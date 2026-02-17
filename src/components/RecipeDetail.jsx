import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

import { hebrew } from '../data/hebrew';
import './RecipeDetail.css';
import { supabase, useSupabase } from '../lib/supabaseClient';
import { processImageForUpload } from '../lib/imageUtils';
import { extractLeadingEmoji } from '../lib/emojiUtils';
import { formatAmountToFraction, parseAmountToDecimal } from '../lib/formatUtils';
import ImageUploader from './ImageUploader';
import ImageGallery from './ImageGallery';
import AddRecipe from './AddRecipe';

export default function RecipeDetail({ recipeId, user, displayName }) {
  const [allRecipes, setAllRecipes] = useState([]);
  const [recipeImages, setRecipeImages] = useState([]);
  const [message, setMessage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [reactions, setReactions] = useState({});
  const [isEditing, setIsEditing] = useState(false);

  const handleEditSave = async (updatedRecipe) => {
    if (!updatedRecipe) return;
    await saveUpdatedRecipe(updatedRecipe);
    setIsEditing(false);
    setMessage('המתכון עודכן בהצלחה');
    setTimeout(() => setMessage(''), 2000);
  };
  const ADMIN_EMAIL = 'miriam995@gmail.com';
  const MAX_IMAGES = 20;
  const navigate = useNavigate();

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

          const normalized = { 
            ...dbRecipe, 
            prepTime: dbRecipe.prep_time, 
            cookTime: dbRecipe.cook_time,
            prep_time_text: dbRecipe.prep_time_text,
            cook_time_text: dbRecipe.cook_time_text,
            // Preserve textual servings separately and keep numeric `servings` for compatibility.
            servings_text: (dbRecipe.servings_text && dbRecipe.servings_text.trim()) ? dbRecipe.servings_text : null,
            servings: (dbRecipe.servings_text && dbRecipe.servings_text.trim()) ? dbRecipe.servings_text : dbRecipe.servings
          };
          // Try to fetch the author's display name (profiles.display_name) and attach as proposerName
          try {
            if (dbRecipe.user_id) {
              const { data: prof, error: profErr } = await supabase
                .from('profiles')
                .select('display_name')
                .eq('user_id', dbRecipe.user_id)
                .maybeSingle();
              if (!profErr && prof?.display_name) {
                normalized.proposerName = prof.display_name;
              }
            }
          } catch (pfErr) {
            console.warn('[RecipeDetail] Failed to fetch proposer display_name:', pfErr?.message || pfErr);
          }

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
    return <div>הישארו על הקו, המתכון כבר עולה...</div>;
  }

  const isOwner = user && recipe.user_email === user.email;
  const isAdmin = user && user.email === ADMIN_EMAIL;
 

  const formatIngredient = (ing) => {
    if (!ing) return '';
    if (typeof ing === 'string') return ing; // old format
    if (ing.type === 'subtitle') return ing.text; // subtitle

    let amountRaw = (ing.amount_raw != null && String(ing.amount_raw).trim() !== '') ? String(ing.amount_raw).trim() : null;
    let unit = (ing.unit || '').trim();
    // If amount missing but unit contains a fraction (e.g. "כוסות 1/4"), extract it
    const fracFinder = /(\d+\s+\d+\/\d+|\d+\/\d+|[½¼¾⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]|\d+(?:[.,]\d+)?)/;
    if ((!amountRaw || amountRaw === '') && unit) {
      const m = unit.match(fracFinder);
      if (m) {
        amountRaw = m[0];
        unit = unit.replace(m[0], '').trim();
      }
    }
    // If both amount and unit contain numbers/fractions, merge into mixed amount
    if (amountRaw && unit) {
      const m2 = unit.match(fracFinder);
      if (m2) {
        amountRaw = `${amountRaw} ${m2[0]}`;
        unit = unit.replace(m2[0], '').trim();
      }
    }
    const name = ing.product_name || ing.name || '';

    // If unit is exactly the Hebrew word "יחידה", omit it from display
    const showUnit = unit && unit !== 'יחידה';

    // Adjust amount display for fractions (use formatting helper to show nice unicode fractions)
    const amountElement = (() => {
      if (!amountRaw) return null;
      try {
        const dec = parseAmountToDecimal(amountRaw);
        const formatted = formatAmountToFraction(dec);
        return (
          <span className="amount-ltr" style={{ direction: 'ltr', display: 'inline-block' }}>{formatted}</span>
        );
      } catch (err) {
        return amountRaw;
      }
    })();

    return (
      <span>
        {amountElement && <>{amountElement}{' '}</>}
        {showUnit && <>{unit}{' '}</>}
        {name}
        {ing.comment ? <> {' '}({ing.comment})</> : null}
      </span>
    );
  };

  const renderIngredients = () => {
    if (!recipe.ingredients) return null;
    if (Array.isArray(recipe.ingredients)) {
      return recipe.ingredients.map((ing, idx) => {
        if (ing.type === 'subtitle') {
          return <h4 key={idx} style={{ margin: '10px 0 5px 0', fontWeight: 'bold' }}>{ing.text}</h4>;
        } else {
          return (
            <li key={idx}>
              <input type="checkbox" id={`ingredient-${idx}`} />
              <label htmlFor={`ingredient-${idx}`}>{formatIngredient(ing)}</label>
            </li>
          );
        }
      });
    } else {
      // old format, assume array of strings or objects
      return (recipe.ingredients || []).map((ing, idx) => (
        <li key={idx}>
          <input type="checkbox" id={`ingredient-${idx}`} />
          <label htmlFor={`ingredient-${idx}`}>{formatIngredient(ing)}</label>
        </li>
      ));
    }
  };

  const renderInstructions = () => {
    if (!recipe.steps) return null;
    if (Array.isArray(recipe.steps)) {
      return recipe.steps.map((step, idx) => (
        <li key={idx}>
          <input type="checkbox" id={`step-${idx}`} />
          <label htmlFor={`step-${idx}`}>{step}</label>
        </li>
      ));
    } else {
      // old format, assume string
      return (
        <li>
          <input type="checkbox" id={`step-0`} />
          <label htmlFor={`step-0`}>{recipe.steps}</label>
        </li>
      );
    }
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
          setTimeout(() => navigate('/'), 800);
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
      setTimeout(() => navigate('/'), 800);
      return;
    }

    // mark built-in as deleted
    const deleted = JSON.parse(localStorage.getItem('deletedRecipes') || '[]');
    if (!deleted.includes(recipe.id)) {
      deleted.push(recipe.id);
      localStorage.setItem('deletedRecipes', JSON.stringify(deleted));
    }
    setMessage(hebrew.deleteSuccess);
    setTimeout(() => navigate('/'), 800);
  };

  const saveUpdatedRecipe = async (updated) => {
    // If Supabase is configured, persist the change to the DB
    if (useSupabase && supabase) {
      try {
        // Try updating including optional *_text fields first; if DB rejects due to missing columns, retry without them.
        const toUpdate = { ...updated };
        try {
          const { data: dbRow, error } = await supabase.from('recipes').update(toUpdate).eq('id', updated.id).select().single();
          if (error) throw error;
          const normalized = { ...dbRow, prepTime: dbRow.prep_time, cookTime: dbRow.cook_time };
          setAllRecipes([normalized]);
          return;
        } catch (innerErr) {
          const lower = (innerErr?.message || '').toLowerCase();
          const missingCols = ['cook_time_text','prep_time_text','servings_text'].filter(col => lower.includes(col));
          if (missingCols.length) {
            missingCols.forEach(c => delete toUpdate[c]);
            const { data: dbRow2, error: err2 } = await supabase.from('recipes').update(toUpdate).eq('id', updated.id).select().single();
            if (err2) throw err2;
            const normalized = { ...dbRow2, prepTime: dbRow2.prep_time, cookTime: dbRow2.cook_time };
            setAllRecipes([normalized]);
            return;
          }
          throw innerErr;
        }
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
    // Ensure updated_at exists for localStorage-saved recipes so "עריכה אחרונה" can display
    if (!updated.updated_at) {
      updated.updated_at = new Date().toISOString();
      // update stored entry as well
      const findIdx = userRecipes.findIndex(r => r.id === updated.id);
      if (findIdx !== -1) userRecipes[findIdx] = updated;
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

  // Helper: detect if a string looks like an image URL (Supabase public URL, http(s), data:, or common image extensions)
  const isImageUrl = (s) => {
    if (!s || typeof s !== 'string') return false;
    // Accept absolute http(s), data: URIs, Supabase public-storage paths, or common image extensions.
    return /^(https?:\/\/)/.test(s) || s.startsWith('data:') || s.startsWith('/storage/v1/object/public/') || /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?.*)?$/i.test(s);
  };

  // Prefer emoji from the recipe title (new behavior). Fallback to legacy `recipe.image` if it contains a short emoji.
  const titleEmoji = extractLeadingEmoji(recipe.title) || (recipe.image && typeof recipe.image === 'string' && recipe.image.length < 4 ? recipe.image : null);
  const formatDate = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    } catch (err) {
      return '';
    }
  };

  const formatMinutesToText = (mins) => {
    if (mins == null || mins === '' || Number.isNaN(Number(mins))) return '-';
    const m = Number(mins);
    if (!Number.isFinite(m)) return '-';
    if (m % 1440 === 0) {
      return `${m / 1440} ימים`;
    }
    if (m % 60 === 0) {
      return `${m / 60} שעות`;
    }
    return `${m} דקות`;
  };
  return (
    <div className="recipe-detail">
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}>
        <Link to="/" className="back-button">חזרה לכל המתכונים</Link>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        {user && (recipe.user_email === user.email || user.email === ADMIN_EMAIL) && (
          <>
            <button className="delete-button" onClick={handleDelete}>{hebrew.deleteRecipe}</button>
            <button style={{ marginLeft: 8 }} className="edit-button" onClick={() => setIsEditing(true)}>עריכה</button>
          </>
        )}
      </div>

      {message && <div className="success-message">{message}</div>}

      <div className="recipe-header">
        <div className="recipe-title-section">
          <div className="large-image">
            {recipeImages.length > 0 ? (
              <img src={recipeImages[0].image_url} alt={recipe.title} style={{ maxWidth: 300, borderRadius: 10 }} />
            ) : isImageUrl(recipe.image) ? (
              <img src={recipe.image} alt={recipe.title} style={{ maxWidth: 300, borderRadius: 10 }} />
            ) : null}
          </div>

          <h1>
            <span style={{ marginRight: 8 }}>{titleEmoji || '🍽️'}</span>
            {recipe.title.replace(titleEmoji, '').trim()}
          </h1>
          <div
            style={{
              fontSize: 12,
              color: '#666',
              marginTop: 6,
              marginBottom: 8,
              direction: 'rtl',
              textAlign: 'right'
            }}
          >
            מאת {recipe.proposerName || recipe.display_name || 'משתמש'} | {formatDate(recipe.created_at)}{recipe.updated_at && recipe.updated_at !== recipe.created_at ? ` [עריכה אחרונה ${formatDate(recipe.updated_at)}]` : ''}
          </div>

          {isEditing && (
            <AddRecipe
              editMode={true}
              initialData={recipe}
              onSave={handleEditSave}
              onCancel={() => setIsEditing(false)}
              onRecipeAdded={() => {}}
              recipes={allRecipes}
              user={user}
              displayName={displayName}
              userLoading={false}
            />
          )}

          <p className="recipe-description">{recipe.description}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <button onClick={() => handleReaction()} className="reaction-button" style={{ opacity: reactions[recipe.id]?.liked ? 1 : 0.6 }}>👍 { (reactions[recipe.id] && reactions[recipe.id].likes) || 0 }</button>
      </div>

      <div className="recipe-info">
        <div className="info-item">
          <strong>⏱️ {hebrew.prepTimeLabel}</strong>
          <p>{(recipe.prep_time_text && recipe.prep_time_text.trim()) ? recipe.prep_time_text : formatMinutesToText(recipe.prepTime ?? recipe.prep_time)}</p>
        </div>
        <div className="info-item">
          <strong>⏱️ {hebrew.cookTime}</strong>
          <p>{(recipe.cook_time_text && recipe.cook_time_text.trim()) ? recipe.cook_time_text : formatMinutesToText(recipe.cookTime ?? recipe.cook_time)}</p>
        </div>
        <div className="info-item">
          <strong>👥 {hebrew.servings}</strong>
          <p>{(recipe.servings_text && recipe.servings_text.trim()) ? recipe.servings_text : recipe.servings}</p>
        </div>
        <div className="info-item">
          <strong>📊 {hebrew.difficulty}</strong>
          <p>{recipe.difficulty === 'easy' ? 'קל' : recipe.difficulty === 'medium' ? 'בינוני' : recipe.difficulty === 'hard' ? 'קשה' : recipe.difficulty}</p>
        </div>
      </div>

      {recipe.source ? (
        <div style={{ marginTop: 8, marginBottom: 12, direction: 'rtl', textAlign: 'right' }}>
          <strong style={{ display: 'block', marginBottom: 4 }}>🔗 מקור</strong>
          <div style={{ color: '#333', wordBreak: 'break-word' }}>{recipe.source}</div>
        </div>
      ) : null}

      <div className="recipe-content">
        <div className="ingredients-section">
          <h2>{hebrew.ingredients}</h2>
          <div className="ingredients-list">
            {renderIngredients()}
          </div>
        </div>

        <div className="instructions-section">
          <h2>{hebrew.instructions}</h2>
          <ol className="instructions-list">
            {renderInstructions()}
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
    </div>
  );
}
