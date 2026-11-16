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
