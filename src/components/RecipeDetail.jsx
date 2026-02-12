import React, { useState, useEffect } from 'react';

import { hebrew } from '../data/hebrew';
import './RecipeDetail.css';
import { supabase, useSupabase } from '../lib/supabaseClient';
import { processImageForUpload } from '../lib/imageUtils';
import ImageUploader from './ImageUploader';
import ImageGallery from './ImageGallery';

export default function RecipeDetail({ recipeId, onBack, user, displayName }) {
  const [allRecipes, setAllRecipes] = useState([]);
  const [recipeImages, setRecipeImages] = useState([]);
  const [message, setMessage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [reactions, setReactions] = useState({});
  const ADMIN_EMAIL = 'miriam995@gmail.com';
  const MAX_IMAGES = 20;

  useEffect(() => {
    // If Supabase is configured, fetch the single recipe + reactions from the DB.
    if (useSupabase && supabase) {
      (async () => {
        try {
          const { data: dbRecipe, error: rErr } = await supabase
            .from('recipes')
            .select('*')
            .eq('id', recipeId)
            .maybeSingle();

          if (rErr) {
            console.error('[RecipeDetail] Fetch error:', rErr.code, rErr.message);
            throw rErr;
          }

          if (!dbRecipe) {
            console.warn('[RecipeDetail] Recipe not found in Supabase:', recipeId);
            setAllRecipes([]);
            setReactions({});
            setRecipeImages([]);
            return;
          }

          const normalized = { ...dbRecipe, prepTime: dbRecipe.prep_time, cookTime: dbRecipe.cook_time };
          setAllRecipes([normalized]);
          console.debug('[RecipeDetail] Recipe loaded:', { id: dbRecipe.id, title: dbRecipe.title });

          // Fetch recipe images from the new recipe_images table
          const { data: imgs, error: imgsErr } = await supabase
            .from('recipe_images')
            .select('*')
            .eq('recipe_id', recipeId)
            .order('created_at', { ascending: false });

          if (imgsErr) {
            console.warn('[RecipeDetail] Images fetch warning:', imgsErr.message);
          } else {
            setRecipeImages(imgs || []);
          }

          const { data: rx, error: rxErr } = await supabase.from('reactions').select('*').eq('recipe_id', recipeId).maybeSingle();
          if (rxErr && rxErr.code !== 'PGRST116') {
            console.warn('[RecipeDetail] Reactions fetch warning (non-blocking):', rxErr.message);
          }
          const reactionsMap = {};
          if (rx) reactionsMap[recipeId] = { likes: rx.likes || 0, liked: Boolean(localStorage.getItem('liked_' + recipeId)) };
          setReactions(reactionsMap);
        } catch (err) {
          console.error('[RecipeDetail] Supabase fetch failed:', err.message || err);
          // fallback to local behavior
          const userRecipes = JSON.parse(localStorage.getItem('userRecipes') || '[]');
          const found = userRecipes.find(r => String(r.id) === String(recipeId));
          if (found) {
            setAllRecipes([found]);
          } else {
            setAllRecipes([]);
          }
          const stored = JSON.parse(localStorage.getItem('recipeReactions') || '{}');
          setReactions(stored);
          setRecipeImages([]);
        }
      })();
      return;
    }

    // Local fallback when Supabase is not configured
    const userRecipes = JSON.parse(localStorage.getItem('userRecipes') || '[]');
    const found = userRecipes.find(r => String(r.id) === String(recipeId));
    if (found) {
      setAllRecipes([found]);
    } else {
      setAllRecipes([]);
    }
    const stored = JSON.parse(localStorage.getItem('recipeReactions') || '{}');
    setReactions(stored);
    setRecipeImages([]);
  }, [recipeId]);

  const recipe = allRecipes.find((r) => r.id === recipeId);

  if (!recipe) {
    return <div>המתכון לא נמצא</div>;
  }

  const isOwner = user && recipe.user_email === user.email;
  const isAdmin = user && user.email === ADMIN_EMAIL;

  const formatIngredient = (ing) => {
    if (!ing) return '';
    if (typeof ing === 'string') return ing;
    return `${ing.name}${ing.qty ? ' • ' + ing.qty : ''}${ing.unit ? ' ' + ing.unit : ''}`;
  };

  const handleDelete = () => {
    // Check if user can delete: owner OR admin
    if (!isOwner && !isAdmin) {
      alert('אין לך הרשאה למחוק מתכון זה');
      return;
    }

    // Confirmation dialog
    const confirm = window.confirm(
      `למחוק את המתכון "${recipe.title}"?\nאין אפשרות לשחזר לאחר מחיקה.`
    );
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
    // deduplicate within userRecipes only
    const seen = new Set();
    const combined = userRecipes.filter(r => {
      if (deleted.includes(r.id)) return false;
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
    setAllRecipes(combined);
  };

  const handleAddImageSuccess = () => {
    setMessage('תמונה הוספה בהצלחה');
    setTimeout(() => setMessage(''), 2000);

    // Refetch recipe images to keep in sync
    if (useSupabase && supabase) {
      (async () => {
        const { data: imgs } = await supabase
          .from('recipe_images')
          .select('*')
          .eq('recipe_id', recipeId)
          .order('created_at', { ascending: false });
        setRecipeImages(imgs || []);
      })();
    }
  };

  const handleImageDeleted = (deletedImageId) => {
    setRecipeImages(prev => prev.filter(img => img.id !== deletedImageId));
    setMessage('תמונה נמחקה בהצלחה');
    setTimeout(() => setMessage(''), 2000);
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
            {recipeImages.length > 0 ? (
              <img src={recipeImages[0].image_url} alt={recipe.title} style={{ maxWidth: 300, borderRadius: 10 }} />
            ) : recipe.image && typeof recipe.image === 'string' && !recipe.image.startsWith('data:') && recipe.image.length > 2 ? (
              <img src={recipe.image} alt={recipe.title} style={{ maxWidth: 300, borderRadius: 10 }} />
            ) : (
              <div style={{ fontSize: 100 }}>{recipe.image || '🍽️'}</div>
            )}
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

      {/* Full image gallery at bottom */}
      <ImageGallery
        images={recipeImages}
        recipeId={recipeId}
        user={user}
        onImageDeleted={handleImageDeleted}
      />

      {/* Image upload section */}
      {(isOwner || isAdmin) && (
        <div style={{ marginTop: 32, borderTop: '1px solid #ddd', paddingTop: 24 }}>
          <h3 style={{ marginBottom: 16 }}>הכנת את המתכון? כאן אפשר להשוויץ עם תמונה 📸</h3>
          <ImageUploader
            recipeId={recipeId}
            currentImageCount={recipeImages.length}
            maxImages={MAX_IMAGES}
            onImageAdded={handleAddImageSuccess}
            user={user}
            displayName={displayName}
            disabled={recipeImages.length >= MAX_IMAGES}
          />
        </div>
      )}
    </div>
  );
}
