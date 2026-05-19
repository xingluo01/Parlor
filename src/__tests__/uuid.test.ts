import { describe, it, expect } from 'vitest';
import { generateUUID } from '../utils/uuid';

describe('generateUUID', () => {
  it('should return a string of 36 characters', () => {
    const uuid = generateUUID();
    expect(uuid).toHaveLength(36);
  });

  it('should follow UUID v4 format (xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)', () => {
    const uuid = generateUUID();
    // UUID v4 pattern: 8-4-4-4-12 hex digits, version digit = 4, variant digit = 8/9/a/b
    const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(uuid).toMatch(pattern);
  });

  it('should generate unique values on successive calls', () => {
    const uuids = Array.from({ length: 100 }, () => generateUUID());
    const unique = new Set(uuids);
    expect(unique.size).toBe(100);
  });

  it('should contain only lowercase hex digits and hyphens', () => {
    const uuid = generateUUID();
    expect(uuid).toMatch(/^[0-9a-f-]+$/);
  });
});
