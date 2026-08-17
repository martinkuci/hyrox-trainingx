export const ONBOARDING_STORAGE_KEY = "hyrox-onboarding-v1";
export const ONBOARDING_OPEN_EVENT = "hyrox-onboarding-open";

function getStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function hasCompletedOnboarding() {
  try {
    return getStorage()?.getItem(ONBOARDING_STORAGE_KEY) === "complete";
  } catch {
    return false;
  }
}

export function completeOnboarding() {
  try {
    getStorage()?.setItem(ONBOARDING_STORAGE_KEY, "complete");
  } catch {
    // Úvod lze zavřít i při nedostupném úložišti.
  }
}

export function openOnboarding() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ONBOARDING_OPEN_EVENT));
}
