export type ChatCompletionRequest = {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  max_tokens?: number;
  stop?: string[];
  stream?: boolean;
};

export type ChatCompletionChunk = {
  id: string;
  choices: Array<{
    delta: {
      content?: string;
      reasoning_content?: string;
    };
    finish_reason?: string | null;
  }>;
};
