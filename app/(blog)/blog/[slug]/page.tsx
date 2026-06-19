import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import {
  getAllPosts,
  getPostBySlug,
  getRelatedPosts,
  getPrevNext,
} from "@/lib/blog";
import { mdxComponents } from "@/components/blog/mdx/components";
import { ArticleHeader } from "@/components/blog/ArticleHeader";
import { TableOfContents } from "@/components/blog/TableOfContents";
import { ShareButtons } from "@/components/blog/ShareButtons";
import { AuthorCard } from "@/components/blog/AuthorCard";
import { PrevNextNav } from "@/components/blog/PrevNextNav";
import { RelatedPosts } from "@/components/blog/RelatedPosts";

const SITE_URL = "https://www.toolnestai.net";
const SITE_NAME = "ToolNest AI";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  const url = `${SITE_URL}/blog/${slug}`;
  const title = `${post.title}`;
  const imageUrl = post.image ?? `${SITE_URL}/og-image.png`;

  return {
    title,
    description: post.description,
    keywords: [post.category, ...post.tags],
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      siteName: SITE_NAME,
      title: `${title} | ${SITE_NAME}`,
      description: post.description,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: [post.author.name],
      section: post.category,
      tags: post.tags,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: post.imageAlt ?? title }],
    },
    twitter: {
      card: "summary_large_image",
      site: "@toolnestai",
      creator: "@toolnestai",
      title: `${title} | ${SITE_NAME}`,
      description: post.description,
      images: [imageUrl],
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const { prev, next } = getPrevNext(slug);
  const related = getRelatedPosts(post, 3);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    url: `${SITE_URL}/blog/${slug}`,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    author: {
      "@type": "Person",
      name: post.author.name,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    image: post.image ?? `${SITE_URL}/og-image.png`,
    articleSection: post.category,
    keywords: post.tags.join(", "),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
      { "@type": "ListItem", position: 3, name: post.title, item: `${SITE_URL}/blog/${slug}` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="max-w-[1200px] mx-auto w-full px-4 sm:px-6 py-10">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex items-center gap-1.5 flex-wrap text-[13px]">
            <li>
              <Link href="/" className="text-[#4d4354] hover:text-[#7a6d84] transition-colors">
                Home
              </Link>
            </li>
            <li className="text-[#2d2438]" aria-hidden="true">/</li>
            <li>
              <Link href="/blog" className="text-[#4d4354] hover:text-[#7a6d84] transition-colors">
                Blog
              </Link>
            </li>
            <li className="text-[#2d2438]" aria-hidden="true">/</li>
            <li className="text-[#7a6d84] truncate max-w-[200px]" aria-current="page">
              {post.title}
            </li>
          </ol>
        </nav>

        {/* 2-column layout: article + TOC sidebar */}
        <div className="flex gap-12 items-start">
          {/* Article */}
          <article className="flex-1 min-w-0">
            <ArticleHeader post={post} />

            {/* MDX Content */}
            <div className="prose-blog">
              <MDXRemote
                source={post.content}
                components={mdxComponents}
                options={{
                  mdxOptions: {
                    remarkPlugins: [remarkGfm],
                    rehypePlugins: [
                      rehypeSlug,
                      [rehypeAutolinkHeadings, { behavior: "wrap" }],
                      [
                        rehypePrettyCode,
                        {
                          theme: "github-dark-dimmed",
                          keepBackground: false,
                        },
                      ],
                    ],
                  },
                }}
              />
            </div>

            {/* Tags */}
            {post.tags.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap mt-10 pt-8" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#4d4354]">Tags:</span>
                {post.tags.map((t) => (
                  <Link
                    key={t}
                    href={`/blog?tag=${encodeURIComponent(t)}`}
                    className="px-2.5 py-1 rounded-lg text-[12px] font-medium transition-all hover:border-white/20"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      color: "#5a4d63",
                      border: "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    #{t}
                  </Link>
                ))}
              </div>
            )}

            {/* Share */}
            <div className="mt-8">
              <ShareButtons slug={slug} title={post.title} />
            </div>

            {/* Author */}
            <div className="mt-10">
              <AuthorCard author={post.author} />
            </div>

            {/* Prev/Next */}
            <div className="mt-10">
              <PrevNextNav prev={prev} next={next} />
            </div>

            {/* Related posts */}
            {related.length > 0 && (
              <div className="mt-14">
                <RelatedPosts posts={related} />
              </div>
            )}
          </article>

          {/* TOC sidebar — hidden on mobile */}
          {post.headings.length > 0 && (
            <aside
              className="hidden xl:block w-[220px] flex-shrink-0"
              aria-label="Table of contents"
            >
              <TableOfContents headings={post.headings} />
            </aside>
          )}
        </div>
      </div>
    </>
  );
}
