import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  // Local state for all settings
  const [contextSize, setContextSize] = useState(20);
  const [contextSizeInTokens, setContextSizeInTokens] = useState(4096);
  const [avatarSize, setAvatarSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [autoHideMobileMenus, setAutoHideMobileMenus] = useState(true);
  const [notifyOnComplete, setNotifyOnComplete] = useState(false);
  const [autoContinue, setAutoContinue] = useState(false);
  const [streamResponses, setStreamResponses] = useState(true);
  const [autoScroll, setAutoScroll] = useState(false);
  const [autoSummarize, setAutoSummarize] = useState(false);
  const [autoSummarizeInterval, setAutoSummarizeInterval] = useState(20);
  const [maxResponseTokens, setMaxResponseTokens] = useState(4096);
  const [reasoningMode, setReasoningMode] = useState<ReasoningMode>('auto');
  const [reasoningEffort, setReasoningEffort] = useState<'low' | 'medium' | 'high'>('medium');
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [ttsAutoPlay, setTtsAutoPlay] = useState(false);
  const [translateLanguage, setTranslateLanguage] = useState('');
  const [responseLength, setResponseLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [cardSize, setCardSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [showStatusBar, setShowStatusBar] = useState(false);
  const [imageGen, setImageGen] = useState<ImageGenSettings>({ enabled: false, provider: 'dalle' });
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load settings when they change
  useEffect(() => {
    if (settings) {
      setContextSize(settings.contextSize || 20);
      setContextSizeInTokens(settings.contextSizeInTokens || 4096);
      setAvatarSize(settings.avatarSize || 'medium');
      setFontSize(settings.fontSize || 'medium');
      setAutoHideMobileMenus(settings.autoHideMobileMenus ?? true);
      setNotifyOnComplete(settings.notifyOnComplete ?? false);
      setAutoContinue(settings.autoContinue ?? false);
      setStreamResponses(settings.streamResponses ?? true);
      setAutoScroll(settings.autoScroll ?? false);
      setAutoSummarize(settings.autoSummarize ?? false);
      setAutoSummarizeInterval(settings.autoSummarizeInterval ?? 20);
      setMaxResponseTokens(settings.maxResponseTokens || 4096);
      setReasoningMode(settings.reasoningMode || 'auto');
      setReasoningEffort(settings.reasoningEffort || 'medium');
      setQuickReplies(settings.quickReplies || []);
      setTtsEnabled(settings.ttsEnabled ?? false);
      setTtsAutoPlay(settings.ttsAutoPlay ?? false);
      setTranslateLanguage(settings.translateLanguage || '');
      setResponseLength(settings.responseLength || 'medium');
      setCardSize(settings.cardSize || 'medium');
      setShowStatusBar(settings.showStatusBar ?? false);
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
        fontSize !== (settings.fontSize || 'medium') ||
        autoHideMobileMenus !== settings.autoHideMobileMenus ||
        notifyOnComplete !== (settings.notifyOnComplete ?? false) ||
        autoContinue !== (settings.autoContinue ?? false) ||
        streamResponses !== (settings.streamResponses ?? true) ||
        autoScroll !== (settings.autoScroll ?? false) ||
        autoSummarize !== (settings.autoSummarize ?? false) ||
        autoSummarizeInterval !== (settings.autoSummarizeInterval ?? 20) ||
        maxResponseTokens !== (settings.maxResponseTokens || 4096) ||
        reasoningMode !== (settings.reasoningMode || 'auto') ||
        reasoningEffort !== (settings.reasoningEffort || 'medium') ||
        JSON.stringify(quickReplies) !== JSON.stringify(settings.quickReplies || []) ||
        ttsEnabled !== (settings.ttsEnabled ?? false) ||
        ttsAutoPlay !== (settings.ttsAutoPlay ?? false) ||
        translateLanguage !== (settings.translateLanguage || '') ||
        responseLength !== (settings.responseLength || 'medium') ||
        cardSize !== (settings.cardSize || 'medium') ||
        showStatusBar !== (settings.showStatusBar ?? false) ||
        JSON.stringify(imageGen) !== JSON.stringify(settings.imageGen || { enabled: false, provider: 'dalle' });
      setHasChanges(changed);
    }
  }, [contextSize, contextSizeInTokens, avatarSize, fontSize, cardSize, autoHideMobileMenus, notifyOnComplete, autoContinue, streamResponses, autoScroll, autoSummarize, autoSummarizeInterval, maxResponseTokens, reasoningMode, reasoningEffort, quickReplies, ttsEnabled, ttsAutoPlay, translateLanguage, responseLength, showStatusBar, imageGen, settings]);

  const handleSave = async () => {
    setIsSaving(true);
    await onUpdate({
      contextSize,
      contextSizeInTokens,
      avatarSize,
      fontSize,
      autoHideMobileMenus,
      notifyOnComplete,
      autoContinue,
      streamResponses,
      autoScroll,
      autoSummarize,
      autoSummarizeInterval,
      maxResponseTokens,
      reasoningMode,
      reasoningEffort,
      quickReplies,
      ttsEnabled,
      ttsAutoPlay,
      translateLanguage: translateLanguage || undefined,
      responseLength,
      cardSize,
      showStatusBar,
      imageGen,
    });
    setIsSaving(false);
    setHasChanges(false);
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4 font-serif tracking-tight">{t('settings.tabs.general')}</h2>

      <div className="space-y-8">
        {/* Display Settings */}
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" />
            {t('settings.general.display')}
          </h3>

          <div className="space-y-4">
            {/* Avatar Size */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('settings.general.chatAvatarSize')}
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
                {t('settings.general.avatarSizeDesc')}
              </p>
            </div>

            {/* Auto-hide Mobile Menus */}
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  {t('settings.general.autoHideMobile')}
                </label>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t('settings.general.autoHideMobileDesc')}
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

            {/* Font Size */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">字号</label>
              <div className="flex gap-2">
                {([
                  { value: 'small', label: '小', desc: '14px' },
                  { value: 'medium', label: '中', desc: '16px' },
                  { value: 'large', label: '大', desc: '18px' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFontSize(opt.value)}
                    className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                      (fontSize || 'medium') === opt.value
                        ? 'bg-parlor-500/20 border-parlor-500/50 text-parlor-300'
                        : 'bg-dark-100 border-glass-border text-gray-400 hover:text-white'
                    }`}
                  >
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-xs opacity-70">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Card Size */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">卡片尺寸</label>
              <div className="flex gap-2">
                {([
                  { value: 'small', label: '小', desc: '160px' },
                  { value: 'medium', label: '中', desc: '200px' },
                  { value: 'large', label: '大', desc: '260px' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setCardSize(opt.value)}
                    className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                      (cardSize || 'medium') === opt.value
                        ? 'bg-parlor-500/20 border-parlor-500/50 text-parlor-300'
                        : 'bg-dark-100 border-glass-border text-gray-400 hover:text-white'
                    }`}
                  >
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-xs opacity-70">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Auto Scroll */}
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  自动滚动
                </label>
                <p className="text-xs text-gray-500 mt-0.5">
                  新消息到达时自动滚动到底部
                </p>
              </div>
              <button
                onClick={() => setAutoScroll(!autoScroll)}
                className={`
                  w-12 h-6 rounded-full transition-colors relative flex-shrink-0
                  ${autoScroll ? 'bg-parlor-500' : 'bg-dark-100'}
                `}
              >
                <span
                  className={`
                    absolute top-1 w-4 h-4 rounded-full bg-white transition-transform
                    ${autoScroll ? 'left-7' : 'left-1'}
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
            {t('settings.general.notifications')}
          </h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  {t('settings.general.notifyResponseComplete')}
                </label>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t('settings.general.notifyResponseCompleteDesc')}
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
                  {t('settings.general.autoSummarize')}
                </label>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t('settings.general.autoSummarizeDesc')}
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
                label={t('settings.general.summarizeEvery')}
                value={autoSummarizeInterval}
                min={10} max={100} step={5}
                isInt
                hint={[t('settings.general.summarizeEveryMin'), t('settings.general.summarizeEveryMax')]}
                onChange={v => setAutoSummarizeInterval(Math.round(v))}
              />
            )}
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  {t('settings.general.autoContinue')}
                </label>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t('settings.general.autoContinueDesc')}
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
            {t('settings.general.quickReplies')}
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            {t('settings.general.quickRepliesDesc')}
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
                      placeholder={t('settings.general.quickReplyLabelPlaceholder')}
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
                      <option value="send">{t('settings.general.quickReplyActionSend')}</option>
                      <option value="insert">{t('settings.general.quickReplyActionInsert')}</option>
                    </select>
                  </div>
                  <input
                    value={qr.content}
                    onChange={e => {
                      const updated = [...quickReplies];
                      updated[idx] = { ...qr, content: e.target.value };
                      setQuickReplies(updated);
                    }}
                    placeholder={t('settings.general.quickReplyContentPlaceholder')}
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
              {t('settings.general.addQuickReply')}
            </button>
          </div>
        </div>

        {/* TTS Settings */}
        <div>
            <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
            <Volume2 className="w-4 h-4" />
            {t('settings.general.tts')}
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-300">{t('settings.general.ttsEnable')}</label>
                <p className="text-xs text-gray-500 mt-0.5">{t('settings.general.ttsEnableDesc')}</p>
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
                  <label className="block text-sm font-medium text-gray-300">{t('settings.general.ttsAutoPlay')}</label>
                  <p className="text-xs text-gray-500 mt-0.5">{t('settings.general.ttsAutoPlayDesc')}</p>
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
            {t('settings.general.autoTranslate')}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('settings.general.translateResponsesTo')}
              </label>
              <select
                value={translateLanguage}
                onChange={(e) => setTranslateLanguage(e.target.value)}
                className="w-full bg-dark-50 border border-glass-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-parlor-500"
              >
                <option value="">{t('settings.general.translateDisabled')}</option>
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
                {t('settings.general.translateDesc')}
              </p>
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" />
            {t('settings.general.statusBar')}
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-300">{t('settings.general.statusBarEnable')}</label>
              <p className="text-xs text-gray-500 mt-0.5">
                {t('settings.general.statusBarDesc')}
              </p>
            </div>
            <button
              onClick={() => setShowStatusBar(!showStatusBar)}
              className={`
                w-12 h-6 rounded-full transition-colors relative flex-shrink-0
                ${showStatusBar ? 'bg-parlor-500' : 'bg-dark-100'}
              `}
            >
              <span
                className={`
                  absolute top-1 w-4 h-4 rounded-full bg-white transition-transform
                  ${showStatusBar ? 'left-7' : 'left-1'}
                `}
              />
            </button>
          </div>
        </div>

        {/* Image Generation */}
        <div>
            <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            {t('settings.general.imageGen')}
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-300">{t('settings.general.imageGenEnable')}</label>
                <p className="text-xs text-gray-500 mt-0.5">{t('settings.general.imageGenEnableDesc')}</p>
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
                  <label className="block text-sm font-medium text-gray-300 mb-2">{t('settings.general.imageGenProvider')}</label>
                  <div className="flex gap-2">
                    {([
                      { value: 'dalle', label: t('settings.general.imageGenProviderDalle') },
                      { value: 'sd-webui', label: t('settings.general.imageGenProviderSd') },
                      { value: 'comfyui', label: t('settings.general.imageGenProviderComfy') },
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
                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('settings.general.imageGenEndpoint')}</label>
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
            {t('settings.general.response')}
          </h3>

          <div className="space-y-4">
            {/* Context Size (Messages) */}
            <div>
              <PresetSlider
                label={t('settings.general.contextSizeMessages')}
                value={contextSize}
                min={5} max={200} step={5}
                isInt
                hint={[t('settings.general.contextSizeMessagesMin'), t('settings.general.contextSizeMessagesMax')]}
                onChange={v => setContextSize(Math.round(v))}
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('settings.general.contextSizeMessagesDesc')}
              </p>
            </div>

            {/* Context Size (Tokens) */}
            <PresetSlider
              label={t('settings.general.contextSizeTokens')}
              value={contextSizeInTokens}
              min={1024} max={200000} step={1024}
              isInt
              hint={[t('settings.general.contextSizeTokensMin'), t('settings.general.contextSizeTokensMax')]}
              onChange={v => setContextSizeInTokens(Math.round(v))}
            />

            {/* Max Response Tokens */}
            <PresetSlider
              label={t('settings.general.maxResponseLength')}
              value={maxResponseTokens}
              min={100} max={131072} step={256}
              isInt
              hint={[t('settings.general.maxResponseLengthMin'), t('settings.general.maxResponseLengthMax')]}
              onChange={v => setMaxResponseTokens(Math.round(v))}
            />
          </div>
        </div>

        {/* Response Length */}
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            回复长度
          </h3>
          <div className="flex gap-2">
            {([
              { value: 'short', label: '简短', desc: '1-2句话' },
              { value: 'medium', label: '适中', desc: '3-5句话' },
              { value: 'long', label: '详细', desc: '6-10句话' },
            ] as const).map(opt => (
              <button
                key={opt.value}
                onClick={() => setResponseLength(opt.value)}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  responseLength === opt.value
                    ? 'bg-parlor-500/12 border border-parlor-500/15 text-white'
                    : 'bg-dark-100 border border-glass-border text-gray-400 hover:text-white'
                }`}
              >
                <div className="font-medium">{opt.label}</div>
                <div className="text-xs opacity-70">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Reasoning Settings */}
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
            <Brain className="w-4 h-4" />
            {t('settings.general.reasoning')}
          </h3>

          <div className="space-y-4">
            {/* Reasoning Mode */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('settings.general.reasoningMode')}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'none', label: t('settings.general.reasoningOff'), desc: t('settings.general.reasoningOffDesc') },
                  { value: 'auto', label: t('settings.general.reasoningAuto'), desc: t('settings.general.reasoningAutoDesc') },
                  { value: 'deepseek', label: t('settings.general.reasoningDeepseek'), desc: t('settings.general.reasoningDeepseekDesc') },
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
                {t('settings.general.reasoningDesc')}
              </p>
            </div>

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
            {hasChanges ? t('settings.general.saveChanges') : t('settings.general.noChanges')}
          </Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  {t('settings.general.streaming')}
                </label>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t('settings.general.streamingDesc')}
                </p>
              </div>
              <button
                onClick={() => setStreamResponses(!streamResponses)}
                className={`
                  w-12 h-6 rounded-full transition-colors relative flex-shrink-0
                  ${streamResponses ? 'bg-parlor-500' : 'bg-dark-100'}
                `}
              >
                <span
                  className={`
                    absolute top-1 w-4 h-4 rounded-full bg-white transition-transform
                    ${streamResponses ? 'left-7' : 'left-1'}
                  `}
                />
              </button>
            </div>
          </div>
        </div>
  );
}

