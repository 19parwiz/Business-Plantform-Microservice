import { mountShell } from "./site-shell.js";
import { requireAuthOrRedirect } from "./auth.js";
import { listOrders, listProducts } from "./api.js";
import { el, escapeHtml, money, pid } from "./utils.js";

mountShell("analytics");

function orderTotal(o) {
  const v = o?.totalAmount ?? o?.total_amount;
  return Number(v) || 0;
}

function guessCategory(name) {
  const n = String(name || "").toLowerCase();
  if (/micro|sprout|shoot|pea|radish|sunflower|broccoli|kale|mustard|cress/i.test(n)) {
    return "Microgreens";
  }
  if (/rose|lily|tulip|bouquet|stem|flower|orchid|daisy|carnation|peony/i.test(n)) {
    return "Flowers";
  }
  if (/herb|basil|mint|oregano|thyme|parsley|coriander/i.test(n)) {
    return "Herbs";
  }
  return "Other";
}

/** Map product id → { name, category } from catalog pages. */
async function buildCatalogMap() {
  const map = new Map();
  let page = 1;
  const limit = 80;
  for (let i = 0; i < 15; i++) {
    const data = await listProducts(page, limit);
    const products = data?.products || [];
    for (const p of products) {
      const id = pid(p);
      map.set(Number(id), {
        name: p.name || "",
        category: (p.category || "").trim() || guessCategory(p.name),
      });
    }
    if (products.length < limit) break;
    page++;
  }
  return map;
}

async function fetchAllOrders() {
  const all = [];
  let page = 1;
  const limit = 50;
  for (let i = 0; i < 25; i++) {
    const data = await listOrders(page, limit);
    const orders = data?.orders || [];
    all.push(...orders);
    if (orders.length < limit) break;
    page++;
  }
  return all;
}

function aggregate(orders, catalog) {
  let totalRevenue = 0;
  const revenueByCategory = new Map();
  const productAgg = new Map();

  for (const o of orders) {
    totalRevenue += orderTotal(o);
    const items = o.items || [];
    for (const it of items) {
      const pidVal = Number(it.productId ?? it.product_id);
      const qty = Number(it.quantity ?? 0) || 0;
      const name = String(it.name || (pidVal ? `Product #${pidVal}` : "Line item"));
      const lineRev =
        Number(it.totalPrice ?? it.total_price) ||
        (Number(it.price) || 0) * qty;
      const catEntry = catalog.get(pidVal);
      const category =
        (catEntry && catEntry.category) || guessCategory(name);

      revenueByCategory.set(
        category,
        (revenueByCategory.get(category) || 0) + lineRev
      );

      const key = name;
      if (!productAgg.has(key)) {
        productAgg.set(key, {
          name,
          category,
          units: 0,
          revenue: 0,
        });
      }
      const row = productAgg.get(key);
      row.units += qty;
      row.revenue += lineRev;
    }
  }

  const avgOrder = orders.length ? totalRevenue / orders.length : 0;

  if (revenueByCategory.size === 0 && totalRevenue > 0) {
    revenueByCategory.set(
      "Order totals (line items not in payload)",
      totalRevenue
    );
  }

  return {
    totalRevenue,
    orderCount: orders.length,
    avgOrder,
    revenueByCategory,
    productAgg,
  };
}

let chartCategory = null;
let chartProducts = null;

function destroyCharts() {
  chartCategory?.destroy();
  chartProducts?.destroy();
  chartCategory = null;
  chartProducts = null;
}

function renderStats({ totalRevenue, orderCount, avgOrder }) {
  const host = el("stat-cards");
  if (!host) return;
  host.innerHTML = `
    <article class="stat-card"><span class="stat-card__label">Orders loaded</span><strong class="stat-card__value">${orderCount}</strong></article>
    <article class="stat-card"><span class="stat-card__label">Revenue (sum of order totals)</span><strong class="stat-card__value">${money(totalRevenue)}</strong></article>
    <article class="stat-card"><span class="stat-card__label">Average order value</span><strong class="stat-card__value">${money(avgOrder)}</strong></article>`;
}

function renderTable(productAgg) {
  const tb = el("analytics-tbody");
  if (!tb) return;
  const rows = [...productAgg.values()]
    .sort((a, b) => b.units - a.units)
    .slice(0, 25);
  tb.innerHTML = rows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.category)}</td><td class="num">${r.units}</td><td class="num">${money(r.revenue)}</td></tr>`
    )
    .join("");
}

const COLORS = [
  "#2d6a4f",
  "#40916c",
  "#52b788",
  "#74c69d",
  "#95d5b2",
  "#b7e4c7",
  "#d8f3dc",
  "#c9184a",
  "#ff758f",
  "#ffb3c1",
];

function runCharts(revenueByCategory, productAgg) {
  const Chart = globalThis.Chart;
  if (!Chart) {
    throw new Error("Chart.js failed to load from CDN.");
  }

  destroyCharts();

  const catLabels = [...revenueByCategory.keys()];
  const catData = catLabels.map((k) => revenueByCategory.get(k) || 0);
  const ctxCat = el("chart-category")?.getContext("2d");
  if (ctxCat && catLabels.length > 0) {
    chartCategory = new Chart(ctxCat, {
      type: "doughnut",
      data: {
        labels: catLabels,
        datasets: [
          {
            data: catData,
            backgroundColor: COLORS,
            borderWidth: 1,
            borderColor: "#fff",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },
        },
      },
    });
  }

  const products = [...productAgg.values()].sort((a, b) => b.units - a.units).slice(0, 10);
  const pLabels = products.map((p) =>
    p.name.length > 28 ? `${p.name.slice(0, 26)}…` : p.name
  );
  const pUnits = products.map((p) => p.units);
  const ctxBar = el("chart-products")?.getContext("2d");
  if (ctxBar && pLabels.length > 0) {
    chartProducts = new Chart(ctxBar, {
      type: "bar",
      data: {
        labels: pLabels,
        datasets: [
          {
            label: "Units sold",
            data: pUnits,
            backgroundColor: "rgba(45, 106, 79, 0.75)",
            borderRadius: 6,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: { beginAtZero: true, ticks: { precision: 0 } },
          y: { ticks: { font: { size: 10 } } },
        },
      },
    });
  }
}

if (!requireAuthOrRedirect()) {
  /* redirect */
} else {
  (async () => {
    const status = el("analytics-status");
    status.textContent = "Loading orders and catalog…";
    try {
      const catalog = await buildCatalogMap();
      const orders = await fetchAllOrders();
      const agg = aggregate(orders, catalog);

      if (!orders.length) {
        status.textContent =
          "No orders in range — place a few checkouts first to see charts.";
        renderStats({ totalRevenue: 0, orderCount: 0, avgOrder: 0 });
        destroyCharts();
        const tb = el("analytics-tbody");
        if (tb) tb.innerHTML = "";
        return;
      }

      renderStats(agg);
      renderTable(agg.productAgg);
      runCharts(agg.revenueByCategory, agg.productAgg);
      status.textContent = `Based on ${orders.length} order(s) and ${catalog.size} catalog SKU(s) loaded for category matching.`;
    } catch (e) {
      status.textContent = e.message || String(e);
      status.classList.add("is-error");
    }
  })();
}

window.addEventListener("beforeunload", destroyCharts);
