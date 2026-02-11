import { useState, useEffect } from 'react';
import RecipeList from './components/RecipeList';
import RecipeDetail from './components/RecipeDetail';
import './App.css';
import { supabase, useSupabase } from './lib/supabaseClient';
import { getOrCreateProfile } from './lib/profile';

function AuthControls({ user, setUser }) {
  const login = async () => {
    if (!useSupabase || !supabase) {
      alert('Authentication is not configured for this deployment. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY and rebuild.');
      return;
    }

    const email = window.prompt('נא להכניס את האימייל שלך לקבלת לינק להתחברות');
    if (!email) return;

    try {
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

      const { error: signErr } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin + import.meta.env.BASE_URL,
        },
      });

      if (signErr) throw signErr;
      alert('נשלח לינק עריכה לאימייל — נא לבדוק גם בספאם');
    } catch (err) {
      console.error('Magic link error:', err);
      const msg = err?.message || err?.status || 'שגיאה בשליחת לינק';
      alert(msg);
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
          <button onClick={logout}>התנתקות</button>
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
