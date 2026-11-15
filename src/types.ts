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

export interface AttachedFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: "image" | "inline" | "text" | "binary";
  /** Text content when kind === "text" */
  content?: string;
  /** Raw base64 (without data: prefix) when kind === "image" or "inline" */
  base64Data?: string;
  /** Data URL for rendering image thumbnails in the UI */
  previewUrl?: string;
}

export interface ChatAttachmentMeta {
  name: string;
  mimeType: string;
  size: number;
  kind: AttachedFile["kind"];
  previewUrl?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "thinking" | "done" | "error";
  elapsedSeconds?: number;
  version?: number;
  attachmentName?: string;
  attachments?: ChatAttachmentMeta[];
}

export interface UserSession {
  email: string;
  name: string;
  plan: "free" | "pro";
}
