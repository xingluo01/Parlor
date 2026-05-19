import { useRef, useCallback } from 'react';
import { generateUUID } from '../utils/uuid';
import { APIClient, buildSystemPrompt, buildMessages, buildDepthInjections } from '../services/api';
import type { DepthInjection } from '../utils/presetImport';
import { chatOps, regexOps, worldInfoOps } from '../db';
import { useChatStore } from '../stores';
import type { CharacterCard, ChatSession, Message, ConnectionProfile, Preset, Persona, AppSettings, RegexScript, ChatCompletionRequest } from '../types';
import { CONTINUE_INSTRUCTION } from '../utils/prompts';
import { storeEmbedding, searchSimilar } from '../services/vectorStore';
import { getCombinedAuthorNotePresets } from '../services/apiClient';
import type { CharacterStatus } from '../components/chat/StatusPanel';

function applyRegexScripts(text: string, scripts: RegexScript[], target: 'input' | 'output'): string {
  return scripts
    .filter(s => s.applyTo === target || s.applyTo === 'both')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .reduce((result, script) => {
      try {
        // Deduplicate flags to avoid SyntaxError (e.g. 'gg' when script.flags includes 'g')
        const flags = new Set(('g' + (script.flags || '')).split(''));
        const regex = new RegExp(script.findRegex, [...flags].join(''));
        return result.replace(regex, script.replaceString);
      } catch {
        console.warn(`Regex script "${script.name}" has invalid pattern, skipping.`);
        return result;
      }
    }, text);
}

