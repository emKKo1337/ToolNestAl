import fs from "fs";
import path from "path";
import matter from "gray-matter";
import readingTime from "reading-time";
import GithubSlugger from "github-slugger";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BlogAuthor {
  name: string;
  bio: string;
  avatar?: string;
  twitter?: string;
}

export interface TOCHeading {
  id: string;
  text: string;
  level: 2 | 3 | 4;
}

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  content: string;          // raw MDX without frontmatter
  publishedAt: string;      // ISO date "2024-01-15"
  updatedAt?: string;
  author: BlogAuthor;
  category: string;
  tags: string[];
  image?: string;
  imageAlt?: string;
  featured: boolean;
  readingTime: string;      // "5 min read"
  relatedTools: string[];   // tool slugs
  relatedPosts: string[];   // post slugs
  headings: TOCHeading[];
}

export const BLOG_CATEGORIES = [
  "AI", "PDF", "Images", "Developer", "Security", "Guides", "SEO",
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stripMdx(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .trim();
}

function extractHeadings(content: string): TOCHeading[] {
  const slugger = new GithubSlugger();
  const headings: TOCHeading[] = [];

  for (const line of content.split("\n")) {
    const match = line.match(/^(#{2,4})\s+(.+)$/);
    if (!match) continue;
    const level = match[1].length as 2 | 3 | 4;
    const text = stripMdx(match[2]);
    const id = slugger.slug(text);
    headings.push({ id, text, level });
  }

  return headings;
}

function parsePost(filename: string): BlogPost {
  const slug = filename.replace(/\.mdx?$/, "");
  const filePath = path.join(BLOG_DIR, filename);
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);

  return {
    slug,
    title: data.title ?? slug,
    description: data.description ?? "",
    content,
    publishedAt: data.publishedAt ?? new Date().toISOString().split("T")[0],
    updatedAt: data.updatedAt,
    author: {
      name: data.author?.name ?? "ToolNest AI",
      bio: data.author?.bio ?? "The ToolNest AI editorial team.",
      avatar: data.author?.avatar,
      twitter: data.author?.twitter,
    },
    category: data.category ?? "Guides",
    tags: Array.isArray(data.tags) ? data.tags : [],
    image: data.image,
    imageAlt: data.imageAlt ?? data.title,
    featured: data.featured === true,
    readingTime: readingTime(content).text,
    relatedTools: Array.isArray(data.relatedTools) ? data.relatedTools : [],
    relatedPosts: Array.isArray(data.relatedPosts) ? data.relatedPosts : [],
    headings: extractHeadings(content),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return [];

  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => /\.mdx?$/.test(f))
    .map(parsePost)
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
}

export function getPostBySlug(slug: string): BlogPost | null {
  const mdx = path.join(BLOG_DIR, `${slug}.mdx`);
  const md = path.join(BLOG_DIR, `${slug}.md`);
  if (fs.existsSync(mdx)) return parsePost(`${slug}.mdx`);
  if (fs.existsSync(md)) return parsePost(`${slug}.md`);
  return null;
}

export function getFeaturedPosts(limit = 3): BlogPost[] {
  const all = getAllPosts();
  const featured = all.filter((p) => p.featured);
  return (featured.length > 0 ? featured : all).slice(0, limit);
}

export function getRelatedPosts(post: BlogPost, limit = 3): BlogPost[] {
  const all = getAllPosts().filter((p) => p.slug !== post.slug);

  if (post.relatedPosts.length > 0) {
    const explicit = post.relatedPosts
      .map((s) => all.find((p) => p.slug === s))
      .filter(Boolean) as BlogPost[];
    if (explicit.length > 0) return explicit.slice(0, limit);
  }

  return all
    .map((p) => ({
      post: p,
      score:
        (p.category === post.category ? 3 : 0) +
        p.tags.filter((t) => post.tags.includes(t)).length,
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.post);
}

export function getPrevNext(slug: string): {
  prev: BlogPost | null;
  next: BlogPost | null;
} {
  const posts = getAllPosts();
  const idx = posts.findIndex((p) => p.slug === slug);
  return {
    prev: idx < posts.length - 1 ? posts[idx + 1] : null,
    next: idx > 0 ? posts[idx - 1] : null,
  };
}

export function getAllCategories(): Array<{ name: string; count: number }> {
  const map = new Map<string, number>();
  for (const p of getAllPosts()) {
    map.set(p.category, (map.get(p.category) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export function getAllTags(): Array<{ name: string; count: number }> {
  const map = new Map<string, number>();
  for (const p of getAllPosts()) {
    for (const tag of p.tags) map.set(tag, (map.get(tag) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export function filterPosts(
  posts: BlogPost[],
  {
    q,
    category,
    tag,
  }: { q?: string; category?: string; tag?: string }
): BlogPost[] {
  return posts.filter((p) => {
    if (
      category &&
      p.category.toLowerCase() !== category.toLowerCase()
    )
      return false;
    if (
      tag &&
      !p.tags.map((t) => t.toLowerCase()).includes(tag.toLowerCase())
    )
      return false;
    if (q) {
      const query = q.toLowerCase();
      return (
        p.title.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.content.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query) ||
        p.tags.some((t) => t.toLowerCase().includes(query))
      );
    }
    return true;
  });
}
