import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Plus,
  X,
  Search,
  Users,
  ToggleLeft,
  ToggleRight,
  GripVertical,
  ChevronDown,
} from 'lucide-react';
import { Button, Avatar } from '../components/ui';
import { characterOps, groupChatOps } from '../db';
import { generateUUID } from '../utils/uuid';
import { avatarCache, requestAvatar, subscribeAvatar } from '../utils/avatarCache';
import type { CharacterCard, GroupChat, GroupMember } from '../types';

// ─── Turn mode descriptions ─────────────────────────────────────────────────

function getTurnModes(t: (key: string, opts?: Record<string, unknown>) => string) {
  return [
    { value: 'natural' as const, label: t('groups.turnModeNatural'), desc: t('groups.turnNaturalDesc') },
    { value: 'sequential' as const, label: t('groups.turnModeSequential'), desc: t('groups.turnSequentialDesc') },
    { value: 'list' as const, label: t('groups.turnModeList'), desc: t('groups.turnListDesc') },
    { value: 'random' as const, label: t('groups.turnModeRandom'), desc: t('groups.turnRandomDesc') },
    { value: 'manual' as const, label: t('groups.turnModeManual'), desc: t('groups.turnManualDesc') },
  ];
}

// ─── Avatar hook (per-key subscription) ─────────────────────────────────────

function useCharacterAvatar(id: string): string | undefined {
  const [avatar, setAvatar] = useState<string | undefined>(() =>
    avatarCache.get(id) ?? undefined
  );
  useEffect(() => {
    requestAvatar(id);
    if (avatarCache.has(id)) setAvatar(avatarCache.get(id) ?? undefined);
    return subscribeAvatar(id, () => setAvatar(avatarCache.get(id) ?? undefined));
  }, [id]);
  return avatar;
}

// ─── Member row component ───────────────────────────────────────────────────

