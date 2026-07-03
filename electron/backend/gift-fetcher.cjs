// ═══════════════════════════════════════════════
// TikTok Gift Fetcher - StreamToEarn
// ═══════════════════════════════════════════════

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const CACHE_PATH = path.join(__dirname, "data", "tiktok-gifts.json");
const FALLBACK_PATH = path.join(__dirname, "data", "tiktok-gifts-fallback.json");

// ─── Cache Gift ────────────────────────────
function cacheGiftList(gifts) {
  try {
    const dir = path.dirname(CACHE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(gifts, null, 2), "utf-8");
    console.log(`✅ Gift berhasil diperbarui: ${gifts.length} gift`);
  } catch (e) {
    console.error("❌ Gagal menyimpan cache gift:", e.message);
  }
}

// ─── Load Cache ────────────────────────────
function loadCachedGifts() {
  try {
    if (fs.existsSync(CACHE_PATH)) {
      const data = fs.readFileSync(CACHE_PATH, "utf-8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("❌ Gagal membaca cache gift:", e.message);
  }
  return null;
}

// ─── Load Fallback ─────────────────────────
function loadFallbackGifts() {
  try {
    if (fs.existsSync(FALLBACK_PATH)) {
      const data = fs.readFileSync(FALLBACK_PATH, "utf-8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("❌ Gagal membaca fallback gift:", e.message);
  }
  // Return minimal fallback
  return [
    { name: "Rose", coins: 1, image: "", giftId: "5655" },
    { name: "You're awesome", coins: 1, image: "", giftId: "6371" },
    { name: "Love you so much", coins: 1, image: "", giftId: "6373" },
    { name: "Heart Me", coins: 1, image: "", giftId: "7934" },
    { name: "Lion", coins: 29999, image: "", giftId: "12915" },
  ];
}

// ─── Ambil Gift dari StreamToEarn ──────────
function fetchGiftsFromStreamToEarn() {
  return new Promise((resolve) => {
    console.log("📦 Memuat daftar gift TikTok dari StreamToEarn...");

    const url = "streamtoearn.io";
    const pathname = "/id/gifts?region=ID";
    const options = {
      hostname: url,
      path: pathname,
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/json,*/*",
        "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
      },
    };

    const req = https.get(options, (res) => {
      let body = "";

      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        try {
          const gifts = parseGiftsFromHTML(body);
          if (gifts && gifts.length > 0) {
            cacheGiftList(gifts);
            resolve(gifts);
          } else {
            console.log("⚠️ Tidak ada gift ditemukan, menggunakan cache...");
            resolve(loadCachedGifts() || loadFallbackGifts());
          }
        } catch (e) {
          console.error("❌ Gagal parse gift:", e.message);
          resolve(loadCachedGifts() || loadFallbackGifts());
        }
      });
    });

    req.on("error", (err) => {
      console.error("❌ Gagal mengambil data gift:", err.message);
      console.log("📂 Menggunakan cache lokal...");
      resolve(loadCachedGifts() || loadFallbackGifts());
    });

    req.setTimeout(10000, () => {
      req.destroy();
      console.log("⏱️ Timeout mengambil data gift, menggunakan cache...");
      resolve(loadCachedGifts() || loadFallbackGifts());
    });
  });
}

// ─── Parse HTML dari StreamToEarn ──────────
function parseGiftsFromHTML(html) {
  const gifts = [];
  const uniqueNames = new Set();
  let extractedCount = 0;

  // StreamToEarn uses a simple HTML structure:
  // <div class="gift" data-price="lt10">
  //   <img src="URL" alt="NAME TikTok gift">
  //   <p class="gift-name">NAME</p>
  //   <p class="gift-price">COINS <img ...></p>
  // </div>

  // Extract each gift block
  const giftBlockRegex = /<div\s+class="gift"\s+data-price="[^"]*">\s*([\s\S]*?)<\/div>\s*(?=<div\s+class="gift"|$)/gi;
  let blockMatch;

  while ((blockMatch = giftBlockRegex.exec(html)) !== null) {
    extractedCount++;
    const block = blockMatch[1];

    // Extract image URL
    const imgMatch = block.match(/src="([^"]+)"/);
    const image = imgMatch ? imgMatch[1].trim() : '';

    // Extract name from alt attribute (alt="NAME TikTok gift")
    const altMatch = block.match(/alt="([^"]+)"/);
    let name = '';
    if (altMatch) {
      // Alt format is "NAME TikTok gift"
      name = altMatch[1].replace(/\s+TikTok\s+gift$/i, '').trim();
    }
    if (!name) {
      // Fallback: get from gift-name class
      const nameMatch = block.match(/<p\s+class="gift-name">([^<]+)<\/p>/);
      if (nameMatch) name = nameMatch[1].trim();
    }
    if (!name) continue;

    // Extract coin price from gift-price class
    const priceMatch = block.match(/<p\s+class="gift-price">(\d+)\s*</);
    let coins = 0;
    if (priceMatch) {
      coins = parseInt(priceMatch[1]);
    }

    // Clean up name - remove "TikTok gift" suffix if present
    const cleanName = name.replace(/\s+TikTok\s+gift$/i, '').trim();

    if (cleanName && coins > 0 && !uniqueNames.has(cleanName.toLowerCase())) {
      uniqueNames.add(cleanName.toLowerCase());
      gifts.push({ name: cleanName, coins, image, imageHash: '', giftId: '' });
    }
  }

  if (gifts.length === 0 && extractedCount > 0) {
    console.log(`⚠️ Gagal parse ${extractedCount} block gift, regex mismatch`);
  }

  // Alternative regex if main one fails
  if (gifts.length === 0) {
    console.log("⚠️ Mencoba alternatif regex...");

    // Simpler approach: find all gift blocks with alt text containing numbers
    const simpleRegex = /<div\s+class="gift">[\s\S]*?src="([^"]+)"[\s\S]*?alt="([^"]+)"[\s\S]*?gift-price">(\d+)/gi;
    let simpleMatch;
    while ((simpleMatch = simpleRegex.exec(html)) !== null) {
      const image = simpleMatch[1].trim();
      let name = simpleMatch[2].replace(/\s+TikTok\s+gift$/i, '').trim();
      const coins = parseInt(simpleMatch[3]);

      if (name && coins > 0 && !uniqueNames.has(name.toLowerCase())) {
        uniqueNames.add(name.toLowerCase());
        gifts.push({ name, coins, image, imageHash: '', giftId: '' });
      }
    }
  }

  console.log(`📦 Berhasil mengekstrak ${gifts.length} gift dari ${extractedCount} block`);
  return gifts;
}

function extractBetween(text, start, end) {
  const idx = text.indexOf(start);
  if (idx === -1) return '';
  const startIdx = idx + start.length;
  const endIdx = text.indexOf(end, startIdx);
  if (endIdx === -1) return '';
  return text.substring(startIdx, endIdx);
}

function extractGiftsFromState(state) {
  const gifts = [];
  try {
    // Traverse object recursively to find gift arrays
    function traverse(obj, depth = 0) {
      if (depth > 5) return;
      if (Array.isArray(obj)) {
        if (obj.length > 0 && obj[0] && obj[0].name && obj[0].coins !== undefined) {
          obj.forEach(item => {
            if (item.name && item.coins !== undefined) {
              gifts.push({
                name: item.name,
                coins: item.coins,
                image: item.image || item.icon || item.picture || '',
                giftId: String(item.giftId || item.id || ''),
              });
            }
          });
          return;
        }
        obj.forEach(item => traverse(item, depth + 1));
      } else if (obj && typeof obj === 'object') {
        Object.values(obj).forEach(val => traverse(val, depth + 1));
      }
    }
    traverse(state);
  } catch (e) { /* ignore */ }
  return gifts;
}

// ─── Ekspor Fungsi ─────────────────────────
module.exports = {
  fetchGiftsFromStreamToEarn,
  loadCachedGifts,
  loadFallbackGifts,
  cacheGiftList,
};
