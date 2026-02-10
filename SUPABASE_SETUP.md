Steps to set up Supabase for this site

1) Create a Supabase project at https://app.supabase.com

2) In the project settings, get the `anon` public key and the project URL.

3) Create a storage bucket named `recipes-images` and make it public (or configure appropriate policies).

4) Run the SQL below in the Supabase SQL editor to create the `recipes` and `reactions` tables:

-- create table for recipes (simple example)
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  title text,
  description text,
  image text,
  images jsonb,
  category text,
  prepTime int,
  cookTime int,
  servings int,
  difficulty text,
  source text,
  recipeFile text,
  authorFile text,
  ingredients jsonb,
  steps jsonb,
  created_at timestamptz default now()
);

-- reactions table: one row per recipe_id with like counts
create table if not exists public.reactions (
  recipe_id uuid primary key,
  likes int default 0
);

5) Add the values to your local `.env.local` file (copy `.env.local.example`):

VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

6) Install the Supabase client dependency and rebuild:

```bash
npm install
npm run build
```

7) Deploy the site as before. The frontend will use Supabase when env vars are present; otherwise it will continue to use the localStorage fallback.

Edge Function (optional, recommended)
-----------------------------------
For more secure reaction updates (so you don't use the `service_role` key from the client), deploy the provided Edge Function `supabase/functions/reaction-upsert`.

1. Install Supabase CLI: https://supabase.com/docs/guides/cli
2. From the repo root run:

```bash
supabase login
supabase link --project-ref your-project-ref
supabase functions deploy reaction-upsert --no-verify-jwt
```

3. In the Supabase UI, set the function environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE) if needed.
4. Set `VITE_REACTIONS_API_URL` in your `.env.local` to the function URL (found in Supabase dashboard) so the frontend calls the secure endpoint.

When `VITE_REACTIONS_API_URL` is set, the frontend will post { recipe_id, action } to the function which will upsert the `reactions` table using the service role key.

