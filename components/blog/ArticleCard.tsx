import Link from "next/link";
import type { BlogPost } from "@/lib/blog";

export function ArticleCard({ post }: { post: BlogPost }) {
  const date = new Date(post.publishedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <article className="glass-panel glass-panel-hover rounded-2xl overflow-hidden flex flex-col group h-full">
      {/* Hero image / gradient placeholder */}
      <Link
        href={`/blog/${post.slug}`}
        className="block flex-shrink-0 relative overflow-hidden"
        style={{ aspectRatio: "16/9" }}
        tabIndex={-1}
        aria-hidden="true"
      >
        {post.image ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={post.image}
            alt={post.imageAlt ?? post.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg,rgba(221,183,255,0.12) 0%,rgba(76,215,246,0.07) 100%)",
            }}
          >
            <span
              className="material-symbols-outlined text-[36px] text-[#3d3347]"
              aria-hidden="true"
            >
              article
            </span>
          </div>
        )}
        {/* Category pill */}
        <span
          className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-[0.08em]"
          style={{
            background: "rgba(19,19,19,0.7)",
            color: "#ddb7ff",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(221,183,255,0.2)",
          }}
        >
          {post.category}
        </span>
      </Link>

      {/* Body */}
      <div className="p-5 flex flex-col gap-3 flex-1">
        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {post.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[11px] text-[#5a4d63] font-medium">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <Link href={`/blog/${post.slug}`}>
          <h2 className="text-[17px] font-bold text-[#e2e2e2] leading-snug line-clamp-2 group-hover:text-[#ddb7ff] transition-colors duration-200">
            {post.title}
          </h2>
        </Link>

        {/* Description */}
        <p className="text-[13px] leading-[21px] text-[#7a6d84] line-clamp-3 flex-1">
          {post.description}
        </p>

        {/* Footer meta */}
        <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-auto">
          <span className="text-[11px] text-[#4d4354]">{date}</span>
          <span className="text-[11px] text-[#4d4354] flex items-center gap-1">
            <span
              className="material-symbols-outlined text-[13px]"
              aria-hidden="true"
            >
              schedule
            </span>
            {post.readingTime}
          </span>
        </div>
      </div>
    </article>
  );
}
