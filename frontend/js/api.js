import { getApiBase } from "./config.js";
import { getSession } from "./auth.js";

function authHeaders() {
  const { email, password } = getSession();
  const headers = { Accept: "application/json" };
  if (email && password) {
    headers["X-Email"] = email;
    headers["X-Password"] = password;
  }
  return headers;
}

/**
 * JSON fetch helper; throws Error with message on failure.
 */
export async function apiFetch(path, { method = "GET", body } = {}) {
  const base = getApiBase();
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  const headers = { ...authHeaders() };
  if (body !== undefined && body !== null) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(url, { method, headers, body });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(text.slice(0, 200) || res.statusText);
    }
  }
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || res.statusText;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data;
}

/** Lightweight check that the gateway is up (public catalog route). */
export async function pingGateway() {
  const q = new URLSearchParams({ page: "1", limit: "1" });
  await apiFetch(`/api/v1/products?${q}`, { method: "GET" });
}

export async function registerUser(payload) {
  return apiFetch("/api/v1/users/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listProducts(page = 1, limit = 50) {
  const q = new URLSearchParams({ page: String(page), limit: String(limit) });
  return apiFetch(`/api/v1/products?${q}`);
}

export async function getProduct(id) {
  return apiFetch(`/api/v1/products/${encodeURIComponent(String(id))}`, {
    method: "GET",
  });
}

export async function createProduct(body) {
  return apiFetch("/api/v1/products", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateProduct(id, body) {
  return apiFetch(`/api/v1/products/${encodeURIComponent(String(id))}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteProduct(id) {
  return apiFetch(`/api/v1/products/${encodeURIComponent(String(id))}`, {
    method: "DELETE",
  });
}

export async function getProfile() {
  return apiFetch("/api/v1/users/profile", { method: "GET" });
}

/**
 * Create order line items. Gateway expects snake_case keys on each line.
 */
export async function createOrder(items) {
  const body = items.map((it) => ({
    product_id: it.productId ?? it.product_id,
    quantity: it.quantity,
  }));
  return apiFetch("/api/v1/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function listOrders(page = 1, limit = 20) {
  const q = new URLSearchParams({ page: String(page), limit: String(limit) });
  return apiFetch(`/api/v1/orders?${q}`, { method: "GET" });
}

export async function getOrder(id) {
  return apiFetch(`/api/v1/orders/${encodeURIComponent(String(id))}`, {
    method: "GET",
  });
}

export async function updateOrder(id, { status }) {
  return apiFetch(`/api/v1/orders/${encodeURIComponent(String(id))}`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}
