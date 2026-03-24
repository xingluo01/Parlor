import type { Preset, PromptEntry, PromptOrderEntry, PostPromptProcessing } from '../types';
import { generateUUID } from './uuid';

// ──────────────────────────────────────────────────────────────
// Template variable substitution
// ──────────────────────────────────────────────────────────────

export type PresetBuildVariables = {
  charName?: string;
  userName?: string;
  charDescription?: string;
  charPersonality?: string;
  scenario?: string;
  personaDescription?: string;
  worldInfoBefore?: string;
  worldInfoAfter?: string;
  mesExamples?: string;
  creatorNotes?: string;
  systemPrompt?: string;
  postHistoryInstructions?: string;
};

/**
 * Replace all SillyTavern template variables in a content string.
 * Handles both the camelCase Parlor names and the short ST aliases.
 */
export function substituteTemplateVars(content: string, vars: PresetBuildVariables): string {
  const {
    charName = '',
    userName = 'User',
    charDescription = '',
    charPersonality = '',
    scenario = '',
    personaDescription = '',
    worldInfoBefore = '',
    worldInfoAfter = '',
    mesExamples = '',
    creatorNotes = '',
    systemPrompt = '',
    postHistoryInstructions = '',
  } = vars;

  return content
    // Core entity names — used in nearly every ST preset
    .replace(/\{\{char\}\}/gi, charName)
    .replace(/\{\{user\}\}/gi, userName)
    // Character description — ST uses {{description}}, Parlor used {{charDescription}}
    .replace(/\{\{description\}\}/gi, charDescription)
    .replace(/\{\{charDescription\}\}/gi, charDescription)
    .replace(/\{\{char_description\}\}/gi, charDescription)
    // Personality — ST uses {{personality}}
    .replace(/\{\{personality\}\}/gi, charPersonality)
    .replace(/\{\{charPersonality\}\}/gi, charPersonality)
    .replace(/\{\{char_personality\}\}/gi, charPersonality)
    // Scenario
    .replace(/\{\{scenario\}\}/gi, scenario)
    // User persona — ST uses {{persona}}
    .replace(/\{\{persona\}\}/gi, personaDescription)
    .replace(/\{\{personaDescription\}\}/gi, personaDescription)
    .replace(/\{\{user_description\}\}/gi, personaDescription)
    // World info — ST uses {{wiBefore}} / {{wiAfter}} as short aliases
    .replace(/\{\{worldInfoBefore\}\}/gi, worldInfoBefore)
    .replace(/\{\{wiBefore\}\}/gi, worldInfoBefore)
    .replace(/\{\{worldInfoAfter\}\}/gi, worldInfoAfter)
    .replace(/\{\{wiAfter\}\}/gi, worldInfoAfter)
    // Extended character card fields
    .replace(/\{\{mesExamples\}\}/gi, mesExamples)
    .replace(/\{\{mes_examples\}\}/gi, mesExamples)
    .replace(/\{\{creatorNotes\}\}/gi, creatorNotes)
    .replace(/\{\{creator_notes\}\}/gi, creatorNotes)
    .replace(/\{\{systemPrompt\}\}/gi, systemPrompt)
    .replace(/\{\{system_prompt\}\}/gi, systemPrompt)
    // Post-history instructions / jailbreak — ST uses {{jailbreak}} as alias
    .replace(/\{\{postHistoryInstructions\}\}/gi, postHistoryInstructions)
    .replace(/\{\{jailbreak\}\}/gi, postHistoryInstructions);
}

// ──────────────────────────────────────────────────────────────
// Built-in ST marker handling
// ──────────────────────────────────────────────────────────────

/**
 * ST uses these identifiers as "built-in markers" in prompt_order.
 * They appear in the order list but may not have a matching entry in the
 * prompts array — ST generates their content from the character card / world info.
 */
const BUILTIN_MARKER_IDS = new Set([
  'worldInfoBefore',
  'charDescription',
  'charPersonality',
  'scenario',
  'personaDescription',
  'worldInfoAfter',
  'dialogueExamples',
  'chatStart',
  'chatHistory', // some versions use chatHistory instead of chatStart
]);

/**
 * Return the content that should be injected for a built-in ST marker.
 * Uses personality_format / scenario_format where appropriate.
 */
