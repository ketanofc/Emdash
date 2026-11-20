import type { DocSection } from "@/src/components/Footer";
import type { DocsPageProps } from "@/src/components/docs/DocsLayout";
import { BlogPage } from "@/src/components/docs/pages/BlogPage";
import { EmailSupportPage } from "@/src/components/docs/pages/EmailSupportPage";
import { FaqPage } from "@/src/components/docs/pages/FaqPage";
import { LegalHubPage } from "@/src/components/docs/pages/LegalHubPage";
import { PrivacyPolicyPage } from "@/src/components/docs/pages/PrivacyPolicyPage";
import { PromptingPage } from "@/src/components/docs/pages/PromptingPage";
import { QuickstartPage } from "@/src/components/docs/pages/QuickstartPage";
import { SecurityPage } from "@/src/components/docs/pages/SecurityPage";
import { SupportDocsPage } from "@/src/components/docs/pages/SupportDocsPage";
import { TermsOfServicePage } from "@/src/components/docs/pages/TermsOfServicePage";
import { TrustCenterPage } from "@/src/components/docs/pages/TrustCenterPage";

interface DocsPageRouterProps extends DocsPageProps {
  page: DocSection;
}

export function DocsPageRouter({ page, ...props }: DocsPageRouterProps) {
  switch (page) {
    case "docs":
      return <SupportDocsPage {...props} />;
    case "quickstart":
      return <QuickstartPage {...props} />;
    case "prompting":
      return <PromptingPage {...props} />;
    case "faq":
      return <FaqPage {...props} />;
    case "support":
      return <EmailSupportPage {...props} />;
    case "legal":
      return <LegalHubPage {...props} />;
    case "privacy":
      return <PrivacyPolicyPage {...props} />;
    case "terms":
      return <TermsOfServicePage {...props} />;
    case "security":
      return <SecurityPage {...props} />;
    case "trust":
      return <TrustCenterPage {...props} />;
    case "blog":
      return <BlogPage {...props} />;
  }
}
