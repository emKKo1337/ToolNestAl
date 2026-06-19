import type { MDXComponents } from "mdx/types";
import { Callout } from "./Callout";
import { ToolCard } from "./ToolCard";
import { ImageBlock } from "./ImageBlock";
import { Quote } from "./Quote";
import { FAQBlock } from "./FAQBlock";

export const mdxComponents: MDXComponents = {
  // ─── Custom block components ────────────────────────────────────────
  Callout,
  ToolCard,
  ImageBlock,
  Quote,
  FAQBlock,

  // ─── Override native elements ───────────────────────────────────────
  // blockquote → Quote
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <Quote>{children}</Quote>
  ),

  // table → scrollable wrapper
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="overflow-x-auto my-6">
      <table>{children}</table>
    </div>
  ),
};
