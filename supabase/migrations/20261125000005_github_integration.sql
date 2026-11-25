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
