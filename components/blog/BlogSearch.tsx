"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function BlogSearch({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue);
  const [, startTransition] = useTransition();

  const navigate = useCallback(
    (query: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (query.trim()) {
        params.set("q", query.trim());
      } else {
        params.delete("q");
      }
      params.delete("page");
      startTransition(() => {
        router.push(`/blog?${params.toString()}`);
      });
    },
    [router, searchParams]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      navigate(value);
    },
    [value, navigate]
  );

  const handleClear = useCallback(() => {
    setValue("");
    navigate("");
  }, [navigate]);

  return (
    <form
      onSubmit={handleSubmit}
      className="relative w-full max-w-xl mx-auto"
      role="search"
    >
      <div
        className="glass-panel rounded-2xl flex items-center px-5 py-3.5 gap-3 transition-all duration-300"
        style={{ background: "rgba(19,19,19,0.8)" }}
      >
        <span
          className="material-symbols-outlined text-[#6b5b7a] text-[22px] flex-shrink-0"
          aria-hidden="true"
        >
          search
        </span>
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search articles by title, topic or tag…"
          aria-label="Search blog articles"
          className="flex-1 bg-transparent text-[15px] text-[#e2e2e2] placeholder:text-[#4d4354] outline-none min-w-0"
          autoComplete="off"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="text-[#6b5b7a] hover:text-[#e2e2e2] transition-colors flex-shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        )}
        <button
          type="submit"
          className="btn-primary text-white text-[13px] font-semibold px-4 py-2 rounded-xl flex-shrink-0"
        >
          Search
        </button>
      </div>
    </form>
  );
}
