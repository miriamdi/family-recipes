import React, { useState, useEffect } from 'react';
import RecipeList from './components/RecipeList';
import RecipeDetail from './components/RecipeDetail';
import './App.css';
import { supabase, useSupabase } from './lib/supabaseClient';
import { getOrCreateProfile } from './lib/profile';

function AuthControls({ user, setUser }) {
  const login = async () => {
    if (!useSupabase || !supabase) {
      // Supabase not configured: don't throw or show a blocking alert during CI/build.
      // The App renders a persistent, dismissible banner explaining the fallback.
      console.warn('Authentication not configured for this deployment — using local fallback.');
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


function App({ children }) {
  const [user, setUser] = useState(null);
  const [displayName, setDisplayName] = useState(null);
  const [showSupabaseBanner, setShowSupabaseBanner] = useState(true);

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
      {/* non-blocking banner when Supabase isn't configured */}
      {(!useSupabase || !supabase) && showSupabaseBanner && (
        <div className="supabase-banner" role="status" aria-live="polite">
          <div>
            <strong>Supabase not configured:</strong>
            &nbsp;this deployment is using the local fallback (cloud features disabled).
            Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> and rebuild to enable them.
          </div>
          <button className="supabase-banner__dismiss" onClick={() => setShowSupabaseBanner(false)} aria-label="Dismiss">✕</button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 12 }}>
        <AuthControls user={user} setUser={setUser} />
      </div>

      {React.Children.map(children, child =>
        React.isValidElement(child)
          ? React.cloneElement(child, { user, displayName })
          : child
      )}
    </div>
  );
}

export default App;
