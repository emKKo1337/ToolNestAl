"use client";

import { useEffect } from "react";

export default function ScrollToHash() {
  useEffect(() => {
    if (window.location.hash === "#popular-tools") {
      const timer = setTimeout(() => {
        document.getElementById("popular-tools")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
      return () => clearTimeout(timer);
    }
  }, []);

  return null;
}
