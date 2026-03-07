import { create } from 'zustand';
import type { UIState, CharacterCard, ChatSession, Persona, ConnectionProfile, Preset } from '../types';

// UI Store - handles sidebar, modals, active views
interface UIStore extends UIState {
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setActiveView: (view: UIState['activeView']) => void;
  setActiveChat: (chatId: string | null) => void;
  setActiveCharacter: (characterId: string | null) => void;
  setIsMobile: (isMobile: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  activeView: 'characters',
  activeChatId: null,
  activeCharacterId: null,
  isMobile: false,
  
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setActiveView: (view) => set({ activeView: view }),
  setActiveChat: (chatId) => set({ activeChatId: chatId }),
  setActiveCharacter: (characterId) => set({ activeCharacterId: characterId }),
  setIsMobile: (isMobile) => set({ isMobile }),
}));

// Character Store - handles character list and selected character
interface CharacterStore {
  characters: CharacterCard[];
  selectedCharacter: CharacterCard | null;
  searchQuery: string;
  isLoading: boolean;
  
  setCharacters: (characters: CharacterCard[]) => void;
  addCharacter: (character: CharacterCard) => void;
  updateCharacter: (id: string, updates: Partial<CharacterCard>) => void;
  removeCharacter: (id: string) => void;
  selectCharacter: (character: CharacterCard | null) => void;
  setSearchQuery: (query: string) => void;
  setIsLoading: (loading: boolean) => void;
}

export const useCharacterStore = create<CharacterStore>((set) => ({
  characters: [],
  selectedCharacter: null,
  searchQuery: '',
  isLoading: false,
  
  setCharacters: (characters) => set({ characters }),
  addCharacter: (character) => set((state) => ({ 
    characters: [character, ...state.characters] 
  })),
  updateCharacter: (id, updates) => set((state) => ({
    characters: state.characters.map((c) => 
      c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c
    ),
    selectedCharacter: state.selectedCharacter?.id === id 
      ? { ...state.selectedCharacter, ...updates, updatedAt: Date.now() } 
      : state.selectedCharacter,
  })),
  removeCharacter: (id) => set((state) => ({
    characters: state.characters.filter((c) => c.id !== id),
    selectedCharacter: state.selectedCharacter?.id === id ? null : state.selectedCharacter,
  })),
  selectCharacter: (character) => set({ selectedCharacter: character }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setIsLoading: (loading) => set({ isLoading: loading }),
}));

// Chat Store - handles active chat and messages
interface ChatStore {
  chats: ChatSession[];
  activeChat: ChatSession | null;
  isStreaming: boolean;
  isImpersonating: boolean;
  regeneratingMessageId: string | null;
  streamingContent: string;
  streamingReasoning: string; // For reasoning models
  isLoading: boolean;

  setChats: (chats: ChatSession[]) => void;
  addChat: (chat: ChatSession) => void;
  updateChat: (id: string, updates: Partial<ChatSession>) => void;
  removeChat: (id: string) => void;
  setActiveChat: (chat: ChatSession | null) => void;
  setIsStreaming: (streaming: boolean) => void;
  setIsImpersonating: (impersonating: boolean) => void;
  setRegeneratingMessageId: (id: string | null) => void;
  appendStreamingContent: (content: string) => void;
  clearStreamingContent: () => void;
  appendStreamingReasoning: (reasoning: string) => void;
  clearStreamingReasoning: () => void;
  setIsLoading: (loading: boolean) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  chats: [],
  activeChat: null,
  isStreaming: false,
  isImpersonating: false,
  regeneratingMessageId: null,
  streamingContent: '',
  streamingReasoning: '',
  isLoading: false,
  
  setChats: (chats) => set({ chats }),
  addChat: (chat) => set((state) => ({ chats: [chat, ...state.chats] })),
  updateChat: (id, updates) => set((state) => ({
    chats: state.chats.map((c) => 
      c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c
    ),
    activeChat: state.activeChat?.id === id 
      ? { ...state.activeChat, ...updates, updatedAt: Date.now() } 
      : state.activeChat,
  })),
  removeChat: (id) => set((state) => ({
    chats: state.chats.filter((c) => c.id !== id),
    activeChat: state.activeChat?.id === id ? null : state.activeChat,
  })),
  setActiveChat: (chat) => set({ activeChat: chat }),
  setIsStreaming: (streaming) => set({ isStreaming: streaming }),
  setIsImpersonating: (impersonating) => set({ isImpersonating: impersonating }),
  setRegeneratingMessageId: (id) => set({ regeneratingMessageId: id }),
  appendStreamingContent: (content) => set((state) => ({
    streamingContent: state.streamingContent + content 
  })),
  clearStreamingContent: () => set({ streamingContent: '' }),
  appendStreamingReasoning: (reasoning) => set((state) => ({ 
    streamingReasoning: state.streamingReasoning + reasoning 
  })),
  clearStreamingReasoning: () => set({ streamingReasoning: '' }),
  setIsLoading: (loading) => set({ isLoading: loading }),
}));

