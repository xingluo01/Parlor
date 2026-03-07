
import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  MoreHorizontal,
  Sliders,
  UserCircle,
  Edit3,
  MessageSquarePlus,
  FolderOpen,
  Trash2,
  ChevronDown,
  User,
  Download,
  Bookmark,
  BookOpen,
  FileText,
  GitBranch,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Avatar } from '../components/ui';
import type { CharacterCard, ChatSession, Persona, WorldInfo } from '../types';

type ChatPageHeaderProps = {
  character: CharacterCard;
  activeChat: ChatSession;
  persona: Persona | null;
  personas: Persona[];
  showPersonaMenu: boolean;
  setShowPersonaMenu: (v: boolean) => void;
  showActionsMenu: boolean;
  setShowActionsMenu: (v: boolean) => void;
  setShowParamsPanel: (v: boolean) => void;
  setShowCharacterPanel: (v: boolean) => void;
  setShowDeleteDialog: (v: boolean) => void;
  handleChangePersona: (p: Persona | null) => void;
  onNewChat: () => void;
  showBookmarks: boolean;
  onToggleBookmarks: () => void;
  bookmarkCount: number;
  worldInfoBooks: WorldInfo[];
  enabledWorldInfoIds: string[] | undefined;
  onToggleWorldInfo: (bookId: string) => void;
  showWorldInfoMenu: boolean;
  setShowWorldInfoMenu: (v: boolean) => void;
  onSummarize?: () => void;
  isSummarizing?: boolean;
  onLinkPersonaToCharacter?: (personaId: string | null) => void;
  onShowConversationTree?: () => void;
};

