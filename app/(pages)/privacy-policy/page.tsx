import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumb from "@/components/ui/Breadcrumb";

const SITE_URL = "https://www.toolnestai.net";
const LAST_UPDATED = "19 June 2026";

export const metadata: Metadata = {
  title: "Privacy Policy — ToolNest AI",
  description:
    "Read the ToolNest AI Privacy Policy. We are committed to your privacy — no file uploads, minimal analytics, and zero data selling.",
  alternates: { canonical: `${SITE_URL}/privacy-policy` },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/privacy-policy`,
    title: "Privacy Policy — ToolNest AI",
    description: "ToolNest AI Privacy Policy — how we handle your data and protect your privacy.",
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630 }],
  },
};

const sections = [
  {
    id: "information-collected",
    title: "1. Information We Collect",
    content: (
      <>
        <p>We collect minimal information to operate and improve ToolNest AI. Specifically:</p>
        <ul>
          <li><strong>Usage analytics</strong> — anonymized page views, tool usage frequency, and general geographic region (country level). No personally identifiable information is collected via analytics.</li>
          <li><strong>Contact form submissions</strong> — if you contact us through our contact form, we collect your name, email address, and message content solely to respond to your inquiry.</li>
          <li><strong>Local storage data</strong> — your favorites and recently used tools are stored in your browser&apos;s local storage. This data never leaves your device and is not transmitted to our servers.</li>
        </ul>
        <p>We do <strong>not</strong> collect:</p>
        <ul>
          <li>Files you process using our tools (all processing happens client-side in your browser)</li>
          <li>Passwords or payment information (we have no accounts and no paid features)</li>
          <li>Precise location data</li>
          <li>Device fingerprints or unique identifiers</li>
        </ul>
      </>
    ),
  },
  {
    id: "cookies",
    title: "2. Cookies",
    content: (
      <>
        <p>ToolNest AI uses a minimal set of cookies:</p>
        <ul>
          <li><strong>Essential cookies</strong> — strictly necessary for the website to function. These cannot be disabled.</li>
          <li><strong>Analytics cookies</strong> — anonymous, aggregated statistics to help us understand which tools are most useful. These do not identify you personally.</li>
        </ul>
        <p>We do not use advertising cookies, tracking cookies, or third-party marketing cookies. For full details, see our <Link href="/cookie-policy" className="text-[#ddb7ff] hover:opacity-75 transition-opacity">Cookie Policy</Link>.</p>
      </>
    ),
  },
  {
    id: "local-storage",
    title: "3. Local Storage",
    content: (
      <>
        <p>We use your browser&apos;s local storage for the following features:</p>
        <ul>
          <li><strong>Favorites</strong> — tools you mark as favorites are saved in your browser. This data is never transmitted to our servers.</li>
          <li><strong>Recently used tools</strong> — we may save a list of recently accessed tools locally to improve navigation.</li>
        </ul>
        <p>You can clear this data at any time by clearing your browser&apos;s local storage or site data in your browser settings.</p>
      </>
    ),
  },
  {
    id: "analytics",
    title: "4. Analytics",
    content: (
      <p>
        We use privacy-respecting analytics to understand aggregate traffic patterns. Analytics
        data is anonymised and does not include personally identifiable information. We do not
        share analytics data with advertising networks. If we use a third-party analytics provider,
        we ensure it is compliant with GDPR and does not track users across the web.
      </p>
    ),
  },
  {
    id: "third-party",
    title: "5. Third-Party Services",
    content: (
      <>
        <p>ToolNest AI may use the following third-party services:</p>
        <ul>
          <li><strong>Hosting &amp; CDN</strong> — our infrastructure provider may process server logs containing anonymized IP addresses for security and performance purposes.</li>
          <li><strong>Fonts</strong> — we load fonts from Google Fonts. Please refer to Google&apos;s privacy policy for details on how they handle font requests.</li>
        </ul>
        <p>We do not integrate with social media tracking pixels, advertising networks, or data brokers.</p>
      </>
    ),
  },
  {
    id: "user-rights",
    title: "6. Your Rights (GDPR)",
    content: (
      <>
        <p>If you are located in the European Economic Area (EEA), you have the following rights under GDPR:</p>
        <ul>
          <li><strong>Right of access</strong> — you can request a copy of personal data we hold about you.</li>
          <li><strong>Right to rectification</strong> — you can ask us to correct inaccurate data.</li>
          <li><strong>Right to erasure</strong> — you can ask us to delete your personal data.</li>
          <li><strong>Right to restrict processing</strong> — you can ask us to limit how we use your data.</li>
          <li><strong>Right to data portability</strong> — you can request your data in a machine-readable format.</li>
          <li><strong>Right to object</strong> — you can object to our processing of your data.</li>
        </ul>
        <p>To exercise any of these rights, contact us at <a href="mailto:privacy@toolnest.ai" className="text-[#ddb7ff] hover:opacity-75 transition-opacity">privacy@toolnest.ai</a>.</p>
      </>
    ),
  },
  {
    id: "data-retention",
    title: "7. Data Retention",
    content: (
      <p>
        Contact form submissions are retained for a maximum of 12 months, after which they are
        permanently deleted. Analytics data is anonymised immediately and aggregated — no
        personally identifiable data is retained beyond 30 days. Local storage data (favorites,
        recently used tools) remains in your browser until you clear it.
      </p>
    ),
  },
  {
    id: "security",
    title: "8. Security",
    content: (
      <p>
        We implement industry-standard security measures including HTTPS encryption for all traffic,
        secure server configurations, and regular security reviews. All file processing occurs
        client-side in your browser — your files are never transmitted to or stored on our servers.
        While we take reasonable precautions, no system is completely secure, and we cannot
        guarantee absolute security.
      </p>
    ),
  },
  {
    id: "childrens-privacy",
    title: "9. Children&apos;s Privacy",
    content: (
      <p>
        ToolNest AI is not directed at children under the age of 13. We do not knowingly collect
        personal information from children under 13. If you believe we have inadvertently collected
        such information, please contact us immediately so we can delete it.
      </p>
    ),
  },
  {
    id: "changes",
    title: "10. Changes to This Policy",
    content: (
      <p>
        We may update this Privacy Policy from time to time. We will notify you of material changes
        by updating the &quot;Last updated&quot; date at the top of this page. Your continued use of
        ToolNest AI after any changes constitutes acceptance of the updated policy.
      </p>
    ),
  },
  {
    id: "contact",
    title: "11. Contact",
    content: (
      <p>
        For any privacy-related questions or requests, please contact us at{" "}
        <a href="mailto:privacy@toolnest.ai" className="text-[#ddb7ff] hover:opacity-75 transition-opacity">
          privacy@toolnest.ai
        </a>{" "}
        or use our <Link href="/contact" className="text-[#ddb7ff] hover:opacity-75 transition-opacity">contact form</Link>.
        We aim to respond to all privacy requests within 30 days.
      </p>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="pt-32 pb-24 px-4 md:px-[48px] max-w-[1280px] mx-auto w-full">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Privacy Policy" }]} />

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-12">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#ddb7ff] mb-4">
            Legal
          </p>
          <h1 className="text-[40px] md:text-[52px] font-extrabold tracking-[-0.03em] text-[#e2e2e2] leading-[1.1] mb-5">
            Privacy Policy
          </h1>
          <p className="text-[15px] text-[#7a6d84]">
            Last updated: <span className="text-[#9b8da8] font-medium">{LAST_UPDATED}</span>
          </p>
          <p className="text-[16px] leading-[28px] text-[#9b8da8] mt-4 max-w-2xl">
            Your privacy matters to us. ToolNest AI is built with a privacy-first philosophy:
            your files never leave your browser, we collect minimal analytics, and we never sell your data.
          </p>
        </header>

        {/* Quick nav */}
        <nav
          aria-label="Privacy policy sections"
          className="glass-panel rounded-2xl p-6 mb-10"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#4d4354] mb-4">
            Quick navigation
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            {sections.map(({ id, title }) => (
              <a
                key={id}
                href={`#${id}`}
                className="text-[13px] text-[#7a6d84] hover:text-[#ddb7ff] transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[13px] text-[#3d3347]" aria-hidden="true">
                  chevron_right
                </span>
                {title}
              </a>
            ))}
          </div>
        </nav>

        {/* Sections */}
        <div className="flex flex-col gap-10">
          {sections.map(({ id, title, content }) => (
            <section key={id} id={id} className="scroll-mt-28">
              <h2 className="text-[22px] font-bold text-[#e2e2e2] mb-4">{title}</h2>
              <div className="prose-legal text-[15px] leading-[28px] text-[#9b8da8]">
                {content}
              </div>
            </section>
          ))}
        </div>

        {/* Related links */}
        <div className="mt-14 flex flex-wrap gap-3">
          {[
            { label: "Cookie Policy", href: "/cookie-policy" },
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
