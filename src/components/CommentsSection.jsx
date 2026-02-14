import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const CommentsSection = ({ proposalId, user }) => {
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) return;
    setLoading(true);
    const fetchComments = async () => {
      const { data, error } = await supabase
        .from('comments')
        .select('id, content, user_id, created_at')
        .eq('proposal_id', proposalId)
        .order('created_at', { ascending: true });
      if (error) {
        setComments([]);
        setLoading(false);
        return;
      }
      setComments(data);
      setLoading(false);
    };
    fetchComments();
  }, [proposalId]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    if (!comment.trim()) {
      setError("Comment cannot be empty.");
      setSubmitting(false);
      return;
    }
    if (!user) {
      setError("You must be logged in to comment.");
      setSubmitting(false);
      return;
    }
    const { error } = await supabase.from('comments').insert({
      proposal_id: proposalId,
      user_id: user.id,
      content: comment.trim()
    });
    if (error) setError(error.message);
    setSubmitting(false);
    setComment("");
    // Refetch comments
    const { data } = await supabase
      .from('comments')
      .select('id, content, user_id, created_at')
      .eq('proposal_id', proposalId)
      .order('created_at', { ascending: true });
    setComments(data || []);
  };

  return (
    <div className="comments-section">
      <div className="comments-list">
        {loading ? (
          <div>טוען תגובות...</div>
        ) : comments.length === 0 ? (
          <div>אין תגובות עדיין.</div>
        ) : (
          comments.map((c) => (
            <div className="comment" key={c.id}>
              <span className="comment-user">{c.user_id?.slice(0, 6) || "User"}:</span>
              <span className="comment-text">{c.content}</span>
            </div>
          ))
        )}
      </div>
      {user && (
        <form className="add-comment-form" onSubmit={handleAddComment}>
          <input
            type="text"
            placeholder="להוספת תגובה..."
            value={comment}
            onChange={e => setComment(e.target.value)}
            maxLength={200}
            disabled={submitting}
            required
          />
          <button type="submit" disabled={submitting}>שליחה</button>
          {error && <div className="form-error">{error}</div>}
        </form>
      )}
    </div>
  );
};

export default CommentsSection;
