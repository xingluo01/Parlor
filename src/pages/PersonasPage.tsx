import { useEffect, useState, useRef, useMemo } from 'react';
import { generateUUID } from '../utils/uuid';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Star, Upload, X, User, LayoutGrid, List } from 'lucide-react';
import { Button, Avatar, Modal, Input, Textarea, ImageCropModal } from '../components/ui';
import { usePersonaStore } from '../stores';
import { personaOps } from '../db';
import type { Persona } from '../types';

export function PersonasPage() {
  const { personas, setPersonas, activePersona, setActivePersona } = usePersonaStore();
  const [isLoading, setIsLoading] = useState(true);
  
  // Sort personas alphabetically by name
  const sortedPersonas = useMemo(() => {
    return [...personas].sort((a, b) => a.name.localeCompare(b.name));
  }, [personas]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [viewMode, setViewModeRaw] = useState<'grid' | 'list'>(
    () => (localStorage.getItem('parlor-personas-view') as 'grid' | 'list') || 'grid'
  );
  const setViewMode = (mode: 'grid' | 'list') => {
    setViewModeRaw(mode);
    localStorage.setItem('parlor-personas-view', mode);
  };
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadPersonas() {
      try {
        const personaList = await personaOps.getAll();
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
        name: data.name || 'New Persona',
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
        throw new Error('Invalid file format: missing "personas" object');
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
          name: name || 'Imported Persona',
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

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-serif tracking-tight">Personas</h1>
          <p className="text-gray-600 text-sm mt-1">
            Your user profiles for roleplay - the AI will know you as this character
          </p>
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
          <span>Successfully imported {importSuccess} persona{importSuccess !== 1 ? 's' : ''}!</span>
          <button onClick={() => setImportSuccess(null)} className="hover:text-green-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4" />
          New Persona
        </Button>
        <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
          <Upload className="w-4 h-4" />
          Import
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
        <div className="ml-auto flex gap-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-parlor-500/20 text-parlor-400' : 'text-gray-500 hover:text-gray-300'}`}
            title="Grid view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-parlor-500/20 text-parlor-400' : 'text-gray-500 hover:text-gray-300'}`}
            title="List view"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

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
          <p className="text-gray-400 mb-2 font-serif">No personas yet</p>
          <p className="text-gray-600 text-sm mb-4">
            Create a persona to tell the AI who you are in roleplays
          </p>
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4" />
            Create Your First Persona
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
                className={`glass p-3 sm:p-4 ${persona.isDefault ? 'border-parlor-500/30' : ''}`}
              >
                <div className="flex items-start gap-3 sm:gap-4">
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
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                      {persona.description || 'No description'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 mt-3 sm:mt-4">
                  {!persona.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetDefault(persona.id)}
                    >
                      <Star className="w-4 h-4" />
                      <span className="hidden sm:inline">Set Default</span>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(persona)}
                  >
                    <Edit className="w-4 h-4" />
                    Edit
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
              </motion.div>
            ) : (
              <motion.div
                key={persona.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`glass-sm p-3 flex items-center gap-3 ${persona.isDefault ? 'border-parlor-500/30' : ''}`}
              >
                <Avatar
                  src={persona.avatar}
                  name={persona.name}
                  size="md"
                  className="flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-white truncate text-sm">{persona.name}</h3>
                    {persona.isDefault && (
                      <span className="text-xs bg-parlor-500/20 text-parlor-400 px-1.5 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0">
                        <Star className="w-3 h-3" />
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {persona.description || 'No description'}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!persona.isDefault && (
                    <button
                      onClick={() => handleSetDefault(persona.id)}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-parlor-400 hover:bg-glass-white transition-colors"
                      title="Set Default"
                    >
                      <Star className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(persona)}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-glass-white transition-colors"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  {!persona.isDefault && (
                    <button
                      onClick={() => setDeleteConfirm(persona.id)}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-glass-white transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
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
        title="Delete Persona"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-300">
            Are you sure you want to delete this persona? This action cannot be undone.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
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
      title={persona ? 'Edit Persona' : 'New Persona'}
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
              Upload an avatar image for your persona
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Click the button on the avatar to upload
            </p>
          </div>
        </div>

        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your persona's name"
          required
        />
        
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe who you are in roleplays. This helps the AI understand your character..."
          rows={4}
        />

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} isLoading={isLoading} disabled={!name.trim()}>
            {persona ? 'Save Changes' : 'Create Persona'}
          </Button>
        </div>
      </div>
    </Modal>
    </>
  );
}

export default PersonasPage;