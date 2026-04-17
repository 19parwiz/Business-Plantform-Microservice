/**
 * API base URL for the Go api-gateway (HTTP).
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
