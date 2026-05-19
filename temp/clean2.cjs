const fs = require('fs');
const filePath = 'E:/GitHub/Parlor/src/services/api.ts';
let content = fs.readFileSync(filePath, 'utf-8');
let lines = content.split('\n');

// 1. Remove post-prompt processing section
let postPromptStart = -1, postPromptEnd = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('// Post-prompt processing (SillyTavern-compatible)')) postPromptStart = i;
  if (postPromptStart !== -1 && lines[i].includes('export class APIClient')) {
    postPromptEnd = i - 1;
    break;
  }
}
console.log('Post-prompt block:', postPromptStart, '-', postPromptEnd);
if (postPromptStart !== -1 && postPromptEnd !== -1) {
  lines.splice(postPromptStart, postPromptEnd - postPromptStart);
}

// 2. Find all APIClient and fetchAvailableModels
content = lines.join('\n');
lines = content.split('\n');

const apiClientLines = [];
const fetchModelsLines = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('export class APIClient')) apiClientLines.push(i);
  if (lines[i].includes('export async function fetchAvailableModels')) fetchModelsLines.push(i);
}
console.log('APIClient:', apiClientLines);
console.log('fetchModels:', fetchModelsLines);

// 3. Remove the OLD APIClient (first occurrence) and everything up to the NEW fetchAvailableModels
if (apiClientLines.length >= 2) {
  // Remove from first APIClient to just before the second fetchAvailableModels
  const removeFrom = apiClientLines[0];
  const removeTo = fetchModelsLines[fetchModelsLines.length - 1];
  console.log('Removing lines', removeFrom, 'to', removeTo - 1);
  lines.splice(removeFrom, removeTo - removeFrom);
}

// 4. Fix DEFAULT_MODELS export
content = lines.join('\n');
content = content.replace('const DEFAULT_MODELS:', 'export const DEFAULT_MODELS:');

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Done. Lines:', content.split('\n').length);
