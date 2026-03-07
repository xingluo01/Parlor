import type { CharacterCard } from '../types';
import { generateUUID } from './uuid';

// PNG file signature bytes
const PNG_SIGNATURE = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

interface PngChunk {
  type: string;
  data: Uint8Array;
  crc: number;
}

// Read PNG chunks from ArrayBuffer
function readPngChunks(buffer: ArrayBuffer): PngChunk[] {
  const view = new DataView(buffer);
  
  // Verify PNG signature
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (view.getUint8(i) !== PNG_SIGNATURE[i]) {
      throw new Error('Not a valid PNG file');
    }
  }

  const chunks: PngChunk[] = [];
  let offset = 8; // Skip PNG signature

  while (offset < buffer.byteLength) {
    if (offset + 8 > buffer.byteLength) break;
    
    const length = view.getUint32(offset, false); // Big-endian
    offset += 4;

    const typeBytes = new Uint8Array(buffer, offset, 4);
    const type = String.fromCharCode(...typeBytes);
    offset += 4;

    if (offset + length + 4 > buffer.byteLength) break;
    
    const data = new Uint8Array(buffer, offset, length);
    offset += length;
    
    const crc = view.getUint32(offset, false);
    offset += 4;

    chunks.push({ type, data, crc });

    if (type === 'IEND') break;
  }

  return chunks;
}

// Decode tEXt chunk data
function decodeTextChunk(data: Uint8Array): { keyword: string; text: string } | null {
  try {
    // Find the null separator between keyword and text
    const nullIndex = data.indexOf(0);
    if (nullIndex === -1 || nullIndex === data.length - 1) return null;
    
    const keywordBytes = data.slice(0, nullIndex);
    const textBytes = data.slice(nullIndex + 1);
    
    // Keyword is always latin1 (ASCII)
    const keyword = new TextDecoder('latin1').decode(keywordBytes);
    
    // Text is typically base64 encoded UTF-8, but decode as latin1 first to get raw bytes
    // The base64 decode will handle the actual character encoding
    const text = new TextDecoder('latin1').decode(textBytes);
    
    return { keyword, text };
  } catch {
    return null;
  }
}

