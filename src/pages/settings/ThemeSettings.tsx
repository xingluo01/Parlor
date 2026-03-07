import { useState, useEffect } from 'react';
import { Palette, Save } from 'lucide-react';
import { Button } from '../../components/ui';
import { BUILT_IN_THEMES, applyTheme, getTheme } from '../../utils/themes';
import type { AppSettings, ThemeConfig } from '../../types';

export function ThemeSettings({
  settings,
  onUpdate,
}: {
  settings: AppSettings | null;
  onUpdate: (updates: Partial<AppSettings>) => Promise<void>;
}) {
  const [activeTheme, setActiveTheme] = useState<string>('dark');
  const [customTheme, setCustomTheme] = useState<ThemeConfig>({
    name: 'Custom',
    brandColor: '#a8395e',
    dark50: '#28221e',
    dark100: '#1e1916',
    dark200: '#151210',
    dark300: '#0d0b09',
  });
  const [chatBackground, setChatBackground] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load settings
  useEffect(() => {
    if (settings) {
      setActiveTheme(settings.activeTheme || 'dark');
      if (settings.customTheme) {
        setCustomTheme(settings.customTheme);
        setChatBackground(settings.customTheme.chatBackground || '');
      }
    }
  }, [settings]);

  // Track changes
  useEffect(() => {
    if (settings) {
      const changed =
        activeTheme !== (settings.activeTheme || 'dark') ||
        (activeTheme === 'custom' && JSON.stringify(customTheme) !== JSON.stringify(settings.customTheme)) ||
        chatBackground !== (settings.customTheme?.chatBackground || '');
      setHasChanges(changed);
    }
  }, [activeTheme, customTheme, chatBackground, settings]);

  const handleSelectTheme = (key: string) => {
    setActiveTheme(key);
    const theme = getTheme(key, customTheme);
    applyTheme(theme);
  };

  const handleCustomColorChange = (field: keyof ThemeConfig, value: string) => {
    const updated = { ...customTheme, [field]: value };
    setCustomTheme(updated);
    if (activeTheme === 'custom') {
      applyTheme(updated);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const themeToSave: ThemeConfig = activeTheme === 'custom'
      ? { ...customTheme, chatBackground: chatBackground || undefined }
      : { ...getTheme(activeTheme), chatBackground: chatBackground || undefined };

    await onUpdate({
      activeTheme,
      customTheme: themeToSave,
    });
    setIsSaving(false);
    setHasChanges(false);
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2 font-serif tracking-tight">
        <Palette className="w-5 h-5" />
        Theme
      </h2>

      <div className="space-y-8">
        {/* Built-in Themes */}
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-3">Built-in Themes</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(BUILT_IN_THEMES).map(([key, theme]) => (
              <button
                key={key}
                onClick={() => handleSelectTheme(key)}
                className={`
                  p-3 rounded-lg border-2 transition-all text-left
                  ${activeTheme === key
                    ? 'border-parlor-500 bg-dark-100'
                    : 'border-glass-border bg-dark-100 hover:border-gray-500'}
                `}
              >
                <div className="flex items-center gap-2 mb-2">
                  {/* Color swatches */}
                  <div className="flex gap-1">
                    <div
                      className="w-4 h-4 rounded-sm border border-white/10"
                      style={{ backgroundColor: theme.dark50 }}
                      title="dark-50"
                    />
                    <div
                      className="w-4 h-4 rounded-sm border border-white/10"
                      style={{ backgroundColor: theme.dark100 }}
                      title="dark-100"
                    />
                    <div
                      className="w-4 h-4 rounded-sm border border-white/10"
                      style={{ backgroundColor: theme.dark200 }}
                      title="dark-200"
                    />
                    <div
                      className="w-4 h-4 rounded-sm border border-white/10"
                      style={{ backgroundColor: theme.dark300 }}
                      title="dark-300"
                    />
                  </div>
                  {/* Brand color dot */}
                  <div
                    className="w-4 h-4 rounded-full border border-white/10 ml-auto"
                    style={{ backgroundColor: theme.brandColor }}
                    title="Brand color"
                  />
                </div>
                <span className="text-sm font-medium text-white">{theme.name}</span>
              </button>
            ))}

            {/* Custom option */}
            <button
              onClick={() => handleSelectTheme('custom')}
              className={`
                p-3 rounded-lg border-2 transition-all text-left
                ${activeTheme === 'custom'
                  ? 'border-parlor-500 bg-dark-100'
                  : 'border-glass-border bg-dark-100 hover:border-gray-500'}
              `}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="flex gap-1">
                  <div
                    className="w-4 h-4 rounded-sm border border-white/10"
                    style={{ backgroundColor: customTheme.dark50 }}
                  />
                  <div
                    className="w-4 h-4 rounded-sm border border-white/10"
                    style={{ backgroundColor: customTheme.dark100 }}
                  />
                  <div
                    className="w-4 h-4 rounded-sm border border-white/10"
                    style={{ backgroundColor: customTheme.dark200 }}
                  />
                  <div
                    className="w-4 h-4 rounded-sm border border-white/10"
                    style={{ backgroundColor: customTheme.dark300 }}
                  />
                </div>
                <div
                  className="w-4 h-4 rounded-full border border-white/10 ml-auto"
                  style={{ backgroundColor: customTheme.brandColor }}
                />
              </div>
              <span className="text-sm font-medium text-white">Custom</span>
            </button>
          </div>
        </div>

        {/* Custom Theme Editor */}
        {activeTheme === 'custom' && (
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">Custom Colors</h3>
            <div className="space-y-3">
              {([
                { field: 'brandColor' as const, label: 'Brand Color' },
                { field: 'dark50' as const, label: 'Surface (dark-50)' },
                { field: 'dark100' as const, label: 'Card (dark-100)' },
                { field: 'dark200' as const, label: 'Background (dark-200)' },
                { field: 'dark300' as const, label: 'Deep (dark-300)' },
              ]).map(({ field, label }) => (
                <div key={field} className="flex items-center gap-3">
                  <input
                    type="color"
                    value={customTheme[field]}
                    onChange={(e) => handleCustomColorChange(field, e.target.value)}
                    className="w-10 h-8 rounded border border-glass-border bg-transparent cursor-pointer"
                  />
                  <div className="flex-1">
                    <label className="text-sm text-gray-300">{label}</label>
                  </div>
                  <input
                    type="text"
                    value={customTheme[field]}
                    onChange={(e) => handleCustomColorChange(field, e.target.value)}
                    className="w-24 text-xs bg-dark-200 border border-glass-border rounded px-2 py-1 text-white font-mono focus:outline-none focus:border-parlor-500"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat Background */}
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-3">Chat Background</h3>
          <input
            type="text"
            value={chatBackground}
            onChange={(e) => setChatBackground(e.target.value)}
            placeholder="Image URL (optional)"
            className="w-full text-sm bg-dark-200 border border-glass-border rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-parlor-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Enter a URL to an image to use as the chat background.
          </p>
          {chatBackground && (
            <div className="mt-2 rounded-lg overflow-hidden border border-glass-border h-24">
              <img
                src={chatBackground}
                alt="Chat background preview"
                className="w-full h-full object-cover opacity-50"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t border-glass-border">
          <Button
            onClick={handleSave}
            isLoading={isSaving}
            disabled={!hasChanges}
          >
            <Save className="w-4 h-4" />
            {hasChanges ? 'Save Theme' : 'No Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
