import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import AddPageNumbersTool from "@/components/tools/implementations/AddPageNumbersTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE  = `${SITE_URL}/og-image.png`;

const tool = getToolBySlug("add-page-numbers")!;

export const metadata: Metadata = {
  title: "Add Page Numbers to PDF – Number PDF Pages Online | ToolNest AI",
  description:
    "Add page numbers to PDF documents online for free. Customize numbering style, position and appearance.",
  keywords: tool.keywords,
  alternates: { canonical: `${SITE_URL}/pdf-tools/add-page-numbers` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/pdf-tools/add-page-numbers`,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "Add Page Numbers to PDF – Number PDF Pages Online | ToolNest AI",
    description:
      "Add page numbers to PDF documents online for free. Customize numbering style, position and appearance.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Add Page Numbers to PDF | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@toolnestai",
    creator: "@toolnestai",
    title: "Add Page Numbers to PDF – Number PDF Pages Online | ToolNest AI",
    description:
      "Add page numbers to PDF documents online for free. Customize numbering style, position and appearance.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Add Page Numbers to PDF | ToolNest AI" }],
  },
};

export default function AddPageNumbersPage() {
  return <ToolPageContent tool={tool} toolComponent={<AddPageNumbersTool />} />;
}
