export type QuickReply = {
  id: string;
  label: string;
  content: string;
  action: 'send' | 'insert';
};

export type ImageGenSettings = {
  enabled: boolean;
  provider: 'dalle' | 'sd-webui' | 'comfyui';
  endpoint?: string;
  model?: string;
  width?: number;
  height?: number;
};
