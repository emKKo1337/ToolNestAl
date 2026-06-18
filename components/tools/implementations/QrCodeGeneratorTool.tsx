"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import QRCode from "qrcode";

type QRType = "url" | "text" | "email" | "phone" | "wifi";

const TYPE_OPTIONS: { value: QRType; label: string; icon: string; placeholder: string }[] = [
  { value: "url", label: "URL", icon: "link", placeholder: "https://example.com" },
  { value: "text", label: "Text", icon: "text_fields", placeholder: "Enter any text…" },
  { value: "email", label: "Email", icon: "mail", placeholder: "hello@example.com" },
  { value: "phone", label: "Phone", icon: "phone", placeholder: "+1 (555) 000-0000" },
  { value: "wifi", label: "Wi-Fi", icon: "wifi", placeholder: "Network Name (SSID)" },
];

const SIZES = [128, 256, 512, 1024];

function buildContent(type: QRType, input: string, wifiPass: string, wifiSecurity: string): string {
  switch (type) {
    case "email": return `mailto:${input}`;
    case "phone": return `tel:${input}`;
    case "wifi": return `WIFI:S:${input};T:${wifiSecurity};P:${wifiPass};;`;
    default: return input;
  }
}

export default function QrCodeGeneratorTool() {
  const [type, setType] = useState<QRType>("url");
  const [input, setInput] = useState("");
  const [wifiPass, setWifiPass] = useState("");
  const [wifiSecurity, setWifiSecurity] = useState("WPA");
  const [size, setSize] = useState(256);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const generate = useCallback(async (content: string) => {
    if (!content.trim()) { setQrDataUrl(""); setError(""); return; }
    setLoading(true);
    setError("");
    try {
      const dataUrl = await QRCode.toDataURL(content, {
        width: size,
        margin: 2,
        color: { dark: "#e2e2e2", light: "#131313" },
        errorCorrectionLevel: "M",
      });
      setQrDataUrl(dataUrl);
    } catch {
      setError("Failed to generate QR code. Check your input.");
    } finally {
      setLoading(false);
    }
  }, [size]);

  useEffect(() => {
    const content = buildContent(type, input, wifiPass, wifiSecurity);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => generate(content), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [type, input, wifiPass, wifiSecurity, size, generate]);

  const handleDownload = (format: "png" | "svg") => {
    if (!input.trim()) return;
    const content = buildContent(type, input, wifiPass, wifiSecurity);

    if (format === "png") {
      const link = document.createElement("a");
      link.download = "qrcode.png";
      link.href = qrDataUrl;
      link.click();
      return;
    }

    // SVG download
    QRCode.toString(content, { type: "svg", width: size, margin: 2, color: { dark: "#e2e2e2", light: "#131313" } }, (err, svgStr) => {
      if (err) return;
      const blob = new Blob([svgStr], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = "qrcode.svg";
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  const handleCopy = async () => {
    if (!qrDataUrl) return;
    try {
      const res = await fetch(qrDataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: copy the data URL text
      await navigator.clipboard.writeText(qrDataUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const currentType = TYPE_OPTIONS.find((t) => t.value === type)!;

  return (
    <div className="mb-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Config */}
        <div className="flex flex-col gap-5">
          {/* Type selector */}
          <div className="glass-panel rounded-2xl p-5">
            <p className="text-[13px] font-semibold text-[#988d9f] uppercase tracking-[0.08em] mb-3">Content Type</p>
            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setType(opt.value); setInput(""); }}
                  aria-pressed={type === opt.value}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200"
                  style={{
                    background: type === opt.value ? "rgba(221,183,255,0.15)" : "rgba(255,255,255,0.04)",
                    color: type === opt.value ? "#ddb7ff" : "#988d9f",
                    border: `1px solid ${type === opt.value ? "rgba(221,183,255,0.35)" : "rgba(255,255,255,0.08)"}`,
                  }}
                >
                  <span className="material-symbols-outlined text-[16px]">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3">
            <label className="text-[14px] font-semibold text-[#e2e2e2]">
              {currentType.label} Content
            </label>
            <input
              type={type === "email" ? "email" : type === "phone" ? "tel" : "text"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={currentType.placeholder}
              className="bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-[15px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none focus:border-[#ddb7ff] transition-colors"
              aria-label={`${currentType.label} input`}
            />

            {type === "wifi" && (
              <>
                <input
                  type="password"
                  value={wifiPass}
                  onChange={(e) => setWifiPass(e.target.value)}
                  placeholder="Password"
                  className="bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-[15px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none focus:border-[#ddb7ff] transition-colors"
                />
                <select
                  value={wifiSecurity}
                  onChange={(e) => setWifiSecurity(e.target.value)}
                  className="bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-[15px] text-[#e2e2e2] focus:outline-none focus:border-[#ddb7ff] transition-colors"
                  aria-label="Wi-Fi security type"
                >
                  <option value="WPA">WPA/WPA2</option>
                  <option value="WEP">WEP</option>
                  <option value="nopass">None</option>
                </select>
              </>
            )}
          </div>

          {/* Size */}
          <div className="glass-panel rounded-2xl p-5">
            <p className="text-[13px] font-semibold text-[#988d9f] uppercase tracking-[0.08em] mb-3">Output Size</p>
            <div className="flex gap-2 flex-wrap">
              {SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  aria-pressed={size === s}
                  className="px-3 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200"
                  style={{
                    background: size === s ? "rgba(221,183,255,0.15)" : "rgba(255,255,255,0.04)",
                    color: size === s ? "#ddb7ff" : "#988d9f",
                    border: `1px solid ${size === s ? "rgba(221,183,255,0.35)" : "rgba(255,255,255,0.08)"}`,
                  }}
                >
                  {s}px
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Preview + Downloads */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col items-center justify-center gap-5">
          <div
            className="w-full max-w-[280px] aspect-square rounded-xl flex items-center justify-center transition-all duration-300"
            style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.06)" }}
            aria-live="polite"
            aria-label="QR code preview"
          >
            {loading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-[#ddb7ff] border-t-transparent rounded-full animate-spin" />
                <span className="text-[13px] text-[#988d9f]">Generating…</span>
              </div>
            ) : qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt="Generated QR Code"
                className="w-full h-full rounded-xl object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-center px-4">
                <span className="material-symbols-outlined text-[48px] text-[#4d4354]">qr_code_2</span>
                <p className="text-[13px] text-[#4d4354]">Enter content to generate a QR code</p>
              </div>
            )}
          </div>

          {error && (
            <p className="text-[13px] text-[#ef4444] flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">error</span>
              {error}
            </p>
          )}

          {/* Download buttons */}
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              onClick={() => handleDownload("png")}
              disabled={!qrDataUrl}
              className="btn-primary text-white font-semibold text-[14px] py-3 px-5 rounded-xl flex items-center justify-center gap-2 flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Download PNG
            </button>
            <button
              onClick={() => handleDownload("svg")}
              disabled={!input.trim()}
              className="flex items-center justify-center gap-2 flex-1 py-3 px-5 rounded-xl text-[14px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "rgba(255,255,255,0.06)", color: "#cfc2d6", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Download SVG
            </button>
          </div>

          <button
            onClick={handleCopy}
            disabled={!qrDataUrl}
            className="flex items-center gap-2 text-[13px] font-medium transition-colors disabled:opacity-40"
            style={{ color: copied ? "#22c55e" : "#988d9f" }}
          >
            <span className="material-symbols-outlined text-[16px]">{copied ? "check" : "content_copy"}</span>
            {copied ? "Image copied to clipboard!" : "Copy image to clipboard"}
          </button>
        </div>
      </div>
    </div>
  );
}
