import type { Metadata } from "next";
import type { Tool, ToolCategory } from "@/lib/tools";

const SITE_URL = "https://www.toolnestai.net";
const SITE_NAME = "ToolNest AI";
const OG_IMAGE = `${SITE_URL}/og-image.png`;
const TWITTER_HANDLE = "@toolnestai";

// ─── Tool pages ───────────────────────────────────────────────────────────────

export function generateToolMetadata(tool: Tool): Metadata {
  const url = `${SITE_URL}/${tool.categorySlug}/${tool.slug}`;
  // Descriptive title: "JSON Formatter — Free Online JSON Formatter & Validator"
  const title = `${tool.name} — Free Online ${tool.name}`;
  // Meta description: use shortDescription (concise, already ~120 chars)
  const description = tool.shortDescription;
  // OG description: use the longer description for richer social previews
  const ogDescription =
    tool.description.length > 300
      ? tool.description.slice(0, 297) + "…"
      : tool.description;

  return {
    title,
    description,
    keywords: tool.keywords,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: SITE_NAME,
      locale: "en_US",
      title: `${tool.name} — Free Online ${tool.name} | ${SITE_NAME}`,
      description: ogDescription,
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: `${tool.name} | ${SITE_NAME}` }],
    },
    twitter: {
      card: "summary_large_image",
      site: TWITTER_HANDLE,
      creator: TWITTER_HANDLE,
      title: `${tool.name} — Free Online ${tool.name} | ${SITE_NAME}`,
      description,
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: `${tool.name} | ${SITE_NAME}` }],
    },
  };
}

// ─── Category pages ───────────────────────────────────────────────────────────

export function generateCategoryMetadata(
  category: ToolCategory,
  toolCount: number,
): Metadata {
  const url = `${SITE_URL}/${category.slug}`;

  // Keyword-rich titles per category
  const titleMap: Record<string, string> = {
    "ai-tools":        `AI Tools — ${toolCount} Free Online AI Tools`,
    "pdf-tools":       `PDF Tools — ${toolCount} Free Online PDF Utilities`,
    "image-tools":     `Image Tools — ${toolCount} Free Online Image Editors`,
    "developer-tools": `Developer Tools — ${toolCount} Free Online Dev Utilities`,
    "calculators":     `Calculators & Generators — ${toolCount} Free Online Tools`,
    "text-tools":      `Text Tools — ${toolCount} Free Online Text Utilities`,
  };
  const title = titleMap[category.slug] ?? `${category.name} — ${toolCount} Free Online Tools`;

  // Meta descriptions (~150 chars, keyword-rich)
  const descMap: Record<string, string> = {
    "ai-tools":        `Explore ${toolCount} free AI tools — chat, translate, summarize, write emails, build resumes, and more. No sign-up required.`,
    "pdf-tools":       `${toolCount} free PDF tools online. Merge, split, compress, convert PDF to images or Word. Works in your browser — no install needed.`,
    "image-tools":     `${toolCount} free image tools online. Compress, resize, convert, and remove backgrounds instantly in your browser.`,
    "developer-tools": `${toolCount} free developer tools online. Format JSON, encode Base64, generate UUIDs, test regex, decode JWT, and more.`,
    "calculators":     `${toolCount} free calculators and generators. Password generator, QR code maker, BMI calculator, word counter, and more.`,
    "text-tools":      `${toolCount} free text tools online. Convert case, count words, and transform text instantly in your browser — no install needed.`,
  };
  const description = descMap[category.slug] ?? category.description;

  const keywordsMap: Record<string, string[]> = {
    "ai-tools":        ["AI tools", "free AI tools", "online AI", "AI chat", "text summarizer", "AI translator", "AI email writer", "AI resume builder"],
    "pdf-tools":       ["PDF tools", "free PDF tools", "merge PDF", "split PDF", "compress PDF", "PDF to Word", "PDF to images", "online PDF"],
    "image-tools":     ["image tools", "free image tools", "image compressor", "image resizer", "remove background", "JPG to PNG", "WebP converter"],
    "developer-tools": ["developer tools", "JSON formatter", "Base64 encoder", "UUID generator", "regex tester", "JWT decoder", "hash generator", "CSS minifier"],
    "calculators":     ["calculators", "password generator", "QR code generator", "BMI calculator", "age calculator", "word counter", "online calculator"],
    "text-tools":      ["text tools", "case converter", "word counter", "text transformer", "online text tools", "uppercase converter", "lowercase converter"],
  };

  return {
    title,
    description,
    keywords: keywordsMap[category.slug],
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: SITE_NAME,
      locale: "en_US",
      title: `${title} | ${SITE_NAME}`,
      description,
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: `${category.name} | ${SITE_NAME}` }],
    },
    twitter: {
      card: "summary_large_image",
      site: TWITTER_HANDLE,
      creator: TWITTER_HANDLE,
      title: `${title} | ${SITE_NAME}`,
      description,
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: `${category.name} | ${SITE_NAME}` }],
    },
  };
}
