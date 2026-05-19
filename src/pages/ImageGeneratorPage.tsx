import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, Download, User, Image, Settings,
  Loader2, AlertCircle, CheckCircle, X, Wand2,
} from 'lucide-react';
import { generateImage } from '../services/imageGen';
import { settingsOps, characterOps } from '../db';
import { useCharacterStore } from '../stores';
import type { ImageGenSettings, CharacterCard } from '../types';

// ===== 预制提示词模板 =====

interface PromptCategory {
  title: string;
  items: { label: string; prompt: string }[];
}

const PROMPT_TEMPLATES: PromptCategory[] = [
  {
    title: '头像风格',
    items: [
      { label: '二次元', prompt: 'anime style portrait, cute, vibrant colors, clean lineart, soft shading' },
      { label: '写实', prompt: 'realistic portrait, photorealistic, detailed facial features, professional lighting' },
      { label: '半身像', prompt: 'half body shot, waist up, looking at viewer, detailed clothing' },
      { label: '全身立绘', prompt: 'full body illustration, standing pose, character sheet style, detailed outfit' },
    ],
  },
  {
    title: '角色背景',
    items: [
      { label: '城堡', prompt: 'fantasy castle background, throne room, dramatic lighting, majestic architecture' },
      { label: '森林', prompt: 'enchanted forest background, sunlight filtering through trees, mystical atmosphere, glowing particles' },
      { label: '城市', prompt: 'cyberpunk city background, neon lights, rainy street at night, futuristic buildings' },
      { label: '星空', prompt: 'starry sky background, celestial night sky, glowing stars, nebula, dreamy atmosphere' },
    ],
  },
  {
    title: '表情',
    items: [
      { label: '微笑', prompt: 'smiling expression, warm smile, happy, gentle eyes, slight blush' },
      { label: '愤怒', prompt: 'angry expression, furious glare, intense look, aggressive pose, clenched fists' },
      { label: '悲伤', prompt: 'sad expression, crying, teary eyes, melancholic atmosphere, downcast look' },
      { label: '惊讶', prompt: 'surprised expression, shocked look, wide eyes, mouth slightly open, frozen pose' },
    ],
  },
];

// ===== 分辨率选项 =====

const RESOLUTIONS = [
  { label: '512×512', width: 512, height: 512 },
  { label: '768×768', width: 768, height: 768 },
  { label: '1024×1024', width: 1024, height: 1024 },
  { label: '1024×1536 (3:4)', width: 1024, height: 1536 },
  { label: '1536×1024 (4:3)', width: 1536, height: 1024 },
  { label: '1216×832', width: 1216, height: 832 },
];

// ===== 下载图片 =====

