import { create } from 'zustand';
import type { ConnectionProfile } from '../types';

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
