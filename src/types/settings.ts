import type { ReasoningMode } from './common';
import type { QuickReply, ImageGenSettings } from './quickReply';

export type ThemeConfig = {
  name: string;
  brandColor: string;
  dark50: string;
  dark100: string;
  dark200: string;
  dark300: string;
  accentColor?: string;
  chatBackground?: string;
};

export type AppSettings = {
  theme: 'dark' | 'light';
  fontSize: 'small' | 'medium' | 'large';
  streamResponses: boolean;
  autoSaveInterval: number;
  contextSize: number;
  lastBackupDate?: number;

  avatarSize: 'small' | 'medium' | 'large';
  autoHideMobileMenus: boolean;

  maxResponseTokens: number;
  contextSizeInTokens: number;

  reasoningMode?: ReasoningMode;
  reasoningEffort?: 'low' | 'medium' | 'high';

  notifyOnComplete?: boolean;
  autoContinue?: boolean;
  autoScroll?: boolean;
  autoSummarize?: boolean;
  autoSummarizeInterval?: number;

  quickReplies?: QuickReply[];

  ttsEnabled?: boolean;
  ttsProvider?: 'browser' | 'edge';
  ttsAutoPlay?: boolean;

  vectorStoreEnabled?: boolean;

  customTheme?: ThemeConfig;
  activeTheme?: string;

  translateLanguage?: string;
  baiduTranslateEnabled?: boolean;
  baiduTranslateApiUrl?: string;
  baiduTranslateAppId?: string;
  baiduTranslateSecretKey?: string;
  baiduTranslateTarget?: string;
  baiduTranslateMarket?: boolean;

  responseLength?: 'short' | 'medium' | 'long';
  imageGen?: ImageGenSettings;

  cardSize?: 'small' | 'medium' | 'large';
  showStatusBar?: boolean;
  statusFieldConfig?: {
    sceneFields: string[];
    infoFields: string[];
    statusFields?: string[];
  };

  authorNoteDefaultDepth?: number;

  syncEnabled?: boolean;
  syncRemoteUrl?: string;
  syncIntervalMinutes?: number;
  lastSyncAt?: number;
};
