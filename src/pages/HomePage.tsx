import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Plus,
  Download,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { generateUUID } from '../utils/uuid';
import { Button, Avatar } from '../components/ui';
import { characterOps, chatOps, personaOps } from '../db';
import { useChatStore } from '../stores';
import { seedAvatars } from '../utils/avatarCache';
import logoSrc from '../assets/logo.png';
import type { CharacterCard, ChatSession } from '../types';

function getLastMessagePreview(chat: ChatSession, maxLen = 120): string {
  for (let i = chat.messages.length - 1; i >= 0; i--) {
    const msg = chat.messages[i];
    if (msg.role === 'user' || msg.role === 'assistant') {
      const stripped = msg.content
        .replace(/[*_~`#>]/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\n+/g, ' ')
        .trim();
      return stripped.length > maxLen ? stripped.slice(0, maxLen) + '...' : stripped;
    }
  }
  return '';
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
};

export function HomePage() {
  const navigate = useNavigate();
  const { setActiveChat } = useChatStore();
  const [allChats, setAllChats] = useState<ChatSession[]>([]);
  const [characters, setCharacters] = useState<CharacterCard[]>([]);
  const [featured, setFeatured] = useState<CharacterCard[]>([]);
  const [avatarMap, setAvatarMap] = useState<Record<string, string>>({});
  const [stats, setStats] = useState({ characters: 0, chats: 0, messages: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        const [chats, allCharacters] = await Promise.all([
          chatOps.getAll(),
          characterOps.getAllCompact(),
        ]);
        if (!mounted) return;

        const shuffled = [...allCharacters].sort(() => Math.random() - 0.5);
        const featuredChars = shuffled.slice(0, 6);

        const heroAndRecent = chats.slice(0, 5);
        const recentCharIds = heroAndRecent.map(c => c.characterId);
        const idsToLoad = [...new Set([...featuredChars.map(c => c.id), ...recentCharIds])];
        const avatars = idsToLoad.length > 0 ? await characterOps.getAvatars(idsToLoad) : {};
        if (!mounted) return;

        if (Object.keys(avatars).length > 0) seedAvatars(avatars);

        const totalMessages = chats.reduce((sum, chat) => sum + chat.messages.length, 0);

        setAllChats(chats);
        setCharacters(allCharacters);
        setFeatured(featuredChars);
        setAvatarMap(avatars);
        setStats({
          characters: allCharacters.length,
          chats: chats.length,
          messages: totalMessages,
        });
      } catch (error) {
        console.error('Failed to load home data:', error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    loadData();
    return () => { mounted = false; };
  }, []);

  const handleCharacterClick = useCallback(async (character: CharacterCard) => {
    const charChats = allChats
      .filter(c => c.characterId === character.id)
      .sort((a, b) => b.updatedAt - a.updatedAt);

    if (charChats.length > 0) {
      setActiveChat(charChats[0]);
      navigate(`/chat/${charChats[0].id}`);
      return;
    }

    let personaId: string | null = null;
    if (character.defaultPersonaId) {
      personaId = character.defaultPersonaId;
    } else {
      const allPersonas = await personaOps.getAll();
      const defaultPersona = allPersonas.find(p => p.isDefault);
      if (defaultPersona) personaId = defaultPersona.id;
    }

    const newChat: ChatSession = {
      id: generateUUID(),
      characterId: character.id,
      personaId,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (character.firstMessage) {
      const allGreetings = [character.firstMessage, ...(character.alternateGreetings ?? [])].filter(Boolean);
      newChat.messages.push({
        id: generateUUID(),
        role: 'assistant',
        content: character.firstMessage,
        timestamp: Date.now(),
        ...(allGreetings.length > 1 ? { swipes: allGreetings } : {}),
      });
    }

    await chatOps.add(newChat);
    setActiveChat(newChat);
    navigate(`/chat/${newChat.id}`);
  }, [allChats, setActiveChat, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-parlor-500" />
      </div>
    );
  }

  const isEmpty = allChats.length === 0 && characters.length === 0;

  if (isEmpty) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-md"
        >
          <div className="relative inline-block mb-8">
            <img src={logoSrc} alt="Parlor" className="w-20 h-20 rounded-2xl shadow-glow-lg" />
            <div className="absolute inset-0 rounded-2xl bg-parlor-500/10 animate-pulse-soft" />
          </div>
          <h1 className="text-4xl font-bold text-white font-serif mb-3 tracking-tight">
            Welcome to Parlor
          </h1>
          <p className="text-gray-400 mb-2 text-lg leading-relaxed">Your private stage for conversation.</p>
          <p className="text-sm text-gray-600 mb-8 leading-relaxed">
            Create your first character or import one to begin.
          </p>
          <div className="flex gap-3 justify-center">
            <Link to="/characters/new">
              <Button size="lg">
                <Plus className="w-5 h-5" />
                Create Character
              </Button>
            </Link>
            <Link to="/characters/import">
              <Button variant="secondary" size="lg">
                <Download className="w-5 h-5" />
                Import
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  const heroChat = allChats[0] as ChatSession | undefined;
  const recentChats = allChats.slice(1, 5);
  const heroCharacter = heroChat ? characters.find(c => c.id === heroChat.characterId) : undefined;

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="p-4 md:p-8 max-w-3xl mx-auto space-y-8"
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="pt-2">
        <h1 className="text-3xl sm:text-4xl font-bold text-white font-serif tracking-tight">Welcome back</h1>
        <p className="text-gray-600 mt-1 text-sm">Pick up where you left off</p>
      </motion.div>

      {/* Hero Chat */}
      {heroChat && (
        <motion.div variants={fadeUp}>
          <Link to={`/chat/${heroChat.id}`}>
            <div className="relative overflow-hidden bg-dark-200 border border-glass-border rounded-2xl p-5 hover:border-parlor-500/15 transition-all group">
              {/* Warm glow accent */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-parlor-500/[0.04] rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-parlor-500/[0.08] transition-colors duration-500" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-accent-500/[0.03] rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

              <div className="relative flex items-start gap-4">
                <Avatar
                  src={avatarMap[heroCharacter?.id ?? '']}
                  name={heroCharacter?.name || 'Unknown'}
                  size="lg"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-accent-500" />
                    <span className="text-2xs text-accent-500 font-semibold uppercase tracking-[0.1em]">Continue</span>
                  </div>
                  <p className="font-semibold text-white text-lg font-serif tracking-tight truncate">
                    {heroCharacter?.name || 'Unknown Character'}
                  </p>
                  {heroChat.title && (
                    <p className="text-xs text-gray-600 truncate mt-0.5">{heroChat.title}</p>
                  )}
                  <p className="text-sm text-gray-500 mt-2 line-clamp-2 leading-relaxed">
                    {getLastMessagePreview(heroChat)}
                  </p>
                </div>
                <span className="text-2xs text-gray-600 shrink-0 pt-1 tracking-wide">
                  {formatTime(heroChat.updatedAt)}
                </span>
              </div>
            </div>
          </Link>
        </motion.div>
      )}

      {/* Recent Chats */}
      {recentChats.length > 0 && (
        <motion.div variants={fadeUp}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white font-serif tracking-tight">Recent Chats</h2>
            <Link to="/chats">
              <Button variant="ghost" size="sm" className="text-xs">
                View All
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
          <div className="space-y-1.5">
            {recentChats.map((chat) => {
              const character = characters.find(c => c.id === chat.characterId);
              return (
                <Link key={chat.id} to={`/chat/${chat.id}`}>
                  <div className="bg-dark-200/80 border border-glass-border p-3 rounded-xl hover:border-parlor-500/10 transition-all flex items-center gap-3 group">
                    <Avatar
                      src={avatarMap[character?.id ?? '']}
                      name={character?.name || 'Unknown'}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-200 truncate text-sm">
                        {character?.name || 'Unknown Character'}
                      </p>
                      <p className="text-xs text-gray-600 line-clamp-1 mt-0.5">
                        {getLastMessagePreview(chat, 100)}
                      </p>
                    </div>
                    <span className="text-2xs text-gray-700 shrink-0 tracking-wide">
                      {formatTime(chat.updatedAt)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Stats */}
      <motion.div variants={fadeUp} className="grid grid-cols-3 gap-3">
        {[
          { value: stats.characters, label: 'Characters' },
          { value: stats.chats, label: 'Chats' },
          { value: stats.messages, label: 'Messages' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-dark-200/60 border border-glass-border p-4 rounded-xl text-center"
          >
            <p className="text-2xl font-bold text-white font-serif tracking-tight">{stat.value}</p>
            <p className="text-2xs text-gray-600 mt-1 uppercase tracking-[0.1em]">{stat.label}</p>
          </div>
        ))}
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={fadeUp} className="grid grid-cols-3 gap-3">
        <Link to="/characters">
          <div className="bg-dark-200/60 border border-glass-border p-4 rounded-xl hover:border-parlor-500/10 transition-all group cursor-pointer text-center">
            <MessageSquare className="w-5 h-5 text-parlor-400 mb-2 mx-auto group-hover:scale-110 transition-transform" />
            <p className="text-xs font-medium text-gray-400">New Chat</p>
          </div>
        </Link>
        <Link to="/characters/new">
          <div className="bg-dark-200/60 border border-glass-border p-4 rounded-xl hover:border-parlor-500/10 transition-all group cursor-pointer text-center">
            <Plus className="w-5 h-5 text-parlor-400 mb-2 mx-auto group-hover:scale-110 transition-transform" />
            <p className="text-xs font-medium text-gray-400">Create</p>
          </div>
        </Link>
        <Link to="/characters/import">
          <div className="bg-dark-200/60 border border-glass-border p-4 rounded-xl hover:border-parlor-500/10 transition-all group cursor-pointer text-center">
            <Download className="w-5 h-5 text-parlor-400 mb-2 mx-auto group-hover:scale-110 transition-transform" />
            <p className="text-xs font-medium text-gray-400">Import</p>
          </div>
        </Link>
      </motion.div>

      {/* Your Characters */}
      {featured.length > 0 && (
        <motion.div variants={fadeUp}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white font-serif tracking-tight">Your Characters</h2>
            <Link to="/characters">
              <Button variant="ghost" size="sm" className="text-xs">
                View All
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
            {featured.map((char) => (
              <button
                key={char.id}
                onClick={() => handleCharacterClick(char)}
                className="bg-dark-200/80 border border-glass-border p-3 rounded-xl hover:border-parlor-500/10 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <Avatar src={avatarMap[char.id]} name={char.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-200 truncate text-sm">{char.name}</p>
                    <p className="text-2xs text-gray-700 truncate">
                      {char.tags?.[0] || 'No tags'}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default HomePage;
