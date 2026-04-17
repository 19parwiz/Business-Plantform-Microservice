/**
 * Stores credentials for api-gateway protected routes (X-Email / X-Password).
 * Demo-only: replace with proper tokens when you harden the gateway.
 */
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
