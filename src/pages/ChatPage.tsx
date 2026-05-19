import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { generateUUID } from '../utils/uuid';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Play,
  Brain,
  ChevronUp,
  ChevronDown,
  X,
  FileText,
  Code,
  Copy,
  Check,
} from 'lucide-react';
import { Button, Avatar, ConfirmDialog } from '../components/ui';
import { MessageBubble, RpContent } from '../components/chat/MessageBubble';
import { ParameterPanel } from '../components/chat/ParameterPanel';
import { CharacterPanel } from '../components/chat/CharacterPanel';
import { AuthorNotesPanel } from '../components/chat/AuthorNotesPanel';
import { GreetingPickerModal } from '../components/chat/GreetingPickerModal';
import { BookmarkPanel } from '../components/chat/BookmarkPanel';
import { ConversationTree } from '../components/chat/ConversationTree';
import { parseSlashCommand } from '../services/slashCommands';
import type { SlashCommandContext } from '../services/slashCommands';
import { characterOps, chatOps, connectionOps, presetOps, personaOps, settingsOps, worldInfoOps, getCombinedAuthorNotePresets } from '../db';
import { useChatStore, usePersonaStore } from '../stores';
import { buildSystemPrompt } from '../services/api';
import { useChatGeneration } from '../hooks/useChatGeneration';
import { useHotkeys } from '../hooks/useHotkeys';

import type { CharacterCard, ChatSession, Message, ConnectionProfile, Preset, Persona, AppSettings, ParameterOverrides, WorldInfo, ChatCompletionRequest } from '../types';
import { ChatPageHeader } from './ChatPageHeader';
import { StatusPanel } from '../components/chat';
import type { CharacterStatus } from '../components/chat/StatusPanel';
import { ChatInput } from '../components/chat/ChatInput';
import { extractStatusFromContent, stripStatusBlocks } from '../utils/prompts';

export function ChatPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id: chatId } = useParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

