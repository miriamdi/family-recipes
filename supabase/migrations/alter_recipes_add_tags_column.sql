-- Adds a `tags` text[] column to `recipes` if it doesn't exist.
-- Safe and idempotent: will do nothing if the table or column already exist.
ALTER TABLE IF EXISTS recipes
  ADD COLUMN IF NOT EXISTS tags text[];