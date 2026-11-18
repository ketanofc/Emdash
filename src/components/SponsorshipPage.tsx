import type React from "react";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { CornerBrackets } from "@/src/components/CornerBrackets";
import { cn } from "@/src/lib/utils";

export type SponsorPlacement = "composer" | "template" | "web-agent";

interface SponsorshipPageProps {
  onGoHome: () => void;
  onOpenWebAgent: () => void;
}

const PLACEMENT_META: Record<
  SponsorPlacement,
  {
    label: string;
    shortLabel: string;
    placementTag: string;
    cadence: string;
    summary: string;
  }
> = {
  composer: {
    label: "Home Composer Banner",
    shortLabel: "Composer Banner",
    placementTag: "Above fold",
    cadence: "Monthly · Above fold",
    summary: "Single-line native banner directly beneath the primary prompt input.",
  },
  template: {
    label: "Templates Grid Card",
    shortLabel: "Template Card",
    placementTag: "Gallery slot",
    cadence: "Monthly · Gallery slot",
    summary: "Dedicated card inside the 6-slot starter template gallery on the home page.",
  },
  "web-agent": {
    label: "Web Agent Workspace",
    shortLabel: "Web Agent Slot",
    placementTag: "IDE workspace",
    cadence: "Monthly · Open-source IDE",
    summary: "Pinned above the Web Agent chat composer and in the workspace sidebar footer.",
  },
};

const FAQ_ITEMS: ReadonlyArray<{
  id: string;
  question: string;
  answer: string;
}> = [
  {
    id: "non-intrusive",
    question: "How are sponsor placements kept non-intrusive for builders?",
    answer:
      "Every placement uses the same sharp grid geometry as Emdash itself, carries an explicit AD and SPONSORED label, and contains zero popups, autoplay media, or third-party tracking scripts.",
  },
  {
    id: "monthly-billing",
    question: "How does monthly sponsorship scheduling work?",
    answer:
      "Sponsorships run on a clean monthly basis across your chosen placement slot, with flexible renewal and zero long-term lock-in.",
  },
  {
    id: "pro-users",
    question: "Do paying Pro subscribers see sponsor placements?",
    answer:
      "No. Pro workspaces remain completely ad-free. Sponsor slots appear strictly inside free-tier Home Builder sessions and the open-source Web Agent to fund compute and model usage.",
  },
  {
    id: "attribution",
    question: "How can our team track clicks and campaign performance?",
    answer:
      "Monthly sponsorships support signed click IDs (emcid), outbound UTM attribution, and straightforward delivery summaries.",
  },
];

