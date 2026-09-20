/**
 * Vercel Web Analytics.
 *
 * This is the vanilla `inject()` entry point, not the `<Analytics />` React
 * component shown in Vercel's onboarding — the app has no React.
 *
 * Privacy: Vercel Web Analytics is cookieless and stores no personal data, which
 * is why no consent banner is needed. Keep it that way — the custom event below
 * deliberately carries nothing that could identify a student, in particular not
 * the beacon name, which they type themselves and could put a real name into.
 *
 * The tracking script is served from /_vercel/insights/ and only exists on a
 * Vercel deployment, so locally it runs in development mode and sends nothing.
 */
import { inject, track } from "@vercel/analytics";

const isDev = import.meta.env.MODE === "development";

export function initAnalytics(): void {
  inject({ mode: isDev ? "development" : "production" });
}

/**
 * Fired when a board is successfully flashed, so the dashboard shows how many
 * students actually finished rather than just how many opened the page.
 *
 * `target` separates real T-Beam flashes from the ESP32-S3 test target, so
 * development runs do not inflate the count.
 */
export function trackFlashSuccess(target: string, erasedAll: boolean): void {
  if (isDev) return;
  try {
    track("firmware_flashed", { target, erasedAll });
  } catch {
    // Analytics must never break the flasher. A blocked or failed beacon is
    // not something the student should ever see or care about.
  }
}
