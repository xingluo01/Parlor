import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Download,
  Key,
  NotebookPen,
  Settings as SettingsIcon,
  Zap,
  Code,
  BookOpen,
  Palette,
  RefreshCw,
  Globe,
} from 'lucide-react';
import { backupOps, connectionOps, presetOps, regexOps, settingsOps, worldInfoOps } from '../db';
import { saveAs } from 'file-saver';
import { useConnectionStore, usePresetStore } from '../stores';
import type { AppSettings, RegexScript, WorldInfo } from '../types';
import { ConnectionSettings } from './settings/ConnectionSettings';
import { PresetSettings } from './settings/PresetSettings';
import { RegexSettings } from './settings/RegexSettings';
import { BackupSettings } from './settings/BackupSettings';
import { GeneralSettings } from './settings/GeneralSettings';
import { WorldInfoSettings } from './settings/WorldInfoSettings';
import { ThemeSettings } from './settings/ThemeSettings';
import { SyncSettings } from './settings/SyncSettings';
import { TranslationSettings } from './settings/TranslationSettings';
import { AuthorNoteSettings } from './settings/AuthorNoteSettings';

type SettingsTab = 'connection' | 'presets' | 'regex' | 'worldInfo' | 'backup' | 'translation' | 'general' | 'theme' | 'sync' | 'authorNotes';

