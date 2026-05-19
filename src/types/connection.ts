import type { APIProvider } from './common';

export type ConnectionProfile = {
  id: string;
  name: string;
  provider: APIProvider;
  apiKey: string;
  endpoint?: string;
  model: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
};
