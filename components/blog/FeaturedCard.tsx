import Link from "next/link";
import type { BlogPost } from "@/lib/blog";

export function FeaturedCard({ post }: { post: BlogPost }) {
  const date = new Date(post.publishedAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <article className="glass-panel rounded-3xl overflow-hidden grid md:grid-cols-2 group">
      {/* Image */}
      <Link
        href={`/blog/${post.slug}`}
        className="block relative overflow-hidden min-h-[240px] md:min-h-[320px]"
        tabIndex={-1}
        aria-hidden="true"
      >
        {post.image ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={post.image}
            alt={post.imageAlt ?? post.title}
            className="w-full h-full object-cover absolute inset-0 transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className="w-full h-full absolute inset-0 flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg,rgba(221,183,255,0.18) 0%,rgba(76,215,246,0.10) 100%)",
            }}
          >
            <span
              className="material-symbols-outlined text-[64px] text-[#3d3347]"
              aria-hidden="true"
            >
              featured_play_list
            </span>
          </div>
        )}
        {/* Featured badge */}
        <span
          className="absolute top-4 left-4 px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-[0.08em]"
          style={{
            background: "rgba(221,183,255,0.2)",
            color: "#ddb7ff",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(221,183,255,0.3)",
          }}
        >
          ★ Featured
        </span>
      </Link>

      {/* Content */}
      <div className="p-8 md:p-10 flex flex-col justify-center gap-5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span
            className="px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-[0.08em]"
            style={{
              background: "rgba(76,215,246,0.1)",
              color: "#4cd7f6",
              border: "1px solid rgba(76,215,246,0.2)",
            }}
          >
            {post.category}
          </span>
          <span className="text-[12px] text-[#4d4354] flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px]" aria-hidden="true">schedule</span>
            {post.readingTime}
          </span>
        </div>

        <Link href={`/blog/${post.slug}`}>
          <h2 className="text-[24px] md:text-[30px] font-extrabold text-[#e2e2e2] leading-tight group-hover:text-[#ddb7ff] transition-colors duration-200">
            {post.title}
          </h2>
        </Link>

        <p className="text-[15px] leading-[26px] text-[#9b8da8] line-clamp-3">
          {post.description}
        </p>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "rgba(221,183,255,0.12)" }}
            >
              {post.author.avatar ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={post.author.avatar}
                  alt={post.author.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span
                  className="material-symbols-outlined text-[16px] text-[#ddb7ff]"
                  aria-hidden="true"
                >
                  person
                </span>
              )}
            </div>
            <span className="text-[13px] text-[#9b8da8] font-medium">
              {post.author.name}
            </span>
          </div>
          <span className="text-[12px] text-[#4d4354]">{date}</span>
        </div>

        <Link
          href={`/blog/${post.slug}`}
          className="btn-primary text-white text-[14px] font-semibold px-5 py-2.5 rounded-xl inline-flex items-center gap-2 w-fit"
        >
          Read Article
          <span
            className="material-symbols-outlined text-[16px]"
            aria-hidden="true"
          >
            arrow_forward
          </span>
        </Link>
      </div>
    </article>
  );
}
