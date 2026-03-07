import type {
  ConnectionProfile,
  Preset,
  ChatCompletionRequest,
  CharacterCard,
  Persona,
  Message,
  LorebookEntry,
  APIProvider,
  ReasoningMode,
  AppSettings
} from '../types';
import { buildPromptFromPreset, getDepthInjections } from '../utils/presetImport';
import type { DepthInjection, PresetBuildVariables } from '../utils/presetImport';

// Helper to detect reasoning mode from model name
function detectReasoningMode(model: string): ReasoningMode {
  const modelLower = model.toLowerCase();

  // OpenAI o1/o3/o4 models (direct and OpenRouter-style paths like "openai/o3")
  if (modelLower.includes('o1-') || modelLower.includes('o1.') ||
      modelLower.includes('o3-') || modelLower.includes('o3.') ||
      modelLower.includes('o4-') ||
      modelLower.endsWith('/o1') || modelLower.endsWith('/o3')) {
    return 'openai';
  }

  // DeepSeek R1 models
  if (modelLower.includes('deepseek-r1') || modelLower.includes('deepseek-reasoner') ||
      modelLower.includes('deepseek.r1')) {
    return 'deepseek';
  }

  // GLM models
  if (modelLower.includes('glm') || modelLower.includes('chatglm')) {
    return 'glm';
  }

  // Anthropic/Claude models
  if (modelLower.includes('claude')) {
    return 'anthropic';
  }

  return 'none';
}

// Parse GLM-style <think> tags from content
function parseGLMThinking(content: string): { reasoning: string; response: string } {
  const thinkRegex = /<think>([\s\S]*?)(?:<\/think>|$)/i;
  const match = content.match(thinkRegex);
  
  if (match) {
    const reasoning = match[1].trim();
    const response = content.replace(thinkRegex, '').trim();
    return { reasoning, response };
  }
  
  return { reasoning: '', response: content };
}

// ==========================================
// API Service - Handles all AI provider communication
// ==========================================

export type StreamCallback = (chunk: string) => void;
export type ReasoningCallback = (reasoningChunk: string) => void;
export type CompletionCallback = (fullResponse: string, reasoning?: string) => void;
export type ErrorCallback = (error: Error) => void;

