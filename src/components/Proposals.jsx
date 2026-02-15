import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import './Proposals.css';
import CommentsSection from './CommentsSection';

const Proposals = (props) => {
  // State for proposals, form, sorting, etc.
  const [proposals, setProposals] = useState([]);
  const [sortBy, setSortBy] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  // Use user from props if available (from App)
  const user = props.user;
  const userLoading = props.userLoading;

  // Fetch proposals from Supabase
  useEffect(() => {
    if (!supabase) return;
    setLoading(true);
    const fetchProposals = async () => {
      // fetch proposals without relying on a DB relationship for profiles
      // (some projects don't define the FK/relationship which makes a select('profiles(...)') fail)
      const query = supabase
        .from('proposals')
        .select('id, title, content, created_at, user_id, important_marks:important_marks(id, user_id), comments(id)')
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) {
        console.error('Failed to load proposals:', error);
        setProposals([]);
        setLoading(false);
        return;
      }

      // Collect proposer user_ids to fetch their display names in a separate query
      const userIds = Array.from(new Set((data || []).map(d => d.user_id).filter(Boolean)));
      let profilesMap = {};
      if (userIds.length > 0) {
        try {
          const { data: profs, error: profErr } = await supabase
            .from('profiles')
            .select('user_id, display_name')
            .in('user_id', userIds);
          if (!profErr && Array.isArray(profs)) {
            profilesMap = profs.reduce((acc, p) => ({ ...acc, [p.user_id]: p.display_name }), {});
          } else if (profErr) {
            console.warn('Failed to fetch profiles:', profErr);
          }
        } catch (profFetchErr) {
          console.warn('Profiles fetch error:', profFetchErr);
        }
      }

      // Map important marks and comments count and attach proposerName from profilesMap
      const mapped = data.map(p => ({
        ...p,
        important_count: p.important_marks ? p.important_marks.length : 0,
        markedImportant: user && p.important_marks?.some(m => m.user_id === user?.id),
        comments_count: p.comments ? p.comments.length : 0,
        proposerName: profilesMap[p.user_id] || null,
      }));

      setProposals(mapped);
      setLoading(false);
    };
    fetchProposals();
    }, [sortBy, user, refresh]);

    const formatDate = (iso) => {
      if (!iso) return 'תאריך לא ידוע';
      try {
        const d = new Date(iso);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
      } catch (err) {
        return 'תאריך לא ידוע';
      }
    };


  // Proposal form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [markingId, setMarkingId] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('handleSubmit started');
    setSubmitting(true);
    setError("");
    if (!title.trim() || !content.trim()) {
      setError("Title and content are required.");
      setSubmitting(false);
      return;
    }
    if (userLoading) {
      setError("טוען נתוני התחברות...");
      setSubmitting(false);
      return;
    }
    if (!user) {
      setError("יש להתחבר כדי להגיש הצעה.");
      setSubmitting(false);
      return;
    }
    try {
      const { data: session } = await supabase.auth.getSession();
      console.log('Session:', session);

      // Insert and return the created row to confirm success
      const { data: insertData, error: insertErr } = await supabase
        .from('proposals')
        .insert({ title: title.trim(), content: content.trim(), user_id: user.id })
        .select()
        .single();

      console.log('Insert result - data:', insertData, 'error:', insertErr);
      if (insertErr) {
        // Provide a helpful error message if RLS blocks the insert
        const hint = insertErr.message && insertErr.message.toLowerCase().includes('row-level security')
          ? 'הרשאת RLS חוסמת את ההוספה. וודא כי קיימת מדיניות INSERT המתאימה בטבלת proposals (auth.uid() = user_id).' : null;
        setError((insertErr.message || 'שגיאה בשמירה') + (hint ? (' — ' + hint) : ''));
        console.error('Proposal insert error details:', insertErr);
        setSubmitting(false);
        return;
      }

      // Success: clear form and refetch
      setTitle('');
      setContent('');
      setSortBy('newest'); // triggers refetch
    } catch (err) {
      console.error('Unexpected error inserting proposal:', err);
      setError(err?.message || 'שגיאה בלתי צפויה בעת שמירה');
    } finally {
      setSubmitting(false);
    }
  };

  // Handler for marking as important
  const handleMarkImportant = async (proposalId) => {
    if (!user) return;
    if (markingId) return; // prevent concurrent

    // Optimistic UI update: mark as important locally immediately
    setProposals(prev => prev.map(p => p.id === proposalId ? {
      ...p,
      markedImportant: true,
      important_count: (p.important_count || 0) + 1
    } : p));

    setMarkingId(proposalId);
    try {
      const { data, error } = await supabase.from('important_marks').insert({
        proposal_id: proposalId,
        user_id: user.id
      }).select();

      if (error) {
        console.warn('important_marks insert error:', error);
        setError(error.message || JSON.stringify(error));
        // revert optimistic change
        setProposals(prev => prev.map(p => p.id === proposalId ? ({
          ...p,
          markedImportant: false,
          important_count: Math.max(0, (p.important_count || 1) - 1)
        }) : p));
      } else {
        // Successful insert: refetch proposals to reflect DB-driven counts
        setRefresh(r => r + 1);
      }
    } catch (err) {
      console.error('Failed to mark important:', err);
      setError(err?.message || 'שגיאה בשמירה');
      // revert optimistic change
      setProposals(prev => prev.map(p => p.id === proposalId ? ({
        ...p,
        markedImportant: false,
        important_count: Math.max(0, (p.important_count || 1) - 1)
      }) : p));
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <div className="proposals-container" dir="rtl" lang="he">
      <h1>הצעות לשיפור הבלוג</h1>
      <div style={{ marginBottom: 12 }}>
        <Link to="/" className="back-button">חזרה לכל המתכונים</Link>
      </div>
      {userLoading ? (
        <div style={{ textAlign: 'center', margin: '2em 0', fontSize: '1.2em' }}>טוען נתוני התחברות...</div>
      ) : (
        <form className="proposal-form" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="כותרת להצעה"
            value={title}
            onChange={e => setTitle(e.target.value)}
            disabled={submitting || userLoading}
            maxLength={100}
            required
          />
          <textarea
            placeholder="תוכן ההצעה"
            value={content}
            onChange={e => setContent(e.target.value)}
            disabled={submitting || userLoading}
            maxLength={1000}
            required
          />
          {error && <div className="form-error">{error}</div>}
          <button type="submit" disabled={submitting || userLoading}>העלאת הצעה</button>
        </form>
      )}
      <div className="proposals-sorting">
        <label>סדר לפי: </label>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="newest">החדשות ביותר</option>
          <option value="important">הכי חשובות</option>
        </select>
      </div>
      <div className="proposals-list">
        {loading ? (
          <div>טוען הצעות...</div>
        ) : proposals.length === 0 ? (
          <div>אין הצעות עדיין.</div>
        ) : (
          proposals.map((proposal) => (
            <div className="proposal-card" key={proposal.id}>
              <h2>{proposal.title}</h2>
              <div style={{ fontSize: 12, color: '#666', marginTop: 6, marginBottom: 8 }}>
               מאת {proposal.proposerName || proposal.user_id} | {formatDate(proposal.created_at)}
              </div>
              <p className="proposal-content">{proposal.content}</p>
              <div className="proposal-meta">
                <span className="important-count">חשוב: {proposal.important_count || 0}</span>
                <button
                  className="important-btn"
                  disabled={proposal.markedImportant || !user || markingId === proposal.id}
                  onClick={() => handleMarkImportant(proposal.id)}
                >
                  {markingId === proposal.id ? 'שולח…' : (proposal.markedImportant ? 'סימנת כחשוב' : 'גם לדעתי זה כדאי')}
                </button>
                {/* Show delete button only for the owner of the proposal */}
                {user && proposal.user_id === user.id && (
                  <button
                    className="delete-proposal-btn"
                    disabled={deletingId === proposal.id}
                    onClick={async () => {
                      const ok = window.confirm('למחוק את ההצעה הזו? פעולה זו אינה ניתנת לביטול.');
                      if (!ok) return;
                      try {
                        setDeletingId(proposal.id);
                        if (supabase) {
                          const { error: delErr } = await supabase.from('proposals').delete().eq('id', proposal.id);
                          if (delErr) throw delErr;
                        } else {
                          // Local fallback: remove from local state only
                        }
                        setProposals(prev => prev.filter(p => p.id !== proposal.id));
                      } catch (err) {
                        console.error('Failed to delete proposal', err);
                        setError(err?.message || 'שגיאה במחיקה');
                      } finally {
                        setDeletingId(null);
                      }
                    }}
                  >
                    {deletingId === proposal.id ? 'מוחק…' : 'למחוק הצעה'}
                  </button>
                )}
              </div>
              <div className="proposal-comments">
                <CommentsSection proposalId={proposal.id} user={user} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Proposals;
