import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus, ExternalLink, Edit2, Trash2, Globe,
  Save, X, Search, Loader2,
  Download, AlertCircle, CheckCircle,
  ChevronDown, ChevronLeft, ChevronRight
} from 'lucide-react';
import { API_URL, settingsOps, worldInfoOps } from '../services/apiClient';
import { characterOps } from '../db';
import { generateUUID } from '../utils/uuid';
import { importCharacterFromFile } from '../utils/characterImport';
import type { AppSettings, CharacterCard, WorldInfo } from '../types';
import { MarketCharacterCard, CharacterPreviewModal } from './characterMarket';

// ========== 类型定义 ==========

interface MarketLink {
  id: string;
  name: string;
  url: string;
  description?: string;
  isPreset?: boolean;
}

interface ChubSearchNode {
  name: string;
  fullPath: string;
  description: string;
  starCount: number;
  topics: string[];
  avatar_url: string;
  max_res_url: string;
  nTokens: number;
  nChats: number;
  nFavorites?: number;
  relatedLorebooks?: { id: string; name?: string }[];
}

// ========== 预设市场链接 ==========

const PRESET_LINKS: MarketLink[] = [
  // 有开放 API 的角色市场
  { id: 'chub', name: 'Chub.ai', url: 'https://www.chub.ai', description: '最大最活跃的角色卡市场，支持搜索和一键导入', isPreset: true },
  // 可直接下载角色卡的站点
  { id: 'stpro', name: 'SillyTavern Pro', url: 'https://cards.sillytavern.one', description: '3.3 万+ 中文/英文角色卡', isPreset: true },
  { id: 'charavault', name: 'CharaVault', url: 'https://charavault.net', description: '19.5 万角色卡，支持 PNG/JSON 下载', isPreset: true },
  { id: 'aicharactercards', name: 'AI Character Cards', url: 'https://aicharactercards.com', description: 'SillyTavern 角色卡静态目录', isPreset: true },
  { id: 'taverncard', name: 'TavernCard', url: 'https://www.taverncard.com', description: '角色卡展示与分享', isPreset: true },
  { id: 'characterhub', name: 'Character Hub', url: 'https://www.characterhub.org', description: 'AI 角色管理与发现', isPreset: true },
];

// ========== 简单 TTL 缓存 ==========
const CACHE_TTL = 10 * 60 * 1000; // 10 分钟
const MAX_CACHE = 100;

function createCache<T>() {
  const store = new Map<string, { data: T; ts: number }>();
  return {
    get(key: string): T | undefined {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (Date.now() - entry.ts > CACHE_TTL) { store.delete(key); return undefined; }
      return entry.data;
    },
    set(key: string, data: T) {
      if (store.size >= MAX_CACHE) {
        const oldest = store.keys().next().value;
        if (oldest) store.delete(oldest);
      }
      store.set(key, { data, ts: Date.now() });
    },
    clear() { store.clear(); },
  };
}

const chubSearchCache = createCache<{ nodes: ChubSearchNode[]; hasMore: boolean }>();
const chubDetailCache = createCache<any>();
// ========== Chub API 工具函数 ==========

const CHUB_API = 'https://api.chub.ai';

async function searchChub(query: string, sort = 'star_count', limit = 20, skip = 0) {
  const cacheKey = `${query}|${sort}|${limit}|${skip}`;
  const cached = chubSearchCache.get(cacheKey);
  if (cached) return cached;
  const url = `${CHUB_API}/search?search=${encodeURIComponent(query)}&first=${limit}&skip=${skip}&sort=${sort}&nsfw=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Chub search failed: ${res.status}`);
  const data = await res.json();
  const result = {
    nodes: (data.data?.nodes || []) as ChubSearchNode[],
    hasMore: data.data?.pageInfo?.hasNextPage || false,
  };
  chubSearchCache.set(cacheKey, result);
  return result;
}

async function fetchChubCharacter(fullPath: string) {
  const cached = chubDetailCache.get(fullPath);
  if (cached) return cached;
  const url = `${CHUB_API}/api/characters/${fullPath}?full=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Chub detail fetch failed: ${res.status}`);
  const data = await res.json();
  chubDetailCache.set(fullPath, data.node);
  return data.node;
}


/** 获取独立知识书详情 */
async function fetchChubLorebook(lorebookPath: string) {
  const url = `${CHUB_API}/api/lorebooks/${lorebookPath}?full=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Chub lorebook fetch failed: ${res.status}`);
  const data = await res.json();
  return data.node;
}

// ========== Chub → CharacterCard 映射 ==========

