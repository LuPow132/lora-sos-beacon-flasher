/**
 * Vercel Web Analytics.
 *
 * This is the vanilla `inject()` entry point, not the `<Analytics />` React
 * component shown in Vercel's onboarding — the app has no React.
 *
 * Privacy: Vercel Web Analytics is cookieless and stores no personal data, which
 * is why no consent banner is needed. Keep it that way — nothing reported below
 * could identify a student, in particular not the beacon name, which they type
 * themselves and could put a real name into.
 *
 * The tracking script is served from /_vercel/insights/ and only exists on a
 * Vercel deployment, so locally it runs in development mode and sends nothing.
 */
import { inject, track, pageview } from "@vercel/analytics";

const isDev = import.meta.env.MODE === "development";

/** Virtual route recorded when a board is successfully flashed. */
const FLASHED_ROUTE = "/flashed";

export function initAnalytics(): void {
  inject({ mode: isDev ? "development" : "production" });
}

/**
 * Records a successful flash.
 *
 * Reported two ways on purpose, because custom events are a Pro-only feature and
 * this project runs on Hobby:
 *
 *  - `pageview` for a virtual /flashed route. Pageviews are the one thing Hobby
 *    does count, so this shows up as its own row in the dashboard's Pages panel
 *    and is what actually answers "how many boards got flashed". It costs one
 *    extra page view per flash; the visitor count is unaffected. No real
 *    navigation happens, so the address bar is untouched and a reload cannot
 *    land on a path that does not exist.
 *  - `track` for the richer custom event. Silently discarded on Hobby, but it
 *    carries the detail the pageview cannot, so it starts working on its own if
 *    the project ever moves to Pro.
 *
 * `target` separates real T-Beam flashes from the ESP32-S3 test target so
 * development runs do not inflate either number.
 */
export function trackFlashSuccess(target: string, erasedAll: boolean): void {
  if (isDev) return;
  try {
    const path = target === "tbeam" ? FLASHED_ROUTE : `${FLASHED_ROUTE}/${target}`;
    pageview({ route: FLASHED_ROUTE, path });
    track("firmware_flashed", { target, erasedAll });
  } catch {
    // Analytics must never break the flasher. A blocked or failed beacon is
    // not something the student should ever see or care about.
  }
}
