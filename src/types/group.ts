import type { ParameterOverrides } from './chat';
import type { Message } from './chat';

export type GroupMember = {
  characterId: string;
  talkativeness: number;
  isActive: boolean;
};

export type GroupChat = {
  id: string;
  name: string;
  members: GroupMember[];
  turnMode: 'natural' | 'sequential' | 'list' | 'random' | 'manual';
  messages: Message[];
  personaId?: string;
  parameterOverrides?: ParameterOverrides;
  authorNote?: string;
  authorNoteDepth?: number;
  enabledWorldInfoIds?: string[];
  summary?: string;
  summaryUpToIndex?: number;
  currentTurnIndex?: number;
  createdAt: number;
  updatedAt: number;
};
