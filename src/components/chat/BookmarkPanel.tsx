import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Bookmark, X } from 'lucide-react';
import type { Message, Persona, CharacterCard } from '../../types';

interface BookmarkPanelProps {
  messages: Message[];
  character: CharacterCard | null;
  persona: Persona | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToMessage: (messageId: string) => void;
}

export function BookmarkPanel({
  messages,
  character,
  persona,
  isOpen,
  onClose,
  onNavigateToMessage,
}: BookmarkPanelProps) {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-dark-200 border-l border-glass-border z-50 flex flex-col"
          >
            <div className="sticky top-0 bg-dark-200/95 backdrop-blur-sm border-b border-glass-border p-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-accent-500 fill-accent-500" />
                <h2 className="font-semibold text-white font-serif tracking-tight">
                  {t('chat.bookmarks')}
                  {messages.filter(m => m.bookmarked).length > 0 && (
                    <span className="ml-2 text-sm font-normal text-gray-400">
                      ({messages.filter(m => m.bookmarked).length})
                    </span>
                  )}
                </h2>
              </div>
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-glass-white transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.filter(m => m.bookmarked).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <Bookmark className="w-10 h-10 text-gray-600 mb-3" />
                  <p className="text-gray-500 text-sm">{t('chat.noBookmarks')}</p>
                  <p className="text-gray-600 text-xs mt-1">{t('chat.noBookmarksHint')}</p>
                </div>
              ) : (
                messages
                  .filter(m => m.bookmarked)
                  .map(m => {
                    const isUser = m.role === 'user';
                    const speaker = isUser ? (persona?.name || t('chat.role.user')) : character?.name ?? '';
                    return (
                      <button
                        key={m.id}
                        onClick={() => onNavigateToMessage(m.id)}
                        className="w-full text-left glass-sm p-3 rounded-xl hover:border-parlor-400/40 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-medium ${isUser ? 'text-parlor-400' : 'text-accent-500'}`}>
                            {speaker}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(m.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            {' '}
                            {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-300 line-clamp-3">{m.content}</p>
                      </button>
                    );
                  })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
