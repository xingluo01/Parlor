import { characterOps } from '../db';
import { dbGetAvatars, dbSetAvatars } from './avatarDB';

/**
 * In-memory avatar cache. Module-level so it survives component unmount/remount.
 * Maps character ID → base64 data URL, or null (confirmed: character has no avatar).
 *
 * Persistence layer: IndexedDB (avatarDB.ts) backs this cache so data survives
 * page refreshes. On a cache miss we check IndexedDB first, then the server.
 */
export const avatarCache = new Map<string, string | null>();

const pendingIds = new Set<string>();

/** Fired when any avatar changes — use for broad "something loaded" notifications. */
const listeners = new Set<() => void>();

/**
 * Per-key listeners: maps character ID → set of callbacks.
 * Only the callbacks for the specific ID that just loaded are called,
 * so individual card components can subscribe without triggering a full-list re-render.
 */
const keyListeners = new Map<string, Set<() => void>>();

let fetchTimer: ReturnType<typeof setTimeout> | null = null;

function notifyKey(id: string) {
  keyListeners.get(id)?.forEach(fn => fn());
}

async function flush() {
  fetchTimer = null;
  const ids = [...pendingIds].filter(id => !avatarCache.has(id));
  pendingIds.clear();
  if (ids.length === 0) return;

  // ── Step 1: check IndexedDB (fast, no network) ────────────────────────────
  const dbHits = await dbGetAvatars(ids);
  const misses: string[] = [];

  for (const id of ids) {
    if (dbHits[id] !== undefined) {
      avatarCache.set(id, dbHits[id]);
      notifyKey(id);
    } else {
      misses.push(id);
    }
  }

  if (Object.keys(dbHits).length > 0) {
    listeners.forEach(fn => fn());
  }

  // ── Step 2: fetch remaining from server ────────────────────────────────────
  if (misses.length === 0) return;

  try {
    const result = await characterOps.getAvatars(misses);
    const toStore: Record<string, string | null> = {};

    for (const id of misses) {
      const val = result[id] ?? null;
      avatarCache.set(id, val);
      toStore[id] = val;
      notifyKey(id);
    }

    listeners.forEach(fn => fn());

    // Persist to IndexedDB fire-and-forget (cache write failures are non-fatal)
    dbSetAvatars(toStore).catch(() => {});
  } catch {
    // Server fetch failed — set null so we don't loop-request the same IDs.
    for (const id of misses) {
      avatarCache.set(id, null);
      notifyKey(id);
    }
    listeners.forEach(fn => fn());
  }
}

/** Schedule an avatar to be loaded (debounced 120 ms so nearby requests batch). */
export function requestAvatar(id: string): void {
  if (avatarCache.has(id)) return;
  pendingIds.add(id);
  if (fetchTimer) clearTimeout(fetchTimer);
  fetchTimer = setTimeout(flush, 120);
}

/**
 * Pre-populate the in-memory cache and IndexedDB with avatars that were
 * already fetched as a side-effect of another query (e.g. HomePage batch-load).
 */
export function seedAvatars(map: Record<string, string>): void {
  const toStore: Record<string, string | null> = {};
  for (const [id, url] of Object.entries(map)) {
    if (!avatarCache.has(id)) {
      avatarCache.set(id, url || null);
      if (url) toStore[id] = url;
    }
  }
  if (Object.keys(toStore).length > 0) {
    dbSetAvatars(toStore).catch(() => {});
  }
}

/**
 * Subscribe to ALL cache updates.
 * Use sparingly — prefer subscribeAvatar() when you only care about one character.
 * Returns an unsubscribe function.
 */
export function subscribeAvatars(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Pre-warm the in-memory cache for a batch of IDs from IndexedDB only (no
 * network). Call this on page mount so cards that were seen in a previous
 * session render their avatars immediately instead of waiting for the
 * IntersectionObserver + 120 ms debounce cycle.
 */
export async function prewarmAvatars(ids: string[]): Promise<void> {
  const missing = ids.filter(id => !avatarCache.has(id));
  if (missing.length === 0) return;
  const dbHits = await dbGetAvatars(missing);
  for (const id of missing) {
    if (dbHits[id] !== undefined) {
      avatarCache.set(id, dbHits[id]);
      notifyKey(id);
    }
  }
}

/**
 * Subscribe to updates for a SINGLE character ID.
 * The callback fires only when that specific avatar loads or changes.
 * This is much more efficient than subscribeAvatars for per-card components.
 * Returns an unsubscribe function.
 */
export function subscribeAvatar(id: string, callback: () => void): () => void {
  if (!keyListeners.has(id)) keyListeners.set(id, new Set());
  keyListeners.get(id)!.add(callback);
  return () => {
    const set = keyListeners.get(id);
    if (!set) return;
    set.delete(callback);
    if (set.size === 0) keyListeners.delete(id);
  };
}
