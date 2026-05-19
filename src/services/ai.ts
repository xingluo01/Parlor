import type { ConnectionProfile } from '../types';

export type AIProvider = 'deepseek' | 'custom';

export interface CallAIOptions {
  temperature?: number;
  maxTokens?: number;
}

/**
 * AI 调用函数，仅支持 OpenAI 兼容接口（DeepSeek / Custom）
 */
export async function callAI(
  connection: ConnectionProfile,
  systemPrompt: string,
  userPrompt: string,
  options: CallAIOptions = {}
): Promise<string> {
  const { provider, apiKey, endpoint, model } = connection;
  const baseUrl = endpoint?.replace(/\/$/, '') || 'https://api.deepseek.com';
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens ?? 4096;

  const openaiCompatible = ['deepseek', 'custom'];
  let resultText = '';

  if (openaiCompatible.includes(provider)) {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
    });
    if (!res.ok) throw new Error(`${provider} API error: ${res.status}`);
    const data = await res.json();
    resultText = data.choices?.[0]?.message?.content || '';
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  if (!resultText) throw new Error('AI 返回为空');
  return resultText;
}
