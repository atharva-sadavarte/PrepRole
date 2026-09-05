-- Migration: Create resume_analyses table and storage bucket
CREATE TABLE IF NOT EXISTS public.resume_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  target_role TEXT NOT NULL,
  job_description TEXT,
  file_name TEXT,
  file_url TEXT,
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  score_tier TEXT NOT NULL DEFAULT 'Competitive',
  breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary TEXT NOT NULL DEFAULT '',
  strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
  improvements JSONB NOT NULL DEFAULT '[]'::jsonb,
  skills_matched JSONB NOT NULL DEFAULT '[]'::jsonb,
  skills_missing JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.resume_analyses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to ensure idempotency
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view their own analyses" ON public.resume_analyses;
  DROP POLICY IF EXISTS "Users can insert their own analyses" ON public.resume_analyses;
  DROP POLICY IF EXISTS "Users can update their own analyses" ON public.resume_analyses;
  DROP POLICY IF EXISTS "Users can delete their own analyses" ON public.resume_analyses;
END $$;

-- RLS Policies
CREATE POLICY "Users can view their own analyses"
  ON public.resume_analyses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own analyses"
  ON public.resume_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own analyses"
  ON public.resume_analyses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own analyses"
  ON public.resume_analyses FOR DELETE
  USING (auth.uid() = user_id);

-- Storage bucket for resumes
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can upload their own resumes" ON storage.objects;
  DROP POLICY IF EXISTS "Users can read their own resumes" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their own resumes" ON storage.objects;
END $$;

CREATE POLICY "Users can upload their own resumes"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can read their own resumes"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own resumes"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);
