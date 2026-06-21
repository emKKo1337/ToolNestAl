import Link from "next/link";
import { tools } from "@/lib/tools";

const columns = [
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    heading: "Tools",
    links: [
      { label: "AI Tools", href: "/ai-tools" },
      { label: "PDF Tools", href: "/pdf-tools" },
      { label: "Image Tools", href: "/image-tools" },
      { label: "Developer Tools", href: "/developer-tools" },
      { label: "Text Tools", href: "/text-tools" },
      { label: "Calculators", href: "/calculators" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy-policy" },
      { label: "Terms of Service", href: "/terms-of-service" },
      { label: "Cookie Policy", href: "/cookie-policy" },
    ],
  },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="w-full"
      style={{ background: "#0d0d0d", borderTop: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="px-6 md:px-[48px] max-w-[1280px] mx-auto w-full">

        {/* Main footer grid */}
        <div className="py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">

          {/* Brand column */}
          <div className="flex flex-col gap-5 sm:col-span-2 lg:col-span-1">
            <Link
              href="/"
              className="flex items-center gap-2 w-fit group"
              aria-label="ToolNest AI — homepage"
            >
              <span
                className="material-symbols-outlined text-[#ddb7ff] text-[22px] transition-transform duration-300 group-hover:rotate-12"
                style={{ fontVariationSettings: "'FILL' 1" }}
                aria-hidden="true"
              >
                build_circle
              </span>
              <span className="text-[18px] font-extrabold text-[#e2e2e2] tracking-tight leading-none">
                ToolNest AI
              </span>
            </Link>

            <p className="text-[13px] leading-[22px] text-[#5a4d63] max-w-[200px]">
              Free AI &amp; Online Tools designed to help you work faster, smarter and more efficiently.
            </p>

            <p className="text-[12px] text-[#3d3347] mt-auto">
              © {year} ToolNest AI. All rights reserved.
            </p>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.heading} className="flex flex-col gap-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#3d3347]">
                {col.heading}
              </p>
              <nav aria-label={`${col.heading} links`}>
                <ul className="flex flex-col gap-2.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-[13px] text-[#5a4d63] hover:text-[#ddb7ff] transition-colors duration-200 w-fit block"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div
          className="h-px w-full"
          style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.06), transparent)" }}
          aria-hidden="true"
        />

        {/* Bottom bar */}
        <div className="py-5 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-[12px] text-[#3d3347]">
            {tools.length}+ tools. No sign-up required.
          </p>
          <p className="text-[12px] text-[#3d3347]">
            © {year} ToolNest AI. All rights reserved.
          </p>
        </div>

      </div>
    </footer>
  );
}
