// =============================================
// Dexie.js IndexedDB — Media blob storage
// =============================================

import Dexie from "dexie";

class RosaeFinityDB extends Dexie {
  sounds!: Dexie.Table<{ id: string; name: string; file: string; fileName: string; profileId: string }, string>;
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
    userId?: string;
    profileId?: string;
  }, string>;
  goals!: Dexie.Table<{
    id: string;
    type: string;
    target: number;
    title: string;
    reachedBehavior: string;
    increaseAmount: number;
    actionId: string | null;
    enabled: boolean;
    createdAt: number;
    updatedAt: number;
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
    this.version(4).stores({
      goals: "id, type, enabled, createdAt",
    });
    this.version(5).stores({
      sounds: "id, profileId",
    });
    this.version(6).stores({
      overlays: "id, name, updatedAt, moduleId, enabled, userId",
    });
    this.version(7).stores({
      overlays: "id, name, updatedAt, moduleId, enabled, userId, profileId",
    });
    // v8: Add userId index to goals for account isolation (F-001).
    // Existing rows retain their data; unowned legacy goals lack userId
    // and are excluded from authenticated queries.
    this.version(8).stores({
      goals: "id, userId, type, enabled, createdAt",
    });
  }
}

export const db = new RosaeFinityDB();

/**
 * Attempt to recover from a DatabaseClosedError by creating a fresh
 * Dexie instance that reopens the same underlying IndexedDB.
 * Returns a usable db instance, or throws if recovery fails.
 */
export async function reopenDatabase(): Promise<RosaeFinityDB> {
  const fresh = new RosaeFinityDB();
  await fresh.open();
  return fresh;
}

// ── Sound persistence ──
export async function saveSound(id: string, name: string, file: string, fileName: string, profileId: string) {
  await db.sounds.put({ id, name, file, fileName, profileId });
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

export async function getSoundsByProfile(profileId: string) {
  return await db.sounds.where('profileId').equals(profileId).toArray();
}

export async function deleteSoundsByProfile(profileId: string) {
  return await db.sounds.where('profileId').equals(profileId).delete();
}

// ── Action media persistence ──
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

// ── Overlay Instance persistence ──
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
    userId: instance.userId,
    profileId: instance.profileId,
  });
}

export async function getOverlayInstance(id: string) {
  const row = await db.overlays.get(id);
  if (!row) return null;
  return rowToInstance(row);
}

/** Convert a raw Dexie row to an OverlayInstance */
function rowToInstance(row: { id: string; name: string; updatedAt: string; moduleId: string; enabled: number; browserSourceId: string; config: string; configVersion: number; createdAt: string; userId?: string; profileId?: string }): OverlayInstance {
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
    userId: row.userId,
    profileId: row.profileId,
  };
}

/** Get overlay instances — optionally filtered by userId for account isolation */
export async function getAllOverlayInstances(userId?: string) {
  if (userId) {
    const rows = await db.overlays.where('userId').equals(userId).toArray();
    return rows.map(rowToInstance);
  }
  const rows = await db.overlays.toArray();
  return rows.map(rowToInstance);
}

export async function deleteOverlayInstanceFromDB(id: string) {
  await db.overlays.delete(id);
}

/** Delete all overlay instances belonging to a user + profile */
export async function deleteOverlaysByProfile(userId: string, profileId: string): Promise<string[]> {
  const instances = await db.overlays.where('userId').equals(userId)
    .and((row: any) => row.profileId === profileId)
    .toArray();
  const ids = instances.map(i => i.id);
  await db.overlays.bulkDelete(ids);
  return ids;
}

// ── Bulk import helpers (for Export/Import v2) ──

/** Import goals in bulk — replaces existing goals by id */
export async function importGoals(goals: Array<{
  id: string; type: string; target: number; title: string;
  reachedBehavior: string; increaseAmount: number;
  actionId: string | null; enabled: boolean; userId?: string;
}>, targetDb?: RosaeFinityDB) {
  await (targetDb ?? db).goals.bulkPut(goals);
}

/** Import overlay instances in bulk — replaces existing by id */
export async function importOverlays(rows: Array<{
  id: string; name: string; moduleId: string; enabled: number;
  browserSourceId: string; config: string; configVersion: number;
  createdAt: string; updatedAt?: string; userId?: string; profileId?: string;
}>, targetDb?: RosaeFinityDB) {
  await (targetDb ?? db).overlays.bulkPut(rows);
}
