/**
 * 统一文件名安全化
 * 只过滤 Windows 非法文件名字符，保留中文等 UTF-8 字符
 */
export function sanitizeFilename(name: string): string {
  const sanitized = name.replace(/[\\/:*?"<>|]/g, '_').trim();
  return sanitized || 'export';
}
