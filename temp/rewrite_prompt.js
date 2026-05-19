const fs = require('fs');
const filePath = 'E:/GitHub/Parlor/src/services/api.ts';
let content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

// Find buildSystemPrompt boundaries
let fnStart = -1, fnEnd = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('export function buildSystemPrompt(')) fnStart = i;
  if (fnStart !== -1 && lines[i].includes('// Build messages array for API request')) {
    fnEnd = i - 1;
    break;
  }
}
console.log('buildSystemPrompt:', fnStart, '-', fnEnd);

// Each line to be written as-is to the output .ts file
// Use \\ to represent a literal \n in the output
const newBody = [
'export function buildSystemPrompt(',
'  character: CharacterCard,',
'  persona?: Persona | null,',
'  customSystemPrompt?: string,',
'  preset?: Preset | null,',
'  responseLength?: \'short\' | \'medium\' | \'long\',',
'): string {',
'  // If preset has prompt entries, use the preset prompt system with variable substitution',
'  if (preset?.prompts && preset.prompts.length > 0) {',
'    const presetPrompt = buildPromptFromPreset(',
'      preset,',
'      buildPresetVariables(character, persona, customSystemPrompt),',
'    );',
'    if (presetPrompt) return presetPrompt;',
'  }',
'',
'  const parts: string[] = [];',
'',
'  // CRITICAL OUTPUT FORMAT - placed at the HEAD so DeepSeek never misses it',
'  parts.push(`You are roleplaying as ${character.name}. You MUST follow these rules EXACTLY:\\n' +
'\\n' +
'1. ALWAYS output *action* for actions, "dialogue" for speech, (thought) for inner monologue.\\n' +
'2. At the END of every response, you MUST append a [STATUS] block in valid JSON:\\n' +
'   [STATUS]\\n' +
'   {\\n' +
'     "time": "<current in-story time>",\\n' +
'     "location": "<current location>",\\n' +
'     "info": { "key": "value", ... },\\n' +
'     "status": { "key": "value", ... }\\n' +
'   }\\n' +
'   [/STATUS]\\n' +
'3. The [STATUS] block is NOT optional. Every single response must include it.`);',
'',
'  // Custom system prompt or default',
'  if (customSystemPrompt) {',
'    parts.push(`\\n${customSystemPrompt}`);',
'  } else {',
'    parts.push(\'\\nStay in character at all times. Respond as the character would.\');',
'  }',
'',
'  // Character info',
'  parts.push(`\\n## ${character.name}`);',
'  if (character.description) parts.push(`\\n${character.description}`);',
'  if (character.personality) parts.push(`\\nPersonality: ${character.personality}`);',
'  if (character.scenario) parts.push(`\\nScenario: ${character.scenario}`);',
'',
'  // Persona',
'  if (persona) {',
'    parts.push(`\\n## ${persona.name} (user)`);',
'    if (persona.description) parts.push(`\\n${persona.description}`);',
'    if (persona.personality) parts.push(`\\nPersonality: ${persona.personality}`);',
'  }',
'',
'  // Example dialogue',
'  if (character.mesExamples) parts.push(`\\n## Example Dialogue\\n${character.mesExamples}`);',
'',
'  // Post-history instructions',
'  if (character.postHistoryInstructions) parts.push(`\\n## Instructions\\n${character.postHistoryInstructions}`);',
'',
'  // Response length',
'  if (responseLength && responseLength !== \'medium\') {',
'    parts.push(responseLength === \'short\'',
'      ? \'\\nKeep responses short - 1-2 sentences maximum.\'',
'      : \'\\nKeep responses detailed - 6-10 sentences, fully elaborate.\');',
'  }',
'',
'  return parts.join(\'\\n\');',
'}',
];

// Write using the line-based approach
const before = lines.slice(0, fnStart).join('\n');
const after = lines.slice(fnEnd + 1).join('\n');
const result = before + '\n' + newBody.join('\n') + '\n' + after;
fs.writeFileSync(filePath, result, 'utf-8');
console.log('Done!');
