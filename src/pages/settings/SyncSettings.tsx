import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Wifi, WifiOff, Check, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui';
import { syncNow, startAutoSync, stopAutoSync, onSyncStatus } from '../../services/sync';
import type { SyncResult } from '../../services/sync';
import type { AppSettings } from '../../types';

type Props = {
  settings: AppSettings | null;
  onUpdate: (updates: Partial<AppSettings>) => Promise<void>;
};

export function SyncSettings({ settings, onUpdate }: Props) {
  const { t } = useTranslation();
  const [remoteUrl, setRemoteUrl] = useState(settings?.syncRemoteUrl || '');
  const [enabled, setEnabled] = useState(settings?.syncEnabled || false);
  const [interval, setInterval_] = useState(settings?.syncIntervalMinutes || 5);
  const [status, setStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [reachable, setReachable] = useState<boolean | null>(null);
  const checkTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Populate from settings
  useEffect(() => {
    if (!settings) return;
    setRemoteUrl(settings.syncRemoteUrl || '');
    setEnabled(settings.syncEnabled || false);
    setInterval_(settings.syncIntervalMinutes || 5);
  }, [settings]);

  // Listen for sync status updates
  useEffect(() => {
    return onSyncStatus((s, result, error) => {
      setStatus(s);
      if (result) setLastResult(result);
      if (error) setErrorMsg(error);
    });
  }, []);

  // Check reachability when URL changes
  useEffect(() => {
    if (checkTimer.current) clearTimeout(checkTimer.current);
    if (!remoteUrl) { setReachable(null); return; }

    checkTimer.current = setTimeout(async () => {
      try {
        const url = remoteUrl.replace(/\/+$/, '');
        const res = await fetch(`${url}/api/status`, { signal: AbortSignal.timeout(5000) });
        setReachable(res.ok);
      } catch {
        setReachable(false);
      }
    }, 800);

    return () => { if (checkTimer.current) clearTimeout(checkTimer.current); };
  }, [remoteUrl]);

  // Track changes
  useEffect(() => {
    const changed =
      remoteUrl !== (settings?.syncRemoteUrl || '') ||
      enabled !== (settings?.syncEnabled || false) ||
      interval !== (settings?.syncIntervalMinutes || 5);
    setHasChanges(changed);
  }, [remoteUrl, enabled, interval, settings]);

  const handleSave = async () => {
    await onUpdate({
      syncEnabled: enabled,
      syncRemoteUrl: remoteUrl,
      syncIntervalMinutes: interval,
    });
    setHasChanges(false);

    // Restart or stop auto-sync based on new settings
    if (enabled && remoteUrl && interval > 0) {
      startAutoSync(remoteUrl, interval);
    } else {
      stopAutoSync();
    }
  };

  const handleSyncNow = async () => {
    if (!remoteUrl) return;
    setErrorMsg('');
    try {
      await syncNow(remoteUrl);
    } catch {
      // Error already captured by the listener
    }
  };

  const formatTime = (ts?: number) => {
    if (!ts) return t('settings.sync.lastSyncNever');
    const d = new Date(ts);
    return d.toLocaleString();
  };

  const totalPulled = lastResult ? Object.values(lastResult.pulled).reduce((a, b) => a + b, 0) : 0;
  const totalPushedCount = lastResult
    ? Object.values(lastResult.pushed).reduce((sum, s) => sum + s.added + s.updated, 0)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">{t('settings.sync.title')}</h2>
        <p className="text-sm text-gray-600">
          {t('settings.sync.syncDesc')}
        </p>
      </div>

      {/* Remote URL */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-400">{t('settings.sync.remoteServerUrl')}</label>
        <div className="relative">
          <input
            type="text"
            value={remoteUrl}
            onChange={e => setRemoteUrl(e.target.value)}
            placeholder="http://192.168.1.100:3001"
            className="w-full bg-dark-300 border border-glass-border rounded-lg px-3 py-2 text-white text-sm placeholder:text-gray-700 pr-10"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {reachable === true && <Wifi className="w-4 h-4 text-green-400" />}
            {reachable === false && <WifiOff className="w-4 h-4 text-red-400" />}
          </div>
        </div>
        {reachable === false && remoteUrl && (
          <p className="text-xs text-red-400">{t('settings.sync.cannotReachServer')}</p>
        )}
        {reachable === true && (
          <p className="text-xs text-green-400">{t('settings.sync.serverReachable')}</p>
        )}
      </div>

      {/* Enable toggle */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-gray-300">{t('settings.sync.autoSync')}</div>
          <div className="text-xs text-gray-600">{t('settings.sync.autoSyncDesc')}</div>
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-parlor-500' : 'bg-dark-100'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      {/* Interval */}
      {enabled && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-400">
            {t('settings.sync.title')}: {interval} min
          </label>
          <input
            type="range"
            min={1}
            max={60}
            value={interval}
            onChange={e => setInterval_(Number(e.target.value))}
            className="w-full accent-parlor-500"
          />
          <div className="flex justify-between text-xs text-gray-700">
            <span>{t('settings.sync.syncIntervalMin')}</span>
            <span>{t('settings.sync.syncIntervalMax')}</span>
          </div>
        </div>
      )}

      {/* Sync Now button */}
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          onClick={handleSyncNow}
          disabled={!remoteUrl || status === 'syncing'}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${status === 'syncing' ? 'animate-spin' : ''}`} />
          {status === 'syncing' ? t('settings.sync.syncing') : t('settings.sync.syncNow')}
        </Button>

        {status === 'success' && lastResult && (
          <span className="flex items-center gap-1.5 text-xs text-green-400">
            <Check className="w-3.5 h-3.5" />
            {totalPulled + totalPushedCount === 0
              ? t('settings.sync.alreadyInSync')
              : t('settings.sync.syncResult', { pulled: totalPulled, pushed: totalPushedCount })}
          </span>
        )}

        {status === 'error' && (
          <span className="flex items-center gap-1.5 text-xs text-red-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            {errorMsg || t('settings.sync.syncFailed')}
          </span>
        )}
      </div>

      {/* Last sync info */}
      <div className="text-xs text-gray-600">
        {t('settings.sync.lastSync')}: {formatTime(settings?.lastSyncAt)}
      </div>

      {/* Save */}
      {hasChanges && (
        <Button variant="primary" size="sm" onClick={handleSave}>
          {t('common.save')}
        </Button>
      )}
    </div>
  );
}
