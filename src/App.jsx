import { useState, useEffect } from 'react';
import RecipeList from './components/RecipeList';
import RecipeDetail from './components/RecipeDetail';
import './App.css';
import { supabase, useSupabase } from './lib/supabaseClient';
import { getOrCreateProfile } from './lib/profile';

function AuthControls({ user, setUser }) {
  const login = async () => {
    const email = window.prompt('נא להכניס את האימייל שלך לקבלת לינק להתחברות');
    if (!email) return;

    try {
      if (useSupabase && supabase) {
        const { data, error } = await supabase
          .from('approved_emails')
          .select('email')
          .eq('email', email)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          alert('האימייל שלך לא מעודכן במערכת');
          return;
        }
      }

      await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin + import.meta.env.BASE_URL,
        },
      });

      alert('נשלח לינק עריכה לאימייל — נא לבדוק גם בספאם');
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
        <button onClick={login}>התחברות באמצעות אימייל</button>
      )}
    </div>
  );
}

function App() {
  const [selectedRecipeId, setSelectedRecipeId] = useState(null);
  const [user, setUser] = useState(null);
  const [displayName, setDisplayName] = useState(null);

  useEffect(() => {
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'he';
  }, []);

  useEffect(() => {
    if (!useSupabase || !supabase) return;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) setUser(data.session.user);

      supabase.auth.onAuthStateChange((event, session) => {
        setUser(session?.user ?? null);
      });
    })();
  }, []);

  useEffect(() => {
    if (!user) {
      setDisplayName(null);
      return;
    }

    (async () => {
      const name = await getOrCreateProfile(user);
      setDisplayName(name);
    })();
  }, [user]);

  return (
    <div className="app">
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 12 }}>
        <AuthControls user={user} setUser={setUser} />
      </div>

      {selectedRecipeId === null ? (
        <RecipeList
          onSelectRecipe={setSelectedRecipeId}
          user={user}
          displayName={displayName}
        />
      ) : (
        <RecipeDetail
          recipeId={selectedRecipeId}
          onBack={() => setSelectedRecipeId(null)}
          user={user}
          displayName={displayName}
        />
      )}
    </div>
  );
}

export default App;
