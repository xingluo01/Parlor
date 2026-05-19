/**
 * Parlor API Client
 * Replaces IndexedDB with REST API calls for server-first storage
 */

import type {
  AuthorNotePreset,
  CharacterCard,
  Persona,
  ChatSession,
  ConnectionProfile,
  Preset,
  RegexScript,
  AppSettings,
  LorebookEntry,
  WorldInfo,
  GroupChat,
  DataBankDocument,
} from '../types';
import { generateUUID } from '../utils/uuid';
import { normalizeCharacterCard, normalizeWorldInfo, normalizeLorebookEntries } from '../utils/normalizeLorebook';

// Use a relative URL so requests always go to the same origin (Vite proxies /api → :3001)
export const API_URL = '/api';

const DEFAULT_TIMEOUT_MS = 30_000;

/** Create an AbortController that rejects after `ms` milliseconds. */
function withTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), ms);
  return { signal: controller.signal, clear: () => clearTimeout(id) };
}

// Generic API helpers
async function apiGet<T>(endpoint: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const { signal, clear } = withTimeout(timeoutMs);
  try {
    const response = await fetch(`${API_URL}${endpoint}`, { signal });
    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
    return response.json();
  } finally {
    clear();
  }
}

async function apiPost<T>(endpoint: string, data?: unknown, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const { signal, clear } = withTimeout(timeoutMs);
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal,
    });
    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
    return response.json();
  } finally {
    clear();
  }
}

async function apiPut<T>(endpoint: string, data: unknown, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const { signal, clear } = withTimeout(timeoutMs);
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal,
    });
    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
    return response.json();
  } finally {
    clear();
  }
}

async function apiDelete<T>(endpoint: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const { signal, clear } = withTimeout(timeoutMs);
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      signal,
    });
    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
    return response.json();
  } finally {
    clear();
  }
}

// Flag to track if we've initialized this session
let initialized = false;

// Initialize default data if needed
export async function initializeDatabase() {
  if (initialized) return;
  initialized = true;

  try {
    // Fetch all three in parallel instead of sequentially
    const [settings, personas, presets] = await Promise.all([
      apiGet<(AppSettings & { id: string })[]>('/settings'),
      apiGet<Persona[]>('/personas'),
      apiGet<Preset[]>('/presets'),
    ]);

    const defaults: Promise<unknown>[] = [];

    if (settings.length === 0) {
      defaults.push(apiPost('/settings', {
        id: 'app',
        theme: 'dark',
        fontSize: 'medium',
        streamResponses: true,
        autoSaveInterval: 30000,
        contextSize: 20,
        avatarSize: 'medium',
        autoHideMobileMenus: true,
        maxResponseTokens: 2048,
        contextSizeInTokens: 4096,
      }));
    }

    if (personas.length === 0) {
      defaults.push(apiPost('/personas', {
        id: generateUUID(),
        name: 'User',
        description: 'Default user persona',
        isDefault: true,
      }));
    }

    if (presets.length === 0) {
      defaults.push(apiPost('/presets', {
        id: generateUUID(),
        name: 'Default',
        temperature: 0.8,
        topP: 0.9,
        frequencyPenalty: 0,
        presencePenalty: 0,
        maxTokens: 2048,
        isDefault: true,
      }));
    }

    if (defaults.length > 0) await Promise.all(defaults);
  } catch (error) {
    console.error('Failed to initialize database:', error);
    initialized = false; // Allow retry on next call
  }
}

