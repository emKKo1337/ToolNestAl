import dynamic from "next/dynamic";

// Dynamic import code-splits the search bundle away from the homepage critical path
const HeroSearchBox = dynamic(() => import("./HeroSearchBox"), {
  loading: () => (
    <div className="w-full max-w-3xl mb-8">
      <div
        className="glass-panel rounded-2xl flex items-center px-6 py-4 w-full"
        style={{ background: "rgba(19,19,19,0.8)", minHeight: "72px" }}
        aria-hidden="true"
      >
        <div className="flex-1 h-8 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }} />
      </div>
    </div>
  ),
});

export default function Hero({ toolCount }: { toolCount: number }) {
  return (
    <section
      className="flex flex-col items-center justify-center text-center mt-12 mb-16 max-w-4xl mx-auto"
      aria-labelledby="hero-heading"
    >
      <h1
        id="hero-heading"
        className="text-[40px] md:text-[64px] font-extrabold leading-[48px] md:leading-[72px] tracking-[-0.03em] md:tracking-[-0.04em] text-[#e2e2e2] mb-6"
      >
        {toolCount}+ Free AI &amp; Online Tools <br className="hidden md:block" />
        <span className="gradient-text">in One Place</span>
      </h1>

      <p className="text-[18px] leading-[28px] text-[#cfc2d6] mb-12 max-w-2xl">
        Boost your productivity with powerful AI tools, PDF utilities, image
        editors, developer tools, calculators and generators.
      </p>

      <HeroSearchBox />
    </section>
  );
}
