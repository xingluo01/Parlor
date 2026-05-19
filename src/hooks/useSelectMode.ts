import { useState, useCallback } from 'react';

export function useSelectMode<T extends { id: string }>() {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelectMode = useCallback(() => {
    setSelectMode(prev => !prev);
    setSelectedIds(new Set());
  }, []);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((items: T[]) => {
    setSelectedIds(prev => {
      if (prev.size === items.length) {
        return new Set();
      }
      return new Set(items.map(i => i.id));
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectMode(false);
  }, []);

  return {
    selectMode,
    selectedIds,
    setSelectMode,
    toggleSelectMode,
    handleToggleSelect,
    handleSelectAll,
    clearSelection,
  };
}
