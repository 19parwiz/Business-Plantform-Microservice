/**
 * Browser-only session for checkout and account (demo headers).
 * Replace with proper auth tokens before production.
 */
import { skipAuthGuard } from "./config.js";

const KEY_EMAIL = "bloomstem_email";
const KEY_PASSWORD = "bloomstem_password";

export function getSession() {
  return {
    email: sessionStorage.getItem(KEY_EMAIL) || "",
    password: sessionStorage.getItem(KEY_PASSWORD) || "",
  };
}

export function setSession(email, password) {
  sessionStorage.setItem(KEY_EMAIL, email.trim());
  sessionStorage.setItem(KEY_PASSWORD, password);
}

export function clearSession() {
  sessionStorage.removeItem(KEY_EMAIL);
  sessionStorage.removeItem(KEY_PASSWORD);
}

export function isLoggedIn() {
  const s = getSession();
  return Boolean(s.email && s.password);
}

/** Clears session and sends the browser to the home page. */
export function logout() {
  clearSession();
  window.location.assign("index.html");
}

/**
 * If the visitor is not signed in, redirect to login and stop.
 * @returns {boolean} true when logged in
 */
export function requireAuthOrRedirect() {
  if (skipAuthGuard()) return true;
  if (isLoggedIn()) return true;
  const here = encodeURIComponent(
    `${window.location.pathname}${window.location.search}`
  );
  window.location.assign(`login.html?next=${here}`);
  return false;
}
