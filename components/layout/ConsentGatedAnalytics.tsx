"use client";

import { useEffect, useState } from "react";
import { GoogleAnalytics } from "@next/third-parties/google";
import { hasConsent } from "@/lib/cookieConsent";

// Loads the GA script only after the visitor has actually consented to
// analytics cookies — required for GDPR/ePrivacy compliance for EEA/UK/CH
// visitors, and part of Google's own EU User Consent Policy.
export default function ConsentGatedAnalytics({ gaId }: { gaId: string }) {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    setAllowed(hasConsent("analytics"));

    const onChange = () => setAllowed(hasConsent("analytics"));
    window.addEventListener("toolnest-consent-changed", onChange);
    return () => window.removeEventListener("toolnest-consent-changed", onChange);
  }, []);

  if (!allowed) return null;
  return <GoogleAnalytics gaId={gaId} />;
}
