import type {
  ConnectionProfile,
  Preset,
  ChatCompletionRequest,
  CharacterCard,
  Persona,
  Message,
  LorebookEntry,
  ReasoningMode,
  AppSettings
} from '../types';
import { buildPromptFromPreset, getDepthInjections } from '../utils/presetImport';
import type { DepthInjection, PresetBuildVariables } from '../utils/presetImport';


// ==========================================
// API Service - Handles all AI provider communication
// ==========================================

export type StreamCallback = (chunk: string) => void;
export type ReasoningCallback = (reasoningChunk: string) => void;
export type CompletionCallback = (fullResponse: string, reasoning?: string, finishReason?: string, usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }) => void;
export type ErrorCallback = (error: Error) => void;

// Build the system prompt from character and persona
// If a preset with prompt entries is provided, use the preset's prompt system instead
export function buildSystemPrompt(
  character: CharacterCard,
  persona?: Persona | null,
  customSystemPrompt?: string,
  preset?: Preset | null,
  responseLength?: 'short' | 'medium' | 'long',
): string {
  if (preset?.prompts && preset.prompts.length > 0) {
    const presetPrompt = buildPromptFromPreset(
      preset,
      buildPresetVariables(character, persona, customSystemPrompt),
    );
    if (presetPrompt) return presetPrompt;
  }

  const parts: string[] = [];

  // CRITICAL OUTPUT FORMAT - placed at the HEAD so DeepSeek never misses it
  parts.push(`You are roleplaying as ${character.name}. You MUST follow these rules EXACTLY:\n\n1. ALWAYS output *action* for actions, "dialogue" for speech, (thought) for inner monologue.\n2. At the END of every response, you MUST append a [STATUS] block in valid JSON:\n   [STATUS]\n   {\n     "time": "<current in-story time>",\n     "location": "<current location>",\n     "info": { "key": "value", ... },\n     "status": { "key": "value", ... }\n   }\n   [/STATUS]\n3. The [STATUS] block is NOT optional. Every single response must include it.`);

  if (customSystemPrompt) {
    parts.push(`${customSystemPrompt}`);
  } else {
    parts.push('Stay in character at all times. Respond as the character would.');
  }

  parts.push(`## ${character.name}`);
  if (character.description) parts.push(`${character.description}`);
  if (character.personality) parts.push(`Personality: ${character.personality}`);
  if (character.scenario) parts.push(`Scenario: ${character.scenario}`);

  if (persona) {
    parts.push(`## ${persona.name} (user)`);
    if (persona.description) parts.push(`${persona.description}`);
    if (persona.personality) parts.push(`Personality: ${persona.personality}`);
  }

  if (character.mesExamples) parts.push(`## Example Dialogue\n${character.mesExamples}`);
  if (character.postHistoryInstructions) parts.push(`## Instructions\n${character.postHistoryInstructions}`);

  if (responseLength && responseLength !== 'medium') {
    parts.push(responseLength === 'short'
      ? 'Keep responses short - 1-2 sentences maximum.'
      : 'Keep responses detailed - 6-10 sentences, fully elaborate.');
  }

  return parts.join('\n');
}
// Build messages array for API request
export function buildMessages(
  systemPrompt: string,
  messages: Message[],
  contextSize: number = 20,
  lorebookEntries?: LorebookEntry[],
  depthInjections?: DepthInjection[],
  summary?: string,
  wiFormat?: string,
): ChatCompletionRequest['messages'] {
  const apiMessages: ChatCompletionRequest['messages'] = [];

  // Add system prompt
  apiMessages.push({
    role: 'system',
    content: systemPrompt,
  });

  // Inject conversation summary if available
  if (summary) {
    apiMessages.push({
      role: 'system',
      content: `[Previous conversation summary]\n${summary}`,
    });
  }

  // Add lorebook entries as system messages if triggered
  if (lorebookEntries && lorebookEntries.length > 0) {
    const recentMessages = messages.slice(-contextSize);
    const recentContent = recentMessages.map(m => m.content).join(' ');
    const recentContentLower = recentContent.toLowerCase();

    /** Check if a single keyword matches the content. */
    const keywordMatches = (keyword: string, entry: LorebookEntry): boolean => {
      const text = entry.caseSensitive ? recentContent : recentContentLower;
      const kw = entry.caseSensitive ? keyword : keyword.toLowerCase();
      if (entry.matchWholeWords) {
        const pattern = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, entry.caseSensitive ? '' : 'i');
        return pattern.test(recentContent);
      }
      return text.includes(kw);
    };

    const triggeredEntries = lorebookEntries
      .filter(entry => entry.enabled)
      .filter(entry => {
        // Primary keywords must have at least one match
        const primaryHit = entry.keywords.some(kw => keywordMatches(kw, entry));
        if (!primaryHit) return false;

        // If selective mode with secondary keywords, apply AND/OR logic
        if (entry.selective && entry.secondaryKeywords && entry.secondaryKeywords.length > 0) {
          const logic = entry.selectiveLogic || 'AND';
          if (logic === 'AND') {
            return entry.secondaryKeywords.every(kw => keywordMatches(kw, entry));
          } else {
            return entry.secondaryKeywords.some(kw => keywordMatches(kw, entry));
          }
        }

        return true;
      })
      .sort((a, b) => a.insertionOrder - b.insertionOrder);

    if (triggeredEntries.length > 0) {
      const format = wiFormat || '{0}';
      const loreContent = triggeredEntries
        .map(e => format.replace('{0}', e.content))
        .join('\n\n');
      apiMessages.push({
        role: 'system',
        content: `[Lorebook]\n${loreContent}`,
      });
    }
  }

  // Add conversation messages (limited by context size)
  const contextMessages = messages.slice(-contextSize);

  for (const msg of contextMessages) {
    apiMessages.push({
      role: msg.role === 'system' ? 'system' : msg.role,
      content: msg.content,
    });
  }

  // Splice depth-injected prompts into the chat history.
  // depthInjections are pre-sorted deepest-first so each splice does not
  // shift the insertion point of the next (shallower) entry.
  // depth 0 = after the last message; depth N = N messages from the end.
  if (depthInjections && depthInjections.length > 0) {
    for (const inj of depthInjections) {
      const insertAt = Math.max(1, apiMessages.length - inj.depth);
      apiMessages.splice(insertAt, 0, { role: inj.role, content: inj.content });
    }
  }

  return apiMessages;
}

