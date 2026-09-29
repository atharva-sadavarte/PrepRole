-- Migration: Create interview_sessions table
CREATE TABLE IF NOT EXISTS public.interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  experience_level TEXT NOT NULL CHECK (experience_level IN ('fresher', 'experienced')),
  recording_mode TEXT NOT NULL CHECK (recording_mode IN ('video', 'audio')),
  target_role TEXT NOT NULL DEFAULT 'General',
  duration_seconds INTEGER NOT NULL DEFAULT 60,
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  score_tier TEXT NOT NULL DEFAULT 'Developing',
  breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary TEXT NOT NULL DEFAULT '',
  strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
  improvements JSONB NOT NULL DEFAULT '[]'::jsonb,
  ideal_script_rewrite TEXT NOT NULL DEFAULT '',
  key_takeaways JSONB NOT NULL DEFAULT '[]'::jsonb,
  filler_words JSONB NOT NULL DEFAULT '[]'::jsonb,
  pacing_wpm_estimate INTEGER DEFAULT 130,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to ensure idempotency
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view their own interview sessions" ON public.interview_sessions;
  DROP POLICY IF EXISTS "Users can insert their own interview sessions" ON public.interview_sessions;
  DROP POLICY IF EXISTS "Users can update their own interview sessions" ON public.interview_sessions;
  DROP POLICY IF EXISTS "Users can delete their own interview sessions" ON public.interview_sessions;
END $$;

-- RLS Policies
CREATE POLICY "Users can view their own interview sessions"
  ON public.interview_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own interview sessions"
  ON public.interview_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own interview sessions"
  ON public.interview_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own interview sessions"
  ON public.interview_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast user queries
CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_id ON public.interview_sessions(user_id, created_at DESC);
