import { describe, it, expect } from 'vitest';
import { 
  normalizeLorebookEntry, 
  normalizeLorebookEntries,
  normalizeCharacterCard,
  normalizeWorldInfo,
} from '../utils/normalizeLorebook';

describe('normalizeLorebookEntry', () => {
  it('converts `keys` to `keywords` when `keywords` is missing', () => {
    const entry = { id: '1', keys: ['keyword1', 'keyword2'], content: 'test' };
    const result = normalizeLorebookEntry(entry)!;
    expect(result.keywords).toEqual(['keyword1', 'keyword2']);
  });

  it('preserves existing `keywords` when both `keys` and `keywords` exist', () => {
    const entry = { id: '2', keys: ['old'], keywords: ['new'], content: 'test' };
    const result = normalizeLorebookEntry(entry)!;
    expect(result.keywords).toEqual(['new']);
  });

  it('handles entries with no `keys` or `keywords` field', () => {
    const entry = { id: '3', content: 'test' };
    const result = normalizeLorebookEntry(entry)!;
    expect(result.keywords).toEqual([]);
  });

  it('handles null and undefined entries', () => {
    expect(normalizeLorebookEntry(null)).toBeNull();
    expect(normalizeLorebookEntry(undefined)).toBeUndefined();
  });

  it('converts `secondary_keys` to `secondaryKeywords`', () => {
    const entry = { id: '4', keys: ['k'], secondary_keys: ['sk1', 'sk2'], content: 'test' };
    const result = normalizeLorebookEntry(entry)!;
    expect(result.secondaryKeywords).toEqual(['sk1', 'sk2']);
  });

  it('preserves all other fields', () => {
    const entry = {
      id: '5', keys: ['k'], content: 'hello',
      enabled: true, insertionOrder: 1, caseSensitive: false,
    };
    const result = normalizeLorebookEntry(entry)!;
    expect(result.id).toBe('5');
    expect(result.content).toBe('hello');
    expect(result.enabled).toBe(true);
    expect(result.insertionOrder).toBe(1);
  });
});

describe('normalizeLorebookEntries', () => {
  it('normalizes all entries in an array', () => {
    const entries = [
      { id: '1', keys: ['k1'], content: 'a' },
      { id: '2', keys: ['k2'], content: 'b' },
    ];
    const result = normalizeLorebookEntries(entries);
    expect(result).toHaveLength(2);
    expect(result[0].keywords).toEqual(['k1']);
    expect(result[1].keywords).toEqual(['k2']);
  });

  it('returns empty array for null/undefined input', () => {
    expect(normalizeLorebookEntries(null)).toEqual([]);
    expect(normalizeLorebookEntries(undefined)).toEqual([]);
  });
});

describe('normalizeCharacterCard', () => {
  it('normalizes characterBook entries', () => {
    const card = {
      id: 'char1',
      name: 'Test',
      characterBook: {
        entries: [
          { id: 'e1', keys: ['keyword1'], content: 'content1' },
          { id: 'e2', keys: ['keyword2'], content: 'content2' },
        ],
      },
    };
    const result = normalizeCharacterCard(card);
    expect(result.characterBook.entries[0].keywords).toEqual(['keyword1']);
    expect(result.characterBook.entries[1].keywords).toEqual(['keyword2']);
  });

  it('handles character with no characterBook', () => {
    const card = { id: 'char2', name: 'Test2' };
    const result = normalizeCharacterCard(card);
    expect(result.characterBook).toBeUndefined();
  });

  it('preserves card-level fields', () => {
    const card = { id: 'char3', name: 'Test3', description: 'desc', tags: ['tag1'] };
    const result = normalizeCharacterCard(card);
    expect(result.name).toBe('Test3');
    expect(result.tags).toEqual(['tag1']);
  });
});

describe('normalizeWorldInfo', () => {
  it('normalizes world info entries', () => {
    const wi = {
      id: 'wi1',
      name: 'World',
      entries: [
        { id: 'e1', keys: ['k1'], content: 'c1' },
      ],
    };
    const result = normalizeWorldInfo(wi);
    expect(result.entries[0].keywords).toEqual(['k1']);
  });

  it('handles world info with no entries', () => {
    const wi = { id: 'wi2', name: 'Empty' };
    const result = normalizeWorldInfo(wi);
    expect(result.entries).toEqual([]);
  });
});

describe('buildMessages crash regression', () => {
  it('simulates the crash scenario: entry.keywords.some() should work after normalization', () => {
    // This simulates what buildMessages does at api.ts:230
    const rawEntries = [
      { id: 'e1', keys: ['keyword1'], content: 'content1', enabled: true },
      { id: 'e2', keywords: ['keyword2'], content: 'content2', enabled: true },
    ];

    const normalized = normalizeLorebookEntries(rawEntries);

    // This should NOT crash
    expect(() => {
      normalized.forEach(entry => {
        entry.keywords.some(kw => kw === 'keyword1');
      });
    }).not.toThrow();

    // Verify the actual filtering works
    const triggered = normalized.filter(entry => 
      entry.keywords.some(kw => kw === 'keyword1')
    );
    expect(triggered).toHaveLength(1);
    expect(triggered[0].id).toBe('e1');
  });
});
