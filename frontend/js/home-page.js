import { mountShell } from "./site-shell.js";
import { listProducts } from "./api.js";
import { addToCart, cartCount } from "./cart-store.js";
import { isFavorite, toggleFavorite, favoriteCount } from "./favorites-store.js";
import { isLoggedIn } from "./auth.js";
import { skipAuthGuard } from "./config.js";
import { el, escapeHtml, money, pid } from "./utils.js";
import { DEMO_CATALOG, productImageUrl } from "./product-images.js";

mountShell("home");

const canBuy = () => isLoggedIn() || skipAuthGuard();
const authNext = () =>
  encodeURIComponent(
    `${location.pathname}${location.search}${location.hash}`
  );

function toolbar() {
  const w = el("shop-toolbar-links");
  if (!w) return;
  const a = `auth.html?next=${authNext()}`;
  if (canBuy()) {
    w.setAttribute("aria-label", "Cart and favourites");
    w.innerHTML = `<a class="nav-link" href="cart.html">Cart <span class="nav-badge" id="shop-cart-count"></span></a><a class="nav-link" href="favorites.html">Favourites <span class="nav-badge" id="shop-fav-count"></span></a>`;
  } else {
    w.setAttribute("aria-label", "Sign in for cart");
    w.innerHTML = `<span class="shop-toolbar__guest-msg muted">Guests browse only. <a class="nav-link" href="${a}">Sign in</a> to buy.</span>`;
  }
}

function badges() {
  const cc = cartCount();
  const fc = favoriteCount();
  const c = el("shop-cart-count");
  if (c) {
    c.textContent = cc > 0 ? String(cc) : "";
    c.hidden = cc === 0;
  }
  const f = el("shop-fav-count");
  if (f) {
    f.textContent = fc > 0 ? String(fc) : "";
    f.hidden = fc === 0;
  }
}

let products = [];
let demoCat = false;
let apiErr = "";
let cat = "all";
let proceedProductId = null;

function status(t, ok) {
  const s = el("shop-status");
  if (!s) return;
  s.textContent = t;
  s.classList.toggle("is-error", !ok);
}

function filter(qRaw) {
  const q = qRaw.trim().toLowerCase();
  let list = products;
  if (cat === "flowers" || cat === "microgreens") {
    list = list.filter((p) =>
      String(p.category || "")
        .toLowerCase()
        .includes(cat)
    );
  }
  if (!q) return list;
  return list.filter((p) => {
    const n = String(p.name || "").toLowerCase();
    const c = String(p.category || "").toLowerCase();
    const id = String(pid(p) || "");
    return n.includes(q) || c.includes(q) || id.includes(q);
  });
}

function paintGrid(list) {
  const g = el("shop-grid");
  if (!g) return;
  if (!products.length) {
    g.innerHTML =
      "<p class=\"empty-hint\">No products yet. Add some in Admin.</p>";
    return;
  }
  if (!list.length) {
    g.innerHTML =
      "<p class=\"empty-hint\">No matches — try another search.</p>";
    return;
  }
  const ok = canBuy();
  const auth = `auth.html?next=${authNext()}`;
  g.innerHTML = list
    .map((p) => {
      const id = pid(p);
      const nm = escapeHtml(p.name || "Product");
      const c = escapeHtml(p.category || "—");
      const pr = Number(p.price);
      const st = p.stock ?? "—";
      const fv = isFavorite(id);
      const src = productImageUrl(p);
      const heart = ok
        ? `<button type="button" class="btn-fav${fv ? " is-on" : ""}" data-fav="${id}" title="Favourite" aria-pressed="${fv}">♥</button>`
        : `<button type="button" class="btn-fav btn-fav--guest" disabled title="Sign in" aria-disabled="true">♥</button>`;
      const showProceed = ok && String(proceedProductId) === String(id);
      const buy = ok
        ? showProceed
          ? `<button type="button" class="btn btn--outline btn--sm" data-proceed="1">Proceed to checkout</button>`
          : `<button type="button" class="btn btn--primary btn--sm" data-add="${id}" data-name="${encodeURIComponent(p.name || "")}" data-price="${pr}" data-cat="${encodeURIComponent(p.category || "")}">Add to cart</button>`
        : `<a class="btn btn--outline btn--sm" href="${auth}">Sign in to buy</a>`;
      return `<article class="shop-card"><div class="shop-card__visual"><img class="shop-card__img" src="${src}" alt="${nm}" loading="lazy" width="640" height="480"/>${heart}</div><div class="shop-card__body"><h3>${nm}</h3><div class="shop-card__meta">${c} · <span class="muted">#${id}</span> · ${st}</div><div class="shop-card__row"><span class="shop-card__price">${money(pr)}</span>${buy}</div></div></article>`;
    })
    .join("");
}

