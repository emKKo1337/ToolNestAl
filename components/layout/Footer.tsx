import Link from "next/link";

const footerLinks = [
  { heading: "Product", links: [{ label: "AI Tools", href: "/ai-tools" }, { label: "PDF Tools", href: "/pdf-tools" }, { label: "Image Tools", href: "/image-tools" }, { label: "Developer Tools", href: "/developer-tools" }] },
  { heading: "More", links: [{ label: "Calculators", href: "/calculators" }, { label: "Favorites", href: "/favorites" }] },
  { heading: "Company", links: [{ label: "About", href: "" }, { label: "Blog", href: "" }, { label: "Contact", href: "" }] },
  { heading: "Legal", links: [{ label: "Privacy", href: "" }, { label: "Terms", href: "" }] },
];

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="w-full border-t border-white/5" style={{ background: "#0d0d0d" }}>
      <div className="px-4 md:px-[48px] max-w-[1280px] mx-auto w-full py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-x-6 gap-y-12">
          {/* Brand */}
          <div className="col-span-2 flex flex-col gap-4">
            <Link
              href="/"
              className="text-[20px] font-extrabold text-[#e2e2e2] flex items-center gap-2 leading-none w-fit"
              aria-label="ToolNest AI — homepage"
            >
              <span
                className="material-symbols-outlined text-[#ddb7ff] text-[22px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
                aria-hidden="true"
              >
                build_circle
              </span>
              ToolNest AI
            </Link>
            <p className="text-[14px] leading-[22px] text-[#7a6d84] max-w-[220px]">
              100+ free AI &amp; online tools — no sign-up required.
            </p>
            <p className="text-[13px] text-[#4d4354] mt-auto">
              © {year} ToolNest AI
            </p>
          </div>

          {/* Link columns */}
          {footerLinks.map((col) => (
            <div key={col.heading} className="flex flex-col gap-3">
              <p className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#4d4354] mb-1">
                {col.heading}
              </p>
              {col.links.map((link) =>
                link.href ? (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="text-[14px] text-[#7a6d84] hover:text-[#ddb7ff] transition-colors duration-200 w-fit"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <span
                    key={link.label}
                    className="text-[14px] text-[#4d4354] w-fit cursor-default"
                    aria-label={`${link.label} — coming soon`}
                  >
                    {link.label}
                  </span>
                )
              )}
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
