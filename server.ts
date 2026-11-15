import "dotenv/config";
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === "production";

interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

interface GenerateRequestBody {
  prompt?: string;
  currentHtml?: string;
  history?: HistoryTurn[];
  attachment?: {
    name: string;
    content: string;
  } | null;
}

interface PublishedSite {
  slug: string;
  title: string;
  html: string;
  updatedAt: string;
}

const publishedSites = new Map<string, PublishedSite>();

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function sanitizeSlug(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return cleaned || "untitled-app";
}

const SYSTEM_INSTRUCTION = `You are Emdash, an expert web product engineer and UI designer.
Your job is to build or update a complete, production-quality, self-contained single-file HTML5 web application (\`index.html\`) from the user's prompt.

Rules for the generated \`html\`:
1. Return a valid, complete HTML document starting with \`<!DOCTYPE html>\` with embedded \`<style>\` and \`<script>\`.
2. Make the UI crisp, modern, and thoughtfully designed (inspired by shadcn/ui with sharp boxy 0px corners, clean 1px hairline borders, subtle surfaces, high contrast, responsive mobile-first layout, clear typographic hierarchy, system or Google Fonts).
3. Every button, form, filter, tab, toggle, or interactive element in the generated app MUST actually work with clean vanilla JavaScript (including localStorage persistence where helpful like todos or habit trackers).
4. Do not use external image URLs that might fail to load (use crisp inline SVGs, CSS gradients, or canvas graphics instead).
5. When modifying an existing app (\`currentHtml\` is provided), preserve the existing features and data structure while faithfully applying the user's requested changes (e.g., dark mode, new color accents, new sections, layout refinements).
6. Keep \`summary\` concise, human, and direct (1–2 sentences describing what was built or updated).
7. Keep \`title\` short (2–5 words) and \`slug\` URL-friendly lowercase kebab-case.`;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/generate", async (req, res) => {
    const body = (req.body || {}) as GenerateRequestBody;
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      res.status(400).json({ error: "Prompt is required." });
      return;
    }

    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error:
          "GEMINI_API_KEY is not configured. Add your key in the Settings > Secrets panel to generate apps.",
      });
      return;
    }

    const parts: string[] = [];
    if (body.history && Array.isArray(body.history) && body.history.length > 0) {
      const recent = body.history.slice(-6);
      parts.push(
        "Conversation history:\n" +
          recent
            .map((turn) => `${turn.role === "user" ? "User" : "Emdash"}: ${turn.content}`)
            .join("\n")
      );
    }

    if (body.currentHtml && typeof body.currentHtml === "string") {
      parts.push(
        `Current index.html to modify:\n\`\`\`html\n${body.currentHtml.slice(0, 45000)}\n\`\`\``
      );
    }

    if (body.attachment?.content) {
      parts.push(
        `Attached reference (${body.attachment.name}):\n\`\`\`\n${body.attachment.content.slice(0, 12000)}\n\`\`\``
      );
    }

    parts.push(`User request: ${prompt}`);

    try {
      const startedAt = Date.now();
      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: parts.join("\n\n"),
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: "Short project title (2-5 words).",
              },
              slug: {
                type: Type.STRING,
                description: "Kebab-case subdomain slug for the app.",
              },
              summary: {
                type: Type.STRING,
                description: "Concise 1-2 sentence summary of what was built or updated.",
              },
              html: {
                type: Type.STRING,
                description:
                  "Complete, self-contained HTML5 document with embedded CSS and JavaScript.",
              },
            },
            required: ["title", "slug", "summary", "html"],
          },
        },
      });

      const rawText = (response.text ?? "").trim();
      if (!rawText) {
        res.status(502).json({ error: "Empty response received from model." });
        return;
      }

      const parsed = JSON.parse(rawText) as {
        title?: string;
        slug?: string;
        summary?: string;
        html?: string;
      };

      if (!parsed.html || !parsed.html.includes("<")) {
        res.status(502).json({ error: "Model did not return valid HTML output." });
        return;
      }

      const elapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));

      res.json({
        title: (parsed.title || "Untitled App").trim().slice(0, 60),
        slug: sanitizeSlug(parsed.slug || parsed.title || "untitled"),
        summary:
          (parsed.summary || "Built your application and saved it as a new version.").trim(),
        html: parsed.html,
        elapsedSeconds,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to generate application.";
      const status =
        message.includes("403") || message.includes("PERMISSION_DENIED")
          ? 403
          : message.includes("429") || message.includes("RESOURCE_EXHAUSTED")
            ? 429
            : 500;
      res.status(status).json({ error: message });
    }
  });

  app.post("/api/publish", (req, res) => {
    const body = (req.body || {}) as {
      slug?: string;
      title?: string;
      html?: string;
    };
    const html = typeof body.html === "string" ? body.html : "";
    if (!html) {
      res.status(400).json({ error: "Nothing to publish yet." });
      return;
    }
    const slug = sanitizeSlug(body.slug || body.title || "untitled");
    const site: PublishedSite = {
      slug,
      title: (body.title || "Untitled App").slice(0, 80),
      html,
      updatedAt: new Date().toISOString(),
    };
    publishedSites.set(slug, site);
    res.json({
      slug,
      path: `/p/${slug}`,
      updatedAt: site.updatedAt,
    });
  });

  app.get("/p/:slug", (req, res) => {
    const slug = sanitizeSlug(req.params.slug || "");
    const site = publishedSites.get(slug);
    if (!site) {
      res
        .status(404)
        .type("html")
        .send(
          `<!doctype html><html><body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#fafafa;color:#09090b"><div style="text-align:center"><h1 style="font-size:20px;margin:0 0 8px">Site not found</h1><p style="color:#71717a;margin:0">Publish an app from the Emdash workspace to preview it here.</p></div></body></html>`
        );
      return;
    }
    res.type("html").send(site.html);
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get("*", (_req, res) => {
        res.sendFile(path.join(distDir, "index.html"));
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Emdash server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
