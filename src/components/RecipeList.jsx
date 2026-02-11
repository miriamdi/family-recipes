import React, { useState, useEffect } from 'react';
import { hebrew } from '../data/hebrew';
import AddRecipe from './AddRecipe';
import './RecipeList.css';
import { supabase, useSupabase } from '../lib/supabaseClient';

export default function RecipeList({ onSelectRecipe, user, displayName }) {
  // start empty — when Supabase is configured we'll load DB results; otherwise load local fallback
  const [allRecipes, setAllRecipes] = useState([]);
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
          .select('*, profiles(display_name)')
          .order('created_at', { ascending: false });

        if (rErr) throw rErr;

        // Always prefer DB results when Supabase is configured (even empty)
        console.debug('[loadRecipes] fetched from supabase:', (dbRecipes || []).length, 'rows', (dbRecipes || []).slice(0,5).map(r => r.id));

        const { data: rx, error: rxErr } = await supabase
          .from('reactions')
          .select('*');

        if (rxErr) throw rxErr;

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
      console.error('Error loading from Supabase', err);
      // fall through to local fallback only on error
    }

    setAllRecipes(recipes);
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

  return (
    <div className="recipe-list">
      <h1>{hebrew.title}</h1>
      <p className="subtitle">{hebrew.subtitle}</p>

      <div className="list-controls">
        {user ? (
          <AddRecipe
            onRecipeAdded={handleRecipeAdded}
            recipes={allRecipes}
            user={user}
            displayName={displayName}
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

          return (
            <div
              key={recipe.id}
              className="recipe-card"
              onClick={() => onSelectRecipe(recipe.id)}
            >
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
