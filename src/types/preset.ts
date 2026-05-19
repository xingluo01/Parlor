import type { ReasoningMode, PostPromptProcessing } from './common';

export type PromptEntry = {
  identifier: string;
  name: string;
  content: string;
  role: 'system' | 'user' | 'assistant';
  system_prompt?: boolean;
  marker?: boolean;
  enabled?: boolean;
  injection_position?: number;
  injection_depth?: number;
  forbid_overrides?: boolean;
};

export type PromptOrderEntry = {
  identifier: string;
  enabled: boolean;
};

export type Preset = {
  id: string;
  name: string;
  temperature: number;
  topP: number;
  topK?: number;
  minP?: number;
  frequencyPenalty: number;
  presencePenalty: number;
  maxTokens: number;
  stopSequences?: string[];

  reasoningMode?: ReasoningMode;
  reasoningBudgetTokens?: number;
  enableReasoning?: boolean;
  reasoningEffort?: 'low' | 'medium' | 'high';

  post_prompt_processing?: PostPromptProcessing;

  prompts?: PromptEntry[];
  prompt_order?: PromptOrderEntry[];

  impersonation_prompt?: string;
  new_chat_prompt?: string;
  new_group_chat_prompt?: string;
  new_example_chat_prompt?: string;
  continue_nudge_prompt?: string;
  group_nudge_prompt?: string;
  scenario_format?: string;
  personality_format?: string;
  wi_format?: string;

  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
};
