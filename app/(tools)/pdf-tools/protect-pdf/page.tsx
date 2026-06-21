import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import ProtectPdfTool from "@/components/tools/implementations/ProtectPdfTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE  = `${SITE_URL}/og-image.png`;

const tool = getToolBySlug("protect-pdf")!;

export const metadata: Metadata = {
  title: "Protect PDF – Password Protect PDF Online | ToolNest AI",
  description:
    "Protect PDF files with a password online for free. Secure your PDF documents using strong encryption.",
  keywords: tool.keywords,
  alternates: { canonical: `${SITE_URL}/pdf-tools/protect-pdf` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/pdf-tools/protect-pdf`,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "Protect PDF – Password Protect PDF Online | ToolNest AI",
    description:
      "Protect PDF files with a password online for free. Secure your PDF documents using strong encryption.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Protect PDF | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@toolnestai",
    creator: "@toolnestai",
    title: "Protect PDF – Password Protect PDF Online | ToolNest AI",
    description:
      "Protect PDF files with a password online for free. Secure your PDF documents using strong encryption.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Protect PDF | ToolNest AI" }],
  },
};

export default function ProtectPdfPage() {
  return <ToolPageContent tool={tool} toolComponent={<ProtectPdfTool />} />;
}
