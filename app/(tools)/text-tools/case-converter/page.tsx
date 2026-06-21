import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import CaseConverterTool from "@/components/tools/implementations/CaseConverterTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE = `${SITE_URL}/og-image.png`;

const tool = getToolBySlug("case-converter")!;

export const metadata: Metadata = {
  title: "Case Converter – Convert Text Between Uppercase, Lowercase & More | ToolNest AI",
  description:
    "Convert text instantly between uppercase, lowercase, title case, sentence case, camelCase, PascalCase, snake_case and kebab-case for free.",
  keywords: tool.keywords,
  alternates: { canonical: `${SITE_URL}/text-tools/case-converter` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/text-tools/case-converter`,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "Case Converter – Convert Text Between Uppercase, Lowercase & More | ToolNest AI",
    description:
      "Convert text instantly between uppercase, lowercase, title case, sentence case, camelCase, PascalCase, snake_case and kebab-case for free.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Case Converter | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@toolnestai",
    creator: "@toolnestai",
    title: "Case Converter – Convert Text Between Uppercase, Lowercase & More | ToolNest AI",
    description:
      "Convert text instantly between uppercase, lowercase, title case, sentence case, camelCase, PascalCase, snake_case and kebab-case for free.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Case Converter | ToolNest AI" }],
  },
};

export default function CaseConverterPage() {
  return <ToolPageContent tool={tool} toolComponent={<CaseConverterTool />} />;
}
