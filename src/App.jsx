import { useState } from 'react';
import RecipeList from './components/RecipeList';
import RecipeDetail from './components/RecipeDetail';
import './App.css';

function App() {
  const [selectedRecipeId, setSelectedRecipeId] = useState(null);

  return (
    <div className="app">
      {selectedRecipeId === null ? (
        <RecipeList onSelectRecipe={setSelectedRecipeId} />
      ) : (
        <RecipeDetail
          recipeId={selectedRecipeId}
          onBack={() => setSelectedRecipeId(null)}
        />
      )}
    </div>
  );
}

export default App;
