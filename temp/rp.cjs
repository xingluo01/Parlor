const fs = require('fs');
const filePath = 'E:/GitHub/Parlor/src/services/api.ts';
let content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

let fnStart = -1, fnEnd = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('export function buildSystemPrompt(')) fnStart = i;
  if (fnStart !== -1 && lines[i].includes('// Build messages array for API request')) {
    fnEnd = i - 1;
    break;
  }
}
console.log('buildSystemPrompt:', fnStart, '-', fnEnd);

const newBody = [
'export function buildSystemPrompt(',
'  character: CharacterCard,',
'  persona?: Persona | null,',
'  customSystemPrompt?: string,',
'  preset?: Preset | null,',
'  responseLength?: \'short\' | \'medium\' | \'long\',',
'): string {',
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
'  parts.push(`You are roleplaying as ${character.name}. You MUST follow these rules EXACTLY:\\n\\n1. ALWAYS output *action* for actions, "dialogue" for speech, (thought) for inner monologue.\\n2. At the END of every response, you MUST append a [STATUS] block in valid JSON:\\n   [STATUS]\\n   {\\n     "time": "<current in-story time>",\\n     "location": "<current location>",\\n     "info": { "key": "value", ... },\\n     "status": { "key": "value", ... }\\n   }\\n   [/STATUS]\\n3. The [STATUS] block is NOT optional. Every single response must include it.`);',
'',
'  if (customSystemPrompt) {',
'    parts.push(`${customSystemPrompt}`);',
'  } else {',
'    parts.push(\'Stay in character at all times. Respond as the character would.\');',
'  }',
'',
'  parts.push(`## ${character.name}`);',
'  if (character.description) parts.push(`${character.description}`);',
'  if (character.personality) parts.push(`Personality: ${character.personality}`);',
'  if (character.scenario) parts.push(`Scenario: ${character.scenario}`);',
'',
'  if (persona) {',
'    parts.push(`## ${persona.name} (user)`);',
'    if (persona.description) parts.push(`${persona.description}`);',
'    if (persona.personality) parts.push(`Personality: ${persona.personality}`);',
'  }',
'',
'  if (character.mesExamples) parts.push(`## Example Dialogue\\n${character.mesExamples}`);',
'  if (character.postHistoryInstructions) parts.push(`## Instructions\\n${character.postHistoryInstructions}`);',
'',
'  if (responseLength && responseLength !== \'medium\') {',
'    parts.push(responseLength === \'short\'',
'      ? \'Keep responses short - 1-2 sentences maximum.\'',
'      : \'Keep responses detailed - 6-10 sentences, fully elaborate.\');',
'  }',
'',
'  return parts.join(\'\\n\');',
'}',
];

const before = lines.slice(0, fnStart).join('\n');
const after = lines.slice(fnEnd + 1).join('\n');
const result = before + '\n' + newBody.join('\n') + '\n' + after;
fs.writeFileSync(filePath, result, 'utf-8');
console.log('Done!');
