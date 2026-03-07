import { useEffect, useState, useMemo, useCallback, useRef, memo } from 'react';
import { generateUUID } from '../utils/uuid';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, Plus, Upload, ArrowUpDown, Tag, Clock, ArrowUpAz, ArrowDownAz, Calendar, ChevronDown, ChevronUp, X, Trash2, Edit3, LayoutGrid, List, CheckSquare, Square } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Avatar, ConfirmDialog } from '../components/ui';
import { useChatStore } from '../stores';
import { characterOps, chatOps, personaOps } from '../db';
import { avatarCache, requestAvatar, subscribeAvatar, prewarmAvatars } from '../utils/avatarCache';
import type { ChatSession, CharacterCard } from '../types';

type SortOption = 'recent' | 'newest' | 'oldest' | 'alpha-asc' | 'alpha-desc';
type TagSortOption = 'alpha' | 'count';

const SORT_OPTIONS: { value: SortOption; label: string; icon: React.ReactNode }[] = [
  { value: 'recent', label: 'Recently Chatted', icon: <Clock className="w-4 h-4" /> },
  { value: 'newest', label: 'Newest First', icon: <Calendar className="w-4 h-4" /> },
  { value: 'oldest', label: 'Oldest First', icon: <Calendar className="w-4 h-4" /> },
  { value: 'alpha-asc', label: 'A to Z', icon: <ArrowUpAz className="w-4 h-4" /> },
  { value: 'alpha-desc', label: 'Z to A', icon: <ArrowDownAz className="w-4 h-4" /> },
];

function useCols(parentRef: React.RefObject<HTMLDivElement | null>): number {
  const [cols, setCols] = useState(5);
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w < 640) setCols(2);
      else if (w < 1024) setCols(3);
      else if (w < 1280) setCols(4);
      else setCols(5);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [parentRef]);
  return cols;
}

