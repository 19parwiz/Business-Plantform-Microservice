# AgroTech Fresh — frontend (microgreens & flowers)

This folder is a **static multi-page** storefront that talks to your existing **API gateway** over HTTP. It does **not** contain a build step: plain HTML, CSS, and ES modules.

## What it does today

| Area | Behaviour | Backend you can add later |
|------|-------------|---------------------------|
| **Branding** | Welcome line is **dynamic** (`js/welcome.js`, called from `site-shell.js`): time-of-day greeting + store name + tagline; optional overrides via meta or `localStorage`. Top-of-site **blossom strip** + home hero use **`--bloom-hero-image`** in `css/style.css` (default: Meriç Dağlı’s *Sakura tree in bloom* on Unsplash). | CMS, CDN hero, or seasonal campaign assets. |
| **Catalog** | `GET /api/v1/products` — cards with **search** (client-side filter on name, category, id). | Server-side search, facets, pagination UX. |
| **Favourites** | ♥ on each card; list stored in **`sessionStorage`** (`favorites-store.js`). **Favourites** page; counts on the home catalog toolbar when signed in. | `POST/DELETE /users/.../favorites` with auth; sync across devices. |
| **Cart** | Same idea: **`sessionStorage`** (`cart-store.js`). | Persistent cart API, merge on login. |
| **Auth** | Single page auth (`html/auth.html`) with login + register; session in `sessionStorage`; gateway gets **`X-Email`** / **`X-Password`** (`auth.js`, `api.js`). While **`SKIP_AUTH_GUARD`** in `config.js` is `true`, protected pages do not redirect (UI preview). Set `false` (or `<meta name="demo-skip-auth" content="false">`) to enforce login. | JWT / session cookies, refresh tokens, OAuth. |
| **Checkout** | Demo checkbox + disabled card fields, then **`POST /api/v1/orders`** with snake_case line items. | Stripe / PayPal / PSP, idempotency keys, tax. |
| **Orders** | `GET /api/v1/orders`, `GET /api/v1/orders/:id`. | Webhooks, cancellations, inventory reservation. |
| **Insights** | **`html/analytics.html`** — aggregates loaded orders + catalog for doughnut (revenue by category) and bar chart (units by product). Uses Chart.js CDN. **Today:** only the signed-in user’s orders; **later:** owner-wide reporting API + date range. | Dedicated analytics service, warehouse exports, cohort views. |
| **Inventory UI** | Product CRUD via gateway (any logged-in user today). | Admin role, audit log, file uploads for photos. |

## File map

- **`html/index.html`** + **`js/home-page.js`** — Home hero, photo strip, embedded **catalog** (search, chips, grid, cart strip) in one script.
- **`html/shop.html`** — Redirects to `index.html#catalog` (keeps old links working).
- **`html/favorites.html`** + **`js/favorites-page.js`** — Saved cards + search filter.
- **`html/analytics.html`** + **`js/analytics-page.js`** — Sales insights (Chart.js CDN).
- **`html/cart.html`** / **`html/checkout.html`** / **`html/payment.html`** — Cart, checkout + demo payment note, payment info page.
- **`html/auth.html`** + **`js/auth-page.js`** — Combined login + register.
- **`html/about.html`** + **`js/about-page.js`** — About us.
- **`html/dashboard.html`** — Admin dashboard.
- **`html/orders.html`** / **`html/order.html`** — List and detail.
- **`html/profile.html`** — `GET /api/v1/users/profile`.
- **`html/admin.html`** — Tabs: **catalog** CRUD (products), **orders** (list, create, status update), **users** (profile JSON via `GET /users/profile` only; no list/edit API on gateway yet).
- **`js/config.js`** — Reads `<meta name="api-base" content="http://localhost:8080">` from each HTML file (change per environment).
- **`js/site-shell.js`** — Sticky header: **Home · About us** (+ **Log in / Register** or **Checkout · Payment · Orders · Profile · Admin · Log out**). Cart/favourites live in the home catalog toolbar.
- **`js/product-images.js`** — Fallback card photos when the API has no `imageUrl`: rotates through curated **[Unsplash](https://unsplash.com)** and **[Pexels](https://www.pexels.com)** direct links (add your own URLs or `pexelsPhoto(id)` rows). Demo catalog when the gateway is empty or offline.
- **`css/style.css`** — Global styles.

## How to run locally

From **this directory** (root `index.html` redirects into `html/`):

```bash
cd frontend
python -m http.server 5500
```

Open `http://localhost:5500/` (or `http://localhost:5500/html/index.html`). Ensure the **gateway** URL in `<meta name="api-base" ...>` matches your running `api-gateway` (default `http://localhost:8080`).

### Layout

Pages under `html/` use **responsive CSS** (`style.css`): stacked nav on small screens, horizontal scroll for many nav links, full-width cards, larger tap targets, and chart heights capped with `min()` / `vh` so analytics fits phones.

## Dynamic welcome (`welcome.js`)

Every page with `<p class="welcome-tag" aria-live="polite"></p>` gets the same message when `mountShell()` runs.

**Default pattern:** `Good morning | afternoon | evening — Welcome to {store} — {tagline}`  
Defaults: store **AgroTech Fresh**, tagline **Microgreens & Flowers Store**.

**Overrides (optional):**

1. **Full line** — in `<head>`:  
   `<meta name="store-welcome" content="Your entire one-line greeting" />`
2. **Parts** — e.g. on `index.html`:  
   `<meta name="store-name" content="AgroTech Fresh" />`  
   `<meta name="store-tagline" content="Microgreens & Flowers Store" />`  
   Copy the same metas onto other HTML entry points if you need them on every full page load.
3. **Runtime (e.g. after your backend settings fetch)** — set  
   `localStorage.setItem('agrotech_store_welcome', '…')`  
   then reload; this wins over the time-based line unless `store-welcome` meta is set.

## Conventions for when you extend the backend

1. **Favourites** — Replace `sessionStorage` with authenticated API calls; keep the same UI events (`bloomstem-favorites`) if you want minimal UI churn.
2. **Search** — Today filtering is in the browser after `listProducts`. For large catalogs, pass `q` as a query param and implement in **inventory-service** + gateway.
3. **Product photos** — Cards use a gradient placeholder; add image URLs to your product model and extend `home-page.js` / `favorites-page.js` markup.
4. **Roles** — Hide **Admin** in `site-shell.js` when the API exposes a `role` claim (or separate staff host).

## Spelling note

Customer-facing copy uses **“favourites”** (UK) in the nav to match common agritech / EU retail tone; storage keys stay ASCII.
