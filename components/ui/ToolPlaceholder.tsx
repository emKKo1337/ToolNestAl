export default function ToolPlaceholder({ toolName }: { toolName: string }) {
  return (
    <div
      className="glass-panel rounded-2xl p-8 md:p-16 mb-12 flex flex-col items-center justify-center text-center min-h-[360px] gap-6"
      style={{ borderStyle: "dashed", borderColor: "rgba(221,183,255,0.18)" }}
    >
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center"
        style={{ background: "rgba(221,183,255,0.08)" }}
      >
        <span
          className="material-symbols-outlined text-[38px] text-[#ddb7ff]"
          style={{ fontVariationSettings: "'FILL' 0, 'wght' 300" }}
          aria-hidden="true"
        >
          construction
        </span>
      </div>
      <div className="flex flex-col gap-2 max-w-sm">
        <h2 className="text-[22px] font-bold text-[#e2e2e2]">{toolName} — Coming Soon</h2>
        <p className="text-[15px] leading-[24px] text-[#7a6d84]">
          This tool is currently in development and will be available shortly.
        </p>
      </div>
      <button className="btn-ghost text-[14px] font-semibold px-6 py-2.5 rounded-xl flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px] text-[#ddb7ff]" aria-hidden="true">notifications</span>
        Notify Me When Ready
      </button>
    </div>
  );
}
