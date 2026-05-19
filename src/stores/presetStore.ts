import { create } from 'zustand';
import type { Preset } from '../types';

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
