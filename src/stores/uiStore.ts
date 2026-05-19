import { create } from 'zustand';
import type { UIState } from '../types';

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
