"use client";

import { useState } from "react";
import type { ToolFAQ } from "@/lib/tools";

export default function FAQSection({ faqs }: { faqs: ToolFAQ[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="mb-16" aria-labelledby="faq-heading">
      <h2
        id="faq-heading"
        className="text-[28px] font-bold leading-[36px] tracking-[-0.02em] text-[#e2e2e2] mb-6"
      >
        Frequently Asked Questions
      </h2>
      <div className="flex flex-col gap-2">
        {faqs.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div
              key={index}
              className="glass-panel rounded-xl overflow-hidden"
              style={{ borderColor: isOpen ? "rgba(221,183,255,0.2)" : "rgba(255,255,255,0.08)" }}
            >
              <button
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="w-full flex items-center justify-between px-5 py-4 text-left gap-4 transition-colors duration-200 hover:bg-white/[0.03]"
                aria-expanded={isOpen}
                aria-controls={`faq-answer-${index}`}
                id={`faq-question-${index}`}
              >
                <span className="text-[15px] font-semibold text-[#e2e2e2] leading-snug">{faq.question}</span>
                <span
                  className="material-symbols-outlined text-[20px] text-[#6b5b7a] flex-shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                  style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                  aria-hidden="true"
                >
                  expand_more
                </span>
              </button>
              <div
                id={`faq-answer-${index}`}
                role="region"
                aria-labelledby={`faq-question-${index}`}
                style={{
                  display: "grid",
                  gridTemplateRows: isOpen ? "1fr" : "0fr",
                  transition: "grid-template-rows 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                <div style={{ overflow: "hidden" }}>
                  <div className="px-5 pb-5 pt-0">
                    <div className="h-px mb-4" style={{ background: "rgba(255,255,255,0.06)" }} />
                    <p className="text-[14px] leading-[22px] text-[#988d9f]">{faq.answer}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
