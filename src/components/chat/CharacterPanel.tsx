import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { User, Bot, BookOpen, UserCircle, Edit3, X } from 'lucide-react';
import { Button, Avatar } from '../ui';
import type { CharacterCard } from '../../types';

interface CharacterPanelProps {
  character: CharacterCard;
  onClose: () => void;
}

export function CharacterPanel({ character, onClose }: CharacterPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-dark-200 border-l border-glass-border z-50 overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 bg-dark-200/95 backdrop-blur-md border-b border-glass-border p-4 flex items-center justify-between">
        <h2 className="font-semibold text-white font-serif tracking-tight">{t('chat.characterPanel.title')}</h2>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-glass-white transition-colors">
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Content */}
      <div className="p-5 space-y-6">
        {/* Avatar & Name */}
        <div className="flex flex-col items-center text-center">
          <Avatar src={character.avatar} name={character.name} size="xl" className="w-24 h-24 ring-2 ring-parlor-500/20" />
          <h3 className="text-2xl font-bold text-white mt-4 font-serif tracking-tight">{character.name}</h3>
          {character.tags && character.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3 justify-center">
              {character.tags.slice(0, 5).map((tag) => (
                <span key={tag} className="tag text-2xs">{tag}</span>
              ))}
            </div>
          )}
        </div>

        <div className="divider" />

        {/* Description */}
        {character.description && (
          <div>
            <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-2 uppercase tracking-[0.1em]">
              <User className="w-3.5 h-3.5" />
              {t('chat.characterPanel.description')}
            </h4>
            <p className="text-sm text-gray-400 whitespace-pre-wrap leading-relaxed">{character.description}</p>
          </div>
        )}

        {/* Personality */}
        {character.personality && (
          <div>
            <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-2 uppercase tracking-[0.1em]">
              <Bot className="w-3.5 h-3.5" />
              {t('chat.characterPanel.personality')}
            </h4>
            <p className="text-sm text-gray-400 whitespace-pre-wrap leading-relaxed">{character.personality}</p>
          </div>
        )}

        {/* Scenario */}
        {character.scenario && (
          <div>
            <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-2 uppercase tracking-[0.1em]">
              <BookOpen className="w-3.5 h-3.5" />
              {t('chat.characterPanel.scenario')}
            </h4>
            <p className="text-sm text-gray-400 whitespace-pre-wrap leading-relaxed">{character.scenario}</p>
          </div>
        )}

        {/* Lorebook */}
        {character.characterBook && character.characterBook.entries.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-2 uppercase tracking-[0.1em]">
              <BookOpen className="w-3.5 h-3.5" />
              {t('chat.characterPanel.lorebook', { count: character.characterBook.entries.filter(e => e.enabled).length })}
            </h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {character.characterBook.entries.filter(e => e.enabled).slice(0, 5).map((entry) => (
                <div key={entry.id} className="text-xs bg-dark-300/40 rounded-lg p-2.5 border border-glass-border">
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {entry.keywords.slice(0, 3).map((kw) => (
                      <span key={kw} className="bg-parlor-500/15 text-parlor-400 px-1.5 py-0.5 rounded text-2xs">
                        {kw}
                      </span>
                    ))}
                  </div>
                  <p className="text-gray-600 line-clamp-2">{entry.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="pt-4 border-t border-glass-border space-y-2">
          <Button
            variant="secondary"
            className="w-full justify-center"
            onClick={() => { onClose(); navigate(`/characters/${character.id}`); }}
          >
            <UserCircle className="w-4 h-4" />
            {t('chat.characterPanel.viewFullProfile')}
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-center"
            onClick={() => { onClose(); navigate(`/characters/${character.id}/edit`); }}
          >
            <Edit3 className="w-4 h-4" />
            {t('chat.characterPanel.editCharacter')}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
