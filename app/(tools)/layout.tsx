import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import MeshBackground from "@/components/sections/MeshBackground";

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MeshBackground />
      <Header />
      <main id="main-content" className="flex-grow flex flex-col">{children}</main>
      <Footer />
    </>
  );
}
