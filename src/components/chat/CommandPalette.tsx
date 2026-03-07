import { useEffect, useRef, useState } from 'react';
import { Terminal } from 'lucide-react';
import { searchCommands } from '../../services/slashCommands';

type CommandPaletteProps = {
  query: string;
  onSelect: (command: string) => void;
  onClose: () => void;
};

export function CommandPalette({ query, onSelect, onClose }: CommandPaletteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const results = searchCommands(query);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (results.length === 0) {
        if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => (i + 1) % results.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => (i - 1 + results.length) % results.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onSelect('/' + results[selectedIndex].name);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [results, selectedIndex, onSelect, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (results.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="absolute bottom-full mb-2 left-0 z-50 bg-dark-100 border border-glass-border rounded-xl shadow-dramatic py-1 min-w-[260px] max-h-[240px] overflow-y-auto"
    >
      {results.map((cmd, i) => (
        <button
          key={cmd.name}
          className={`w-full flex items-start gap-3 px-3 py-2 text-left transition-colors ${
            i === selectedIndex
              ? 'bg-parlor-500/10 text-white'
              : 'text-gray-500 hover:bg-glass-white hover:text-gray-300'
          }`}
          onMouseEnter={() => setSelectedIndex(i)}
          onClick={() => onSelect('/' + cmd.name)}
        >
          <Terminal size={16} className="mt-0.5 shrink-0 text-parlor-500" />
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-sm">{cmd.name}</span>
              <span className="text-xs text-gray-500">{cmd.usage}</span>
            </div>
            <p className="text-xs text-gray-500 truncate">{cmd.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
