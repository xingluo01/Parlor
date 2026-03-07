// ==========================================
// Core Data Types for Parlor
// ==========================================

// Character Card Types
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
  mesExamples?: string; // Example dialogue (V2 spec mes_examples)
  tags: string[];
  avatar?: string; // Base64 or URL
  alternateGreetings?: string[];
  characterBook?: Lorebook;
  gallery?: GalleryImage[];
  defaultPersonaId?: string; // Preferred persona for this character
  ttsVoice?: string; // Preferred TTS voice for this character
  expressions?: Record<string, string>; // emotion → image data URL (neutral, happy, sad, angry, surprised, thinking, embarrassed)
  createdAt: number;
  updatedAt: number;
}

// Lorebook Entry
export type LorebookEntry = {
  id: string;
  keywords: string[];
  content: string;
  enabled: boolean;
  insertionOrder: number;
  caseSensitive?: boolean;
}

export type Lorebook = {
  entries: LorebookEntry[];
}

export type WorldInfo = {
  id: string;
  name: string;
  enabled: boolean;        // global toggle (all chats)
  entries: LorebookEntry[];
  createdAt: number;
  updatedAt: number;
}

// Gallery Image
export type GalleryImage = {
  id: string;
  url: string; // Base64 or URL
  caption?: string;
}

// Persona (User Profile)
export type Persona = {
  id: string;
  name: string;
  description: string;
  personality?: string;
  avatar?: string;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

// Parameter Overrides (per-chat)
export type ParameterOverrides = {
  temperature?: number;
  topP?: number;
  topK?: number;
  minP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  maxTokens?: number;
  contextSize?: number;
  // Reasoning support
  reasoningMode?: ReasoningMode;
  reasoningBudgetTokens?: number;
  // Legacy support
  enableReasoning?: boolean;
  reasoningEffort?: 'low' | 'medium' | 'high';
}

// Chat Types
export type ChatSession = {
  id: string;
  characterId: string;
  personaId: string | null;
  title?: string;
  messages: Message[];
  parameterOverrides?: ParameterOverrides; // Per-chat parameter overrides
  authorNote?: string;
  authorNoteDepth?: number; // messages from end to inject at; default 2
  enabledWorldInfoIds?: string[]; // undefined = all enabled; [] = all disabled; specific ids = selective
  summary?: string; // Condensed summary of earlier conversation
  summaryUpToIndex?: number; // Messages up to this index have been summarized
  branchedFromChatId?: string; // ID of parent chat if this is a branch
  branchPointMessageId?: string; // Message ID where the branch was created
  createdAt: number;
  updatedAt: number;
}

export type MessageContent = {
  type: 'text' | 'image';
  text?: string;
  image?: string; // Base64 or URL
}

export type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string; // For backward compatibility - plain text
  parts?: MessageContent[]; // For multimodal content (text + images)
  timestamp: number;
  isEdited?: boolean;
  isRegenerated?: boolean;
  parentMessageId?: string | null;
  swipes?: string[];  // Alternate response versions
  activeSwipeIndex?: number; // Which swipe is currently viewed
  reasoning?: string; // Model's reasoning/thinking process (for o1/o3 style models)
  bookmarked?: boolean;
  characterId?: string; // For group chats — identifies which character sent this message
  translatedContent?: string; // Auto-translated version of content
  generatedImages?: string[]; // Inline generated image URLs/base64
  embedded?: boolean; // Whether this message has been vectorized
}

// API Connection Types
export type APIProvider =
  | 'openai'
  | 'anthropic'
  | 'openrouter'
  | 'glm'
  | 'gemini'
  | 'mistral'
  | 'deepseek'
  | 'groq'
  | 'custom'
  | 'ollama'
  | 'lmstudio';

