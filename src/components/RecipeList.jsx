import React, { useState, useEffect } from 'react';
import recipes from '../data/recipes.json';
import { hebrew } from '../data/hebrew';
import AddRecipe from './AddRecipe';
import './RecipeList.css';
import { supabase, useSupabase } from '../lib/supabaseClient';

export default function RecipeList({ onSelectRecipe }) {
  const [allRecipes, setAllRecipes] = useState(recipes);
  const [reactions, setReactions] = useState({});
  const [sortBy, setSortBy] = useState('category');

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    try {
      if (useSupabase && supabase) {
        const { data: dbRecipes, error: rErr } = await supabase.from('recipes').select('*').order('created_at', { ascending: false });
        if (rErr) throw rErr;
        const { data: rx, error: rxErr } = await supabase.from('reactions').select('*');
        if (rxErr) throw rxErr;
        const reactionsMap = {};
        (rx || []).forEach(row => { reactionsMap[row.recipe_id] = { likes: row.likes || 0, liked: Boolean(localStorage.getItem('liked_' + row.recipe_id)) }; });
        setReactions(reactionsMap);
        if (dbRecipes && dbRecipes.length) {
          setAllRecipes(dbRecipes);
          return;
        }
      }
    } catch (err) {
      console.error('Error loading from Supabase', err);
    }

    const userRecipes = JSON.parse(localStorage.getItem('userRecipes') || '[]');
    const deleted = JSON.parse(localStorage.getItem('deletedRecipes') || '[]');
    const combined = [...userRecipes, ...recipes].filter(r => !deleted.includes(r.id));
    setAllRecipes(combined);
  };

  const handleRecipeAdded = () => {
    loadRecipes();
  };

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('recipeReactions') || '{}');
    setReactions(stored);
  }, []);

  const saveReactions = (next) => {
    setReactions(next);
    localStorage.setItem('recipeReactions', JSON.stringify(next));
  };

  const handleReaction = async (e, id) => {
    e.stopPropagation();
    try {
      const likedKey = 'liked_' + id;
      const currentlyLiked = !!localStorage.getItem(likedKey);
      // If there's a secure reaction API URL configured, call it instead of anon upsert
      const REACTIONS_API = import.meta.env.VITE_REACTIONS_API_URL;
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
          const next = { ...(reactions || {}) };
          next[id] = { likes: j.likes || 0, liked: !currentlyLiked };
          saveReactions(next);
          return;
        }
      }

      if (useSupabase && supabase) {
        const { data: row, error: rowErr } = await supabase.from('reactions').select('*').eq('recipe_id', id).single();
        if (rowErr && rowErr.code !== 'PGRST116') { /* ignore not found */ }
        const currentLikes = row?.likes || 0;
        const nextLikes = currentlyLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1;
        const upsert = { recipe_id: id, likes: nextLikes };
        const { error: upErr } = await supabase.from('reactions').upsert(upsert, { onConflict: ['recipe_id'] });
        if (upErr) throw upErr;
        if (currentlyLiked) localStorage.removeItem(likedKey); else localStorage.setItem(likedKey, '1');
        const next = { ...(reactions || {}) };
        next[id] = { likes: nextLikes, liked: !currentlyLiked };
        saveReactions(next);
        return;
      }

      const cur = JSON.parse(localStorage.getItem('recipeReactions') || '{}');
      const entry = cur[id] || { likes: 0 };
      if (entry.liked) {
        entry.likes = Math.max(0, entry.likes - 1);
        entry.liked = false;
        localStorage.removeItem('liked_' + id);
      } else {
        entry.likes = (entry.likes || 0) + 1;
        entry.liked = true;
        localStorage.setItem('liked_' + id, '1');
      }
      cur[id] = entry;
      saveReactions(cur);
    } catch (err) {
      console.error('Reaction error', err);
    }
  };

  const sortRecipes = (items) => {
    const sorted = [...items];
    switch (sortBy) {
      case 'newest':
        return sorted.reverse();
      case 'name':
        return sorted.sort((a, b) => a.title.localeCompare(b.title, 'he'));
      case 'prepTime':
        return sorted.sort((a, b) => (a.prepTime || 0) - (b.prepTime || 0));
      case 'totalTime': {
        return sorted.sort((a, b) => {
          const ta = Number(a.prepTime || 0) + Number(a.cookTime || 0);
          const tb = Number(b.prepTime || 0) + Number(b.cookTime || 0);
          return ta - tb;
        });
      }
      case 'difficulty': {
        const diffOrder = { 'קל': 1, 'בינוני': 2, 'קשה': 3 };
        return sorted.sort((a, b) => (diffOrder[a.difficulty] || 0) - (diffOrder[b.difficulty] || 0));
      }
      case 'popularity':
        return sorted.sort((a, b) => (reactions[b.id]?.likes || 0) - (reactions[a.id]?.likes || 0));
      case 'category':
      default:
        return sorted;
    }
  };

  const groupByCategory = (items) => {
    const groups = {};
    items.forEach(recipe => {
      const cat = recipe.category || 'ללא קטגוריה';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(recipe);
    });
    return groups;
  };

  const getDisplayRecipes = () => {
    const sorted = sortRecipes(allRecipes);
    if (sortBy === 'category') {
      return groupByCategory(sorted);
    }
    return { 'כל המתכונים': sorted };
  };

  const displayData = getDisplayRecipes();

  return (
    <div className="recipe-list">
      <h1>{hebrew.title}</h1>
      <p className="subtitle">{hebrew.subtitle}</p>
      
      <div className="list-controls">
        <AddRecipe onRecipeAdded={handleRecipeAdded} recipes={recipes} />
        <div className="sort-container">
          <label>סדר לפי:</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="category">קטגוריה</option>
            <option value="newest">חדש ביותר</option>
            <option value="name">שם (א-ת)</option>
            <option value="prepTime">זמן הכנה</option>
            <option value="totalTime">זמן כולל</option>
            <option value="difficulty">דרגת קושי</option>
            <option value="popularity">הנפוצים</option>
          </select>
        </div>
      </div>

      {Object.entries(displayData).map(([categoryName, categoryRecipes]) => (
        <div key={categoryName} className="category-section">
          <h2 className="category-title">{categoryName}</h2>
          <div className="recipes-grid">
            {categoryRecipes.map((recipe) => {
              const r = reactions[recipe.id] || { likes: 0 };
              return (
                <div
                  key={recipe.id}
                  className="recipe-card"
                  onClick={() => onSelectRecipe(recipe.id)}
                >
                  <div className="recipe-image">
                    {Array.isArray(recipe.images) && recipe.images[0] ? (
                      <img src={recipe.images[0]} alt={recipe.title} style={{ maxWidth: '100%', borderRadius: 8 }} />
                    ) : (typeof recipe.image === 'string' && recipe.image.startsWith('data:') ? (
                      <img src={recipe.image} alt={recipe.title} style={{ maxWidth: '100%', borderRadius: 8 }} />
                    ) : (
                      recipe.image
                    ))}
                  </div>
                  <h3>{recipe.title}</h3>
                  <p className="recipe-description">{recipe.description}</p>
                  <div className="recipe-meta">
                    <span>⏱️ {Number(recipe.prepTime || 0) + Number(recipe.cookTime || 0)} דקות</span>
                    <span>👥 {recipe.servings}</span>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={(e) => handleReaction(e, recipe.id)} className="reaction-button" style={{ opacity: r.liked ? 1 : 0.6 }}>👍 {r.likes || 0}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
