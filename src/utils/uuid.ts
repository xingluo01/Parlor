/**
 * Generate a UUID v4
 * Works in both secure (localhost/HTTPS) and non-secure (HTTP network IP) contexts
 */
export function generateUUID(): string {
  // Try native crypto.randomUUID first (secure contexts only)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  
  // Fallback: Generate UUID v4 manually
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}