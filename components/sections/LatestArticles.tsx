import Link from "next/link";
import { getAllPosts } from "@/lib/blog";
import { ArticleCard } from "@/components/blog/ArticleCard";

export default function LatestArticles() {
  const posts = getAllPosts().slice(0, 3);

  return (
    <section aria-labelledby="latest-articles-heading">
      {/* Section header */}
      <div className="flex items-end justify-between mb-8 gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#ddb7ff] mb-2">
            From the Blog
          </p>
          <h2
            id="latest-articles-heading"
            className="text-[28px] md:text-[36px] font-extrabold tracking-[-0.02em] text-[#e2e2e2] leading-[1.1]"
          >
            Latest Articles
          </h2>
        </div>
        <Link
          href="/blog"
          className="flex-shrink-0 flex items-center gap-1.5 text-[13px] font-semibold text-[#ddb7ff] hover:opacity-75 transition-opacity"
        >
          View All Articles
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            arrow_forward
          </span>
        </Link>
      </div>

      {posts.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <ArticleCard key={post.slug} post={post} />
          ))}
        </div>
      ) : (
        /* Empty placeholder */
        <div
          className="glass-panel rounded-3xl flex flex-col items-center justify-center py-20 px-8 text-center gap-5"
          style={{ borderColor: "rgba(221,183,255,0.08)" }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(221,183,255,0.07)" }}
          >
            <span
              className="material-symbols-outlined text-[32px] text-[#3d3347]"
              aria-hidden="true"
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 300" }}
            >
              article
            </span>
          </div>
          <div>
            <p className="text-[18px] font-bold text-[#e2e2e2] mb-1.5">
              Articles coming soon
            </p>
            <p className="text-[14px] text-[#5a4d63] max-w-xs leading-snug mx-auto">
              We&apos;re working on guides and tutorials. Check back soon!
            </p>
          </div>
          <Link
            href="/blog"
            className="flex items-center gap-1.5 text-[13px] font-semibold text-[#ddb7ff] hover:opacity-75 transition-opacity mt-1"
          >
            Visit the Blog
            <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
              arrow_forward
            </span>
          </Link>
        </div>
      )}
    </section>
  );
}
