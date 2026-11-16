-- 001: App Config, Wallets, Coin Ledger, and Jobs (with strict RLS & atomic coin RPCs)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.app_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  daily_grant int NOT NULL DEFAULT 100 CHECK (daily_grant >= 0),
  costs jsonb NOT NULL DEFAULT '{"build": 10, "repair": 0}'::jsonb,
  reset_timezone text NOT NULL DEFAULT 'UTC',
  global_daily_call_limit int NOT NULL DEFAULT 5000 CHECK (global_daily_call_limit > 0),
  maintenance boolean NOT NULL DEFAULT false,
  signups_enabled boolean NOT NULL DEFAULT true,
  high_demand_threshold numeric NOT NULL DEFAULT 0.8 CHECK (high_demand_threshold > 0 AND high_demand_threshold <= 1),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance int NOT NULL DEFAULT 100 CHECK (balance >= 0),
  last_grant_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stage text NOT NULL DEFAULT 'build',
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'paused')),
  coin_cost int NOT NULL DEFAULT 0,
  refunded boolean NOT NULL DEFAULT false,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_jobs_user_created ON public.jobs (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.coin_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta int NOT NULL,
  balance_after int NOT NULL,
  reason text NOT NULL,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coin_ledger_user_created ON public.coin_ledger (user_id, created_at DESC);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_ledger ENABLE ROW LEVEL SECURITY;

-- Users can read only their own wallet, ledger, and jobs.
-- Only service_role can mutate balances or config.
DROP POLICY IF EXISTS wallets_select_own ON public.wallets;
CREATE POLICY wallets_select_own ON public.wallets
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS coin_ledger_select_own ON public.coin_ledger;
CREATE POLICY coin_ledger_select_own ON public.coin_ledger
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS jobs_select_own ON public.jobs;
CREATE POLICY jobs_select_own ON public.jobs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Atomic coin deduction (service_role only)
CREATE OR REPLACE FUNCTION public.spend_coins(
  p_user_id uuid,
  p_amount int,
  p_reason text,
  p_job_id uuid DEFAULT NULL
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance int;
BEGIN
  IF p_amount < 0 THEN
    RAISE EXCEPTION 'Amount must be non-negative';
  END IF;

  INSERT INTO public.wallets (user_id, balance)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_balance
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_COINS';
  END IF;

  IF p_amount = 0 THEN
    RETURN v_balance;
  END IF;

  v_balance := v_balance - p_amount;

  UPDATE public.wallets
  SET balance = v_balance, updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.coin_ledger (user_id, delta, balance_after, reason, job_id)
  VALUES (p_user_id, -p_amount, v_balance, p_reason, p_job_id);

  RETURN v_balance;
END;
$$;

-- Atomic coin refund (idempotent per job_id; service_role only)
CREATE OR REPLACE FUNCTION public.refund_coins(
  p_user_id uuid,
  p_amount int,
  p_reason text,
  p_job_id uuid DEFAULT NULL
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance int;
  v_already_refunded boolean := false;
BEGIN
  IF p_amount <= 0 THEN
    SELECT balance INTO v_balance FROM public.wallets WHERE user_id = p_user_id;
    RETURN COALESCE(v_balance, 0);
  END IF;

  IF p_job_id IS NOT NULL THEN
    SELECT refunded INTO v_already_refunded
    FROM public.jobs
    WHERE id = p_job_id AND user_id = p_user_id
    FOR UPDATE;

    IF v_already_refunded IS TRUE THEN
      SELECT balance INTO v_balance FROM public.wallets WHERE user_id = p_user_id;
      RETURN COALESCE(v_balance, 0);
    END IF;

    UPDATE public.jobs
    SET refunded = true, status = 'failed'
    WHERE id = p_job_id AND user_id = p_user_id;
  END IF;

  SELECT balance INTO v_balance
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  v_balance := COALESCE(v_balance, 0) + p_amount;

  UPDATE public.wallets
  SET balance = v_balance, updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.coin_ledger (user_id, delta, balance_after, reason, job_id)
  VALUES (p_user_id, p_amount, v_balance, p_reason, p_job_id);

  RETURN v_balance;
END;
$$;

-- Admin or daily coin adjustment (writes a coin_ledger row)
CREATE OR REPLACE FUNCTION public.adjust_coins(
  p_user_id uuid,
  p_delta int,
  p_reason text,
  p_actor_id uuid DEFAULT NULL
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance int;
BEGIN
  INSERT INTO public.wallets (user_id, balance)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_balance
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  v_balance := GREATEST(0, v_balance + p_delta);

  UPDATE public.wallets
  SET balance = v_balance, updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.coin_ledger (user_id, delta, balance_after, reason, actor_id)
  VALUES (p_user_id, p_delta, v_balance, p_reason, p_actor_id);

  RETURN v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.spend_coins(uuid, int, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_coins(uuid, int, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.adjust_coins(uuid, int, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spend_coins(uuid, int, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_coins(uuid, int, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.adjust_coins(uuid, int, text, uuid) TO service_role;