// Build the system prompt from character and persona
// If a preset with prompt entries is provided, use the preset's prompt system instead
export function buildSystemPrompt(
  character: CharacterCard,
  persona?: Persona | null,
  customSystemPrompt?: string,
  preset?: Preset | null
): string {
  // If preset has prompt entries, use the preset prompt system with variable substitution
  if (preset?.prompts && preset.prompts.length > 0) {
    const presetPrompt = buildPromptFromPreset(
      preset,
      buildPresetVariables(character, persona, customSystemPrompt),
    );
    if (presetPrompt) return presetPrompt;
  }

  const parts: string[] = [];

  // Use custom system prompt if provided
  if (customSystemPrompt) {
    parts.push(customSystemPrompt);
  } else {
    // Default system prompt structure
    parts.push('You are roleplaying as a character. Stay in character at all times.');
  }

  // Add character information
  parts.push(`\n## Character: ${character.name}`);

  if (character.description) {
    parts.push(`\n### Description\n${character.description}`);
  }

  if (character.personality) {
    parts.push(`\n### Personality\n${character.personality}`);
  }

  if (character.scenario) {
    parts.push(`\n### Scenario\n${character.scenario}`);
  }

  // Add persona information if available
  if (persona) {
    parts.push(`\n## User: ${persona.name}`);
    if (persona.description) {
      parts.push(`\n### Description\n${persona.description}`);
    }
    if (persona.personality) {
      parts.push(`\n### Personality\n${persona.personality}`);
    }
  }

  // Add post-history instructions
  if (character.postHistoryInstructions) {
    parts.push(`\n## Instructions\n${character.postHistoryInstructions}`);
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
    const triggeredEntries = lorebookEntries
      .filter(entry => entry.enabled)
      .filter(entry =>
        entry.keywords.some(keyword =>
          entry.caseSensitive
            ? recentContent.includes(keyword)
            : recentContentLower.includes(keyword.toLowerCase())
        )
      )
      .sort((a, b) => a.insertionOrder - b.insertionOrder);

    if (triggeredEntries.length > 0) {
      const loreContent = triggeredEntries.map(e => e.content).join('\n\n');
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

// Main API client class
export class APIClient {
  private connection: ConnectionProfile;
  private preset: Preset;
  private settings?: AppSettings;
  private abortController: AbortController | null = null;

  constructor(connection: ConnectionProfile, preset: Preset, settings?: AppSettings) {
    this.connection = connection;
    this.preset = preset;
    this.settings = settings;
  }

  // Get the appropriate endpoint based on provider
  private getEndpoint(): string {
    switch (this.connection.provider) {
      case 'openai':
        return 'https://api.openai.com/v1/chat/completions';
      case 'anthropic':
        return 'https://api.anthropic.com/v1/messages';
      case 'openrouter':
        return 'https://openrouter.ai/api/v1/chat/completions';
      case 'custom':
        return this.connection.endpoint || 'http://localhost:1234/v1/chat/completions';
      case 'ollama':
        return this.connection.endpoint || 'http://localhost:11434/v1/chat/completions';
      case 'lmstudio':
        return this.connection.endpoint || 'http://localhost:1234/v1/chat/completions';
      case 'glm':
        return 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
      case 'gemini':
        return 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
      case 'mistral':
        return 'https://api.mistral.ai/v1/chat/completions';
      case 'deepseek':
        return 'https://api.deepseek.com/v1/chat/completions';
      case 'groq':
        return 'https://api.groq.com/openai/v1/chat/completions';
      default:
        return this.connection.endpoint || 'https://api.openai.com/v1/chat/completions';
    }
  }

  // Get headers based on provider
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    switch (this.connection.provider) {
      case 'openai':
        headers['Authorization'] = `Bearer ${this.connection.apiKey}`;
        break;
      case 'anthropic':
        headers['x-api-key'] = this.connection.apiKey;
        headers['anthropic-version'] = '2023-06-01';
        break;
      case 'openrouter':
        headers['Authorization'] = `Bearer ${this.connection.apiKey}`;
        headers['HTTP-Referer'] = window.location.origin;
        break;
      case 'custom':
        if (this.connection.apiKey) {
          headers['Authorization'] = `Bearer ${this.connection.apiKey}`;
        }
        break;
      case 'ollama':
      case 'lmstudio':
        if (this.connection.apiKey) {
          headers['Authorization'] = `Bearer ${this.connection.apiKey}`;
        }
        break;
      case 'glm':
      case 'gemini':
      case 'mistral':
      case 'deepseek':
      case 'groq':
        headers['Authorization'] = `Bearer ${this.connection.apiKey}`;
        break;
    }

    return headers;
  }

  // Build request body based on provider
  private buildRequestBody(messages: ChatCompletionRequest['messages']): Record<string, unknown> {
    const baseRequest: Record<string, unknown> = {
      model: this.connection.model,
      messages,
      temperature: this.preset.temperature,
      top_p: this.preset.topP,
      max_tokens: this.preset.maxTokens,
      stream: true,
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

    // Determine reasoning mode - prioritize global settings over preset
    let reasoningMode: ReasoningMode | undefined;
    let reasoningEffort: 'low' | 'medium' | 'high' | undefined;
    
    // First check global settings
    if (this.settings?.reasoningMode) {
      reasoningMode = this.settings.reasoningMode;
      reasoningEffort = this.settings.reasoningEffort;
    } else {
      // Fall back to preset settings
      reasoningMode = this.preset.reasoningMode;
      reasoningEffort = this.preset.reasoningEffort;
    }
    
    // Handle legacy enableReasoning flag
    if (!reasoningMode && this.preset.enableReasoning) {
      reasoningMode = 'openai';
    }
    
    // Auto-detect reasoning mode if set to auto or not set
    if (reasoningMode === 'auto' || !reasoningMode) {
      reasoningMode = detectReasoningMode(this.connection.model);
    }
    
    // Apply reasoning parameters based on mode
    if (reasoningMode && reasoningMode !== 'none') {
      switch (reasoningMode) {
        case 'openai':
          // o-series models don't support temperature/top_p/penalties and use a different token field
          delete baseRequest.temperature;
          delete baseRequest.top_p;
          delete baseRequest.frequency_penalty;
          delete baseRequest.presence_penalty;
          baseRequest.max_completion_tokens = baseRequest.max_tokens;
          delete baseRequest.max_tokens;
          if (reasoningEffort) baseRequest.reasoning_effort = reasoningEffort;
          break;

        case 'deepseek':
          // DeepSeek R1 always reasons, no special parameters needed
          // Just ensure we parse reasoning_content from response
          break;

        case 'glm':
          // GLM reasoning models output <think> tags naturally — no special param needed
          break;
      }
    }

    // Anthropic has a different API structure
    if (this.connection.provider === 'anthropic') {
      // Collect ALL system messages (main prompt + lorebook + depth injections)
      const systemMessages = messages.filter(m => m.role === 'system');
      const otherMessages = messages.filter(m => m.role !== 'system');

      const anthropicBody: Record<string, unknown> = {
        model: this.connection.model,
        system: systemMessages.map(m => m.content).join('\n\n'),
        messages: otherMessages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: this.preset.maxTokens,
        temperature: this.preset.temperature,
        top_p: this.preset.topP,
        stream: true,
      };

      if (this.preset.topK !== undefined) {
        anthropicBody.top_k = this.preset.topK;
      }

      if (this.preset.minP !== undefined) {
        anthropicBody.min_p = this.preset.minP;
      }

      if (this.preset.stopSequences && this.preset.stopSequences.length > 0) {
        anthropicBody.stop_sequences = this.preset.stopSequences;
      }

      // Enable Anthropic extended thinking
      if (reasoningMode === 'anthropic') {
        const budgetTokens = Math.max(
          1024,
          Math.min(this.preset.reasoningBudgetTokens || this.preset.maxTokens, 16384)
        );
        anthropicBody.thinking = { type: 'enabled', budget_tokens: budgetTokens };
        anthropicBody.temperature = 1; // Anthropic requires temperature=1 when thinking is enabled
        delete anthropicBody.top_p;
        delete anthropicBody.top_k;
      }

      return anthropicBody;
    }

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
        body: JSON.stringify(this.buildRequestBody(messages)),
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

      // Track <think> tag state — applies to ALL models (CoT prompts on any provider)
      let inThinkTag = false;
      let thinkBuffer = '';

      const isAnthropic = this.connection.provider === 'anthropic';

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
                }
                // Skip other Anthropic event types (message_start, content_block_start, etc.)
              } else {
                // OpenAI-compatible streaming format
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
                    inThinkTag = true;
                    thinkBuffer = content;
                    continue;
                  }

                  if (inThinkTag) {
                    thinkBuffer += content;

                    if (thinkBuffer.includes('</think')) {
                      inThinkTag = false;
                      const parsed = parseGLMThinking(thinkBuffer);
                      if (parsed.reasoning) {
                        fullReasoning += parsed.reasoning;
                        if (onReasoning) onReasoning(parsed.reasoning);
                      }
                      if (parsed.response) {
                        fullContent += parsed.response;
                        onChunk(parsed.response);
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
        const parsed = parseGLMThinking(thinkBuffer);
        if (parsed.reasoning) {
          fullReasoning += parsed.reasoning;
          if (onReasoning) onReasoning(parsed.reasoning);
        }
        if (parsed.response) {
          fullContent += parsed.response;
        }
      }

      onComplete(fullContent, fullReasoning || undefined);
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
    const requestBody = this.buildRequestBody(messages);
    requestBody.stream = false;

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
      requestBody.max_tokens = 50;
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

    switch (connection.provider) {
      case 'openai':
        endpoint = 'https://api.openai.com/v1/models';
        headers['Authorization'] = `Bearer ${connection.apiKey}`;
        break;
      case 'openrouter':
        endpoint = 'https://openrouter.ai/api/v1/models';
        headers['Authorization'] = `Bearer ${connection.apiKey}`;
        break;
      case 'custom':
        endpoint = connection.endpoint?.replace('/chat/completions', '/models') || '';
        if (connection.apiKey) {
          headers['Authorization'] = `Bearer ${connection.apiKey}`;
        }
        break;
      default:
        return [];
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

// Fetch models without needing a full connection (just provider + apiKey)
export async function fetchAvailableModels(
  provider: APIProvider, 
  apiKey: string,
  customEndpoint?: string
): Promise<{ id: string; name?: string }[]> {
  try {
    let endpoint: string;
    let headers: Record<string, string> = {};

    switch (provider) {
      case 'openai':
        if (!apiKey) return [];
        endpoint = 'https://api.openai.com/v1/models';
        headers['Authorization'] = `Bearer ${apiKey}`;
        break;
      case 'openrouter':
        if (!apiKey) return [];
        endpoint = 'https://openrouter.ai/api/v1/models';
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['HTTP-Referer'] = window.location.origin;
        break;
      case 'anthropic':
        // Anthropic doesn't have a models endpoint, return defaults
        return DEFAULT_MODELS.anthropic.map(id => ({ id }));
      case 'custom':
        if (!customEndpoint) return [];
        endpoint = customEndpoint.replace('/chat/completions', '/models');
        if (apiKey) {
          headers['Authorization'] = `Bearer ${apiKey}`;
        }
        break;
      case 'ollama': {
        const base = customEndpoint
          ? customEndpoint.replace('/v1/chat/completions', '')
          : 'http://localhost:11434';
        try {
          const response = await fetch(`${base}/api/tags`);
          if (!response.ok) return [];
          const data = await response.json();
          return (data.models || [])
            .map((m: { name: string }) => ({ id: m.name }))
            .sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id));
        } catch {
          return [];
        }
      }
      case 'lmstudio': {
        const base = customEndpoint
          ? customEndpoint.replace('/chat/completions', '/models')
          : 'http://localhost:1234/v1/models';
        try {
          const response = await fetch(base);
          if (!response.ok) return [];
          const data = await response.json();
          return (data.data || [])
            .map((m: { id: string }) => ({ id: m.id }))
            .sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id));
        } catch {
          return [];
        }
      }
      case 'glm':
        if (!apiKey) return DEFAULT_MODELS.glm.map(id => ({ id }));
        endpoint = 'https://open.bigmodel.cn/api/paas/v4/models';
        headers['Authorization'] = `Bearer ${apiKey}`;
        break;
      case 'gemini': {
        if (!apiKey) return DEFAULT_MODELS.gemini.map(id => ({ id }));
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
          );
          if (!response.ok) return DEFAULT_MODELS.gemini.map(id => ({ id }));
          const data = await response.json();
          return (data.models || [])
            .filter((m: { name: string; supportedGenerationMethods?: string[] }) =>
              m.supportedGenerationMethods?.includes('generateContent')
            )
            .map((m: { name: string }) => ({ id: m.name.replace('models/', '') }))
            .sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id));
        } catch {
          return DEFAULT_MODELS.gemini.map(id => ({ id }));
        }
      }
      case 'mistral':
        if (!apiKey) return DEFAULT_MODELS.mistral.map(id => ({ id }));
        endpoint = 'https://api.mistral.ai/v1/models';
        headers['Authorization'] = `Bearer ${apiKey}`;
        break;
      case 'deepseek':
        if (!apiKey) return DEFAULT_MODELS.deepseek.map(id => ({ id }));
        endpoint = 'https://api.deepseek.com/v1/models';
        headers['Authorization'] = `Bearer ${apiKey}`;
        break;
      case 'groq':
        if (!apiKey) return DEFAULT_MODELS.groq.map(id => ({ id }));
        endpoint = 'https://api.groq.com/openai/v1/models';
        headers['Authorization'] = `Bearer ${apiKey}`;
        break;
      default:
        return [];
    }

    const response = await fetch(endpoint, { headers });
    
    if (!response.ok) {
      console.warn(`Failed to fetch models from ${provider}:`, response.status);
      return DEFAULT_MODELS[provider]?.map(id => ({ id })) || [];
    }

    const data = await response.json();
    
    // OpenRouter returns more info including display names
    if (provider === 'openrouter') {
      return (data.data || [])
        .map((m: { id: string; name?: string }) => ({
          id: m.id,
          name: m.name || m.id,
        }))
        .sort((a: { id: string; name?: string }, b: { id: string; name?: string }) => (a.name || a.id).localeCompare(b.name || b.id));
    }
    
    // OpenAI style response
    return (data.data || [])
      .map((m: { id: string }) => ({ id: m.id }))
      .sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id));
  } catch (error) {
    console.warn(`Error fetching models from ${provider}:`, error);
    return DEFAULT_MODELS[provider]?.map(id => ({ id })) || [];
  }
}

