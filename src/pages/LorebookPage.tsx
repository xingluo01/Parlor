import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit3, Trash2, BookOpen, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button, Modal, ConfirmDialog, Input } from '../components/ui';
import { lorebookOps } from '../db';
import { generateUUID } from '../utils/uuid';
import type { LorebookEntry } from '../types';

// ==========================================
// Lorebook Entry Modal
// ==========================================

function LorebookEntryModal({
  isOpen,
  onClose,
  entry,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  entry: LorebookEntry | null;
  onSave: () => void;
}) {
  const [keywords, setKeywords] = useState('');
  const [secondaryKeywords, setSecondaryKeywords] = useState('');
  const [selective, setSelective] = useState(false);
  const [selectiveLogic, setSelectiveLogic] = useState<'AND' | 'OR'>('AND');
  const [content, setContent] = useState('');
  const [insertionOrder, setInsertionOrder] = useState(100);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matchWholeWords, setMatchWholeWords] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (entry) {
      setKeywords(entry.keywords.join(', '));
      setSecondaryKeywords(entry.secondaryKeywords?.join(', ') || '');
      setSelective(entry.selective ?? false);
      setSelectiveLogic(entry.selectiveLogic ?? 'AND');
      setContent(entry.content);
      setInsertionOrder(entry.insertionOrder);
      setCaseSensitive(entry.caseSensitive ?? false);
      setMatchWholeWords(entry.matchWholeWords ?? false);
      setEnabled(entry.enabled);
    } else {
      setKeywords('');
      setSecondaryKeywords('');
      setSelective(false);
      setSelectiveLogic('AND');
      setContent('');
      setInsertionOrder(100);
      setCaseSensitive(false);
      setMatchWholeWords(false);
      setEnabled(true);
    }
  }, [entry, isOpen]);

  const handleSave = async () => {
    if (!content.trim()) return;

    const keywordList = keywords
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);

    const secondaryList = secondaryKeywords
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);

    const entryData = {
      keywords: keywordList,
      secondaryKeywords: secondaryList.length > 0 ? secondaryList : undefined,
      selective: selective || undefined,
      selectiveLogic: selective ? selectiveLogic : undefined,
      content: content.trim(),
      insertionOrder,
      caseSensitive,
      matchWholeWords: matchWholeWords || undefined,
      enabled,
    };

    setIsSaving(true);
    try {
      if (entry) {
        await lorebookOps.update(entry.id, entryData);
      } else {
        await lorebookOps.add({
          id: generateUUID(),
          ...entryData,
        });
      }
      onSave();
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={entry ? 'Edit Lorebook Entry' : 'New Lorebook Entry'}
      size="md"
    >
      <div className="space-y-4">
        <Input
          label="Keywords (comma-separated)"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="keyword1, keyword2, keyword3"
        />

        <div>
          <label className="flex items-center gap-2 cursor-pointer mb-2">
            <input
              type="checkbox"
              checked={selective}
              onChange={(e) => setSelective(e.target.checked)}
              className="w-4 h-4 rounded border-glass-border accent-parlor-500"
            />
            <span className="text-sm text-gray-300">Selective (require secondary keywords)</span>
          </label>
          {selective && (
            <div className="space-y-2">
              <Input
                label="Secondary Keywords (comma-separated)"
                value={secondaryKeywords}
                onChange={(e) => setSecondaryKeywords(e.target.value)}
                placeholder="secondary1, secondary2"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectiveLogic('AND')}
                  className={`px-3 py-1 rounded text-xs font-medium ${
                    selectiveLogic === 'AND' ? 'bg-parlor-600 text-white' : 'bg-dark-100 text-gray-400 border border-glass-border'
                  }`}
                >
                  AND (all must match)
                </button>
                <button
                  onClick={() => setSelectiveLogic('OR')}
                  className={`px-3 py-1 rounded text-xs font-medium ${
                    selectiveLogic === 'OR' ? 'bg-parlor-600 text-white' : 'bg-dark-100 text-gray-400 border border-glass-border'
                  }`}
                >
                  OR (any can match)
                </button>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Content
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Content to inject when keywords are triggered..."
            rows={6}
            className="w-full px-4 py-2.5 rounded-lg bg-dark-100 border border-glass-border text-white placeholder-gray-500 focus:outline-none focus:border-parlor-500/50 resize-y"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Insertion Order
            </label>
            <input
              type="number"
              value={insertionOrder}
              onChange={(e) => setInsertionOrder(Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-lg bg-dark-100 border border-glass-border text-white focus:outline-none focus:border-parlor-500/50"
            />
          </div>
          <div className="flex flex-col justify-end gap-2 pb-0.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => setCaseSensitive(e.target.checked)}
                className="w-4 h-4 rounded border-glass-border accent-parlor-500"
              />
              <span className="text-sm text-gray-300">Case Sensitive</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={matchWholeWords}
                onChange={(e) => setMatchWholeWords(e.target.checked)}
                className="w-4 h-4 rounded border-glass-border accent-parlor-500"
              />
              <span className="text-sm text-gray-300">Match Whole Words</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-glass-border accent-parlor-500"
              />
              <span className="text-sm text-gray-300">Enabled</span>
            </label>
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            isLoading={isSaving}
            disabled={!content.trim()}
          >
            {entry ? 'Save Changes' : 'Create Entry'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ==========================================
// LorebookPage
// ==========================================

export function LorebookPage() {
  const [entries, setEntries] = useState<LorebookEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LorebookEntry | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadEntries = async () => {
    setIsLoading(true);
    try {
      const data = await lorebookOps.getAll();
      setEntries(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, []);

  const handleToggleEnabled = async (entry: LorebookEntry) => {
    await lorebookOps.update(entry.id, { enabled: !entry.enabled });
    setEntries(prev =>
      prev.map(e => e.id === entry.id ? { ...e, enabled: !e.enabled } : e)
    );
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await lorebookOps.delete(deleteConfirm);
    setDeleteConfirm(null);
    await loadEntries();
  };

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-serif tracking-tight">Global Lorebook</h1>
          <p className="text-gray-600 text-sm mt-1">
            World info entries injected into every chat when keywords are triggered
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingEntry(null);
            setIsModalOpen(true);
          }}
        >
          <Plus className="w-4 h-4" />
          New Entry
        </Button>
      </div>

      {/* Entry List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : entries.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16 glass"
        >
          <BookOpen className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2 font-serif tracking-tight">No lorebook entries yet</h3>
          <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
            Add world info entries that will be injected into chats when their keywords appear in the conversation.
          </p>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4" />
            Create First Entry
          </Button>
        </motion.div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, index) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className={`glass-sm p-4 ${!entry.enabled ? 'opacity-50' : ''}`}
            >
              <div className="flex items-start gap-3">
                {/* Toggle */}
                <button
                  onClick={() => handleToggleEnabled(entry)}
                  className="flex-shrink-0 mt-0.5 text-gray-400 hover:text-parlor-400 transition-colors"
                  title={entry.enabled ? 'Disable entry' : 'Enable entry'}
                >
                  {entry.enabled ? (
                    <ToggleRight className="w-5 h-5 text-parlor-400" />
                  ) : (
                    <ToggleLeft className="w-5 h-5" />
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Keywords */}
                  {entry.keywords.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {entry.keywords.map((kw) => (
                        <span
                          key={kw}
                          className="text-xs bg-parlor-500/20 text-parlor-300 border border-parlor-500/30 px-2 py-0.5 rounded-full"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 italic mb-2">No keywords</p>
                  )}

                  {/* Content preview */}
                  <p className="text-sm text-gray-300 truncate">{entry.content}</p>

                  {/* Meta */}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 flex-wrap">
                    <span>Order: {entry.insertionOrder}</span>
                    {entry.caseSensitive && <span>Case-sensitive</span>}
                    {entry.matchWholeWords && <span>Whole words</span>}
                    {entry.selective && <span>Selective ({entry.selectiveLogic || 'AND'})</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingEntry(entry);
                      setIsModalOpen(true);
                    }}
                  >
                    <Edit3 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteConfirm(entry.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Entry Modal */}
      <LorebookEntryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        entry={editingEntry}
        onSave={loadEntries}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Entry"
        message="Are you sure you want to delete this lorebook entry? This cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}

export default LorebookPage;
