// ═══════════════════════════════════════════════
// TikTok Gift API - Untuk Electron & Renderer
// ═══════════════════════════════════════════════

const { fetchGiftsFromStreamToEarn, loadCachedGifts, loadFallbackGifts } = require("./gift-fetcher.cjs");

// Cache di runtime
let giftCache = [];
let cacheLoaded = false;

// ─── Muat Gift ──────────────────────────────
async function muatGiftTikTok(forceRefresh = false) {
  if (cacheLoaded && !forceRefresh) {
    console.log(`📦 Menggunakan cache gift (${giftCache.length} gift)`);
    return giftCache;
  }

  let gifts = await fetchGiftsFromStreamToEarn();

  // Jika gagal fetching atau kosong, gunakan fallback
  if (!gifts || gifts.length === 0) {
    console.log("⚠️ Menggunakan fallback gift...");
    gifts = loadFallbackGifts();
  }

  // Hapus duplikat berdasarkan nama
  const uniqueGifts = [];
  const seen = new Set();
  gifts.forEach(g => {
    const key = g.name.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueGifts.push(g);
    }
  });

  giftCache = uniqueGifts;
  cacheLoaded = true;
  console.log(`✅ ${giftCache.length} gift dimuat`);

  return giftCache;
}

// ─── Dapatkan Semua Gift ────────────────────
function getAllTikTokGifts() {
  return giftCache;
}

// ─── Cari Gift Berdasarkan Nama ─────────────
function getGiftByName(nama) {
  if (!nama) return null;
  const namaBersih = nama.toLowerCase().trim();
  return giftCache.find(
    g => g.name.toLowerCase().trim() === namaBersih
  ) || giftCache.find(
    g => g.name.toLowerCase().includes(namaBersih)
  ) || null;
}

// ─── Cari Gift Berdasarkan ID ───────────────
function getGiftById(id) {
  if (!id) return null;
  return giftCache.find(g => g.giftId === String(id)) || null;
}

// ─── Format Gift untuk Dropdown ─────────────
function formatGiftDropdown(gift) {
  const emojiMap = {
    'rose': '🌹', 'lion': '🦁', 'heart': '❤️', 'love': '🥰',
    'gg': '👍', 'tiktok': '📱', 'money': '💰', 'galaxy': '🌌',
    'swan': '🦢', 'train': '🚂', 'cake': '🎂', 'amazing': '🌟',
    'confetti': '🎊', 'perfume': '🧴', 'jets': '✈️', 'corgi': '🐕',
    'whale': '🐋', 'boxing': '🥊', 'hands': '🤲', 'ice': '🍦',
    'bouquet': '💐', 'cap': '🧢', 'chicken': '🍗', 'cola': '🥤',
    'necklace': '📿', 'gold': '🥇', 'team': '👥', 'bracelet': '📿',
    'doughnut': '🍩', 'pump': '💪', 'awesome': '😎', 'birthday': '🎉',
    'fl flying': '✈️', 'community': '🎪', 'interstellar': '🚀',
    'finger': '👉', 'friendship': '🤝', 'heart me': '💖',
    'love you': '💗', 'you\'re': '🌟', 'you are': '🌟',
  };

  let emoji = '🎁';
  const nameLower = gift.name.toLowerCase();
  for (const [key, val] of Object.entries(emojiMap)) {
    if (nameLower.includes(key)) { emoji = val; break; }
  }

  return {
    html: `${emoji} ${gift.name} (${gift.coins} Coin)`,
    text: `${gift.name}`,
    coins: gift.coins,
    image: gift.image,
    emoji: emoji,
  };
}

// ─── Sinkronisasi Gift dari Event TikTok ────
function cocokkanGiftEvent(data) {
  // Coba cocokkan dari giftName
  const giftName = data.giftName || data.gift?.name || '';
  const giftId = data.giftId || data.gift?.id || '';

  if (giftId) {
    const byId = getGiftById(giftId);
    if (byId) return byId;
  }

  if (giftName) {
    const byName = getGiftByName(giftName);
    if (byName) return byName;
  }

  // Fallback: return object dengan data yang ada
  return {
    name: giftName || 'Unknown',
    coins: data.diamondCount || data.coins || 0,
    image: data.giftImage || data.image || '',
    giftId: String(giftId),
  };
}

module.exports = {
  muatGiftTikTok,
  getAllTikTokGifts,
  getGiftByName,
  getGiftById,
  formatGiftDropdown,
  cocokkanGiftEvent,
};
