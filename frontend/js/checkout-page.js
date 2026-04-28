import { mountShell } from "./site-shell.js";
import { requireAuthOrRedirect } from "./auth.js";
import { getCart, clearCart, cartSubtotal } from "./cart-store.js";
import { createOrder } from "./api.js";
import { el, escapeHtml, money } from "./utils.js";
import { lineImageUrl } from "./product-images.js";

mountShell("checkout");

if (!requireAuthOrRedirect()) {
  /* redirect */
} else {
  function setStatus(text, ok) {
    const s = el("checkout-status");
    if (!s) return;
    s.textContent = text;
    s.classList.toggle("is-error", !ok);
  }

  function paintReview() {
    const lines = getCart();
    const out = el("checkout-lines");
    const sub = el("checkout-sub");
    if (!lines.length) {
      if (out) {
        out.innerHTML =
          "<p class=\"empty-hint\">Your cart is empty. <a href=\"index.html#catalog\">Browse the catalog</a> first.</p>";
      }
      if (sub) sub.textContent = "";
      return;
    }
    if (out) {
      out.innerHTML = `<ul class="product-list">${lines
        .map(
          (l) =>
            `<li class="product-list__row"><img class="cart-line-thumb" src="${lineImageUrl(l)}" alt="" width="48" height="48" loading="lazy" /><div><strong>${escapeHtml(l.name)}</strong> × ${l.qty} · ${money(
              l.price * l.qty
            )} <span class="muted">#${l.productId}</span></div></li>`
        )
        .join("")}</ul>`;
    }
    if (sub) sub.textContent = `Subtotal ${money(cartSubtotal())}`;
  }

  paintReview();

  el("btn-place")?.addEventListener("click", async () => {
    const lines = getCart();
    if (!lines.length) {
      setStatus("Cart is empty.", false);
      return;
    }
    if (!el("pay-ok")?.checked) {
      setStatus("Confirm the demo payment checkbox first.", false);
      return;
    }
    const btn = el("btn-place");
    btn.disabled = true;
    setStatus("Sending order to gateway…", true);
    try {
      const items = lines.map((l) => ({
        productId: l.productId,
        quantity: l.qty,
      }));
      const res = await createOrder(items);
      const oid = res?.orderId ?? res?.order_id;
      clearCart();
      el("step-pill-pay")?.classList.add("is-done");
      el("step-pill-done")?.classList.add("is-done");
      setStatus(`Order recorded. Reference #${oid}.`, true);
      paintReview();
      setTimeout(() => {
        window.location.assign(`order.html?id=${encodeURIComponent(String(oid))}`);
      }, 900);
    } catch (e) {
      setStatus(
        `${e.message || String(e)} — cart unchanged. Retry when the gateway is up; you can still open Payment and Orders from the menu.`,
        false
      );
    } finally {
      btn.disabled = false;
    }
  });
}
