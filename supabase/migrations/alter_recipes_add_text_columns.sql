-- Migration: add optional textual *_text columns to `recipes` if they are missing
-- Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS)

BEGIN;

-- Add textual display columns used by edge functions and client code
ALTER TABLE IF EXISTS recipes ADD COLUMN IF NOT EXISTS prep_time_text text;
ALTER TABLE IF EXISTS recipes ADD COLUMN IF NOT EXISTS cook_time_text text;
ALTER TABLE IF EXISTS recipes ADD COLUMN IF NOT EXISTS servings_text text;

COMMIT;

-- Usage:
-- Run this SQL against your Supabase/Postgres database (via psql, Supabase SQL editor, or supabase CLI).
-- Example (psql):
-- psql "postgresql://<user>:<pass>@<host>:5432/<db>" -f supabase/migrations/alter_recipes_add_text_columns.sql
