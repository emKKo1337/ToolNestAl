import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import AiChatTool from "@/components/tools/implementations/AiChatTool";

const tool = getToolBySlug("ai-chat")!;

export const metadata: Metadata = {
  title: "AI Chat – Free Online AI Assistant | ToolNest AI",
  description:
    "Chat with an intelligent AI assistant for writing, coding, learning, brainstorming and everyday questions. Fast, free, and no account required.",
  keywords: [
    "AI chat",
    "free AI assistant",
    "ChatGPT alternative",
    "AI chatbot online",
    "AI for coding",
    "AI for writing",
    "online AI chat",
  ],
  openGraph: {
    title: "AI Chat – Free Online AI Assistant | ToolNest AI",
    description:
      "Chat with an intelligent AI assistant for writing, coding, learning, brainstorming and everyday questions.",
    url: "https://www.toolnestai.net/ai-tools/ai-chat",
    siteName: "ToolNest AI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Chat – Free Online AI Assistant | ToolNest AI",
    description:
      "Chat with an intelligent AI assistant for writing, coding, learning, and everyday questions.",
  },
  alternates: {
    canonical: "https://www.toolnestai.net/ai-tools/ai-chat",
  },
};

export default function AiChatPage() {
  return <ToolPageContent tool={tool} toolComponent={<AiChatTool />} />;
}

