import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { generateUUID } from '../../utils/uuid';
import {
  Upload,
  Plus,
  Edit3,
  Trash2,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  Save,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { Button, Input, Modal, ConfirmDialog, Textarea } from '../../components/ui';
import { regexOps } from '../../db';
import type { RegexScript } from '../../types';

// Regex Settings Component
export function RegexSettings({
  regexes,
  onRefresh,
}: {
  regexes: RegexScript[];
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRegex, setEditingRegex] = useState<RegexScript | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const sorted = [...regexes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportSuccess(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const items: RegexScript[] = Array.isArray(data) ? data : [data];
      const existing = new Set(regexes.map(r => r.id));
      let imported = 0;
      for (const raw of items) {
        if (!raw || typeof raw !== 'object') continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const item = raw as any;
        const script: RegexScript = {
          id: item.id || generateUUID(),
          name: item.name || item.scriptName || 'Imported Rule',
          findRegex: item.findRegex || item.find_regex || '',
          replaceString: item.replaceString ?? item.replace_string ?? '',
          flags: item.flags || undefined,
          applyTo: item.applyTo || 'output',
          enabled: item.enabled ?? true,
          order: item.order ?? (regexes.length + imported),
          createdAt: item.createdAt || Date.now(),
          updatedAt: Date.now(),
        };
        if (!script.findRegex) continue;
        if (existing.has(script.id)) script.id = generateUUID();
        await regexOps.add(script);
        imported++;
      }
      onRefresh();
      setImportSuccess(t('settings.regex.importedCount', { count: imported }));
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import');
    } finally {
      e.target.value = '';
    }
  };

  const handleReorder = async (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= sorted.length) return;
    const a = sorted[index];
    const b = sorted[swapIndex];
    await Promise.all([
      regexOps.update(a.id, { order: b.order }),
      regexOps.update(b.id, { order: a.order }),
    ]);
    onRefresh();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white font-serif tracking-tight">{t('settings.regex.title')}</h2>
        <div className="flex gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => importInputRef.current?.click()}
          >
            <Upload className="w-4 h-4" />
            {t('common.import')}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditingRegex(null);
              setIsModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4" />
            {t('settings.regex.addRule')}
          </Button>
        </div>
      </div>

      {importError && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center justify-between">
          <span>{importError}</span>
          <button onClick={() => setImportError(null)} className="hover:text-red-300">✕</button>
        </div>
      )}
      {importSuccess && (
        <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm flex items-center justify-between">
          <span>{importSuccess}</span>
          <button onClick={() => setImportSuccess(null)} className="hover:text-green-300">✕</button>
        </div>
      )}

      <p className="text-gray-500 text-sm mb-4">
        {t('settings.regex.description')}
      </p>

      {sorted.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">{t('settings.regex.noRulesDesc')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((script, index) => (
            <div
              key={script.id}
              className="bg-dark-200 border border-glass-border rounded-lg p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={async () => {
                      await regexOps.update(script.id, { enabled: !script.enabled });
                      onRefresh();
                    }}
                    className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
                    title={script.enabled ? t('settings.regex.disableScript') : t('settings.regex.enableScript')}
                  >
                    {script.enabled
                      ? <ToggleRight className="w-5 h-5 text-parlor-400" />
                      : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <span className={`font-medium truncate ${script.enabled ? 'text-white' : 'text-gray-500'}`}>
                    {script.name}
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReorder(index, 'up')}
                    disabled={index === 0}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReorder(index, 'down')}
                    disabled={index === sorted.length - 1}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingRegex(script);
                      setIsModalOpen(true);
                    }}
                  >
                    <Edit3 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteConfirm(script.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-3 text-sm">
                <code className="text-parlor-300 font-mono truncate">
                  /{script.findRegex}/{script.flags || ''}
                </code>
                <span className="text-gray-500">→</span>
                <code className="text-gray-300 font-mono truncate">
                  "{script.replaceString}"
                </code>
                <span className={`ml-auto flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium ${
                  script.applyTo === 'input'
                    ? 'bg-blue-500/20 text-blue-300'
                    : script.applyTo === 'output'
                    ? 'bg-green-500/20 text-green-300'
                    : 'bg-purple-500/20 text-purple-300'
                }`}>
                  {script.applyTo === 'input' ? t('settings.regex.inputScope') : script.applyTo === 'output' ? t('settings.regex.outputScope') : t('settings.regex.bothScope')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <RegexModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        regex={editingRegex}
        regexCount={regexes.length}
        onSave={async (data) => {
          if (editingRegex) {
            await regexOps.update(editingRegex.id, data);
          } else {
            await regexOps.add({
              ...data,
              id: generateUUID(),
              createdAt: Date.now(),
              updatedAt: Date.now(),
            } as RegexScript);
          }
          onRefresh();
          setIsModalOpen(false);
        }}
      />

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={async () => {
          if (deleteConfirm) {
            await regexOps.delete(deleteConfirm);
            onRefresh();
            setDeleteConfirm(null);
          }
        }}
        title={t('settings.regex.deleteRule')}
        message={t('settings.regex.deleteRuleConfirm')}
        confirmText={t('common.delete')}
        variant="danger"
      />
    </div>
  );
}

