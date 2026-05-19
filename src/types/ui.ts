export type AuthorNotePreset = {
  id: string;
  name: string;
  content: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
};

export type UIState = {
  sidebarOpen: boolean;
  activeView: 'characters' | 'chats' | 'personas' | 'settings';
  activeChatId: string | null;
  activeCharacterId: string | null;
  isMobile: boolean;
};
