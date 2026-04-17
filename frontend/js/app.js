import { getApiBase } from "./config.js";
import { setSession, clearSession, getSession } from "./auth.js";
import {
  registerUser,
  listProducts,
  getProfile,
  createOrder,
  listOrders,
} from "./api.js";

function $(id) {
  return document.getElementById(id);
}

function setStatus(el, text, ok = true) {
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("is-error", !ok);
}

function renderProducts(data, container) {
  if (!container) return;
  const products = data?.products || [];
  if (!products.length) {
    container.innerHTML = "<p class=\"muted\">No products yet.</p>";
    return;
  }
  const rows = products
    .map(
      (p) =>
        `<li><strong>${escapeHtml(p.name || "")}</strong> · ${escapeHtml(p.category || "")} · $${Number(p.price).toFixed(2)} · stock ${p.stock} <span class="muted">#${p.productId}</span></li>`
    )
    .join("");
  container.innerHTML = `<ul class="product-list">${rows}</ul>`;
}

function renderOrders(data, container) {
  if (!container) return;
  const orders = data?.orders || [];
  if (!orders.length) {
    container.innerHTML = "<p class=\"muted\">No orders yet.</p>";
    return;
  }
  const rows = orders
    .map(
      (o) =>
        `<li>Order <strong>#${o.orderId}</strong> · status ${escapeHtml(o.status || "")} · total $${Number(o.totalAmount).toFixed(2)}</li>`
    )
    .join("");
  container.innerHTML = `<ul class="product-list">${rows}</ul>`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function onRegister(e) {
  e.preventDefault();
  const status = $("status-register");
  const email = $("reg-email")?.value?.trim();
  const password = $("reg-password")?.value || "";
  const name = $("reg-name")?.value?.trim();
  try {
    const data = await registerUser({ email, password, name });
    const uid = data.userId ?? data.user_id;
    setStatus(status, `Registered — user id ${uid}`, true);
  } catch (err) {
    setStatus(status, err.message || String(err), false);
  }
}

async function onSaveSession(e) {
  e.preventDefault();
  const status = $("status-session");
  const email = $("sess-email")?.value?.trim();
  const password = $("sess-password")?.value || "";
  setSession(email, password);
  setStatus(status, "Session saved in this browser (for protected API calls).", true);
}

function onClearSession() {
  clearSession();
  $("sess-email").value = "";
  $("sess-password").value = "";
  setStatus($("status-session"), "Session cleared.", true);
}

async function onLoadProducts() {
  const status = $("status-catalog");
  const out = $("products-out");
  setStatus(status, "Loading…", true);
  try {
    const data = await listProducts(1, 20);
    renderProducts(data, out);
    setStatus(status, `Loaded ${(data.products || []).length} item(s).`, true);
  } catch (err) {
    setStatus(status, err.message || String(err), false);
    out.innerHTML = "";
  }
}

async function onProfile() {
  const status = $("status-session");
  const out = $("profile-out");
  const { email } = getSession();
  if (!email) {
    setStatus(status, "Save a session first (email + password).", false);
    return;
  }
  try {
    const data = await getProfile();
    out.textContent = JSON.stringify(data, null, 2);
    setStatus(status, "Profile loaded.", true);
  } catch (err) {
    setStatus(status, err.message || String(err), false);
    out.textContent = "";
  }
}

async function onPlaceOrder(e) {
  e.preventDefault();
  const status = $("status-orders");
  const pid = parseInt($("order-product-id")?.value?.trim() || "0", 10) || 0;
  const qty = parseInt($("order-qty")?.value?.trim() || "0", 10) || 0;
  if (!pid || !qty) {
    setStatus(status, "Enter product id and quantity.", false);
    return;
  }
  try {
    const data = await createOrder([{ productId: pid, quantity: qty }]);
    const oid = data.orderId ?? data.order_id;
    setStatus(status, `Order created — id ${oid}`, true);
  } catch (err) {
    setStatus(status, err.message || String(err), false);
  }
}

async function onListOrders() {
  const status = $("status-orders");
  const out = $("orders-out");
  setStatus(status, "Loading orders…", true);
  try {
    const data = await listOrders(1, 10);
    renderOrders(data, out);
    setStatus(status, `Loaded ${(data.orders || []).length} order(s).`, true);
  } catch (err) {
    setStatus(status, err.message || String(err), false);
    out.innerHTML = "";
  }
}

function init() {
  const hint = $("api-base-hint");
  if (hint) {
    hint.textContent = getApiBase();
  }
  const s = getSession();
  if ($("sess-email")) $("sess-email").value = s.email;
  if ($("sess-password")) $("sess-password").value = s.password;

  $("form-register")?.addEventListener("submit", onRegister);
  $("form-session")?.addEventListener("submit", onSaveSession);
  $("btn-session-clear")?.addEventListener("click", onClearSession);
  $("btn-products")?.addEventListener("click", onLoadProducts);
  $("btn-profile")?.addEventListener("click", onProfile);
  $("form-order")?.addEventListener("submit", onPlaceOrder);
  $("btn-orders")?.addEventListener("click", onListOrders);
}

document.addEventListener("DOMContentLoaded", init);
