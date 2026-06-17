import Link from "next/link";

const columns = [
  [
    { label: "About", href: "#" },
    { label: "Blog", href: "#" },
  ],
  [
    { label: "Privacy", href: "#" },
    { label: "Terms", href: "#" },
  ],
  [{ label: "Contact", href: "#" }],
  [
    { label: "API", href: "#" },
    { label: "Developers", href: "#" },
  ],
];

export default function Footer() {
  return (
    <footer className="bg-[#0e0e0e] w-full py-16 border-t border-white/5">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 px-4 md:px-[48px] max-w-[1280px] mx-auto">
        {/* Brand column */}
        <div className="col-span-2 md:col-span-4 lg:col-span-2 mb-8 lg:mb-0">
          <div className="text-[24px] font-bold text-[#e2e2e2] mb-4 flex items-center gap-2">
            <span
              className="material-symbols-outlined text-[#ddb7ff] text-[24px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
              aria-hidden="true"
            >
              build_circle
            </span>
            ToolNest AI
          </div>
          <p className="text-[16px] text-[#cfc2d6] max-w-sm leading-[24px]">
            © 2024 ToolNest AI. Aetheric Precision for the Modern Web.
          </p>
        </div>

        {/* Link columns */}
        {columns.map((col, i) => (
          <div key={i} className="flex flex-col gap-4">
            {col.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-[16px] text-[#cfc2d6] hover:text-[#ddb7ff] transition-colors duration-200 hover:translate-x-1 inline-block"
              >
                {link.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </footer>
  );
}