export type ConnectionProfile = {
  id: string;
  name: string;
  provider: APIProvider;
  apiKey: string; // Will be stored securely
  endpoint?: string; // For custom endpoints
  model: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

// Prompt Entry for SillyTavern-style presets
export type PromptEntry = {
  identifier: string;
  name: string;
  content: string;
  role: 'system' | 'user' | 'assistant';
  system_prompt?: boolean;
  marker?: boolean;
  enabled?: boolean;
  injection_position?: number;
  injection_depth?: number;
  forbid_overrides?: boolean;
}

// Prompt Order Entry
export type PromptOrderEntry = {
  identifier: string;
  enabled: boolean;
}

// Reasoning mode for different model types
export type ReasoningMode = 'none' | 'auto' | 'openai' | 'anthropic' | 'deepseek' | 'glm';

// Generation Preset (SillyTavern-compatible)
export type Preset = {
  id: string;
  name: string;
  // Basic sampling params
  temperature: number;
  topP: number;
  topK?: number;
  minP?: number;
  frequencyPenalty: number;
  presencePenalty: number;
  maxTokens: number;
  stopSequences?: string[];
  
  // Reasoning support (for o1/o3, DeepSeek R1, GLM, Anthropic models)
  reasoningMode?: ReasoningMode;
  reasoningBudgetTokens?: number; // Anthropic thinking budget (1024–16384)
  // Legacy support - maps to reasoningMode='openai'
  enableReasoning?: boolean;
  reasoningEffort?: 'low' | 'medium' | 'high';
  
  // SillyTavern-style prompt configuration
  prompts?: PromptEntry[];
  prompt_order?: PromptOrderEntry[];
  
  // Format strings
  impersonation_prompt?: string;
  new_chat_prompt?: string;
  new_group_chat_prompt?: string;
  continue_nudge_prompt?: string;
  scenario_format?: string;
  personality_format?: string;

  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

// Regex Script
export type RegexScript = {
  id: string;
  name: string;
  findRegex: string;
  replaceString: string;
  flags?: string;    // e.g. 'i', 'im', 'ims' — 'g' is always applied in code
  enabled: boolean;
  applyTo: 'input' | 'output' | 'both';
  order: number;     // Ascending execution order
  createdAt: number;
  updatedAt: number;
}

// Quick Reply / Macro
export type QuickReply = {
  id: string;
  label: string;       // Button text (short)
  content: string;     // What gets sent (can use {{char}}/{{user}} vars)
  action: 'send' | 'insert'; // Send immediately or insert into input
}

// Group Chat Types
export type GroupMember = {
  characterId: string;
  talkativeness: number; // 0-100, probability of speaking each turn
  isActive: boolean;
}

export type GroupChat = {
  id: string;
  name: string;
  members: GroupMember[];
  turnMode: 'natural' | 'list' | 'random' | 'manual';
  messages: Message[];
  personaId?: string;
  parameterOverrides?: ParameterOverrides;
  authorNote?: string;
  authorNoteDepth?: number;
  enabledWorldInfoIds?: string[];
  summary?: string;
  summaryUpToIndex?: number;
  currentTurnIndex?: number; // For list mode — which member speaks next
  createdAt: number;
  updatedAt: number;
}

// Theme Customization
export type ThemeConfig = {
  name: string;
  brandColor: string;      // Primary brand color (default: #8b5cf6)
  dark50: string;           // Lightest background
  dark100: string;
  dark200: string;          // Main background
  dark300: string;          // Darkest background
  accentColor?: string;     // Secondary accent
  chatBackground?: string;  // URL or base64 for chat background image
}

// Data Bank Document
export type DataBankDocument = {
  id: string;
  name: string;
  content: string;         // Raw text content
  scope: 'global' | 'character' | 'chat';
  scopeId?: string;        // characterId or chatId if scoped
  chunkCount?: number;     // Number of chunks after processing
  createdAt: number;
  updatedAt: number;
}

// Image Generation Settings
export type ImageGenProvider = 'dalle' | 'sd-webui' | 'comfyui';

export type ImageGenSettings = {
  enabled: boolean;
  provider: ImageGenProvider;
  endpoint?: string;       // For SD WebUI / ComfyUI
  model?: string;          // For DALL-E (dall-e-3, dall-e-2)
  width?: number;
  height?: number;
}

// App Settings
export type AppSettings = {
  theme: 'dark' | 'light';
  fontSize: 'small' | 'medium' | 'large';
  streamResponses: boolean;
  autoSaveInterval: number; // In milliseconds
  contextSize: number; // Number of messages to include in context
  lastBackupDate?: number;

  // New display settings
  avatarSize: 'small' | 'medium' | 'large';
  autoHideMobileMenus: boolean;

  // New response settings
  maxResponseTokens: number;
  contextSizeInTokens: number;

  // Global reasoning settings
  reasoningMode?: ReasoningMode;
  reasoningEffort?: 'low' | 'medium' | 'high';

  // Notifications
  notifyOnComplete?: boolean;

  // Summarization
  autoSummarize?: boolean;
  autoSummarizeInterval?: number; // Trigger summarization every N user messages (default 20)

  // Quick Replies
  quickReplies?: QuickReply[];

  // TTS
  ttsEnabled?: boolean;
  ttsProvider?: 'browser' | 'edge';
  ttsAutoPlay?: boolean; // Auto-play new assistant messages

  // Vector Store / RAG
  vectorStoreEnabled?: boolean;

  // Theme
  customTheme?: ThemeConfig;
  activeTheme?: string; // 'dark' | 'midnight' | 'lavender' | 'forest' | 'crimson' | 'custom'

  // Auto-Translate
  translateLanguage?: string; // Target language for translation (empty = disabled)

  // Image Generation
  imageGen?: ImageGenSettings;
}

// Export/Import Types
export type QuickBackup = {
  version: string;
  exportType: 'quick';
  exportDate: string;
  characters: CharacterCard[];
  personas: Persona[];
  presets: Preset[];
  regexes: RegexScript[];
  settings: AppSettings;
  connectionProfiles: Omit<ConnectionProfile, 'apiKey'>[]; // Exclude API keys
}

export type FullBackup = Omit<QuickBackup, 'exportType'> & {
  exportType: 'full';
  chats: ChatSession[];
}

// API Request/Response Types
export type ChatCompletionRequest = {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  max_tokens?: number;
  stop?: string[];
  stream?: boolean;
}

export type ChatCompletionChunk = {
  id: string;
  choices: Array<{
    delta: {
      content?: string;
      reasoning_content?: string; // For reasoning models
    };
    finish_reason?: string | null;
  }>;
}

// UI State Types
export type UIState = {
  sidebarOpen: boolean;
  activeView: 'characters' | 'chats' | 'personas' | 'settings';
  activeChatId: string | null;
  activeCharacterId: string | null;
  isMobile: boolean;
}