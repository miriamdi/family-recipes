import React, { useState, useEffect } from 'react';
import recipes from '../data/recipes.json';
import { hebrew } from '../data/hebrew';
import AddRecipe from './AddRecipe';
import './RecipeList.css';

export default function RecipeList({ onSelectRecipe }) {
  const [allRecipes, setAllRecipes] = useState(recipes);

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = () => {
    const userRecipes = JSON.parse(localStorage.getItem('userRecipes') || '[]');
    setAllRecipes([...recipes, ...userRecipes]);
  };

  const handleRecipeAdded = () => {
    loadRecipes();
  };

  return (
    <div className="recipe-list">
      <h1>{hebrew.title}</h1>
      <p className="subtitle">{hebrew.subtitle}</p>
      <AddRecipe onRecipeAdded={handleRecipeAdded} recipes={allRecipes} />
      <div className="recipes-grid">
        {allRecipes.map((recipe) => (
          <div
            key={recipe.id}
            className="recipe-card"
            onClick={() => onSelectRecipe(recipe.id)}
          >
            <div className="recipe-image">{recipe.image}</div>
            <h2>{recipe.title}</h2>
            <p className="recipe-description">{recipe.description}</p>
            <div className="recipe-meta">
              <span>⏱️ {recipe.prepTime + recipe.cookTime} דקות</span>
              <span>👥 {recipe.servings}</span>
            </div>
            <button className="learn-more">{hebrew.viewRecipe}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
