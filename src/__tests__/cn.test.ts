import { describe, it, expect } from 'vitest';
import { cn } from '../utils/cn';

describe('cn', () => {
  it('should merge tailwind classes, later overriding earlier', () => {
    const result = cn('px-4 py-2', 'px-6');
    expect(result).toBe('py-2 px-6');
  });

  it('should handle conditional classes via boolean', () => {
    const result = cn('base', false && 'hidden', true && 'visible');
    expect(result).toBe('base visible');
  });

  it('should handle array of classes', () => {
    const result = cn(['a', 'b'], 'c');
    expect(result).toContain('a');
    expect(result).toContain('b');
    expect(result).toContain('c');
  });

  it('should return empty string for no inputs', () => {
    expect(cn()).toBe('');
  });

  it('should filter out falsy values', () => {
    const result = cn('a', undefined, null, false, '', 'b');
    expect(result).toBe('a b');
  });
});
