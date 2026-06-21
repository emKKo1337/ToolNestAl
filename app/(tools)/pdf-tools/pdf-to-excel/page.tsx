import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import PdfToExcelTool from "@/components/tools/implementations/PdfToExcelTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE  = `${SITE_URL}/og-image.png`;

const tool = getToolBySlug("pdf-to-excel")!;

export const metadata: Metadata = {
  title: "PDF to Excel – Convert PDF to XLSX Online | ToolNest AI",
  description:
    "Convert PDF files into editable Excel spreadsheets online for free while preserving tables whenever possible.",
  keywords: tool.keywords,
  alternates: { canonical: `${SITE_URL}/pdf-tools/pdf-to-excel` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/pdf-tools/pdf-to-excel`,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "PDF to Excel – Convert PDF to XLSX Online | ToolNest AI",
    description:
      "Convert PDF files into editable Excel spreadsheets online for free while preserving tables whenever possible.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "PDF to Excel | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@toolnestai",
    creator: "@toolnestai",
    title: "PDF to Excel – Convert PDF to XLSX Online | ToolNest AI",
    description:
      "Convert PDF files into editable Excel spreadsheets online for free while preserving tables whenever possible.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "PDF to Excel | ToolNest AI" }],
  },
};

export default function PdfToExcelPage() {
  return <ToolPageContent tool={tool} toolComponent={<PdfToExcelTool />} />;
}
