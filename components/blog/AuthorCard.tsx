import type { BlogAuthor } from "@/lib/blog";

export function AuthorCard({ author }: { author: BlogAuthor }) {
  return (
    <div
      className="glass-panel rounded-2xl p-6 flex gap-5"
      style={{ borderColor: "rgba(221,183,255,0.1)" }}
    >
      {/* Avatar */}
      <div
        className="w-14 h-14 rounded-2xl flex-shrink-0 flex items-center justify-center overflow-hidden"
        style={{ background: "rgba(221,183,255,0.1)" }}
      >
        {author.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={author.avatar}
            alt={author.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span
            className="material-symbols-outlined text-[28px] text-[#ddb7ff]"
            aria-hidden="true"
          >
            person
          </span>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#4d4354] mb-1">
          About the author
        </p>
        <p className="text-[16px] font-bold text-[#e2e2e2] leading-none mb-2">
          {author.name}
        </p>
        {author.bio && (
          <p className="text-[13px] leading-[1.65] text-[#7a6d84]">
            {author.bio}
          </p>
        )}
        {author.twitter && (
          <a
            href={`https://twitter.com/${author.twitter}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-3 text-[12px] font-semibold transition-colors hover:text-[#ddb7ff]"
            style={{ color: "#5a4d63" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.736l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            @{author.twitter}
          </a>
        )}
      </div>
    </div>
  );
}
