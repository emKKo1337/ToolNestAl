import Link from "next/link";

interface Props {
  categories: Array<{ name: string; count: number }>;
  activeCategory?: string;
  activeTag?: string;
  searchQuery?: string;
}

export function CategoryFilter({
  categories,
  activeCategory,
  activeTag,
  searchQuery,
}: Props) {
  const buildHref = (category?: string) => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (activeTag) params.set("tag", activeTag);
    if (searchQuery) params.set("q", searchQuery);
    const qs = params.toString();
    return `/blog${qs ? `?${qs}` : ""}`;
  };

  return (
    <div
      className="flex flex-wrap gap-2"
      role="list"
      aria-label="Filter by category"
    >
      <Link
        href={buildHref()}
        role="listitem"
        className="px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200"
        style={{
          background: !activeCategory
            ? "rgba(221,183,255,0.15)"
            : "rgba(255,255,255,0.05)",
          color: !activeCategory ? "#ddb7ff" : "#7a6d84",
          border: `1px solid ${
            !activeCategory
              ? "rgba(221,183,255,0.3)"
              : "rgba(255,255,255,0.08)"
          }`,
        }}
      >
        All Articles
      </Link>

      {categories.map(({ name, count }) => {
        const active =
          activeCategory?.toLowerCase() === name.toLowerCase();
        return (
          <Link
            key={name}
            href={buildHref(name)}
            role="listitem"
            className="px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 flex items-center gap-2"
            style={{
              background: active
                ? "rgba(221,183,255,0.15)"
                : "rgba(255,255,255,0.05)",
              color: active ? "#ddb7ff" : "#7a6d84",
              border: `1px solid ${
                active
                  ? "rgba(221,183,255,0.3)"
                  : "rgba(255,255,255,0.08)"
              }`,
            }}
          >
            {name}
            <span
              className="text-[10px] opacity-50 font-bold tabular-nums"
            >
              {count}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
