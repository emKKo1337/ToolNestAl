import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import AiResumeBuilderTool from "@/components/tools/implementations/AiResumeBuilderTool";

const tool = getToolBySlug("ai-resume-builder")!;

export const metadata: Metadata = {
  title: "AI Resume Builder – Create ATS-Friendly Resumes | ToolNest AI",
  description:
    "Create professional ATS-friendly resumes using AI in minutes. Fill in your experience, let AI craft compelling bullet points and summaries, then download as PDF or TXT.",
  keywords: [
    "AI resume builder",
    "ATS resume generator",
    "free resume maker",
    "CV builder AI",
    "professional resume creator",
    "resume writing tool",
  ],
  openGraph: {
    title: "AI Resume Builder – Create ATS-Friendly Resumes | ToolNest AI",
    description:
      "Build a professional, ATS-optimized resume in minutes with AI. Enter your details, generate polished content, and download instantly.",
    url: "https://www.toolnestai.net/ai-tools/ai-resume-builder",
    siteName: "ToolNest AI",
    locale: "en_US",
    type: "website",
    images: [{ url: "https://www.toolnestai.net/og-image.png", width: 1200, height: 630, alt: "AI Resume Builder | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@toolnestai",
    creator: "@toolnestai",
    title: "AI Resume Builder – Create ATS-Friendly Resumes | ToolNest AI",
    description:
      "Build a professional, ATS-optimized resume in minutes with AI.",
    images: [{ url: "https://www.toolnestai.net/og-image.png", width: 1200, height: 630, alt: "AI Resume Builder | ToolNest AI" }],
  },
  alternates: {
    canonical: "https://www.toolnestai.net/ai-tools/ai-resume-builder",
  },
};

export default function AiResumeBuilderPage() {
  return <ToolPageContent tool={tool} toolComponent={<AiResumeBuilderTool />} />;
}

