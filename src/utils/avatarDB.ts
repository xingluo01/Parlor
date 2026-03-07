/**
 * Lightweight IndexedDB wrapper for persisting character avatar data between sessions.
 * Avatars are keyed by character ID and stored as raw base64 strings.
 *
 * This sits below avatarCache.ts:
 *   avatarCache (in-memory, instant)
 *     → avatarDB (IndexedDB, fast, persists across refreshes)
 *       → server (REST, slow, source of truth)
 */

const DB_NAME = 'parlor-avatar-cache';
const STORE   = 'avatars';
const VERSION = 1;

let _db: IDBDatabase | null = null;
let _opening: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  if (_opening) return _opening;
  _opening = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => {
      _db = req.result;
      // If the DB is closed externally (e.g. browser garbage collection), clear so we re-open.
      _db.onclose = () => { _db = null; _opening = null; };
      resolve(_db);
    };
    req.onerror = () => {
      _opening = null;
      reject(req.error);
    };
  });
  return _opening;
}

/** Read multiple avatars from IndexedDB. Returns only IDs that were found. */
export async function dbGetAvatars(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  try {
    const db = await openDB();
    const result: Record<string, string> = {};
    await Promise.all(ids.map(id => new Promise<void>(resolve => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
      req.onsuccess = () => { if (req.result) result[id] = req.result; resolve(); };
      req.onerror  = () => resolve();
    })));
    return result;
  } catch {
    return {};
  }
}

/**
 * Persist avatar data to IndexedDB. Pass `null` as the value to explicitly
 * remove a character's avatar (e.g. after it has been cleared on the server).
 */
export async function dbSetAvatars(entries: Record<string, string | null>): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const [id, data] of Object.entries(entries)) {
      if (data) store.put(data, id);
      else store.delete(id);
    }
    await new Promise<void>(resolve => {
      tx.oncomplete = () => resolve();
      tx.onerror    = () => resolve(); // swallow — non-critical cache
    });
  } catch {
    // Cache write failures are non-fatal.
  }
}

/** Wipe the entire avatar cache from IndexedDB (e.g. after a "nuke all data"). */
export async function dbClearAvatars(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
  } catch {}
}
