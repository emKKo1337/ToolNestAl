"use client";

import { useState } from "react";

interface FAQItem {
  question: string;
  answer: string;
}

export function FAQBlock({ items }: { items: FAQItem[] }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="my-6 flex flex-col gap-2" role="list">
      {items.map((item, i) => (
        <div
          key={i}
          className="glass-panel rounded-xl overflow-hidden"
          role="listitem"
        >
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between px-5 py-4 text-left gap-4 hover:bg-white/[0.03] transition-colors duration-200"
            aria-expanded={open === i}
            aria-controls={`faq-block-${i}`}
          >
            <span className="text-[14px] font-semibold text-[#e2e2e2] leading-snug">
              {item.question}
            </span>
            <span
              className="material-symbols-outlined text-[18px] text-[#6b5b7a] flex-shrink-0 transition-transform duration-200"
              style={{ transform: open === i ? "rotate(180deg)" : "rotate(0deg)" }}
              aria-hidden="true"
            >
              expand_more
            </span>
          </button>
          <div
            id={`faq-block-${i}`}
            style={{
              display: "grid",
              gridTemplateRows: open === i ? "1fr" : "0fr",
              transition: "grid-template-rows 0.25s cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            <div style={{ overflow: "hidden" }}>
              <div className="px-5 pb-4">
                <div
                  className="h-px mb-3"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                />
                <p className="text-[13px] leading-[22px] text-[#988d9f]">
                  {item.answer}
                </p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
