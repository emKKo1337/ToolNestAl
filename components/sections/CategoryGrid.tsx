import Link from "next/link";

interface Category {
  id: string;
  label: string;
  icon: string;
  iconColor: string;
  bgColor: string;
  href: string;
}

const categories: Category[] = [
  { id: "ai-tools",        label: "AI Tools",        icon: "smart_toy",        iconColor: "#ddb7ff", bgColor: "rgba(221,183,255,0.1)", href: "/ai-tools" },
  { id: "pdf-tools",       label: "PDF Tools",        icon: "picture_as_pdf",   iconColor: "#ffb4ab", bgColor: "rgba(255,180,171,0.1)", href: "/pdf-tools" },
  { id: "image-tools",     label: "Image Tools",      icon: "image",            iconColor: "#4cd7f6", bgColor: "rgba(76,215,246,0.1)",  href: "/image-tools" },
  { id: "developer-tools", label: "Developer Tools",  icon: "terminal",         iconColor: "#adc6ff", bgColor: "rgba(173,198,255,0.1)", href: "/developer-tools" },
];

export default function CategoryGrid() {
  return (
    <section id="popular-tools" aria-labelledby="categories-heading">
      <div className="flex justify-between items-center mb-7">
        <h2
          id="categories-heading"
          className="text-[28px] font-bold leading-[36px] tracking-[-0.02em] text-[#e2e2e2]"
        >
          Browse by Category
        </h2>
        <Link
          href="/ai-tools"
          className="text-[13px] font-semibold text-[#ddb7ff] hover:opacity-75 transition-opacity flex items-center gap-0.5"
        >
          View all
          <span className="material-symbols-outlined text-[15px]" aria-hidden="true">arrow_forward</span>
        </Link>
      </div>

      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
        role="list"
        aria-label="Tool categories"
      >
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={cat.href}
            role="listitem"
            className="glass-panel glass-panel-hover rounded-2xl p-5 flex flex-col items-center justify-center gap-3 group"
            aria-label={`Browse ${cat.label}`}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center transition-colors"
              style={{ backgroundColor: cat.bgColor }}
            >
              <span
                className="material-symbols-outlined text-[28px]"
                style={{ color: cat.iconColor, fontVariationSettings: "'FILL' 1" }}
                aria-hidden="true"
              >
                {cat.icon}
              </span>
            </div>
            <span className="text-[15px] font-semibold leading-snug text-[#e2e2e2] text-center group-hover:text-[#ddb7ff] transition-colors duration-200">
              {cat.label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
