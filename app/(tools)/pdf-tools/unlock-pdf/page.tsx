import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import UnlockPdfTool from "@/components/tools/implementations/UnlockPdfTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE  = `${SITE_URL}/og-image.png`;

const tool = getToolBySlug("unlock-pdf")!;

export const metadata: Metadata = {
  title: "Unlock PDF – Remove PDF Password Online | ToolNest AI",
  description:
    "Unlock password-protected PDF files online for free. Remove PDF security using the correct password.",
  keywords: tool.keywords,
  alternates: { canonical: `${SITE_URL}/pdf-tools/unlock-pdf` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/pdf-tools/unlock-pdf`,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "Unlock PDF – Remove PDF Password Online | ToolNest AI",
    description:
      "Unlock password-protected PDF files online for free. Remove PDF security using the correct password.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Unlock PDF | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@toolnestai",
    creator: "@toolnestai",
    title: "Unlock PDF – Remove PDF Password Online | ToolNest AI",
    description:
      "Unlock password-protected PDF files online for free. Remove PDF security using the correct password.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Unlock PDF | ToolNest AI" }],
  },
};

export default function UnlockPdfPage() {
  return <ToolPageContent tool={tool} toolComponent={<UnlockPdfTool />} />;
}
