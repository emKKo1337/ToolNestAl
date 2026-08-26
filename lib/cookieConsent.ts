// Minimal consent-state helper. The banner writes here; any future
// analytics/advertising script should check hasConsent("analytics") or
// hasConsent("advertising") before loading, so consent is enforced at the
// point scripts are injected, not just at the banner UI.

export type ConsentCategory = "essential" | "analytics" | "advertising";

export interface ConsentState {
  essential: true; // always true, cannot be disabled
  analytics: boolean;
  advertising: boolean;
  decidedAt: string; // ISO timestamp
}

const STORAGE_KEY = "toolnest-cookie-consent";

export function getConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ConsentState) : null;
  } catch {
    return null;
  }
}

export function setConsent(analytics: boolean, advertising: boolean): void {
  if (typeof window === "undefined") return;
  const state: ConsentState = {
    essential: true,
    analytics,
    advertising,
    decidedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("toolnest-consent-changed", { detail: state }));
}

export function hasConsent(category: ConsentCategory): boolean {
  if (category === "essential") return true;
  const state = getConsent();
  return state ? state[category] : false;
}
