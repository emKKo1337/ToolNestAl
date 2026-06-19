"use client";

import { useEffect, useState } from "react";
import type { TOCHeading } from "@/lib/blog";

export function TableOfContents({ headings }: { headings: TOCHeading[] }) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "0px 0px -75% 0px", threshold: 0.1 }
    );

    headings.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <nav aria-label="Table of contents" className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#4d4354] mb-4">
        On this page
      </p>
      <ul className="flex flex-col gap-0.5">
        {headings.map((h) => {
          const isActive = activeId === h.id;
          return (
            <li
              key={h.id}
              style={{ paddingLeft: h.level === 2 ? 0 : h.level === 3 ? 12 : 22 }}
            >
              <a
                href={`#${h.id}`}
                className="block text-[12px] leading-[1.5] py-1 transition-colors duration-150 hover:text-[#ddb7ff]"
                style={{ color: isActive ? "#ddb7ff" : "#5a4d63" }}
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .getElementById(h.id)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                {h.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
