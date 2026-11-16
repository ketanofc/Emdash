import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { redactSecrets } from "../lib/llm/crypto.ts";
import type {
  AppConfigRecord,
  LlmCallInsert,
  LlmCallRecord,
  LlmRouterStore,
  ProviderHealthRecord,
  ProviderModelRecord,
  ProviderRecord,
  ProviderWindowUsage,
  RouteRecord,
  RouteStage,
} from "../lib/llm/types.ts";

export interface ProfileRecord {
  user_id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  status: "active" | "suspended";
  country: string | null;
  last_seen_at: string;
  created_at: string;
  password_hash?: string | null;
  totp_secret?: string | null;
  totp_verified?: boolean;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(":");
  if (!salt || !keyHex) return false;
  try {
    const expected = Buffer.from(keyHex, "hex");
    const derived = crypto.scryptSync(password, salt, expected.length);
    return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}

export interface WalletRecord {
  user_id: string;
  balance: number;
  last_grant_at: string | null;
  updated_at: string;
}

export interface CoinLedgerRecord {
  id: string;
  user_id: string;
  delta: number;
  balance_after: number;
  reason: string;
  job_id: string | null;
  actor_id: string | null;
  created_at: string;
}

export interface JobRecord {
  id: string;
  user_id: string;
  stage: string;
  status: "running" | "completed" | "failed" | "paused";
  coin_cost: number;
  refunded: boolean;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface AuditLogRecord {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string;
  before: unknown;
  after: unknown;
  ip: string | null;
  created_at: string;
}

export interface LlmDailyRecord {
  day: string;
  provider_id: string | null;
  model_id: string;
  calls: number;
  errors: number;
  rate_limited: number;
  input_tokens: number;
  output_tokens: number;
}

interface PersistedSnapshot {
  config: AppConfigRecord;
  profiles: ProfileRecord[];
  wallets: WalletRecord[];
  coin_ledger: CoinLedgerRecord[];
  jobs: JobRecord[];
  providers: Array<Omit<ProviderRecord, "api_key_enc"> & { api_key_enc: string }>;
  provider_models: ProviderModelRecord[];
  routes: RouteRecord[];
  provider_health: ProviderHealthRecord[];
  llm_calls: LlmCallRecord[];
  llm_daily: LlmDailyRecord[];
  audit_log: AuditLogRecord[];
}

export function getLocalDayKey(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }
}

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateTotpSecret(): string {
  const bytes = crypto.randomBytes(20);
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  return out;
}

function decodeBase32(secret: string): Buffer {
  const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx >= 0) bits += idx.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generateTotpCode(secret: string, timeMs = Date.now()): string {
  const key = decodeBase32(secret);
  const counter = Math.floor(timeMs / 1000 / 30);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", key).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

export function verifyTotpCode(secret: string, code: string, timeMs = Date.now()): boolean {
  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) return false;
  for (const stepOffset of [-1, 0, 1]) {
    if (generateTotpCode(secret, timeMs + stepOffset * 30_000) === trimmed) {
      return true;
    }
  }
  return false;
}

export class LocalAppStore implements LlmRouterStore {
  private readonly persistPath: string | null;
  private config: AppConfigRecord;
  private profiles = new Map<string, ProfileRecord>();
  private wallets = new Map<string, WalletRecord>();
  private coinLedger: CoinLedgerRecord[] = [];
  private jobs = new Map<string, JobRecord>();
  private providers = new Map<string, ProviderRecord>();
  private providerModels = new Map<string, ProviderModelRecord>();
  private routes = new Map<RouteStage, RouteRecord>();
  private providerHealth = new Map<string, ProviderHealthRecord>();
  private llmCalls: LlmCallRecord[] = [];
  private llmDaily: LlmDailyRecord[] = [];
  private auditLog: AuditLogRecord[] = [];
  private nowFn: () => number;

