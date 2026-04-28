import { mountShell } from "./site-shell.js";
import { requireAuthOrRedirect } from "./auth.js";
import { getOrder } from "./api.js";
import { el, readQuery, escapeHtml, money, oid } from "./utils.js";

mountShell("orders");

const idRaw = readQuery("id");
const id = idRaw ? parseInt(idRaw, 10) : 0;

if (!requireAuthOrRedirect()) {
  /* redirect */
} else if (!id) {
  const st = el("order-status");
  if (st) st.textContent = "Missing order id. Open this page from your order list.";
} else {
  (async () => {
    const st = el("order-status");
    const body = el("order-body");
    const title = el("order-title");
    st.textContent = "Loading…";
    try {
      const o = await getOrder(id);
      const oidVal = oid(o);
      if (title) title.textContent = `Order #${oidVal}`;
      const items = o?.items || [];
      const rows = items
        .map((it) => {
          const name = escapeHtml(it.name || "—");
          const pid = it.productId ?? it.product_id;
          const qty = it.quantity ?? "—";
          const line = it.totalPrice ?? it.total_price ?? it.price;
          return `<tr>
            <td>${name}</td>
            <td>#${pid}</td>
            <td class="num">${qty}</td>
            <td class="num">${money(line)}</td>
          </tr>`;
        })
        .join("");
      const total = o?.totalAmount ?? o?.total_amount;
      const status = escapeHtml(o?.status || "—");
      body.innerHTML = `
        <div class="dash-card" style="margin-bottom:1rem">
          <p><strong>Status</strong> ${status}</p>
          <p><strong>Total</strong> ${money(total)}</p>
        </div>
        <div class="table-wrap"><table class="order-table">
          <thead><tr><th>Item</th><th>Product</th><th>Qty</th><th>Line</th></tr></thead>
          <tbody>${rows || "<tr><td colspan=\"4\">No line items</td></tr>"}</tbody>
        </table></div>`;
      st.textContent = "";
    } catch (e) {
      const msg = e.message || String(e);
      st.textContent = "Could not load this order.";
      st.classList.add("is-error");
      if (body) {
        body.innerHTML = `<p class="empty-hint">${escapeHtml(msg)}. Check that the gateway is running and you are signed in, or open <a href="orders.html">orders</a> again.</p>`;
      }
    }
  })();
}
