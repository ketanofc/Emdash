-- =====================================================================
-- EMDASH FULL SUPABASE DATABASE SCHEMA SETUP
-- Paste this entire file into your Supabase SQL Editor and click RUN.
-- It is idempotent and safe to run multiple times.
-- =====================================================================

-- >>>>> 20261116000001_wallet_and_config.sql <<<<<
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


-- >>>>> 20261116000002_profiles_and_auth.sql <<<<<
-- 002: User Profiles, Role/Status Enforcement, and Auto-Signup Trigger

CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  country text,
  last_seen_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles (status);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users may read ONLY their own profile row.
-- Users may NOT insert, update role/status, or delete profiles directly.
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Auto-create profile + initial wallet on auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signups_enabled boolean := true;
  v_daily_grant int := 100;
BEGIN
  SELECT signups_enabled, daily_grant
  INTO v_signups_enabled, v_daily_grant
  FROM public.app_config
  WHERE id = 1;

  IF v_signups_enabled IS FALSE THEN
    RAISE EXCEPTION 'SIGNUPS_DISABLED';
  END IF;

  INSERT INTO public.profiles (user_id, email, role, status, last_seen_at)
  VALUES (NEW.id, NEW.email, 'user', 'active', now())
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.wallets (user_id, balance, last_grant_at)
  VALUES (NEW.id, COALESCE(v_daily_grant, 100), now())
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.coin_ledger (user_id, delta, balance_after, reason)
  VALUES (NEW.id, COALESCE(v_daily_grant, 100), COALESCE(v_daily_grant, 100), 'Welcome daily Dash Coins')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- >>>>> 20261116000003_llm_router_and_admin.sql <<<<<
-- 003: Multi-Provider LLM Router Tables, Health, Call Logs, and Audit Log (Service-Role Only)

CREATE TABLE IF NOT EXISTS public.providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  protocol text NOT NULL CHECK (protocol IN ('gemini', 'openai')),
  base_url text NOT NULL,
  api_key_enc bytea NOT NULL,
  key_last4 text NOT NULL,
  key_version int NOT NULL DEFAULT 1,
  enabled boolean NOT NULL DEFAULT true,
  priority int NOT NULL DEFAULT 100,
  rpm_limit int CHECK (rpm_limit IS NULL OR rpm_limit > 0),
  rpd_limit int CHECK (rpd_limit IS NULL OR rpd_limit > 0),
  daily_token_limit bigint CHECK (daily_token_limit IS NULL OR daily_token_limit > 0),
  blocked_regions text[] NOT NULL DEFAULT '{}',
  supports_json_schema boolean NOT NULL DEFAULT false,
  last_test_at timestamptz,
  last_test_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.provider_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  model_id text NOT NULL,
  label text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  input_cost_per_mtok numeric NOT NULL DEFAULT 0,
  output_cost_per_mtok numeric NOT NULL DEFAULT 0,
  UNIQUE (provider_id, model_id)
);

CREATE TABLE IF NOT EXISTS public.routes (
  stage text PRIMARY KEY CHECK (stage IN ('brief', 'plan', 'build', 'repair')),
  chain jsonb NOT NULL DEFAULT '[]'::jsonb,
  temperature numeric NOT NULL DEFAULT 0.7,
  max_output_tokens int NOT NULL DEFAULT 8192,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.routes (stage, chain, temperature, max_output_tokens)
VALUES
  ('brief', '[]'::jsonb, 0.4, 2048),
  ('plan', '[]'::jsonb, 0.3, 4096),
  ('build', '[]'::jsonb, 0.5, 16384),
  ('repair', '[]'::jsonb, 0.3, 8192)
ON CONFLICT (stage) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.provider_health (
  provider_id uuid PRIMARY KEY REFERENCES public.providers(id) ON DELETE CASCADE,
  cooldown_until timestamptz,
  consecutive_failures int NOT NULL DEFAULT 0,
  last_error text,
  key_invalid boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.llm_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  stage text NOT NULL,
  provider_id uuid REFERENCES public.providers(id) ON DELETE SET NULL,
  model_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('ok', 'error', 'rate_limited', 'skipped')),
  http_status int,
  latency_ms int NOT NULL DEFAULT 0,
  input_tokens int NOT NULL DEFAULT 0,
  output_tokens int NOT NULL DEFAULT 0,
  total_tokens int NOT NULL DEFAULT 0,
  error_code text
);

