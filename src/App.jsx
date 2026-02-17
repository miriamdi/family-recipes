import React, { useState, useEffect } from 'react';
import RecipeList from './components/RecipeList';
import RecipeDetail from './components/RecipeDetail';
import './App.css';
import { supabase, useSupabase } from './lib/supabaseClient';
import { getOrCreateProfile } from './lib/profile';

function AuthControls({ user, setUser, displayName, setDisplayName, userLoading }) {
  const login = async () => {
    if (!useSupabase || !supabase) {
      // Supabase not configured: don't throw or show a blocking alert during CI/build.
      // The App renders a persistent, dismissible banner explaining the fallback.
      console.warn('Authentication not configured for this deployment — using local fallback.');
      return;
    }

    let email = window.prompt('נא להכניס את האימייל שלך לקבלת לינק להתחברות');
    if (!email) return;
    email = email.trim().toLowerCase();

    try {
      const { data, error } = await supabase
        .from('approved_emails')
        .select('email')
        .ilike('email', email)
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

  const updateDisplayName = async () => {
    if (!user) return;
    const name = window.prompt('עדכן את שם התצוגה שלך', displayName || '');
    if (!name) return;
    try {
      const { error } = await supabase.from('profiles').upsert(
        { user_id: user.id, display_name: name.trim() },
        { onConflict: 'user_id' }
      );
      if (error) throw error;
      setDisplayName(name.trim());
    } catch (err) {
      console.error('Failed to update display name', err);
      alert('שגיאה בעדכון השם');
    }
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {user ? (
        <>
          <span style={{ fontSize: 14, marginRight: 8 }}>{displayName || ''}</span>
          <button onClick={updateDisplayName} style={{ marginRight: 8 }}>
            {displayName ? 'לשנות שם' : 'להגדיר שם'}
          </button>
          <span style={{ fontSize: 14, marginRight: 8 }}>{user.email}</span>
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
  const [userLoading, setUserLoading] = useState(true);

  useEffect(() => {
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'he';
  }, []);

  useEffect(() => {
    if (!useSupabase || !supabase) {
      setUserLoading(false);
      return;
    }
    let subscription = null;
    (async () => {
      setUserLoading(true);
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) setUser(data.session.user);
      setUserLoading(false);
    })();

    // subscribe to auth changes and ensure we unsubscribe on cleanup
    const listener = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });
    // listener shape may be { data: { subscription } } or contain subscription directly
    subscription = listener?.data?.subscription ?? listener?.subscription ?? null;

    return () => {
      try {
        subscription?.unsubscribe?.();
      } catch (err) {
        // ignore cleanup errors
      }
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setDisplayName(null);
      return;
    }
    // Only try to fetch/create a profile if we don't already have a displayName
    if (!displayName) {
      (async () => {
        const name = await getOrCreateProfile(user);
        if (name) setDisplayName(name);
      })();
    }
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
        <AuthControls user={user} setUser={setUser} displayName={displayName} setDisplayName={setDisplayName} userLoading={userLoading} />
      </div>

      {React.Children.map(children, child => {
        // If this child is a Routes element, clone its Route children so their
        // `element` props receive the auth props (user, displayName, userLoading).
        if (React.isValidElement(child) && child.props && child.props.children) {
          const newChildren = React.Children.map(child.props.children, routeChild => {
            if (
              React.isValidElement(routeChild) &&
              routeChild.props &&
              routeChild.props.element &&
              React.isValidElement(routeChild.props.element)
            ) {
              const newElement = React.cloneElement(routeChild.props.element, { user, displayName, userLoading });
              return React.cloneElement(routeChild, { ...routeChild.props, element: newElement });
            }
            return routeChild;
          });
          return React.cloneElement(child, { ...child.props, children: newChildren });
        }

        return React.isValidElement(child)
          ? React.cloneElement(child, { user, displayName, userLoading })
          : child;
      })}
    </div>
  );
}

export default App;