function MemberRow({
  member,
  character,
  onTalkativenessChange,
  onActiveToggle,
  onRemove,
}: {
  member: GroupMember;
  character: CharacterCard | undefined;
  onTalkativenessChange: (value: number) => void;
  onActiveToggle: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const avatar = useCharacterAvatar(member.characterId);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex items-center gap-3 p-3 rounded-lg bg-dark-100/50 border border-glass-border group"
    >
      <GripVertical className="w-4 h-4 text-gray-600 flex-shrink-0" />

      <Avatar
        src={avatar}
        name={character?.name || '?'}
        size="sm"
      />

      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">
          {character?.name || t('common.unknownCharacter')}
        </p>

        {/* Talkativeness slider */}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-500 w-20 flex-shrink-0">{t('groups.talkativeness')}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={member.talkativeness}
            onChange={(e) => onTalkativenessChange(parseInt(e.target.value))}
            className="flex-1 h-1 accent-parlor-500 bg-dark-200 rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-parlor-500"
          />
          <span className="text-xs text-gray-400 w-8 text-right tabular-nums">
            {member.talkativeness}
          </span>
        </div>
      </div>

      {/* Active toggle */}
      <button
        onClick={onActiveToggle}
        className="flex-shrink-0 transition-colors"
        title={member.isActive ? t('groups.activeHint') : t('groups.inactiveHint')}
      >
        {member.isActive ? (
          <ToggleRight className="w-6 h-6 text-parlor-400" />
        ) : (
          <ToggleLeft className="w-6 h-6 text-gray-600" />
        )}
      </button>

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-red-400"
        title={t('groups.removeHint')}
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

// ─── Character picker dropdown ──────────────────────────────────────────────

function CharacterPicker({
  characters,
  excludeIds,
  onSelect,
  onClose,
}: {
  characters: CharacterCard[];
  excludeIds: Set<string>;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const filtered = useMemo(() => {
    const lq = query.toLowerCase();
    return characters.filter(
      (c) => !excludeIds.has(c.id) && c.name.toLowerCase().includes(lq)
    );
  }, [characters, excludeIds, query]);

  return (
    <div ref={dropdownRef} className="absolute z-20 top-full left-0 right-0 mt-1">
      <div className="bg-dark-100 border border-glass-border rounded-xl shadow-dramatic overflow-hidden max-h-64 flex flex-col">
        <div className="p-2 border-b border-glass-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('groups.searchCharacters')}
              className="w-full bg-dark-100 border border-glass-border rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-parlor-500/50"
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              {query ? t('groups.noMatchingChars') : t('groups.allAdded')}
            </div>
          ) : (
            filtered.map((char) => (
              <CharacterPickerRow
                key={char.id}
                character={char}
                onSelect={() => {
                  onSelect(char.id);
                  onClose();
                }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function CharacterPickerRow({
  character,
  onSelect,
}: {
  character: CharacterCard;
  onSelect: () => void;
}) {
  const avatar = useCharacterAvatar(character.id);

  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-glass-white transition-colors text-left"
    >
      <Avatar src={avatar} name={character.name} size="sm" />
      <span className="text-sm text-white truncate">{character.name}</span>
    </button>
  );
}

// ─── Main page component ────────────────────────────────────────────────────

export function GroupChatEditorPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [name, setName] = useState('');
  const turnModes = getTurnModes(t);
  const [turnMode, setTurnMode] = useState<GroupChat['turnMode']>('natural');
  const [members, setMembers] = useState<GroupMember[]>([]);

  const [characters, setCharacters] = useState<CharacterCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [turnModeOpen, setTurnModeOpen] = useState(false);

  const pickerAnchorRef = useRef<HTMLDivElement>(null);

  // Character map for quick lookup
  const characterMap = useMemo(() => {
    const map = new Map<string, CharacterCard>();
    for (const c of characters) map.set(c.id, c);
    return map;
  }, [characters]);

  // IDs already in the group
  const memberIds = useMemo(
    () => new Set(members.map((m) => m.characterId)),
    [members]
  );

  // ── Load characters + existing group ────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [chars, group] = await Promise.all([
          characterOps.getAllCompact(),
          id ? groupChatOps.getById(id) : undefined,
        ]);

        if (cancelled) return;

        setCharacters(chars);

        if (group) {
          setName(group.name);
          setTurnMode(group.turnMode);
          setMembers(group.members);
        }
      } catch {
        if (!cancelled) setError(t('groups.failedToLoad'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id]);

  // ── Member management ───────────────────────────────────────────────────────

  const addMember = useCallback((characterId: string) => {
    setMembers((prev) => [
      ...prev,
      { characterId, talkativeness: 50, isActive: true },
    ]);
    setError(null);
  }, []);

  const removeMember = useCallback((characterId: string) => {
    setMembers((prev) => prev.filter((m) => m.characterId !== characterId));
  }, []);

  const updateMember = useCallback(
    (characterId: string, updates: Partial<GroupMember>) => {
      setMembers((prev) =>
        prev.map((m) =>
          m.characterId === characterId ? { ...m, ...updates } : m
        )
      );
    },
    []
  );

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!name.trim()) {
      setError(t('groups.nameRequired'));
      return;
    }
    if (members.length < 2) {
      setError(t('groups.needTwoMembers'));
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const now = Date.now();

      if (isEditing && id) {
        await groupChatOps.update(id, {
          name: name.trim(),
          turnMode,
          members,
          updatedAt: now,
        });
        navigate(`/group/${id}`);
      } else {
        const groupId = generateUUID();
        const group: GroupChat = {
          id: groupId,
          name: name.trim(),
          members,
          turnMode,
          messages: [],
          createdAt: now,
          updatedAt: now,
        };
        await groupChatOps.add(group);
        navigate(`/group/${groupId}`);
      }
    } catch {
      setError(t('groups.failedToSave'));
    } finally {
      setIsSaving(false);
    }
  };

  // ── Loading state ───────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-parlor-500" />
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white font-serif tracking-tight">
              {isEditing ? t('groups.editGroupTitle') : t('groups.createGroup')}
            </h1>
            <p className="text-gray-600 text-sm mt-1">
              {isEditing ? t('groups.editSubtitle') : t('groups.createSubtitle')}
            </p>
          </div>
        </div>
        <Button onClick={handleSave} isLoading={isSaving}>
          <Save className="w-4 h-4" />
          {t('groups.save')}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
          {error}
        </div>
      )}

      {/* Group Name */}
      <div className="glass p-6 mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          {t('groups.groupName')}
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(null); }}
          placeholder={t('groups.groupNamePlaceholder')}
          className="w-full bg-dark-100/50 backdrop-blur-sm border border-glass-border rounded-lg px-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:border-parlor-500 focus:ring-1 focus:ring-parlor-500/50 transition-all duration-200"
        />
      </div>

      {/* Turn Mode */}
      <div className="glass p-6 mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          {t('groups.turnMode')}
        </label>
        <div className="relative">
          <button
            onClick={() => setTurnModeOpen(!turnModeOpen)}
            className="w-full flex items-center justify-between bg-dark-100 border border-glass-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-parlor-500/50 transition-all"
          >
            <div className="text-left">
              <span className="text-sm font-medium">
                {turnModes.find((m) => m.value === turnMode)?.label}
              </span>
              <span className="text-xs text-gray-500 ml-2">
                {turnModes.find((m) => m.value === turnMode)?.desc}
              </span>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform ${turnModeOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence>
            {turnModeOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute z-10 top-full left-0 right-0 mt-1 bg-dark-100 border border-glass-border rounded-xl shadow-dramatic overflow-hidden"
              >
                {turnModes.map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => { setTurnMode(mode.value); setTurnModeOpen(false); }}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      turnMode === mode.value
                        ? 'bg-parlor-600/20 text-white'
                        : 'text-gray-300 hover:bg-glass-white hover:text-white'
                    }`}
                  >
                    <p className="text-sm font-medium">{mode.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{mode.desc}</p>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Members */}
      <div className="glass p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-parlor-400" />
            <h2 className="text-lg font-medium text-white font-serif tracking-tight">
              {t('groups.members')}
            </h2>
            <span className="text-xs text-gray-500">
              ({members.length})
            </span>
          </div>
          <div className="relative" ref={pickerAnchorRef}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowPicker(!showPicker)}
            >
              <Plus className="w-4 h-4" />
              {t('groups.addMember')}
            </Button>
            <AnimatePresence>
              {showPicker && (
                <CharacterPicker
                  characters={characters}
                  excludeIds={memberIds}
                  onSelect={addMember}
                  onClose={() => setShowPicker(false)}
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Member list */}
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {members.map((member) => (
              <MemberRow
                key={member.characterId}
                member={member}
                character={characterMap.get(member.characterId)}
                onTalkativenessChange={(v) =>
                  updateMember(member.characterId, { talkativeness: v })
                }
                onActiveToggle={() =>
                  updateMember(member.characterId, { isActive: !member.isActive })
                }
                onRemove={() => removeMember(member.characterId)}
              />
            ))}
          </AnimatePresence>

          {members.length === 0 && (
            <div className="text-center py-10 text-gray-500">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">{t('groups.noMembers')}</p>
              <p className="text-xs mt-1 text-gray-600">
                {t('groups.noMembersHint')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GroupChatEditorPage;
