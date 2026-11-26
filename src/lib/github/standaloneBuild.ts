export interface StandaloneBuildParsed {
  summary: string;
  files: Array<{ path: string; content: string }>;
  previewHtml: string | null;
}

export function buildStandaloneSystemPrompt(
  mode: "build" | "plan",
  projectName?: string,
  branch?: string
): string {
  const repoContext = projectName
    ? `Active repository: ${projectName} (branch: ${branch || "main"}).`
    : "Standalone Web Agent workspace.";

  if (mode === "plan") {
    return `You are Emdash Web Agent in PLAN mode. ${repoContext}
Provide a clear, structured technical plan covering:
1. Architecture & layout overview
2. Files & components to create
3. State management & user interactions
4. Edge cases & accessibility considerations`;
  }

  return `You are Emdash Web Agent in BUILD mode. ${repoContext}
Build a complete, polished, responsive, interactive web application matching the user's request.
Return ONLY a valid JSON object (no text outside JSON) with this exact schema:
{
  "summary": "Brief summary of what was built and how to use it",
  "files": [
    {
      "path": "index.html",
      "content": "Complete self-contained HTML5 document including <style> and <script> (or Tailwind CDN) so it runs immediately in an iframe"
    }
  ]
}
Requirements:
- Make the UI visually refined, responsive, and immediately interactive with zero placeholder TODOs or ellipses.
- Ensure index.html is completely self-contained and works inside an iframe.`;
}

export function parseStandaloneBuildOutput(rawText: string): StandaloneBuildParsed {
  const trimmed = rawText.trim();
  let jsonCandidate = trimmed;

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    jsonCandidate = fenceMatch[1].trim();
  } else {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonCandidate = trimmed.slice(firstBrace, lastBrace + 1);
    }
  }

  try {
    const parsed = JSON.parse(jsonCandidate) as {
      summary?: string;
      files?: Array<{ path?: string; content?: string }>;
      previewHtml?: string;
    };
    const files = Array.isArray(parsed.files)
      ? parsed.files
          .filter((f): f is { path: string; content: string } => Boolean(f?.path && typeof f.content === "string"))
          .map((f) => ({ path: f.path, content: f.content }))
      : [];

    const htmlFile =
      files.find((f) => f.path === "index.html") ||
      files.find((f) => f.path.endsWith(".html"));

    const previewHtml =
      typeof parsed.previewHtml === "string" && parsed.previewHtml.trim()
        ? parsed.previewHtml
        : htmlFile?.content || null;

    if (files.length > 0 || previewHtml) {
      return {
        summary: typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary : "Built application.",
        files,
        previewHtml,
      };
    }
  } catch {
    // Fallback: check if model returned raw HTML inside ```html ... ```
  }

  const htmlBlock = trimmed.match(/```html\s*([\s\S]*?)```/i);
  if (htmlBlock && htmlBlock[1]?.includes("<html")) {
    const html = htmlBlock[1].trim();
    return {
      summary: "Built interactive web application.",
      files: [{ path: "index.html", content: html }],
      previewHtml: html,
    };
  }

  return {
    summary: trimmed,
    files: [],
    previewHtml: null,
  };
}
