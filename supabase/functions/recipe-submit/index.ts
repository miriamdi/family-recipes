// Supabase Edge Function: recipe-submit
// Receives POST with recipe data, validates, and inserts into recipes table.
// Uses service_role key to bypass RLS for insert.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE not set');
}

export default async function handler(req: Request) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
  try {
    const body = await req.json();
    const { title, category, prep_time, cook_time, prep_time_text, cook_time_text, servings, servings_text, difficulty, source, ingredients, steps, user_id, user_email } = body;

    // Validation
    if (!title || !category || prep_time == null || cook_time == null || servings == null || !difficulty || !source || !Array.isArray(ingredients) || !Array.isArray(steps)) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }
    if (typeof prep_time !== 'number' || prep_time < 0 || typeof cook_time !== 'number' || cook_time < 0 || typeof servings !== 'number' || servings < 1) {
      return new Response(JSON.stringify({ error: 'Invalid numeric fields' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }
    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      return new Response(JSON.stringify({ error: 'Invalid difficulty' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }
    if (ingredients.length === 0) {
      return new Response(JSON.stringify({ error: 'Ingredients cannot be empty' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }
    for (const ing of ingredients) {
      if (ing.type === 'ingredient') {
        if (!ing.product_name || typeof ing.amount !== 'number' || ing.amount < 0) {
          return new Response(JSON.stringify({ error: 'Invalid ingredient' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
        }
      } else if (ing.type === 'subtitle') {
        if (!ing.text) {
          return new Response(JSON.stringify({ error: 'Invalid subtitle' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
        }
      } else {
        return new Response(JSON.stringify({ error: 'Invalid ingredient type' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
      }
    }
    if (steps.length === 0) {
      return new Response(JSON.stringify({ error: 'Instructions cannot be empty' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    // Insert
    const insertData: Record<string, any> = {
      title,
      category,
      prep_time,
      cook_time,
      servings,
      difficulty,
      source,
      ingredients,
      steps,
      user_id,
      user_email
    };
    // Include optional textual fields when present
    if (typeof prep_time_text === 'string') insertData.prep_time_text = prep_time_text;
    if (typeof cook_time_text === 'string') insertData.cook_time_text = cook_time_text;
    if (typeof servings_text === 'string') insertData.servings_text = servings_text;

    // Try insert; if DB schema doesn't include the optional text columns, retry without them.
    const doInsert = async (payload: Record<string, any>) => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/recipes`, {
        method: 'POST',
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify(payload)
      });
      return r;
    };

    let res = await doInsert(insertData);
    if (!res.ok) {
      const errText = await res.text();
      const lower = errText.toLowerCase();
      const missingCols = ['cook_time_text', 'prep_time_text', 'servings_text'].filter(col => lower.includes(col));
      if (missingCols.length) {
        // remove missing optional fields and retry
        missingCols.forEach(c => delete insertData[c]);
        res = await doInsert(insertData);
        if (!res.ok) {
          const err2 = await res.text();
          return new Response(JSON.stringify({ error: err2 }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
        }
      } else {
        return new Response(JSON.stringify({ error: errText }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
      }
    }

    const data = await res.json();
    return new Response(JSON.stringify(data[0]), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'server error' }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}