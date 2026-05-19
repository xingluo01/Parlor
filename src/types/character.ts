export interface CharacterRelation {
  id: string;
  targetId: string;
  relationType: '情侣' | '师徒' | '好友' | '敌对' | '家人' | '主仆' | '师生' | '同门' | '其他';
  customType?: string;
  summary: string;
  createdAt: number;
  updatedAt: number;
}

export interface WorldInfoRelation {
  id: string;
  targetId: string;
  summary: string;
  createdAt: number;
  updatedAt: number;
}

export type GalleryImage = {
  id: string;
  url: string;
  caption?: string;
};

export type LorebookEntry = {
  id: string;
  keywords: string[];
  secondaryKeywords?: string[];
  selective?: boolean;
  selectiveLogic?: 'AND' | 'OR';
  content: string;
  enabled: boolean;
  insertionOrder: number;
  caseSensitive?: boolean;
  matchWholeWords?: boolean;
};

export type Lorebook = {
  entries: LorebookEntry[];
};

export type WorldInfo = {
  id: string;
  name: string;
  enabled: boolean;
  entries: LorebookEntry[];
  autoAssociate?: boolean;
  relations?: WorldInfoRelation[];
  createdAt: number;
  updatedAt: number;
};

export type CharacterCard = {
  id: string;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;
  systemPrompt?: string;
  postHistoryInstructions?: string;
  creatorNotes?: string;
  mesExamples?: string;
  tags: string[];
  avatar?: string;
  alternateGreetings?: string[];
  characterBook?: Lorebook;
  gallery?: GalleryImage[];
  defaultPersonaId?: string;
  ttsVoice?: string;
  expressions?: Record<string, string>;
  worldInfoId?: string;
  relations?: CharacterRelation[];

  age?: string;
  gender?: string;
  race?: string;
  occupation?: string;
  height?: string;
  appearance?: string;
  hairStyle?: string;
  eyeColor?: string;
  clothing?: string;
  bodyFeatures?: string;
  personalityTraits?: string[];
  mbti?: string;
  likes?: string[];
  dislikes?: string[];
  habits?: string[];
  background?: string;
  keyEvents?: string;
  abilities?: string;
  speechStyle?: string;
  catchphrases?: string[];
  intimateDetails?: string;

  createdAt: number;
  updatedAt: number;
};
