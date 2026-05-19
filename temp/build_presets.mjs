import { readFileSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';

// ── Read source SillyTavern preset ──
const sourcePath = "C:\\Users\\星落\\Downloads\\Tavo__20251211T2312.jsonTavo_墨_20251211T2312.json";
const raw = readFileSync(sourcePath, 'utf-8');
const src = JSON.parse(raw);

// ── Read existing presets.json ──
const presetsPath = "E:\\GitHub\\Parlor\\data\\presets.json";
const existing = JSON.parse(readFileSync(presetsPath, 'utf-8'));

// ── Helper: safely parse numeric values ──
function num(v, def) {
  return (v != null && !isNaN(Number(v))) ? Number(v) : def;
}

// ── Helper: generate UUID ──
function uuid() {
  return randomUUID();
}

// ── Build preset from source ──
function buildPreset(name, id, extraPrompts = [], extraOrder = []) {
  const prompts = (src.prompts || []).map(p => ({
    identifier: String(p.identifier || ''),
    name: String(p.name || 'Unnamed'),
    content: String(p.content || ''),
    role: (p.role || 'system'),
    system_prompt: Boolean(p.system_prompt),
    marker: Boolean(p.marker),
    enabled: p.enabled !== false,
    injection_position: Number(p.injection_position) || 0,
    injection_depth: Number(p.injection_depth) || 0,
    forbid_overrides: Boolean(p.forbid_overrides),
  }));

  let promptOrder = [];
  if (src.prompt_order && Array.isArray(src.prompt_order)) {
    const orderData = src.prompt_order[0];
    if (orderData && Array.isArray(orderData.order)) {
      promptOrder = orderData.order.map(o => ({
        identifier: o.identifier || '',
        enabled: o.enabled !== false,
      }));
    }
  }

  // Append extra prompts and order entries
  prompts.push(...extraPrompts);
  promptOrder.push(...extraOrder);

  return {
    id,
    name,
    temperature: num(src.temperature, 1.0),
    topP: num(src.top_p, 1.0),
    topK: src.top_k !== undefined ? Number(src.top_k) : undefined,
    minP: src.min_p !== undefined ? Number(src.min_p) : undefined,
    frequencyPenalty: num(src.frequency_penalty, 0),
    presencePenalty: num(src.presence_penalty, 0),
    maxTokens: num(src.max_tokens || src.max_response_length || src.openai_max_tokens, 4096),
    stopSequences: Array.isArray(src.stop) ? [...src.stop] : [],
    reasoningMode: 'deepseek',
    post_prompt_processing: 'none',
    impersonation_prompt: String(src.impersonation_prompt || ''),
    new_chat_prompt: String(src.new_chat_prompt || ''),
    new_group_chat_prompt: String(src.new_group_chat_prompt || ''),
    new_example_chat_prompt: String(src.new_example_chat_prompt || ''),
    continue_nudge_prompt: String(src.continue_nudge_prompt || ''),
    group_nudge_prompt: String(src.group_nudge_prompt || ''),
    scenario_format: String(src.scenario_format || '{{scenario}}'),
    personality_format: String(src.personality_format || '{{personality}}'),
    wi_format: String(src.wi_format || '{0}'),
    prompts,
    prompt_order: promptOrder,
    isDefault: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ── Build "墨的扮演协议" ──
const preset1 = buildPreset('墨的扮演协议', 'f47ac10b-58cc-4372-a567-0e02b2c3d479');

// ── Build "墨的扮演协议 - 状态栏版" ──
const statusBarPrompt = {
  identifier: 'status-bar-monitor',
  name: '状态栏',
  system_prompt: false,
  marker: false,
  content: `<Status_Bar>\n在每个回复的末尾用分隔线隔开，输出一个简洁的状态栏：\n\n【场景】当前场景的简要描述\n【位置】当前位置  \n【时间】当前时间  \n【{{char}} 状态】{{char}} 当前的情绪和身体状态  \n\n格式保持简洁，用【】包裹字段名，冒号后跟内容。\n这个状态栏用于辅助 UI 显示，是叙事的一部分。\n</Status_Bar>`,
  role: 'system',
  injection_position: 0,
  injection_depth: 4,
  forbid_overrides: false,
  enabled: true,
};

const preset2 = buildPreset(
  '墨的扮演协议 - 状态栏版',
  'a1b2c3d4-e5f6-4789-abcd-ef0123456789',
  [statusBarPrompt],
  [{ identifier: 'status-bar-monitor', enabled: true }]
);

// ── Combine ──
const result = [...existing, preset1, preset2];

// ── Write ──
writeFileSync(presetsPath, JSON.stringify(result, null, 2), 'utf-8');
console.log(`Done! Presets: ${result.length} (${existing.length} existing + 2 new)`);
console.log(`  1. ${preset1.name} (${preset1.id}) - ${preset1.prompts.length} prompts`);
console.log(`  2. ${preset2.name} (${preset2.id}) - ${preset2.prompts.length} prompts`);
