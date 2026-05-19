const fs = require('fs');
const path = require('path');
const filePath = 'E:/GitHub/Parlor/src/services/api.ts';
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Remove detectReasoningMode - replace with simplified version
const oldDetect = `function detectReasoningMode(model: string): ReasoningMode {
  const modelLower = model.toLowerCase();

  // OpenAI o1/o3/o4 models (direct and OpenRouter-style paths like "openai/o3")
  if (modelLower.includes('o1-') || modelLower.includes('o1.') ||
      modelLower.includes('o3-') || modelLower.includes('o3.') ||
      modelLower.includes('o4-') ||
      modelLower.endsWith('/o1') || modelLower.endsWith('/o3') || modelLower.endsWith('/o4')) {
    return 'openai';
  }

  // DeepSeek R1 / V4 / V3 / Chat models
  if (modelLower.includes('deepseek-r1') || modelLower.includes('deepseek-reasoner') ||
      modelLower.includes('deepseek.r1') || modelLower.includes('deepseek-v4') ||
      modelLower.includes('deepseek-v3') || modelLower.includes('deepseek-chat')) {
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
}`;

const newDetect = `// Simplified for DeepSeek-only build
function detectReasoningMode(model: string): ReasoningMode {
  const m = model.toLowerCase();
  if (m.includes('deepseek')) return 'deepseek';
  return 'none';
}`;

content = content.replace(oldDetect, newDetect);

// 2. Remove parseGLMThinking
const oldGLM = `// Parse GLM-style <think> tags from content
function parseGLMThinking(content: string): { reasoning: string; response: string } {
  const thinkRegex = /<think>([\\s\\S]*?)(?:<\\/think>|$)/i;
  const match = content.match(thinkRegex);
  
  if (match) {
    const reasoning = match[1].trim();
    const response = content.replace(thinkRegex, '').trim();
    return { reasoning, response };
  }
  
  return { reasoning: '', response: content };
}`;

content = content.replace(oldGLM, '// parseGLMThinking removed — DeepSeek-only build');

// 3. Remove the post-prompt processing functions and applyPostPromptProcessing
const postPromptRegex = /\/\/ ──+[\s\S]*?\/\/ ──+\s*\n[\s\S]*?type ApiMsg = ChatCompletionRequest['messages'][number];[\s\S]*?function applyPostPromptProcessing[\s\S]*?\n\}\n\n/;
content = content.replace(postPromptRegex, '// Post-prompt processing removed — DeepSeek-only build\n\n');

// 4. Simplify getEndpoint
const oldGetEndpoint = `  private getEndpoint(): string {
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
  }`;

const newGetEndpoint = `  private getEndpoint(): string {
    if (this.connection.provider === 'custom' && this.connection.endpoint) {
      return this.connection.endpoint;
    }
    return 'https://api.deepseek.com/v1/chat/completions';
  }`;

content = content.replace(oldGetEndpoint, newGetEndpoint);

// 5. Simplify getHeaders
const oldGetHeaders = `  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    switch (this.connection.provider) {
      case 'openai':
        headers['Authorization'] = \`Bearer \${this.connection.apiKey}\`;
        break;
      case 'anthropic':
        headers['x-api-key'] = this.connection.apiKey;
        headers['anthropic-version'] = '2023-06-01';
        break;
      case 'openrouter':
        headers['Authorization'] = \`Bearer \${this.connection.apiKey}\`;
        headers['HTTP-Referer'] = window.location.origin;
        break;
      case 'custom':
        if (this.connection.apiKey) {
          headers['Authorization'] = \`Bearer \${this.connection.apiKey}\`;
        }
        break;
      case 'ollama':
      case 'lmstudio':
        if (this.connection.apiKey) {
          headers['Authorization'] = \`Bearer \${this.connection.apiKey}\`;
        }
        break;
      case 'glm':
      case 'gemini':
      case 'mistral':
      case 'deepseek':
      case 'groq':
        headers['Authorization'] = \`Bearer \${this.connection.apiKey}\`;
        break;
    }

    return headers;
  }`;

const newGetHeaders = `  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.connection.apiKey) {
      headers['Authorization'] = \`Bearer \${this.connection.apiKey}\`;
    }
    return headers;
  }`;

content = content.replace(oldGetHeaders, newGetHeaders);

// 6. Simplify buildRequestBody - remove anthropic body, post-prompt processing call, non-deepseek reasoning
// First, remove the `applyPostPromptProcessing` call
content = content.replace(
  `const messages = applyPostPromptProcessing(rawMessages, this.preset.post_prompt_processing);`,
  `const messages = rawMessages;`
);

// Remove the legacy enableReasoning -> openai mapping
content = content.replace(
  `// Handle legacy enableReasoning flag\n    if (!reasoningMode && this.preset.enableReasoning) {\n      reasoningMode = 'openai';\n    }`,
  ``
);

// Remove the whole reasoning switch block and Anthropic body section
const reasoningSwitchStart = content.indexOf('// Apply reasoning parameters based on mode');
const reasoningSwitchEnd = content.indexOf('    return baseRequest;');
const anthropicSection = content.indexOf('    // Anthropic has a different API structure');

