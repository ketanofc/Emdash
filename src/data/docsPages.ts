import type { DocSection } from "@/src/components/Footer";

export interface PageMeta {
  id: DocSection;
  path: string;
  group: "support" | "legal";
  docCode: string;
  readTime: string;
  updatedAt: string;
  badgeTag: string;
  badgeLabel: string;
  title: string;
  subtitle: string;
  shortTitle: string;
  cardSummary: string;
}

export const INFO_PAGES: Record<DocSection, PageMeta> = {
  docs: {
    id: "docs",
    path: "/docs",
    group: "support",
    docCode: "DOC-01",
    readTime: "3 min read",
    updatedAt: "Nov 2026",
    badgeTag: "DOCS",
    badgeLabel: "Support documentation",
    title: "Support documentation",
    subtitle:
      "Architecture overview, prompting workflows, reference file uploads, Dash Coin rules, and code export guides for Emdash.",
    shortTitle: "Support documentation",
    cardSummary: "Central documentation hub covering workflows, uploads, quotas, and help.",
  },
  quickstart: {
    id: "quickstart",
    path: "/quickstart",
    group: "support",
    docCode: "DOC-02",
    readTime: "4 min read",
    updatedAt: "Nov 2026",
    badgeTag: "GUIDE",
    badgeLabel: "Quickstart guide",
    title: "Quickstart guide",
    subtitle:
      "Go from a plain-English prompt or mockup screenshot to a live previewed, versioned, and exportable application in under two minutes.",
    shortTitle: "Quickstart guide",
    cardSummary: "Four-step walkthrough from prompt entry to live Sandpack preview and .zip export.",
  },
  prompting: {
    id: "prompting",
    path: "/prompting",
    group: "support",
    docCode: "DOC-03",
    readTime: "5 min read",
    updatedAt: "Nov 2026",
    badgeTag: "GUIDE",
    badgeLabel: "Prompting & file uploads",
    title: "Prompting & file uploads",
    subtitle:
      "Structure high-precision prompts, trigger React + TypeScript vs. static output, and attach screenshots, SVGs, PDFs, or source files.",
    shortTitle: "Prompting & file uploads",
    cardSummary: "Supported attachment formats (up to 4 files, 4 MB each) and prompt blueprints.",
  },
  faq: {
    id: "faq",
    path: "/faq",
    group: "support",
    docCode: "DOC-04",
    readTime: "4 min read",
    updatedAt: "Nov 2026",
    badgeTag: "FAQ",
    badgeLabel: "Frequently asked questions",
    title: "Frequently asked questions",
    subtitle:
      "Detailed answers on daily Dash Coins, automatic failure refunds, React & static exports, Web Agent BYOK keys, and ad-supported tiers.",
    shortTitle: "FAQ",
    cardSummary: "Daily Dash Coins, automatic refunds, .zip exports, Web Agent keys, and pricing.",
  },
  support: {
    id: "support",
    path: "/support",
    group: "support",
    docCode: "DOC-05",
    readTime: "2 min read",
    updatedAt: "Nov 2026",
    badgeTag: "SUPPORT",
    badgeLabel: "Email support",
    title: "Email support",
    subtitle:
      "Reach our team at info@emdash.world or send a message using the form below.",
    shortTitle: "Email support",
    cardSummary: "Direct info@emdash.world contact details and support form.",
  },
  legal: {
    id: "legal",
    path: "/legal",
    group: "legal",
    docCode: "LEG-01",
    readTime: "3 min read",
    updatedAt: "Nov 2026",
    badgeTag: "LEGAL",
    badgeLabel: "Legal & compliance",
    title: "Legal overview",
    subtitle:
      "Summary of Emdash's legal agreements, 100% generated source code ownership, privacy commitments, and security governance links.",
    shortTitle: "Legal",
    cardSummary: "Overview of Emdash policies, user ownership guarantees, and compliance links.",
  },
  privacy: {
    id: "privacy",
    path: "/privacy",
    group: "legal",
    docCode: "LEG-02",
    readTime: "5 min read",
    updatedAt: "Nov 2026",
    badgeTag: "LEGAL",
    badgeLabel: "Privacy Policy",
    title: "Privacy Policy",
    subtitle:
      "How Emdash processes prompts and reference attachments, stores workspace versions locally in your browser, and avoids tracking pixels.",
    shortTitle: "Privacy Policy",
    cardSummary: "How prompts, reference files, browser IndexedDB storage, and sessions are handled.",
  },
  terms: {
    id: "terms",
    path: "/terms",
    group: "legal",
    docCode: "LEG-03",
    readTime: "5 min read",
    updatedAt: "Nov 2026",
    badgeTag: "LEGAL",
    badgeLabel: "Terms of Service",
    title: "Terms of Service",
    subtitle:
      "Full commercial ownership of generated code, daily Dash Coin fairness and automatic refunds, sponsor placements, and acceptable use.",
    shortTitle: "Terms of Service",
    cardSummary: "Code ownership rights, daily Dash Coin fairness, and acceptable platform use.",
  },
  security: {
    id: "security",
    path: "/security",
    group: "legal",
    docCode: "SEC-01",
    readTime: "4 min read",
    updatedAt: "Nov 2026",
    badgeTag: "SECURITY",
    badgeLabel: "Security architecture",
    title: "Security",
    subtitle:
      "Layered security controls covering sandboxed preview frames, AES-256-GCM vault encryption, scrypt + TOTP MFA, and secret redaction.",
    shortTitle: "Security",
    cardSummary: "Preview isolation, server-side AI boundaries, MFA protection, and vulnerability reporting.",
  },
  trust: {
    id: "trust",
    path: "/trust",
    group: "legal",
    docCode: "SEC-02",
    readTime: "4 min read",
    updatedAt: "Nov 2026",
    badgeTag: "TRUST",
    badgeLabel: "Trust Center",
    title: "Trust Center",
    subtitle:
      "Verifiable platform safeguards, data residency and local browser storage inventory, runtime isolation guarantees, and disclosure channels.",
    shortTitle: "Trust Center",
    cardSummary: "Live transparency overview covering sandboxing, transport security, and data control.",
  },
  blog: {
    id: "blog",
    path: "/blog",
    group: "support",
    docCode: "DOC-06",
    readTime: "4 min read",
    updatedAt: "Nov 2026",
    badgeTag: "BLOG",
    badgeLabel: "Engineering & release notes",
    title: "Engineering notes",
    subtitle:
      "Technical write-ups on Emdash's four-stage synthesis pipeline, Dash Coin wallet fairness, and open-source Web Agent architecture.",
    shortTitle: "Blog",
    cardSummary: "Engineering notes on multi-stage synthesis, Dash Coins, and code exports.",
  },
};

