// Supabase Edge Function: reaction-upsert
// Receives POST { recipe_id: string, action: 'like'|'unlike' }
// Uses service_role key (set in Supabase environment) to upsert the reactions table.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE');

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE not set');
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  try {
    const body = await req.json();
    const { recipe_id, action } = body;
    if (!recipe_id || !['like', 'unlike'].includes(action)) {
      return new Response(JSON.stringify({ error: 'invalid payload' }), { status: 400 });
    }

    // Get current likes
    const getRes = await fetch(`${SUPABASE_URL}/rest/v1/reactions?recipe_id=eq.${encodeURIComponent(recipe_id)}`, {
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        Accept: 'application/json'
      }
    });
    const rows = await getRes.json();
    const currentLikes = (Array.isArray(rows) && rows[0] && rows[0].likes) ? rows[0].likes : 0;
    const nextLikes = action === 'like' ? currentLikes + 1 : Math.max(0, currentLikes - 1);

    // Upsert via POST with Prefer header to merge-duplicates
    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/reactions`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ recipe_id, likes: nextLikes })
    });

    if (!upsertRes.ok) {
      const errText = await upsertRes.text();
      return new Response(JSON.stringify({ error: errText }), { status: 500 });
    }

    return new Response(JSON.stringify({ recipe_id, likes: nextLikes }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'server error' }), { status: 500 });
  }
}
