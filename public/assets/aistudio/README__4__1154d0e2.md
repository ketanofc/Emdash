<div align="center">

# — Emdash

**Say it. Ship it.**

A free, ad-supported app builder. Describe what you want in plain language, preview it live, iterate through chat, then export or publish.

[Live demo](https://emdashworld.ai.studio/) · [Report a bug](../../issues) · [Request a feature](../../issues)

</div>

---

## Table of contents

- [Overview](#overview)
- [Features](#features)
- [Free, ad-supported model](#free-ad-supported-model)
- [Project status](#project-status)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Project structure](#project-structure)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## Overview

Most ideas stall between "I should build that" and "where do I even start?" Emdash closes that gap. You write a prompt such as *"a habit tracker with weekly streaks"*, and Emdash generates a working web app, shows it in a live preview, and lets you keep refining it by asking for changes ("make it dark", "use a purple accent", "add a pricing section").

Emdash is free to use. Each user gets **5 hours of build time per day**, funded by clearly labeled ads.

> The name comes from the em dash, the punctuation mark that connects one thought to the next. Emdash connects what you imagine to what exists.

## Features

**Build**
- Prompt-to-app generation from a single text box
- Streaming assistant replies with a visible "thinking" state
- Follow-up prompts that update the app and save each change as a new **version**
- Template gallery to start from a common idea

**Preview**
- Live, sandboxed preview
- Desktop, tablet, and mobile width switcher
- Preview / Code toggle
- Version picker to go back to any earlier result
- Reload control and generated URL bar

**Ship**
- Export the generated code
- One-click publish to a free `*.emdash.site` subdomain

**Experience**
- Minimal, shadcn-style interface
- Light and dark themes that follow the system setting
- Keyboard friendly (Enter to send, Esc to close dialogs)
- Respects `prefers-reduced-motion`
- Responsive layout down to mobile

## Free, ad-supported model

| Item | Detail |
| --- | --- |
| Daily allowance | 5 hours of build time, reset every 24 hours |
| Cost to start | Free, no credit card |
| Ads | Clearly labeled "Ad" placements: home page banner, template grid tile, workspace sidebar, and a card shown while the agent is building |
| Need more time? | Watch a 15-second rewarded ad to add 20 minutes |
| Quota display | Header pill with remaining time; turns amber when under 30 minutes |

Ads never replace or overlap generated app content.

## Project status

Emdash is in an **early stage**. The table below separates what the current UI covers from what is planned.

| Area | Status |
| --- | --- |
| Prompt, chat, and workspace UI | Prototype done |
| Preview with device switcher, code view, versions | Prototype done |
| Quota pill and rewarded-ad dialog | Prototype done (simulated) |
| Real AI code generation | Planned |
| Accounts and saved projects | Planned |
| Server-side quota enforcement | Planned |
| Real ad network integration | Planned |
| Export to zip and publish to subdomain | Planned |

## Tech stack

The stack below is the intended production setup, chosen so the whole product can run on free tiers.

| Layer | Choice |
| --- | --- |
| Frontend | Next.js, React, Tailwind CSS, shadcn/ui |
| Auth and database | Supabase (Postgres + Auth) |
| AI models | Free-tier providers behind one adapter (for example Gemini, Groq, OpenRouter, Cloudflare Workers AI) |
| In-browser runtime | Sandpack or WebContainers for live preview |
| Hosting | Vercel or Cloudflare Pages |
| Published apps | Static files on Cloudflare R2 / Pages |
| Ads | Google AdSense (banners) and a rewarded-ad network |

## Architecture

```
Browser
  ├─ Prompt UI ──────────────► /api/generate ──► Model adapter ──► Free AI providers
  │                                  │                  (fallback on rate limit)
  ├─ Sandboxed preview (iframe)      ▼
  │                             Supabase
  └─ Ad slots                   users · projects · versions · usage_daily
```

Key ideas:

1. **Model adapter.** One interface, many providers. If a provider hits its free rate limit, the request falls back to the next.
2. **Versions are immutable.** Every prompt creates a new version row, so users can always roll back.
3. **Quota is enforced on the server.** The client only displays it. Usage is recorded per user per day.
4. **Previews are sandboxed.** Generated code runs in an iframe with `sandbox` restrictions and never touches the host app.

Suggested tables:

| Table | Purpose |
| --- | --- |
| `users` | Account and profile |
| `projects` | One row per app (title, slug, owner) |
| `versions` | Generated files per prompt, linked to a project |
| `usage_daily` | Seconds of build time used per user per day |

## Getting started

### Prerequisites

- Node.js 20 or newer
- A package manager (npm, pnpm, or yarn)
- A Supabase project (free tier)
- At least one AI provider API key

### Install and run

```bash
# 1. Clone
git clone https://github.com/<your-username>/emdash.git
cd emdash

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# then fill in the values (see below)

# 4. Start the dev server
npm run dev
```

Open <http://localhost:3000>.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run the linter |

## Environment variables

Create `.env.local` with:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI providers (add the ones you use)
GEMINI_API_KEY=
GROQ_API_KEY=
OPENROUTER_API_KEY=

# Quota
DAILY_BUILD_SECONDS=18000
AD_EXTENSION_SECONDS=1200

# Ads
NEXT_PUBLIC_ADSENSE_CLIENT=
```

Never commit `.env.local`. Keep the service role key server-side only.

## Project structure

A suggested layout:

```
emdash/
├─ app/
│  ├─ page.tsx            # Home: prompt box + templates
│  ├─ studio/             # Workspace: chat + preview
│  └─ api/
│     ├─ generate/        # Prompt → code
│     ├─ usage/           # Quota read / extend
│     └─ publish/         # Publish to subdomain
├─ components/
│  ├─ ui/                 # shadcn/ui primitives
│  ├─ prompt-box.tsx
│  ├─ chat.tsx
│  ├─ preview.tsx
│  ├─ ad-slot.tsx
│  └─ quota-pill.tsx
├─ lib/
│  ├─ models/             # Provider adapters + fallback
│  ├─ quota.ts
│  └─ supabase.ts
├─ supabase/migrations/   # SQL schema
└─ public/
```

## Roadmap

- [ ] Real AI generation with provider fallback
- [ ] Sign in and saved projects
- [ ] Server-side daily quota
- [ ] Rewarded-ad flow with a real network
- [ ] Export as zip
- [ ] Publish to `*.emdash.site`
- [ ] Projects sidebar and search
- [ ] Multi-file apps and framework choices
- [ ] Pricing and upgrade page for heavier users
- [ ] Templates contributed by the community

## Contributing

Contributions are welcome.

1. Fork the repo and create a branch: `git checkout -b feat/your-feature`
2. Make your change and run `npm run lint`
3. Commit with a clear message
4. Open a pull request describing what changed and why

For larger changes, please open an issue first to discuss the approach.

## License

Released under the [MIT License](LICENSE).

---

<div align="center">

Built with care, supported by ads, free for everyone.

</div>
