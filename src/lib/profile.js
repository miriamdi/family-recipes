import { supabase } from './supabaseClient';

export async function getOrCreateProfile(user) {
  if (!user) return null;

  const { data: prof } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('user_id', user.id)
    .maybeSingle();

  if (prof?.display_name) return prof.display_name;

  const name = window.prompt('איך לקרוא לך באתר? (שם לתצוגה)');
  if (!name) return null;

  await supabase.from('profiles').upsert(
    { user_id: user.id, display_name: name.trim() },
    { onConflict: 'user_id' }
  );

  return name.trim();
}
