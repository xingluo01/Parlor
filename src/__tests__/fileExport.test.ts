import { describe, it, expect } from 'vitest';
import { sanitizeFilename } from '../utils/fileExport';

describe('sanitizeFilename', () => {
  it('should preserve safe filenames', () => {
    expect(sanitizeFilename('Alice')).toBe('Alice');
    expect(sanitizeFilename('hello-world.txt')).toBe('hello-world.txt');
  });

  it('should replace Windows illegal characters with underscores', () => {
    expect(sanitizeFilename('file:name')).toBe('file_name');
    expect(sanitizeFilename('file/name')).toBe('file_name');
    expect(sanitizeFilename('file\\name')).toBe('file_name');
    expect(sanitizeFilename('file*name')).toBe('file_name');
    expect(sanitizeFilename('file?name')).toBe('file_name');
    expect(sanitizeFilename('file<name>')).toBe('file_name_');
    expect(sanitizeFilename('file|name')).toBe('file_name');
    expect(sanitizeFilename('file"name')).toBe('file_name');
  });

  it('should preserve Chinese characters', () => {
    expect(sanitizeFilename('角色_测试')).toBe('角色_测试');
    expect(sanitizeFilename('角色:测试')).toBe('角色_测试');
  });

  it('should trim whitespace', () => {
    expect(sanitizeFilename('  hello  ')).toBe('hello');
  });

  it('should fallback to "export" for empty or whitespace-only input', () => {
    expect(sanitizeFilename('')).toBe('export');
    expect(sanitizeFilename('   ')).toBe('export');
  });
});