function paint() {
  const q = el("shop-search")?.value || "";
  const list = filter(q);
  paintGrid(list);
  const hint = demoCat ? "Demo photos. " : "";
  const err = apiErr ? `${apiErr} · ` : "";
  status(
    `${err}${hint}${products.length} product(s)${q.trim() ? ` (${list.length} match)` : ""}.`,
    true
  );
}

function fromUrl() {
  const p = new URLSearchParams(location.search);
  const v = (p.get("q") ?? "").trim();
  const c = (p.get("cat") ?? "").trim().toLowerCase();
  if (c === "flowers" || c === "microgreens") cat = c;
  else if (/^(flowers|microgreens)$/i.test(v)) cat = v.toLowerCase();
  else if (/^plants$/i.test(v)) cat = "all";
  const inp = el("shop-search");
  if (inp) {
    const skip = /^(plants|flowers|microgreens)$/i.test(v);
    inp.value = skip ? "" : v;
  }
  document.querySelectorAll("[data-cat]").forEach((b) => {
    b.classList.toggle(
      "is-active",
      b.getAttribute("data-cat") === cat
    );
  });
}

function toUrl() {
  const v = el("shop-search")?.value?.trim() ?? "";
  const u = new URL(location.href);
  if (v) u.searchParams.set("q", v);
  else u.searchParams.delete("q");
  if (cat === "flowers" || cat === "microgreens")
    u.searchParams.set("cat", cat);
  else u.searchParams.delete("cat");
  const qs = u.searchParams.toString();
  history.replaceState(null, "", u.pathname + (qs ? `?${qs}` : "") + (u.hash || ""));
}

function onGridClick(e) {
  const proceed = e.target.closest("[data-proceed]");
  if (proceed) {
    window.location.assign("checkout.html");
    return;
  }

  const add = e.target.closest("[data-add]");
  if (add) {
    if (!isLoggedIn()) {
      window.location.assign(`auth.html?next=${authNext()}`);
      return;
    }
    const id = Number(add.getAttribute("data-add"));
    const name = decodeURIComponent(add.getAttribute("data-name") || "");
    const price = Number(add.getAttribute("data-price"));
    const c = decodeURIComponent(add.getAttribute("data-cat") || "");
    addToCart({ productId: id, name, price, qty: 1, category: c });
    proceedProductId = id;
    status(`Added “${name || id}”. You can proceed to checkout.`, true);
    paint();
    return;
  }
  const fb = e.target.closest("[data-fav]");
  if (fb) {
    const id = Number(fb.getAttribute("data-fav"));
    const card = fb.closest(".shop-card");
    const ab = card?.querySelector("[data-add]");
    const name = ab
      ? decodeURIComponent(ab.getAttribute("data-name") || "")
      : "";
    const price = ab ? Number(ab.getAttribute("data-price")) : 0;
    const c = ab
      ? decodeURIComponent(ab.getAttribute("data-cat") || "")
      : "";
    const on = toggleFavorite({
      productId: id,
      name: name || `#${id}`,
      price,
      category: c,
    });
    fb.classList.toggle("is-on", on);
    fb.setAttribute("aria-pressed", String(on));
    status(on ? "Saved." : "Removed.", true);
  }
}

toolbar();
badges();
window.addEventListener("bloomstem-cart", badges);
window.addEventListener("bloomstem-favorites", badges);

fromUrl();
el("shop-search")?.addEventListener("input", () => {
  toUrl();
  paint();
});
document.querySelectorAll("[data-cat]").forEach((b) => {
  b.addEventListener("click", () => {
    const n = (b.getAttribute("data-cat") || "all").toLowerCase();
    cat = n === "flowers" || n === "microgreens" ? n : "all";
    document.querySelectorAll("[data-cat]").forEach((btn) => {
      btn.classList.toggle(
        "is-active",
        btn.getAttribute("data-cat") === cat
      );
    });
    toUrl();
    paint();
  });
});
window.addEventListener("popstate", () => {
  fromUrl();
  paint();
});
el("shop-grid")?.addEventListener("click", onGridClick);

(async () => {
  status("Loading…", true);
  try {
    apiErr = "";
    const data = await listProducts(1, 100);
    products = data?.products || [];
    if (!products.length) {
      demoCat = true;
      products = [...DEMO_CATALOG];
    }
    paint();
  } catch (e) {
    demoCat = true;
    apiErr = e.message || String(e);
    products = [...DEMO_CATALOG];
    paint();
  }
})();
