import { mountShell } from "./site-shell.js";
import { setSession } from "./auth.js";
import { registerUser } from "./api.js";
import { el, readQuery } from "./utils.js";

mountShell("auth");

const nextUrl = readQuery("next") || "index.html#catalog";
const emailQ = readQuery("email");
const registered = readQuery("registered");

if (emailQ && el("login-email")) el("login-email").value = emailQ;
if (registered === "1" && el("login-lede")) {
  el("login-lede").textContent =
    "Account created. Sign in with the password you just chose.";
}

function setStatus(id, text, ok) {
  const s = el(id);
  if (!s) return;
  s.textContent = text;
  s.classList.toggle("is-error", !ok);
}

el("form-login")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const email = el("login-email")?.value?.trim() ?? "";
  const password = el("login-password")?.value || "";
  setSession(email, password);
  setStatus(
    "status-login",
    email && password
      ? "Saved — redirecting..."
      : "Continuing without credentials (preview). Redirecting...",
    true
  );
  window.location.assign(nextUrl);
});

el("form-register")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.submitter;
  const email = el("reg-email")?.value?.trim() ?? "";
  const password = el("reg-password")?.value || "";
  const name = el("reg-name")?.value?.trim() ?? "";
  btn.disabled = true;
  try {
    if (!email || !password || !name) {
      setStatus(
        "status-register",
        "Enter email, password, and name to continue to the site.",
        false
      );
      return;
    }
    try {
      await registerUser({ email, password, name });
    } catch {
      /* No gateway: still create a local session for demo checkout / orders UI */
    }
    setSession(email, password);
    setStatus("status-register", "Redirecting…", true);
    window.location.assign(nextUrl);
  } finally {
    btn.disabled = false;
  }
});
