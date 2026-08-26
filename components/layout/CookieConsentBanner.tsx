"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getConsent, setConsent } from "@/lib/cookieConsent";

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analyticsChecked, setAnalyticsChecked] = useState(true);

  useEffect(() => {
    // Only show if no prior decision is stored — never re-show after a choice.
    if (getConsent() === null) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const acceptAll = () => {
    setConsent(true, true);
    setVisible(false);
  };

  const essentialOnly = () => {
    setConsent(false, false);
    setVisible(false);
  };

  const savePreferences = () => {
    setConsent(analyticsChecked, false); // advertising off until AdSense is actually introduced
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-[100] p-4 sm:p-5"
    >
      <div
        className="glass-panel rounded-2xl p-5 sm:p-6 max-w-3xl mx-auto flex flex-col gap-4"
        style={{ background: "rgba(13,13,13,0.97)", borderColor: "rgba(221,183,255,0.15)" }}
      >
        <div>
          <p className="text-[14px] font-bold text-[#e2e2e2] mb-1.5">We use minimal cookies</p>
          <p className="text-[13px] leading-[21px] text-[#9b8da8]">
            Essential cookies keep the site working and can&apos;t be disabled. We&apos;d also like
            to use anonymous analytics cookies to see which tools are useful — these are optional.
            No advertising cookies are set today. Read the full{" "}
            <Link href="/cookie-policy" className="text-[#ddb7ff] hover:opacity-75 transition-opacity">
              Cookie Policy
            </Link>
            .
          </p>
        </div>

        {showDetails && (
          <div className="flex flex-col gap-2 py-1">
            <label className="flex items-center gap-2.5 text-[13px] text-[#7a6d84]">
              <input type="checkbox" checked disabled className="w-4 h-4 accent-[#ddb7ff]" />
              Essential — always on
            </label>
            <label className="flex items-center gap-2.5 text-[13px] text-[#cfc2d6]">
              <input
                type="checkbox"
                checked={analyticsChecked}
                onChange={(e) => setAnalyticsChecked(e.target.checked)}
                className="w-4 h-4 accent-[#ddb7ff]"
              />
              Analytics — anonymous usage statistics
            </label>
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={acceptAll}
            className="btn-primary text-white font-semibold px-5 py-2.5 rounded-xl text-[13px]"
          >
            Accept all
          </button>
          <button
            onClick={essentialOnly}
            className="glass-panel px-5 py-2.5 rounded-xl text-[13px] font-semibold text-[#cfc2d6] hover:text-[#ddb7ff] transition-colors"
          >
            Essential only
          </button>
          {showDetails ? (
            <button
              onClick={savePreferences}
              className="text-[13px] font-semibold text-[#7a6d84] hover:text-[#ddb7ff] transition-colors ml-auto"
            >
              Save preferences
            </button>
          ) : (
            <button
              onClick={() => setShowDetails(true)}
              className="text-[13px] font-semibold text-[#7a6d84] hover:text-[#ddb7ff] transition-colors ml-auto"
            >
              Customize
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