const activeChat = useChatStore(s => s.activeChat);
const setActiveChat = useChatStore(s => s.setActiveChat);
const updateChat = useChatStore(s => s.updateChat);
const removeChat = useChatStore(s => s.removeChat);
const streamingReasoning = useChatStore(s => s.streamingReasoning);
const clearStreamingReasoning = useChatStore(s => s.clearStreamingReasoning);
const personas = usePersonaStore(s => s.personas);
const setPersonas = usePersonaStore(s => s.setPersonas);

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
  const [authorNoteDepth, setAuthorNoteDepth] = useState(0);

  // Greeting picker state
  const [showGreetingPicker, setShowGreetingPicker] = useState(false);

  // Summarization state
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // Bookmarks panel
  const [showBookmarks, setShowBookmarks] = useState(false);


  // AI 提示词预览
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [promptMessages, setPromptMessages] = useState<ChatCompletionRequest['messages'] | null>(null);
  const [copied, setCopied] = useState(false);

  // Conversation tree
  const [showConversationTree, setShowConversationTree] = useState(false);
  const [branchChats, setBranchChats] = useState<ChatSession[]>([]);

  // World Info books
  const [worldInfoBooks, setWorldInfoBooks] = useState<WorldInfo[]>([]);

  // Slash command palette
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');

  // Visual Novel mode

  // Character status panel state
  const [characterStatuses, setCharacterStatuses] = useState<CharacterStatus[]>([]);
  const [statusPage, setStatusPage] = useState(0);
  const statusInfoRef = useRef<CharacterStatus | null>(null);
  statusInfoRef.current = characterStatuses[0] ?? null;

  // Reset status bar and reasoning when switching chats
  useEffect(() => {
    setCharacterStatuses([]);
    setStatusPage(0);
    clearStreamingReasoning();
  }, [activeChat?.id]);

  // Close all dropdown menus
  const closeAllMenus = useCallback(() => {
    setShowPersonaMenu(false);
    setShowActionsMenu(false);
    setShowWorldInfoMenu(false);
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
    getLastPrompt,
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
        if (lastAssistant) regenerateResponse(lastAssistant.id, statusInfoRef.current);
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
        const note = chat.authorNote ?? '';
        setAuthorNote(note);

        // Auto-fill from enabled presets if authorNote is empty
        if (!note) {
          getCombinedAuthorNotePresets().then(combined => {
            if (combined) {
              setAuthorNote(combined);
              chatOps.update(chat.id, { authorNote: combined }).catch(() => {});
            }
          }).catch(() => {});
        }

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

        // Set authorNote default depth from settings
        const defaultDepth = settingsData?.authorNoteDefaultDepth ?? 0;
        setAuthorNoteDepth(chat.authorNoteDepth ?? defaultDepth);

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

  // Auto-scroll to bottom on new messages, streaming content changes, or streaming start/stop
  useEffect(() => {
    if (hasScrolledToBottom.current === activeChat?.id && settings?.autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeChat?.messages, isStreaming, streamingContent, settings?.autoScroll]);

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
      m.id === messageId
        ? {
            ...m,
            activeSwipeIndex: newIndex,
            content: m.swipes?.[newIndex] ?? m.content,
          }
        : m
    );
    updateChat(activeChat.id, { messages: updatedMessages });
    chatOps.update(activeChat.id, { messages: updatedMessages });
  }, [activeChat, currentSwipeIndex, updateChat]);

  // Auto-advance swipe index when a new swipe is added (after regeneration)
  const prevSwipeCounts = useRef<Record<string, number>>({});
  const initializedChatId = useRef<string | null>(null);
  const extractedGreetingRef = useRef<string | null>(null);
  const prevContentRef = useRef<string>('');
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

  // Extract character status from assistant messages
  useEffect(() => {
    if (!activeChat?.messages) return;
    const messages = activeChat.messages;

    const tryExtractAndUpdate = (content: string) => {
      if (!content || isStreaming || content === prevContentRef.current) return;
      prevContentRef.current = content;
      const { sceneHeader, infoLines, statusLines } = extractStatusFromContent(content, settings?.statusFieldConfig);
      if (!sceneHeader && infoLines.length === 0 && statusLines.length === 0) return;

      // 单聊始终替换第一个条目，不会创建多页
      setCharacterStatuses(prev => {
        const newStatus: CharacterStatus = { sceneHeader, infoLines, statusLines };
        if (prev.length === 0) return [newStatus];

        // 合并更新：本轮有输出时未提及的旧字段不保留，无输出时保留全部旧状态
        const oldStatus = prev[0];

        // 合并状态行：新值覆盖旧值；本轮有输出时未提及的旧字段不保留，无输出时保留全部旧状态
        const newLabels = new Set((newStatus.statusLines || []).map(l => l.label));
        const mergedLines = [...(newStatus.statusLines || [])];
        const oldLines = oldStatus.statusLines || [];
        for (const oldLine of oldLines) {
          if (!newLabels.has(oldLine.label)) {
            mergedLines.push(oldLine);
          }
        }

        // 合并角色信息：新值覆盖旧值；本轮有输出时未提及的旧字段不保留，无输出时保留全部旧状态
        const newInfoLabels = new Set((newStatus.infoLines || []).map(l => l.label));
        const mergedInfo = [...(newStatus.infoLines || [])];
        const oldInfo = oldStatus.infoLines || [];
        for (const oldLine of oldInfo) {
          if (!newInfoLabels.has(oldLine.label)) {
            mergedInfo.push(oldLine);
          }
        }

        return [{
          sceneHeader: newStatus.sceneHeader || oldStatus.sceneHeader,
          infoLines: mergedInfo,
          statusLines: mergedLines,
        }];
      });
      // Reset to first page when new status arrives
      setStatusPage(0);
    };

    // 始终尝试从最后一条 assistant 消息提取状态
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === 'assistant') {
      tryExtractAndUpdate(lastMsg.content);
    }

    // 首次加载此聊天时，从第一条 assistant 消息（开场白）提取初始状态
    if (extractedGreetingRef.current !== activeChat.id) {
      extractedGreetingRef.current = activeChat.id;
      const firstAssistant = messages.find(m => m.role === 'assistant');
      if (firstAssistant && firstAssistant.id !== lastMsg?.id) {
        tryExtractAndUpdate(firstAssistant.content);
      }
    }
  }, [activeChat?.messages, activeChat?.id, settings?.statusFieldConfig]);

  // 流式传输中实时提取状态
  useEffect(() => {
    if (isStreaming && streamingContent) {
      const { sceneHeader, infoLines, statusLines } = extractStatusFromContent(
        streamingContent,
        settings?.statusFieldConfig,
      );
      if (sceneHeader || infoLines.length > 0 || statusLines.length > 0) {
        setCharacterStatuses(prev => {
          const newStatus: CharacterStatus = { sceneHeader, infoLines, statusLines };
          if (prev.length === 0) return [newStatus];
          const oldStatus = prev[0];

          const newLabels = new Set((newStatus.statusLines || []).map(l => l.label));
          const mergedLines = [...(newStatus.statusLines || [])];
          const oldLines = oldStatus.statusLines || [];
          for (const oldLine of oldLines) {
            if (!newLabels.has(oldLine.label)) mergedLines.push(oldLine);
          }

          const newInfoLabels = new Set((newStatus.infoLines || []).map(l => l.label));
          const mergedInfo = [...(newStatus.infoLines || [])];
          const oldInfo = oldStatus.infoLines || [];
          for (const oldLine of oldInfo) {
            if (!newInfoLabels.has(oldLine.label)) mergedInfo.push(oldLine);
          }

          return [{
            sceneHeader: newStatus.sceneHeader || oldStatus.sceneHeader,
            infoLines: mergedInfo,
            statusLines: mergedLines,
          }];
        });
      }
    }
  }, [isStreaming, streamingContent, settings?.statusFieldConfig]);

  // Regenerate wrapper that injects current status info
  const handleRegenerateWithStatus = useCallback((id: string) => {
    regenerateResponse(id, statusInfoRef.current);
  }, [regenerateResponse]);

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
        onRegenerate: handleRegenerateWithStatus,
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
    try {
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

      await generateResponse(updatedMessages, statusInfoRef.current);
    } catch (e) {
      console.error('[ChatPage] Send failed:', e);
      const errorMsg: Message = {
        id: generateUUID(),
        role: 'assistant',
        content: `生成失败: ${e instanceof Error ? e.message : '未知错误'}`,
        timestamp: Date.now(),
      };
      const updatedWithError = [...activeChat.messages, errorMsg];
      await chatOps.update(activeChat.id, { messages: updatedWithError });
      updateChat(activeChat.id, { messages: updatedWithError });
    } finally {
      setIsSending(false);
    }
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
    await generateResponse(messagesUpTo, statusInfoRef.current);
  }, [activeChat, updateChat, generateResponse, statusInfoRef]);

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

    // 获取所有启用了"默认关联"的世界书
    const allWorldInfos = await worldInfoOps.getAll();
    const enabledWorldInfoIds = allWorldInfos
      .filter(b => b.enabled && b.autoAssociate !== false)
      .map(b => b.id);

    const newChat: ChatSession = {
      id: generateUUID(),
      characterId: character.id,
      personaId,
      messages: [],
      enabledWorldInfoIds: enabledWorldInfoIds.length > 0 ? enabledWorldInfoIds : [],
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
    const sysPrompt = preset ? buildSystemPrompt(character, persona, character.systemPrompt, preset, settings?.responseLength) : '';
    const effectiveCtxSize = activeChat.parameterOverrides?.contextSize ?? contextSize;
    const msgText = activeChat.messages.slice(-effectiveCtxSize).map(m => m.content).join(' ');
    return Math.ceil((sysPrompt.length + msgText.length + inputValue.length) / 4);
  }, [activeChat?.messages, activeChat?.parameterOverrides?.contextSize, character, persona, preset, contextSize, inputValue]);

  // Session aggregated metadata from responseMeta
  const sessionMeta = useMemo(() => {
    if (!activeChat?.messages) return null;
    const msgs = activeChat.messages.filter(m => m.responseMeta);
    if (msgs.length === 0) return null;
    let totalTokens = 0;
    let totalTimeMs = 0;
    let currentTimeMs = 0;
    msgs.forEach(m => {
      if (m.responseMeta?.totalTokens) totalTokens += m.responseMeta.totalTokens;
      if (m.responseMeta?.responseTimeMs) {
        totalTimeMs += m.responseMeta.responseTimeMs;
        currentTimeMs = m.responseMeta.responseTimeMs;
      }
    });
    return { totalTokens, totalTimeMs, currentTimeMs, msgCount: msgs.length };
  }, [activeChat?.messages]);

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
        <p className="text-gray-500">{t('chat.notFound')}</p>
        <Button className="mt-4" onClick={() => navigate('/chats')}>
          {t('chat.backToChats')}
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
        sessionMeta={sessionMeta}
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
            <span>{t('chat.contextSummary', { count: activeChat.summaryUpToIndex ?? 0 })}</span>
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

      {/* Content + Status Panel Row */}
      <div className="flex flex-1 overflow-hidden">
        {/* Inner column: messages + controls */}
        <div className="flex-1 flex flex-col overflow-hidden">

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
          // Strip status blocks from assistant messages for display
          const displayMessage = message.role === 'assistant'
            ? { ...message, content: stripStatusBlocks(message.content) }
            : message;
          return (
          <div key={message.id} id={`msg-${message.id}`}>
            <MessageBubble
              message={displayMessage}
              character={character}
              personaName={persona?.name || t('chat.role.user')}
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
              onRegenerate={handleRegenerateWithStatus}
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
              name={isImpersonating ? (persona?.name || t('chat.role.user')) : character.name}
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
                    <span>{t('chat.reasoning')}</span>
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
              {t('chat.continueGeneration')}
            </Button>
          </div>
        )}
      </div>

      <AuthorNotesPanel
        isOpen={showAuthorNotes}
        authorNote={authorNote}
        authorNoteDepth={authorNoteDepth}
        onSave={(note, depth) => {
          setAuthorNote(note);
          setAuthorNoteDepth(depth);
          if (activeChat) {
            chatOps.update(activeChat.id, { authorNote: note, authorNoteDepth: depth });
          }
        }}
      />

      <ChatInput
        inputValue={inputValue}
        onInputChange={handleInputChange}
        onSend={handleSend}
        onStop={stopGeneration}
        onImpersonate={() => impersonateResponse(undefined, (text) => { setInputValue(text); setTimeout(() => inputRef.current?.focus(), 0); })}
        onShowPromptPreview={() => {
          const prompt = getLastPrompt?.();
          if (prompt) {
            setPromptMessages(prompt);
            setShowPromptModal(true);
          }
        }}
        isGenerating={isGenerating}
        isSending={isSending}
        authorNote={authorNote}
        showAuthorNotes={showAuthorNotes}
        onToggleAuthorNotes={() => setShowAuthorNotes(p => !p)}
        showCommandPalette={showCommandPalette}
        commandQuery={commandQuery}
        onCommandQueryChange={setCommandQuery}
        onCommandSelect={(cmd) => {
          setInputValue(cmd + ' ');
          setShowCommandPalette(false);
          inputRef.current?.focus();
        }}
        onCloseCommandPalette={() => setShowCommandPalette(false)}
        connection={connection}
        preset={preset}
        estimatedTokens={estimatedTokens}
        totalTokens={settings?.contextSizeInTokens ?? 4096}
        quickReplies={activeChat?.messages ? [] : (settings?.quickReplies ?? [])}
        onQuickReply={(content) => handleSend(content)}
        characterName={character?.name}
        personaName={persona?.name}
      />
        </div> {/* End inner column */}

        {/* Right Status Panel — always visible */}
        <StatusPanel
          statuses={characterStatuses}
          currentPage={statusPage}
          onPageChange={setStatusPage}
          enablePagination={false}
        />
      </div> {/* End content + status panel row */}

      <BookmarkPanel
        messages={activeChat.messages}
        character={character}
        persona={persona}
        isOpen={showBookmarks}
        onClose={() => setShowBookmarks(false)}
        onNavigateToMessage={(messageId) => {
          setShowBookmarks(false);
          setTimeout(() => {
            document.getElementById(`msg-${messageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 300);
        }}
      />

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
        title={t('chat.deleteChat')}
        message={t('chat.deleteConfirmWithName', { name: character.name })}
        confirmText={t('chat.deleteChat')}
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

      {/* AI 提示词预览 */}
      {showPromptModal && promptMessages && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowPromptModal(false)}>
          <div className="relative w-full max-w-3xl max-h-[80vh] mx-4 bg-dark-200 border border-glass-border rounded-xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {/* 标题栏 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-glass-border">
              <div className="flex items-center gap-2">
                <Code size={16} className="text-parlor-400" />
                <span className="text-sm font-medium text-gray-200">AI 提示词预览</span>
                <span className="text-[11px] text-gray-500">({promptMessages.length} 条消息)</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    const text = promptMessages.map(m => `<|${m.role}|>\n${typeof m.content === 'string' ? m.content : JSON.stringify(m.content, null, 2)}`).join('\n\n');
                    navigator.clipboard.writeText(text);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="p-1.5 rounded-lg hover:bg-dark-300 text-gray-400 hover:text-gray-200 transition-colors"
                  title="复制全部"
                >
                  {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                </button>
                <button onClick={() => setShowPromptModal(false)} className="p-1.5 rounded-lg hover:bg-dark-300 text-gray-400 hover:text-gray-200 transition-colors">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* 消息列表 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {promptMessages.map((msg, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      msg.role === 'system' ? 'bg-purple-500/20 text-purple-300' :
                      msg.role === 'user' ? 'bg-blue-500/20 text-blue-300' :
                      'bg-green-500/20 text-green-300'
                    }`}>
                      {msg.role.toUpperCase()}
                    </span>
                    <span className="text-[10px] text-gray-600">#{i + 1}</span>
                  </div>
                  <pre className="text-[11px] text-gray-300 bg-dark-300/50 rounded-lg p-3 whitespace-pre-wrap break-all font-mono leading-relaxed max-h-64 overflow-y-auto">
                    {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2)}
                  </pre>
                </div>
              ))}
            </div>

            {/* 底部信息 */}
            <div className="px-4 py-2 border-t border-glass-border text-[10px] text-gray-600 flex items-center justify-between">
              <span>共 {promptMessages.length} 条消息</span>
              <span>角色分配: {promptMessages.filter(m => m.role === 'system').length} system / {promptMessages.filter(m => m.role === 'user').length} user / {promptMessages.filter(m => m.role === 'assistant').length} assistant</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatPage;
