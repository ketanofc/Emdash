import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { callLLM, NoAvailableProviderError, type RouteStage } from "./llm.ts";

export type PipelineStage = "brief" | "plan" | "build" | "check" | "repair";

export const BRIEF_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    appName: { type: "string" },
    appType: { type: "string" },
    audience: { type: "string" },
    tone: { type: "string" },
    layout: { type: "string" },
    notes: { type: "string" },
    mode: { type: "string", enum: ["static", "react-ts"] },
    dark: { type: "boolean" },
    palette: {
      type: "object",
      properties: {
        primary: { type: "string" },
        secondary: { type: "string" },
        accent: { type: "string" },
        background: { type: "string" },
        surface: { type: "string" },
        text: { type: "string" },
        muted: { type: "string" },
      },
      required: ["primary", "secondary", "accent", "background", "surface", "text", "muted"],
    },
    fonts: {
      type: "object",
      properties: {
        heading: { type: "string" },
        body: { type: "string" },
      },
      required: ["heading", "body"],
    },
    sections: { type: "array", items: { type: "string" } },
    features: { type: "array", items: { type: "string" } },
  },
  required: [
    "appName",
    "appType",
    "audience",
    "tone",
    "layout",
    "notes",
    "mode",
    "dark",
    "palette",
    "fonts",
    "sections",
    "features",
  ],
};

export const PLAN_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    files: {
      type: "array",
      items: {
        type: "object",
        properties: {
          path: { type: "string" },
          purpose: { type: "string" },
        },
        required: ["path", "purpose"],
      },
    },
    components: { type: "array", items: { type: "string" } },
    state: { type: "array", items: { type: "string" } },
    interactions: { type: "array", items: { type: "string" } },
  },
  required: ["files", "components", "state", "interactions"],
};

const BRIEF_SYSTEM_PROMPT =
  "You are the design lead of a web app builder. Turn the user's request into a design brief. Obey every explicit instruction (colors, fonts, layout, tone, brand). Colors must be 6-digit hex. If something is unspecified, choose tasteful professional defaults. Never ask questions. Text/background contrast must be at least 4.5:1. mode = 'react-ts' only if the user asks for React/TypeScript/Tailwind or the app needs rich state (dashboards, multi-view apps, complex forms); otherwise 'static'.";

const PLAN_SYSTEM_PROMPT =
  "You are a software architect for a web app builder. Produce an implementation plan listing the files to create, components, state variables, and user interactions. Output valid JSON matching the schema only. Do not include code.";

const BUILD_SYSTEM_PROMPT = `You are a senior frontend engineer. Build the application according to the design brief and implementation plan.

Strict output format rules:
- Output a concise one-line summary first, then output every file in full wrapped in exact tags:
<file path="index.html">
...complete contents...
</file>
and nothing else after the files.
- Never output partial files, ellipses ("..."), placeholder comments ("// ..."), TODO comments, or lorem ipsum; write realistic, domain-authentic copy everywhere.
- Colors MUST ONLY be referenced via CSS variables: var(--primary), var(--secondary), var(--accent), var(--bg), var(--surface), var(--text), var(--muted). Do NOT write a :root block and do NOT write hard-coded hex colors in CSS.
- For static mode: link style.css (<link rel="stylesheet" href="style.css">) and app.js (<script src="app.js"></script>).
- For react-ts mode: write React 18 + strict TypeScript + Tailwind utility classes mapped to CSS variables.`;

export interface DesignBrief {
  appName: string;
  appType: string;
  audience: string;
  tone: string;
  layout: string;
  notes: string;
  mode: "static" | "react-ts";
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

export type GeneratedFiles = Record<string, string>;

function normalizeHex(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const raw = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(raw)) return raw;
  return fallback;
}

