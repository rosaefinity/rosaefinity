import type { FilterTab, Notification } from "../types";
// eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars
type Overlay = any;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const overlayImages = [
  "https://images.unsplash.com/photo-1536240478700-b869070f9279?w=400&h=225&fit=crop",
  "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&h=225&fit=crop",
  "https://images.unsplash.com/photo-1557683316-973673baf926?w=400&h=225&fit=crop",
  "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=225&fit=crop",
  "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&h=225&fit=crop",
  "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&h=225&fit=crop",
  "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=225&fit=crop",
  "https://images.unsplash.com/photo-1552820728-8b83bb6b6414?w=400&h=225&fit=crop",
  "https://images.unsplash.com/photo-1560415755-bd80d06eda59?w=400&h=225&fit=crop",
  "https://images.unsplash.com/photo-1551033406-611cf9a28f67?w=400&h=225&fit=crop",
  "https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=400&h=225&fit=crop",
  "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&h=225&fit=crop",
  "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=225&fit=crop",
  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=225&fit=crop",
  "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&h=225&fit=crop",
  "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=400&h=225&fit=crop",
];

const overlayNames = [
  "Gift Rain Deluxe", "Stream Goal Pro", "Follower Milestone",
  "Subscriber Alert", "Donation Goal Bar", "Chat Rainbow",
  "Battle Arena", "Spin The Wheel", "Like Explosion",
  "Share Toast", "Join Party", "Leaderboard Elite",
  "TikTok Shop Alert", "Countdown Timer", "Sound Wave Visualizer",
  "World Cup Bracket",
];

const descriptions = [
  "Animated gift overlay with particle effects and real-time leaderboard",
  "Track streaming goals with elegant progress bar and milestone celebrations",
  "Celebrate new followers with animated confetti and personalized messages",
  "Eye-catching subscriber alert with custom animations and sound effects",
  "Interactive donation goal tracker with live progress updates",
  "Colorful chat overlay that reacts to messages with vibrant animations",
  "Head-to-head battle overlay for competitive streaming sessions",
  "Interactive lucky wheel for viewer engagement and rewards",
  "Animated like burst effect with customizable particle systems",
  "Smooth share notification overlay with elegant transitions",
  "Welcome animation for new viewers joining your stream",
  "Real-time leaderboard showing top supporters and contributors",
  "Product showcase overlay for TikTok Shop integration",
  "Versatile countdown timer for streams, breaks, and events",
  "Audio-reactive visualizer that dances to your stream music",
  "Tournament bracket overlay for competitive events",
];

export const filterTabs: FilterTab[] = [
  { id: "all", label: "All", icon: "layout-grid" },
  { id: "gift", label: "Gift", icon: "gift" },
  { id: "alert", label: "Alert", icon: "bell" },
  { id: "goal", label: "Goal", icon: "target" },
  { id: "game", label: "Game", icon: "gamepad-2" },
  { id: "interactive", label: "Interactive", icon: "sparkles" },
  { id: "sports", label: "Sports", icon: "trophy" },
  { id: "music", label: "Music", icon: "music" },
  { id: "trending", label: "Trending", icon: "trending-up" },
  { id: "premium", label: "Premium", icon: "crown" },
  { id: "favorite", label: "Favorites", icon: "star" },
];

const categories: Array<{ id: Overlay["category"]; tags: string[] }> = [
  { id: "gift", tags: ["gift", "donation"] },
  { id: "goal", tags: ["goal", "progress"] },
  { id: "alert", tags: ["follower", "alert"] },
  { id: "alert", tags: ["subscriber", "premium"] },
  { id: "goal", tags: ["donation", "progress"] },
  { id: "interactive", tags: ["chat", "interactive"] },
  { id: "game", tags: ["battle", "competition"] },
  { id: "game", tags: ["wheel", "interactive"] },
  { id: "alert", tags: ["like", "animation"] },
  { id: "alert", tags: ["share", "notification"] },
  { id: "alert", tags: ["join", "welcome"] },
  { id: "sports", tags: ["leaderboard", "competitive"] },
  { id: "gift", tags: ["shop", "commerce"] },
  { id: "music", tags: ["timer", "utility"] },
  { id: "music", tags: ["music", "visualizer"] },
  { id: "sports", tags: ["sports", "tournament"] },
];

function generateOverlays(): Overlay[] {
  return overlayNames.map((name, i) => ({
    id: `overlay-${i + 1}`,
    name,
    description: descriptions[i],
    thumbnail: overlayImages[i % overlayImages.length],
    category: categories[i].id,
    tags: categories[i].tags,
    isPremium: i % 3 === 0,
    isNew: i < 3,
    isPopular: i >= 4 && i <= 8,
    isActive: i % 4 === 0,
    isFavorite: false,
    createdAt: new Date(Date.now() - Math.random() * 90 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
    previewUrl: `/api/preview/${i + 1}`,
    config: {
      theme: "dark",
      primaryColor: "#7C3AED",
      secondaryColor: "#EC4899",
      transparency: 0.9,
      scale: 1,
      borderRadius: 12,
      animationSpeed: "normal",
    },
  }));
}

export async function fetchOverlays(category: Overlay["category"] = "all"): Promise<Overlay[]> {
  await delay(200);
  const all = generateOverlays();
  if (category === "all") return all;
  if (category === "favorite") return all.filter((o) => o.isFavorite);
  if (category === "premium") return all.filter((o) => o.isPremium);
  if (category === "trending") return all.filter((o) => o.isPopular);
  return all.filter((o) => o.category === category);
}

export async function fetchNotifications(): Promise<Notification[]> {
  await delay(150);
  return [
    { id: "n1", title: "New overlay available", message: "World Cup Bracket is now available", type: "info", read: false, createdAt: new Date(Date.now() - 3600000).toISOString() },
    { id: "n2", title: "Pro trial ending soon", message: "Your 14-day Pro trial expires in 3 days", type: "warning", read: false, createdAt: new Date(Date.now() - 7200000).toISOString() },
    { id: "n3", title: "Overlay published", message: "Gift Rain Deluxe is now live on your stream", type: "success", read: true, createdAt: new Date(Date.now() - 86400000).toISOString() },
  ];
}
