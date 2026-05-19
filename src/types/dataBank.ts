export type DataBankDocument = {
  id: string;
  name: string;
  content: string;
  scope: 'global' | 'character' | 'chat';
  scopeId?: string;
  chunkCount?: number;
  createdAt: number;
  updatedAt: number;
};
