You are a senior full-stack engineer. Work inside this existing repository, the "Emdash" website (free AI app builder, Supabase backend with Auth, Postgres and Edge Functions, managed mode with daily Dash Coins).

GOAL
Add (A) a multi-provider LLM router that works with Gemini, OpenRouter, OpenCode Zen, and any other OpenAI-compatible provider, (B) an ADMIN PANEL to manage provider API keys, routing, users, settings, and to monitor token usage. Users never see or bring any API key. All provider keys live encrypted in the database and are used only on the server.

STEP 0: INSPECT FIRST
- Read the repo: framework, language, styling, existing Supabase migrations, the existing /generate, /repair, /wallet functions, the pipeline code, the coin functions, and the header/pill UI. Print a short summary and plan, then continue. Reuse existing code and the existing design system (orange brand, mono labels, crop-mark corners, hatched dividers). Do not redesign the public site. Commit after each step.
- Replace the old single-key GEMINI_API_KEY env usage: all provider calls now go through the new router. Remove any leftover bring-your-own-key code.

SECURITY RULES (strict)
- Provider API keys are stored ONLY as AES-256-GCM ciphertext in providers.api_key_enc (random 12-byte IV per record, key_version column for rotation). The master key is the server secret KEY_ENCRYPTION_SECRET (32 random bytes, base64). Decrypt only inside Edge Functions, only at call time, never log it, never return it. APIs return key_last4 only.
- No key may appear in source, committed files, client bundles, logs, error messages, URLs, or test snapshots. Add .env* to .gitignore. Never ask me for any API key. I will add provider keys myself through the admin panel.
- Admin access: profiles.role = 'admin' checked server-side from the database on every admin request (never trust a client claim). Require Supabase MFA (TOTP) at assurance level aal2 for all admin endpoints; return 403 otherwise. Rate-limit admin endpoints. Admin pages are code-split and hidden from the nav for non-admins (but real protection is server-side).
- Every admin write is recorded in audit_log with actor, action, target, before/after (secrets redacted), IP, and timestamp.
- CORS locked to the site origin. Escape all model output before inserting into the DOM.

DATABASE (new migrations; enable RLS on every table)
- profiles(user_id pk references auth.users, role text default 'user' check in ('user','admin'), status text default 'active' check in ('active','suspended'), country text, last_seen_at timestamptz, created_at timestamptz default now()). Create automatically on signup via trigger. Users may read only their own row and may not change role or status.
- providers(id uuid pk, name text, slug text unique, protocol text check in ('gemini','openai'), base_url text, api_key_enc bytea, key_last4 text, key_version int default 1, enabled bool default true, priority int default 100, rpm_limit int, rpd_limit int, daily_token_limit bigint, blocked_regions text[] default '{}', supports_json_schema bool default false, last_test_at timestamptz, last_test_status text, created_at, updated_at).
- provider_models(id, provider_id fk, model_id text, label text, enabled bool default true, input_cost_per_mtok numeric, output_cost_per_mtok numeric, unique(provider_id, model_id)).
- routes(stage text pk check in ('brief','plan','build','repair'), chain jsonb not null default '[]' (ordered [{provider_id, model_id}]), temperature numeric, max_output_tokens int).
- provider_health(provider_id pk, cooldown_until timestamptz, consecutive_failures int default 0, last_error text, updated_at).
- llm_calls(id uuid pk, created_at timestamptz default now(), user_id uuid, job_id uuid, stage text, provider_id uuid, model_id text, status text ('ok','error','rate_limited','skipped'), http_status int, latency_ms int, input_tokens int, output_tokens int, total_tokens int, error_code text). Index on (provider_id, created_at) and (user_id, created_at) and (created_at).
- audit_log(id uuid pk, actor_id uuid, action text, target_type text, target_id text, before jsonb, after jsonb, ip text, created_at timestamptz default now()).
- Extend app_config with: signups_enabled=true, high_demand_threshold=0.8.
- RLS: providers, provider_models, routes, provider_health, llm_calls, audit_log are NOT readable or writable by normal users or the anon role; only the service role (Edge Functions) touches them. Users can still read only their own wallet and ledger.
- Provide SQL helper views or RPCs for usage aggregation: daily totals, by provider, by model, by user, error and rate-limit counts. Retention: a scheduled job deletes llm_calls older than 90 days after rolling them into a daily summary table llm_daily(day, provider_id, model_id, calls, errors, rate_limited, input_tokens, output_tokens).

