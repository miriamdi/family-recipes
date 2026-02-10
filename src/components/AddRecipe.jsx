import React, { useState } from 'react';
import { hebrew } from '../data/hebrew';
import './AddRecipe.css';

export default function AddRecipe({ onRecipeAdded, recipes }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image: '🍳',
    prepTime: '',
    cookTime: '',
    servings: '',
    difficulty: 'קל',
    ingredients: '',
    steps: ''
  });
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    // Check password
    if (password !== '029944082') {
      setError(hebrew.passwordError);
      return;
    }

    // Validate required fields
    if (!formData.name || !formData.description || !formData.ingredients || !formData.steps) {
      setError('בבקשה מלא את כל השדות');
      return;
    }

    // Create new recipe object
    const newRecipe = {
      id: Math.max(...recipes.map(r => r.id), 0) + 1,
      title: formData.name,
      description: formData.description,
      image: formData.image,
      prepTime: parseInt(formData.prepTime) || 10,
      cookTime: parseInt(formData.cookTime) || 20,
      servings: parseInt(formData.servings) || 4,
      difficulty: formData.difficulty,
      ingredients: formData.ingredients.split('\n').filter(i => i.trim()),
      steps: formData.steps.split('\n').filter(s => s.trim())
    };

    // Save to localStorage
    const savedRecipes = JSON.parse(localStorage.getItem('userRecipes') || '[]');
    savedRecipes.push(newRecipe);
    localStorage.setItem('userRecipes', JSON.stringify(savedRecipes));

    setMessage(hebrew.successMessage);
    setFormData({
      name: '',
      description: '',
      image: '🍳',
      prepTime: '',
      cookTime: '',
      servings: '',
      difficulty: 'קל',
      ingredients: '',
      steps: ''
    });
    setPassword('');

    setTimeout(() => {
      onRecipeAdded();
      setShowForm(false);
      setMessage('');
    }, 1500);
  };

  if (!showForm) {
    return (
      <button className="add-recipe-button" onClick={() => setShowForm(true)}>
        {hebrew.addRecipe}
      </button>
    );
  }

  return (
    <div className="add-recipe-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h2>הוסף מתכון חדש</h2>
          <button
            className="close-button"
            onClick={() => {
              setShowForm(false);
              setError('');
              setMessage('');
            }}
          >
            ✕
          </button>
        </div>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{hebrew.recipeName}</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="למ״ד כשרה מעולה"
            />
          </div>

          <div className="form-group">
            <label>{hebrew.recipeDescription}</label>
            <input
              type="text"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="מתכון משפחתי דור על דור"
            />
          </div>

          <div className="form-group">
            <label>{hebrew.recipeImage}</label>
            <input
              type="text"
              name="image"
              value={formData.image}
              onChange={handleChange}
              placeholder="🍳"
              maxLength="2"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{hebrew.prepTimeLabel}</label>
              <input
                type="number"
                name="prepTime"
                value={formData.prepTime}
                onChange={handleChange}
                placeholder="10"
                min="0"
              />
            </div>
            <div className="form-group">
              <label>{hebrew.cookTimeLabel}</label>
              <input
                type="number"
                name="cookTime"
                value={formData.cookTime}
                onChange={handleChange}
                placeholder="20"
                min="0"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{hebrew.servingsLabel}</label>
              <input
                type="number"
                name="servings"
                value={formData.servings}
                onChange={handleChange}
                placeholder="4"
                min="1"
              />
            </div>
            <div className="form-group">
              <label>{hebrew.difficultyLabel}</label>
              <select
                name="difficulty"
                value={formData.difficulty}
                onChange={handleChange}
              >
                <option>קל</option>
                <option>בינוני</option>
                <option>קשה</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>{hebrew.ingredientsList}</label>
            <textarea
              name="ingredients"
              value={formData.ingredients}
              onChange={handleChange}
              placeholder="2 כוסות קמח&#10;1 ביצה&#10;1/2 כוס חמאה"
              rows="6"
            />
          </div>

          <div className="form-group">
            <label>{hebrew.stepsList}</label>
            <textarea
              name="steps"
              value={formData.steps}
              onChange={handleChange}
              placeholder="חמם את התנור&#10;ערבב את החומרים&#10;אפה ל-30 דקות"
              rows="6"
            />
          </div>

          <div className="form-group">
            <label>{hebrew.password}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="הכנס סיסמה"
            />
          </div>

          <div className="form-buttons">
            <button
              type="submit"
              className="submit-button"
            >
              {hebrew.submit}
            </button>
            <button
              type="button"
              className="cancel-button"
              onClick={() => {
                setShowForm(false);
                setError('');
                setMessage('');
              }}
            >
              {hebrew.cancel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
