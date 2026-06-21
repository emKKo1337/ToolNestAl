import Link from "next/link";
import { categories, getToolsByCategory } from "@/lib/tools";

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
          href="/tools"
          className="text-[13px] font-semibold text-[#ddb7ff] hover:opacity-75 transition-opacity flex items-center gap-0.5"
        >
          View all
          <span className="material-symbols-outlined text-[15px]" aria-hidden="true">arrow_forward</span>
        </Link>
      </div>

      <div
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
        role="list"
        aria-label="Tool categories"
      >
        {categories.map((cat) => {
          const count = getToolsByCategory(cat.slug).length;
          return (
            <Link
              key={cat.slug}
              href={`/${cat.slug}`}
              role="listitem"
              className="glass-panel glass-panel-hover rounded-2xl p-5 flex flex-col items-center justify-center gap-3 group"
              aria-label={`Browse ${cat.name}`}
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
              <div className="flex flex-col items-center gap-1">
                <span className="text-[14px] font-semibold leading-snug text-[#e2e2e2] text-center group-hover:text-[#ddb7ff] transition-colors duration-200">
                  {cat.name}
                </span>
                <span className="text-[11px] text-[#988d9f]">{count} {count === 1 ? "tool" : "tools"}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