function chubToCharacterCard(node: any): CharacterCard {
  const def = node.definition || {};
  let avatar: string | undefined = '';
  if (typeof def.avatar === 'string' && def.avatar.startsWith('data:')) {
    avatar = def.avatar;
  } else if (node.avatar_url) {
    // 对外部 URL 头像不做同步下载（避免阻塞导入），直接保存 URL
    // 服务端 extractAvatar 会将其写入侧边文件
    avatar = node.avatar_url;
  }
  // 空字符串会导致 extractAvatar 误删侧边文件；无头像时设为 undefined
  if (!avatar) {
    avatar = undefined;
  }

  return {
    id: generateUUID(),
    name: def.name || node.name || 'Unknown',
    description: def.description || '',
    personality: def.personality || '',
    scenario: def.scenario || '',
    firstMessage: def.first_message || '',
    mesExamples: def.example_dialogs || '',
    systemPrompt: def.system_prompt || '',
    postHistoryInstructions: def.post_history_instructions || '',
    alternateGreetings: def.alternate_greetings || [],
    avatar,
    characterBook: def.embedded_lorebook || null,
    tags: node.topics || [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ========== 快速导入：URL 检测与导入 ==========

async function importFromUrl(url: string): Promise<{ success: boolean; name?: string; error?: string }> {
  try {
    // 检测是否为 Chub URL
    const chubMatch = url.match(/(?:www\.)?chub\.ai\/(?:characters?\/)?([^/\s]+\/[^/\s?#]+)/i);
    if (chubMatch) {
      const fullPath = chubMatch[1].replace(/\/+$/, '');
      const node = await fetchChubCharacter(fullPath);
      if (!node || !node.definition) {
        return { success: false, error: 'Could not fetch character data from Chub.' };
      }
      const card = chubToCharacterCard(node);
      await characterOps.add(card);
      return { success: true, name: card.name };
    }

    // 通用 URL：尝试直接下载并解析
    const response = await fetch(url);
    if (!response.ok) return { success: false, error: `HTTP ${response.status}` };

    const contentType = response.headers.get('content-type') || '';
    const blob = await response.blob();

    if (contentType.includes('image/png') || blob.type === 'image/png') {
      // PNG 角色卡：使用 File 对象走已有导入逻辑
      const file = new File([blob], 'character.png', { type: 'image/png' });
      const result = await importCharacterFromFile(file);
      if (result?.character) {
        const partial = result.character;
        const card: CharacterCard = {
          ...partial as CharacterCard,
          id: partial.id || generateUUID(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await characterOps.add(card);
        return { success: true, name: card.name };
      }
      return { success: false, error: 'Could not parse PNG character card.' };
    }

    // JSON 格式
    const text = await blob.text();
    let data: any;
    try { data = JSON.parse(text); } catch {
      return { success: false, error: 'Invalid JSON format.' };
    }

    // 尝试标准化
    let raw = data;
    if (data.data) raw = data.data;
    if (raw.spec === 'chara_card_v2' && raw.data) raw = raw.data;

    const card: CharacterCard = {
      id: generateUUID(),
      name: raw.name || raw.char_name || 'Unknown',
      description: raw.description || raw.char_persona || '',
      personality: raw.personality || '',
      scenario: raw.scenario || '',
      firstMessage: raw.first_mes || raw.first_message || raw.char_greeting || '',
      mesExamples: raw.mes_example || raw.example_dialogs || '',
      systemPrompt: raw.system_prompt || raw.system_prompt_instruction || '',
      postHistoryInstructions: raw.post_history_instructions || '',
      alternateGreetings: raw.alternate_greetings || [],
      avatar: raw.avatar || '',
      characterBook: raw.character_book || raw.lorebook || null,
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await characterOps.add(card);
    return { success: true, name: card.name };
  } catch (e: any) {
    return { success: false, error: e.message || 'Import failed' };
  }
}

// ========== 页面组件 ==========

export default function CharacterMarketPage() {
  const { t } = useTranslation();

  // 自定义链接状态
  const [customLinks, setCustomLinks] = useState<MarketLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(true);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [editingLink, setEditingLink] = useState<MarketLink | null>(null);
  const [linkFormName, setLinkFormName] = useState('');
  const [linkFormUrl, setLinkFormUrl] = useState('');
  const [linkFormDesc, setLinkFormDesc] = useState('');

  // 搜索状态
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSort, setSearchSort] = useState('star_count');
  const [searchResults, setSearchResults] = useState<ChubSearchNode[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [backgroundLoading] = useState(false); // 后台静默加载（不再使用）

  // 预览状态
  const [previewNode, setPreviewNode] = useState<ChubSearchNode | null>(null);
  const [previewDetail, setPreviewDetail] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // 标签列表（从搜索结果提取）
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  // 分页
  const PER_PAGE = 48;
  const [searchPage, setSearchPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  // 缓存（搜索关键词变化标记）
  const [lastSearchQuery, setLastSearchQuery] = useState('');

  // 同名角色卡分组
  const [cardGroups, setCardGroups] = useState<Map<string, ChubSearchNode[]>>(new Map());
  const [previewVariants, setPreviewVariants] = useState<ChubSearchNode[]>([]);
  const [previewVariantIndex, setPreviewVariantIndex] = useState(0);

  // 标签折叠状态
  const [topicsCollapsed, setTopicsCollapsed] = useState(true);
  // 本地过滤
  const [localFilter, setLocalFilter] = useState('');

  // 导入状态
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 导入选择弹窗：角色附带世界书时弹出
  const [importChoiceNode, setImportChoiceNode] = useState<ChubSearchNode | null>(null);
  const [importChoiceDetail, setImportChoiceDetail] = useState<any>(null);
  const [importSelectedMode, setImportSelectedMode] = useState<'together' | 'separate' | 'character-only'>('together');
  const [importSelectedLorebooks, setImportSelectedLorebooks] = useState<string[]>([]);

  // 翻译状态
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [translatedTexts, setTranslatedTexts] = useState<Record<string, string>>({});

  // 快速导入
  const [quickUrl, setQuickUrl] = useState('');
  const [isQuickImporting, setIsQuickImporting] = useState(false);

  // ===== 自定义链接 CRUD =====

  useEffect(() => {
    fetch(`${API_URL}/characterMarkets`)
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setCustomLinks(data); })
      .catch(() => { })
      .finally(() => setLinksLoading(false));
  }, []);

  async function saveLinks(links: MarketLink[]) {
    await fetch(`${API_URL}/characterMarkets/batch`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(links),
    }).catch(() => { });
  }

  function openLinkForm(link?: MarketLink) {
    setEditingLink(link || null);
    setLinkFormName(link?.name || '');
    setLinkFormUrl(link?.url || '');
    setLinkFormDesc(link?.description || '');
    setShowLinkForm(true);
  }

  async function handleLinkSave() {
    if (!linkFormName.trim() || !linkFormUrl.trim()) return;
    const url = linkFormUrl.startsWith('http') ? linkFormUrl : `https://${linkFormUrl}`;
    const newLinks = editingLink
      ? customLinks.map(l => l.id === editingLink.id ? { ...l, name: linkFormName.trim(), url, description: linkFormDesc.trim() } : l)
      : [...customLinks, { id: generateUUID(), name: linkFormName.trim(), url, description: linkFormDesc.trim(), isPreset: false }];
    setCustomLinks(newLinks);
    await saveLinks(newLinks);
    setShowLinkForm(false);
  }

  async function handleLinkDelete(id: string) {
    const newLinks = customLinks.filter(l => l.id !== id);
    setCustomLinks(newLinks);
    await saveLinks(newLinks);
  }

  // ===== Chub 搜索 =====

  async function handleSearchWithQuery(query: string) {
    setIsSearching(true);
    setSearchError('');
    setImportMessage(null);
    setSearchPage(0);
    setLastSearchQuery(query.trim());

    const currentSettings = await settingsOps.get();

    try {
      // 首次加载 50 条（快速展示）
      const FIRST_BATCH = PER_PAGE;
      const { nodes, hasMore: more } = await searchChub(query.trim(), searchSort, FIRST_BATCH, 0);
      setSearchResults(nodes);
      setHasMore(more);

      // 自动翻译（仅首次批次）
      if (nodes.length > 0 && currentSettings?.baiduTranslateMarket && currentSettings?.baiduTranslateAppId && currentSettings?.baiduTranslateSecretKey) {
        handleBatchTranslate(nodes, currentSettings);
      }

      // 提取标签
      const topics = new Set<string>();
      nodes.forEach(n => n.topics?.forEach(t => topics.add(t)));
      setAvailableTopics(Array.from(topics).sort());

      // 按名称分组去重
      const grouped = groupSearchResults(nodes);
      setCardGroups(grouped);

      if (nodes.length === 0) setSearchError(t('characterMarket.noResults'));

      // 首次展示完成
      setIsSearching(false);
    } catch {
      setSearchError(t('characterMarket.searchError'));
    } finally {
      setIsSearching(false);
    }
  }

  /** 静默加载所有剩余页面 */
  // loadAllRemainingPages removed — on-demand pagination only

  async function handleSearch() {
    await handleSearchWithQuery(searchQuery);
  }

  const goToPage = useCallback(async (page: number) => {
    if (page < 0 || page === searchPage) return;

    const needFetchCount = (page + 1) * PER_PAGE;

    // 如果目标页的数据还没获取到，且有更多可加载
    if (needFetchCount > searchResults.length && hasMore && lastSearchQuery) {
      if (isSearching) return;
      setIsSearching(true);
      try {
        const nextPageToFetch = Math.ceil(searchResults.length / PER_PAGE);
        const skip = nextPageToFetch * PER_PAGE;
        const { nodes, hasMore: more } = await searchChub(lastSearchQuery, searchSort, PER_PAGE, skip);

        // 立即计算新长度，避免闭包陈旧问题
        const newLength = searchResults.length + nodes.length;
        const newAvailablePages = Math.ceil(newLength / PER_PAGE);

        setSearchResults(prev => [...prev, ...nodes]);

        // 翻页获取的新节点也需要自动翻译
        if (nodes.length > 0) {
          try {
            const s = await settingsOps.get();
            if (s?.baiduTranslateMarket && s?.baiduTranslateAppId && s?.baiduTranslateSecretKey) {
              handleBatchTranslate(nodes, s);
            }
          } catch {
            // 静默失败，不阻塞翻页
          }
        }

        setHasMore(more);

        // 合并新标签
        setAvailableTopics(prev => {
          const updated = new Set(prev);
          nodes.forEach(n => n.topics?.forEach(t => updated.add(t)));
          return Array.from(updated).sort();
        });

        // 用新长度判断跳转
        if (page < newAvailablePages) {
          setSearchPage(page);
        } else if (newAvailablePages > 0) {
          // 跳转到最后一页
          setSearchPage(newAvailablePages - 1);
        }
      } catch {
        // 静默失败
      } finally {
        setIsSearching(false);
      }
    } else {
      // 无需 fetch，直接跳转
      const availablePages = Math.ceil(searchResults.length / PER_PAGE);
      if (page < availablePages) {
        setSearchPage(page);
      }
    }
  }, [searchPage, searchResults.length, hasMore, lastSearchQuery, searchSort, isSearching]);

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSearch();
  }

  /** 将搜索结果按名称分组，完全相同的合并，有差异的保留为列表 */
  function groupSearchResults(nodes: ChubSearchNode[]): Map<string, ChubSearchNode[]> {
    const groups = new Map<string, ChubSearchNode[]>();

    for (const node of nodes) {
      const existing = groups.get(node.name) || [];

      // 检查是否与现有条目完全重合
      const isDuplicate = existing.some(e =>
        e.description === node.description &&
        e.starCount === node.starCount &&
        JSON.stringify(e.topics) === JSON.stringify(node.topics)
      );

      if (!isDuplicate) {
        existing.push(node);
        groups.set(node.name, existing);
      }
      // 重合则跳过
    }

    return groups;
  }

  // ===== 一键导入 =====

  async function doImport(fullPathOrNode: string | ChubSearchNode, detail?: any, mode?: 'together' | 'separate' | 'character-only') {
    const fullPath = typeof fullPathOrNode === 'string' ? fullPathOrNode : fullPathOrNode.fullPath;
    const node = typeof fullPathOrNode === 'string' ? null : fullPathOrNode;

    setImportingId(fullPath);
    setImportMessage(null);
    try {
      // 如果没有传入 detail，先获取
      let charDetail = detail;
      if (!charDetail) {
        charDetail = await fetchChubCharacter(fullPath);
      }
      if (!charDetail || !charDetail.definition) {
        throw new Error('无法获取角色数据');
      }

      const card = chubToCharacterCard(charDetail);

      if (mode === 'character-only') {
        // 仅导入角色，去掉世界书
        delete card.characterBook;
      } else if (mode === 'separate') {
        // 分别导入：角色不包含世界书，世界书存为独立分组
        const book = card.characterBook;
        delete card.characterBook;

        // 保存角色
        await characterOps.add(card);

        // 如果存在世界书，创建独立世界书分组
        if (book?.entries && book.entries.length > 0) {
          const label = node?.name || card.name || '导入的世界书';
          const newWorldInfo: WorldInfo = {
            id: generateUUID(),
            name: `${label} - 世界书`,
            enabled: true,
            autoAssociate: true,
            entries: book.entries,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          await worldInfoOps.add(newWorldInfo);
          setImportMessage({ type: 'success', text: `${card.name} 已导入，世界书已存为独立分组「${newWorldInfo.name}」` });
        } else {
          setImportMessage({ type: 'success', text: `${card.name} 已导入（无世界书）` });
        }
        // 跳过默认的 importMessage 设置
        return;
      }
      // together 模式或不指定模式：保持原行为（内嵌世界书）
      await characterOps.add(card);

      const name = node?.name || card.name || '角色';
      setImportMessage({ type: 'success', text: node
        ? t('characterMarket.importSuccess')
        : `${name} 已导入` });

    } catch (err) {
      console.error('Import failed:', err);
      setImportMessage({ type: 'error', text: t('characterMarket.importFailed') });
    } finally {
      setImportingId(null);
    }
  }

  async function handleImport(fullPathOrNode: string | ChubSearchNode) {
    const fullPath = typeof fullPathOrNode === 'string' ? fullPathOrNode : fullPathOrNode.fullPath;
    const node = typeof fullPathOrNode === 'string' ? null : fullPathOrNode;

    setImportingId(fullPath);
    try {
      const detail = await fetchChubCharacter(fullPath);
      if (!detail || !detail.definition) {
        setImportingId(null);
        return;
      }

      const hasBook = detail.definition?.embedded_lorebook?.entries?.length > 0;
      const relatedLbs = node?.relatedLorebooks || [];
      const hasRelatedLbs = relatedLbs.length > 0;

      if (hasBook || hasRelatedLbs) {
        // 有世界书或关联知识书，弹窗让用户选择
        setImportChoiceNode(node || { fullPath, name: detail.definition.name || '角色', description: '', starCount: 0, topics: [], avatar_url: '', max_res_url: '', nTokens: 0, nChats: 0 });
        setImportChoiceDetail(detail);
        setImportSelectedMode(hasBook ? 'together' : 'character-only');
        setImportSelectedLorebooks(relatedLbs.map(lb => lb.id));
        setImportingId(null); // 已拿到 detail，释放 loading
      } else {
        // 没有世界书和关联知识书，直接导入
        setImportingId(null);
        await doImport(fullPath, detail, 'together');
      }
    } catch (err) {
      console.error('获取角色详情失败:', err);
      setImportingId(null);
    }
  }

  // ===== 翻译 =====

  async function handleTranslate(node: ChubSearchNode) {
    if (translatingId) return;
    setTranslatingId(node.fullPath);

    try {
      const settings = await settingsOps.get();
      if (!settings?.baiduTranslateEnabled || !settings?.baiduTranslateAppId || !settings?.baiduTranslateSecretKey) {
        alert('请先在设置中配置百度翻译');
        setTranslatingId(null);
        return;
      }

      const textToTranslate = [node.name, node.description].filter(Boolean).join('\n---\n');
      if (!textToTranslate) {
        setTranslatingId(null);
        return;
      }

      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToTranslate,
          from: 'auto',
          to: settings.baiduTranslateTarget || 'zh',
          apiUrl: settings.baiduTranslateApiUrl || '',
          appId: settings.baiduTranslateAppId,
          secretKey: settings.baiduTranslateSecretKey,
        }),
      });

      const data = await res.json();
      if (data.error) {
        console.error('翻译失败:', data.error);
        return;
      }

      setTranslatedTexts(prev => ({ ...prev, [node.fullPath]: data.translated }));
    } catch (err) {
      console.error('翻译请求失败:', err);
    } finally {
      setTranslatingId(null);
    }
  }

  const handleBatchTranslate = async (nodes: ChubSearchNode[], settings: AppSettings) => {
    // 收集所有需要翻译的文本
    const textsToTranslate: { text: string; fullPath: string }[] = [];
    
    for (const node of nodes) {
      const parts: string[] = [];
      if (node.name) parts.push(node.name);
      if (node.description) parts.push(node.description);
      if (parts.length === 0) continue;
      
      textsToTranslate.push({
        text: parts.join('\n---\n'),
        fullPath: node.fullPath,
      });
    }
    
    if (textsToTranslate.length === 0) return;
    
    try {
      // 分批翻译（每次最多20条，避免请求体过大）
      const batchSize = 20;
      for (let i = 0; i < textsToTranslate.length; i += batchSize) {
        const batch = textsToTranslate.slice(i, i + batchSize);
        
        // 合并一批文本用换行分隔（百度翻译支持\n分隔多段文本）
        const combinedText = batch.map(t => t.text).join('\n#####\n');
        
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: combinedText,
            from: 'auto',
            to: settings.baiduTranslateTarget || 'zh',
            apiUrl: settings.baiduTranslateApiUrl || '',
            appId: settings.baiduTranslateAppId,
            secretKey: settings.baiduTranslateSecretKey,
          }),
        });
        
        const data = await res.json();
        if (data.error) {
          console.warn('批量翻译失败:', data.error);
          continue;
        }
        
        // 按分隔符拆分翻译结果
        const translatedParts = data.translated.split('\n#####\n');
        
        // 映射回各节点
        const newTranslations: Record<string, string> = {};
        batch.forEach((item, idx) => {
          if (translatedParts[idx]) {
            newTranslations[item.fullPath] = translatedParts[idx];
          }
        });
        
        setTranslatedTexts(prev => ({ ...prev, ...newTranslations }));
      }
    } catch (err) {
      console.warn('批量翻译失败:', err);
    }
  };

  // ===== 角色预览 =====

  async function handlePreview(node: ChubSearchNode) {
    // 查找该节点所属的组
    const variants = cardGroups.get(node.name) || [node];
    setPreviewVariants(variants);
    setPreviewVariantIndex(variants.findIndex(v => v.fullPath === node.fullPath));
    setPreviewNode(node);
    setPreviewLoading(true);
    setPreviewDetail(null);
    try {
      const detail = await fetchChubCharacter(node.fullPath);
      setPreviewDetail(detail);
    } catch {
      // 即使详情加载失败，也可以显示搜索结果显示的信息
      setPreviewDetail(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  // ===== 快速导入 =====

  async function handleQuickImport() {
    if (!quickUrl.trim()) return;
    setIsQuickImporting(true);
    setImportMessage(null);
    const result = await importFromUrl(quickUrl.trim());
    if (result.success) {
      setImportMessage({ type: 'success', text: `${t('characterMarket.importSuccess')} ${result.name}` });
      setQuickUrl('');
    } else {
      setImportMessage({ type: 'error', text: result.error || t('characterMarket.importFailed') });
    }
    setIsQuickImporting(false);
  }

  // ===== 渲染 =====

  const allLinks = [...PRESET_LINKS, ...customLinks];

  // 本地过滤结果
  const filteredResults = useMemo(() => {
    if (!localFilter.trim()) return searchResults;
    const lower = localFilter.toLowerCase();
    return searchResults.filter(node =>
      node.name.toLowerCase().includes(lower) ||
      node.description?.toLowerCase().includes(lower) ||
      node.topics?.some(t => t.toLowerCase().includes(lower))
    );
  }, [searchResults, localFilter]);

  // 按名称分组后的展平列表（每组取第一个，标记变体数量）
  const groupedResults = useMemo(() => {
    const groups = new Map<string, { node: ChubSearchNode; count: number }>();

    for (const node of filteredResults) {
      const existing = groups.get(node.name);
      if (existing) {
        // 已存在：如果不完全重合，增加计数
        if (existing.node.description !== node.description ||
            existing.node.starCount !== node.starCount ||
            JSON.stringify(existing.node.topics) !== JSON.stringify(node.topics)) {
          groups.set(node.name, { node: existing.node, count: existing.count + 1 });
        }
        // 重合则完全忽略
      } else {
        groups.set(node.name, { node, count: 1 });
      }
    }

    return Array.from(groups.values());
  }, [filteredResults]);

  const totalPages = Math.max(1, Math.ceil(groupedResults.length / PER_PAGE));
  const currentPageStart = searchPage * PER_PAGE;
  const currentPageResults = useMemo(() => {
    return groupedResults.slice(currentPageStart, currentPageStart + PER_PAGE);
  }, [groupedResults, searchPage]);

  return (
    <div className="h-full overflow-y-auto bg-dark-200">
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe className="w-6 h-6 text-parlor-500" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white font-serif tracking-tight">
              {t('nav.characterMarket')}
            </h1>
          </div>
        </div>

        <p className="text-sm text-gray-400 -mt-4">
          {t('characterMarket.description')}
        </p>

        {/* 全局导入消息 */}
        {importMessage && (
          <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
            importMessage.type === 'success'
              ? 'bg-green-900/20 text-green-300 border border-green-800'
              : 'bg-red-900/20 text-red-300 border border-red-800'
          }`}>
            {importMessage.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            <span>{importMessage.text}</span>
            <button onClick={() => setImportMessage(null)} className="ml-auto p-1 hover:opacity-70">
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── 快速导入 ── */}
        <div className="glass p-4 border border-glass-border">
          <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
            <Download size={16} className="text-parlor-500" />
            {t('characterMarket.quickImport')}
          </h3>
          <p className="text-xs text-gray-400 mb-3">
            {t('characterMarket.quickImportHint')}
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={quickUrl}
              onChange={e => setQuickUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleQuickImport()}
              placeholder={t('characterMarket.quickImportPlaceholder')}
              className="flex-1 px-3 py-2 bg-dark-50 border border-glass-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-parlor-500 text-sm"
            />
            <button
              onClick={handleQuickImport}
              disabled={isQuickImporting || !quickUrl.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-parlor-500 text-white rounded-lg hover:bg-parlor-600 disabled:opacity-50 transition-colors text-sm whitespace-nowrap"
            >
              {isQuickImporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              <span>{isQuickImporting ? t('characterMarket.importing') : t('common.import')}</span>
            </button>
          </div>
          {/* 快捷导入按钮 */}
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-xs text-gray-500 self-center shrink-0">快捷导入:</span>
            <button onClick={() => { setQuickUrl('https://cards.sillytavern.one'); }} className="text-xs px-2.5 py-1 rounded-md bg-dark-100 border border-glass-border text-gray-400 hover:text-parlor-300 hover:border-parlor-500/30 transition-colors">SillyTavern Pro</button>
            <button onClick={() => { setQuickUrl('https://charavault.net'); }} className="text-xs px-2.5 py-1 rounded-md bg-dark-100 border border-glass-border text-gray-400 hover:text-parlor-300 hover:border-parlor-500/30 transition-colors">CharaVault</button>
            <button onClick={() => { setQuickUrl('https://www.characterhub.org'); }} className="text-xs px-2.5 py-1 rounded-md bg-dark-100 border border-glass-border text-gray-400 hover:text-parlor-300 hover:border-parlor-500/30 transition-colors">Character Hub</button>
            <a href="https://cards.sillytavern.one" target="_blank" rel="noopener noreferrer" className="text-xs px-2.5 py-1 rounded-md bg-dark-100 border border-glass-border text-gray-400 hover:text-parlor-300 hover:border-parlor-500/30 transition-colors flex items-center gap-1">
              浏览市场 <ExternalLink size={10} />
            </a>
          </div>
        </div>

        {/* ── 搜索区域 ── */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Search size={16} className="text-parlor-500" />
              {t('characterMarket.search')}
            </h3>
            <span className="text-xs px-2 py-0.5 bg-parlor-900/30 text-parlor-400 rounded-full font-medium">
              Chub.ai
            </span>
          </div>
          <div className="flex gap-2">
            <select
              value={searchSort}
              onChange={e => setSearchSort(e.target.value)}
              className="px-3 py-2 bg-dark-50 border border-glass-border rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-parlor-500"
            >
              <option value="star_count">{t('characterMarket.sortStarCount')}</option>
              <option value="download_count">{t('characterMarket.sortDownloadCount')}</option>
              <option value="rating">{t('characterMarket.sortRating')}</option>
              <option value="created_at">{t('characterMarket.sortNewest')}</option>
            </select>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={t('characterMarket.searchPlaceholder')}
              className="flex-1 px-3 py-2 bg-dark-50 border border-glass-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-parlor-500 text-sm"
            />
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="flex items-center gap-2 px-4 py-2 bg-parlor-500 text-white rounded-lg hover:bg-parlor-600 disabled:opacity-50 transition-colors text-sm"
            >
              {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              <span>{t('characterMarket.search')}</span>
            </button>
          </div>
        </div>

        {/* 标签折叠 */}
        {availableTopics.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs text-gray-400 font-medium">
                {t('characterMarket.topics')} ({availableTopics.length})
              </span>
              <button
                onClick={() => setTopicsCollapsed(!topicsCollapsed)}
                className="p-0.5 rounded hover:bg-dark-300 text-gray-500"
              >
                {topicsCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
            {!topicsCollapsed && (
              <div className="flex flex-wrap gap-1.5">
                {availableTopics.map(topic => (
                  <button
                    key={topic}
                    onClick={() => { setSearchQuery(topic); handleSearchWithQuery(topic); }}
                    className="px-2 py-0.5 text-[11px] rounded-full bg-dark-300 text-gray-300 hover:bg-parlor-600 hover:text-white transition-colors"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {searchError && !isSearching && (
          <div className="text-center py-8 text-gray-500 text-sm">
            {searchError}
          </div>
        )}

        {searchResults.length > 0 && (
          <div>
            <p className="text-sm text-gray-400 mb-3">
              {t('characterMarket.searchResults', { count: searchResults.length })}
            </p>
            {/* 本地过滤 */}
            {searchResults.length > 0 && (
              <div className="mb-3">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={localFilter}
                    onChange={e => setLocalFilter(e.target.value)}
                    placeholder={t('characterMarket.filterPlaceholder') || '过滤当前结果...'}
                    className="w-full pl-8 pr-3 py-1.5 text-[12px] rounded-lg bg-dark-300 border border-glass-border text-gray-200 placeholder-gray-500 focus:outline-none focus:border-parlor-500"
                  />
                  {localFilter && (
                    <button
                      onClick={() => setLocalFilter('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className="text-[11px] text-gray-500 mt-1">
                  已过滤: {filteredResults.length} / {searchResults.length}
                </div>
              </div>
            )}
            {filteredResults.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm">
                没有匹配的结果，试试其他关键词。
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {currentPageResults.map(item => (
                <MarketCharacterCard
                  key={item.node.fullPath}
                  node={item.node}
                  variantCount={item.count}
                  translatedText={translatedTexts[item.node.fullPath]}
                  importingId={importingId}
                  translatingId={translatingId}
                  onPreview={handlePreview}
                  onImport={handleImport}
                  onTranslate={handleTranslate}
                  t={t}
                />
              ))}
            </div>
          {/* 翻页导航 */}
          {filteredResults.length > 0 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              {/* 上一页 */}
              <button
                onClick={() => goToPage(searchPage - 1)}
                disabled={searchPage === 0 || isSearching}
                className="p-1.5 rounded-lg bg-dark-100 border border-glass-border text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>

              {/* 页码按钮 */}
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                // 计算显示的页码范围（最多7个）
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i;
                } else if (searchPage <= 3) {
                  pageNum = i;
                } else if (searchPage >= totalPages - 4) {
                  pageNum = totalPages - 7 + i;
                } else {
                  pageNum = searchPage - 3 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => goToPage(pageNum)}
                    disabled={isSearching}
                    className={`w-8 h-8 text-xs rounded-lg transition-colors ${
                      pageNum === searchPage
                        ? 'bg-parlor-600 text-white font-medium'
                        : 'bg-dark-100 border border-glass-border text-gray-400 hover:text-white'
                    } disabled:opacity-50`}
                  >
                    {pageNum + 1}
                  </button>
                );
              })}

              {/* 下一页 */}
              <button
                onClick={() => goToPage(searchPage + 1)}
                disabled={(searchPage >= totalPages - 1 && !hasMore && !backgroundLoading) || isSearching}
                className="p-1.5 rounded-lg bg-dark-100 border border-glass-border text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>

              {/* 统计信息 */}
              <span className="text-[11px] text-gray-500 ml-2 flex items-center gap-1">
                {filteredResults.length} 个角色
                {backgroundLoading && (
                  <span className="flex items-center gap-1 text-parlor-400">
                    <Loader2 size={10} className="animate-spin" />
                    加载中...
                  </span>
                )}
              </span>
            </div>
          )}
          </div>
        )}

        {/* ── 分隔线 ── */}
        <hr className="border-glass-border" />

        {/* ── 角色市场链接 ── */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Globe size={16} className="text-parlor-500" />
            {t('characterMarket.links')}
          </h3>
          <button
            onClick={() => openLinkForm()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-parlor-500 text-white rounded-lg hover:bg-parlor-600 transition-colors"
          >
            <Plus size={16} />
            <span>{t('characterMarket.addLink')}</span>
          </button>
        </div>

        {/* 链接表单 */}
        {showLinkForm && (
          <div className="glass p-4 border border-glass-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white text-sm">
                {editingLink ? t('characterMarket.editLink') : t('characterMarket.addLink')}
              </h3>
              <button onClick={() => setShowLinkForm(false)} className="p-1 text-gray-500 hover:text-white hover:bg-glass-white rounded transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">{t('characterMarket.name')}</label>
                <input
                  type="text"
                  value={linkFormName}
                  onChange={e => setLinkFormName(e.target.value)}
                  placeholder={t('characterMarket.namePlaceholder')}
                  className="w-full px-3 py-2 bg-dark-50 border border-glass-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-parlor-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">{t('characterMarket.url')}</label>
                <input
                  type="url"
                  value={linkFormUrl}
                  onChange={e => setLinkFormUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 bg-dark-50 border border-glass-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-parlor-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">{t('characterMarket.description')}</label>
                <input
                  type="text"
                  value={linkFormDesc}
                  onChange={e => setLinkFormDesc(e.target.value)}
                  placeholder={t('characterMarket.descriptionPlaceholder')}
                  className="w-full px-3 py-2 bg-dark-50 border border-glass-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-parlor-500 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setShowLinkForm(false)}
                  className="px-4 py-2 text-sm text-gray-400 border border-glass-border rounded-lg hover:text-white hover:bg-glass-white transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleLinkSave}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-parlor-500 text-white rounded-lg hover:bg-parlor-600 transition-colors"
                >
                  <Save size={16} />
                  <span>{t('common.save')}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 链接网格 */}
        {linksLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-parlor-500 border-t-transparent" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allLinks.map(link => (
              <div
                key={link.id}
                className="relative group glass p-4 border border-glass-border hover:shadow-glass-sm transition-all"
              >
                {/* Preset badge */}
                {link.isPreset && (
                  <span className="absolute top-3 right-3 text-[10px] px-1.5 py-0.5 bg-glass-white text-gray-400 rounded uppercase tracking-wider">
                    preset
                  </span>
                )}

                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-glass-white rounded-lg flex items-center justify-center shrink-0">
                      <Globe size={20} className="text-parlor-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white truncate flex items-center gap-1 text-sm">
                        {link.name}
                        <ExternalLink size={14} className="text-gray-500 shrink-0" />
                      </h3>
                    </div>
                  </div>
                  {link.description && (
                    <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                      {link.description}
                    </p>
                  )}
                  <p className="text-[11px] text-gray-600 mt-2 truncate">
                    {link.url}
                  </p>
                </a>

                {/* Edit/Delete for custom links */}
                {!link.isPreset && (
                  <div className="absolute bottom-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openLinkForm(link)}
                      className="p-1.5 text-gray-500 hover:text-parlor-400 hover:bg-glass-white rounded transition-colors"
                      title={t('common.edit')}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleLinkDelete(link.id)}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-glass-white rounded transition-colors"
                      title={t('common.delete')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 导入选择弹窗：角色附带世界书/关联知识书时弹出 */}
      {importChoiceNode && importChoiceDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setImportChoiceNode(null)}>
          <div className="w-full max-w-md mx-4 bg-dark-200 border border-glass-border rounded-xl p-5 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-medium text-gray-200 mb-1">{t('characterMarket.importChoiceTitle')}</h3>
            <p className="text-xs text-gray-400 mb-4">{importChoiceNode.name}</p>

            {/* ── 内嵌世界书 ── */}
            {(importChoiceDetail.definition?.embedded_lorebook?.entries?.length || 0) > 0 && (
              <>
                <p className="text-xs text-gray-500 mb-3">
                  {t('characterMarket.importChoiceDesc', { count: importChoiceDetail.definition?.embedded_lorebook?.entries?.length || 0 })}
                </p>
                <div className="space-y-2 mb-3">
                  {(['together', 'separate', 'character-only'] as const).map(mode => (
                    <label
                      key={mode}
                      className={`flex items-start gap-3 w-full text-left px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                        importSelectedMode === mode
                          ? 'bg-parlor-500/10 border border-parlor-500/30'
                          : 'border border-glass-border hover:bg-dark-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="importMode"
                        checked={importSelectedMode === mode}
                        onChange={() => setImportSelectedMode(mode)}
                        className="mt-0.5 accent-parlor-500"
                      />
                      <div>
                        {mode === 'together' && (
                          <>
                            <div className="text-sm text-gray-200 font-medium">{t('characterMarket.importTogether')}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{t('characterMarket.importTogetherHint')}</div>
                          </>
                        )}
                        {mode === 'separate' && (
                          <>
                            <div className="text-sm text-gray-200 font-medium">{t('characterMarket.importSeparate')}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{t('characterMarket.importSeparateHint')}</div>
                          </>
                        )}
                        {mode === 'character-only' && (
                          <>
                            <div className="text-sm text-gray-200 font-medium">{t('characterMarket.importCharacterOnly')}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{t('characterMarket.importCharacterOnlyHint')}</div>
                          </>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </>
            )}

            {/* ── 关联的独立知识书 ── */}
            {importChoiceNode.relatedLorebooks && importChoiceNode.relatedLorebooks.length > 0 && (
              <div className={((importChoiceDetail.definition?.embedded_lorebook?.entries?.length || 0) > 0) ? 'border-t border-glass-border pt-3 mt-1' : ''}>
                <p className="text-xs text-gray-500 mb-2">
                  该角色还关联了 {importChoiceNode.relatedLorebooks.length} 个独立知识书，是否一并导入？
                </p>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {importChoiceNode.relatedLorebooks.map((lb, i) => (
                    <label key={i} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-dark-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={importSelectedLorebooks.includes(lb.id)}
                        onChange={() => {
                          setImportSelectedLorebooks(prev =>
                            prev.includes(lb.id)
                              ? prev.filter(id => id !== lb.id)
                              : [...prev, lb.id]
                          );
                        }}
                        className="rounded border-gray-500 accent-parlor-500"
                      />
                      <span className="text-sm text-gray-300">{lb.name || lb.id}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* ── 无任何可导入内容 ── */}
            {(importChoiceDetail.definition?.embedded_lorebook?.entries?.length || 0) === 0
              && (!importChoiceNode.relatedLorebooks || importChoiceNode.relatedLorebooks.length === 0) && (
              <p className="text-xs text-gray-500 mb-3">该角色不附带世界书或关联知识书。</p>
            )}

            {/* ── 确认 / 取消 ── */}
            <div className="flex gap-2 mt-4 pt-3 border-t border-glass-border">
              <button
                onClick={async () => {
                  const node = importChoiceNode;
                  const detail = importChoiceDetail;
                  const mode = importSelectedMode;
                  const selectedLbs = importSelectedLorebooks;
                  setImportChoiceNode(null);
                  setImportChoiceDetail(null);

                  // 1. 导入角色（含内嵌世界书处理）
                  if (detail.definition?.embedded_lorebook?.entries?.length > 0) {
                    await doImport(node, detail, mode);
                  } else {
                    await doImport(node, detail, 'character-only');
                  }

                  // 2. 导入关联知识书为独立 WorldInfo 分组
                  for (const lbId of selectedLbs) {
                    try {
                      const lbNode = await fetchChubLorebook(lbId);
                      const embeddedLb = lbNode?.definition?.embedded_lorebook;
                      if (embeddedLb?.entries?.length > 0) {
                        const newWorldInfo: WorldInfo = {
                          id: generateUUID(),
                          name: lbNode.name || lbId,
                          enabled: true,
                          autoAssociate: true,
                          entries: embeddedLb.entries.map((e: any) => ({
                            id: generateUUID(),
                            keywords: e.keys || [],
                            secondaryKeywords: e.secondary_keys || undefined,
                            content: e.content || '',
                            enabled: e.enabled !== false,
                            insertionOrder: e.insertion_order || 0,
                          })),
                          createdAt: Date.now(),
                          updatedAt: Date.now(),
                        };
                        await worldInfoOps.add(newWorldInfo);
                      }
                    } catch (err) {
                      console.error(`导入关联知识书失败: ${lbId}`, err);
                    }
                  }

                  // 3. 更新导入消息
                  if (selectedLbs.length > 0) {
                    const name = node?.name || '角色';
                    setImportMessage({ type: 'success', text: `${name} 已导入，同时导入了 ${selectedLbs.length} 个关联知识书` });
                  }
                }}
                className="flex-1 px-3 py-2 text-sm bg-parlor-500 text-white rounded-lg hover:bg-parlor-600 transition-colors"
              >
                确认导入
              </button>
              <button
                onClick={() => { setImportChoiceNode(null); setImportChoiceDetail(null); }}
                className="px-3 py-2 text-sm border border-glass-border rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                {t('characterMarket.importCancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      <CharacterPreviewModal
        previewNode={previewNode}
        previewDetail={previewDetail}
        previewLoading={previewLoading}
        previewVariants={previewVariants}
        previewVariantIndex={previewVariantIndex}
        importingId={importingId}
        onClose={() => setPreviewNode(null)}
        onVariantChange={(idx, node) => {
          setPreviewVariantIndex(idx);
          setPreviewNode(node);
          setPreviewLoading(true);
          setPreviewDetail(null);
        }}
        onImport={(node) => { handleImport(node); setPreviewNode(null); }}
      />
    </div>
  );
}
