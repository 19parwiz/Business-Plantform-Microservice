import { mountShell } from "./site-shell.js";
import { requireAuthOrRedirect } from "./auth.js";
import {
  getCart,
  setLineQty,
  removeLine,
  cartSubtotal,
} from "./cart-store.js";
import { el, escapeHtml, money } from "./utils.js";
import { lineImageUrl } from "./product-images.js";

mountShell("cart");

if (requireAuthOrRedirect()) {
  function paint() {
    const out = el("cart-out");
    const sum = el("cart-summary");
    if (!out) return;
    const lines = getCart();
    if (!lines.length) {
      out.innerHTML =
        "<p class=\"empty-hint\">Your cart is empty. Browse the catalog on the home page to add microgreens or flowers.</p>";
      if (sum) sum.textContent = "";
      return;
    }
    out.innerHTML = `<div class="table-wrap"><table class="order-table">
    <thead><tr><th class="cart-col-thumb" aria-label="Preview"></th><th>Item</th><th>Price</th><th>Qty</th><th></th></tr></thead>
    <tbody>${lines
      .map(
        (l) => `<tr>
        <td class="cart-col-thumb"><img class="cart-line-thumb" src="${lineImageUrl(l)}" alt="" width="48" height="48" loading="lazy" /></td>
        <td><strong>${escapeHtml(l.name)}</strong><br/><span class="muted">#${l.productId}</span></td>
        <td class="num">${money(l.price)}</td>
        <td><input type="number" min="1" class="qty-input" data-pid="${l.productId}" value="${l.qty}" style="width:4rem;padding:0.35rem;border-radius:8px;border:1px solid #d5ddd7" /></td>
        <td><button type="button" class="btn btn--quiet btn--sm" data-remove="${l.productId}">Remove</button></td>
      </tr>`
      )
      .join("")}
    </tbody></table></div>`;

    out.querySelectorAll(".qty-input").forEach((inp) => {
      inp.addEventListener("change", () => {
        const id = Number(inp.getAttribute("data-pid"));
        setLineQty(id, inp.value);
        paint();
      });
    });
    out.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        removeLine(Number(btn.getAttribute("data-remove")));
        paint();
      });
    });

    if (sum) sum.textContent = `Subtotal ${money(cartSubtotal())}`;
  }

  paint();
  window.addEventListener("bloomstem-cart", paint);
}
