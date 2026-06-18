import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "404 — Page Not Found | ToolNest AI",
  description: "The page you're looking for doesn't exist.",
};

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
      <span
        className="material-symbols-outlined text-[72px] mb-6"
        style={{ color: "#ddb7ff" }}
        aria-hidden="true"
      >
        search_off
      </span>
      <h1 className="text-[48px] font-extrabold tracking-tight text-[#e2e2e2] mb-3">
        404
      </h1>
      <p className="text-[18px] text-[#cfc2d6] mb-8 max-w-md">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="btn-primary text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2 transition-all"
      >
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
          home
        </span>
        Back to Home
      </Link>
    </div>
  );
}
