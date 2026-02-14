-- Proposals table
create table if not exists proposals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  title text not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc', now())
);

-- Important marks table
create table if not exists important_marks (
  id uuid primary key default uuid_generate_v4(),
  proposal_id uuid references proposals(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc', now()),
  unique (proposal_id, user_id)
);

-- Comments table
create table if not exists proposal_comments (
  id uuid primary key default uuid_generate_v4(),
  proposal_id uuid references proposals(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  comment text not null,
  created_at timestamp with time zone default timezone('utc', now())
);