import { mountShell } from "./site-shell.js";
import { requireAuthOrRedirect } from "./auth.js";
import { getProfile } from "./api.js";
import { el, escapeHtml } from "./utils.js";

mountShell("profile");

if (!requireAuthOrRedirect()) {
  /* redirect */
} else {
  (async () => {
    const st = el("profile-status");
    const card = el("profile-card");
    st.textContent = "Loading…";
    try {
      const p = await getProfile();
      const uid = p?.userId ?? p?.user_id;
      card.innerHTML = `
        <p><span class="profile-card__k">Name</span> ${escapeHtml(String(p?.name || "—"))}</p>
        <p><span class="profile-card__k">Email</span> ${escapeHtml(String(p?.email || "—"))}</p>
        <p><span class="profile-card__k">Customer ID</span> ${escapeHtml(String(uid ?? "—"))}</p>`;
      st.textContent = "";
    } catch (e) {
      st.textContent = e.message || String(e);
      st.classList.add("is-error");
      card.innerHTML = "";
    }
  })();
}
