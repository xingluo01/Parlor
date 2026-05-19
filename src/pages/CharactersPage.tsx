import { useEffect, useState, useMemo, useCallback, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { generateUUID } from '../utils/uuid';
import { Search, Plus, Upload, ArrowUpDown, Tag, Clock, ArrowUpAz, ArrowDownAz, Calendar, ChevronDown, ChevronUp, ChevronRight, X, Trash2, Edit3, CheckSquare, Square, FolderOpen, Link2, Sparkles, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Avatar, ConfirmDialog } from '../components/ui';
import { useChatStore, useCharacterStore } from '../stores';
import { characterOps, chatOps, connectionOps, personaOps, worldInfoOps } from '../db';
import { avatarCache, subscribeAvatar, prewarmAvatars } from '../utils/avatarCache';
import RelationModal from '../components/modals/RelationModal';
import CharacterProcessModal from '../components/modals/CharacterProcessModal';
import { useSelectMode } from '../hooks/useSelectMode';
import type { ChatSession, CharacterCard, WorldInfo } from '../types';
import { callAI } from '../services/ai';
import { extractJSON, buildCreateCharacterPrompt, CARD_HEIGHT_MAP } from '../utils/prompts';
import { settingsOps } from '../db';

type SortOption = 'recent' | 'newest' | 'oldest' | 'alpha-asc' | 'alpha-desc';
type TagSortOption = 'alpha' | 'count';

const SORT_OPTIONS: { value: SortOption; labelKey: string; icon: React.ReactNode }[] = [
  { value: 'recent', labelKey: 'characters.sortRecentlyChatted', icon: <Clock className="w-4 h-4" /> },
  { value: 'newest', labelKey: 'characters.sortNewest', icon: <Calendar className="w-4 h-4" /> },
  { value: 'oldest', labelKey: 'characters.sortOldest', icon: <Calendar className="w-4 h-4" /> },
  { value: 'alpha-asc', labelKey: 'characters.sortAZ', icon: <ArrowUpAz className="w-4 h-4" /> },
  { value: 'alpha-desc', labelKey: 'characters.sortZToA', icon: <ArrowDownAz className="w-4 h-4" /> },
];

export function CharactersPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { setActiveChat } = useChatStore();
  const [characters, setCharacters] = useState<CharacterCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showTags, setShowTags] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [tagSortBy, setTagSortBy] = useState<TagSortOption>('alpha');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [characterToDelete, setCharacterToDelete] = useState<CharacterCard | null>(null);
  const [viewMode] = useState<'grid' | 'list'>('grid');
  const [cardSize, setCardSize] = useState<'small' | 'medium' | 'large'>('medium');
  const { selectMode, selectedIds, toggleSelectMode, handleToggleSelect, handleSelectAll, clearSelection } = useSelectMode<CharacterCard>();
  const [deleteSelectedConfirm, setDeleteSelectedConfirm] = useState(false);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [lastChatTimeByChar, setLastChatTimeByChar] = useState<Map<string, number>>(new Map());
  const [worldInfoBooks, setWorldInfoBooks] = useState<WorldInfo[]>([]);
  const [relationModalChar, setRelationModalChar] = useState<CharacterCard | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [aiCreateChar, setAiCreateChar] = useState<{ bookId: string; bookName: string } | null>(null);
  const [aiCharName, setAiCharName] = useState('');
  const [aiCharPrompt, setAiCharPrompt] = useState('');
  const [aiCharGenerating, setAiCharGenerating] = useState(false);
  const [aiRefPersonaId, setAiRefPersonaId] = useState('');
  const [aiRefBookId, setAiRefBookId] = useState('');
  const [aiRefCharId, setAiRefCharId] = useState('');
  const [aiRefCharBookId, setAiRefCharBookId] = useState('');
  const [personas, setPersonas] = useState<any[]>([]);
  const [processCharId, setProcessCharId] = useState<string | null>(null);

  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    async function loadCharacters() {
      try {
        const [chars, compactChats, appSettings] = await Promise.all([
          characterOps.getAllCompact(),
          chatOps.getCompact(),
          settingsOps.get(),
        ]);
        if (appSettings?.cardSize) setCardSize(appSettings.cardSize);
        const chatTimeMap = new Map<string, number>();
        for (const chat of compactChats) {
          const prev = chatTimeMap.get(chat.characterId) ?? 0;
          if ((chat.updatedAt || 0) > prev) {
            chatTimeMap.set(chat.characterId, chat.updatedAt || 0);
          }
        }
        if (mounted) {
          setCharacters(chars);
          setLastChatTimeByChar(chatTimeMap);
          setIsLoading(false);
          prewarmAvatars(chars.map(c => c.id));
        }
        // 加载世界观分组 + 初始化折叠状态
        worldInfoOps.getAll().then(books => {
          if (!mounted) return;
          if (Array.isArray(books)) {
            setWorldInfoBooks(books);
            // 默认全部折叠，只展开最近交互角色所在分组
            const allBookIds = books.map(b => b.id);
            setCollapsedGroups(new Set(allBookIds));
            if (chatTimeMap.size > 0) {
              const recentCharIds = [...chatTimeMap.entries()]
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([charId]) => charId);
              const toExpand = new Set<string>();
              for (const char of chars) {
                if (recentCharIds.includes(char.id) && char.worldInfoId && books.some(b => b.id === char.worldInfoId)) {
                  toExpand.add(char.worldInfoId);
                }
              }
              if (toExpand.size > 0) {
                setCollapsedGroups(prev => {
                  const next = new Set(prev);
                  toExpand.forEach(id => next.delete(id));
                  return next;
                });
              }
            }
          }
        }).catch(() => {});
      } catch (error) {
        console.error('[CharactersPage] Failed to load characters:', error);
        if (mounted) setIsLoading(false);
      }
    }
    loadCharacters();
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    personaOps.getAll().then(p => setPersonas(p)).catch(() => {});
  }, []);

  const allTagsWithCounts = useMemo(() => {
    const tagCounts = new Map<string, number>();
    characters.forEach(char => {
      char.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });
    return Array.from(tagCounts.entries()).map(([tag, count]) => ({ tag, count }));
  }, [characters]);

  const filteredTags = useMemo(() => {
    let result = [...allTagsWithCounts];
    if (tagSearch.trim()) {
      const query = tagSearch.toLowerCase();
      result = result.filter(({ tag }) => tag.toLowerCase().includes(query));
    }
    if (tagSortBy === 'alpha') {
      result.sort((a, b) => a.tag.localeCompare(b.tag));
    } else {
      result.sort((a, b) => b.count - a.count);
    }
    return result;
  }, [allTagsWithCounts, tagSearch, tagSortBy]);

  const filteredCharacters = useMemo(() => {
    if (!characters || characters.length === 0) return [];
    let result = [...characters];
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(char =>
        char.name.toLowerCase().includes(query) ||
        (char.tags || []).some(tag => tag.toLowerCase().includes(query))
      );
    }
    if (selectedTag !== null) {
      result = result.filter(char =>
        char.tags && Array.isArray(char.tags) && char.tags.includes(selectedTag)
      );
    }
    switch (sortBy) {
      case 'recent': {
        const withChats = result.filter(c => lastChatTimeByChar.has(c.id));
        const withoutChats = result.filter(c => !lastChatTimeByChar.has(c.id));
        withChats.sort((a, b) => (lastChatTimeByChar.get(b.id) ?? 0) - (lastChatTimeByChar.get(a.id) ?? 0));
        withoutChats.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        result = [...withChats, ...withoutChats];
        break;
      }
      case 'newest': result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); break;
      case 'oldest': result.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)); break;
      case 'alpha-asc': result.sort((a, b) => (a.name || '').localeCompare(b.name || '')); break;
      case 'alpha-desc': result.sort((a, b) => (b.name || '').localeCompare(a.name || '')); break;
    }
    return result;
  }, [characters, searchQuery, sortBy, selectedTag, lastChatTimeByChar]);

  const createNewChat = useCallback(async (character: CharacterCard) => {
    let personaId: string | null = null;
    if (character.defaultPersonaId) {
      personaId = character.defaultPersonaId;
    } else {
      const allPersonas = await personaOps.getAll();
      const defaultPersona = allPersonas.find(p => p.isDefault);
      if (defaultPersona) personaId = defaultPersona.id;
    }
    // 获取所有启用了"默认关联"的世界书
    const allWorldInfos = await worldInfoOps.getAll();
    const enabledWorldInfoIds = allWorldInfos
      .filter(b => b.enabled && b.autoAssociate !== false)
      .map(b => b.id);

    const newChat: ChatSession = {
      id: generateUUID(),
      characterId: character.id,
      personaId,
      messages: [],
      enabledWorldInfoIds: enabledWorldInfoIds.length > 0 ? enabledWorldInfoIds : [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (character.firstMessage) {
      const allGreetings = [character.firstMessage, ...(character.alternateGreetings ?? [])];
      newChat.messages.push({
        id: generateUUID(),
        role: 'assistant',
        content: character.firstMessage,
        timestamp: Date.now(),
        ...(allGreetings.length > 1 ? { swipes: allGreetings } : {}),
      });
    }
    await chatOps.add(newChat);
    setActiveChat(newChat);
    navigate(`/chat/${newChat.id}`);
  }, [setActiveChat, navigate]);

  const handleCharacterClick = useCallback(async (characterId: string) => {
    try {
      const character = characters.find(c => c.id === characterId);
      if (!character) return;
      const allChats = await chatOps.getAll();
      const existingChat = allChats
        .filter(chat => chat.characterId === characterId)
        .sort((a, b) => b.updatedAt - a.updatedAt)[0];
      if (existingChat) {
        setActiveChat(existingChat);
        navigate(`/chat/${existingChat.id}`);
        return;
      }
      await createNewChat(character);
    } catch (error) {
      console.error('Failed to create chat:', error);
    }
  }, [characters, setActiveChat, navigate, createNewChat]);

  const handleTagClick = useCallback((tag: string) => {
    setSelectedTag(prev => prev === tag ? null : tag);
  }, []);

  const clearTagFilter = useCallback(() => setSelectedTag(null), []);

  const handleDeleteCharacter = useCallback(async (characterId: string) => {
    try {
      await characterOps.delete(characterId);
      setCharacters(prev => prev.filter(c => c.id !== characterId));
      setDeleteConfirm(null);
      setCharacterToDelete(null);
    } catch (error) {
      console.error('Failed to delete character:', error);
    }
  }, []);

  const confirmDelete = useCallback((character: CharacterCard, e: React.MouseEvent) => {
    e.stopPropagation();
    setCharacterToDelete(character);
    setDeleteConfirm(character.id);
  }, []);

  const handleToggleSelectWithStop = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    handleToggleSelect(id);
  }, [handleToggleSelect]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsBatchDeleting(true);
    try {
      await characterOps.batchDelete([...selectedIds]);
      setCharacters(prev => prev.filter(c => !selectedIds.has(c.id)));
      clearSelection();
    } catch (err) {
      console.error('Batch delete failed:', err);
    } finally {
      setIsBatchDeleting(false);
      setDeleteSelectedConfirm(false);
    }
  }, [selectedIds]);

  const handleDeleteAll = useCallback(async () => {
    setIsBatchDeleting(true);
    try {
      await characterOps.batchDelete(characters.map(c => c.id));
      setCharacters([]);
      clearSelection();
    } catch (err) {
      console.error('Delete all failed:', err);
    } finally {
      setIsBatchDeleting(false);
      setDeleteAllConfirm(false);
    }
  }, [characters]);

  const handleCloneSelected = useCallback(async () => {
    if (selectedIds.size !== 1) return;
    const charId = selectedIds.values().next().value;
    const char = characters.find(c => c.id === charId);
    if (!char) return;

    const clone: CharacterCard = {
      ...char,
      id: generateUUID(),
      name: `${char.name}(副本)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await characterOps.add(clone);
    useCharacterStore.getState().addCharacter(clone);
    clearSelection();
  }, [selectedIds, characters, clearSelection]);

  const handleEdit = useCallback((characterId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/characters/${characterId}/edit`);
  }, [navigate]);

  const handleRelation = useCallback((character: CharacterCard, e: React.MouseEvent) => {
    e.stopPropagation();
    setRelationModalChar(character);
  }, []);

  const currentSortLabel = t(SORT_OPTIONS.find(o => o.value === sortBy)?.labelKey || 'characters.sortLabel');

  // 从角色中提取分组（按 worldInfoId 归类）
  const characterGroups = useMemo(() => {
    const groupMap = new Map<string, { count: number }>();
    for (const c of characters) {
      if (c.worldInfoId) {
        const existing = groupMap.get(c.worldInfoId);
        if (existing) existing.count++;
        else groupMap.set(c.worldInfoId, { count: 1 });
      }
    }
    return groupMap;
  }, [characters]);

  // ─── AI 创建角色 ──────────────────────────────────────────────────────────────

  async function handleAICreateCharacter() {
    if (!aiCreateChar || !aiCharName.trim()) return;
    setAiCharGenerating(true);
    try {
      const connection = await connectionOps.getActive();
      if (!connection) { alert('请先配置 AI 连接'); return; }

      // 获取世界观条目作为上下文
      const book = worldInfoBooks.find(b => b.id === aiCreateChar.bookId);
      const worldContext = book ? `世界观「${book.name}」的设定：\n${book.entries.slice(0, 15).map(e => `- ${e.keywords.join(', ')}: ${e.content.slice(0, 150)}`).join('\n')}` : '';

      // 人设参考
      let personaContext = '';
      if (aiRefPersonaId) {
        const persona = personas.find((p: any) => p.id === aiRefPersonaId);
        if (persona) {
          personaContext = `参考人设「${persona.name}」的信息：\n描述：${(persona.description || '').slice(0, 200)}\n性格：${(persona.personality || '').slice(0, 100)}`;
        }
      }

      // 世界观组参考
      let bookContext = '';
      if (aiRefBookId) {
        const refBook = worldInfoBooks.find(b => b.id === aiRefBookId);
        if (refBook) {
          bookContext = `参考世界观组「${refBook.name}」的设定：\n${refBook.entries.slice(0, 10).map(e => `- ${e.keywords.join(', ')}: ${e.content.slice(0, 150)}`).join('\n')}`;
        }
      }

      // 角色参考
      let charRefContext = '';
      if (aiRefCharId) {
        const refChar = characters.find(c => c.id === aiRefCharId);
        if (refChar) {
          charRefContext = `参考角色「${refChar.name}」的信息：\n描述：${(refChar.description || '').slice(0, 200)}\n性格：${(refChar.personality || '').slice(0, 100)}`;
        }
      }

      // 角色组参考
      let charGroupContext = '';
      if (aiRefCharBookId) {
        const refBook = worldInfoBooks.find(b => b.id === aiRefCharBookId);
        if (refBook) {
          charGroupContext = `\n参考角色组「${refBook.name}」的设定：\n${refBook.entries.slice(0, 10).map(e => `- ${e.keywords.join(', ')}: ${e.content.slice(0, 150)}`).join('\n')}`;
        }
      }

      const prompt = buildCreateCharacterPrompt(worldContext, personaContext, bookContext + charGroupContext, aiCharName, aiCharPrompt, charRefContext);

      const resultText = await callAI(connection, '你是一个角色创作专家。', prompt, { temperature: 0.5, maxTokens: 2048 });

      // 解析并保存角色
      const result = extractJSON(resultText);
      const card: any = {
        id: generateUUID(), name: result.name || aiCharName,
        description: result.description || '', personality: result.personality || '',
        scenario: result.scenario || '', firstMessage: result.firstMessage || `*${result.name || aiCharName}出现了*`,
        tags: [...(result.tags || []), book?.name || ''].filter(Boolean),
        worldInfoId: aiCreateChar.bookId,
        createdAt: Date.now(), updatedAt: Date.now(),
      };
      await characterOps.add(card);
      useCharacterStore.getState().addCharacter(card);
      setAiCreateChar(null);
      setAiCharName('');
      setAiCharPrompt('');
    } catch (e: any) {
      alert(`创建失败: ${e.message}`);
    } finally {
      setAiCharGenerating(false);
    }
  }

  return (
    <>
    <div className="flex flex-col h-full overflow-hidden">
      {/* Non-scrolling header area */}
      <div className="flex-shrink-0 px-3 pt-3 md:px-6 md:pt-6">
        {/* Page header */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-white font-serif tracking-tight">{t('characters.title')}</h1>
            <p className="text-gray-600 text-xs sm:text-sm">
              {t('characters.countOf', { filtered: filteredCharacters.length, total: characters.length })}
            </p>
          </div>
          <div className="flex gap-1.5 sm:gap-2 flex-shrink-0">
            {selectMode ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => handleSelectAll(filteredCharacters)} disabled={selectedIds.size === filteredCharacters.length}>
                  <CheckSquare className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('characters.selectAll')}</span>
                </Button>
                {selectedIds.size === 1 && (
                  <Button variant="ghost" size="sm" onClick={handleCloneSelected}>
                    <Copy className="w-4 h-4" />
                    复制
                  </Button>
                )}
                {selectedIds.size === 1 && (
                  <Button variant="ghost" size="sm" onClick={() => setProcessCharId(selectedIds.values().next().value!)}>
                    <Sparkles className="w-4 h-4" />
                    处理
                  </Button>
                )}
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setDeleteSelectedConfirm(true)}
                  disabled={selectedIds.size === 0 || isBatchDeleting}
                  isLoading={isBatchDeleting}
                >
                  <Trash2 className="w-4 h-4" />
                  {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteAllConfirm(true)}
                  disabled={isBatchDeleting || characters.length === 0}
                  className="text-red-400 hover:text-red-300"
                  title={t('characters.deleteAll')}
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('common.all')}</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={toggleSelectMode}>
                  <X className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('common.cancel')}</span>
                </Button>
              </>
            ) : (
              <>
                {characters.length > 0 && (
                  <>
                  <Button variant="ghost" size="sm" onClick={toggleSelectMode} title={t('characters.select')}>
                    <CheckSquare className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('characters.select')}</span>
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => navigate('/characters/import')} title={t('common.import')}>
                    <Upload className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('common.import')}</span>
                  </Button>
                  <Button size="sm" onClick={() => navigate('/characters/new')} title={t('characters.new')}>
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('characters.new')}</span>
                  </Button>
                  </>
                )}
              </> 
            )}
          </div>
        </div>

        {/* Search + Sort */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <Input
              placeholder={t('characters.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="relative flex-shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowSortMenu(!showSortMenu)}
            >
              <ArrowUpDown className="w-4 h-4" />
              <span className="hidden sm:inline">{currentSortLabel}</span>
            </Button>
            {showSortMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 bg-dark-100 border border-glass-border rounded-xl py-1 min-w-[180px] shadow-dramatic">
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => { setSortBy(option.value); setShowSortMenu(false); }}
                      className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                        sortBy === option.value
                          ? 'text-parlor-400 bg-parlor-500/10'
                          : 'text-gray-400 hover:text-white hover:bg-glass-white'
                      }`}
                    >
                      {option.icon}
                      {t(option.labelKey)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tags toggle + active filter */}
        <div className="flex items-center gap-3 mb-3">
          {allTagsWithCounts.length > 0 && (
            <button
              onClick={() => setShowTags(!showTags)}
              className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 hover:text-white transition-colors flex-shrink-0"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>{showTags ? t('characters.hideTags') : t('characters.showTags')}</span>
              {showTags ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
          {selectedTag && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-parlor-500/15 text-parlor-400 rounded-full text-xs">
              {selectedTag}
              <button onClick={() => setSelectedTag(null)} className="ml-0.5 hover:text-white">x</button>
            </span>
          )}
        </div>

        {/* Tags Section */}
        {allTagsWithCounts.length > 0 && showTags && (
          <div className="mb-3 space-y-2">
            <div className="flex gap-2">
              <div className="flex-1 relative min-w-0">
                <Input
                  placeholder={t('characters.searchTagsPlaceholder')}
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                  className="text-sm"
                />
                {tagSearch && (
                  <button
                    onClick={() => setTagSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => setTagSortBy('alpha')}
                  className={`px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                    tagSortBy === 'alpha' ? 'bg-parlor-500/80 text-white' : 'bg-glass-white text-gray-500 hover:text-white'
                  }`}
                >{t('characters.sortAZShort')}</button>
                <button
                  onClick={() => setTagSortBy('count')}
                  className={`px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                    tagSortBy === 'count' ? 'bg-parlor-500/80 text-white' : 'bg-glass-white text-gray-500 hover:text-white'
                  }`}
                >{t('characters.sortCount')}</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
              <button
                onClick={clearTagFilter}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  selectedTag === null ? 'bg-parlor-500/80 text-white' : 'bg-glass-white text-gray-500 hover:text-white'
                }`}
              >
                {t('common.all')} ({characters.length})
              </button>
              {filteredTags.map(({ tag, count }) => (
                <button
                  key={tag}
                  onClick={() => handleTagClick(tag)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                    selectedTag === tag ? 'bg-parlor-500/80 text-white' : 'bg-glass-white text-gray-500 hover:text-white'
                  }`}
                >
                  {tag}
                  <span className="opacity-50">({count})</span>
                </button>
              ))}
            </div>
            {filteredTags.length === 0 && tagSearch && (
              <p className="text-xs text-gray-600">{t('characters.noTagsMatch', { query: tagSearch })}</p>
            )}
          </div>
        )}
      </div>

      {/* Virtualized scroll container */}
      <div ref={parentRef} className="flex-1 overflow-y-auto px-3 pb-4 md:px-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-parlor-500" />
          </div>
        ) : filteredCharacters.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-14 h-14 rounded-full bg-dark-200 flex items-center justify-center mb-4 ring-1 ring-glass-border">
              <Search className="w-6 h-6 text-gray-600" />
            </div>
            <p className="text-gray-500">
              {searchQuery || selectedTag ? t('characters.noMatch') : t('characters.noCharacters')}
            </p>
            {!searchQuery && !selectedTag && (
              <Button className="mt-4" onClick={() => navigate('/characters/new')}>
                <Plus className="w-4 h-4" />
                {t('characters.createFirst')}
              </Button>
            )}
          </div>
        ) : (
          <div className="px-4 pb-4 space-y-4">
            {(() => {
              const grouped = new Map<string, CharacterCard[]>();
              const ungrouped: CharacterCard[] = [];

              for (const char of filteredCharacters) {
                if (char.worldInfoId && worldInfoBooks.some(b => b.id === char.worldInfoId)) {
                  const group = grouped.get(char.worldInfoId) || [];
                  group.push(char);
                  grouped.set(char.worldInfoId, group);
                } else {
                  ungrouped.push(char);
                }
              }

              return (
                <>
                  {Array.from(grouped.entries()).map(([bookId, chars]) => {
                    const book = worldInfoBooks.find(b => b.id === bookId);
                    const isCollapsed = collapsedGroups.has(bookId);
                    return (
                      <div key={bookId} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                        {/* 卡片头 - 点击切换折叠 */}
                        <div
                          className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors select-none"
                          onClick={() => {
                            setCollapsedGroups(prev => {
                              const next = new Set(prev);
                              if (next.has(bookId)) next.delete(bookId);
                              else next.add(bookId);
                              return next;
                            });
                          }}
                        >
                          <ChevronRight
                            size={16}
                            className={`text-gray-400 transition-transform duration-200 shrink-0 ${isCollapsed ? '' : 'rotate-90'}`}
                          />
                          <FolderOpen size={16} className="text-parlor-500 shrink-0" />
                          <h3 className="font-semibold text-sm truncate">{book?.name || '未知分组'}</h3>
                          <span className="text-xs text-gray-500 shrink-0">({chars.length} 个角色)</span>
                          <div className="ml-auto flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            {/* 添加角色按钮 */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAiCreateChar({ bookId, bookName: book?.name || '' });
                              }}
                              className="p-1.5 text-gray-400 hover:text-parlor-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                              title="AI 创建角色"
                            >
                              <Sparkles size={14} />
                            </button>
                            {/* 关联设置按钮 */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRelationModalChar(chars[0]);
                              }}
                              className="p-1.5 text-gray-400 hover:text-parlor-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                              title="关联设置"
                            >
                              <Link2 size={14} />
                            </button>
                            {/* 移出分组 */}
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!confirm(`确定将「${book?.name || '未知分组'}」下的所有角色移出分组？`)) return;
                                for (const char of chars) {
                                  await characterOps.update(char.id, { worldInfoId: '' as any });
                                  useCharacterStore.getState().updateCharacter(char.id, { worldInfoId: '' as any });
                                }
                                window.location.reload();
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                              title="移出分组"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        {/* 卡片主体：角色网格（折叠时隐藏） */}
                        {!isCollapsed && (
                          <div className="p-3">
                            <div className={viewMode === 'grid'
                              ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3'
                              : 'space-y-2'
                            }>
                              {chars.map(char => (
                                viewMode === 'grid' ? (
                                  <GridCard
                                    key={char.id}
                                    character={char}
                                    cardSize={cardSize}
                                    isSelected={selectedIds.has(char.id)}
                                    selectMode={selectMode}
                                    onToggleSelect={handleToggleSelectWithStop}
                                    onClick={handleCharacterClick}
                                    onEdit={handleEdit}
                                    onDelete={confirmDelete}
                                    onRelation={handleRelation}
                                  />
                                ) : (
                                  <ListCard
                                    key={char.id}
                                    character={char}
                                    isSelected={selectedIds.has(char.id)}
                                    selectMode={selectMode}
                                    onToggleSelect={handleToggleSelectWithStop}
                                    onClick={handleCharacterClick}
                                    onEdit={handleEdit}
                                    onDelete={confirmDelete}
                                    onRelation={handleRelation}
                              />
                            )
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {ungrouped.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <div
                        className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors select-none"
                        onClick={() => {
                          setCollapsedGroups(prev => {
                            const next = new Set(prev);
                            if (next.has('__ungrouped__')) next.delete('__ungrouped__');
                            else next.add('__ungrouped__');
                            return next;
                          });
                        }}
                      >
                        <ChevronRight
                          size={16}
                          className={`text-gray-400 transition-transform duration-200 shrink-0 ${collapsedGroups.has('__ungrouped__') ? '' : 'rotate-90'}`}
                        />
                        <h3 className="font-semibold text-sm text-gray-500">未分组</h3>
                        <span className="text-xs text-gray-500">({ungrouped.length} 个角色)</span>
                      </div>
                      {!collapsedGroups.has('__ungrouped__') && (
                      <div className="p-3">
                        <div className={viewMode === 'grid'
                          ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3'
                          : 'space-y-2'
                        }>
                          {ungrouped.map(char => (
                            viewMode === 'grid' ? (
                              <GridCard
                                key={char.id}
                                character={char}
                                cardSize={cardSize}
                                isSelected={selectedIds.has(char.id)}
                                selectMode={selectMode}
                                onToggleSelect={handleToggleSelectWithStop}
                                onClick={handleCharacterClick}
                                onEdit={handleEdit}
                                onDelete={confirmDelete}
                                onRelation={handleRelation}
                              />
                            ) : (
                              <ListCard
                                key={char.id}
                                character={char}
                                isSelected={selectedIds.has(char.id)}
                                selectMode={selectMode}
                                onToggleSelect={handleToggleSelectWithStop}
                                onClick={handleCharacterClick}
                                onEdit={handleEdit}
                                onDelete={confirmDelete}
                                onRelation={handleRelation}
                              />
                            )
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>

      {/* Delete Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => { setDeleteConfirm(null); setCharacterToDelete(null); }}
        onConfirm={() => deleteConfirm && handleDeleteCharacter(deleteConfirm)}
        title={t('characters.deleteConfirm')}
        message={t('characters.deleteConfirm', { name: characterToDelete?.name || '' })}
        confirmText={t('common.delete')}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={deleteSelectedConfirm}
        onClose={() => setDeleteSelectedConfirm(false)}
        onConfirm={handleDeleteSelected}
        title={t('chatsList.deleteSelectedTitle', { count: selectedIds.size })}
        message={t('chatsList.deleteSelectedConfirm', { count: selectedIds.size })}
        confirmText={isBatchDeleting ? t('common.loading') : t('common.delete')}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={deleteAllConfirm}
        onClose={() => setDeleteAllConfirm(false)}
        onConfirm={handleDeleteAll}
        title={t('characters.deleteAll')}
        message={t('characters.deleteAllConfirm')}
        confirmText={isBatchDeleting ? t('common.loading') : t('characters.deleteAll')}
        variant="danger"
      />
      {relationModalChar && (
        <RelationModal
          character={relationModalChar}
          allCharacters={filteredCharacters}
          onSave={async (relations) => {
            await fetch(`/api/characters/${relationModalChar.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ relations }),
            });
            useCharacterStore.getState().updateCharacter(relationModalChar.id, { relations });
          }}
          onClose={() => setRelationModalChar(null)}
        />
      )}

      {/* AI 创建角色弹窗 */}
      {aiCreateChar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setAiCreateChar(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl border w-full max-w-md mx-4 p-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-1">AI 创建角色 — {aiCreateChar.bookName}</h3>
            <p className="text-xs text-gray-500 mb-3">将基于世界观设定和你的要求生成角色</p>
            <input value={aiCharName} onChange={e => setAiCharName(e.target.value)} placeholder="角色名称（必填）" className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-900 mb-2" />
            <select value={aiRefPersonaId} onChange={e => setAiRefPersonaId(e.target.value)} className="w-full mb-2 px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-900">
              <option value="">不参考人设</option>
              {personas.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={aiRefBookId} onChange={e => setAiRefBookId(e.target.value)} className="w-full mb-2 px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-900">
              <option value="">参考世界观组</option>
              {worldInfoBooks.filter(b => b.id !== aiCreateChar?.bookId).map(b => <option key={b.id} value={b.id}>{b.name}（{b.entries.length}条目）</option>)}
            </select>
            <select value={aiRefCharBookId} onChange={e => setAiRefCharBookId(e.target.value)} className="w-full mb-2 px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-900">
              <option value="">参考角色组</option>
              {Array.from(characterGroups.entries())
                .filter(([id]) => id !== aiCreateChar?.bookId)
                .map(([id, { count }]) => {
                  const book = worldInfoBooks.find(b => b.id === id);
                  return <option key={id} value={id}>{book?.name || '未命名分组'}（{count}个角色）</option>;
                })}
            </select>
            <select value={aiRefCharId} onChange={e => setAiRefCharId(e.target.value)} className="w-full mb-2 px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-900">
              <option value="">参考角色</option>
              {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <textarea value={aiCharPrompt} onChange={e => setAiCharPrompt(e.target.value)} placeholder="补充要求（可选）：角色定位、性格特点、能力等..." className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-900 mb-3" rows={3} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setAiCreateChar(null)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">取消</button>
              <button onClick={handleAICreateCharacter} disabled={aiCharGenerating || !aiCharName.trim()} className="px-4 py-2 text-sm bg-parlor-500 text-white rounded-lg disabled:opacity-50">
                {aiCharGenerating ? '生成中...' : 'AI 创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    {processCharId && (() => {
      const char = characters.find(c => c.id === processCharId);
      if (!char) return null;
      return createPortal(
        <CharacterProcessModal
          character={char}
          onClose={() => setProcessCharId(null)}
          onComplete={() => { setProcessCharId(null); clearSelection(); }}
        />,
        document.body
      );
    })()}
    </>
  );
}

