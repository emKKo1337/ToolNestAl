import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumb from "@/components/ui/Breadcrumb";

const SITE_URL = "https://toolnest.ai";

export const metadata: Metadata = {
  title: "About ToolNest AI — Our Mission, Vision & Story",
  description:
    "Learn about ToolNest AI — why we built a suite of 32+ free online tools, what makes us different, and our commitment to privacy and performance.",
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/about`,
    title: "About ToolNest AI — Our Mission, Vision & Story",
    description:
      "Learn about ToolNest AI — why we built a suite of 32+ free online tools, what makes us different, and our commitment to privacy and performance.",
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630 }],
  },
};

const faqs = [
  {
    q: "Is ToolNest AI really free?",
    a: "Yes — every tool on ToolNest AI is completely free to use. There are no paywalls, no premium tiers, and no hidden charges.",
  },
  {
    q: "Do I need to create an account?",
    a: "No sign-up is required. Open any tool and start working immediately. Your favorites are saved locally in your browser.",
  },
  {
    q: "Do you store my files or data?",
    a: "No. All file processing (PDF, image, etc.) happens entirely in your browser. Your files never leave your device and are never uploaded to our servers.",
  },
  {
    q: "How is ToolNest AI funded?",
    a: "ToolNest AI is currently self-funded. We may introduce non-intrusive advertising in the future to keep the platform free for everyone.",
  },
  {
    q: "Can I suggest a new tool?",
    a: "Absolutely! We love hearing from users. Use the Contact page to send us your tool ideas and feature requests.",
  },
  {
    q: "Is ToolNest AI open source?",
    a: "Not yet, but we are considering open-sourcing parts of the platform in the future. Follow our updates for announcements.",
  },
];

export default function AboutPage() {
  return (
    <div className="pt-32 pb-24 px-4 md:px-[48px] max-w-[1280px] mx-auto w-full">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "About" }]} />

      {/* Hero */}
      <header className="max-w-3xl mb-20">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#ddb7ff] mb-4">
          About ToolNest AI
        </p>
        <h1 className="text-[40px] md:text-[56px] font-extrabold tracking-[-0.03em] text-[#e2e2e2] leading-[1.08] mb-6">
          Tools that work.{" "}
          <span className="gradient-text">No friction.</span>
        </h1>
        <p className="text-[18px] leading-[30px] text-[#9b8da8] max-w-2xl">
          ToolNest AI is a free, all-in-one suite of online tools built for
          people who want to get things done — without sign-ups, without
          software installs, and without wasting time.
        </p>
      </header>

      {/* Mission + Vision */}
      <div className="grid md:grid-cols-2 gap-5 mb-16">
        {[
          {
            icon: "rocket_launch",
            color: "#ddb7ff",
            bg: "rgba(221,183,255,0.08)",
            label: "Our Mission",
            text:
              "To make powerful digital tools accessible to everyone, everywhere — for free. We believe productivity software should not sit behind paywalls or require technical expertise.",
          },
          {
            icon: "visibility",
            color: "#4cd7f6",
            bg: "rgba(76,215,246,0.08)",
            label: "Our Vision",
            text:
              "A world where any person, regardless of budget or background, can compress a PDF, remove an image background, format JSON, generate a QR code, or chat with AI — instantly, in their browser.",
          },
        ].map(({ icon, color, bg, label, text }) => (
          <div key={label} className="glass-panel rounded-3xl p-8 flex flex-col gap-5">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: bg }}
            >
              <span
                className="material-symbols-outlined text-[24px]"
                style={{ color, fontVariationSettings: "'FILL' 1" }}
                aria-hidden="true"
              >
                {icon}
              </span>
            </div>
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.1em] mb-2" style={{ color }}>
                {label}
              </p>
              <p className="text-[15px] leading-[26px] text-[#9b8da8]">{text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Why ToolNest AI exists */}
      <section className="mb-16">
        <h2 className="text-[28px] md:text-[36px] font-extrabold tracking-[-0.02em] text-[#e2e2e2] mb-4">
          Why ToolNest AI exists
        </h2>
        <div className="max-w-3xl space-y-4 text-[16px] leading-[28px] text-[#9b8da8]">
          <p>
            Every day, millions of people search for tools to complete simple
            tasks — merge a PDF, resize an image, format some JSON, decode a
            JWT. They land on websites riddled with ads, dark patterns, and
            forced sign-ups. Many tools are paid, slow, or simply don't work
            well on mobile.
          </p>
          <p>
            We built ToolNest AI because we were frustrated by this experience
            ourselves. We wanted a single, fast, trustworthy place to go for any
            everyday digital task — a place that respects your time and your
            privacy.
          </p>
        </div>
      </section>

      {/* What makes us different */}
      <section className="mb-16">
        <h2 className="text-[28px] md:text-[36px] font-extrabold tracking-[-0.02em] text-[#e2e2e2] mb-8">
          What makes us different
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: "lock", title: "Privacy-first", desc: "File processing runs entirely in your browser. Your data never touches our servers." },
            { icon: "bolt", title: "Instant & fast", desc: "No loading screens, no queues. Tools are ready the moment you open the page." },
            { icon: "block", title: "No sign-up required", desc: "Open any tool and start immediately. Your time is too valuable for account creation flows." },
            { icon: "devices", title: "Works everywhere", desc: "Fully responsive across desktop, tablet and mobile. Works on any modern browser." },
            { icon: "category", title: "One platform", desc: "AI, PDF, image editing, developer utilities, calculators — all in one cohesive experience." },
            { icon: "favorite", title: "Made with care", desc: "Built by developers who use these tools every day. Designed with attention to every detail." },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="glass-panel rounded-2xl p-6 flex flex-col gap-3">
              <span
                className="material-symbols-outlined text-[22px] text-[#ddb7ff]"
                style={{ fontVariationSettings: "'FILL' 1" }}
                aria-hidden="true"
              >
                {icon}
              </span>
              <p className="text-[15px] font-bold text-[#e2e2e2]">{title}</p>
              <p className="text-[13px] leading-[22px] text-[#7a6d84]">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Security & Privacy */}
      <section className="mb-16">
        <div className="glass-panel rounded-3xl p-8 md:p-12 flex flex-col md:flex-row gap-8 items-start"
          style={{ borderColor: "rgba(76,215,246,0.15)" }}>
          <div className="flex-shrink-0">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(76,215,246,0.1)" }}>
              <span className="material-symbols-outlined text-[28px] text-[#4cd7f6]"
                style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
                shield
              </span>
            </div>
          </div>
          <div>
            <h2 className="text-[24px] font-extrabold text-[#e2e2e2] mb-3">Security &amp; Privacy</h2>
            <p className="text-[15px] leading-[26px] text-[#9b8da8] mb-4">
              We take your privacy seriously. All file-based tools — PDF processing, image editing,
              compression — run entirely client-side using WebAssembly and modern browser APIs.
              Your files are processed locally and never uploaded.
            </p>
            <p className="text-[15px] leading-[26px] text-[#9b8da8]">
              We use minimal, privacy-respecting analytics to understand which tools are most useful.
              We do not sell your data. We do not track you across the web. Read our{" "}
              <Link href="/privacy-policy" className="text-[#ddb7ff] hover:opacity-75 transition-opacity">
                Privacy Policy
              </Link>{" "}
              for full details.
            </p>
          </div>
        </div>
      </section>

      {/* Performance & Technology */}
      <section className="mb-16">
        <div className="glass-panel rounded-3xl p-8 md:p-12 flex flex-col md:flex-row gap-8 items-start"
          style={{ borderColor: "rgba(221,183,255,0.15)" }}>
          <div className="flex-shrink-0">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(221,183,255,0.1)" }}>
              <span className="material-symbols-outlined text-[28px] text-[#ddb7ff]"
                style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
                speed
              </span>
            </div>
          </div>
          <div>
            <h2 className="text-[24px] font-extrabold text-[#e2e2e2] mb-3">Performance &amp; Technology</h2>
            <p className="text-[15px] leading-[26px] text-[#9b8da8] mb-4">
              ToolNest AI is built with Next.js 16 and React 19, targeting Lighthouse scores above 95
              across all categories. Every page is statically generated and served from a global CDN
              for sub-second load times anywhere in the world.
            </p>
            <p className="text-[15px] leading-[26px] text-[#9b8da8]">
              Our tools use best-in-class libraries — pdf-lib for PDF manipulation,
              WebAssembly codecs for image processing — all bundled per-route so you
              only download what you need.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mb-16">
        <h2 className="text-[28px] md:text-[36px] font-extrabold tracking-[-0.02em] text-[#e2e2e2] mb-8">
          Frequently Asked Questions
        </h2>
        <div className="flex flex-col gap-4">
          {faqs.map(({ q, a }) => (
            <div key={q} className="glass-panel rounded-2xl p-6">
              <p className="text-[15px] font-bold text-[#e2e2e2] mb-2">{q}</p>
              <p className="text-[14px] leading-[24px] text-[#7a6d84]">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="glass-panel rounded-3xl p-10 md:p-16 text-center"
        style={{ background: "linear-gradient(135deg,rgba(221,183,255,0.07) 0%,rgba(76,215,246,0.04) 100%)", borderColor: "rgba(221,183,255,0.15)" }}>
        <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#ddb7ff] mb-3">
          Get started for free
        </p>
        <h2 className="text-[30px] md:text-[40px] font-extrabold tracking-[-0.02em] text-[#e2e2e2] mb-4">
          Start Using ToolNest AI
        </h2>
        <p className="text-[16px] text-[#7a6d84] mb-8 max-w-md mx-auto">
          No account. No downloads. No cost. Just open a tool and go.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/"
            className="btn-primary text-white font-semibold px-8 py-3 rounded-xl text-[15px] flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              rocket_launch
            </span>
            Explore All Tools
          </Link>
          <Link
            href="/contact"
            className="glass-panel px-8 py-3 rounded-xl text-[15px] font-semibold text-[#cfc2d6] hover:text-[#ddb7ff] transition-colors"
          >
            Contact Us
          </Link>
        </div>
      </section>
    </div>
  );
}
