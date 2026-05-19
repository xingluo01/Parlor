import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

interface AuthorNotesPanelProps {
  isOpen: boolean;
  authorNote: string;
  authorNoteDepth: number;
  onSave: (note: string, depth: number) => void;
}

export function AuthorNotesPanel({ isOpen, authorNote, authorNoteDepth, onSave }: AuthorNotesPanelProps) {
  const { t } = useTranslation();
  const [localNote, setLocalNote] = useState(authorNote);

  // Sync external authorNote changes (e.g. preset auto-fill) into local state
  useEffect(() => {
    setLocalNote(authorNote);
  }, [authorNote]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden border-t border-glass-border bg-dark-100/80 backdrop-blur-sm"
        >
          <div className="max-w-4xl mx-auto px-3 py-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400">{t('chat.authorsNotes')}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{t('chat.injectAtDepth')}</span>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={authorNoteDepth}
                  onChange={(e) => {
                    const d = Math.max(0, Math.min(20, parseInt(e.target.value) || 0));
                    onSave(localNote, d);
                  }}
                  className="w-12 text-center text-xs bg-dark-100 border border-glass-border rounded px-1 py-0.5 text-white focus:outline-none focus:border-parlor-500"
                />
                <span className="text-xs text-gray-500">{t('chat.msgsFromEnd')}</span>
              </div>
            </div>
            <textarea
              value={localNote}
              onChange={(e) => setLocalNote(e.target.value)}
              onBlur={() => onSave(localNote, authorNoteDepth)}
              placeholder={t('chat.notesPlaceholder')}
              rows={3}
              className="w-full resize-none rounded-lg bg-dark-100 border border-glass-border px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-parlor-500/50"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
