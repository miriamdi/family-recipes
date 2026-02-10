import { useState, useEffect } from 'react';
import RecipeList from './components/RecipeList';
import RecipeDetail from './components/RecipeDetail';
import './App.css';
import { supabase, useSupabase } from './lib/supabaseClient';

function AuthControls({ user, setUser }) {
  const login = async () => {
    const email = window.prompt('הכנס את הדואר האלקטרוני שלך (magic link)');
    if (!email) return;
    try {
      await supabase.auth.signInWithOtp({ email });
      alert('נשלח לינק לאימייל — בדוק את התיבה שלך');
    } catch (err) {
      console.error(err);
      alert('שגיאה בשליחת לינק');
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {user ? (
        <>
          <span style={{ fontSize: 14 }}>{user.email}</span>
          <button onClick={logout}>התנתק</button>
        </>
      ) : (
        <button onClick={login}>התחבר (magic link)</button>
      )}
    </div>
  );
}

function App() {
  const [selectedRecipeId, setSelectedRecipeId] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Set document direction to RTL
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'he';
  }, []);

  useEffect(() => {
    if (!useSupabase || !supabase) return;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        setUser(data.session.user);
      }
      supabase.auth.onAuthStateChange((event, session) => {
        setUser(session?.user ?? null);
      });
    })();
  }, []);

  return (
    <div className="app">
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 12 }}>
        <AuthControls user={user} setUser={setUser} />
      </div>
      {selectedRecipeId === null ? (
        <RecipeList onSelectRecipe={setSelectedRecipeId} user={user} />
      ) : (
        <RecipeDetail
          recipeId={selectedRecipeId}
          onBack={() => setSelectedRecipeId(null)}
          user={user}
        />
      )}
    </div>
  );
}

export default App;
