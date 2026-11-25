-- Migration: Add updated PDF storage & edit summary columns to resume_analyses
ALTER TABLE public.resume_analyses
  ADD COLUMN IF NOT EXISTS updated_file_name TEXT,
  ADD COLUMN IF NOT EXISTS updated_file_url TEXT,
  ADD COLUMN IF NOT EXISTS updated_summary_of_changes JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
