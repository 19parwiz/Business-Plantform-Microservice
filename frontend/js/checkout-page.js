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
  const DIGITS_ONLY = /\D+/g;

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

  function normalizePan(raw) {
    const digits = String(raw || "").replace(DIGITS_ONLY, "").slice(0, 19);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
  }

  function normalizeExp(raw) {
    const digits = String(raw || "").replace(DIGITS_ONLY, "").slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  function normalizeCvv(raw) {
    return String(raw || "").replace(DIGITS_ONLY, "").slice(0, 4);
  }

  function isValidExpiry(mmYy) {
    const m = /^(\d{2})\/(\d{2})$/.exec(mmYy);
    if (!m) return false;
    const month = Number(m[1]);
    const year = Number(m[2]);
    if (month < 1 || month > 12) return false;
    const now = new Date();
    const nowYear = now.getFullYear() % 100;
    const nowMonth = now.getMonth() + 1;
    if (year < nowYear) return false;
    if (year === nowYear && month < nowMonth) return false;
    return true;
  }

  function validatePayment() {
    const name = el("pay-name")?.value.trim() || "";
    const pan = normalizePan(el("pay-pan")?.value || "");
    const exp = normalizeExp(el("pay-exp")?.value || "");
    const cvv = normalizeCvv(el("pay-cvv")?.value || "");

    if (!name) return { ok: false, msg: "Enter name on card." };
    // Accept common PAN lengths (12-19) for demo flows instead of forcing only 16.
    const panDigits = pan.replace(DIGITS_ONLY, "");
    if (panDigits.length < 12) {
      return { ok: false, msg: "Enter a valid card number (at least 12 digits)." };
    }
    if (!isValidExpiry(exp)) {
      return { ok: false, msg: "Enter a valid expiry date in MM/YY format." };
    }
    if (cvv.length < 3) return { ok: false, msg: "Enter a valid CVV (3 or 4 digits)." };
    return { ok: true, payload: { name, pan, exp, cvv } };
  }

  el("pay-pan")?.addEventListener("input", (e) => {
    e.currentTarget.value = normalizePan(e.currentTarget.value);
  });
  el("pay-exp")?.addEventListener("input", (e) => {
    e.currentTarget.value = normalizeExp(e.currentTarget.value);
  });
  el("pay-cvv")?.addEventListener("input", (e) => {
    e.currentTarget.value = normalizeCvv(e.currentTarget.value);
  });

  el("step-pill-done")?.addEventListener("click", () => {
    el("btn-place")?.click();
  });

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
    const payment = validatePayment();
    if (!payment.ok) {
      setStatus(payment.msg, false);
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
      // Keep last entered payment values in session for convenience on next checkout.
      sessionStorage.setItem(
        "bloomstem_last_payment",
        JSON.stringify({
          name: payment.payload.name,
          panLast4: payment.payload.pan.replace(DIGITS_ONLY, "").slice(-4),
          exp: payment.payload.exp,
        })
      );
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