export function normalizeBrief(raw: DesignBrief): DesignBrief {
  const dark = Boolean(raw.dark);
  return {
    ...raw,
    mode: raw.mode === "react-ts" ? "react-ts" : "static",
    dark,
    palette: {
      primary: normalizeHex(raw.palette?.primary, "#ff5401"),
      secondary: normalizeHex(raw.palette?.secondary, dark ? "#27272a" : "#e4e4e7"),
      accent: normalizeHex(raw.palette?.accent, "#ff5401"),
      background: normalizeHex(raw.palette?.background, dark ? "#121212" : "#fafafa"),
      surface: normalizeHex(raw.palette?.surface, dark ? "#18181b" : "#ffffff"),
      text: normalizeHex(raw.palette?.text, dark ? "#fafafa" : "#0a0a0a"),
      muted: normalizeHex(raw.palette?.muted, dark ? "#a1a1aa" : "#52525b"),
    },
    fonts: {
      heading: raw.fonts?.heading?.trim() || "system-ui, sans-serif",
      body: raw.fonts?.body?.trim() || "system-ui, sans-serif",
    },
    sections: Array.isArray(raw.sections) ? raw.sections : [],
    features: Array.isArray(raw.features) ? raw.features : [],
  };
}

function stripRootBlocks(css: string): string {
  return css.replace(/:root\s*\{[\s\S]*?\}\s*/g, "").trimStart();
}

export function injectTokens(files: GeneratedFiles, brief: DesignBrief): GeneratedFiles {
  const targetPath = brief.mode === "static" ? "style.css" : "src/index.css";
  const cleanedCss = stripRootBlocks(files[targetPath] ?? "");
  const tokens = `:root {\n  --primary: ${brief.palette.primary};\n  --secondary: ${brief.palette.secondary};\n  --accent: ${brief.palette.accent};\n  --bg: ${brief.palette.background};\n  --surface: ${brief.palette.surface};\n  --text: ${brief.palette.text};\n  --muted: ${brief.palette.muted};\n  --font-heading: "${brief.fonts.heading}", system-ui, sans-serif;\n  --font-body: "${brief.fonts.body}", system-ui, sans-serif;\n}`;
  return {
    ...files,
    [targetPath]: cleanedCss ? `${tokens}\n\n${cleanedCss}` : `${tokens}\n`,
  };
}

export function parseFiles(reply: string): { summary: string; files: GeneratedFiles } {
  const files: GeneratedFiles = {};
  const regex = /<file path="([^"]+)">\n?([\s\S]*?)<\/file>/g;
  let match: RegExpExecArray | null;
  let firstIndex = -1;
  while ((match = regex.exec(reply)) !== null) {
    if (firstIndex === -1) firstIndex = match.index;
    const rawPath = match[1].trim().replace(/^\/+/, "");
    const content = match[2].trim();
    if (rawPath) files[rawPath] = content;
  }
  const rawSummary = firstIndex >= 0 ? reply.slice(0, firstIndex).trim() : reply.trim();
  const summary =
    rawSummary
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith("```")) || "Built your application.";
  return { summary, files };
}

export function validateFiles(files: GeneratedFiles, brief: DesignBrief): string[] {
  const errors: string[] = [];
  const required =
    brief.mode === "static"
      ? ["index.html", "style.css", "app.js"]
      : [
          "index.html",
          "package.json",
          "tsconfig.json",
          "vite.config.ts",
          "tailwind.config.ts",
          "postcss.config.js",
          "src/main.tsx",
          "src/App.tsx",
          "src/index.css",
          "src/types.ts",
        ];
  for (const p of required) {
    if (!files[p]?.trim()) errors.push(`Missing or empty required file: ${p}`);
  }
  return errors;
}

