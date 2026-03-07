import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Plus, Search, Trash2, MoreVertical, Download, Edit3, CheckSquare, Square, GitBranch, UsersRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Avatar, Modal, ConfirmDialog } from '../components/ui';
import { useChatStore, useCharacterStore } from '../stores';
import { chatOps, characterOps, groupChatOps } from '../db';
import type { CharacterCard, GroupChat } from '../types';

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
  const navigate = useNavigate();
  const { chats, setChats, removeChat } = useChatStore();
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
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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
        title: chat.title || character?.name || 'Unknown Character',
        updatedAt: chat.updatedAt,
        messageCount: chat.messages.length,
        preview: lastMsg ? lastMsg.content.slice(0, 100) : 'No messages yet',
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
        preview: lastMsg ? lastMsg.content.slice(0, 100) : 'No messages yet',
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
    try {
      await Promise.all(selectedIds.map(id => chatOps.delete(id)));
      selectedIds.forEach(id => removeChat(id));
      setSelectedIds([]);
      setIsSelectMode(false);
      setBulkDeleteConfirm(false);
    } catch (error) {
      console.error('Failed to bulk delete chats:', error);
    }
  };

  const toggleSelectChat = (chatId: string) => {
    setSelectedIds(prev =>
      prev.includes(chatId) ? prev.filter(id => id !== chatId) : [...prev, chatId]
    );
  };

  const toggleSelectAll = () => {
    const soloIds = filteredChats.filter(c => c.kind === 'solo').map(c => c.id);
    if (selectedIds.length === soloIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(soloIds);
    }
  };

  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedIds([]);
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
      title: soloChat.title || `${character?.name || 'Unknown'} Chat`,
      character: character?.name || 'Unknown',
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
    a.download = `${(soloChat.title || character?.name || 'chat').replace(/[^a-z0-9]/gi, '_')}_export.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setContextMenu(null);
  };

  const totalCount = chats.length + groupChats.length;

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-serif tracking-tight">Chats</h1>
          <p className="text-gray-600 text-sm mt-1">
            {totalCount} conversation{totalCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {isSelectMode ? (
            <>
              <Button variant="ghost" onClick={exitSelectMode}>
                Cancel
              </Button>
              {selectedIds.length > 0 && (
                <Button variant="danger" onClick={() => setBulkDeleteConfirm(true)}>
                  <Trash2 className="w-4 h-4" />
                  Delete {selectedIds.length}
                </Button>
              )}
            </>
          ) : (
            <>
              {totalCount > 0 && (
                <Button variant="secondary" onClick={() => setIsSelectMode(true)}>
                  Select
                </Button>
              )}
              <Button onClick={() => navigate('/characters')}>
                <Plus className="w-4 h-4" />
                New Chat
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <Input
          placeholder="Search chats..."
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
            {selectedIds.length === filteredChats.filter(c => c.kind === 'solo').length
              ? <CheckSquare className="w-4 h-4 text-parlor-400" />
              : <Square className="w-4 h-4" />
            }
            {selectedIds.length === filteredChats.filter(c => c.kind === 'solo').length ? 'Deselect All' : 'Select All'}
          </button>
          {selectedIds.length > 0 && (
            <span className="text-2xs text-gray-700">{selectedIds.length} selected</span>
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
            {searchQuery ? 'No chats match your search' : 'No chats yet'}
          </p>
          {!searchQuery && (
            <Button className="mt-4" onClick={() => navigate('/characters')}>
              <Plus className="w-4 h-4" />
              Start a conversation
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
          {filteredChats.map((chat) => {
            const character = chat.characterId ? characterMap[chat.characterId] : undefined;
            const isSelected = selectedIds.includes(chat.id);
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
                        name={character?.name || 'Unknown'}
                        size="lg"
                        className="flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {chat.branchedFromChatId && (
                          <span title="Branched chat"><GitBranch className="w-3 h-3 text-parlor-400 flex-shrink-0" /></span>
                        )}
                        {isGroup && (
                          <span className="text-2xs uppercase tracking-[0.1em] text-accent-500 font-semibold bg-accent-500/10 px-1.5 py-0.5 rounded">Group</span>
                        )}
                        <h3 className="font-semibold text-white truncate text-sm">
                          {chat.title}
                        </h3>
                        <span className="text-2xs text-gray-700">
                          {chat.messageCount} msgs
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 truncate mt-0.5">
                        {getSearchSnippet(chat.id, chat.kind, searchQuery) ?? (chat.preview.length < chat.messageCount ? chat.preview + '...' : chat.preview)}
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
                    <div className="absolute right-0 top-full mt-1 z-50 bg-dark-100 border border-glass-border rounded-xl py-1 min-w-[160px] shadow-dramatic">
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
                        Rename
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
                          Export Chat
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
                        Delete Chat
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </motion.div>
      )}

      {/* Dialogs */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDeleteChat(deleteConfirm, deleteKind)}
        title="Delete Chat"
        message="Are you sure you want to delete this chat? All messages will be lost. This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />

      <ConfirmDialog
        isOpen={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        title={`Delete ${selectedIds.length} Chat${selectedIds.length !== 1 ? 's' : ''}`}
        message={`Are you sure you want to delete ${selectedIds.length} chat${selectedIds.length !== 1 ? 's' : ''}? All messages will be lost. This action cannot be undone.`}
        confirmText="Delete All"
        variant="danger"
      />

      <Modal
        isOpen={!!renameChat}
        onClose={() => {
          setRenameChat(null);
          setNewTitle('');
        }}
        title="Rename Chat"
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Chat Title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && newTitle.trim()) handleRenameChat(); }}
            placeholder="Enter a title for this chat"
            autoFocus
          />
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => {
              setRenameChat(null);
              setNewTitle('');
            }}>
              Cancel
            </Button>
            <Button onClick={handleRenameChat} disabled={!newTitle.trim()}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default ChatsPage;
