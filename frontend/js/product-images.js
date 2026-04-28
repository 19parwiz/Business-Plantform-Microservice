/**
 * Product card imagery for the static storefront.
 * When your Go/inventory API adds `imageUrl` (or `image`) on each product, that wins.
 *
 * Fallback pools below mix **direct image URLs** from [Unsplash](https://unsplash.com)
 * and [Pexels](https://www.pexels.com) — no SDK: paste any full-size JPEG/WEBP link
 * you get from “Share” / “Copy image address” / download link on those sites, or your CDN.
 */

/** Pexels CDN: photo id from the URL bar on pexels.com/photo/… */
function pexelsPhoto(id) {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=640&h=480&fit=crop`;
}

/** Matches `css/style.css` hero strip; paths relative to `html/*.html`. */
const SITE_HERO_STRIP = "../assets/images/bg-hero-strip.png";

const MICRO = [
  // Unsplash
  "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=640&h=480&q=82",
  "https://images.unsplash.com/photo-1592419044706-39796d40f98c?auto=format&fit=crop&w=640&h=480&q=82",
  "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=640&h=480&q=82",
  "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=640&h=480&q=82",
  // Pexels (greens / produce / herbs)
  pexelsPhoto(5945562),
  pexelsPhoto(1300975),
  pexelsPhoto(1084542),
  pexelsPhoto(5945746),
];

const FLOWERS = [
  SITE_HERO_STRIP,
  "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=640&h=480&q=82",
  "https://images.unsplash.com/photo-1606800052052-a08c5214fd89?auto=format&fit=crop&w=640&h=480&q=82",
  "https://images.unsplash.com/photo-1563241527-3004b7be0ffd?auto=format&fit=crop&w=640&h=480&q=82",
  "https://images.unsplash.com/photo-1518882605630-8e3605fff006?auto=format&fit=crop&w=640&h=480&q=82",
  pexelsPhoto(1168764),
  pexelsPhoto(1308888),
  pexelsPhoto(931154),
  pexelsPhoto(931177),
];

const OTHER = [
  "https://images.unsplash.com/photo-1563514227147-6a0471065a2c?auto=format&fit=crop&w=640&h=480&q=82",
  "https://images.unsplash.com/photo-1595854340887-7e343b91614b?auto=format&fit=crop&w=640&h=480&q=82",
  "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=640&h=480&q=82",
  pexelsPhoto(1656666),
  pexelsPhoto(4050074),
];

const BASIL_LOCAL = [
  "../assets/images/Basil/Basil (1).jpeg",
  "../assets/images/Basil/Basil (2).jpeg",
  "../assets/images/Basil/Basil (3).jpeg",
  "../assets/images/Basil/Basil (4).jpeg",
  "../assets/images/Basil/Basil (5).jpeg",
];

const TARRAGON_LOCAL = [
  "../assets/images/Tarragon/Tarragon (1).jpeg",
  "../assets/images/Tarragon/Tarragon (2).jpeg",
  "../assets/images/Tarragon/Tarragon (3).jpeg",
  "../assets/images/Tarragon/Tarragon (4).jpeg",
  "../assets/images/Tarragon/Tarragon (5).jpeg",
  "../assets/images/Tarragon/Tarragon (6).jpeg",
  "../assets/images/Tarragon/Tarragon (7).jpeg",
];

const MANGOLD_LOCAL = [
  "../assets/images/Mangold/Mangold (1).JPG",
  "../assets/images/Mangold/Mangold (2).JPG",
  "../assets/images/Mangold/Mangold (3).JPG",
  "../assets/images/Mangold/Mangold (4).JPG",
  "../assets/images/Mangold/Mangold (5).JPG",
  "../assets/images/Mangold/Mangold (6).JPG",
  "../assets/images/Mangold/Mangold (7).JPG",
  "../assets/images/Mangold/Mangold (8).JPG",
  "../assets/images/Mangold/Mangold (9).JPG",
  "../assets/images/Mangold/Mangold (10).JPG",
  "../assets/images/Mangold/Mangold (11).JPG",
  "../assets/images/Mangold/Mangold (12).JPG",
];

function stableIndex(str, mod) {
  let h = 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return mod ? h % mod : 0;
}

function poolForText(name, category) {
  const t = `${name} ${category}`.toLowerCase();
  if (/\bbasil\b/.test(t)) return BASIL_LOCAL;
  if (/\btarragon\b/.test(t)) return TARRAGON_LOCAL;
  if (/\bmangold\b|\bchard\b/.test(t)) return MANGOLD_LOCAL;
  if (
    /(flower|bouquet|rose|sunflower|peony|tulip|dahlia|bloom|cut\s*flower|wedding)/.test(
      t
    )
  ) {
    return FLOWERS;
  }
  if (
    /(micro|sprout|shoot|pea\s*tendril|radish|r-|tray|green|herb|vegetable|salad|leaf)/.test(
      t
    )
  ) {
    return MICRO;
  }
  return OTHER;
}

/**
 * @param {{ id?: number, product_id?: number, productId?: number, name?: string, category?: string, imageUrl?: string, image_url?: string, image?: string }} p
 */
export function productImageUrl(p) {
  const explicit = p.imageUrl || p.image_url || p.image;
  if (explicit && typeof explicit === "string") return explicit;
  const id = String(p.id ?? p.product_id ?? p.productId ?? "");
  const name = String(p.name || "");
  const cat = String(p.category || "");
  const pool = poolForText(name, cat);
  const idx = stableIndex(id || `${name}|${cat}`, pool.length);
  return pool[idx];
}

/** Cart / favourite row without full product shape */
export function lineImageUrl(line) {
  return productImageUrl({
    id: line.productId,
    name: line.name,
    category: line.category,
  });
}

/** Shown when the gateway has no products or is unreachable — UI preview only */
export const DEMO_CATALOG = [
  {
    id: 9001,
    name: "Sunflower micro shoots",
    category: "Microgreens",
    price: 6.5,
    stock: 14,
  },
  {
    id: 9002,
    name: "Pea tendrils tray",
    category: "Microgreens",
    price: 7.25,
    stock: 9,
  },
  {
    id: 9003,
    name: "Mixed edible flowers",
    category: "Flowers",
    price: 12,
    stock: 22,
  },
  {
    id: 9004,
    name: "Radish sprouts",
    category: "Microgreens",
    price: 5.5,
    stock: 18,
  },
  {
    id: 9005,
    name: "Seasonal bouquet (small)",
    category: "Flowers",
    price: 24,
    stock: 6,
  },
  {
    id: 9006,
    name: "Baby herb mix",
    category: "Herbs",
    price: 8,
    stock: 11,
  },
  {
    id: 9007,
    name: "Genovese basil living pot",
    category: "Herbs",
    price: 5.25,
    stock: 24,
  },
  {
    id: 9008,
    name: "Arugula roquette tray",
    category: "Microgreens",
    price: 6,
    stock: 17,
  },
];
