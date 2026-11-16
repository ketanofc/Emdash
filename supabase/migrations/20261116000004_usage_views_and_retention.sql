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