// Default models for providers
export const DEFAULT_MODELS: Record<string, string[]> = {
  openai: [
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-4.1-nano',
    'gpt-4o',
    'gpt-4o-mini',
    'o3',
    'o3-mini',
    'o4-mini',
  ],
  anthropic: [
    'claude-opus-4-6',
    'claude-sonnet-4-6',
    'claude-haiku-4-5-20251001',
  ],
  openrouter: [
    'openai/gpt-4.1',
    'anthropic/claude-sonnet-4-6',
    'google/gemini-2.5-pro',
    'meta-llama/llama-4-maverick',
  ],
  custom: [],
  ollama: [],    // Dynamically discovered from local server
  lmstudio: [],  // Dynamically discovered from local server
  glm: [
    'glm-4-plus',
    'glm-4-0520',
    'glm-4',
    'glm-4-air',
    'glm-4-flash',
  ],
  gemini: [
    'gemini-2.5-pro-preview-05-06',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
  ],
  mistral: [
    'mistral-large-latest',
    'mistral-medium-latest',
    'mistral-small-latest',
    'open-mistral-nemo',
    'codestral-latest',
  ],
  deepseek: [
    'deepseek-chat',
    'deepseek-reasoner',
  ],
  groq: [
    'llama-3.3-70b-versatile',
    'llama-3.1-70b-versatile',
    'llama-3.1-8b-instant',
    'gemma2-9b-it',
    'mixtral-8x7b-32768',
  ],
};