/**
 * Build the variables object used by both buildSystemPrompt and getDepthInjections.
 * Exposed so callers can compute depth injections without duplicating field mapping.
 */
function buildPresetVariables(
  character: CharacterCard,
  persona?: Persona | null,
  customSystemPrompt?: string,
): PresetBuildVariables {
  return {
    charName: character.name,
    userName: persona?.name || 'User',
    charDescription: character.description,
    charPersonality: character.personality,
    scenario: character.scenario,
    personaDescription: persona?.description,
    mesExamples: character.mesExamples,
    creatorNotes: character.creatorNotes,
    systemPrompt: customSystemPrompt || character.systemPrompt,
    postHistoryInstructions: character.postHistoryInstructions,
  };
}

/**
 * Return depth-injected prompt entries for the given character/preset.
 * Pass the result to buildMessages() as the depthInjections argument.
 */
export function buildDepthInjections(
  character: CharacterCard,
  persona?: Persona | null,
  customSystemPrompt?: string,
  preset?: Preset | null,
): DepthInjection[] {
  if (!preset?.prompts) return [];
  return getDepthInjections(preset, buildPresetVariables(character, persona, customSystemPrompt));
}

// ──────────────────────────────────────────────────────────────

// Main API client class
export class APIClient {
  private connection: ConnectionProfile;
  private preset: Preset;
  private abortController: AbortController | null = null;
  constructor(connection: ConnectionProfile, preset: Preset, settings?: AppSettings) {
    this.connection = connection;
    this.preset = preset;
  }

  // Get the appropriate endpoint based on provider
  private getEndpoint(): string {
    if (this.connection.provider === 'custom' && this.connection.endpoint) {
      return this.connection.endpoint;
    }
    return 'https://api.deepseek.com/v1/chat/completions';
  }

