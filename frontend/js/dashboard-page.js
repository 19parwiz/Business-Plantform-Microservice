import { mountShell } from "./site-shell.js";
import { requireAuthOrRedirect } from "./auth.js";
import { getProfile } from "./api.js";
import { el, escapeHtml } from "./utils.js";

mountShell("dashboard");

if (!requireAuthOrRedirect()) {
  /* redirecting to login */
} else {
  (async () => {
    const box = el("dash-welcome");
    if (!box) return;
    try {
      const p = await getProfile();
      const name = p?.name || p?.email || "there";
      box.hidden = false;
      box.innerHTML = `Signed in as <strong>${escapeHtml(String(name))}</strong> — welcome back.`;
    } catch {
      box.hidden = false;
      box.classList.add("callout--amber");
      box.textContent =
        "We could not load your profile (check gateway and user-service). You can still browse the catalog on the home page.";
    }
  })();
}
