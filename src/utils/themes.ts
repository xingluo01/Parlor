import type { ThemeConfig } from '../types';

// ThemeConfig stores hex colors. We convert to space-separated RGB for CSS variables
// so Tailwind opacity modifiers (bg-parlor-500/30, bg-dark-100/50, etc.) work correctly.

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return hex; // fallback if invalid
  return `${r} ${g} ${b}`;
}

export const BUILT_IN_THEMES: Record<string, ThemeConfig> = {
  dark: {
    name: 'Ink & Velvet',
    brandColor: '#a8395e',
    dark50: '#28221e',
    dark100: '#1e1916',
    dark200: '#151210',
    dark300: '#0d0b09',
  },
  midnight: {
    name: 'Midnight',
    brandColor: '#6366f1',
    dark50: '#1e1b4b',
    dark100: '#1a1744',
    dark200: '#13103a',
    dark300: '#0c0a2a',
  },
  lavender: {
    name: 'Lavender',
    brandColor: '#a855f7',
    dark50: '#2d2040',
    dark100: '#251a36',
    dark200: '#1c132b',
    dark300: '#140e20',
  },
  forest: {
    name: 'Forest',
    brandColor: '#22c55e',
    dark50: '#1a2e1a',
    dark100: '#162816',
    dark200: '#0f1e0f',
    dark300: '#0a150a',
  },
  crimson: {
    name: 'Crimson',
    brandColor: '#ef4444',
    dark50: '#2e1a1a',
    dark100: '#281616',
    dark200: '#1e0f0f',
    dark300: '#150a0a',
  },
  classic: {
    name: 'Classic Purple',
    brandColor: '#8b5cf6',
    dark50: '#1e1e2e',
    dark100: '#181825',
    dark200: '#11111b',
    dark300: '#0a0a12',
  },
};

export function applyTheme(theme: ThemeConfig): void {
  const root = document.documentElement;
  root.style.setProperty('--parlor-500', hexToRgb(theme.brandColor));
  root.style.setProperty('--dark-50', hexToRgb(theme.dark50));
  root.style.setProperty('--dark-100', hexToRgb(theme.dark100));
  root.style.setProperty('--dark-200', hexToRgb(theme.dark200));
  root.style.setProperty('--dark-300', hexToRgb(theme.dark300));
}

export function resetTheme(): void {
  applyTheme(BUILT_IN_THEMES.dark);
}

export function getTheme(name: string, custom?: ThemeConfig): ThemeConfig {
  if (name === 'custom' && custom) return custom;
  return BUILT_IN_THEMES[name] || BUILT_IN_THEMES.dark;
}
