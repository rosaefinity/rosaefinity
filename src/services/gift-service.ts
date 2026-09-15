// ═══════════════════════════════════════════════
// TikTok Gift Service
// ═══════════════════════════════════════════════

export interface TikTokGift {
  name: string;
  coins: number;
  image: string;       // StreamToEarn direct image
  cdnImage: string;    // TikTok CDN fallback
  imageHash?: string;
  giftId?: string;
}

const CACHE_KEY = "rf_tiktok_gifts";
const CACHE_TIME_KEY = "rf_tiktok_gifts_time";

// ─── EMOJI MAP ──────────────────────────────
const EMOJI: Record<string, string> = {
  rose:"🌹",lion:"🦁",heart:"❤️",love:"🥰",gg:"👍",tiktok:"📱",
  galaxy:"🌌",swan:"🦢",train:"🚂",cake:"🎂",confetti:"🎊",
  perfume:"🧴",corgi:"🐕",whale:"🐋",jets:"✈️",chicken:"🍗",
  "ice cream":"🍦",bouquet:"💐",cap:"🧢",necklace:"📿",gold:"🥇",
  team:"👥",doughnut:"🍩",interstellar:"🚀",money:"💰",amazing:"🌟",
  awesome:"😎",birthday:"🎉",community:"🎪",boxing:"🥊",hands:"🤲",
  finger:"👉",friendship:"🤝",pump:"💪",flying:"✈️",coffee:"☕",
  crown:"👑",sunglass:"😎",jersey:"👕",
};

export function getGiftEmoji(name: string): string {
  if (!name) return "🎁";
  const n = name.toLowerCase();
  for (const [k, v] of Object.entries(EMOJI)) if (n.includes(k)) return v;
  return "🎁";
}

// ─── FALLBACK GIFTS ─────────────────────────
// Image format: https://streamtoearn.io/assets/img/gifts/{slug}.png
function img(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
  return `https://streamtoearn.io/assets/img/gifts/${slug}.png`;
}
// CDN giftId-based URLs are broken (TikTok uses hash-based filenames)
// The cdnImage field in FALLBACK_GIFTS is no longer used for image resolution
// Images come from the StreamToEarn catalog (hash-based URLs) or SVG fallback
function cdn(_id: string): string {
  return ''; // giftId-based CDN URLs do not work
}

