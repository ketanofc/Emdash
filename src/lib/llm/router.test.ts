import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { LocalAppStore } from "../../server/store.ts";
import { encryptApiKey } from "./crypto.ts";
import { callLLM, computeCooldownSeconds } from "./router.ts";
import { NoAvailableProviderError } from "./types.ts";

function makeSecret(): string {
  return crypto.randomBytes(32).toString("base64");
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("llm router", () => {
  it("computes capped exponential cooldown backoff (60s -> 2m -> 5m -> 15m)", () => {
    expect(computeCooldownSeconds(1)).toBe(60);
    expect(computeCooldownSeconds(2)).toBe(120);
    expect(computeCooldownSeconds(3)).toBe(300);
    expect(computeCooldownSeconds(4)).toBe(900);
    expect(computeCooldownSeconds(9)).toBe(900);
  });

  it("falls through on 429, sets cooldown, and maps Gemini x-goog-api-key + uppercase schema", async () => {
    let now = 1_700_000_000_000;
    const store = new LocalAppStore({ nowMs: () => now });
    const secret = makeSecret();

    const p1Enc = await encryptApiKey("fixture_primary_1111", secret, 1);
    const p2Enc = await encryptApiKey("fixture_backup_2222", secret, 1);

    const p1 = store.createProvider({
      name: "OpenRouter Primary",
      slug: "openrouter",
      protocol: "openai",
      base_url: "https://openrouter.ai/api/v1",
      api_key_enc: p1Enc.encryptedHex,
      key_last4: p1Enc.keyLast4,
      key_version: 1,
      enabled: true,
      priority: 1,
      rpm_limit: null,
      rpd_limit: null,
      daily_token_limit: null,
      blocked_regions: [],
      supports_json_schema: true,
      last_test_at: null,
      last_test_status: null,
    });

    const p2 = store.createProvider({
      name: "Gemini Backup",
      slug: "gemini",
      protocol: "gemini",
      base_url: "https://generativelanguage.googleapis.com/v1beta",
      api_key_enc: p2Enc.encryptedHex,
      key_last4: p2Enc.keyLast4,
      key_version: 1,
      enabled: true,
      priority: 2,
      rpm_limit: null,
      rpd_limit: null,
      daily_token_limit: null,
      blocked_regions: [],
      supports_json_schema: true,
      last_test_at: null,
      last_test_status: null,
    });

    store.upsertRoute({
      stage: "brief",
      chain: [
        { provider_id: p1.id, model_id: "google/gemini-2.5-flash" },
        { provider_id: p2.id, model_id: "gemini-2.5-flash" },
      ],
      temperature: 0.4,
      max_output_tokens: 2048,
    });

    const seenCalls: Array<{ url: string; headers: Record<string, string>; body: Record<string, unknown> }> = [];
    const fetchFn: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
      seenCalls.push({ url, headers, body });

      if (url.includes("openrouter.ai")) {
        return jsonResponse({ error: "rate limit" }, 429);
      }
      return jsonResponse({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ appName: "Nova" }) }] } }],
        usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 8, totalTokenCount: 20 },
      });
    };

    const result = await callLLM(
      {
        stage: "brief",
        system: "Design brief",
        prompt: "Build a todo app",
        schema: {
          type: "object",
          properties: { appName: { type: "string" } },
          required: ["appName"],
        },
        userId: "user-1",
        jobId: "job-1",
      },
      { store, keyring: secret, fetchFn, nowMs: () => now }
    );

    expect(result.providerId).toBe(p2.id);
    expect(result.model).toBe("gemini-2.5-flash");
    expect(result.tokens).toEqual({ inputTokens: 12, outputTokens: 8, totalTokens: 20 });

    // OpenRouter received X-Title: Emdash
    expect(seenCalls[0].headers["X-Title"]).toBe("Emdash");
    // Gemini received x-goog-api-key header, NEVER query param
    expect(seenCalls[1].url).not.toContain("key=");
    expect(seenCalls[1].headers["x-goog-api-key"]).toBe("fixture_backup_2222");

    // Gemini received uppercase schema types converted from canonical lowercase JSON Schema
    const genCfg = seenCalls[1].body.generationConfig as { responseSchema?: { type?: string } };
    expect(genCfg.responseSchema?.type).toBe("OBJECT");

    const p1Health = await store.getProviderHealth(p1.id);
    expect(p1Health?.consecutive_failures).toBe(1);
    expect(Date.parse(p1Health!.cooldown_until!)).toBe(now + 60_000);

    const calls = store.listLlmCalls();
    expect(calls).toHaveLength(2);
    expect(calls[0].status).toBe("rate_limited");
    expect(calls[1].status).toBe("ok");
  });

  it("marks key_invalid on 401/403 and skips cooled-down, disabled, blocked-region, and over-limit providers", async () => {
    let now = 1_700_000_000_000;
    const store = new LocalAppStore({ nowMs: () => now });
    const secret = makeSecret();

    const pAuthEnc = await encryptApiKey("fixture_bad_key_0001", secret, 1);
    const pDisabledEnc = await encryptApiKey("fixture_dis_key_0002", secret, 1);
    const pRegionEnc = await encryptApiKey("fixture_reg_key_0003", secret, 1);
    const pRpmEnc = await encryptApiKey("fixture_rpm_key_0004", secret, 1);
    const pGoodEnc = await encryptApiKey("fixture_good_key_0005", secret, 1);

    const pAuth = store.createProvider({
      name: "AuthFail",
      slug: "opencode-zen-1",
      protocol: "openai",
      base_url: "https://opencode.ai/zen/v1",
      api_key_enc: pAuthEnc.encryptedHex,
      key_last4: pAuthEnc.keyLast4,
      key_version: 1,
      enabled: true,
      priority: 1,
      rpm_limit: null,
      rpd_limit: null,
      daily_token_limit: null,
      blocked_regions: [],
      supports_json_schema: false,
      last_test_at: null,
      last_test_status: null,
    });
    const pDisabled = store.createProvider({
      name: "Disabled",
      slug: "disabled-p",
      protocol: "openai",
      base_url: "https://api.example.com/v1",
      api_key_enc: pDisabledEnc.encryptedHex,
      key_last4: pDisabledEnc.keyLast4,
      key_version: 1,
      enabled: false,
      priority: 2,
      rpm_limit: null,
      rpd_limit: null,
      daily_token_limit: null,
      blocked_regions: [],
      supports_json_schema: false,
      last_test_at: null,
      last_test_status: null,
    });
    const pRegion = store.createProvider({
      name: "RegionBlocked",
      slug: "region-p",
      protocol: "openai",
      base_url: "https://api.example.com/v1",
      api_key_enc: pRegionEnc.encryptedHex,
      key_last4: pRegionEnc.keyLast4,
      key_version: 1,
      enabled: true,
      priority: 3,
      rpm_limit: null,
      rpd_limit: null,
      daily_token_limit: null,
      blocked_regions: ["DE"],
      supports_json_schema: false,
      last_test_at: null,
      last_test_status: null,
    });
    const pRpm = store.createProvider({
      name: "RpmFull",
      slug: "rpm-p",
      protocol: "openai",
      base_url: "https://api.example.com/v1",
      api_key_enc: pRpmEnc.encryptedHex,
      key_last4: pRpmEnc.keyLast4,
      key_version: 1,
      enabled: true,
      priority: 4,
      rpm_limit: 1,
      rpd_limit: null,
      daily_token_limit: null,
      blocked_regions: [],
      supports_json_schema: false,
      last_test_at: null,
      last_test_status: null,
    });
    const pGood = store.createProvider({
      name: "Healthy",
      slug: "healthy-p",
      protocol: "openai",
      base_url: "https://opencode.ai/zen/v1",
      api_key_enc: pGoodEnc.encryptedHex,
      key_last4: pGoodEnc.keyLast4,
      key_version: 1,
      enabled: true,
      priority: 5,
      rpm_limit: null,
      rpd_limit: null,
      daily_token_limit: null,
      blocked_regions: [],
      supports_json_schema: false,
      last_test_at: null,
      last_test_status: null,
    });

    // Simulate 1 existing call in current minute so pRpm is over rpm_limit
    await store.insertLlmCall({
      user_id: "u1",
      job_id: "j0",
      stage: "build",
      provider_id: pRpm.id,
      model_id: "m1",
      status: "ok",
      http_status: 200,
      latency_ms: 50,
      input_tokens: 1,
      output_tokens: 1,
      total_tokens: 2,
      error_code: null,
    });

    // Disabled model on pGood? Add an active model and keep route matching it
    store.upsertProviderModels(pGood.id, [{ model_id: "good-model", enabled: true }]);
    store.upsertRoute({
      stage: "build",
      chain: [
        { provider_id: pAuth.id, model_id: "m-auth" },
        { provider_id: pDisabled.id, model_id: "m-dis" },
        { provider_id: pRegion.id, model_id: "m-reg" },
        { provider_id: pRpm.id, model_id: "m-rpm" },
        { provider_id: pGood.id, model_id: "good-model" },
      ],
      temperature: 0.3,
      max_output_tokens: 4096,
    });

    const calledModels: string[] = [];
    const fetchFn: typeof fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { model: string };
      calledModels.push(body.model);
      if (body.model === "m-auth") {
        return jsonResponse({ error: "unauthorized" }, 401);
      }
      return jsonResponse({
        choices: [{ message: { content: "Built app output" } }],
        usage: { prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 },
      });
    };

    const res = await callLLM(
      {
        stage: "build",
        system: "sys",
        prompt: "build",
        userId: "u1",
        jobId: "j1",
        country: "DE",
      },
      { store, keyring: secret, fetchFn, nowMs: () => now }
    );

    expect(res.providerId).toBe(pGood.id);
    expect(calledModels).toEqual(["m-auth", "good-model"]);

    const authHealth = await store.getProviderHealth(pAuth.id);
    expect(authHealth?.key_invalid).toBe(true);
    expect(Date.parse(authHealth!.cooldown_until!)).toBeGreaterThan(now + 20 * 3600 * 1000);

    // Second call 10s later should skip pAuth completely because of cooldown
    now += 10_000;
    calledModels.length = 0;
    await callLLM(
      {
        stage: "build",
        system: "sys",
        prompt: "build",
        userId: "u1",
        jobId: "j2",
        country: "DE",
      },
      { store, keyring: secret, fetchFn, nowMs: () => now }
    );
    expect(calledModels).toEqual(["good-model"]);
  });

  it("retries OpenAI JSON schema validation once with Zod error then falls through or succeeds", async () => {
    const store = new LocalAppStore();
    const secret = makeSecret();
    const enc = await encryptApiKey("fixture_openai_key_3333", secret, 1);

    const p = store.createProvider({
      name: "OpenCode",
      slug: "opencode-zen",
      protocol: "openai",
      base_url: "https://opencode.ai/zen/v1",
      api_key_enc: enc.encryptedHex,
      key_last4: enc.keyLast4,
      key_version: 1,
      enabled: true,
      priority: 1,
      rpm_limit: null,
      rpd_limit: null,
      daily_token_limit: null,
      blocked_regions: [],
      supports_json_schema: false,
      last_test_at: null,
      last_test_status: null,
    });

    store.upsertRoute({
      stage: "plan",
      chain: [{ provider_id: p.id, model_id: "qwen-coder" }],
      temperature: 0.2,
      max_output_tokens: 1024,
    });

    let attempt = 0;
    const prompts: string[] = [];
    const fetchFn: typeof fetch = async (_url, init) => {
      attempt += 1;
      const body = JSON.parse(String(init?.body)) as { messages: Array<{ content: string }> };
      prompts.push(body.messages[body.messages.length - 1].content);
      if (attempt === 1) {
        // Missing required "components" field -> triggers Zod retry
        return jsonResponse({
          choices: [{ message: { content: JSON.stringify({ wrongField: 1 }) } }],
          usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
        });
      }
      return jsonResponse({
        choices: [{ message: { content: JSON.stringify({ components: ["Header"] }) } }],
        usage: { prompt_tokens: 15, completion_tokens: 6, total_tokens: 21 },
      });
    };

    const out = await callLLM(
      {
        stage: "plan",
        system: "Plan",
        prompt: "Make plan",
        schema: {
          type: "object",
          properties: { components: { type: "array", items: { type: "string" } } },
          required: ["components"],
        },
        userId: "u1",
        jobId: "j3",
      },
      { store, keyring: secret, fetchFn }
    );

    expect(attempt).toBe(2);
    expect(prompts[1]).toContain("failed schema validation");
    expect(JSON.parse(out.text)).toEqual({ components: ["Header"] });
    expect(out.tokens.totalTokens).toBe(35);
  });

  it("throws NoAvailableProviderError with exact user-facing copy when all candidates fail or maintenance is enabled", async () => {
    const store = new LocalAppStore();
    const secret = makeSecret();

    await expect(
      callLLM(
        {
          stage: "build",
          system: "sys",
          prompt: "hello",
          userId: "u1",
          jobId: "j4",
        },
        { store, keyring: secret }
      )
    ).rejects.toThrowError(new NoAvailableProviderError("High demand right now, please try again later"));

    store.updateConfig({ maintenance: true });
    await expect(
      callLLM(
        {
          stage: "build",
          system: "sys",
          prompt: "hello",
          userId: "u1",
          jobId: "j5",
        },
        { store, keyring: secret }
      )
    ).rejects.toThrowError("High demand right now, please try again later");
  });
});
