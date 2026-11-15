export type ThemeMode = "light" | "dark" | "system";
export type WorkspaceTab = "preview" | "code";
export type DeviceViewport = "desktop" | "tablet" | "mobile";

export interface AppVersion {
  version: number;
  title: string;
  slug: string;
  html: string;
  prompt: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "thinking" | "done" | "error";
  elapsedSeconds?: number;
  version?: number;
  attachmentName?: string;
}

export interface AttachedFile {
  name: string;
  content: string;
}

export interface UserSession {
  email: string;
  name: string;
  plan: "free" | "pro";
}
