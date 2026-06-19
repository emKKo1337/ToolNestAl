import type { Metadata } from "next";
import Link from "next/link";
import {
  getAllPosts,
  getFeaturedPosts,
  getAllCategories,
  filterPosts,
} from "@/lib/blog";
import { FeaturedCard } from "@/components/blog/FeaturedCard";
import { ArticleCard } from "@/components/blog/ArticleCard";
import { BlogSearch } from "@/components/blog/BlogSearch";
import { CategoryFilter } from "@/components/blog/CategoryFilter";
import { Pagination } from "@/components/blog/Pagination";
import { BlogEmpty } from "@/components/blog/BlogEmpty";

const SITE_URL = "https://www.toolnestai.net";
const SITE_NAME = "ToolNest AI";
const PER_PAGE = 9;

export const metadata: Metadata = {
  title: "Blog — AI Tools Guides, Tutorials & Tips",
  description:
    "Explore guides, tutorials, and tips on AI tools, PDF utilities, image editors, developer tools and more from the ToolNest AI team.",
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/blog`,
    siteName: SITE_NAME,
    title: "Blog — AI Tools Guides, Tutorials & Tips | ToolNest AI",
    description:
      "Explore guides, tutorials, and tips on AI tools, PDF utilities, image editors, developer tools and more from the ToolNest AI team.",
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630, alt: "ToolNest AI Blog" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@toolnestai",
    creator: "@toolnestai",
    title: "Blog — AI Tools Guides, Tutorials & Tips | ToolNest AI",
    description:
      "Explore guides, tutorials, and tips on AI tools, PDF utilities, image editors, developer tools and more from the ToolNest AI team.",
    images: [`${SITE_URL}/og-image.png`],
  },
};

interface PageProps {
  searchParams: Promise<{ q?: string; category?: string; tag?: string; page?: string }>;
}

export default async function BlogPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const category = sp.category ?? "";
  const tag = sp.tag ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const allPosts = getAllPosts();
  const featuredPosts = getFeaturedPosts(3);
  const categories = getAllCategories();

  const isFiltered = !!(q || category || tag);
  const filtered = isFiltered ? filterPosts(allPosts, { q, category, tag }) : allPosts;

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const pagePosts = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "ToolNest AI Blog",
    url: `${SITE_URL}/blog`,
    description: "Guides, tutorials, and tips on AI tools, PDF utilities, image editors, and developer tools.",
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="max-w-[1200px] mx-auto w-full px-4 sm:px-6 py-12">
        {/* Header */}
        <header className="mb-12 text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#ddb7ff] mb-3">
            ToolNest AI Blog
          </p>
          <h1 className="text-[36px] md:text-[52px] font-extrabold tracking-[-0.03em] text-[#e2e2e2] leading-[1.1] mb-4">
            Guides, Tutorials & Tips
          </h1>
          <p className="text-[17px] text-[#7a6d84] max-w-xl mx-auto leading-relaxed">
            Learn how to get the most out of free online tools with in-depth articles from our team.
          </p>
        </header>

        {/* Featured section — only when not filtering */}
        {!isFiltered && featuredPosts.length > 0 && (
          <section aria-labelledby="featured-heading" className="mb-14">
            <h2
              id="featured-heading"
              className="text-[13px] font-bold uppercase tracking-[0.1em] text-[#4d4354] mb-5"
            >
              Featured
            </h2>
            <div className="flex flex-col gap-4">
              {featuredPosts.map((post) => (
                <FeaturedCard key={post.slug} post={post} />
              ))}
            </div>
          </section>
        )}

        {/* Search + filter row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="flex-1">
            <BlogSearch defaultValue={q} />
          </div>
        </div>

        {/* Category filter pills */}
        {categories.length > 0 && (
          <div className="mb-8">
            <CategoryFilter
              categories={categories}
              activeCategory={category}
              activeTag={tag}
              searchQuery={q}
            />
          </div>
        )}

        {/* Tag filter indicator */}
        {tag && (
          <div className="mb-6 flex items-center gap-2 flex-wrap">
            <span className="text-[13px] text-[#7a6d84]">Filtered by tag:</span>
            <span
              className="px-3 py-1 rounded-full text-[12px] font-semibold"
              style={{
                background: "rgba(76,215,246,0.1)",
                color: "#4cd7f6",
                border: "1px solid rgba(76,215,246,0.2)",
              }}
            >
              #{tag}
            </span>
            <Link
              href={`/blog${q ? `?q=${encodeURIComponent(q)}` : ""}${category ? `${q ? "&" : "?"}category=${encodeURIComponent(category)}` : ""}`}
              className="text-[12px] text-[#4d4354] hover:text-[#7a6d84] transition-colors"
            >
              ✕ Remove
            </Link>
          </div>
        )}

        {/* Articles grid */}
        {pagePosts.length > 0 ? (
          <>
            <section aria-label="Articles">
              <h2 className="sr-only">
                {isFiltered ? "Search results" : "Latest articles"}
              </h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {pagePosts.map((post) => (
                  <ArticleCard key={post.slug} post={post} />
                ))}
              </div>
            </section>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              searchParams={{ q, category, tag }}
            />
          </>
        ) : (
          <BlogEmpty
            title={isFiltered ? "No articles found" : "No articles yet"}
            message={
              isFiltered
                ? "Try a different search or remove filters."
                : "Articles are coming soon. Check back later!"
            }
            showBrowse={isFiltered}
          />
        )}
      </div>
    </>
  );
}
