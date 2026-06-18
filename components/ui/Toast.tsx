"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

interface ToastItem {
  id: number;
  message: string;
  icon: string;
}

interface ToastContextValue {
  show: (message: string, icon?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const show = useCallback((message: string, icon = "check_circle") => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, message, icon }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2500);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-2 pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-2.5 px-5 py-3 rounded-2xl text-[14px] font-semibold text-[#e2e2e2] shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
            style={{
              background: "rgba(30,20,40,0.95)",
              border: "1px solid rgba(221,183,255,0.25)",
              backdropFilter: "blur(16px)",
              animation: "toast-in 0.25s ease",
            }}
          >
            <span
              className="material-symbols-outlined text-[18px]"
              style={{ color: "#ddb7ff", fontVariationSettings: "'FILL' 1" }}
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
