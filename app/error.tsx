"use client";

import { useEffect } from "react";
import Link from "next/link";
import MeshBackground from "@/components/sections/MeshBackground";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <MeshBackground />
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-4 gap-6">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(255,128,128,0.1)" }}
        >
          <span
            className="material-symbols-outlined text-[40px]"
            style={{ color: "#ff8080" }}
            aria-hidden="true"
          >
            error
          </span>
        </div>
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight text-[#e2e2e2] mb-2">
            Something went wrong
          </h1>
          <p className="text-[15px] text-[#7a6d84] max-w-sm leading-snug">
            An unexpected error occurred. Please try again or return to the homepage.
          </p>
        </div>
        <div className="flex gap-3 flex-wrap justify-center">
          <button
            onClick={reset}
            className="btn-primary text-white font-semibold px-6 py-2.5 rounded-xl flex items-center gap-2 text-[14px]"
          >
            <span className="material-symbols-outlined text-[17px]" aria-hidden="true">refresh</span>
            Try again
          </button>
          <Link
            href="/"
            className="btn-ghost font-semibold px-6 py-2.5 rounded-xl flex items-center gap-2 text-[14px]"
          >
            <span className="material-symbols-outlined text-[17px]" aria-hidden="true">home</span>
            Home
          </Link>
        </div>
      </div>
    </>
  );
}
