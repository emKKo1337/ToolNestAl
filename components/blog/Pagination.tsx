import { Fragment } from "react";
import Link from "next/link";

interface Props {
  currentPage: number;
  totalPages: number;
  searchParams: { q?: string; category?: string; tag?: string };
}

export function Pagination({ currentPage, totalPages, searchParams }: Props) {
  if (totalPages <= 1) return null;

  const makeUrl = (page: number) => {
    const params = new URLSearchParams();
    if (searchParams.q) params.set("q", searchParams.q);
    if (searchParams.category) params.set("category", searchParams.category);
    if (searchParams.tag) params.set("tag", searchParams.tag);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return `/blog${qs ? `?${qs}` : ""}`;
  };

  // Always show first, last, current ± 1
  const all = Array.from({ length: totalPages }, (_, i) => i + 1);
  const visible = all.filter(
    (p) =>
      p === 1 ||
      p === totalPages ||
      Math.abs(p - currentPage) <= 1
  );

  return (
    <nav
      aria-label="Blog pagination"
      className="flex items-center justify-center gap-2 mt-12 flex-wrap"
    >
      {/* Prev */}
      {currentPage > 1 ? (
        <Link
          href={makeUrl(currentPage - 1)}
          className="w-9 h-9 rounded-xl flex items-center justify-center glass-panel transition-all hover:border-white/20"
          aria-label="Previous page"
        >
          <span
            className="material-symbols-outlined text-[18px] text-[#7a6d84]"
            aria-hidden="true"
          >
            chevron_left
          </span>
        </Link>
      ) : (
        <span className="w-9 h-9 rounded-xl flex items-center justify-center opacity-30 glass-panel">
          <span className="material-symbols-outlined text-[18px] text-[#7a6d84]" aria-hidden="true">chevron_left</span>
        </span>
      )}

      {/* Page numbers */}
      {visible.map((page, i) => {
        const prev = visible[i - 1];
        const showEllipsis = prev !== undefined && page - prev > 1;
        const isActive = page === currentPage;

        return (
          <Fragment key={page}>
            {showEllipsis && (
              <span className="w-9 h-9 flex items-center justify-center text-[#4d4354] text-[13px]">
                …
              </span>
            )}
            <Link
              href={makeUrl(page)}
              aria-current={isActive ? "page" : undefined}
              aria-label={`Page ${page}`}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[13px] font-semibold transition-all duration-200"
              style={{
                background: isActive
                  ? "rgba(221,183,255,0.18)"
                  : "rgba(255,255,255,0.05)",
                color: isActive ? "#ddb7ff" : "#7a6d84",
                border: `1px solid ${
                  isActive
                    ? "rgba(221,183,255,0.3)"
                    : "rgba(255,255,255,0.08)"
                }`,
              }}
            >
              {page}
            </Link>
          </Fragment>
        );
      })}

      {/* Next */}
      {currentPage < totalPages ? (
        <Link
          href={makeUrl(currentPage + 1)}
          className="w-9 h-9 rounded-xl flex items-center justify-center glass-panel transition-all hover:border-white/20"
          aria-label="Next page"
        >
          <span
            className="material-symbols-outlined text-[18px] text-[#7a6d84]"
            aria-hidden="true"
          >
            chevron_right
          </span>
        </Link>
      ) : (
        <span className="w-9 h-9 rounded-xl flex items-center justify-center opacity-30 glass-panel">
          <span className="material-symbols-outlined text-[18px] text-[#7a6d84]" aria-hidden="true">chevron_right</span>
        </span>
      )}
    </nav>
  );
}