const FALLBACK_GIFTS: TikTokGift[] = [
  { name:"Rose", coins:1, image:img("Rose"), cdnImage:cdn("5655"), giftId:"5655" },
  { name:"Heart Me", coins:1, image:img("Heart Me"), cdnImage:cdn("7934"), giftId:"7934" },
  { name:"You're awesome", coins:1, image:img("You're awesome"), cdnImage:cdn("6371"), giftId:"6371" },
  { name:"GG", coins:1, image:img("GG"), cdnImage:cdn("12912"), giftId:"12912" },
  { name:"TikTok", coins:1, image:img("TikTok"), cdnImage:cdn("12913"), giftId:"12913" },
  { name:"Doughnut", coins:1, image:img("Doughnut"), cdnImage:cdn("12914"), giftId:"12914" },
  { name:"Pumped Up", coins:1, image:img("Pumped Up"), cdnImage:cdn("12911"), giftId:"12911" },
  { name:"Pumpkin", coins:9, image:img("Pumpkin"), cdnImage:"", giftId:"" },
  { name:"Team Bracelet", coins:9, image:img("Team Bracelet"), cdnImage:cdn("12937"), giftId:"12937" },
  { name:"Friendship Necklace", coins:19, image:img("Friendship Necklace"), cdnImage:cdn("12935"), giftId:"12935" },
  { name:"Hi Bear", coins:19, image:img("Hi Bear"), cdnImage:"", giftId:"" },
  { name:"Gold necklace", coins:19, image:img("Gold necklace"), cdnImage:cdn("12936"), giftId:"12936" },
  { name:"Finger Heart", coins:29, image:img("Finger Heart"), cdnImage:"", giftId:"" },
  { name:"Cap", coins:29, image:img("Cap"), cdnImage:cdn("12933"), giftId:"12933" },
  { name:"Chicken and Cola", coins:29, image:img("Chicken and Cola"), cdnImage:cdn("12934"), giftId:"12934" },
  { name:"Ice Cream Cone", coins:99, image:img("Ice Cream Cone"), cdnImage:cdn("12931"), giftId:"12931" },
  { name:"Bouquet", coins:99, image:img("Bouquet"), cdnImage:cdn("12932"), giftId:"12932" },
  { name:"Nasi Lemak", coins:99, image:img("Nasi Lemak"), cdnImage:"", giftId:"" },
  { name:"Orange Juice", coins:99, image:img("Orange Juice"), cdnImage:"", giftId:"" },
  { name:"Rosa", coins:99, image:img("Rosa"), cdnImage:"", giftId:"" },
  { name:"I love you", coins:99, image:img("I love you"), cdnImage:"", giftId:"" },
  { name:"Little Crown", coins:99, image:img("Little Crown"), cdnImage:"", giftId:"" },
  { name:"Bouquet Flower", coins:199, image:img("Bouquet Flower"), cdnImage:cdn("13862"), giftId:"13862" },
  { name:"Community Fest", coins:199, image:img("Community Fest"), cdnImage:cdn("12930"), giftId:"12930" },
  { name:"Hand Hearts", coins:299, image:img("Hand Hearts"), cdnImage:cdn("12929"), giftId:"12929" },
  { name:"Boxing Gloves", coins:599, image:img("Boxing Gloves"), cdnImage:cdn("12928"), giftId:"12928" },
  { name:"Corgi", coins:999, image:img("Corgi"), cdnImage:cdn("12926"), giftId:"12926" },
  { name:"Whale Diving", coins:999, image:img("Whale Diving"), cdnImage:cdn("12927"), giftId:"12927" },
  { name:"Flying Jets", coins:1499, image:img("Flying Jets"), cdnImage:cdn("12925"), giftId:"12925" },
  { name:"Confetti", coins:1999, image:img("Confetti"), cdnImage:cdn("12923"), giftId:"12923" },
  { name:"Perfume", coins:1999, image:img("Perfume"), cdnImage:cdn("12924"), giftId:"12924" },
  { name:"You're Amazing", coins:2999, image:img("You're Amazing"), cdnImage:cdn("12922"), giftId:"12922" },
  { name:"Birthday Cake", coins:5999, image:img("Birthday Cake"), cdnImage:cdn("12921"), giftId:"12921" },
  { name:"Train", coins:6999, image:img("Train"), cdnImage:cdn("12920"), giftId:"12920" },
  { name:"Swan", coins:9999, image:img("Swan"), cdnImage:cdn("12919"), giftId:"12919" },
  { name:"Money Gun", coins:9999, image:img("Money Gun"), cdnImage:cdn("12918"), giftId:"12918" },
  { name:"Galaxy", coins:19999, image:img("Galaxy"), cdnImage:cdn("12917"), giftId:"12917" },
  { name:"Lion", coins:29999, image:img("Lion"), cdnImage:cdn("12915"), giftId:"12915" },
  { name:"Interstellar", coins:29999, image:img("Interstellar"), cdnImage:cdn("12916"), giftId:"12916" },
];

// ─── CACHE ────────────────────────────────
function loadCached(): TikTokGift[] | null {
  try { const c = localStorage.getItem(CACHE_KEY); return c ? JSON.parse(c) : null; } catch { return null; }
}
function saveCache(g: TikTokGift[]) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(g)); localStorage.setItem(CACHE_TIME_KEY, String(Date.now())); } catch {}
}