CREATE INDEX IF NOT EXISTS idx_llm_calls_provider_created ON public.llm_calls (provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_calls_user_created ON public.llm_calls (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_calls_created ON public.llm_calls (created_at DESC);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  before jsonb,
  after jsonb,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.audit_log (actor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.llm_daily (
  day date NOT NULL,
  provider_id uuid,
  model_id text NOT NULL,
  calls bigint NOT NULL DEFAULT 0,
  errors bigint NOT NULL DEFAULT 0,
  rate_limited bigint NOT NULL DEFAULT 0,
  input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (day, provider_id, model_id)
);

-- Enable RLS on every table with ZERO policies for anon/authenticated.
-- Only service_role (Edge Functions) may read or write these tables.
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_daily ENABLE ROW LEVEL SECURITY;


-- >>>>> 20261116000004_usage_views_and_retention.sql <<<<<
-- 004: Usage Aggregation Views, Helper RPCs, and 90-Day Retention Rollup

CREATE OR REPLACE FUNCTION public.get_provider_window_usage(p_provider_id uuid)
RETURNS TABLE (
  rpm_count bigint,
  rpd_count bigint,
  daily_tokens bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) FILTER (
      WHERE created_at >= now() - interval '1 minute'
        AND status IN ('ok', 'error', 'rate_limited')
    ) AS rpm_count,
    COUNT(*) FILTER (
      WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
        AND status IN ('ok', 'error', 'rate_limited')
    ) AS rpd_count,
    COALESCE(SUM(total_tokens) FILTER (
      WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
        AND status = 'ok'
    ), 0)::bigint AS daily_tokens
  FROM public.llm_calls
  WHERE provider_id = p_provider_id;
$$;

CREATE OR REPLACE FUNCTION public.get_usage_by_day(p_days int DEFAULT 7)
RETURNS TABLE (
  day date,
  calls bigint,
  errors bigint,
  rate_limited bigint,
  input_tokens bigint,
  output_tokens bigint,
  total_tokens bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH recent AS (
    SELECT
      (created_at AT TIME ZONE 'UTC')::date AS day,
      COUNT(*) FILTER (WHERE status <> 'skipped') AS calls,
      COUNT(*) FILTER (WHERE status = 'error') AS errors,
      COUNT(*) FILTER (WHERE status = 'rate_limited') AS rate_limited,
      COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
      COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
      COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens
    FROM public.llm_calls
    WHERE created_at >= (now() - make_interval(days => GREATEST(1, p_days)))
    GROUP BY 1
  ),
  archived AS (
    SELECT
      day,
      SUM(calls)::bigint AS calls,
      SUM(errors)::bigint AS errors,
      SUM(rate_limited)::bigint AS rate_limited,
      SUM(input_tokens)::bigint AS input_tokens,
      SUM(output_tokens)::bigint AS output_tokens,
      SUM(input_tokens + output_tokens)::bigint AS total_tokens
    FROM public.llm_daily
    WHERE day >= ((now() AT TIME ZONE 'UTC')::date - GREATEST(1, p_days))
    GROUP BY 1
  ),
  combined AS (
    SELECT * FROM recent
    UNION ALL
    SELECT * FROM archived
  )
  SELECT
    day,
    SUM(calls)::bigint AS calls,
    SUM(errors)::bigint AS errors,
    SUM(rate_limited)::bigint AS rate_limited,
    SUM(input_tokens)::bigint AS input_tokens,
    SUM(output_tokens)::bigint AS output_tokens,
    SUM(total_tokens)::bigint AS total_tokens
  FROM combined
  GROUP BY day
  ORDER BY day ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_usage_by_provider(p_days int DEFAULT 1)
RETURNS TABLE (
  provider_id uuid,
  calls bigint,
  errors bigint,
  rate_limited bigint,
  input_tokens bigint,
  output_tokens bigint,
  total_tokens bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    provider_id,
    COUNT(*) FILTER (WHERE status <> 'skipped') AS calls,
    COUNT(*) FILTER (WHERE status = 'error') AS errors,
    COUNT(*) FILTER (WHERE status = 'rate_limited') AS rate_limited,
    COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
    COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
    COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens
  FROM public.llm_calls
  WHERE created_at >= (now() - make_interval(days => GREATEST(1, p_days)))
  GROUP BY provider_id;
$$;

CREATE OR REPLACE FUNCTION public.get_usage_by_model(p_days int DEFAULT 7)
RETURNS TABLE (
  provider_id uuid,
  model_id text,
  calls bigint,
  errors bigint,
  rate_limited bigint,
  input_tokens bigint,
  output_tokens bigint,
  total_tokens bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    provider_id,
    model_id,
    COUNT(*) FILTER (WHERE status <> 'skipped') AS calls,
    COUNT(*) FILTER (WHERE status = 'error') AS errors,
    COUNT(*) FILTER (WHERE status = 'rate_limited') AS rate_limited,
    COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
    COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
    COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens
  FROM public.llm_calls
  WHERE created_at >= (now() - make_interval(days => GREATEST(1, p_days)))
  GROUP BY provider_id, model_id;
$$;

CREATE OR REPLACE FUNCTION public.get_usage_by_user(p_days int DEFAULT 7)
RETURNS TABLE (
  user_id uuid,
  calls bigint,
  errors bigint,
  rate_limited bigint,
  input_tokens bigint,
  output_tokens bigint,
  total_tokens bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    user_id,
    COUNT(*) FILTER (WHERE status <> 'skipped') AS calls,
    COUNT(*) FILTER (WHERE status = 'error') AS errors,
    COUNT(*) FILTER (WHERE status = 'rate_limited') AS rate_limited,
    COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
    COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
    COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens
  FROM public.llm_calls
  WHERE created_at >= (now() - make_interval(days => GREATEST(1, p_days)))
    AND user_id IS NOT NULL
  GROUP BY user_id;
$$;

-- Retention rollup: rolls llm_calls older than retention_days into llm_daily, then deletes them
CREATE OR REPLACE FUNCTION public.rollup_and_prune_llm_calls(retention_days int DEFAULT 90)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff timestamptz := now() - make_interval(days => GREATEST(1, retention_days));
  v_deleted bigint := 0;
BEGIN
  INSERT INTO public.llm_daily (
    day, provider_id, model_id, calls, errors, rate_limited, input_tokens, output_tokens
  )
  SELECT
    (created_at AT TIME ZONE 'UTC')::date AS day,
    COALESCE(provider_id, '00000000-0000-0000-0000-000000000000'::uuid) AS provider_id,
    model_id,
    COUNT(*) FILTER (WHERE status <> 'skipped')::bigint AS calls,
    COUNT(*) FILTER (WHERE status = 'error')::bigint AS errors,
    COUNT(*) FILTER (WHERE status = 'rate_limited')::bigint AS rate_limited,
    COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
    COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens
  FROM public.llm_calls
  WHERE created_at < v_cutoff
  GROUP BY 1, 2, 3
  ON CONFLICT (day, provider_id, model_id)
  DO UPDATE SET
    calls = public.llm_daily.calls + EXCLUDED.calls,
    errors = public.llm_daily.errors + EXCLUDED.errors,
    rate_limited = public.llm_daily.rate_limited + EXCLUDED.rate_limited,
    input_tokens = public.llm_daily.input_tokens + EXCLUDED.input_tokens,
    output_tokens = public.llm_daily.output_tokens + EXCLUDED.output_tokens;

  DELETE FROM public.llm_calls
  WHERE created_at < v_cutoff;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Restrict all usage/retention RPCs exclusively to service_role
REVOKE ALL ON FUNCTION public.get_provider_window_usage(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_usage_by_day(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_usage_by_provider(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_usage_by_model(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_usage_by_user(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rollup_and_prune_llm_calls(int) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_provider_window_usage(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_usage_by_day(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_usage_by_provider(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_usage_by_model(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_usage_by_user(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.rollup_and_prune_llm_calls(int) TO service_role;

-- Schedule daily retention job at 03:15 UTC if pg_cron is enabled
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'emdash_llm_calls_retention',
      '15 3 * * *',
      $cron$SELECT public.rollup_and_prune_llm_calls(90);$cron$
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$$;



-- >>>>> 20261125000005_github_integration.sql <<<<<
-- 005: GitHub Integration (Encrypted OAuth Connections & Agent Sessions)

CREATE TABLE IF NOT EXISTS public.github_connections (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  github_user_id text NOT NULL,
  username text NOT NULL,
  avatar_url text,
  scope text,
  access_token_enc bytea NOT NULL,
  key_version int NOT NULL DEFAULT 1,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Server-only table: never expose access tokens to client RLS
ALTER TABLE public.github_connections ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.github_agent_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  repo_owner text NOT NULL,
  repo_name text NOT NULL,
  base_branch text NOT NULL,
  working_branch text,
  pr_url text,
  pr_number int,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'committed', 'pr_opened', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_github_agent_sessions_user
  ON public.github_agent_sessions (user_id, updated_at DESC);

ALTER TABLE public.github_agent_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS github_sessions_select_own ON public.github_agent_sessions;
CREATE POLICY github_sessions_select_own ON public.github_agent_sessions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
