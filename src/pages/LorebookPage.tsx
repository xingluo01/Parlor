import { useState, useEffect, useRef, useMemo, useCallback, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpen, Plus, ChevronDown, ChevronRight, Edit2, Trash2,
  ToggleLeft, ToggleRight, X, Save, FolderOpen,
  FileText, Link2, GitMerge, Sparkles, Download, Upload,
  CheckSquare, Square, UserPlus, UserX
} from 'lucide-react';
import { Button, ConfirmDialog } from '../components/ui';
import { generateUUID } from '../utils/uuid';
import { connectionOps, worldInfoOps, lorebookOps, characterOps } from '../db';
import { useSelectMode } from '../hooks/useSelectMode';
import type { WorldInfo, LorebookEntry } from '../types';
import WorldRelationModal from '../components/modals/WorldRelationModal';
import BridgeModal from '../components/modals/BridgeModal';
import { callAI } from '../services/ai';
import { extractJSON, buildSupplementPrompt } from '../utils/prompts';
import { sanitizeFilename } from '../utils/fileExport';

// ===== 条目编辑弹窗 =====

function EntryModal({
  entry,
  onSave,
  onClose,
}: {
  entry?: Partial<LorebookEntry>;
  onSave: (entry: Partial<LorebookEntry>) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [keywords, setKeywords] = useState((entry?.keywords || []).join(', '));
  const [content, setContent] = useState(entry?.content || '');
  const [enabled, setEnabled] = useState(entry?.enabled ?? true);
  const [insertionOrder, setInsertionOrder] = useState(entry?.insertionOrder ?? 0);
  const [caseSensitive, setCaseSensitive] = useState(entry?.caseSensitive ?? false);
  const [matchWholeWords, setMatchWholeWords] = useState(entry?.matchWholeWords ?? false);
  const [selective, setSelective] = useState(entry?.selective ?? false);
  const [secondaryKeywords, setSecondaryKeywords] = useState((entry?.secondaryKeywords || []).join(', '));
  const [selectiveLogic, setSelectiveLogic] = useState<'AND' | 'OR'>(entry?.selectiveLogic || 'AND');

  function handleSave() {
    onSave({
      ...(entry?.id ? { id: entry.id } : {}),
      keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
      content,
      enabled,
      insertionOrder,
      caseSensitive,
      matchWholeWords,
      selective,
      secondaryKeywords: selective ? secondaryKeywords.split(',').map(k => k.trim()).filter(Boolean) : undefined,
      selectiveLogic: selective ? selectiveLogic : undefined,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold">{entry?.id ? t('lorebook.editEntry') : t('lorebook.newEntry')}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">{t('lorebook.keywords')}</label>
            <input value={keywords} onChange={e => setKeywords(e.target.value)}
              placeholder="dragon, fire, wyrm"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">{t('lorebook.content')}</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={4}
              placeholder={t('lorebook.contentPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm resize-none" />
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)}
                className="rounded border-gray-300" />
              {t('common.enable')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={caseSensitive} onChange={e => setCaseSensitive(e.target.checked)}
                className="rounded border-gray-300" />
              {t('lorebook.caseSensitive')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={matchWholeWords} onChange={e => setMatchWholeWords(e.target.checked)}
                className="rounded border-gray-300" />
              {t('lorebook.matchWholeWords')}
            </label>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">{t('lorebook.insertionOrder')}</label>
            <input type="number" value={insertionOrder} onChange={e => setInsertionOrder(Number(e.target.value))}
              className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm" />
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <label className="flex items-center gap-2 text-sm mb-3">
              <input type="checkbox" checked={selective} onChange={e => setSelective(e.target.checked)}
                className="rounded border-gray-300" />
              {t('lorebook.selectiveLabel')}
            </label>
            {selective && (
              <>
                <div className="mb-3">
                  <label className="text-sm font-medium block mb-1">{t('lorebook.secondaryKeywords')}</label>
                  <input value={secondaryKeywords} onChange={e => setSecondaryKeywords(e.target.value)}
                    placeholder="secondary1, secondary2"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm" />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectiveLogic('AND')}
                    className={`px-3 py-1.5 text-xs rounded-lg ${selectiveLogic === 'AND' ? 'bg-parlor-500 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
                  >
                    {t('lorebook.andLogic')}
                  </button>
                  <button
                    onClick={() => setSelectiveLogic('OR')}
                    className={`px-3 py-1.5 text-xs rounded-lg ${selectiveLogic === 'OR' ? 'bg-parlor-500 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
                  >
                    {t('lorebook.orLogic')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            {t('common.cancel')}
          </button>
          <button onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-parlor-500 text-white rounded-lg hover:bg-parlor-600">
            <Save size={14} /> {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== 主页面 =====

export function LorebookPage() {
  // 数据
  const [books, setBooks] = useState<WorldInfo[]>([]);
  const [orphanEntries, setOrphanEntries] = useState<LorebookEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // UI 状态
  const [expandedBooks, setExpandedBooks] = useState<Set<string>>(new Set());
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [editingBookName, setEditingBookName] = useState('');
  const [newBookName, setNewBookName] = useState('');
  const [showNewBook, setShowNewBook] = useState(false);

  // 条目弹窗
  const [entryModal, setEntryModal] = useState<{
    bookId?: string;         // undefined = orphan entry
    entry?: Partial<LorebookEntry>;
  } | null>(null);

  // 关联弹窗
  const [relationModalBook, setRelationModalBook] = useState<WorldInfo | null>(null);

  // 桥接弹窗
  const [bridgeModalBook, setBridgeModalBook] = useState<WorldInfo | null>(null);

  // AI 补充设定
  const [aiSupplement, setAiSupplement] = useState<{ bookId: string; bookName: string } | null>(null);
  const [aiSupplPrompt, setAiSupplPrompt] = useState('');
  const [aiSupplGenerating, setAiSupplGenerating] = useState(false);
  const [aiRefCharBookId, setAiRefCharBookId] = useState('');
  const [aiRefPersonaId, setAiRefPersonaId] = useState('');
  const [aiRefCharId, setAiRefCharId] = useState('');
  const [personas, setPersonas] = useState<any[]>([]);
  const [allCharacters, setAllCharacters] = useState<any[]>([]);
  const { selectMode, selectedIds, toggleSelectMode, handleToggleSelect, handleSelectAll, clearSelection } = useSelectMode<WorldInfo | LorebookEntry>();
  const [deleteSelectedConfirm, setDeleteSelectedConfirm] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const { t } = useTranslation();

  // 加载数据
  async function loadData() {
    setLoading(true);
    try {
      const [allBooks, allEntries] = await Promise.all([
        worldInfoOps.getAll(),
        lorebookOps.getAll(),
      ]);
      const bk = Array.isArray(allBooks) ? allBooks : [];
      const en = Array.isArray(allEntries) ? allEntries : [];
      setBooks(bk);
      setOrphanEntries(en);
    } catch (e) {
      console.error('Failed to load lorebook data:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    import('../db').then(({ personaOps }) => {
      personaOps.getAll().then(p => setPersonas(p)).catch(() => {});
    });
    characterOps.getAllCompact().then(chars => setAllCharacters(chars)).catch(() => {});
  }, []);

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

  // ===== 分组管理 =====

  async function handleCreateBook() {
    if (!newBookName.trim()) return;
    const book: WorldInfo = {
      id: generateUUID(),
      name: newBookName.trim(),
      enabled: true,
      autoAssociate: true,
      entries: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await worldInfoOps.add(book);
    setBooks(prev => [...prev, book]);
    setNewBookName('');
    setShowNewBook(false);
  }

  async function handleRenameBook(bookId: string) {
    if (!editingBookName.trim()) return;
    await worldInfoOps.update(bookId, { name: editingBookName.trim() });
    setBooks(prev => prev.map(b => b.id === bookId ? { ...b, name: editingBookName.trim() } : b));
    setEditingBookId(null);
  }

  async function handleToggleBook(bookId: string) {
    const book = books.find(b => b.id === bookId);
    if (!book) return;
    await worldInfoOps.update(bookId, { enabled: !book.enabled });
    setBooks(prev => prev.map(b => b.id === bookId ? { ...b, enabled: !b.enabled } : b));
  }

  async function handleToggleAutoAssociate(bookId: string) {
    const book = books.find(b => b.id === bookId);
    if (!book) return;
    const newVal = book.autoAssociate === false ? true : false;
    await worldInfoOps.update(bookId, { autoAssociate: newVal });
    setBooks(prev => prev.map(b => b.id === bookId ? { ...b, autoAssociate: newVal } : b));
  }

  async function handleDeleteBook(bookId: string) {
    if (!confirm(t('lorebook.deleteBookConfirm'))) return;
    await worldInfoOps.delete(bookId);
    setBooks(prev => prev.filter(b => b.id !== bookId));
  }

  // ===== 条目管理 =====

  async function handleSaveEntry(data: Partial<LorebookEntry>) {
    const isNew = !data.id;
    const entry: LorebookEntry = {
      id: data.id || generateUUID(),
      keywords: data.keywords || [],
      content: data.content || '',
      enabled: data.enabled ?? true,
      insertionOrder: data.insertionOrder ?? 0,
      caseSensitive: data.caseSensitive,
      matchWholeWords: data.matchWholeWords,
      selective: data.selective,
      secondaryKeywords: data.secondaryKeywords,
      selectiveLogic: data.selectiveLogic,
    };

    if (entryModal?.bookId) {
      // 属于分组的条目
      const book = books.find(b => b.id === entryModal.bookId);
      if (!book) return;

      let newEntries: LorebookEntry[];
      if (isNew) {
        newEntries = [...book.entries, entry];
      } else {
        newEntries = book.entries.map(e => e.id === entry.id ? entry : e);
      }

      await worldInfoOps.update(entryModal.bookId, { entries: newEntries });
      setBooks(prev => prev.map(b =>
        b.id === entryModal.bookId ? { ...b, entries: newEntries } : b
      ));
    } else {
      // 未分组条目
      if (isNew) {
        await lorebookOps.add(entry);
        setOrphanEntries(prev => [...prev, entry]);
      } else {
        await lorebookOps.update(entry.id, entry);
        setOrphanEntries(prev => prev.map(e => e.id === entry.id ? entry : e));
      }
    }

    setEntryModal(null);
  }

  async function handleDeleteEntry(bookId: string | undefined, entryId: string) {
    if (!confirm(t('lorebook.deleteEntryConfirm'))) return;

    if (bookId) {
      const book = books.find(b => b.id === bookId);
      if (!book) return;
      const newEntries = book.entries.filter(e => e.id !== entryId);
      await worldInfoOps.update(bookId, { entries: newEntries });
      setBooks(prev => prev.map(b =>
        b.id === bookId ? { ...b, entries: newEntries } : b
      ));
    } else {
      await lorebookOps.delete(entryId);
      setOrphanEntries(prev => prev.filter(e => e.id !== entryId));
    }
  }

  // ===== 展开/折叠 =====

  function toggleExpand(bookId: string) {
    setExpandedBooks(prev => {
      const next = new Set(prev);
      if (next.has(bookId)) next.delete(bookId); else next.add(bookId);
      return next;
    });
  }

  // ===== 导入导出 =====

  function handleExportBook(book: WorldInfo) {
    const json = JSON.stringify(book, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitizeFilename(book.name)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const importInputRef = useRef<HTMLInputElement>(null);

  async function handleImportBook(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // 验证数据格式
      if (!data.name || !Array.isArray(data.entries)) {
        throw new Error(t('lorebook.invalidImportFormat'));
      }

      const newBook: WorldInfo = {
        id: generateUUID(),
        name: data.name,
        enabled: data.enabled !== false,
        entries: data.entries.map((e: any, idx: number) => ({
          id: e.id || generateUUID(),
          keywords: e.keywords || [],
          content: e.content || '',
          enabled: e.enabled !== false,
          insertionOrder: idx,
          caseSensitive: e.caseSensitive,
          matchWholeWords: e.matchWholeWords,
          selective: e.selective,
          secondaryKeywords: e.secondaryKeywords,
          selectiveLogic: e.selectiveLogic,
        })),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await worldInfoOps.add(newBook);
      setBooks(prev => [...prev, newBook]);

      // 重置 input 以便重复导入同一文件
      e.target.value = '';
    } catch (err: any) {
      alert(t('lorebook.importFailed', { message: err.message }));
    }
  }

  // ─── AI 补充设定 ──────────────────────────────────────────────────────────────

  async function handleAISupplement() {
    if (!aiSupplement) return;
    setAiSupplGenerating(true);
    try {
      const connection = await connectionOps.getActive();
      if (!connection) { alert(t('lorebook.noAIConnection')); return; }

      const book = books.find(b => b.id === aiSupplement.bookId);
      if (!book) return;

      const existingEntries = book.entries.map(e => `- ${e.keywords.join(', ')}: ${e.content.slice(0, 200)}`).join('\n');

      let charGroupContext = '';
      if (aiRefCharBookId) {
        const refBook = books.find(b => b.id === aiRefCharBookId);
        if (refBook) {
          charGroupContext = `\n参考角色组「${refBook.name}」的设定：\n${refBook.entries.slice(0, 10).map(e => `- ${e.keywords.join(', ')}: ${e.content.slice(0, 150)}`).join('\n')}`;
        }
      }

      let personaContext = '';
      if (aiRefPersonaId) {
        const persona = personas.find((p: any) => p.id === aiRefPersonaId);
        if (persona) {
          personaContext = `\n参考人设「${persona.name}」的信息：\n描述：${(persona.description || '').slice(0, 200)}\n性格：${(persona.personality || '').slice(0, 100)}`;
        }
      }

      // 角色参考
      let charRefContext = '';
      if (aiRefCharId) {
        const refChar = allCharacters.find((c: any) => c.id === aiRefCharId);
        if (refChar) {
          charRefContext = `参考角色「${refChar.name}」的信息：\n描述：${(refChar.description || '').slice(0, 200)}\n性格：${(refChar.personality || '').slice(0, 100)}`;
        }
      }

      const prompt = buildSupplementPrompt(existingEntries, charGroupContext, personaContext, aiSupplPrompt, charRefContext);

      const resultText = await callAI(connection, '你是一个世界观设定创作专家。', prompt, { temperature: 0.5, maxTokens: 2048 });

      // 解析结果并保存
      const result = extractJSON(resultText);
      if (!result.entries?.length) throw new Error(t('lorebook.aiNoValidEntries'));

      const newEntries = result.entries.map((e: any, idx: number) => ({
        id: generateUUID(), keywords: e.keywords || [], content: e.content || '',
        enabled: true, insertionOrder: book.entries.length + idx,
      }));

      const updatedBook = { ...book, entries: [...book.entries, ...newEntries] };
      await worldInfoOps.update(book.id, { entries: updatedBook.entries });
      setBooks(prev => prev.map(b => b.id === book.id ? updatedBook : b));
      setAiSupplement(null);
      setAiSupplPrompt('');
    } catch (e: any) {
      alert(t('lorebook.supplementFailed', { message: e.message }));
    } finally {
      setAiSupplGenerating(false);
    }
  }

  // ===== 渲染条目 =====

  function renderEntry(entry: LorebookEntry, bookId?: string) {
    const isOrphan = bookId === undefined;
    return (
      <div
        key={entry.id}
        className={`flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg group ${
          selectMode && isOrphan ? 'cursor-pointer' : ''
        } ${selectMode && isOrphan && selectedIds.has(entry.id) ? 'bg-parlor-50 dark:bg-parlor-900/10' : ''}`}
        onClick={selectMode && isOrphan ? () => handleToggleSelect(entry.id) : undefined}
      >
        {selectMode && isOrphan && (
          <div className="flex-shrink-0 mt-1">
            {selectedIds.has(entry.id)
              ? <CheckSquare className="w-5 h-5 text-parlor-400" />
              : <Square className="w-5 h-5 text-gray-600" />
            }
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {/* 关键词标签 */}
            {entry.keywords.slice(0, 5).map(kw => (
              <span key={kw}
                className={`text-[11px] px-1.5 py-0.5 rounded ${
                  entry.enabled
                    ? 'bg-parlor-100 dark:bg-parlor-900/30 text-parlor-600 dark:text-parlor-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                }`}
              >
                {kw}
              </span>
            ))}
            {entry.keywords.length > 5 && (
              <span className="text-[11px] text-gray-400">+{entry.keywords.length - 5}</span>
            )}
            {/* 标志 */}
            {entry.caseSensitive && <span className="text-[10px] text-gray-400">Aa</span>}
            {entry.matchWholeWords && <span className="text-[10px] text-gray-400">[词]</span>}
            {entry.selective && <span className="text-[10px] text-purple-400">S</span>}
          </div>
          <p className={`text-xs ${entry.enabled ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400 line-through'}`}>
            {entry.content.slice(0, 120)}{entry.content.length > 120 ? '...' : ''}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">{t('lorebook.orderPrefix', { order: entry.insertionOrder })}</p>
        </div>
        {!(selectMode && isOrphan) && (
          <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={() => setEntryModal({ bookId, entry })}
              className="p-1.5 text-gray-500 hover:text-parlor-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              title={t('common.edit')}
            >
              <Edit2 size={13} />
            </button>
            <button
              onClick={() => handleDeleteEntry(bookId, entry.id)}
              className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              title={t('common.delete')}
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
    );
  }

  // ===== 渲染分组卡片 =====

  function renderBook(book: WorldInfo) {
    const isExpanded = expandedBooks.has(book.id);
    const isEditing = editingBookId === book.id;
    const enabledCount = book.entries.filter(e => e.enabled).length;

    return (
      <div key={book.id} className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden group ${
        selectedIds.has(book.id) ? 'ring-1 ring-parlor-500/60' : ''
      }`}>
        {/* 分组头 */}
        <div
          className={`flex items-center gap-2 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex-wrap ${
            selectMode ? 'cursor-pointer' : ''
          }`}
          onClick={selectMode ? () => handleToggleSelect(book.id) : undefined}
        >
          <button onClick={(e) => { e.stopPropagation(); toggleExpand(book.id); }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          {selectMode && (
            <div className="flex-shrink-0">
              {selectedIds.has(book.id)
                ? <CheckSquare className="w-5 h-5 text-parlor-400" />
                : <Square className="w-5 h-5 text-gray-600" />
              }
            </div>
          )}
          <FolderOpen size={16} className="text-parlor-500 shrink-0" />
          
          {isEditing && !selectMode ? (
            <div className="flex-1 flex gap-2">
              <input
                value={editingBookName}
                onChange={e => setEditingBookName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleRenameBook(book.id)}
                className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900"
                autoFocus
              />
              <button onClick={() => handleRenameBook(book.id)}
                className="px-2 py-1 text-xs bg-parlor-500 text-white rounded">{t('common.save')}</button>
              <button onClick={() => setEditingBookId(null)}
                className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded">{t('common.cancel')}</button>
            </div>
          ) : selectMode ? (
            <span className="flex-1 text-sm font-medium truncate">{book.name}</span>
          ) : (
            <>
              <span className="flex-1 text-sm font-medium truncate">{book.name}</span>
              <span className="text-xs text-gray-500">
                {t('lorebook.entriesCount', { enabled: enabledCount, total: book.entries.length })}
              </span>
              {/* 全局开关 */}
              <button onClick={(e) => { e.stopPropagation(); handleToggleBook(book.id); }}
                className={`p-1 rounded ${book.enabled ? 'text-green-500' : 'text-gray-400'}`}
                title={book.enabled ? t('common.enable') : t('common.disable')}>
                {book.enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
              </button>
              {/* 自动关联开关 */}
              <button onClick={(e) => { e.stopPropagation(); handleToggleAutoAssociate(book.id); }}
                className={`p-1 rounded ${book.autoAssociate !== false ? 'text-blue-500' : 'text-gray-300'}`}
                title={t('lorebook.autoAssociateHint')}>
                {book.autoAssociate !== false ? <UserPlus size={16} /> : <UserX size={16} />}
              </button>
              {/* 补充设定 */}
              <button
                onClick={(e) => { e.stopPropagation(); setAiSupplement({ bookId: book.id, bookName: book.name }); }}
                className="p-1 text-gray-500 hover:text-parlor-400 rounded transition-colors"
                title={t('lorebook.supplement')}>
                <Sparkles size={13} />
              </button>
              {/* 关联设置 */}
              <button
                onClick={(e) => { e.stopPropagation(); setRelationModalBook(book); }}
                className="p-1 text-gray-500 hover:text-parlor-400 rounded transition-colors"
                title={t('lorebook.relationSettings')}>
                <Link2 size={13} />
              </button>
              {/* 导出 */}
              <button
                onClick={(e) => { e.stopPropagation(); handleExportBook(book); }}
                className="p-1 text-gray-500 hover:text-parlor-400 rounded transition-colors"
                title={t('lorebook.exportBook')}
              >
                <Download size={13} />
              </button>
              {/* 桥接按钮 */}
              {book.relations && book.relations.length > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setBridgeModalBook(book); }}
                  className="p-1.5 text-gray-500 hover:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  title={t('lorebook.bridge')}
                >
                  <GitMerge size={14} />
                </button>
              )}
              {/* 编辑名称 */}
              <button
                onClick={(e) => { e.stopPropagation(); setEditingBookId(book.id); setEditingBookName(book.name); }}
                className="p-1 text-gray-500 hover:text-parlor-400 rounded transition-colors"
                title={t('common.rename')}>
                <Edit2 size={13} />
              </button>
              {/* 删除 */}
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteBook(book.id); }}
                className="p-1 text-gray-500 hover:text-red-400 rounded transition-colors"
                title={t('common.delete')}>
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>

        {/* 展开后的条目列表 */}
        {isExpanded && (
          <div className="border-t border-gray-100 dark:border-gray-700">
            {book.entries.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-400">{t('lorebook.noEntriesInBook')}</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {[...book.entries]
                  .sort((a, b) => a.insertionOrder - b.insertionOrder)
                  .map(entry => renderEntry(entry, book.id))}
              </div>
            )}
            <div className="p-2 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setEntryModal({ bookId: book.id })}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-parlor-500 hover:bg-parlor-50 dark:hover:bg-parlor-900/20 rounded-lg transition-colors w-full"
              >
                <Plus size={12} /> {t('lorebook.addEntry')}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===== 选择模式 =====

  const selectableItems = useMemo(() => {
    return [...books, ...orphanEntries];
  }, [books, orphanEntries]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsBatchDeleting(true);
    try {
      const bookIdSet = new Set(books.map(b => b.id));
      const bookIds: string[] = [];
      const entryIds: string[] = [];
      for (const id of selectedIds) {
        if (bookIdSet.has(id)) {
          bookIds.push(id);
        } else {
          entryIds.push(id);
        }
      }
      await Promise.all(bookIds.map(id => worldInfoOps.delete(id)));
      await Promise.all(entryIds.map(id => lorebookOps.delete(id)));
      setBooks(prev => prev.filter(b => !selectedIds.has(b.id)));
      setOrphanEntries(prev => prev.filter(e => !selectedIds.has(e.id)));
      clearSelection();
    } catch (err) {
      console.error('Batch delete failed:', err);
    } finally {
      setIsBatchDeleting(false);
      setDeleteSelectedConfirm(false);
    }
  }, [selectedIds, books, clearSelection]);

  // ===== 主渲染 =====

  const hasOrphans = orphanEntries.length > 0;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="text-parlor-500" />
            {t('lorebook.title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('lorebook.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectMode ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => handleSelectAll(selectableItems)} disabled={selectedIds.size === selectableItems.length}>
                <CheckSquare className="w-4 h-4" />
                <span className="hidden sm:inline">{t('common.selectAll')}</span>
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
              <Button variant="ghost" size="sm" onClick={toggleSelectMode} title={t('common.select')}>
                <CheckSquare className="w-4 h-4" />
                <span className="hidden sm:inline">{t('common.select')}</span>
              </Button>
              <input
                ref={importInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImportBook}
              />
              <Button variant="secondary" size="sm" onClick={() => importInputRef.current?.click()}>
                <Upload size={14} />
                {t('common.import')}
              </Button>
              <Button size="sm" onClick={() => setShowNewBook(true)}>
                <Plus size={16} />
                <span>{t('lorebook.newBook')}</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 新建分组表单 */}
      {showNewBook && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <input
            value={newBookName}
            onChange={e => setNewBookName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateBook()}
            placeholder={t('lorebook.bookNamePlaceholder')}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm"
            autoFocus
          />
          <button onClick={handleCreateBook}
            className="px-3 py-2 text-sm bg-parlor-500 text-white rounded-lg hover:bg-parlor-600">{t('common.create')}</button>
          <button onClick={() => { setShowNewBook(false); setNewBookName(''); }}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">{t('common.cancel')}</button>
        </div>
      )}

      {/* 加载状态 */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">{t('common.loading')}</div>
      ) : (
        <>
          {/* 分组列表 */}
          {books.length === 0 && !hasOrphans ? (
            <div className="text-center py-16 text-gray-400">
              <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t('lorebook.noBooks')}</p>
              <p className="text-xs mt-1">{t('lorebook.noBooksHint')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {books.map(renderBook)}
            </div>
          )}

          {/* 未分组条目 */}
          {hasOrphans && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-gray-500">
                <FileText size={14} />
                {t('lorebook.ungrouped')}
                <span className="text-xs font-normal">({orphanEntries.length})</span>
              </h3>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                {[...orphanEntries]
                  .sort((a, b) => a.insertionOrder - b.insertionOrder)
                  .map(entry => renderEntry(entry, undefined))}
              </div>
              <div className="mt-2">
                <button
                  onClick={() => setEntryModal({})}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-parlor-500 hover:bg-parlor-50 dark:hover:bg-parlor-900/20 rounded-lg transition-colors"
                >
                  <Plus size={12} /> {t('lorebook.addUngroupedEntry')}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* 批量删除确认 */}
      <ConfirmDialog
        isOpen={deleteSelectedConfirm}
        onClose={() => setDeleteSelectedConfirm(false)}
        onConfirm={handleDeleteSelected}
        title={t('lorebook.deleteSelectedTitle')}
        message={t('lorebook.deleteSelectedConfirm', { count: selectedIds.size })}
        confirmText={isBatchDeleting ? t('common.deleting') : t('common.delete')}
        variant="danger"
      />

      {/* 条目编辑弹窗 */}
      {entryModal && (
        <EntryModal
          entry={entryModal.entry}
          onSave={handleSaveEntry}
          onClose={() => setEntryModal(null)}
        />
      )}

      {/* 关联设置弹窗 */}
      {relationModalBook && (
        <WorldRelationModal
          worldInfo={relationModalBook}
          allWorldInfos={books}
          onSave={async (relations) => {
            await worldInfoOps.update(relationModalBook.id, { relations });
            setBooks(prev => prev.map(b =>
              b.id === relationModalBook.id ? { ...b, relations } : b
            ));
          }}
          onClose={() => setRelationModalBook(null)}
        />
      )}

      {/* 桥接弹窗 */}
      {bridgeModalBook && (
        <BridgeModal
          sourceWorldInfo={bridgeModalBook}
          relatedWorldInfos={books.filter(b => bridgeModalBook.relations?.some(r => r.targetId === b.id))}
          relations={bridgeModalBook.relations || []}
          onClose={() => setBridgeModalBook(null)}
          onComplete={(newBook) => {
            setBooks(prev => [...prev, newBook]);
          }}
        />
      )}

      {/* AI 补充设定弹窗 */}
      {aiSupplement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setAiSupplement(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl border w-full max-w-md mx-4 p-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-1">{t('lorebook.supplementTitle', { name: aiSupplement.bookName })}</h3>
            <p className="text-xs text-gray-500 mb-3">{t('lorebook.supplementDesc')}</p>
            <select value={aiRefCharBookId} onChange={e => setAiRefCharBookId(e.target.value)} className="w-full mb-2 px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-900">
              <option value="">{t('lorebook.refCharGroup')}</option>
              {Array.from(characterGroups.entries())
                .filter(([id]) => id !== aiSupplement?.bookId)
                .map(([id, { count }]) => {
                  const book = books.find(b => b.id === id);
                  return <option key={id} value={id}>{book?.name || t('common.unnamed')}（{count}{t('lorebook.charCount')}）</option>;
                })}
            </select>
            <select value={aiRefPersonaId} onChange={e => setAiRefPersonaId(e.target.value)} className="w-full mb-2 px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-900">
              <option value="">{t('lorebook.noRefPersona')}</option>
              {personas.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={aiRefCharId} onChange={e => setAiRefCharId(e.target.value)} className="w-full mb-2 px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-900">
              <option value="">{t('lorebook.refCharacter')}</option>
              {allCharacters.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <textarea value={aiSupplPrompt} onChange={e => setAiSupplPrompt(e.target.value)} placeholder={t('lorebook.supplementPlaceholder')} className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-900 mb-3" rows={3} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setAiSupplement(null)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">{t('common.cancel')}</button>
              <button onClick={handleAISupplement} disabled={aiSupplGenerating || !aiSupplPrompt.trim()} className="px-4 py-2 text-sm bg-parlor-500 text-white rounded-lg disabled:opacity-50">
                {aiSupplGenerating ? t('common.generating') : t('lorebook.supplementBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LorebookPage;
