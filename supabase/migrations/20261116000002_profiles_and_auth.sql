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
