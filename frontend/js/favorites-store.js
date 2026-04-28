/**
 * Saved items (microgreens, flowers, etc.) in sessionStorage until you wire a backend.
 * Each entry keeps enough fields to render a card without another API call.
 */
const KEY = "bloomstem_favorites_v1";

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

function writeRaw(rows) {
  sessionStorage.setItem(KEY, JSON.stringify(rows));
  window.dispatchEvent(new CustomEvent("bloomstem-favorites"));
}

/** @typedef {{ productId: number, name: string, price: number, category?: string }} FavoriteRow */

/** @returns {FavoriteRow[]} */
export function getFavorites() {
  return readRaw();
}

export function favoriteCount() {
  return getFavorites().length;
}

export function isFavorite(productId) {
  const id = Number(productId);
  return readRaw().some((r) => Number(r.productId) === id);
}

/** Add or replace a favorite row (same id). */
export function addFavorite(row) {
  const id = Number(row.productId);
  const rows = readRaw().filter((r) => Number(r.productId) !== id);
  rows.push({
    productId: id,
    name: String(row.name || "Item"),
    price: Number(row.price) || 0,
    category: row.category != null ? String(row.category) : "",
  });
  writeRaw(rows);
}

export function removeFavorite(productId) {
  const id = Number(productId);
  writeRaw(readRaw().filter((r) => Number(r.productId) !== id));
}

/** Toggle: returns true if now favorited. */
export function toggleFavorite(row) {
  if (isFavorite(row.productId)) {
    removeFavorite(row.productId);
    return false;
  }
  addFavorite(row);
  return true;
}
