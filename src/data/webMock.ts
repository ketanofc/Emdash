export const WEB_URL = "/web";
export const REPO_URL = "https://github.com/emdash-build/emdash"; // TODO: Choose license

export interface WebProject {
  id: string;
  name: string;
  branch: string;
  updatedAt: string;
}

export interface WebChatSession {
  id: string;
  title: string;
  timestamp: string;
  projectId: string;
  branch: string;
}

export interface WebFileItem {
  path: string;
  content: string;
  language: string;
}

export interface WebDiffLine {
  type: "ctx" | "add" | "del";
  oldLine?: number;
  newLine?: number;
  text: string;
}

export interface WebDiffFile {
  path: string;
  added: number;
  removed: number;
  hunks: WebDiffLine[];
}

export const WEB_MODELS = [
  "Gemini Flash",
  "Gemini Pro",
  "Claude Sonnet 4",
  "GPT-5 Mini",
] as const;

export const MOCK_PROJECTS: WebProject[] = [];

export const MOCK_CHATS: WebChatSession[] = [];

export const MOCK_FILES: WebFileItem[] = [];

export const MOCK_DIFFS: WebDiffFile[] = [];

export const MOCK_TERMINAL_LOGS: string[] = [];

export const STARTER_PROMPTS = [
  "Add a responsive pricing section with monthly and annual toggle",
  "Fix mobile drawer focus trap and keyboard Escape handling",
  "Extract shared header controls into a clean Toolbar component",
];
