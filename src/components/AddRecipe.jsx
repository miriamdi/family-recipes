import React, { useState, useEffect, useRef } from 'react';
import { hebrew } from '../data/hebrew';
import styles from './AddRecipe.module.css';
import { supabase, useSupabase } from '../lib/supabaseClient';
import { getEmojiForName, stripLeadingEmoji } from '../lib/emojiUtils';
import { formatAmountToFraction, parseAmountToDecimal } from '../lib/formatUtils';

export default function AddRecipe({ onRecipeAdded, recipes, user, displayName, userLoading, editMode = false, initialData = null, onSave = null, onCancel = null }) {
  const [showForm, setShowForm] = useState(false);
  const [recipeName, setRecipeName] = useState('');
  const [image, setImage] = useState(() => getEmojiForName(''));
  const [category, setCategory] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [useNewCategory, setUseNewCategory] = useState(false);
  const [workTimeMinutes, setWorkTimeMinutes] = useState('');
  const [totalTimeMinutes, setTotalTimeMinutes] = useState('');
  const [servings, setServings] = useState('');
  const [difficulty, setDifficulty] = useState('easy'); // stored as easy|medium|hard
  const [source, setSource] = useState('');
  const [ingredients, setIngredients] = useState([
    { type: 'ingredient', product_name: '', unit: '', amount: '', comment: '' }
  ]);
  const [instructions, setInstructions] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);
  const [categorySuggestions, setCategorySuggestions] = useState([]);
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [productSuggestionsAll, setProductSuggestionsAll] = useState([]);
  const [displayedProductSuggestions, setDisplayedProductSuggestions] = useState([]);
  const [unitSuggestions, setUnitSuggestions] = useState([]);
  const [unitSuggestionsAll, setUnitSuggestionsAll] = useState([]);
  const [displayedUnitSuggestions, setDisplayedUnitSuggestions] = useState([]);
  const [submitting, setSubmitting] = useState(false);
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
      setWorkTimeMinutes(initialData.prep_time || initialData.prepTime || '');
      setTotalTimeMinutes(initialData.cook_time || initialData.cookTime || '');
      setServings(initialData.servings || '');
      // Map english difficulty back to Hebrew options
      const diffMap = { easy: 'קל', medium: 'בינוני', hard: 'קשה' };
      setDifficulty(diffMap[initialData.difficulty] || initialData.difficulty || 'easy');
      setSource(initialData.source || '');
      setIngredients(Array.isArray(initialData.ingredients) ? initialData.ingredients.map(i => i.type === 'subtitle' ? { type: 'subtitle', text: i.text } : { type: 'ingredient', product_name: i.product_name || i.name || '', unit: i.unit || '', amount: i.amount_raw ?? i.amount ?? i.qty ?? '', comment: i.comment || '' }) : [{ type: 'ingredient', product_name: '', unit: '', amount: '', comment: '' }]);
      setInstructions(Array.isArray(initialData.steps) ? initialData.steps.join('\n') : (initialData.steps || ''));
    }
    // build category list from provided `recipes` only (DB-sourced)
    const cats = Array.from(new Set((recipes || []).map(r => r.category).filter(Boolean)));
    setCategories(cats);

    // Also build suggestions for products/units from the provided `recipes` as a fallback
    try {
      const products = new Set();
      const units = new Set();
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
      });
      const prodList = Array.from(products).map(p => p.charAt(0).toUpperCase() + p.slice(1));
      const unitList = Array.from(units).map(u => u.charAt(0).toUpperCase() + u.slice(1));
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
      if (!useSupabase || !supabase) {
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
      } catch (err) {
        console.warn('Failed to fetch suggestions from Supabase:', err);
        setCategorySuggestions([]);
        setProductSuggestions([]);
        setUnitSuggestions([]);
      }
    };
    fetchSuggestions();
  }, [recipes, useSupabase, supabase]);

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
    if (p.prep) setWorkTimeMinutes(p.prep);
    if (p.total) setTotalTimeMinutes(p.total);
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

    if (!recipeName || !category || !workTimeMinutes || !totalTimeMinutes || !servings || !difficulty || !source || ingredients.length === 0 || !instructions.trim()) {
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

    const payload = {
      title: finalTitle,
      description: '',
      // Do NOT store the emoji as an image URL. Leave `image` empty by default (emoji is in the title).
      image: '',
      category: finalCategory,
      prep_time: parseInt(workTimeMinutes),
      cook_time: parseInt(totalTimeMinutes),
      servings: parseInt(servings),
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
    };

    // If Supabase is configured, attempt to save there (requires authenticated + approved user)
    if (useSupabase && supabase) {
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
          const res = await fetch(RECIPE_SUBMIT_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, user_id: authUser.id, user_email: authUser.email })
          });

          if (!res.ok) {
            const err = await res.json();
            setError(err.error || 'שגיאה בשמירה בשרת');
            setSubmitting(false);
            return;
          }

          const inserted = await res.json();

          const uiRecipe = inserted ? { ...inserted, prepTime: inserted.prep_time, cookTime: inserted.cook_time } : null;

          setMessage(hebrew.successMessage);
          setTimeout(() => {
            // optimistic update + ask parent to re-fetch to reconcile server state
            onRecipeAdded && onRecipeAdded(uiRecipe, { refetch: true });
            setShowForm(false);
            setMessage('');
            setSubmitting(false);
          }, 800);
        } else {
          // EDIT MODE: update existing recipe
          try {
            const toUpdate = { ...payload };
            const { data: updatedRow, error: upErr } = await supabase.from('recipes').update(toUpdate).eq('id', initialData.id).select().single();
            if (upErr) throw upErr;
            const uiRecipe = updatedRow ? { ...updatedRow, prepTime: updatedRow.prep_time, cookTime: updatedRow.cook_time } : null;
            if (uiRecipe && !uiRecipe.updated_at) uiRecipe.updated_at = new Date().toISOString();
            setMessage('המתכון עודכן בהצלחה');
            setTimeout(() => {
              onSave ? onSave(uiRecipe) : onRecipeAdded && onRecipeAdded(uiRecipe, { refetch: true });
              setShowForm(false);
              setMessage('');
              setSubmitting(false);
            }, 800);
          } catch (editErr) {
            console.error('Edit save failed', editErr);
            setError(editErr?.message || 'שגיאה בעדכון המתכון');
            setSubmitting(false);
          }
        }
      } catch (err) {
        console.error('Supabase insert unexpected error', err);
        // Fallback: try inserting directly with Supabase client (useful in dev or if functions are down)
        try {
          const { data: { user: fallbackUser } = {}, error: authErr } = await supabase.auth.getUser();
          if (!fallbackUser?.id) throw new Error('לא מזוהים - התחברו כדי לנסות שוב');
          if (!editMode) {
            const toInsertFallback = { ...payload, user_id: fallbackUser.id, user_email: fallbackUser.email };
            const { data: insertData, error: insertErr } = await supabase.from('recipes').insert(toInsertFallback).select().single();
            if (insertErr) throw insertErr;

            const inserted = insertData || null;
            const uiRecipe = inserted ? { ...inserted, prepTime: inserted.prep_time, cookTime: inserted.cook_time } : null;
            setMessage(hebrew.successMessage);
            setTimeout(() => {
              onRecipeAdded && onRecipeAdded(uiRecipe, { refetch: true });
              setShowForm(false);
              setMessage('');
              setSubmitting(false);
            }, 800);
            return;
          } else {
            // edit mode fallback: update directly
            const toUpdate = { ...payload };
            const { data: updatedRow, error: upErr } = await supabase.from('recipes').update(toUpdate).eq('id', initialData.id).select().single();
            if (upErr) throw upErr;
            const uiRecipe = updatedRow ? { ...updatedRow, prepTime: updatedRow.prep_time, cookTime: updatedRow.cook_time } : null;
            if (uiRecipe && !uiRecipe.updated_at) uiRecipe.updated_at = new Date().toISOString();
            setMessage('המתכון עודכן בהצלחה');
            setTimeout(() => {
              onSave ? onSave(uiRecipe) : onRecipeAdded && onRecipeAdded(uiRecipe, { refetch: true });
              setShowForm(false);
              setMessage('');
              setSubmitting(false);
            }, 800);
            return;
          }
        } catch (fallbackErr) {
          console.error('Fallback insert failed', fallbackErr);
          setError(fallbackErr?.message || err?.message || 'שגיאה בשמירה בשרת');
          setSubmitting(false);
        }
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
              setWorkTimeMinutes('');
              setTotalTimeMinutes('');
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
            <input
              type="text"
              value={category}
              onChange={e => setCategory(e.target.value)}
              list="category-suggestions"
              placeholder=" נא לבחור קטגוריה קיימת או להכניס קטגוריה חדשה"
              aria-autocomplete="list"
            />
            <datalist id="category-suggestions">
              {categorySuggestions.map((cat, idx) => <option key={idx} value={cat} />)}
            </datalist>
          </div>

            <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>זמן עבודה (דקות)</label>
              <input type="number" value={workTimeMinutes} onChange={e => setWorkTimeMinutes(e.target.value)} min="0" />
            </div>
            <div className={styles.formGroup}>
              <label>זמן הכנה כולל (דקות)</label>
              <input type="number" value={totalTimeMinutes} onChange={e => setTotalTimeMinutes(e.target.value)} min="0" />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>{hebrew.servingsLabel}</label>
              <input type="number" value={servings} onChange={e => setServings(e.target.value)} min="1" />
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
                    <input placeholder="כמות (אפשר 1 1/4)" type="text" style={{ width: 100 }} value={ing.amount} onChange={e => handleIngredientChange(i, 'amount', e.target.value)} />
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
              setWorkTimeMinutes('');
              setTotalTimeMinutes('');
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
