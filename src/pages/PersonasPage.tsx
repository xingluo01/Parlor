import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { generateUUID } from '../utils/uuid';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Star, Upload, X, User, Sparkles, CheckSquare, Square } from 'lucide-react';
import { Button, Avatar, Modal, Input, Textarea, ImageCropModal, ConfirmDialog } from '../components/ui';
import { useSelectMode } from '../hooks/useSelectMode';
import { usePersonaStore } from '../stores';
import { connectionOps, personaOps, worldInfoOps, characterOps } from '../db';
import type { Persona, WorldInfo } from '../types';
import { callAI } from '../services/ai';
import { extractJSON, buildCreatePersonaPrompt, CARD_HEIGHT_MAP } from '../utils/prompts';
import { settingsOps } from '../db';

export function PersonasPage() {
  const { t } = useTranslation();
  const personas = usePersonaStore(s => s.personas);
  const setPersonas = usePersonaStore(s => s.setPersonas);
  const activePersona = usePersonaStore(s => s.activePersona);
  const setActivePersona = usePersonaStore(s => s.setActivePersona);
  const [isLoading, setIsLoading] = useState(true);
  
  // Sort personas alphabetically by name
  const sortedPersonas = useMemo(() => {
    return [...personas].sort((a, b) => a.name.localeCompare(b.name));
  }, [personas]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const viewMode = 'grid';
  const [cardSize, setCardSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAIPersona, setShowAIPersona] = useState(false);
  const [aiPersonaPrompt, setAiPersonaPrompt] = useState('');
  const [aiPersonaGenerating, setAiPersonaGenerating] = useState(false);
  const [worldInfoBooks, setWorldInfoBooks] = useState<WorldInfo[]>([]);
  const [selectedBookId, setSelectedBookId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedCharId, setSelectedCharId] = useState('');
  const [allCharacters, setAllCharacters] = useState<any[]>([]);
  const { selectMode, selectedIds, toggleSelectMode, handleToggleSelect, handleSelectAll, clearSelection } = useSelectMode<Persona>();
  const [deleteSelectedConfirm, setDeleteSelectedConfirm] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  useEffect(() => {
    async function loadPersonas() {
      try {
        const [personaList, appSettings] = await Promise.all([
          personaOps.getAll(),
          settingsOps.get(),
        ]);
        if (appSettings?.cardSize) setCardSize(appSettings.cardSize);
        setPersonas(personaList);
        const defaultPersona = personaList.find((p) => p.isDefault);
        if (defaultPersona) {
          setActivePersona(defaultPersona);
        }
      } catch (error) {
        console.error('Failed to load personas:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadPersonas();
    worldInfoOps.getAll().then(books => setWorldInfoBooks(books)).catch(() => {});
    characterOps.getAllCompact().then(chars => setAllCharacters(chars)).catch(() => {});
  }, [setPersonas, setActivePersona]);

  const handleSetDefault = async (id: string) => {
    try {
      await personaOps.setDefault(id);
      const persona = personas.find((p) => p.id === id);
      if (persona) {
        setActivePersona({ ...persona, isDefault: true });
      }
      setPersonas(
        personas.map((p) => ({
          ...p,
          isDefault: p.id === id,
        }))
      );
    } catch (error) {
      console.error('Failed to set default persona:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await personaOps.delete(id);
      setPersonas(personas.filter((p) => p.id !== id));
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete persona:', error);
    }
  };

  const handleEdit = (persona: Persona) => {
    setEditingPersona(persona);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setEditingPersona(null);
    setIsModalOpen(true);
  };

  const handleSave = async (data: Partial<Persona>) => {
    if (editingPersona) {
      await personaOps.update(editingPersona.id, data);
      const updated = personas.map((p) =>
        p.id === editingPersona.id ? { ...p, ...data } : p
      );
      setPersonas(updated);
      if (editingPersona.id === activePersona?.id) {
        setActivePersona({ ...editingPersona, ...data });
      }
    } else {
      const newPersona: Persona = {
        id: generateUUID(),
        name: data.name || t('personas.newPersona'),
        description: data.description || '',
        personality: data.personality,
        avatar: data.avatar,
        isDefault: personas.length === 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await personaOps.add(newPersona);
      setPersonas([...personas, newPersona]);
    }
    setIsModalOpen(false);
  };

  // Import personas from JSON file
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportSuccess(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate structure
      if (!data.personas || typeof data.personas !== 'object') {
        throw new Error(t('personas.invalidFormat'));
      }

      const personaNames = data.personas as Record<string, string>;
      const personaDescriptions = data.persona_descriptions as Record<string, { description?: string }> || {};
      const defaultPersonaId = data.default_persona as string | undefined;

      const importedPersonas: Persona[] = [];
      const now = Date.now();

      for (const [fileId, name] of Object.entries(personaNames)) {
        const descData = personaDescriptions[fileId];
        const description = descData?.description || '';

        const persona: Persona = {
          id: generateUUID(),
          name: name || t('personas.newPersona'),
          description: description.replace(/\{\{user\}\}/g, '{{user}}'),
          avatar: undefined, // Images would need to be imported separately
          isDefault: fileId === defaultPersonaId,
          createdAt: now,
          updatedAt: now,
        };

        importedPersonas.push(persona);
      }

      // If no default was set, make the first one default
      if (importedPersonas.length > 0 && !importedPersonas.some(p => p.isDefault)) {
        importedPersonas[0].isDefault = true;
      }

      // Check for existing default "User" persona to replace
      const existingDefault = personas.find(p => p.isDefault);
      const isDefaultUser = existingDefault && existingDefault.name === 'User';
      
      // If importing and there's a default "User" persona, delete it
      if (isDefaultUser && importedPersonas.length > 0) {
        await personaOps.delete(existingDefault.id);
        // Remove from local state
        const remainingPersonas = personas.filter(p => p.id !== existingDefault.id);
        setPersonas(remainingPersonas);
      }

      // Add all imported personas to database
      for (const persona of importedPersonas) {
        await personaOps.add(persona);
      }

      // Update state - use current personas (minus deleted User if applicable)
      const currentPersonas = isDefaultUser 
        ? personas.filter(p => p.id !== existingDefault.id)
        : personas;
      setPersonas([...currentPersonas, ...importedPersonas]);
      setImportSuccess(importedPersonas.length);

      // Set default persona as active
      const defaultOne = importedPersonas.find(p => p.isDefault);
      if (defaultOne) {
        setActivePersona(defaultOne);
      }

    } catch (error) {
      console.error('Import error:', error);
      setImportError(error instanceof Error ? error.message : 'Failed to import personas');
    } finally {
      // Reset file input
      e.target.value = '';
    }
  };

  // 从角色中提取分组（按 worldInfoId 归类）
  const characterGroups = useMemo(() => {
    const groupMap = new Map<string, { count: number }>();
    for (const c of allCharacters) {
      if (c.worldInfoId) {
        const existing = groupMap.get(c.worldInfoId);
        if (existing) existing.count++;
        else groupMap.set(c.worldInfoId, { count: 1 });
      }
    }
    return groupMap;
  }, [allCharacters]);

  // ─── AI 创建人设 ──────────────────────────────────────────────────────────────

  async function handleAICreatePersona() {
    if (!aiPersonaPrompt.trim()) return;
    setAiPersonaGenerating(true);
    try {
      const connection = await connectionOps.getActive();
      if (!connection) { alert('请先配置 AI 连接'); return; }

      // 获取选中的世界书信息
      let worldContext = '';
      if (selectedBookId) {
        const book = worldInfoBooks.find(b => b.id === selectedBookId);
        if (book) {
          worldContext = `参考世界观「${book.name}」的设定：\n${book.entries.slice(0, 10).map(e => `- ${e.keywords.join(', ')}: ${e.content.slice(0, 100)}`).join('\n')}`;
        }
      }

      // 角色组参考
      let groupContext = '';
      if (selectedGroupId) {
        const group = worldInfoBooks.find(b => b.id === selectedGroupId);
        if (group) {
          groupContext = `参考角色组「${group.name}」的设定：\n${group.entries.slice(0, 10).map(e => `- ${e.keywords.join(', ')}: ${e.content.slice(0, 150)}`).join('\n')}`;
        }
      }

      // 角色参考
      let charRefContext = '';
      if (selectedCharId) {
        const ch = allCharacters.find((c: any) => c.id === selectedCharId);
        if (ch) {
          charRefContext = `参考角色「${ch.name}」的信息：\n描述：${(ch.description || '').slice(0, 200)}\n性格：${(ch.personality || '').slice(0, 100)}`;
        }
      }

      const prompt = buildCreatePersonaPrompt(worldContext, groupContext, aiPersonaPrompt, charRefContext);

      const resultText = await callAI(connection, '你是一个人设创作专家。', prompt, { temperature: 0.5, maxTokens: 2048 });

      // 解析 JSON
      const result = extractJSON(resultText);
      if (!result.name) throw new Error('AI 未生成人设名称');

      // 保存人设
      const persona: Persona = {
        id: generateUUID(),
        name: result.name,
        description: result.description || '',
        personality: result.personality || '',
        isDefault: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await personaOps.add(persona);
      setPersonas([...personas, persona]);
      setShowAIPersona(false);
      setAiPersonaPrompt('');
    } catch (e: any) {
      alert(`创建失败: ${e.message}`);
    } finally {
      setAiPersonaGenerating(false);
    }
  }

  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsBatchDeleting(true);
    try {
      await Promise.all([...selectedIds].map(id => personaOps.delete(id)));
      setPersonas(personas.filter(p => !selectedIds.has(p.id)));
      clearSelection();
    } catch (err) {
      console.error('Batch delete failed:', err);
    } finally {
      setIsBatchDeleting(false);
      setDeleteSelectedConfirm(false);
    }
  }, [selectedIds, personas, setPersonas, clearSelection]);

  return (
    <div className="p-4 md:p-6">
      {/* Header + Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-serif tracking-tight">{t('personas.title')}</h1>
          <p className="text-gray-600 text-sm mt-1">
            {t('personas.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectMode ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => handleSelectAll(sortedPersonas)} disabled={selectedIds.size === sortedPersonas.length}>
                <CheckSquare className="w-4 h-4" />
                <span className="hidden sm:inline">{t('characters.selectAll')}</span>
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setDeleteSelectedConfirm(true)}
                disabled={selectedIds.size === 0 || isBatchDeleting}
                isLoading={isBatchDeleting}
              >
                <Trash2 className="w-4 h-4" />
                {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
              </Button>
              <Button variant="ghost" size="sm" onClick={toggleSelectMode}>
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">{t('common.cancel')}</span>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={toggleSelectMode} title={t('characters.select')}>
                <CheckSquare className="w-4 h-4" />
                <span className="hidden sm:inline">{t('characters.select')}</span>
              </Button>
              <Button variant="secondary" size="sm" onClick={handleCreate}>
                <Plus className="w-4 h-4" />
                {t('personas.newPersona')}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowAIPersona(true)}>
                <Sparkles className="w-4 h-4" />
                AI 创建
              </Button>
              <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4" />
                {t('personas.import')}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </>
          )}
        </div>
      </div>

      {/* Import Status */}
      {importError && (
        <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-between">
          <span>{importError}</span>
          <button onClick={() => setImportError(null)} className="hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      
      {importSuccess !== null && (
        <div className="mb-4 p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 flex items-center justify-between">
          <span>{t('personas.importSuccess', { count: importSuccess })}</span>
          <button onClick={() => setImportSuccess(null)} className="hover:text-green-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Personas List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-parlor-500" />
        </div>
      ) : personas.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="w-16 h-16 rounded-full bg-dark-200 flex items-center justify-center mb-4">
            <User className="w-8 h-8 text-gray-600" />
          </div>
          <p className="text-gray-400 mb-2 font-serif">{t('personas.noPersonas')}</p>
          <p className="text-gray-600 text-sm mb-4">
            {t('personas.emptyHint')}
          </p>
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4" />
            {t('personas.createFirst')}
          </Button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
            : 'space-y-2'
          }
        >
          {sortedPersonas.map((persona) =>
            viewMode === 'grid' ? (
              <motion.div
                key={persona.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`glass p-3 sm:p-4 cursor-pointer transition-all ${CARD_HEIGHT_MAP[cardSize || 'medium']} overflow-hidden ${
                  persona.isDefault ? 'border-parlor-500/30' : ''
                } ${selectedIds.has(persona.id) ? 'ring-1 ring-parlor-500/60' : ''}`}
                onClick={selectMode ? () => handleToggleSelect(persona.id) : undefined}
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  {selectMode && (
                    <div className="flex-shrink-0 mt-1">
                      {selectedIds.has(persona.id)
                        ? <CheckSquare className="w-5 h-5 text-parlor-400" />
                        : <Square className="w-5 h-5 text-gray-600" />
                      }
                    </div>
                  )}
                  <Avatar
                    src={persona.avatar}
                    name={persona.name}
                    size="md"
                    className="flex-shrink-0 sm:hidden"
                  />
                  <Avatar
                    src={persona.avatar}
                    name={persona.name}
                    size="xl"
                    className="flex-shrink-0 hidden sm:block"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-white truncate">{persona.name}</h3>
                      {persona.isDefault && (
                        <span className="text-xs bg-parlor-500/20 text-parlor-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Star className="w-3 h-3" />
                          {t('personas.default')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                      {persona.description || t('personas.noDescription')}
                    </p>
                  </div>
                </div>

                {!selectMode && (
                  <div className="flex gap-2 mt-3 sm:mt-4">
                    {!persona.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetDefault(persona.id)}
                      >
                        <Star className="w-4 h-4" />
                        <span className="hidden sm:inline">{t('personas.setDefaultStandalone')}</span>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(persona)}
                    >
                      <Edit className="w-4 h-4" />
                      {t('personas.edit')}
                    </Button>
                    {!persona.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteConfirm(persona.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key={persona.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`glass-sm p-3 flex items-center gap-3 cursor-pointer transition-all ${
                  persona.isDefault ? 'border-parlor-500/30' : ''
                } ${selectedIds.has(persona.id) ? 'ring-1 ring-parlor-500/60' : ''}`}
                onClick={selectMode ? () => handleToggleSelect(persona.id) : undefined}
              >
                {selectMode ? (
                  <div className="flex-shrink-0">
                    {selectedIds.has(persona.id)
                      ? <CheckSquare className="w-5 h-5 text-parlor-400" />
                      : <Square className="w-5 h-5 text-gray-600" />
                    }
                  </div>
                ) : (
                  <Avatar
                    src={persona.avatar}
                    name={persona.name}
                    size="md"
                    className="flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-white truncate text-sm">{persona.name}</h3>
                    {persona.isDefault && (
                      <span className="text-xs bg-parlor-500/20 text-parlor-400 px-1.5 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0">
                        <Star className="w-3 h-3" />
                        {t('personas.default')}
                      </span>
                    )}
                  </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {persona.description || t('personas.noDescription')}
                    </p>
                </div>
                {!selectMode && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!persona.isDefault && (
                      <button
                        onClick={() => handleSetDefault(persona.id)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-parlor-400 hover:bg-glass-white transition-colors"
                        title={t('personas.setDefault')}
                      >
                        <Star className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(persona)}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-glass-white transition-colors"
                      title={t('personas.edit')}
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {!persona.isDefault && (
                      <button
                        onClick={() => setDeleteConfirm(persona.id)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-glass-white transition-colors"
                        title={t('personas.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            )
          )}
        </motion.div>
      )}

      {/* Persona Modal */}
      <PersonaModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        persona={editingPersona}
        onSave={handleSave}
      />

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title={t('personas.deletePersona')}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-300">
            {t('personas.deleteConfirmSimple')}
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>
              {t('personas.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              {t('personas.delete')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Batch Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteSelectedConfirm}
        onClose={() => setDeleteSelectedConfirm(false)}
        onConfirm={handleDeleteSelected}
        title={t('chatsList.deleteSelectedTitle', { count: selectedIds.size })}
        message={t('chatsList.deleteSelectedConfirm', { count: selectedIds.size })}
        confirmText={isBatchDeleting ? t('common.loading') : t('common.delete')}
        variant="danger"
      />

      {/* AI 创建人设弹窗 */}
      {showAIPersona && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAIPersona(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl border w-full max-w-md mx-4 p-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-3">AI 创建人设</h3>
            <select value={selectedBookId} onChange={e => setSelectedBookId(e.target.value)} className="w-full mb-2 px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-900">
              <option value="">参考世界观组</option>
              {worldInfoBooks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)} className="w-full mb-2 px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-900">
              <option value="">参考角色组</option>
              {Array.from(characterGroups.entries())
                .filter(([id]) => id !== selectedBookId)
                .map(([id, { count }]) => {
                  const book = worldInfoBooks.find(b => b.id === id);
                  return <option key={id} value={id}>{book?.name || '未命名分组'}（{count}个角色）</option>;
                })}
            </select>
            <select value={selectedCharId} onChange={e => setSelectedCharId(e.target.value)} className="w-full mb-2 px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-900">
              <option value="">参考角色</option>
              {allCharacters.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <textarea value={aiPersonaPrompt} onChange={e => setAiPersonaPrompt(e.target.value)} placeholder="描述你想要的人设特征、身份、背景..." className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-900 mb-3" rows={4} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAIPersona(false)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">取消</button>
              <button onClick={handleAICreatePersona} disabled={aiPersonaGenerating || !aiPersonaPrompt.trim()} className="px-4 py-2 text-sm bg-parlor-500 text-white rounded-lg disabled:opacity-50">
                {aiPersonaGenerating ? '生成中...' : 'AI 创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Persona Modal Component
interface PersonaModalProps {
  isOpen: boolean;
  onClose: () => void;
  persona: Persona | null;
  onSave: (persona: Partial<Persona>) => Promise<void>;
}

function PersonaModal({ isOpen, onClose, persona, onSave }: PersonaModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState<string | undefined>();
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (persona) {
      setName(persona.name);
      setDescription(persona.description || '');
      setAvatar(persona.avatar);
    } else {
      setName('');
      setDescription('');
      setAvatar(undefined);
    }
  }, [persona, isOpen]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result as string);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    
    setIsLoading(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        avatar,
        isDefault: persona?.isDefault || false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
    {cropSrc && (
      <ImageCropModal
        imageSrc={cropSrc}
        onConfirm={(url) => { setAvatar(url); setCropSrc(null); }}
        onCancel={() => setCropSrc(null)}
      />
    )}
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={persona ? t('personas.editPersona') : t('personas.newPersonaTitle')}
      size="md"
    >
      <div className="space-y-4">
        {/* Avatar Upload */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar src={avatar} name={name || 'Persona'} size="xl" />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-parlor-600 hover:bg-parlor-500 flex items-center justify-center transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-white" />
            </button>
            {avatar && (
              <button
                onClick={() => setAvatar(undefined)}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center transition-colors"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-400">
              {t('personas.uploadAvatarHint')}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {t('personas.uploadAvatarDetail')}
            </p>
          </div>
        </div>

        <Input
          label={t('personas.name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('personas.namePlaceholder')}
          required
        />
        
        <Textarea
          label={t('personas.description')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('personas.descriptionPlaceholder')}
          rows={4}
        />

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="ghost" onClick={onClose}>
            {t('personas.cancel')}
          </Button>
          <Button onClick={handleSave} isLoading={isLoading} disabled={!name.trim()}>
            {persona ? t('personas.saveChanges') : t('personas.createPersonaBtn')}
          </Button>
        </div>
      </div>
    </Modal>
    </>
  );
}

export default PersonasPage;