/** Shared helper: builds API messages from character, preset, chat state, and lorebook data. */
async function buildApiRequest(
  character: CharacterCard,
  persona: Persona | null,
  preset: Preset,
  contextSize: number,
  activeChat: ChatSession,
  messages: Message[],
  vectorEnabled?: boolean,
  translateLanguage?: string,
  responseLength?: 'short' | 'medium' | 'long',
  statusInfo?: CharacterStatus | null,
) {
  const systemPrompt = buildSystemPrompt(character, persona, character.systemPrompt, preset, responseLength);

  // ---- 关联角色信息注入 ----
  let relatedCharactersText = '';
  if (character.relations?.length) {
    try {
      const priority: Record<string, number> = {
        '情侣': 0, '家人': 1, '好友': 2, '师徒': 3,
        '师生': 4, '主仆': 5, '同门': 6, '敌对': 7, '其他': 8
      };
      const topRelations = [...character.relations]
        .sort((a, b) => (priority[a.relationType] ?? 9) - (priority[b.relationType] ?? 9))
        .slice(0, 3);

      if (topRelations.length > 0) {
        const relatedCards = await Promise.all(
          topRelations.map(rel =>
            fetch(`/api/characters/${rel.targetId}`)
              .then(r => r.ok ? r.json() : null)
              .catch(() => null)
          )
        );

        const infoParts: string[] = [];
        for (let i = 0; i < topRelations.length; i++) {
          const card = relatedCards[i];
          if (!card) continue;
          const rel = topRelations[i];
          infoParts.push(
            `【${card.name}】关系：${rel.relationType}${rel.summary ? `（${rel.summary}）` : ''}\n` +
            `  描述：${(card.description || '无').slice(0, 200)}`
          );
        }

        if (infoParts.length > 0) {
          relatedCharactersText = '\n\n## 相关角色信息\n你和以下角色存在关联关系，在对话中请注意这些关系，适时提及：\n' + infoParts.join('\n\n');
        }
      }
    } catch (e) {
      console.debug('[RelationInject] Failed to load related characters:', e);
    }
  }

  const presetInjections = buildDepthInjections(character, persona, character.systemPrompt, preset);
  const allDepthInjections: DepthInjection[] = [...presetInjections];

  // 获取作者备注内容：优先使用 chat 的设置，其次 fallback 到启用的预设组合
  let authorNoteContent = activeChat.authorNote?.trim();
  if (!authorNoteContent) {
    try {
      authorNoteContent = await getCombinedAuthorNotePresets();
    } catch {
      // 静默失败
    }
  }
  if (authorNoteContent) {
    allDepthInjections.push({
      content: `[CRITICAL INSTRUCTION — You MUST follow this]\n${authorNoteContent}`,
      role: 'system',
      depth: 0,
    });
  }
  allDepthInjections.sort((a, b) => b.depth - a.depth);

  const allBooks = await worldInfoOps.getAll();
  const enabledIds = activeChat.enabledWorldInfoIds;
  const enabledBooks = allBooks.filter(b => {
    if (!b.enabled) return false;
    if (enabledIds === undefined) return true;
    return enabledIds.includes(b.id);
  });

  const allLorebookEntries = [
    ...(character.characterBook?.entries ?? []),
    ...enabledBooks.flatMap(b => b.entries),
  ];

  // Retrieve relevant past messages via vector search if enabled
  let vectorContext = '';
  if (vectorEnabled) {
    try {
      const recentTexts = messages.slice(-3).map(m => m.content);
      const results = await searchSimilar(activeChat.id, recentTexts, 5);
      if (results.length > 0) {
        vectorContext = results.map(r => r.text).join('\n---\n');
      }
    } catch { /* non-critical */ }
  }

  const effectiveSummary = vectorContext
    ? [activeChat.summary, `[Relevant context from earlier]\n${vectorContext}`].filter(Boolean).join('\n\n')
    : activeChat.summary;

  const apiMessages = buildMessages(systemPrompt + relatedCharactersText, messages, contextSize, allLorebookEntries, allDepthInjections, effectiveSummary, preset.wi_format);

  const enabledScripts = await regexOps.getEnabled();

  // Apply input regex to the last user message
  let lastUserIdx = -1;
  for (let i = apiMessages.length - 1; i >= 0; i--) {
    if (apiMessages[i].role === 'user') { lastUserIdx = i; break; }
  }
  if (lastUserIdx !== -1) {
    apiMessages[lastUserIdx] = {
      ...apiMessages[lastUserIdx],
      content: applyRegexScripts(apiMessages[lastUserIdx].content, enabledScripts, 'input'),
    };
  }

  // Inject translation instruction if enabled
  if (translateLanguage) {
    apiMessages.push({
      role: 'system',
      content: `[Important: The user speaks ${translateLanguage}. You MUST respond in ${translateLanguage}. Keep character names and special terms untranslated.]`,
    });
  }



  // 状态约束：嵌入最后一条 user 消息末尾（对 DeepSeek 效果远好于 system 消息注入）
  if (statusInfo && lastUserIdx !== -1) {
    const blockParts: string[] = [];
    const scenes: string[] = [];
    if (statusInfo.sceneHeader) scenes.push(statusInfo.sceneHeader);
    if (statusInfo.infoLines.length > 0) {
      blockParts.push(statusInfo.infoLines.map(l => `${l.label}: ${l.value}`).join('\n'));
    }
    if (statusInfo.statusLines.length > 0) {
      blockParts.push(statusInfo.statusLines.map(l => `${l.label}: ${l.value}`).join('\n'));
    }
    const statusBlock = blockParts.length > 0
      ? `${scenes.length > 0 ? scenes.join(' | ') + '\n' : ''}${blockParts.join('\n')}`
      : (scenes.length > 0 ? scenes.join(' | ') : '');
    if (statusBlock) {
      apiMessages[lastUserIdx] = {
        ...apiMessages[lastUserIdx],
        content: apiMessages[lastUserIdx].content +
          `\n\n[STATUS REFERENCE — Current known state]\n${statusBlock}\n` +
          `[END STATUS — You MUST output an updated [STATUS] block at the end of your response reflecting the new state after this exchange]`,
      };
    }
  }
  return { apiMessages, enabledScripts };
}

interface UseChatGenerationOptions {
  activeChat: ChatSession | null;
  character: CharacterCard | null;
  connection: ConnectionProfile | null;
  preset: Preset | null;
  persona: Persona | null;
  settings: AppSettings | null;
  contextSize: number;
}

