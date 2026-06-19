import Link from "next/link";
import type { Metadata } from "next";
import MeshBackground from "@/components/sections/MeshBackground";

export const metadata: Metadata = {
  title: "404 — Page Not Found | ToolNest AI",
  description: "The page you're looking for doesn't exist.",
};

export default function NotFound() {
  return (
    <>
      <MeshBackground />
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-4 gap-6">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(221,183,255,0.1)" }}
        >
          <span
            className="material-symbols-outlined text-[40px]"
            style={{ color: "#ddb7ff" }}
            aria-hidden="true"
          >
            search_off
          </span>
        </div>
        <div>
          <p className="text-[80px] font-extrabold tracking-tight text-[#e2e2e2] leading-none mb-3 gradient-text">
            404
          </p>
          <h1 className="text-[22px] font-bold text-[#e2e2e2] mb-2">Page not found</h1>
          <p className="text-[15px] text-[#7a6d84] max-w-sm leading-snug">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>
        <Link
          href="/"
          className="btn-primary text-white font-semibold px-7 py-3 rounded-xl flex items-center gap-2 text-[14px]"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">home</span>
          Back to Home
        </Link>
      </div>
    </>
  );
}
