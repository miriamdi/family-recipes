import React from 'react';
import recipes from '../data/recipes.json';
import './RecipeList.css';

export default function RecipeList({ onSelectRecipe }) {
  return (
    <div className="recipe-list">
      <h1>Family Recipes</h1>
      <p className="subtitle">Easy and delicious recipes for everyone</p>
      <div className="recipes-grid">
        {recipes.map((recipe) => (
          <div
            key={recipe.id}
            className="recipe-card"
            onClick={() => onSelectRecipe(recipe.id)}
          >
            <div className="recipe-image">{recipe.image}</div>
            <h2>{recipe.title}</h2>
            <p className="recipe-description">{recipe.description}</p>
            <div className="recipe-meta">
              <span>⏱️ {recipe.prepTime + recipe.cookTime} min</span>
              <span>👥 {recipe.servings}</span>
            </div>
            <button className="learn-more">View Recipe</button>
          </div>
        ))}
      </div>
    </div>
  );
}
