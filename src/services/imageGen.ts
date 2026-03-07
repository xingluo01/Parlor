import type { ImageGenSettings } from '../types';

export async function generateImage(
  prompt: string,
  settings: ImageGenSettings,
  apiKey?: string,
): Promise<string> {
  // Returns a base64 data URL or blob URL of the generated image
  switch (settings.provider) {
    case 'dalle': return generateWithDALLE(prompt, settings, apiKey);
    case 'sd-webui': return generateWithSDWebUI(prompt, settings);
    case 'comfyui': return generateWithComfyUI(prompt, settings);
    default: throw new Error(`Unknown provider: ${settings.provider}`);
  }
}

async function generateWithDALLE(
  prompt: string,
  settings: ImageGenSettings,
  apiKey?: string,
): Promise<string> {
  if (!apiKey) throw new Error('API key required for DALL-E');
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.model || 'dall-e-3',
      prompt,
      n: 1,
      size: `${settings.width || 1024}x${settings.height || 1024}`,
      response_format: 'b64_json',
    }),
  });
  if (!response.ok) throw new Error(`DALL-E error: ${response.status}`);
  const data = await response.json();
  return `data:image/png;base64,${data.data[0].b64_json}`;
}

async function generateWithSDWebUI(
  prompt: string,
  settings: ImageGenSettings,
): Promise<string> {
  const endpoint = settings.endpoint || 'http://localhost:7860';
  const response = await fetch(`${endpoint}/sdapi/v1/txt2img`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      width: settings.width || 512,
      height: settings.height || 512,
      steps: 20,
    }),
  });
  if (!response.ok) throw new Error(`SD WebUI error: ${response.status}`);
  const data = await response.json();
  return `data:image/png;base64,${data.images[0]}`;
}

async function generateWithComfyUI(
  _prompt: string,
  settings: ImageGenSettings,
): Promise<string> {
  // ComfyUI has a more complex workflow-based API
  // For now, use a simplified text2img approach
  const endpoint = settings.endpoint || 'http://localhost:8188';
  const response = await fetch(`${endpoint}/api/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: {
        '3': {
          class_type: 'KSampler',
          inputs: { seed: Math.floor(Math.random() * 1e15) },
        },
      },
      // Simplified - real ComfyUI needs full workflow JSON
    }),
  });
  if (!response.ok) throw new Error(`ComfyUI error: ${response.status}`);
  const data = await response.json();
  return data.images?.[0] || '';
}

export function isImageGenEnabled(settings?: ImageGenSettings): boolean {
  return !!settings?.enabled;
}
