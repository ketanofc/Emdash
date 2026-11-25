export interface PendingPromptRecord {
  prompt: string;
  source: "home" | "web";
  mode?: "build" | "plan";
  timestamp: number;
}

const PENDING_PROMPT_KEY = "emdash:pending_prompt";
const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

export function savePendingPrompt(record: PendingPromptRecord): void {
  try {
    window.localStorage.setItem(PENDING_PROMPT_KEY, JSON.stringify(record));
  } catch {
    // ignore storage failures
  }
}

export function loadPendingPrompt(): PendingPromptRecord | null {
  try {
    const raw = window.localStorage.getItem(PENDING_PROMPT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingPromptRecord>;
    if (
      typeof parsed.prompt !== "string" ||
      !parsed.prompt.trim() ||
      (parsed.source !== "home" && parsed.source !== "web")
    ) {
      return null;
    }
    if (typeof parsed.timestamp === "number" && Date.now() - parsed.timestamp > MAX_AGE_MS) {
      window.localStorage.removeItem(PENDING_PROMPT_KEY);
      return null;
    }
    return {
      prompt: parsed.prompt,
      source: parsed.source,
      mode: parsed.mode === "plan" ? "plan" : "build",
      timestamp: parsed.timestamp ?? Date.now(),
    };
  } catch {
    return null;
  }
}

export function clearPendingPrompt(): void {
  try {
    window.localStorage.removeItem(PENDING_PROMPT_KEY);
  } catch {
    // ignore
  }
}