export function SponsorshipPage({
  onGoHome,
  onOpenWebAgent,
}: SponsorshipPageProps) {
  const [previewSlot, setPreviewSlot] = useState<SponsorPlacement>("composer");

  const [selectedSlot, setSelectedSlot] = useState<SponsorPlacement>("composer");
  const [customCampaign, setCustomCampaign] = useState<boolean>(false);
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState("");
  const [headline, setHeadline] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedRefId, setSubmittedRefId] = useState<string | null>(null);

  const [openFaqId, setOpenFaqId] = useState<string>(FAQ_ITEMS[0].id);

  const selectSlotAndScroll = (slot: SponsorPlacement) => {
    setSelectedSlot(slot);
    setPreviewSlot(slot);
    setCustomCampaign(false);
    setSubmittedRefId(null);
    setFormError(null);
    document
      .getElementById("campaign-inquiry")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmitInquiry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim()) {
      setFormError("Enter your company or developer product name.");
      return;
    }
    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setFormError("Enter a valid work email address.");
      return;
    }
    const cleanUrl = url.trim();
    if (cleanUrl && !/^https?:\/\/.+/i.test(cleanUrl)) {
      setFormError("Destination URL must start with https:// or http://.");
      return;
    }
    if (!headline.trim()) {
      setFormError("Provide a concise sponsor headline (up to 70 characters).");
      return;
    }

    setFormError(null);
    const refCode = `EMD-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${String(Date.now()).slice(-4)}`;
    setSubmittedRefId(refCode);
  };

  const resetInquiry = () => {
    setSubmittedRefId(null);
    setCompany("");
    setEmail("");
    setUrl("");
    setHeadline("");
    setCustomCampaign(false);
    setFormError(null);
  };

  const liveBrand = company.trim() || "CloudNest Edge Hosting";
  const liveHeadline =
    headline.trim() || "Deploy exported HTML in seconds · 3 months free for builders";

  return (
    <main className="flex-1 overflow-x-clip bg-background">
      {/* Top Diagonal Hatch Strip (Mirrors HomeView) */}
      <div className="w-full px-2">
        <div className="relative flex h-8 md:h-10 w-full min-w-0 md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto border-x border-edge bg-card hatch-pattern" />
      </div>

      {/* Hero Rail Section (Mirrors HomeView Hero) */}
      <section className="w-full px-2">
        <div className="screen-line-before screen-line-after relative w-full min-w-0 md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto flex flex-col items-center border-x border-edge bg-card px-2.5 sm:px-4 md:px-10 py-10 sm:py-14 md:py-20">
          <CornerBrackets />

          <a
            href="#campaign-inquiry"
            onClick={(e) => {
              e.preventDefault();
              selectSlotAndScroll(previewSlot);
            }}
            className="inline-flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 border border-edge bg-background min-h-8 font-mono uppercase text-[11px] sm:text-xs px-2.5 sm:px-3 py-1 text-foreground hover:border-primary transition-colors cursor-pointer max-w-full text-center"
          >
            <span className="bg-primary text-primary-foreground px-1.5 py-0.5 text-[10px] font-semibold">
              sponsore
            </span>
            <span>&amp; Reach developers</span>
          </a>

          <h1 className="mt-5 text-[32px] sm:text-[38px] leading-[1.04] lg:text-6xl tracking-tighter font-semibold max-w-2xl text-balance text-center text-foreground">
            Put your devtool inside every build.
          </h1>

          <p className="mt-4 max-w-xl tracking-tight text-muted-foreground text-sm lg:text-base text-center">
            Emdash stays free to start and open-source in the browser because developer sponsors fund model and compute costs through native, high-intent placements.
          </p>

          {/* Interactive Placement Preview Box (Mirrors HomeView Composer Box) */}
          <div className="relative mt-9 w-full max-w-2xl border border-edge bg-card p-3 sm:p-4">
            <CornerBrackets />

            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-edge">
              <span className="font-mono uppercase text-[10px] text-muted-foreground">
                Live placement preview
              </span>

              <div
                role="tablist"
                aria-label="Preview placement format"
                className="inline-flex flex-wrap items-center border border-edge bg-background p-0.5 gap-0.5"
              >
                {(["composer", "template", "web-agent"] as SponsorPlacement[]).map(
                  (slotKey) => {
                    const active = previewSlot === slotKey;
                    return (
                      <button
                        key={slotKey}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => {
                          setPreviewSlot(slotKey);
                          setSelectedSlot(slotKey);
                        }}
                        className={cn(
                          "px-2 py-1 font-mono uppercase text-[10px] transition-colors cursor-pointer whitespace-nowrap shrink-0",
                          active
                            ? "bg-card text-primary font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {PLACEMENT_META[slotKey].shortLabel}
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* Live Preview Stage */}
            <div className="py-4">
              {previewSlot === "composer" && (
                <div className="border border-dashed border-edge bg-background px-3.5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono uppercase text-[10px] font-semibold border border-edge px-1.5 py-0.5 text-primary bg-card shrink-0">
                      Ad
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-foreground truncate">
                        {liveBrand}: {liveHeadline}
                      </div>
                      <div className="font-mono uppercase text-[10px] text-muted-foreground mt-0.5">
                        Sponsored · Appears below main Home Builder input
                      </div>
                    </div>
                  </div>
                  <span className="h-7 px-2.5 border border-edge bg-card font-mono uppercase text-[10px] text-foreground inline-flex items-center shrink-0">
                    Visit site
                  </span>
                </div>
              )}

              {previewSlot === "template" && (
                <div className="max-w-xs mx-auto border border-edge bg-surface p-4 flex flex-col justify-between gap-3">
                  <div className="flex items-center justify-between w-full">
                    <span className="font-mono uppercase text-[10px] border border-edge px-1.5 py-0.5 text-primary bg-background">
                      Ad
                    </span>
                    <span className="font-mono uppercase text-[10px] text-muted-foreground">
                      Sponsored
                    </span>
                  </div>
                  <div className="aspect-[16/9] w-full border border-dashed border-edge bg-background p-3.5 flex flex-col justify-center items-start gap-2">
                    <span className="bg-primary text-primary-foreground px-2 py-0.5 font-mono uppercase text-[10px]">
                      {liveBrand}
                    </span>
                    <span className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {liveHeadline}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium text-xs text-foreground truncate">
                      {liveBrand}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      Templates gallery slot · High discovery intent
                    </div>
                  </div>
                </div>
              )}

              {previewSlot === "web-agent" && (
                <div className="border border-edge bg-background p-3">
                  <div className="border border-dashed border-edge bg-surface px-3 py-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono uppercase text-[10px] font-semibold border border-edge px-1.5 py-0.5 text-primary bg-card shrink-0">
                        Ad
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {liveBrand} · {liveHeadline}
                      </span>
                    </div>
                    <span className="font-mono uppercase text-[10px] text-muted-foreground shrink-0">
                      SPONSORED
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-edge">
              <div className="font-mono uppercase text-[11px] text-muted-foreground">
                <span className="text-foreground font-semibold">
                  {PLACEMENT_META[previewSlot].label}
                </span>
                <span className="mx-1.5" aria-hidden="true">
                  ·
                </span>
                <span>{PLACEMENT_META[previewSlot].cadence}</span>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="#campaign-formats"
                  onClick={(e) => {
                    e.preventDefault();
                    document
                      .getElementById("campaign-formats")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="h-9 px-3.5 border border-edge bg-background hover:border-neutral font-mono uppercase text-xs text-foreground inline-flex items-center transition-colors whitespace-nowrap"
                >
                  Compare formats
                </a>
                <Button
                  type="button"
                  onClick={() => selectSlotAndScroll(previewSlot)}
                  className="h-9 px-5 font-mono uppercase text-xs gap-2 whitespace-nowrap"
                >
                  <span>Book placement</span>
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Diagonal Hatch Separator (Mirrors HomeView) */}
      <div className="w-full px-2">
        <div className="relative flex h-8 md:h-10 w-full min-w-0 md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto border-x border-edge bg-card hatch-pattern" />
      </div>

      {/* Campaign Formats & Placements Rail Section (Mirrors HomeView Templates Rail) */}
      <section id="campaign-formats" className="w-full px-2">
        <div className="screen-line-before screen-line-after relative w-full min-w-0 md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto border-x border-edge bg-background px-2.5 sm:px-4 md:px-10 py-12 md:py-16">
          <CornerBrackets />

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-8">
            <div>
              <div className="font-mono uppercase text-xs text-primary mb-2">
                Monthly placements
              </div>
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
                Where your sponsorship appears
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Clean monthly developer placements across the Emdash builder and open-source Web Agent.
              </p>
            </div>
          </div>

          {/* 3-Column Placement Inventory Grid (Mirrors HomeView 3-col Template Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-edge border border-edge">
            {(["composer", "template", "web-agent"] as SponsorPlacement[]).map((slotKey) => {
              const info = PLACEMENT_META[slotKey];
              return (
                <button
                  key={slotKey}
                  type="button"
                  onClick={() => selectSlotAndScroll(slotKey)}
                  className="group bg-card hover:bg-muted/60 p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring flex flex-col cursor-pointer"
                >
                  <div className="flex items-center justify-between w-full mb-3.5">
                    <span className="font-mono uppercase text-[11px] text-muted-foreground">
                      {info.placementTag}
                    </span>
                    <span className="font-mono uppercase text-[11px] text-primary">
                      Select
                    </span>
                  </div>

                  {/* Schematic Placement Wireframe matching HomeView template thumbnails */}
                  <div className="aspect-[16/10] w-full border border-edge bg-background p-3.5 flex flex-col gap-1.5 overflow-hidden group-hover:border-primary/60 transition-colors">
                    {slotKey === "composer" && (
                      <>
                        <span className="block h-2 w-[48%] bg-foreground/75" />
                        <span className="block flex-1 border border-edge bg-card p-1.5" />
                        <span className="block h-3.5 w-full border border-dashed border-primary/70 bg-primary/10" />
                      </>
                    )}
                    {slotKey === "template" && (
                      <div className="grid grid-cols-3 gap-1.5 flex-1">
                        <span className="border border-edge bg-card" />
                        <span className="border border-edge bg-card" />
                        <span className="border border-edge bg-card" />
                        <span className="border border-edge bg-card" />
                        <span className="border border-edge bg-card" />
                        <span className="border border-dashed border-primary/80 bg-primary/15" />
                      </div>
                    )}
                    {slotKey === "web-agent" && (
                      <div className="flex gap-1.5 flex-1">
                        <div className="w-[32%] border border-edge bg-card p-1 flex flex-col justify-between">
                          <span className="block h-1.5 w-full bg-border" />
                          <span className="block h-3 w-full border border-dashed border-primary/70 bg-primary/10" />
                        </div>
                        <div className="flex-1 border border-edge bg-card p-1.5 flex flex-col justify-end gap-1">
                          <span className="block h-2 w-full border border-dashed border-primary/70 bg-primary/10" />
                          <span className="block h-3 w-full border border-edge bg-background" />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    <div className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                      {info.label}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {info.summary}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Monthly Campaign Team Callout */}
          <div className="mt-6 border border-dashed border-edge bg-card px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs sm:text-sm font-medium text-foreground">
                Planning to spend ₹1,25,000 ($1,500) or more a month?
              </div>
              <p className="text-xs text-muted-foreground">
                Talk through your campaign, custom placements, and monthly goals with our team.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCustomCampaign(true);
                setSubmittedRefId(null);
                setFormError(null);
                document
                  .getElementById("campaign-inquiry")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="h-8 px-3 border border-edge bg-background hover:border-primary hover:text-primary font-mono uppercase text-[11px] text-foreground transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            >
              Talk to our team
            </button>
          </div>
        </div>
      </section>

      {/* Diagonal Hatch Separator (Mirrors HomeView) */}
      <div className="w-full px-2">
        <div className="relative flex h-8 md:h-10 w-full min-w-0 md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto border-x border-edge bg-card hatch-pattern" />
      </div>

      {/* Attribution, FAQ & Inquiry Form Rail Section */}
      <section id="campaign-inquiry" className="w-full px-2">
        <div className="screen-line-before screen-line-after relative w-full min-w-0 md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto border-x border-edge bg-card px-2.5 sm:px-4 md:px-10 py-12 md:py-16">
          <CornerBrackets />

          <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-8 lg:gap-10 items-start">
            {/* Left Column: Sponsorship FAQ */}
            <div className="space-y-6">
              <div>
                <div className="font-mono uppercase text-xs text-primary mb-2">
                  Monthly sponsorship FAQ
                </div>
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground text-balance">
                  Built for developer tools, structured monthly.
                </h2>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  Clean first-party placements with flexible monthly campaigns in INR and zero third-party ad trackers.
                </p>
              </div>

              {/* FAQ Accordion */}
              <div className="space-y-2.5">
                <div className="border border-edge bg-background divide-y divide-edge">
                  {FAQ_ITEMS.map((item) => {
                    const isOpen = openFaqId === item.id;
                    return (
                      <div key={item.id}>
                        <button
                          type="button"
                          onClick={() =>
                            setOpenFaqId((prev) => (prev === item.id ? "" : item.id))
                          }
                          aria-expanded={isOpen}
                          className="w-full px-4 py-3 text-left flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors cursor-pointer"
                        >
                          <span className="text-xs sm:text-sm font-medium text-foreground">
                            {item.question}
                          </span>
                          <ChevronDown
                            className={cn(
                              "size-4 text-muted-foreground shrink-0 transition-transform duration-150",
                              isOpen && "rotate-180 text-primary"
                            )}
                          />
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-3.5 text-xs text-muted-foreground leading-relaxed">
                            {item.answer}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Sponsorship Inquiry Card */}
            <div className="relative border border-edge bg-background p-5 sm:p-6">
              <CornerBrackets />

              {submittedRefId ? (
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <div className="font-mono uppercase text-[11px] text-primary font-semibold">
                      Request recorded · {submittedRefId}
                    </div>
                    <h3 className="text-xl font-semibold tracking-tight text-foreground">
                      Sponsorship inquiry received
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      We logged your placement request for{" "}
                      <span className="text-foreground font-medium">{company}</span> and will follow up at{" "}
                      <span className="text-foreground font-medium">{email}</span> with available dates and onboarding details.
                    </p>
                  </div>

                  <div className="border border-edge bg-card p-4 space-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Selected slot</span>
                      <span className="text-foreground font-semibold">
                        {PLACEMENT_META[selectedSlot].label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Cadence</span>
                      <span className="text-foreground">
                        {customCampaign ? "Custom monthly campaign (₹1,25,000+ / mo)" : "Monthly"}
                      </span>
                    </div>
                    {url && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">URL</span>
                        <span className="text-foreground truncate max-w-[220px]">{url}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-edge">
                      <div className="text-[10px] uppercase text-muted-foreground mb-1">
                        Sponsor Copy
                      </div>
                      <div className="font-sans text-foreground">{headline}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetInquiry}
                      className="border-edge font-mono uppercase text-xs"
                    >
                      Submit another inquiry
                    </Button>
                    <Button
                      type="button"
                      onClick={onGoHome}
                      className="font-mono uppercase text-xs gap-1.5"
                    >
                      <span>Back to Builder</span>
                      <ArrowUpRight className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmitInquiry} className="space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono uppercase text-[11px] text-primary">
                        Reserve a placement
                      </span>
                      {customCampaign && (
                        <span className="font-mono uppercase text-[10px] text-primary">
                          Custom monthly campaign
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold tracking-tight text-foreground">
                      Launch a sponsorship campaign
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Choose a placement slot, enter your sponsor headline, and request upcoming monthly availability.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <span className="font-mono uppercase text-[10px] text-muted-foreground block">
                      Placement format
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                      {(
                        ["composer", "template", "web-agent"] as SponsorPlacement[]
                      ).map((slotKey) => {
                        const info = PLACEMENT_META[slotKey];
                        const active = selectedSlot === slotKey;
                        return (
                          <button
                            key={slotKey}
                            type="button"
                            onClick={() => {
                              setSelectedSlot(slotKey);
                              setPreviewSlot(slotKey);
                            }}
                            className={cn(
                              "border p-2.5 text-left transition-colors cursor-pointer",
                              active
                                ? "border-primary bg-primary/5"
                                : "border-edge bg-card hover:border-neutral"
                            )}
                          >
                            <div className="text-xs font-semibold text-foreground truncate">
                              {info.shortLabel}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="grid gap-1">
                      <span className="font-mono uppercase text-[10px] text-muted-foreground">
                        Company or product
                      </span>
                      <input
                        type="text"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="CloudNest"
                        className="h-9 border border-edge bg-card px-3 text-xs text-foreground outline-none focus-visible:border-primary"
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="font-mono uppercase text-[10px] text-muted-foreground">
                        Work email
                      </span>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="growth@cloudnest.dev"
                        className="h-9 border border-edge bg-card px-3 text-xs text-foreground outline-none focus-visible:border-primary"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="grid gap-1">
                      <span className="font-mono uppercase text-[10px] text-muted-foreground">
                        Destination URL
                      </span>
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://cloudnest.dev"
                        className="h-9 border border-edge bg-card px-3 text-xs text-foreground outline-none focus-visible:border-primary"
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="font-mono uppercase text-[10px] text-muted-foreground">
                        Selected slot
                      </span>
                      <select
                        value={selectedSlot}
                        onChange={(e) => {
                          const next = e.target.value as SponsorPlacement;
                          setSelectedSlot(next);
                          setPreviewSlot(next);
                        }}
                        className="h-9 w-full border border-edge bg-card px-2.5 text-xs text-foreground outline-none focus-visible:border-primary cursor-pointer"
                      >
                        <option value="composer">Home Composer Banner</option>
                        <option value="template">Templates Grid Card</option>
                        <option value="web-agent">Web Agent Workspace</option>
                      </select>
                    </label>
                  </div>

                  <label className="grid gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono uppercase text-[10px] text-muted-foreground">
                        Sponsor headline
                      </span>
                    </div>
                    <input
                      type="text"
                      maxLength={70}
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      placeholder="Deploy exported HTML in seconds with 3 months free"
                      className="h-9 border border-edge bg-card px-3 text-xs text-foreground outline-none focus-visible:border-primary"
                    />
                  </label>

                  {formError && (
                    <div className="border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs font-mono text-destructive">
                      {formError}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-10 font-mono uppercase text-xs gap-2"
                  >
                    <span>Request sponsorship slot</span>
                    <ArrowRight className="size-3.5" />
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Diagonal Hatch Strip leading into Footer (Mirrors HomeView / WebAgentLandingSection) */}
      <div className="w-full px-2">
        <div className="relative flex h-8 md:h-10 w-full min-w-0 md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto border-x border-edge bg-card hatch-pattern" />
      </div>
    </main>
  );
}
