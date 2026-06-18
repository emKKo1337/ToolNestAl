"use client";

import { useEffect } from "react";
import Link from "next/link";

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
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
      <span
        className="material-symbols-outlined text-[72px] mb-6"
        style={{ color: "#ff8080" }}
        aria-hidden="true"
      >
        error
      </span>
      <h1 className="text-[36px] font-extrabold tracking-tight text-[#e2e2e2] mb-3">
        Something went wrong
      </h1>
      <p className="text-[17px] text-[#cfc2d6] mb-8 max-w-md">
        An unexpected error occurred. Please try again or return to the homepage.
      </p>
      <div className="flex gap-4 flex-wrap justify-center">
        <button
          onClick={reset}
          className="btn-primary text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            refresh
          </span>
          Try again
        </button>
        <Link
          href="/"
          className="font-semibold px-6 py-3 rounded-xl flex items-center gap-2 transition-all"
          style={{ background: "rgba(255,255,255,0.07)", color: "#e2e2e2", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            home
          </span>
          Home
        </Link>
      </div>
    </div>
  );
}
