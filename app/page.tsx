import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import MeshBackground from "@/components/sections/MeshBackground";
import Hero from "@/components/sections/Hero";
import CategoryGrid from "@/components/sections/CategoryGrid";

export default function Home() {
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
