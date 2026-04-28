import { mountShell } from "./site-shell.js";
import { requireAuthOrRedirect } from "./auth.js";
import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  listOrders,
  updateOrder,
  createOrder,
  getProfile,
} from "./api.js";
import { el, escapeHtml, money, pid, oid } from "./utils.js";

mountShell("admin");

function set(id, text, ok) {
  const s = el(id);
  if (!s) return;
  s.textContent = text;
  s.classList.toggle("is-error", !ok);
}

function setTab(name) {
  document.querySelectorAll(".admin-tab").forEach((b) => {
    const on = b.dataset.tab === name;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });
  document.querySelectorAll(".admin-panel").forEach((p) => {
    p.hidden = p.dataset.panel !== name;
  });
}

let ordersBooted = false;

function wireTabs() {
  document.querySelectorAll(".admin-tab").forEach((b) => {
    b.addEventListener("click", () => {
      const name = b.dataset.tab || "catalog";
      setTab(name);
      if (name === "orders" && !ordersBooted) {
        ordersBooted = true;
        reloadOrders();
      }
    });
  });
}

async function reloadTable() {
  const tb = el("admin-tbody");
  if (!tb) return;
  set("admin-list-status", "Loading…", true);
  try {
    const data = await listProducts(1, 100);
    const products = data?.products || [];
    tb.innerHTML = products
      .map((p) => {
        const id = pid(p);
        return `<tr>
          <td>${id}</td>
          <td>${escapeHtml(p.name || "")}</td>
          <td>${escapeHtml(p.category || "")}</td>
          <td>${money(p.price)}</td>
          <td>${p.stock ?? ""}</td>
          <td class="admin-actions">
            <button type="button" class="btn btn--quiet btn--sm" data-edit="${id}">Edit</button>
            <button type="button" class="btn btn--quiet btn--sm" data-del="${id}">Delete</button>
          </td>
        </tr>`;
      })
      .join("");
    set("admin-list-status", `${products.length} row(s).`, true);

    tb.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.getAttribute("data-edit"));
        const row = btn.closest("tr");
        const cells = row?.querySelectorAll("td");
        if (!cells || cells.length < 5) return;
        el("e-id").value = String(id);
        el("e-name").value = cells[1].textContent.trim();
        el("e-cat").value = cells[2].textContent.trim();
        el("e-price").value = String(
          parseFloat(String(cells[3].textContent).replace(/[^0-9.]/g, "")) || 0
        );
        el("e-stock").value = cells[4].textContent.trim();
        el("edit-dlg")?.showModal();
      });
    });

    tb.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.getAttribute("data-del"));
        if (!confirm(`Delete product #${id}?`)) return;
        set("admin-list-status", "Deleting…", true);
        try {
          await deleteProduct(id);
          await reloadTable();
        } catch (e) {
          set("admin-list-status", e.message || String(e), false);
        }
      });
    });
  } catch (e) {
    tb.innerHTML = "";
    set("admin-list-status", e.message || String(e), false);
  }
}

async function reloadOrders() {
  const tb = el("admin-orders-tbody");
  if (!tb) return;
  set("admin-orders-status", "Loading…", true);
  try {
    const data = await listOrders(1, 50);
    const orders = data?.orders || [];
    tb.innerHTML = orders
      .map((o) => {
        const id = oid(o);
        const st = escapeHtml(o?.status || "—");
        const tot = money(o?.totalAmount ?? o?.total_amount);
        const rawCr = String(o?.createdAt ?? o?.created_at ?? "—");
        const cr = escapeHtml(
          rawCr.length > 28 ? `${rawCr.slice(0, 28)}…` : rawCr
        );
        return `<tr>
          <td>${id}</td>
          <td>${st}</td>
          <td>${tot}</td>
          <td>${cr}</td>
          <td><button type="button" class="btn btn--quiet btn--sm" data-ostatus="${id}" data-cur="${encodeURIComponent(o?.status || "")}">Status</button></td>
        </tr>`;
      })
      .join("");
    set("admin-orders-status", `${orders.length} order(s).`, true);

    tb.querySelectorAll("[data-ostatus]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.getAttribute("data-ostatus"));
        el("o-id").value = String(id);
        const cur = decodeURIComponent(
          btn.getAttribute("data-cur") || "pending"
        );
        const sel = el("o-status");
        if (sel) sel.value = cur || "pending";
        el("order-dlg")?.showModal();
      });
    });
  } catch (e) {
    tb.innerHTML = "";
    set("admin-orders-status", e.message || String(e), false);
  }
}

async function loadProfile() {
  set("admin-profile-status", "Loading…", true);
  const out = el("admin-profile-out");
  try {
    const p = await getProfile();
    if (out) {
      out.style.display = "block";
      out.textContent = JSON.stringify(p, null, 2);
    }
    set("admin-profile-status", "Loaded.", true);
  } catch (e) {
    if (out) {
      out.style.display = "block";
      out.textContent = e.message || String(e);
    }
    set("admin-profile-status", "Error.", false);
  }
}

if (!requireAuthOrRedirect()) {
  /* redirect */
} else {
  wireTabs();

  el("form-create")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = {
      name: el("c-name").value.trim(),
      category: el("c-cat").value.trim(),
      price: Number(el("c-price").value),
      stock: Math.floor(Number(el("c-stock").value)),
    };
    set("admin-create-status", "Saving…", true);
    try {
      await createProduct(body);
      el("form-create").reset();
      set("admin-create-status", "Created.", true);
      await reloadTable();
    } catch (err) {
      set("admin-create-status", err.message || String(err), false);
    }
  });

  el("edit-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = Number(el("e-id").value);
    const body = {
      name: el("e-name").value.trim(),
      category: el("e-cat").value.trim(),
      price: Number(el("e-price").value),
      stock: Math.floor(Number(el("e-stock").value)),
    };
    try {
      await updateProduct(id, body);
      el("edit-dlg")?.close();
      await reloadTable();
      set("admin-create-status", "", true);
    } catch (err) {
      set("admin-create-status", err.message || String(err), false);
    }
  });

  el("e-cancel")?.addEventListener("click", () => el("edit-dlg")?.close());

  el("form-admin-order")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pid = Math.floor(Number(el("ao-pid").value));
    const qty = Math.floor(Number(el("ao-qty").value));
    set("admin-order-status", "Sending…", true);
    try {
      await createOrder([{ productId: pid, quantity: qty }]);
      set("admin-order-status", "Order created.", true);
      el("form-admin-order").reset();
      ordersBooted = true;
      await reloadOrders();
    } catch (err) {
      set("admin-order-status", err.message || String(err), false);
    }
  });

  el("order-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = Number(el("o-id").value);
    const status = el("o-status")?.value || "";
    try {
      await updateOrder(id, { status });
      el("order-dlg")?.close();
      await reloadOrders();
    } catch (err) {
      set("admin-orders-status", err.message || String(err), false);
    }
  });

  el("o-cancel")?.addEventListener("click", () => el("order-dlg")?.close());

  el("btn-profile-load")?.addEventListener("click", () => loadProfile());

  reloadTable();
}
