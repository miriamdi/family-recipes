import React, { useState, useEffect } from 'react';
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
          const rawInput = (i.amount != null) ? String(i.amount).trim() : '';
          const amt = parseAmountToDecimal(rawInput);
          return { product_name: i.product_name.trim(), unit: i.unit.trim(), amount: amt, amount_raw: rawInput, comment: (i.comment || '').trim() };
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
                        // Show decimal only if user entered a fraction
                        if (/^-?\d+\s+\d+\/\d+$/.test(raw) || /^-?\d+\/\d+$/.test(raw)) {
                          const dec = parseAmountToDecimal(raw);
                          if (dec == null || isNaN(Number(dec))) return raw;
                          const decRounded = (Math.round(Number(dec) * 100) / 100);
                          return `${raw} (${decRounded})`;
                        }
                        return ''; // Otherwise, show nothing
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
