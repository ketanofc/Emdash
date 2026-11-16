import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl =
  typeof import.meta !== "undefined" && import.meta.env
    ? (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
    : undefined;
const supabaseAnonKey =
  typeof import.meta !== "undefined" && import.meta.env
    ? (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()
    : undefined;

let cachedClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function getSupabaseUrl(): string {
  return (supabaseUrl || "").replace(/\/+$/, "");
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl, supabaseAnonKey);
  }
  return cachedClient;
}

const LOCAL_TOKEN_KEY = "emdash_session_token";

export function getLocalSessionToken(): string | null {
  try {
    return localStorage.getItem(LOCAL_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setLocalSessionToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(LOCAL_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(LOCAL_TOKEN_KEY);
    }
  } catch {
    // ignore
  }
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const client = getSupabaseClient();
  if (client) {
    const { data } = await client.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      return {
        Authorization: `Bearer ${token}`,
        ...(supabaseAnonKey ? { apikey: supabaseAnonKey } : {}),
      };
    }
  }
  const localToken = getLocalSessionToken();
  if (localToken) {
    return { Authorization: `Bearer ${localToken}` };
  }
  return {};
}
