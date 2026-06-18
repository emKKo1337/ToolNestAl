export default function ToolPlaceholder({ toolName }: { toolName: string }) {
  return (
    <div className="glass-panel rounded-2xl p-8 md:p-12 mb-12 flex flex-col items-center justify-center text-center min-h-[320px] gap-6" style={{ borderStyle: "dashed", borderColor: "rgba(221,183,255,0.2)" }}>
      <div className="w-20 h-20 rounded-full bg-[rgba(221,183,255,0.08)] flex items-center justify-center">
        <span className="material-symbols-outlined text-[40px] text-[#ddb7ff]" style={{ fontVariationSettings: "'FILL' 0" }} aria-hidden="true">construction</span>
      </div>
      <div>
        <h2 className="text-[22px] font-bold text-[#e2e2e2] mb-2">{toolName} — Coming Soon</h2>
        <p className="text-[16px] text-[#988d9f] max-w-md">This tool is currently in development. The interface and full functionality will be available shortly.</p>
      </div>
      <button className="btn-primary text-white text-[14px] font-semibold px-6 py-3 rounded-xl">Notify Me When Ready</button>
    </div>
  );
}
