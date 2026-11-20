import type React from "react";
import { useState } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import {
  DocHeading,
  DocsLayout,
  type DocsPageProps,
  type TocItem,
} from "@/src/components/docs/DocsLayout";

const TOC: TocItem[] = [
  { id: "direct-contact", label: "Contact Email" },
  { id: "support-form", label: "Send a Message" },
];

export function EmailSupportPage(props: DocsPageProps) {
  const { onSelectPage, onGoHome, onOpenWebAgent } = props;

  const [supportName, setSupportName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportTopic, setSupportTopic] = useState("General Support");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportError, setSupportError] = useState<string | null>(null);
  const [ticketRef, setTicketRef] = useState<string | null>(null);

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportName.trim()) {
      setSupportError("Please enter your name.");
      return;
    }
    const cleanEmail = supportEmail.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setSupportError("Please enter a valid email address.");
      return;
    }
    if (supportMessage.trim().length < 10) {
      setSupportError("Please add a brief message before continuing.");
      return;
    }

    setSupportError(null);
    const id = `EMD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    setTicketRef(id);
  };

  return (
    <DocsLayout
      page="support"
      toc={TOC}
      onSelectPage={onSelectPage}
      onGoHome={onGoHome}
      onOpenWebAgent={onOpenWebAgent}
    >
      <section className="space-y-4">
        <DocHeading id="direct-contact">Direct email</DocHeading>
        <p className="text-muted-foreground">
          For workspace help, account questions, security reports, or sponsorship inquiries on{" "}
          <span className="text-foreground font-medium">emdash.world</span>, email us at{" "}
          <a
            href="mailto:info@emdash.world"
            className="font-sans font-normal text-foreground underline underline-offset-4 hover:text-[#c23a00] dark:hover:text-primary"
          >
            info@emdash.world
          </a>
          .
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <a
            href="mailto:info@emdash.world"
            className="inline-flex items-center gap-2 h-9 px-4 bg-primary text-primary-foreground font-sans text-sm font-normal hover:opacity-90 transition-opacity"
          >
            <Mail className="size-3.5" />
            <span>info@emdash.world</span>
          </a>
        </div>
      </section>

      <section className="space-y-4">
        <DocHeading id="support-form">Send a message</DocHeading>
        <p className="text-muted-foreground text-sm">
          Fill out the form below to open a pre-formatted draft directly to{" "}
          <span className="font-sans font-normal text-foreground">info@emdash.world</span>.
        </p>

        {ticketRef ? (
          <div className="border-l-2 border-primary pl-5 py-2 space-y-3">
            <div className="font-mono uppercase text-xs text-[#c23a00] dark:text-primary font-semibold">
              Draft Ready · {ticketRef}
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your message under{" "}
              <strong className="text-foreground">{supportTopic}</strong> is ready to send.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <a
                href={`mailto:info@emdash.world?subject=${encodeURIComponent(
                  `[${ticketRef}] ${supportTopic}`
                )}&body=${encodeURIComponent(
                  `Name: ${supportName}\nReply-To: ${supportEmail}\n\n${supportMessage}`
                )}`}
                className="inline-flex items-center gap-2 h-9 px-4 bg-primary text-primary-foreground font-mono uppercase text-xs font-medium"
              >
                <Mail className="size-3.5" />
                <span>Open in Email App</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  setTicketRef(null);
                  setSupportMessage("");
                }}
                className="text-xs font-mono uppercase text-muted-foreground hover:text-foreground underline underline-offset-4 cursor-pointer"
              >
                New message
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSupportSubmit} className="space-y-4 pt-1 max-w-xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block space-y-1.5">
                <span className="font-mono uppercase text-[11px] text-muted-foreground block">
                  Name
                </span>
                <input
                  type="text"
                  value={supportName}
                  onChange={(e) => setSupportName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="w-full h-9 px-3 border border-edge bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="font-mono uppercase text-[11px] text-muted-foreground block">
                  Email
                </span>
                <input
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  placeholder="you@domain.com"
                  className="w-full h-9 px-3 border border-edge bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="font-mono uppercase text-[11px] text-muted-foreground block">
                Topic
              </span>
              <select
                value={supportTopic}
                onChange={(e) => setSupportTopic(e.target.value)}
                className="w-full h-9 px-3 border border-edge bg-card text-sm text-foreground focus:outline-none focus:border-primary"
              >
                <option>General Support</option>
                <option>Dash Coins &amp; Account</option>
                <option>Web Agent BYOK</option>
                <option>Security Disclosure</option>
                <option>Sponsorship Inquiry</option>
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="font-mono uppercase text-[11px] text-muted-foreground block">
                Message
              </span>
              <textarea
                rows={4}
                value={supportMessage}
                onChange={(e) => setSupportMessage(e.target.value)}
                placeholder="How can we help?"
                className="w-full p-3 border border-edge bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
              />
            </label>

            {supportError && (
              <p className="font-mono text-xs text-destructive">
                {supportError}
              </p>
            )}

            <Button
              type="submit"
              className="h-9 px-5 font-mono uppercase text-xs gap-2"
            >
              <span>Send Message</span>
              <ArrowRight className="size-3.5" />
            </Button>
          </form>
        )}
      </section>
    </DocsLayout>
  );
}
