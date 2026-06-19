type CalloutType = "info" | "warning" | "tip" | "danger";

const config: Record<
  CalloutType,
  { icon: string; color: string; bg: string; border: string }
> = {
  info:    { icon: "info",          color: "#4cd7f6", bg: "rgba(76,215,246,0.08)",  border: "rgba(76,215,246,0.2)"  },
  warning: { icon: "warning",       color: "#ffb347", bg: "rgba(255,179,71,0.08)",  border: "rgba(255,179,71,0.2)"  },
  tip:     { icon: "lightbulb",     color: "#ddb7ff", bg: "rgba(221,183,255,0.08)", border: "rgba(221,183,255,0.2)" },
  danger:  { icon: "error",         color: "#ff8080", bg: "rgba(255,128,128,0.08)", border: "rgba(255,128,128,0.2)" },
};

export function Callout({
  type = "info",
  title,
  children,
}: {
  type?: CalloutType;
  title?: string;
  children: React.ReactNode;
}) {
  const cfg = config[type];
  return (
    <div
      className="rounded-xl p-4 my-6 flex gap-3"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      <span
        className="material-symbols-outlined text-[20px] flex-shrink-0 mt-0.5"
        style={{ color: cfg.color, fontVariationSettings: "'FILL' 1" }}
        aria-hidden="true"
      >
        {cfg.icon}
      </span>
      <div className="flex-1 min-w-0">
        {title && (
          <p
            className="text-[13px] font-bold mb-1.5"
            style={{ color: cfg.color }}
          >
            {title}
          </p>
        )}
        <div className="text-[14px] leading-[22px] text-[#9b8da8] [&>p:last-child]:mb-0">
          {children}
        </div>
      </div>
    </div>
  );
}
