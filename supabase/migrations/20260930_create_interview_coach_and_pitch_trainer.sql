-- Migration: Create tables for Interview Coach journeys and Personal Pitch Trainer
-- 1. interview_journeys
CREATE TABLE IF NOT EXISTS public.interview_journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  job_role TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en-US',
  learner_country TEXT NOT NULL DEFAULT 'India',
  status TEXT NOT NULL DEFAULT 'inProgress' CHECK (status IN ('inProgress', 'completed')),
  current_round_number INTEGER NOT NULL DEFAULT 1,
  rounds JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. interview_journey_attempts
CREATE TABLE IF NOT EXISTS public.interview_journey_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID REFERENCES public.interview_journeys(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  round_number INTEGER NOT NULL,
  question TEXT NOT NULL,
  user_response_text TEXT NOT NULL DEFAULT '',
  audio_url TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  score NUMERIC(3,1) NOT NULL DEFAULT 0.0 CHECK (score >= 0.0 AND score <= 5.0),
  passed BOOLEAN NOT NULL DEFAULT false,
  ratings JSONB NOT NULL DEFAULT '{}'::jsonb,
  feedback TEXT NOT NULL DEFAULT '',
  strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
  improvements JSONB NOT NULL DEFAULT '[]'::jsonb,
  sample_answer TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. pitch_trainer_pitches
CREATE TABLE IF NOT EXISTS public.pitch_trainer_pitches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'analyzed', 'analyzed_failed', 'saved')),
  job_role TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en-US',
  notes JSONB NOT NULL DEFAULT '{}'::jsonb,
  transcript TEXT NOT NULL DEFAULT '',
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  video_url TEXT,
  audio_url TEXT,
  recording_mode TEXT NOT NULL DEFAULT 'video',
  overall_score NUMERIC(3,1) CHECK (overall_score >= 0.0 AND overall_score <= 5.0),
  score_tier TEXT,
  analysis JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.interview_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_journey_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pitch_trainer_pitches ENABLE ROW LEVEL SECURITY;

-- RLS Policies: interview_journeys
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can manage their interview journeys" ON public.interview_journeys;
  DROP POLICY IF EXISTS "Users can manage their interview attempts" ON public.interview_journey_attempts;
  DROP POLICY IF EXISTS "Users can manage their pitch trainer pitches" ON public.pitch_trainer_pitches;
END $$;

CREATE POLICY "Users can manage their interview journeys"
  ON public.interview_journeys FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their interview attempts"
  ON public.interview_journey_attempts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their pitch trainer pitches"
  ON public.pitch_trainer_pitches FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_interview_journeys_user ON public.interview_journeys(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_interview_attempts_journey ON public.interview_journey_attempts(journey_id, round_number);
CREATE INDEX IF NOT EXISTS idx_pitch_trainer_user ON public.pitch_trainer_pitches(user_id, updated_at DESC);
