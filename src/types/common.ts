// Shared enums and type aliases
// DeepSeek-only build — all other providers removed

export type APIProvider = 'deepseek' | 'custom';

// Reasoning mode kept minimal; DeepSeek reasoning is disabled for [STATUS] compliance
export type ReasoningMode = 'none' | 'auto' | 'deepseek';

// Post-prompt processing not needed with DeepSeek's native format handling
export type PostPromptProcessing = 'none';

export type ImageGenProvider = 'dalle' | 'sd-webui' | 'comfyui';
