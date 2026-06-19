import type { BlogPost } from "@/lib/blog";
import { ArticleCard } from "./ArticleCard";

export function RelatedPosts({ posts }: { posts: BlogPost[] }) {
  if (posts.length === 0) return null;

  return (
    <section aria-labelledby="related-heading">
      <h2
        id="related-heading"
        className="text-[20px] font-bold text-[#e2e2e2] mb-6"
      >
        Related Articles
      </h2>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <ArticleCard key={post.slug} post={post} />
        ))}
      </div>
    </section>
  );
}
