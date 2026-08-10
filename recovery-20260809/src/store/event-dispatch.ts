import { useAppStore } from "./app-store";
import { sendToOverlay } from "../lib/overlay-bus";
import { getActionMedia } from "../lib/db";
import { dispatchToEventBus } from "../events/EventDispatcher";
import { api, safeInvoke } from "../services/electron-service";
import type { Action, Event, LiveEvent, ScreenId } from "../types";

const globalCooldowns: Map<string, number> = new Map();
const userCooldowns: Map<string, Map<string, number>> = new Map();

// Bounded cooldown maps â€” clear entries older than 1 hour to prevent unbounded growth
const COOLDOWN_MAX_AGE_MS = 60 * 60 * 1000;
let lastCleanupMs = 0;

function cleanupStaleCooldowns(): void {
  const now = Date.now();
  if (now - lastCleanupMs < 5 * 60 * 1000) return; // max once per 5 min
  lastCleanupMs = now;
  for (const [actionId, timestamp] of globalCooldowns) {
    if (now - timestamp > COOLDOWN_MAX_AGE_MS) globalCooldowns.delete(actionId);
  }
  for (const [actionId, userMap] of userCooldowns) {
    for (const [user, timestamp] of userMap) {
      if (now - timestamp > COOLDOWN_MAX_AGE_MS) userMap.delete(user);
    }
    if (userMap.size === 0) userCooldowns.delete(actionId);
  }
}

export function dispatchTikTokEvent(data: any) {
  if (!data) return;
  cleanupStaleCooldowns();
  const store = useAppStore.getState();
  const { events, actions, alertsMasterEnabled, alertSettings } = store;

  if (!alertsMasterEnabled) return;

  // Per-type alert toggle check
  const typeSettings = alertSettings[data.type as keyof typeof alertSettings];
  if (typeSettings && typeof typeSettings === "object" && "enabled" in typeSettings && !typeSettings.enabled) return;

  const screenId: ScreenId = data.screenId || "screen-0";

  const liveEvent: LiveEvent = {
    type: data.type,
    screenId,
    user: data.user,
    nickname: data.nickname,
    giftName: data.giftName,
    repeatCount: data.repeatCount,
    diamondCount: data.diamondCount,
    comment: data.comment,
    likeCount: data.likeCount,
    totalLikeCount: data.totalLikeCount,
    timestamp: data.timestamp || Date.now(),
  };
  store.addScreenLiveEvent(screenId, liveEvent);

  // Update per-screen stats
  switch (data.type) {
    case "gift": store.incrementScreenStat(screenId, "gifts"); break;
    case "like": store.incrementScreenStat(screenId, "likes"); break;
    case "follow": store.incrementScreenStat(screenId, "follows"); break;
    case "subscribe": store.incrementScreenStat(screenId, "follows"); break;
    case "join": {
      const views = store.screenConnections[screenId]?.stats.views || 0;
      store.setScreenStats(screenId, { views: views + 1 });
      break;
    }
  }

  // Find matching events and execute actions
  const matchingEvents = events.filter(e => e.enabled && matchesTrigger(e, data));
  for (const evt of matchingEvents) {
    const action = actions.find(a => a.name === evt.actionName && a.enabled);
    if (!action) continue;

    if (action.globalCooldown && action.globalCooldown > 0) {
      const lastGlobal = globalCooldowns.get(action.id) || 0;
      if (Date.now() - lastGlobal < action.globalCooldown * 1000) continue;
    }
    if (action.userCooldown && action.userCooldown > 0) {
      const userMap = userCooldowns.get(action.id) || new Map();
      const lastUser = userMap.get(data.user) || 0;
      if (Date.now() - lastUser < action.userCooldown * 1000) continue;
    }

    if (action.globalCooldown) globalCooldowns.set(action.id, Date.now());
    if (action.userCooldown) {
      if (!userCooldowns.has(action.id)) userCooldowns.set(action.id, new Map());
      userCooldowns.get(action.id)!.set(data.user, Date.now());
    }

    executeAction(action, data);
  }
}

function matchesTrigger(event: Event, data: any): boolean {
  const triggerType = event.triggerType;
  switch (triggerType) {
    case "gift": return data.type === "gift";
    case "specificgift": return data.type === "gift" && data.giftName?.toLowerCase() === event.giftName?.toLowerCase();
    case "giftcoins": return data.type === "gift" && (data.diamondCount || 0) >= (event.minCoins || 0);
    case "follow": return data.type === "follow";
    case "like": return data.type === "like" && (!event.minLikes || (data.likeCount || 0) >= event.minLikes);
    case "comment": return data.type === "comment" && (!event.keyword || data.comment?.toLowerCase().includes(event.keyword.toLowerCase()));
    case "join": return data.type === "join";
    case "subscribe": return data.type === "subscribe";
    case "command": return data.type === "comment" && data.comment?.toLowerCase().startsWith(event.keyword?.toLowerCase() || "");
    default: return false;
  }
}