export async function runEdgePipeline(params: {
  supabaseAdmin: SupabaseClient;
  userId: string;
  jobId: string;
  country: string | null;
  prompt: string;
  brief?: DesignBrief;
  files?: GeneratedFiles;
  runtimeErrors?: string[];
  onStage?: (stage: PipelineStage) => void;
}) {
  const invoke = (stage: RouteStage, system: string, prompt: string, schema?: Record<string, unknown>) =>
    callLLM({
      supabaseAdmin: params.supabaseAdmin,
      stage,
      system,
      prompt,
      schema,
      userId: params.userId,
      jobId: params.jobId,
      country: params.country,
    });

  if (params.runtimeErrors?.length && params.brief && params.files) {
    const brief = normalizeBrief(params.brief);
    let files = injectTokens({ ...params.files }, brief);
    params.onStage?.("check");
    const allErrors = [...validateFiles(files, brief), ...params.runtimeErrors];
    let summary = "Fixed runtime issues in your application.";
    if (allErrors.length > 0) {
      params.onStage?.("repair");
      const snapshot = Object.entries(files)
        .map(([p, c]) => `<file path="${p}">\n${c}\n</file>`)
        .join("\n\n");
      const rep = await invoke(
        "repair",
        BUILD_SYSTEM_PROMPT,
        `Fix these errors:\n${allErrors.join("\n")}\n\nCurrent files:\n${snapshot}`
      );
      const parsed = parseFiles(rep.text);
      files = injectTokens({ ...files, ...parsed.files }, brief);
      if (parsed.summary) summary = parsed.summary;
    }
    return {
      brief,
      plan: { files: [], components: [], state: [], interactions: [] },
      files,
      summary,
    };
  }

  params.onStage?.("brief");
  const isEditing = Boolean(params.brief && params.files);
  const briefPrompt = isEditing
    ? `Current design brief:\n${JSON.stringify(params.brief)}\n\nChange request:\n${params.prompt}`
    : `User request:\n${params.prompt}`;
  const briefCall = await invoke("brief", BRIEF_SYSTEM_PROMPT, briefPrompt, BRIEF_SCHEMA);
  const brief = normalizeBrief(JSON.parse(briefCall.text) as DesignBrief);

  params.onStage?.("plan");
  const planPrompt = isEditing
    ? `Design brief:\n${JSON.stringify(brief)}\nExisting files: ${Object.keys(params.files ?? {}).join(", ")}\nChange request: ${params.prompt}`
    : `Design brief:\n${JSON.stringify(brief)}\nUser request: ${params.prompt}`;
  const planCall = await invoke("plan", PLAN_SYSTEM_PROMPT, planPrompt, PLAN_SCHEMA);
  const plan = JSON.parse(planCall.text);

  params.onStage?.("build");
  const buildPrompt = isEditing && params.files
    ? `Design brief:\n${JSON.stringify(brief)}\nPlan:\n${JSON.stringify(plan)}\nExisting:\n${Object.entries(params.files).map(([p, c]) => `<file path="${p}">\n${c}\n</file>`).join("\n\n")}\nRequested changes:\n${params.prompt}`
    : `Design brief:\n${JSON.stringify(brief)}\nPlan:\n${JSON.stringify(plan)}\nOriginal user request:\n${params.prompt}`;
  const buildCall = await invoke("build", BUILD_SYSTEM_PROMPT, buildPrompt);
  const parsedBuild = parseFiles(buildCall.text);
  if (Object.keys(parsedBuild.files).length === 0) {
    throw new NoAvailableProviderError("High demand right now, please try again later");
  }
  let files = injectTokens(
    isEditing ? { ...params.files, ...parsedBuild.files } : parsedBuild.files,
    brief
  );
  let summary = parsedBuild.summary;

  params.onStage?.("check");
  const errs = validateFiles(files, brief);
  if (errs.length > 0) {
    params.onStage?.("repair");
    const snapshot = Object.entries(files)
      .map(([p, c]) => `<file path="${p}">\n${c}\n</file>`)
      .join("\n\n");
    const rep = await invoke(
      "repair",
      BUILD_SYSTEM_PROMPT,
      `Fix these errors:\n${errs.join("\n")}\n\nCurrent files:\n${snapshot}`
    );
    const parsedRep = parseFiles(rep.text);
    files = injectTokens({ ...files, ...parsedRep.files }, brief);
    if (parsedRep.summary) summary = parsedRep.summary;
  }

  return { brief, plan, files, summary };
}
