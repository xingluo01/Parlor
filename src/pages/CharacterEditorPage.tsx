import { useState, useEffect, useRef } from 'react';
import { generateUUID } from '../utils/uuid';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, Image as ImageIcon, Plus, X } from 'lucide-react';
import { Button, Avatar, Input, Textarea, ConfirmDialog, ImageCropModal } from '../components/ui';
import { characterOps, personaOps } from '../db';
import { usePersonaStore } from '../stores';
import { useCharacterStore } from '../stores';
import { fileToBase64, exportCharacterToJson, validateCharacter } from '../utils/characterImport';
import type { CharacterCard, LorebookEntry } from '../types';
import { saveAs } from 'file-saver';

export function CharacterEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const { updateCharacter, addCharacter } = useCharacterStore();

  const [character, setCharacter] = useState<Partial<CharacterCard>>({
    name: '',
    description: '',
    personality: '',
    scenario: '',
    firstMessage: '',
    systemPrompt: '',
    postHistoryInstructions: '',
    creatorNotes: '',
    tags: [],
    avatar: undefined,
    alternateGreetings: [],
    characterBook: undefined,
    gallery: [],
  });

  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced' | 'lorebook'>('basic');
  const [isDirty, setIsDirty] = useState(false);
  const { personas } = usePersonaStore();

  // Warn before navigating away with unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Load existing character
  useEffect(() => {
    if (id) {
      const loadCharacter = async () => {
        const char = await characterOps.getById(id);
        if (char) {
          setCharacter(char);
        } else {
          setError('Character not found');
        }
        setIsLoading(false);
      };
      loadCharacter();
    }
  }, [id]);

  // Load personas
  useEffect(() => {
    personaOps.getAll().then(personaList => {
      usePersonaStore.getState().setPersonas(personaList);
    });
  }, []);

  const updateField = <K extends keyof CharacterCard>(
    field: K,
    value: CharacterCard[K]
  ) => {
    setCharacter((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
    setError(null);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        setCropSrc(base64);
        if (avatarInputRef.current) avatarInputRef.current.value = '';
      } catch (err) {
        setError('Failed to load image');
      }
    }
  };

  const handleTagsChange = (value: string) => {
    const tags = value.split(',').map((t) => t.trim()).filter(Boolean);
    updateField('tags', tags);
  };

  const handleSave = async () => {
    const validation = validateCharacter(character);
    if (!validation.valid) {
      setError(validation.errors.join(', '));
      return;
    }

    setIsSaving(true);
    try {
      const now = Date.now();
      const charData: CharacterCard = {
        id: character.id || generateUUID(),
        name: character.name!,
        description: character.description || '',
        personality: character.personality || '',
        scenario: character.scenario || '',
        firstMessage: character.firstMessage!,
        systemPrompt: character.systemPrompt,
        postHistoryInstructions: character.postHistoryInstructions,
        creatorNotes: character.creatorNotes,
        tags: character.tags || [],
        avatar: character.avatar,
        alternateGreetings: character.alternateGreetings,
        characterBook: character.characterBook,
        gallery: character.gallery,
        defaultPersonaId: character.defaultPersonaId,
        createdAt: character.createdAt || now,
        updatedAt: now,
      };

      if (isEditing && id) {
        await characterOps.update(id, charData);
        updateCharacter(id, charData);
      } else {
        await characterOps.add(charData);
        addCharacter(charData);
      }

      setIsDirty(false);
      navigate(`/characters/${charData.id}`);
    } catch (err) {
      setError('Failed to save character');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await characterOps.delete(id);
      navigate('/characters');
    } catch (err) {
      setError('Failed to delete character');
    }
  };

  const handleExport = () => {
    if (!character.name) return;
    const json = exportCharacterToJson(character as CharacterCard);
    const blob = new Blob([json], { type: 'application/json' });
    saveAs(blob, `${character.name.replace(/[^a-z0-9]/gi, '_')}.json`);
  };

  // Lorebook handlers
  const addLorebookEntry = () => {
    const entry: LorebookEntry = {
      id: generateUUID(),
      keywords: [],
      content: '',
      enabled: true,
      insertionOrder: character.characterBook?.entries?.length || 0,
    };
    updateField('characterBook', {
      entries: [...(character.characterBook?.entries || []), entry],
    });
  };

  const updateLorebookEntry = (index: number, updates: Partial<LorebookEntry>) => {
    const entries = [...(character.characterBook?.entries || [])];
    entries[index] = { ...entries[index], ...updates };
    updateField('characterBook', { entries });
  };

  const removeLorebookEntry = (index: number) => {
    const entries = (character.characterBook?.entries || []).filter((_, i) => i !== index);
    updateField('characterBook', { entries });
  };

  // Alternate greetings handlers
  const addGreeting = () => {
    updateField('alternateGreetings', [...(character.alternateGreetings || []), '']);
  };

  const updateGreeting = (index: number, value: string) => {
    const greetings = [...(character.alternateGreetings || [])];
    greetings[index] = value;
    updateField('alternateGreetings', greetings);
  };

  const removeGreeting = (index: number) => {
    const greetings = (character.alternateGreetings || []).filter((_, i) => i !== index);
    updateField('alternateGreetings', greetings);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-parlor-500" />
      </div>
    );
  }

  const tabs = [
    { id: 'basic' as const, label: 'Basic Info' },
    { id: 'advanced' as const, label: 'Advanced' },
    { id: 'lorebook' as const, label: 'Lorebook' },
  ];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white font-serif tracking-tight">
              {isEditing ? 'Edit Character' : 'Create Character'}
            </h1>
            <p className="text-gray-600 text-sm mt-1">
              {isEditing ? 'Modify character details' : 'Design your new character'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isEditing && (
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="w-4 h-4 text-red-400" />
            </Button>
          )}
          <Button variant="secondary" onClick={handleExport} disabled={!character.name}>
            Export JSON
          </Button>
          <Button onClick={handleSave} isLoading={isSaving}>
            <Save className="w-4 h-4" />
            Save
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
          {error}
        </div>
      )}

      {/* Avatar Section */}
      <div className="glass p-6 mb-6">
        <div className="flex items-start gap-6">
          <div className="relative group">
            <Avatar
              src={character.avatar}
              name={character.name || 'Character'}
              size="xl"
              className="w-24 h-24"
            />
            <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
              <ImageIcon className="w-6 h-6 text-white" />
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </label>
          </div>
          <div className="flex-1">
            <Input
              label="Character Name"
              value={character.name || ''}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="Enter character name"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap
              transition-all duration-200
              ${activeTab === tab.id
                ? 'bg-parlor-500/12 text-white border border-parlor-500/15'
                : 'text-gray-500 hover:text-white hover:bg-glass-white border border-transparent'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass p-6"
      >
          {activeTab === 'basic' && (
          <div className="space-y-4">
            <Textarea
              label="Description"
              value={character.description || ''}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Describe your character's appearance, background, personality, and key traits..."
              rows={6}
            />

            <Textarea
              label="Scenario"
              value={character.scenario || ''}
              onChange={(e) => updateField('scenario', e.target.value)}
              placeholder="Set the scene for the roleplay..."
              rows={3}
            />

            <Textarea
              label="First Message"
              value={character.firstMessage || ''}
              onChange={(e) => updateField('firstMessage', e.target.value)}
              placeholder="The character's opening message to start the conversation..."
              rows={6}
            />

            <Input
              label="Tags (comma separated)"
              value={character.tags?.join(', ') || ''}
              onChange={(e) => handleTagsChange(e.target.value)}
              placeholder="fantasy, original, female..."
            />
          </div>
        )}

        {activeTab === 'advanced' && (
          <div className="space-y-4">
            <Textarea
              label="System Prompt"
              value={character.systemPrompt || ''}
              onChange={(e) => updateField('systemPrompt', e.target.value)}
              placeholder="Custom system prompt to override the default..."
              rows={4}
            />

            <Textarea
              label="Post-History Instructions"
              value={character.postHistoryInstructions || ''}
              onChange={(e) => updateField('postHistoryInstructions', e.target.value)}
              placeholder="Instructions appended after the chat history..."
              rows={3}
            />

            <Textarea
              label="Creator Notes"
              value={character.creatorNotes || ''}
              onChange={(e) => updateField('creatorNotes', e.target.value)}
              placeholder="Notes about the character (not shown in chat)..."
              rows={3}
            />

            {/* Default Persona Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Default Persona
              </label>
              <select
                value={character.defaultPersonaId || ''}
                onChange={(e) => updateField('defaultPersonaId', e.target.value || undefined)}
                className="w-full rounded-lg bg-dark-100 border border-glass-border px-4 py-3 text-white focus:outline-none focus:border-parlor-500/50"
              >
                <option value="">Use global default persona</option>
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.isDefault ? '(Default)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                This persona will always be used when starting a new chat with this character
              </p>
            </div>

            {/* Alternate Greetings */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-300">
                  Alternate Greetings
                </label>
                <Button variant="ghost" size="sm" onClick={addGreeting}>
                  <Plus className="w-4 h-4" />
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                {(character.alternateGreetings || []).map((greeting, index) => (
                  <div key={index} className="flex gap-2">
                    <Textarea
                      value={greeting}
                      onChange={(e) => updateGreeting(index, e.target.value)}
                      placeholder={`Alternate greeting #${index + 2}`}
                      rows={3}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeGreeting(index)}
                      className="flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'lorebook' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-white font-serif tracking-tight">Character Lorebook</h3>
                <p className="text-sm text-gray-500">
                  Add entries that will be injected into context when keywords are mentioned
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={addLorebookEntry}>
                <Plus className="w-4 h-4" />
                Add Entry
              </Button>
            </div>

            <div className="space-y-3">
              {(character.characterBook?.entries || []).map((entry, index) => (
                <div key={entry.id} className="glass-sm p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 space-y-3">
                      <Input
                        label="Keywords (comma separated)"
                        value={entry.keywords.join(', ')}
                        onChange={(e) =>
                          updateLorebookEntry(index, {
                            keywords: e.target.value.split(',').map((k) => k.trim()).filter(Boolean),
                          })
                        }
                        placeholder="keyword1, keyword2"
                      />
                      <Textarea
                        label="Content"
                        value={entry.content}
                        onChange={(e) =>
                          updateLorebookEntry(index, { content: e.target.value })
                        }
                        placeholder="Information to inject when keywords are triggered..."
                        rows={3}
                      />
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm text-gray-400">
                          <input
                            type="checkbox"
                            checked={entry.enabled}
                            onChange={(e) =>
                              updateLorebookEntry(index, { enabled: e.target.checked })
                            }
                            className="rounded border-glass-border bg-dark-100"
                          />
                          Enabled
                        </label>
                        <Input
                          type="number"
                          label="Order"
                          value={entry.insertionOrder}
                          onChange={(e) =>
                            updateLorebookEntry(index, {
                              insertionOrder: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-24"
                        />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLorebookEntry(index)}
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                </div>
              ))}

              {(character.characterBook?.entries?.length || 0) === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <p>No lorebook entries yet</p>
                  <p className="text-sm mt-1">
                    Add entries to provide additional context when certain topics come up
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>

      {/* Image Crop Modal */}
      {cropSrc && (
        <ImageCropModal
          imageSrc={cropSrc}
          onConfirm={(url) => { updateField('avatar', url); setCropSrc(null); }}
          onCancel={() => setCropSrc(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Character"
        message={`Are you sure you want to delete "${character.name}"? This action cannot be undone and will also delete all associated chats.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}

export default CharacterEditorPage;