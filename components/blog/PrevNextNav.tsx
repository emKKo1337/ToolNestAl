import Link from "next/link";
import type { BlogPost } from "@/lib/blog";

export function PrevNextNav({
  prev,
  next,
}: {
  prev: BlogPost | null;
  next: BlogPost | null;
}) {
  if (!prev && !next) return null;

  return (
    <nav
      aria-label="Previous and next articles"
      className="grid gap-3"
      style={{ gridTemplateColumns: "1fr 1fr" }}
    >
      {/* Prev */}
      {prev ? (
        <Link
          href={`/blog/${prev.slug}`}
          className="glass-panel rounded-2xl p-5 flex flex-col gap-2 group transition-all hover:border-white/20"
        >
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#4d4354]">
            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
              arrow_back
            </span>
            Previous
          </span>
          <p className="text-[14px] font-semibold text-[#7a6d84] group-hover:text-[#ddb7ff] transition-colors leading-[1.4] line-clamp-2">
            {prev.title}
          </p>
        </Link>
      ) : (
        <div />
      )}

      {/* Next */}
      {next ? (
        <Link
          href={`/blog/${next.slug}`}
          className="glass-panel rounded-2xl p-5 flex flex-col gap-2 items-end text-right group transition-all hover:border-white/20"
        >
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#4d4354]">
            Next
            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
              arrow_forward
            </span>
          </span>
          <p className="text-[14px] font-semibold text-[#7a6d84] group-hover:text-[#ddb7ff] transition-colors leading-[1.4] line-clamp-2">
            {next.title}
          </p>
        </Link>
      ) : (
        <div />
      )}
    </nav>
  );
}
