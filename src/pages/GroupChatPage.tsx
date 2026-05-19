import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
  RefreshCw,
  ChevronRight,
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
import { StatusPanel } from '../components/chat';
import type { CharacterStatus } from '../components/chat/StatusPanel';
import { extractStatusFromContent, stripStatusBlocks } from '../utils/prompts';
import { sanitizeFilename } from '../utils/fileExport';

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

    case 'sequential': {
      // All active members reply in sequence
      return {
        responders: active.map(m => m.characterId),
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
  responseLength?: 'short' | 'medium' | 'long',
): string {
  const base = buildSystemPrompt(character, persona, character.systemPrompt, preset, responseLength);

  // Append group context — mention other characters in the scene
  const others = members
    .filter(m => m.isActive && m.characterId !== character.id)
    .map(m => allCharacters.get(m.characterId))
    .filter(Boolean) as CharacterCard[];

  if (others.length === 0) return base;

  const otherNames = others.map(c => c.name).join(', ');

  // Use preset's group_nudge_prompt if available, substituting {{char}}, {{user}}, {{group}}
  const nudgeTemplate = preset?.group_nudge_prompt;
  let groupNote: string;
  if (nudgeTemplate) {
    groupNote = '\n\n' + nudgeTemplate
      .replace(/\{\{char\}\}/gi, character.name)
      .replace(/\{\{user\}\}/gi, persona?.name || 'User')
      .replace(/\{\{group\}\}/gi, otherNames);
  } else {
    groupNote = `\n\n## Group Chat Context\nYou are in a group conversation with: ${otherNames}. Respond ONLY as ${character.name}. Do NOT write dialogue or actions for the other characters.`;
  }

  return base + groupNote;
}

// ── Component ────────────────────────────────────────────────────────────────

export function GroupChatPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id: groupId } = useParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const apiClientRef = useRef<APIClient | null>(null);

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

  // Scroll tick — periodic increment during generation to keep scrolling smoothly
  const [scrollTick, setScrollTick] = useState(0);

  // Message editing state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Impersonation state
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonationCharId, setImpersonationCharId] = useState<string | null>(null);

  // Character status panel state
  const [characterStatuses, setCharacterStatuses] = useState<CharacterStatus[]>([]);
  const [statusPage, setStatusPage] = useState(0);

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

  // ── Poll scrollTick during generation to keep auto-scroll smooth ──────
  useEffect(() => {
    if (!isGenerating) return;
    const timer = setInterval(() => {
      setScrollTick(t => t + 1);
    }, 500);
    return () => clearInterval(timer);
  }, [isGenerating]);

  // ── Scroll behavior ─────────────────────────────────────────────────────

  const hasScrolledToBottom = useRef<string | null>(null);

  useEffect(() => {
    // 群聊切换时重置状态
    setCharacterStatuses([]);
    if (!isLoading && groupChat && hasScrolledToBottom.current !== groupChat.id) {
      hasScrolledToBottom.current = groupChat.id;
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
      });
    }
  }, [isLoading, groupChat?.id]);

  useEffect(() => {
    if (hasScrolledToBottom.current === groupChat?.id && settings?.autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [groupChat?.messages, isGenerating, scrollTick, settings?.autoScroll]);

  // ── Generation logic ────────────────────────────────────────────────────

  /** Generate a single character's response and return the message. */
  const generateForCharacter = async (
    character: CharacterCard,
    currentMessages: Message[],
    mentionedCharIds?: Set<string>,
  ): Promise<Message | null> => {
    if (!connection || !preset || !groupChat) return null;

    let systemPrompt = buildGroupSystemPrompt(character, characters, groupChat.members, persona, preset, settings?.responseLength);

    // Natural mode: restrict response to 3 sentences
    if (groupChat.turnMode === 'natural') {
      systemPrompt += '\n\n【回复限制】每次回复最多3句话，请简洁自然。';
    }

    // @mention: urged to respond
    if (mentionedCharIds?.has(character.id)) {
      systemPrompt += `\n\n【注意】用户专门提到了你（@${character.name}），请务必回应。`;
    }
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
      preset?.wi_format,
    );

    // 注入当前角色的状态信息（如果存在）
    const charStatus = characterStatuses.find(s => {
      const nameLine = s.infoLines.find(l => l.label === '姓名');
      return nameLine && nameLine.value === character.name;
    });
    if (charStatus) {
      const parts: string[] = [];
      if (charStatus.sceneHeader) {
        parts.push(`[场景信息]\n${charStatus.sceneHeader}`);
      }
      if (charStatus.infoLines.length > 0) {
        parts.push(`[角色信息]\n${charStatus.infoLines.map(l => `${l.label}: ${l.value}`).join('\n')}`);
      }
      if (charStatus.statusLines.length > 0) {
        parts.push(`[当前状态]\n${charStatus.statusLines.map(l => `${l.label}: ${l.value}`).join('\n')}`);
      }
      if (parts.length > 0) {
        apiMessages.push({
          role: 'system',
          content: `[当前状态参考]\n以下是当前已知的角色信息与状态，请基于此保持一致性：\n\n${parts.join('\n\n')}`,
        });
      }
    }

    const client = new APIClient(connection, preset, settings || undefined);
    apiClientRef.current = client;
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
  const runGeneration = async (responderIds: string[], messagesWithUser: Message[], mentionedCharIds?: Set<string>) => {
    if (!groupChat) return;
    setIsGenerating(true);

    try {
      let currentMessages = [...messagesWithUser];

      for (const charId of responderIds) {
        const char = characters.get(charId);
        if (!char) continue;

        const msg = await generateForCharacter(char, currentMessages, mentionedCharIds);
        if (msg) {
          currentMessages = [...currentMessages, msg];
          // Persist incrementally
          const updated = { ...groupChat, messages: currentMessages, updatedAt: Date.now() };
          await groupChatOps.update(groupChat.id, { messages: currentMessages });
          setGroupChat(updated);
        }
      }
    } catch (e) {
      console.error('[GroupChatPage] runGeneration failed:', e);
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Send user message ───────────────────────────────────────────────────

  const handleSend = async () => {
    if (!inputValue.trim() || !groupChat || isSending) return;
    if (!connection || !preset) {
      navigate('/settings');
      return;
    }

    setIsSending(true);
    try {
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
        return;
      }

      // ── @mention parsing ──────────────────────────────────────────────────
      const mentionRegex = /@([^\s，,。！？、\n]+)/g;
      const mentionedNames: string[] = [];
      let mentionMatch;
      while ((mentionMatch = mentionRegex.exec(userContent)) !== null) {
        mentionedNames.push(mentionMatch[1].trim());
      }

      const mentionedCharIds = new Set<string>();
      if (mentionedNames.length > 0) {
        for (const [charId, char] of characters.entries()) {
          if (mentionedNames.includes(char.name)) {
            mentionedCharIds.add(charId);
          }
        }
      }
      // ── @mention parsing end ──────────────────────────────────────────────

      // Determine responders
      let { responders, nextTurnIndex } = pickResponders(
        groupChat.members,
        characters,
        groupChat.turnMode,
        groupChat.currentTurnIndex ?? 0,
      );

      // Force @mentioned characters into the responder list
      if (mentionedCharIds.size > 0) {
        for (const charId of mentionedCharIds) {
          if (!responders.includes(charId)) {
            responders.push(charId);
          }
        }
      }

      // Update turn index (only used by 'list' and 'turn' modes)
      if (nextTurnIndex !== (groupChat.currentTurnIndex ?? 0)) {
        await groupChatOps.update(groupChat.id, { currentTurnIndex: nextTurnIndex });
      }

      await runGeneration(responders, updatedMessages, mentionedCharIds);
    } catch (e) {
      console.error('[GroupChatPage] Send failed:', e);
    } finally {
      setIsSending(false);
    }
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
    apiClientRef.current?.abort();
    apiClientRef.current = null;
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

  // ── Message editing ──────────────────────────────────────────────────────

  const handleEditMessage = useCallback((msgId: string) => {
    const msg = groupChat?.messages.find(m => m.id === msgId);
    if (!msg) return;
    setEditingMessageId(msgId);
    setEditContent(msg.content);
  }, [groupChat]);

  const handleSaveEdit = useCallback(async () => {
    if (!groupChat || !editingMessageId || !editContent.trim()) return;
    const updated = groupChat.messages.map(m =>
      m.id === editingMessageId ? { ...m, content: editContent } : m
    );
    await groupChatOps.update(groupChat.id, { messages: updated });
    setGroupChat({ ...groupChat, messages: updated, updatedAt: Date.now() });
    setEditingMessageId(null);
    setEditContent('');
  }, [groupChat, editingMessageId, editContent]);

  // ── Regenerate ────────────────────────────────────────────────────────────

  const handleRegenerate = useCallback(async (msg: Message) => {
    if (!groupChat) return;
    const idx = groupChat.messages.findIndex(m => m.id === msg.id);
    if (idx === -1) return;
    const truncated = groupChat.messages.slice(0, idx);
    await groupChatOps.update(groupChat.id, { messages: truncated });
    setGroupChat({ ...groupChat, messages: truncated, updatedAt: Date.now() });

    const char = characters.get(msg.characterId || '');
    if (!char) return;

    setIsGenerating(true);
    const newMsg = await generateForCharacter(char, truncated);
    if (newMsg) {
      const updated = [...truncated, newMsg];
      await groupChatOps.update(groupChat.id, { messages: updated });
      setGroupChat({ ...groupChat, messages: updated, updatedAt: Date.now() });
    }
    setIsGenerating(false);
  }, [groupChat, characters]);

  // ── Continue generation ────────────────────────────────────────────────────

  const handleContinue = useCallback(async () => {
    if (!groupChat) return;

    const messages = groupChat.messages;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant' || !lastMsg.characterId) return;

    const continueChar = characters.get(lastMsg.characterId);
    if (!continueChar) return;

    setIsGenerating(true);

    try {
      // Reuse generateForCharacter with messages excluding the last one,
      // then append the result to the last message instead of creating a new one
      const result = await generateForCharacter(continueChar, messages.slice(0, -1));

      if (result && result.content.trim()) {
        const updatedMessages = messages.map((msg, idx) =>
          idx === messages.length - 1
            ? { ...msg, content: msg.content + '\n' + result.content.trim() }
            : msg
        );
        await groupChatOps.update(groupChat.id, { messages: updatedMessages });
        setGroupChat(prev => prev ? { ...prev, messages: updatedMessages, updatedAt: Date.now() } : prev);
      }
    } catch (e: any) {
      console.error('Continue generation failed:', e);
    } finally {
      setIsGenerating(false);
    }
  }, [groupChat, characters]);

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

  // ── Session aggregated metadata from responseMeta ──────────────────────

  const sessionMeta = useMemo(() => {
    if (!groupChat?.messages) return null;
    const msgs = groupChat.messages.filter(m => m.responseMeta);
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
  }, [groupChat?.messages]);

  // ── Extract character status from the last assistant message ──────────
  useEffect(() => {
    if (!groupChat?.messages) return;
    const lastMsg = groupChat.messages[groupChat.messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant') return;

    const { sceneHeader, infoLines, statusLines } = extractStatusFromContent(lastMsg.content, settings?.statusFieldConfig);
    if (infoLines.length > 0 || statusLines.length > 0) {
      setCharacterStatuses(prev => {
        const updated = [...prev];
        const char = lastMsg.characterId ? characters.get(lastMsg.characterId) : null;
        const name = char?.name || '角色';
        const existing = updated.findIndex(s => {
          const nameMatch = s.infoLines.find(l => l.label === '姓名');
          return nameMatch && nameMatch.value === name;
        });
        const newStatus: CharacterStatus = { sceneHeader, infoLines, statusLines };
        if (existing >= 0) {
          // 合并更新：保留旧状态中未被新状态覆盖的字段
          const oldStatus = updated[existing];

          // 合并状态行
          const mergedLines = [...(newStatus.statusLines || [])];
          const oldLines = oldStatus.statusLines || [];
          for (const oldLine of oldLines) {
            const exists = mergedLines.some(l => l.label === oldLine.label);
            if (!exists) mergedLines.push(oldLine);
          }

          // 合并角色信息
          const mergedInfo = [...(newStatus.infoLines || [])];
          const oldInfo = oldStatus.infoLines || [];
          for (const oldLine of oldInfo) {
            const exists = mergedInfo.some(l => l.label === oldLine.label);
            if (!exists) mergedInfo.push(oldLine);
          }

          updated[existing] = {
            sceneHeader: newStatus.sceneHeader || oldStatus.sceneHeader,
            infoLines: mergedInfo,
            statusLines: mergedLines,
          };
        } else {
          updated.push(newStatus);
        }
        return updated;
      });
      setStatusPage(0);
    }
  }, [groupChat?.messages]);

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
    a.download = `${sanitizeFilename(groupChat.name)}.txt`;
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
        <p className="text-gray-400">{t('groups.notFound')}</p>
        <Button className="mt-4" onClick={() => navigate('/chats')}>
          {t('groups.backToChats')}
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
                  {t('groups.membersAndMessages', { members: groupChat.members.length, messages: groupChat.messages.length })}
                </p>
                {sessionMeta && (
                  <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                    <span>🪙 {sessionMeta.totalTokens.toLocaleString()} tokens</span>
                    <span>⏱ 当前 {(sessionMeta.currentTimeMs / 1000).toFixed(1)}s / 总计 {(sessionMeta.totalTimeMs / 1000).toFixed(1)}s</span>
                  </div>
                )}
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
                          navigate(`/groups/${groupChat.id}/edit`);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:text-white hover:bg-glass-white flex items-center gap-2"
                      >
                        <Edit3 className="w-4 h-4" />
                        {t('groups.editGroup')}
                      </button>
                      <button
                        onClick={() => {
                          setShowActionsMenu(false);
                          navigate(`/groups/${groupChat.id}/edit`);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:text-white hover:bg-glass-white flex items-center gap-2"
                      >
                        <Users className="w-4 h-4" />
                        {t('groups.manageMembers')}
                      </button>
                      <button
                        onClick={() => {
                          setShowActionsMenu(false);
                          navigate('/chats');
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:text-white hover:bg-glass-white flex items-center gap-2"
                      >
                        <FolderOpen className="w-4 h-4" />
                        {t('groups.allChats')}
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
                        {t('groups.exportText')}
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
                        {t('groups.deleteGroupChat')}
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Content + Status Panel Row */}
      <div className="flex flex-1 overflow-hidden">
        {/* Inner column: messages + controls */}
        <div className="flex-1 flex flex-col overflow-hidden">

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-2 sm:space-y-3">
        {groupChat.messages.map((message) => {
          const isUser = message.role === 'user';
          const char = getCharacterForMessage(message);
          const displayContent = message.role === 'assistant' ? stripStatusBlocks(message.content) : message.content;

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
                  {editingMessageId === message.id ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full bg-dark-200 border border-glass-border rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-parlor-500/50 min-h-[80px]"
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => { setEditingMessageId(null); setEditContent(''); }}
                          className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded-md bg-dark-200"
                        >
                          {t('common.cancel')}
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          className="text-xs text-white px-2 py-1 rounded-md bg-parlor-600 hover:bg-parlor-500"
                        >
                          {t('common.save')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-200 whitespace-pre-wrap break-words prose prose-invert prose-sm max-w-none text-[13px] leading-relaxed sm:text-sm">
                      <RpContent content={displayContent} />
                    </div>
                  )}

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
                      title={t('common.copy')}
                    >
                      <Edit3 className="w-4 h-4 text-gray-400" />
                    </button>
                    {message.role === 'assistant' && (
                      <button
                        onClick={() => handleRegenerate(message)}
                        className="p-1.5 rounded-lg bg-dark-100 hover:bg-dark-50"
                        title={t('chat.regenerate')}
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                    )}
                    <button
                      onClick={() => handleEditMessage(message.id)}
                      className="p-1.5 rounded-lg bg-dark-100 hover:bg-dark-50"
                      title={t('common.edit')}
                    >
                      <Edit3 className="w-4 h-4 text-parlor-400" />
                    </button>
                    <button
                      onClick={() => handleDeleteMessage(message.id)}
                      className="p-1.5 rounded-lg bg-dark-100 hover:bg-dark-50"
                      title={t('common.delete')}
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
          <p className="text-xs text-gray-500 mb-1.5 px-1">{t('groups.chooseSpeaker')}</p>
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

      {/* Impersonation bar */}
      {isImpersonating && (
        <div className="flex-shrink-0 border-t border-glass-border bg-dark-200/80 px-2 py-2">
          <div className="flex items-center gap-2 max-w-4xl mx-auto">
            <span className="text-xs text-gray-500 whitespace-nowrap">{t('groups.impersonatingAs')}</span>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide flex-1">
              {groupChat.members
                .filter(m => m.isActive)
                .map((m) => {
                  const char = characters.get(m.characterId);
                  if (!char) return null;
                  const isSelected = impersonationCharId === m.characterId;
                  return (
                    <button
                      key={m.characterId}
                      onClick={() => setImpersonationCharId(m.characterId)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors flex-shrink-0 ${
                        isSelected
                          ? 'bg-parlor-600/20 border-parlor-500/50 text-parlor-300'
                          : 'bg-dark-100 border-glass-border text-gray-400 hover:text-white hover:border-parlor-500/30'
                      }`}
                    >
                      <Avatar src={char.avatar} name={char.name} size="xs" />
                      {char.name}
                    </button>
                  );
                })}
            </div>
            <button
              onClick={() => { setIsImpersonating(false); setImpersonationCharId(null); }}
              className="text-xs text-gray-500 hover:text-white px-2 py-1 rounded-md bg-dark-100 border border-glass-border flex-shrink-0"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* 继续生成按钮 */}
      {!isGenerating && groupChat.messages.length > 0 && 
       groupChat.messages[groupChat.messages.length - 1]?.role === 'assistant' && (
        <div className="flex justify-center py-1 border-t border-glass-border">
          <button
            onClick={handleContinue}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-parlor-400 bg-dark-100/50 hover:bg-dark-100 border border-glass-border rounded-full px-3 py-1.5 transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5 rotate-90" />
            {t('chat.continueGeneration')}
          </button>
        </div>
      )}

      {/* Input Area */}
      <div className="flex-shrink-0 border-t border-glass-border bg-dark-200/95 backdrop-blur-sm px-2 py-2 sm:p-3 safe-bottom">
        <div className="flex gap-1.5 sm:gap-3 items-end max-w-4xl mx-auto">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={isImpersonating ? t('groups.impersonatePlaceholder', { name: characters.get(impersonationCharId || '')?.name || '' }) : t('groups.typeMessage')}
            className="flex-1 min-w-0 resize-none rounded-xl bg-dark-100 border border-glass-border px-3 py-2.5 sm:px-4 sm:py-3 text-white placeholder-gray-500 focus:outline-none focus:border-parlor-500/50 focus:ring-1 focus:ring-parlor-500/30 text-base leading-6 auto-grow-input"
          />
          {isGenerating ? (
            <Button
              onClick={handleStop}
              variant="danger"
              className="h-10 w-10 sm:h-12 sm:w-12 p-0 rounded-xl flex items-center justify-center flex-shrink-0"
            >
              <Square className="w-5 h-5" />
            </Button>
          ) : (
            <div className="flex gap-1.5 sm:gap-2 flex-shrink-0">
              {!isImpersonating ? (
                <Button
                  onClick={() => setIsImpersonating(true)}
                  variant="ghost"
                  className="h-10 w-10 sm:h-12 sm:w-12 p-0 rounded-xl flex items-center justify-center hover:text-parlor-300"
                  title={t('chat.impersonate')}
                >
                  <Edit3 className="w-4 h-4 text-gray-400" />
                </Button>
              ) : (
                <Button
                  onClick={async () => {
                    if (!inputValue.trim() || !groupChat || !impersonationCharId || isSending) return;
                    setIsSending(true);
                    const content = inputValue.trim();
                    setInputValue('');

                    const impersonatedMsg: Message = {
                      id: generateUUID(),
                      role: 'assistant',
                      content,
                      timestamp: Date.now(),
                      characterId: impersonationCharId,
                    };

                    const updatedMessages = [...groupChat.messages, impersonatedMsg];
                    await groupChatOps.update(groupChat.id, { messages: updatedMessages });
                    setGroupChat({ ...groupChat, messages: updatedMessages, updatedAt: Date.now() });
                    setIsSending(false);
                    setIsImpersonating(false);
                    setImpersonationCharId(null);
                  }}
                  disabled={!inputValue.trim() || !impersonationCharId || isSending}
                  className="h-10 w-10 sm:h-12 sm:w-12 p-0 rounded-xl flex items-center justify-center flex-shrink-0"
                  title={t('groups.sendImpersonated')}
                >
                  {isSending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </Button>
              )}
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim() || isSending || isImpersonating}
                className="h-10 w-10 sm:h-12 sm:w-12 p-0 rounded-xl flex items-center justify-center bg-parlor-500 hover:bg-parlor-400 shadow-lg shadow-parlor-500/20"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
          )}
        </div>
      </div>
        </div> {/* End inner column */}

        {/* Right Status Panel — always visible */}
        <StatusPanel
          statuses={characterStatuses}
          currentPage={statusPage}
          onPageChange={setStatusPage}
        />
      </div> {/* End content + status panel row */}

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
              <h3 className="text-lg font-medium text-white mb-2 font-serif tracking-tight">{t('groups.deleteGroupChat')}</h3>
              <p className="text-sm text-gray-500 mb-4">
                {t('groups.deleteConfirm', { name: groupChat.name })}
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setShowDeleteDialog(false)}>
                  {t('groups.cancel')}
                </Button>
                <Button variant="danger" size="sm" onClick={handleDeleteChat}>
                  {t('groups.delete')}
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
