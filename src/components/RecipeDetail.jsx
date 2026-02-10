import React from 'react';
import recipes from '../data/recipes.json';
import './RecipeDetail.css';

export default function RecipeDetail({ recipeId, onBack }) {
  const recipe = recipes.find((r) => r.id === recipeId);

  if (!recipe) {
    return <div>Recipe not found</div>;
  }

  return (
    <div className="recipe-detail">
      <button className="back-button" onClick={onBack}>
        ← Back to Recipes
      </button>

      <div className="recipe-header">
        <div className="recipe-title-section">
          <div className="large-image">{recipe.image}</div>
          <h1>{recipe.title}</h1>
          <p className="recipe-description">{recipe.description}</p>
        </div>
      </div>

      <div className="recipe-info">
        <div className="info-item">
          <strong>⏱️ Prep Time</strong>
          <p>{recipe.prepTime} min</p>
        </div>
        <div className="info-item">
          <strong>🔥 Cook Time</strong>
          <p>{recipe.cookTime} min</p>
        </div>
        <div className="info-item">
          <strong>👥 Servings</strong>
          <p>{recipe.servings}</p>
        </div>
        <div className="info-item">
          <strong>📊 Difficulty</strong>
          <p>{recipe.difficulty}</p>
        </div>
      </div>

      <div className="recipe-content">
        <div className="ingredients-section">
          <h2>Ingredients</h2>
          <ul className="ingredients-list">
            {recipe.ingredients.map((ingredient, index) => (
              <li key={index}>
                <input type="checkbox" id={`ingredient-${index}`} />
                <label htmlFor={`ingredient-${index}`}>{ingredient}</label>
              </li>
            ))}
          </ul>
        </div>

        <div className="instructions-section">
          <h2>Instructions</h2>
          <ol className="instructions-list">
            {recipe.steps.map((step, index) => (
              <li key={index}>
                <input type="checkbox" id={`step-${index}`} />
                <label htmlFor={`step-${index}`}>{step}</label>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