// Regex Modal
export function RegexModal({
  isOpen,
  onClose,
  regex,
  regexCount,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  regex: RegexScript | null;
  regexCount: number;
  onSave: (data: Partial<RegexScript>) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [findRegex, setFindRegex] = useState('');
  const [replaceString, setReplaceString] = useState('');
  const [flagI, setFlagI] = useState(false);
  const [flagM, setFlagM] = useState(false);
  const [flagS, setFlagS] = useState(false);
  const [applyTo, setApplyTo] = useState<'input' | 'output' | 'both'>('output');
  const [sampleText, setSampleText] = useState('');
  const [regexError, setRegexError] = useState<string | null>(null);

  const flagsStr = [flagI ? 'i' : '', flagM ? 'm' : '', flagS ? 's' : ''].filter(Boolean).join('');

  // Load values from prop when modal opens
  useEffect(() => {
    if (isOpen) {
      if (regex) {
        setName(regex.name);
        setFindRegex(regex.findRegex);
        setReplaceString(regex.replaceString);
        setFlagI(!!(regex.flags?.includes('i')));
        setFlagM(!!(regex.flags?.includes('m')));
        setFlagS(!!(regex.flags?.includes('s')));
        setApplyTo(regex.applyTo);
      } else {
        setName('');
        setFindRegex('');
        setReplaceString('');
        setFlagI(false);
        setFlagM(false);
        setFlagS(false);
        setApplyTo('output');
      }
      setSampleText('');
      setRegexError(null);
    }
  }, [regex, isOpen]);

  // Validate regex pattern
  useEffect(() => {
    if (!findRegex) {
      setRegexError(null);
      return;
    }
    try {
      new RegExp(findRegex, 'g' + flagsStr);
      setRegexError(null);
    } catch (e) {
      setRegexError((e as Error).message);
    }
  }, [findRegex, flagsStr]);

  // Compute live preview
  let previewResult = sampleText;
  if (sampleText && findRegex && !regexError) {
    try {
      previewResult = sampleText.replace(new RegExp(findRegex, 'g' + flagsStr), replaceString);
    } catch {
      // leave as-is
    }
  }

  const canSave = name.trim() !== '' && findRegex.trim() !== '' && !regexError;

  const handleSave = async () => {
    if (!canSave) return;
    const data: Partial<RegexScript> = {
      name: name.trim(),
      findRegex: findRegex.trim(),
      replaceString,
      flags: flagsStr || undefined,
      applyTo,
      enabled: regex?.enabled ?? true,
      order: regex?.order ?? regexCount,
    };
    await onSave(data);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={regex ? t('settings.regex.editRule') : t('settings.regex.newRule')}
      size="md"
    >
      <div className="space-y-4">
        <Input
          label={t('settings.regex.ruleName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('settings.regex.ruleNamePlaceholder')}
        />

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            {t('settings.regex.findRegex')}
          </label>
          <input
            value={findRegex}
            onChange={(e) => setFindRegex(e.target.value)}
            placeholder={t('settings.regex.findRegexPlaceholder')}
            className={`w-full px-4 py-2.5 rounded-lg bg-dark-100 border text-white font-mono placeholder-gray-500 focus:outline-none ${
              regexError
                ? 'border-red-500 focus:border-red-500'
                : 'border-glass-border focus:border-parlor-500/50'
            }`}
          />
          {regexError && (
            <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              {regexError}
            </p>
          )}
        </div>

        <div>
          <Input
            label={t('settings.regex.replaceWith')}
            value={replaceString}
            onChange={(e) => setReplaceString(e.target.value)}
            placeholder={t('settings.regex.replaceWithPlaceholder')}
          />
          <p className="mt-1 text-xs text-gray-500">
            Use <code className="text-gray-400">$1</code>, <code className="text-gray-400">$2</code> for capture groups. Leave empty to delete matches.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">{t('settings.regex.flags')}</label>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={flagI}
                onChange={(e) => setFlagI(e.target.checked)}
                className="rounded border-glass-border bg-dark-100 text-parlor-500"
              />
              <span className="text-sm text-gray-300">Case insensitive <code className="text-gray-500">(i)</code></span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={flagM}
                onChange={(e) => setFlagM(e.target.checked)}
                className="rounded border-glass-border bg-dark-100 text-parlor-500"
              />
              <span className="text-sm text-gray-300">Multiline <code className="text-gray-500">(m)</code></span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={flagS}
                onChange={(e) => setFlagS(e.target.checked)}
                className="rounded border-glass-border bg-dark-100 text-parlor-500"
              />
              <span className="text-sm text-gray-300">Dot all <code className="text-gray-500">(s)</code></span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">{t('settings.regex.applyTo')}</label>
          <div className="flex gap-2">
            {(['input', 'output', 'both'] as const).map((option) => (
              <button
                key={option}
                onClick={() => setApplyTo(option)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  applyTo === option
                    ? 'bg-parlor-500/12 border border-parlor-500/15 text-white'
                    : 'bg-dark-100 text-gray-400 hover:text-white border border-glass-border'
                }`}
              >
                {option === 'input' ? t('settings.regex.inputScope') : option === 'output' ? t('settings.regex.outputScope') : t('settings.regex.bothScope')}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-glass-border pt-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{t('settings.regex.liveTest')}</p>
          <Textarea
            label={t('settings.regex.sampleText')}
            value={sampleText}
            onChange={(e) => setSampleText(e.target.value)}
            placeholder={t('settings.regex.sampleTextPlaceholder')}
            rows={3}
          />
          {sampleText && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('settings.regex.result')}</label>
              <textarea
                readOnly
                value={previewResult}
                rows={3}
                className="w-full px-4 py-2.5 rounded-lg bg-dark-100 border border-glass-border text-gray-300 font-mono text-sm resize-none focus:outline-none"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} disabled={!canSave}>
            <Save className="w-4 h-4" />
            {t('common.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
