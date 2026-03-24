import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { generateUUID } from '../utils/uuid';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Send,
  Loader2,
  Square,
  Play,
  Brain,
  ChevronUp,
  ChevronDown,
  NotebookPen,
  Bookmark,
  X,
  UserPen,
  Plus,
  FileText,
} from 'lucide-react';
import { Button, Avatar, ConfirmDialog } from '../components/ui';
import { MessageBubble, RpContent } from '../components/chat/MessageBubble';
import { ParameterPanel } from '../components/chat/ParameterPanel';
import { CharacterPanel } from '../components/chat/CharacterPanel';
import { GreetingPickerModal } from '../components/chat/GreetingPickerModal';
import { ConversationTree } from '../components/chat/ConversationTree';
import { CommandPalette } from '../components/chat/CommandPalette';
import { parseSlashCommand } from '../services/slashCommands';
import type { SlashCommandContext } from '../services/slashCommands';
import { characterOps, chatOps, connectionOps, presetOps, personaOps, settingsOps, worldInfoOps } from '../db';
import { useChatStore, usePersonaStore } from '../stores';
import { buildSystemPrompt } from '../services/api';
import { useChatGeneration } from '../hooks/useChatGeneration';
import { useHotkeys } from '../hooks/useHotkeys';
import type { CharacterCard, ChatSession, Message, ConnectionProfile, Preset, Persona, AppSettings, ParameterOverrides, WorldInfo, QuickReply } from '../types';
import { ChatPageHeader } from './ChatPageHeader';

