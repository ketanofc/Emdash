import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildStaticPreviewHtml,
  contrastRatio,
  injectTokens,
  normalizeBrief,
  parseFiles,
  runPipeline,
  tokensCss,
  validateFiles,
} from "./pipeline";
import type { DesignBrief, PipelineStage } from "@/src/types";

function makeSampleBrief(overrides?: Partial<DesignBrief>): DesignBrief {
  return {
    appName: "Oak & Ember Roastery",
    appType: "Coffee Roastery Landing Page",
    audience: "Specialty coffee drinkers",
    tone: "Warm editorial",
    layout: "Hero + Roast Grid + Story + Footer",
    notes: "Forest green and cream palette with serif headings",
    mode: "static",
    dark: false,
    palette: {
      primary: "#1f4d3a",
      secondary: "#d8ceb8",
      accent: "#b45309",
      background: "#f5efe0",
      surface: "#fffdf7",
      text: "#18241d",
      muted: "#526057",
    },
    fonts: {
      heading: "Georgia",
      body: "system-ui",
    },
    sections: ["Hero", "Single-origin lots", "Roasting story", "Footer"],
    features: ["Interactive roast filter", "Newsletter signup"],
    ...overrides,
  };
}

describe("parseFiles", () => {
  it("parses summary and multiple tagged files cleanly", () => {
    const reply = `Built a coffee roastery landing page.
<file path="index.html">
<!doctype html>
<html><head><link rel="stylesheet" href="style.css"></head><body><script src="app.js"></script></body></html>
</file>
<file path="/style.css">
body { background: var(--bg); color: var(--text); }
</file>
<file path="app.js">
console.log("ready");
</file>`;

    const parsed = parseFiles(reply);
    expect(parsed.summary).toBe("Built a coffee roastery landing page.");
    expect(Object.keys(parsed.files)).toEqual(["index.html", "style.css", "app.js"]);
    expect(parsed.files["style.css"]).toContain("var(--bg)");
  });

  it("returns empty files map on malformed reply", () => {
    const parsed = parseFiles("Here is some code without file tags.");
    expect(Object.keys(parsed.files)).toHaveLength(0);
  });
});

describe("contrastRatio & normalizeBrief", () => {
  it("computes WCAG contrast accurately", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#1f4d3a", "#f5efe0")).toBeGreaterThan(7);
  });

  it("replaces low-contrast text with highest-contrast #0a0a0a or #fafafa", () => {
    const lowContrastLight = makeSampleBrief({
      palette: {
        primary: "#1f4d3a",
        secondary: "#d8ceb8",
        accent: "#b45309",
        background: "#f5efe0",
        surface: "#ffffff",
        text: "#e5dec9",
        muted: "#526057",
      },
    });
    const fixedLight = normalizeBrief(lowContrastLight);
    expect(fixedLight.palette.text).toBe("#0a0a0a");

    const lowContrastDark = makeSampleBrief({
      dark: true,
      palette: {
        primary: "#ff5401",
        secondary: "#27272a",
        accent: "#ff5401",
        background: "#121212",
        surface: "#18181b",
        text: "#222222",
        muted: "#9f9fa9",
      },
    });
    const fixedDark = normalizeBrief(lowContrastDark);
    expect(fixedDark.palette.text).toBe("#fafafa");
  });

  it("preserves already high-contrast text color", () => {
    const brief = normalizeBrief(makeSampleBrief());
    expect(brief.palette.text).toBe("#18241d");
    expect(brief.palette.primary).toBe("#1f4d3a");
    expect(brief.palette.background).toBe("#f5efe0");
  });
});

describe("tokensCss & injectTokens", () => {
  it("strips model :root block and prepends deterministic tokens in static style.css", () => {
    const brief = normalizeBrief(makeSampleBrief());
    const files = injectTokens(
      {
        "index.html": "<html></html>",
        "style.css": `:root {\n  --primary: #ff0000;\n}\nbody {\n  background: var(--bg);\n  color: var(--text);\n}`,
        "app.js": "const ready = true;",
      },
      brief
    );

    expect(files["style.css"].startsWith(tokensCss(brief))).toBe(true);
    expect(files["style.css"]).not.toContain("#ff0000");
    expect(files["style.css"]).toContain("--primary: #1f4d3a;");
    expect(files["style.css"]).toContain("--bg: #f5efe0;");
    expect(files["style.css"]).toContain("background: var(--bg);");
  });

  it("injects tokens into src/index.css for react-ts mode", () => {
    const brief = normalizeBrief(makeSampleBrief({ mode: "react-ts" }));
    const files = injectTokens(
      {
        "src/index.css": ":root { --bg: #000000; }\nbody { color: var(--text); }",
      },
      brief
    );
    expect(files["src/index.css"]).toContain("--bg: #f5efe0;");
    expect(files["src/index.css"]).not.toContain("#000000");
  });
});

