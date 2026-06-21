import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import WatermarkPdfTool from "@/components/tools/implementations/WatermarkPdfTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE  = `${SITE_URL}/og-image.png`;

const tool = getToolBySlug("watermark-pdf")!;

export const metadata: Metadata = {
  title: "Watermark PDF – Add Text or Image Watermarks Online | ToolNest AI",
  description:
    "Add text or image watermarks to PDF files online for free with customizable position, opacity and style.",
  keywords: tool.keywords,
  alternates: { canonical: `${SITE_URL}/pdf-tools/watermark-pdf` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/pdf-tools/watermark-pdf`,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "Watermark PDF – Add Text or Image Watermarks Online | ToolNest AI",
    description:
      "Add text or image watermarks to PDF files online for free with customizable position, opacity and style.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Watermark PDF | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@toolnestai",
    creator: "@toolnestai",
    title: "Watermark PDF – Add Text or Image Watermarks Online | ToolNest AI",
    description:
      "Add text or image watermarks to PDF files online for free with customizable position, opacity and style.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Watermark PDF | ToolNest AI" }],
  },
};

export default function WatermarkPdfPage() {
  return <ToolPageContent tool={tool} toolComponent={<WatermarkPdfTool />} />;
}