// Persona Store
interface PersonaStore {
  personas: Persona[];
  activePersona: Persona | null;
  
  setPersonas: (personas: Persona[]) => void;
  addPersona: (persona: Persona) => void;
  updatePersona: (id: string, updates: Partial<Persona>) => void;
  removePersona: (id: string) => void;
  setActivePersona: (persona: Persona | null) => void;
}

export const usePersonaStore = create<PersonaStore>((set) => ({
  personas: [],
  activePersona: null,
  
  setPersonas: (personas) => set({ personas }),
  addPersona: (persona) => set((state) => ({ 
    personas: [...state.personas, persona] 
  })),
  updatePersona: (id, updates) => set((state) => ({
    personas: state.personas.map((p) => 
      p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
    ),
    activePersona: state.activePersona?.id === id 
      ? { ...state.activePersona, ...updates, updatedAt: Date.now() } 
      : state.activePersona,
  })),
  removePersona: (id) => set((state) => ({
    personas: state.personas.filter((p) => p.id !== id),
    activePersona: state.activePersona?.id === id ? null : state.activePersona,
  })),
  setActivePersona: (persona) => set({ activePersona: persona }),
}));

// Connection Store
interface ConnectionStore {
  connections: ConnectionProfile[];
  activeConnection: ConnectionProfile | null;
  
  setConnections: (connections: ConnectionProfile[]) => void;
  addConnection: (connection: ConnectionProfile) => void;
  updateConnection: (id: string, updates: Partial<ConnectionProfile>) => void;
  removeConnection: (id: string) => void;
  setActiveConnection: (connection: ConnectionProfile | null) => void;
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  connections: [],
  activeConnection: null,
  
  setConnections: (connections) => set({ connections }),
  addConnection: (connection) => set((state) => ({ 
    connections: [...state.connections, connection] 
  })),
  updateConnection: (id, updates) => set((state) => ({
    connections: state.connections.map((c) => 
      c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c
    ),
    activeConnection: state.activeConnection?.id === id 
      ? { ...state.activeConnection, ...updates, updatedAt: Date.now() } 
      : state.activeConnection,
  })),
  removeConnection: (id) => set((state) => ({
    connections: state.connections.filter((c) => c.id !== id),
    activeConnection: state.activeConnection?.id === id ? null : state.activeConnection,
  })),
  setActiveConnection: (connection) => set({ activeConnection: connection }),
}));

// Preset Store
interface PresetStore {
  presets: Preset[];
  activePreset: Preset | null;
  
  setPresets: (presets: Preset[]) => void;
  addPreset: (preset: Preset) => void;
  updatePreset: (id: string, updates: Partial<Preset>) => void;
  removePreset: (id: string) => void;
  setActivePreset: (preset: Preset | null) => void;
}

export const usePresetStore = create<PresetStore>((set) => ({
  presets: [],
  activePreset: null,
  
  setPresets: (presets) => set({ presets }),
  addPreset: (preset) => set((state) => ({ 
    presets: [...state.presets, preset] 
  })),
  updatePreset: (id, updates) => set((state) => ({
    presets: state.presets.map((p) => 
      p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
    ),
    activePreset: state.activePreset?.id === id 
      ? { ...state.activePreset, ...updates, updatedAt: Date.now() } 
      : state.activePreset,
  })),
  removePreset: (id) => set((state) => ({
    presets: state.presets.filter((p) => p.id !== id),
    activePreset: state.activePreset?.id === id ? null : state.activePreset,
  })),
  setActivePreset: (preset) => set({ activePreset: preset }),
}));