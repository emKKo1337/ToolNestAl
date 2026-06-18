"use client";

import { useEffect } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import MeshBackground from "@/components/sections/MeshBackground";
import Hero from "@/components/sections/Hero";
import CategoryGrid from "@/components/sections/CategoryGrid";

export default function Home() {
  // When arriving via /#popular-tools from another page, scroll after hydration
  useEffect(() => {
    if (window.location.hash === "#popular-tools") {
      // Small delay lets the page fully paint before scrolling
      const timer = setTimeout(() => {
        document.getElementById("popular-tools")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <>
      <MeshBackground />
      <Header />
      <main id="main-content" className="flex-grow pt-32 pb-24 px-4 md:px-[48px] w-full max-w-[1280px] mx-auto flex flex-col gap-32">
        <Hero />
        <CategoryGrid />
      </main>
      <Footer />
    </>
  );
}