export function useChatGeneration({
  activeChat,
  character,
  connection,
  preset,
  persona,
  settings,
  contextSize,
}: UseChatGenerationOptions) {
  const updateChat = useChatStore(s => s.updateChat);
  const isStreaming = useChatStore(s => s.isStreaming);
  const setIsStreaming = useChatStore(s => s.setIsStreaming);
  const isImpersonating = useChatStore(s => s.isImpersonating);
  const setIsImpersonating = useChatStore(s => s.setIsImpersonating);
  const regeneratingMessageId = useChatStore(s => s.regeneratingMessageId);
  const setRegeneratingMessageId = useChatStore(s => s.setRegeneratingMessageId);
  const streamingContent = useChatStore(s => s.streamingContent);
  const appendStreamingContent = useChatStore(s => s.appendStreamingContent);
  const clearStreamingContent = useChatStore(s => s.clearStreamingContent);
  const streamingReasoning = useChatStore(s => s.streamingReasoning);
  const appendStreamingReasoning = useChatStore(s => s.appendStreamingReasoning);
  const clearStreamingReasoning = useChatStore(s => s.clearStreamingReasoning);
  const apiClientRef = useRef<APIClient | null>(null);
  const continueRef = useRef<() => void>(() => {});
  const impersonateCallbackRef = useRef<((text: string) => void) | null>(null);
  const lastPromptRef = useRef<ChatCompletionRequest['messages'] | null>(null);

  // Get effective preset with parameter overrides applied
  const getEffectivePreset = useCallback(() => {
    if (!preset) return preset;
    const chatOverrides = activeChat?.parameterOverrides;
    if (!chatOverrides) return preset;

    const effective = { ...preset };
    if (chatOverrides.temperature !== undefined) effective.temperature = chatOverrides.temperature;
    if (chatOverrides.topP !== undefined) effective.topP = chatOverrides.topP;
    if (chatOverrides.topK !== undefined) effective.topK = chatOverrides.topK;
    if (chatOverrides.minP !== undefined) effective.minP = chatOverrides.minP;
    if (chatOverrides.frequencyPenalty !== undefined) effective.frequencyPenalty = chatOverrides.frequencyPenalty;
    if (chatOverrides.presencePenalty !== undefined) effective.presencePenalty = chatOverrides.presencePenalty;
    if (chatOverrides.maxTokens !== undefined) effective.maxTokens = chatOverrides.maxTokens;
    if (chatOverrides.reasoningMode !== undefined) effective.reasoningMode = chatOverrides.reasoningMode;
    if (chatOverrides.reasoningEffort !== undefined) effective.reasoningEffort = chatOverrides.reasoningEffort;
    if (chatOverrides.reasoningBudgetTokens !== undefined) effective.reasoningBudgetTokens = chatOverrides.reasoningBudgetTokens;
    return effective;
  }, [preset, activeChat?.parameterOverrides]);

  const getEffectiveContextSize = useCallback(() => {
    return activeChat?.parameterOverrides?.contextSize ?? contextSize;
  }, [activeChat?.parameterOverrides?.contextSize, contextSize]);

  // Silently generates a chat title after the first exchange
  const generateChatTitle = useCallback(async (
    chatId: string,
    userMessage: string,
    aiResponse: string,
  ) => {
    if (!connection || !preset) return;
    try {
      const titlePreset = { ...preset, maxTokens: 20, temperature: 0.7 };
      const titleClient = new APIClient(connection, titlePreset, undefined);
      const title = await titleClient.complete([{
        role: 'user',
        content: `Write a short title (3-5 words) for a roleplay chat that begins:\nUser: "${userMessage.slice(0, 300)}"\nAssistant: "${aiResponse.slice(0, 300)}"\nReply with ONLY the title, no quotes or punctuation at the end.`,
      }]);
      const clean = title.trim().replace(/^["'`]|["'`]$/g, '').trim();
      if (clean && clean.length <= 80) {
        await chatOps.update(chatId, { title: clean });
        updateChat(chatId, { title: clean });
      }
    } catch {
      // Non-critical — silently skip on failure
    }
  }, [connection, preset, updateChat]);

  const generateResponse = useCallback(async (messages: Message[], statusInfo?: CharacterStatus | null) => {
    if (!connection || !preset || !character || !activeChat) return;

    // Abort any in-progress generation before starting a new one
    if (apiClientRef.current) {
      apiClientRef.current.abort();
      apiClientRef.current = null;
    }

    clearStreamingContent();
    clearStreamingReasoning();
    setIsStreaming(true);

    const effectivePreset = getEffectivePreset()!;
    const client = new APIClient(connection, effectivePreset, settings || undefined);
    apiClientRef.current = client;

    const chatId = activeChat.id;
    const { apiMessages, enabledScripts } = await buildApiRequest(
      character, persona, effectivePreset, getEffectiveContextSize(), activeChat, messages, settings?.vectorStoreEnabled, settings?.translateLanguage, settings?.responseLength, statusInfo,
    );

    lastPromptRef.current = apiMessages;

    const startTime = Date.now();
    try {
      if (settings?.streamResponses !== false) {
        await client.streamCompletion(
          apiMessages,
          (chunk) => appendStreamingContent(chunk),
          async (completeResponse, reasoning, finishReason, usage) => {
            const responseTimeMs = Date.now() - startTime;
            const processedContent = applyRegexScripts(completeResponse, enabledScripts, 'output');

            // Guard against empty API responses — don't save empty messages
            if (!processedContent.trim()) {
              console.warn('API returned empty response');
              setIsStreaming(false);
              clearStreamingContent();
              clearStreamingReasoning();

              // Show an error message so the user knows something went wrong
              const errorMessage: Message = {
                id: generateUUID(),
                role: 'assistant',
                content: '[Error] The API returned an empty response. Try generating again.',
                timestamp: Date.now(),
              };
              const latestChat = useChatStore.getState().activeChat;
              const currentMessages = latestChat?.id === chatId ? latestChat.messages : messages;
              const finalMessages = [...currentMessages, errorMessage];
              await chatOps.update(chatId, { messages: finalMessages });
              updateChat(chatId, { messages: finalMessages });
              return;
            }

            const assistantMessage: Message = {
              id: generateUUID(),
              role: 'assistant',
              content: processedContent,
              timestamp: Date.now(),
              reasoning,
              responseMeta: usage ? {
                promptTokens: usage.prompt_tokens,
                completionTokens: usage.completion_tokens,
                totalTokens: usage.total_tokens,
                responseTimeMs,
                finishReason,
              } : finishReason ? {
                responseTimeMs,
                finishReason,
              } : { responseTimeMs },
            };

            // Use latest messages from store to avoid stale closure
            const latestChat = useChatStore.getState().activeChat;
            const currentMessages = latestChat?.id === chatId ? latestChat.messages : messages;
            const finalMessages = [...currentMessages, assistantMessage];
            await chatOps.update(chatId, { messages: finalMessages });
            updateChat(chatId, { messages: finalMessages });

            // Background vectorize new message if enabled
            if (settings?.vectorStoreEnabled) {
              storeEmbedding(chatId, assistantMessage.id, processedContent).catch(console.error);
            }

            // Auto-generate a title on the first exchange if none exists yet
            const userMessages = currentMessages.filter(m => m.role === 'user');
            if (!activeChat.title && userMessages.length === 1) {
              generateChatTitle(chatId, userMessages[0].content, processedContent);
            }

            // Auto-summarize if enabled and threshold reached
            const interval = settings?.autoSummarizeInterval ?? 20;
            if (settings?.autoSummarize && interval > 0) {
              const summaryUpTo = activeChat.summaryUpToIndex ?? 0;
              const messagesSinceSummary = finalMessages.length - summaryUpTo;
              if (messagesSinceSummary >= interval) {
                // Fire-and-forget — don't block chat flow
                summarizeChat(chatId, finalMessages).catch(console.error);
              }
            }

            // Browser notification when tab is hidden
            if (settings?.notifyOnComplete && document.hidden && Notification.permission === 'granted') {
              const preview = processedContent.replace(/<[^>]+>/g, '').trim().slice(0, 80);
              new Notification(character.name, {
                body: preview || 'Response ready.',
                icon: character.avatar || undefined,
              });
            }

            setIsStreaming(false);
            clearStreamingContent();
            clearStreamingReasoning();

            // Auto-continue if the response was truncated by token limit
            if (finishReason === 'length' && settings?.autoContinue) {
              setTimeout(() => continueRef.current(), 500);
            }
          },
          (error) => {
            console.error('API Error:', error);
            const errorMessage: Message = {
              id: generateUUID(),
              role: 'assistant',
            content: `[Error] Failed to generate response: ${error instanceof Error ? error.message : String(error)}`,
              timestamp: Date.now(),
            };

            const latestChat = useChatStore.getState().activeChat;
            const currentMessages = latestChat?.id === chatId ? latestChat.messages : messages;
            const finalMessages = [...currentMessages, errorMessage];
            chatOps.update(chatId, { messages: finalMessages }).catch(console.error);
            updateChat(chatId, { messages: finalMessages });

            setIsStreaming(false);
            clearStreamingContent();
            clearStreamingReasoning();
          },
          (reasoningChunk) => appendStreamingReasoning(reasoningChunk),
        );
      } else {
        try {
          const fullText = await client.complete(apiMessages);
          const processedContent = applyRegexScripts(fullText, enabledScripts, 'output');
          const responseTimeMs = Date.now() - startTime;

          // Guard against empty API responses — don't save empty messages
          if (!processedContent.trim()) {
            console.warn('API returned empty response');
            setIsStreaming(false);
            clearStreamingContent();
            clearStreamingReasoning();

            // Show an error message so the user knows something went wrong
            const errorMessage: Message = {
              id: generateUUID(),
              role: 'assistant',
              content: '[Error] The API returned an empty response. Try generating again.',
              timestamp: Date.now(),
            };
            const latestChat = useChatStore.getState().activeChat;
            const currentMessages = latestChat?.id === chatId ? latestChat.messages : messages;
            const finalMessages = [...currentMessages, errorMessage];
            await chatOps.update(chatId, { messages: finalMessages });
            updateChat(chatId, { messages: finalMessages });
            return;
          }

          const assistantMessage: Message = {
            id: generateUUID(),
            role: 'assistant',
            content: processedContent,
            timestamp: Date.now(),
            reasoning: '',
            responseMeta: {
              responseTimeMs,
              finishReason: 'stop',
            },
          };

          // Use latest messages from store to avoid stale closure
          const latestChat = useChatStore.getState().activeChat;
          const currentMessages = latestChat?.id === chatId ? latestChat.messages : messages;
          const finalMessages = [...currentMessages, assistantMessage];
          await chatOps.update(chatId, { messages: finalMessages });
          updateChat(chatId, { messages: finalMessages });

          // Background vectorize new message if enabled
          if (settings?.vectorStoreEnabled) {
            storeEmbedding(chatId, assistantMessage.id, processedContent).catch(console.error);
          }

          // Auto-generate a title on the first exchange if none exists yet
          const userMessages = currentMessages.filter(m => m.role === 'user');
          if (!activeChat.title && userMessages.length === 1) {
            generateChatTitle(chatId, userMessages[0].content, processedContent);
          }

          // Auto-summarize if enabled and threshold reached
          const interval = settings?.autoSummarizeInterval ?? 20;
          if (settings?.autoSummarize && interval > 0) {
            const summaryUpTo = activeChat.summaryUpToIndex ?? 0;
            const messagesSinceSummary = finalMessages.length - summaryUpTo;
            if (messagesSinceSummary >= interval) {
              // Fire-and-forget — don't block chat flow
              summarizeChat(chatId, finalMessages).catch(console.error);
            }
          }

          // Browser notification when tab is hidden
          if (settings?.notifyOnComplete && document.hidden && Notification.permission === 'granted') {
            const preview = processedContent.replace(/<[^>]+>/g, '').trim().slice(0, 80);
            new Notification(character.name, {
              body: preview || 'Response ready.',
              icon: character.avatar || undefined,
            });
          }

          setIsStreaming(false);
          clearStreamingContent();
          clearStreamingReasoning();
        } catch (error) {
          console.error('API Error:', error);
          const errorMessage: Message = {
            id: generateUUID(),
            role: 'assistant',
            content: `[Error] Failed to generate response: ${error instanceof Error ? error.message : String(error)}`,
            timestamp: Date.now(),
          };

          const latestChat = useChatStore.getState().activeChat;
          const currentMessages = latestChat?.id === chatId ? latestChat.messages : messages;
          const finalMessages = [...currentMessages, errorMessage];
          chatOps.update(chatId, { messages: finalMessages }).catch(console.error);
          updateChat(chatId, { messages: finalMessages });

          setIsStreaming(false);
          clearStreamingContent();
          clearStreamingReasoning();
        }
      }
    } catch (error) {
      console.error('Failed to generate:', error);
      setIsStreaming(false);
      clearStreamingContent();
      clearStreamingReasoning();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, preset, character, activeChat, persona, settings, getEffectivePreset, getEffectiveContextSize, updateChat, setIsStreaming, appendStreamingContent, clearStreamingContent, clearStreamingReasoning, appendStreamingReasoning, generateChatTitle]);

  const regenerateResponse = useCallback(async (messageId: string, statusInfo?: CharacterStatus | null) => {
    if (!activeChat || !connection || !preset || !character) return;

    const messageIndex = activeChat.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1 || activeChat.messages[messageIndex].role !== 'assistant') return;

    const messagesBeforeResponse = activeChat.messages.slice(0, messageIndex);

    // Abort any in-progress generation
    if (apiClientRef.current) {
      apiClientRef.current.abort();
      apiClientRef.current = null;
    }

    clearStreamingContent();
    clearStreamingReasoning();
    setRegeneratingMessageId(messageId);
    setIsStreaming(true);

    const effectivePreset = getEffectivePreset()!;
    const client = new APIClient(connection, effectivePreset, settings || undefined);
    apiClientRef.current = client;

    const chatId = activeChat.id;
    const { apiMessages, enabledScripts } = await buildApiRequest(
      character, persona, effectivePreset, getEffectiveContextSize(), activeChat, messagesBeforeResponse, settings?.vectorStoreEnabled, settings?.translateLanguage, settings?.responseLength, statusInfo,
    );

    const startTime = Date.now();
    try {
      await client.streamCompletion(
        apiMessages,
        (chunk) => appendStreamingContent(chunk),
        async (completeResponse, reasoning, finishReason, usage) => {
          const responseTimeMs = Date.now() - startTime;
          const processedContent = applyRegexScripts(completeResponse, enabledScripts, 'output');

          // Guard against empty API responses — don't overwrite with empty content
          if (!processedContent.trim()) {
            console.warn('API returned empty response during regeneration');
            setIsStreaming(false);
            setRegeneratingMessageId(null);
            clearStreamingContent();
            clearStreamingReasoning();
            return;
          }

          const message = activeChat.messages[messageIndex];
          // Create new swipes array (no mutation of original)
          const swipes = [...(message.swipes || [message.content]), processedContent];

          const responseMeta = usage ? {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
            responseTimeMs,
            finishReason,
          } : finishReason ? {
            responseTimeMs,
            finishReason,
          } : { responseTimeMs };

          const latestChat = useChatStore.getState().activeChat;
          const currentMessages = latestChat?.id === chatId ? latestChat.messages : activeChat.messages;
          const updatedMessages = currentMessages.map(msg =>
            msg.id === messageId
              ? { ...msg, swipes, content: processedContent, reasoning, responseMeta }
              : msg
          );

          await chatOps.update(chatId, { messages: updatedMessages });
          updateChat(chatId, { messages: updatedMessages });

          setIsStreaming(false);
          setRegeneratingMessageId(null);
          clearStreamingContent();
          clearStreamingReasoning();
        },
        (error) => {
          console.error('Regenerate error:', error);
          setIsStreaming(false);
          setRegeneratingMessageId(null);
          clearStreamingContent();
          clearStreamingReasoning();
        },
        (reasoningChunk) => appendStreamingReasoning(reasoningChunk),
      );
    } catch (error) {
      console.error('Failed to regenerate:', error);
      setIsStreaming(false);
      setRegeneratingMessageId(null);
      clearStreamingContent();
      clearStreamingReasoning();
    }
  }, [activeChat, connection, preset, character, persona, settings, getEffectivePreset, getEffectiveContextSize, updateChat, setIsStreaming, setRegeneratingMessageId, appendStreamingContent, clearStreamingContent, clearStreamingReasoning, appendStreamingReasoning]);

  const continueGeneration = useCallback(async () => {
    if (!activeChat || !connection || !preset || !character) return;

    const lastMessage = activeChat.messages[activeChat.messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'assistant') return;

    // Abort any in-progress generation
    if (apiClientRef.current) {
      apiClientRef.current.abort();
      apiClientRef.current = null;
    }

    clearStreamingContent();
    clearStreamingReasoning();
    setIsStreaming(true);

    const effectivePreset = getEffectivePreset()!;
    const client = new APIClient(connection, effectivePreset, settings || undefined);
    apiClientRef.current = client;

    const chatId = activeChat.id;
    const { apiMessages, enabledScripts } = await buildApiRequest(
      character, persona, effectivePreset, getEffectiveContextSize(), activeChat, activeChat.messages, settings?.vectorStoreEnabled, settings?.translateLanguage, settings?.responseLength,
    );

    // 在 system prompt 末尾追加继续生成指令，确保 AI 以正确角色视角继续
    if (apiMessages.length > 0 && apiMessages[0].role === 'system') {
      apiMessages[0] = {
        ...apiMessages[0],
        content: apiMessages[0].content + CONTINUE_INSTRUCTION,
      };
    }

    const startTime = Date.now();
    try {
      await client.streamCompletion(
        apiMessages,
        (chunk) => appendStreamingContent(chunk),
        async (completeResponse, reasoning, finishReason, usage) => {
          const responseTimeMs = Date.now() - startTime;
          const processedContent = applyRegexScripts(completeResponse, enabledScripts, 'output');

          const latestChat = useChatStore.getState().activeChat;
          const currentMessages = latestChat?.id === chatId ? latestChat.messages : activeChat.messages;
          const lastMsgMeta = currentMessages[currentMessages.length - 1]?.responseMeta;

          const responseMeta = usage ? {
            ...lastMsgMeta,
            promptTokens: (lastMsgMeta?.promptTokens ?? 0) + (usage.prompt_tokens ?? 0),
            completionTokens: (lastMsgMeta?.completionTokens ?? 0) + (usage.completion_tokens ?? 0),
            totalTokens: (lastMsgMeta?.totalTokens ?? 0) + (usage.total_tokens ?? 0),
            responseTimeMs: (lastMsgMeta?.responseTimeMs ?? 0) + responseTimeMs,
            finishReason,
          } : finishReason ? {
            ...(lastMsgMeta ?? {}),
            responseTimeMs: (lastMsgMeta?.responseTimeMs ?? 0) + responseTimeMs,
            finishReason,
          } : {
            ...(lastMsgMeta ?? {}),
            responseTimeMs: (lastMsgMeta?.responseTimeMs ?? 0) + responseTimeMs,
          };

          const updatedMessages = currentMessages.map((msg, idx) =>
            idx === currentMessages.length - 1
              ? {
                  ...msg,
                  content: msg.content + processedContent,
                  reasoning: msg.reasoning
                    ? msg.reasoning + (reasoning || '')
                    : reasoning || undefined,
                  responseMeta,
                }
              : msg
          );

          await chatOps.update(chatId, { messages: updatedMessages });
          updateChat(chatId, { messages: updatedMessages });

          setIsStreaming(false);
          clearStreamingContent();
          clearStreamingReasoning();

          // Auto-continue if truncated by token limit
          if (finishReason === 'length' && settings?.autoContinue) {
            setTimeout(() => continueRef.current(), 500);
          }
        },
        (error) => {
          console.error('Continue error:', error);
          setIsStreaming(false);
          clearStreamingContent();
          clearStreamingReasoning();
        },
        (reasoningChunk) => appendStreamingReasoning(reasoningChunk),
      );
    } catch (error) {
      console.error('Failed to continue:', error);
      setIsStreaming(false);
      clearStreamingContent();
      clearStreamingReasoning();
    }
  }, [activeChat, connection, preset, character, persona, settings, getEffectivePreset, getEffectiveContextSize, updateChat, setIsStreaming, appendStreamingContent, clearStreamingContent, clearStreamingReasoning, appendStreamingReasoning]);

  // Keep ref in sync for auto-continue (avoids circular deps between callbacks)
  continueRef.current = continueGeneration;

  const stopGeneration = useCallback(() => {
    const { streamingContent: partialContent, streamingReasoning: partialReasoning, isImpersonating: wasImpersonating, regeneratingMessageId: regenMsgId } = useChatStore.getState();

    if (apiClientRef.current) {
      apiClientRef.current.abort();
      apiClientRef.current = null;
    }

    // Save partial content if any was streamed
    if (partialContent) {
      const latestChat = useChatStore.getState().activeChat;
      if (latestChat) {
        if (regenMsgId) {
          // Regeneration was in progress — save partial as a new swipe on the existing message
          const msgIndex = latestChat.messages.findIndex(m => m.id === regenMsgId);
          if (msgIndex !== -1) {
            const message = latestChat.messages[msgIndex];
            const swipes = [...(message.swipes || [message.content]), partialContent];
            const updatedMessages = latestChat.messages.map(msg =>
              msg.id === regenMsgId
                ? { ...msg, swipes, content: partialContent, reasoning: partialReasoning || undefined }
                : msg
            );
            chatOps.update(latestChat.id, { messages: updatedMessages }).catch(console.error);
            updateChat(latestChat.id, { messages: updatedMessages });
          }
        } else if (wasImpersonating && impersonateCallbackRef.current) {
          // Impersonation with callback — route partial text to input field
          const trimmed = partialContent.trim();
          if (trimmed) impersonateCallbackRef.current(trimmed);
          impersonateCallbackRef.current = null;
        } else {
          // Normal generation — save partial as a new message
          const partialMessage: Message = {
            id: generateUUID(),
            role: wasImpersonating ? 'user' : 'assistant',
            content: partialContent,
            timestamp: Date.now(),
            reasoning: wasImpersonating ? undefined : (partialReasoning || undefined),
          };
          const finalMessages = [...latestChat.messages, partialMessage];
          chatOps.update(latestChat.id, { messages: finalMessages }).catch(console.error);
          updateChat(latestChat.id, { messages: finalMessages });
        }
      }
    }

    setIsStreaming(false);
    setIsImpersonating(false);
    setRegeneratingMessageId(null);
    clearStreamingContent();
    clearStreamingReasoning();
  }, [updateChat, setIsStreaming, setIsImpersonating, setRegeneratingMessageId, clearStreamingContent, clearStreamingReasoning]);

  const impersonateResponse = useCallback(async (hint?: string, onResult?: (text: string) => void) => {
    if (!connection || !preset || !character || !activeChat) return;

    // Abort any in-progress generation before starting
    if (apiClientRef.current) {
      apiClientRef.current.abort();
      apiClientRef.current = null;
    }

    impersonateCallbackRef.current = onResult || null;

    clearStreamingContent();
    clearStreamingReasoning();
    setIsStreaming(true);
    setIsImpersonating(true);

    const effectivePreset = getEffectivePreset()!;
    const client = new APIClient(connection, effectivePreset, settings || undefined);
    apiClientRef.current = client;

    const chatId = activeChat.id;
    const { apiMessages } = await buildApiRequest(
      character, persona, effectivePreset, getEffectiveContextSize(), activeChat, activeChat.messages, undefined, settings?.translateLanguage, settings?.responseLength,
    );

    // Build the impersonation instruction
    const userName = persona?.name || 'User';
    const defaultPrompt = `[Write the next reply from the point of view of ${userName}, maintaining their personality and speech patterns. Write only the dialogue/action, not the character name prefix.]`;
    let impPrompt = effectivePreset.impersonation_prompt || defaultPrompt;
    impPrompt = impPrompt.replace(/\{\{user\}\}/gi, userName).replace(/\{\{char\}\}/gi, character.name);
    if (hint) impPrompt += `\n[Direction: ${hint}]`;

    apiMessages.push({ role: 'system', content: impPrompt });

    const startTime = Date.now();
    try {
      await client.streamCompletion(
        apiMessages,
        (chunk) => appendStreamingContent(chunk),
        async (completeResponse, _reasoning, finishReason, usage) => {
          const responseTimeMs = Date.now() - startTime;
          const trimmed = completeResponse.trim();
          const cb = impersonateCallbackRef.current;
          impersonateCallbackRef.current = null;

          if (cb) {
            // Route to input field for user review
            if (trimmed) cb(trimmed);
          } else {
            // Legacy fallback: save directly as user message
            if (trimmed) {
              const userMessage: Message = {
                id: generateUUID(),
                role: 'user',
                content: trimmed,
                timestamp: Date.now(),
                responseMeta: usage ? {
                  promptTokens: usage.prompt_tokens,
                  completionTokens: usage.completion_tokens,
                  totalTokens: usage.total_tokens,
                  responseTimeMs,
                  finishReason,
                } : { responseTimeMs },
              };
              const latestChat = useChatStore.getState().activeChat;
              const currentMessages = latestChat?.id === chatId ? latestChat.messages : activeChat.messages;
              const finalMessages = [...currentMessages, userMessage];
              await chatOps.update(chatId, { messages: finalMessages });
              updateChat(chatId, { messages: finalMessages });
            }
          }

          setIsStreaming(false);
          setIsImpersonating(false);
          clearStreamingContent();
          clearStreamingReasoning();
        },
        (error) => {
          console.error('Impersonate error:', error);
          impersonateCallbackRef.current = null;
          setIsStreaming(false);
          setIsImpersonating(false);
          clearStreamingContent();
          clearStreamingReasoning();
        },
      );
    } catch (error) {
      console.error('Failed to impersonate:', error);
      impersonateCallbackRef.current = null;
      setIsStreaming(false);
      setIsImpersonating(false);
      clearStreamingContent();
      clearStreamingReasoning();
    }
  }, [connection, preset, character, activeChat, persona, settings, getEffectivePreset, getEffectiveContextSize, updateChat, setIsStreaming, setIsImpersonating, appendStreamingContent, clearStreamingContent, clearStreamingReasoning]);

  const summarizeChat = useCallback(async (chatId: string, messages: Message[], upToIndex?: number) => {
    if (!connection || !preset) return;
    const endIdx = upToIndex ?? messages.length;
    const toSummarize = messages.slice(0, endIdx);
    if (toSummarize.length < 4) return; // Not enough messages to summarize

    const transcript = toSummarize
      .filter(m => m.role !== 'system')
      .map(m => `${m.role === 'user' ? 'User' : 'Character'}: ${m.content.slice(0, 500)}`)
      .join('\n');

    try {
      const summaryPreset = { ...preset, maxTokens: 500, temperature: 0.3 };
      const summaryClient = new APIClient(connection, summaryPreset, undefined);
      const summary = await summaryClient.complete([{
        role: 'user',
        content: `Summarize this roleplay conversation concisely. Capture key events, character development, emotional beats, and plot points. Preserve important details like names, locations, and established facts.\n\n${transcript}\n\nProvide a dense summary in 2-4 paragraphs:`,
      }]);
      const clean = summary.trim();
      if (clean) {
        await chatOps.update(chatId, { summary: clean, summaryUpToIndex: endIdx });
        updateChat(chatId, { summary: clean, summaryUpToIndex: endIdx });
      }
      return clean;
    } catch (e) {
      console.error('Failed to summarize:', e);
    }
  }, [connection, preset, updateChat]);

  return {
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
    streamingReasoning,
    getLastPrompt: () => lastPromptRef.current,
  };
}
