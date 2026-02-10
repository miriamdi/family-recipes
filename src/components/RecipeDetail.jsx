import React, { useState, useEffect } from 'react';
import recipes from '../data/recipes.json';
import { hebrew } from '../data/hebrew';
import './RecipeDetail.css';

export default function RecipeDetail({ recipeId, onBack }) {
  const [allRecipes, setAllRecipes] = useState(recipes);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const userRecipes = JSON.parse(localStorage.getItem('userRecipes') || '[]');
    const deleted = JSON.parse(localStorage.getItem('deletedRecipes') || '[]');
    setAllRecipes([...recipes, ...userRecipes].filter(r => !deleted.includes(r.id)));
  }, []);

  const recipe = allRecipes.find((r) => r.id === recipeId);

  if (!recipe) {
    return <div>המתכון לא נמצא</div>;
  }

  const formatIngredient = (ing) => {
    if (!ing) return '';
    if (typeof ing === 'string') return ing;
    return `${ing.name}${ing.qty ? ' • ' + ing.qty : ''}${ing.unit ? ' ' + ing.unit : ''}`;
  };

  const handleDelete = () => {
    const pw = window.prompt(hebrew.deletePasswordPrompt || 'Password');
    if (pw !== 'miriamdi') {
      alert(hebrew.passwordError);
      return;
    }

    const userRecipes = JSON.parse(localStorage.getItem('userRecipes') || '[]');
    // try to remove from userRecipes
    const idx = userRecipes.findIndex(r => r.id === recipe.id);
    if (idx !== -1) {
      userRecipes.splice(idx, 1);
      localStorage.setItem('userRecipes', JSON.stringify(userRecipes));
      setMessage(hebrew.deleteSuccess);
      setTimeout(() => onBack(), 800);
      return;
    }

    // mark built-in as deleted
    const deleted = JSON.parse(localStorage.getItem('deletedRecipes') || '[]');
    if (!deleted.includes(recipe.id)) {
      deleted.push(recipe.id);
      localStorage.setItem('deletedRecipes', JSON.stringify(deleted));
    }
    setMessage(hebrew.deleteSuccess);
    setTimeout(() => onBack(), 800);
  };

  return (
    <div className="recipe-detail">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="back-button" onClick={onBack}>{hebrew.backToRecipes} ←</button>
        <button className="delete-button" onClick={handleDelete}>{hebrew.deleteRecipe}</button>
      </div>

      {message && <div className="success-message">{message}</div>}

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
            {Array.isArray(recipe.ingredients) && recipe.ingredients.map((ingredient, index) => (
              <li key={index}>
                <input type="checkbox" id={`ingredient-${index}`} />
                <label htmlFor={`ingredient-${index}`}>{formatIngredient(ingredient)}</label>
              </li>
            ))}
          </ul>
        </div>

        <div className="instructions-section">
          <h2>{hebrew.instructions}</h2>
          <ol className="instructions-list">
            {Array.isArray(recipe.steps) && recipe.steps.map((step, index) => (
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
