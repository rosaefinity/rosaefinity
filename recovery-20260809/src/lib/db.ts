// =============================================
// Dexie.js IndexedDB â€” Media blob storage
// =============================================

import Dexie from "dexie";

class RosaeFinityDB extends Dexie {
  sounds!: Dexie.Table<{ id: string; name: string; file: string; fileName: string }, string>;
  mediaFiles!: Dexie.Table<{ id: string; actionId: string; type: "sound" | "video" | "image"; file: string; fileName: string }, string>;
  overlays!: Dexie.Table<{
    id: string;
    name: string;
    updatedAt: string;
    moduleId: string;
    enabled: number;
    browserSourceId: string;
    config: string;
    configVersion: number;
    createdAt: string;
  }, string>;

  constructor() {
    super("rosaefinity-db");
    this.version(1).stores({
      sounds: "id",
      mediaFiles: "id, actionId, type",
    });
    this.version(2).stores({
      overlays: "id, name, updatedAt, moduleId, enabled",
    });
    this.version(3).stores({
      overlays: "id, name, updatedAt, moduleId, enabled, browserSourceId, config, configVersion, createdAt",
    });
  }
}

export const db = new RosaeFinityDB();

// â”€â”€ Sound persistence â”€â”€
export async function saveSound(id: string, name: string, file: string, fileName: string) {
  await db.sounds.put({ id, name, file, fileName });
}

export async function getSound(id: string) {
  return await db.sounds.get(id);
}

export async function deleteSoundFromDB(id: string) {
  await db.sounds.delete(id);
}

export async function getAllSounds() {
  return await db.sounds.toArray();
}

// â”€â”€ Action media persistence â”€â”€
export async function saveActionMedia(id: string, actionId: string, type: "sound" | "video" | "image", file: string, fileName: string) {
  await db.mediaFiles.put({ id, actionId, type, file, fileName });
}

export async function getActionMedia(actionId: string, type?: "sound" | "video" | "image") {
  if (type) {
    return await db.mediaFiles.where({ actionId, type }).first();
  }
  return await db.mediaFiles.where({ actionId }).toArray();
}

export async function getActionMediaArray(actionId: string) {
  return await db.mediaFiles.where({ actionId }).toArray();
}

export async function deleteActionMedia(actionId: string) {
  await db.mediaFiles.where({ actionId }).delete();
}

// â”€â”€ Overlay Instance persistence â”€â”€
import type { OverlayInstance } from '../overlays/types';

export async function saveOverlayInstance(instance: OverlayInstance) {
  await db.overlays.put({
    id: instance.id,
    name: instance.name,
    updatedAt: instance.updatedAt.toString(),
    moduleId: instance.moduleId,
    enabled: instance.enabled,
    browserSourceId: instance.browserSourceId,
    config: JSON.stringify(instance.config),
    configVersion: instance.configVersion,
    createdAt: instance.createdAt.toString(),
  });
}

export async function getOverlayInstance(id: string) {
  const row = await db.overlays.get(id);
  if (!row) return null;
  return {
    id: row.id,
    moduleId: row.moduleId,
    name: row.name,
    enabled: row.enabled,
    browserSourceId: row.browserSourceId,
    config: JSON.parse(row.config),
    configVersion: row.configVersion,
    createdAt: parseInt(row.createdAt),
    updatedAt: parseInt(row.updatedAt),
  } as OverlayInstance;
}

export async function getAllOverlayInstances() {
  const rows = await db.overlays.toArray();
  return rows.map(row => ({
    id: row.id,
    moduleId: row.moduleId,
    name: row.name,
    enabled: row.enabled,
    browserSourceId: row.browserSourceId,
    config: JSON.parse(row.config),
    configVersion: row.configVersion,
    createdAt: parseInt(row.createdAt),
    updatedAt: parseInt(row.updatedAt),
  })) as OverlayInstance[];
}

export async function deleteOverlayInstanceFromDB(id: string) {
  await db.overlays.delete(id);
}
