"use client";

import { useState } from "react";

const searchTags = [
  "AI Chat",
  "Remove Background",
  "PDF to Word",
  "QR Generator",
  "Resume Builder",
  "Password Generator",
];

export default function Hero() {
  const [query, setQuery] = useState("");

  return (
    <section
      className="flex flex-col items-center justify-center text-center mt-12 mb-16 max-w-4xl mx-auto"
      aria-labelledby="hero-heading"
    >
      <h1
        id="hero-heading"
        className="text-[40px] md:text-[64px] font-extrabold leading-[48px] md:leading-[72px] tracking-[-0.03em] md:tracking-[-0.04em] text-[#e2e2e2] mb-6"
      >
        100+ Free AI &amp; Online Tools <br className="hidden md:block" />
        <span className="gradient-text">in One Place</span>
      </h1>

      <p className="text-[18px] leading-[28px] text-[#cfc2d6] mb-12 max-w-2xl">
        Boost your productivity with powerful AI tools, PDF utilities, image
        editors, developer tools, calculators and generators.
      </p>

      {/* Search Bar */}
      <div className="w-full max-w-3xl relative mb-8">
        <div
          className="glass-panel search-focus rounded-2xl flex items-center px-6 py-4 transition-all duration-300 w-full relative z-10"
          style={{ background: "rgba(19,19,19,0.8)" }}
        >
          <span
            className="material-symbols-outlined text-[#988d9f] mr-4 text-[28px]"
            aria-hidden="true"
          >
            search
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any tool..."
            aria-label="Search tools"
            className="bg-transparent border-none text-[24px] leading-[32px] font-normal text-[#e2e2e2] w-full placeholder-[#4d4354] focus:ring-0 focus:outline-none h-12"
          />
          <button
            className="btn-primary text-white p-3 rounded-xl ml-4 flex items-center justify-center hover:scale-105 transition-transform"
            aria-label="Search"
          >
            <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
              arrow_forward
            </span>
          </button>
        </div>
      </div>

      {/* Search Tags */}
      <div
        className="flex flex-wrap justify-center gap-3"
        role="list"
        aria-label="Popular searches"
      >
        {searchTags.map((tag) => (
          <button
            key={tag}
            role="listitem"
            onClick={() => setQuery(tag)}
            className="px-4 py-2 rounded-full glass-panel text-[12px] font-semibold tracking-[0.05em] text-[#cfc2d6] hover:text-[#ddb7ff] hover:border-[#ddb7ff]/50 cursor-pointer transition-colors"
          >
            {tag}
          </button>
        ))}
      </div>
    </section>
  );
}
