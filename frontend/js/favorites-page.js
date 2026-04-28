import { mountShell } from "./site-shell.js";
import { requireAuthOrRedirect } from "./auth.js";
import { getFavorites, removeFavorite } from "./favorites-store.js";
import { addToCart } from "./cart-store.js";
import { el, escapeHtml, money } from "./utils.js";
import { lineImageUrl } from "./product-images.js";

mountShell("favorites");

if (requireAuthOrRedirect()) {
  function setStatus(text, ok) {
    const s = el("fav-status");
    if (!s) return;
    s.textContent = text;
    s.classList.toggle("is-error", !ok);
  }

  function filterRows(query, rows) {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = String(r.name || "").toLowerCase();
      const cat = String(r.category || "").toLowerCase();
      return name.includes(q) || cat.includes(q);
    });
  }

  function paint() {
    const rows = getFavorites();
    const q = el("fav-search")?.value || "";
    const filtered = filterRows(q, rows);
    const g = el("fav-grid");
    if (!g) return;

    if (!rows.length) {
      g.innerHTML =
        "<p class=\"empty-hint\">No favourites yet. Open the home page catalog and tap the heart on any microgreen or flower card.</p>";
      setStatus("", true);
      return;
    }

    if (!filtered.length) {
      g.innerHTML =
        "<p class=\"empty-hint\">No saved items match that search.</p>";
      setStatus(`${rows.length} saved · 0 matches.`, true);
      return;
    }

    g.innerHTML = filtered
      .map((r) => {
        const id = r.productId;
        const name = escapeHtml(r.name || "Product");
        const cat = escapeHtml(r.category || "—");
        const imgSrc = lineImageUrl(r);
        const alt = escapeHtml(r.name || "Product");
        return `<article class="shop-card">
        <div class="shop-card__visual">
          <img class="shop-card__img" src="${imgSrc}" alt="${alt}" loading="lazy" width="640" height="480" />
          <button type="button" class="btn-fav is-on" data-fav="${id}" title="Remove from favourites" aria-pressed="true">♥</button>
        </div>
        <div class="shop-card__body">
          <h3>${name}</h3>
          <div class="shop-card__meta">${cat} · <span class="muted">#${id}</span></div>
          <div class="shop-card__row">
            <span class="shop-card__price">${money(r.price)}</span>
            <button type="button" class="btn btn--primary btn--sm" data-add="${id}" data-name="${encodeURIComponent(r.name || "")}" data-price="${Number(r.price)}" data-cat="${encodeURIComponent(r.category || "")}">Add to cart</button>
          </div>
        </div>
      </article>`;
      })
      .join("");

    g.querySelectorAll("[data-fav]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.getAttribute("data-fav"));
        removeFavorite(id);
        paint();
        setStatus("Removed from favourites.", true);
      });
    });

    g.querySelectorAll("[data-add]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.getAttribute("data-add"));
        const name = decodeURIComponent(btn.getAttribute("data-name") || "");
        const price = Number(btn.getAttribute("data-price"));
        const category = decodeURIComponent(
          btn.getAttribute("data-cat") || ""
        );
        addToCart({ productId: id, name, price, qty: 1, category });
        setStatus(`Added “${name || id}” to cart.`, true);
      });
    });

    const suffix = q.trim() ? ` · showing ${filtered.length}` : "";
    setStatus(`${rows.length} favourite(s)${suffix}.`, true);
  }

  el("fav-search")?.addEventListener("input", () => paint());

  paint();
  window.addEventListener("bloomstem-favorites", paint);
}