function getBuiltinMarkerContent(
  identifier: string,
  vars: PresetBuildVariables,
  personalityFormat: string,
  scenarioFormat: string,
  newExampleChatPrompt?: string,
): string {
  switch (identifier) {
    case 'worldInfoBefore':
      return vars.worldInfoBefore || '';

    case 'charDescription':
      return vars.charDescription || '';

    case 'charPersonality':
      if (!vars.charPersonality) return '';
      // Apply the preset's personality_format template with full variable substitution
      return substituteTemplateVars(personalityFormat, vars);

    case 'scenario':
      if (!vars.scenario) return '';
      // Apply the preset's scenario_format template with full variable substitution
      return substituteTemplateVars(scenarioFormat, vars);

    case 'personaDescription':
      return vars.personaDescription || '';

    case 'worldInfoAfter':
      return vars.worldInfoAfter || '';

    case 'dialogueExamples': {
      if (!vars.mesExamples) return '';
      const separator = newExampleChatPrompt || '';
      return separator ? `${separator}\n${vars.mesExamples}` : vars.mesExamples;
    }

    case 'chatStart':
    case 'chatHistory':
      // Separator between system context and chat messages — no text content
      return '';

    default:
      return '';
  }
}

// ──────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────

/**
 * Return the enabled prompt entries sorted by prompt_order.
 * Exported for external consumers (e.g. debugging / display).
 */
export function getOrderedPrompts(preset: Preset): PromptEntry[] {
  if (!preset.prompts || preset.prompts.length === 0) return [];

  if (preset.prompt_order && preset.prompt_order.length > 0) {
    const orderMap = new Map<string, number>();
    const disabledByOrder = new Set<string>();

    preset.prompt_order.forEach((entry, index) => {
      if (entry.enabled) {
        orderMap.set(entry.identifier, index);
      } else {
        disabledByOrder.add(entry.identifier);
      }
    });

    return preset.prompts
      .filter(p => p.enabled !== false && !disabledByOrder.has(p.identifier))
      .sort((a, b) => {
        const orderA = orderMap.get(a.identifier) ?? 999;
        const orderB = orderMap.get(b.identifier) ?? 999;
        return orderA - orderB;
      });
  }

  return preset.prompts.filter(p => p.enabled !== false);
}

/**
 * Build the system prompt string from a preset and character variables.
 *
 * Handles:
 * - Built-in ST markers (worldInfoBefore, charDescription, charPersonality,
 *   scenario, personaDescription, worldInfoAfter, dialogueExamples, chatStart)
 * - All ST template variables: {{char}}, {{user}}, {{description}},
 *   {{personality}}, {{persona}}, {{wiBefore}}, {{wiAfter}}, {{mesExamples}},
 *   {{creatorNotes}}, {{systemPrompt}}, {{jailbreak}}, etc.
 * - personality_format and scenario_format preset strings
 * - prompt_order-driven sequencing
 */