function triggerDownload(content: string, filename: string, mime: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

function buildSafeFilename(base: string, ext: string) {
  return `${base.replace(/[^a-z0-9_\- ]/gi, '_').trim()}.${ext}`;
}

export function ChatPageHeader({
  character,
  activeChat,
  persona,
  personas,
  showPersonaMenu,
  setShowPersonaMenu,
  showActionsMenu,
  setShowActionsMenu,
  setShowParamsPanel,
  setShowCharacterPanel,
  setShowDeleteDialog,
  handleChangePersona,
  onNewChat,
  showBookmarks,
  onToggleBookmarks,
  bookmarkCount,
  worldInfoBooks,
  enabledWorldInfoIds,
  onToggleWorldInfo,
  showWorldInfoMenu,
  setShowWorldInfoMenu,
  onSummarize,
  isSummarizing,
  onLinkPersonaToCharacter,
  onShowConversationTree,
}: ChatPageHeaderProps) {
  const navigate = useNavigate();
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  // Close actions menu on outside click/touch (reliable on mobile)
  useEffect(() => {
    if (!showActionsMenu) return;
    const handler = (e: PointerEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setShowActionsMenu(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [showActionsMenu, setShowActionsMenu]);

  const userName = persona?.name || 'User';
  const chatTitle = activeChat.title || `${character.name} Chat`;
  const exportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const handleExportMarkdown = () => {
    const header = [
      `# ${chatTitle}`,
      `*${character.name}${persona ? ` • As ${userName}` : ''}*`,
      `*Exported ${exportDate}*`,
      '',
      '---',
      '',
    ].join('\n');

    const body = activeChat.messages
      .filter(m => m.role !== 'system')
      .map(m => {
        const speaker = m.role === 'user' ? `**${userName}**` : `**${character.name}**`;
        return `${speaker}\n\n${m.content}`;
      })
      .join('\n\n---\n\n');

    triggerDownload(header + body, buildSafeFilename(chatTitle, 'md'), 'text/markdown');
  };

  const handleExportText = () => {
    const header = [
      `${chatTitle}`,
      `${character.name}${persona ? ` | As ${userName}` : ''}`,
      `Exported ${exportDate}`,
      '',
      '='.repeat(40),
      '',
    ].join('\n');

    const body = activeChat.messages
      .filter(m => m.role !== 'system')
      .map(m => {
        const speaker = m.role === 'user' ? userName : character.name;
        return `[${speaker}]: ${m.content}`;
      })
      .join('\n\n');

    triggerDownload(header + body, buildSafeFilename(chatTitle, 'txt'), 'text/plain');
  };

  const dropdownItemClass = 'w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors text-gray-400 hover:text-white hover:bg-glass-white';
  const dropdownClass = 'absolute right-0 top-full mt-1 z-50 bg-dark-100 border border-glass-border rounded-xl py-1 min-w-[200px] shadow-dramatic';

  const getPersonaButtonClass = (isActive: boolean) => {
    if (isActive) {
      return 'w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors text-parlor-400 bg-parlor-500/10';
    }
    return dropdownItemClass;
  };

  const charDefault = character.defaultPersonaId
    ? personas.find(p => p.id === character.defaultPersonaId)
    : null;

  return (
    <div className="flex-shrink-0 border-b border-glass-border bg-dark-200/90 backdrop-blur-md relative z-10">
      <div className="flex items-center justify-between px-2 h-14 sm:h-14">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => navigate('/chats')} className="p-1.5">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <button
            onClick={() => setShowCharacterPanel(true)}
            className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity min-w-0"
          >
            <Avatar src={character.avatar} name={character.name} size="sm" className="sm:hidden flex-shrink-0" />
            <Avatar src={character.avatar} name={character.name} size="md" className="hidden sm:block flex-shrink-0" />
            <div className="text-left min-w-0">
              <h1 className="font-semibold text-white text-sm sm:text-base truncate font-serif tracking-tight">{character.name}</h1>
              <p className="text-2xs text-gray-600 truncate max-w-[120px] sm:max-w-none">
                {activeChat.title || `${activeChat.messages.length} messages`}
              </p>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
          {/* Persona Selector */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPersonaMenu(!showPersonaMenu)}
              title={persona?.name || 'No Persona'}
              className="hidden sm:flex items-center gap-1 p-1.5"
            >
              <Users className="w-4 h-4" />
              <ChevronDown className="w-3 h-3" />
            </Button>

            <AnimatePresence>
              {showPersonaMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowPersonaMenu(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                    className={dropdownClass}
                  >
                    <div className="px-3 py-2 text-2xs text-gray-600 uppercase tracking-[0.1em] border-b border-glass-border">
                      Select Persona
                    </div>

                    {charDefault && (
                      <button
                        onClick={() => handleChangePersona(charDefault)}
                        className={getPersonaButtonClass(persona?.id === charDefault.id)}
                      >
                        <Avatar src={charDefault.avatar} name={charDefault.name} size="xs" />
                        <span className="truncate flex-1">{charDefault.name}</span>
                        <span className="text-2xs text-parlor-400">Linked</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleChangePersona(null)}
                      className={getPersonaButtonClass(!persona)}
                    >
                      <div className="w-6 h-6 rounded-full bg-dark-50 flex items-center justify-center">
                        <User className="w-3 h-3" />
                      </div>
                      No Persona
                    </button>

                    {personas.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleChangePersona(p)}
                        className={getPersonaButtonClass(persona?.id === p.id)}
                      >
                        <Avatar src={p.avatar} name={p.name} size="xs" />
                        <span className="truncate">{p.name}</span>
                        {p.isDefault && (
                          <span className="text-2xs text-gray-600 ml-auto">Default</span>
                        )}
                      </button>
                    ))}

                    {personas.length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-600">
                        No personas created yet
                      </div>
                    )}

                    {onLinkPersonaToCharacter && persona && (
                      <div className="border-t border-glass-border mt-1 pt-1">
                        {character.defaultPersonaId === persona.id ? (
                          <button
                            onClick={() => { onLinkPersonaToCharacter(null); setShowPersonaMenu(false); }}
                            className={dropdownItemClass}
                          >
                            Unlink "{persona.name}" from {character.name}
                          </button>
                        ) : (
                          <button
                            onClick={() => { onLinkPersonaToCharacter(persona.id); setShowPersonaMenu(false); }}
                            className="w-full px-3 py-2 text-left text-sm text-parlor-400 hover:text-parlor-300 hover:bg-glass-white transition-colors"
                          >
                            Link "{persona.name}" to {character.name}
                          </button>
                        )}
                      </div>
                    )}
                    <div className="border-t border-glass-border mt-1 pt-1">
                      <button
                        onClick={() => {
                          setShowPersonaMenu(false);
                          navigate('/personas');
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-parlor-400 hover:text-parlor-300 hover:bg-glass-white transition-colors"
                      >
                        Manage Personas...
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Bookmarks Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleBookmarks}
            title="Bookmarks"
            className={`hidden sm:flex p-1.5 ${showBookmarks || bookmarkCount > 0 ? 'text-accent-500' : ''}`}
          >
            <Bookmark className={`w-4 h-4 ${bookmarkCount > 0 ? 'fill-accent-500' : ''}`} />
          </Button>

          {/* World Info Toggle */}
          {worldInfoBooks.length > 0 && (
            <div className="relative hidden sm:block">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowWorldInfoMenu(!showWorldInfoMenu)}
                title="World Info"
                className={`p-1.5 ${worldInfoBooks.some(b => {
                  if (!b.enabled) return false;
                  if (enabledWorldInfoIds === undefined) return true;
                  return enabledWorldInfoIds.includes(b.id);
                }) ? 'text-emerald-400' : ''}`}
              >
                <BookOpen className="w-4 h-4" />
              </Button>

              <AnimatePresence>
                {showWorldInfoMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowWorldInfoMenu(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-1 z-50 bg-dark-100 border border-glass-border rounded-xl py-1 min-w-[220px] shadow-dramatic"
                    >
                      <div className="px-3 py-2 text-2xs text-gray-600 uppercase tracking-[0.1em] border-b border-glass-border">
                        World Info — this chat
                      </div>
                      {worldInfoBooks.filter(b => b.enabled).map((book) => {
                        const isActive = enabledWorldInfoIds === undefined || enabledWorldInfoIds.includes(book.id);
                        return (
                          <button
                            key={book.id}
                            onClick={() => onToggleWorldInfo(book.id)}
                            className={dropdownItemClass}
                          >
                            <input
                              type="checkbox"
                              checked={isActive}
                              readOnly
                              className="rounded border-glass-border bg-dark-100 text-parlor-500 pointer-events-none"
                            />
                            <span className="truncate flex-1">{book.name}</span>
                            <span className="text-2xs text-gray-600 flex-shrink-0">
                              {book.entries.filter(e => e.enabled).length} entries
                            </span>
                          </button>
                        );
                      })}
                      {worldInfoBooks.filter(b => b.enabled).length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-600">
                          No enabled books
                        </div>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Actions Menu */}
          <div className="relative" ref={actionsMenuRef}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowActionsMenu(!showActionsMenu)}
              className="p-1.5"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>

            <AnimatePresence>
              {showActionsMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-1 z-50 bg-dark-100 border border-glass-border rounded-xl py-1 min-w-[180px] shadow-dramatic"
                  >
                    {/* Mobile-only items */}
                    <button
                      onClick={() => { setShowActionsMenu(false); setShowPersonaMenu(true); }}
                      className={`${dropdownItemClass} sm:hidden`}
                    >
                      <Users className="w-4 h-4" />
                      {persona ? `Persona: ${persona.name}` : 'Select Persona'}
                    </button>
                    <button
                      onClick={() => { setShowActionsMenu(false); onToggleBookmarks(); }}
                      className={`${dropdownItemClass} sm:hidden`}
                    >
                      <Bookmark className={`w-4 h-4 ${bookmarkCount > 0 ? 'fill-accent-500 text-accent-500' : ''}`} />
                      Bookmarks{bookmarkCount > 0 ? ` (${bookmarkCount})` : ''}
                    </button>
                    <button
                      onClick={() => { setShowActionsMenu(false); setShowParamsPanel(true); }}
                      className={`${dropdownItemClass} sm:hidden`}
                    >
                      <Sliders className="w-4 h-4" />
                      Chat Parameters
                    </button>
                    <div className="border-t border-glass-border my-1 sm:hidden" />

                    <button
                      onClick={() => {
                        setShowActionsMenu(false);
                        navigate(`/characters/${character.id}`);
                      }}
                      className={dropdownItemClass}
                    >
                      <UserCircle className="w-4 h-4" />
                      View Character
                    </button>
                    <button
                      onClick={() => {
                        setShowActionsMenu(false);
                        navigate(`/characters/${character.id}/edit`);
                      }}
                      className={dropdownItemClass}
                    >
                      <Edit3 className="w-4 h-4" />
                      Edit Character
                    </button>
                    <button
                      onClick={() => {
                        setShowActionsMenu(false);
                        onNewChat();
                      }}
                      className={dropdownItemClass}
                    >
                      <MessageSquarePlus className="w-4 h-4" />
                      New Chat
                    </button>
                    {activeChat.branchedFromChatId && (
                      <button
                        onClick={() => {
                          setShowActionsMenu(false);
                          navigate(`/chat/${activeChat.branchedFromChatId}`);
                        }}
                        className={dropdownItemClass}
                      >
                        <GitBranch className="w-4 h-4" />
                        View Parent Chat
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowActionsMenu(false);
                        navigate('/chats');
                      }}
                      className={dropdownItemClass}
                    >
                      <FolderOpen className="w-4 h-4" />
                      All Chats
                    </button>
                    {onShowConversationTree && (
                      <button
                        onClick={() => { setShowActionsMenu(false); onShowConversationTree(); }}
                        className={dropdownItemClass}
                      >
                        <GitBranch className="w-4 h-4" />
                        Conversation Tree
                      </button>
                    )}
                    {onSummarize && (
                      <button
                        onClick={() => {
                          setShowActionsMenu(false);
                          onSummarize();
                        }}
                        disabled={isSummarizing}
                        className={`${dropdownItemClass} disabled:opacity-40`}
                      >
                        <FileText className="w-4 h-4" />
                        {isSummarizing ? 'Summarizing...' : 'Summarize Context'}
                      </button>
                    )}
                    <div className="border-t border-glass-border my-1" />
                    <button
                      onClick={() => { setShowActionsMenu(false); handleExportMarkdown(); }}
                      className={dropdownItemClass}
                    >
                      <Download className="w-4 h-4" />
                      Export as Markdown
                    </button>
                    <button
                      onClick={() => { setShowActionsMenu(false); handleExportText(); }}
                      className={dropdownItemClass}
                    >
                      <Download className="w-4 h-4" />
                      Export as Text
                    </button>
                    <div className="border-t border-glass-border my-1" />
                    <button
                      onClick={() => {
                        setShowActionsMenu(false);
                        setShowDeleteDialog(true);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 flex items-center gap-2 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Chat
                    </button>
                  </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Parameter Overrides Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowParamsPanel(true)}
            title="Chat Parameters"
            className={`hidden sm:flex p-1.5 ${activeChat.parameterOverrides ? 'text-parlor-400' : ''}`}
          >
            <Sliders className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
