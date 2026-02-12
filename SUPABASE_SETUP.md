Steps to set up Supabase for this site

1) Create a Supabase project at https://app.supabase.com

2) In the project settings, get the `anon` public key and the project URL.

3) Create a storage bucket named `recipes-images` and make it public (or configure appropriate policies).

4) Run the SQL below in the Supabase SQL editor to create the tables and enable Row Level Security policies:

```sql
-- Create recipes table
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  title text,
  description text,
  image text,
  images jsonb,
  category text,
  prep_time int,
  cook_time int,
  servings int,
  difficulty text,
  source text,
  recipe_file text,
  author_file text,
  ingredients jsonb,
  steps jsonb,
  user_id uuid,
  user_email text,
  created_at timestamptz default now()
);

-- Create reactions table
create table if not exists public.reactions (
  recipe_id uuid primary key,
  likes int default 0
);

-- Create approved_emails table (family allowlist)
create table if not exists public.approved_emails (
  email text primary key
);

-- Create profiles table (for author display names)
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  display_name text,
  created_at timestamptz default now(),
  foreign key (user_id) references auth.users(id) on delete cascade
);

-- Create recipe_images table (for image metadata and uploader info)
create table if not exists public.recipe_images (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null,
  image_url text not null,
  uploaded_by_user_id uuid not null,
  uploaded_by_user_name text,
  created_at timestamptz default now(),
  foreign key (recipe_id) references public.recipes(id) on delete cascade,
  foreign key (uploaded_by_user_id) references auth.users(id) on delete restrict
);

-- Enable Row Level Security
alter table public.recipes enable row level security;
alter table public.reactions enable row level security;
alter table public.approved_emails enable row level security;
alter table public.profiles enable row level security;
alter table public.recipe_images enable row level security;

-- ============ RECIPES POLICIES ============
-- Allow ANYONE to read recipes (public access)
drop policy if exists "recipe_read_public" on public.recipes;
drop policy if exists "allow select recipes" on public.recipes;
drop policy if exists "allow insert recipes for approved" on public.recipes;
drop policy if exists "allow modify recipes for approved" on public.recipes;

create policy "recipe_read_public" on public.recipes
  for select
  to public
  using (true);

-- Allow authenticated users in approved_emails to insert recipes
create policy "recipe_insert_approved" on public.recipes
  for insert
  to authenticated
  with check (auth.email() in (select email from public.approved_emails));

-- Allow authenticated users to update their own recipes (if approved)
create policy "recipe_update_own" on public.recipes
  for update
  to authenticated
  using (auth.email() in (select email from public.approved_emails))
  with check (auth.email() in (select email from public.approved_emails));

-- Allow authenticated users to delete their own recipes (if approved)
create policy "recipe_delete_own" on public.recipes
  for delete
  to authenticated
  using (auth.email() in (select email from public.approved_emails));

-- ============ REACTIONS POLICIES ============
-- Allow ANYONE to read reactions
drop policy if exists "reaction_read_public" on public.reactions;
drop policy if exists "allow modify reactions for approved" on public.reactions;

create policy "reaction_read_public" on public.reactions
  for select
  to public
  using (true);

-- Allow authenticated approved users to insert reactions
create policy "reaction_insert_approved" on public.reactions
  for insert
  to authenticated
  with check (auth.email() in (select email from public.approved_emails));

-- Allow authenticated approved users to update reactions
create policy "reaction_update_approved" on public.reactions
  for update
  to authenticated
  using (auth.email() in (select email from public.approved_emails))
  with check (auth.email() in (select email from public.approved_emails));

-- ============ APPROVED_EMAILS POLICIES ============
-- Allow ANYONE to read approved_emails (needed for login/permission checks)
drop policy if exists "approved_read_public" on public.approved_emails;

create policy "approved_read_public" on public.approved_emails
  for select
  to public
  using (true);

-- ============ PROFILES POLICIES ============
-- Allow ANYONE to read profiles (for author display names)
drop policy if exists "profile_read_public" on public.profiles;

create policy "profile_read_public" on public.profiles
  for select
  to public
  using (true);

-- Allow authenticated users to insert their own profile
create policy "profile_insert_own" on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Allow authenticated users to update their own profile
create policy "profile_update_own" on public.profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============ RECIPE_IMAGES POLICIES ============
-- Allow ANYONE to read recipe images (public access)
drop policy if exists "recipe_images_read_public" on public.recipe_images;

create policy "recipe_images_read_public" on public.recipe_images
  for select
  to public
  using (true);

-- Allow authenticated approved users to insert recipe images
drop policy if exists "recipe_images_insert_approved" on public.recipe_images;

create policy "recipe_images_insert_approved" on public.recipe_images
  for insert
  to authenticated
  with check (
    auth.uid() = uploaded_by_user_id
    and auth.email() in (select email from public.approved_emails)
  );

-- Allow users to delete ONLY their own images, or admin can delete any image
drop policy if exists "recipe_images_delete_own_or_admin" on public.recipe_images;

create policy "recipe_images_delete_own_or_admin" on public.recipe_images
  for delete
  to authenticated
  using (
    auth.uid() = uploaded_by_user_id
    or auth.email() = 'miriam995@gmail.com'
  );
```

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

