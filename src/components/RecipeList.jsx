import React, { useState, useEffect } from 'react';
import recipes from '../data/recipes.json';
import { hebrew } from '../data/hebrew';
import AddRecipe from './AddRecipe';
import './RecipeList.css';
import { supabase, useSupabase } from '../lib/supabaseClient';

export default function RecipeList({ onSelectRecipe, user, displayName }) {
  const [allRecipes, setAllRecipes] = useState(recipes);
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

        if (dbRecipes && dbRecipes.length) {
          const mapped = dbRecipes.map(r => ({
            ...r,
            id: r.id,
            prepTime: r.prep_time,
            cookTime: r.cook_time
          }));
          setAllRecipes(mapped);
          return;
        }
      }
    } catch (err) {
      console.error('Error loading from Supabase', err);
    }

    setAllRecipes(recipes);
  };

  const handleRecipeAdded = () => {
    loadRecipes();
  };

  const handleReaction = async (e, id) => {
    e.stopPropagation();
    try {
      const likedKey = 'liked_' + id;
      const currentlyLiked = !!localStorage.getItem(likedKey);

      const { data: row } = await supabase
        .from('reactions')
        .select('*')
        .eq('recipe_id', id)
        .maybeSingle();

      const currentLikes = row?.likes || 0;
      const nextLikes = currentlyLiked
        ? Math.max(0, currentLikes - 1)
        : currentLikes + 1;

      await supabase
        .from('reactions')
        .upsert(
          { recipe_id: id, likes: nextLikes },
          { onConflict: 'recipe_id' }
        );

      if (currentlyLiked) {
        localStorage.removeItem(likedKey);
      } else {
        localStorage.setItem(likedKey, '1');
      }

      setReactions(prev => ({
        ...prev,
        [id]: { likes: nextLikes, liked: !currentlyLiked }
      }));
    } catch (err) {
      console.error('Reaction error', err);
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
            recipes={recipes}
            user={user}
            displayName={displayName}
          />
        ) : (
          <div style={{ fontSize: 13, opacity: 0.7 }}>
            התחברי כדי להוסיף מתכון
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
