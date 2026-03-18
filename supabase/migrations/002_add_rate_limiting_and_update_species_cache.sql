-- ============================================================
-- Migration 002: Rate limiting on profiles + species_cache schema update
-- Apply via Supabase SQL Editor (Dashboard -> SQL -> New query)
-- ============================================================

-- ── Rate limiting columns on profiles ──
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS analysis_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS analysis_reset_at TIMESTAMPTZ;

-- ── Update species_cache to match Edge Function expectations ──
-- Rename species_name -> scientific_name, add common_name, rename care_data -> data
ALTER TABLE species_cache RENAME COLUMN species_name TO scientific_name;
ALTER TABLE species_cache RENAME COLUMN care_data TO data;
ALTER TABLE species_cache ADD COLUMN IF NOT EXISTS common_name TEXT;
