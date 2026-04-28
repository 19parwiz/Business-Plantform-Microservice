/**
 * Dynamic welcome line for all `.welcome-tag` elements.
 *
 * Priority:
 * 1) <meta name="store-welcome" content="Full one-line message">
 * 2) localStorage key `agrotech_store_welcome` (for a future settings UI)
 * 3) Time-of-day greeting + optional <meta name="store-name"> + <meta name="store-tagline">
 *
 * Defaults when metas are missing: "AgroTech Fresh" / "Microgreens & Flowers Store"
 */

const LS_WELCOME = "agrotech_store_welcome";

const DEFAULT_STORE_NAME = "AgroTech Fresh";
const DEFAULT_TAGLINE = "Microgreens & Flowers Store";

function meta(name) {
  return document.querySelector(`meta[name="${name}"]`)?.getAttribute("content")?.trim();
}

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function getWelcomeMessage() {
  const fullOverride = meta("store-welcome");
  if (fullOverride) return fullOverride;

  try {
    const fromLs = localStorage.getItem(LS_WELCOME)?.trim();
    if (fromLs) return fromLs;
  } catch {
    /* private mode */
  }

  const storeName = meta("store-name") || DEFAULT_STORE_NAME;
  const tagline = meta("store-tagline") || DEFAULT_TAGLINE;
  return `${timeGreeting()} — Welcome to ${storeName} — ${tagline}`;
}

/** Fills every `.welcome-tag` (keeps classes and inline styles on the node). */
export function mountWelcome() {
  const msg = getWelcomeMessage();
  document.querySelectorAll(".welcome-tag").forEach((el) => {
    el.textContent = msg;
  });
}
