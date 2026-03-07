import { useState, useRef, useCallback } from 'react';
import { GripVertical, RotateCcw } from 'lucide-react';
import type { PromptEntry, PromptOrderEntry } from '../../types';

type PromptOrderEditorProps = {
  prompts: PromptEntry[];
  promptOrder: PromptOrderEntry[];
  onPromptsChange: (prompts: PromptEntry[]) => void;
  onOrderChange: (order: PromptOrderEntry[]) => void;
};

/** Resolve display order: use promptOrder if non-empty, otherwise array order. */
function getOrderedPrompts(
  prompts: PromptEntry[],
  promptOrder: PromptOrderEntry[],
): { prompt: PromptEntry; enabled: boolean }[] {
  if (promptOrder.length === 0) {
    return prompts.map((p) => ({ prompt: p, enabled: p.enabled !== false }));
  }

  const promptMap = new Map(prompts.map((p) => [p.identifier, p]));
  const ordered: { prompt: PromptEntry; enabled: boolean }[] = [];

  for (const entry of promptOrder) {
    const prompt = promptMap.get(entry.identifier);
    if (prompt) {
      ordered.push({ prompt, enabled: entry.enabled });
    }
  }

  // Append any prompts not present in promptOrder (safety fallback)
  const inOrder = new Set(promptOrder.map((e) => e.identifier));
  for (const p of prompts) {
    if (!inOrder.has(p.identifier)) {
      ordered.push({ prompt: p, enabled: p.enabled !== false });
    }
  }

  return ordered;
}

const roleBadgeClass: Record<string, string> = {
  system: 'bg-blue-500/20 text-blue-400',
  user: 'bg-green-500/20 text-green-400',
  assistant: 'bg-purple-500/20 text-purple-400',
};

export function PromptOrderEditor({
  prompts,
  promptOrder,
  onPromptsChange,
  onOrderChange,
}: PromptOrderEditorProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragCounter = useRef(0);

  const ordered = getOrderedPrompts(prompts, promptOrder);

  // --- Build a canonical order array from current state ---
  const buildOrder = useCallback(
    (items: { prompt: PromptEntry; enabled: boolean }[]): PromptOrderEntry[] =>
      items.map((item) => ({
        identifier: item.prompt.identifier,
        enabled: item.enabled,
      })),
    [],
  );

  // --- Drag handlers ---
  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
      setDragIndex(index);
    },
    [],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDragEnter = useCallback(
    (_e: React.DragEvent<HTMLDivElement>, index: number) => {
      dragCounter.current++;
      setOverIndex(index);
    },
    [],
  );

  const handleDragLeave = useCallback(() => {
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setOverIndex(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
      e.preventDefault();
      dragCounter.current = 0;
      const sourceIndex = dragIndex ?? Number(e.dataTransfer.getData('text/plain'));

      if (sourceIndex === targetIndex) {
        setDragIndex(null);
        setOverIndex(null);
        return;
      }

      const newOrdered = [...ordered];
      const [moved] = newOrdered.splice(sourceIndex, 1);
      newOrdered.splice(targetIndex, 0, moved);

      onOrderChange(buildOrder(newOrdered));
      setDragIndex(null);
      setOverIndex(null);
    },
    [ordered, dragIndex, onOrderChange, buildOrder],
  );

  const handleDragEnd = useCallback(() => {
    dragCounter.current = 0;
    setDragIndex(null);
    setOverIndex(null);
  }, []);

  // --- Toggle enable/disable ---
  const handleToggle = useCallback(
    (index: number) => {
      const item = ordered[index];
      const newEnabled = !item.enabled;

      // Update promptOrder
      const newOrdered = ordered.map((o, i) =>
        i === index ? { ...o, enabled: newEnabled } : o,
      );
      onOrderChange(buildOrder(newOrdered));

      // Also sync to prompts array
      const newPrompts = prompts.map((p) =>
        p.identifier === item.prompt.identifier
          ? { ...p, enabled: newEnabled }
          : p,
      );
      onPromptsChange(newPrompts);
    },
    [ordered, prompts, onOrderChange, onPromptsChange, buildOrder],
  );

  // --- Reset to default ---
  const handleReset = useCallback(() => {
    onOrderChange([]);
  }, [onOrderChange]);

  if (prompts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No prompts in this preset.</p>
        <p className="text-sm mt-1">
          Import a SillyTavern preset to add prompts.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">
          Drag to reorder prompts. Toggle to enable or disable.
        </p>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white bg-dark-100 border border-glass-border hover:border-parlor-500/40 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset to Default
        </button>
      </div>

      {/* Card list */}
      <div className="space-y-1.5">
        {ordered.map(({ prompt, enabled }, index) => {
          const isDragging = dragIndex === index;
          const isOver = overIndex === index && dragIndex !== index;

          return (
            <div
              key={prompt.identifier}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDragEnter={(e) => handleDragEnter(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`glass-sm flex items-center gap-3 px-3 py-2.5 select-none transition-all duration-150
                ${isDragging ? 'opacity-30 scale-[0.98]' : 'opacity-100'}
                ${isOver ? 'ring-2 ring-parlor-500/50 bg-parlor-500/5' : ''}
                ${!enabled ? 'opacity-50' : ''}
              `}
            >
              {/* Drag handle */}
              <div className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300 flex-shrink-0">
                <GripVertical className="w-4 h-4" />
              </div>

              {/* Name + badges */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white truncate">
                    {prompt.name}
                  </span>

                  {/* Role badge */}
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase leading-none flex-shrink-0 ${
                      roleBadgeClass[prompt.role] || roleBadgeClass.system
                    }`}
                  >
                    {prompt.role}
                  </span>

                  {/* Depth indicator */}
                  {prompt.injection_position === 1 &&
                    prompt.injection_depth !== undefined && (
                      <span className="text-[10px] font-medium text-accent-500 bg-accent-500/15 px-1.5 py-0.5 rounded leading-none flex-shrink-0">
                        @ depth {prompt.injection_depth}
                      </span>
                    )}

                  {/* Marker badge */}
                  {prompt.marker && (
                    <span className="text-[10px] font-medium text-yellow-400 bg-yellow-500/15 px-1.5 py-0.5 rounded leading-none flex-shrink-0">
                      marker
                    </span>
                  )}
                </div>

                {/* Content preview */}
                {prompt.content && !prompt.marker && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {prompt.content.length > 80
                      ? prompt.content.slice(0, 80) + '...'
                      : prompt.content}
                  </p>
                )}
              </div>

              {/* Enable/disable toggle */}
              <button
                onClick={() => handleToggle(index)}
                className={`flex-shrink-0 w-10 h-5 rounded-full relative transition-colors duration-200 ${
                  enabled
                    ? 'bg-parlor-500'
                    : 'bg-dark-100 border border-glass-border'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                    enabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