// Extract character data from PNG (TavernAI/SillyTavern format)
export async function extractCharacterFromPng(file: File): Promise<Partial<CharacterCard> | null> {
  try {
    const buffer = await file.arrayBuffer();
    const chunks = readPngChunks(buffer);

    // Look for tEXt chunks with character data
    for (const chunk of chunks) {
      if (chunk.type === 'tEXt') {
        const decoded = decodeTextChunk(chunk.data);
        if (!decoded) continue;

        const { keyword, text } = decoded;

        // TavernAI/SillyTavern uses "chara" as the keyword
        if (keyword === 'chara' || keyword === 'character' || keyword.toLowerCase() === 'chara') {
          try {
            const binaryString = atob(text);

            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const decoded = new TextDecoder('utf-8').decode(bytes);

            const charData = JSON.parse(decoded);
            return normalizeCharacterData(charData);
          } catch {
            // Try parsing as raw JSON (some formats don't base64 encode)
            try {
              const charData = JSON.parse(text);
              return normalizeCharacterData(charData);
            } catch {
              // Both parsing methods failed for this chunk
            }
          }
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

// Parse JSON character file
export async function parseCharacterJson(file: File): Promise<Partial<CharacterCard> | null> {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    return normalizeCharacterData(data);
  } catch {
    return null;
  }
}

// Convert file to base64 for storage
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Normalize character data from various formats (Tavern, SillyTavern, etc.)
function normalizeCharacterData(data: any): Partial<CharacterCard> {
  // Handle data wrapped in a "data" property (some formats)
  if (data.data && typeof data.data === 'object') {
    data = data.data;
  }

  // Handle Spec v2 format with "spec" and "spec_version" fields
  if (data.spec === 'chara_card_v2' && data.data) {
    data = data.data;
  }

  const char: Partial<CharacterCard> = {
    id: generateUUID(),
    name: data.name || data.char_name || 'Unknown Character',
    description: data.description || data.char_persona || '',
    personality: data.personality || data.char_persona || '',
    scenario: data.scenario || data.world_scenario || '',
    firstMessage: data.first_mes || data.char_greeting || data.first_message || '',
    systemPrompt: data.system_prompt || data.system_prompt_instruction || '',
    postHistoryInstructions: data.post_history_instructions || '',
    creatorNotes: data.creator_notes || data.notes || '',
    mesExamples: data.mes_examples || data.mes_example || '',
    tags: Array.isArray(data.tags) ? data.tags : [],
    alternateGreetings: Array.isArray(data.alternate_greetings) ? data.alternate_greetings : [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Handle lorebook/character book
  if (data.character_book || data.lorebook) {
    const book = data.character_book || data.lorebook;
    if (Array.isArray(book.entries)) {
      char.characterBook = {
        entries: book.entries.map((entry: any, index: number) => ({
          id: entry.id || entry.uid || generateUUID(),
          keywords: entry.keywords || entry.keys || entry.key || [],
          content: entry.content || entry.text || '',
          enabled: entry.enabled ?? entry.disable ?? true,
          insertionOrder: entry.insertion_order ?? entry.order ?? index,
          caseSensitive: entry.case_sensitive ?? false,
        })),
      };
    }
  }

  // Handle gallery images
  if (Array.isArray(data.gallery) && data.gallery.length) {
    char.gallery = data.gallery.map((img: any) => ({
      id: generateUUID(),
      url: typeof img === 'string' ? img : img.url || '',
      caption: img.caption || '',
    }));
  }

  return char;
}

// Import character from file (auto-detect format)
export async function importCharacterFromFile(file: File): Promise<{
  character: Partial<CharacterCard>;
  avatarData?: string;
} | null> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  let character: Partial<CharacterCard> | null = null;
  let avatarData: string | undefined;

  if (extension === 'png') {
    // Try to extract embedded character data
    character = await extractCharacterFromPng(file);
    
    // Also extract the image for avatar
    avatarData = await fileToBase64(file);
    
    if (!character) {
      character = {
        id: generateUUID(),
        name: file.name.replace(/\.png$/i, ''),
        description: '',
        personality: '',
        scenario: '',
        firstMessage: '',
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }
  } else if (extension === 'json') {
    character = await parseCharacterJson(file);
  } else {
    throw new Error(`Unsupported file format: ${extension}`);
  }

  if (!character) {
    return null;
  }

  // Add avatar if we have it and character doesn't already have one
  if (avatarData && !character.avatar) {
    character.avatar = avatarData;
  }

  return { character, avatarData };
}

// Export character to JSON
export function exportCharacterToJson(character: CharacterCard): string {
  const exportData = {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: character.name,
      description: character.description,
      personality: character.personality,
      scenario: character.scenario,
      first_mes: character.firstMessage,
      system_prompt: character.systemPrompt,
      post_history_instructions: character.postHistoryInstructions,
      creator_notes: character.creatorNotes,
      mes_examples: character.mesExamples || '',
      tags: character.tags,
      alternate_greetings: character.alternateGreetings,
      character_book: character.characterBook,
    }
  };

  return JSON.stringify(exportData, null, 2);
}

// ──────────────────────────────────────────────────────────────
// PNG Export — embeds V2 character data as a tEXt chunk
// ──────────────────────────────────────────────────────────────

/** CRC32 lookup table (pre-computed). */
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/** Build a PNG tEXt chunk: keyword + null separator + text content. */
function buildTextChunk(keyword: string, text: string): Uint8Array {
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(keyword);
  const textBytes = encoder.encode(text);
  // chunk layout: [4-byte length][4-byte type][data][4-byte CRC]
  const dataLen = keyBytes.length + 1 + textBytes.length; // +1 for null separator
  const chunk = new Uint8Array(12 + dataLen);
  const view = new DataView(chunk.buffer);

  // Length
  view.setUint32(0, dataLen, false);

  // Type: tEXt
  chunk[4] = 0x74; // t
  chunk[5] = 0x45; // E
  chunk[6] = 0x58; // X
  chunk[7] = 0x74; // t

  // Data: keyword + \0 + text
  chunk.set(keyBytes, 8);
  chunk[8 + keyBytes.length] = 0;
  chunk.set(textBytes, 8 + keyBytes.length + 1);

  // CRC covers type + data
  const crcData = chunk.slice(4, 8 + dataLen);
  view.setUint32(8 + dataLen, crc32(crcData), false);

  return chunk;
}

/** Convert a data URL to PNG format via canvas. Returns a PNG ArrayBuffer. */
async function convertImageToPng(dataUrl: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('Canvas toBlob failed'));
        blob.arrayBuffer().then(resolve).catch(reject);
      }, 'image/png');
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

/** Create a minimal 1x1 transparent PNG via canvas (fallback when character has no avatar). */
function createMinimalPng(): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    canvas.toBlob(blob => {
      if (!blob) return reject(new Error('Canvas toBlob failed'));
      blob.arrayBuffer().then(resolve).catch(reject);
    }, 'image/png');
  });
}