export async function executeAction(action: Action, eventData: any) {
  const electronAPI = api();
  const vol = (action.soundVolume ?? action.mediaVolume ?? 80) / 100;

  // Load media from Dexie if stripped by Zustand partialize
  let soundFile = action.soundFile;
  let videoFile = action.videoFile;
  let imageFile = action.imageFile;
  if (action.sound && !soundFile) {
    const media = await getActionMedia(action.id, "sound").catch(() => null) as { file: string } | null;
    if (media) soundFile = media.file;
  }
  if (action.video && !videoFile) {
    const media = await getActionMedia(action.id, "video").catch(() => null) as { file: string } | null;
    if (media) videoFile = media.file;
  }
  if (action.image && !imageFile) {
    const media = await getActionMedia(action.id, "image").catch(() => null) as { file: string } | null;
    if (media) imageFile = media.file;
  }

  // â”€â”€ Play sound effect â”€â”€
  if (action.sound && soundFile) {
    const playSound = () => {
      try {
        const audio = new Audio(soundFile);
        audio.volume = vol;
        // Fade in
        if (action.soundFadeIn && action.soundFadeIn > 0) {
          audio.volume = 0;
          const fadeSteps = 20;
          const stepTime = (action.soundFadeIn * 1000) / fadeSteps;
          let step = 0;
          const fadeInterval = setInterval(() => {
            step++;
            audio.volume = Math.min(vol, (step / fadeSteps) * vol);
            if (step >= fadeSteps) clearInterval(fadeInterval);
          }, stepTime);
        }
        // Fade out
        if (action.soundFadeOut && action.soundFadeOut > 0) {
          audio.addEventListener("timeupdate", () => {
            const remaining = audio.duration - audio.currentTime;
            if (remaining <= action.soundFadeOut! && remaining > 0) {
              audio.volume = Math.max(0, (remaining / action.soundFadeOut!) * vol);
            }
          });
        }
        audio.loop = action.soundLoop || false;
        audio.play().catch(() => {});
      } catch (_) {}
    };
    // Sound delay
    if (action.soundDelay && action.soundDelay > 0) {
      setTimeout(playSound, action.soundDelay * 1000);
    } else {
      playSound();
    }
  }

  // â”€â”€ Send visual to overlay â”€â”€
  const screen = action.overlayScreen || "1";
  const overlayData: Record<string, unknown> = {
    type: action.video ? "video" : action.image ? "image" : "action",
    actionName: action.name,
    screen,
    videoFile,
    imageFile,
    duration: action.displayDuration || action.duration || 5,
    fadeInOut: action.fadeInOut,
    eventData,
    // Sound properties
    soundVolume: vol,
    soundFadeIn: action.soundFadeIn || 0,
    soundFadeOut: action.soundFadeOut || 0,
    soundLoop: action.soundLoop || false,
    // Video properties
    videoAutoplay: action.videoAutoplay !== false,
    videoLoop: action.videoLoop || false,
    videoSpeed: action.videoSpeed || 1,
    videoFadeIn: action.videoFadeIn || 0,
    videoFadeOut: action.videoFadeOut || 0,
    // Image properties
    imageOpacity: action.imageOpacity ?? 100,
    imageScale: action.imageScale ?? 100,
    imagePosition: action.imagePosition || { x: 50, y: 50 },
    imageAnimation: action.imageAnimation || "none",
    // Keystroke properties
    keystrokeKeys: action.keystrokeKeys,
    keystrokeHoldMs: action.keystrokeHoldMs || 100,
    keystrokeDuration: action.keystrokeDuration || 5,
    keystrokeOpacity: action.keystrokeOpacity ?? 100,
    keystrokeScale: action.keystrokeScale ?? 100,
    keystrokeAnimation: action.keystrokeAnimation || "fade",
  };
  sendToOverlay(overlayData);

  // â”€â”€ Forward to Event Bus V2 â”€â”€
  dispatchToEventBus(data);

  // â”€â”€ Send keystrokes to overlay and Electron â”€â”€
  if (action.keystroke && action.keystrokeKeys) {
    // Send keystroke event to overlay for visual display
    sendToOverlay({
      type: "keystroke",
      event: "triggered",
      screen,
      keys: action.keystrokeKeys.split(/\s+/).filter(Boolean),
      mouseButtons: [],
      duration: action.keystrokeDuration || 5,
      opacity: action.keystrokeOpacity ?? 100,
      scale: action.keystrokeScale ?? 100,
      animation: action.keystrokeAnimation || "fade",
      source: "action-trigger",
      eventData,
      timestamp: Date.now(),
    });
    // Also send to Electron for actual input simulation
    if (electronAPI) {
      electronAPI.sendKeystrokes(action.keystrokeKeys, {
        holdMs: action.keystrokeHoldMs || 100,
        eventData,
      });
    }
  }

  // â”€â”€ Execute Minecraft command â”€â”€
  if (action.minecraft && action.minecraftCommand && electronAPI) {
    const cmd = action.minecraftCommand
      .replace(/\{username\}/gi, eventData.user || "")
      .replace(/\{nickname\}/gi, eventData.nickname || "")
      .replace(/\{giftname\}/gi, eventData.giftName || "")
      .replace(/\{comment\}/gi, eventData.comment || "");
    // Minecraft delay
    const executeMc = () => {
      try {
        electronAPI.mcExecute({ command: cmd });
      } catch (_) {}
    };
    if (action.minecraftDelay && action.minecraftDelay > 0) {
      setTimeout(executeMc, action.minecraftDelay * 1000);
    } else {
      executeMc();
    }
  }

  // â”€â”€ Trigger Streamer.bot â”€â”€
  if (electronAPI) {
    electronAPI.sbTrigger({ actionName: action.name, eventData });
  }

  // â”€â”€ Switch OBS scene if configured â”€â”€
  if (electronAPI && action.overlayScreen) {
    safeInvoke(electronAPI.obsSwitchScene, { sceneName: `Screen ${action.overlayScreen}` });
  }
}