LLM ROUTER (lib/llm, used by /generate and /repair)
callLLM({ stage, system, prompt, schema?, userId, jobId, country }) -> { text, provider, model, tokens }
- Load the route chain for the stage. Walk it in order. Skip a candidate (and log a 'skipped' call row only if useful for debugging) when: provider disabled, model disabled, country is in blocked_regions, provider_health.cooldown_until is in the future, rpm_limit/rpd_limit/daily_token_limit already reached (computed from llm_calls counts).
- Protocols:
  - gemini: POST {base_url or https://generativelanguage.googleapis.com/v1beta}/models/{model}:generateContent with the key in the x-goog-api-key header only; body uses systemInstruction, contents, generationConfig{temperature, maxOutputTokens, responseMimeType/responseSchema when schema is given}. Tokens from usageMetadata (promptTokenCount, candidatesTokenCount, totalTokenCount).
  - openai (OpenRouter, OpenCode Zen, others): POST {base_url}/chat/completions with Authorization: Bearer <key>, messages [system,user], temperature, max_tokens. Presets: OpenRouter base_url https://openrouter.ai/api/v1, OpenCode Zen base_url https://opencode.ai/zen/v1. For OpenRouter also send optional X-Title: Emdash. Tokens from usage.prompt_tokens / completion_tokens / total_tokens. If schema is given and supports_json_schema is true, send response_format json_schema; otherwise instruct "respond with JSON only", parse, validate with zod, retry once with the validation error, then fall through to the next candidate.
- Keep ONE canonical JSON Schema (lowercase types) in code and convert it to Gemini's format (uppercase types) inside the gemini adapter.
- 60s timeout (AbortController). On 429 or 5xx: record the failure, set cooldown_until with exponential backoff (60s, 2m, 5m, capped at 15m) and consecutive_failures, then try the next candidate. On 401/403: mark the provider unhealthy with a long cooldown and flag it in the admin dashboard as "key invalid". On success: reset consecutive_failures.
- Every attempt writes an llm_calls row (tokens, latency, status, error_code). Never store prompts or outputs in llm_calls.
- If all candidates fail, throw a friendly error so /generate refunds the user's coins (existing behavior).
- Keep the existing global_daily_call_limit and high-demand behavior, now measured from llm_calls.

ADMIN API (Edge Function "admin", all routes behind admin + aal2 checks)
- GET /overview?range=1d|7d|30d: calls, tokens, errors, rate-limited count, active users, coins spent, per-provider usage vs limits, alerts (provider down, key invalid, >80% of a daily limit).
- Providers: GET/POST /providers, PATCH/DELETE /providers/:id, POST /providers/:id/rotate-key, POST /providers/:id/test. Create and rotate accept the key in the request body once; test calls the provider's model-list endpoint (or a 1-token generation) and returns the discovered models, which can be saved into provider_models. Never return the key.
- Models: GET/PATCH /providers/:id/models (enable, labels, per-million-token costs).
- Routes: GET/PUT /routes (per stage: ordered chain, temperature, max_output_tokens). Validate that every referenced provider and model exists.
- Users: GET /users?q=&status=&page=, GET /users/:id (wallet, ledger, recent jobs, tokens used), POST /users/:id/coins { delta, reason } (writes a ledger row), POST /users/:id/suspend and /reactivate. Suspended users get 403 from /generate.
- Usage: GET /usage?group=provider|model|user|day&range=
- Config: GET/PUT /config (daily_grant, costs, reset_timezone, global_daily_call_limit, maintenance, signups_enabled, high_demand_threshold) with validation.
- Audit: GET /audit?page=
- Bootstrap: do NOT create an admin account automatically. Print the exact SQL I must run once in the Supabase SQL editor to promote my user: update profiles set role='admin' where user_id = '<my-user-id>';

ADMIN UI (route /admin, lazy-loaded, matches the existing design system, responsive down to 390px, light and dark)
1. Overview: stat cards (calls today, tokens today, error rate, active users, coins spent), a 7/30-day chart (use the chart library already in the repo, otherwise simple inline SVG), per-provider usage bars against their limits, and an alerts strip.
2. Providers: table (name, protocol, status chip, key ••••last4, priority, limits, today's usage, last test). "Add provider" dialog with presets (Gemini, OpenRouter, OpenCode Zen, Custom OpenAI-compatible), key input (password, write-only), test button, model picker, limits, blocked regions, enable toggle. "Rotate key" action. Confirm before delete.
3. Routing: four rows (brief, plan, build, repair), each with an ordered chain you can reorder with up/down buttons and edit temperature and max tokens. Show a warning if a chain is empty or contains a disabled provider.
4. Users: searchable table (email, status, coins, tokens today, last seen, country). Detail drawer with ledger, recent jobs, and actions (adjust coins with a reason, suspend, reactivate).
5. Settings: the config form with validation and a prominent maintenance toggle.
6. Audit log: filterable table.
- Guard: if the signed-in user is not an admin or lacks MFA, show a clear "Admin access required / enable two-factor authentication" screen. Add an MFA enrollment flow (TOTP) reachable from the admin gate.
- Never display secrets; show copy-safe IDs only.

PUBLIC SITE CHANGES
- Keep the coin pill and flow. Remove any mention of keys or providers from the user UI. If the router reports no available provider, show "High demand right now, please try again later".

TESTS
- Router: falls through on 429 and sets cooldown; skips cooled-down, disabled, over-limit, and region-blocked providers; maps Gemini and OpenAI usage fields; zod-validation retry for JSON on openai protocol; throws when all candidates fail and the coin refund still happens exactly once.
- Crypto: encrypt/decrypt round trip, unique IV, wrong key fails, key_version rotation.
- Security: non-admin gets 403 on every admin route; admin without aal2 gets 403; a user cannot read providers, llm_calls, or audit_log via the client library; assert no API response and no log output contains a test key; audit_log row written for each admin write.
- Admin coin adjustment writes a ledger row; suspended user cannot generate.
- Run lint, typecheck, tests, and a production build. Grep the repo and build output for "AIza", "sk-", "Bearer " with real-looking tokens, and any string equal to a test key; confirm nothing secret is present.

ACCEPTANCE CHECKLIST (report pass/fail for each)
1. After I promote my account to admin and enroll MFA, /admin opens; a normal user sees the gate screen.
2. I can add Gemini, OpenRouter, and OpenCode Zen providers by pasting keys in the UI, test each one, and save discovered models; keys show only the last 4 characters afterward.
3. I can set the "build" route to a primary model and a fallback; when I disable the primary, builds still succeed through the fallback.
4. Simulating a 429 puts the provider on cooldown and the dashboard shows it.
5. Overview shows tokens and calls per provider and per day; the Users page shows per-user usage.
6. Adjusting a user's coins and suspending a user work and appear in the audit log.
7. Changing daily_grant, costs, and reset_timezone in Settings takes effect without a redeploy.
8. A user in a region listed in a provider's blocked_regions never reaches that provider.
9. No secret appears in the client bundle, repo, console, network URLs, or API responses.
10. The public site, coins, preview, and export still work.

FINAL REPORT
List the files changed, migration order, the exact commands for me to run (supabase db push, supabase functions deploy, and supabase secrets set KEY_ENCRYPTION_SECRET=<generate with: openssl rand -base64 32>), the SQL to promote my admin account, local run instructions, and what to test by hand. Do not ask me for any provider API key.