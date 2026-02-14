import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { hebrew } from '../data/hebrew';
import AddRecipe from './AddRecipe';
import './RecipeList.css';
import { supabase, useSupabase } from '../lib/supabaseClient';
import { extractLeadingEmoji } from '../lib/emojiUtils';

export default function RecipeList({ onSelectRecipe, user, displayName, userLoading }) {
  // start empty — when Supabase is configured we'll load DB results; otherwise load local fallback
  const [allRecipes, setAllRecipes] = useState([]);
  const [recipeImages, setRecipeImages] = useState({});  // recipe_id -> array of images
  const [reactions, setReactions] = useState({});
  const [sortBy, setSortBy] = useState('category');

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    try {
      if (useSupabase && supabase) {
        const { data: dbRecipes, error: rErr } = await supabase
          .from('recipes')
          .select('*')
          .order('created_at', { ascending: false });

        if (rErr) {
          console.error('[loadRecipes] Supabase fetch error:', rErr.code, rErr.message);
          throw rErr;
        }

        console.debug('[loadRecipes] fetched from supabase:', (dbRecipes || []).length, 'rows', (dbRecipes || []).slice(0,5).map(r => ({ id: r.id, title: r.title })));

        // Fetch all recipe images
        const { data: allImages, error: imgsErr } = await supabase
          .from('recipe_images')
          .select('recipe_id, id, image_url, uploaded_by_user_name');

        if (imgsErr) {
          console.warn('[loadRecipes] Recipe images fetch warning:', imgsErr.message);
        }

        // Group images by recipe_id
        const imagesMap = {};
        (allImages || []).forEach(img => {
          if (!imagesMap[img.recipe_id]) {
            imagesMap[img.recipe_id] = [];
          }
          imagesMap[img.recipe_id].push(img);
        });

        setRecipeImages(imagesMap);

        const { data: rx, error: rxErr } = await supabase
          .from('reactions')
          .select('*');

        if (rxErr) {
          console.warn('[loadRecipes] Reactions fetch warning (non-blocking):', rxErr.message);
        }

        const reactionsMap = {};
        (rx || []).forEach(row => {
          reactionsMap[row.recipe_id] = {
            likes: row.likes || 0,
            liked: Boolean(localStorage.getItem('liked_' + row.recipe_id))
          };
        });

        setReactions(reactionsMap);

        const mapped = (dbRecipes || []).map(r => ({
          ...r,
          id: r.id,
          prepTime: r.prep_time,
          cookTime: r.cook_time
        }));

        setAllRecipes(mapped);
        return;
      }
    } catch (err) {
      console.error('[loadRecipes] Error loading from Supabase:', err.message || err);
      // If RLS is the issue, log it explicitly
      if (err.code === 'PGRST001' || err.code === 'AUTH') {
        console.error('[loadRecipes] RLS policy issue detected — ensure "allow select recipes" policy exists and is enabled.');
      }
    }

    // Local fallback: empty list (not importing recipes.json—app uses localStorage or Supabase only)
    setAllRecipes([]);
    setRecipeImages({});
  };

  const handleRecipeAdded = (newRecipe, opts = { refetch: false }) => {
    // optimistic UI: prepend inserted recipe returned from Supabase or local fallback
    if (newRecipe && newRecipe.id) {
      setAllRecipes(prev => {
        if (prev.find(r => String(r.id) === String(newRecipe.id))) return prev;
        return [{ ...newRecipe }, ...prev];
      });
    }

    // if requested, re-fetch from Supabase to reconcile eventual consistency / RLS behavior
    if (opts.refetch && useSupabase && supabase) {
      // small delay to allow DB to become consistent
      setTimeout(() => loadRecipes(), 900);
      return;
    }

    // otherwise ensure UI matches server by reloading once
    if (!newRecipe) loadRecipes();
  };

  const handleReaction = async (e, id) => {
    e.stopPropagation();
    try {
      const likedKey = 'liked_' + id;
      const currentlyLiked = !!localStorage.getItem(likedKey);
      const REACTIONS_API = import.meta.env.VITE_REACTIONS_API_URL;

      // 1) If there's an edge function configured, use it (secure)
      if (REACTIONS_API) {
        const action = currentlyLiked ? 'unlike' : 'like';
        const res = await fetch(REACTIONS_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipe_id: id, action })
        });
        if (res.ok) {
          const j = await res.json();
          if (currentlyLiked) localStorage.removeItem(likedKey); else localStorage.setItem(likedKey, '1');
          setReactions(prev => ({ ...prev, [id]: { likes: j.likes || 0, liked: !currentlyLiked } }));
          return;
        }
      }

      // 2) If Supabase client is available, use it
      if (useSupabase && supabase) {
        const { data: row, error: rowErr } = await supabase.from('reactions').select('*').eq('recipe_id', id).maybeSingle();
        if (rowErr && rowErr.code !== 'PGRST116') { /* ignore not found */ }
        const currentLikes = row?.likes || 0;
        const nextLikes = currentlyLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1;
        const upsert = { recipe_id: id, likes: nextLikes };
        const { error: upErr } = await supabase.from('reactions').upsert(upsert, { onConflict: ['recipe_id'] });
        if (upErr) throw upErr;
        if (currentlyLiked) localStorage.removeItem(likedKey); else localStorage.setItem(likedKey, '1');
        setReactions(prev => ({ ...prev, [id]: { likes: nextLikes, liked: !currentlyLiked } }));
        return;
      }

      // 3) Fallback to localStorage-only behavior
      const cur = JSON.parse(localStorage.getItem('recipeReactions') || '{}');
      const entry = cur[id] || { likes: 0 };
      if (entry.liked) {
        entry.likes = Math.max(0, entry.likes - 1);
        entry.liked = false;
      } else {
        entry.likes = (entry.likes || 0) + 1;
        entry.liked = true;
      }
      cur[id] = entry;
      setReactions(prev => ({ ...prev, [id]: entry }));
      localStorage.setItem('recipeReactions', JSON.stringify(cur));

    } catch (err) {
      console.error('Reaction error', err);
      // show unobtrusive feedback in dev; avoid leaking details in prod
    }
  };

  const getStableRandomImage = (images, recipeId) => {
    // Use recipe ID as a seed for stable-ish random selection
    // This way the same recipe always shows the same preview image on the same page load
    if (!Array.isArray(images) || images.length === 0) return null;
    const hash = recipeId.split('').reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0);
    const index = Math.abs(hash) % images.length;
    return images[index];
  };

  return (
    <div className="recipe-list">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Link to="/proposals" style={{ fontWeight: 'bold', color: '#2d7ff9', textDecoration: 'underline', fontSize: 16 }}>
          הצעות לשיפור הבלוג
        </Link>
      </div>
      <h1>{hebrew.title}</h1>
      <p className="subtitle">{hebrew.subtitle}</p>

      <div className="list-controls">
        {userLoading ? (
          <div style={{ textAlign: 'center', margin: '2em 0', fontSize: '1.2em' }}>טוען נתוני התחברות...</div>
        ) : user ? (
          <AddRecipe
            onRecipeAdded={handleRecipeAdded}
            recipes={allRecipes}
            user={user}
            displayName={displayName}
            userLoading={userLoading}
          />
        ) : (
          <div style={{ fontSize: 13, opacity: 0.7 }}>
            התחברו כדי להוסיף מתכונים
          </div>
        )}

        <div className="sort-container">
          <label>סדר לפי:</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="category">קטגוריה</option>
            <option value="newest">חדש ביותר</option>
            <option value="name">שם (א-ת)</option>
          </select>
        </div>
      </div>

      <div className="recipes-grid">
        {allRecipes.map((recipe) => {
          const r = reactions[recipe.id] || { likes: 0 };
          // Get preview image from recipe_images table
          const images = recipeImages[recipe.id] || [];
          const previewImage = images.length > 0 ? getStableRandomImage(images, recipe.id) : null;
          // Prefer emoji from the title (new stored format). Fallback to legacy `recipe.image` emoji when present.
          const titleEmoji = extractLeadingEmoji(recipe.title) || (recipe.image && typeof recipe.image === 'string' && recipe.image.length < 4 ? recipe.image : null);

          return (
            <Link
              to={`/recipe/${recipe.id}`}
              key={recipe.id}
              className="recipe-card"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              {previewImage ? (
                <div style={{ marginBottom: 8, height: 120, overflow: 'hidden', borderRadius: '8px 8px 0 0', position: 'relative' }}>
                  <img src={previewImage.image_url} alt={recipe.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {/* Show uploader name on image */}
                  {previewImage.uploaded_by_user_name && (
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'rgba(0, 0, 0, 0.5)',
                      color: 'white',
                      padding: '2px 6px',
                      fontSize: 11,
                      textAlign: 'right'
                    }}>
                      {previewImage.uploaded_by_user_name}
                    </div>
                  )}
                </div>
              ) : titleEmoji ? (
                <div style={{ marginBottom: 8, height: 120, overflow: 'hidden', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '64px', background: '#f5f5f5' }}>
                  {titleEmoji}
                </div>
              ) : null}
              <h3>{recipe.title}</h3>
              <p className="recipe-description">{recipe.description}</p>

              <div className="recipe-meta">
                <span>
                  ⏱️ {Number(recipe.prepTime || 0) + Number(recipe.cookTime || 0)} דקות
                </span>
                <span>👥 {recipe.servings}</span>
              </div>

              {recipe.profiles?.display_name && (
                <div
                  className="recipe-author"
                  style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}
                >
                  נוסף ע״י {recipe.profiles.display_name}
                </div>
              )}

              <div style={{ marginTop: 8 }}>
                <button
                  onClick={(e) => handleReaction(e, recipe.id)}
                  className="reaction-button"
                  style={{ opacity: r.liked ? 1 : 0.6 }}
                >
                  👍 {r.likes || 0}
                </button>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
