import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumb from "@/components/ui/Breadcrumb";
import ContactForm from "@/components/pages/ContactForm";

const SITE_URL = "https://www.toolnestai.net";
const SUPPORT_EMAIL = "contact@toolnestai.net";

export const metadata: Metadata = {
  title: "Contact Us — ToolNest AI",
  description:
    "Get in touch with the ToolNest AI team. Report bugs, request features, ask questions, or share feedback.",
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/contact`,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "Contact Us — ToolNest AI",
    description:
      "Get in touch with the ToolNest AI team. Report bugs, request features, ask questions, or share feedback.",
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630, alt: "Contact ToolNest AI" }],
  },
};

const links = [
  { icon: "help_outline", label: "Browse the FAQ", href: "/about#faq", external: false },
  { icon: "article", label: "Read the Blog", href: "/blog", external: false },
  { icon: "lock", label: "Privacy Policy", href: "/privacy-policy", external: false },
  { icon: "gavel", label: "Terms of Service", href: "/terms-of-service", external: false },
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
          {/* Email */}
          <div className="glass-panel rounded-3xl p-6 flex flex-col gap-4">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-[#4d4354]">
              Direct contact
            </h2>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="flex items-center gap-3 group"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(221,183,255,0.08)" }}
              >
                <span
                  className="material-symbols-outlined text-[17px]"
                  style={{ color: "#ddb7ff" }}
                  aria-hidden="true"
                >
                  mail
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-[#4d4354] leading-none mb-0.5">Email</p>
                <p className="text-[13px] font-semibold text-[#7a6d84] group-hover:text-[#ddb7ff] transition-colors truncate">
                  {SUPPORT_EMAIL}
                </p>
              </div>
            </a>
          </div>

          {/* Helpful links */}
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
              </Link>
            ))}
          </div>

          {/* Response time */}
          <div
            className="rounded-2xl px-5 py-4 text-[13px] leading-[22px] text-[#5a4d63]"
            style={{ background: "rgba(221,183,255,0.05)", border: "1px solid rgba(221,183,255,0.1)" }}
          >
            <span className="font-semibold text-[#7a6d84]">Response time:</span> We typically reply
            within 1–2 business days. You can also email us directly at{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#ddb7ff] hover:opacity-75 transition-opacity">
              {SUPPORT_EMAIL}
            </a>.
          </div>
        </aside>
      </div>
    </div>
  );
}
