"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

interface ToastItem {
  id: number;
  message: string;
  icon: string;
  exiting: boolean;
}

interface ToastContextValue {
  show: (message: string, icon?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_TOASTS = 3;

const iconColorMap: Record<string, string> = {
  favorite: "#ff6482",
  heart_broken: "#ff6482",
  check_circle: "#4cd7f6",
  error: "#ff8080",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const show = useCallback((message: string, icon = "check_circle") => {
    const id = ++counter.current;

    setToasts((prev) => {
      const next = [...prev, { id, message, icon, exiting: false }];
      // Evict oldest if over cap
      return next.slice(-MAX_TOASTS);
    });

    // Begin exit animation then remove
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
      );
    }, 2000);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2350);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-2 pointer-events-none"
        style={{ minWidth: "max-content" }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="flex items-center gap-2.5 px-5 py-3 rounded-2xl text-[13px] font-semibold text-[#e2e2e2] shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
            style={{
              background: "rgba(22,14,32,0.96)",
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              animation: t.exiting
                ? "toast-out 0.28s ease forwards"
                : "toast-in 0.28s cubic-bezier(0.34,1.56,0.64,1) forwards",
            }}
          >
            <span
              className="material-symbols-outlined text-[17px] flex-shrink-0"
              style={{
                color: iconColorMap[t.icon] ?? "#ddb7ff",
                fontVariationSettings: "'FILL' 1",
              }}
              aria-hidden="true"
            >
              {t.icon}
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
