import React, { useState } from 'react';
import { supabase, useSupabase } from '../lib/supabaseClient';

export default function ImageGallery({ images, recipeId, user, onImageDeleted }) {
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState('');
  const ADMIN_EMAIL = 'miriam995@gmail.com';

  if (!Array.isArray(images) || images.length === 0) {
    return null;
  }

  const handleDeleteImage = async (imageId, imageUrl, uploadedBy) => {
    // Permission check: user can delete own images or admin can delete any
    const isOwner = user && user.id === uploadedBy;
    const isAdmin = user && user.email === ADMIN_EMAIL;

    if (!isOwner && !isAdmin) {
      setError('אינך מורשה למחוק תמונה זו');
      return;
    }

    if (!window.confirm('האם אתה בטוח שברצונך למחוק תמונה זו?')) return;

    if (!useSupabase || !supabase) {
      setError('מחיקה לא זמינה בגרסה זו');
      return;
    }

    setDeleting(imageId);
    setError('');

    try {
      // Delete from database
      const { error: deleteErr } = await supabase
        .from('recipe_images')
        .delete()
        .eq('id', imageId);

      if (deleteErr) {
        if (deleteErr.message.includes('permission')) {
          setError('אין לך הרשאה למחוק תמונה זו');
        } else {
          setError(`שגיאה במחיקה: ${deleteErr.message}`);
        }
        setDeleting(null);
        return;
      }

      // Delete from storage (best effort - don't block on failure)
      try {
        const fileKey = imageUrl.split('/').pop();
        await supabase.storage
          .from('recipes-images')
          .remove([`recipes/${fileKey}`]);
      } catch (storageErr) {
        console.warn('Failed to delete from storage, but DB entry deleted:', storageErr);
      }

      if (onImageDeleted) {
        onImageDeleted(imageId);
      }

      setDeleting(null);
    } catch (err) {
      console.error('Unexpected error:', err);
      setError(`שגיאה בתהליך: ${err.message}`);
      setDeleting(null);
    }
  };

  return (
    <div style={{ marginTop: 32 }}>
      {error && (
        <div style={{
          padding: 12,
          background: '#fee',
          color: '#c00',
          borderRadius: 4,
          marginBottom: 16,
          fontSize: 13
        }}>
          {error}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: 12
      }}>
        {images.map((img) => (
          <div key={img.id} style={{ position: 'relative' }}>
            <img
              src={img.image_url}
              alt={img.uploaded_by_user_name || 'Recipe image'}
              style={{
                width: '100%',
                height: 150,
                objectFit: 'cover',
                borderRadius: 8,
                cursor: 'pointer'
              }}
              onClick={() => window.open(img.image_url, '_blank')}
              title="לחץ כדי צפיה במלאה"
            />

            {/* Uploader name label */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'rgba(0, 0, 0, 0.6)',
              color: 'white',
              padding: '4px 6px',
              fontSize: 11,
              borderRadius: '0 0 8px 8px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
                {`תמונה של ${img.uploaded_by_user_name} ${formatIsraeliDate(img.created_at)}`}
            </div>

            {/* Delete button (only if owner or admin) */}
            {user && (user.id === img.uploaded_by_user_id || user.email === ADMIN_EMAIL) && (
              <button
                onClick={() => handleDeleteImage(img.id, img.image_url, img.uploaded_by_user_id)}
                disabled={deleting === img.id}
                style={{
                  position: 'absolute',
                  top: 4,
                  left: 4,
                  background: deleting === img.id ? '#aaa' : '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: 24,
                  height: 24,
                  cursor: deleting === img.id ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0
                }}
                title={deleting === img.id ? 'מוחק...' : 'מחק תמונה'}
              >
                {deleting === img.id ? '⟳' : '×'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

  // Helper to format date in Israeli format DD/MM/YYYY
  function formatIsraeliDate(dateString) {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }
