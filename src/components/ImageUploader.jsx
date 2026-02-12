import React, { useState } from 'react';
import { supabase, useSupabase } from '../lib/supabaseClient';
import { processImageForUpload } from '../lib/imageUtils';

export default function ImageUploader({ recipeId, currentImageCount, maxImages, onImageAdded, user, displayName, disabled }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const ADMIN_EMAIL = 'miriam995@gmail.com';

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');

    // Permission check
    if (!user) {
      setError('אנא התחברו כדי להוסיף תמונה');
      e.target.value = '';
      return;
    }

    // Max images check
    if (currentImageCount >= maxImages) {
      setError(`הגעת למקסימום של ${maxImages} תמונות לעל מתכון זה`);
      e.target.value = '';
      return;
    }

    // Validate and compress image
    const { blob: compressedBlob, error: processError } = await processImageForUpload(file);
    if (processError) {
      setError(processError);
      e.target.value = '';
      return;
    }

    if (!useSupabase || !supabase) {
      setError('עלאת תמונה לא זמינה בגרסה זו');
      e.target.value = '';
      return;
    }

    setUploading(true);

    try {
      // Upload to Supabase storage
      const ext = file.type.split('/')[1] || 'jpeg';
      const filename = `recipes/${recipeId}-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('recipes-images')
        .upload(filename, compressedBlob, { upsert: true });

      if (upErr) {
        if (upErr.message.includes('not found')) {
          setError('התמונה לא הועלתה - bucket לא קיים. אנא פנה אל admin');
        } else if (upErr.message.includes('permission')) {
          setError('אין לך הרשאה להעלות תמונה');
        } else {
          setError(`משגיאה בהעלאה: ${upErr.message}`);
        }
        setUploading(false);
        e.target.value = '';
        return;
      }

      // Get public URL
      const { data: urlData } = await supabase.storage
        .from('recipes-images')
        .getPublicUrl(filename);

      const publicUrl = urlData?.publicUrl;
      if (!publicUrl) {
        setError('שגיאה בקבלת URL של התמונה');
        setUploading(false);
        e.target.value = '';
        return;
      }

      // Insert metadata into recipe_images table
      const userId = user?.id;

      if (!userId) {
        setError('שגיאה בזיהוי משתמש');
        setUploading(false);
        e.target.value = '';
        return;
      }

      const { error: insertErr } = await supabase.from('recipe_images').insert({
        recipe_id: recipeId,
        image_url: publicUrl,
        uploaded_by_user_id: userId,
        uploaded_by_user_name: displayName || user.email
      });

      if (insertErr) {
        console.error('Insert error:', insertErr);
        if (insertErr.message.includes('permission')) {
          setError('אין לך הרשאה להוסיף תמונה. ודא שהאימייל שלך בטבלת ה-approved_emails');
        } else {
          setError(`שגיאה בשמירה: ${insertErr.message}`);
        }
        setUploading(false);
        e.target.value = '';
        return;
      }

      // Success - notify parent
      if (onImageAdded) {
        onImageAdded({
          image_url: publicUrl,
          uploaded_by_user_name: displayName || user.email,
          uploaded_by_user_id: userId
        });
      }

      setError('');
      e.target.value = '';
    } catch (err) {
      console.error('Unexpected error:', err);
      setError(`שגיאה בתהליך: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: disabled || uploading ? 'not-allowed' : 'pointer', opacity: disabled || uploading ? 0.5 : 1 }}>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          disabled={disabled || uploading}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          onClick={(e) => e.currentTarget.previousElementSibling?.click()}
          disabled={disabled || uploading}
          style={{
            padding: '8px 12px',
            background: disabled || uploading ? '#ccc' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: disabled || uploading ? 'not-allowed' : 'pointer',
            fontSize: 14
          }}
        >
          {uploading ? 'מעלה...' : '📸 הוסף תמונה'}
        </button>
        {currentImageCount > 0 && (
          <span style={{ fontSize: 13, opacity: 0.7 }}>
            ({currentImageCount}/{maxImages})
          </span>
        )}
      </label>
      {error && (
        <div style={{
          padding: 8,
          background: '#fee',
          color: '#c00',
          borderRadius: 4,
          fontSize: 13
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
