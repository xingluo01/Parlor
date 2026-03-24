import { useState, useEffect } from 'react';
import { Zap, Settings as SettingsIcon, Brain, Save, Bell, MessageSquare, Plus, Trash2, GripVertical, Volume2, Languages, ImageIcon } from 'lucide-react';
import { Button } from '../../components/ui';
import type { AppSettings, ReasoningMode, QuickReply, ImageGenSettings } from '../../types';
import { PresetSlider } from './PresetSlider';
import { generateUUID } from '../../utils/uuid';

// General Settings Component
export function GeneralSettings({
  settings,
  onUpdate,
}: {
  settings: AppSettings | null;
  onUpdate: (updates: Partial<AppSettings>) => Promise<void>;
}) {
  // Local state for all settings
  const [contextSize, setContextSize] = useState(20);
  const [contextSizeInTokens, setContextSizeInTokens] = useState(4096);
  const [avatarSize, setAvatarSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [autoHideMobileMenus, setAutoHideMobileMenus] = useState(true);
  const [notifyOnComplete, setNotifyOnComplete] = useState(false);
  const [autoContinue, setAutoContinue] = useState(false);
  const [autoSummarize, setAutoSummarize] = useState(false);
  const [autoSummarizeInterval, setAutoSummarizeInterval] = useState(20);
  const [maxResponseTokens, setMaxResponseTokens] = useState(4096);
  const [reasoningMode, setReasoningMode] = useState<ReasoningMode>('auto');
  const [reasoningEffort, setReasoningEffort] = useState<'low' | 'medium' | 'high'>('medium');
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [ttsAutoPlay, setTtsAutoPlay] = useState(false);
  const [translateLanguage, setTranslateLanguage] = useState('');
  const [imageGen, setImageGen] = useState<ImageGenSettings>({ enabled: false, provider: 'dalle' });
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load settings when they change
  useEffect(() => {
    if (settings) {
      setContextSize(settings.contextSize || 20);
      setContextSizeInTokens(settings.contextSizeInTokens || 4096);
      setAvatarSize(settings.avatarSize || 'medium');
      setAutoHideMobileMenus(settings.autoHideMobileMenus ?? true);
      setNotifyOnComplete(settings.notifyOnComplete ?? false);
      setAutoContinue(settings.autoContinue ?? false);
      setAutoSummarize(settings.autoSummarize ?? false);
      setAutoSummarizeInterval(settings.autoSummarizeInterval ?? 20);
      setMaxResponseTokens(settings.maxResponseTokens || 4096);
      setReasoningMode(settings.reasoningMode || 'auto');
      setReasoningEffort(settings.reasoningEffort || 'medium');
      setQuickReplies(settings.quickReplies || []);
      setTtsEnabled(settings.ttsEnabled ?? false);
      setTtsAutoPlay(settings.ttsAutoPlay ?? false);
      setTranslateLanguage(settings.translateLanguage || '');
      if (settings.imageGen) setImageGen(settings.imageGen);
    }
  }, [settings]);

  // Track changes
  useEffect(() => {
    if (settings) {
      const changed =
        contextSize !== settings.contextSize ||
        contextSizeInTokens !== (settings.contextSizeInTokens || 4096) ||
        avatarSize !== settings.avatarSize ||
        autoHideMobileMenus !== settings.autoHideMobileMenus ||
        notifyOnComplete !== (settings.notifyOnComplete ?? false) ||
        autoContinue !== (settings.autoContinue ?? false) ||
        autoSummarize !== (settings.autoSummarize ?? false) ||
        autoSummarizeInterval !== (settings.autoSummarizeInterval ?? 20) ||
        maxResponseTokens !== (settings.maxResponseTokens || 4096) ||
        reasoningMode !== (settings.reasoningMode || 'auto') ||
        reasoningEffort !== (settings.reasoningEffort || 'medium') ||
        JSON.stringify(quickReplies) !== JSON.stringify(settings.quickReplies || []) ||
        ttsEnabled !== (settings.ttsEnabled ?? false) ||
        ttsAutoPlay !== (settings.ttsAutoPlay ?? false) ||
        translateLanguage !== (settings.translateLanguage || '') ||
        JSON.stringify(imageGen) !== JSON.stringify(settings.imageGen || { enabled: false, provider: 'dalle' });
      setHasChanges(changed);
    }
  }, [contextSize, contextSizeInTokens, avatarSize, autoHideMobileMenus, notifyOnComplete, autoContinue, autoSummarize, autoSummarizeInterval, maxResponseTokens, reasoningMode, reasoningEffort, quickReplies, ttsEnabled, ttsAutoPlay, translateLanguage, imageGen, settings]);

  const handleSave = async () => {
    setIsSaving(true);
    await onUpdate({
      contextSize,
      contextSizeInTokens,
      avatarSize,
      autoHideMobileMenus,
      notifyOnComplete,
      autoContinue,
      autoSummarize,
      autoSummarizeInterval,
      maxResponseTokens,
      reasoningMode,
      reasoningEffort,
      quickReplies,
      ttsEnabled,
      ttsAutoPlay,
      translateLanguage: translateLanguage || undefined,
      imageGen,
    });
    setIsSaving(false);
    setHasChanges(false);
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4 font-serif tracking-tight">General Settings</h2>

      <div className="space-y-8">
        {/* Display Settings */}
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" />
            Display
          </h3>

          <div className="space-y-4">
            {/* Avatar Size */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Chat Avatar Size
              </label>
              <div className="flex gap-2">
                {(['small', 'medium', 'large'] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => setAvatarSize(size)}
                    className={`
                      flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all
                      ${avatarSize === size
                        ? 'bg-parlor-500/12 border border-parlor-500/15 text-white'
                        : 'bg-dark-100 border border-glass-border text-gray-400 hover:text-white'}
                    `}
                  >
                    {size.charAt(0).toUpperCase() + size.slice(1)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Size of avatars shown in chat messages.
              </p>
            </div>

            {/* Auto-hide Mobile Menus */}
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Auto-Hide Menus on Mobile
                </label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Hide top/bottom navigation when scrolling in chat.
                </p>
              </div>
              <button
                onClick={() => setAutoHideMobileMenus(!autoHideMobileMenus)}
                className={`
                  w-12 h-6 rounded-full transition-colors relative
                  ${autoHideMobileMenus ? 'bg-parlor-500' : 'bg-dark-100'}
                `}
              >
                <span
                  className={`
                    absolute top-1 w-4 h-4 rounded-full bg-white transition-transform
                    ${autoHideMobileMenus ? 'left-7' : 'left-1'}
                  `}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notifications
          </h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Notify When Response Completes
                </label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Show a browser notification when generation finishes while you're on another tab.
                </p>
              </div>
              <button
                onClick={async () => {
                  const next = !notifyOnComplete;
                  if (next && Notification.permission === 'default') {
                    await Notification.requestPermission();
                  }
                  setNotifyOnComplete(next);
                }}
                className={`
                  w-12 h-6 rounded-full transition-colors relative flex-shrink-0
                  ${notifyOnComplete ? 'bg-parlor-500' : 'bg-dark-100'}
                `}
              >
                <span
                  className={`
                    absolute top-1 w-4 h-4 rounded-full bg-white transition-transform
                    ${notifyOnComplete ? 'left-7' : 'left-1'}
                  `}
                />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Auto-Summarize Long Chats
                </label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Automatically summarize earlier messages when the conversation gets long.
                </p>
              </div>
              <button
                onClick={() => setAutoSummarize(!autoSummarize)}
                className={`
                  w-12 h-6 rounded-full transition-colors relative flex-shrink-0
                  ${autoSummarize ? 'bg-parlor-500' : 'bg-dark-100'}
                `}
              >
                <span
                  className={`
                    absolute top-1 w-4 h-4 rounded-full bg-white transition-transform
                    ${autoSummarize ? 'left-7' : 'left-1'}
                  `}
                />
              </button>
            </div>
            {autoSummarize && (
              <PresetSlider
                label="Summarize Every N Messages"
                value={autoSummarizeInterval}
                min={10} max={100} step={5}
                isInt
                hint={['10 msgs', '100 msgs']}
                onChange={v => setAutoSummarizeInterval(Math.round(v))}
              />
            )}
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Auto-Continue on Token Limit
                </label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Automatically continue generation when a response is cut off by the max token limit.
                </p>
              </div>
              <button
                onClick={() => setAutoContinue(!autoContinue)}
                className={`
                  w-12 h-6 rounded-full transition-colors relative flex-shrink-0
                  ${autoContinue ? 'bg-parlor-500' : 'bg-dark-100'}
                `}
              >
                <span
                  className={`
                    absolute top-1 w-4 h-4 rounded-full bg-white transition-transform
                    ${autoContinue ? 'left-7' : 'left-1'}
                  `}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Replies */}
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Quick Replies
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Shortcut buttons shown above the chat input. Use {'{{char}}'} and {'{{user}}'} for character/user names.
          </p>
          <div className="space-y-2">
            {quickReplies.map((qr, idx) => (
              <div key={qr.id} className="flex items-start gap-2 bg-dark-100 border border-glass-border rounded-lg p-2">
                <GripVertical className="w-4 h-4 text-gray-600 mt-2 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="flex gap-2">
                    <input
                      value={qr.label}
                      onChange={e => {
                        const updated = [...quickReplies];
                        updated[idx] = { ...qr, label: e.target.value };
                        setQuickReplies(updated);
                      }}
                      placeholder="Label"
                      className="flex-1 text-sm bg-dark-200 border border-glass-border rounded px-2 py-1 text-white placeholder-gray-500 focus:outline-none focus:border-parlor-500"
                    />
                    <select
                      value={qr.action}
                      onChange={e => {
                        const updated = [...quickReplies];
                        updated[idx] = { ...qr, action: e.target.value as 'send' | 'insert' };
                        setQuickReplies(updated);
                      }}
                      className="text-xs bg-dark-200 border border-glass-border rounded px-2 py-1 text-gray-300 focus:outline-none focus:border-parlor-500"
                    >
                      <option value="send">Send</option>
                      <option value="insert">Insert</option>
                    </select>
                  </div>
                  <input
                    value={qr.content}
                    onChange={e => {
                      const updated = [...quickReplies];
                      updated[idx] = { ...qr, content: e.target.value };
                      setQuickReplies(updated);
                    }}
                    placeholder="Content to send or insert..."
                    className="w-full text-sm bg-dark-200 border border-glass-border rounded px-2 py-1 text-white placeholder-gray-500 focus:outline-none focus:border-parlor-500"
                  />
                </div>
                <button
                  onClick={() => setQuickReplies(quickReplies.filter((_, i) => i !== idx))}
                  className="p-1 text-gray-500 hover:text-red-400 transition-colors mt-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              onClick={() => setQuickReplies([...quickReplies, {
                id: generateUUID(),
                label: '',
                content: '',
                action: 'send',
              }])}
              className="flex items-center gap-2 text-sm text-parlor-400 hover:text-parlor-300 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Quick Reply
            </button>
          </div>
        </div>

        {/* TTS Settings */}
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
            <Volume2 className="w-4 h-4" />
            Text-to-Speech
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-300">Enable TTS</label>
                <p className="text-xs text-gray-500 mt-0.5">Show speaker button on assistant messages.</p>
              </div>
              <button
                onClick={() => setTtsEnabled(!ttsEnabled)}
                className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${ttsEnabled ? 'bg-parlor-500' : 'bg-dark-100'}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${ttsEnabled ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
            {ttsEnabled && (
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-300">Auto-Play Responses</label>
                  <p className="text-xs text-gray-500 mt-0.5">Automatically read new assistant messages aloud.</p>
                </div>
                <button
                  onClick={() => setTtsAutoPlay(!ttsAutoPlay)}
                  className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${ttsAutoPlay ? 'bg-parlor-500' : 'bg-dark-100'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${ttsAutoPlay ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Auto-Translate */}
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
            <Languages className="w-4 h-4" />
            Auto-Translate
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Translate Responses To
              </label>
              <select
                value={translateLanguage}
                onChange={(e) => setTranslateLanguage(e.target.value)}
                className="w-full bg-dark-50 border border-glass-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-parlor-500"
              >
                <option value="">Disabled</option>
                <option value="Spanish">Spanish</option>
                <option value="French">French</option>
                <option value="German">German</option>
                <option value="Portuguese">Portuguese</option>
                <option value="Italian">Italian</option>
                <option value="Japanese">Japanese</option>
                <option value="Korean">Korean</option>
                <option value="Chinese">Chinese</option>
                <option value="Russian">Russian</option>
                <option value="Arabic">Arabic</option>
                <option value="Hindi">Hindi</option>
                <option value="Dutch">Dutch</option>
                <option value="Polish">Polish</option>
                <option value="Turkish">Turkish</option>
                <option value="Thai">Thai</option>
                <option value="Vietnamese">Vietnamese</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                When set, adds a system instruction for the AI to respond in the selected language. No external API needed.
              </p>
            </div>
          </div>
        </div>

        {/* Image Generation */}
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            Image Generation
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-300">Enable Image Generation</label>
                <p className="text-xs text-gray-500 mt-0.5">Allow generating images in chat via /imagine command.</p>
              </div>
              <button
                onClick={() => setImageGen(prev => ({ ...prev, enabled: !prev.enabled }))}
                className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${imageGen.enabled ? 'bg-parlor-500' : 'bg-dark-100'}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${imageGen.enabled ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
            {imageGen.enabled && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Provider</label>
                  <div className="flex gap-2">
                    {([
                      { value: 'dalle', label: 'DALL-E' },
                      { value: 'sd-webui', label: 'SD WebUI' },
                      { value: 'comfyui', label: 'ComfyUI' },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setImageGen(prev => ({ ...prev, provider: opt.value }))}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                          imageGen.provider === opt.value
                            ? 'bg-parlor-500/12 border border-parlor-500/15 text-white'
                            : 'bg-dark-100 border border-glass-border text-gray-400 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {imageGen.provider !== 'dalle' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Endpoint</label>
                    <input
                      type="text"
                      value={imageGen.endpoint || ''}
                      onChange={(e) => setImageGen(prev => ({ ...prev, endpoint: e.target.value }))}
                      placeholder={imageGen.provider === 'sd-webui' ? 'http://localhost:7860' : 'http://localhost:8188'}
                      className="w-full text-sm bg-dark-200 border border-glass-border rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-parlor-500"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Response Settings */}
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Response
          </h3>

          <div className="space-y-4">
            {/* Context Size (Messages) */}
            <div>
              <PresetSlider
                label="Context Size (Messages)"
                value={contextSize}
                min={5} max={200} step={5}
                isInt
                hint={['5 msgs', '200 msgs']}
                onChange={v => setContextSize(Math.round(v))}
              />
              <p className="text-xs text-gray-500 mt-1">
                Fallback when token-based context is unavailable.
              </p>
            </div>

            {/* Context Size (Tokens) */}
            <PresetSlider
              label="Context Size (Tokens)"
              value={contextSizeInTokens}
              min={1024} max={200000} step={1024}
              isInt
              hint={['1K', '200K']}
              onChange={v => setContextSizeInTokens(Math.round(v))}
            />

            {/* Max Response Tokens */}
            <PresetSlider
              label="Max Response Length (Tokens)"
              value={maxResponseTokens}
              min={100} max={131072} step={256}
              isInt
              hint={['100', '131072']}
              onChange={v => setMaxResponseTokens(Math.round(v))}
            />
          </div>
        </div>

        {/* Reasoning Settings */}
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
            <Brain className="w-4 h-4" />
            Reasoning
          </h3>

          <div className="space-y-4">
            {/* Reasoning Mode */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Reasoning Mode
              </label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'none', label: 'Off', desc: 'No reasoning' },
                  { value: 'auto', label: 'Auto', desc: 'Detect from model' },
                  { value: 'openai', label: 'OpenAI', desc: 'o1/o3/o4 models' },
                  { value: 'anthropic', label: 'Anthropic', desc: 'Claude thinking models' },
                  { value: 'deepseek', label: 'DeepSeek', desc: 'R1 models' },
                  { value: 'glm', label: 'GLM', desc: 'Thinking models' },
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setReasoningMode(option.value)}
                    className={`
                      py-2 px-3 rounded-lg text-sm transition-all text-left
                      ${reasoningMode === option.value
                        ? 'bg-parlor-500/12 border border-parlor-500/15 text-white'
                        : 'bg-dark-100 border border-glass-border text-gray-400 hover:text-white'}
                    `}
                  >
                    <div className="font-medium">{option.label}</div>
                    <div className="text-xs opacity-60">{option.desc}</div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Enable extended reasoning for OpenAI o1/o3/o4, Claude, DeepSeek R1, or GLM models. "Auto" detects based on model name.
              </p>
            </div>

            {/* Reasoning Effort - Only for OpenAI mode */}
            {reasoningMode === 'openai' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Reasoning Effort
                </label>
                <div className="flex gap-2">
                  {(['low', 'medium', 'high'] as const).map((effort) => (
                    <button
                      key={effort}
                      onClick={() => setReasoningEffort(effort)}
                      className={`
                        flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all
                        ${reasoningEffort === effort
                          ? 'bg-parlor-500/12 border border-parlor-500/15 text-white'
                          : 'bg-dark-100 border border-glass-border text-gray-400 hover:text-white'}
                      `}
                    >
                      {effort.charAt(0).toUpperCase() + effort.slice(1)}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Controls how much "thinking" the model does. Higher = more reasoning, slower response.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t border-glass-border">
          <Button
            onClick={handleSave}
            isLoading={isSaving}
            disabled={!hasChanges}
          >
            <Save className="w-4 h-4" />
            {hasChanges ? 'Save Changes' : 'No Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}