  // Get headers based on provider
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.connection.apiKey) {
      headers['Authorization'] = `Bearer ${this.connection.apiKey}`;
    }

    return headers;
  }

  // Build request body based on provider
  private buildRequestBody(rawMessages: ChatCompletionRequest['messages'], stream = true): Record<string, unknown> {
    // Apply post-prompt processing before building the final request
    const messages = rawMessages;

    const baseRequest: Record<string, unknown> = {
      model: this.connection.model,
      messages,
      temperature: this.preset.temperature,
      top_p: this.preset.topP,
      max_tokens: this.preset.maxTokens,
      stream,
    };

    // Add optional parameters
    if (this.preset.topK !== undefined) {
      baseRequest.top_k = this.preset.topK;
    }

    if (this.preset.minP !== undefined) {
      baseRequest.min_p = this.preset.minP;
    }

    if (this.preset.frequencyPenalty !== 0) {
      baseRequest.frequency_penalty = this.preset.frequencyPenalty;
    }

    if (this.preset.presencePenalty !== 0) {
      baseRequest.presence_penalty = this.preset.presencePenalty;
    }

    if (this.preset.stopSequences && this.preset.stopSequences.length > 0) {
      baseRequest.stop = this.preset.stopSequences;
    }

    // Reasoning disabled — DeepSeek-only build
    return baseRequest;
  }


  // Stream completion with reasoning support
  async streamCompletion(
    messages: ChatCompletionRequest['messages'],
    onChunk: StreamCallback,
    onComplete: CompletionCallback,
    onError: ErrorCallback,
    onReasoning?: ReasoningCallback
  ): Promise<void> {
    this.abortController = new AbortController();

    try {
      const response = await fetch(this.getEndpoint(), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(this.buildRequestBody(messages, true)),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let fullContent = '';
      let fullReasoning = '';
      let buffer = '';
      let finishReason = '';
      let latestUsage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;

      // Track <think> tag state — applies to ALL models (CoT prompts on any provider)
      let inThinkTag = false;
      let thinkBuffer = '';

      const isAnthropic = false; // DeepSeek-only build

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();

          if (!trimmedLine || trimmedLine === 'data: [DONE]') {
            continue;
          }

          // Skip Anthropic SSE event type lines (we use parsed.type instead)
          if (trimmedLine.startsWith('event: ')) {
            continue;
          }

          if (trimmedLine.startsWith('data: ')) {
            try {
              const jsonStr = trimmedLine.slice(6);
              const parsed = JSON.parse(jsonStr);

              if (isAnthropic) {
                // Anthropic streaming format
                if (parsed.type === 'content_block_delta') {
                  const delta = parsed.delta;
                  if (delta?.type === 'text_delta' && delta.text) {
                    fullContent += delta.text;
                    onChunk(delta.text);
                  } else if (delta?.type === 'thinking_delta' && delta.thinking && onReasoning) {
                    fullReasoning += delta.thinking;
                    onReasoning(delta.thinking);
                  }
                } else if (parsed.type === 'message_delta') {
                  if (parsed.delta?.stop_reason) {
                    // Anthropic: stop_reason 'max_tokens' means truncated
                    finishReason = parsed.delta.stop_reason === 'max_tokens' ? 'length' : parsed.delta.stop_reason;
                  }
                  if (parsed.usage) {
                    latestUsage = parsed.usage;
                  }
                }
                // Skip other Anthropic event types (message_start, content_block_start, etc.)
              } else {
                // OpenAI-compatible streaming format
                const choiceFinishReason = parsed.choices?.[0]?.finish_reason;
                if (choiceFinishReason) finishReason = choiceFinishReason;

                // Track token usage from the final chunk
                if (parsed.usage) {
                  latestUsage = parsed.usage;
                }

                const content = parsed.choices?.[0]?.delta?.content;
                // Direct DeepSeek uses reasoning_content; OpenRouter uses reasoning (no suffix)
                const reasoningContent = parsed.choices?.[0]?.delta?.reasoning_content
                  || parsed.choices?.[0]?.delta?.reasoning;

                if (reasoningContent && onReasoning) {
                  fullReasoning += reasoningContent;
                  onReasoning(reasoningContent);
                }

                if (content) {
                  // Universal <think> tag stripping — works on any model.
                  // CoT prompts (like the Chain-of-Thought prompt in this preset)
                  // instruct the model to reason inside <think> tags; we route that
                  // to the reasoning panel instead of the chat bubble.
                  if (!inThinkTag && content.includes('<think')) {
                    const thinkIdx = content.indexOf('<think');
                    const beforeThink = content.slice(0, thinkIdx);
                    if (beforeThink) {
                      fullContent += beforeThink;
                      onChunk(beforeThink);
                    }
                    inThinkTag = true;
                    thinkBuffer = content.slice(thinkIdx);
                    continue;
                  }

                  if (inThinkTag) {
                    thinkBuffer += content;

                    if (thinkBuffer.includes('</think')) {
                      inThinkTag = false;
                      const extracted = thinkBuffer.replace(/<\/?think>?/g, '').trim();
                      if (extracted) {
                        fullReasoning += extracted;
                        if (onReasoning) onReasoning(extracted);
                      }
                      thinkBuffer = '';
                    }
                    continue;
                  }

                  fullContent += content;
                  onChunk(content);
                }
              }
            } catch (e) {
              // Skip invalid JSON
              console.warn('Failed to parse SSE chunk:', trimmedLine);
            }
          }
        }
      }

      // Flush any unclosed <think> buffer (model stopped mid-reasoning)
      if (thinkBuffer) {
        // Flush remaining think buffer as reasoning content
        fullReasoning += thinkBuffer;
        if (onReasoning) onReasoning(thinkBuffer);
      }

      onComplete(fullContent, fullReasoning || undefined, finishReason || undefined, latestUsage);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request aborted');
      } else {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    } finally {
      this.abortController = null;
    }
  }

  // Non-streaming completion (for simpler use cases)
  async complete(messages: ChatCompletionRequest['messages']): Promise<string> {
    const requestBody = this.buildRequestBody(messages, false);

    const response = await fetch(this.getEndpoint(), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    // Anthropic returns { content: [{ text }] }, OpenAI-compatible returns { choices: [{ message: { content } }] }
    return data.choices?.[0]?.message?.content || '';
  }

  // Abort ongoing request
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  // Test connection
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const testMessages: ChatCompletionRequest['messages'] = [
        { role: 'user', content: 'Say "Connection successful" and nothing else.' }
      ];

      const requestBody = this.buildRequestBody(testMessages);
      // For o-series models, buildRequestBody replaces max_tokens with max_completion_tokens
      if (requestBody.max_completion_tokens !== undefined) {
        requestBody.max_completion_tokens = 50;
      } else {
        requestBody.max_tokens = 50;
      }
      requestBody.stream = false;

      const response = await fetch(this.getEndpoint(), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `${response.status}: ${errorText}` };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// Helper to get model list for a provider
export async function fetchModels(connection: ConnectionProfile): Promise<string[]> {
  try {
    let endpoint: string;
    let headers: Record<string, string> = {};

    if (connection.provider === 'custom' && connection.endpoint) {
      endpoint = connection.endpoint.replace('/chat/completions', '/models') || '';
      if (connection.apiKey) {
        headers['Authorization'] = `Bearer ${connection.apiKey}`;
      }
    } else {
      endpoint = 'https://api.deepseek.com/v1/models';
      if (connection.apiKey) {
        headers['Authorization'] = `Bearer ${connection.apiKey}`;
      }
    }

    const response = await fetch(endpoint, { headers });
    
    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.data?.map((m: { id: string }) => m.id) || [];
  } catch {
    return [];
  }
}




// ===== DeepSeek-only model listing =====
export const DEFAULT_MODELS: Record<string, string[]> = {
  deepseek: [
    'deepseek-chat',
    'deepseek-reasoner',
    'deepseek-v4-flash',
    'deepseek-v4-pro',
  ],
};

export async function fetchAvailableModels(connection: ConnectionProfile): Promise<{ id: string }[]> {
  if (connection.provider === 'custom' && connection.endpoint) {
    return [{ id: connection.model || 'custom-model' }];
  }

  try {
    const response = await fetch('https://api.deepseek.com/v1/models', {
      headers: { Authorization: `Bearer ${connection.apiKey}` },
    });
    if (response.ok) {
      const data = await response.json();
      return (data.data || []).map((m: any) => ({ id: m.id }));
    }
  } catch {}
  return DEFAULT_MODELS.deepseek.map(id => ({ id }));
}