describe("validateFiles", () => {
  it("passes a clean static file set", () => {
    const brief = normalizeBrief(makeSampleBrief());
    const files = injectTokens(
      {
        "index.html": `<!doctype html>
<html>
<head><link rel="stylesheet" href="style.css"></head>
<body><h1>Roastery</h1><script src="app.js"></script></body>
</html>`,
        "style.css": "body { background: var(--bg); color: var(--text); }",
        "app.js": 'document.addEventListener("DOMContentLoaded", () => {});',
      },
      brief
    );
    expect(validateFiles(files, brief)).toEqual([]);
  });

  it("flags TODO, lorem ipsum, trailing ellipsis, disallowed scripts, hex outside :root, TS any, and missing links", () => {
    const brief = normalizeBrief(makeSampleBrief());
    const badStatic = injectTokens(
      {
        "index.html": `<html><body><script src="https://evil.example.com/x.js"></script></body></html>`,
        "style.css": "body { color: #123456; /* TODO */ }",
        "app.js": "const text = 'lorem ipsum';\n// ...",
      },
      brief
    );

    const staticErrors = validateFiles(badStatic, brief);
    expect(staticErrors.some((e) => e.includes("TODO"))).toBe(true);
    expect(staticErrors.some((e) => e.includes("lorem ipsum"))).toBe(true);
    expect(staticErrors.some((e) => e.includes("trailing"))).toBe(true);
    expect(staticErrors.some((e) => e.includes("disallowed external script"))).toBe(true);
    expect(staticErrors.some((e) => e.includes("hard-coded hex"))).toBe(true);
    expect(staticErrors.some((e) => e.includes("style.css"))).toBe(true);
    expect(staticErrors.some((e) => e.includes("app.js"))).toBe(true);

    const reactBrief = normalizeBrief(makeSampleBrief({ mode: "react-ts" }));
    const badReact = injectTokens(
      {
        "index.html": `<html><script src="https://cdnjs.cloudflare.com/ajax/libs/dayjs/1.11.10/dayjs.min.js"></script></html>`,
        "package.json": "{}",
        "tsconfig.json": "{}",
        "vite.config.ts": "export default {};",
        "tailwind.config.ts": "export default {};",
        "postcss.config.js": "export default {};",
        "src/main.tsx": "export {};",
        "src/App.tsx": "const x: any = 1; export default function App(){ return null; }",
        "src/index.css": "body { color: var(--text); }",
        "src/types.ts": "export interface Row { id: string; }",
        "src/components/Card.tsx": "export function Card(v: unknown) { return (v as any); }",
      },
      reactBrief
    );
    const reactErrors = validateFiles(badReact, reactBrief);
    expect(reactErrors.filter((e) => e.includes('TypeScript "any"'))).toHaveLength(2);
    expect(reactErrors.some((e) => e.includes("cdnjs.cloudflare.com"))).toBe(false);
  });

  it("does not misclassify CSS ID selectors like #feed or SVG url(#fade) as hard-coded hex colors", () => {
    const brief = normalizeBrief(makeSampleBrief());
    const files = injectTokens(
      {
        "index.html": `<!doctype html><html><head><link rel="stylesheet" href="style.css"></head><body><section id="feed"></section><script src="app.js"></script></body></html>`,
        "style.css": "#feed { display: grid; gap: 1rem; }\n.badge { filter: url(#fade); color: var(--primary); }",
        "app.js": "const feed = document.getElementById('feed');",
      },
      brief
    );
    expect(validateFiles(files, brief)).toEqual([]);
  });
});

function mockServerGenerateResponse(text: string): Response {
  return new Response(JSON.stringify({ text }), { status: 200 });
}

