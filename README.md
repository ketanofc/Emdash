<div align="center">

# — Emdash

**Say it. Ship it.**

A free, ad-supported AI web app builder. Describe what you want in plain language, preview it live across viewports, iterate through chat, and export or publish working web applications in seconds.

[Overview](#overview) · [Features](#features) · [Architecture](#architecture) · [API Reference](#api-reference) · [Getting Started](#getting-started)

</div>

---

## Table of contents

- [Overview](#overview)
- [Features](#features)
- [Free, ad-supported model](#free-ad-supported-model)
- [Project status](#project-status)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [API reference](#api-reference)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Project structure](#project-structure)
- [Design system](#design-system)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## Overview

Most ideas stall between *"I should build that"* and *"where do I even start?"* Emdash closes that gap. You write a prompt such as *"build a habit tracker with weekly streak grids and local storage"*—optionally attaching a reference file—and Emdash generates a complete, interactive single-file HTML5 web application, renders it in a sandboxed live preview, and lets you keep refining it through follow-up chat prompts.

Emdash is free to use. Each user receives **5 hours of build time per day**, supported by clearly labeled ad placements and an optional rewarded-ad flow to earn extra time.

> The name comes from the em dash (`—`), the punctuation mark that connects one thought to the next. Emdash connects what you imagine to what exists.

## Features

### Build
- **Single-box prompt composer** with rotating prompt suggestions and keyboard submit (`Enter` to build, `Shift+Enter` for newline)
- **Reference file attachment** supporting `.txt`, `.md`, `.json`, `.html`, `.css`, and `.csv` files (up to 150 KB) as context for generation
- **Quick-start chips** (`Todo list`, `Coffee shop`, `Portfolio`, `Pricing page`) and a **template gallery** with 5 curated starters
- **Server-side AI generation** powered by Gemini (`gemini-4-hydrogen`) returning structured `{ title, slug, summary, html }` output
- **Iterative chat workspace** that passes recent conversation history and current `index.html` into follow-up requests so changes preserve existing features
- **Immutable version history** saving every generation step as `v1`, `v2`, `v3`, and so on

### Preview
- **Sandboxed live iframe** (`sandbox="allow-scripts allow-forms allow-modals"`) isolating generated apps from the host UI
- **Device viewport switcher** for Desktop (`100%`), Tablet (`768px`), and Mobile (`390px`) previews
- **Preview / Code tabs** to inspect or one-click copy the generated `index.html` source
- **Version picker** to switch between any earlier build version
- **Reload control** and live slug address bar (`<slug>.emdash.site`)

### Ship
- **Standalone HTML export** downloading `<slug>-v<version>.html` directly to your machine
- **One-click live publishing** serving the built app on `/p/<slug>` with a share modal for copying the live URL, opening it in a new tab, or downloading HTML

### Experience
- **Sharp, boxy Culio / shadcn-style UI** with `0px` border radius, `1px` hairline rails, corner brackets, and diagonal hatch spacers
- **Light and dark themes** synced with system preferences and persisted in `localStorage`
- **Responsive split workspace** with left-hand chat rail and right-hand preview/code canvas on tablet and desktop viewports
- **Accessible & motion-safe**: honors `prefers-reduced-motion` and supports keyboard navigation (`Esc` to close dialogs)

## Free, ad-supported model

| Item | Detail |
| --- | --- |
| Daily allowance | 5 hours (`18,000` seconds) of build time, reset daily (`YYYY-MM-DD`) |
| Cost per build | 6 minutes (`360` seconds) deducted per successful generation on the Free tier |
| Cost to start | Free, no credit card required |
| Ad placements | Clearly labeled **Ad** units: template gallery card, workspace sidebar banner, and a wait-state card shown while generating |
| Need more time? | Watch a 15-second rewarded ad spot in the quota dialog to add **20 minutes** (`1,200` seconds) |
| Quota indicator | Header countdown badge showing remaining daily time; switches to primary highlight under 30 minutes |
| Pro preview | Switchable **Emdash Pro** mode (`$19/mo` preview) disabling all ad slots and unlocking unlimited daily build time |

Ads never cover or interrupt the generated app preview canvas.

## Project status

| Area | Status | Notes |
| --- | --- | --- |
| Prompt composer, templates & chat workspace | Implemented | React 19 + Tailwind CSS v4 + Radix UI primitives |
| AI code generation (`POST /api/generate`) | Implemented | Server-side `@google/genai` (`gemini-4-hydrogen`) with structured JSON schema |
| Live preview, code view & version switching | Implemented | Sandboxed `iframe` with desktop/tablet/mobile widths |
| HTML file export | Implemented | Client-side download as `<slug>-v<version>.html` |
| Live route publishing (`POST /api/publish`, `GET /p/:slug`) | Implemented | In-memory Express route registry for instant sharing |
| Daily quota, local session & rewarded-ad flow | Implemented (local) | Persisted in `localStorage` with simulated 15s rewarded countdown |
| Persistent database & multi-tenant auth | Planned | PostgreSQL / Firestore persistence across server restarts |
| Server-side quota enforcement & zip/subdomain deploys | Planned | Per-account rate limiting and custom `*.emdash.site` edge hosting |

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend framework | React 19, TypeScript, Vite 8 |
| Styling & components | Tailwind CSS v4 (`@tailwindcss/vite`), Radix UI primitives (`Dialog`, `Select`, `Tabs`, `Tooltip`, `Slot`), `class-variance-authority`, `sonner` |
| Icons & motion | `lucide-react`, `motion` |
| Backend server | Node.js (v22+), Express 4 (`tsx` in development, native `node server.ts` in production) |
| AI model SDK | `@google/genai` (`gemini-4-hydrogen`, `ThinkingLevel.MEDIUM`) |

## Architecture

```
Browser (React SPA)
  ├─ HomeView / WorkspaceView ──► POST /api/generate ──► Express ──► Gemini API (gemini-4-hydrogen)
  │                                                                     └─ Structured JSON { title, slug, summary, html }
  ├─ Sandboxed Preview (iframe)
  │    └─ srcDoc isolated with allow-scripts allow-forms allow-modals
  ├─ Publish Flow ──────────────► POST /api/publish ───► In-memory Map ──► GET /p/:slug
  └─ Local State (localStorage)
       └─ Daily quota, theme preference, active plan, user session
```

### Core design principles

1. **Server-side AI boundary.** All `@google/genai` requests run exclusively in `server.ts`. API keys are never exposed to the browser bundle.
2. **Structured generation.** `/api/generate` enforces a JSON schema (`title`, `slug`, `summary`, `html`) so every build yields clean metadata, a URL-safe slug, and a complete HTML5 document.
3. **Immutable client versions.** Each prompt appends a new `AppVersion` snapshot (`v1`, `v2`, …), making rollbacks and source comparisons instantaneous.
4. **Sandboxed previews.** Generated apps render inside an `iframe` using `srcDoc` and restricted `sandbox` permissions so untrusted scripts cannot access parent DOM state.

## API reference

### `GET /api/health`
Returns server liveness status.

```json
{ "ok": true }
```

### `POST /api/generate`
Generates a new single-file web app or updates an existing `index.html`.

**Request body**
```json
{
  "prompt": "Build a todo app with status filters and local storage persistence",
  "currentHtml": "<!DOCTYPE html>...",
  "history": [
    { "role": "user", "content": "Initial prompt" },
    { "role": "assistant", "content": "Summary of v1" }
  ],
  "attachment": {
    "name": "brief.md",
    "content": "..."
  }
}
```

**Response (`200 OK`)**
```json
{
  "title": "Tasklist Todo App",
  "slug": "tasklist-todo-app",
  "summary": "Built a minimalist todo app with status filters and localStorage persistence.",
  "html": "<!DOCTYPE html>...",
  "elapsedSeconds": 4
}
```

**Error codes**
- `400` — Missing or empty `prompt`
- `403` / `429` — Upstream Gemini permission or rate-limit error
- `502` — Empty or invalid HTML response from the model
- `503` — `GEMINI_API_KEY` is not configured

### `POST /api/publish`
Stores an app snapshot under a sanitized slug and returns its live server path.

**Request body**
```json
{
  "slug": "tasklist-todo-app",
  "title": "Tasklist Todo App",
  "html": "<!DOCTYPE html>..."
}
```

**Response (`200 OK`)**
```json
{
  "slug": "tasklist-todo-app",
  "path": "/p/tasklist-todo-app",
  "updatedAt": "2026-11-14T23:19:00.000Z"
}
```

### `GET /p/:slug`
Serves the published HTML document directly (`Content-Type: text/html`), or a `404` page if the slug has not been published on the active server instance.

## Getting started

### Prerequisites

- **Node.js 20+** (Node.js 22+ recommended for native TypeScript execution with `npm run start`)
- **npm** (or another Node package manager)
- A **Gemini API key** (`GEMINI_API_KEY`)

### Install and run

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env
# Add your GEMINI_API_KEY to .env

# 3. Start the full-stack dev server (Express + Vite middleware on port 3000)
npm run dev
```

Open <http://localhost:3000>.

### Production build & run

```bash
npm run build
NODE_ENV=production npm run start
```

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Express + Vite development server on port `3000` via `tsx` |
| `npm run build` | Bundle the React frontend into `dist/` with Vite |
| `npm run start` | Run `node server.ts` serving `dist/` and `/api/*` + `/p/*` routes |
| `npm run preview` | Preview the static Vite build locally |
| `npm run lint` | Run TypeScript type checking (`tsc --noEmit`) |
| `npm run clean` | Remove build artifacts (`dist`, `server.js`) |

## Environment variables

Defined in `.env.example`:

| Variable | Required | Description |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes | Server-side API key used by `@google/genai` in `/api/generate` |
| `PORT` | No | HTTP server port (defaults to `3000`) |
| `NODE_ENV` | No | Set to `production` to serve static files from `dist/` |
| `APP_URL` | No | Public origin URL when deployed behind a proxy or Cloud Run |

Never commit `.env` files or expose `GEMINI_API_KEY` in client-side `VITE_*` variables.

## Project structure

```text
emdash/
├─ .env.example               # Environment variable template
├─ index.html                 # App shell, Google Fonts, SEO/OG metadata
├─ metadata.json              # App metadata & server-side Gemini capability
├─ package.json               # Dependencies and npm scripts
├─ server.ts                  # Express server, Vite middleware, Gemini & publish routes
├─ tsconfig.json              # TypeScript configuration
├─ vite.config.ts             # Vite + React + Tailwind v4 configuration
└─ src/
   ├─ App.tsx                 # Root state: theme, quota, auth, build lifecycle, dialogs
   ├─ main.tsx                # React entry point
   ├─ index.css               # Tailwind v4 theme tokens, Culio rails & hatch patterns
   ├─ types.ts                # Shared TypeScript interfaces (AppVersion, ChatMessage, etc.)
   ├─ lib/
   │  └─ utils.ts             # cn() Tailwind class merge helper
   ├─ data/
   │  └─ templates.ts         # Quick-start chips, rotating placeholders, template gallery
   └─ components/
      ├─ CornerBrackets.tsx   # Decorative 4-corner L-bracket accents
      ├─ Dialogs.tsx          # AdReward, Pricing, Templates, Publish & Auth modals
      ├─ HomeView.tsx         # Landing view: hero composer, chips, templates, footer
      ├─ Navbar.tsx           # Sticky header with quota gauge, theme toggle & auth
      ├─ WorkspaceView.tsx    # Split chat rail + preview/code/device/version workspace
      └─ ui/                  # Boxy 0px Radix + Tailwind UI primitives
         ├─ button.tsx
         ├─ dialog.tsx
         ├─ select.tsx
         ├─ skeleton.tsx
         ├─ sonner.tsx
         ├─ tabs.tsx
         ├─ textarea.tsx
         └─ tooltip.tsx
```

## Design system

Emdash follows a sharp, architectural grid layout inspired by [Culio](https://www.shadcn.io/demos/culio) and `shadcn/ui`:

- **Geometry:** `0px` border radius across all inputs, cards, buttons, and modals, anchored by `1px` `--edge` borders and 4-corner bracket accents (`CornerBrackets`).
- **Palette:** Warm zinc canvas (`#f6f6f6` light / `#121212` dark), crisp card surfaces (`#ffffff` / `#18181b`), and high-contrast international orange (`#ff5401`) for primary actions and active states.
- **Typography:** `Plus Jakarta Sans` for UI copy and headings; `JetBrains Mono` uppercase labels for controls, metadata, and version tags.

## Roadmap

- [ ] Persistent database storage (PostgreSQL / Firestore) for user projects and published `/p/:slug` routes
- [ ] Server-side daily quota tracking and authenticated project history
- [ ] Real rewarded-ad and display ad network integration
- [ ] Multi-file project export as `.zip` archives
- [ ] Custom `*.emdash.site` wildcard subdomain publishing
- [ ] Community-submitted starter templates

## Contributing

Contributions are welcome.

1. Fork the repository and create a feature branch: `git checkout -b feat/your-feature`
2. Make your changes and verify types & build:
   ```bash
   npm run lint
   npm run build
   ```
3. Commit with a clear message and open a pull request describing what changed and why.

## License

Released under the [MIT License](LICENSE).

---

<div align="center">

Built with care, supported by ads, free for everyone.

</div>
