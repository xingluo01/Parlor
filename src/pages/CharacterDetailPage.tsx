import { useState, useEffect } from 'react';
import { generateUUID } from '../utils/uuid';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Trash2,
  MessageSquare,
  Download,
  Calendar,
  Tag,
  FileText,
  Image,
} from 'lucide-react';
import { Button, Avatar, ConfirmDialog } from '../components/ui';
import { characterOps, chatOps } from '../db';
import { useCharacterStore, useChatStore } from '../stores';
import { exportCharacterToJson, exportCharacterToPng } from '../utils/characterImport';
import type { CharacterCard, ChatSession } from '../types';
import { saveAs } from 'file-saver';

export function CharacterDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { removeCharacter } = useCharacterStore();
  const { addChat, setActiveChat } = useChatStore();

  const [character, setCharacter] = useState<CharacterCard | null>(null);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeSection, setActiveSection] = useState<'description' | 'scenario' | 'greetings'>('description');

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [char, charChats] = await Promise.all([
          characterOps.getById(id),
          chatOps.getByCharacter(id),
        ]);
        if (!mounted) return;
        setCharacter(char || null);
        setChats(charChats);
      } catch (err) {
        console.error('Failed to load character:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    loadData();
    return () => { mounted = false; };
  }, [id]);

  const handleStartChat = async () => {
    if (!character) return;

    const newChat: ChatSession = {
      id: generateUUID(),
      characterId: character.id,
      personaId: null,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (character.firstMessage) {
      newChat.messages.push({
        id: generateUUID(),
        role: 'assistant',
        content: character.firstMessage,
        timestamp: Date.now(),
      });
    }

    await chatOps.add(newChat);
    addChat(newChat);
    setActiveChat(newChat);
    navigate(`/chat/${newChat.id}`);
  };

  const handleExport = () => {
    if (!character) return;
    const json = exportCharacterToJson(character);
    const blob = new Blob([json], { type: 'application/json' });
    saveAs(blob, `${character.name.replace(/[^a-z0-9]/gi, '_')}.json`);
  };

  const handleExportPng = async () => {
    if (!character) return;
    try {
      const blob = await exportCharacterToPng(character);
      saveAs(blob, `${character.name.replace(/[^a-z0-9]/gi, '_')}.png`);
    } catch (err) {
      console.error('Failed to export PNG:', err);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await characterOps.delete(id);
      removeCharacter(id);
      navigate('/characters');
    } catch (err) {
      console.error('Failed to delete character:', err);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-parlor-500" />
      </div>
    );
  }

  if (!character) {
    return (
      <div className="p-4 md:p-6 text-center">
        <p className="text-gray-500">Character not found</p>
        <Button className="mt-4" onClick={() => navigate('/characters')}>
          Back to Characters
        </Button>
      </div>
    );
  }

  const sections = [
    { id: 'description' as const, label: 'Description', icon: FileText },
    { id: 'scenario' as const, label: 'Scenario', icon: Tag },
    { id: 'greetings' as const, label: 'Greetings', icon: MessageSquare },
  ];

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/characters')} className="p-1.5">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Avatar
            src={character.avatar}
            name={character.name}
            size="lg"
            className="ring-2 ring-parlor-500/20"
          />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-3xl font-bold text-white truncate font-serif tracking-tight">{character.name}</h1>
            <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500 mt-1">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(character.createdAt)}
              </span>
              {chats.length > 0 && (
                <span>{chats.length} chat{chats.length !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleStartChat}>
            <MessageSquare className="w-4 h-4" />
            Start Chat
          </Button>
          <Button variant="secondary" onClick={() => navigate(`/characters/${id}/edit`)}>
            <Edit className="w-4 h-4" />
            Edit
          </Button>
          <Button variant="secondary" onClick={handleExport}>
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Button variant="secondary" onClick={handleExportPng}>
            <Image className="w-4 h-4" />
            Export PNG
          </Button>
        </div>
      </div>

      {/* Tags */}
      {character.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {character.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Section Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap
              transition-all duration-200
              ${activeSection === section.id
                ? 'bg-parlor-500/15 text-white border border-parlor-500/20'
                : 'text-gray-500 hover:text-white hover:bg-glass-white border border-transparent'
              }
            `}
          >
            <section.icon className="w-4 h-4" />
            {section.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <motion.div
        key={activeSection}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="glass p-6"
      >
        {activeSection === 'description' && (
          <div>
            <h3 className="text-lg font-medium text-white mb-3 font-serif">Description</h3>
            {character.description ? (
              <p className="text-gray-400 whitespace-pre-wrap leading-relaxed">
                {character.description}
              </p>
            ) : (
              <p className="text-gray-600 italic">No description provided</p>
            )}
          </div>
        )}

        {activeSection === 'scenario' && (
          <div>
            <h3 className="text-lg font-medium text-white mb-3 font-serif">Scenario</h3>
            {character.scenario ? (
              <p className="text-gray-400 whitespace-pre-wrap leading-relaxed">
                {character.scenario}
              </p>
            ) : (
              <p className="text-gray-600 italic">No scenario defined</p>
            )}
          </div>
        )}

        {activeSection === 'greetings' && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-2">First Message</h4>
              {character.firstMessage ? (
                <div className="glass-sm p-4 text-gray-400 whitespace-pre-wrap">
                  {character.firstMessage}
                </div>
              ) : (
                <p className="text-gray-600 italic">No first message defined</p>
              )}
            </div>

            {character.alternateGreetings && character.alternateGreetings.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">
                  Alternate Greetings ({character.alternateGreetings.length})
                </h4>
                <div className="space-y-3">
                  {character.alternateGreetings.map((greeting, index) => (
                    <div key={index} className="glass-sm p-4 text-gray-400 whitespace-pre-wrap">
                      {greeting}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Lorebook Summary */}
      {character.characterBook && character.characterBook.entries.length > 0 && (
        <div className="glass p-6 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-white font-serif">Lorebook</h3>
              <p className="text-sm text-gray-500">
                {character.characterBook.entries.filter(e => e.enabled).length} active entries
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={() => navigate(`/characters/${id}/edit`)}
            >
              <Edit className="w-4 h-4" />
              Edit Lorebook
            </Button>
          </div>
        </div>
      )}

      {/* Recent Chats */}
      {chats.length > 0 && (
        <div className="glass p-6 mt-4">
          <h3 className="text-lg font-medium text-white mb-4 font-serif">Recent Chats</h3>
          <div className="space-y-2">
            {chats.slice(0, 5).map((chat) => (
              <div
                key={chat.id}
                className="glass-sm p-4 cursor-pointer hover:border-parlor-500/20 transition-all"
                onClick={() => navigate(`/chat/${chat.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white text-sm">
                      {chat.title || `Chat with ${character.name}`}
                    </p>
                    <p className="text-sm text-gray-500">
                      {chat.messages.length} messages • Updated {formatDate(chat.updatedAt)}
                    </p>
                  </div>
                  <MessageSquare className="w-4 h-4 text-gray-600" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Danger Zone */}
      <div className="glass p-6 mt-4 border-red-500/15">
        <h3 className="text-lg font-medium text-red-400 mb-2 font-serif">Danger Zone</h3>
        <p className="text-sm text-gray-500 mb-4">
          Deleting this character will also delete all associated chats.
        </p>
        <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
          <Trash2 className="w-4 h-4" />
          Delete Character
        </Button>
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Character"
        message={`Are you sure you want to delete "${character.name}"? This will also delete ${chats.length} associated chat${chats.length !== 1 ? 's' : ''}. This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}

export default CharacterDetailPage;
