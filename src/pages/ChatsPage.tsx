import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { MessageSquare, Plus, Search, Trash2, MoreVertical, Download, Edit3, CheckSquare, Square, GitBranch, Users, UsersRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Avatar, Modal, ConfirmDialog } from '../components/ui';
import { useChatStore, useCharacterStore } from '../stores';
import { chatOps, characterOps, groupChatOps } from '../db';
import { useSelectMode } from '../hooks/useSelectMode';
import type { CharacterCard, GroupChat } from '../types';
import { sanitizeFilename } from '../utils/fileExport';

type UnifiedChat = {
  kind: 'solo' | 'group';
  id: string;
  title: string;
  updatedAt: number;
  messageCount: number;
  preview: string;
  characterId?: string;
  memberCount?: number;
  branchedFromChatId?: string;
};

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.03 } },
};

const fadeIn = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const } },
};

export function ChatsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
      const chats = useChatStore(s => s.chats);
      const setChats = useChatStore(s => s.setChats);
      const removeChat = useChatStore(s => s.removeChat);
  const { setCharacters } = useCharacterStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteKind, setDeleteKind] = useState<'solo' | 'group'>('solo');
  const [contextMenu, setContextMenu] = useState<string | null>(null);
  const [characterMap, setCharacterMap] = useState<Record<string, CharacterCard>>({});
  const [avatarMap, setAvatarMap] = useState<Record<string, string>>({});
  const [renameChat, setRenameChat] = useState<{ id: string; kind: 'solo' | 'group' } | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [groupChats, setGroupChats] = useState<GroupChat[]>([]);

  // Multi-select state
  const { selectMode: isSelectMode, selectedIds, setSelectMode: setIsSelectMode, handleToggleSelect, handleSelectAll, clearSelection } = useSelectMode<UnifiedChat>();
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [chatList, charList, groups] = await Promise.all([
          chatOps.getAll(),
          characterOps.getAll(),
          groupChatOps.getAll(),
        ]);
        setChats(chatList);
        setCharacters(charList);
        setGroupChats(groups);

        const map: Record<string, CharacterCard> = {};
        charList.forEach(c => { map[c.id] = c; });
        setCharacterMap(map);

        const uniqueCharIds = [...new Set(chatList.map(c => c.characterId))];
        if (uniqueCharIds.length > 0) {
          characterOps.getAvatars(uniqueCharIds).then(setAvatarMap).catch(() => {});
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [setChats, setCharacters]);

  const unifiedChats: UnifiedChat[] = useMemo(() => {
    const soloItems: UnifiedChat[] = chats.map(chat => {
      const character = characterMap[chat.characterId];
      const lastMsg = chat.messages.length > 0 ? chat.messages[chat.messages.length - 1] : null;
      return {
        kind: 'solo',
        id: chat.id,
        title: chat.title || character?.name || t('chatsList.unknownCharacter'),
        updatedAt: chat.updatedAt,
        messageCount: chat.messages.length,
        preview: lastMsg ? lastMsg.content.slice(0, 100) : t('chatsList.noMessagesYet'),
        characterId: chat.characterId,
        branchedFromChatId: chat.branchedFromChatId,
      };
    });

    const groupItems: UnifiedChat[] = groupChats.map(g => {
      const lastMsg = g.messages.length > 0 ? g.messages[g.messages.length - 1] : null;
      return {
        kind: 'group',
        id: g.id,
        title: g.name,
        updatedAt: g.updatedAt,
        messageCount: g.messages.length,
        preview: lastMsg ? lastMsg.content.slice(0, 100) : t('chatsList.noMessagesYet'),
        memberCount: g.members.length,
      };
    });

    return [...soloItems, ...groupItems].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [chats, groupChats, characterMap]);

  const filteredChats = useMemo(() => {
    if (!searchQuery) return unifiedChats;
    const query = searchQuery.toLowerCase();
    return unifiedChats.filter(chat => {
      if (chat.title.toLowerCase().includes(query)) return true;
      if (chat.kind === 'solo') {
        const soloChat = chats.find(c => c.id === chat.id);
        if (soloChat?.messages.some(m => m.content.toLowerCase().includes(query))) return true;
      }
      if (chat.kind === 'group') {
        const gc = groupChats.find(g => g.id === chat.id);
        if (gc?.messages.some(m => m.content.toLowerCase().includes(query))) return true;
      }
      return false;
    });
  }, [unifiedChats, searchQuery, chats, groupChats]);

  const getSearchSnippet = (chatId: string, kind: 'solo' | 'group', query: string): string | null => {
    if (!query) return null;
    const q = query.toLowerCase();
    const messages = kind === 'solo'
      ? chats.find(c => c.id === chatId)?.messages
      : groupChats.find(g => g.id === chatId)?.messages;
    if (!messages) return null;
    for (const m of messages) {
      const idx = m.content.toLowerCase().indexOf(q);
      if (idx !== -1) {
        const start = Math.max(0, idx - 40);
        const end = Math.min(m.content.length, idx + q.length + 80);
        return (start > 0 ? '...' : '') + m.content.slice(start, end) + (end < m.content.length ? '...' : '');
      }
    }
    return null;
  };

  const handleDeleteChat = async (chatId: string, kind: 'solo' | 'group') => {
    try {
      if (kind === 'solo') {
        await chatOps.delete(chatId);
        removeChat(chatId);
      } else {
        await groupChatOps.delete(chatId);
        setGroupChats(prev => prev.filter(g => g.id !== chatId));
      }
      setDeleteConfirm(null);
      setContextMenu(null);
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      const groupIds: string[] = [];
      const soloIds: string[] = [];
      selectedIds.forEach(id => {
        const chat = unifiedChats.find(c => c.id === id);
        if (chat?.kind === 'group') {
          groupIds.push(id);
        } else {
          soloIds.push(id);
        }
      });

      const promises: Promise<any>[] = [
        ...soloIds.map(id => chatOps.delete(id)),
        ...groupIds.map(id => groupChatOps.delete(id)),
      ];
      await Promise.all(promises);

      soloIds.forEach(id => removeChat(id));
      setGroupChats(prev => prev.filter(g => !groupIds.includes(g.id)));
      clearSelection();
      setBulkDeleteConfirm(false);
    } catch (error) {
      console.error('Failed to bulk delete chats:', error);
    }
  };

  const toggleSelectChat = (chatId: string) => {
    handleToggleSelect(chatId);
  };

  const toggleSelectAll = () => {
    handleSelectAll(filteredChats.filter(c => c.kind === 'solo'));
  };

  const exitSelectMode = () => {
    clearSelection();
  };

  const handleRenameChat = async () => {
    if (!renameChat || !newTitle.trim()) return;
    try {
      if (renameChat.kind === 'solo') {
        await chatOps.update(renameChat.id, { title: newTitle.trim() });
        setChats(chats.map(c => c.id === renameChat.id ? { ...c, title: newTitle.trim() } : c));
      } else {
        await groupChatOps.update(renameChat.id, { name: newTitle.trim() });
        setGroupChats(prev => prev.map(g => g.id === renameChat.id ? { ...g, name: newTitle.trim() } : g));
      }
      setRenameChat(null);
      setNewTitle('');
      setContextMenu(null);
    } catch (error) {
      console.error('Failed to rename chat:', error);
    }
  };

  const handleExportChat = (chatId: string) => {
    const soloChat = chats.find(c => c.id === chatId);
    if (!soloChat) return;
    const character = characterMap[soloChat.characterId];
    const exportData = {
      title: soloChat.title || t('chatsList.exportedTitle', { name: character?.name || t('chatsList.unknown') }),
      character: character?.name || t('chatsList.unknown'),
      exportedAt: new Date().toISOString(),
      messageCount: soloChat.messages.length,
      messages: soloChat.messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: new Date(m.timestamp).toISOString(),
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitizeFilename(soloChat.title || character?.name || 'chat')}_export.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setContextMenu(null);
  };

  const totalCount = chats.length + groupChats.length;
  const groupChats_filtered = filteredChats.filter(c => c.kind === 'group');
  const soloChats_filtered = filteredChats.filter(c => c.kind === 'solo');

  const renderChatCard = (chat: UnifiedChat) => {
    const character = chat.characterId ? characterMap[chat.characterId] : undefined;
    const isSelected = selectedIds.has(chat.id);
    const isGroup = chat.kind === 'group';
    return (
      <div key={chat.id} className="relative">
        <motion.div
          variants={fadeIn}
          className={`bg-dark-200/80 border border-glass-border p-3.5 rounded-xl cursor-pointer transition-all group ${
            isSelected
              ? 'border-parlor-500/30 bg-parlor-500/5'
              : 'hover:border-parlor-500/10'
          }`}
          onClick={() => {
            if (isSelectMode) {
              if (!isGroup) toggleSelectChat(chat.id);
            } else {
              navigate(isGroup ? `/group/${chat.id}` : `/chat/${chat.id}`);
            }
          }}
        >
          <div className="flex items-center gap-3.5">
            {isSelectMode && !isGroup ? (
              <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
                {isSelected
                  ? <CheckSquare className="w-5 h-5 text-parlor-400" />
                  : <Square className="w-5 h-5 text-gray-600" />
                }
              </div>
            ) : isGroup ? (
              <div className="flex-shrink-0 w-14 h-14 rounded-full bg-dark-100 border border-glass-border flex items-center justify-center">
                <UsersRound className="w-6 h-6 text-parlor-400" />
              </div>
            ) : (
              <Avatar
                src={avatarMap[chat.characterId || '']}
                name={character?.name || t('chatsList.unknown')}
                size="lg"
                className="flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {chat.branchedFromChatId && (
                  <span title={t('chatsList.branchedChat')}><GitBranch className="w-3 h-3 text-parlor-400 flex-shrink-0" /></span>
                )}
                {isGroup && (
                  <span className="text-2xs uppercase tracking-[0.1em] text-accent-500 font-semibold bg-accent-500/10 px-1.5 py-0.5 rounded">{t('chatsList.groupBadge')}</span>
                )}
                <h3 className="font-semibold text-white truncate text-sm">
                  {chat.title}
                </h3>
                <span className="text-2xs text-gray-700">
                  {t('chatsList.msgs', { count: chat.messageCount })}
                </span>
              </div>
              <p className="text-sm text-gray-600 truncate mt-0.5">
                {getSearchSnippet(chat.id, chat.kind, searchQuery) ?? (chat.preview.length >= 100 ? chat.preview + '...' : chat.preview)}
              </p>
              <p className="text-2xs text-gray-700 mt-1 tracking-wide">
                {new Date(chat.updatedAt).toLocaleDateString()} at{' '}
                {new Date(chat.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            {!isSelectMode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setContextMenu(contextMenu === chat.id ? null : chat.id);
                }}
                className="p-2 rounded-lg hover:bg-glass-white sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="w-4 h-4 text-gray-600" />
              </button>
            )}
          </div>
        </motion.div>

        {/* Context Menu */}
        {contextMenu === chat.id && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={(e) => {
                e.stopPropagation();
                setContextMenu(null);
              }}
            />
            <div className="absolute right-0 sm:right-auto sm:left-0 top-full mt-1 z-50 bg-dark-100 border border-glass-border rounded-xl py-1 min-w-[160px] shadow-dramatic">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRenameChat({ id: chat.id, kind: chat.kind });
                  setNewTitle(chat.title);
                  setContextMenu(null);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-400 hover:text-white hover:bg-glass-white flex items-center gap-2"
              >
                <Edit3 className="w-4 h-4" />
                {t('chatsList.rename')}
              </button>
              {!isGroup && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExportChat(chat.id);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-400 hover:text-white hover:bg-glass-white flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  {t('chatsList.exportChat')}
                </button>
              )}
              <div className="border-t border-glass-border my-1" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteConfirm(chat.id);
                  setDeleteKind(chat.kind);
                  setContextMenu(null);
                }}
                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {t('chatsList.deleteChat')}
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-serif tracking-tight">{t('chatsList.title')}</h1>
          <p className="text-gray-600 text-sm mt-1">
            {t('chatsList.conversations', { count: totalCount })}
          </p>
        </div>
        <div className="flex gap-2">
          {isSelectMode ? (
            <>
              <Button variant="ghost" size="sm" onClick={exitSelectMode}>
                {t('common.cancel')}
              </Button>
              {selectedIds.size > 0 && (
                <Button variant="danger" size="sm" onClick={() => setBulkDeleteConfirm(true)}>
                  <Trash2 className="w-4 h-4" />
                  {t('common.delete')} {selectedIds.size}
                </Button>
              )}
            </>
          ) : (
            <>
              {totalCount > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setIsSelectMode(true)}>
                  <CheckSquare className="w-4 h-4" />
                  {t('chatsList.selectLabel')}
                </Button>
              )}
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => navigate('/characters')}>
                  <Plus className="w-4 h-4" />
                  {t('nav.newChat')}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => navigate('/groups/new')}>
                  <Users className="w-4 h-4" />
                  {t('groups.newGroup') || '新建群聊'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <Input
          placeholder={t('chatsList.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
        />
      </div>

      {/* Select all row */}
      {isSelectMode && filteredChats.length > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-white transition-colors"
          >
            {selectedIds.size === filteredChats.filter(c => c.kind === 'solo').length
              ? <CheckSquare className="w-4 h-4 text-parlor-400" />
              : <Square className="w-4 h-4" />
            }
            {selectedIds.size === filteredChats.filter(c => c.kind === 'solo').length ? t('chatsList.deselectAll') : t('chatsList.selectAll')}
          </button>
          {selectedIds.size > 0 && (
            <span className="text-2xs text-gray-700">{t('chatsList.selected', { count: selectedIds.size })}</span>
          )}
        </div>
      )}

      {/* Chats List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-parlor-500" />
        </div>
      ) : filteredChats.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="w-14 h-14 rounded-full bg-dark-200 flex items-center justify-center mb-4 ring-1 ring-glass-border">
            <MessageSquare className="w-6 h-6 text-gray-600" />
          </div>
          <p className="text-gray-600">
            {searchQuery ? t('chatsList.noSearchMatch') : t('chatsList.noChats')}
          </p>
          {!searchQuery && (
            <Button className="mt-4" onClick={() => navigate('/characters')}>
              <Plus className="w-4 h-4" />
              {t('chatsList.startConversation')}
            </Button>
          )}
        </div>
      ) : (
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="space-y-1.5"
        >
          {groupChats_filtered.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 px-4 py-2">
                <UsersRound className="w-4 h-4 text-parlor-500" />
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">群聊 ({groupChats_filtered.length})</h2>
              </div>
              <div className="space-y-1.5">
                {groupChats_filtered.map(chat => renderChatCard(chat))}
              </div>
            </div>
          )}
          {soloChats_filtered.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 px-4 py-2">
                <MessageSquare className="w-4 h-4 text-parlor-500" />
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">单聊 ({soloChats_filtered.length})</h2>
              </div>
              <div className="space-y-1.5">
                {soloChats_filtered.map(chat => renderChatCard(chat))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Dialogs */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDeleteChat(deleteConfirm, deleteKind)}
        title={t('chatsList.deleteChat')}
        message={t('chatsList.deleteConfirmSimple')}
        confirmText={t('common.delete')}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        title={t('chatsList.deleteSelectedTitle', { count: selectedIds.size })}
        message={t('chatsList.deleteSelectedConfirm', { count: selectedIds.size })}
        confirmText={t('chatsList.deleteAll')}
        variant="danger"
      />

      <Modal
        isOpen={!!renameChat}
        onClose={() => {
          setRenameChat(null);
          setNewTitle('');
        }}
        title={t('chatsList.renameChat')}
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label={t('chatsList.chatTitle')}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && newTitle.trim()) handleRenameChat(); }}
            placeholder={t('chatsList.titlePlaceholder')}
            autoFocus
          />
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => {
              setRenameChat(null);
              setNewTitle('');
            }}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleRenameChat} disabled={!newTitle.trim()}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default ChatsPage;
