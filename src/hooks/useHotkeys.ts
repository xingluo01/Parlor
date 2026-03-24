import { useEffect } from 'react';

export type HotkeyAction =
  | 'send'
  | 'continue'
  | 'regenerate'
  | 'stopGeneration'
  | 'newLine'
  | 'focusInput';

export type HotkeyMap = Record<string, HotkeyAction>;

/**
 * Default hotkeys for the chat page.
 *
 * Key format: modifier combos joined with '+', e.g. "ctrl+enter", "escape".
 * Modifiers: ctrl, shift, alt, meta.
 */
export const DEFAULT_HOTKEYS: HotkeyMap = {
  'ctrl+enter': 'send',
  'ctrl+shift+enter': 'continue',
  'ctrl+shift+r': 'regenerate',
  'escape': 'stopGeneration',
  'shift+enter': 'newLine',
  'ctrl+l': 'focusInput',
};

function buildKeyString(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');

  const key = e.key.toLowerCase();
  // Avoid duplicating modifier names
  if (!['control', 'shift', 'alt', 'meta'].includes(key)) {
    parts.push(key);
  }

  return parts.join('+');
}

/**
 * Registers global keyboard shortcuts.
 *
 * @param handlers - Map of action names to callback functions.
 *                   Only actions present in the map will be handled.
 * @param enabled  - When false, hotkeys are disabled (e.g. during modal).
 * @param hotkeys  - Custom hotkey mapping (defaults to DEFAULT_HOTKEYS).
 */
export function useHotkeys(
  handlers: Partial<Record<HotkeyAction, () => void>>,
  enabled = true,
  hotkeys: HotkeyMap = DEFAULT_HOTKEYS,
) {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const keyStr = buildKeyString(e);
      const action = hotkeys[keyStr];
      if (!action) return;

      const handler = handlers[action];
      if (!handler) return;

      // Don't intercept newLine — let it pass through to textarea
      if (action === 'newLine') return;

      e.preventDefault();
      e.stopPropagation();
      handler();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers, enabled, hotkeys]);
}