export function CharactersPage() {
  const navigate = useNavigate();
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
  const [viewMode, setViewModeRaw] = useState<'grid' | 'list'>(
    () => (localStorage.getItem('parlor-characters-view') as 'grid' | 'list') || 'grid'
  );
  const setViewMode = (mode: 'grid' | 'list') => {
    setViewModeRaw(mode);
    localStorage.setItem('parlor-characters-view', mode);
  };
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteSelectedConfirm, setDeleteSelectedConfirm] = useState(false);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [lastChatTimeByChar, setLastChatTimeByChar] = useState<Map<string, number>>(new Map());

  const parentRef = useRef<HTMLDivElement>(null);
  const cols = useCols(parentRef);

  useEffect(() => {
    let mounted = true;
    async function loadCharacters() {
      try {
        const [chars, compactChats] = await Promise.all([
          characterOps.getAllCompact(),
          chatOps.getCompact(),
        ]);
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
      } catch (error) {
        console.error('[CharactersPage] Failed to load characters:', error);
        if (mounted) setIsLoading(false);
      }
    }
    loadCharacters();
    return () => { mounted = false; };
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
        char.tags.some(tag => tag.toLowerCase().includes(query))
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

  const rows = useMemo(() => {
    const r: CharacterCard[][] = [];
    for (let i = 0; i < filteredCharacters.length; i += cols) {
      r.push(filteredCharacters.slice(i, i + cols));
    }
    return r;
  }, [filteredCharacters, cols]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 240,
    overscan: 3,
  });

  const listVirtualizer = useVirtualizer({
    count: filteredCharacters.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 5,
  });

  const gridVirtualItems = rowVirtualizer.getVirtualItems();
  const listVirtualItems = listVirtualizer.getVirtualItems();
  useEffect(() => {
    const ids: string[] = viewMode === 'grid'
      ? gridVirtualItems.flatMap(vr => rows[vr.index]?.map(c => c.id) ?? [])
      : listVirtualItems.map(vr => filteredCharacters[vr.index]?.id).filter((id): id is string => !!id);
    ids.forEach(id => requestAvatar(id));
  }, [gridVirtualItems, listVirtualItems, viewMode, rows, filteredCharacters]);

  const createNewChat = useCallback(async (character: CharacterCard) => {
    let personaId: string | null = null;
    if (character.defaultPersonaId) {
      personaId = character.defaultPersonaId;
    } else {
      const allPersonas = await personaOps.getAll();
      const defaultPersona = allPersonas.find(p => p.isDefault);
      if (defaultPersona) personaId = defaultPersona.id;
    }
    const newChat: ChatSession = {
      id: generateUUID(),
      characterId: character.id,
      personaId,
      messages: [],
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

  const toggleSelectMode = useCallback(() => {
    setSelectMode(prev => !prev);
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredCharacters.map(c => c.id)));
  }, [filteredCharacters]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsBatchDeleting(true);
    try {
      await characterOps.batchDelete([...selectedIds]);
      setCharacters(prev => prev.filter(c => !selectedIds.has(c.id)));
      setSelectedIds(new Set());
      setSelectMode(false);
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
      setSelectedIds(new Set());
      setSelectMode(false);
    } catch (err) {
      console.error('Delete all failed:', err);
    } finally {
      setIsBatchDeleting(false);
      setDeleteAllConfirm(false);
    }
  }, [characters]);

  const handleEdit = useCallback((characterId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/characters/${characterId}/edit`);
  }, [navigate]);

  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label || 'Sort';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Non-scrolling header area */}
      <div className="flex-shrink-0 px-3 pt-3 md:px-6 md:pt-6">
        {/* Page header */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-white font-serif tracking-tight">Characters</h1>
            <p className="text-gray-600 text-xs sm:text-sm">
              {filteredCharacters.length} of {characters.length}
            </p>
          </div>
          <div className="flex gap-1.5 sm:gap-2 flex-shrink-0">
            {selectMode ? (
              <>
                <Button variant="ghost" size="sm" onClick={selectAll} disabled={selectedIds.size === filteredCharacters.length}>
                  <CheckSquare className="w-4 h-4" />
                  <span className="hidden sm:inline">Select All</span>
                </Button>
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
                  title="Delete all characters"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">All</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={toggleSelectMode}>
                  <X className="w-4 h-4" />
                  <span className="hidden sm:inline">Cancel</span>
                </Button>
              </>
            ) : (
              <>
                {/* View mode toggle */}
                <div className="flex rounded-lg overflow-hidden border border-glass-border">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 sm:p-2 transition-colors ${viewMode === 'grid' ? 'bg-parlor-500/80 text-white' : 'bg-dark-100 text-gray-600 hover:text-white'}`}
                    title="Grid view"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 sm:p-2 transition-colors ${viewMode === 'list' ? 'bg-parlor-500/80 text-white' : 'bg-dark-100 text-gray-600 hover:text-white'}`}
                    title="List view"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>
                {characters.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={toggleSelectMode} title="Select">
                    <CheckSquare className="w-4 h-4" />
                    <span className="hidden sm:inline">Select</span>
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => navigate('/characters/import')} title="Import">
                  <Upload className="w-4 h-4" />
                  <span className="hidden sm:inline">Import</span>
                </Button>
                <Button size="sm" onClick={() => navigate('/characters/new')} title="New Character">
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">New</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Search + Sort */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <Input
              placeholder="Search characters..."
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
                      {option.label}
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
              <span>{showTags ? 'Hide Tags' : 'Tags'}</span>
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
                  placeholder="Search tags..."
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
                >A-Z</button>
                <button
                  onClick={() => setTagSortBy('count')}
                  className={`px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                    tagSortBy === 'count' ? 'bg-parlor-500/80 text-white' : 'bg-glass-white text-gray-500 hover:text-white'
                  }`}
                >Count</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
              <button
                onClick={clearTagFilter}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  selectedTag === null ? 'bg-parlor-500/80 text-white' : 'bg-glass-white text-gray-500 hover:text-white'
                }`}
              >
                All ({characters.length})
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
              <p className="text-xs text-gray-600">No tags match "{tagSearch}"</p>
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
              {searchQuery || selectedTag ? 'No characters match your filters' : 'No characters yet'}
            </p>
            {!searchQuery && !selectedTag && (
              <Button className="mt-4" onClick={() => navigate('/characters/new')}>
                <Plus className="w-4 h-4" />
                Create your first character
              </Button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
            {rowVirtualizer.getVirtualItems().map(vRow => {
              const row = rows[vRow.index];
              return (
                <div
                  key={vRow.key}
                  data-index={vRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: vRow.start,
                    left: 0,
                    width: '100%',
                    display: 'grid',
                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                    gap: '0.75rem',
                    paddingBottom: '0.75rem',
                  }}
                >
                  {row.map(character => (
                    <GridCard
                      key={character.id}
                      character={character}
                      isSelected={selectedIds.has(character.id)}
                      selectMode={selectMode}
                      onToggleSelect={toggleSelect}
                      onClick={handleCharacterClick}
                      onEdit={handleEdit}
                      onDelete={confirmDelete}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ height: listVirtualizer.getTotalSize(), position: 'relative' }}>
            {listVirtualizer.getVirtualItems().map(vItem => {
              const character = filteredCharacters[vItem.index];
              return (
                <div
                  key={vItem.key}
                  data-index={vItem.index}
                  ref={listVirtualizer.measureElement}
                  style={{ position: 'absolute', top: vItem.start, left: 0, width: '100%', paddingBottom: '0.375rem' }}
                >
                  <ListCard
                    character={character}
                    isSelected={selectedIds.has(character.id)}
                    selectMode={selectMode}
                    onToggleSelect={toggleSelect}
                    onClick={handleCharacterClick}
                    onEdit={handleEdit}
                    onDelete={confirmDelete}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => { setDeleteConfirm(null); setCharacterToDelete(null); }}
        onConfirm={() => deleteConfirm && handleDeleteCharacter(deleteConfirm)}
        title="Delete Character"
        message={`Are you sure you want to delete "${characterToDelete?.name}"? This will also delete all chats with this character. This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />

      <ConfirmDialog
        isOpen={deleteSelectedConfirm}
        onClose={() => setDeleteSelectedConfirm(false)}
        onConfirm={handleDeleteSelected}
        title="Delete Selected Characters"
        message={`Delete ${selectedIds.size} character${selectedIds.size !== 1 ? 's' : ''} and all their chats? This cannot be undone.`}
        confirmText={isBatchDeleting ? 'Deleting...' : `Delete ${selectedIds.size}`}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={deleteAllConfirm}
        onClose={() => setDeleteAllConfirm(false)}
        onConfirm={handleDeleteAll}
        title="Delete All Characters"
        message={`This will permanently delete all ${characters.length} character${characters.length !== 1 ? 's' : ''} and every chat associated with them. This cannot be undone.`}
        confirmText={isBatchDeleting ? 'Deleting...' : `Delete All ${characters.length}`}
        variant="danger"
      />
    </div>
  );
}

// ─── Shared props ────────────────────────────────────────────────────────────
interface CardProps {
  character: CharacterCard;
  isSelected: boolean;
  selectMode: boolean;
  onToggleSelect: (id: string, e: React.MouseEvent) => void;
  onClick: (id: string) => void;
  onEdit: (id: string, e: React.MouseEvent) => void;
  onDelete: (character: CharacterCard, e: React.MouseEvent) => void;
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
  character, isSelected, selectMode,
  onToggleSelect, onClick, onEdit, onDelete,
}: CardProps) {
  const avatar = useCharacterAvatar(character.id);
  return (
    <div
      className={`character-card group ${selectMode ? 'cursor-pointer' : ''} ${isSelected ? 'ring-1 ring-parlor-500/60' : ''}`}
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
  onToggleSelect, onClick, onEdit, onDelete,
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
