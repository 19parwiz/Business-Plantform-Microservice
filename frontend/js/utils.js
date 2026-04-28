export function el(id) {
  return document.getElementById(id);
}

export function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function money(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("kk-KZ", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  }).format(v);
}

export function pid(p) {
  return p?.productId ?? p?.product_id;
}

export function oid(o) {
  return o?.orderId ?? o?.order_id;
}

export function readQuery(key) {
  return new URLSearchParams(window.location.search).get(key);
}