// ─── Shared props ────────────────────────────────────────────────────────────
interface CardProps {
  character: CharacterCard;
  cardSize?: 'small' | 'medium' | 'large';
  isSelected: boolean;
  selectMode: boolean;
  onToggleSelect: (id: string, e: React.MouseEvent) => void;
  onClick: (id: string) => void;
  onEdit: (id: string, e: React.MouseEvent) => void;
  onDelete: (character: CharacterCard, e: React.MouseEvent) => void;
  onRelation: (character: CharacterCard, e: React.MouseEvent) => void;
}

function useCharacterAvatar(id: string): string | undefined {
  const [avatar, setAvatar] = useState<string | undefined>(() =>
    avatarCache.get(id) ?? undefined
  );
  useEffect(() => {
    if (avatarCache.has(id)) setAvatar(avatarCache.get(id) ?? undefined);
    return subscribeAvatar(id, () => setAvatar(avatarCache.get(id) ?? undefined));
  }, [id]);
  return avatar;
}

// ─── Grid card ──────────────────────────────────────────────────────────────
const GridCard = memo(function GridCard({
  character, cardSize, isSelected, selectMode,
  onToggleSelect, onClick, onEdit, onDelete, onRelation,
}: CardProps) {
  const avatar = useCharacterAvatar(character.id);
  const cardHeight = CARD_HEIGHT_MAP[cardSize || 'medium'];
  return (
    <div
      className={`character-card group ${cardHeight} overflow-hidden ${selectMode ? 'cursor-pointer' : ''} ${isSelected ? 'ring-1 ring-parlor-500/60' : ''}`}
      onClick={selectMode ? (e) => onToggleSelect(character.id, e) : () => onClick(character.id)}
    >
      {selectMode ? (
        <div className="absolute top-2 right-2 z-10">
          {isSelected
            ? <CheckSquare className="w-5 h-5 text-parlor-400" />
            : <Square className="w-5 h-5 text-gray-600" />
          }
        </div>
      ) : (
        <div className="absolute top-2 right-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex gap-1 z-10">
          <button
            onClick={(e) => onRelation(character, e)}
            className="p-1.5 rounded-lg bg-dark-200/90 hover:bg-dark-100 text-gray-500 hover:text-white transition-colors"
            title="关联设置"
          >
            <Link2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => onEdit(character.id, e)}
            className="p-1.5 rounded-lg bg-dark-200/90 hover:bg-dark-100 text-gray-500 hover:text-white transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => onDelete(character, e)}
            className="p-1.5 rounded-lg bg-dark-200/90 hover:bg-red-500/15 text-gray-500 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <div className="flex flex-col items-center text-center">
        <Avatar src={avatar} name={character.name} size="xl" className="mb-3" />
        <h3 className="font-medium text-white truncate w-full text-sm">{character.name}</h3>
        {character.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 justify-center">
            {character.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="tag text-2xs">{tag}</span>
            ))}
            {character.tags.length > 3 && (
              <span className="tag text-2xs">+{character.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

// ─── List card ──────────────────────────────────────────────────────────────
const ListCard = memo(function ListCard({
  character, isSelected, selectMode,
  onToggleSelect, onClick, onEdit, onDelete, onRelation,
}: CardProps) {
  const avatar = useCharacterAvatar(character.id);
  return (
    <div
      className={`bg-dark-200/80 border border-glass-border rounded-lg p-3 cursor-pointer hover:border-parlor-500/10 transition-all group flex items-center gap-3.5 ${isSelected ? 'ring-1 ring-parlor-500/60' : ''}`}
      onClick={selectMode ? (e) => onToggleSelect(character.id, e) : () => onClick(character.id)}
    >
      {selectMode ? (
        <div className="flex-shrink-0">
          {isSelected
            ? <CheckSquare className="w-5 h-5 text-parlor-400" />
            : <Square className="w-5 h-5 text-gray-600" />
          }
        </div>
      ) : (
        <Avatar src={avatar} name={character.name} size="sm" className="flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-white truncate text-sm">{character.name}</h3>
        {character.creatorNotes ? (
          <p className="text-xs text-gray-600 truncate mt-0.5">
            {character.creatorNotes.split('\n').find(l => l.trim()) ?? character.creatorNotes}
          </p>
        ) : null}
      </div>
      {!selectMode && (
        <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={(e) => onRelation(character, e)}
            className="p-1.5 rounded-lg bg-dark-200/90 hover:bg-dark-100 text-gray-500 hover:text-white transition-colors"
            title="关联设置"
          >
            <Link2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => onEdit(character.id, e)}
            className="p-1.5 rounded-lg bg-dark-200/90 hover:bg-dark-100 text-gray-500 hover:text-white transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => onDelete(character, e)}
            className="p-1.5 rounded-lg bg-dark-200/90 hover:bg-red-500/15 text-gray-500 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
});

export default CharactersPage;
