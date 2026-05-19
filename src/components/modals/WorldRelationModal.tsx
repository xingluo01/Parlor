import { useState } from 'react';
import { X, Search, Plus, Trash2 } from 'lucide-react';
import { generateUUID } from '../../utils/uuid';
import type { WorldInfo, WorldInfoRelation } from '../../types';

interface WorldRelationModalProps {
  worldInfo: WorldInfo;
  allWorldInfos: WorldInfo[];
  onSave: (relations: WorldInfoRelation[]) => Promise<void>;
  onClose: () => void;
}

export default function WorldRelationModal({ worldInfo, allWorldInfos, onSave, onClose }: WorldRelationModalProps) {
  const [relations, setRelations] = useState<WorldInfoRelation[]>(worldInfo.relations || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  // 可关联的世界书（排除自己 + 已关联的）
  const available = allWorldInfos.filter(w =>
    w.id !== worldInfo.id &&
    !relations.some(r => r.targetId === w.id) &&
    (w.name.toLowerCase().includes(searchQuery.toLowerCase()) || searchQuery === '')
  );

  function addRelation(target: WorldInfo) {
    setRelations(prev => [...prev, {
      id: generateUUID(),
      targetId: target.id,
      summary: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }]);
    setSearchQuery('');
  }

  function updateRelation(id: string, summary: string) {
    setRelations(prev => prev.map(r =>
      r.id === id ? { ...r, summary, updatedAt: Date.now() } : r
    ));
  }

  function removeRelation(id: string) {
    setRelations(prev => prev.filter(r => r.id !== id));
  }

  function getWorldName(id: string): string {
    return allWorldInfos.find(w => w.id === id)?.name || '未知世界书';
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(relations);
      onClose();
    } catch (e) {
      console.error('Failed to save relations:', e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-full sm:w-auto max-w-lg max-h-[80vh] mx-4 flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* 标题 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-sm">世界书关联 — {worldInfo.name}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><X size={16} /></button>
        </div>

        {/* 已有关联列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {relations.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">暂无关联世界书，从下方搜索添加</p>
          )}
          {relations.map(rel => (
            <div key={rel.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{getWorldName(rel.targetId)}</p>
                <input
                  value={rel.summary}
                  onChange={e => updateRelation(rel.id, e.target.value)}
                  placeholder="关联说明（如：续集世界观、平行世界）"
                  className="mt-1 w-full text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900"
                />
              </div>
              <button onClick={() => removeRelation(rel.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded shrink-0">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* 搜索添加区 */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索世界书添加关联..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
            />
          </div>
          {searchQuery && (
            <div className="mt-2 max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
              {available.length === 0 ? (
                <p className="text-xs text-gray-400 p-2 text-center">未找到匹配世界书</p>
              ) : (
                available.slice(0, 10).map(w => (
                  <button
                    key={w.id}
                    onClick={() => addRelation(w)}
                    className="w-full flex items-center gap-2 p-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 text-left"
                  >
                    <Plus size={14} className="text-parlor-500 shrink-0" />
                    <span>{w.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">{w.entries.length} 条目</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">取消</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-parlor-500 text-white rounded-lg hover:bg-parlor-600 disabled:opacity-50">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
