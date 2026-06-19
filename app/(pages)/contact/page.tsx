import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumb from "@/components/ui/Breadcrumb";
import ContactForm from "@/components/pages/ContactForm";

const SITE_URL = "https://toolnest.ai";

export const metadata: Metadata = {
  title: "Contact Us — ToolNest AI",
  description:
    "Get in touch with the ToolNest AI team. Report bugs, request features, ask questions, or explore partnership opportunities.",
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/contact`,
    title: "Contact Us — ToolNest AI",
    description:
      "Get in touch with the ToolNest AI team. Report bugs, request features, ask questions, or explore partnership opportunities.",
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630 }],
  },
};

const channels = [
  {
    icon: "mail",
    color: "#ddb7ff",
    bg: "rgba(221,183,255,0.08)",
    label: "General Inquiries",
    value: "hello@toolnest.ai",
    href: "mailto:hello@toolnest.ai",
  },
  {
    icon: "support_agent",
    color: "#4cd7f6",
    bg: "rgba(76,215,246,0.08)",
    label: "Support",
    value: "support@toolnest.ai",
    href: "mailto:support@toolnest.ai",
  },
  {
    icon: "bug_report",
    color: "#ff9f6b",
    bg: "rgba(255,159,107,0.08)",
    label: "Bug Reports",
    value: "bugs@toolnest.ai",
    href: "mailto:bugs@toolnest.ai",
  },
  {
    icon: "lightbulb",
    color: "#7ee8a2",
    bg: "rgba(126,232,162,0.08)",
    label: "Feature Requests",
    value: "ideas@toolnest.ai",
    href: "mailto:ideas@toolnest.ai",
  },
];

const links = [
  { icon: "help_outline", label: "Browse the FAQ", href: "/about#faq", external: false },
  { icon: "article", label: "Read the Blog", href: "/blog", external: false },
  { icon: "code", label: "GitHub", href: "https://github.com/toolnestai", external: true },
  { icon: "forum", label: "Twitter / X", href: "https://twitter.com/toolnestai", external: true },
  { icon: "business", label: "LinkedIn", href: "https://linkedin.com/company/toolnestai", external: true },
];

export default function ContactPage() {
  return (
    <div className="pt-32 pb-24 px-4 md:px-[48px] max-w-[1280px] mx-auto w-full">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Contact" }]} />

      {/* Header */}
      <header className="max-w-2xl mb-14">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#ddb7ff] mb-4">
          Get in touch
        </p>
        <h1 className="text-[40px] md:text-[52px] font-extrabold tracking-[-0.03em] text-[#e2e2e2] leading-[1.1] mb-5">
          We&apos;d love to hear from you
        </h1>
        <p className="text-[17px] leading-[28px] text-[#9b8da8]">
          Have a question, found a bug, or want to suggest a tool? Send us a message
          and we&apos;ll get back to you within 1–2 business days.
        </p>
      </header>

      <div className="grid lg:grid-cols-[1fr_380px] gap-8 items-start">
        {/* Contact form */}
        <div className="glass-panel rounded-3xl p-8">
          <h2 className="text-[20px] font-bold text-[#e2e2e2] mb-6">Send a message</h2>
          <ContactForm />
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-5">
          {/* Direct email channels */}
          <div className="glass-panel rounded-3xl p-6 flex flex-col gap-4">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-[#4d4354]">
              Direct contact
            </h2>
            {channels.map(({ icon, color, bg, label, value, href }) => (
              <a
                key={label}
                href={href}
                className="flex items-center gap-3 group"
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: bg }}
                >
                  <span
                    className="material-symbols-outlined text-[17px]"
                    style={{ color }}
                    aria-hidden="true"
                  >
                    {icon}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-[#4d4354] leading-none mb-0.5">{label}</p>
                  <p className="text-[13px] font-semibold text-[#7a6d84] group-hover:text-[#ddb7ff] transition-colors truncate">
                    {value}
                  </p>
                </div>
              </a>
            ))}
          </div>

          {/* Links */}
          <div className="glass-panel rounded-3xl p-6 flex flex-col gap-3">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-[#4d4354] mb-1">
              Helpful links
            </h2>
            {links.map(({ icon, label, href, external }) => (
              <Link
                key={label}
                href={href}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
                className="flex items-center gap-2.5 text-[13px] font-medium text-[#7a6d84] hover:text-[#ddb7ff] transition-colors group"
              >
                <span
                  className="material-symbols-outlined text-[17px] text-[#3d3347] group-hover:text-[#ddb7ff] transition-colors"
                  aria-hidden="true"
                >
                  {icon}
                </span>
                {label}
                {external && (
                  <span
                    className="material-symbols-outlined text-[13px] opacity-40 ml-auto"
                    aria-hidden="true"
                  >
                    open_in_new
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* Response time note */}
          <div
            className="rounded-2xl px-5 py-4 text-[13px] leading-[22px] text-[#5a4d63]"
            style={{ background: "rgba(221,183,255,0.05)", border: "1px solid rgba(221,183,255,0.1)" }}
          >
            <span className="font-semibold text-[#7a6d84]">Response time:</span> We typically reply
            within 1–2 business days. For urgent issues, email{" "}
            <a href="mailto:support@toolnest.ai" className="text-[#ddb7ff] hover:opacity-75 transition-opacity">
              support@toolnest.ai
            </a>{" "}
            directly.
          </div>
        </aside>
      </div>
    </div>
  );
}
