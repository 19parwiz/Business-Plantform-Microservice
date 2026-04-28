/**
 * Simple cart in sessionStorage (no server cart in this API yet).
 */
const KEY = "bloomstem_cart_v1";

function readRaw() {
  try {
    const t = sessionStorage.getItem(KEY);
    if (!t) return [];
    const arr = JSON.parse(t);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeRaw(lines) {
  sessionStorage.setItem(KEY, JSON.stringify(lines));
  window.dispatchEvent(new CustomEvent("bloomstem-cart"));
}

/** @typedef {{ productId: number, name: string, price: number, qty: number, category?: string }} CartLine */

/** @returns {CartLine[]} */
export function getCart() {
  return readRaw();
}

export function cartCount() {
  return getCart().reduce((s, l) => s + (l.qty || 0), 0);
}

export function cartSubtotal() {
  return getCart().reduce((s, l) => s + (Number(l.price) || 0) * (l.qty || 0), 0);
}

/**
 * Add or merge a line (same productId increases qty).
 */
export function addToCart({ productId, name, price, qty = 1, category }) {
  const lines = readRaw();
  const id = Number(productId);
  const q = Math.max(1, Number(qty) || 1);
  const cat =
    category != null && String(category).trim()
      ? String(category).trim()
      : undefined;
  const idx = lines.findIndex((l) => Number(l.productId) === id);
  if (idx >= 0) {
    lines[idx].qty = (lines[idx].qty || 0) + q;
    lines[idx].name = name || lines[idx].name;
    lines[idx].price = Number(price) || lines[idx].price;
    if (cat) lines[idx].category = cat;
  } else {
    lines.push({
      productId: id,
      name: String(name || "Item"),
      price: Number(price) || 0,
      qty: q,
      ...(cat ? { category: cat } : {}),
    });
  }
  writeRaw(lines);
}

export function setLineQty(productId, qty) {
  const lines = readRaw();
  const id = Number(productId);
  const q = Math.max(0, Math.floor(Number(qty) || 0));
  const idx = lines.findIndex((l) => Number(l.productId) === id);
  if (idx < 0) return;
  if (q === 0) lines.splice(idx, 1);
  else lines[idx].qty = q;
  writeRaw(lines);
}

export function removeLine(productId) {
  const id = Number(productId);
  writeRaw(readRaw().filter((l) => Number(l.productId) !== id));
}

export function clearCart() {
  sessionStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent("bloomstem-cart"));
}
