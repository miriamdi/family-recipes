import React from 'react';
import { HashRouter, Routes, Route, useParams } from 'react-router-dom';
import App from './App';
import RecipeList from './components/RecipeList';
import RecipeDetail from './components/RecipeDetail';

function RecipeDetailWithParams(props) {
  const { id } = useParams();
  return <RecipeDetail recipeId={id} {...props} />;
}

export default function AppRouter(props) {
  return (
    <HashRouter>
      <App>
        <Routes>
          <Route path="/" element={<RecipeList {...props} />} />
          <Route path="/recipe/:id" element={<RecipeDetailWithParams {...props} />} />
        </Routes>
      </App>
    </HashRouter>
  );
}
