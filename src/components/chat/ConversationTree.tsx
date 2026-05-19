import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X, GitBranch, Bookmark, ChevronRight } from 'lucide-react';
import type { ChatSession, Message } from '../../types';

type ConversationTreeProps = {
  chat: ChatSession;
  branches: ChatSession[];
  onNavigateMessage: (messageId: string) => void;
  onNavigateBranch: (chatId: string) => void;
  onClose: () => void;
};

function formatCompactTimestamp(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return (
    d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + '...';
}

const roleDotColor: Record<Message['role'], string> = {
  user: 'bg-parlor-500',
  assistant: 'bg-accent-500',
  system: 'bg-gray-500',
};

export function ConversationTree({
  chat,
  branches,
  onNavigateMessage,
  onNavigateBranch,
  onClose,
}: ConversationTreeProps) {
  const { t } = useTranslation();
  const lastMessageId = chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].id : null;

  // Build a map from branchPointMessageId -> branches that fork from that message
  const branchMap = useMemo(() => {
    const map = new Map<string, ChatSession[]>();
    for (const branch of branches) {
      if (branch.branchPointMessageId) {
        const existing = map.get(branch.branchPointMessageId);
        if (existing) {
          existing.push(branch);
        } else {
          map.set(branch.branchPointMessageId, [branch]);
        }
      }
    }
    return map;
  }, [branches]);

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 z-50"
      />

      {/* Panel */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-dark-200 border-l border-glass-border z-50 flex flex-col shadow-dramatic"
      >
        {/* Header */}
        <div className="sticky top-0 bg-dark-200/95 backdrop-blur-sm border-b border-glass-border p-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-parlor-400" />
            <h2 className="font-semibold text-white font-serif tracking-tight">
              {t('chat.conversationTree.title')}
              <span className="ml-2 text-sm font-normal text-gray-500 font-sans">
                {t('chat.conversationTree.messagesCount', { count: chat.messages.length })}
              </span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-glass-white transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Tree View */}
        <div className="flex-1 overflow-y-auto p-3">
          {chat.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <GitBranch className="w-10 h-10 text-gray-600 mb-3" />
              <p className="text-gray-500 text-sm">{t('chat.conversationTree.noMessages')}</p>
              <p className="text-gray-600 text-xs mt-1">
                {t('chat.conversationTree.startHint')}
              </p>
            </div>
          ) : (
            <div className="relative">
              {chat.messages.map((msg, idx) => {
                const isLast = idx === chat.messages.length - 1;
                const isActive = msg.id === lastMessageId;
                const messageBranches = branchMap.get(msg.id);
                const hasSwipes = msg.swipes && msg.swipes.length > 1;

                return (
                  <div key={msg.id}>
                    {/* Message node with connector line */}
                    <div className="flex">
                      {/* Connector column */}
                      <div className="flex flex-col items-center w-6 flex-shrink-0">
                        {/* Dot */}
                        <div
                          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-3 ${roleDotColor[msg.role]}`}
                        />
                        {/* Vertical line (hidden on last node if no branches) */}
                        {(!isLast || messageBranches) && (
                          <div className="flex-1 w-0 border-l-2 border-glass-border" />
                        )}
                      </div>

                      {/* Node content */}
                      <button
                        onClick={() => onNavigateMessage(msg.id)}
                        className={`flex-1 text-left rounded-lg py-2 px-3 ml-1 mb-1 transition-colors ${
                          isActive
                            ? 'bg-parlor-500/10 border border-parlor-500/30'
                            : 'hover:bg-glass-white border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-xs font-medium ${
                              msg.role === 'user'
                                ? 'text-parlor-400'
                                : msg.role === 'assistant'
                                ? 'text-accent-500'
                                : 'text-gray-400'
                            }`}
                          >
                            {t(`chat.role.${msg.role}`)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatCompactTimestamp(msg.timestamp)}
                          </span>
                          {hasSwipes && (
                            <span className="text-2xs text-gray-500 bg-dark-200 px-1.5 py-0.5 rounded">
                              {t('chat.conversationTree.swipesCount', { count: msg.swipes!.length })}
                            </span>
                          )}
                          {msg.bookmarked && (
                            <Bookmark className="w-3 h-3 text-accent-500 fill-accent-500" />
                          )}
                        </div>
                        <p className="text-sm text-gray-300 mt-0.5 leading-snug">
                          {truncate(msg.content, 40)}
                        </p>
                      </button>
                    </div>

                    {/* Branch indicators */}
                    {messageBranches &&
                      messageBranches.map((branch) => (
                        <div key={branch.id} className="flex ml-6 mb-1">
                          {/* Fork connector */}
                          <div className="flex items-center w-6 flex-shrink-0 justify-center">
                            <div className="w-0 h-full border-l-2 border-glass-border border-dashed" />
                          </div>

                          <button
                            onClick={() => onNavigateBranch(branch.id)}
                            className="flex items-center gap-2 text-left rounded-lg py-1.5 px-3 ml-1 hover:bg-glass-white transition-colors group"
                          >
                            <GitBranch className="w-3.5 h-3.5 text-parlor-400 flex-shrink-0" />
                            <span className="text-xs text-parlor-400 font-medium truncate">
                              {branch.title || t('chat.conversationTree.untitledBranch')}
                            </span>
                            <span className="text-xs text-gray-500">
                              {t('chat.conversationTree.msgsCount', { count: branch.messages.length })}
                            </span>
                            <ChevronRight className="w-3 h-3 text-gray-500 group-hover:text-parlor-400 transition-colors flex-shrink-0" />
                          </button>
                        </div>
                      ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
