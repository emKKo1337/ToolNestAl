import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import RemoveExtraSpacesTool from "@/components/tools/implementations/RemoveExtraSpacesTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE  = `${SITE_URL}/og-image.png`;

const tool = getToolBySlug("remove-extra-spaces")!;

export const metadata: Metadata = {
  title: "Remove Extra Spaces – Free Online Text Cleaner | ToolNest AI",
  description:
    "Remove extra spaces, tabs and unnecessary whitespace from text instantly using this free online tool.",
  keywords: tool.keywords,
  alternates: { canonical: `${SITE_URL}/text-tools/remove-extra-spaces` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/text-tools/remove-extra-spaces`,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "Remove Extra Spaces – Free Online Text Cleaner | ToolNest AI",
    description:
      "Remove extra spaces, tabs and unnecessary whitespace from text instantly using this free online tool.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Remove Extra Spaces | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@toolnestai",
    creator: "@toolnestai",
    title: "Remove Extra Spaces – Free Online Text Cleaner | ToolNest AI",
    description:
      "Remove extra spaces, tabs and unnecessary whitespace from text instantly using this free online tool.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Remove Extra Spaces | ToolNest AI" }],
  },
};

export default function RemoveExtraSpacesPage() {
  return <ToolPageContent tool={tool} toolComponent={<RemoveExtraSpacesTool />} />;
}
