// Novel parse result from AI analysis

export interface NovelParseResult {
  title?: string;
  worldEntries: {
    name: string;
    content: string;
    keywords: string[];
  }[];
  characters: {
    name: string;
    description: string;
    personality: string;
    firstMessage: string;
    scenario?: string;
    tags: string[];

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

    relations?: {
      targetName: string;
      relationType: '情侣' | '师徒' | '好友' | '敌对' | '家人' | '主仆' | '师生' | '同门' | '其他';
      customType?: string;
      summary: string;
    }[];
  }[];
}
