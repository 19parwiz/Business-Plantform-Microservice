import { mountShell } from "./site-shell.js";
import { requireAuthOrRedirect } from "./auth.js";
import { listOrders } from "./api.js";
import { el, escapeHtml, money, oid } from "./utils.js";

mountShell("orders");

if (!requireAuthOrRedirect()) {
  /* redirect */
} else {
  function setStatus(text, ok) {
    const s = el("orders-status");
    if (!s) return;
    s.textContent = text;
    s.classList.toggle("is-error", !ok);
  }

  (async () => {
    setStatus("Loading…", true);
    try {
      const data = await listOrders(1, 30);
      const orders = data?.orders || [];
      const g = el("orders-grid");
      if (!g) return;
      if (!orders.length) {
        g.innerHTML =
          "<p class=\"empty-hint\">No orders yet. <a href=\"checkout.html\">Complete a checkout</a> with something from the catalog.</p>";
      } else {
        g.innerHTML = orders
          .map((o) => {
            const id = oid(o);
            const total = o?.totalAmount ?? o?.total_amount;
            const st = o?.status || "—";
            return `<article class="dash-card">
              <h2>Order #${id}</h2>
              <p>${st} · ${money(total)}</p>
              <a class="btn btn--outline" href="order.html?id=${id}">View details</a>
            </article>`;
          })
          .join("");
      }
      setStatus(`${orders.length} order(s).`, true);
    } catch (e) {
      const msg = e.message || String(e);
      const g = el("orders-grid");
      if (g) {
        g.innerHTML = `<p class="empty-hint">Orders could not be loaded (${escapeHtml(msg)}). When your gateway is running, refresh this page. You can still use <a href="checkout.html">checkout</a> and <a href="payment.html">payment</a> for the demo flow.</p>`;
      }
      setStatus("Gateway offline or error — see message above.", false);
    }
  })();
}
