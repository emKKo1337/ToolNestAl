import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import PowerPointToPdfTool from "@/components/tools/implementations/PowerPointToPdfTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE  = `${SITE_URL}/og-image.png`;

const tool = getToolBySlug("powerpoint-to-pdf")!;

export const metadata: Metadata = {
  title: "PowerPoint to PDF – Convert PPT & PPTX to PDF Online | ToolNest AI",
  description:
    "Convert PowerPoint presentations (PPT and PPTX) into PDF documents online for free.",
  keywords: tool.keywords,
  alternates: { canonical: `${SITE_URL}/pdf-tools/powerpoint-to-pdf` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/pdf-tools/powerpoint-to-pdf`,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "PowerPoint to PDF – Convert PPT & PPTX to PDF Online | ToolNest AI",
    description:
      "Convert PowerPoint presentations (PPT and PPTX) into PDF documents online for free.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "PowerPoint to PDF | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@toolnestai",
    creator: "@toolnestai",
    title: "PowerPoint to PDF – Convert PPT & PPTX to PDF Online | ToolNest AI",
    description:
      "Convert PowerPoint presentations (PPT and PPTX) into PDF documents online for free.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "PowerPoint to PDF | ToolNest AI" }],
  },
};

export default function PowerPointToPdfPage() {
  return <ToolPageContent tool={tool} toolComponent={<PowerPointToPdfTool />} />;
}
