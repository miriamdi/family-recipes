import React, { useState, useEffect, useRef } from 'react';
import { hebrew } from '../data/hebrew';
import styles from './AddRecipe.module.css';
import { supabase, useSupabase as libUseSupabase } from '../lib/supabaseClient';
import { getEmojiForName, stripLeadingEmoji } from '../lib/emojiUtils';
import { formatAmountToFraction, parseAmountToDecimal } from '../lib/formatUtils';
export default function AddRecipe({ recipes = [], editMode = false, initialData = null, onRecipeAdded = null, onSave = null, onCancel = null, user = null, displayName = null, userLoading = false, useSupabase: useSupabaseProp = false }) {
  const [recipeName, setRecipeName] = useState('');
  const [image, setImage] = useState('');
  const [category, setCategory] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [useNewCategory, setUseNewCategory] = useState(false);
  const [workTimeValue, setWorkTimeValue] = useState('');
  const [workTimeUnit, setWorkTimeUnit] = useState('דקות');
  const [totalTimeValue, setTotalTimeValue] = useState('');
  const [totalTimeUnit, setTotalTimeUnit] = useState('דקות');
  const [servings, setServings] = useState('');
  const [difficulty, setDifficulty] = useState('easy');
  const [source, setSource] = useState('');
  const [ingredients, setIngredients] = useState([{ type: 'ingredient', product_name: '', unit: '', amount: '', comment: '' }]);
  const [showForm, setShowForm] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);
  const CATEGORY_OPTIONS = [
    'מנות פתיחה',
    'סלטים',
    'מרקים',
    'עיקריות',
    'תוספות',
    'מאפים ולחמים',
    'קינוחים',
    'משקאות'
  ];
  const [categorySuggestions, setCategorySuggestions] = useState([]);
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [productSuggestionsAll, setProductSuggestionsAll] = useState([]);
  const [displayedProductSuggestions, setDisplayedProductSuggestions] = useState([]);
  const [unitSuggestions, setUnitSuggestions] = useState([]);
  const [unitSuggestionsAll, setUnitSuggestionsAll] = useState([]);
  const [displayedUnitSuggestions, setDisplayedUnitSuggestions] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState([]);
  // Import-from-text improved state
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [parsedPreview, setParsedPreview] = useState(null);
  const [previewText, setPreviewText] = useState('');
  const previewRef = useRef(null);

  const toPreviewHTML = (text) => {
    if (!text) return '';
    return text.split(/\r?\n/).map(ln => {
      const t = ln.trim();
      if (!t) return '<div style="height:8px"></div>';
      if (/^(?:שם:|מנות:|זמן הכנה:|סה"?כ:|מצרכים:|הוראות:)/i.test(t)) {
        return `<div style="font-weight:700;margin-bottom:4px">${t}</div>`;
      }
      return `<div style="margin-left:6px;color:#222">${t}</div>`;
    }).join('');
  };

  useEffect(() => {
    if (previewRef.current) {
      // Avoid overwriting the editable content while the user is actively editing
      if (document && document.activeElement === previewRef.current) return;
      const html = toPreviewHTML(previewText || '');
      if (previewRef.current.innerHTML !== html) previewRef.current.innerHTML = html;
    }
  }, [previewText, parsedPreview]);

  useEffect(() => {
    // If used in edit mode, prefill fields from initialData and show the form
    if (editMode && initialData) {
      setShowForm(true);
      setRecipeName(initialData.title || '');
      setImage(getEmojiForName(initialData.title || ''));
      setCategory(initialData.category || '');
      // Convert stored minutes back to a value+unit pair for editing
      const prep = initialData.prep_time ?? initialData.prepTime ?? '';
      const cook = initialData.cook_time ?? initialData.cookTime ?? '';
      if (prep !== '' && prep != null) {
        if (prep % 1440 === 0) {
          setWorkTimeValue(String(prep / 1440));
          setWorkTimeUnit('ימים');
        } else if (prep % 60 === 0) {
          setWorkTimeValue(String(prep / 60));
          setWorkTimeUnit('שעות');
        } else {
          setWorkTimeValue(String(prep));
          setWorkTimeUnit('דקות');
        }
      }
      if (cook !== '' && cook != null) {
        if (cook % 1440 === 0) {
          setTotalTimeValue(String(cook / 1440));
          setTotalTimeUnit('ימים');
        } else if (cook % 60 === 0) {
          setTotalTimeValue(String(cook / 60));
          setTotalTimeUnit('שעות');
        } else {
          setTotalTimeValue(String(cook));
          setTotalTimeUnit('דקות');
        }
      }
      // Prefer textual servings when available for editing (e.g. "4-6", "לחצי מנה")
      setServings(initialData.servings_text ?? initialData.servings ?? '');
      // Map english difficulty back to Hebrew options
      const diffMap = { easy: 'קל', medium: 'בינוני', hard: 'קשה' };
      setDifficulty(diffMap[initialData.difficulty] || initialData.difficulty || 'easy');
      setSource(initialData.source || '');
      setIngredients(Array.isArray(initialData.ingredients) ? initialData.ingredients.map(i => i.type === 'subtitle' ? { type: 'subtitle', text: i.text } : { type: 'ingredient', product_name: i.product_name || i.name || '', unit: i.unit || '', amount: i.amount_raw ?? i.amount ?? i.qty ?? '', comment: i.comment || '' }) : [{ type: 'ingredient', product_name: '', unit: '', amount: '', comment: '' }]);
      setInstructions(Array.isArray(initialData.steps) ? initialData.steps.join('\n') : (initialData.steps || ''));
      // tags
      setTags(Array.isArray(initialData.tags) ? initialData.tags : (initialData.tags ? initialData.tags : []));
    }
    // build category list from provided `recipes` only (DB-sourced)
    const cats = Array.from(new Set((recipes || []).map(r => r.category).filter(Boolean)));
    setCategories(cats);

    // Also build suggestions for products/units from the provided `recipes` as a fallback
    try {
      const products = new Set();
      const units = new Set();
      const tagSet = new Set();
      (recipes || []).forEach(r => {
        if (!r || !Array.isArray(r.ingredients)) return;
        r.ingredients.forEach(item => {
          if (!item) return;
          // skip explicit subtitle rows, otherwise treat as ingredient entry
          if (item.type === 'subtitle') return;
          const pname = String(item.product_name ?? item.name ?? '').trim();
          const unit = String(item.unit ?? '').trim();
          if (pname) products.add(pname.toLowerCase());
          if (unit) units.add(unit.toLowerCase());
        });
        if (Array.isArray(r.tags)) {
          r.tags.forEach(t => { if (t) tagSet.add(String(t).toLowerCase()); });
        }
      });
      const prodList = Array.from(products).map(p => p.charAt(0).toUpperCase() + p.slice(1));
      const unitList = Array.from(units).map(u => u.charAt(0).toUpperCase() + u.slice(1));
      const tagList = Array.from(tagSet).map(t => t.charAt(0).toUpperCase() + t.slice(1));
      if (prodList.length) {
        setProductSuggestions(prodList);
        setProductSuggestionsAll(prodList);
        setDisplayedProductSuggestions(prodList);
      }
      if (unitList.length) {
        setUnitSuggestions(unitList);
        setUnitSuggestionsAll(unitList);
        setDisplayedUnitSuggestions(unitList);
      }
      if (tagList.length) setTagSuggestions(tagList);
    } catch (err) {
      // ignore
    }
  }, [recipes]);

  useEffect(() => {
    // Use the emoji utility to generate an emoji from the recipe name (modular & data-driven)
    try {
      const e = getEmojiForName(recipeName || '');
      setImage(e);
    } catch (err) {
      // keep a safe fallback
      setImage('🍽️');
    }
  }, [recipeName]);

  useEffect(() => {
    // Only fetch suggestions from Supabase (use DB as single source of truth)
    const fetchSuggestions = async () => {
      // If Supabase not configured, leave fallback suggestions (from `recipes`) intact
      if (!(useSupabaseProp || libUseSupabase) || !supabase) {
        return;
      }
      try {
        const { data: catData } = await supabase.from('recipes').select('category').not('category', 'is', null);
        const cats = Array.from(new Set((catData || []).map(r => r.category).filter(Boolean)));
        setCategorySuggestions(cats);

        const { data: ingData } = await supabase.from('recipes').select('ingredients').not('ingredients', 'is', null);
        const products = new Set();
        const units = new Set();
        (ingData || []).forEach(r => {
          if (!r || !Array.isArray(r.ingredients)) return;
          r.ingredients.forEach(item => {
            if (!item) return;
            if (item.type === 'subtitle') return;
            const pname = String(item.product_name ?? item.name ?? '').trim();
            const unit = String(item.unit ?? '').trim();
            if (pname) products.add(pname.toLowerCase());
            if (unit) units.add(unit.toLowerCase());
          });
        });
        const prodList = Array.from(products).map(p => p.charAt(0).toUpperCase() + p.slice(1));
        const unitList = Array.from(units).map(u => u.charAt(0).toUpperCase() + u.slice(1));
          setProductSuggestions(prodList);
          setProductSuggestionsAll(prodList);
          setDisplayedProductSuggestions(prodList);
          setUnitSuggestions(unitList);
          setUnitSuggestionsAll(unitList);
          setDisplayedUnitSuggestions(unitList);
          // fetch tags from DB suggestions
          try {
            const { data: tagData } = await supabase.from('recipes').select('tags').not('tags', 'is', null);
            const tset = new Set();
            (tagData || []).forEach(r => {
              if (!r || !Array.isArray(r.tags)) return;
              r.tags.forEach(t => { if (t) tset.add(String(t).toLowerCase()); });
            });
            const tlist = Array.from(tset).map(t => t.charAt(0).toUpperCase() + t.slice(1));
            if (tlist.length) setTagSuggestions(tlist);
          } catch (e) {
            // ignore
          }
      } catch (err) {
        console.warn('Failed to fetch suggestions from Supabase:', err);
        setCategorySuggestions([]);
        setProductSuggestions([]);
        setUnitSuggestions([]);
      }
    };
    fetchSuggestions();
  }, [recipes, useSupabaseProp, libUseSupabase, supabase]);

  // update a specific ingredient row `i`, field `field`, with `value`
  const handleIngredientChange = (i, field, value) => {
    // If user types fraction-like input in the amount field or unit field, normalize immediately
    if (field === 'amount') {
      const s = String(value || '').trim();
      // If contains slash or unicode fraction characters, convert to decimal string
      if (/[\u00BC-\u00BE\u2150-\u215E]|\//.test(s)) {
        try {
          const dec = parseAmountToDecimal(s);
          // Preserve empty when parse fails
          const out = Number.isFinite(dec) ? String(Math.round(dec * 10000) / 10000) : s.replace(',', '.');
          setIngredients(prev => prev.map((ing, idx) => idx === i ? ({ ...ing, [field]: out }) : ing));
          return;
        } catch (err) {
          // fall back to storing raw
        }
      }
      // Normalize comma to dot for decimal entry
      const normalized = s.replace(',', '.');
      setIngredients(prev => prev.map((ing, idx) => idx === i ? ({ ...ing, [field]: normalized }) : ing));
      return;
    }

    if (field === 'unit') {
      // If unit contains a fraction token like "1/4" or "½", extract it into amount
      const unitVal = String(value || '').trim();
      const fracFinder = /(\d+\s+\d+\/\d+|\d+\/\d+|[\u00BC-\u00BE\u2150-\u215E]|\d+(?:[.,]\d+)?)/;
      const m = unitVal.match(fracFinder);
      if (m) {
        const fracToken = m[0];
        const dec = parseAmountToDecimal(fracToken);
        const decStr = Number.isFinite(dec) ? String(Math.round(dec * 10000) / 10000) : fracToken.replace(',', '.');
        const newUnit = unitVal.replace(fracToken, '').trim();
        setIngredients(prev => prev.map((ing, idx) => idx === i ? ({ ...ing, unit: newUnit, amount: decStr }) : ing));
        return;
      }
    }

    setIngredients(prev => prev.map((ing, idx) => idx === i ? ({ ...ing, [field]: value }) : ing));

    // If the user is typing product name or unit, filter the visible suggestions
    if (field === 'product_name') {
      const master = productSuggestionsAll.length ? productSuggestionsAll : productSuggestions;
      const filtered = value ? master.filter(p => p.toLowerCase().includes(value.toLowerCase())) : master;
      setDisplayedProductSuggestions(filtered);
    }

    if (field === 'unit') {
      const master = unitSuggestionsAll.length ? unitSuggestionsAll : unitSuggestions;
      const filtered = value ? master.filter(u => u.toLowerCase().includes(value.toLowerCase())) : master;
      setDisplayedUnitSuggestions(filtered);
    }
  };

  const addTag = (t) => {
    if (!t) return;
    const v = String(t).trim();
    if (!v) return;
    setTags(prev => prev.includes(v) ? prev : [...prev, v]);
    setTagInput('');
  };

  const removeTag = (idx) => {
    setTags(prev => prev.filter((_, i) => i !== idx));
  };

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.trim().replace(/,$/, '');
      addTag(val);
    } else if (e.key === 'Escape') {
      setTagInput('');
    }
  };

  // --- Improved import/parsing helpers ---
  const handleFileUpload = async (file) => {
    setImportError('');
    setParsedPreview(null);
    if (!file) return;
    try {
      const txt = await file.text();
      setImportText(txt);
    } catch (err) {
      setImportError('שגיאה בקריאת הקובץ');
    }
  };

  const normalize = (s) => s.replace(/\t/g, ' ').replace(/\u00A0/g, ' ').trim();

  const parseIngredientLine = (line) => {
    let l = normalize(line).replace(/^[-*•\s]+/, '');
    // Try to extract amount (1 1/2, 1/2, 2.5, 2) including unicode vulgar fractions and mixed forms like "1½"
    const unicodeFracs = '\u00BD\u00BC\u00BE\u2150-\u215E';
    // Capture any leading chunk made of digits, unicode vulgar fractions, slashes, dots, commas and spaces
    const amountRe = new RegExp('^([0-9' + unicodeFracs + '\/\\s\\.,]+)');
    let amount = '';
    const m = l.match(amountRe);
    if (m) {
      const token = m[1].trim();
      try {
        const dec = parseAmountToDecimal(token);
        amount = Number.isFinite(dec) ? String(dec) : token.replace(',', '.');
      } catch (err) {
        amount = token.replace(',', '.');
      }
      l = l.slice(m[0].length).trim();
    }

    // Next token might be unit (short). If unit exists but no explicit amount, assume amount = 1
    let unit = '';
    const tokens = l.split(/\s+/);

    const isFractionToken = (t) => {
      if (!t) return false;
      const fracRe = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?|[½¼¾⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])$/;
      return fracRe.test(t);
    };

    if (tokens.length >= 1) {
      const maybeUnit = tokens[0].replace(/[.,;:]$/,'');
      const knownUnits = ['g','gr','gram','grams','kg','cup','cups','tbsp','tablespoon','tsp','teaspoon','ml','l','ltr','מ"ל','מל','גרם','כוס','כוסות','כף','כפות','כפית','כפיות','חתיכה','פרוסה','יחידה'];
      if (knownUnits.includes(maybeUnit.toLowerCase())) {
        unit = tokens.shift();
        l = tokens.join(' ');
        if (!amount) amount = '1';

        // If immediately after the unit there's a fraction token, treat it as the amount (e.g. "כוסות 1/4")
        if (!amount || amount === '1') {
          const next = tokens[0] ? tokens[0].replace(/[.,;:]$/,'') : '';
          if (isFractionToken(next)) {
            amount = tokens.shift();
            l = tokens.join(' ');
          }
        }
      } else {
        // try to find a unit anywhere in the tokens (e.g. "שמן כף" or "ביצה כ" )
        for (let i = 0; i < tokens.length; i++) {
          const t = tokens[i].replace(/[.,;:]$/,'');
          if (knownUnits.includes(t.toLowerCase())) {
            unit = tokens.splice(i, 1)[0];
            l = tokens.join(' ');
            if (!amount) amount = '1';

            // If a following token is a fraction, pull it into amount
            const next = tokens[0] ? tokens[0].replace(/[.,;:]$/,'') : '';
            if (isFractionToken(next)) {
              amount = tokens.shift();
              l = tokens.join(' ');
            }
            break;
          }
        }
      }
    }

    // Separate comment inside parentheses or after comma
    let comment = '';
    const paren = l.match(/\(([^)]+)\)/);
    if (paren) {
      comment = paren[1].trim();
      l = l.replace(/\([^)]*\)/g, '').trim();
    } else if (l.includes(',')) {
      const parts = l.split(',');
      l = parts.shift().trim();
      comment = parts.join(',').trim();
    }

    return { type: 'ingredient', product_name: l, unit, amount, comment };
  };

  const parseRecipeText = (text) => {
    setImportError('');
    setParsedPreview(null);
    setPreviewText(text || '');
    if (!text || !text.trim()) {
      setImportError('אין טקסט לייבא');
      return null;
    }

    const rawLinesAll = text.split(/\r?\n/);
    const rawLines = rawLinesAll.map(l => l.trim()).filter(Boolean);
    if (!rawLines.length) {
      setImportError('אין טקסט תקף');
      return null;
    }

    const headerIs = (line) => {
      if (!line) return null;
      const l = line.trim();
      if (/^(?:שם|title)\s*[:\-]/i.test(l)) return 'title';
      if (/^(?:מנות|servings)\s*[:\-]/i.test(l)) return 'servings';
      if (/^(?:זמן הכנה|prep(?: time)?|זמן|time)\s*[:\-]/i.test(l)) return 'time';
      if (/^(?:סה\\"כ|total|cook(?: time)?)\s*[:\-]/i.test(l)) return 'total';
      if (/^(?:מצרכים|מרכיבים|ingredients)\s*[:\-]/i.test(l)) return 'ingredients';
      if (/^(?:הוראות|אופן הכנה|הוראות הכנה|instructions|steps)\s*[:\-]/i.test(l)) return 'steps';
      return null;
    };

    let title = '';
    let ingLines = [];
    let stepLines = [];
    let foundServings = '';
    let foundPrep = '';
    let foundTotal = '';

    let currentSection = null;
    for (let i = 0; i < rawLinesAll.length; i++) {
      const line = rawLinesAll[i];
      const h = headerIs(line);
      if (h) {
        currentSection = h;
        const after = line.split(/[:\-]/).slice(1).join(':').trim();
        if (after) {
          if (h === 'title') title = after;
          if (h === 'servings') foundServings = (after.match(/\d+/) || [''])[0];
          if (h === 'time') foundPrep = (after.match(/\d+/) || [''])[0];
          if (h === 'total') foundTotal = (after.match(/\d+/) || [''])[0];
        }
        continue;
      }
      if (!currentSection) continue;
      if (currentSection === 'title') {
        if (!title) title = line.trim();
      } else if (currentSection === 'ingredients') {
        if (line.trim()) ingLines.push(line.trim());
      } else if (currentSection === 'steps') {
        if (line.trim()) stepLines.push(line.trim());
      } else if (currentSection === 'servings') {
        if (!foundServings) foundServings = (line.match(/\d+/) || [''])[0];
      } else if (currentSection === 'time') {
        if (!foundPrep) foundPrep = (line.match(/\d+/) || [''])[0];
      } else if (currentSection === 'total') {
        if (!foundTotal) foundTotal = (line.match(/\d+/) || [''])[0];
      }
    }

    const hadExplicitSections = Boolean(title || ingLines.length || stepLines.length || foundServings || foundPrep || foundTotal);

    let parsedIngredients = [];
    let parsedSteps = [];
    if (hadExplicitSections && (ingLines.length || stepLines.length || title)) {
      parsedIngredients = ingLines.map(parseIngredientLine);
      parsedSteps = stepLines.map(s => s.replace(/^\d+\.\s*/, '').trim());
    } else {
      const isIngredientsHeader = (s) => /^(ingredients|מצרכים|מרכיבים)/i.test(s);
      const isStepsHeader = (s) => /^(instructions|steps|אופן הכנה|הוראות|אופן ההכנה)/i.test(s);

      let titleCandidate = rawLines[0];
      if (isIngredientsHeader(titleCandidate) || isStepsHeader(titleCandidate)) {
        titleCandidate = rawLines.slice(0, 4).find(l => !isIngredientsHeader(l) && !isStepsHeader(l)) || rawLines[0];
      }
      title = titleCandidate || title;

      let ingStart = -1, ingEnd = -1, stepsStart = -1;
      rawLines.forEach((ln, idx) => {
        if (isIngredientsHeader(ln)) { if (ingStart === -1) ingStart = idx + 1; }
        if (isStepsHeader(ln)) { if (stepsStart === -1) stepsStart = idx + 1; if (ingStart !== -1 && ingEnd === -1) ingEnd = idx - 1; }
      });

      rawLines.forEach(l => {
        const mS = l.match(/(?:servings|מנות)[:\s]*([0-9]+)/i);
        if (mS) foundServings = mS[1];
        const mPrep = l.match(/(?:prep(?: time)?|זמן עבודה|הכנה)[:\s]*([0-9]+)/i);
        if (mPrep) foundPrep = mPrep[1];
        const mCook = l.match(/(?:cook(?: time)?|total|זמן כולל|סך)[:\s]*([0-9]+)/i);
        if (mCook) foundTotal = mCook[1];
      });

      if (ingStart === -1) {
        const cand = rawLines.map((l, idx) => ({ l, idx })).filter(({ l }) => /^[-*•\d\s]/.test(l) || /\d+\s*(g|gr|kg|cup|כוס|גרם|מ"ל)/i.test(l));
        if (cand.length) { ingStart = cand[0].idx; ingEnd = cand[cand.length - 1].idx; }
      }
      if (ingStart !== -1 && ingEnd === -1) ingEnd = Math.min(rawLines.length - 1, ingStart + 200);

      if (stepsStart === -1) {
        if (ingEnd !== -1 && ingEnd + 1 < rawLines.length) stepsStart = ingEnd + 1;
        else {
          const sIdx = rawLines.findIndex(l => /^\d+\./.test(l) || /^[ivx]+\./i.test(l));
          if (sIdx !== -1) stepsStart = sIdx;
        }
      }

      const ingredientLines = (ingStart !== -1 && ingEnd !== -1) ? rawLines.slice(ingStart, ingEnd + 1) : [];
      const stepLinesFallback = (stepsStart !== -1) ? rawLines.slice(stepsStart) : [];

      parsedIngredients = ingredientLines.length ? ingredientLines.map(parseIngredientLine) : [];
      parsedSteps = stepLinesFallback.length ? stepLinesFallback.map(s => s.replace(/^\d+\.\s*/, '').trim()) : [];
    }

    const parsed = { title: title || '', ingredients: parsedIngredients, steps: parsedSteps, servings: foundServings, prep: foundPrep, total: foundTotal };
    setParsedPreview(parsed);

    const buildPreviewText = (p) => {
      const lines = [];
      if (p.title) lines.push(`שם: ${p.title}`);
      if (p.servings) lines.push(`מנות: ${p.servings}`);
      if (p.prep) lines.push(`זמן הכנה: ${p.prep}`);
      if (p.total) lines.push(`סה"כ: ${p.total}`);
      if (lines.length) lines.push('');
      lines.push('מצרכים:');
      if (p.ingredients && p.ingredients.length) {
        p.ingredients.forEach(ing => {
          const amt = ing.amount ? ing.amount + ' ' : '';
          const u = ing.unit ? ing.unit + ' ' : '';
          const c = ing.comment ? ` (${ing.comment})` : '';
          lines.push(`${amt}${u}${ing.product_name}${c}`.trim());
        });
      }
      lines.push('');
      lines.push('הוראות:');
      if (p.steps && p.steps.length) p.steps.forEach(s => lines.push(s));
      return lines.join('\n');
    };

    setPreviewText(buildPreviewText(parsed));
    return parsed;
  };

  const applyParsedPreview = (parsed) => {
    const p = parsed || parsedPreview;
    if (!p) return;
    setRecipeName(p.title || '');
    if (p.ingredients && p.ingredients.length) setIngredients(p.ingredients);
    if (p.steps && p.steps.length) setInstructions(p.steps.join('\n'));
    if (p.servings) setServings(p.servings);
    if (p.prep) {
      setWorkTimeValue(String(p.prep));
      setWorkTimeUnit('דקות');
    }
    if (p.total) {
      setTotalTimeValue(String(p.total));
      setTotalTimeUnit('דקות');
    }
    setShowImport(false);
  };

  const moveRowUp = (i) => {
    if (i <= 0) return;
    setIngredients(prev => {
      const arr = [...prev];
      const tmp = arr[i - 1];
      arr[i - 1] = arr[i];
      arr[i] = tmp;
      return arr;
    });
  };

  const moveRowDown = (i) => {
    setIngredients(prev => {
      if (i >= prev.length - 1) return prev;
      const arr = [...prev];
      const tmp = arr[i + 1];
      arr[i + 1] = arr[i];
      arr[i] = tmp;
      return arr;
    });
  };

  const addIngredientRow = () => {
    setIngredients(prev => [...prev, { type: 'ingredient', product_name: '', unit: '', amount: '', comment: '' }]);
  };

  const addSubtitleRow = () => {
    setIngredients(prev => [...prev, { type: 'subtitle', text: '' }]);
  };

  const removeIngredientRow = (i) => {
    setIngredients(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (userLoading) {
      setError('טוען נתוני התחברות...');
      return;
    }

    if (!recipeName || !category || !workTimeValue || !totalTimeValue || !servings || !difficulty || !source || ingredients.length === 0 || !instructions.trim()) {
      setError("בבקשה למלא את כל השדות הנדרשים");
      return;
    }

    const finalCategory = useNewCategory && newCategory ? newCategory : category || '';

    // Map Hebrew difficulty to English
    const difficultyMap = { 'קל': 'easy', 'בינוני': 'medium', 'קשה': 'hard' };
    const englishDifficulty = difficultyMap[difficulty] || difficulty;

    // Ensure the emoji becomes part of the title string when saving (not an <img> or separate field).
    // Strip any known leading emoji (from our generator) first, then prepend the generated emoji exactly once.
    const trimmedName = recipeName.trim();
    const nameWithoutKnownEmoji = stripLeadingEmoji(trimmedName);
    const emojiToPrepend = image || '';
    const finalTitle = nameWithoutKnownEmoji.startsWith(emojiToPrepend) || nameWithoutKnownEmoji.startsWith((emojiToPrepend + ' '))
      ? nameWithoutKnownEmoji
      : (emojiToPrepend ? `${emojiToPrepend} ${nameWithoutKnownEmoji}` : nameWithoutKnownEmoji);

    const numericServings = (() => {
      const parsed = parseInt(String(servings).replace(/[^0-9\-]/g, ''), 10);
      return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
    })();

    // We store numeric minutes in the DB (prep_time / cook_time).
    // Avoid relying on textual "*_time_text" columns for core logic.

    const payload = {
      title: finalTitle,
      description: '',
      // Do NOT store the emoji as an image URL. Leave `image` empty by default (emoji is in the title).
      image: '',
      category: finalCategory,
      prep_time: (function() {
        const v = parseFloat(String(workTimeValue).replace(',', '.')) || 0;
        if (workTimeUnit === 'שעות') return Math.round(v * 60);
        if (workTimeUnit === 'ימים') return Math.round(v * 1440);
        return Math.round(v);
      })(),
      cook_time: (function() {
        const v = parseFloat(String(totalTimeValue).replace(',', '.')) || 0;
        if (totalTimeUnit === 'שעות') return Math.round(v * 60);
        if (totalTimeUnit === 'ימים') return Math.round(v * 1440);
        return Math.round(v);
      })(),
      // send numeric servings for DB compatibility and also the original text
      servings: numericServings,
      servings_text: (servings || '').toString(),
      difficulty: englishDifficulty,
      source,
      ingredients: ingredients.filter(i => i.type === 'ingredient' ? i.product_name.trim() : i.text.trim()).map(i => {
        if (i.type === 'ingredient') {
          // parse amount entered as fraction or decimal into a numeric value for storage
          let rawInput = (i.amount != null) ? String(i.amount).trim() : '';
          let unitField = (i.unit || '').trim();

          // If user accidentally put fraction inside the unit field (e.g. "כוסות 1/4"), extract it
          const fracFinder = /(\d+\s+\d+\/\d+|\d+\/\d+|[½¼¾⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]|\d+(?:[.,]\d+)?)/;
          if ((!rawInput || rawInput === '') && unitField) {
            const m = unitField.match(fracFinder);
            if (m) {
              rawInput = m[0];
              unitField = unitField.replace(m[0], '').trim();
            }
          }

          // If both amount and unit contain numbers/fractions, merge them into a mixed amount
          if (rawInput && unitField) {
            const m2 = unitField.match(fracFinder);
            if (m2) {
              rawInput = `${rawInput} ${m2[0]}`;
              unitField = unitField.replace(m2[0], '').trim();
            }
          }

          const amt = parseAmountToDecimal(rawInput);
          return { product_name: i.product_name.trim(), unit: unitField, amount: amt, amount_raw: rawInput, comment: (i.comment || '').trim() };
        } else {
          return { type: 'subtitle', text: i.text.trim() };
        }
      }),
      steps: instructions.split('\n').map(s => s.trim()).filter(Boolean)
      ,
      tags: tags.map(t => String(t).trim()).filter(Boolean)
    };

    // If Supabase is configured, attempt to save there (requires authenticated + approved user)
    if ((useSupabaseProp || libUseSupabase) && supabase) {
      try {
        const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !authUser?.id) {
          alert('אנא התחברו כדי להוסיף מתכון');
          return;
        }

        setSubmitting(true);
        if (!editMode) {
          // Use edge function for validation and insert
          const RECIPE_SUBMIT_API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recipe-submit`;
          console.log('Calling recipe submit API:', RECIPE_SUBMIT_API);

          let res;
          try {
            // Prefer Supabase client invoke (includes auth) when available
            if (supabase && supabase.functions && typeof supabase.functions.invoke === 'function') {
              console.log('Invoking Supabase function recipe-submit via client');
              res = await supabase.functions.invoke('recipe-submit', {
                body: JSON.stringify({ ...payload, user_id: authUser.id, user_email: authUser.email })
              });
              // `res` will be a Response-like object from supabase-js; normalize below
            } else {
              res = await fetch(RECIPE_SUBMIT_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payload, user_id: authUser.id, user_email: authUser.email })
              });
            }
            console.log('recipe-submit response status:', res?.status);
          } catch (fetchErr) {
            console.error('Fetch error when calling recipe-submit:', fetchErr);
            const msg = fetchErr && fetchErr.message ? fetchErr.message : String(fetchErr);
            if (msg.includes('Failed to fetch')) {
              setError('שגיאת רשת או CORS בעת שליחת המתכון (Failed to fetch)');
            } else {
              setError('שגיאת רשת בעת שליחת המתכון: ' + msg);
            }
            setSubmitting(false);
            return;
          }

          // Normalize supabase-js invoke return which wraps response data in { data, error }
          let inserted = null;
          if (res && typeof res.json === 'function') {
            // fetch Response
            if (!res.ok) {
              let bodyText = '';
              try { bodyText = await res.text(); } catch (e) { bodyText = '[unable to read response body]'; }
              console.error('recipe-submit returned non-OK:', { status: res.status, body: bodyText });
              if (res.status === 401 || res.status === 403) {
                setError('שגיאת הרשאה (401/403) בעת שמירה — ודאו שאתם מחוברים ומורשים.');
              } else if (res.status === 404) {
                setError('הפונקציה לא נמצאה (404) — ודאו שהפונקציה פרוסה ו-URL נכון.');
              } else {
                try { const j = JSON.parse(bodyText || '{}'); setError(j.error || `שגיאה בשרת שמירת המתכון (status ${res.status})`); } catch (e) { setError(`שגיאה בשרת שמירת המתכון (status ${res.status})`); }
              }
              setSubmitting(false);
              return;
            }
            inserted = await res.json();
          } else if (res && res.data) {
            // supabase-js function invoke returns { data, error }
            if (res.error) {
              console.error('recipe-submit returned error:', res.error);
              setError(res.error.message || 'שגיאה בשמירת המתכון');
              setSubmitting(false);
              return;
            }
            inserted = res.data;
          }

          // Ensure the UI-facing recipe preserves `servings_text` when provided by the form payload.
          console.debug('recipe-submit inserted result:', inserted);
          const uiRecipe = inserted ? { ...inserted, prepTime: inserted.prep_time, cookTime: inserted.cook_time, servings_text: payload.servings_text ?? inserted.servings_text ?? null } : null;
          if (!uiRecipe || !uiRecipe.id) {
            // If there was no explicit error but no row returned, attempt a direct insert via Supabase client as a fallback
            console.warn('Insert succeeded with no row returned from recipe-submit; attempting direct client insert');
            try {
              if (supabase) {
                // Attach user info to payload for DB insert
                const clientPayload = { ...payload, user_id: authUser.id, user_email: authUser.email };
                // Try insert; if DB lacks optional *_text columns, retry without them
                const tryInsert = async (p) => await supabase.from('recipes').insert(p).select().single();
                let { data: clientInserted, error: clientErr } = await tryInsert(clientPayload);
                if (clientErr) {
                  console.warn('Client insert error, checking for missing *_text columns:', clientErr.message || clientErr);
                  const lower = (clientErr?.message || '').toLowerCase();
                  const maybeMissing = ['cook_time_text', 'prep_time_text', 'servings_text'].filter(c => lower.includes(c));
                  if (maybeMissing.length) {
                    maybeMissing.forEach(c => delete clientPayload[c]);
                    const { data: clientInserted2, error: clientErr2 } = await tryInsert(clientPayload);
                    clientInserted = clientInserted2;
                    clientErr = clientErr2;
                  }
                }

                if (clientErr || !clientInserted || !clientInserted.id) {
                  console.error('Direct client insert failed', clientErr);
                  setError('שגיאה: הוספת המתכון נכשלה — יש לבדוק את לוג השרת.');
                  // still trigger a refetch in parent to be safe
                  onRecipeAdded && onRecipeAdded(null, { refetch: true });
                  setSubmitting(false);
                  return;
                }

                const uiFromClient = { ...clientInserted, prepTime: clientInserted.prep_time, cookTime: clientInserted.cook_time, servings_text: clientInserted.servings_text ?? payload.servings_text };
                setMessage(hebrew.successMessage);
                setTimeout(() => {
                  onRecipeAdded && onRecipeAdded(uiFromClient, { refetch: true });
                  setShowForm(false);
                  setMessage('');
                  setSubmitting(false);
                }, 800);
                return;
              } else {
                console.error('Supabase client not available for fallback insert');
                setError('שגיאה פנימית: לקוח Supabase לא זמין');
                setSubmitting(false);
                return;
              }
            } catch (cliErr) {
              console.error('Fallback client insert exception', cliErr);
              setError('שגיאה בהוספת המתכון (fallback): ' + (cliErr?.message || String(cliErr)));
              onRecipeAdded && onRecipeAdded(null, { refetch: true });
              setSubmitting(false);
              return;
            }
          }

          setMessage(hebrew.successMessage);
          setTimeout(() => {
            onRecipeAdded && onRecipeAdded(uiRecipe, { refetch: true });
            setShowForm(false);
            setMessage('');
            setSubmitting(false);
          }, 800);
          return;
        }
        // EDIT MODE: update existing recipe in-place with retry for missing *_text columns
        try {
          const id = initialData?.id || initialData?.recipe_id || initialData?.recipeId;
          if (!id) {
            setError('אין מזהה מתכון לעדכון');
            setSubmitting(false);
            return;
          }

          // Attempt to update the recipe row directly via Supabase client
          const attemptUpdate = async (obj) => {
            return await supabase.from('recipes').update(obj).eq('id', id).select().single();
          };

          let { data: updatedRow, error: updateErr } = await attemptUpdate(payload);

          if (updateErr) {
            console.warn('Initial update error, checking for missing columns:', updateErr.message || updateErr);
            const lower = (updateErr?.message || '').toLowerCase();
            const maybeMissing = ['cook_time_text', 'prep_time_text', 'servings_text'].filter(c => lower.includes(c));
            if (maybeMissing.length) {
              // retry without the missing columns
              const retryPayload = { ...payload };
              maybeMissing.forEach(c => delete retryPayload[c]);
              const { data: updatedRow2, error: updateErr2 } = await attemptUpdate(retryPayload);
              if (updateErr2) {
                console.error('Retry update failed', updateErr2);
                setError(updateErr2.message || 'שגיאה בעדכון המתכון');
                setSubmitting(false);
                return;
              }
              updatedRow = updatedRow2;
            } else {
              console.error('Supabase update error', updateErr);
              const msg = updateErr?.message || String(updateErr);
              if (msg.includes('Failed to fetch')) {
                setError('שגיאת רשת או CORS בעת שליחת המתכון (Failed to fetch)');
              } else if (updateErr?.status === 401 || updateErr?.status === 403) {
                setError('שגיאת הרשאה בעת עדכון — בדקו את ההתחברות.');
              } else {
                setError(updateErr.message || 'שגיאה בעדכון המתכון');
              }
              setSubmitting(false);
              return;
            }
          }

          const uiRecipe = updatedRow ? { ...updatedRow, prepTime: updatedRow.prep_time, cookTime: updatedRow.cook_time, servings_text: payload.servings_text ?? updatedRow.servings_text ?? null } : null;
          setMessage('העדכון בוצע בהצלחה');
          setTimeout(() => {
            onSave && onSave(uiRecipe);
            setShowForm(false);
            setMessage('');
            setSubmitting(false);
          }, 600);
          return;
        } catch (err) {
          console.error('Unexpected error during update', err);
          const msg = err?.message || String(err);
          if (msg.includes('Failed to fetch')) {
            setError('שגיאת רשת או CORS בעת שליחת המתכון (Failed to fetch)');
          } else {
            setError('שגיאה בשמירה בשרת: ' + msg);
          }
          setSubmitting(false);
        }
      } catch (err) {
        console.error('Supabase insert unexpected error', err);
        setError(err?.message || 'שגיאה בשמירה בשרת');
        setSubmitting(false);
      }

      return;
    }

    // Do NOT save locally — require Supabase DB. If DB not available, return an error.
    setError('אין חיבור לשרת שמירת מתכונים (Supabase) — שמירה דורשת חיבור למסד נתונים.');
    setSubmitting(false);
    return;
  };

  if (!showForm) {
    return (
      <button className={styles.addRecipeButton} onClick={() => setShowForm(true)}>
        {hebrew.addRecipe}
      </button>
    );
  }

  return (
    <div className={styles.addRecipeModal}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>{editMode ? 'עדכון מתכון' : hebrew.addRecipe}</h2>
          <button
            className={styles.closeButton}
              onClick={() => {
                setShowForm(false);
              setError('');
              setMessage('');
              setRecipeName('');
              setImage('');
              setCategory('');
              setNewCategory('');
              setUseNewCategory(false);
              setWorkTimeValue('');
              setWorkTimeUnit('דקות');
              setTotalTimeValue('');
              setTotalTimeUnit('דקות');
              setServings('');
              setDifficulty('easy');
              setSource('');
              setIngredients([{ type: 'ingredient', product_name: '', unit: '', amount: '', comment: '' }]);
              setInstructions('');
                if (editMode && onCancel) onCancel();
            }}
          >
            ✕
          </button>
        </div>

        {message && <div className={styles.successMessage}>{message}</div>}
        {error && <div className={styles.errorMessage}>{error}</div>}

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label>גרסה חלקית: ייבוא מתכון מטקסט / קובץ</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <button type="button" className={styles.addIngredient} onClick={() => { setShowImport(s => !s); setParsedPreview(null); }}>{showImport ? 'הסתרת ייבוא' : 'ייבא מטקסט'}</button>
              <input type="file" accept=".txt" onChange={e => handleFileUpload(e.target.files && e.target.files[0])} />
            </div>
            {showImport && (
              <>
                <textarea placeholder="נא להדביק כאן את הטקסט של המתכון" value={importText} onChange={e => setImportText(e.target.value)} rows={6} />
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button type="button" className={styles.addIngredient} onClick={() => parseRecipeText(importText)}>פענח והצג תצוגה מקדימה</button>
                  <button type="button" className={styles.cancelButton} onClick={() => { setImportText(''); setImportError(''); setParsedPreview(null); }}>נקה</button>
                </div>
                {importError && <div className={styles.errorMessage} style={{ marginTop: 6 }}>{importError}</div>}
                {parsedPreview && (
                  <div style={{ border: '1px solid #ddd', padding: 8, marginTop: 8 }}>
                    <strong>תצוגה מקדימה (טקסט עריכה):</strong>
                    <div style={{ marginTop: 6 }}>
                      <div
                        ref={previewRef}
                        contentEditable
                        role="textbox"
                        aria-label="תצוגה מקדימה טקסט עריכה"
                        onInput={e => {
                          // Convert the editable HTML to newline-preserving plain text
                          const html = e.currentTarget.innerHTML || '';
                          // Replace divs and brs with newlines
                          let withLines = html.replace(/<div\s*[^>]*>/gi, '\n')
                                             .replace(/<br\s*\/?\s*>/gi, '\n')
                                             .replace(/<\/div>/gi, '');
                          // Strip any remaining tags
                          withLines = withLines.replace(/<[^>]+>/g, '');
                          // Normalize multiple newlines
                          withLines = withLines.replace(/\n{2,}/g, '\n\n').replace(/^\n/, '');
                          setPreviewText(withLines);
                        }}
                        style={{ width: '100%', minHeight: 180, padding: 8, outline: 'none', border: '1px solid #eee', background: '#fff', whiteSpace: 'pre-wrap' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button type="button" className={styles.addIngredient} onClick={() => parseRecipeText(previewText)}>פענח/עדכן תצוגה</button>
                      <button type="button" className={styles.submitButton} onClick={() => { const parsed = parseRecipeText(previewText); if (parsed) applyParsedPreview(parsed); }}>המתכון נכון, נא להחיל לטופס!</button>
                      <button type="button" className={styles.cancelButton} onClick={() => { setParsedPreview(null); setPreviewText(''); }}>ביטול תצוגה</button>
                    </div>
                    <div style={{ marginTop: 8, color: '#666' }}>אפשר לערוך את הטקסט לפי הצורך (כותרת, מצרכים בשורות, הוראות בשורות).</div>
                  </div>
                )}
              </>
            )}
          </div>
          <div className={styles.formGroup}>
            <label>{hebrew.recipeName}</label>
            <div className={styles.nameRow}>
              <div className={styles.inputWithEmojiWrapper}>
                <span className={styles.inputEmojiPrefix} aria-hidden="true">{image}</span>
                <input className={styles.recipeNameInput} type="text" value={recipeName} onChange={e => setRecipeName(e.target.value)} aria-label={hebrew.recipeName} />
              </div>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>{hebrew.categoryLabel}</label>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">נא לבחור קטגוריה</option>
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
              {editMode && category && !CATEGORY_OPTIONS.includes(category) && (
                <option value={category}>{category}</option>
              )}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>תגיות</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                list="tag-suggestions"
                placeholder="יש להוסיף תגית ואז Enter"
                style={{ flex: 1 }}
              />
              <button type="button" className={styles.addIngredient} onClick={() => addTag(tagInput)}>הוספה</button>
            </div>
            <datalist id="tag-suggestions">
              {(tagSuggestions || []).map((t, idx) => <option key={idx} value={t} />)}
            </datalist>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {tags.map((t, i) => (
                <div key={i} className={styles.tagChip}>
                  <span>{t}</span>
                  <button type="button" onClick={() => removeTag(i)}>×</button>
                </div>
              ))}
            </div>
          </div>

            <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>זמן עבודה</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="number" value={workTimeValue} onChange={e => setWorkTimeValue(e.target.value)} min="0" style={{ width: 120 }} />
                <select value={workTimeUnit} onChange={e => setWorkTimeUnit(e.target.value)}>
                  <option value="דקות">דקות</option>
                  <option value="שעות">שעות</option>
                  <option value="ימים">ימים</option>
                </select>
              </div>
            </div>
            <div className={styles.formGroup}>
              <label>זמן הכנה כולל</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="number" value={totalTimeValue} onChange={e => setTotalTimeValue(e.target.value)} min="0" style={{ width: 120 }} />
                <select value={totalTimeUnit} onChange={e => setTotalTimeUnit(e.target.value)}>
                  <option value="דקות">דקות</option>
                  <option value="שעות">שעות</option>
                  <option value="ימים">ימים</option>
                </select>
              </div>
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>{hebrew.servingsLabel}</label>
              <input type="text" value={servings} onChange={e => setServings(e.target.value)} placeholder="" />
            </div>
            <div className={styles.formGroup}>
              <label>{hebrew.difficultyLabel}</label>
              <select value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                <option value="easy">קל</option>
                <option value="medium">בינוני</option>
                <option value="hard">קשה</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>{hebrew.sourceLabel}</label>
            <input type="text" value={source} onChange={e => setSource(e.target.value)} />
          </div>

          <div className={styles.formGroup}>
            <label>{hebrew.ingredientsList}</label>
            {ingredients.map((ing, i) => (
              <div key={i} className={styles.ingredientRow} style={{ marginBottom: 8 }}>
                {ing.type === 'ingredient' ? (
                  <>
                    <input placeholder="שם מוצר" style={{ flex: 2 }} value={ing.product_name} onChange={e => handleIngredientChange(i, 'product_name', e.target.value)} onInput={e => handleIngredientChange(i, 'product_name', e.target.value)} list="product-suggestions" />
                    <input placeholder="כמות" type="text" style={{ width: 100 }} value={ing.amount} onChange={e => handleIngredientChange(i, 'amount', e.target.value)} />
                    <span className={styles.amountFraction} aria-hidden="true">
                      {(() => {
                        const raw = (ing.amount || '').toString().trim();
                        const n = parseFloat(raw.replace(',', '.'));
                        if (Number.isFinite(n)) {
                          const nice = formatAmountToFraction(n);
                          // if nice differs from raw, show hint like "1/4"
                          if (nice && nice !== raw) return nice;
                        }
                        return '';
                      })()}
                    </span>
                    <input placeholder='יחידה / גרם / מ"ל...' style={{ width: 120 }} value={ing.unit} onChange={e => handleIngredientChange(i, 'unit', e.target.value)} onInput={e => handleIngredientChange(i, 'unit', e.target.value)} list="unit-suggestions" />
                    <input placeholder="הערה [אם יש]" style={{ width: 160 }} value={ing.comment} onChange={e => handleIngredientChange(i, 'comment', e.target.value)} />
                  </>
                ) : (
                  <input placeholder="כותרת חלק (למשל: לבצק)" style={{ flex: 1 }} value={ing.text} onChange={e => handleIngredientChange(i, 'text', e.target.value)} />
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <button type="button" title="הזז למעלה" onClick={() => moveRowUp(i)} style={{ padding: '2px 6px' }}>▲</button>
                  <button type="button" title="הזז למטה" onClick={() => moveRowDown(i)} style={{ padding: '2px 6px' }}>▼</button>
                </div>

                <button type="button" className={styles.deleteIngredient} aria-label="הסר שורה" onClick={() => removeIngredientRow(i)}>–</button>
              </div>
            ))}
            <datalist id="product-suggestions">
              {(displayedProductSuggestions.length ? displayedProductSuggestions : productSuggestions).map((product, index) => (
                <option key={index} value={product} />
              ))}
            </datalist>
            <datalist id="unit-suggestions">
              {(displayedUnitSuggestions.length ? displayedUnitSuggestions : unitSuggestions).map((unit, index) => (
                <option key={index} value={unit} />
              ))}
            </datalist>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className={styles.addIngredient} onClick={addIngredientRow}>הוספת מצרך</button>
              <button type="button" className={styles.addIngredient} onClick={addSubtitleRow}>הוספת כותרת חלק</button>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>{hebrew.stepsList}</label>
            <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={6} />
          </div>

          <div className={styles.formButtons}>
            <button type="submit" className={styles.submitButton} disabled={submitting}>{submitting ? 'שולח…' : (editMode ? 'עדכון מתכון' : hebrew.submit)}</button>
            <button type="button" className={styles.cancelButton} onClick={() => { 
              setShowForm(false); 
              setError(''); 
              setMessage(''); 
              setRecipeName('');
              setImage('');
              setCategory('');
              setNewCategory('');
              setUseNewCategory(false);
              setWorkTimeValue('');
              setWorkTimeUnit('דקות');
              setTotalTimeValue('');
              setTotalTimeUnit('דקות');
              setServings('');
              setDifficulty('easy');
              setSource('');
              setIngredients([{ type: 'ingredient', product_name: '', unit: '', amount: '', comment: '' }]);
              setInstructions('');
            }}>{hebrew.cancel}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
