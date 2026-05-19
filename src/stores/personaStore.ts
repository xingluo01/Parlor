import { create } from 'zustand';
import type { Persona } from '../types';

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