// Character operations
export const characterOps = {
  async getAll(): Promise<CharacterCard[]> {
    const chars = await apiGet<CharacterCard[]>('/characters');
    return chars
      .map(normalizeCharacterCard)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  },

  /** Lightweight list: strips avatar/gallery/characterBook/mesExamples/long text fields.
   *  Use this for the characters list page — dramatically smaller payload. */
  async getAllCompact(): Promise<CharacterCard[]> {
    const chars = await apiGet<CharacterCard[]>('/characters?compact=true');
    return chars
      .map(normalizeCharacterCard)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  },

  /** Batch-fetch avatars for a set of character IDs. Returns {id: base64} map. */
  async getAvatars(ids: string[]): Promise<Record<string, string>> {
    if (ids.length === 0) return {};
    return apiPost<Record<string, string>>('/characters/avatars', ids);
  },
  
  async getById(id: string): Promise<CharacterCard | undefined> {
    try {
      const card = await apiGet<CharacterCard>(`/characters/${id}`);
      return normalizeCharacterCard(card);
    } catch {
      return undefined;
    }
  },
  
  async search(query: string): Promise<CharacterCard[]> {
    const chars = await this.getAll();
    const lowerQuery = query.toLowerCase();
    return chars.filter(char => 
      char.name.toLowerCase().includes(lowerQuery) ||
      char.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  },
  
  async add(character: CharacterCard): Promise<string> {
    await apiPost('/characters', character);
    return character.id;
  },
  
  async update(id: string, updates: Partial<CharacterCard>): Promise<number> {
    await apiPut(`/characters/${id}`, { ...updates, updatedAt: Date.now() });
    return 1;
  },
  
  async delete(id: string): Promise<void> {
    // Delete associated chats first
    const chats = await apiGet<ChatSession[]>('/chats');
    const characterChats = chats.filter(c => c.characterId === id);
    for (const chat of characterChats) {
      await apiDelete(`/chats/${chat.id}`);
    }
    await apiDelete(`/characters/${id}`);
  },

  async batchDelete(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const [allChars, allChats] = await Promise.all([
      apiGet<CharacterCard[]>('/characters'),
      apiGet<ChatSession[]>('/chats'),
    ]);
    const remainingChars = allChars.filter(c => !idSet.has(c.id));
    const remainingChats = allChats.filter(c => !idSet.has(c.characterId));
    await Promise.all([
      apiPost('/characters/batch', remainingChars),
      apiPost('/chats/batch', remainingChats),
    ]);
  },

  async batchAdd(characters: CharacterCard[]): Promise<{ imported: number; skipped: number }> {
    // Chunk into groups of 50 so no single request carries an absurd payload.
    const CHUNK_SIZE = 50;
    let totalImported = 0;
    let totalSkipped = 0;
    for (let i = 0; i < characters.length; i += CHUNK_SIZE) {
      const chunk = characters.slice(i, i + CHUNK_SIZE);
      const result = await apiPost<{ imported: number; skipped: number }>(
        '/characters/batch-import',
        chunk,
      );
      totalImported += result.imported;
      totalSkipped += result.skipped;
    }
    return { imported: totalImported, skipped: totalSkipped };
  },
};

// Chat operations
export const chatOps = {
  async getAll(): Promise<ChatSession[]> {
    const chats = await apiGet<ChatSession[]>('/chats');
    return chats.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  },

  /** Lightweight list: returns chats without messages array — just id/characterId/updatedAt/title. */
  async getCompact(): Promise<Omit<ChatSession, 'messages'>[]> {
    const chats = await apiGet<Omit<ChatSession, 'messages'>[]>('/chats?compact=true');
    return chats.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  },
  
  async getByCharacter(characterId: string): Promise<ChatSession[]> {
    const chats = await this.getAll();
    return chats.filter(c => c.characterId === characterId);
  },
  
  async getById(id: string): Promise<ChatSession | undefined> {
    try {
      return await apiGet<ChatSession>(`/chats/${id}`);
    } catch {
      return undefined;
    }
  },
  
  async add(chat: ChatSession): Promise<string> {
    await apiPost('/chats', chat);
    return chat.id;
  },
  
  async update(id: string, updates: Partial<ChatSession>): Promise<number> {
    await apiPut(`/chats/${id}`, { ...updates, updatedAt: Date.now() });
    return 1;
  },
  
  async addMessage(chatId: string, message: ChatSession['messages'][0]): Promise<void> {
    const chat = await this.getById(chatId);
    if (chat) {
      await apiPut(`/chats/${chatId}`, {
        messages: [...chat.messages, message],
        updatedAt: Date.now(),
      });
    }
  },
  
  async updateMessage(chatId: string, messageId: string, content: string): Promise<void> {
    const chat = await this.getById(chatId);
    if (chat) {
      const messages = chat.messages.map(msg =>
        msg.id === messageId ? { ...msg, content, isEdited: true } : msg
      );
      await apiPut(`/chats/${chatId}`, { messages, updatedAt: Date.now() });
    }
  },
  
  async deleteMessage(chatId: string, messageId: string): Promise<void> {
    const chat = await this.getById(chatId);
    if (chat) {
      const messages = chat.messages.filter(msg => msg.id !== messageId);
      await apiPut(`/chats/${chatId}`, { messages, updatedAt: Date.now() });
    }
  },
  
  async delete(id: string): Promise<void> {
    await apiDelete(`/chats/${id}`);
  },
};

// Persona operations
export const personaOps = {
  async getAll(): Promise<Persona[]> {
    return apiGet<Persona[]>('/personas');
  },
  
  async getDefault(): Promise<Persona | undefined> {
    const personas = await this.getAll();
    return personas.find(p => p.isDefault);
  },
  
  async setDefault(id: string): Promise<void> {
    const personas = await this.getAll();
    for (const p of personas) {
      if (p.id === id) {
        await apiPut(`/personas/${p.id}`, { isDefault: true, updatedAt: Date.now() });
      } else if (p.isDefault) {
        await apiPut(`/personas/${p.id}`, { isDefault: false, updatedAt: Date.now() });
      }
    }
  },
  
  async add(persona: Persona): Promise<string> {
    await apiPost('/personas', persona);
    return persona.id;
  },
  
  async update(id: string, updates: Partial<Persona>): Promise<number> {
    await apiPut(`/personas/${id}`, { ...updates, updatedAt: Date.now() });
    return 1;
  },
  
  async delete(id: string): Promise<void> {
    const personas = await this.getAll();
    const target = personas.find(p => p.id === id);
    if (!target) return;
    // If deleting the default and another persona exists, auto-promote it
    if (target.isDefault) {
      const other = personas.find(p => p.id !== id);
      if (other) {
        await apiPut(`/personas/${other.id}`, { isDefault: true, updatedAt: Date.now() });
      }
    }
    await apiDelete(`/personas/${id}`);
  },
};

// Connection operations
export const connectionOps = {
  async getAll(): Promise<ConnectionProfile[]> {
    return apiGet<ConnectionProfile[]>('/connections');
  },
  
  async getActive(): Promise<ConnectionProfile | undefined> {
    const connections = await this.getAll();
    return connections.find(c => c.isActive);
  },
  
  async setActive(id: string): Promise<void> {
    const connections = await this.getAll();
    for (const c of connections) {
      if (c.id === id) {
        await apiPut(`/connections/${c.id}`, { isActive: true, updatedAt: Date.now() });
      } else if (c.isActive) {
        await apiPut(`/connections/${c.id}`, { isActive: false, updatedAt: Date.now() });
      }
    }
  },
  
  async add(connection: ConnectionProfile): Promise<string> {
    await apiPost('/connections', connection);
    return connection.id;
  },
  
  async update(id: string, updates: Partial<ConnectionProfile>): Promise<number> {
    await apiPut(`/connections/${id}`, { ...updates, updatedAt: Date.now() });
    return 1;
  },
  
  async delete(id: string): Promise<void> {
    await apiDelete(`/connections/${id}`);
  },
};

// Preset operations
export const presetOps = {
  async getAll(): Promise<Preset[]> {
    return apiGet<Preset[]>('/presets');
  },
  
  async getDefault(): Promise<Preset | undefined> {
    const presets = await this.getAll();
    return presets.find(p => p.isDefault);
  },
  
  async setDefault(id: string): Promise<void> {
    const presets = await this.getAll();
    for (const p of presets) {
      if (p.id === id) {
        await apiPut(`/presets/${p.id}`, { isDefault: true, updatedAt: Date.now() });
      } else if (p.isDefault) {
        await apiPut(`/presets/${p.id}`, { isDefault: false, updatedAt: Date.now() });
      }
    }
  },
  
  async add(preset: Preset): Promise<string> {
    await apiPost('/presets', preset);
    return preset.id;
  },
  
  async update(id: string, updates: Partial<Preset>): Promise<number> {
    await apiPut(`/presets/${id}`, { ...updates, updatedAt: Date.now() });
    return 1;
  },
  
  async delete(id: string): Promise<void> {
    const defaultPreset = await this.getDefault();
    if (defaultPreset?.id === id) {
      throw new Error('Cannot delete default preset');
    }
    await apiDelete(`/presets/${id}`);
  },
};

// Regex operations
export const regexOps = {
  async getAll(): Promise<RegexScript[]> {
    return apiGet<RegexScript[]>('/regexes');
  },
  
  async getEnabled(): Promise<RegexScript[]> {
    const regexes = await this.getAll();
    return regexes.filter(r => r.enabled);
  },
  
  async add(regex: RegexScript): Promise<string> {
    await apiPost('/regexes', regex);
    return regex.id;
  },
  
  async update(id: string, updates: Partial<RegexScript>): Promise<number> {
    await apiPut(`/regexes/${id}`, { ...updates, updatedAt: Date.now() });
    return 1;
  },
  
  async delete(id: string): Promise<void> {
    await apiDelete(`/regexes/${id}`);
  },
};

// Lorebook operations
export const lorebookOps = {
  async getAll(): Promise<LorebookEntry[]> {
    const entries = await apiGet<LorebookEntry[]>('/lorebook');
    return normalizeLorebookEntries(entries) as LorebookEntry[];
  },
  async add(entry: LorebookEntry): Promise<string> {
    await apiPost('/lorebook', entry);
    return entry.id;
  },
  async update(id: string, updates: Partial<LorebookEntry>): Promise<number> {
    await apiPut(`/lorebook/${id}`, updates);
    return 1;
  },
  async delete(id: string): Promise<void> {
    await apiDelete(`/lorebook/${id}`);
  },
};

// World Info operations
export const worldInfoOps = {
  async getAll(): Promise<WorldInfo[]> {
    const books = await apiGet<WorldInfo[]>('/worldInfo');
    return books.map(normalizeWorldInfo);
  },
  async add(book: WorldInfo): Promise<string> {
    await apiPost('/worldInfo', book);
    return book.id;
  },
  async update(id: string, updates: Partial<WorldInfo>): Promise<void> {
    await apiPut(`/worldInfo/${id}`, { ...updates, updatedAt: Date.now() });
  },
  async delete(id: string): Promise<void> {
    await apiDelete(`/worldInfo/${id}`);
  },
};

// Group Chat operations
export const groupChatOps = {
  async getAll(): Promise<GroupChat[]> {
    try {
      const groups = await apiGet<GroupChat[]>('/groupChats');
      return groups.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch {
      return [];
    }
  },
  async getById(id: string): Promise<GroupChat | undefined> {
    try {
      return await apiGet<GroupChat>(`/groupChats/${id}`);
    } catch {
      return undefined;
    }
  },
  async add(group: GroupChat): Promise<string> {
    await apiPost('/groupChats', group);
    return group.id;
  },
  async update(id: string, updates: Partial<GroupChat>): Promise<number> {
    await apiPut(`/groupChats/${id}`, { ...updates, updatedAt: Date.now() });
    return 1;
  },
  async delete(id: string): Promise<void> {
    await apiDelete(`/groupChats/${id}`);
  },
};

// Data Bank operations
export const dataBankOps = {
  async getAll(): Promise<DataBankDocument[]> {
    try {
      const docs = await apiGet<DataBankDocument[]>('/databank');
      return docs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch {
      return [];
    }
  },
  async getById(id: string): Promise<DataBankDocument | undefined> {
    try {
      return await apiGet<DataBankDocument>(`/databank/${id}`);
    } catch {
      return undefined;
    }
  },
  async getByScope(scope: string, scopeId?: string): Promise<DataBankDocument[]> {
    const all = await this.getAll();
    return all.filter(d => d.scope === scope && (!scopeId || d.scopeId === scopeId));
  },
  async add(doc: DataBankDocument): Promise<string> {
    await apiPost('/databank', doc);
    return doc.id;
  },
  async update(id: string, updates: Partial<DataBankDocument>): Promise<number> {
    await apiPut(`/databank/${id}`, { ...updates, updatedAt: Date.now() });
    return 1;
  },
  async delete(id: string): Promise<void> {
    await apiDelete(`/databank/${id}`);
  },
};

// Author Note Preset operations
export const authorNoteOps = {
  async getAll(): Promise<AuthorNotePreset[]> {
    return apiGet<AuthorNotePreset[]>('/authorNotes');
  },
  async getEnabled(): Promise<AuthorNotePreset[]> {
    const all = await this.getAll();
    return all.filter(p => p.enabled);
  },
  async add(preset: AuthorNotePreset): Promise<string> {
    await apiPost('/authorNotes', preset);
    return preset.id;
  },
  async update(id: string, updates: Partial<AuthorNotePreset>): Promise<number> {
    await apiPut(`/authorNotes/${id}`, { ...updates, updatedAt: Date.now() });
    return 1;
  },
  async delete(id: string): Promise<void> {
    await apiDelete(`/authorNotes/${id}`);
  },
};

/** Get combined content from all enabled presets */
export async function getCombinedAuthorNotePresets(): Promise<string> {
  const presets = await authorNoteOps.getEnabled();
  if (presets.length === 0) return '';
  return presets
    .map(p => p.content.trim())
    .filter(Boolean)
    .join('\n\n');
}

// Settings operations
export const settingsOps = {
  async get(): Promise<AppSettings | undefined> {
    try {
      const settings = await apiGet<(AppSettings & { id: string })[]>('/settings');
      return settings.find(s => s.id === 'app');
    } catch {
      return undefined;
    }
  },
  
  async update(updates: Partial<AppSettings>): Promise<number> {
    const current = await this.get();
    if (!current) {
      console.error('Settings not found, cannot update');
      return 0;
    }
    await apiPut('/settings/app', { ...current, ...updates });
    return 1;
  },
};

// Backup/Restore operations
export const backupOps = {
  async createQuickBackup() {
    const [characters, personas, presets, regexes, settings, connections] = await Promise.all([
      characterOps.getAll(),
      personaOps.getAll(),
      presetOps.getAll(),
      regexOps.getAll(),
      settingsOps.get(),
      connectionOps.getAll(),
    ]);

    return {
      version: '1.0.0',
      exportType: 'quick' as const,
      exportDate: new Date().toISOString(),
      characters,
      personas,
      presets,
      regexes,
      settings: settings!,
      connectionProfiles: connections.map(({ apiKey: _, ...rest }) => rest),
    };
  },

  async createFullBackup() {
    const quickBackup = await this.createQuickBackup();
    const chats = await chatOps.getAll();

    return {
      ...quickBackup,
      exportType: 'full' as const,
      chats,
    };
  },

  async restoreQuickBackup(backup: Omit<Awaited<ReturnType<typeof this.createQuickBackup>>, 'exportType'>) {
    // Use batch endpoints to restore all data
    await apiPost('/characters/batch', backup.characters);
    await apiPost('/personas/batch', backup.personas);
    await apiPost('/presets/batch', backup.presets);
    await apiPost('/regexes/batch', backup.regexes);
    if (backup.settings) {
      await apiPost('/settings', { ...backup.settings, id: 'app' });
    }
  },

  async restoreFullBackup(backup: Awaited<ReturnType<typeof this.createFullBackup>>) {
    await this.restoreQuickBackup(backup);
    await apiPost('/chats/batch', backup.chats);
  },

  /** Wipe every data store. Page should be reloaded after this. */
  async nukeAllData(): Promise<void> {
    await Promise.all([
      apiPost('/characters/batch', []),
      apiPost('/chats/batch', []),
      apiPost('/personas/batch', []),
      apiPost('/presets/batch', []),
      apiPost('/connections/batch', []),
      apiPost('/regexes/batch', []),
      apiPost('/lorebook/batch', []),
      apiPost('/settings/batch', []),
    ]);
  },
};