import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumb from "@/components/ui/Breadcrumb";

const SITE_URL = "https://toolnest.ai";
const LAST_UPDATED = "19 June 2026";

export const metadata: Metadata = {
  title: "Cookie Policy — ToolNest AI",
  description:
    "Learn how ToolNest AI uses cookies and local storage. We use only essential and minimal analytics cookies — no advertising or tracking.",
  alternates: { canonical: `${SITE_URL}/cookie-policy` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/cookie-policy`,
    title: "Cookie Policy — ToolNest AI",
    description: "ToolNest AI Cookie Policy — minimal cookies, no advertising, no cross-site tracking.",
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630 }],
  },
};

const cookieTable = [
  {
    name: "Session cookie",
    type: "Essential",
    purpose: "Maintains your session while using the website",
    duration: "Session",
    canDisable: false,
  },
  {
    name: "Analytics cookie",
    type: "Analytics",
    purpose: "Aggregated, anonymous usage statistics to improve the Service",
    duration: "Up to 12 months",
    canDisable: true,
  },
];

const localStorageItems = [
  {
    key: "toolnest-favorites",
    purpose: "Stores the list of tools you have marked as favorites",
    persistent: true,
  },
  {
    key: "toolnest-recent",
    purpose: "Stores recently accessed tools for quick navigation",
    persistent: true,
  },
];

export default function CookiePolicyPage() {
  return (
    <div className="pt-32 pb-24 px-4 md:px-[48px] max-w-[1280px] mx-auto w-full">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Cookie Policy" }]} />

      <div className="max-w-4xl mx-auto">
        <header className="mb-12">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#ddb7ff] mb-4">
            Legal
          </p>
          <h1 className="text-[40px] md:text-[52px] font-extrabold tracking-[-0.03em] text-[#e2e2e2] leading-[1.1] mb-5">
            Cookie Policy
          </h1>
          <p className="text-[15px] text-[#7a6d84]">
            Last updated: <span className="text-[#9b8da8] font-medium">{LAST_UPDATED}</span>
          </p>
          <p className="text-[16px] leading-[28px] text-[#9b8da8] mt-4 max-w-2xl">
            We believe in transparency. This policy explains exactly what cookies and local storage
            we use, why, and how you can control them.
          </p>
        </header>

        <div className="flex flex-col gap-10">
          {/* What are cookies */}
          <section id="what-are-cookies" className="scroll-mt-28">
            <h2 className="text-[22px] font-bold text-[#e2e2e2] mb-4">1. What Are Cookies?</h2>
            <p className="text-[15px] leading-[28px] text-[#9b8da8]">
              Cookies are small text files placed on your device by websites you visit. They are
              widely used to make websites work efficiently and to provide information to site
              owners. Cookies allow a website to recognise your device and remember information
              about your visit, such as your preferences.
            </p>
          </section>

          {/* Cookies we use */}
          <section id="cookies-we-use" className="scroll-mt-28">
            <h2 className="text-[22px] font-bold text-[#e2e2e2] mb-4">2. Cookies We Use</h2>
            <p className="text-[15px] leading-[28px] text-[#9b8da8] mb-6">
              ToolNest AI uses a minimal number of cookies. We do not use advertising cookies,
              social media tracking pixels, or cross-site tracking cookies.
            </p>
            {/* Cookie table */}
            <div className="glass-panel rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      {["Cookie", "Type", "Purpose", "Duration", "Can Disable?"].map((h) => (
                        <th
                          key={h}
                          className="text-left px-5 py-3.5 font-bold uppercase tracking-[0.08em] text-[#4d4354] text-[11px] whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cookieTable.map(({ name, type, purpose, duration, canDisable }) => (
                      <tr key={name} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td className="px-5 py-4 font-semibold text-[#cfc2d6] whitespace-nowrap">{name}</td>
                        <td className="px-5 py-4">
                          <span
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-[0.06em]"
                            style={
                              type === "Essential"
                                ? { background: "rgba(76,215,246,0.1)", color: "#4cd7f6" }
                                : { background: "rgba(221,183,255,0.1)", color: "#ddb7ff" }
                            }
                          >
                            {type}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-[#7a6d84]">{purpose}</td>
                        <td className="px-5 py-4 text-[#7a6d84] whitespace-nowrap">{duration}</td>
                        <td className="px-5 py-4 text-[#7a6d84]">{canDisable ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Essential cookies */}
          <section id="essential-cookies" className="scroll-mt-28">
            <h2 className="text-[22px] font-bold text-[#e2e2e2] mb-4">3. Essential Cookies</h2>
            <p className="text-[15px] leading-[28px] text-[#9b8da8]">
              Essential cookies are strictly necessary for the website to function correctly.
              Without these cookies, the Service cannot be provided. They do not collect any
              personally identifiable information and cannot be disabled without affecting
              the functionality of the website.
            </p>
          </section>

          {/* Analytics cookies */}
          <section id="analytics-cookies" className="scroll-mt-28">
            <h2 className="text-[22px] font-bold text-[#e2e2e2] mb-4">4. Analytics Cookies</h2>
            <p className="text-[15px] leading-[28px] text-[#9b8da8]">
              We use anonymous analytics cookies to understand how visitors interact with the
              website — for example, which tools are most popular and how users navigate between
              pages. All analytics data is aggregated and anonymised. No personally identifiable
              information is collected. We do not share this data with advertising networks.
            </p>
          </section>

          {/* Local storage */}
          <section id="local-storage" className="scroll-mt-28">
            <h2 className="text-[22px] font-bold text-[#e2e2e2] mb-4">5. Local Storage</h2>
            <p className="text-[15px] leading-[28px] text-[#9b8da8] mb-6">
              In addition to cookies, we use your browser&apos;s local storage for certain features.
              Unlike cookies, local storage data is never transmitted to our servers — it exists
              only on your device.
            </p>
            <div className="glass-panel rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      {["Key", "Purpose", "Persistent?"].map((h) => (
                        <th
                          key={h}
                          className="text-left px-5 py-3.5 font-bold uppercase tracking-[0.08em] text-[#4d4354] text-[11px]"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {localStorageItems.map(({ key, purpose, persistent }) => (
                      <tr key={key} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td className="px-5 py-4 font-mono text-[#ddb7ff] text-[12px]">{key}</td>
                        <td className="px-5 py-4 text-[#7a6d84]">{purpose}</td>
                        <td className="px-5 py-4 text-[#7a6d84]">{persistent ? "Yes (until cleared)" : "Session"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Managing cookies */}
          <section id="managing-cookies" className="scroll-mt-28">
            <h2 className="text-[22px] font-bold text-[#e2e2e2] mb-4">6. Managing Cookies &amp; Local Storage</h2>
            <p className="text-[15px] leading-[28px] text-[#9b8da8] mb-4">
              You can control and manage cookies through your browser settings. Most browsers allow
              you to:
            </p>
            <ul className="flex flex-col gap-2 text-[15px] leading-[26px] text-[#9b8da8] pl-5 mb-4 list-disc">
              <li>View what cookies are set and delete them individually</li>
              <li>Block all cookies or cookies from specific websites</li>
              <li>Clear all cookies when you close your browser</li>
            </ul>
            <p className="text-[15px] leading-[28px] text-[#9b8da8] mb-4">
              Please note that disabling essential cookies may affect the functionality of
              ToolNest AI. To clear local storage data (favorites, recently used tools), go to
              your browser&apos;s developer tools &gt; Application &gt; Local Storage and delete the
              ToolNest AI entries.
            </p>
            <p className="text-[15px] leading-[28px] text-[#9b8da8]">
              For browser-specific instructions on managing cookies, visit the help pages for
              your browser (Chrome, Firefox, Safari, Edge, etc.).
            </p>
          </section>

          {/* Changes */}
          <section id="changes" className="scroll-mt-28">
            <h2 className="text-[22px] font-bold text-[#e2e2e2] mb-4">7. Changes to This Policy</h2>
            <p className="text-[15px] leading-[28px] text-[#9b8da8]">
              We may update this Cookie Policy from time to time. We will notify you of changes
              by updating the &quot;Last updated&quot; date at the top of this page. Continued use
              of ToolNest AI after any changes constitutes acceptance of the updated policy.
            </p>
          </section>

          {/* Contact */}
          <section id="contact" className="scroll-mt-28">
            <h2 className="text-[22px] font-bold text-[#e2e2e2] mb-4">8. Contact</h2>
            <p className="text-[15px] leading-[28px] text-[#9b8da8]">
              If you have questions about our use of cookies or local storage, please contact us at{" "}
              <a
                href="mailto:privacy@toolnest.ai"
                className="text-[#ddb7ff] hover:opacity-75 transition-opacity"
              >
                privacy@toolnest.ai
              </a>{" "}
              or use our{" "}
              <Link href="/contact" className="text-[#ddb7ff] hover:opacity-75 transition-opacity">
                contact form
              </Link>
              .
            </p>
          </section>
        </div>

        <div className="mt-14 flex flex-wrap gap-3">
          {[
            { label: "Privacy Policy", href: "/privacy-policy" },
            { label: "Terms of Service", href: "/terms-of-service" },
            { label: "Contact Us", href: "/contact" },
          ].map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className="glass-panel px-5 py-2.5 rounded-xl text-[13px] font-semibold text-[#7a6d84] hover:text-[#ddb7ff] transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