if (reasoningSwitchStart !== -1 && anthropicSection !== -1 && reasoningSwitchEnd !== -1) {
  const beforeSwitch = content.slice(0, reasoningSwitchStart);
  const afterAnthropic = content.slice(anthropicSection);
  const afterAnthropicEnd = afterAnthropic.indexOf('    return baseRequest;');
  
  if (afterAnthropicEnd !== -1) {
    const afterBaseRequest = afterAnthropic.slice(afterAnthropicEnd);
    content = beforeSwitch + '    // Reasoning disabled — DeepSeek-only build, [STATUS] compliance prioritized\n    // All reasoning mode code removed\n' + afterBaseRequest;
  }
}

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Phase 1 done');

// Now need to also handle the streaming function
// Let me check what's left
content = fs.readFileSync(filePath, 'utf-8');

// Remove Anthropic SSE handling from streamCompletion
if (content.includes("const isAnthropic = this.connection.provider === 'anthropic'")) {
  content = content.replace(
    `const isAnthropic = this.connection.provider === 'anthropic';`,
    `const isAnthropic = false; // DeepSeek-only build`
  );
}

// Remove the Anthropic streaming blocks
// First, remove the big if block for Anthropic in streaming
const anthropicStreamBlock = content.indexOf(`if (isAnthropic) {`);
const anthropicStreamEnd = content.indexOf(`} else {`);
if (anthropicStreamBlock !== -1 && anthropicStreamEnd !== -1) {
  const before = content.slice(0, anthropicStreamBlock);
  const afterBlock = content.slice(anthropicStreamEnd + 7); // skip '} else {'
  content = before + afterBlock;
}

// Remove the <think> tag tracking in streaming
// Find and simplify the think tag section
const thinkTagStart = content.indexOf(`// Universal <think> tag stripping`);
if (thinkTagStart !== -1) {
  const thinkSectionEnd = content.indexOf(`// Flush any unclosed <think> buffer`);
  if (thinkSectionEnd !== -1) {
    const beforeThink = content.slice(0, thinkTagStart);
    const afterThink = content.slice(thinkSectionEnd);
    // Find the actual end of think flushing block
    const flushEnd = afterThink.indexOf('// Apply output regex');
    if (flushEnd !== -1) {
      const flushHandle = afterThink.slice(0, flushEnd);
      // Find the closing } of the flush block
      const flushBlockEnd = flushHandle.indexOf(`}
      // Apply output regex`);
      if (flushBlockEnd !== -1) {
        const finalPart = afterThink.slice(flushBlockEnd);
        content = beforeThink + finalPart;
      }
    }
  }
}

// Remove the thinkBuffer variable declaration
content = content.replace(
  `// Track <think> tag state`,
  `// <think> tag handling removed — DeepSeek-only`
);

content = content.replace(
  `let inThinkTag = false;
      let thinkBuffer = '';`,
  ``
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Phase 2 done');

// Check for any remaining Anthropic-specific code in the complete() function
content = fs.readFileSync(filePath, 'utf-8');
const completeMethod = content.indexOf('// Non-streaming completion');
if (completeMethod !== -1) {
  const nextMethod = content.indexOf('// Abort ongoing request', completeMethod);
  if (nextMethod !== -1) {
    const completeSection = content.slice(completeMethod, nextMethod);
    // Simplify: remove Anthropic response parsing
    const simplified = completeSection.replace(
      /return data\.choices\?\.\[0\]\?\.message\?\.content\s*\|\|\s*data\.content\?\.\[0\]\?\.text\s*\|\|\s*'';/,
      `return data.choices?.[0]?.message?.content || '';`
    );
    content = content.slice(0, completeMethod) + simplified + content.slice(nextMethod);
  }
}

// Remove model listing for non-DeepSeek providers
const modelListStart = content.indexOf('// ===== 模型列表 =====');
if (modelListStart !== -1) {
  const nextSection = content.indexOf('// ===== ', modelListStart + 15);
  const untilSection = nextSection !== -1 ? nextSection : content.length;
  const modelSection = content.slice(modelListStart, untilSection);
  
  // Replace the entire model listing section with a DeepSeek-only version
  const newModelSection = `// ===== 模型列表 (DeepSeek-only) =====
const DEEPSEEK_MODELS = [
  'deepseek-chat',
  'deepseek-reasoner',
  'deepseek-r1',
  'deepseek-v3',
  'deepseek-v4',
];

const DEFAULT_MODELS: Record<string, string[]> = {
  deepseek: DEEPSEEK_MODELS,
  custom: ['custom-model'],
};

export async function fetchAvailableModels(connection: ConnectionProfile): Promise<{ id: string }[]> {
  const provider = connection.provider === 'custom' && connection.endpoint ? 'custom' : 'deepseek';
  if (provider === 'custom') {
    return [{ id: connection.model || 'custom-model' }];
  }

  try {
    const response = await fetch('https://api.deepseek.com/v1/models', {
      headers: { 'Authorization': \`Bearer \${connection.apiKey}\` },
    });
    if (response.ok) {
      const data = await response.json();
      return (data.data || []).map((m: any) => ({ id: m.id }));
    }
  } catch {}
  return DEFAULT_MODELS.deepseek.map(id => ({ id }));
}`;
  
  content = content.slice(0, modelListStart) + newModelSection + content.slice(untilSection);
}

// Remove unused imports
content = content.replace(
  `import type {
  ConnectionProfile,
  Preset,
  ChatCompletionRequest,
  CharacterCard,
  Persona,
  Message,
  LorebookEntry,
  APIProvider,
  ReasoningMode,
  PostPromptProcessing,
  AppSettings
} from '../types';`,
  `import type {
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
} from '../types';`
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Phase 3 done - api.ts fully cleaned');
