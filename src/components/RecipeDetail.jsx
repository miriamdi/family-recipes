import React, { useState, useEffect } from 'react';
import recipes from '../data/recipes.json';
import { hebrew } from '../data/hebrew';
import './RecipeDetail.css';
import { supabase, useSupabase } from '../lib/supabaseClient';

export default function RecipeDetail({ recipeId, onBack, user }) {
  const [allRecipes, setAllRecipes] = useState(recipes);
  const [message, setMessage] = useState('');
  const [reactions, setReactions] = useState({});
  const ADMIN_EMAIL = 'miriam995@gmail.com';

  useEffect(() => {
    // If Supabase is configured, fetch the single recipe + reactions from the DB.
    if (useSupabase && supabase) {
      (async () => {
        try {
          const { data: dbRecipe, error: rErr } = await supabase
            .from('recipes')
            .select('*, profiles(display_name)')
            .eq('id', recipeId)
            .maybeSingle();

          if (rErr) throw rErr;

          if (dbRecipe) {
            const normalized = { ...dbRecipe, prepTime: dbRecipe.prep_time, cookTime: dbRecipe.cook_time };
            setAllRecipes([normalized]);
          } else {
            setAllRecipes([]);
          }

          const { data: rx, error: rxErr } = await supabase.from('reactions').select('*').eq('recipe_id', recipeId).maybeSingle();
          if (rxErr && rxErr.code !== 'PGRST116') throw rxErr;
          const reactionsMap = {};
          if (rx) reactionsMap[recipeId] = { likes: rx.likes || 0, liked: Boolean(localStorage.getItem('liked_' + recipeId)) };
          setReactions(reactionsMap);
        } catch (err) {
          console.error('Supabase fetch failed, falling back to local data', err);
          // fallback to local behavior below
          const userRecipes = JSON.parse(localStorage.getItem('userRecipes') || '[]');
          const deleted = JSON.parse(localStorage.getItem('deletedRecipes') || '[]');
          const seen = new Set();
          const combined = [...userRecipes, ...recipes].filter(r => {
            if (deleted.includes(r.id)) return false;
            if (seen.has(r.id)) return false;
            seen.add(r.id);
            return true;
          });
          setAllRecipes(combined);
          const stored = JSON.parse(localStorage.getItem('recipeReactions') || '{}');
          setReactions(stored);
        }
      })();
      return;
    }

    // Local fallback when Supabase is not configured
    const userRecipes = JSON.parse(localStorage.getItem('userRecipes') || '[]');
    const deleted = JSON.parse(localStorage.getItem('deletedRecipes') || '[]');
    // deduplicate: userRecipes override built-in recipes with same id
    const seen = new Set();
    const combined = [...userRecipes, ...recipes].filter(r => {
      if (deleted.includes(r.id)) return false;
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
    setAllRecipes(combined);
    const stored = JSON.parse(localStorage.getItem('recipeReactions') || '{}');
    setReactions(stored);
  }, [recipeId]);

  const recipe = allRecipes.find((r) => r.id === recipeId);

  if (!recipe) {
    return <div>המתכון לא נמצא</div>;
  }

  const formatIngredient = (ing) => {
    if (!ing) return '';
    if (typeof ing === 'string') return ing;
    return `${ing.name}${ing.qty ? ' • ' + ing.qty : ''}${ing.unit ? ' ' + ing.unit : ''}`;
  };

  const handleDelete = () => {
    // Check if user can delete: owner OR admin
    const isOwner = user && recipe.user_email === user.email;
    const isAdmin = user && user.email === ADMIN_EMAIL;
    if (!isOwner && !isAdmin) {
      alert('אינך מורשה למחוק מתכון זה');
      return;
    }

    // Confirmation dialog
    const confirm = window.confirm(`אתה בטוח שאתה רוצה למחוק את "${recipe.title}"?`);
    if (!confirm) return;

    if (useSupabase && supabase) {
      (async () => {
        try {
          const { error } = await supabase.from('recipes').delete().eq('id', recipe.id);
          if (error) throw error;
          setMessage(hebrew.deleteSuccess);
          setTimeout(() => onBack(), 800);
        } catch (err) {
          console.error('Delete error', err);
          alert('שגיאה במחיקה');
        }
      })();
      return;
    }

    const userRecipes = JSON.parse(localStorage.getItem('userRecipes') || '[]');
    // try to remove from userRecipes
    const idx = userRecipes.findIndex(r => r.id === recipe.id);
    if (idx !== -1) {
      userRecipes.splice(idx, 1);
      localStorage.setItem('userRecipes', JSON.stringify(userRecipes));
      setMessage(hebrew.deleteSuccess);
      setTimeout(() => onBack(), 800);
      return;
    }

    // mark built-in as deleted
    const deleted = JSON.parse(localStorage.getItem('deletedRecipes') || '[]');
    if (!deleted.includes(recipe.id)) {
      deleted.push(recipe.id);
      localStorage.setItem('deletedRecipes', JSON.stringify(deleted));
    }
    setMessage(hebrew.deleteSuccess);
    setTimeout(() => onBack(), 800);
  };

  const saveUpdatedRecipe = async (updated) => {
    // If Supabase is configured, persist the change to the DB
    if (useSupabase && supabase) {
      try {
        const { data: dbRow, error } = await supabase.from('recipes').update(updated).eq('id', updated.id).select().single();
        if (error) throw error;
        const normalized = { ...dbRow, prepTime: dbRow.prep_time, cookTime: dbRow.cook_time };
        setAllRecipes([normalized]);
        return;
      } catch (err) {
        console.error('Failed to save updated recipe to Supabase, falling back to localStorage', err);
        // fall through to localStorage fallback
      }
    }

    // LocalStorage fallback
    const userRecipes = JSON.parse(localStorage.getItem('userRecipes') || '[]');
    const idx = userRecipes.findIndex(r => r.id === updated.id);
    if (idx !== -1) {
      userRecipes[idx] = updated;
    } else {
      userRecipes.push(updated);
    }
    localStorage.setItem('userRecipes', JSON.stringify(userRecipes));
    const deleted = JSON.parse(localStorage.getItem('deletedRecipes') || '[]');
    // deduplicate: userRecipes override built-in recipes with same id
    const seen = new Set();
    const combined = [...userRecipes, ...recipes].filter(r => {
      if (deleted.includes(r.id)) return false;
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
    setAllRecipes(combined);
  };

  const handleAddImage = (file) => {
    if (!file) return;
    // Only allow owner or admin to add images
    const isOwner = user && recipe.user_email === user.email;
    const isAdmin = user && user.email === ADMIN_EMAIL;
    if (!isOwner && !isAdmin) {
      alert('אינך מורשה להוסיף תמונה');
      return;
    }

    const proceedWithDataUrl = async (data) => {
      const updated = { ...recipe };
      updated.images = Array.isArray(updated.images) ? [...updated.images] : (updated.image ? [updated.image] : []);
      if (updated.images.length >= 5) {
        alert('מקסימום 5 תמונות');
        return;
      }
      updated.images.push(data);
      delete updated.image;
      await saveUpdatedRecipe(updated);
    };

    // If Supabase is configured, upload to storage and save public URL
    if (useSupabase && supabase) {
      (async () => {
        try {
          const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
          if (!file.type || !file.type.startsWith('image/')) {
            alert('הקובץ חייב להיות תמונה');
            return;
          }
          if (file.size > MAX_IMAGE_BYTES) {
            alert('התמונה גדולה מדי (מקסימום 2MB)');
            return;
          }
          const ext = (file.type.split('/')[1] || 'png');
          const filename = `recipes/${recipe.id || 'temp'}-${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage.from('recipes-images').upload(filename, file, { upsert: true });
          if (upErr) throw upErr;
          const { data: urlData } = await supabase.storage.from('recipes-images').getPublicUrl(filename);
          const publicUrl = urlData?.publicUrl || null;
          if (!publicUrl) throw new Error('failed to obtain public url');
          const updated = { ...recipe };
          updated.images = Array.isArray(updated.images) ? [...updated.images] : (updated.image ? [updated.image] : []);
          if (updated.images.length >= 5) {
            alert('מקסימום 5 תמונות');
            return;
          }
          updated.images.push(publicUrl);
          delete updated.image;
          await saveUpdatedRecipe(updated);
        } catch (err) {
          console.error('Supabase image add failed', err);
          alert('העלאת תמונה נכשלה');
        }
      })();
      return;
    }

    // fallback: use data URL and local storage
    const reader = new FileReader();
    reader.onload = (ev) => proceedWithDataUrl(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = (index) => {
    // Only allow owner or admin to remove images
    const isOwner = user && recipe.user_email === user.email;
    const isAdmin = user && user.email === ADMIN_EMAIL;
    if (!isOwner && !isAdmin) {
      alert('אינך מורשה להסיר תמונה');
      return;
    }
    if (!window.confirm('האם אתה בטוח שברצונך להסיר תמונה זו?')) return;
    const updated = { ...recipe };
    updated.images = Array.isArray(updated.images) ? [...updated.images] : (updated.image ? [updated.image] : []);
    updated.images.splice(index, 1);
    if (updated.images.length === 0 && recipe.image) {
      // keep legacy image if it existed
      updated.image = recipe.image;
      delete updated.images;
    }
    saveUpdatedRecipe(updated);
  };

  const saveReactions = (next) => {
    setReactions(next);
    localStorage.setItem('recipeReactions', JSON.stringify(next));
  };

  const handleReaction = async () => {
    try {
      const likedKey = 'liked_' + recipe.id;
      const currentlyLiked = !!localStorage.getItem(likedKey);
      const REACTIONS_API = import.meta.env.VITE_REACTIONS_API_URL;
      if (REACTIONS_API) {
        const action = currentlyLiked ? 'unlike' : 'like';
        const res = await fetch(REACTIONS_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipe_id: recipe.id, action })
        });
        if (res.ok) {
          const j = await res.json();
          if (currentlyLiked) localStorage.removeItem(likedKey); else localStorage.setItem(likedKey, '1');
          const next = { ...(reactions || {}) };
          next[recipe.id] = { likes: j.likes || 0, liked: !currentlyLiked };
          saveReactions(next);
          return;
        }
      }

      if (useSupabase && supabase) {
        const { data: row, error: rowErr } = await supabase.from('reactions').select('*').eq('recipe_id', recipe.id).single();
        if (rowErr && rowErr.code !== 'PGRST116') { /* ignore not found */ }
        const currentLikes = row?.likes || 0;
        const nextLikes = currentlyLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1;
        const upsert = { recipe_id: recipe.id, likes: nextLikes };
        const { error: upErr } = await supabase.from('reactions').upsert(upsert, { onConflict: ['recipe_id'] });
        if (upErr) throw upErr;
        if (currentlyLiked) localStorage.removeItem(likedKey); else localStorage.setItem(likedKey, '1');
        const next = { ...(reactions || {}) };
        next[recipe.id] = { likes: nextLikes, liked: !currentlyLiked };
        saveReactions(next);
        return;
      }

      const cur = JSON.parse(localStorage.getItem('recipeReactions') || '{}');
      const entry = cur[recipe.id] || { likes: 0 };
      if (entry.liked) {
        entry.likes = Math.max(0, entry.likes - 1);
        entry.liked = false;
      } else {
        entry.likes = (entry.likes || 0) + 1;
        entry.liked = true;
      }
      cur[recipe.id] = entry;
      saveReactions(cur);
    } catch (err) {
      console.error('Reaction error', err);
    }
  };

  return (
    <div className="recipe-detail">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="back-button" onClick={onBack}>{hebrew.backToRecipes} ←</button>
        {user && (recipe.user_email === user.email || user.email === ADMIN_EMAIL) && (
          <button className="delete-button" onClick={handleDelete}>{hebrew.deleteRecipe}</button>
        )}
      </div>

      {message && <div className="success-message">{message}</div>}

      <div className="recipe-header">
        <div className="recipe-title-section">
          <div className="large-image">
            {Array.isArray(recipe.images) && recipe.images[0] ? (
              <img src={recipe.images[0]} alt={recipe.title} style={{ maxWidth: 300, borderRadius: 10 }} />
            ) : (typeof recipe.image === 'string' && recipe.image.startsWith('data:') ? (
              <img src={recipe.image} alt={recipe.title} style={{ maxWidth: 300, borderRadius: 10 }} />
            ) : (
              recipe.image
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 10 }}>
            {Array.isArray(recipe.images) && recipe.images.length > 0 && recipe.images.map((img, idx) => (
              <div key={idx} style={{ position: 'relative' }}>
                <img src={img} alt={`img-${idx}`} style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 6 }} />
                <button onClick={() => handleRemoveImage(idx)} style={{ position: 'absolute', top: -6, left: -6, background: '#e74c3c', color: 'white', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer' }}>×</button>
              </div>
            ))}
            <div>
              <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) handleAddImage(f); }} />
            </div>
          </div>
          <h1>{recipe.title}</h1>
          <p className="recipe-description">{recipe.description}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <button onClick={() => handleReaction()} className="reaction-button" style={{ opacity: reactions[recipe.id]?.liked ? 1 : 0.6 }}>👍 { (reactions[recipe.id] && reactions[recipe.id].likes) || 0 }</button>
      </div>

      <div className="recipe-info">
        <div className="info-item">
          <strong>⏱️ {hebrew.prepTime}</strong>
          <p>{recipe.prepTime} דקות</p>
        </div>
        <div className="info-item">
          <strong>🔥 {hebrew.cookTime}</strong>
          <p>{recipe.cookTime} דקות</p>
        </div>
        <div className="info-item">
          <strong>👥 {hebrew.servings}</strong>
          <p>{recipe.servings}</p>
        </div>
        <div className="info-item">
          <strong>📊 {hebrew.difficulty}</strong>
          <p>{recipe.difficulty}</p>
        </div>
      </div>

      <div className="recipe-content">
        <div className="ingredients-section">
          <h2>{hebrew.ingredients}</h2>
          <ul className="ingredients-list">
            {Array.isArray(recipe.ingredients) && recipe.ingredients.map((ingredient, index) => (
              <li key={index}>
                <input type="checkbox" id={`ingredient-${index}`} />
                <label htmlFor={`ingredient-${index}`}>{formatIngredient(ingredient)}</label>
              </li>
            ))}
          </ul>
        </div>

        <div className="instructions-section">
          <h2>{hebrew.instructions}</h2>
          <ol className="instructions-list">
            {Array.isArray(recipe.steps) && recipe.steps.map((step, index) => (
              <li key={index}>
                <input type="checkbox" id={`step-${index}`} />
                <label htmlFor={`step-${index}`}>{step}</label>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
