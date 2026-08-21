import type { FilterTab, Notification } from "../types";
import { getOverlayModules, getOverlaysByCategory } from "../overlays/registry";
import type { AnyOverlayModule } from "../overlays/types";

// eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars
type Overlay = any;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Convert registry module to API overlay format
function moduleToOverlay(mod: AnyOverlayModule): Overlay {
  return {
    id: mod.id,
    name: mod.name,
    description: mod.description,
    thumbnail: mod.thumbnail || "https://images.unsplash.com/photo-1536240478700-b869070f9279?w=400&h=225&fit=crop",
    category: mod.category,
    tags: mod.tags,
    isPremium: false,
    isNew: false,
    isPopular: false,
    isActive: false,
    isFavorite: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    previewUrl: `/api/preview/${mod.id}`,
    config: mod.defaultConfig || {},
  };
}

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

export async function fetchOverlays(category: Overlay["category"] = "all"): Promise<Overlay[]> {
  await delay(200);

  // Get modules from registry
  let modules: readonly AnyOverlayModule[];
  if (category === "all") {
    modules = getOverlayModules();
  } else {
    modules = getOverlaysByCategory(category);
  }

  // If no modules in registry, fall back to empty array
  if (modules.length === 0) {
    return [];
  }

  return modules.map(moduleToOverlay);
}

export async function fetchNotifications(): Promise<Notification[]> {
  await delay(150);
  return [
    { id: "n1", title: "New overlay available", message: "World Cup Bracket is now available", type: "info", read: false, createdAt: new Date(Date.now() - 3600000).toISOString() },
    { id: "n2", title: "Pro trial ending soon", message: "Your 14-day Pro trial expires in 3 days", type: "warning", read: false, createdAt: new Date(Date.now() - 7200000).toISOString() },
    { id: "n3", title: "Overlay published", message: "Gift Rain Deluxe is now live on your stream", type: "success", read: true, createdAt: new Date(Date.now() - 86400000).toISOString() },
  ];
}