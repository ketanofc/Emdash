<div align="center">

<img src="public/assets/emdash-logo.png" alt="Emdash Logo" width="84" />

**Say it. Ship it.**

A free, open-source, sponsor-supported AI web app builder and browser-based Web Agent IDE. Describe what you want in plain language, preview multi-file React or standalone HTML apps live in Sandpack, iterate through chat, export clean source code as `.zip`, or connect your own API keys in the Web Agent.

[Overview](#overview) · [Features](#features) · [Brand & Logo](#brand-identity--logo) · [Architecture](#architecture) · [Web Agent (BYOK)](#web-agent-ide--byok) · [API Reference](#api-reference) · [Getting Started](#getting-started) · [Codebase](#complete-codebase-structure)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Brand Identity & Logo](#brand-identity--logo)
- [Routes & Views](#routes--views)
- [Dash Coins & Sponsor Model](#dash-coins--sponsor-model)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Web Agent IDE & BYOK](#web-agent-ide--byok)
- [API Reference](#api-reference)
- [Supabase Backend (Optional)](#supabase-backend-optional)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Complete Codebase Structure](#complete-codebase-structure)
- [Testing & Security](#testing--security)
- [License](#license)

---

## Overview

Most ideas stall between *"I should build that"* and *"where do I even start?"* Emdash bridges that gap.

Write a plain-English prompt—optionally attaching up to 4 reference files (images, PDFs, audio, video, SVGs, or code/text files up to 4 MB each)—and Emdash runs a structured multi-stage AI pipeline (`brief` → `plan` → `build` → `check` → `repair`) to produce complete **Static HTML/CSS/JS** or **React + TypeScript + Tailwind** applications. Apps render immediately in a live preview canvas, support follow-up chat iterations with immutable version snapshots (`v1`, `v2`, …), auto-repair runtime errors, export as `.zip` archives, and publish to `/p/:slug`.

> *"We named it after the Emdash because it connects one thought to the next. That’s the whole job: connect what you imagine to what exists. It stays free because sponsors can cover the costs. It stays open source because you should be able to read how your builder works. And it stays honest: no hidden limits, no surprise paywall."* — **Ketan**, Founder & CEO

---

## Features

### 1. AI App Builder (`HomeView` & `WorkspaceView`)
- **Single-prompt composer** with rotating prompt suggestions, drag-and-drop / paste / file-picker attachments (`MAX_ATTACHMENTS = 4`, `4 MB` max per file), and `Enter` to build (`Shift+Enter` for newline).
- **Multimodal reference support**: raster images (`PNG`, `JPEG`, `WebP`, `GIF`, `HEIC`, plus client-side PNG rasterization for `BMP`/`AVIF`/`ICO`), `SVG` vector text + preview, `PDF`/`audio`/`video` inline payloads, and `60+` text/code formats.
- **Dual build targets (`PipelineMode`)**:
  - `static`: Standalone semantic HTML5 + CSS3 + vanilla ES2020 JavaScript.
  - `react-ts`: Full modular React 18 + strict TypeScript + Tailwind CSS project (`package.json`, `vite.config.ts`, `src/components/*.tsx`, etc.).
- **Live Sandpack & Static Preview**: Powered by `@codesandbox/sandpack-react` and sandboxed `iframe` rendering across **Desktop (`100%`)**, **Tablet (`768px`)**, and **Mobile (`390px`)** viewports.
- **Automatic Runtime Self-Repair**: Captures Sandpack/preview runtime errors and automatically invokes the `repair` pipeline stage once per version.
- **Immutable Version History & Code Explorer**: Browse every generated file in a tree explorer, switch across `v1`, `v2`, `v3` snapshots (persisted locally in IndexedDB `emdash_db`), pause active builds, export complete `.zip` bundles (`JSZip`), or publish live to `/p/:slug`.
- **5 Curated Starter Templates**: Todo app, Coffee landing page, Photo portfolio, Pricing page, and Habit tracker.

### 2. Browser Web Agent IDE (`/web`)
- Dedicated open-source IDE workspace featuring repository/branch switching, **Build** and **Plan** modes, file explorer, terminal log panel, git diff viewer, viewport preview, and mobile slide-out drawer.
- **Bring Your Own Key (BYOK)**: Users configure their own API key in Web Agent Settings for **Google Gemini**, **OpenAI**, **Anthropic**, or **OpenRouter**, proxied safely through `POST /api/web-agent/chat`.

### 3. Sponsorship Portal (`/sponsorship`, `/sponsor`, `/advertisers`)
- Dedicated monthly sponsorship portal with live interactive placement previews for **Home Composer Banner**, **Templates Grid Card**, and **Web Agent Workspace** (`Ad` / `SPONSORED` labeled, zero third-party ad trackers).
- Structured for monthly INR campaigns with a custom campaign inquiry workflow and FAQ accordion.

### 4. Admin Console & Multi-Provider LLM Router (`/admin`)
- Lazy-loaded administrative console protected by role checks (`admin`) and **TOTP MFA (`aal2`)**.
- Encrypted LLM provider vault (`AES-256-GCM`), key rotation, live connection testing, per-stage routing chains (`brief`, `plan`, `build`, `repair`) with automatic failover & cooldowns, user & Dash Coin management, usage analytics, global maintenance/grant controls, and full audit logging.

---

## Brand Identity & Logo

Emdash’s visual identity is built around architectural precision: sharp `0px` edges, `1px` structural hairline rails, crop-mark corner brackets, diagonal hatch dividers, and international orange accents.

### Official Brand Marks

| Asset | Preview | Usage | Path |
| --- | --- | --- | --- |
| **Primary Mark** | <img src="public/assets/emdash-logo.png" alt="Emdash primary mark" width="44" /> | Navbar, Footer, README & docs headers | `public/assets/emdash-logo.png` |
| **Favicon / App Icon** | <img src="public/assets/emdash-favicon.png" alt="Emdash favicon" width="44" /> | Browser tab, PWA manifest, high-res square icon | `public/assets/emdash-favicon.png` |
| **Multi-Size Favicons** | — | Standard ICO, 16px, 32px, 48px PNGs | `public/favicon.ico`, `public/favicon-{16,32,48}x*.png` |
| **Apple / Android / Tile** | — | iOS home screen, Android Chrome, Windows tile | `public/apple-touch-icon.png`, `public/android-chrome-{192,512}x*.png`, `public/mstile-150x150.png` |
| **PWA Manifest** | — | Standalone app metadata (`theme_color: #ff5401`) | `public/site.webmanifest` |

### Brand Symbol Geometry
- **The Slanted Em Dash**: A forward-leaning international orange (`#ff5401`) parallelogram representing a dynamic em dash (`—`) bridging imagination and shipped software.
- **Crop-Mark Corner Brackets (`CornerBrackets`)**: `12px × 12px` L-shaped neutral corner ticks framing hero sections, composers, cards, and modals.
- **Diagonal Hatch Dividers (`.hatch-pattern`)**: `10px × 10px` `315deg` repeating `1px` `--edge` diagonal strips separating horizontal page sections.

### Color System (`src/index.css`)

| Token | Light Mode | Dark Mode | Role |
| --- | --- | --- | --- |
| `--background` | `#f6f6f6` | `#121212` | Dominant neutral canvas |
| `--card` | `#ffffff` | `#18181b` | Primary rail & card surfaces |
| `--surface` | `#fafafa` | `#18181b` | Secondary / sponsor preview panels |
| `--foreground` | `#09090b` | `#fafafa` | Primary copy & headings |
| `--muted-foreground` | `#4a4a4a` | `#9f9fa9` | Secondary labels & captions |
| `--primary` | `#ff5401` | `#ff5401` | International orange primary actions & accents |
| `--primary-foreground` | `#ffffff` | `#ffffff` | Text on primary accent fills |
| `--border` | `#c5c5c5` | `#27272a` | Input & base structural borders |
| `--edge` | `color-mix(border 64%, bg)` | `color-mix(border 82%, bg)` | Hairline rail lines & hatch pattern strokes |
| `--neutral` | `#a3a3a3` | `#71717a` | Corner brackets & hover borders |
| `--destructive` | `#e40014` | `#bf000f` | Error & validation alerts |
| `--success` / `--info` | `#00c758` / `#009cf5` | `#00c758` / `#009cf5` | Status indicators |

> **Accessibility & Contrast Note**: On light surfaces (`#ffffff` / `#f6f6f6`), small orange text accents (e.g., quotation marks and hover labels) step down to `#c23a00` / `#b53600` to preserve $\ge 4.5:1$ WCAG AA contrast, while dark surfaces pair with `#ff5401` / `#ff7833`.

### Typography & Radius Rules
- **Display & Body (`--font-sans`)**: `Plus Jakarta Sans` (`400`, `500`, `600`, `700`)
- **Technical & Labels (`--font-mono`)**: `JetBrains Mono` (`400`, `500`) — uppercase tracked kickers, buttons, status tags, and tabular numerals (`tabular-nums`)
- **Border Radius**: Strictly `0px` (`--radius-sm` through `--radius-2xl` set to `0px`)

---

## Routes & Views

Client-side routing in `src/App.tsx` + `vercel.json` rewrites:

| Path | Component | Purpose |
| --- | --- | --- |
| `/` | `HomeView` + `WebAgentLandingSection` + `FounderNoteSection` | Landing page, prompt composer, starter templates, Web Agent CTA, Founder quote, and Footer |
| *(in-app)* | `WorkspaceView` | Active split-pane builder (chat rail + Sandpack/HTML preview, code tree, viewport switcher, export, publish) |
| `/web` | `WebAgentPage` | Browser Web Agent IDE with BYOK multi-provider chat, repo explorer, terminal, and git diff view |
| `/sponsorship`, `/sponsor`, `/advertisers` | `SponsorshipPage` | Interactive placement preview, monthly sponsorship slots, FAQ, and campaign inquiry form |
| `/signin`, `/login` | `AuthPage` | Sign in via local HMAC session or Supabase Auth |
| `/signup`, `/register` | `AuthPage` | Account registration |
| `/admin` | `AdminPage` *(lazy-loaded)* | Role-gated & TOTP MFA (`aal2`) admin dashboard |
| `/p/:slug` | Express handler (`server.ts`) | Serves published standalone HTML apps directly |
| `/trust.html` | Static asset (`public/trust.html`) | Public security & trust overview linked from the Footer |

---

## Dash Coins & Sponsor Model

| Mechanism | Default / Behavior |
| --- | --- |
| **Daily Coin Grant** | `100` Dash Coins granted per daily cycle (`reset_timezone`: `UTC`, configurable in Admin) |
| **Build Cost** | `10` Dash Coins deducted per `build` job (`POST /api/generate`) |
| **Repair Cost** | `0` Dash Coins per `repair` job (`POST /api/repair`) |
| **Failure Protection** | Automatic coin refund (`build_refund` / `repair_refund`) if generation or upstream provider calls fail |
| **Ad-Supported Free Tier** | Labeled `Ad` / `SPONSORED` native banners on Home Composer, Template Grid, and Web Agent surfaces — zero ads inside generated previews |
| **Pro Mode** | Ad-free workspace experience across prompts and templates |

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| **Frontend** | React 19, TypeScript 7, Vite 8 |
| **Styling & UI** | Tailwind CSS v4 (`@tailwindcss/vite`), Radix UI (`Dialog`, `Select`, `Tabs`, `Tooltip`, `Slot`), `class-variance-authority`, `tailwind-merge`, `sonner` |
| **Live Sandbox & Export** | `@codesandbox/sandpack-react`, `jszip` |
| **Icons, Motion & Charts** | `lucide-react`, `motion` (`prefers-reduced-motion` aware), `recharts` |
| **Backend Server** | Node.js 22+, Express 4 (`tsx` in dev, native `node server.ts` or Vercel serverless `api/index.ts` in prod) |
| **AI & Routing** | `@google/genai` + native fetch adapters for Gemini, OpenAI-compatible APIs, Anthropic, and OpenRouter |
| **Auth & Database (Optional)** | Local JSON/in-memory store + scrypt/HMAC + TOTP MFA, or managed Supabase (`@supabase/supabase-js` + PostgreSQL + Edge Functions) |
| **Testing & Validation** | Vitest 5, Zod 4, `tsc --noEmit` |

---

## Architecture

```text
Browser (React 19 + Vite 8 SPA)
  ├─ HomeView / WorkspaceView
  │    ├─ IndexedDB (emdash_db) ──► Immutable AppVersion snapshots (v1, v2, …)
  │    ├─ Sandpack / iframe ──────► Live preview + automatic error capture
  │    ├─ JSZip ──────────────────► <slug>-v<version>.zip export
  │    └─ SSE / JSON ─────────────► POST /api/generate | /api/repair
  │
  ├─ WebAgentPage (/web)
  │    ├─ LocalStorage (emdash:web_agent_byok) ──► User BYOK key (never logged)
  │    └─ POST /api/web-agent/chat ──────────────► Gemini | OpenAI | Anthropic | OpenRouter
  │
  └─ AdminPage (/admin) & AuthPage (/signin, /signup)
       └─ /api/auth/* & /api/admin/* (HMAC/Supabase JWT + TOTP aal2 + AES-256-GCM vault)
             │
             ▼
Express Server (server.ts / api/index.ts)
  ├─ Multi-Stage Pipeline (src/lib/pipeline.ts)
  │    └─ brief ──► plan ──► build ──► check ──► repair
  ├─ Multi-Provider LLM Router (src/lib/llm/router.ts)
  │    ├─ Decrypts provider keys via KEY_ENCRYPTION_SECRET (AES-256-GCM)
  │    ├─ Enforces RPM / RPD / daily token limits & blocked regions
  │    ├─ Exponential cooldowns (60s → 2m → 5m → 15m; 24h on 401/403)
  │    └─ JSON schema validation & repair (src/lib/llm/schema.ts)
  └─ Persistence Layer
       ├─ LocalAppStore (.data/emdash-store.json or /tmp/emdash-data on serverless)
       └─ Optional Supabase (PostgreSQL + RLS + Edge Functions)
```

---

## Web Agent IDE & BYOK

The Web Agent (`/web`) lets developers work with repositories in a browser IDE layout and run AI engineering prompts using **their own provider API key**:

1. Open `/web` and click **Settings** in the sidebar footer.
2. Choose a provider (**Gemini**, **OpenAI**, **Anthropic**, or **OpenRouter**) and enter your API key (`emdash:web_agent_byok` in `localStorage`).
3. Switch between **Build** (code & implementation guidance) and **Plan** (structured technical architecture) modes.
4. Requests are sent to `POST /api/web-agent/chat`, which resolves the target model ID, applies conversation history (up to the last 8 turns) + active repository/branch context, calls the selected upstream provider, and redacts any secrets from error messages before returning output.

| Provider | Default / Fallback Model | Upstream Endpoint |
| --- | --- | --- |
| `gemini` | `gemini-2.5-flash` / `gemini-2.5-pro` | `generativelanguage.googleapis.com/v1beta` |
| `openai` | `gpt-4o-mini` (or explicit `gpt-*` / `o*-*`) | `api.openai.com/v1` |
| `anthropic` | `claude-sonnet-4-20250514` (or explicit `claude-*`) | `api.anthropic.com/v1/messages` |
| `openrouter` | `google/gemini-2.5-flash` (or `<org>/<model>`) | `openrouter.ai/api/v1` |

---

## API Reference

All API routes are mounted under `/api` in `server.ts` with origin-locked CORS.

### Public & Pipeline Endpoints (`src/server/apiHandlers.ts`, `server.ts`)

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Public | Server liveness check (`{ "ok": true }`) |
| `GET` | `/api/public-config` | Public | Safe client Supabase config (`supabaseUrl`, `supabaseAnonKey`); never leaks secrets |
| `GET` | `/api/wallet` | Optional Bearer | Returns Dash Coin balance, `dailyGrant`, `buildCost`, `repairCost`, config flags, and user ledger |
| `POST` | `/api/generate` | Optional Bearer | Runs `brief → plan → build → check` pipeline; supports `Accept: text/event-stream` (`stage`, `result`, `error` events). Alias: `POST /api/gemini/pipeline` |
| `POST` | `/api/repair` | Optional Bearer | Runs automated error repair against existing `files` + `runtimeErrors` |
| `POST` | `/api/web-agent/chat` | Public (BYOK) | Executes Web Agent `build`/`plan` chat via user-supplied `apiKey` for Gemini, OpenAI, Anthropic, or OpenRouter |
| `POST` | `/api/publish` | Public | Stores `{ slug, title, html }` in the live server map and returns `{ slug, path: "/p/<slug>", updatedAt }` |
| `GET` | `/p/:slug` | Public | Serves published HTML directly (`Content-Type: text/html`) |

### Authentication & MFA Endpoints (`src/server/adminRouter.ts`)

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/auth/session` | Sign in or sign up (`email`, `password`, `mode: "signin" \| "signup"`); issues HMAC-signed session token |
| `GET` | `/api/auth/me` | Validates Bearer token against store/Supabase profile and returns `{ user, aal }` |
| `POST` | `/api/auth/mfa/enroll` | Enrolls TOTP factor for admin MFA upgrade (`otpauth://` URI + secret) |
| `POST` | `/api/auth/mfa/verify` | Verifies 6-digit TOTP code and upgrades session token to `aal2` |

### Admin Console Endpoints (`/api/admin/*`)

> Requires authenticated `role === "admin"`, `aal === "aal2"`, and per-actor/IP rate limiting (`120 req/min`). All mutations record entries in the audit log.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/admin/overview` | System metrics, active providers, job counts, daily call volume |
| `GET` / `POST` | `/api/admin/providers` | List sanitized providers or create a provider (encrypts API key with AES-256-GCM) |
| `PATCH` / `DELETE` | `/api/admin/providers/:id` | Update provider priority/limits/regions or remove provider |
| `POST` | `/api/admin/providers/:id/rotate-key` | Re-encrypt and rotate provider API key (`key_version` bump) |
| `POST` | `/api/admin/providers/:id/test` | Live upstream connectivity probe |
| `GET` / `PATCH` | `/api/admin/providers/:id/models` | List or toggle enabled models & token pricing |
| `GET` / `PUT` | `/api/admin/routes` | Inspect or update fallback routing chains per stage (`brief`, `plan`, `build`, `repair`) |
| `GET` / `GET :id` | `/api/admin/users`, `/api/admin/users/:id` | Search user profiles, inspect wallet balance, coin ledger, and job history |
| `POST` | `/api/admin/users/:id/coins` | Credit or debit Dash Coins with audit reason |
| `POST` | `/api/admin/users/:id/suspend` / `reactivate` | Suspend or restore user accounts |
| `GET` | `/api/admin/usage` | Aggregated LLM call telemetry, token totals, latency, and error codes |
| `GET` / `PUT` | `/api/admin/config` | Read or update `daily_grant`, `costs`, `maintenance`, `signups_enabled`, `global_daily_call_limit` |
| `GET` | `/api/admin/audit` | Query immutable administrative audit log |

---

## Supabase Backend (Optional)

Emdash runs standalone out of the box using `LocalAppStore`, and optionally connects to Supabase via migrations and Edge Functions in `supabase/`:

- **SQL Migrations (`supabase/migrations/`)**:
  1. `20261116000001_wallet_and_config.sql` — Dash Coin wallets, ledger, jobs, app config
  2. `20261116000002_profiles_and_auth.sql` — User profiles, roles, RLS policies
  3. `20261116000003_llm_router_and_admin.sql` — Providers, models, routes, provider health, LLM calls, audit logs
  4. `20261116000004_usage_views_and_retention.sql` — Usage summary views and data retention policies
- **Edge Functions (`supabase/functions/`)**:
  - `admin/`, `generate/`, `repair/`, `wallet/`, and `_shared/` utilities.

---

## Getting Started

### Prerequisites
- **Node.js 20+** (`Node.js 22+` recommended for native TypeScript execution in `npm run start`)
- **npm** (or `bun`)

### Local Development

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env
# Generate KEY_ENCRYPTION_SECRET (recommended): openssl rand -base64 32

# 3. Start full-stack dev server (Express + Vite middleware on port 3000)
npm run dev
```

Open **http://localhost:3000**.

### Production Build & Run

```bash
npm run build
NODE_ENV=production npm run start
```

### Available npm Scripts

| Command | Script | Description |
| --- | --- | --- |
| `npm run dev` | `tsx server.ts` | Start Express + Vite dev server on port `3000` |
| `npm run build` | `vite build` | Build production SPA bundle into `dist/` |
| `npm run start` | `node server.ts` | Start production Express server serving `dist/` and `/api/*` + `/p/*` |
| `npm run preview` | `vite preview` | Preview built static Vite bundle |
| `npm run lint` | `tsc --noEmit` | Run strict TypeScript typechecking |
| `npm run test` | `vitest run` | Run all Vitest unit and security test suites |
| `npm run clean` | `rm -rf dist server.js` | Clean generated build artifacts |

---

## Environment Variables

Defined in `.env.example` (plus optional server runtime flags in `server.ts` & `vite.config.ts`):

| Variable | Required | Scope | Description |
| --- | --- | --- | --- |
| `KEY_ENCRYPTION_SECRET` | Recommended | Server | 32 random bytes base64-encoded (`openssl rand -base64 32`) for AES-256-GCM provider key encryption |
| `APP_URL` / `SITE_ORIGIN` | No | Server | Allowed origin(s) for CORS & self-referential links (defaults to `http://localhost:3000`) |
| `SESSION_SIGNING_SECRET` | No | Server | Optional explicit HMAC secret for session tokens (derived automatically if omitted) |
| `VITE_SUPABASE_URL` | No | Client & Server | Supabase project URL for managed auth/DB mode |
| `VITE_SUPABASE_ANON_KEY` | No | Client & Server | Supabase anonymous/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Server | Supabase service role key for server-side JWT & DB verification |
| `PORT` | No | Server | HTTP port override (defaults to `3000`) |
| `DISABLE_HMR` | No | Vite | Set `"true"` to disable Vite HMR file watching |

> **Security**: Never commit `.env` files or expose `KEY_ENCRYPTION_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, or `SESSION_SIGNING_SECRET` in `VITE_*` variables.

---

## Deployment

- **Node.js / Cloud Run**: Run `npm run build` followed by `NODE_ENV=production npm run start`. The Express server listens on `0.0.0.0:${PORT:-3000}` and serves `dist/` with SPA fallback.
- **Vercel Serverless**: Configured out of the box via `api/index.ts` (re-exporting Express `app`) and `vercel.json` (routing `/api/*` and `/p/*` to `/api/index`, and SPA routes `/admin`, `/signin`, `/signup`, `/login`, `/register`, `/web` to `/index.html`). On read-only serverless filesystems, `LocalAppStore` automatically falls back to `os.tmpdir()/emdash-data` without throwing `EROFS`.

---

## Complete Codebase Structure

```text
emdash/
├─ .env.example                          # Environment variable template
├─ api/
│  └─ index.ts                           # Vercel serverless handler exporting Express app
├─ index.html                            # HTML shell, favicon/manifest links, Google Fonts, OG tags
├─ metadata.json                         # App metadata & server-side Gemini capability declaration
├─ package.json                          # Dependencies and scripts
├─ server.ts                             # Express entrypoint, CORS, /api/*, /p/:slug, Vite dev/prod static
├─ tsconfig.json                         # TypeScript configuration
├─ vercel.json                           # Vercel API & SPA routing rules
├─ vite.config.ts                        # Vite 8 + React + Tailwind CSS v4 configuration
├─ public/
│  ├─ site.webmanifest                   # PWA manifest (theme_color: #ff5401)
│  ├─ trust.html                         # Static Trust & Security center page
│  ├─ favicon.ico, favicon-*.png         # Multi-resolution favicons
│  ├─ apple-touch-icon.png               # iOS touch icon
│  ├─ android-chrome-*.png               # Android PWA icons
│  ├─ mstile-150x150.png                 # Windows tile icon
│  └─ assets/
│     ├─ emdash-logo.png                 # Primary Emdash slanted orange mark
│     ├─ emdash-favicon.png              # High-res square Emdash icon
│     └─ ketan-avatar.jpg                # Founder avatar asset
├─ supabase/
│  ├─ migrations/                        # 4 PostgreSQL schema, RLS & retention migrations
│  └─ functions/                         # Supabase Edge Functions (admin, generate, repair, wallet, _shared)
└─ src/
   ├─ main.tsx                           # React root mount
   ├─ App.tsx                            # Root router, theme/quota/auth state, build lifecycle, ZIP export
   ├─ index.css                          # Tailwind v4 tokens, light/dark themes, Culio rails & hatch patterns
   ├─ types.ts                           # Shared TypeScript interfaces
   ├─ data/
   │  ├─ templates.ts                    # Quick-start chips, rotating placeholders, 5 starter templates
   │  └─ webMock.ts                      # Web Agent workspace projects, files, diffs, terminal & model presets
   ├─ lib/
   │  ├─ apiClient.ts                    # Client API wrappers for auth, wallet, admin & generation
   │  ├─ fileAttachment.ts               # Multi-format file processing (images, PDF/AV, SVG, code/text)
   │  ├─ gemini.ts / gemini.test.ts      # Client pipeline SSE runner, model presets & error types
   │  ├─ pipeline.ts / pipeline.test.ts  # Multi-stage prompt engineering, XML/JSON parsing & static builder
   │  ├─ storage.ts                      # IndexedDB (emdash_db) version store & localStorage helpers
   │  ├─ supabase.ts                     # Lazy Supabase client & runtime hydration via /api/public-config
   │  ├─ utils.ts                        # cn() class merge utility
   │  └─ llm/
   │     ├─ adapters.ts                  # Gemini & OpenAI-compatible HTTP adapters
   │     ├─ crypto.ts / crypto.test.ts   # AES-256-GCM encryption/decryption & secret redaction
   │     ├─ router.ts / router.test.ts   # Multi-provider failover, cooldowns, limits & schema enforcement
   │     ├─ schema.ts                    # JSON extraction & validation helpers
   │     └─ types.ts                     # Router, provider, health & error contracts
   ├─ server/
   │  ├─ adminRouter.ts                  # Auth, TOTP MFA & rate-limited admin CRUD routes
   │  ├─ adminSecurity.test.ts           # Security regression tests (RBAC, aal2, EROFS, refunds, secrets)
   │  ├─ apiHandlers.ts                  # Public wallet, SSE pipeline, repair & BYOK Web Agent chat routes
   │  └─ store.ts                        # LocalAppStore (users, scrypt, TOTP, wallets, vaults, audit log)
   └─ components/
      ├─ AuthPage.tsx                    # Dedicated /signin and /signup view
      ├─ CornerBrackets.tsx              # 4-corner L-bracket architectural accents
      ├─ Dialogs.tsx                     # Wallet, Templates, Auth & Support Docs dialogs
      ├─ Footer.tsx                      # Multi-column footer with docs, Trust Center & social links
      ├─ FounderNoteSection.tsx          # Founder quotation section with semantic figure/blockquote/figcaption
      ├─ HomeView.tsx                    # Landing composer, attachments, ad slots & template gallery
      ├─ Navbar.tsx                      # Sticky header with mode navigation, theme toggle & mobile drawer
      ├─ SponsorshipPage.tsx             # /sponsorship placement previews, FAQ & inquiry form
      ├─ WebAgentLandingSection.tsx      # Landing section introducing the browser Web Agent
      ├─ WorkspaceView.tsx               # Split chat + Sandpack/static preview, file tree, versions & export
      ├─ web/
      │  └─ WebAgentPage.tsx             # Full /web open-source coding IDE with BYOK Settings
      ├─ admin/
      │  ├─ AdminPage.tsx                # Lazy-loaded admin shell with MFA verification flow
      │  ├─ AdminDashboardSection.tsx    # Dashboard layout container
      │  ├─ AdminOverviewTab.tsx         # Overview KPIs & charts
      │  ├─ AdminProvidersTab.tsx        # Encrypted LLM provider management & key rotation
      │  ├─ AdminRoutingTab.tsx          # Per-stage routing chain editor
      │  ├─ AdminUsersTab.tsx            # User lookup, Dash Coin grants & suspension controls
      │  ├─ AdminSettingsTab.tsx         # Global config (daily grants, maintenance, call limits)
      │  └─ AdminAuditTab.tsx            # Audit log viewer
      └─ ui/                             # Boxy 0px Radix + Tailwind primitives (button, dialog, select, etc.)
```

---

## Testing & Security

Run the full validation suite:

```bash
npm run lint     # TypeScript strict check (tsc --noEmit)
npm run test     # Vitest suite (33 tests across 5 test files)
npm run build    # Production Vite bundle verification
```

### Automated Test Suites
- `src/server/adminSecurity.test.ts` — RBAC enforcement, `aal2` MFA gating, secret hygiene, RLS checks, Dash Coin refunds, and read-only serverless filesystem fallback (`EROFS` regression).
- `src/lib/llm/router.test.ts` — Provider failover, region blocking, rate limits, cooldown backoff, and schema validation.
- `src/lib/pipeline.test.ts` — Multi-stage pipeline parsing (`static` & `react-ts`) and HTML preview construction.
- `src/lib/gemini.test.ts` — SSE stream handling, retry logic, and error normalization.
- `src/lib/llm/crypto.test.ts` — `AES-256-GCM` key encryption/decryption and secret redaction.

---

## License

Released under the [MIT License](LICENSE).

---

<div align="center">

Built with care, supported by sponsors, free for everyone.

</div>
