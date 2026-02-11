import React, { useState, useEffect } from 'react';

import { hebrew } from '../data/hebrew';
import './RecipeDetail.css';
import { supabase, useSupabase } from '../lib/supabaseClient';
import { processImageForUpload } from '../lib/imageUtils';

export default function RecipeDetail({ recipeId, onBack, user }) {
  const [allRecipes, setAllRecipes] = useState([]);
  const [message, setMessage] = useState('');
  const [imageError, setImageError] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [reactions, setReactions] = useState({});
  const ADMIN_EMAIL = 'miriam995@gmail.com';

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
            return;
          }

          const normalized = { ...dbRecipe, prepTime: dbRecipe.prep_time, cookTime: dbRecipe.cook_time };
          setAllRecipes([normalized]);
          console.debug('[RecipeDetail] Recipe loaded:', { id: dbRecipe.id, title: dbRecipe.title });

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
    const isOwner = user && recipe.user_email === user.email;
    const isAdmin = user && user.email === ADMIN_EMAIL;
    if (!isOwner && !isAdmin) {
      alert('איך לך הרשאה למחוק מתכון זה');
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

  const handleAddImage = (file) => {
    if (!file) return;

    setImageError('');
    const isOwner = user && recipe.user_email === user.email;
    const isAdmin = user && user.email === ADMIN_EMAIL;
    if (!isOwner && !isAdmin) {
      setImageError('אינך מורשה להוסיף תמונה');
      return;
    }

    const currentImages = Array.isArray(recipe.images) ? recipe.images : [];
    const legacyImage = recipe.image && !Array.isArray(recipe.images) ? [recipe.image] : [];
    const totalImages = currentImages.length + legacyImage.length;

    if (totalImages >= 6) {
      setImageError('להגיע למקסימום 6 תמונות');
      return;
    }

    const proceedWithDataUrl = async (dataUrl) => {
      try {
        const updated = { ...recipe };
        updated.images = Array.isArray(updated.images) ? [...updated.images] : [];
        if (updated.images.length >= 6) {
          setImageError('להגיע למקסימום 6 תמונות');
          return;
        }
        updated.images.push(dataUrl);
        delete updated.image;
        await saveUpdatedRecipe(updated);
        setMessage('תמונה הוספה בהצלחה');
        setTimeout(() => setMessage(''), 2000);
      } catch (err) {
        setImageError(`שגיאה בשמירה: ${err.message}`);
      }
    };

    // Process and upload image
    (async () => {
      setUploadingImage(true);
      try {
        const { blob: compressedBlob, error: processError } = await processImageForUpload(file);

        if (processError) {
          setImageError(processError);
          setUploadingImage(false);
          return;
        }

        if (useSupabase && supabase) {
          // Upload to Supabase storage
          try {
            const ext = file.type.split('/')[1] || 'jpeg';
            const filename = `recipes/${recipe.id}-${Date.now()}.${ext}`;

            const { error: upErr } = await supabase.storage
              .from('recipes-images')
              .upload(filename, compressedBlob, { upsert: true });

            if (upErr) {
              if (upErr.message.includes('not found')) {
                setImageError('Bucket storage not configured. Please contact admin.');
              } else if (upErr.message.includes('permission')) {
                setImageError('Permission denied. You are not allowed to upload.');
              } else {
                setImageError(`Upload failed: ${upErr.message}`);
              }
              setUploadingImage(false);
              return;
            }

            const { data: urlData } = await supabase.storage
              .from('recipes-images')
              .getPublicUrl(filename);

            const publicUrl = urlData?.publicUrl;
            if (!publicUrl) {
              setImageError('Failed to get image URL after upload');
              setUploadingImage(false);
              return;
            }

            const updated = { ...recipe };
            updated.images = Array.isArray(updated.images) ? [...updated.images] : [];
            if (updated.images.length >= 6) {
              setImageError('Reached maximum 6 images');
              setUploadingImage(false);
              return;
            }
            updated.images.push(publicUrl);
            delete updated.image;
            await saveUpdatedRecipe(updated);
            setMessage('תמונה הוסיפה בהצלחה');
            setTimeout(() => setMessage(''), 2000);
          } catch (err) {
            console.error('Supabase image upload failed:', err);
            setImageError(`Upload error: ${err.message}`);
          }
        } else {
          // Fallback: convert to data URL
          const reader = new FileReader();
          reader.onload = (ev) => proceedWithDataUrl(ev.target.result);
          reader.onerror = () => setImageError('File read error');
          reader.readAsDataURL(compressedBlob);
        }
      } catch (err) {
        console.error('Image processing error:', err);
        setImageError(`Processing error: ${err.message}`);
      } finally {
        setUploadingImage(false);
      }
    })();
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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}>
            {Array.isArray(recipe.images) && recipe.images.length > 0 && recipe.images.map((img, idx) => (
              <div key={idx} style={{ position: 'relative' }}>
                <img src={img} alt={`img-${idx}`} style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 6 }} />
                {(isOwner || isAdmin) && (
                  <button onClick={() => handleRemoveImage(idx)} style={{ position: 'absolute', top: -6, left: -6, background: '#e74c3c', color: 'white', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontSize: 14 }}>×</button>
                )}
              </div>
            ))}
            {(isOwner || isAdmin) && Array.isArray(recipe.images) && recipe.images.length < 6 && (
              <div style={{ position: 'relative' }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) handleAddImage(f); }}
                  disabled={uploadingImage}
                  style={{ width: 80, height: 60, opacity: 0.5, cursor: uploadingImage ? 'not-allowed' : 'pointer' }}
                  title={uploadingImage ? 'Uploading...' : 'Add image'}
                />
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', fontSize: 24 }}>+</div>
              </div>
            )}
          </div>

          {imageError && (
            <div style={{ marginTop: 8, padding: 8, background: '#fee', color: '#c00', borderRadius: 4, fontSize: 13 }}>
              {imageError}
            </div>
          )}
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
      {Array.isArray(recipe.images) && recipe.images.length > 1 && (
        <div style={{ marginTop: 32, borderTop: '1px solid #ddd', paddingTop: 24 }}>
          <h2>תמונות נוספות</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {recipe.images.map((img, idx) => (
              <img
                key={idx}
                src={img}
                alt={`${recipe.title} - תמונה ${idx + 1}`}
                style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 8, cursor: 'pointer' }}
                onClick={() => window.open(img, '_blank')}
                title="Click to view full size"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
