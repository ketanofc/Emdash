import type { AttachedFile } from "../../types.ts";

export type ProviderProtocol = "gemini" | "openai";
export type RouteStage = "brief" | "plan" | "build" | "repair";
export type LlmCallStatus = "ok" | "error" | "rate_limited" | "skipped";

export interface ProviderRecord {
  id: string;
  name: string;
  slug: string;
  protocol: ProviderProtocol;
  base_url: string;
  api_key_enc: Uint8Array | string;
  key_last4: string;
  key_version: number;
  enabled: boolean;
  priority: number;
  rpm_limit: number | null;
  rpd_limit: number | null;
  daily_token_limit: number | null;
  blocked_regions: string[];
  supports_json_schema: boolean;
  last_test_at: string | null;
  last_test_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProviderModelRecord {
  id: string;
  provider_id: string;
  model_id: string;
  label: string;
  enabled: boolean;
  input_cost_per_mtok: number;
  output_cost_per_mtok: number;
}

export interface RouteCandidate {
  provider_id: string;
  model_id: string;
}

export interface RouteRecord {
  stage: RouteStage;
  chain: RouteCandidate[];
  temperature: number;
  max_output_tokens: number;
  updated_at?: string;
}

export interface ProviderHealthRecord {
  provider_id: string;
  cooldown_until: string | null;
  consecutive_failures: number;
  last_error: string | null;
  key_invalid?: boolean;
  updated_at: string;
}

export interface LlmCallInsert {
  user_id: string | null;
  job_id: string | null;
  stage: RouteStage;
  provider_id: string | null;
  model_id: string;
  status: LlmCallStatus;
  http_status: number | null;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  error_code: string | null;
}

export interface LlmCallRecord extends LlmCallInsert {
  id: string;
  created_at: string;
}

export interface ProviderWindowUsage {
  rpm_count: number;
  rpd_count: number;
  daily_tokens: number;
}

export interface AppConfigRecord {
  id: number;
  daily_grant: number;
  costs: {
    build: number;
    repair: number;
  };
  reset_timezone: string;
  global_daily_call_limit: number;
  maintenance: boolean;
  signups_enabled: boolean;
  high_demand_threshold: number;
  updated_at: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface CallLLMInput {
  stage: RouteStage;
  system: string;
  prompt: string;
  schema?: Record<string, unknown>;
  attachments?: AttachedFile[];
  userId: string | null;
  jobId: string | null;
  country?: string | null;
  signal?: AbortSignal;
}

export interface CallLLMOutput {
  text: string;
  provider: string;
  providerId: string;
  model: string;
  tokens: TokenUsage;
}

export interface LlmRouterStore {
  getRoute(stage: RouteStage): Promise<RouteRecord | null>;
  getProvider(providerId: string): Promise<ProviderRecord | null>;
  getProviderModel(
    providerId: string,
    modelId: string
  ): Promise<ProviderModelRecord | null>;
  getProviderHealth(providerId: string): Promise<ProviderHealthRecord | null>;
  upsertProviderHealth(health: ProviderHealthRecord): Promise<void>;
  getProviderWindowUsage(providerId: string): Promise<ProviderWindowUsage>;
  getGlobalDailyCallCount(): Promise<number>;
  getConfig(): Promise<AppConfigRecord>;
  insertLlmCall(call: LlmCallInsert): Promise<void>;
}

export class NoAvailableProviderError extends Error {
  readonly code = "HIGH_DEMAND";
  readonly status = 503;

  constructor(
    message = "High demand right now, please try again later"
  ) {
    super(message);
    this.name = "NoAvailableProviderError";
  }
}

export class AdapterHttpError extends Error {
  readonly status: number;
  readonly errorCode: string;

  constructor(status: number, errorCode: string, message: string) {
    super(message);
    this.name = "AdapterHttpError";
    this.status = status;
    this.errorCode = errorCode;
  }
}