export function buildPromptFromPreset(preset: Preset, variables: PresetBuildVariables): string {
  if (!preset.prompts || preset.prompts.length === 0) {
    return '';
  }

  const personalityFormat = preset.personality_format || '{{personality}}';
  const scenarioFormat = preset.scenario_format || '{{scenario}}';
  const newExampleChatPrompt = preset.new_example_chat_prompt || '';

  // Quick lookup for prompt entries by identifier
  const promptMap = new Map<string, PromptEntry>();
  for (const p of preset.prompts) {
    promptMap.set(p.identifier, p);
  }

  /**
   * Resolve the effective content for a prompt entry.
   * Implements SillyTavern's forbid_overrides behaviour:
   * - "main" entry: character's systemPrompt replaces content unless forbid_overrides
   * - "jailbreak" entry: character's postHistoryInstructions replaces content unless forbid_overrides
   */
  const resolveContent = (prompt: PromptEntry): string => {
    if (!prompt.forbid_overrides) {
      if (prompt.identifier === 'main' && variables.systemPrompt) {
        return variables.systemPrompt;
      }
      if (prompt.identifier === 'jailbreak' && variables.postHistoryInstructions) {
        return variables.postHistoryInstructions;
      }
    }
    return prompt.content;
  };

  const parts: string[] = [];

  if (preset.prompt_order && preset.prompt_order.length > 0) {
    // Drive order from prompt_order — this is how ST processes presets
    const processedIds = new Set<string>();

    for (const orderEntry of preset.prompt_order) {
      if (!orderEntry.enabled) {
        processedIds.add(orderEntry.identifier); // explicitly disabled
        continue;
      }

      const id = orderEntry.identifier;
      processedIds.add(id);

      if (BUILTIN_MARKER_IDS.has(id)) {
        // Check if the user provided a custom override for this built-in slot
        const custom = promptMap.get(id);
        if (custom && !custom.marker && custom.enabled !== false && custom.content) {
          const content = substituteTemplateVars(resolveContent(custom), variables);
          if (content.trim()) parts.push(content);
        } else {
          // Inject the built-in content (charDescription, personality, etc.)
          const content = getBuiltinMarkerContent(id, variables, personalityFormat, scenarioFormat, newExampleChatPrompt);
          if (content.trim()) parts.push(content);
        }
        continue;
      }

      // Regular user-defined prompt entry
      const prompt = promptMap.get(id);
      if (!prompt || prompt.enabled === false || prompt.marker) continue;

      // injection_position:1 entries belong in the chat history (handled by getDepthInjections)
      if (prompt.injection_position === 1) continue;

      const resolved = resolveContent(prompt);
      if (!resolved) continue;
      const content = substituteTemplateVars(resolved, variables);
      if (content.trim()) parts.push(content);
    }

    // Second pass: include prompts that exist in the prompts array but aren't
    // listed in prompt_order at all (not explicitly disabled, just absent).
    for (const prompt of preset.prompts) {
      if (processedIds.has(prompt.identifier)) continue;
      if (prompt.enabled === false || prompt.marker) continue;
      if (prompt.injection_position === 1) continue;
      if (BUILTIN_MARKER_IDS.has(prompt.identifier)) continue;

      const resolved = resolveContent(prompt);
      if (!resolved) continue;
      const content = substituteTemplateVars(resolved, variables);
      if (content.trim()) parts.push(content);
    }
  } else {
    // No prompt_order — fall back to original array order
    for (const prompt of preset.prompts) {
      if (prompt.enabled === false) continue;

      if (prompt.marker || BUILTIN_MARKER_IDS.has(prompt.identifier)) {
        const content = getBuiltinMarkerContent(
          prompt.identifier, variables, personalityFormat, scenarioFormat, newExampleChatPrompt,
        );
        if (content.trim()) parts.push(content);
        continue;
      }

      // injection_position:1 entries belong in the chat history (handled by getDepthInjections)
      if (prompt.injection_position === 1) continue;

      const resolved = resolveContent(prompt);
      if (!resolved) continue;
      const content = substituteTemplateVars(resolved, variables);
      if (content.trim()) parts.push(content);
    }
  }

  return parts.join('\n\n');
}

// ──────────────────────────────────────────────────────────────
// Depth injection (injection_position: 1)
// ──────────────────────────────────────────────────────────────

/**
 * A prompt entry that should be spliced into the chat history at a specific
 * depth from the end, rather than placed in the system prompt.
 * depth: 0 = after the last message, 1 = before the last message, etc.
 */
export type DepthInjection = {
  content: string;
  role: 'system' | 'user' | 'assistant';
  depth: number;
};

/**
 * Collect all injection_position:1 prompts from the preset.
 * Returns them sorted deepest-first so callers can splice them into
 * apiMessages without earlier insertions shifting later positions.
 */
export function getDepthInjections(preset: Preset, variables: PresetBuildVariables): DepthInjection[] {
  if (!preset.prompts || preset.prompts.length === 0) return [];

  const hasOrder = preset.prompt_order && preset.prompt_order.length > 0;
  // Track prompts explicitly disabled in prompt_order (enabled: false).
  // Prompts absent from prompt_order entirely are still included.
  const disabledByOrder = new Set<string>();
  if (hasOrder) {
    for (const entry of preset.prompt_order!) {
      if (!entry.enabled) disabledByOrder.add(entry.identifier);
    }
  }

  const injections: DepthInjection[] = [];

  for (const prompt of preset.prompts) {
    if (prompt.injection_position !== 1) continue;
    if (prompt.enabled === false) continue;
    if (disabledByOrder.has(prompt.identifier)) continue;
    if (prompt.marker) continue;

    // Apply forbid_overrides: "main"/"jailbreak" entries can be replaced by character fields
    let rawContent = prompt.content;
    if (!prompt.forbid_overrides) {
      if (prompt.identifier === 'main' && variables.systemPrompt) {
        rawContent = variables.systemPrompt;
      } else if (prompt.identifier === 'jailbreak' && variables.postHistoryInstructions) {
        rawContent = variables.postHistoryInstructions;
      }
    }
    if (!rawContent) continue;

    const content = substituteTemplateVars(rawContent, variables);
    if (!content.trim()) continue;

    injections.push({
      content,
      role: prompt.role || 'system',
      depth: prompt.injection_depth ?? 0,
    });
  }

  // Deepest first — so splicing doesn't shift the insertion point of shallower entries
  return injections.sort((a, b) => b.depth - a.depth);
}

