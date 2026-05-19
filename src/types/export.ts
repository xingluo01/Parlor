import type { CharacterCard } from './character';
import type { Persona } from './persona';
import type { Preset } from './preset';
import type { RegexScript } from './regex';
import type { AppSettings } from './settings';
import type { ConnectionProfile } from './connection';
import type { ChatSession } from './chat';

export type QuickBackup = {
  version: string;
  exportType: 'quick';
  exportDate: string;
  characters: CharacterCard[];
  personas: Persona[];
  presets: Preset[];
  regexes: RegexScript[];
  settings: AppSettings;
  connectionProfiles: Omit<ConnectionProfile, 'apiKey'>[];
};

export type FullBackup = Omit<QuickBackup, 'exportType'> & {
  exportType: 'full';
  chats: ChatSession[];
};
