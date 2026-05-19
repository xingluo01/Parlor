import type { ReasoningMode } from './common';

export type ParameterOverrides = {
  temperature?: number;
  topP?: number;
  topK?: number;
  minP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  maxTokens?: number;
  contextSize?: number;
  reasoningMode?: ReasoningMode;
  reasoningBudgetTokens?: number;
  enableReasoning?: boolean;
  reasoningEffort?: 'low' | 'medium' | 'high';
};

export type MessageContent = {
  type: 'text' | 'image';
  text?: string;
  image?: string;
};

export type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  parts?: MessageContent[];
  timestamp: number;
  isEdited?: boolean;
  isRegenerated?: boolean;
  parentMessageId?: string | null;
  swipes?: string[];
  activeSwipeIndex?: number;
  reasoning?: string;
  bookmarked?: boolean;
  characterId?: string;
  translatedContent?: string;
  generatedImages?: string[];
  embedded?: boolean;
  responseMeta?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    responseTimeMs?: number;
    finishReason?: string;
  };
};

export type ChatSession = {
  id: string;
  characterId: string;
  personaId: string | null;
  title?: string;
  messages: Message[];
  parameterOverrides?: ParameterOverrides;
  authorNote?: string;
  authorNoteDepth?: number;
  enabledWorldInfoIds?: string[];
  summary?: string;
  summaryUpToIndex?: number;
  branchedFromChatId?: string;
  branchPointMessageId?: string;
  createdAt: number;
  updatedAt: number;
};
