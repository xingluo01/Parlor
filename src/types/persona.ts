export type Persona = {
  id: string;
  name: string;
  description: string;
  personality?: string;
  avatar?: string;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
};
