import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumb from "@/components/ui/Breadcrumb";

const SITE_URL = "https://www.toolnestai.net";
const LAST_UPDATED = "19 June 2026";

export const metadata: Metadata = {
  title: "Terms of Service — ToolNest AI",
  description:
    "Read the ToolNest AI Terms of Service. By using our platform, you agree to these terms governing website usage, intellectual property, and user responsibilities.",
  alternates: { canonical: `${SITE_URL}/terms-of-service` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/terms-of-service`,
    title: "Terms of Service — ToolNest AI",
    description: "ToolNest AI Terms of Service — governing website usage and user responsibilities.",
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630 }],
  },
};

const sections = [
  {
    id: "acceptance",
    title: "1. Acceptance of Terms",
    content: (
      <p>
        By accessing or using ToolNest AI at{" "}
        <Link href="/" className="text-[#ddb7ff] hover:opacity-75 transition-opacity">
          www.toolnestai.net
        </Link>{" "}
        (the &quot;Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;).
        If you do not agree to these Terms, please do not use the Service. ToolNest AI reserves
        the right to update these Terms at any time. Continued use of the Service after changes
        constitutes acceptance.
      </p>
    ),
  },
  {
    id: "description",
    title: "2. Description of Service",
    content: (
      <p>
        ToolNest AI provides a collection of free online tools including, but not limited to,
        AI-powered utilities, PDF tools, image editors, developer tools, and calculators. All tools
        are provided &quot;as is&quot; and free of charge. No account creation is required to use
        the Service.
      </p>
    ),
  },
  {
    id: "usage",
    title: "3. Acceptable Use",
    content: (
      <>
        <p>You agree to use ToolNest AI only for lawful purposes. You must not:</p>
        <ul>
          <li>Use the Service to process, generate, or distribute illegal, harmful, or offensive content</li>
          <li>Attempt to reverse-engineer, scrape, or copy any part of the Service</li>
          <li>Use automated bots or scripts to access the Service in a way that degrades performance for other users</li>
          <li>Attempt to gain unauthorized access to any system or network associated with the Service</li>
          <li>Use the Service in any way that violates applicable local, national, or international laws</li>
          <li>Impersonate any person or entity or misrepresent your affiliation with any person or entity</li>
        </ul>
        <p>
          We reserve the right to terminate or restrict access to the Service for users who violate
          these terms.
        </p>
      </>
    ),
  },
  {
    id: "intellectual-property",
    title: "4. Intellectual Property",
    content: (
      <>
        <p>
          All content on ToolNest AI — including but not limited to the website design, code,
          text, graphics, logos, and tool interfaces — is the property of ToolNest AI and is
          protected by applicable intellectual property laws.
        </p>
        <p>
          You retain full ownership of any content you process using our tools. By using our
          tools, you do not grant us any rights to your files or data. All file processing
          occurs locally in your browser and your content is never transmitted to our servers.
        </p>
        <p>
          You may not copy, reproduce, distribute, or create derivative works from any part
          of the ToolNest AI website or its content without our express written permission.
        </p>
      </>
    ),
  },
  {
    id: "disclaimer",
    title: "5. Disclaimer of Warranties",
    content: (
      <>
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES
          OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
        </p>
        <p>
          We do not warrant that the Service will be uninterrupted, error-free, or completely
          secure. We do not warrant the accuracy, completeness, or usefulness of any information
          provided through the Service.
        </p>
        <p>
          AI-generated content produced through our AI tools is for informational purposes only
          and should not be relied upon for professional, legal, medical, or financial advice.
        </p>
      </>
    ),
  },
  {
    id: "liability",
    title: "6. Limitation of Liability",
    content: (
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, TOOLNEST AI SHALL NOT BE LIABLE FOR
        ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT
        NOT LIMITED TO LOSS OF DATA, LOSS OF PROFITS, OR BUSINESS INTERRUPTION, ARISING FROM
        YOUR USE OF OR INABILITY TO USE THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE
        POSSIBILITY OF SUCH DAMAGES. OUR TOTAL LIABILITY SHALL NOT EXCEED €100 IN ANY EVENT.
      </p>
    ),
  },
  {
    id: "availability",
    title: "7. Service Availability",
    content: (
      <p>
        We strive to maintain high availability of the Service but do not guarantee uninterrupted
        access. We reserve the right to modify, suspend, or discontinue any part of the Service
        at any time, with or without notice. We shall not be liable for any downtime or service
        interruption. We may also impose limits on certain features or restrict access to parts
        of the Service without notice.
      </p>
    ),
  },
  {
    id: "user-content",
    title: "8. User Content",
    content: (
      <p>
        You are solely responsible for any content you process or generate using our Service.
        You represent that you have all necessary rights to any content you process. Since all
        file processing occurs client-side, we do not receive, store, or access your content.
        However, you remain fully responsible for ensuring your use of the tools complies with
        applicable laws and does not infringe third-party rights.
      </p>
    ),
  },
  {
    id: "third-party",
    title: "9. Third-Party Links & Services",
    content: (
      <p>
        The Service may contain links to third-party websites or services. These links are
        provided for convenience only. ToolNest AI has no control over the content or practices
        of third-party sites and accepts no responsibility for them. Accessing any linked
        third-party site is at your own risk.
      </p>
    ),
  },
  {
    id: "governing-law",
    title: "10. Governing Law",
    content: (
      <p>
        These Terms shall be governed by and construed in accordance with applicable law.
        Any disputes arising from these Terms or your use of the Service shall be subject
        to the exclusive jurisdiction of the competent courts in the applicable jurisdiction.
        If any provision of these Terms is found to be unenforceable, the remaining provisions
        shall remain in full force and effect.
      </p>
    ),
  },
  {
    id: "changes",
    title: "11. Changes to Terms",
    content: (
      <p>
        We reserve the right to modify these Terms at any time. We will notify users of
        material changes by updating the &quot;Last updated&quot; date on this page. Your
        continued use of the Service after any changes constitutes your acceptance of the
        new Terms. If you do not agree to the new Terms, you must stop using the Service.
      </p>
    ),
  },
  {
    id: "contact",
    title: "12. Contact",
    content: (
      <p>
        If you have questions about these Terms, please contact us at{" "}
        <a
          href="mailto:contact@toolnestai.net"
          className="text-[#ddb7ff] hover:opacity-75 transition-opacity"
        >
          contact@toolnestai.net
        </a>{" "}
        or use our{" "}
        <Link href="/contact" className="text-[#ddb7ff] hover:opacity-75 transition-opacity">
          contact form
        </Link>
        .
      </p>
    ),
  },
];

export default function TermsOfServicePage() {
  return (
    <div className="pt-32 pb-24 px-4 md:px-[48px] max-w-[1280px] mx-auto w-full">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Terms of Service" }]} />

      <div className="max-w-4xl mx-auto">
        <header className="mb-12">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#ddb7ff] mb-4">
            Legal
          </p>
          <h1 className="text-[40px] md:text-[52px] font-extrabold tracking-[-0.03em] text-[#e2e2e2] leading-[1.1] mb-5">
            Terms of Service
          </h1>
          <p className="text-[15px] text-[#7a6d84]">
            Last updated: <span className="text-[#9b8da8] font-medium">{LAST_UPDATED}</span>
          </p>
          <p className="text-[16px] leading-[28px] text-[#9b8da8] mt-4 max-w-2xl">
            Please read these Terms of Service carefully before using ToolNest AI. They govern
            your use of our platform and the tools we provide.
          </p>
        </header>

        {/* Quick nav */}
        <nav
          aria-label="Terms of service sections"
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

        <div className="mt-14 flex flex-wrap gap-3">
          {[
            { label: "Privacy Policy", href: "/privacy-policy" },
            { label: "Cookie Policy", href: "/cookie-policy" },
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
