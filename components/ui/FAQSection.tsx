"use client";
import { useState } from "react";
import type { ToolFAQ } from "@/lib/tools";

export default function FAQSection({ faqs }: { faqs: ToolFAQ[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <section className="mb-16" aria-labelledby="faq-heading">
      <h2 id="faq-heading" className="text-[28px] font-bold leading-[36px] tracking-[-0.02em] text-[#e2e2e2] mb-6">Frequently Asked Questions</h2>
      <div className="flex flex-col gap-3">
        {faqs.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={index} className="glass-panel rounded-xl overflow-hidden">
              <button onClick={() => setOpenIndex(isOpen ? null : index)} className="w-full flex items-center justify-between px-6 py-4 text-left gap-4 hover:bg-white/5 transition-colors" aria-expanded={isOpen}>
                <span className="text-[16px] font-semibold text-[#e2e2e2]">{faq.question}</span>
                <span className="material-symbols-outlined text-[20px] text-[#988d9f] flex-shrink-0 transition-transform duration-200" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }} aria-hidden="true">expand_more</span>
              </button>
              {isOpen && (
                <div className="px-6 pb-5">
                  <p className="text-[15px] leading-[24px] text-[#988d9f]">{faq.answer}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