/**
 * Export a character as a PNG with embedded V2 JSON (TavernAI/SillyTavern format).
 * Returns a Blob ready for download.
 */
export async function exportCharacterToPng(character: CharacterCard): Promise<Blob> {
  // Build V2 spec JSON
  const v2Data = {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: character.name,
      description: character.description,
      personality: character.personality,
      scenario: character.scenario,
      first_mes: character.firstMessage,
      system_prompt: character.systemPrompt || '',
      post_history_instructions: character.postHistoryInstructions || '',
      creator_notes: character.creatorNotes || '',
      mes_examples: character.mesExamples || '',
      tags: character.tags || [],
      alternate_greetings: character.alternateGreetings || [],
      character_book: character.characterBook || undefined,
    },
  };

  // Encode to base64
  const jsonStr = JSON.stringify(v2Data);
  const jsonBytes = new TextEncoder().encode(jsonStr);
  let b64 = '';
  const chunkSize = 8192;
  for (let i = 0; i < jsonBytes.length; i += chunkSize) {
    b64 += String.fromCharCode(...jsonBytes.slice(i, i + chunkSize));
  }
  b64 = btoa(b64);

  // Get or create PNG image
  let pngBuffer: ArrayBuffer;
  if (character.avatar) {
    try {
      pngBuffer = await convertImageToPng(character.avatar);
    } catch {
      pngBuffer = await createMinimalPng();
    }
  } else {
    pngBuffer = await createMinimalPng();
  }

  // Read existing chunks
  const chunks = readPngChunks(pngBuffer);

  // Build new tEXt chunk with character data
  const charaChunk = buildTextChunk('chara', b64);

  // Reassemble PNG: signature + all chunks except old 'chara' tEXt + new chara + IEND
  const pngSig = new Uint8Array(PNG_SIGNATURE);
  const parts: Uint8Array[] = [pngSig];

  for (const chunk of chunks) {
    if (chunk.type === 'IEND') continue;
    // Skip any existing 'chara' tEXt chunk
    if (chunk.type === 'tEXt') {
      const decoded = decodeTextChunk(chunk.data);
      if (decoded?.keyword === 'chara') continue;
    }
    // Re-encode chunk: length + type + data + crc
    const buf = new Uint8Array(12 + chunk.data.length);
    const view = new DataView(buf.buffer);
    view.setUint32(0, chunk.data.length, false);
    const typeBytes = new TextEncoder().encode(chunk.type);
    buf.set(typeBytes, 4);
    buf.set(chunk.data, 8);
    const crcData = buf.slice(4, 8 + chunk.data.length);
    view.setUint32(8 + chunk.data.length, crc32(crcData), false);
    parts.push(buf);
  }

  // Insert new chara tEXt chunk
  parts.push(charaChunk);

  // IEND chunk
  const iend = new Uint8Array(12);
  const iendView = new DataView(iend.buffer);
  iendView.setUint32(0, 0, false); // length = 0
  iend[4] = 0x49; iend[5] = 0x45; iend[6] = 0x4E; iend[7] = 0x44; // IEND
  const iendCrc = crc32(iend.slice(4, 8));
  iendView.setUint32(8, iendCrc, false);
  parts.push(iend);

  // Concatenate
  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return new Blob([result], { type: 'image/png' });
}

// Validate character has required fields
export function validateCharacter(character: Partial<CharacterCard>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!character.name?.trim()) {
    errors.push('Name is required');
  }

  if (!character.firstMessage?.trim()) {
    errors.push('First message is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}