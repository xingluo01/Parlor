import type { LorebookEntry } from '../types';

/**
 * Normalize a single lorebook entry from various input formats.
 * Handles SillyTavern compatibility: `keys` → `keywords`, `secondary_keys` → `secondaryKeywords`
 */
export function normalizeLorebookEntry(entry: any): LorebookEntry | null | undefined {
  if (entry === null || entry === undefined) return entry;
  
  return {
    ...entry,
    keywords: entry.keywords ?? entry.keys ?? [],
    secondaryKeywords: entry.secondaryKeywords ?? entry.secondary_keys ?? entry.secondaryKeywords,
  };
}

/**
 * Normalize an array of lorebook entries, filtering out null/undefined
 */
export function normalizeLorebookEntries(entries: any[] | undefined | null): LorebookEntry[] {
  if (!entries) return [];
  return entries.map((e: any) => normalizeLorebookEntry(e)) as LorebookEntry[];
}

/**
 * Normalize a character card: convert `keys` → `keywords` in characterBook entries
 */
export function normalizeCharacterCard(card: any) {
  if (!card) return card;
  
  return {
    ...card,
    characterBook: card.characterBook
      ? {
          ...card.characterBook,
          entries: normalizeLorebookEntries(card.characterBook.entries),
        }
      : card.characterBook,
  };
}

/**
 * Normalize a WorldInfo: convert `keys` → `keywords` in entries
 */
export function normalizeWorldInfo(wi: any) {
  if (!wi) return wi;
  
  return {
    ...wi,
    entries: normalizeLorebookEntries(wi.entries),
  };
}
