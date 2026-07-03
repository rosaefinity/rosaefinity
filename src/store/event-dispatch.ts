import { useAppStore } from "./app-store";
import { sendToOverlay } from "../lib/overlay-bus";
import { getActionMedia } from "../lib/db";
import type { Action, Event, LiveEvent, ScreenId } from "../types";

const globalCooldowns: Map<string, number> = new Map();
const userCooldowns: Map<string, Map<string, number>> = new Map();

export function dispatchTikTokEvent(data: any) {
  if (!data) return;
  const screenId: ScreenId = data.screenId || "screen-0";
  const store = useAppStore.getState();
  const { events, actions, alertsMasterEnabled, alertSettings } = store;

  if (!alertsMasterEnabled) return;

  // Per-type alert toggle check
  const typeSettings = alertSettings[data.type as keyof typeof alertSettings];
  if (typeSettings && typeof typeSettings === "object" && "enabled" in typeSettings && !typeSettings.enabled) return;

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
  const electronAPI = (window as any).electronAPI;
  const vol = (action.mediaVolume ?? 80) / 100;

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

  // Play sound effect
  if (action.sound && soundFile) {
    try {
      const audio = new Audio(soundFile);
      audio.volume = vol;
      audio.play().catch(() => {});
    } catch (_) {}
  }

  // Play video audio through the main Electron window
  if (action.video && videoFile) {
    try {
      const videoAudio = new Audio(videoFile);
      videoAudio.volume = vol;
      videoAudio.play().catch(() => {});
    } catch (_) {}
  }

  // Send visual to overlay
  const screen = action.overlayScreen || "1";
  sendToOverlay({
    type: action.video ? "video" : action.image ? "image" : "action",
    actionName: action.name,
    screen,
    videoFile,
    imageFile,
    duration: action.displayDuration || action.duration || 5,
    fadeInOut: action.fadeInOut,
    eventData,
  });

  // Send keystrokes
  if (action.keystroke && action.keystrokeKeys && electronAPI) {
    electronAPI.sendKeystrokes(action.keystrokeKeys, {
      holdMs: action.keystrokeHoldMs || 100,
      eventData,
    });
  }

  // Execute Minecraft command
  if (action.minecraft && action.minecraftCommand && electronAPI) {
    const cmd = action.minecraftCommand
      .replace(/\{username\}/gi, eventData.user || "")
      .replace(/\{nickname\}/gi, eventData.nickname || "")
      .replace(/\{giftname\}/gi, eventData.giftName || "")
      .replace(/\{comment\}/gi, eventData.comment || "");
    electronAPI.mcExecute({ command: cmd });
  }

  // Trigger Streamer.bot
  if (electronAPI) {
    electronAPI.sbTrigger({ actionName: action.name, eventData });
  }

  // Switch OBS scene if configured
  if (electronAPI && action.overlayScreen) {
    electronAPI.obsSwitchScene({ sceneName: `Screen ${action.overlayScreen}` }).catch(() => {});
  }
}
