import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { hebrew } from '../data/hebrew';
import AddRecipe from './AddRecipe';
import styles from './RecipeList.module.css';
import Skeleton from './Skeleton';
import { supabase, useSupabase } from '../lib/supabaseClient';
import { extractLeadingEmoji } from '../lib/emojiUtils';

export default function RecipeList({ onSelectRecipe, user, displayName, userLoading }) {
  // start empty — when Supabase is configured we'll load DB results; otherwise load local fallback
  const [allRecipes, setAllRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
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
          cookTime: r.cook_time,
          prep_time_text: r.prep_time_text,
          cook_time_text: r.cook_time_text,
          servings: (r.servings_text && r.servings_text.trim()) ? r.servings_text : r.servings
        }));

        setAllRecipes(mapped);
        setLoading(false);
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
    setLoading(false);
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

  const formatMinutesToText = (mins) => {
    if (mins == null || mins === '' || Number.isNaN(Number(mins))) return '—';
    const m = Number(mins);
    if (!Number.isFinite(m)) return '—';
    if (m % 1440 === 0) return `${m / 1440} ימים`;
    if (m % 60 === 0) return `${m / 60} שעות`;
    return `${m} דקות`;
  };

  const getRecipeTimeText = (recipe) => {
    // Accept multiple possible property names from different sources
    const txt = recipe.cook_time_text ?? recipe.cookTimeText ?? recipe.cook_time ?? null;
    if (typeof txt === 'string' && txt.trim()) return txt;
    const cook = recipe.cookTime ?? recipe.cook_time ?? null;
    const prep = recipe.prepTime ?? recipe.prep_time ?? null;
    if (cook != null) return formatMinutesToText(cook);
    if (prep != null) return formatMinutesToText(prep);
    return '—';
  };

  const getServingsText = (recipe) => {
    const txt = recipe.servings_text ?? recipe.servingsText ?? null;
    if (typeof txt === 'string' && txt.trim()) return txt;
    if (recipe.servings != null) return String(recipe.servings);
    return '—';
  };


  return (
    <div className={styles.recipeList}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Link to="/proposals" style={{ fontWeight: '700', color: 'var(--accent)', textDecoration: 'underline', fontSize: 16 }}>
          הצעות לשיפור הבלוג
        </Link>
      </div>
      <h1 className={styles.title}>{hebrew.title}</h1>
      <p className={styles.subtitle}>{hebrew.subtitle}</p>

      <div className={styles.listControls}>
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

        <div className={styles.sortContainer}>
          <label className={styles.sortLabel}>סדר לפי:</label>
          <select className={styles.sortSelect} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="category">קטגוריה</option>
            <option value="newest">חדש ביותר</option>
            <option value="name">שם (א-ת)</option>
          </select>
        </div>
      </div>

      {loading ? (
        <Skeleton count={6} />
      ) : (
        <div>
        {sortBy === 'category' ? (
          // Group recipes by category and render a heading for each
          (() => {
            const groups = {};
            (allRecipes || []).forEach(r => {
              const catRaw = (r.category || '').trim();
              const cat = catRaw || 'אחרים';
              if (!groups[cat]) groups[cat] = [];
              groups[cat].push(r);
            });

            const ORDER = [
              'מנות פתיחה',
              'סלטים',
              'מרקים',
              'עיקריות',
              'תוספות',
              'מאפים ולחמים',
              'קינוחים',
              'משקאות'
            ];

            // Render categories in the requested order; any other categories go into 'אחרים' after
            const elements = [];
            ORDER.forEach(cat => {
              if (groups[cat]) {
                elements.push(cat);
              }
            });
            // collect other categories
            const otherCats = Object.keys(groups).filter(c => !ORDER.includes(c) && c !== 'אחרים').sort((a,b) => a.localeCompare(b));
            if (groups['אחרים'] || otherCats.length) elements.push('אחרים');

            return (
              <div>
                {elements.map(cat => (
                  <div key={cat} style={{ marginBottom: 24 }}>
                    <h2 className={styles.categoryTitle}>{cat}</h2>
                    <div className={styles.recipesGrid}>
                      {(cat === 'אחרים'
                        ? [ ...(groups['אחרים'] || []), ...otherCats.flatMap(c => groups[c] || []) ]
                        : groups[cat]
                      ).map((recipe) => {
          const r = reactions[recipe.id] || { likes: 0 };
          // Get preview image from recipe_images table
          const images = recipeImages[recipe.id] || [];
          const previewImage = images.length > 0 ? getStableRandomImage(images, recipe.id) : null;
          // Prefer emoji from the title (new stored format). Fallback to legacy `recipe.image` emoji when present.
          const titleEmoji = extractLeadingEmoji(recipe.title) || (recipe.image && typeof recipe.image === 'string' && recipe.image.length < 4 ? recipe.image : null);

                      return (
                        <Link to={`/recipe/${recipe.id}`} key={recipe.id} className={styles.recipeCard}>
              {previewImage ? (
                <div className={styles.previewImage}>
                  <img src={previewImage.image_url} alt={recipe.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ) : titleEmoji ? (
                <div className={styles.previewEmoji}>{titleEmoji}</div>
              ) : null}

              <h3 className={styles.cardTitle}>{recipe.title}</h3>
              <p className={styles.recipeDescription}>{recipe.description}</p>

              <div className={styles.recipeMeta}>
                <span>⏱️ {getRecipeTimeText(recipe)}</span>
                <span>👥 {getServingsText(recipe)}</span>
              </div>

              {recipe.profiles?.display_name && (
                <div className={styles.author}>נוסף ע״י {recipe.profiles.display_name}</div>
              )}

              <div style={{ marginTop: 8 }}>
                <button onClick={(e) => handleReaction(e, recipe.id)} className={styles.reactionButton} style={{ opacity: r.liked ? 1 : 0.6 }} aria-pressed={!!r.liked} aria-label={`לאהוב ${recipe.title}`}>
                  👍 {r.likes || 0}
                </button>
              </div>
                        </Link>
                      );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()
        ) : (
          <div className={styles.recipesGrid}>
            {allRecipes.map((recipe) => {
              const r = reactions[recipe.id] || { likes: 0 };
              const images = recipeImages[recipe.id] || [];
              const previewImage = images.length > 0 ? getStableRandomImage(images, recipe.id) : null;
              const titleEmoji = extractLeadingEmoji(recipe.title) || (recipe.image && typeof recipe.image === 'string' && recipe.image.length < 4 ? recipe.image : null);

              return (
                <Link to={`/recipe/${recipe.id}`} key={recipe.id} className={styles.recipeCard}>
                  {previewImage ? (
                    <div className={styles.previewImage}>
                      <img src={previewImage.image_url} alt={recipe.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : titleEmoji ? (
                    <div className={styles.previewEmoji}>{titleEmoji}</div>
                  ) : null}

                  <h3 className={styles.cardTitle}>{recipe.title}</h3>
                  <p className={styles.recipeDescription}>{recipe.description}</p>

                  <div className={styles.recipeMeta}>
                    <span>⏱️ {getRecipeTimeText(recipe)}</span>
                    <span>👥 {getServingsText(recipe)}</span>
                  </div>

                  {recipe.profiles?.display_name && (
                    <div className={styles.author}>נוסף ע״י {recipe.profiles.display_name}</div>
                  )}

                  <div style={{ marginTop: 8 }}>
                    <button onClick={(e) => handleReaction(e, recipe.id)} className={styles.reactionButton} style={{ opacity: r.liked ? 1 : 0.6 }} aria-pressed={!!r.liked} aria-label={`לאהוב ${recipe.title}`}>
                      👍 {r.likes || 0}
                    </button>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        </div>
      )}
    </div>
  );
}
