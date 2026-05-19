import { create } from 'zustand';
import type { ChatSession } from '../types';

interface ChatStore {
  chats: ChatSession[];
  activeChat: ChatSession | null;
  isStreaming: boolean;
  isImpersonating: boolean;
  regeneratingMessageId: string | null;
  streamingContent: string;
  streamingReasoning: string;
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