function downloadImage(dataUrl: string, filename = 'character.png') {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ===== 页面组件 =====

export default function ImageGeneratorPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // 设置状态
  const [settings, setSettings] = useState<ImageGenSettings | null>(null);
  const [apiKey, _setApiKey] = useState<string>('');
  const [settingsLoading, setSettingsLoading] = useState(true);

  // 提示词状态
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');

  // 生成参数
  const [resolution, setResolution] = useState(RESOLUTIONS[2]); // 1024x1024 默认
  const [count, setCount] = useState(1);

  // 生成状态
  const [generating, setGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [error, setError] = useState('');

  // 设为头像相关
  const [characters, setCharacters] = useState<CharacterCard[]>([]);
  const [showCharPicker, setShowCharPicker] = useState(false);
  const [selectedImageIdx, setSelectedImageIdx] = useState<number>(-1);
  const [settingAvatar, setSettingAvatar] = useState(false);

  // 加载设置和角色列表
  useEffect(() => {
    async function load() {
      try {
        const appSettings = await settingsOps.get();
        const genSettings = appSettings?.imageGen;
        if (genSettings) {
          setSettings(genSettings);
        }
        // 加载角色列表
        const chars = await characterOps.getAll();
        setCharacters(Array.isArray(chars) ? chars : []);
      } catch (e) {
        console.error('Failed to load settings:', e);
      } finally {
        setSettingsLoading(false);
      }
    }
    load();
  }, []);

  // ===== 预制提示词点击 =====

  function handleTemplateClick(templatePrompt: string) {
    setPrompt(prev => {
      if (!prev) return templatePrompt;
      return prev + ', ' + templatePrompt;
    });
  }

  // ===== 生成图片 =====

  async function handleGenerate() {
    if (!prompt.trim()) return;
    if (!settings || !settings.enabled) {
      setError('图片生成未配置，请先在设置中配置');
      return;
    }

    setGenerating(true);
    setError('');
    setGeneratedImages([]);

    try {
      const updatedSettings = { ...settings, width: resolution.width, height: resolution.height };

      const results: string[] = [];
      for (let i = 0; i < count; i++) {
        const finalPrompt = count > 1
          ? prompt + ` (variant ${i + 1})`
          : prompt;
        const image = await generateImage(finalPrompt, updatedSettings, apiKey);
        if (image) results.push(image);
      }
      setGeneratedImages(results);
    } catch (e: any) {
      setError(e.message || '图片生成失败');
    } finally {
      setGenerating(false);
    }
  }

  // ===== 下载 =====

  function handleDownload(dataUrl: string, index: number) {
    downloadImage(dataUrl, `character_${Date.now()}_${index}.png`);
  }

  // ===== 设为头像 =====

  async function handleSetAvatar(characterId: string) {
    if (selectedImageIdx < 0 || !generatedImages[selectedImageIdx]) return;
    setSettingAvatar(true);
    try {
      await characterOps.update(characterId, { avatar: generatedImages[selectedImageIdx] });
      useCharacterStore.getState().updateCharacter(characterId, { avatar: generatedImages[selectedImageIdx] });
      setShowCharPicker(false);
      setError('');
    } catch (e: any) {
      setError('头像更新失败: ' + e.message);
    } finally {
      setSettingAvatar(false);
    }
  }

  // ===== 渲染 =====

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* 页面标题 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
          <Sparkles size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t('nav.imageGenerator')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">使用 AI 生成角色图像</p>
        </div>
      </div>

      {/* 设置状态提示 */}
      {!settingsLoading && (
        <div className={`mb-4 p-3 rounded-lg text-sm flex items-center justify-between ${
          settings?.enabled
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
            : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
        }`}>
          <div className="flex items-center gap-2">
            {settings?.enabled ? <CheckCircle size={16} className="text-green-500" /> : <AlertCircle size={16} className="text-yellow-500" />}
            <span>
              {settings?.enabled
                ? `当前配置: ${settings.provider === 'dalle' ? 'DALL·E' : settings.provider === 'sd-webui' ? 'SD WebUI' : 'ComfyUI'} | ${settings.width || 1024}×${settings.height || 1024}`
                : '图片生成未配置，请在设置中启用并配置'}
            </span>
          </div>
          <button
            onClick={() => navigate('/settings')}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <Settings size={12} />
            <span>去设置</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* 左侧：提示词配置区 */}
        <div className="lg:col-span-3 space-y-4">
          {/* 预制提示词 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Wand2 size={14} className="text-parlor-500" />
              预制提示词
            </h3>
            <div className="space-y-3">
              {PROMPT_TEMPLATES.map(category => (
                <div key={category.title}>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">{category.title}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {category.items.map(item => (
                      <button
                        key={item.label}
                        onClick={() => handleTemplateClick(item.prompt)}
                        className="px-2.5 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-parlor-100 dark:hover:bg-parlor-900/30 hover:text-parlor-600 dark:hover:text-parlor-400 transition-colors border border-transparent hover:border-parlor-200 dark:hover:border-parlor-800"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 提示词输入 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <label className="text-sm font-semibold block mb-2">提示词 (Prompt)</label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="输入图片描述，或点击上方预制提示词快速构建..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-parlor-500/30"
            />

            <label className="text-sm font-semibold block mt-3 mb-2">负面提示词 (Negative Prompt)</label>
            <textarea
              value={negativePrompt}
              onChange={e => setNegativePrompt(e.target.value)}
              placeholder="不想出现在图片中的内容..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-parlor-500/30"
            />
          </div>

          {/* 参数设置 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">分辨率</label>
                <select
                  value={`${resolution.width}x${resolution.height}`}
                  onChange={e => {
                    const r = RESOLUTIONS.find(r => `${r.width}x${r.height}` === e.target.value);
                    if (r) setResolution(r);
                  }}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-parlor-500/30"
                >
                  {RESOLUTIONS.map(r => (
                    <option key={`${r.width}x${r.height}`} value={`${r.width}x${r.height}`}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">生成数量</label>
                <select
                  value={count}
                  onChange={e => setCount(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-parlor-500/30"
                >
                  {[1, 2, 3, 4].map(n => (
                    <option key={n} value={n}>{n} 张</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 生成按钮 */}
            <button
              onClick={handleGenerate}
              disabled={generating || !prompt.trim() || !settings?.enabled}
              className="mt-4 w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity font-medium"
            >
              {generating ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Sparkles size={18} />
              )}
              <span>{generating ? '生成中...' : '✨ 生成图片'}</span>
            </button>
          </div>
        </div>

        {/* 右侧：生成结果 */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 h-full">
            <h3 className="text-sm font-semibold mb-3">生成结果</h3>

            {error && (
              <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <AlertCircle size={12} />
                <span>{error}</span>
              </div>
            )}

            {generatedImages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-gray-600">
                <Image size={48} className="mb-2 opacity-30" />
                <p className="text-sm">配置提示词后点击生成</p>
                <p className="text-xs mt-1">生成的图片将显示在这里</p>
              </div>
            ) : (
              <div className="space-y-3">
                {generatedImages.map((dataUrl, idx) => (
                  <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <img
                      src={dataUrl}
                      alt={`Generated ${idx + 1}`}
                      className="w-full h-auto"
                    />
                    <div className="p-2 flex gap-2 bg-gray-50 dark:bg-gray-900">
                      <button
                        onClick={() => handleDownload(dataUrl, idx)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        <Download size={12} />
                        <span>下载</span>
                      </button>
                      <button
                        onClick={() => { setSelectedImageIdx(idx); setShowCharPicker(true); }}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-parlor-500 text-white rounded-lg hover:bg-parlor-600 transition-colors"
                      >
                        <User size={12} />
                        <span>设为头像</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 角色选择弹窗 */}
      {showCharPicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCharPicker(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full max-h-[70vh] overflow-hidden shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-sm">选择角色</h3>
              <button onClick={() => setShowCharPicker(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <X size={16} />
              </button>
            </div>
            <div className="p-2 overflow-y-auto max-h-[50vh]">
              {characters.length === 0 ? (
                <p className="text-center py-8 text-sm text-gray-500">暂无角色</p>
              ) : (
                <div className="space-y-1">
                  {characters.map(char => (
                    <button
                      key={char.id}
                      onClick={() => handleSetAvatar(char.id)}
                      disabled={settingAvatar}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                    >
                      {char.avatar ? (
                        <img src={char.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-400">
                          <User size={16} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{char.name}</p>
                        <p className="text-xs text-gray-500 truncate">{char.description || ''}</p>
                      </div>
                      {settingAvatar && (
                        <Loader2 size={14} className="animate-spin text-parlor-500 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
