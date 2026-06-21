import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import RotatePdfTool from "@/components/tools/implementations/RotatePdfTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE  = `${SITE_URL}/og-image.png`;

const tool = getToolBySlug("rotate-pdf")!;

export const metadata: Metadata = {
  title: "Rotate PDF – Rotate PDF Pages Online Free | ToolNest AI",
  description:
    "Rotate PDF pages online for free. Rotate one page or an entire PDF in seconds.",
  keywords: tool.keywords,
  alternates: { canonical: `${SITE_URL}/pdf-tools/rotate-pdf` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/pdf-tools/rotate-pdf`,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "Rotate PDF – Rotate PDF Pages Online Free | ToolNest AI",
    description:
      "Rotate PDF pages online for free. Rotate one page or an entire PDF in seconds.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Rotate PDF | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@toolnestai",
    creator: "@toolnestai",
    title: "Rotate PDF – Rotate PDF Pages Online Free | ToolNest AI",
    description:
      "Rotate PDF pages online for free. Rotate one page or an entire PDF in seconds.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Rotate PDF | ToolNest AI" }],
  },
};

export default function RotatePdfPage() {
  return <ToolPageContent tool={tool} toolComponent={<RotatePdfTool />} />;
}
