"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { hasConsent } from "@/lib/cookieConsent";

// Microsoft Clarity is a session-recording/analytics tool — treated as the
// "analytics" consent category. The AdSense loader is treated as
// "advertising". Neither loads until the visitor has actually consented,
// consistent with what /privacy-policy and /cookie-policy state.
export default function ConsentGatedScripts() {
  const [analyticsAllowed, setAnalyticsAllowed] = useState(false);
  const [advertisingAllowed, setAdvertisingAllowed] = useState(false);

  useEffect(() => {
    const sync = () => {
      setAnalyticsAllowed(hasConsent("analytics"));
      setAdvertisingAllowed(hasConsent("advertising"));
    };
    sync();
    window.addEventListener("toolnest-consent-changed", sync);
    return () => window.removeEventListener("toolnest-consent-changed", sync);
  }, []);

  return (
    <>
      {advertisingAllowed && (
        <Script
          id="google-adsense"
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7701645766589173"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      )}
      {analyticsAllowed && process.env.NODE_ENV === "production" && (
        <Script
          id="microsoft-clarity"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","x9q0v29sbs");`,
          }}
        />
      )}
    </>
  );
}
