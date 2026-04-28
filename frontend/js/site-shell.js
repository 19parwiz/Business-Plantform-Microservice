import { isLoggedIn, logout } from "./auth.js";
import { mountWelcome } from "./welcome.js";

/**
 * @param {"home"|"about"|"favorites"|"cart"|"payment"|"checkout"|"orders"|"analytics"|"admin"|"dashboard"|"profile"|"auth"|""} active
 */
export function mountShell(active = "") {
  const header = document.getElementById("site-header");
  if (!header) return;
  header.classList.toggle("site-bar--center-brand", active === "checkout");

  const inNav = (key) => (active === key ? "nav-link is-active" : "nav-link");

  const logged = isLoggedIn();

  const accountLinks = logged
    ? `
        <a class="${inNav("checkout")}" href="checkout.html" title="Step 1: confirm cart and place order">Checkout</a>
        <a class="${inNav("payment")} nav-link--muted" href="payment.html" title="Step 2: payment notes / demo">Payment</a>
        <a class="${inNav("orders")}" href="orders.html" title="Step 3: order history">Orders</a>
        <a class="${inNav("profile")}" href="profile.html">Profile</a>
        <a class="${inNav("dashboard")}" href="dashboard.html">Admin</a>
        <button type="button" class="nav-link nav-link--btn" id="site-logout">Log out</button>`
    : "";

  const authCta = logged
    ? ""
    : `<a class="${inNav("auth")} nav-link--cta" href="auth.html">Log in / Register</a>`;

  header.innerHTML = `
    <div class="site-bar__inner">
      <div class="site-bar__lane">
        <div class="site-bar__brand-block">
          <a class="site-bar__brand" href="index.html" title="AgroTech Fresh — home">AgroTech Fresh</a>
          <span class="site-bar__tagline">Microgreens &amp; flowers</span>
        </div>
        <nav class="site-bar__nav site-bar__nav--categories" aria-label="Main navigation">
          <a class="${inNav("home")}" href="index.html">Home</a>
          <a class="${inNav("about")}" href="about.html">About us</a>
          ${authCta}
          ${accountLinks}
        </nav>
      </div>
    </div>`;

  document.getElementById("site-logout")?.addEventListener("click", () => {
    logout();
  });

  mountWelcome();
}
