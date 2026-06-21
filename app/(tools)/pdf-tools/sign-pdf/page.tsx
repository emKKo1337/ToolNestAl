import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import SignPdfTool from "@/components/tools/implementations/SignPdfTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE  = `${SITE_URL}/og-image.png`;

const tool = getToolBySlug("sign-pdf")!;

export const metadata: Metadata = {
  title: "Sign PDF – Add Your Signature to PDF Online | ToolNest AI",
  description:
    "Sign PDF files online for free using a typed, drawn or uploaded signature.",
  keywords: tool.keywords,
  alternates: { canonical: `${SITE_URL}/pdf-tools/sign-pdf` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/pdf-tools/sign-pdf`,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "Sign PDF – Add Your Signature to PDF Online | ToolNest AI",
    description:
      "Sign PDF files online for free using a typed, drawn or uploaded signature.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Sign PDF | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@toolnestai",
    creator: "@toolnestai",
    title: "Sign PDF – Add Your Signature to PDF Online | ToolNest AI",
    description:
      "Sign PDF files online for free using a typed, drawn or uploaded signature.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Sign PDF | ToolNest AI" }],
  },
};

export default function SignPdfPage() {
  return <ToolPageContent tool={tool} toolComponent={<SignPdfTool />} />;
}
