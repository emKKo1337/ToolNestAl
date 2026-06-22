"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useFavorites } from "@/lib/favorites";

const navLinks = [
  { label: "AI Tools",      href: "/ai-tools" },
  { label: "PDF Tools",     href: "/pdf-tools" },
  { label: "Image Tools",   href: "/image-tools" },
  { label: "Developer",     href: "/developer-tools" },
  { label: "Text Tools",    href: "/text-tools" },
  { label: "SEO",           href: "/seo-tools" },
  { label: "Blog",          href: "/blog" },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const { count } = useFavorites();

  const handleGetStarted = useCallback(() => {
    closeMenu();
    if (pathname === "/") {
      document.getElementById("popular-tools")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      router.push("/#popular-tools");
    }
  }, [pathname, router, closeMenu]);

  return (
    <header
      className="fixed top-0 w-full z-50 border-b border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]"
      style={{ background: "rgba(19,19,19,0.6)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}
    >
      {/* Skip to content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:text-white focus:text-sm focus:font-semibold"
        style={{ background: "#ddb7ff", color: "#131313" }}
      >
        Skip to main content
      </a>

      <div className="flex justify-between items-center h-20 px-4 md:px-[48px] max-w-[1280px] mx-auto w-full">
        {/* Brand */}
        <Link
          href="/"
          className="text-[22px] font-extrabold tracking-tight text-[#e2e2e2] flex items-center gap-2 leading-none shrink-0"
          aria-label="ToolNest AI — Go to homepage"
          onClick={closeMenu}
        >
          <span
            className="material-symbols-outlined text-[#ddb7ff] text-[26px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
            aria-hidden="true"
          >
            build_circle
          </span>
          ToolNest AI
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex gap-6 items-center text-[15px] font-medium" aria-label="Main navigation">
          {navLinks.map((link) => {
            const active = pathname?.startsWith(link.href);
            return (
              <Link
                key={link.label}
                href={link.href}
                className="transition-colors duration-200"
                style={{ color: active ? "#ddb7ff" : "#cfc2d6" }}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop actions — spacer to right-align */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/favorites"
            aria-label={`Favorites${count > 0 ? ` (${count})` : ""}`}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[14px] font-semibold transition-colors duration-200"
            style={{
              color: pathname === "/favorites" ? "#ff6482" : "#cfc2d6",
              background: pathname === "/favorites" ? "rgba(255,100,130,0.10)" : "transparent",
            }}
          >
            <span
              className="material-symbols-outlined text-[18px]"
              style={{
                color: count > 0 ? "#ff6482" : "inherit",
                fontVariationSettings: count > 0 ? "'FILL' 1" : "'FILL' 0",
              }}
              aria-hidden="true"
            >
              favorite
            </span>
            Favorites
            {count > 0 && (
              <span
                className="ml-0.5 min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full text-[11px] font-bold"
                style={{ background: "#ff6482", color: "#fff" }}
              >
                {count}
              </span>
            )}
          </Link>
          <button
            onClick={handleGetStarted}
            className="btn-primary text-white text-[14px] font-semibold px-5 py-2 rounded-xl"
          >
            Get Started
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl transition-colors"
          style={{ color: "#cfc2d6", background: menuOpen ? "rgba(255,255,255,0.08)" : "transparent" }}
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
        >
          <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
            {menuOpen ? "close" : "menu"}
          </span>
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div
          id="mobile-menu"
          className="md:hidden border-t border-white/10 px-4 py-4 flex flex-col gap-1"
          style={{ background: "rgba(19,19,19,0.97)" }}
          role="navigation"
          aria-label="Mobile navigation"
        >
          {navLinks.map((link) => {
            const active = pathname?.startsWith(link.href);
            return (
              <Link
                key={link.label}
                href={link.href}
                onClick={closeMenu}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] font-medium transition-colors"
                style={{
                  color: active ? "#ddb7ff" : "#cfc2d6",
                  background: active ? "rgba(221,183,255,0.08)" : "transparent",
                }}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
          {/* Favorites in mobile menu */}
          <Link
            href="/favorites"
            onClick={closeMenu}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] font-medium transition-colors"
            style={{
              color: pathname === "/favorites" ? "#ff6482" : "#cfc2d6",
              background: pathname === "/favorites" ? "rgba(255,100,130,0.08)" : "transparent",
            }}
          >
            <span
              className="material-symbols-outlined text-[18px]"
              style={{
                color: count > 0 ? "#ff6482" : "inherit",
                fontVariationSettings: count > 0 ? "'FILL' 1" : "'FILL' 0",
              }}
              aria-hidden="true"
            >
              favorite
            </span>
            Favorites
            {count > 0 && (
              <span
                className="ml-auto min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full text-[11px] font-bold"
                style={{ background: "#ff6482", color: "#fff" }}
              >
                {count}
              </span>
            )}
          </Link>
          <div className="pt-3 mt-2 border-t border-white/10">
            <button
              onClick={handleGetStarted}
              className="btn-primary text-white text-[14px] font-semibold px-5 py-2.5 rounded-xl w-full flex items-center justify-center"
            >
              Get Started
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
