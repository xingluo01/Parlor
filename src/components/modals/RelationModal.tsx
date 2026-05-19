import { useState } from 'react';
import { X, Search, Plus, Trash2 } from 'lucide-react';
import { generateUUID } from '../../utils/uuid';
import type { CharacterCard, CharacterRelation } from '../../types';

interface RelationModalProps {
  character: CharacterCard;
  allCharacters: CharacterCard[];
  onSave: (relations: CharacterRelation[]) => Promise<void>;
  onClose: () => void;
}

const RELATION_TYPES = ['情侣', '师徒', '好友', '敌对', '家人', '主仆', '师生', '同门', '其他'] as const;

export default function RelationModal({ character, allCharacters, onSave, onClose }: RelationModalProps) {
  const [relations, setRelations] = useState<CharacterRelation[]>(character.relations || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  // 可关联的角色（排除自己 + 已关联的）
  const availableCharacters = allCharacters.filter(c =>
    c.id !== character.id &&
    !relations.some(r => r.targetId === c.id) &&
    (c.name.toLowerCase().includes(searchQuery.toLowerCase()) || searchQuery === '')
  );

  function addRelation(targetChar: CharacterCard) {
    const newRel: CharacterRelation = {
      id: generateUUID(),
      targetId: targetChar.id,
      relationType: '其他',
      summary: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setRelations(prev => [...prev, newRel]);
    setSearchQuery('');
  }

  function updateRelation(id: string, field: Partial<CharacterRelation>) {
    setRelations(prev => prev.map(r =>
      r.id === id ? { ...r, ...field, updatedAt: Date.now() } : r
    ));
  }

  function removeRelation(id: string) {
    setRelations(prev => prev.filter(r => r.id !== id));
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

  // 通过 targetId 获取角色名称
  function getCharName(id: string): string {
    return allCharacters.find(c => c.id === id)?.name || '未知角色';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-full sm:w-auto max-w-lg max-h-[80vh] mx-4 flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-sm">角色关联 — {character.name}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><X size={16} /></button>
        </div>

        {/* 已有关联列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {relations.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">暂无关联角色，从下方搜索添加</p>
          )}
          {relations.map(rel => (
            <div key={rel.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{getCharName(rel.targetId)}</p>
                <div className="flex items-center gap-2 mt-1">
                  <select
                    value={rel.relationType}
                    onChange={e => updateRelation(rel.id, { relationType: e.target.value as any })}
                    className="text-xs px-2 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900"
                  >
                    {RELATION_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <input
                  value={rel.summary}
                  onChange={e => updateRelation(rel.id, { summary: e.target.value })}
                  placeholder="关系描述（可选）"
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
              placeholder="搜索角色添加关联..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
            />
          </div>
          {searchQuery && (
            <div className="mt-2 max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
              {availableCharacters.length === 0 ? (
                <p className="text-xs text-gray-400 p-2 text-center">未找到匹配角色</p>
              ) : (
                availableCharacters.slice(0, 10).map(char => (
                  <button
                    key={char.id}
                    onClick={() => addRelation(char)}
                    className="w-full flex items-center gap-2 p-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 text-left"
                  >
                    <Plus size={14} className="text-parlor-500 shrink-0" />
                    <span>{char.name}</span>
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
