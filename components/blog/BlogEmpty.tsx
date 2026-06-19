import Link from "next/link";

export function BlogEmpty({
  title = "No articles yet",
  message = "Articles are coming soon. Check back later!",
  showBrowse = false,
}: {
  title?: string;
  message?: string;
  showBrowse?: boolean;
}) {
  return (
    <div className="glass-panel rounded-3xl flex flex-col items-center justify-center py-24 px-8 text-center gap-6">
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center"
        style={{ background: "rgba(221,183,255,0.08)" }}
      >
        <span
          className="material-symbols-outlined text-[40px] text-[#4d4354]"
          aria-hidden="true"
          style={{ fontVariationSettings: "'FILL' 0, 'wght' 300" }}
        >
          article
        </span>
      </div>
      <div>
        <p className="text-[22px] font-bold text-[#e2e2e2] mb-2">{title}</p>
        <p className="text-[14px] text-[#7a6d84] max-w-xs leading-snug mx-auto">
          {message}
        </p>
      </div>
      {showBrowse && (
        <Link
          href="/blog"
          className="btn-primary text-white text-[14px] font-semibold px-6 py-2.5 rounded-xl flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            arrow_back
          </span>
          Back to Blog
        </Link>
      )}
    </div>
  );
}
