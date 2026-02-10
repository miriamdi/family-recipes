import React, { useState, useEffect } from 'react';
import { hebrew } from '../data/hebrew';
import './AddRecipe.css';
import { supabase, useSupabase } from '../lib/supabaseClient';

export default function AddRecipe({ onRecipeAdded, recipes, user }) {
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
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);
  const IMAGE_UPLOAD_PASSWORD = import.meta.env.VITE_IMAGE_UPLOAD_PASSWORD;
    const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB
  const [filePreview, setFilePreview] = useState('');
  const [recipeFileName, setRecipeFileName] = useState('');
  const [authorFileName, setAuthorFileName] = useState('');

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

  const handleSubmit = (e) => {
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
      images: filePreview ? [filePreview] : null,
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

    if (useSupabase && supabase) {
      if (!user) {
        setError('אנא התחבר קודם כדי לשלוח מתכון');
        return;
      }
      (async () => {
        try {
          let imageUrl = null;
          if (filePreview && filePreview.startsWith('data:')) {
            const res = await fetch(filePreview);
            const blob = await res.blob();
            const ext = blob.type.split('/')[1] || 'png';
            const filename = `recipes/${Date.now()}.${ext}`;
            const { error: upErr } = await supabase.storage.from('recipes-images').upload(filename, blob, { upsert: true });
            if (upErr) throw upErr;
            const { data: urlData } = supabase.storage.from('recipes-images').getPublicUrl(filename);
            imageUrl = urlData?.publicUrl || null;
          }

          const toInsert = { ...payload, images: imageUrl ? [imageUrl] : payload.images, user_id: user.id, user_email: user.email };
          const { data, error: insertErr } = await supabase.from('recipes').insert(toInsert).select();
          if (insertErr) throw insertErr;
          setMessage(hebrew.successMessage);
          setTimeout(() => {
            onRecipeAdded();
            setShowForm(false);
            setRecipeFileName('');
            setAuthorFileName('');
            setFilePreview('');
            setMessage('');
          }, 800);
        } catch (err) {
          console.error('Supabase insert error', err);
          setError('שגיאה בשמירה בשרת');
        }
      })();
      return;
    }

    // fallback to localStorage when Supabase not configured
    const userRecipes = JSON.parse(localStorage.getItem('userRecipes') || '[]');
    const newId = Math.max(...recipes.map(r => r.id), ...userRecipes.map(r => r.id), 0) + 1;
    const newRecipe = { id: newId, ...payload };
    userRecipes.push(newRecipe);
    localStorage.setItem('userRecipes', JSON.stringify(userRecipes));

    setMessage(hebrew.successMessage);
    setTimeout(() => {
      onRecipeAdded();
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
                  if (password !== IMAGE_UPLOAD_PASSWORD) {
                    setError(hebrew.passwordError || 'Password required to upload image');
                    return;
                  }
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

          <div className="form-group">
            {/* password field removed when using Supabase auth */}
          </div>

          <div className="form-buttons">
            <button type="submit" className="submit-button">{hebrew.submit}</button>
            <button type="button" className="cancel-button" onClick={() => { setShowForm(false); setError(''); setMessage(''); setRecipeFileName(''); setAuthorFileName(''); setFilePreview(''); }}>{hebrew.cancel}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
