export type RegexScript = {
  id: string;
  name: string;
  findRegex: string;
  replaceString: string;
  flags?: string;
  enabled: boolean;
  applyTo: 'input' | 'output' | 'both';
  order: number;
  createdAt: number;
  updatedAt: number;
};
