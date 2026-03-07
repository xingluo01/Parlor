import { useState, useEffect, useRef, useCallback } from 'react';
import { generateUUID } from '../utils/uuid';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Send,
  Loader2,
  Square,
  ArrowLeft,
  MoreHorizontal,
  Edit3,
  Trash2,
  Users,
  Download,
  FolderOpen,
} from 'lucide-react';
import { Button, Avatar } from '../components/ui';
import { RpContent } from '../components/chat/MessageBubble';
import { groupChatOps, characterOps, connectionOps, presetOps, personaOps, settingsOps } from '../db';
import { APIClient, buildSystemPrompt, buildMessages, buildDepthInjections } from '../services/api';
import type {
  CharacterCard,
  GroupChat,
  GroupMember,
  Message,
  ConnectionProfile,
  Preset,
  Persona,
  AppSettings,
} from '../types';
import type { DepthInjection } from '../utils/presetImport';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Pick responding characters based on turn mode. */
function pickResponders(
  members: GroupMember[],
  characters: Map<string, CharacterCard>,
  turnMode: GroupChat['turnMode'],
  currentTurnIndex: number,
): { responders: string[]; nextTurnIndex: number } {
  const active = members.filter(m => m.isActive && characters.has(m.characterId));
  if (active.length === 0) return { responders: [], nextTurnIndex: currentTurnIndex };

  switch (turnMode) {
    case 'list': {
      const idx = currentTurnIndex % active.length;
      return {
        responders: [active[idx].characterId],
        nextTurnIndex: idx + 1,
      };
    }

    case 'random': {
      // Weighted random pick by talkativeness
      const totalWeight = active.reduce((s, m) => s + (m.talkativeness || 1), 0);
      let roll = Math.random() * totalWeight;
      for (const m of active) {
        roll -= m.talkativeness || 1;
        if (roll <= 0) {
          return { responders: [m.characterId], nextTurnIndex: currentTurnIndex };
        }
      }
      return { responders: [active[0].characterId], nextTurnIndex: currentTurnIndex };
    }

    case 'natural': {
      // Pick 1-3 characters based on talkativeness probability
      const chosen: string[] = [];
      for (const m of active) {
        const chance = (m.talkativeness || 50) / 100;
        if (Math.random() < chance) {
          chosen.push(m.characterId);
        }
      }
      // Guarantee at least one responder
      if (chosen.length === 0) {
        const randomIdx = Math.floor(Math.random() * active.length);
        chosen.push(active[randomIdx].characterId);
      }
      // Cap at 3
      return {
        responders: chosen.slice(0, 3),
        nextTurnIndex: currentTurnIndex,
      };
    }

    case 'manual':
    default:
      // Manual mode: caller picks, return empty here
      return { responders: [], nextTurnIndex: currentTurnIndex };
  }
}

/** Build group-specific system prompt for a character. */
function buildGroupSystemPrompt(
  character: CharacterCard,
  allCharacters: Map<string, CharacterCard>,
  members: GroupMember[],
  persona: Persona | null,
  preset: Preset | null,
): string {
  const base = buildSystemPrompt(character, persona, character.systemPrompt, preset);

  // Append group context — mention other characters in the scene
  const others = members
    .filter(m => m.isActive && m.characterId !== character.id)
    .map(m => allCharacters.get(m.characterId))
    .filter(Boolean) as CharacterCard[];

  if (others.length === 0) return base;

  const otherNames = others.map(c => c.name).join(', ');
  const groupNote = `\n\n## Group Chat Context\nYou are in a group conversation with: ${otherNames}. Respond ONLY as ${character.name}. Do NOT write dialogue or actions for the other characters.`;

  return base + groupNote;
}

// ── Component ────────────────────────────────────────────────────────────────

