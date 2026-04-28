/**
 * When true, pages that normally require login (dashboard, checkout, admin, …)
 * still load so you can preview the UI. API calls may fail until you sign in
 * or run the gateway. Set to false (or use meta below) before real use.
 */
export const SKIP_AUTH_GUARD = true;

/**
 * Optional per-page override: <meta name="demo-skip-auth" content="false" />
 * forces login gates even if SKIP_AUTH_GUARD is true (handy for one-off tests).
 */
export function skipAuthGuard() {
  const m = document.querySelector('meta[name="demo-skip-auth"]');
  const v = m?.getAttribute("content")?.trim().toLowerCase();
  if (v === "false" || v === "0" || v === "no") return false;
  return SKIP_AUTH_GUARD;
}

/**
 * Base URL for the shop HTTP API.
 * Override via <meta name="api-base" content="http://host:port"> in index.html.
 */
export function getApiBase() {
  const el = document.querySelector('meta[name="api-base"]');
  const raw = el?.getAttribute("content")?.trim();
  if (raw) {
    return raw.replace(/\/+$/, "");
  }
  return "http://localhost:8080";
}
