// =============================================
// Dexie.js IndexedDB — Media blob storage
// =============================================

import Dexie from "dexie";

class RosaeFinityDB extends Dexie {
  sounds!: Dexie.Table<{ id: string; name: string; file: string; fileName: string }, string>;
  mediaFiles!: Dexie.Table<{ id: string; actionId: string; type: "sound" | "video" | "image"; file: string; fileName: string }, string>;

  constructor() {
    super("rosaefinity-db");
    this.version(1).stores({
      sounds: "id",
      mediaFiles: "id, actionId, type",
    });
  }
}

const db = new RosaeFinityDB();

// ── Sound persistence ──
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