export function ChatPage() {
  const navigate = useNavigate();
  const { id: chatId } = useParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { activeChat, setActiveChat, updateChat, removeChat, streamingReasoning } = useChatStore();
  const { personas, setPersonas } = usePersonaStore();

  const [character, setCharacter] = useState<CharacterCard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Swipe state for alternate responses
  const [currentSwipeIndex, setCurrentSwipeIndex] = useState<Record<string, number>>({});

  // Streaming reasoning expand state
  const [expandedStreamingReasoning, setExpandedStreamingReasoning] = useState(false);

  // Connection state
  const [connection, setConnection] = useState<ConnectionProfile | null>(null);
  const [preset, setPreset] = useState<Preset | null>(null);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [contextSize, setContextSize] = useState(20);
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
  const [showWorldInfoMenu, setShowWorldInfoMenu] = useState(false);

  // Settings & panels state
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCharacterPanel, setShowCharacterPanel] = useState(false);
  const [showParamsPanel, setShowParamsPanel] = useState(false);

  // Parameter overrides state
  const [overrides, setOverrides] = useState<ParameterOverrides>({});

  // Author's Notes state
  const [showAuthorNotes, setShowAuthorNotes] = useState(false);
  const [authorNote, setAuthorNote] = useState('');
  const [authorNoteDepth, setAuthorNoteDepth] = useState(2);

  // Greeting picker state
  const [showGreetingPicker, setShowGreetingPicker] = useState(false);

  // Summarization state
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // Bookmarks panel
  const [showBookmarks, setShowBookmarks] = useState(false);

  // Mobile input actions menu
  const [showMobileInputActions, setShowMobileInputActions] = useState(false);

  // Conversation tree
  const [showConversationTree, setShowConversationTree] = useState(false);
  const [branchChats, setBranchChats] = useState<ChatSession[]>([]);

  // World Info books
  const [worldInfoBooks, setWorldInfoBooks] = useState<WorldInfo[]>([]);

  // Slash command palette
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');

  // Visual Novel mode

  // Close all dropdown menus
  const closeAllMenus = useCallback(() => {
    setShowPersonaMenu(false);
    setShowActionsMenu(false);
    setShowWorldInfoMenu(false);
    setShowMobileInputActions(false);
  }, []);

  // Escape key closes all menus
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAllMenus();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [closeAllMenus]);

  // Use the chat generation hook
  const {
    generateResponse,
    regenerateResponse,
    continueGeneration,
    stopGeneration,
    impersonateResponse,
    summarizeChat,
    isStreaming,
    isImpersonating,
    regeneratingMessageId,
    streamingContent,
  } = useChatGeneration({
    activeChat,
    character,
    connection,
    preset,
    persona,
    settings,
    contextSize,
  });

  const isGenerating = isStreaming;

  // Global hotkeys
  useHotkeys(useMemo(() => ({
    send: () => { if (!isGenerating) handleSendRef.current?.(); },
    continue: () => { if (!isGenerating) continueGeneration(); },
    regenerate: () => {
      if (!isGenerating && activeChat?.messages?.length) {
        const lastAssistant = [...activeChat.messages].reverse().find(m => m.role === 'assistant');
        if (lastAssistant) regenerateResponse(lastAssistant.id);
      }
    },
    stopGeneration: () => { if (isGenerating) stopGeneration(); },
    focusInput: () => inputRef.current?.focus(),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isGenerating, activeChat?.messages, continueGeneration, regenerateResponse, stopGeneration]));

  // Ref to avoid stale closure for hotkey send
  const handleSendRef = useRef<(() => void) | null>(null);

  // Get avatar size from settings
  const getAvatarSize = (): 'xs' | 'sm' | 'md' | 'lg' | 'xl' => {
    switch (settings?.avatarSize) {
      case 'small': return 'sm';
      case 'large': return 'lg';
      default: return 'md';
    }
  };

  // Load chat and character
  useEffect(() => {
    if (chatId) {
      loadChat();
    }
  }, [chatId]);

  const loadChat = async () => {
    setIsLoading(true);
    try {
      const chat = await chatOps.getById(chatId!);
      if (chat) {
        setActiveChat(chat);
        setAuthorNote(chat.authorNote ?? '');
        setAuthorNoteDepth(chat.authorNoteDepth ?? 2);

        // Restore saved swipe indices
        const restored: Record<string, number> = {};
        for (const msg of chat.messages) {
          if (msg.swipes && msg.swipes.length > 0 && msg.activeSwipeIndex != null) {
            restored[msg.id] = Math.min(msg.activeSwipeIndex, msg.swipes.length - 1);
          }
        }
        setCurrentSwipeIndex(restored);

        const char = await characterOps.getById(chat.characterId);
        setCharacter(char || null);

        const [activeConn, activePresetData, settingsData, personaList, wiBooks] = await Promise.all([
          connectionOps.getActive(),
          presetOps.getDefault(),
          settingsOps.get(),
          personaOps.getAll(),
          worldInfoOps.getAll(),
        ]);

        setConnection(activeConn || null);
        setPreset(activePresetData || null);
        setContextSize(settingsData?.contextSize || 20);
        setSettings(settingsData || null);
        setWorldInfoBooks(wiBooks);
        setPersonas(personaList);

        // Load branch chats for conversation tree
        const allChats = await chatOps.getAll();
        setBranchChats(allChats.filter(c => c.branchedFromChatId === chat.id));

        // Load parameter overrides from chat
        if (chat.parameterOverrides) {
          setOverrides(chat.parameterOverrides);
        }

        // Load persona - priority: chat's persona > character's default > global default
        if (chat.personaId) {
          const chatPersona = personaList.find(p => p.id === chat.personaId);
          setPersona(chatPersona || null);
        } else if (char?.defaultPersonaId) {
          const charDefaultPersona = personaList.find(p => p.id === char.defaultPersonaId);
          setPersona(charDefaultPersona || null);
        } else if (personaList.length > 0) {
          const defaultPersona = personaList.find(p => p.isDefault) || personaList[0];
          setPersona(defaultPersona);
        }
      } else {
        navigate('/chats');
      }
    } catch (err) {
      console.error('Failed to load chat:', err);
      navigate('/chats');
    } finally {
      setIsLoading(false);
    }
  };

  // Stream impersonation text directly into the input field
  useEffect(() => {
    if (isImpersonating && streamingContent) {
      setInputValue(streamingContent);
    }
  }, [isImpersonating, streamingContent]);

  // Instant scroll to bottom on initial chat load
  const hasScrolledToBottom = useRef<string | null>(null);
  useEffect(() => {
    if (!isLoading && activeChat && hasScrolledToBottom.current !== activeChat.id) {
      hasScrolledToBottom.current = activeChat.id;
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
      });
    }
  }, [isLoading, activeChat?.id]);

  // Auto-scroll to bottom on new messages or when streaming starts/stops (not per-chunk)
  useEffect(() => {
    if (hasScrolledToBottom.current === activeChat?.id) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeChat?.messages, isStreaming]);

  // Navigate swipes — persist activeSwipeIndex to the message
  const navigateSwipe = useCallback((messageId: string, direction: 'left' | 'right') => {
    const message = activeChat?.messages.find(m => m.id === messageId);
    if (!message?.swipes || !activeChat) return;

    const currentIndex = currentSwipeIndex[messageId] || 0;
    const maxIndex = message.swipes.length - 1;
    const newIndex = direction === 'left'
      ? Math.max(0, currentIndex - 1)
      : Math.min(maxIndex, currentIndex + 1);

    setCurrentSwipeIndex(prev => ({ ...prev, [messageId]: newIndex }));

    // Persist to message so it survives page reload
    const updatedMessages = activeChat.messages.map(m =>
      m.id === messageId ? { ...m, activeSwipeIndex: newIndex } : m
    );
    updateChat(activeChat.id, { messages: updatedMessages });
    chatOps.update(activeChat.id, { messages: updatedMessages });
  }, [activeChat, currentSwipeIndex, updateChat]);

  // Auto-advance swipe index when a new swipe is added (after regeneration)
  const prevSwipeCounts = useRef<Record<string, number>>({});
  const initializedChatId = useRef<string | null>(null);
  useEffect(() => {
    if (!activeChat) return;

    // On chat change (or first load), snapshot current swipe counts without advancing
    if (initializedChatId.current !== activeChat.id) {
      prevSwipeCounts.current = {};
      for (const msg of activeChat.messages) {
        if (msg.swipes && msg.swipes.length > 0) {
          prevSwipeCounts.current[msg.id] = msg.swipes.length;
        }
      }
      initializedChatId.current = activeChat.id;
      return;
    }

    const advancedIds: string[] = [];
    for (const msg of activeChat.messages) {
      if (msg.swipes && msg.swipes.length > 0) {
        const prevCount = prevSwipeCounts.current[msg.id] || 0;
        const newCount = msg.swipes.length;
        if (newCount > prevCount) {
          // New swipe was added — jump to it
          setCurrentSwipeIndex(prev => ({ ...prev, [msg.id]: newCount - 1 }));
          advancedIds.push(msg.id);
        }
        prevSwipeCounts.current[msg.id] = newCount;
      }
    }

    // Persist activeSwipeIndex for any auto-advanced messages
    if (advancedIds.length > 0) {
      const updatedMessages = activeChat.messages.map(m =>
        advancedIds.includes(m.id) && m.swipes
          ? { ...m, activeSwipeIndex: m.swipes.length - 1 }
          : m
      );
      updateChat(activeChat.id, { messages: updatedMessages });
      chatOps.update(activeChat.id, { messages: updatedMessages });
    }
  }, [activeChat?.messages]);

  // Send message (optional override for Quick Replies)
  const handleSend = async (overrideContent?: string) => {
    const content = overrideContent ?? inputValue;
    if (!content.trim() || !activeChat || !character || isSending) return;

    // Check for slash commands
    const parsed = parseSlashCommand(content.trim());
    if (parsed) {
      const lastAssistant = activeChat.messages.filter(m => m.role === 'assistant').at(-1);
      const ctx: SlashCommandContext = {
        onContinue: continueGeneration,
        onRegenerate: (id) => regenerateResponse(id),
        onImpersonate: () => impersonateResponse(undefined, (text) => { setInputValue(text); }),
        onSummarize: handleSummarize,
        onSetAuthorNote: (note) => { setAuthorNote(note); handleSaveAuthorNote(note, authorNoteDepth); },
        onSendSystemMessage: async (content) => {
          const sysMsg: Message = { id: generateUUID(), role: 'system', content, timestamp: Date.now() };
          const msgs = [...activeChat.messages, sysMsg];
          await chatOps.update(activeChat.id, { messages: msgs });
          updateChat(activeChat.id, { messages: msgs });
        },
        lastAssistantMessageId: lastAssistant?.id || null,
      };
      parsed.command.execute(parsed.args, ctx);
      setInputValue('');
      setShowCommandPalette(false);
      return;
    }

    if (!connection || !preset) {
      navigate('/settings');
      return;
    }

    setIsSending(true);
    const userContent = content.trim();
    setInputValue('');

    const userMessage: Message = {
      id: generateUUID(),
      role: 'user',
      content: userContent,
      timestamp: Date.now(),
    };

    const updatedMessages = [...activeChat.messages, userMessage];
    await chatOps.update(activeChat.id, { messages: updatedMessages });
    updateChat(activeChat.id, { messages: updatedMessages });

    await generateResponse(updatedMessages);
    setIsSending(false);
  };

  // Keep ref in sync for hotkeys
  handleSendRef.current = () => handleSend();

  // Handle input change — show command palette on '/'
  const handleInputChange = (value: string) => {
    setInputValue(value);
    if (value.startsWith('/') && !value.includes(' ')) {
      setShowCommandPalette(true);
      setCommandQuery(value.slice(1));
    } else {
      setShowCommandPalette(false);
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (showCommandPalette && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape')) {
      // Let CommandPalette handle these keys when it's open
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Edit message
  const handleEditMessage = useCallback(async (messageId: string, content: string) => {
    if (!activeChat) return;
    const updatedMessages = activeChat.messages.map(msg =>
      msg.id === messageId ? { ...msg, content, isEdited: true } : msg
    );
    await chatOps.updateMessage(activeChat.id, messageId, content);
    updateChat(activeChat.id, { messages: updatedMessages });
  }, [activeChat, updateChat]);

  // Edit message with swipe awareness
  const handleEditSwipe = useCallback(async (messageId: string, content: string, swipeIdx: number) => {
    if (!activeChat) return;
    const updatedMessages = activeChat.messages.map(msg => {
      if (msg.id !== messageId) return msg;
      const newSwipes = msg.swipes ? [...msg.swipes] : [msg.content];
      newSwipes[swipeIdx] = content;
      return { ...msg, content, swipes: newSwipes, isEdited: true };
    });
    await chatOps.update(activeChat.id, { messages: updatedMessages });
    updateChat(activeChat.id, { messages: updatedMessages });
  }, [activeChat, updateChat]);

  // Delete message
  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (!activeChat) return;
    await chatOps.deleteMessage(activeChat.id, messageId);
    const updatedMessages = activeChat.messages.filter(msg => msg.id !== messageId);
    updateChat(activeChat.id, { messages: updatedMessages });
  }, [activeChat, updateChat]);

  // Retry from a user message — remove everything after it and re-generate
  const handleRetry = useCallback(async (messageId: string) => {
    if (!activeChat) return;
    const msgIndex = activeChat.messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;

    // Keep messages up to and including the user message
    const messagesUpTo = activeChat.messages.slice(0, msgIndex + 1);
    await chatOps.update(activeChat.id, { messages: messagesUpTo });
    updateChat(activeChat.id, { messages: messagesUpTo });

    // Trigger a new generation
    await generateResponse(messagesUpTo);
  }, [activeChat, updateChat, generateResponse]);

  // Copy message
  const handleCopy = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
  }, []);

  // Toggle bookmark on a message
  const handleBookmarkMessage = useCallback(async (messageId: string) => {
    if (!activeChat) return;
    const updatedMessages = activeChat.messages.map(msg =>
      msg.id === messageId ? { ...msg, bookmarked: !msg.bookmarked } : msg
    );
    await chatOps.update(activeChat.id, { messages: updatedMessages });
    updateChat(activeChat.id, { messages: updatedMessages });
  }, [activeChat, updateChat]);

  // Branch from message — creates a new chat with messages up to (and including) this one
  const handleBranchFromMessage = useCallback(async (messageId: string) => {
    if (!activeChat || !character) return;
    const msgIndex = activeChat.messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;

    const branchedMessages = activeChat.messages.slice(0, msgIndex + 1).map(m => ({
      ...m,
      id: generateUUID(),
    }));

    const newChat: ChatSession = {
      id: generateUUID(),
      characterId: character.id,
      personaId: activeChat.personaId,
      title: activeChat.title ? `${activeChat.title} (branch)` : undefined,
      messages: branchedMessages,
      branchedFromChatId: activeChat.id,
      branchPointMessageId: messageId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await chatOps.add(newChat);
    setActiveChat(newChat);
    navigate(`/chat/${newChat.id}`);
  }, [activeChat, character, navigate, setActiveChat]);

  // Delete chat
  const handleDeleteChat = async () => {
    if (!activeChat) return;
    await chatOps.delete(activeChat.id);
    removeChat(activeChat.id);
    navigate('/chats');
  };

  // Change persona for this chat
  const handleChangePersona = async (newPersona: Persona | null) => {
    if (!activeChat) return;
    setPersona(newPersona);
    await chatOps.update(activeChat.id, { personaId: newPersona?.id || null });
    updateChat(activeChat.id, { personaId: newPersona?.id || null });
    setShowPersonaMenu(false);
  };

  // Create a new chat with the same character and a specific greeting
  const createNewChatWithGreeting = async (greeting: string) => {
    if (!character) return;
    let personaId: string | null = null;
    if (character.defaultPersonaId) {
      personaId = character.defaultPersonaId;
    } else {
      const defaultPersona = personas.find(p => p.isDefault);
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
    if (greeting) {
      const allGreetings = [character.firstMessage, ...(character.alternateGreetings ?? [])].filter(Boolean);
      newChat.messages.push({
        id: generateUUID(),
        role: 'assistant',
        content: greeting,
        timestamp: Date.now(),
        ...(allGreetings.length > 1 ? { swipes: allGreetings } : {}),
      });
    }
    await chatOps.add(newChat);
    setActiveChat(newChat);
    navigate(`/chat/${newChat.id}`);
  };

  // Create a new chat with the same character
  const handleNewChat = async () => {
    if (!character) return;
    if (character.alternateGreetings && character.alternateGreetings.length > 0) {
      setShowGreetingPicker(true);
      return;
    }
    await createNewChatWithGreeting(character.firstMessage);
  };

  // Toggle World Info book for this chat
  const handleToggleWorldInfo = async (bookId: string) => {
    if (!activeChat) return;
    const current = activeChat.enabledWorldInfoIds;
    let next: string[];
    if (current === undefined) {
      // All were enabled; disable just this one
      next = worldInfoBooks.map(b => b.id).filter(id => id !== bookId);
    } else if (current.includes(bookId)) {
      next = current.filter(id => id !== bookId);
    } else {
      next = [...current, bookId];
    }
    await chatOps.update(activeChat.id, { enabledWorldInfoIds: next });
    setActiveChat({ ...activeChat, enabledWorldInfoIds: next });
  };

  // Link / unlink a persona to this character
  const handleLinkPersonaToCharacter = async (personaId: string | null) => {
    if (!character) return;
    await characterOps.update(character.id, { defaultPersonaId: personaId ?? undefined });
    setCharacter({ ...character, defaultPersonaId: personaId ?? undefined });
  };

  // Save Author's Notes
  const handleSaveAuthorNote = async (note: string, depth: number) => {
    if (!activeChat) return;
    await chatOps.update(activeChat.id, { authorNote: note, authorNoteDepth: depth });
    updateChat(activeChat.id, { authorNote: note, authorNoteDepth: depth });
  };

  // Summarize context
  const handleSummarize = async () => {
    if (!activeChat || isSummarizing) return;
    setIsSummarizing(true);
    try {
      await summarizeChat(activeChat.id, activeChat.messages);
    } finally {
      setIsSummarizing(false);
    }
  };

  // Save parameter overrides
  const handleSaveOverrides = async (newOverrides: ParameterOverrides) => {
    if (!activeChat) return;
    const hasOverrides = Object.values(newOverrides).some(v => v !== undefined);
    const resolved = hasOverrides ? newOverrides : undefined;
    await chatOps.update(activeChat.id, {
      parameterOverrides: resolved,
    });
    updateChat(activeChat.id, {
      parameterOverrides: resolved,
    });
    setOverrides(resolved ?? {});
    setShowParamsPanel(false);
  };

  // Estimated token count
  const estimatedTokens = useMemo(() => {
    if (!activeChat || !character) return 0;
    const sysPrompt = preset ? buildSystemPrompt(character, persona, character.systemPrompt, preset) : '';
    const effectiveCtxSize = activeChat.parameterOverrides?.contextSize ?? contextSize;
    const msgText = activeChat.messages.slice(-effectiveCtxSize).map(m => m.content).join(' ');
    return Math.ceil((sysPrompt.length + msgText.length + inputValue.length) / 4);
  }, [activeChat?.messages, activeChat?.parameterOverrides?.contextSize, character, persona, preset, contextSize, inputValue]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-parlor-500" />
      </div>
    );
  }

  if (!activeChat || !character) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <p className="text-gray-500">Chat not found</p>
        <Button className="mt-4" onClick={() => navigate('/chats')}>
          Back to Chats
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <ChatPageHeader
        character={character}
        activeChat={activeChat}
        persona={persona}
        personas={personas}
        showPersonaMenu={showPersonaMenu}
        setShowPersonaMenu={(v) => { if (v) closeAllMenus(); setShowPersonaMenu(v); }}
        showActionsMenu={showActionsMenu}
        setShowActionsMenu={(v) => { if (v) closeAllMenus(); setShowActionsMenu(v); }}
        setShowParamsPanel={(v) => { if (v) closeAllMenus(); setShowParamsPanel(v); }}
        setShowCharacterPanel={(v) => { if (v) closeAllMenus(); setShowCharacterPanel(v); }}
        setShowDeleteDialog={setShowDeleteDialog}
        handleChangePersona={handleChangePersona}
        onNewChat={handleNewChat}
        showBookmarks={showBookmarks}
        onToggleBookmarks={() => { closeAllMenus(); setShowBookmarks(p => !p); }}
        bookmarkCount={activeChat.messages.filter(m => m.bookmarked).length}
        worldInfoBooks={worldInfoBooks}
        enabledWorldInfoIds={activeChat.enabledWorldInfoIds}
        onToggleWorldInfo={handleToggleWorldInfo}
        showWorldInfoMenu={showWorldInfoMenu}
        setShowWorldInfoMenu={(v) => { if (v) closeAllMenus(); setShowWorldInfoMenu(v); }}
        onSummarize={handleSummarize}
        isSummarizing={isSummarizing}
        onLinkPersonaToCharacter={handleLinkPersonaToCharacter}
        onShowConversationTree={() => { closeAllMenus(); setShowConversationTree(true); }}
      />

      {/* Summary Panel */}
      {activeChat.summary && (
        <div className="flex-shrink-0 border-b border-glass-border bg-dark-100/50">
          <button
            onClick={() => setShowSummary(p => !p)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-gray-300 transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-parlor-400" />
            <span>Context Summary (up to message {activeChat.summaryUpToIndex ?? 0})</span>
            {showSummary ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
          </button>
          {showSummary && (
            <div className="px-3 pb-3">
              <div className="text-sm text-gray-300 whitespace-pre-wrap bg-dark-200/80 rounded-lg p-3 border-l-2 border-parlor-500/50 max-h-48 overflow-y-auto">
                {activeChat.summary}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-2 sm:space-y-3">
        {activeChat.messages.map((message, idx) => {
          // Find whether this is the last assistant message in the conversation
          let isLastAssistant = false;
          if (message.role === 'assistant') {
            isLastAssistant = true;
            for (let j = idx + 1; j < activeChat.messages.length; j++) {
              if (activeChat.messages[j].role === 'assistant') { isLastAssistant = false; break; }
            }
          }
          return (
          <div key={message.id} id={`msg-${message.id}`}>
            <MessageBubble
              message={message}
              character={character}
              personaName={persona?.name || 'User'}
              personaAvatar={persona?.avatar}
              isUser={message.role === 'user'}
              isLastAssistant={isLastAssistant}
              avatarSize={getAvatarSize()}
              swipeIndex={currentSwipeIndex[message.id] || 0}
              isGenerating={isGenerating}
              regeneratingMessageId={regeneratingMessageId}
              streamingContent={streamingContent}
              streamingReasoning={streamingReasoning}
              onEdit={handleEditMessage}
              onEditSwipe={handleEditSwipe}
              onDelete={handleDeleteMessage}
              onRegenerate={regenerateResponse}
              onCopy={handleCopy}
              onSwipe={navigateSwipe}
              onBookmark={handleBookmarkMessage}
              onBranch={handleBranchFromMessage}
              onRetry={handleRetry}
              ttsVoice={character.ttsVoice}
            />
          </div>
          );
        })}

        {/* Streaming Response — single bubble for reasoning + content (not regeneration/impersonation) */}
        {isStreaming && !regeneratingMessageId && !isImpersonating && (streamingReasoning || streamingContent) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${isImpersonating ? 'flex-row-reverse' : ''}`}
          >
            <Avatar
              src={isImpersonating ? persona?.avatar : character.avatar}
              name={isImpersonating ? (persona?.name || 'User') : character.name}
              size={getAvatarSize()}
              className="flex-shrink-0 mt-1"
            />
            <div className={`rounded-2xl px-4 py-3 max-w-[80%] min-w-0 overflow-hidden ${isImpersonating ? 'bg-parlor-600/30 border border-parlor-500/30' : 'glass-sm'}`}>
              {streamingReasoning && (
                <>
                  <button
                    onClick={() => setExpandedStreamingReasoning(prev => !prev)}
                    className="flex items-center gap-2 text-xs text-parlor-400 hover:text-parlor-300 transition-colors mb-2"
                  >
                    <Brain className="w-3.5 h-3.5" />
                    <span>Reasoning...</span>
                    <ChevronUp className={`w-3.5 h-3.5 transition-transform ${expandedStreamingReasoning ? '' : 'rotate-180'}`} />
                  </button>
                  {expandedStreamingReasoning && (
                    <div className="text-sm text-gray-400 italic whitespace-pre-wrap break-words bg-dark-100/50 rounded-lg p-2 border-l-2 border-parlor-500/50 max-h-40 overflow-y-auto">
                      {streamingReasoning}
                    </div>
                  )}
                </>
              )}
              {streamingContent ? (
                <div className="text-gray-200 whitespace-pre-wrap break-words prose prose-invert prose-sm max-w-none text-[13px] leading-relaxed sm:text-sm">
                  <RpContent content={streamingContent} />
                  <span className="inline-block w-2 h-4 bg-parlor-400 animate-pulse ml-1" />
                </div>
              ) : (
                <div className="flex gap-1 mt-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Typing Indicator — only when nothing has streamed yet (not during impersonation) */}
        {isGenerating && !regeneratingMessageId && !isImpersonating && !streamingContent && !streamingReasoning && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3"
          >
            <Avatar src={character.avatar} name={character.name} size={getAvatarSize()} />
            <div className="glass-sm rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />

        {/* Continue Generation Button */}
        {activeChat.messages.length > 0 &&
         activeChat.messages[activeChat.messages.length - 1].role === 'assistant' &&
         !isGenerating && (
          <div className="flex justify-center pb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={continueGeneration}
              className="text-gray-400 hover:text-white"
            >
              <Play className="w-4 h-4" />
              Continue Generation
            </Button>
          </div>
        )}
      </div>

      {/* Author's Notes Panel */}
      <AnimatePresence>
        {showAuthorNotes && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-glass-border bg-dark-100/80 backdrop-blur-sm"
          >
            <div className="max-w-4xl mx-auto px-3 py-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-400">Author's Notes</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Inject at depth:</span>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={authorNoteDepth}
                    onChange={(e) => {
                      const d = Math.max(0, Math.min(20, parseInt(e.target.value) || 0));
                      setAuthorNoteDepth(d);
                      handleSaveAuthorNote(authorNote, d);
                    }}
                    className="w-12 text-center text-xs bg-dark-100 border border-glass-border rounded px-1 py-0.5 text-white focus:outline-none focus:border-parlor-500"
                  />
                  <span className="text-xs text-gray-500">msgs from end</span>
                </div>
              </div>
              <textarea
                value={authorNote}
                onChange={(e) => setAuthorNote(e.target.value)}
                onBlur={() => handleSaveAuthorNote(authorNote, authorNoteDepth)}
                placeholder="Notes injected into the AI context at the specified depth..."
                rows={3}
                className="w-full resize-none rounded-lg bg-dark-100 border border-glass-border px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-parlor-500/50"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Replies */}
      {settings?.quickReplies && settings.quickReplies.length > 0 && !isGenerating && (
        <div className="flex-shrink-0 border-t border-glass-border bg-dark-100/50 px-2 py-1.5">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide max-w-4xl mx-auto">
            {settings.quickReplies.map((qr: QuickReply) => {
              const resolved = qr.content
                .replace(/\{\{char\}\}/gi, character?.name || '')
                .replace(/\{\{user\}\}/gi, persona?.name || 'User');
              return (
                <button
                  key={qr.id}
                  onClick={() => {
                    if (qr.action === 'send') {
                      handleSend(resolved);
                    } else {
                      setInputValue(prev => prev + resolved);
                      inputRef.current?.focus();
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
        <div className="flex gap-1.5 sm:gap-3 items-stretch max-w-4xl mx-auto">
          <div className="flex-1 min-w-0 relative">
            {showCommandPalette && (
              <CommandPalette
                query={commandQuery}
                onSelect={(cmd) => {
                  setInputValue(cmd + ' ');
                  setShowCommandPalette(false);
                  inputRef.current?.focus();
                }}
                onClose={() => setShowCommandPalette(false)}
              />
            )}
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type a message..."
              className="w-full resize-none rounded-xl bg-dark-100 border border-glass-border px-3 py-2.5 sm:px-4 sm:py-3 text-white placeholder-gray-500 focus:outline-none focus:border-parlor-500/50 focus:ring-1 focus:ring-parlor-500/30 text-base leading-6 auto-grow-input"
            />
          </div>
          {/* Author's Notes — desktop only */}
          <button
            onClick={() => setShowAuthorNotes(p => !p)}
            title="Author's Notes"
            className={`self-end h-12 w-12 p-0 rounded-xl hidden sm:flex items-center justify-center flex-shrink-0 border transition-colors ${
              authorNote.trim()
                ? 'bg-parlor-500/20 border-parlor-500/50 text-parlor-400'
                : 'bg-dark-100 border-glass-border text-gray-500 hover:text-gray-300'
            }`}
          >
            <NotebookPen className="w-5 h-5" />
          </button>
          {/* Impersonate — desktop only */}
          <button
            onClick={() => impersonateResponse(undefined, (text) => { setInputValue(text); setTimeout(() => inputRef.current?.focus(), 0); })}
            disabled={isGenerating || !connection || !preset}
            title="Impersonate (AI writes as you)"
            className="self-end h-12 w-12 p-0 rounded-xl hidden sm:flex items-center justify-center flex-shrink-0 border transition-colors bg-dark-100 border-glass-border text-gray-500 hover:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <UserPen className="w-5 h-5" />
          </button>
          {/* Mobile-only + menu */}
          <div className="relative self-end flex sm:hidden">
            <button
              onClick={() => setShowMobileInputActions(p => !p)}
              title="More actions"
              className="h-10 w-10 p-0 rounded-xl flex items-center justify-center flex-shrink-0 border transition-colors bg-dark-100 border-glass-border text-gray-500 hover:text-gray-300"
            >
              <Plus className="w-4.5 h-4.5" />
            </button>
            {showMobileInputActions && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMobileInputActions(false)} />
                <div className="absolute bottom-full mb-2 right-0 z-50 bg-dark-50 border border-glass-border rounded-xl shadow-xl py-1 min-w-[180px]">
                  <button
                    onClick={() => { setShowMobileInputActions(false); setShowAuthorNotes(p => !p); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-400 hover:bg-glass-white transition-colors"
                  >
                    <NotebookPen className="w-4 h-4 text-gray-400" />
                    <span>Author's Notes</span>
                    {authorNote.trim() && <span className="ml-auto w-2 h-2 rounded-full bg-parlor-500" />}
                  </button>
                  <button
                    onClick={() => {
                      setShowMobileInputActions(false);
                      impersonateResponse(undefined, (text) => { setInputValue(text); setTimeout(() => inputRef.current?.focus(), 0); });
                    }}
                    disabled={isGenerating || !connection || !preset}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-400 hover:bg-glass-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <UserPen className="w-4 h-4 text-gray-400" />
                    <span>Impersonate</span>
                  </button>
                </div>
              </>
            )}
          </div>
          {isGenerating ? (
            <Button
              onClick={stopGeneration}
              variant="danger"
              className="self-end h-10 w-10 sm:h-12 sm:w-12 p-0 rounded-xl flex items-center justify-center flex-shrink-0"
            >
              <Square className="w-5 h-5" />
            </Button>
          ) : (
            <Button
              onClick={() => handleSend()}
              disabled={!inputValue.trim() || isSending}
              className="self-end h-10 w-10 sm:h-12 sm:w-12 p-0 rounded-xl flex items-center justify-center flex-shrink-0"
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
            ~{estimatedTokens.toLocaleString()} / {(settings?.contextSizeInTokens ?? 4096).toLocaleString()} tokens
          </span>
        </div>
      </div>

      {/* Bookmarks Panel */}
      <AnimatePresence>
        {showBookmarks && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBookmarks(false)}
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
                    Bookmarks
                    {activeChat.messages.filter(m => m.bookmarked).length > 0 && (
                      <span className="ml-2 text-sm font-normal text-gray-400">
                        ({activeChat.messages.filter(m => m.bookmarked).length})
                      </span>
                    )}
                  </h2>
                </div>
                <button onClick={() => setShowBookmarks(false)} className="p-1 rounded-lg hover:bg-glass-white transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {activeChat.messages.filter(m => m.bookmarked).length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <Bookmark className="w-10 h-10 text-gray-600 mb-3" />
                    <p className="text-gray-500 text-sm">No bookmarks yet</p>
                    <p className="text-gray-600 text-xs mt-1">Hover a message and click the bookmark icon to save it here.</p>
                  </div>
                ) : (
                  activeChat.messages
                    .filter(m => m.bookmarked)
                    .map(m => {
                      const isUser = m.role === 'user';
                      const speaker = isUser ? (persona?.name || 'User') : character.name;
                      return (
                        <button
                          key={m.id}
                          onClick={() => {
                            setShowBookmarks(false);
                            setTimeout(() => {
                              document.getElementById(`msg-${m.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }, 300);
                          }}
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

      {/* Conversation Tree */}
      <AnimatePresence>
        {showConversationTree && (
          <ConversationTree
            chat={activeChat}
            branches={branchChats}
            onNavigateMessage={(messageId) => {
              setShowConversationTree(false);
              setTimeout(() => {
                document.getElementById(`msg-${messageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 300);
            }}
            onNavigateBranch={(chatId) => {
              setShowConversationTree(false);
              navigate(`/chat/${chatId}`);
            }}
            onClose={() => setShowConversationTree(false)}
          />
        )}
      </AnimatePresence>

      {/* Delete Chat Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteChat}
        title="Delete Chat"
        message={`Are you sure you want to delete this chat with ${character.name}? All messages will be permanently deleted.`}
        confirmText="Delete Chat"
        variant="danger"
      />

      {/* Parameter Overrides Panel */}
      <AnimatePresence>
        {showParamsPanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowParamsPanel(false)}
              className="fixed inset-0 bg-black/50 z-50"
            />
            <ParameterPanel
              preset={preset}
              contextSize={contextSize}
              overrides={overrides}
              onOverridesChange={setOverrides}
              onSave={handleSaveOverrides}
              onClose={() => setShowParamsPanel(false)}
            />
          </>
        )}
      </AnimatePresence>

      {/* Character Quick View Panel */}
      <AnimatePresence>
        {showCharacterPanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCharacterPanel(false)}
              className="fixed inset-0 bg-black/50 z-50"
            />
            <CharacterPanel
              character={character}
              onClose={() => setShowCharacterPanel(false)}
            />
          </>
        )}
      </AnimatePresence>

      {/* Greeting Picker */}
      {showGreetingPicker && (
        <GreetingPickerModal
          character={character}
          onSelect={(greeting) => {
            createNewChatWithGreeting(greeting);
            setShowGreetingPicker(false);
          }}
          onClose={() => {
            setShowGreetingPicker(false);
          }}
        />
      )}
    </div>
  );
}

export default ChatPage;
