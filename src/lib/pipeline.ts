import {
  GeminiError,
  gemini,
  type GeminiRequestOptions,
} from "./gemini.ts";
import type {
  AttachedFile,
  BuildPlan,
  DesignBrief,
  GeneratedFiles,
  PipelineStage,
} from "../types.ts";

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
- Never end lines or files with three dots ("...").
- Colors MUST ONLY be referenced via CSS variables: var(--primary), var(--secondary), var(--accent), var(--bg), var(--surface), var(--text), var(--muted). The platform injects :root tokens automatically; do NOT write a :root block and do NOT write any hard-coded hex colors (#...) in CSS or <style> blocks.
- Fonts are provided via var(--font-heading) and var(--font-body). Use semantic HTML5, mobile-first responsive CSS, visible :focus-visible focus outlines, accessible <label> elements on inputs, alt text on images, at least 4.5:1 contrast, @media (prefers-reduced-motion: reduce), and proper empty/error states.
- No external <script src> or external images (only cdnjs.cloudflare.com scripts are allowed if needed). Use inline SVG or CSS gradients instead of external image URLs.
- For static mode: write clean vanilla ES2020 JavaScript and ensure index.html links style.css (<link rel="stylesheet" href="style.css">) and app.js (<script src="app.js"></script>).
- For react-ts mode: write React 18 + strict TypeScript (NEVER use ": any" or "as any") + Tailwind utility classes mapped to CSS variables (for example bg-[var(--bg)], text-[var(--text)], bg-[var(--primary)], border-[var(--muted)]). Include index.html, package.json, tsconfig.json, vite.config.ts, tailwind.config.ts, postcss.config.js, src/main.tsx, src/App.tsx, src/index.css, src/types.ts, and modular src/components/*.tsx files.
- When editing an existing project, return ONLY the changed or added files, each written in full.`;

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
      required: [
        "primary",
        "secondary",
        "accent",
        "background",
        "surface",
        "text",
        "muted",
      ],
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

export type GeminiGenerateFn = (options: GeminiRequestOptions) => Promise<string>;

export interface PipelineOptions {
  model: string;
  brief?: DesignBrief;
  files?: GeneratedFiles;
  runtimeErrors?: string[];
  attachments?: AttachedFile[];
  generateFn?: GeminiGenerateFn;
}

export interface PipelineResult {
  brief: DesignBrief;
  plan: BuildPlan;
  files: GeneratedFiles;
  summary: string;
}

function normalizeHexColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const raw = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(raw)) return raw;
  const short = raw.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  if (short) {
    return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  }
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = normalizeHexColor(hex, "#000000").slice(1);
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function normalizeBrief(brief: DesignBrief): DesignBrief {
  const isDark = Boolean(brief.dark);
  const bg = normalizeHexColor(
    brief.palette?.background,
    isDark ? "#121212" : "#fafafa"
  );
  let text = normalizeHexColor(
    brief.palette?.text,
    isDark ? "#fafafa" : "#0a0a0a"
  );

  if (contrastRatio(text, bg) < 4.5) {
    const darkCandidate = "#0a0a0a";
    const lightCandidate = "#fafafa";
    text =
      contrastRatio(darkCandidate, bg) >= contrastRatio(lightCandidate, bg)
        ? darkCandidate
        : lightCandidate;
  }

  return {
    ...brief,
    mode: brief.mode === "react-ts" ? "react-ts" : "static",
    dark: isDark,
    palette: {
      primary: normalizeHexColor(brief.palette?.primary, "#ff5401"),
      secondary: normalizeHexColor(
        brief.palette?.secondary,
        isDark ? "#27272a" : "#e4e4e7"
      ),
      accent: normalizeHexColor(brief.palette?.accent, "#ff5401"),
      background: bg,
      surface: normalizeHexColor(
        brief.palette?.surface,
        isDark ? "#18181b" : "#ffffff"
      ),
      text,
      muted: normalizeHexColor(
        brief.palette?.muted,
        isDark ? "#a1a1aa" : "#52525b"
      ),
    },
    fonts: {
      heading: brief.fonts?.heading?.trim() || "system-ui, -apple-system, sans-serif",
      body: brief.fonts?.body?.trim() || "system-ui, -apple-system, sans-serif",
    },
    sections: Array.isArray(brief.sections) ? brief.sections : [],
    features: Array.isArray(brief.features) ? brief.features : [],
  };
}

function formatFontStack(family: string, isHeading: boolean): string {
  const clean = family.replace(/["']/g, "").trim();
  const lower = clean.toLowerCase();
  const isSerif = lower.includes("serif") || lower.includes("georgia") || lower.includes("garamond") || lower.includes("playfair") || lower.includes("lora");
  const fallback = isSerif
    ? 'Georgia, "Times New Roman", serif'
    : 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  if (!clean || lower.includes("system-ui")) {
    return isHeading && isSerif ? fallback : clean || fallback;
  }
  return `"${clean}", ${fallback}`;
}

export function tokensCss(brief: DesignBrief): string {
  return `:root {
  --primary: ${brief.palette.primary};
  --secondary: ${brief.palette.secondary};
  --accent: ${brief.palette.accent};
  --bg: ${brief.palette.background};
  --surface: ${brief.palette.surface};
  --text: ${brief.palette.text};
  --muted: ${brief.palette.muted};
  --font-heading: ${formatFontStack(brief.fonts.heading, true)};
  --font-body: ${formatFontStack(brief.fonts.body, false)};
}`;
}

export function stripRootBlocks(css: string): string {
  let result = "";
  let i = 0;
  while (i < css.length) {
    const rest = css.slice(i);
    const match = rest.match(/^:root\s*\{/);
    if (match) {
      let depth = 1;
      let j = i + match[0].length;
      while (j < css.length && depth > 0) {
        if (css[j] === "{") depth++;
        else if (css[j] === "}") depth--;
        j++;
      }
      i = j;
      while (i < css.length && (css[i] === "\n" || css[i] === "\r")) {
        i++;
      }
    } else {
      result += css[i];
      i++;
    }
  }
  return result.trimStart();
}

export function injectTokens(
  files: GeneratedFiles,
  brief: DesignBrief
): GeneratedFiles {
  const targetPath = brief.mode === "static" ? "style.css" : "src/index.css";
  const existingCss = files[targetPath] ?? "";
  const cleanedCss = stripRootBlocks(existingCss);
  const block = tokensCss(brief);
  return {
    ...files,
    [targetPath]: cleanedCss ? `${block}\n\n${cleanedCss}` : `${block}\n`,
  };
}

export function parseFiles(reply: string): {
  summary: string;
  files: GeneratedFiles;
} {
  const files: GeneratedFiles = {};
  const regex = /<file path="([^"]+)">\n?([\s\S]*?)<\/file>/g;
  let match: RegExpExecArray | null;
  let firstIndex = -1;

  while ((match = regex.exec(reply)) !== null) {
    if (firstIndex === -1) {
      firstIndex = match.index;
    }
    const rawPath = match[1].trim().replace(/^\/+/, "");
    const content = match[2].trim();
    if (rawPath) {
      files[rawPath] = content;
    }
  }

  const rawSummary =
    firstIndex >= 0 ? reply.slice(0, firstIndex).trim() : reply.trim();
  const summaryLines = rawSummary
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("```"));
  const summary = summaryLines[0] || "Built your application.";

  return { summary, files };
}

const STATIC_REQUIRED_FILES = ["index.html", "style.css", "app.js"];
const REACT_TS_REQUIRED_FILES = [
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

function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function findHexColorsInCss(css: string): string[] {
  const withoutRoot = stripRootBlocks(stripCssComments(css));
  const matches: string[] = [];
  const regex = /(?:[:,\s(])(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8}))(?=\s*[;,)\r\n}])/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(withoutRoot)) !== null) {
    const prefixStart = Math.max(0, match.index - 4);
    const context = withoutRoot.slice(prefixStart, match.index + 1);
    if (!/url\(/i.test(context)) {
      matches.push(match[1]);
    }
  }
  return matches;
}

export function validateFiles(
  files: GeneratedFiles,
  brief: DesignBrief
): string[] {
  const errors: string[] = [];
  const required =
    brief.mode === "static" ? STATIC_REQUIRED_FILES : REACT_TS_REQUIRED_FILES;

  for (const path of required) {
    if (!files[path] || !files[path].trim()) {
      errors.push(`Missing or empty required file: ${path}`);
    }
  }

  if (brief.mode === "react-ts") {
    const hasComponent = Object.keys(files).some(
      (p) => p.startsWith("src/components/") && p.endsWith(".tsx") && files[p].trim().length > 0
    );
    if (!hasComponent) {
      errors.push("Missing component file under src/components/*.tsx");
    }
  }

  for (const [path, content] of Object.entries(files)) {
    if (/\bTODO\b/i.test(content)) {
      errors.push(`${path} contains a TODO placeholder`);
    }
    if (/lorem\s+ipsum/i.test(content)) {
      errors.push(`${path} contains lorem ipsum placeholder text`);
    }
    if (/\.\.\.\s*$/m.test(content) || /\/\/\s*\.\.\./.test(content) || /\/\*\s*\.\.\.\s*\*\//.test(content)) {
      errors.push(`${path} contains trailing "..." or truncated code`);
    }

    if (path.endsWith(".html")) {
      const scriptSrcRegex = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
      let scriptMatch: RegExpExecArray | null;
      while ((scriptMatch = scriptSrcRegex.exec(content)) !== null) {
        const src = scriptMatch[1].trim();
        if (/^(https?:)?\/\//i.test(src)) {
          try {
            const parsed = new URL(src.startsWith("//") ? `https:${src}` : src);
            if (parsed.hostname !== "cdnjs.cloudflare.com") {
              errors.push(`${path} uses disallowed external script: ${src}`);
            }
          } catch {
            errors.push(`${path} contains invalid external script src: ${src}`);
          }
        }
      }

      const styleBlockRegex = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
      let styleMatch: RegExpExecArray | null;
      while ((styleMatch = styleBlockRegex.exec(content)) !== null) {
        const hexes = findHexColorsInCss(styleMatch[1]);
        if (hexes.length > 0) {
          errors.push(
            `${path} <style> uses hard-coded hex colors outside :root (${hexes.join(", ")})`
          );
        }
      }
    }

    if (path.endsWith(".css")) {
      const hexes = findHexColorsInCss(content);
      if (hexes.length > 0) {
        errors.push(
          `${path} uses hard-coded hex colors outside :root (${hexes.join(", ")})`
        );
      }
    }

    if (path.endsWith(".ts") || path.endsWith(".tsx")) {
      if (/:\s*any\b|\bas\s+any\b/.test(content)) {
        errors.push(`${path} uses disallowed TypeScript "any" type`);
      }
    }
  }

  if (brief.mode === "static" && files["index.html"]) {
    const html = files["index.html"];
    if (!/<link\b[^>]*href\s*=\s*["'][^"']*style\.css["']/i.test(html)) {
      errors.push("index.html does not link style.css");
    }
    if (!/<script\b[^>]*src\s*=\s*["'][^"']*app\.js["']/i.test(html)) {
      errors.push("index.html does not link app.js");
    }
  }

  return errors;
}

function parseJsonWithRepair(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

async function callJsonStage<T>(
  options: {
    model: string;
    stage: "brief" | "plan";
    system: string;
    prompt: string;
    schema: Record<string, unknown>;
    temperature?: number;
    attachments?: AttachedFile[];
    generateFn: GeminiGenerateFn;
  }
): Promise<T> {
  const { generateFn, ...req } = options;
  let raw = await generateFn(req);
  try {
    return parseJsonWithRepair(raw) as T;
  } catch {
    raw = await generateFn({
      ...req,
      prompt: `${req.prompt}\n\nYour previous reply was not valid JSON. Return ONLY valid JSON matching the schema.`,
    });
    try {
      return parseJsonWithRepair(raw) as T;
    } catch {
      throw new GeminiError(
        "MALFORMED",
        "Model returned malformed structured output. Please try again."
      );
    }
  }
}

async function callBuildStage(options: {
  model: string;
  stage: "build" | "repair";
  prompt: string;
  attachments?: AttachedFile[];
  generateFn: GeminiGenerateFn;
}): Promise<{ summary: string; files: GeneratedFiles }> {
  const firstReply = await options.generateFn({
    model: options.model,
    stage: options.stage,
    system: BUILD_SYSTEM_PROMPT,
    prompt: options.prompt,
    temperature: 0.3,
    attachments: options.attachments,
  });

  const parsedFirst = parseFiles(firstReply);
  if (Object.keys(parsedFirst.files).length > 0) {
    return parsedFirst;
  }

  const retryReply = await options.generateFn({
    model: options.model,
    stage: options.stage,
    system: BUILD_SYSTEM_PROMPT,
    prompt: `${options.prompt}\n\nYour previous reply did not contain <file path="...">...</file> blocks. Output one summary line followed by complete <file path="...">...</file> blocks.`,
    temperature: 0.3,
    attachments: options.attachments,
  });

  const parsedRetry = parseFiles(retryReply);
  if (Object.keys(parsedRetry.files).length === 0) {
    throw new GeminiError(
      "MALFORMED",
      "Model returned malformed code output without <file> blocks. Please try again."
    );
  }
  return parsedRetry;
}

export async function runPipeline(
  userPrompt: string,
  options: PipelineOptions,
  onStage?: (stage: PipelineStage) => void
): Promise<PipelineResult> {
  const { model, attachments, generateFn = gemini } = options;
  const isRuntimeRepairOnly = Boolean(
    options.runtimeErrors?.length && options.brief && options.files
  );

  let brief: DesignBrief;
  let plan: BuildPlan;
  let files: GeneratedFiles;
  let summary = "Built your application.";

  if (isRuntimeRepairOnly && options.brief && options.files) {
    brief = normalizeBrief(options.brief);
    plan = {
      files: Object.keys(options.files).map((path) => ({
        path,
        purpose: "Existing project file",
      })),
      components: [],
      state: [],
      interactions: [],
    };
    files = injectTokens({ ...options.files }, brief);
    onStage?.("check");
    const validationErrors = validateFiles(files, brief);
    const allErrors = [...validationErrors, ...(options.runtimeErrors ?? [])];

    if (allErrors.length > 0) {
      onStage?.("repair");
      const fileSnapshot = Object.entries(files)
        .map(([p, c]) => `<file path="${p}">\n${c}\n</file>`)
        .join("\n\n");
      const repairPrompt = `Fix the following runtime and validation errors in the existing ${brief.mode} project.\n\nErrors:\n${allErrors.map((e) => `- ${e}`).join("\n")}\n\nCurrent files:\n${fileSnapshot}\n\nReturn ONLY the changed files in full using <file path="...">...</file> tags.`;
      const repaired = await callBuildStage({
        model,
        stage: "repair",
        prompt: repairPrompt,
        generateFn,
      });
      files = injectTokens({ ...files, ...repaired.files }, brief);
      summary = repaired.summary || "Fixed runtime issues in your application.";
    }
    return { brief, plan, files, summary };
  }

  // 1) BRIEF
  onStage?.("brief");
  const isEditing = Boolean(options.brief && options.files);
  const briefPrompt = isEditing
    ? `Current design brief JSON:\n${JSON.stringify(options.brief, null, 2)}\n\nChange request:\n${userPrompt}\n\nReturn an updated design brief JSON that applies the requested changes and preserves everything else.`
    : `User request:\n${userPrompt}`;

  const rawBrief = await callJsonStage<DesignBrief>({
    model,
    stage: "brief",
    system: BRIEF_SYSTEM_PROMPT,
    prompt: briefPrompt,
    schema: BRIEF_SCHEMA,
    temperature: 0.4,
    attachments,
    generateFn,
  });
  brief = normalizeBrief(rawBrief);

  // 2) PLAN
  onStage?.("plan");
  const expectedFilesHint =
    brief.mode === "static"
      ? "Required files for static mode: index.html, style.css, app.js."
      : "Required files for react-ts mode: index.html, package.json, tsconfig.json, vite.config.ts, tailwind.config.ts, postcss.config.js, src/main.tsx, src/App.tsx, src/index.css, src/components/*.tsx, src/types.ts.";

  const planPrompt = isEditing
    ? `Design brief:\n${JSON.stringify(brief, null, 2)}\n\nExisting files: ${Object.keys(options.files ?? {}).join(", ")}\nChange request: ${userPrompt}\n${expectedFilesHint}\nPlan the required updates.`
    : `Design brief:\n${JSON.stringify(brief, null, 2)}\n\nUser request: ${userPrompt}\n${expectedFilesHint}`;

  plan = await callJsonStage<BuildPlan>({
    model,
    stage: "plan",
    system: PLAN_SYSTEM_PROMPT,
    prompt: planPrompt,
    schema: PLAN_SCHEMA,
    temperature: 0.2,
    generateFn,
  });

  // 3) BUILD
  onStage?.("build");
  let buildPrompt: string;
  if (isEditing && options.files) {
    const existingSnapshot = Object.entries(options.files)
      .map(([p, c]) => `<file path="${p}">\n${c}\n</file>`)
      .join("\n\n");
    buildPrompt = `Design brief:\n${JSON.stringify(brief, null, 2)}\n\nImplementation plan:\n${JSON.stringify(plan, null, 2)}\n\nExisting project files:\n${existingSnapshot}\n\nRequested changes:\n${userPrompt}\n\nReturn ONLY the changed or newly added files, each written in full inside <file path="...">...</file> tags.`;
  } else {
    buildPrompt = `Design brief:\n${JSON.stringify(brief, null, 2)}\n\nImplementation plan:\n${JSON.stringify(plan, null, 2)}\n\nOriginal user request:\n${userPrompt}`;
  }

  const built = await callBuildStage({
    model,
    stage: "build",
    prompt: buildPrompt,
    attachments,
    generateFn,
  });
  summary = built.summary;

  const mergedFiles: GeneratedFiles = isEditing
    ? { ...options.files, ...built.files }
    : { ...built.files };

  // 4) DESIGN TOKENS
  files = injectTokens(mergedFiles, brief);

  // 5) VALIDATE + 6) REPAIR (max 2 rounds)
  for (let round = 0; round < 2; round++) {
    onStage?.("check");
    const validationErrors = validateFiles(files, brief);
    const runtimeErrs = round === 0 ? options.runtimeErrors ?? [] : [];
    const allErrors = [...validationErrors, ...runtimeErrs];

    if (allErrors.length === 0) {
      break;
    }

    onStage?.("repair");
    const snapshot = Object.entries(files)
      .map(([p, c]) => `<file path="${p}">\n${c}\n</file>`)
      .join("\n\n");

    const repairPrompt = `Fix the following errors in the ${brief.mode} project while preserving all features and the design brief:\n${allErrors.map((e) => `- ${e}`).join("\n")}\n\nCurrent files:\n${snapshot}\n\nReturn ONLY the changed files in full inside <file path="...">...</file> tags. Remember: NO hard-coded hex colors in CSS outside :root (use CSS variables), NO TODO/lorem ipsum/trailing "...", NO TypeScript "any", and in static mode index.html must link style.css and app.js.`;

    const repaired = await callBuildStage({
      model,
      stage: "repair",
      prompt: repairPrompt,
      generateFn,
    });

    files = injectTokens({ ...files, ...repaired.files }, brief);
    if (repaired.summary) {
      summary = repaired.summary;
    }
  }

  return { brief, plan, files, summary };
}

export function buildStaticPreviewHtml(
  files: GeneratedFiles,
  versionNumber?: number
): string {
  const rawHtml = files["index.html"] || "<!doctype html><html><body></body></html>";
  const css = files["style.css"] || "";
  const js = files["app.js"] || "";

  const errorHookScript = `<script>
(function(){
  var ver = ${JSON.stringify(versionNumber ?? 1)};
  function report(msg){
    try {
      window.parent.postMessage({ type: "emdash-runtime-error", version: ver, message: String(msg || "Unknown runtime error") }, "*");
    } catch (_) {}
  }
  window.addEventListener("error", function(ev){
    var loc = ev.filename ? " (" + ev.filename + ":" + ev.lineno + ")" : "";
    report((ev.message || "Script error") + loc);
  });
  window.addEventListener("unhandledrejection", function(ev){
    var reason = ev.reason;
    var msg = reason && reason.message ? reason.message : String(reason || "Unhandled promise rejection");
    report(msg);
  });
})();
</script>`;

  let html = rawHtml.replace(
    /<link\b[^>]*href\s*=\s*["'][^"']*style\.css["'][^>]*>/i,
    () => `<style>\n${css}\n</style>`
  );

  if (!html.includes(css) && css) {
    html = html.replace(/<\/head>/i, () => `<style>\n${css}\n</style>\n</head>`);
  }

  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head([^>]*)>/i, `<head$1>\n${errorHookScript}`);
  } else {
    html = `${errorHookScript}\n${html}`;
  }

  const inlineAppScript = `<script>\n${js.replace(/<\/script>/gi, "<\\/script>")}\n</script>`;
  if (/<script\b[^>]*src\s*=\s*["'][^"']*app\.js["'][^>]*>\s*<\/script>/i.test(html)) {
    html = html.replace(
      /<script\b[^>]*src\s*=\s*["'][^"']*app\.js["'][^>]*>\s*<\/script>/i,
      () => inlineAppScript
    );
  } else if (js) {
    html = html.replace(/<\/body>/i, () => `${inlineAppScript}\n</body>`);
  }

  return html;
}
