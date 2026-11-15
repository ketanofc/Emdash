export type ThemeMode = "light" | "dark" | "system";
export type WorkspaceTab = "preview" | "code";
export type DeviceViewport = "desktop" | "tablet" | "mobile";

export type PipelineMode = "static" | "react-ts";
export type PipelineStage = "brief" | "plan" | "build" | "check" | "repair";

export interface DesignBrief {
  appName: string;
  appType: string;
  audience: string;
  tone: string;
  layout: string;
  notes: string;
  mode: PipelineMode;
  dark: boolean;
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    muted: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
  sections: string[];
  features: string[];
}

export interface PlanFileSpec {
  path: string;
  purpose: string;
}

export interface BuildPlan {
  files: PlanFileSpec[];
  components: string[];
  state: string[];
  interactions: string[];
}

export type GeneratedFiles = Record<string, string>;

export interface AppVersion {
  version: number;
  title: string;
  slug: string;
  prompt: string;
  brief: DesignBrief;
  plan: BuildPlan;
  files: GeneratedFiles;
  createdAt: string;
}

export interface GeminiModelOption {
  id: string;
  displayName: string;
  description?: string;
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
  stage?: PipelineStage;
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
