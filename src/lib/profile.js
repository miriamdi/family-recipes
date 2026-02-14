import { supabase } from './supabaseClient';

export async function getOrCreateProfile(user) {
  if (!user) return null;
  try {
    // try to read existing profile; if RLS prevents this, don't prompt the user
    const { data: prof, error } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.warn('Could not read profile (RLS or other):', error);
      return null;
    }

    if (prof?.display_name) return prof.display_name;

    // Prefer using any name available in user metadata before prompting
    const metaName = user.user_metadata?.full_name || user.user_metadata?.name || null;
    if (metaName) {
      try {
        await supabase.from('profiles').upsert(
          { user_id: user.id, display_name: metaName.trim() },
          { onConflict: 'user_id' }
        );
      } catch (upErr) {
        console.warn('Failed to upsert profile from user metadata:', upErr);
      }
      return metaName.trim();
    }

    const name = window.prompt('איך לקרוא לך באתר? (שם לתצוגה)');
    if (!name) return null;

    await supabase.from('profiles').upsert(
      { user_id: user.id, display_name: name.trim() },
      { onConflict: 'user_id' }
    );

    return name.trim();
  } catch (err) {
    console.error('getOrCreateProfile unexpected error:', err);
    return null;
  }
}
