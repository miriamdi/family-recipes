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