// ─── FETCH dari StreamToEarn ──────────────
export async function fetchGifts(): Promise<TikTokGift[]> {
  // Coba direct + via corsproxy.io
  const attempts = [
    "https://streamtoearn.io/id/gifts?region=ID",
    `https://corsproxy.io/?${encodeURIComponent("https://streamtoearn.io/id/gifts?region=ID")}`,
  ];
  for (const url of attempts) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const parsed = parse(html);
      if (parsed.length > 0) {
        // If parser returned fewer gifts than our fallback list, the parse is
        // incomplete (likely a changed HTML structure). Merge parsed entries into
        // FALLBACK_GIFTS so we never lose known gifts. Parsed entries win on
        // image URLs since they carry real StreamToEarn CDN hashes.
        if (parsed.length < FALLBACK_GIFTS.length) {
          console.warn('[GIFT-SERVICE] Parsed catalog incomplete:', parsed.length, '< fallback:', FALLBACK_GIFTS.length, '- merging');
          const merged = new Map<string, TikTokGift>();
          // Start with fallback as the base (guarantees all known gifts)
          for (const g of FALLBACK_GIFTS) merged.set(g.name.toLowerCase().trim(), g);
          // Overlay parsed entries (they have real image URLs)
          for (const g of parsed) merged.set(g.name.toLowerCase().trim(), g);
          const result = Array.from(merged.values());
          saveCache(result);
          return result;
        }
        saveCache(parsed);
        return parsed;
      }
    } catch {}
  }
  const cached = loadCached();
  return cached || FALLBACK_GIFTS;
}

// ─── PARSE HTML ───────────────────────────
function parse(html: string): TikTokGift[] {
  const gifts: TikTokGift[] = [];
  const seen = new Set<string>();
  const regex = /<div\s+class="gift"[\s\S]*?<\/div>/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    const b = m[0];
    const src = b.match(/src="([^"]+)"/)?.[1] || "";
    const alt = b.match(/alt="([^"]+)"/)?.[1]?.replace(/\s+TikTok\s+gift$/i,"").trim() || "";
    const name = alt || b.match(/<p\s+class="gift-name">([^<]+)<\/p>/)?.[1]?.trim() || "";
    const coins = parseInt(b.match(/<p\s+class="gift-price">(\d+)/)?.[1] || "0");
    if (name && coins > 0 && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      const image = src.startsWith("http") ? src : `https://streamtoearn.io${src}`;
      gifts.push({ name, coins, image, cdnImage: "", giftId: "", imageHash: "" });
    }
  }
  return gifts;
}

// ─── GET IMAGE URL ──────────────────────
// Priority: cdnImage > image field (any valid HTTP URL)
// The catalog (parsed from StreamToEarn HTML) contains real gift image URLs.
// Previously these were incorrectly filtered out.
export function getGiftImageUrl(gift: TikTokGift): string {
  if (gift.cdnImage) return gift.cdnImage;                        // TikTok CDN if available
  if (gift.image?.startsWith("http")) {
    return gift.image;                                            // Catalog image URL
  }
  return "";
}

// ─── AMBIL GIFT ─────────────────────────
let cache: TikTokGift[] = [];
let loaded = false;

export async function getGifts(force = false): Promise<TikTokGift[]> {
  if (loaded && !force) return cache;
  let gifts = await fetchGifts();
  if (!gifts?.length) gifts = FALLBACK_GIFTS;
  const seen = new Set<string>();
  const unique: TikTokGift[] = [];
  gifts.forEach(g => { const k = g.name.toLowerCase().trim(); if (!seen.has(k)) { seen.add(k); unique.push(g); } });
  cache = unique; loaded = true;

  const withImages = unique.filter(g => Boolean(getGiftImageUrl(g)));
  console.log('[GIFT-SERVICE] Catalog loaded:', {
    count: unique.length,
    withImages: withImages.length,
    hasHandHearts: unique.some(g => g.name.toLowerCase() === 'hand hearts'),
    sampleNames: unique.slice(0, 5).map(g => g.name),
  });

  // Populate image cache from catalog
  for (const g of unique) {
    const url = getGiftImageUrl(g);
    if (url) cacheGiftImage(g.giftId || '', g.name, url);
  }
  return unique;
}

// Synchronous access to the gift catalog (returns null if not yet loaded)
export function getGiftsSync(): TikTokGift[] | null {
  return loaded && cache.length > 0 ? cache : null;
}

export function searchGifts(gifts: TikTokGift[], kw: string): TikTokGift[] {
  const q = kw.toLowerCase().trim();
  if (!q) return gifts;
  return gifts.filter(g => g.name.toLowerCase().includes(q) || String(g.coins).includes(q));
}

// Load cache at startup — but reject incomplete caches (fewer entries than
// FALLBACK_GIFTS means the cache was populated by a partial parser result)
const c = loadCached();
if (c && c.length >= FALLBACK_GIFTS.length) {
  cache = c;
  loaded = true;
} else if (c) {
  // Stale/incomplete cache — clear it so getGifts() will re-fetch + merge
  console.warn('[GIFT-SERVICE] Stale cache rejected:', c.length, '< fallback:', FALLBACK_GIFTS.length);
  try { localStorage.removeItem(CACHE_KEY); localStorage.removeItem(CACHE_TIME_KEY); } catch {}
}

