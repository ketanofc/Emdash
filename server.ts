import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAdminRouter, createAuthRouter, type ServerContext } from "./src/server/adminRouter.ts";
import { createPublicApiRouter } from "./src/server/apiHandlers.ts";
import { LocalAppStore, resolveServerMasterSecret } from "./src/server/store.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === "production";

interface PublishedSite {
  slug: string;
  title: string;
  html: string;
  updatedAt: string;
}

const publishedSites = new Map<string, PublishedSite>();

function sanitizeSlug(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return cleaned || "untitled-app";
}

function getAllowedOrigins(): Set<string> {
  const vercelUrl = process.env.VERCEL_URL?.trim();
  const vercelProdUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const candidates = [
    process.env.SITE_ORIGIN,
    process.env.APP_URL,
    vercelProdUrl ? `https://${vercelProdUrl.replace(/^https?:\/\//, "")}` : "",
    vercelUrl ? `https://${vercelUrl.replace(/^https?:\/\//, "")}` : "",
    "https://emdashworld.vercel.app",
    `http://localhost:${PORT}`,
    `http://127.0.0.1:${PORT}`,
  ]
    .filter((v): v is string => Boolean(v && v.trim()))
    .map((v) => v.trim().replace(/\/+$/, ""));
  return new Set(candidates);
}

function resolveSigningSecret(masterSecret: string): string {
  const explicit = process.env.SESSION_SIGNING_SECRET?.trim();
  if (explicit) return explicit;
  const keySecret = process.env.KEY_ENCRYPTION_SECRET?.trim();
  if (keySecret) return crypto.createHash("sha256").update(keySecret).digest("hex");
  const serviceSecret = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)?.trim();
  if (serviceSecret) {
    return crypto.createHmac("sha256", serviceSecret).update("emdash:session-signing:v1").digest("hex");
  }
  return crypto.createHash("sha256").update(masterSecret).digest("hex");
}

export function createApp(customCtx?: Partial<ServerContext>) {
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const dataDir = isServerless
    ? path.join(os.tmpdir(), "emdash-data")
    : path.resolve(__dirname, ".data");
  const store =
    customCtx?.store ??
    new LocalAppStore({
      persistPath:
        process.env.NODE_ENV === "test" || process.env.VITEST
          ? null
          : path.join(dataDir, "emdash-store.json"),
    });
  const masterSecret = customCtx?.masterSecret ?? resolveServerMasterSecret(dataDir);
  const signingSecret = customCtx?.signingSecret ?? resolveSigningSecret(masterSecret);

  const ctx: ServerContext = {
    store,
    masterSecret,
    keyring: customCtx?.keyring ?? masterSecret,
    signingSecret,
    fetchFn: customCtx?.fetchFn,
  };

  const expressApp = express();
  expressApp.use(express.json({ limit: "20mb" }));

  // Origin-locked CORS for API routes
  const allowedOrigins = getAllowedOrigins();
  expressApp.use("/api", (req, res, next) => {
    const reqOrigin = typeof req.headers.origin === "string" ? req.headers.origin.replace(/\/+$/, "") : "";
    if (reqOrigin) {
      const originToAllow = allowedOrigins.has(reqOrigin)
        ? reqOrigin
        : Array.from(allowedOrigins)[0] || "http://localhost:3000";
      res.setHeader("Access-Control-Allow-Origin", originToAllow);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "authorization, content-type, x-client-info, apikey");
    }
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  expressApp.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  expressApp.get("/api/public-config", (_req, res) => {
    const supabaseUrl = (
      process.env.VITE_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      ""
    ).trim();
    const supabaseAnonKey = (
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      ""
    ).trim();
    res.json({ supabaseUrl, supabaseAnonKey });
  });

  expressApp.use("/api/auth", createAuthRouter(ctx));
  expressApp.use("/api/admin", createAdminRouter(ctx));
  expressApp.use("/api", createPublicApiRouter(ctx));

  expressApp.post("/api/publish", (req, res) => {
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

  expressApp.get("/p/:slug", (req, res) => {
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

  expressApp.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error("[emdash] Unhandled server error:", err);
      if (res.headersSent) return;
      const message = err instanceof Error ? err.message : "Internal server error.";
      res.status(500).json({ error: message });
    }
  );

  return { app: expressApp, ctx };
}

export const { app } = createApp();

async function startServer() {
  if (process.env.VERCEL || process.env.NODE_ENV === "test" || process.env.VITEST) {
    return;
  }

  if (!isProd) {
    const vitePkg = "vite";
    const { createServer: createViteServer } = await import(/* @vite-ignore */ vitePkg);
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

if (!process.env.VERCEL && process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  startServer().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}
