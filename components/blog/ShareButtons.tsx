"use client";

import { useCallback, useState } from "react";

const SITE = "https://toolnest.ai";

export function ShareButtons({ slug, title }: { slug: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${SITE}/blog/${slug}`;

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [url]);

  const twitterHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}&via=toolnestai`;
  const linkedinHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#4d4354]">
        Share
      </p>

      {/* X / Twitter */}
      <a
        href={twitterHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on X (Twitter)"
        className="w-9 h-9 rounded-xl flex items-center justify-center glass-panel transition-all hover:border-[rgba(29,155,240,0.35)]"
        style={{ color: "#1d9bf0" }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.736l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </a>

      {/* LinkedIn */}
      <a
        href={linkedinHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on LinkedIn"
        className="w-9 h-9 rounded-xl flex items-center justify-center glass-panel transition-all hover:border-[rgba(10,102,194,0.35)]"
        style={{ color: "#0a66c2" }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      </a>

      {/* Copy link */}
      <button
        onClick={copy}
        aria-label={copied ? "Link copied!" : "Copy article link"}
        className="h-9 px-3 rounded-xl flex items-center gap-1.5 glass-panel text-[12px] font-semibold transition-all"
        style={{ color: copied ? "#4cd7f6" : "#7a6d84" }}
      >
        <span
          className="material-symbols-outlined text-[15px]"
          aria-hidden="true"
        >
          {copied ? "check" : "link"}
        </span>
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}
