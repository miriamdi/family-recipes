import React, { useState, useEffect } from 'react';
import recipes from '../data/recipes.json';
import { hebrew } from '../data/hebrew';
import './RecipeDetail.css';

export default function RecipeDetail({ recipeId, onBack }) {
  const [allRecipes, setAllRecipes] = useState(recipes);

  useEffect(() => {
    const userRecipes = JSON.parse(localStorage.getItem('userRecipes') || '[]');
    setAllRecipes([...recipes, ...userRecipes]);
  }, []);

  const recipe = allRecipes.find((r) => r.id === recipeId);

  if (!recipe) {
    return <div>المتكن لم يتم العثور عليه</div>;
  }

  return (
    <div className="recipe-detail">
      <button className="back-button" onClick={onBack}>
        {hebrew.backToRecipes} ←
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
            {recipe.ingredients.map((ingredient, index) => (
              <li key={index}>
                <input type="checkbox" id={`ingredient-${index}`} />
                <label htmlFor={`ingredient-${index}`}>{ingredient}</label>
              </li>
            ))}
          </ul>
        </div>

        <div className="instructions-section">
          <h2>{hebrew.instructions}</h2>
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
