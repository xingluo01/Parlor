/**
 * Parlor Sync Service
 * Two-way background sync between local and remote Parlor instances.
 *
 * Algorithm:
 * 1. Fetch manifests (id + updatedAt) from both local and remote
 * 2. Compare: newer items on remote → pull; newer items locally → push;
 *    items only on one side → sync to the other
 * 3. Execute pull then push
 */

import { settingsOps } from '../services/apiClient';

type ManifestEntry = { id: string; updatedAt: number };
type Manifest = Record<string, ManifestEntry[]>;
type SyncPlan = {
  toPull: Record<string, string[]>;  // type → [ids to pull from remote]
  toPush: Record<string, string[]>;  // type → [ids to push to remote]
};

export type SyncResult = {
  pulled: Record<string, number>;
  pushed: Record<string, { added: number; updated: number }>;
  errors: string[];
  timestamp: number;
};

// Skip syncing settings (each device should keep its own)
const SKIP_TYPES = new Set(['settings']);

let syncTimer: ReturnType<typeof setInterval> | null = null;
let isSyncing = false;

// Listeners for UI updates
type SyncListener = (status: 'idle' | 'syncing' | 'success' | 'error', result?: SyncResult, error?: string) => void;
const listeners = new Set<SyncListener>();

export function onSyncStatus(listener: SyncListener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function notify(status: 'idle' | 'syncing' | 'success' | 'error', result?: SyncResult, error?: string) {
  listeners.forEach(fn => fn(status, result, error));
}

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function computeSyncPlan(local: Manifest, remote: Manifest): SyncPlan {
  const toPull: Record<string, string[]> = {};
  const toPush: Record<string, string[]> = {};

  // Collect all types from both sides
  const allTypes = new Set([...Object.keys(local), ...Object.keys(remote)]);

  for (const type of allTypes) {
    if (SKIP_TYPES.has(type)) continue;

    const localItems = local[type] || [];
    const remoteItems = remote[type] || [];

    const localMap = new Map(localItems.map(i => [i.id, i.updatedAt]));
    const remoteMap = new Map(remoteItems.map(i => [i.id, i.updatedAt]));

    const pullIds: string[] = [];
    const pushIds: string[] = [];

    // Items on remote: pull if newer or missing locally
    for (const [id, remoteUpdated] of remoteMap) {
      const localUpdated = localMap.get(id);
      if (localUpdated === undefined || remoteUpdated > localUpdated) {
        pullIds.push(id);
      }
    }

    // Items on local: push if newer or missing on remote
    for (const [id, localUpdated] of localMap) {
      const remoteUpdated = remoteMap.get(id);
      if (remoteUpdated === undefined || localUpdated > remoteUpdated) {
        pushIds.push(id);
      }
    }

    if (pullIds.length > 0) toPull[type] = pullIds;
    if (pushIds.length > 0) toPush[type] = pushIds;
  }

  return { toPull, toPush };
}

export async function syncNow(remoteUrl: string): Promise<SyncResult> {
  if (isSyncing) throw new Error('Sync already in progress');
  isSyncing = true;
  notify('syncing');

  const result: SyncResult = { pulled: {}, pushed: {}, errors: [], timestamp: Date.now() };
  const remote = remoteUrl.replace(/\/+$/, '');

  try {
    // 1. Fetch manifests from both sides
    const [localManifest, remoteManifest] = await Promise.all([
      fetchJSON<Manifest>('/api/sync/manifest'),
      fetchJSON<Manifest>(`${remote}/api/sync/manifest`),
    ]);

    // 2. Compute plan
    const plan = computeSyncPlan(localManifest, remoteManifest);

    const hasPull = Object.keys(plan.toPull).length > 0;
    const hasPush = Object.keys(plan.toPush).length > 0;

    if (!hasPull && !hasPush) {
      // Already in sync
      await settingsOps.update({ lastSyncAt: Date.now() });
      notify('success', result);
      return result;
    }

    // 3. Pull: fetch full items from remote, push to local
    if (hasPull) {
      try {
        const pulled = await fetchJSON<Record<string, unknown[]>>(
          `${remote}/api/sync/pull`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(plan.toPull) }
        );
        // Push pulled items to local server
        const pushResult = await fetchJSON<{ stats: Record<string, { added: number; updated: number }> }>(
          '/api/sync/push',
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pulled) }
        );
        for (const [type, ids] of Object.entries(plan.toPull)) {
          result.pulled[type] = ids.length;
        }
        // Merge stats
        if (pushResult.stats) {
          for (const [type, s] of Object.entries(pushResult.stats)) {
            if (!result.pushed[type]) result.pushed[type] = { added: 0, updated: 0 };
            result.pushed[type].added += s.added;
            result.pushed[type].updated += s.updated;
          }
        }
      } catch (e) {
        result.errors.push(`Pull failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 4. Push: fetch full items from local, push to remote
    if (hasPush) {
      try {
        const localItems = await fetchJSON<Record<string, unknown[]>>(
          '/api/sync/pull',
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(plan.toPush) }
        );
        const pushResult = await fetchJSON<{ stats: Record<string, { added: number; updated: number }> }>(
          `${remote}/api/sync/push`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(localItems) }
        );
        if (pushResult.stats) {
          for (const [type, s] of Object.entries(pushResult.stats)) {
            if (!result.pushed[type]) result.pushed[type] = { added: 0, updated: 0 };
            result.pushed[type].added += s.added;
            result.pushed[type].updated += s.updated;
          }
        }
      } catch (e) {
        result.errors.push(`Push failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 5. Update last sync timestamp
    result.timestamp = Date.now();
    await settingsOps.update({ lastSyncAt: result.timestamp });

    if (result.errors.length > 0) {
      notify('error', result, result.errors.join('; '));
    } else {
      notify('success', result);
    }
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    result.errors.push(msg);
    notify('error', result, msg);
    throw e;
  } finally {
    isSyncing = false;
  }
}

export function startAutoSync(remoteUrl: string, intervalMinutes: number) {
  stopAutoSync();
  if (intervalMinutes <= 0 || !remoteUrl) return;

  const intervalMs = intervalMinutes * 60 * 1000;
  console.log(`[sync] Auto-sync started: every ${intervalMinutes}m to ${remoteUrl}`);

  // Run immediately, then on interval
  syncNow(remoteUrl).catch(e => console.warn('[sync] Auto-sync failed:', e));
  syncTimer = setInterval(() => {
    syncNow(remoteUrl).catch(e => console.warn('[sync] Auto-sync failed:', e));
  }, intervalMs);
}

export function stopAutoSync() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
    console.log('[sync] Auto-sync stopped');
  }
}

export function isSyncRunning() {
  return isSyncing;
}