  constructor(options?: { persistPath?: string | null; nowMs?: () => number }) {
    this.persistPath = options?.persistPath ?? null;
    this.nowFn = options?.nowMs ?? (() => Date.now());
    this.config = {
      id: 1,
      daily_grant: 100,
      costs: { build: 10, repair: 0 },
      reset_timezone: "UTC",
      global_daily_call_limit: 5000,
      maintenance: false,
      signups_enabled: true,
      high_demand_threshold: 0.8,
      updated_at: new Date(this.nowFn()).toISOString(),
    };

    const defaultRoutes: RouteRecord[] = [
      { stage: "brief", chain: [], temperature: 0.4, max_output_tokens: 2048 },
      { stage: "plan", chain: [], temperature: 0.3, max_output_tokens: 4096 },
      { stage: "build", chain: [], temperature: 0.5, max_output_tokens: 16384 },
      { stage: "repair", chain: [], temperature: 0.3, max_output_tokens: 8192 },
    ];
    for (const r of defaultRoutes) {
      this.routes.set(r.stage, r);
    }

    if (this.persistPath) {
      this.loadFromDisk();
    }
  }

  private loadFromDisk() {
    if (!this.persistPath || !fs.existsSync(this.persistPath)) return;
    try {
      const raw = JSON.parse(fs.readFileSync(this.persistPath, "utf8")) as PersistedSnapshot;
      if (raw.config) this.config = raw.config;
      if (Array.isArray(raw.profiles)) {
        this.profiles = new Map(raw.profiles.map((p) => [p.user_id, p]));
      }
      if (Array.isArray(raw.wallets)) {
        this.wallets = new Map(raw.wallets.map((w) => [w.user_id, w]));
      }
      if (Array.isArray(raw.coin_ledger)) this.coinLedger = raw.coin_ledger;
      if (Array.isArray(raw.jobs)) {
        this.jobs = new Map(raw.jobs.map((j) => [j.id, j]));
      }
      if (Array.isArray(raw.providers)) {
        this.providers = new Map(raw.providers.map((p) => [p.id, p]));
      }
      if (Array.isArray(raw.provider_models)) {
        this.providerModels = new Map(
          raw.provider_models.map((m) => [`${m.provider_id}::${m.model_id}`, m])
        );
      }
      if (Array.isArray(raw.routes)) {
        for (const r of raw.routes) {
          this.routes.set(r.stage, r);
        }
      }
      if (Array.isArray(raw.provider_health)) {
        this.providerHealth = new Map(raw.provider_health.map((h) => [h.provider_id, h]));
      }
      if (Array.isArray(raw.llm_calls)) this.llmCalls = raw.llm_calls;
      if (Array.isArray(raw.llm_daily)) this.llmDaily = raw.llm_daily;
      if (Array.isArray(raw.audit_log)) this.auditLog = raw.audit_log;
    } catch {
      // ignore corrupted snapshot
    }
  }

