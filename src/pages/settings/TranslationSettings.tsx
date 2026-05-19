import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Link2,
  ToggleRight,
  ToggleLeft,
} from 'lucide-react';
import type { AppSettings } from '../../types';
import { Input } from '../../components/ui/Input';

type TranslationSubTab = 'connection';

interface Props {
  settings: AppSettings | undefined;
  onUpdate: (key: string, value: any) => void;
}

const BAIDU_API_URL = 'https://fanyi-api.baidu.com/api/trans/vip/translate';

export function TranslationSettings({ settings, onUpdate }: Props) {
  const { t } = useTranslation();
  const [subTab, setSubTab] = useState<TranslationSubTab>('connection');
  const [saved, setSaved] = useState(false);

  const showSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* ===== 子导航栏 ===== */}
      <div className="flex gap-1 border-b border-glass-border pb-2">
        <button
          onClick={() => setSubTab('connection')}
          className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
            subTab === 'connection'
              ? 'bg-parlor-500/10 text-parlor-300 font-medium'
              : 'text-gray-500 hover:text-white'
          }`}
        >
          <Link2 size={14} />
          连接
        </button>
      </div>

      {/* ===== 子内容区 ===== */}
      {subTab === 'connection' && (
        <div className="space-y-4">
          {/* 启用开关 */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-300">{t('settings.general.baiduTranslate.enabled')}</span>
              <p className="text-xs text-gray-500">{t('settings.general.baiduTranslate.enabledHint')}</p>
            </div>
            <button
              onClick={() => {
                onUpdate('baiduTranslateEnabled', !settings?.baiduTranslateEnabled);
                showSaved();
              }}
              className={`p-1 rounded ${settings?.baiduTranslateEnabled ? 'text-green-500' : 'text-gray-400'}`}
            >
              {settings?.baiduTranslateEnabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
            </button>
          </div>

          {/* ===== 角色市场自动翻译 ===== */}
          <div className="flex items-center justify-between pt-4 border-t border-glass-border">
            <div>
              <span className="text-sm text-gray-300">翻译角色市场角色卡</span>
              <p className="text-xs text-gray-500">
                启用后自动翻译角色市场搜索结果中的名称和描述，便于预览非中文角色卡
              </p>
            </div>
            <button
              onClick={() => {
                onUpdate('baiduTranslateMarket', !settings?.baiduTranslateMarket);
                showSaved();
              }}
              className={`p-1 rounded ${settings?.baiduTranslateMarket ? 'text-green-500' : 'text-gray-400'}`}
            >
              {settings?.baiduTranslateMarket ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
            </button>
          </div>

          {/* 翻译API链接 — 下拉选择 */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              {t('settings.general.baiduTranslate.apiUrl')}
            </label>
            <select
              value={settings?.baiduTranslateApiUrl || BAIDU_API_URL}
              onChange={e => {
                onUpdate('baiduTranslateApiUrl', e.target.value);
                showSaved();
              }}
              className="w-full px-3 py-2 text-sm rounded-lg bg-dark-300 border border-glass-border text-gray-200"
            >
              <option value={BAIDU_API_URL}>百度翻译 (Baidu)</option>
              <option value="__custom__">{t('common.custom') || '自定义'}</option>
            </select>
            {settings?.baiduTranslateApiUrl && settings.baiduTranslateApiUrl !== BAIDU_API_URL && (
              <Input
                value={settings.baiduTranslateApiUrl}
                onChange={e => {
                  onUpdate('baiduTranslateApiUrl', e.target.value);
                  showSaved();
                }}
                placeholder="https://..."
                className="mt-2"
              />
            )}
          </div>

          {/* APP ID */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              {t('settings.general.baiduTranslate.appId')}
            </label>
            <Input
              value={settings?.baiduTranslateAppId || ''}
              onChange={e => {
                onUpdate('baiduTranslateAppId', e.target.value);
                showSaved();
              }}
              placeholder={t('settings.general.baiduTranslate.appIdPlaceholder')}
            />
          </div>

          {/* 密钥 */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              {t('settings.general.baiduTranslate.secretKey')}
            </label>
            <Input
              type="password"
              value={settings?.baiduTranslateSecretKey || ''}
              onChange={e => {
                onUpdate('baiduTranslateSecretKey', e.target.value);
                showSaved();
              }}
              placeholder={t('settings.general.baiduTranslate.secretKeyPlaceholder')}
            />
          </div>

          {/* 目标语言 */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              {t('settings.general.baiduTranslate.targetLang')}
            </label>
            <select
              value={settings?.baiduTranslateTarget || 'zh'}
              onChange={e => {
                onUpdate('baiduTranslateTarget', e.target.value);
                showSaved();
              }}
              className="w-full px-3 py-2 text-sm rounded-lg bg-dark-300 border border-glass-border text-gray-200"
            >
              <option value="zh">{t('settings.general.baiduTranslate.targetLangZh')}</option>
              <option value="en">{t('settings.general.baiduTranslate.targetLangEn')}</option>
              <option value="jp">{t('settings.general.baiduTranslate.targetLangJp')}</option>
            </select>
          </div>

          {/* 保存反馈 */}
          {saved && (
            <p className="text-xs text-green-500">{t('settings.general.baiduTranslate.saved')}</p>
          )}
        </div>
      )}
    </div>
  );
}
