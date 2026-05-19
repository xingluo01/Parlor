import { create } from 'zustand';
import type { CharacterCard } from '../types';

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