  private persistToDisk() {
    if (!this.persistPath) return;
    const dir = path.dirname(this.persistPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const snapshot: PersistedSnapshot = {
      config: this.config,
      profiles: Array.from(this.profiles.values()),
      wallets: Array.from(this.wallets.values()),
      coin_ledger: this.coinLedger,
      jobs: Array.from(this.jobs.values()),
      providers: Array.from(this.providers.values()).map((p) => ({
        ...p,
        api_key_enc: typeof p.api_key_enc === "string" ? p.api_key_enc : Buffer.from(p.api_key_enc).toString("base64"),
      })),
      provider_models: Array.from(this.providerModels.values()),
      routes: Array.from(this.routes.values()),
      provider_health: Array.from(this.providerHealth.values()),
      llm_calls: this.llmCalls,
      llm_daily: this.llmDaily,
      audit_log: this.auditLog,
    };
    fs.writeFileSync(this.persistPath, JSON.stringify(snapshot, null, 2), "utf8");
  }

  // ---- Profiles & Auth ----
  getProfileByEmail(email: string): ProfileRecord | null {
    const emailNorm = email.trim().toLowerCase();
    for (const p of this.profiles.values()) {
      if (p.email.toLowerCase() === emailNorm) {
        return { ...p };
      }
    }
    return null;
  }

  ensureProfile(input: {
    userId?: string;
    email: string;
    name?: string;
    country?: string | null;
    passwordHash?: string | null;
  }): { created: boolean; profile: ProfileRecord } {
    const emailNorm = input.email.trim().toLowerCase();
    for (const p of this.profiles.values()) {
      if (p.email.toLowerCase() === emailNorm || (input.userId && p.user_id === input.userId)) {
        p.last_seen_at = new Date(this.nowFn()).toISOString();
        if (input.country) p.country = input.country;
        if (input.passwordHash && !p.password_hash) p.password_hash = input.passwordHash;
        this.persistToDisk();
        return { created: false, profile: { ...p } };
      }
    }

    if (!this.config.signups_enabled) {
      throw new Error("SIGNUPS_DISABLED");
    }

    const nowIso = new Date(this.nowFn()).toISOString();
    const userId = input.userId || crypto.randomUUID();
    const profile: ProfileRecord = {
      user_id: userId,
      email: emailNorm,
      name: (input.name || emailNorm.split("@")[0] || "Builder").trim(),
      role: "user", // NEVER auto-promote
      status: "active",
      country: input.country ?? null,
      last_seen_at: nowIso,
      created_at: nowIso,
      password_hash: input.passwordHash ?? null,
      totp_secret: null,
      totp_verified: false,
    };
    this.profiles.set(userId, profile);

    const welcomeGrant = this.config.daily_grant;
    this.wallets.set(userId, {
      user_id: userId,
      balance: welcomeGrant,
      last_grant_at: nowIso,
      updated_at: nowIso,
    });
    this.coinLedger.unshift({
      id: crypto.randomUUID(),
      user_id: userId,
      delta: welcomeGrant,
      balance_after: welcomeGrant,
      reason: "welcome_grant",
      job_id: null,
      actor_id: null,
      created_at: nowIso,
    });
    this.persistToDisk();
    return { created: true, profile: { ...profile } };
  }

  getProfile(userId: string): ProfileRecord | null {
    const p = this.profiles.get(userId);
    return p ? { ...p } : null;
  }

  setUserRole(userId: string, role: "user" | "admin"): ProfileRecord | null {
    const p = this.profiles.get(userId);
    if (!p) return null;
    p.role = role;
    this.persistToDisk();
    return { ...p };
  }

  setUserStatus(userId: string, status: "active" | "suspended"): ProfileRecord | null {
    const p = this.profiles.get(userId);
    if (!p) return null;
    p.status = status;
    this.persistToDisk();
    return { ...p };
  }

  setUserTotp(userId: string, secret: string, verified: boolean): ProfileRecord | null {
    const p = this.profiles.get(userId);
    if (!p) return null;
    p.totp_secret = secret;
    p.totp_verified = verified;
    this.persistToDisk();
    return { ...p };
  }

  listProfiles(params?: { q?: string; status?: string; page?: number; pageSize?: number }) {
    const q = (params?.q || "").trim().toLowerCase();
    const status = params?.status || "";
    const page = Math.max(1, params?.page ?? 1);
    const pageSize = params?.pageSize ?? 25;

    let list = Array.from(this.profiles.values());
    if (status === "active" || status === "suspended") {
      list = list.filter((p) => p.status === status);
    }
    if (q) {
      list = list.filter(
        (p) => p.email.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    const total = list.length;
    const paged = list.slice((page - 1) * pageSize, page * pageSize);
    return { total, page, items: paged.map((p) => ({ ...p })) };
  }

  // ---- Wallets, Coins & Jobs ----
  ensureDailyGrant(userId: string): WalletRecord {
    const now = new Date(this.nowFn());
    const nowIso = now.toISOString();
    let wallet = this.wallets.get(userId);
    if (!wallet) {
      wallet = {
        user_id: userId,
        balance: this.config.daily_grant,
        last_grant_at: nowIso,
        updated_at: nowIso,
      };
      this.wallets.set(userId, wallet);
      this.coinLedger.unshift({
        id: crypto.randomUUID(),
        user_id: userId,
        delta: this.config.daily_grant,
        balance_after: this.config.daily_grant,
        reason: "daily_grant",
        job_id: null,
        actor_id: null,
        created_at: nowIso,
      });
      this.persistToDisk();
      return { ...wallet };
    }

    const profile = this.profiles.get(userId);
    const todayKey = getLocalDayKey(now, this.config.reset_timezone);
    const lastKey = wallet.last_grant_at
      ? getLocalDayKey(new Date(wallet.last_grant_at), this.config.reset_timezone)
      : null;

    if (
      (!profile || profile.status === "active") &&
      this.config.daily_grant > 0 &&
      lastKey !== todayKey
    ) {
      wallet.balance += this.config.daily_grant;
      wallet.last_grant_at = nowIso;
      wallet.updated_at = nowIso;
      this.coinLedger.unshift({
        id: crypto.randomUUID(),
        user_id: userId,
        delta: this.config.daily_grant,
        balance_after: wallet.balance,
        reason: "daily_grant",
        job_id: null,
        actor_id: null,
        created_at: nowIso,
      });
      this.persistToDisk();
    }

    return { ...wallet };
  }

  getWallet(userId: string): WalletRecord | null {
    const w = this.wallets.get(userId);
    return w ? { ...w } : null;
  }

  getUserLedger(userId: string, limit = 30): CoinLedgerRecord[] {
    return this.coinLedger.filter((l) => l.user_id === userId).slice(0, limit);
  }

  getUserJobs(userId: string, limit = 20): JobRecord[] {
    return Array.from(this.jobs.values())
      .filter((j) => j.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }

  createJob(userId: string, stage: string, coinCost: number): JobRecord {
    const job: JobRecord = {
      id: crypto.randomUUID(),
      user_id: userId,
      stage,
      status: "running",
      coin_cost: coinCost,
      refunded: false,
      error_message: null,
      created_at: new Date(this.nowFn()).toISOString(),
      completed_at: null,
    };
    this.jobs.set(job.id, job);
    this.persistToDisk();
    return { ...job };
  }

  completeJob(jobId: string, status: "completed" | "failed" | "paused", errorMessage?: string) {
    const j = this.jobs.get(jobId);
    if (!j) return;
    j.status = status;
    j.error_message = errorMessage ?? null;
    j.completed_at = new Date(this.nowFn()).toISOString();
    this.persistToDisk();
  }

  spendCoins(userId: string, amount: number, reason: string, jobId: string | null): number {
    if (amount < 0) throw new Error("Amount must be non-negative");
    const wallet = this.ensureDailyGrant(userId);
    const actual = this.wallets.get(userId)!;
    if (wallet.balance < amount) {
      throw new Error("INSUFFICIENT_COINS");
    }
    if (amount === 0) return actual.balance;
    actual.balance -= amount;
    actual.updated_at = new Date(this.nowFn()).toISOString();
    this.coinLedger.unshift({
      id: crypto.randomUUID(),
      user_id: userId,
      delta: -amount,
      balance_after: actual.balance,
      reason,
      job_id: jobId,
      actor_id: null,
      created_at: actual.updated_at,
    });
    this.persistToDisk();
    return actual.balance;
  }

  refundCoins(userId: string, amount: number, reason: string, jobId: string | null): number {
    const wallet = this.wallets.get(userId);
    if (amount <= 0) return wallet?.balance ?? 0;

    if (jobId) {
      const job = this.jobs.get(jobId);
      if (job && job.refunded) {
        return wallet?.balance ?? 0;
      }
      if (job) {
        job.refunded = true;
        job.status = "failed";
        job.completed_at = new Date(this.nowFn()).toISOString();
      }
    }

    const nowIso = new Date(this.nowFn()).toISOString();
    const target =
      wallet ??
      (() => {
        const created: WalletRecord = {
          user_id: userId,
          balance: 0,
          last_grant_at: nowIso,
          updated_at: nowIso,
        };
        this.wallets.set(userId, created);
        return created;
      })();

    target.balance += amount;
    target.updated_at = nowIso;
    this.coinLedger.unshift({
      id: crypto.randomUUID(),
      user_id: userId,
      delta: amount,
      balance_after: target.balance,
      reason,
      job_id: jobId,
      actor_id: null,
      created_at: nowIso,
    });
    this.persistToDisk();
    return target.balance;
  }

  adjustCoins(userId: string, delta: number, reason: string, actorId: string | null): number {
    const nowIso = new Date(this.nowFn()).toISOString();
    let target = this.wallets.get(userId);
    if (!target) {
      target = { user_id: userId, balance: 0, last_grant_at: nowIso, updated_at: nowIso };
      this.wallets.set(userId, target);
    }
    target.balance = Math.max(0, target.balance + delta);
    target.updated_at = nowIso;
    this.coinLedger.unshift({
      id: crypto.randomUUID(),
      user_id: userId,
      delta,
      balance_after: target.balance,
      reason,
      job_id: null,
      actor_id: actorId,
      created_at: nowIso,
    });
    this.persistToDisk();
    return target.balance;
  }

  // ---- Config ----
  async getConfig(): Promise<AppConfigRecord> {
    return { ...this.config, costs: { ...this.config.costs } };
  }

  updateConfig(next: Partial<AppConfigRecord>): AppConfigRecord {
    this.config = {
      ...this.config,
      ...next,
      costs: next.costs ? { ...next.costs } : { ...this.config.costs },
      updated_at: new Date(this.nowFn()).toISOString(),
    };
    this.persistToDisk();
    return { ...this.config, costs: { ...this.config.costs } };
  }

  // ---- Providers & Models ----
  listProviders(): ProviderRecord[] {
    return Array.from(this.providers.values())
      .sort((a, b) => a.priority - b.priority)
      .map((p) => ({ ...p }));
  }

  async getProvider(providerId: string): Promise<ProviderRecord | null> {
    const p = this.providers.get(providerId);
    return p ? { ...p } : null;
  }

  createProvider(input: Omit<ProviderRecord, "id" | "created_at" | "updated_at">): ProviderRecord {
    for (const existing of this.providers.values()) {
      if (existing.slug === input.slug) {
        throw new Error(`Provider slug "${input.slug}" already exists.`);
      }
    }
    const nowIso = new Date(this.nowFn()).toISOString();
    const record: ProviderRecord = {
      ...input,
      id: crypto.randomUUID(),
      created_at: nowIso,
      updated_at: nowIso,
    };
    this.providers.set(record.id, record);
    this.persistToDisk();
    return { ...record };
  }

  updateProvider(providerId: string, patch: Partial<ProviderRecord>): ProviderRecord | null {
    const existing = this.providers.get(providerId);
    if (!existing) return null;
    const updated: ProviderRecord = {
      ...existing,
      ...patch,
      id: existing.id,
      created_at: existing.created_at,
      updated_at: new Date(this.nowFn()).toISOString(),
    };
    this.providers.set(providerId, updated);
    this.persistToDisk();
    return { ...updated };
  }

  deleteProvider(providerId: string): boolean {
    const existed = this.providers.delete(providerId);
    if (existed) {
      this.providerHealth.delete(providerId);
      for (const [key] of this.providerModels.entries()) {
        if (key.startsWith(`${providerId}::`)) {
          this.providerModels.delete(key);
        }
      }
      this.persistToDisk();
    }
    return existed;
  }

  listProviderModels(providerId: string): ProviderModelRecord[] {
    return Array.from(this.providerModels.values())
      .filter((m) => m.provider_id === providerId)
      .sort((a, b) => a.model_id.localeCompare(b.model_id))
      .map((m) => ({ ...m }));
  }

  async getProviderModel(providerId: string, modelId: string): Promise<ProviderModelRecord | null> {
    const m = this.providerModels.get(`${providerId}::${modelId}`);
    return m ? { ...m } : null;
  }

  upsertProviderModels(
    providerId: string,
    models: Array<{
      model_id: string;
      label?: string;
      enabled?: boolean;
      input_cost_per_mtok?: number;
      output_cost_per_mtok?: number;
    }>
  ): ProviderModelRecord[] {
    for (const item of models) {
      const key = `${providerId}::${item.model_id}`;
      const existing = this.providerModels.get(key);
      const record: ProviderModelRecord = {
        id: existing?.id ?? crypto.randomUUID(),
        provider_id: providerId,
        model_id: item.model_id,
        label: item.label?.trim() || existing?.label || item.model_id,
        enabled: item.enabled !== undefined ? item.enabled : (existing?.enabled ?? true),
        input_cost_per_mtok:
          item.input_cost_per_mtok !== undefined
            ? Number(item.input_cost_per_mtok)
            : (existing?.input_cost_per_mtok ?? 0),
        output_cost_per_mtok:
          item.output_cost_per_mtok !== undefined
            ? Number(item.output_cost_per_mtok)
            : (existing?.output_cost_per_mtok ?? 0),
      };
      this.providerModels.set(key, record);
    }
    this.persistToDisk();
    return this.listProviderModels(providerId);
  }

  // ---- Routes ----
  listRoutes(): RouteRecord[] {
    return Array.from(this.routes.values()).map((r) => ({ ...r, chain: [...r.chain] }));
  }

  async getRoute(stage: RouteStage): Promise<RouteRecord | null> {
    const r = this.routes.get(stage);
    return r ? { ...r, chain: [...r.chain] } : null;
  }

  upsertRoute(route: RouteRecord): RouteRecord {
    const record: RouteRecord = {
      ...route,
      chain: [...route.chain],
      updated_at: new Date(this.nowFn()).toISOString(),
    };
    this.routes.set(route.stage, record);
    this.persistToDisk();
    return { ...record };
  }

  // ---- Health & Telemetry ----
  async getProviderHealth(providerId: string): Promise<ProviderHealthRecord | null> {
    const h = this.providerHealth.get(providerId);
    return h ? { ...h } : null;
  }

  async upsertProviderHealth(health: ProviderHealthRecord): Promise<void> {
    this.providerHealth.set(health.provider_id, { ...health });
    this.persistToDisk();
  }

  async insertLlmCall(call: LlmCallInsert): Promise<void> {
    this.llmCalls.push({
      ...call,
      id: crypto.randomUUID(),
      created_at: new Date(this.nowFn()).toISOString(),
    });
    this.persistToDisk();
  }

  listLlmCalls(): LlmCallRecord[] {
    return [...this.llmCalls];
  }

  async getProviderWindowUsage(providerId: string): Promise<ProviderWindowUsage> {
    const now = this.nowFn();
    const minuteAgo = now - 60_000;
    const utcDayStart = new Date(now);
    utcDayStart.setUTCHours(0, 0, 0, 0);
    const dayStartMs = utcDayStart.getTime();

    let rpm_count = 0;
    let rpd_count = 0;
    let daily_tokens = 0;

    for (const c of this.llmCalls) {
      if (c.provider_id !== providerId) continue;
      const t = Date.parse(c.created_at);
      if (c.status !== "skipped") {
        if (t >= minuteAgo) rpm_count++;
        if (t >= dayStartMs) rpd_count++;
      }
      if (c.status === "ok" && t >= dayStartMs) {
        daily_tokens += c.total_tokens;
      }
    }
    return { rpm_count, rpd_count, daily_tokens };
  }

  async getGlobalDailyCallCount(): Promise<number> {
    const utcDayStart = new Date(this.nowFn());
    utcDayStart.setUTCHours(0, 0, 0, 0);
    const dayStartMs = utcDayStart.getTime();
    return this.llmCalls.filter(
      (c) => c.status !== "skipped" && Date.parse(c.created_at) >= dayStartMs
    ).length;
  }

  getUsageByDay(days: number) {
    const cutoff = this.nowFn() - Math.max(1, days) * 86_400_000;
    const map = new Map<
      string,
      { day: string; calls: number; errors: number; rate_limited: number; input_tokens: number; output_tokens: number; total_tokens: number }
    >();
    for (const c of this.llmCalls) {
      if (Date.parse(c.created_at) < cutoff) continue;
      const day = c.created_at.slice(0, 10);
      const row = map.get(day) ?? {
        day,
        calls: 0,
        errors: 0,
        rate_limited: 0,
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
      };
      if (c.status !== "skipped") row.calls += 1;
      if (c.status === "error") row.errors += 1;
      if (c.status === "rate_limited") row.rate_limited += 1;
      row.input_tokens += c.input_tokens;
      row.output_tokens += c.output_tokens;
      row.total_tokens += c.total_tokens;
      map.set(day, row);
    }
    return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
  }

  getUsageByProvider(days: number) {
    const cutoff = this.nowFn() - Math.max(1, days) * 86_400_000;
    const map = new Map<
      string,
      { provider_id: string; calls: number; errors: number; rate_limited: number; input_tokens: number; output_tokens: number; total_tokens: number }
    >();
    for (const c of this.llmCalls) {
      if (!c.provider_id || Date.parse(c.created_at) < cutoff) continue;
      const row = map.get(c.provider_id) ?? {
        provider_id: c.provider_id,
        calls: 0,
        errors: 0,
        rate_limited: 0,
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
      };
      if (c.status !== "skipped") row.calls += 1;
      if (c.status === "error") row.errors += 1;
      if (c.status === "rate_limited") row.rate_limited += 1;
      row.input_tokens += c.input_tokens;
      row.output_tokens += c.output_tokens;
      row.total_tokens += c.total_tokens;
      map.set(c.provider_id, row);
    }
    return Array.from(map.values());
  }

  getUsageByModel(days: number) {
    const cutoff = this.nowFn() - Math.max(1, days) * 86_400_000;
    const map = new Map<
      string,
      { provider_id: string | null; model_id: string; calls: number; errors: number; rate_limited: number; input_tokens: number; output_tokens: number; total_tokens: number }
    >();
    for (const c of this.llmCalls) {
      if (Date.parse(c.created_at) < cutoff) continue;
      const key = `${c.provider_id ?? "none"}::${c.model_id}`;
      const row = map.get(key) ?? {
        provider_id: c.provider_id,
        model_id: c.model_id,
        calls: 0,
        errors: 0,
        rate_limited: 0,
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
      };
      if (c.status !== "skipped") row.calls += 1;
      if (c.status === "error") row.errors += 1;
      if (c.status === "rate_limited") row.rate_limited += 1;
      row.input_tokens += c.input_tokens;
      row.output_tokens += c.output_tokens;
      row.total_tokens += c.total_tokens;
      map.set(key, row);
    }
    return Array.from(map.values());
  }

  getUsageByUser(days: number) {
    const cutoff = this.nowFn() - Math.max(1, days) * 86_400_000;
    const map = new Map<
      string,
      { user_id: string; calls: number; errors: number; rate_limited: number; input_tokens: number; output_tokens: number; total_tokens: number }
    >();
    for (const c of this.llmCalls) {
      if (!c.user_id || Date.parse(c.created_at) < cutoff) continue;
      const row = map.get(c.user_id) ?? {
        user_id: c.user_id,
        calls: 0,
        errors: 0,
        rate_limited: 0,
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
      };
      if (c.status !== "skipped") row.calls += 1;
      if (c.status === "error") row.errors += 1;
      if (c.status === "rate_limited") row.rate_limited += 1;
      row.input_tokens += c.input_tokens;
      row.output_tokens += c.output_tokens;
      row.total_tokens += c.total_tokens;
      map.set(c.user_id, row);
    }
    return Array.from(map.values());
  }

  getOverviewMetrics(days: number) {
    const utcDayStart = new Date(this.nowFn());
    utcDayStart.setUTCHours(0, 0, 0, 0);
    const dayStartMs = utcDayStart.getTime();

    const todaysCalls = this.llmCalls.filter(
      (c) => Date.parse(c.created_at) >= dayStartMs && c.status !== "skipped"
    );
    const callsToday = todaysCalls.length;
    const errorsToday = todaysCalls.filter((c) => c.status === "error").length;
    const rateLimitedToday = todaysCalls.filter((c) => c.status === "rate_limited").length;
    const tokensToday = todaysCalls.reduce((s, c) => s + c.total_tokens, 0);
    const activeUsers = new Set(todaysCalls.map((c) => c.user_id).filter(Boolean)).size;
    const coinsSpent = this.coinLedger
      .filter((l) => l.delta < 0 && Date.parse(l.created_at) >= dayStartMs)
      .reduce((s, l) => s + Math.abs(l.delta), 0);

    const todayUsageMap = new Map(this.getUsageByProvider(1).map((u) => [u.provider_id, u]));
    const threshold = this.config.high_demand_threshold;
    const alerts: Array<{ level: "error" | "warn"; providerId?: string; message: string }> = [];

    const perProvider = this.listProviders().map((p) => {
      const h = this.providerHealth.get(p.id) ?? null;
      const u = todayUsageMap.get(p.id) ?? { calls: 0, errors: 0, rate_limited: 0, total_tokens: 0 };
      const inCooldown = Boolean(h?.cooldown_until && Date.parse(h.cooldown_until) > this.nowFn());
      if (h?.key_invalid) {
        alerts.push({ level: "error", providerId: p.id, message: `${p.name}: API key invalid (401/403)` });
      } else if (inCooldown && h?.cooldown_until) {
        alerts.push({ level: "warn", providerId: p.id, message: `${p.name}: On cooldown until ${h.cooldown_until}` });
      }
      if (p.rpd_limit && u.calls >= p.rpd_limit * threshold) {
        alerts.push({ level: "warn", providerId: p.id, message: `${p.name}: ${Math.round((u.calls / p.rpd_limit) * 100)}% of daily calls` });
      }
      if (p.daily_token_limit && u.total_tokens >= p.daily_token_limit * threshold) {
        alerts.push({ level: "warn", providerId: p.id, message: `${p.name}: ${Math.round((u.total_tokens / p.daily_token_limit) * 100)}% of daily tokens` });
      }
      const { api_key_enc: _omit, ...safe } = p;
      return {
        ...safe,
        callsToday: u.calls,
        errorsToday: u.errors,
        rateLimitedToday: u.rate_limited,
        tokensToday: u.total_tokens,
        health: h,
      };
    });

    return {
      callsToday,
      tokensToday,
      errorRate: callsToday > 0 ? errorsToday / callsToday : 0,
      errorsToday,
      rateLimitedToday,
      activeUsers,
      coinsSpent,
      dailySeries: this.getUsageByDay(days),
      perProvider,
      alerts,
    };
  }

  // ---- Audit Log & Retention ----
  writeAuditLog(entry: {
    actor_id: string | null;
    action: string;
    target_type: string;
    target_id: string;
    before: unknown;
    after: unknown;
    ip: string | null;
  }): AuditLogRecord {
    const record: AuditLogRecord = {
      id: crypto.randomUUID(),
      actor_id: entry.actor_id,
      action: entry.action,
      target_type: entry.target_type,
      target_id: entry.target_id,
      before: entry.before === undefined ? null : redactSecrets(entry.before),
      after: entry.after === undefined ? null : redactSecrets(entry.after),
      ip: entry.ip,
      created_at: new Date(this.nowFn()).toISOString(),
    };
    this.auditLog.unshift(record);
    this.persistToDisk();
    return record;
  }

  listAuditLog(page = 1, pageSize = 30) {
    const safePage = Math.max(1, page);
    const total = this.auditLog.length;
    const entries = this.auditLog.slice((safePage - 1) * pageSize, safePage * pageSize);
    return { total, page: safePage, entries };
  }

  rollupAndPruneLlmCalls(retentionDays = 90): number {
    const cutoff = this.nowFn() - Math.max(1, retentionDays) * 86_400_000;
    const kept: LlmCallRecord[] = [];
    let pruned = 0;

    for (const c of this.llmCalls) {
      if (Date.parse(c.created_at) >= cutoff) {
        kept.push(c);
        continue;
      }
      pruned++;
      const day = c.created_at.slice(0, 10);
      let bucket = this.llmDaily.find(
        (d) => d.day === day && d.provider_id === c.provider_id && d.model_id === c.model_id
      );
      if (!bucket) {
        bucket = {
          day,
          provider_id: c.provider_id,
          model_id: c.model_id,
          calls: 0,
          errors: 0,
          rate_limited: 0,
          input_tokens: 0,
          output_tokens: 0,
        };
        this.llmDaily.push(bucket);
      }
      if (c.status !== "skipped") bucket.calls += 1;
      if (c.status === "error") bucket.errors += 1;
      if (c.status === "rate_limited") bucket.rate_limited += 1;
      bucket.input_tokens += c.input_tokens;
      bucket.output_tokens += c.output_tokens;
    }

    this.llmCalls = kept;
    this.persistToDisk();
    return pruned;
  }
}

export function resolveServerMasterSecret(dataDir = path.resolve(process.cwd(), ".data")): string {
  const envSecret = process.env.KEY_ENCRYPTION_SECRET?.trim();
  if (envSecret) return envSecret;

  const keyFile = path.join(dataDir, "local-master.key");
  if (fs.existsSync(keyFile)) {
    const saved = fs.readFileSync(keyFile, "utf8").trim();
    if (saved) return saved;
  }

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const generated = crypto.randomBytes(32).toString("base64");
  fs.writeFileSync(keyFile, generated, { mode: 0o600 });
  return generated;
}
