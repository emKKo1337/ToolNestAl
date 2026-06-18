"use client";

import Link from "next/link";

const navLinks = [
  { label: "AI Tools", href: "/ai-tools" },
  { label: "PDF Tools", href: "/pdf-tools" },
  { label: "Developer", href: "/developer-tools" },
  { label: "Calculators", href: "/calculators" },
  { label: "Pricing", href: "/pricing" },
  { label: "Blog", href: "/blog" },
];

export default function Header() {
  return (
    <header
      className="fixed top-0 w-full z-50 border-b border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]"
      style={{ background: "rgba(19,19,19,0.4)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}
    >
      <div className="flex justify-between items-center h-20 px-4 md:px-[48px] max-w-[1280px] mx-auto w-full">
        {/* Brand */}
        <Link
          href="/"
          className="text-[24px] font-extrabold tracking-tight text-[#e2e2e2] flex items-center gap-2 leading-none"
          aria-label="ToolNest AI Home"
        >
          <span
            className="material-symbols-outlined text-[#ddb7ff] text-[28px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
            aria-hidden="true"
          >
            build_circle
          </span>
          ToolNest AI
        </Link>

        {/* Desktop Navigation */}
        <nav
          className="hidden md:flex gap-8 items-center text-[16px] font-medium"
          aria-label="Main navigation"
        >
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-[#cfc2d6] hover:text-[#e2e2e2] transition-colors duration-200"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <button
            className="material-symbols-outlined text-[#cfc2d6] hover:text-[#e2e2e2] transition-colors duration-200 text-[24px]"
            aria-label="Toggle dark mode"
          >
            dark_mode
          </button>
          <button
            className="hidden sm:block text-[#cfc2d6] hover:text-[#e2e2e2] text-[16px] font-medium px-4 py-2 transition-all duration-300"
            aria-label="Login"
          >
            Login
          </button>
          <button
            className="btn-primary text-white text-[16px] font-medium px-6 py-2 rounded-lg"
            aria-label="Get started"
          >
            Get Started
          </button>
        </div>
      </div>
    </header>
  );
}