export function GroupChatPage() {
  const navigate = useNavigate();
  const { id: groupId } = useParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Core state
  const [groupChat, setGroupChat] = useState<GroupChat | null>(null);
  const [characters, setCharacters] = useState<Map<string, CharacterCard>>(new Map());
  const [connection, setConnection] = useState<ConnectionProfile | null>(null);
  const [preset, setPreset] = useState<Preset | null>(null);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [contextSize, setContextSize] = useState(20);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingCharId, setStreamingCharId] = useState<string | null>(null);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // ── Load group chat and all dependencies ────────────────────────────────

  useEffect(() => {
    if (groupId) loadGroupChat();
  }, [groupId]);

  const loadGroupChat = async () => {
    setIsLoading(true);
    try {
      const gc = await groupChatOps.getById(groupId!);
      if (!gc) {
        navigate('/chats');
        return;
      }
      setGroupChat(gc);

      // Load all member characters
      const charMap = new Map<string, CharacterCard>();
      await Promise.all(
        gc.members.map(async (m: GroupMember) => {
          const char = await characterOps.getById(m.characterId);
          if (char) charMap.set(char.id, char);
        }),
      );
      setCharacters(charMap);

      // Load connection, preset, settings, persona
      const [activeConn, activePreset, settingsData, personaList] = await Promise.all([
        connectionOps.getActive(),
        presetOps.getDefault(),
        settingsOps.get(),
        personaOps.getAll(),
      ]);

      setConnection(activeConn || null);
      setPreset(activePreset || null);
      setSettings(settingsData || null);
      setContextSize(settingsData?.contextSize || 20);

      // Load persona: group's persona > default persona
      if (gc.personaId) {
        const p = personaList.find(p => p.id === gc.personaId);
        setPersona(p || null);
      } else if (personaList.length > 0) {
        const defaultPersona = personaList.find(p => p.isDefault) || personaList[0];
        setPersona(defaultPersona);
      }
    } catch (err) {
      console.error('Failed to load group chat:', err);
      navigate('/chats');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Scroll behavior ─────────────────────────────────────────────────────

  const hasScrolledToBottom = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoading && groupChat && hasScrolledToBottom.current !== groupChat.id) {
      hasScrolledToBottom.current = groupChat.id;
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
      });
    }
  }, [isLoading, groupChat?.id]);

  useEffect(() => {
    if (hasScrolledToBottom.current === groupChat?.id) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [groupChat?.messages, isGenerating]);

  // ── Generation logic ────────────────────────────────────────────────────

  /** Generate a single character's response and return the message. */
  const generateForCharacter = async (
    character: CharacterCard,
    currentMessages: Message[],
  ): Promise<Message | null> => {
    if (!connection || !preset || !groupChat) return null;

    const systemPrompt = buildGroupSystemPrompt(character, characters, groupChat.members, persona, preset);
    const depthInjections: DepthInjection[] = [
      ...buildDepthInjections(character, persona, character.systemPrompt, preset),
    ];
    depthInjections.sort((a, b) => b.depth - a.depth);

    const apiMessages = buildMessages(
      systemPrompt,
      currentMessages,
      contextSize,
      character.characterBook?.entries,
      depthInjections,
      groupChat.summary,
    );

    const client = new APIClient(connection, preset, settings || undefined);
    abortControllerRef.current = new AbortController();

    return new Promise<Message | null>((resolve) => {
      let fullContent = '';

      setStreamingCharId(character.id);
      setStreamingContent('');

      client.streamCompletion(
        apiMessages,
        // onChunk
        (chunk) => {
          fullContent += chunk;
          setStreamingContent(fullContent);
        },
        // onComplete
        (finalContent) => {
          const content = finalContent || fullContent;
          if (!content.trim()) {
            resolve(null);
            return;
          }

          const msg: Message = {
            id: generateUUID(),
            role: 'assistant',
            content: content.trim(),
            timestamp: Date.now(),
            characterId: character.id,
          };

          setStreamingContent('');
          setStreamingCharId(null);
          resolve(msg);
        },
        // onError
        (error) => {
          console.error(`Generation error for ${character.name}:`, error);
          setStreamingContent('');
          setStreamingCharId(null);
          resolve(null);
        },
      );
    });
  };

  /** Run the full generation pipeline: save user message, pick responders, generate. */
  const runGeneration = async (responderIds: string[], messagesWithUser: Message[]) => {
    if (!groupChat) return;
    setIsGenerating(true);

    let currentMessages = [...messagesWithUser];

    for (const charId of responderIds) {
      const char = characters.get(charId);
      if (!char) continue;

      const msg = await generateForCharacter(char, currentMessages);
      if (msg) {
        currentMessages = [...currentMessages, msg];
        // Persist incrementally
        const updated = { ...groupChat, messages: currentMessages, updatedAt: Date.now() };
        await groupChatOps.update(groupChat.id, { messages: currentMessages });
        setGroupChat(updated);
      }
    }

    setIsGenerating(false);
  };

  // ── Send user message ───────────────────────────────────────────────────

  const handleSend = async () => {
    if (!inputValue.trim() || !groupChat || isSending) return;
    if (!connection || !preset) {
      navigate('/settings');
      return;
    }

    setIsSending(true);
    const userContent = inputValue.trim();
    setInputValue('');

    const userMessage: Message = {
      id: generateUUID(),
      role: 'user',
      content: userContent,
      timestamp: Date.now(),
    };

    const updatedMessages = [...groupChat.messages, userMessage];
    const updated = { ...groupChat, messages: updatedMessages, updatedAt: Date.now() };
    await groupChatOps.update(groupChat.id, { messages: updatedMessages });
    setGroupChat(updated);

    if (groupChat.turnMode === 'manual') {
      // Manual mode: don't auto-generate, user will pick via character buttons
      setIsSending(false);
      return;
    }

    // Determine responders
    const { responders, nextTurnIndex } = pickResponders(
      groupChat.members,
      characters,
      groupChat.turnMode,
      groupChat.currentTurnIndex ?? 0,
    );

    if (nextTurnIndex !== (groupChat.currentTurnIndex ?? 0)) {
      await groupChatOps.update(groupChat.id, { currentTurnIndex: nextTurnIndex });
    }

    await runGeneration(responders, updatedMessages);
    setIsSending(false);
  };

  // ── Manual mode: pick a character to speak ──────────────────────────────

  const handleManualPick = async (characterId: string) => {
    if (!groupChat || isGenerating) return;
    setIsGenerating(true);

    const char = characters.get(characterId);
    if (!char) {
      setIsGenerating(false);
      return;
    }

    const msg = await generateForCharacter(char, groupChat.messages);
    if (msg) {
      const updatedMessages = [...groupChat.messages, msg];
      const updated = { ...groupChat, messages: updatedMessages, updatedAt: Date.now() };
      await groupChatOps.update(groupChat.id, { messages: updatedMessages });
      setGroupChat(updated);
    }

    setIsGenerating(false);
  };

  // ── Stop generation ─────────────────────────────────────────────────────

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsGenerating(false);
    setStreamingContent('');
    setStreamingCharId(null);
  }, []);

  // ── Delete message ──────────────────────────────────────────────────────

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (!groupChat) return;
    const updatedMessages = groupChat.messages.filter(m => m.id !== messageId);
    await groupChatOps.update(groupChat.id, { messages: updatedMessages });
    setGroupChat({ ...groupChat, messages: updatedMessages, updatedAt: Date.now() });
  }, [groupChat]);

  // ── Delete group chat ───────────────────────────────────────────────────

  const handleDeleteChat = async () => {
    if (!groupChat) return;
    await groupChatOps.delete(groupChat.id);
    navigate('/chats');
  };

  // ── Copy message ────────────────────────────────────────────────────────

  const handleCopy = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
  }, []);

  // ── Key handler ─────────────────────────────────────────────────────────

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Avatar size from settings ───────────────────────────────────────────

  const getAvatarSize = (): 'xs' | 'sm' | 'md' | 'lg' | 'xl' => {
    switch (settings?.avatarSize) {
      case 'small': return 'sm';
      case 'large': return 'lg';
      default: return 'md';
    }
  };

  // ── Determine if we should show the manual picker ───────────────────────

  const showManualPicker = groupChat?.turnMode === 'manual' && !isGenerating;
  const lastMessage = groupChat?.messages[groupChat.messages.length - 1];
  const showPickerNow = showManualPicker && lastMessage?.role === 'user';

  // ── Export helper ──────────────────────────────────────────────────────

  function handleExportText() {
    if (!groupChat) return;
    const header = [
      groupChat.name,
      `Group Chat · ${groupChat.members.length} members`,
      `Exported ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      '',
      '='.repeat(40),
      '',
    ].join('\n');

    const body = groupChat.messages
      .filter(m => m.role !== 'system')
      .map(m => {
        const speaker = m.role === 'user'
          ? (persona?.name || 'User')
          : (characters.get(m.characterId || '')?.name || 'Unknown');
        return `[${speaker}]: ${m.content}`;
      })
      .join('\n\n');

    const content = header + body;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
    a.download = `${groupChat.name.replace(/[^a-z0-9_\- ]/gi, '_').trim()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  // ── Render helpers ──────────────────────────────────────────────────────

  const getCharacterForMessage = (msg: Message): CharacterCard | null => {
    if (msg.characterId) return characters.get(msg.characterId) || null;
    // Fallback: first character
    const firstMember = groupChat?.members[0];
    return firstMember ? characters.get(firstMember.characterId) || null : null;
  };

  // ── Loading state ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-parlor-500" />
      </div>
    );
  }

  if (!groupChat) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <p className="text-gray-400">Group chat not found</p>
        <Button className="mt-4" onClick={() => navigate('/chats')}>
          Back to Chats
        </Button>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-glass-border bg-dark-200/50 backdrop-blur-sm relative z-10 safe-top">
        <div className="flex items-center justify-between px-2 h-14 sm:h-16">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => navigate('/chats')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {/* Stacked avatars */}
              <div className="flex -space-x-2 flex-shrink-0">
                {groupChat.members.slice(0, 3).map((m) => {
                  const char = characters.get(m.characterId);
                  return (
                    <Avatar
                      key={m.characterId}
                      src={char?.avatar}
                      name={char?.name || '?'}
                      size="sm"
                      className="ring-2 ring-dark-200"
                    />
                  );
                })}
                {groupChat.members.length > 3 && (
                  <div className="w-8 h-8 rounded-full bg-dark-100 border-2 border-dark-200 flex items-center justify-center text-xs text-gray-400">
                    +{groupChat.members.length - 3}
                  </div>
                )}
              </div>
              <div className="text-left min-w-0">
                <h1 className="font-semibold text-white text-sm sm:text-base truncate font-serif tracking-tight">{groupChat.name}</h1>
                <p className="text-xs text-gray-500 truncate">
                  {groupChat.members.length} members · {groupChat.messages.length} messages
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {/* Turn mode badge */}
            <span className="hidden sm:inline-block text-xs text-gray-500 bg-dark-100 border border-glass-border rounded-full px-2 py-0.5 capitalize">
              {groupChat.turnMode}
            </span>

            {/* Actions Menu */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowActionsMenu(!showActionsMenu)}
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>

              <AnimatePresence>
                {showActionsMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowActionsMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 top-full mt-1 z-50 bg-dark-100 border border-glass-border rounded-xl py-1 min-w-[180px] shadow-dramatic"
                    >
                      <button
                        onClick={() => {
                          setShowActionsMenu(false);
                          navigate(`/group-chats/${groupChat.id}/edit`);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:text-white hover:bg-glass-white flex items-center gap-2"
                      >
                        <Edit3 className="w-4 h-4" />
                        Edit Group
                      </button>
                      <button
                        onClick={() => {
                          setShowActionsMenu(false);
                          navigate(`/group-chats/${groupChat.id}/members`);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:text-white hover:bg-glass-white flex items-center gap-2"
                      >
                        <Users className="w-4 h-4" />
                        Manage Members
                      </button>
                      <button
                        onClick={() => {
                          setShowActionsMenu(false);
                          navigate('/chats');
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:text-white hover:bg-glass-white flex items-center gap-2"
                      >
                        <FolderOpen className="w-4 h-4" />
                        All Chats
                      </button>
                      <div className="border-t border-glass-border my-1" />
                      <button
                        onClick={() => {
                          setShowActionsMenu(false);
                          handleExportText();
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:text-white hover:bg-glass-white flex items-center gap-2"
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
                        className="w-full px-3 py-2 text-left text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Group Chat
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-2 sm:space-y-3">
        {groupChat.messages.map((message) => {
          const isUser = message.role === 'user';
          const char = getCharacterForMessage(message);

          return (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div className="flex-shrink-0 mt-1">
                <Avatar
                  src={isUser ? persona?.avatar : char?.avatar}
                  name={isUser ? (persona?.name || 'User') : (char?.name || '?')}
                  size={getAvatarSize()}
                />
              </div>

              {/* Content */}
              <div className="flex-1 max-w-[80%] min-w-0 overflow-hidden">
                {/* Character name label for assistant messages */}
                {!isUser && char && (
                  <span className="text-xs font-medium text-parlor-400 ml-1 mb-0.5 block">
                    {char.name}
                  </span>
                )}

                <div
                  className={`
                    relative group rounded-2xl px-3 py-2 sm:px-4 sm:py-3
                    ${isUser
                      ? 'bg-parlor-600/12 border border-parlor-500/15'
                      : 'bg-dark-100/70 border border-glass-border'}
                  `}
                >
                  <div className="text-gray-200 whitespace-pre-wrap break-words prose prose-invert prose-sm max-w-none text-[13px] leading-relaxed sm:text-sm">
                    <RpContent content={message.content} />
                  </div>

                  {/* Hover actions */}
                  <div
                    className={`
                      absolute ${isUser ? 'left-0 -translate-x-full pr-2' : 'right-0 translate-x-full pl-2'}
                      top-1/2 -translate-y-1/2
                      opacity-0 group-hover:opacity-100 transition-opacity
                      hidden sm:flex gap-1
                    `}
                  >
                    <button
                      onClick={() => handleCopy(message.content)}
                      className="p-1.5 rounded-lg bg-dark-100 hover:bg-dark-50"
                      title="Copy"
                    >
                      <Edit3 className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleDeleteMessage(message.id)}
                      className="p-1.5 rounded-lg bg-dark-100 hover:bg-dark-50"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>

                {/* Timestamp */}
                <div className={`mt-1 flex ${isUser ? 'justify-end' : ''}`}>
                  <span className="text-xs text-gray-500">
                    {new Date(message.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* Streaming response bubble */}
        {isGenerating && streamingCharId && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3"
          >
            <Avatar
              src={characters.get(streamingCharId)?.avatar}
              name={characters.get(streamingCharId)?.name || '?'}
              size={getAvatarSize()}
              className="flex-shrink-0 mt-1"
            />
            <div className="flex-1 max-w-[80%] min-w-0 overflow-hidden">
              <span className="text-xs font-medium text-parlor-400 ml-1 mb-0.5 block">
                {characters.get(streamingCharId)?.name || '?'}
              </span>
              <div className="glass-sm rounded-2xl px-4 py-3">
                {streamingContent ? (
                  <div className="text-gray-200 whitespace-pre-wrap break-words prose prose-invert prose-sm max-w-none text-[13px] leading-relaxed sm:text-sm">
                    <RpContent content={streamingContent} />
                    <span className="inline-block w-2 h-4 bg-parlor-400 animate-pulse ml-1" />
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Typing indicator when generating but nothing streamed yet */}
        {isGenerating && !streamingCharId && !streamingContent && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-dark-100 flex items-center justify-center flex-shrink-0 mt-1">
              <Users className="w-4 h-4 text-gray-400" />
            </div>
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
      </div>

      {/* Manual mode: character picker */}
      {showPickerNow && (
        <div className="flex-shrink-0 border-t border-glass-border bg-dark-200/80 px-2 py-2">
          <p className="text-xs text-gray-500 mb-1.5 px-1">Choose who speaks next:</p>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {groupChat.members
              .filter(m => m.isActive)
              .map((m) => {
                const char = characters.get(m.characterId);
                if (!char) return null;
                return (
                  <button
                    key={m.characterId}
                    onClick={() => handleManualPick(m.characterId)}
                    disabled={isGenerating}
                    className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-dark-100 border border-glass-border hover:border-parlor-500/50 hover:bg-parlor-500/10 transition-colors disabled:opacity-40 flex-shrink-0"
                  >
                    <Avatar src={char.avatar} name={char.name} size="sm" />
                    <span className="text-xs text-gray-300 max-w-[60px] truncate">{char.name}</span>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="flex-shrink-0 border-t border-glass-border bg-dark-200/95 backdrop-blur-sm px-2 py-2 sm:p-3 safe-bottom">
        <div className="flex gap-1.5 sm:gap-3 items-stretch max-w-4xl mx-auto">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 min-w-0 resize-none rounded-xl bg-dark-100 border border-glass-border px-3 py-2.5 sm:px-4 sm:py-3 text-white placeholder-gray-500 focus:outline-none focus:border-parlor-500/50 focus:ring-1 focus:ring-parlor-500/30 text-base leading-6 auto-grow-input"
          />
          {isGenerating ? (
            <Button
              onClick={handleStop}
              variant="danger"
              className="self-end h-10 w-10 sm:h-12 sm:w-12 p-0 rounded-xl flex items-center justify-center flex-shrink-0"
            >
              <Square className="w-5 h-5" />
            </Button>
          ) : (
            <Button
              onClick={handleSend}
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
      </div>

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {showDeleteDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setShowDeleteDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass p-6 max-w-sm mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-medium text-white mb-2 font-serif tracking-tight">Delete Group Chat</h3>
              <p className="text-sm text-gray-500 mb-4">
                Are you sure you want to delete "{groupChat.name}"? This cannot be undone.
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setShowDeleteDialog(false)}>
                  Cancel
                </Button>
                <Button variant="danger" size="sm" onClick={handleDeleteChat}>
                  Delete
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default GroupChatPage;
