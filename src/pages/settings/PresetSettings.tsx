import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { generateUUID } from '../../utils/uuid';
import {
  Upload,
  Plus,
  Edit3,
  Trash2,
  Brain,
} from 'lucide-react';
import { Button, Input, Modal, ConfirmDialog, Textarea } from '../../components/ui';
import { presetOps } from '../../db';
import { parseSillyTavernPreset, isValidPresetFormat } from '../../utils/presetImport';
import type { Preset, PromptEntry, PromptOrderEntry, ReasoningMode, PostPromptProcessing } from '../../types';
import { PresetSlider } from './PresetSlider';
import { PromptOrderEditor } from '../../components/settings/PromptOrderEditor';

// Preset Settings Component
export function PresetSettings({
  presets,
  onRefresh,
}: {
  presets: Preset[];
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportPreset = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportSuccess(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!isValidPresetFormat(data)) {
        throw new Error('Invalid preset format. Expected SillyTavern-style preset JSON.');
      }

      const preset = parseSillyTavernPreset(data, file.name);

      // Save to database
      await presetOps.add(preset);
      onRefresh();
      setImportSuccess(t('settings.presets.importedPresetCount', { name: preset.name, count: preset.prompts?.length || 0 }));
    } catch (error) {
      console.error('Preset import error:', error);
      setImportError(error instanceof Error ? error.message : 'Failed to import preset');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white font-serif tracking-tight">{t('settings.presets.title')}</h2>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportPreset}
            className="hidden"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4" />
            {t('common.import')}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditingPreset(null);
              setIsModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4" />
            {t('settings.presets.newPreset')}
          </Button>
        </div>
      </div>

      {/* Import Status */}
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
        {t('settings.presets.noPresetsDesc')}
      </p>

      <div className="space-y-3">
        {presets.map((preset) => (
          <div
            key={preset.id}
            className={`glass-sm p-4 ${preset.isDefault ? 'border-parlor-500/30' : ''}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-white">{preset.name}</h3>
                  {preset.isDefault && (
                    <span className="text-xs bg-parlor-500/20 text-parlor-400 px-2 py-0.5 rounded-full">
                      Default
                    </span>
                  )}
                  {preset.prompts && preset.prompts.length > 0 && (
                    <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                      {preset.prompts.length} prompts
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-400">
                  <span>Temperature: {preset.temperature}</span>
                  <span>Top P: {preset.topP}</span>
                  <span>Max Tokens: {preset.maxTokens}</span>
                  {preset.frequencyPenalty !== 0 && (
                    <span>Freq Penalty: {preset.frequencyPenalty}</span>
                  )}
                  {preset.presencePenalty !== 0 && (
                    <span>Pres Penalty: {preset.presencePenalty}</span>
                  )}
                </div>
                {preset.prompts && preset.prompts.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
                      View prompt configuration
                    </summary>
                    <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                      {preset.prompts.filter(p => p.enabled !== false).map((prompt) => (
                        <div key={prompt.identifier} className="text-xs text-gray-500 flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${prompt.marker ? 'bg-yellow-500' : 'bg-green-500'}`} />
                          <span className="truncate">{prompt.name}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {!preset.isDefault && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      await presetOps.setDefault(preset.id);
                      onRefresh();
                    }}
                  >
                    {t('settings.presets.setDefault')}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => {
                  setEditingPreset(preset);
                  setIsModalOpen(true);
                }}>
                  <Edit3 className="w-4 h-4" />
                </Button>
                {!preset.isDefault && (
                  <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(preset.id)}>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <PresetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        preset={editingPreset}
        onSave={async (data) => {
          if (editingPreset) {
            await presetOps.update(editingPreset.id, data);
          } else {
            await presetOps.add({
              ...data,
              id: generateUUID(),
              createdAt: Date.now(),
              updatedAt: Date.now(),
            } as Preset);
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
            await presetOps.delete(deleteConfirm);
            onRefresh();
            setDeleteConfirm(null);
          }
        }}
        title={t('settings.presets.deletePreset')}
        message={t('settings.presets.deletePresetConfirm')}
        confirmText={t('common.delete')}
        variant="danger"
      />
    </div>
  );
}

// Preset Modal
export function PresetModal({
  isOpen,
  onClose,
  preset,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  preset: Preset | null;
  onSave: (data: Partial<Preset>) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [temperature, setTemperature] = useState(0.8);
  const [topP, setTopP] = useState(0.9);
  const [topK, setTopK] = useState<number | undefined>(undefined);
  const [minP, setMinP] = useState<number | undefined>(undefined);
  const [frequencyPenalty, setFrequencyPenalty] = useState(0);
  const [presencePenalty, setPresencePenalty] = useState(0);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [stopSequences, setStopSequences] = useState('');
  const [reasoningMode, setReasoningMode] = useState<ReasoningMode | undefined>(undefined);
  const [reasoningBudgetTokens, setReasoningBudgetTokens] = useState<number>(8192);
  const [postPromptProcessing, setPostPromptProcessing] = useState<PostPromptProcessing>('none');
  const [isLoading, setIsLoading] = useState(false);
  const [prompts, setPrompts] = useState<Preset['prompts']>([]);
  const [promptOrder, setPromptOrder] = useState<PromptOrderEntry[]>([]);
  const [activePromptIndex, setActivePromptIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'params' | 'prompts' | 'order' | 'utility'>('params');

  // Utility prompts state
  const [impersonationPrompt, setImpersonationPrompt] = useState('');
  const [continueNudgePrompt, setContinueNudgePrompt] = useState('');
  const [newChatPrompt, setNewChatPrompt] = useState('');
  const [newExampleChatPrompt, setNewExampleChatPrompt] = useState('');
  const [groupNudgePrompt, setGroupNudgePrompt] = useState('');
  const [scenarioFormat, setScenarioFormat] = useState('{{scenario}}');
  const [personalityFormat, setPersonalityFormat] = useState('{{personality}}');
  const [wiFormat, setWiFormat] = useState('{0}');

  useEffect(() => {
    if (preset) {
      setName(preset.name);
      setTemperature(preset.temperature);
      setTopP(preset.topP);
      setTopK(preset.topK);
      setMinP(preset.minP);
      setFrequencyPenalty(preset.frequencyPenalty);
      setPresencePenalty(preset.presencePenalty);
      setMaxTokens(preset.maxTokens);
      setStopSequences(preset.stopSequences?.join(', ') || '');
      setReasoningMode(preset.reasoningMode);
      setReasoningBudgetTokens(preset.reasoningBudgetTokens ?? 8192);
      setPostPromptProcessing(preset.post_prompt_processing || 'none');
      setPrompts(preset.prompts || []);
      setPromptOrder(preset.prompt_order || []);
      // Load utility prompts
      setImpersonationPrompt(preset.impersonation_prompt || '');
      setContinueNudgePrompt(preset.continue_nudge_prompt || '');
      setNewChatPrompt(preset.new_chat_prompt || '');
      setNewExampleChatPrompt(preset.new_example_chat_prompt || '');
      setGroupNudgePrompt(preset.group_nudge_prompt || '');
      setScenarioFormat(preset.scenario_format || '{{scenario}}');
      setPersonalityFormat(preset.personality_format || '{{personality}}');
      setWiFormat(preset.wi_format || '{0}');
    } else {
      setName('');
      setTemperature(0.8);
      setTopP(0.9);
      setTopK(undefined);
      setMinP(undefined);
      setFrequencyPenalty(0);
      setPresencePenalty(0);
      setMaxTokens(2048);
      setStopSequences('');
      setReasoningMode(undefined);
      setReasoningBudgetTokens(8192);
      setReasoningEffort(undefined);
      setPostPromptProcessing('none');
      setPrompts([]);
      // Reset utility prompts
      setImpersonationPrompt('');
      setContinueNudgePrompt('');
      setNewChatPrompt('');
      setNewExampleChatPrompt('');
      setGroupNudgePrompt('');
      setScenarioFormat('{{scenario}}');
      setPersonalityFormat('{{personality}}');
      setWiFormat('{0}');
    }
    setActivePromptIndex(null);
    setActiveTab('params');
  }, [preset]);

  const handleSave = async () => {
    if (!name.trim()) return;

    setIsLoading(true);
    try {
      await onSave({
        name: name.trim(),
        temperature,
        topP,
        topK,
        minP,
        frequencyPenalty,
        presencePenalty,
        maxTokens,
        stopSequences: stopSequences.split(',').map(s => s.trim()).filter(Boolean),
        reasoningMode,
        reasoningBudgetTokens: reasoningMode === 'deepseek' ? reasoningBudgetTokens : undefined,
        post_prompt_processing: postPromptProcessing,
        isDefault: preset?.isDefault || false,
        prompts: prompts && prompts.length > 0 ? prompts : undefined,
        prompt_order: promptOrder.length > 0 ? promptOrder : undefined,
        // Save utility prompts
        impersonation_prompt: impersonationPrompt,
        continue_nudge_prompt: continueNudgePrompt,
        new_chat_prompt: newChatPrompt,
        new_example_chat_prompt: newExampleChatPrompt,
        group_nudge_prompt: groupNudgePrompt,
        scenario_format: scenarioFormat,
        personality_format: personalityFormat,
        wi_format: wiFormat,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updatePrompt = (index: number, updates: Partial<NonNullable<Preset['prompts']>[0]>) => {
    setPrompts(prev => prev?.map((p, i) => i === index ? { ...p, ...updates } : p) || []);
  };

  const togglePromptEnabled = (index: number) => {
    setPrompts(prev => prev?.map((p, i) => i === index ? { ...p, enabled: !p.enabled } : p) || []);
  };

  const movePrompt = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= (prompts?.length || 0)) return;

    const newPrompts = [...(prompts || [])];
    [newPrompts[index], newPrompts[newIndex]] = [newPrompts[newIndex], newPrompts[index]];
    setPrompts(newPrompts);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={preset ? t('settings.presets.editPreset') : t('settings.presets.newPreset')}
      size="xl"
    >
      <div className="space-y-4">
        <Input
          label={t('settings.presets.presetName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('settings.presets.presetNamePlaceholder')}
        />

        {/* Tab Switcher */}
        <div className="flex gap-1 p-1 bg-dark-200 rounded-lg">
          <button
            onClick={() => setActiveTab('params')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'params' ? 'bg-parlor-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Parameters
          </button>
          <button
            onClick={() => setActiveTab('prompts')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'prompts' ? 'bg-parlor-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Prompts ({prompts?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('order')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'order' ? 'bg-parlor-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Order
          </button>
          <button
            onClick={() => setActiveTab('utility')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'utility' ? 'bg-parlor-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Utility
          </button>
        </div>

        {activeTab === 'utility' && (
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            <p className="text-sm text-gray-400">
              Utility prompts are used for special actions like impersonation (AI writes as user) or continuing generation.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Impersonation Prompt
              </label>
              <Textarea
                value={impersonationPrompt}
                onChange={(e) => setImpersonationPrompt(e.target.value)}
                placeholder="[Write your next reply from the point of view of {{user}}...]"
                rows={3}
                className="text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Used when asking the AI to write as the user. Use {'{{user}}'} as a placeholder.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Continue Nudge Prompt
              </label>
              <Textarea
                value={continueNudgePrompt}
                onChange={(e) => setContinueNudgePrompt(e.target.value)}
                placeholder="[Continue your last message without repeating its original content.]"
                rows={2}
                className="text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Appended when using "Continue Generation" to extend AI responses.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                New Chat Prompt
              </label>
              <Textarea
                value={newChatPrompt}
                onChange={(e) => setNewChatPrompt(e.target.value)}
                placeholder="[Start a new Chat]"
                rows={2}
                className="text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                System instruction appended when starting a fresh conversation.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Example Chat Prompt
              </label>
              <Input
                value={newExampleChatPrompt}
                onChange={(e) => setNewExampleChatPrompt(e.target.value)}
                placeholder="[Example Chat]"
              />
              <p className="text-xs text-gray-500 mt-1">
                Separator text placed before example dialogue blocks.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Group Nudge Prompt
              </label>
              <Textarea
                value={groupNudgePrompt}
                onChange={(e) => setGroupNudgePrompt(e.target.value)}
                placeholder="[Write the next reply only as {{char}}.]"
                rows={2}
                className="text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Injected in group chats to tell the model which character to write as. Use {'{{char}}'}, {'{{user}}'}, {'{{group}}'}.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Scenario Format
                </label>
                <Input
                  value={scenarioFormat}
                  onChange={(e) => setScenarioFormat(e.target.value)}
                  placeholder="{{scenario}}"
                />
                <p className="text-xs text-gray-500 mt-1">
                  How to format the scenario in prompts.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Personality Format
                </label>
                <Input
                  value={personalityFormat}
                  onChange={(e) => setPersonalityFormat(e.target.value)}
                  placeholder="{{personality}}"
                />
                <p className="text-xs text-gray-500 mt-1">
                  How to format personality in prompts.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                World Info Format
              </label>
              <Input
                value={wiFormat}
                onChange={(e) => setWiFormat(e.target.value)}
                placeholder="{0}"
              />
              <p className="text-xs text-gray-500 mt-1">
                How to format each World Info entry before injection. Use {'{0}'} as a placeholder for the entry content.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'prompts' && (
          <PromptsEditor
            prompts={prompts}
            activePromptIndex={activePromptIndex}
            onSelectPrompt={setActivePromptIndex}
            onUpdatePrompt={updatePrompt}
            onToggleEnabled={togglePromptEnabled}
            onMovePrompt={movePrompt}
          />
        )}

        {activeTab === 'order' && (
          <PromptOrderEditor
            prompts={(prompts || []) as PromptEntry[]}
            promptOrder={promptOrder}
            onPromptsChange={(updated) => setPrompts(updated)}
            onOrderChange={setPromptOrder}
          />
        )}

        {activeTab === 'params' && (
          <div className="space-y-4">
            <PresetSlider
              label="Temperature"
              value={temperature}
              min={0} max={2} step={0.05}
              hint={['Precise', 'Creative']}
              onChange={setTemperature}
            />
            <PresetSlider
              label="Top P"
              value={topP}
              min={0} max={1} step={0.05}
              onChange={setTopP}
            />
            <PresetSlider
              label="Min P"
              value={minP ?? 0}
              min={0} max={1} step={0.05}
              onChange={v => setMinP(v === 0 ? undefined : v)}
            />
            <PresetSlider
              label="Max Tokens"
              value={maxTokens}
              min={100} max={131072} step={256}
              isInt
              hint={['100', '131072']}
              onChange={v => setMaxTokens(Math.round(v))}
            />
            <PresetSlider
              label="Frequency Penalty"
              value={frequencyPenalty}
              min={0} max={2} step={0.1}
              onChange={setFrequencyPenalty}
            />
            <PresetSlider
              label="Presence Penalty"
              value={presencePenalty}
              min={0} max={2} step={0.1}
              onChange={setPresencePenalty}
            />

            {/* Reasoning Mode */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <Brain className="w-4 h-4 text-parlor-400" />
                Reasoning Mode
              </label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'none', label: 'Off' },
                  { value: 'auto', label: 'Auto' },
                  { value: 'deepseek', label: 'DeepSeek' },
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setReasoningMode(reasoningMode === option.value ? undefined : option.value)}
                    className={`py-1.5 px-2 rounded-lg text-xs transition-colors ${
                      (reasoningMode ?? 'none') === option.value
                        ? 'bg-parlor-500 text-white'
                        : 'bg-dark-100 border border-glass-border text-gray-400 hover:text-white'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {reasoningMode === 'deepseek' && (
                <div className="mt-3 space-y-1">
                  <PresetSlider
                    label="Thinking Budget (tokens)"
                    value={reasoningBudgetTokens}
                    min={1024} max={16384} step={512}
                    isInt
                    hint={['1K', '16K']}
                    onChange={v => setReasoningBudgetTokens(Math.round(v))}
                  />
                  <p className="text-xs text-gray-500">
                    Higher budget = deeper reasoning but slower and more expensive.
                  </p>
                </div>
              )}
            </div>

            {/* Stop Sequences */}
            <Input
              label="Stop Sequences (comma separated)"
              value={stopSequences}
              onChange={(e) => setStopSequences(e.target.value)}
              placeholder="\n, END, ---"
            />

            {/* Post-Prompt Processing */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Post-Prompt Processing
              </label>
              <select
                value={postPromptProcessing}
                onChange={(e) => setPostPromptProcessing(e.target.value as PostPromptProcessing)}
                className="w-full px-3 py-2 rounded-lg bg-dark-100 border border-glass-border text-white text-sm"
              >
                <optgroup label="None">
                  <option value="none">None</option>
                </optgroup>
                <optgroup label="With Tools">
                  <option value="merge_tools">Merge consecutive roles (with tools)</option>
                  <option value="semi_strict_tools">Semi-strict (alternating roles; with tools)</option>
                  <option value="strict_tools">Strict (user first, alternating roles; with tools)</option>
                </optgroup>
                <optgroup label="No Tools">
                  <option value="merge">Merge consecutive roles (no tools)</option>
                  <option value="semi_strict">Semi-strict (alternating roles; no tools)</option>
                  <option value="strict">Strict (user first, alternating roles; no tools)</option>
                  <option value="single_user">Single user message (no tools)</option>
                </optgroup>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Controls how messages are formatted before sending to the API. Use strict modes for models that require role alternation.
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} isLoading={isLoading} disabled={!name.trim()}>
            {preset ? t('common.save') : t('settings.presets.createPreset')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// Prompts Editor Component
export function PromptsEditor({
  prompts,
  activePromptIndex,
  onSelectPrompt,
  onUpdatePrompt,
  onToggleEnabled,
  onMovePrompt,
}: {
  prompts: Preset['prompts'];
  activePromptIndex: number | null;
  onSelectPrompt: (index: number | null) => void;
  onUpdatePrompt: (index: number, updates: Partial<NonNullable<Preset['prompts']>[0]>) => void;
  onToggleEnabled: (index: number) => void;
  onMovePrompt: (index: number, direction: 'up' | 'down') => void;
}) {
  if (!prompts || prompts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>No prompts in this preset.</p>
        <p className="text-sm mt-1">Import a SillyTavern preset to add prompts.</p>
      </div>
    );
  }

  const activePrompt = activePromptIndex !== null ? prompts[activePromptIndex] : null;

  // Shared prompt editor panel
  const promptEditor = activePrompt && activePromptIndex !== null ? (
    <div className="h-full flex flex-col">
      <div className="p-2 bg-dark-100 border-b border-glass-border flex items-center justify-between gap-2">
        {/* Back button — mobile only */}
        <button
          onClick={() => onSelectPrompt(null)}
          className="sm:hidden p-1 rounded hover:bg-glass-white text-gray-400 flex-shrink-0"
        >
          ←
        </button>
        <span className="text-sm font-medium text-white truncate">{activePrompt.name}</span>
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={() => onMovePrompt(activePromptIndex, 'up')}
            disabled={activePromptIndex === 0}
            className="p-1 rounded hover:bg-glass-white disabled:opacity-30"
          >
            ↑
          </button>
          <button
            onClick={() => onMovePrompt(activePromptIndex, 'down')}
            disabled={activePromptIndex === prompts.length - 1}
            className="p-1 rounded hover:bg-glass-white disabled:opacity-30"
          >
            ↓
          </button>
          <button
            onClick={() => onToggleEnabled(activePromptIndex)}
            className={`px-2 py-1 rounded text-xs ${
              activePrompt.enabled !== false ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}
          >
            {activePrompt.enabled !== false ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
      <div className="flex-1 p-3 overflow-y-auto space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Name</label>
          <Input
            value={activePrompt.name}
            onChange={(e) => onUpdatePrompt(activePromptIndex, { name: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Role</label>
          <select
            value={activePrompt.role}
            onChange={(e) => onUpdatePrompt(activePromptIndex, { role: e.target.value as 'system' | 'user' | 'assistant' })}
            className="w-full px-3 py-2 rounded-lg bg-dark-100 border border-glass-border text-white text-sm"
          >
            <option value="system">System</option>
            <option value="user">User</option>
            <option value="assistant">Assistant</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Content</label>
          <Textarea
            value={activePrompt.content || ''}
            onChange={(e) => onUpdatePrompt(activePromptIndex, { content: e.target.value })}
            rows={12}
            className="font-mono text-xs !min-h-[200px]"
          />
        </div>
        {activePrompt.injection_position !== undefined && (
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Injection Position</label>
            <Input
              type="number"
              value={activePrompt.injection_position}
              onChange={(e) => onUpdatePrompt(activePromptIndex, { injection_position: parseInt(e.target.value) })}
            />
          </div>
        )}
        {(activePrompt.identifier === 'main' || activePrompt.identifier === 'jailbreak') && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={activePrompt.forbid_overrides || false}
                onChange={(e) => onUpdatePrompt(activePromptIndex, { forbid_overrides: e.target.checked })}
                className="rounded border-glass-border bg-dark-100"
              />
              Forbid Overrides
            </label>
            <p className="text-xs text-gray-500">
              Prevents character card from replacing this prompt's content.
            </p>
          </div>
        )}
        {activePrompt.marker && (
          <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs text-yellow-400">
            This is a marker prompt (used for depth positioning)
          </div>
        )}
      </div>
    </div>
  ) : null;

  // Shared prompt list panel
  const promptList = (
    <div className="h-full flex flex-col">
      <div className="p-2 bg-dark-100 border-b border-glass-border text-xs font-medium text-gray-400">
        Prompts ({prompts.length})
      </div>
      <div className="overflow-y-auto flex-1">
        {prompts.map((prompt, index) => (
          <button
            key={prompt.identifier}
            onClick={() => onSelectPrompt(index)}
            className={`w-full p-2 text-left border-b border-glass-border/50 transition-colors ${
              activePromptIndex === index ? 'bg-parlor-500/20' : 'hover:bg-glass-white'
            } ${!prompt.enabled ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${prompt.marker ? 'bg-yellow-500' : 'bg-green-500'}`} />
              <span className="text-sm text-white truncate">{prompt.name}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500">{prompt.role}</span>
              {prompt.injection_position !== undefined && (
                <span className="text-xs text-gray-500">pos: {prompt.injection_position}</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile: stacked single-panel view */}
      <div className="sm:hidden min-h-[400px] border border-glass-border rounded-lg overflow-hidden">
        {activePrompt ? promptEditor : promptList}
      </div>

      {/* Desktop: side-by-side */}
      <div className="hidden sm:flex gap-4 h-[60vh] min-h-[400px]">
        <div className="w-1/3 border border-glass-border rounded-lg overflow-hidden">
          {promptList}
        </div>
        <div className="flex-1 border border-glass-border rounded-lg overflow-hidden">
          {promptEditor || (
            <div className="h-full flex items-center justify-center text-gray-500">
              Select a prompt to edit
            </div>
          )}
        </div>
      </div>
    </>
  );
}

