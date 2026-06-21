import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import ExcelToPdfTool from "@/components/tools/implementations/ExcelToPdfTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE  = `${SITE_URL}/og-image.png`;

const tool = getToolBySlug("excel-to-pdf")!;

export const metadata: Metadata = {
  title: "Excel to PDF – Convert XLSX & XLS to PDF Online | ToolNest AI",
  description:
    "Convert Excel spreadsheets (XLSX and XLS) to PDF online for free while preserving formatting.",
  keywords: tool.keywords,
  alternates: { canonical: `${SITE_URL}/pdf-tools/excel-to-pdf` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/pdf-tools/excel-to-pdf`,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "Excel to PDF – Convert XLSX & XLS to PDF Online | ToolNest AI",
    description:
      "Convert Excel spreadsheets (XLSX and XLS) to PDF online for free while preserving formatting.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Excel to PDF | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@toolnestai",
    creator: "@toolnestai",
    title: "Excel to PDF – Convert XLSX & XLS to PDF Online | ToolNest AI",
    description:
      "Convert Excel spreadsheets (XLSX and XLS) to PDF online for free while preserving formatting.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Excel to PDF | ToolNest AI" }],
  },
};

export default function ExcelToPdfPage() {
  return <ToolPageContent tool={tool} toolComponent={<ExcelToPdfTool />} />;
}
