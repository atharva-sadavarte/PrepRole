-- Migration: Create user_quotas table, atomic quota deduction RPC, and new user trigger

CREATE TABLE IF NOT EXISTS public.user_quotas (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL DEFAULT 'free',
  credits_remaining INTEGER NOT NULL DEFAULT 3 CHECK (credits_remaining >= 0),
  lifetime_scans_used INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_scans_used >= 0),
  pro_until TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.user_quotas ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view their own quotas" ON public.user_quotas;
END $$;

-- RLS: Users can only view their own quotas
CREATE POLICY "Users can view their own quotas"
  ON public.user_quotas FOR SELECT
  USING (auth.uid() = user_id);

-- Explicitly DO NOT grant client INSERT/UPDATE/DELETE to authenticated or anon roles.
-- Only database triggers, service role, and SECURITY DEFINER functions can modify quotas.

-- Backfill any existing users who do not yet have a record in user_quotas
INSERT INTO public.user_quotas (user_id, plan_type, credits_remaining, lifetime_scans_used)
SELECT id, 'free', 3, 0
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_quotas)
ON CONFLICT (user_id) DO NOTHING;

-- Trigger function: automatically provision 3 free credits when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user_quota()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_quotas (user_id, plan_type, credits_remaining, lifetime_scans_used)
  VALUES (NEW.id, 'free', 3, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created_quota ON auth.users;
CREATE TRIGGER on_auth_user_created_quota
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_quota();

-- Atomic Stored Procedure: deduct_user_scan
-- Called by Supabase Edge Function to atomically check and deduct 1 scan.
CREATE OR REPLACE FUNCTION public.deduct_user_scan(target_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_plan_type TEXT;
  v_credits INTEGER;
  v_pro_until TIMESTAMPTZ;
  v_is_pro BOOLEAN := FALSE;
BEGIN
  -- Lock the row for update to prevent race conditions
  SELECT plan_type, credits_remaining, pro_until
  INTO v_plan_type, v_credits, v_pro_until
  FROM public.user_quotas
  WHERE user_id = target_user_id
  FOR UPDATE;

  -- If user record not found, auto-create with 3 credits
  IF NOT FOUND THEN
    INSERT INTO public.user_quotas (user_id, plan_type, credits_remaining, lifetime_scans_used)
    VALUES (target_user_id, 'free', 3, 0)
    RETURNING plan_type, credits_remaining, pro_until
    INTO v_plan_type, v_credits, v_pro_until;
  END IF;

  -- Determine if Pro is active
  IF v_plan_type = 'pro' AND (v_pro_until IS NULL OR v_pro_until > now()) THEN
    v_is_pro := TRUE;
  END IF;

  -- 1. Pro Users: Unlimited scans, credits remain untouched
  IF v_is_pro THEN
    UPDATE public.user_quotas
    SET lifetime_scans_used = lifetime_scans_used + 1,
        updated_at = now()
    WHERE user_id = target_user_id;

    RETURN jsonb_build_object(
      'allowed', TRUE,
      'plan_type', 'pro',
      'credits_remaining', v_credits,
      'is_pro', TRUE
    );
  END IF;

  -- 2. Free Users: Check if credits available
  IF v_credits > 0 THEN
    UPDATE public.user_quotas
    SET credits_remaining = credits_remaining - 1,
        lifetime_scans_used = lifetime_scans_used + 1,
        updated_at = now()
    WHERE user_id = target_user_id;

    RETURN jsonb_build_object(
      'allowed', TRUE,
      'plan_type', 'free',
      'credits_remaining', v_credits - 1,
      'is_pro', FALSE
    );
  END IF;

  -- 3. Quota Exceeded
  RETURN jsonb_build_object(
    'allowed', FALSE,
    'plan_type', 'free',
    'credits_remaining', 0,
    'is_pro', FALSE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