// ─── SHARED CATALOG PRELOAD ────────────────────────────
// One shared promise, reused by all callers. Prevents duplicate fetches.
let catalogPreloadPromise: Promise<boolean> | null = null;

/** Start catalog preload if not already running. Returns the shared promise. */
export function preloadGiftCatalog(): Promise<boolean> {
  if (catalogPreloadPromise) return catalogPreloadPromise;
  if (loaded) { catalogPreloadPromise = Promise.resolve(true); return catalogPreloadPromise; }
  catalogPreloadPromise = (async () => {
    try {
      await getGifts();
      return true;
    } catch {
      return false;
    }
  })();
  return catalogPreloadPromise;
}

/**
 * Wait for the catalog preload to complete, with a bounded timeout.
 * Returns true if catalog loaded, false on timeout.
 * If catalog is already loaded, returns immediately.
 */
export function waitForCatalog(timeoutMs: number = 3000): Promise<boolean> {
  if (loaded) return Promise.resolve(true);
  const promise = preloadGiftCatalog();
  return Promise.race([
    promise,
    new Promise<boolean>(resolve => setTimeout(() => resolve(false), timeoutMs)),
  ]);
}

/** Check if catalog is synchronously available */
export function isCatalogLoaded(): boolean {
  return loaded;
}

// ─── GIFT IMAGE CACHE ─────────────────────────────────
// Persists validated gift image URLs in localStorage.
// Keyed by giftId and giftName → CDN image URL.
// Only URLs that successfully loaded are cached.

const IMAGE_CACHE_KEY = 'rf_gift_image_urls';
const IMAGE_INVALID_KEY = 'rf_gift_image_invalid';

type ImageCache = Record<string, string>; // giftId|giftName → url
type InvalidSet = Record<string, number>; // url → timestamp of failure

function loadImageCache(): ImageCache {
  try { return JSON.parse(localStorage.getItem(IMAGE_CACHE_KEY) || '{}'); } catch { return {}; }
}
function saveImageCache(c: ImageCache) {
  try { localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(c)); } catch {}
}
function loadInvalidSet(): InvalidSet {
  try { return JSON.parse(localStorage.getItem(IMAGE_INVALID_KEY) || '{}'); } catch { return {}; }
}
function saveInvalidSet(s: InvalidSet) {
  try { localStorage.setItem(IMAGE_INVALID_KEY, JSON.stringify(s)); } catch {}
}

const INVALID_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Cache a validated image URL for a gift */
export function cacheGiftImage(giftId: string, giftName: string, url: string): void {
  if (!url || !giftId && !giftName) return;
  const c = loadImageCache();
  if (giftId) c[`id:${giftId}`] = url;
  if (giftName) c[`name:${giftName.toLowerCase().trim()}`] = url;
  saveImageCache(c);
  // Remove from invalid set if it was there
  const inv = loadInvalidSet();
  if (inv[url]) { delete inv[url]; saveInvalidSet(inv); }
}

/** Mark an image URL as invalid (failed to load) */
export function invalidateGiftImage(url: string): void {
  if (!url) return;
  const inv = loadInvalidSet();
  inv[url] = Date.now();
  saveInvalidSet(inv);
}

/** Check if a URL is known-invalid */
export function isInvalidImageUrl(url: string): boolean {
  if (!url) return false;
  const inv = loadInvalidSet();
  const ts = inv[url];
  if (!ts) return false;
  if (Date.now() - ts > INVALID_TTL_MS) { delete inv[url]; saveInvalidSet(inv); return false; }
  return true;
}

/** Look up a cached image URL for a gift */
export function getCachedGiftImage(giftId: string, giftName: string): string {
  const c = loadImageCache();
  if (giftId && c[`id:${giftId}`]) return c[`id:${giftId}`];
  if (giftName && c[`name:${giftName.toLowerCase().trim()}`]) return c[`name:${giftName.toLowerCase().trim()}`];
  return '';
}
