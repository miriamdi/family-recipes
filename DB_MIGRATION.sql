-- Migration to update `recipes` table for the new schema used by the app
-- Run this in Supabase SQL Editor (or include in your DB migration pipeline)

BEGIN;

-- 1) Add / ensure columns (idempotent)
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS prep_time integer DEFAULT 0;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS cook_time integer DEFAULT 0;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS servings integer DEFAULT 1;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS prep_time_text TEXT;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS cook_time_text TEXT;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS servings_text TEXT;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'easy';
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS ingredients JSONB DEFAULT '[]'::jsonb;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS steps JSONB DEFAULT '[]'::jsonb;

-- 2) Normalize / migrate existing values where safe
-- Map Hebrew difficulty labels to English canonical values
UPDATE recipes SET difficulty = 'easy' WHERE difficulty = 'קל';
UPDATE recipes SET difficulty = 'medium' WHERE difficulty = 'בינוני';
UPDATE recipes SET difficulty = 'hard' WHERE difficulty = 'קשה';

-- Ensure numeric defaults for NULLs (safe no-op if already set)
UPDATE recipes SET prep_time = 0 WHERE prep_time IS NULL;
UPDATE recipes SET cook_time = 0 WHERE cook_time IS NULL;
UPDATE recipes SET servings = 1 WHERE servings IS NULL;

-- 3) Coerce `ingredients` and `steps` into JSONB arrays if they already exist in some format
-- (This is conservative and assumes any existing `ingredients` / `steps` values are valid JSON.)
-- If your DB stores them as TEXT that is not valid JSON, review before running.
UPDATE recipes SET ingredients =
  CASE
    WHEN ingredients IS NULL THEN '[]'::jsonb
    WHEN jsonb_typeof(ingredients) = 'array' THEN ingredients
    ELSE jsonb_build_array(ingredients)
  END
WHERE ingredients IS NOT NULL;

UPDATE recipes SET steps =
  CASE
    WHEN steps IS NULL THEN '[]'::jsonb
    WHEN jsonb_typeof(steps) = 'array' THEN steps
    ELSE jsonb_build_array(steps)
  END
WHERE steps IS NOT NULL;

-- 4) Add CHECK constraints to enforce types/ranges expected by backend validation
ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_prep_time_non_negative;
ALTER TABLE recipes ADD CONSTRAINT recipes_prep_time_non_negative CHECK (prep_time >= 0);

ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_cook_time_non_negative;
ALTER TABLE recipes ADD CONSTRAINT recipes_cook_time_non_negative CHECK (cook_time >= 0);

ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_servings_positive;
ALTER TABLE recipes ADD CONSTRAINT recipes_servings_positive CHECK (servings >= 1);

ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_difficulty_check;
ALTER TABLE recipes ADD CONSTRAINT recipes_difficulty_check CHECK (difficulty IN ('easy','medium','hard'));

-- 5) Drop obsolete columns (file-uploads removed from UI)
ALTER TABLE recipes DROP COLUMN IF EXISTS recipe_file;
ALTER TABLE recipes DROP COLUMN IF EXISTS author_file;

-- 6) Indexes to speed up searches / autocomplete (SELECT DISTINCT)
CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category);
CREATE INDEX IF NOT EXISTS idx_recipes_prep_time ON recipes(prep_time);
CREATE INDEX IF NOT EXISTS idx_recipes_cook_time ON recipes(cook_time);
CREATE INDEX IF NOT EXISTS idx_recipes_servings ON recipes(servings);
CREATE INDEX IF NOT EXISTS idx_recipes_ingredients_gin ON recipes USING gin(ingredients);

COMMIT;

-- USAGE: frontend autocomplete queries (run via Supabase client)
-- Categories:   SELECT DISTINCT category FROM recipes WHERE category IS NOT NULL ORDER BY category LIMIT 10;
-- Product names: SELECT DISTINCT (jsonb_array_elements(ingredients)->>'product_name') AS product_name FROM recipes WHERE ingredients IS NOT NULL LIMIT 100;
-- Units:         SELECT DISTINCT (jsonb_array_elements(ingredients)->>'unit') AS unit FROM recipes WHERE ingredients IS NOT NULL LIMIT 50;

-- NOTE:
-- - The migration keeps backward compatibility; frontend handles older formats when rendering.
-- - Review and test in a staging DB before running on production if you have legacy, non-JSON ingredient data.