import { mountShell } from "./site-shell.js";
import { requireAuthOrRedirect } from "./auth.js";
import { getProfile, updateProfile } from "./api.js";
import { el, escapeHtml } from "./utils.js";

mountShell("profile");

if (!requireAuthOrRedirect()) {
  /* redirect */
} else {
  async function renderProfile() {
    const st = el("profile-status");
    const card = el("profile-card");
    st.textContent = "Loading…";
    const p = await getProfile();
    const uid = p?.userId ?? p?.user_id;
    card.innerHTML = `
      <p><span class="profile-card__k">Name</span> ${escapeHtml(String(p?.name || "—"))}</p>
      <p><span class="profile-card__k">Email</span> ${escapeHtml(String(p?.email || "—"))}</p>
      <p><span class="profile-card__k">Customer ID</span> ${escapeHtml(String(uid ?? "—"))}</p>`;
    st.textContent = "";
    el("ps-name").value = String(p?.name || "");
    el("ps-email").value = String(p?.email || "");
  }

  (async () => {
    try {
      await renderProfile();
    } catch (e) {
      const st = el("profile-status");
      const card = el("profile-card");
      st.textContent = e.message || String(e);
      st.classList.add("is-error");
      card.innerHTML = "";
    }
  })();

  el("profile-settings-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = el("profile-settings-status");
    const body = {
      name: el("ps-name").value.trim(),
      email: el("ps-email").value.trim(),
      password: el("ps-password").value,
    };
    status.textContent = "Saving…";
    status.classList.remove("is-error");
    try {
      await updateProfile(body);
      el("ps-password").value = "";
      await renderProfile();
      status.textContent = "Settings saved.";
    } catch (err) {
      status.textContent = err.message || String(err);
      status.classList.add("is-error");
    }
  });
}
