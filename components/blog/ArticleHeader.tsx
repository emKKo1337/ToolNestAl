import Image from "next/image";
import type { BlogPost } from "@/lib/blog";

export function ArticleHeader({ post }: { post: BlogPost }) {
  const pubDate = new Date(post.publishedAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const updDate = post.updatedAt
    ? new Date(post.updatedAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <header className="mb-10">
      {/* Category + reading time */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <span
          className="px-3 py-1 rounded-lg text-[12px] font-bold uppercase tracking-[0.08em]"
          style={{
            background: "rgba(221,183,255,0.12)",
            color: "#ddb7ff",
            border: "1px solid rgba(221,183,255,0.2)",
          }}
        >
          {post.category}
        </span>
        <span className="text-[13px] text-[#4d4354] flex items-center gap-1">
          <span
            className="material-symbols-outlined text-[14px]"
            aria-hidden="true"
          >
            schedule
          </span>
          {post.readingTime}
        </span>
        {post.featured && (
          <span
            className="px-2.5 py-1 rounded-lg text-[11px] font-bold"
            style={{
              background: "rgba(76,215,246,0.1)",
              color: "#4cd7f6",
              border: "1px solid rgba(76,215,246,0.2)",
            }}
          >
            ★ Featured
          </span>
        )}
      </div>

      {/* Title */}
      <h1 className="text-[32px] md:text-[44px] font-extrabold leading-[1.1] tracking-[-0.03em] text-[#e2e2e2] mb-5">
        {post.title}
      </h1>

      {/* Description */}
      <p className="text-[18px] leading-[30px] text-[#9b8da8] mb-7 max-w-3xl">
        {post.description}
      </p>

      {/* Author + dates divider row */}
      <div
        className="flex items-center gap-5 flex-wrap pb-7"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* Author */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
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
                className="material-symbols-outlined text-[17px] text-[#ddb7ff]"
                aria-hidden="true"
              >
                person
              </span>
            )}
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[#e2e2e2] leading-none mb-0.5">
              {post.author.name}
            </p>
            <p className="text-[11px] text-[#4d4354] leading-none">Author</p>
          </div>
        </div>

        <div
          className="h-5 w-px hidden sm:block"
          style={{ background: "rgba(255,255,255,0.08)" }}
          aria-hidden="true"
        />

        {/* Published */}
        <div>
          <p className="text-[11px] text-[#4d4354] mb-0.5">Published</p>
          <time dateTime={post.publishedAt} className="text-[13px] text-[#7a6d84] font-medium">
            {pubDate}
          </time>
        </div>

        {updDate && (
          <>
            <div
              className="h-5 w-px hidden sm:block"
              style={{ background: "rgba(255,255,255,0.08)" }}
              aria-hidden="true"
            />
            <div>
              <p className="text-[11px] text-[#4d4354] mb-0.5">Last updated</p>
              <time dateTime={post.updatedAt} className="text-[13px] text-[#7a6d84] font-medium">
                {updDate}
              </time>
            </div>
          </>
        )}
      </div>

      {/* Hero image */}
      {post.image && (
        <div className="mt-8 rounded-2xl overflow-hidden relative" style={{ aspectRatio: "16/9" }}>
          <Image
            src={post.image}
            alt={post.imageAlt ?? post.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 80vw, 900px"
            className="object-cover"
            priority
          />
        </div>
      )}
    </header>
  );
}
