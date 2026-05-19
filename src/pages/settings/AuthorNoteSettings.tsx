import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit3, ToggleRight, ToggleLeft } from 'lucide-react';
import { authorNoteOps, settingsOps } from '../../db';
import { generateUUID } from '../../utils/uuid';
import type { AuthorNotePreset } from '../../types';

export function AuthorNoteSettings() {
  const [presets, setPresets] = useState<AuthorNotePreset[]>([]);
  const [saved, setSaved] = useState(false);
  const [defaultDepth, setDefaultDepth] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [modalId, setModalId] = useState<string | null>(null);
  const [modalName, setModalName] = useState('');
  const [modalContent, setModalContent] = useState('');

  useEffect(() => {
    loadPresets();
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const data = await settingsOps.get();
    setDefaultDepth(data?.authorNoteDefaultDepth ?? 0);
  };

  const loadPresets = async () => {
    const data = await authorNoteOps.getAll();
    setPresets(data);
  };

  const showSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDelete = async (id: string) => {
    await authorNoteOps.delete(id);
    loadPresets();
  };

  const handleToggle = async (preset: AuthorNotePreset) => {
    await authorNoteOps.update(preset.id, { enabled: !preset.enabled });
    loadPresets();
  };

  const openAddModal = () => {
    setModalMode('add');
    setModalId(null);
    setModalName('');
    setModalContent('');
    setModalOpen(true);
  };

  const openEditModal = (preset: AuthorNotePreset) => {
    setModalMode('edit');
    setModalId(preset.id);
    setModalName(preset.name);
    setModalContent(preset.content);
    setModalOpen(true);
  };

  const handleModalSave = async () => {
    if (!modalName.trim() || !modalContent.trim()) return;

    if (modalMode === 'add') {
      const preset: AuthorNotePreset = {
        id: generateUUID(),
        name: modalName.trim(),
        content: modalContent.trim(),
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await authorNoteOps.add(preset);
    } else if (modalMode === 'edit' && modalId) {
      await authorNoteOps.update(modalId, { name: modalName.trim(), content: modalContent.trim() });
    }

    setModalOpen(false);
    loadPresets();
    showSaved();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        创建作者备注预设模板，可在聊天页面中快速填充。启用的预设会自动组合注入到 AI 上下文中。
      </p>

      {/* ===== 全局配置 ===== */}
      <div className="p-3 rounded-lg bg-dark-300/50 border border-glass-border mb-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-gray-300">默认注入深度</span>
            <p className="text-xs text-gray-500 mt-0.5">新建聊天时作者备注默认插入位置（0 = 末尾，越大越靠前）</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={50}
              value={defaultDepth}
              onChange={async (e) => {
                const val = Math.max(0, Math.min(50, parseInt(e.target.value) || 0));
                setDefaultDepth(val);
                await settingsOps.update({ authorNoteDefaultDepth: val });
                showSaved();
              }}
              className="w-16 px-2 py-1 text-sm text-center rounded bg-dark-300 border border-glass-border text-gray-200"
            />
            <span className="text-xs text-gray-500">距末尾</span>
          </div>
        </div>
      </div>

      {/* 新建预设 */}
      <div className="flex items-center justify-end">
        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-parlor-500 text-white rounded-lg hover:bg-parlor-600 transition-colors"
        >
          <Plus size={14} /> 添加预设
        </button>
      </div>

      {/* 预设列表 */}
      <div className="space-y-2">
        {presets.map(p => (
          <div key={p.id} className="flex items-start gap-3 p-3 rounded-lg bg-dark-300/30 border border-glass-border">
            <button onClick={() => handleToggle(p)} className={`p-1 rounded mt-0.5 ${p.enabled ? 'text-green-500' : 'text-gray-500'}`}>
              {p.enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
            </button>

            {/* 展示模式 */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-200">{p.name}</div>
              <div className="text-xs text-gray-500 mt-1 whitespace-pre-wrap line-clamp-3">{p.content}</div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => openEditModal(p)} className="p-1 rounded hover:bg-dark-300 text-gray-500 hover:text-gray-300" title="编辑">
                <Edit3 size={14} />
              </button>
              <button onClick={() => handleDelete(p.id)} className="p-1 rounded hover:bg-dark-300 text-gray-500 hover:text-red-400" title="删除">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {presets.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-4">暂无预设，点击上方按钮创建</p>
        )}
      </div>

      {saved && <p className="text-xs text-green-500">已保存</p>}

      {/* 编辑弹窗 */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setModalOpen(false)}>
          <div className="w-full max-w-lg mx-4 bg-dark-200 border border-glass-border rounded-xl p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-medium text-gray-200 mb-4">
              {modalMode === 'add' ? '新建预设' : '编辑预设'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">预设名称</label>
                <input
                  value={modalName}
                  onChange={e => setModalName(e.target.value)}
                  placeholder="预设名称"
                  className="w-full px-3 py-1.5 text-sm rounded-lg bg-dark-300 border border-glass-border text-gray-200 placeholder-gray-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">备注内容</label>
                <textarea
                  value={modalContent}
                  onChange={e => setModalContent(e.target.value)}
                  placeholder="备注内容（支持多行）"
                  rows={8}
                  className="w-full px-3 py-1.5 text-sm rounded-lg bg-dark-300 border border-glass-border text-gray-200 placeholder-gray-500 resize-none font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-glass-border">
              <button onClick={() => setModalOpen(false)} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors">
                取消
              </button>
              <button
                onClick={handleModalSave}
                disabled={!modalName.trim() || !modalContent.trim()}
                className="px-4 py-1.5 text-sm bg-parlor-500 text-white rounded-lg hover:bg-parlor-600 disabled:opacity-50 transition-colors"
              >
                {modalMode === 'add' ? '添加' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