export const SUPPORT_GROUP_PAGES: DocSection[] = [
  "docs",
  "quickstart",
  "prompting",
  "faq",
  "support",
];

export const LEGAL_GROUP_PAGES: DocSection[] = [
  "legal",
  "privacy",
  "terms",
  "security",
  "trust",
];

export const DOCS_ORDER: DocSection[] = [
  ...SUPPORT_GROUP_PAGES,
  ...LEGAL_GROUP_PAGES,
  "blog",
];

export const FAQ_LIST: ReadonlyArray<{
  id: string;
  category: string;
  question: string;
  answer: string;
}> = [
  {
    id: "dash-coins",
    category: "Dash Coins",
    question: "How do daily Dash Coins work on the Free tier?",
    answer:
      "Every account receives 100 Dash Coins daily (resetting on a 24-hour UTC schedule). Each build generation costs 10 Dash Coins, while automatic runtime error repairs cost 0 Dash Coins.",
  },
  {
    id: "auto-refund",
    category: "Dash Coins",
    question: "What happens to my Dash Coins if a build fails?",
    answer:
      "If a generation job fails due to upstream provider demand or a network timeout, Emdash automatically refunds the spent Dash Coins back to your wallet ledger.",
  },
  {
    id: "export-formats",
    category: "Exports",
    question: "What formats can I export and how do I run the code locally?",
    answer:
      "You can download any version as a complete .zip archive via JSZip. Static builds include index.html, style.css, and app.js; React + TypeScript builds include package.json, Vite config, Tailwind config, and modular src/components/* files.",
  },
  {
    id: "code-ownership",
    category: "Ownership",
    question: "Do I own the generated applications for commercial use?",
    answer:
      "Yes. You retain full ownership of every line of code generated and exported in Emdash, with no attribution requirements or deployment lock-in.",
  },
  {
    id: "web-agent-byok",
    category: "Web Agent",
    question: "How do API keys work in the open-source Web Agent (/web)?",
    answer:
      "In the Web Agent Settings drawer, you can paste your own API key for Gemini, OpenAI, Anthropic, or OpenRouter. Keys are stored locally in your browser (emdash:web_agent_byok), sent only when you execute a prompt, and redacted from error responses.",
  },
  {
    id: "pro-ads",
    category: "Sponsorships",
    question: "Do ads ever appear inside the apps I build or preview?",
    answer:
      "Never. Sponsor placements appear strictly on designated free-tier surfaces (Home Composer Banner, Templates Grid Card, and Web Agent Workspace) and are completely absent from generated previews and Pro workspaces.",
  },
];

export const PROMPT_BLUEPRINTS: ReadonlyArray<{
  label: string;
  mode: "static" | "react-ts";
  prompt: string;
  whyItWorks: string;
}> = [
  {
    label: "SaaS Analytics Dashboard",
    mode: "react-ts",
    prompt:
      "Build a React TypeScript analytics dashboard for a developer API platform with date-range filters, KPI metric cards, a dark slate surface, and an interactive request latency table.",
    whyItWorks: "Triggers react-ts mode explicitly and defines state controls + visual surface.",
  },
  {
    label: "Artisan Bakery Storefront",
    mode: "static",
    prompt:
      "Build a warm editorial landing page for a sourdough bakery with a daily bake schedule, menu filter tabs (Loaves, Pastries, Coffee), and an order pickup request modal.",
    whyItWorks: "Names specific interactive sections and filter states cleanly.",
  },
  {
    label: "Interactive Budget Planner",
    mode: "static",
    prompt:
      "Build a personal monthly budget planner with category allocation sliders, expense logging saved to localStorage, and live remaining balance calculation.",
    whyItWorks: "Specifies client-side persistence and exact math interactions.",
  },
];

export const ATTACHMENT_MATRIX: ReadonlyArray<{
  category: string;
  formats: string;
  handling: string;
  limit: string;
}> = [
  {
    category: "Screenshots & Mockups",
    formats: "PNG, JPG, WebP, GIF, HEIC, BMP, AVIF",
    handling: "Sent as inline vision data (unsupported formats auto-rasterize to PNG)",
    limit: "4 MB / file",
  },
  {
    category: "Vector Graphics",
    formats: "SVG",
    handling: "Parsed as XML source + thumbnail preview for exact vector replication",
    limit: "60 KB text cap",
  },
  {
    category: "Documents & Media",
    formats: "PDF, MP3, WAV, OGG, MP4, WebM",
    handling: "Attached natively as Gemini inline media context",
    limit: "4 MB / file",
  },
  {
    category: "Code & Structured Data",
    formats: "HTML, CSS, TS, TSX, JSON, MD, CSV, SQL, YAML",
    handling: "Injected cleanly as utf-8 reference context into the Brief & Build stages",
    limit: "60 KB text cap",
  },
];