describe("runPipeline end-to-end (mocked server endpoint)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("runs brief -> plan -> build -> tokens -> check -> repair for static mode and fixes validation errors", async () => {
    const brief = makeSampleBrief();
    const plan = {
      files: [
        { path: "index.html", purpose: "Landing page markup" },
        { path: "style.css", purpose: "Responsive CSS using variables" },
        { path: "app.js", purpose: "Interactive roast filter" },
      ],
      components: ["Hero", "RoastCatalog"],
      state: ["selectedOrigin"],
      interactions: ["Filter roasts by origin"],
    };

    const brokenBuild = `Built Oak & Ember Roastery.
<file path="index.html">
<!doctype html><html><head><link rel="stylesheet" href="style.css"></head><body><main id="feed"></main><script src="app.js"></script></body></html>
</file>
<file path="style.css">
body { color: #990000; background: var(--bg); }
</file>
<file path="app.js">
console.log("roastery ready");
</file>`;

    const repairedBuild = `Fixed CSS to use design token variables only.
<file path="style.css">
body { color: var(--text); background: var(--bg); font-family: var(--font-body); }
</file>`;

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockServerGenerateResponse(JSON.stringify(brief)))
      .mockResolvedValueOnce(mockServerGenerateResponse(JSON.stringify(plan)))
      .mockResolvedValueOnce(mockServerGenerateResponse(brokenBuild))
      .mockResolvedValueOnce(mockServerGenerateResponse(repairedBuild));

    vi.stubGlobal("fetch", fetchMock);

    const stages: PipelineStage[] = [];
    const res = await runPipeline(
      "Build a warm coffee roastery landing page (#1f4d3a green, #f5efe0 cream)",
      { model: "gemini-4-hydrogen" },
      (s) => stages.push(s)
    );

    expect(stages).toEqual(["brief", "plan", "build", "check", "repair", "check"]);
    expect(res.brief.mode).toBe("static");
    expect(res.files["style.css"]).toContain("--primary: #1f4d3a;");
    expect(res.files["style.css"]).toContain("--bg: #f5efe0;");
    expect(res.files["style.css"]).not.toContain("#990000");
    expect(validateFiles(res.files, res.brief)).toEqual([]);

    const previewHtml = buildStaticPreviewHtml(res.files, 1);
    expect(previewHtml).toContain("emdash-runtime-error");
    expect(previewHtml).toContain("--primary: #1f4d3a;");
  });

  it("supports react-ts mode and follow-up edits preserving unmodified files", async () => {
    const reactBrief = makeSampleBrief({
      appName: "PulseOps Dashboard",
      mode: "react-ts",
      dark: true,
      palette: {
        primary: "#ff5401",
        secondary: "#27272a",
        accent: "#ff5401",
        background: "#111113",
        surface: "#18181b",
        text: "#fafafa",
        muted: "#a1a1aa",
      },
    });
    const reactPlan = {
      files: [
        { path: "index.html", purpose: "Entry HTML" },
        { path: "package.json", purpose: "Dependencies" },
        { path: "tsconfig.json", purpose: "TS config" },
        { path: "vite.config.ts", purpose: "Vite config" },
        { path: "tailwind.config.ts", purpose: "Tailwind config" },
        { path: "postcss.config.js", purpose: "PostCSS" },
        { path: "src/main.tsx", purpose: "Mount React" },
        { path: "src/App.tsx", purpose: "Dashboard root" },
        { path: "src/index.css", purpose: "Global styles" },
        { path: "src/types.ts", purpose: "Shared interfaces" },
        { path: "src/components/MetricCard.tsx", purpose: "Metric card" },
      ],
      components: ["MetricCard"],
      state: ["rangeFilter"],
      interactions: ["Switch date range"],
    };

    const reactFilesReply = `Built PulseOps Dashboard in React and TypeScript.
<file path="index.html">
<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>
</file>
<file path="package.json">
{"name":"pulseops","private":true}
</file>
<file path="tsconfig.json">
{"compilerOptions":{"strict":true}}
</file>
<file path="vite.config.ts">
export default {};
</file>
<file path="tailwind.config.ts">
export default {};
</file>
<file path="postcss.config.js">
export default {};
</file>
<file path="src/main.tsx">
import App from "./App"; export { App };
</file>
<file path="src/App.tsx">
import { MetricCard } from "./components/MetricCard"; export default function App() { return <MetricCard label="MRR" value="$42,000" />; }
</file>
<file path="src/index.css">
body { background: var(--bg); color: var(--text); }
</file>
<file path="src/types.ts">
export interface Metric { label: string; value: string; }
</file>
<file path="src/components/MetricCard.tsx">
export function MetricCard({ label, value }: { label: string; value: string }) { return <div className="bg-[var(--surface)]">{label}: {value}</div>; }
</file>`;

    const editReply = `Added quick export button to MetricCard.
<file path="src/components/MetricCard.tsx">
export function MetricCard({ label, value }: { label: string; value: string }) { return <div className="bg-[var(--surface)]">{label}: {value} · Live</div>; }
</file>`;

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockServerGenerateResponse(JSON.stringify(reactBrief)))
      .mockResolvedValueOnce(mockServerGenerateResponse(JSON.stringify(reactPlan)))
      .mockResolvedValueOnce(mockServerGenerateResponse(reactFilesReply))
      .mockResolvedValueOnce(mockServerGenerateResponse(JSON.stringify(reactBrief)))
      .mockResolvedValueOnce(mockServerGenerateResponse(JSON.stringify(reactPlan)))
      .mockResolvedValueOnce(mockServerGenerateResponse(editReply));

    vi.stubGlobal("fetch", fetchMock);

    const v1 = await runPipeline("Build a dark SaaS metrics dashboard in React TypeScript", {
      model: "gemini-4-hydrogen",
    });
    expect(v1.brief.mode).toBe("react-ts");
    expect(Object.keys(v1.files)).toContain("src/components/MetricCard.tsx");
    expect(validateFiles(v1.files, v1.brief)).toEqual([]);

    const v2 = await runPipeline("Add a live badge to MetricCard", {
      model: "gemini-4-hydrogen",
      brief: v1.brief,
      files: v1.files,
    });
    expect(v2.files["src/components/MetricCard.tsx"]).toContain("Live");
    expect(v2.files["src/App.tsx"]).toBe(v1.files["src/App.tsx"]);
    expect(v2.brief.palette.primary).toBe("#ff5401");
  });
});