export function SettingsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>('connection');
  const connections = useConnectionStore(s => s.connections);
  const setConnections = useConnectionStore(s => s.setConnections);
  const setActiveConnection = useConnectionStore(s => s.setActiveConnection);
  const presets = usePresetStore(s => s.presets);
  const setPresets = usePresetStore(s => s.setPresets);
  const setActivePreset = usePresetStore(s => s.setActivePreset);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [regexes, setRegexes] = useState<RegexScript[]>([]);
  const [worldInfoBooks, setWorldInfoBooks] = useState<WorldInfo[]>([]);

  useEffect(() => {
    async function loadData() {
      const [connectionList, presetList, appSettings, regexList, wiBooks] = await Promise.all([
        connectionOps.getAll(),
        presetOps.getAll(),
        settingsOps.get(),
        regexOps.getAll(),
        worldInfoOps.getAll(),
      ]);
      setConnections(connectionList);
      setPresets(presetList);
      setSettings(appSettings || null);
      setRegexes([...regexList].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
      setWorldInfoBooks(wiBooks);

      const activeConn = connectionList.find(c => c.isActive);
      if (activeConn) setActiveConnection(activeConn);

      const defaultPreset = presetList.find(p => p.isDefault);
      if (defaultPreset) setActivePreset(defaultPreset);
    }
    loadData();
  }, []);

  const handleQuickBackup = async () => {
    try {
      const backup = await backupOps.createQuickBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: 'application/json',
      });
      const date = new Date().toISOString().split('T')[0];
      saveAs(blob, `parlor-quick-backup-${date}.json`);
    } catch (error) {
      console.error('Backup failed:', error);
    }
  };

  const handleFullBackup = async () => {
    try {
      const backup = await backupOps.createFullBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: 'application/json',
      });
      const date = new Date().toISOString().split('T')[0];
      saveAs(blob, `parlor-full-backup-${date}.json`);
    } catch (error) {
      console.error('Backup failed:', error);
    }
  };

  const handleUpdateSetting = async (key: string, value: any) => {
    await settingsOps.update({ [key]: value } as Partial<AppSettings>);
    const updated = await settingsOps.get();
    setSettings(updated || null);
  };

  const tabs = [
    { id: 'connection' as const, label: t('settings.tabs.connection'), icon: Key },
    { id: 'presets' as const, label: t('settings.tabs.presets'), icon: Zap },
    { id: 'regex' as const, label: t('settings.tabs.regex'), icon: Code },
    { id: 'worldInfo' as const, label: t('settings.tabs.worldInfo'), icon: BookOpen },
    { id: 'backup' as const, label: t('settings.tabs.backup'), icon: Download },
    { id: 'authorNotes' as const, label: '作者备注', icon: NotebookPen },
    { id: 'theme' as const, label: t('settings.tabs.theme'), icon: Palette },
    { id: 'sync' as const, label: t('settings.tabs.sync'), icon: RefreshCw },
    { id: 'translation' as const, label: t('settings.tabs.translation'), icon: Globe },
    { id: 'general' as const, label: t('settings.tabs.general'), icon: SettingsIcon },
  ];

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white font-serif tracking-tight">{t('settings.title')}</h1>
        <p className="text-gray-600 text-sm mt-1">
          {t('settings.subtitle')}
        </p>
      </div>

      {/* Mobile tab grid */}
      <div className="grid grid-cols-4 gap-1.5 mb-4 md:hidden">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl text-center
              transition-all duration-200
              ${
                activeTab === tab.id
                  ? 'bg-parlor-500/12 text-white border border-parlor-500/15'
                  : 'bg-dark-200/60 border border-glass-border text-gray-600 hover:text-white'
              }
            `}
          >
            <tab.icon className="w-4.5 h-4.5" />
            <span className="text-2xs font-medium">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="bg-dark-200 border border-glass-border rounded-xl shadow-elevated overflow-hidden flex flex-col md:flex-row"
        style={{
          backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.01) 0%, transparent 50%, rgba(0,0,0,0.05) 100%)',
        }}
      >
        {/* Tabs Sidebar - desktop only */}
        <div className="hidden md:block md:w-44 flex-shrink-0 md:border-r border-glass-border p-3">
          <nav className="flex md:flex-col gap-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap relative
                  transition-all duration-200
                  ${
                    activeTab === tab.id
                      ? 'bg-parlor-500/10 text-white'
                      : 'text-gray-500 hover:text-white hover:bg-glass-white'
                  }
                `}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="settings-tab-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-parlor-500 rounded-full"
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  />
                )}
                <tab.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-w-0 p-4 md:p-6">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {activeTab === 'connection' && (
              <ConnectionSettings
                connections={connections}
                onRefresh={async () => {
                  const conns = await connectionOps.getAll();
                  setConnections(conns);
                }}
              />
            )}
            {activeTab === 'presets' && (
              <PresetSettings
                presets={presets}
                onRefresh={async () => {
                  const p = await presetOps.getAll();
                  setPresets(p);
                }}
              />
            )}
            {activeTab === 'regex' && (
              <RegexSettings
                regexes={regexes}
                onRefresh={async () => {
                  const r = await regexOps.getAll();
                  setRegexes([...r].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
                }}
              />
            )}
            {activeTab === 'worldInfo' && (
              <WorldInfoSettings
                books={worldInfoBooks}
                onRefresh={async () => {
                  const wi = await worldInfoOps.getAll();
                  setWorldInfoBooks(wi);
                }}
              />
            )}
            {activeTab === 'backup' && (
              <BackupSettings
                onQuickBackup={handleQuickBackup}
                onFullBackup={handleFullBackup}
              />
            )}
            {activeTab === 'authorNotes' && <AuthorNoteSettings />}
            {activeTab === 'theme' && (
              <ThemeSettings
                settings={settings}
                onUpdate={async (updates) => {
                  await settingsOps.update(updates);
                  const updated = await settingsOps.get();
                  setSettings(updated || null);
                }}
              />
            )}
            {activeTab === 'sync' && (
              <SyncSettings
                settings={settings}
                onUpdate={async (updates) => {
                  await settingsOps.update(updates);
                  const updated = await settingsOps.get();
                  setSettings(updated || null);
                }}
              />
            )}
            {activeTab === 'translation' && (
              <TranslationSettings
                settings={settings ?? undefined}
                onUpdate={handleUpdateSetting}
              />
            )}
            {activeTab === 'general' && (
              <GeneralSettings
                settings={settings}
                onUpdate={async (updates) => {
                  await settingsOps.update(updates);
                  const updated = await settingsOps.get();
                  setSettings(updated || null);
                }}
              />
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
