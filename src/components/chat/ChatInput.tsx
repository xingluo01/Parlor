import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Send,
  Square,
  Loader2,
  NotebookPen,
  UserPen,
  Plus,
  Code,
} from 'lucide-react';
import { Button } from '../ui';
import { CommandPalette } from './CommandPalette';
import type { ConnectionProfile, Preset, QuickReply } from '../../types';

type ChatInputProps = {
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onImpersonate: () => void;
  onShowPromptPreview: () => void;
  isGenerating: boolean;
  isSending: boolean;
  authorNote: string;
  showAuthorNotes: boolean;
  onToggleAuthorNotes: () => void;
  showCommandPalette: boolean;
  commandQuery: string;
  onCommandQueryChange: (query: string) => void;
  onCommandSelect: (cmd: string) => void;
  onCloseCommandPalette: () => void;
  connection: ConnectionProfile | null;
  preset: Preset | null;
  estimatedTokens: number;
  totalTokens: number;
  quickReplies: QuickReply[];
  onQuickReply: (content: string) => void;
  characterName?: string;
  personaName?: string;
};

export function ChatInput({
  inputValue,
  onInputChange,
  onSend,
  onStop,
  onImpersonate,
  onShowPromptPreview,
  isGenerating,
  isSending,
  authorNote,
  onToggleAuthorNotes,
  showCommandPalette,
  commandQuery,
  onCommandSelect,
  onCloseCommandPalette,
  connection,
  preset,
  estimatedTokens,
  totalTokens,
  quickReplies,
  onQuickReply,
  characterName,
  personaName,
}: ChatInputProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showMobileInputActions, setShowMobileInputActions] = useState(false);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (showCommandPalette && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape')) {
      // Let CommandPalette handle these keys when it's open
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <>
      {/* Quick Replies */}
      {quickReplies.length > 0 && !isGenerating && (
        <div className="flex-shrink-0 border-t border-glass-border bg-dark-100/50 px-2 py-1.5">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide max-w-4xl mx-auto">
            {quickReplies.map((qr) => {
              const resolved = qr.content
                .replace(/\{\{char\}\}/gi, characterName || '')
                .replace(/\{\{user\}\}/gi, personaName || '');
              return (
                <button
                  key={qr.id}
                  onClick={() => {
                    if (qr.action === 'send') {
                      onQuickReply(resolved);
                    } else {
                      onInputChange(inputValue + resolved);
                      textareaRef.current?.focus();
                    }
                  }}
                  className="flex-shrink-0 px-3 py-1.5 text-xs rounded-full bg-dark-50 border border-glass-border text-gray-400 hover:text-white hover:border-parlor-500/20 transition-colors"
                >
                  {qr.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="flex-shrink-0 border-t border-glass-border bg-dark-100/80 backdrop-blur-sm px-2 py-2 sm:p-3 safe-bottom">
        <div className="flex gap-1.5 sm:gap-3 items-end max-w-4xl mx-auto">
          <div className="flex-1 min-w-0 relative flex items-center min-h-[44px] sm:min-h-[48px]">
            {showCommandPalette && (
              <CommandPalette
                query={commandQuery}
                onSelect={onCommandSelect}
                onClose={onCloseCommandPalette}
              />
            )}
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={t('chat.typeMessage')}
              className="w-full resize-none rounded-xl bg-dark-100 border border-glass-border px-3 py-2.5 sm:px-4 sm:py-3 text-white placeholder-gray-500 focus:outline-none focus:border-parlor-500/50 focus:ring-1 focus:ring-parlor-500/30 text-base leading-6 auto-grow-input"
            />
          </div>
          {/* Author's Notes — desktop only */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleAuthorNotes}
            title={t('chat.authorsNotes')}
            className={`h-12 w-12 p-0 rounded-xl hidden sm:flex items-center justify-center flex-shrink-0 border ${
              authorNote.trim()
                ? 'bg-parlor-500/20 border-parlor-500/50 text-parlor-400'
                : 'bg-dark-100 border-glass-border text-gray-500 hover:text-gray-300'
            }`}
          >
            <NotebookPen className="w-5 h-5" />
          </Button>
          {/* Impersonate — desktop only */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onImpersonate}
            disabled={isGenerating || !connection || !preset}
            title={t('chat.impersonate')}
            className="h-12 w-12 p-0 rounded-xl hidden sm:flex items-center justify-center flex-shrink-0 border bg-dark-100 border-glass-border text-gray-500 hover:text-parlor-300"
          >
            <UserPen className="w-5 h-5" />
          </Button>
          {/* 查看 AI 提示词 — desktop only */}
          <button
            onClick={onShowPromptPreview}
            className="h-12 w-12 p-0 rounded-xl hidden sm:flex items-center justify-center flex-shrink-0 border bg-dark-100 border-glass-border text-gray-500 hover:text-gray-300 transition-colors"
            title="查看 AI 提示词"
          >
            <Code size={16} />
          </button>
          {/* Mobile-only + menu */}
          <div className="relative flex sm:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMobileInputActions(p => !p)}
              title={t('chat.moreActions')}
              className="h-10 w-10 p-0 rounded-xl flex items-center justify-center flex-shrink-0 border bg-dark-100 border-glass-border text-gray-500 hover:text-gray-300"
            >
              <Plus className="w-4.5 h-4.5" />
            </Button>
            {showMobileInputActions && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMobileInputActions(false)} />
                <div className="absolute bottom-full mb-2 right-0 z-50 bg-dark-50 border border-glass-border rounded-xl shadow-xl py-1 min-w-[180px]">
                  <button
                    onClick={() => { setShowMobileInputActions(false); onToggleAuthorNotes(); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-400 hover:bg-glass-white transition-colors"
                  >
                    <NotebookPen className="w-4 h-4 text-gray-400" />
                    <span>{t('chat.authorsNotes')}</span>
                    {authorNote.trim() && <span className="ml-auto w-2 h-2 rounded-full bg-parlor-500" />}
                  </button>
                  <button
                    onClick={() => {
                      setShowMobileInputActions(false);
                      onImpersonate();
                    }}
                    disabled={isGenerating || !connection || !preset}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-400 hover:bg-glass-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <UserPen className="w-4 h-4 text-gray-400" />
                    <span>{t('chat.impersonate')}</span>
                  </button>
                </div>
              </>
            )}
          </div>
          {isGenerating ? (
            <Button
              onClick={onStop}
              variant="danger"
              className="h-10 w-10 sm:h-12 sm:w-12 p-0 rounded-xl flex items-center justify-center flex-shrink-0"
            >
              <Square className="w-5 h-5" />
            </Button>
          ) : (
            <Button
              onClick={onSend}
              disabled={!inputValue.trim() || isSending}
              className="self-end h-10 w-10 sm:h-12 sm:w-12 p-0 rounded-xl flex items-center justify-center flex-shrink-0 bg-parlor-500 hover:bg-parlor-400 shadow-lg shadow-parlor-500/20"
            >
              {isSending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          )}
        </div>
        <div className="hidden sm:flex justify-end mt-1 max-w-4xl mx-auto pr-1">
          <span className="text-xs text-gray-600">
            {t('chat.tokensUsage', { used: estimatedTokens.toLocaleString(), total: totalTokens.toLocaleString() })}
          </span>
        </div>
      </div>
    </>
  );
}
