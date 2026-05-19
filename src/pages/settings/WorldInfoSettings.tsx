import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { generateUUID } from '../../utils/uuid';
import {
  Plus,
  Edit3,
  Trash2,
  ChevronDown,
  ChevronRight,
  Save,
  ToggleLeft,
  ToggleRight,
  BookOpen,
  X,
} from 'lucide-react';
import { Button, Input, Modal, ConfirmDialog, Textarea } from '../../components/ui';
import { worldInfoOps } from '../../db';
import type { WorldInfo, LorebookEntry } from '../../types';

// Entry editor modal
function EntryModal({
  isOpen,
  onClose,
  entry,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  entry: LorebookEntry | null;
  onSave: (data: Omit<LorebookEntry, 'id'>) => Promise<void>;
}) {
  const [keywords, setKeywords] = useState('');
  const [secondaryKeywords, setSecondaryKeywords] = useState('');
  const [selective, setSelective] = useState(false);
  const [selectiveLogic, setSelectiveLogic] = useState<'AND' | 'OR'>('AND');
  const [content, setContent] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matchWholeWords, setMatchWholeWords] = useState(false);
  const [insertionOrder, setInsertionOrder] = useState(100);

  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen) {
      if (entry) {
        setKeywords(entry.keywords.join(', '));
        setSecondaryKeywords(entry.secondaryKeywords?.join(', ') || '');
        setSelective(entry.selective ?? false);
        setSelectiveLogic(entry.selectiveLogic ?? 'AND');
        setContent(entry.content);
        setEnabled(entry.enabled);
        setCaseSensitive(entry.caseSensitive ?? false);
        setMatchWholeWords(entry.matchWholeWords ?? false);
        setInsertionOrder(entry.insertionOrder);
      } else {
        setKeywords('');
        setSecondaryKeywords('');
        setSelective(false);
        setSelectiveLogic('AND');
        setContent('');
        setEnabled(true);
        setCaseSensitive(false);
        setMatchWholeWords(false);
        setInsertionOrder(100);
      }
    }
  }, [entry, isOpen]);

  const canSave = keywords.trim() !== '' && content.trim() !== '';

  const handleSave = async () => {
    if (!canSave) return;
    const secondaryList = secondaryKeywords.split(',').map(k => k.trim()).filter(Boolean);
    await onSave({
      keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
      secondaryKeywords: secondaryList.length > 0 ? secondaryList : undefined,
      selective: selective || undefined,
      selectiveLogic: selective ? selectiveLogic : undefined,
      content: content.trim(),
      enabled,
      caseSensitive,
      matchWholeWords: matchWholeWords || undefined,
      insertionOrder,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={entry ? t('settings.worldInfo.editEntry') : t('settings.worldInfo.newEntry')}
      size="md"
    >
      <div className="space-y-4">
        <Input
          label={t('settings.worldInfo.keywords')}
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder={t('settings.worldInfo.keywordsPlaceholder')}
        />

        <div>
          <label className="flex items-center gap-2 cursor-pointer mb-2">
            <input
              type="checkbox"
              checked={selective}
              onChange={(e) => setSelective(e.target.checked)}
              className="rounded border-glass-border bg-dark-100 text-parlor-500"
            />
            <span className="text-sm text-gray-300">{t('settings.worldInfo.selective')}</span>
          </label>
          {selective && (
            <div className="space-y-2">
              <Input
                label={t('settings.worldInfo.secondaryKeywords')}
                value={secondaryKeywords}
                onChange={(e) => setSecondaryKeywords(e.target.value)}
                placeholder={t('settings.worldInfo.secondaryKeywordsPlaceholder')}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectiveLogic('AND')}
                  className={`px-3 py-1 rounded text-xs font-medium ${
                    selectiveLogic === 'AND' ? 'bg-parlor-600 text-white' : 'bg-dark-100 text-gray-400 border border-glass-border'
                  }`}
                >
                  {t('settings.worldInfo.andMatch')}
                </button>
                <button
                  onClick={() => setSelectiveLogic('OR')}
                  className={`px-3 py-1 rounded text-xs font-medium ${
                    selectiveLogic === 'OR' ? 'bg-parlor-600 text-white' : 'bg-dark-100 text-gray-400 border border-glass-border'
                  }`}
                >
                  {t('settings.worldInfo.orMatch')}
                </button>
              </div>
            </div>
          )}
        </div>

        <Textarea
          label={t('settings.worldInfo.content')}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t('settings.worldInfo.contentPlaceholder')}
          rows={5}
        />
        <div className="flex items-center gap-6 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-glass-border bg-dark-100 text-parlor-500"
            />
            <span className="text-sm text-gray-300">{t('settings.worldInfo.enabled')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
              className="rounded border-glass-border bg-dark-100 text-parlor-500"
            />
            <span className="text-sm text-gray-300">{t('settings.worldInfo.caseSensitive')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={matchWholeWords}
              onChange={(e) => setMatchWholeWords(e.target.checked)}
              className="rounded border-glass-border bg-dark-100 text-parlor-500"
            />
            <span className="text-sm text-gray-300">{t('settings.worldInfo.matchWholeWords')}</span>
          </label>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-300 w-36">{t('settings.worldInfo.insertionOrder')}</label>
          <input
            type="number"
            value={insertionOrder}
            onChange={(e) => setInsertionOrder(Number(e.target.value))}
            className="w-24 px-3 py-1.5 rounded-lg bg-dark-100 border border-glass-border text-white text-sm focus:outline-none focus:border-parlor-500/50"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} disabled={!canSave}>
            <Save className="w-4 h-4" />
            {t('common.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function WorldInfoSettings({
  books,
  onRefresh,
}: {
  books: WorldInfo[];
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const [expandedBookId, setExpandedBookId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<{ bookId: string; entry: LorebookEntry | null } | null>(null);
  const [deleteBookConfirm, setDeleteBookConfirm] = useState<string | null>(null);
  const [deleteEntryConfirm, setDeleteEntryConfirm] = useState<{ bookId: string; entryId: string } | null>(null);
  const [newBookName, setNewBookName] = useState('');
  const [showNewBook, setShowNewBook] = useState(false);

  const handleCreateBook = async () => {
    const name = newBookName.trim();
    if (!name) return;
    await worldInfoOps.add({
      id: generateUUID(),
      name,
      enabled: true,
      entries: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setNewBookName('');
    setShowNewBook(false);
    onRefresh();
  };

  const handleToggleBook = async (id: string, enabled: boolean) => {
    await worldInfoOps.update(id, { enabled });
    onRefresh();
  };

  const handleDeleteBook = async (id: string) => {
    await worldInfoOps.delete(id);
    if (expandedBookId === id) setExpandedBookId(null);
    onRefresh();
  };

  const handleSaveEntry = async (bookId: string, entryData: Omit<LorebookEntry, 'id'>, existingId?: string) => {
    const book = books.find(b => b.id === bookId);
    if (!book) return;
    const entry: LorebookEntry = { id: existingId || generateUUID(), ...entryData };
    const entries = existingId
      ? book.entries.map(e => e.id === existingId ? entry : e)
      : [...book.entries, entry];
    await worldInfoOps.update(bookId, { entries });
    onRefresh();
  };

  const handleDeleteEntry = async (bookId: string, entryId: string) => {
    const book = books.find(b => b.id === bookId);
    if (!book) return;
    await worldInfoOps.update(bookId, { entries: book.entries.filter(e => e.id !== entryId) });
    onRefresh();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white font-serif tracking-tight">{t('settings.tabs.worldInfo')}</h2>
        <Button
          size="sm"
          onClick={() => setShowNewBook(true)}
        >
          <Plus className="w-4 h-4" />
          {t('settings.worldInfo.newBook')}
        </Button>
      </div>

      <p className="text-gray-500 text-sm mb-4">
        {t('settings.worldInfo.bookDesc')}
      </p>

      {/* New book inline form */}
      {showNewBook && (
        <div className="mb-4 p-4 bg-dark-200 border border-parlor-500/30 rounded-lg flex items-center gap-3">
          <BookOpen className="w-4 h-4 text-parlor-400 flex-shrink-0" />
          <Input
            value={newBookName}
            onChange={(e) => setNewBookName(e.target.value)}
            placeholder={t('settings.worldInfo.bookNamePlaceholder')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateBook();
              if (e.key === 'Escape') { setShowNewBook(false); setNewBookName(''); }
            }}
            autoFocus
            className="flex-1"
          />
          <Button size="sm" onClick={handleCreateBook} disabled={!newBookName.trim()}>
            {t('settings.worldInfo.create')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setShowNewBook(false); setNewBookName(''); }}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {books.length === 0 ? (
        <div className="text-center py-8">
          <BookOpen className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500">{t('settings.worldInfo.noBooks')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {books.map((book) => {
            const isExpanded = expandedBookId === book.id;
            const enabledEntries = book.entries.filter(e => e.enabled).length;

            return (
              <div
                key={book.id}
                className="bg-dark-200 border border-glass-border rounded-lg overflow-hidden"
              >
                {/* Book header row */}
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={async () => handleToggleBook(book.id, !book.enabled)}
                      className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
                      title={book.enabled ? t('settings.worldInfo.disableGlobally') : t('settings.worldInfo.enableGlobally')}
                    >
                      {book.enabled
                        ? <ToggleRight className="w-5 h-5 text-parlor-400" />
                        : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <span className={`font-medium truncate ${book.enabled ? 'text-white' : 'text-gray-500'}`}>
                      {book.name}
                    </span>
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      {t('settings.worldInfo.entriesCount', { enabled: enabledEntries, total: book.entries.length })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedBookId(isExpanded ? null : book.id)}
                      title={isExpanded ? t('settings.worldInfo.collapse') : t('settings.worldInfo.editEntries')}
                    >
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4" />
                        : <ChevronRight className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteBookConfirm(book.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                </div>

                {/* Expanded entries section */}
                {isExpanded && (
                  <div className="border-t border-glass-border">
                    <div className="p-3 flex items-center justify-between">
                      <span className="text-xs text-gray-500 uppercase tracking-wider">{t('settings.worldInfo.entries')}</span>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setEditingEntry({ bookId: book.id, entry: null })}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {t('settings.worldInfo.addEntry')}
                      </Button>
                    </div>

                    {book.entries.length === 0 ? (
                      <div className="px-4 pb-4 text-sm text-gray-500 text-center">
                        {t('settings.worldInfo.noEntries')}
                      </div>
                    ) : (
                      <div className="space-y-2 px-3 pb-3">
                        {book.entries.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-start justify-between gap-3 bg-dark-100 rounded-lg px-3 py-2.5"
                          >
                            <div className="flex items-start gap-2 min-w-0 flex-1">
                              <button
                                onClick={async () => {
                                  const updated = { ...entry, enabled: !entry.enabled };
                                  const entries = book.entries.map(e => e.id === entry.id ? updated : e);
                                  await worldInfoOps.update(book.id, { entries });
                                  onRefresh();
                                }}
                                className="mt-0.5 flex-shrink-0 text-gray-400 hover:text-white transition-colors"
                              >
                                {entry.enabled
                                  ? <ToggleRight className="w-4 h-4 text-parlor-400" />
                                  : <ToggleLeft className="w-4 h-4" />}
                              </button>
                              <div className="min-w-0">
                                <div className="text-xs text-parlor-300 font-mono truncate">
                                  {entry.keywords.join(', ')}
                                </div>
                                <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                                  {entry.content}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingEntry({ bookId: book.id, entry })}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteEntryConfirm({ bookId: book.id, entryId: entry.id })}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Entry editor modal */}
      <EntryModal
        isOpen={!!editingEntry}
        onClose={() => setEditingEntry(null)}
        entry={editingEntry?.entry ?? null}
        onSave={async (data) => {
          if (!editingEntry) return;
          await handleSaveEntry(editingEntry.bookId, data, editingEntry.entry?.id);
          setEditingEntry(null);
        }}
      />

      {/* Delete book confirm */}
      <ConfirmDialog
        isOpen={!!deleteBookConfirm}
        onClose={() => setDeleteBookConfirm(null)}
        onConfirm={async () => {
          if (deleteBookConfirm) {
            await handleDeleteBook(deleteBookConfirm);
            setDeleteBookConfirm(null);
          }
        }}
        title={t('settings.worldInfo.deleteBook')}
        message={t('settings.worldInfo.deleteBookConfirm')}
        confirmText={t('common.delete')}
        variant="danger"
      />

      {/* Delete entry confirm */}
      <ConfirmDialog
        isOpen={!!deleteEntryConfirm}
        onClose={() => setDeleteEntryConfirm(null)}
        onConfirm={async () => {
          if (deleteEntryConfirm) {
            await handleDeleteEntry(deleteEntryConfirm.bookId, deleteEntryConfirm.entryId);
            setDeleteEntryConfirm(null);
          }
        }}
        title={t('settings.worldInfo.deleteEntry')}
        message={t('settings.worldInfo.deleteEntryConfirm')}
        confirmText={t('common.delete')}
        variant="danger"
      />
    </div>
  );
}
