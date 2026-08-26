import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Breadcrumb from "@/components/ui/Breadcrumb";
import { ArticleCard } from "@/components/blog/ArticleCard";
import { AUTHOR } from "@/lib/author";
import { getAllPosts } from "@/lib/blog";

const SITE_URL = "https://www.toolnestai.net";
const SITE_NAME = "ToolNest AI";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return [{ slug: AUTHOR.slug }];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  if (slug !== AUTHOR.slug) return {};

  const url = `${SITE_URL}/author/${AUTHOR.slug}`;
  const title = `${AUTHOR.name} — Author at ${SITE_NAME}`;
  const description = `${AUTHOR.role}. ${AUTHOR.bio}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "profile",
      url,
      siteName: SITE_NAME,
      locale: "en_US",
      title,
      description,
      images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630, alt: AUTHOR.name }],
    },
    twitter: {
      card: "summary_large_image",
      site: "@toolnestai",
      creator: `@${AUTHOR.twitter}`,
      title,
      description,
      images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630, alt: AUTHOR.name }],
    },
  };
}

export default async function AuthorPage({ params }: PageProps) {
  const { slug } = await params;
  if (slug !== AUTHOR.slug) notFound();

  const posts = getAllPosts().filter((p) => p.author.name === AUTHOR.name);
  const url = `${SITE_URL}/author/${AUTHOR.slug}`;

  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: AUTHOR.name,
    url,
    jobTitle: AUTHOR.role,
    description: AUTHOR.bio,
    address: { "@type": "PostalAddress", addressCountry: AUTHOR.location },
    sameAs: [AUTHOR.github, `https://x.com/${AUTHOR.twitter}`],
    worksFor: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
      { "@type": "ListItem", position: 3, name: AUTHOR.name, item: url },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="pt-32 pb-24 px-4 md:px-[48px] max-w-[1280px] mx-auto w-full">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Blog", href: "/blog" }, { label: AUTHOR.name }]} />

        {/* Author header */}
        <div className="glass-panel rounded-3xl p-8 md:p-10 mb-14 flex flex-col sm:flex-row gap-6 sm:items-center">
          <div
            className="w-20 h-20 rounded-2xl flex-shrink-0 flex items-center justify-center"
            style={{ background: "rgba(221,183,255,0.1)" }}
            aria-label={`${AUTHOR.name} avatar placeholder`}
          >
            <span
              className="material-symbols-outlined text-[36px] text-[#ddb7ff]"
              aria-hidden="true"
            >
              person
            </span>
          </div>

          <div className="min-w-0">
            <h1 className="text-[28px] md:text-[34px] font-extrabold tracking-[-0.02em] text-[#e2e2e2] leading-tight mb-1.5">
              {AUTHOR.name}
            </h1>
            <p className="text-[14px] font-semibold text-[#ddb7ff] mb-3">
              {AUTHOR.role} · {AUTHOR.location}
            </p>
            <p className="text-[15px] leading-[26px] text-[#9b8da8] max-w-2xl mb-4">
              {AUTHOR.bio}
            </p>
            <div className="flex items-center gap-4">
              <a
                href={AUTHOR.github}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#7a6d84] hover:text-[#ddb7ff] transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">code</span>
                GitHub
              </a>
              <a
                href={`https://x.com/${AUTHOR.twitter}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#7a6d84] hover:text-[#ddb7ff] transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.736l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                @{AUTHOR.twitter}
              </a>
            </div>
          </div>
        </div>

        {/* Articles */}
        <section>
          <h2 className="text-[22px] font-bold text-[#e2e2e2] mb-6">
            Articles by {AUTHOR.name} ({posts.length})
          </h2>
          {posts.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {posts.map((post) => (
                <ArticleCard key={post.slug} post={post} />
              ))}
            </div>
          ) : (
            <p className="text-[14px] text-[#7a6d84]">No published articles yet.</p>
          )}
        </section>

        <div className="mt-14">
          <Link
            href="/about"
            className="text-[13px] text-[#ddb7ff] hover:opacity-75 transition-opacity"
          >
            Learn more about ToolNest AI's editorial policy →
          </Link>
        </div>
      </div>
    </>
  );
}