// ──────────────────────────────────────────────────────────────
// Preset import / validation
// ──────────────────────────────────────────────────────────────

/** Parse a SillyTavern preset JSON into a Parlor Preset object. */
export function parseSillyTavernPreset(json: unknown, fileName?: string): Preset {
  const data = json as Record<string, unknown>;

  // Extract prompt entries
  const prompts: PromptEntry[] = [];
  if (Array.isArray(data.prompts)) {
    for (const p of data.prompts) {
      const prompt = p as Record<string, unknown>;
      prompts.push({
        identifier: String(prompt.identifier || ''),
        name: String(prompt.name || 'Unnamed'),
        content: String(prompt.content || ''),
        role: (prompt.role as 'system' | 'user' | 'assistant') || 'system',
        system_prompt: Boolean(prompt.system_prompt),
        marker: Boolean(prompt.marker),
        enabled: prompt.enabled !== false,
        injection_position: Number(prompt.injection_position) || 0,
        injection_depth: Number(prompt.injection_depth) || 0,
        forbid_overrides: Boolean(prompt.forbid_overrides),
      });
    }
  }

  // Extract prompt order
  let promptOrder: PromptOrderEntry[] = [];
  if (data.prompt_order && Array.isArray(data.prompt_order)) {
    // ST format: prompt_order is an array of { character_id, order[] }
    const orderData = data.prompt_order[0] as Record<string, unknown>;
    if (orderData && Array.isArray(orderData.order)) {
      promptOrder = orderData.order.map((o: { identifier?: string; enabled?: boolean }) => ({
        identifier: o.identifier || '',
        enabled: o.enabled !== false,
      }));
    } else if (Array.isArray(data.prompt_order) && typeof (data.prompt_order[0] as Record<string, unknown>)?.identifier === 'string') {
      // Flat format: prompt_order is already an array of { identifier, enabled }
      promptOrder = (data.prompt_order as Array<{ identifier?: string; enabled?: boolean }>).map(o => ({
        identifier: o.identifier || '',
        enabled: o.enabled !== false,
      }));
    }
  }

  // Extract name from file name or data
  const name = fileName
    ? fileName.replace(/\.json$/i, '').replace(/_/g, ' ')
    : String(data.name || 'Imported Preset');

  // max_tokens: ST uses several aliases across versions
  const maxTokens =
    Number(data.max_tokens) ||
    Number(data.max_response_length) ||
    Number(data.openai_max_tokens) ||
    4096;

  // Safely parse numeric values — preserves 0 as a valid value (unlike `Number(x) || default`)
  const num = (v: unknown, def: number) => v != null && !isNaN(Number(v)) ? Number(v) : def;

  return {
    id: generateUUID(),
    name,
    temperature: num(data.temperature, 1.0),
    topP: num(data.top_p, 1.0),
    topK: data.top_k !== undefined ? Number(data.top_k) : undefined,
    minP: data.min_p !== undefined ? Number(data.min_p) : undefined,
    frequencyPenalty: num(data.frequency_penalty, 0),
    presencePenalty: num(data.presence_penalty, 0),
    maxTokens,
    stopSequences: Array.isArray(data.stop) ? (data.stop as string[]) : undefined,

    prompts,
    prompt_order: promptOrder,

    impersonation_prompt: String(data.impersonation_prompt || ''),
    new_chat_prompt: String(data.new_chat_prompt || ''),
    new_group_chat_prompt: String(data.new_group_chat_prompt || ''),
    new_example_chat_prompt: String(data.new_example_chat_prompt || ''),
    continue_nudge_prompt: String(data.continue_nudge_prompt || ''),
    group_nudge_prompt: String(data.group_nudge_prompt || ''),
    scenario_format: String(data.scenario_format || '{{scenario}}'),
    personality_format: String(data.personality_format || '{{personality}}'),
    wi_format: String(data.wi_format || '{0}'),
    post_prompt_processing: (typeof data.post_prompt_processing === 'string' ? data.post_prompt_processing : 'none') as PostPromptProcessing,

    isDefault: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** Loosely validate whether a JSON object looks like a preset file. */
export function isValidPresetFormat(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return (
    Array.isArray(obj.prompts) ||
    typeof obj.temperature === 'number' ||
    typeof obj.top_p === 'number' ||
    typeof obj.impersonation_prompt === 'string'
  );
}
