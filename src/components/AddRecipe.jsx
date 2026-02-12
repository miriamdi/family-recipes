import React, { useState, useEffect } from 'react';
import { hebrew } from '../data/hebrew';
import './AddRecipe.css';
import { supabase, useSupabase } from '../lib/supabaseClient';

export default function AddRecipe({ onRecipeAdded, recipes, user, displayName }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [image, setImage] = useState('');
  const [category, setCategory] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [useNewCategory, setUseNewCategory] = useState(false);
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [servings, setServings] = useState('');
  const [difficulty, setDifficulty] = useState('קל');
  const [source, setSource] = useState('');
  const [ingredients, setIngredients] = useState([
    { name: '', unit: '', qty: '' }
  ]);
  const [steps, setSteps] = useState('');
  // const [password, setPassword] = useState(''); // removed, no longer needed
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);
  // const IMAGE_UPLOAD_PASSWORD = import.meta.env.VITE_IMAGE_UPLOAD_PASSWORD; // removed, no longer needed
    const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB
  const [filePreview, setFilePreview] = useState('');
  const [recipeFileName, setRecipeFileName] = useState('');
  const [authorFileName, setAuthorFileName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // build category list from built-in recipes and user recipes
    const userRecipes = JSON.parse(localStorage.getItem('userRecipes') || '[]');
    const all = [...recipes, ...userRecipes];
    const cats = Array.from(new Set(all.map(r => r.category).filter(Boolean)));
    setCategories(cats);
  }, [recipes]);

  // simple emoji suggestion based on name keywords
  useEffect(() => {
    if (!image) {
      const n = (name || '').toLowerCase();
      if (n.includes('עוגה') || n.includes('עוג')) setImage('🍰');
      else if (n.includes('שוק') || n.includes("שוקולד")) setImage('🍪');
      else if (n.includes('פנק') || n.includes('פנקייק')) setImage('🥞');
      else if (n.includes('פסטה') || n.includes('פסטה')) setImage('🍝');
      else if (n.includes('סלט')) setImage('🥗');
      else if (n.includes('עוף')) setImage('🍗');
      else if (n.includes('לחם')) setImage('🍞');
      else setImage('🍽️');
    }
  }, [name]);

  const handleIngredientChange = (index, key, value) => {
    const arr = [...ingredients];
    arr[index][key] = value;
    setIngredients(arr);
  };

  const addIngredientRow = () => {
    setIngredients(prev => [...prev, { name: '', unit: '', qty: '' }]);
  };

  const removeIngredientRow = (i) => {
    setIngredients(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!name || ingredients.length === 0 || !steps) {
      setError('בבקשה מלא את כל השדות הנדרשים');
      return;
    }

    const finalCategory = useNewCategory && newCategory ? newCategory : category || '';

    const payload = {
      title: name,
      description: '',
      image: typeof image === 'string' && image.startsWith('data:') ? null : image,
      category: finalCategory,
      prep_time: parseInt(prepTime) || 0,
      cook_time: parseInt(cookTime) || 0,
      servings: parseInt(servings) || 1,
      difficulty,
      source,
      recipe_file: recipeFileName || null,
      author_file: authorFileName || null,
      ingredients: ingredients
        .filter(i => i.name.trim())
        .map(i => ({ name: i.name.trim(), unit: i.unit.trim(), qty: i.qty.trim() })),
      steps: steps.split('\n').map(s => s.trim()).filter(Boolean)
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

        const toInsert = { ...payload, user_id: authUser.id, user_email: authUser.email };
        // return the inserted row as a single object
        const { data, error: insertErr } = await supabase.from('recipes').insert(toInsert).select().single();

        if (insertErr) {
          console.error('Supabase insert error', insertErr);
          // Common cause: row-level security / not in approved_emails
          if (insertErr?.status === 401 || insertErr?.status === 403 || /permission|authorization|forbidden/i.test(insertErr?.message || '')) {
            setError('אין לך הרשאה להוסיף מתכון — ודא שהאימייל שלך נמצא בטבלת ה-approved_emails');
          } else {
            setError(insertErr?.message || 'שגיאה בשמירה בשרת');
          }
          setSubmitting(false);
          return;
        }

        // data is now a single inserted row
        const inserted = data || null;

        // If there's an image preview, upload it to recipe_images table
        if (filePreview && filePreview.startsWith('data:')) {
          try {
            const res = await fetch(filePreview);
            const blob = await res.blob();
            const ext = blob.type.split('/')[1] || 'png';
            const filename = `recipes/${inserted.id}-${Date.now()}.${ext}`;

            const { error: upErr } = await supabase.storage.from('recipes-images').upload(filename, blob, { upsert: true });
            if (upErr) throw upErr;

            const { data: urlData } = supabase.storage.from('recipes-images').getPublicUrl(filename);
            const imageUrl = urlData?.publicUrl || null;

            if (imageUrl) {
              // Insert into recipe_images table
              await supabase.from('recipe_images').insert({
                recipe_id: inserted.id,
                image_url: imageUrl,
                uploaded_by_user_id: authUser.id,
                uploaded_by_user_name: displayName || authUser.email
              });
            }
          } catch (uploadErr) {
            console.error('Image upload failed (non-blocking)', uploadErr);
            // Don't fail the recipe creation if image upload fails
          }
        }

        const uiRecipe = inserted ? { ...inserted, prepTime: inserted.prep_time, cookTime: inserted.cook_time } : null;

        setMessage(hebrew.successMessage);
        setTimeout(() => {
          // optimistic update + ask parent to re-fetch to reconcile server state
          onRecipeAdded(uiRecipe, { refetch: true });
          setShowForm(false);
          setRecipeFileName('');
          setAuthorFileName('');
          setFilePreview('');
          setMessage('');
          setSubmitting(false);
        }, 800);
      } catch (err) {
        console.error('Supabase insert unexpected error', err);
        setError(err?.message || 'שגיאה בשמירה בשרת');
        setSubmitting(false);
      }

      return;
    }

    // fallback to localStorage when Supabase not configured
    const userRecipes = JSON.parse(localStorage.getItem('userRecipes') || '[]');
    const newId = Math.max(...userRecipes.map(r => r.id), 0) + 1;
    const newRecipe = { id: newId, ...payload };
    userRecipes.push(newRecipe);
    localStorage.setItem('userRecipes', JSON.stringify(userRecipes));

    setMessage(hebrew.successMessage);
    setTimeout(() => {
      // local fallback: optimistic add, no server refetch needed
      onRecipeAdded(newRecipe, { refetch: false });
      setShowForm(false);
      setRecipeFileName('');
      setAuthorFileName('');
      setFilePreview('');
      setMessage('');
    }, 1000);
  };

  if (!showForm) {
    return (
      <button className="add-recipe-button" onClick={() => setShowForm(true)}>
        {hebrew.addRecipe}
      </button>
    );
  }

  return (
    <div className="add-recipe-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h2>{hebrew.addRecipe}</h2>
          <button
            className="close-button"
            onClick={() => {
              setShowForm(false);
              setError('');
              setMessage('');
              setRecipeFileName('');
              setAuthorFileName('');
              setFilePreview('');
            }}
          >
            ✕
          </button>
        </div>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{hebrew.recipeName}</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div className="form-group">
            <label>העלאת מתכון</label>
            <input type="file" accept=".pdf,.txt,.md" onChange={e => {
              const f = e.target.files && e.target.files[0];
              if (!f) return;
              setRecipeFileName(f.name);
            }} />
            {recipeFileName && <div style={{ marginTop: 6 }}>{recipeFileName}</div>}
          </div>

          <div className="form-group">
            <label>{hebrew.recipeImage} • {hebrew.createEmojiInfo}</label>
            <input type="text" value={image} onChange={e => setImage(e.target.value)} maxLength={2} />
            <div style={{ marginTop: 8 }}>
              <input type="file" accept="image/*" onChange={(e) => {
                const f = e.target.files && e.target.files[0];
                if (!f) return;
                  // basic type/size checks before processing
                  if (!f.type || !f.type.startsWith('image/')) {
                    setError('הקובץ חייב להיות תמונה');
                    return;
                  }
                  if (f.size > MAX_IMAGE_BYTES) {
                    setError('התמונה גדולה מדי (מקסימום 2MB)');
                    return;
                  }
                  // password check removed, handled by Supabase auth
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    setImage(ev.target.result);
                    setFilePreview(ev.target.result);
                  };
                  reader.readAsDataURL(f);
              }} />
            </div>
            {filePreview && (
              <div style={{ marginTop: 8 }}>
                <img src={filePreview} alt="preview" style={{ maxWidth: '100%', borderRadius: 6 }} />
              </div>
            )}
          </div>

          <div className="form-group">
            <label>{hebrew.categoryLabel}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={category} onChange={e => { setCategory(e.target.value); setUseNewCategory(false); }}>
                <option value="">בחר קטגוריה</option>
                {categories.map((c, idx) => <option key={idx} value={c}>{c}</option>)}
                <option value="__new">--- קטגוריה חדשה ---</option>
              </select>
              { (category === '__new' || useNewCategory) && (
                <input placeholder="הכנס קטגוריה חדשה" value={newCategory} onChange={e => { setNewCategory(e.target.value); setUseNewCategory(true); setCategory('__new'); }} />
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{hebrew.prepTimeLabel}</label>
              <input type="number" value={prepTime} onChange={e => setPrepTime(e.target.value)} />
            </div>
            <div className="form-group">
              <label>{hebrew.cookTimeLabel}</label>
              <input type="number" value={cookTime} onChange={e => setCookTime(e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{hebrew.servingsLabel}</label>
              <input type="number" value={servings} onChange={e => setServings(e.target.value)} />
            </div>
            <div className="form-group">
              <label>{hebrew.difficultyLabel}</label>
              <select value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                <option>קל</option>
                <option>בינוני</option>
                <option>קשה</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>{hebrew.sourceLabel}</label>
            <input type="text" value={source} onChange={e => setSource(e.target.value)} />
          </div>

          <div className="form-group">
            <label>העלאת מאת</label>
            <input type="file" accept=".pdf,.txt,.md" onChange={e => {
              const f = e.target.files && e.target.files[0];
              if (!f) return;
              setAuthorFileName(f.name);
            }} />
            {authorFileName && <div style={{ marginTop: 6 }}>{authorFileName}</div>}
          </div>

          <div className="form-group">
            <label>{hebrew.ingredientsList}</label>
            {ingredients.map((ing, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input placeholder="שם מוצר" style={{ flex: 2 }} value={ing.name} onChange={e => handleIngredientChange(i, 'name', e.target.value)} />
                <input placeholder="יחידה (g/kg/unit)" style={{ width: 120 }} value={ing.unit} onChange={e => handleIngredientChange(i, 'unit', e.target.value)} />
                <input placeholder="כמות" style={{ width: 80 }} value={ing.qty} onChange={e => handleIngredientChange(i, 'qty', e.target.value)} />
                <button type="button" onClick={() => removeIngredientRow(i)}>–</button>
              </div>
            ))}
            <button type="button" className="add-ingredient" onClick={addIngredientRow}>{hebrew.addIngredient}</button>
          </div>

          <div className="form-group">
            <label>{hebrew.stepsList}</label>
            <textarea value={steps} onChange={e => setSteps(e.target.value)} rows={6} />
          </div>

          {/* password field removed, Supabase auth in use */}

          <div className="form-buttons">
            <button type="submit" className="submit-button" disabled={submitting}>{submitting ? 'שולח…' : hebrew.submit}</button>
            <button type="button" className="cancel-button" onClick={() => { setShowForm(false); setError(''); setMessage(''); setRecipeFileName(''); setAuthorFileName(''); setFilePreview(''); }}>{hebrew.cancel}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
