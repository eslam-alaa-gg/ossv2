import Dexie, { type Table } from "dexie";
import { api } from "@/lib/client";

type Snapshot = { userId: string; key: string; value: unknown; updatedAt: number };
type PendingAction = { id?: number; userId: string; path: string; method: "POST" | "PATCH" | "DELETE"; body?: Record<string, unknown>; createdAt: number };

class UkiyoOfflineDatabase extends Dexie {
  snapshots!: Table<Snapshot, [string, string]>;
  pending!: Table<PendingAction, number>;

  constructor() {
    super("ukiyo-offline-v1");
    this.version(1).stores({
      snapshots: "[userId+key], userId, updatedAt",
      pending: "++id, userId, createdAt",
    });
  }
}

let instance: UkiyoOfflineDatabase | null = null;
function database() {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") return null;
  return instance ??= new UkiyoOfflineDatabase();
}

export async function saveOfflineSnapshot(userId: string, key: string, value: unknown) {
  const db = database();
  if (!db || !userId) return;
  try { await db.snapshots.put({ userId, key, value, updatedAt: Date.now() }); } catch { /* Private cache is best-effort. */ }
}

export async function readOfflineSnapshot<T>(userId: string, key: string): Promise<T | null> {
  const db = database();
  if (!db || !userId) return null;
  try {
    const row = await db.snapshots.get([userId, key]);
    return row ? row.value as T : null;
  } catch { return null; }
}

export async function queueOfflineAction(userId: string, path: string, method: PendingAction["method"], body?: Record<string, unknown>) {
  const db = database();
  if (!db || !userId) return false;
  try {
    await db.pending.add({ userId, path, method, body, createdAt: Date.now() });
    return true;
  } catch { return false; }
}

export async function cancelQueuedAction(userId: string, path: string, bodyMatch: Record<string, unknown>) {
  const db = database();
  if (!db || !userId) return;
  try {
    const actions = await db.pending.where("userId").equals(userId).toArray();
    await Promise.all(actions.filter((action) => action.path === path && action.method === "POST" && JSON.stringify(action.body) === JSON.stringify(bodyMatch))
      .map((action) => action.id === undefined ? Promise.resolve() : db.pending.delete(action.id)));
  } catch { /* Best-effort cancellation of a local-only item. */ }
}

export async function syncOfflineQueue(userId: string): Promise<boolean> {
  const db = database();
  if (!db || !userId || !navigator.onLine) return false;
  const actions = await db.pending.where("userId").equals(userId).sortBy("createdAt");
  for (const action of actions) {
    if (action.id === undefined) continue;
    try {
      await api(action.path, { method: action.method, ...(action.body ? { body: action.body } : {}) });
      await db.pending.delete(action.id);
    } catch {
      return false;
    }
  }
  return true;
}

export async function isolateOfflineUser(userId: string | null) {
  const db = database();
  if (!db) return;
  try {
    await db.transaction("rw", db.snapshots, db.pending, async () => {
      if (userId) {
        await db.snapshots.where("userId").notEqual(userId).delete();
      } else {
        await db.snapshots.clear();
        await db.pending.clear();
      }
    });
  } catch { /* Offline data cleanup must not block sign-in. */ }
}

export async function clearOfflineData() {
  const db = database();
  if (!db) return;
  try { await db.snapshots.clear(); } catch { /* Pending sync actions remain partitioned by account. */ }
}
