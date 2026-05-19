import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { generateUUID } from '../utils/uuid';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { Upload, FileJson, Image, X, AlertCircle, CheckCircle, Link, Loader2, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Avatar, Input } from '../components/ui';
import i18n from '../i18n';
import { importCharacterFromFile, validateCharacter } from '../utils/characterImport';
import { characterOps, connectionOps, worldInfoOps, groupChatOps } from '../db';
import { useCharacterStore } from '../stores';
import type { CharacterCard } from '../types';
import { callAI } from '../services/ai';
import { extractJSON, buildSplitCharacterPrompt } from '../utils/prompts';

// ===== 拆解结果类型 =====
interface SplitCharacter {
  name: string;
  description: string;
  personality: string;
  firstMessage: string;
  scenario?: string;
  tags: string[];
  relations?: { targetName: string; relationType: string; summary: string }[];
}

interface SplitWorldEntry {
  name: string;
  content: string;
  keywords: string[];
}

interface SplitResult {
  isMultiCharacter: boolean;
  characters: SplitCharacter[];
  worldEntries: SplitWorldEntry[];
  groupName?: string;
}

interface ImportResult {
  filename: string;
  success: boolean;
  character?: CharacterCard;
  error?: string;
}

// Fetch character from URL (supports chub.ai and other card repositories)
async function fetchCharacterFromUrl(url: string): Promise<{ character: unknown; filename: string } | null> {
  try {
    // Parse URL
    const urlObj = new URL(url);
    
    // Handle chub.ai URLs
    if (urlObj.hostname === 'chub.ai' || urlObj.hostname.endsWith('.chub.ai')) {
      // Extract character slug from URL
      // Format: https://chub.ai/characters/username/character-name
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      
      if (pathParts.length >= 3 && pathParts[0] === 'characters') {
        const fullPath = pathParts.slice(1).join('/');
        
        // Try to fetch from chub API
        const apiUrl = `https://api.chub.ai/api/v2/characters/full?full_path=${encodeURIComponent(fullPath)}`;
        
        const response = await fetch(apiUrl, {
          headers: {
            'Accept': 'application/json',
          },
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch from chub.ai: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.character) {
          // Extract character data from chub response
          const charData = data.character;
          
          // Download avatar if available
          let avatarData: string | undefined;
          if (charData.avatar_url || charData.avatarUrl) {
            try {
              const avatarUrl = charData.avatar_url || charData.avatarUrl;
              const avatarResponse = await fetch(avatarUrl);
              if (avatarResponse.ok) {
                const blob = await avatarResponse.blob();
                avatarData = await new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.readAsDataURL(blob);
                });
              }
            } catch {
              console.warn('Failed to download avatar');
            }
          }
          
          // Map chub format to our CharacterCard format
          const character = {
            name: charData.name || 'Unknown',
            description: charData.description || charData.definition?.description || '',
            personality: charData.personality || charData.definition?.personality || '',
            scenario: charData.scenario || charData.definition?.scenario || '',
            firstMessage: charData.first_message || charData.firstMessage || charData.definition?.first_message || '*Hello there!*',
            systemPrompt: charData.system_prompt || charData.systemPrompt,
            postHistoryInstructions: charData.post_history_instructions || charData.postHistoryInstructions,
            creatorNotes: charData.creator_notes || charData.creatorNotes,
            tags: charData.tags || [],
            avatar: avatarData,
            alternateGreetings: charData.alternate_greetings || charData.alternateGreetings,
          };
          
          return {
            character,
            filename: `${charData.name || 'character'}.json`,
          };
        }
      }
    }
    
    // Try generic JSON fetch
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }
    
    // Check if it's an image (PNG card)
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('image/png')) {
      const blob = await response.blob();
      const file = new File([blob], 'character.png', { type: 'image/png' });
      const result = await importCharacterFromFile(file);
      if (result) {
        return { character: result.character, filename: 'character.png' };
      }
      return null;
    }
    
    // Try to parse as JSON
    const data = await response.json();
    
    // Check if it's a character card format
    if (data.spec === 'chara_card_v2' || data.name || data.data?.name) {
      return {
        character: data.data || data,
        filename: url.split('/').pop() || 'character.json',
      };
    }
    
    throw new Error(i18n.t('characterImport.unknownFormat'));
  } catch (error) {
    console.error('URL fetch error:', error);
    throw error;
  }
}

export function CharacterImportPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addCharacter } = useCharacterStore();
  const [results, setResults] = useState<ImportResult[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [activeConn, setActiveConn] = useState<any>(null);
  const [splittingId, setSplittingId] = useState<string | null>(null);
  const [splitResults, setSplitResults] = useState<Record<string, { success: boolean; data?: SplitResult; error?: string }>>({});

  // 加载 AI 连接
  useEffect(() => {
    connectionOps.getActive().then(conn => {
      if (conn) setActiveConn(conn);
    });
  }, []);

  const handleSplitCharacter = async (char: CharacterCard) => {
    if (!activeConn) {
      setSplitResults(prev => ({
        ...prev,
        [char.id]: { success: false, error: '请先在设置中配置 AI 连接' }
      }));
      return;
    }

    setSplittingId(char.id);

    try {
      const prompt = buildSplitCharacterPrompt(char);
      const resultText = await callAI(activeConn, '你是一个专业的角色卡分析专家，擅长从角色卡中提取和拆解多个角色信息。', prompt, { temperature: 0.3, maxTokens: 4096 });

      const result = extractJSON(resultText) as SplitResult;

      if (!result.characters || result.characters.length === 0) {
        throw new Error('AI 未能拆解出角色信息');
      }

      if (result.isMultiCharacter && result.characters.length >= 2) {
        await executeSplitImport(result, char);
      }

      setSplitResults(prev => ({
        ...prev,
        [char.id]: { success: true, data: result }
      }));

    } catch (e: any) {
      setSplitResults(prev => ({
        ...prev,
        [char.id]: { success: false, error: e.message }
      }));
    } finally {
      setSplittingId(null);
    }
  };

  function generateFallbackFirstMessage(name: string): string {
    const fallbacks = [
      `*${name}轻轻抬起头，目光中带着一丝好奇，嘴角微微上扬*「你好，我是${name}。没想到会在这里遇见你。」`,
      `*${name}缓步走来，衣袂飘飘，神色从容*「幸会。我是${name}，请多指教。」`,
      `*${name}微微颔首，露出一抹友善的笑容*「你好啊，我是${name}。今天天气不错，心情也很好呢。」`,
      `*${name}双手抱胸，打量着对方，眼中闪过一丝兴趣*「哦？你就是新来的？我叫${name}，欢迎。」`,
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  async function executeSplitImport(result: SplitResult, originalChar: CharacterCard) {
    const novelTitle = result.groupName || `${originalChar.name}群组`;
    const worldInfoId = generateUUID();
    const createdCharIds: string[] = [];
    const characterIdMap = new Map<string, string>();

    // 1. 创建世界书分组
    if (result.worldEntries.length > 0) {
      try {
        const loreEntries: any[] = result.worldEntries.map((entry, idx) => ({
          id: generateUUID(),
          keywords: entry.keywords || [entry.name],
          content: entry.content,
          enabled: true,
          insertionOrder: idx,
        }));

        const worldInfo = {
          id: worldInfoId,
          name: `${novelTitle}世界观`,
          enabled: true,
          entries: loreEntries,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        await worldInfoOps.add(worldInfo);
      } catch (e) {
        console.debug('Failed to create world info:', e);
      }
    }

    // 2. 创建角色卡
    for (const charData of result.characters) {
      const charId = generateUUID();
      characterIdMap.set(charData.name, charId);
      createdCharIds.push(charId);

      const card: any = {
        id: charId,
        name: charData.name,
        description: charData.description || '',
        personality: charData.personality || '',
        scenario: charData.scenario || '',
        firstMessage: (charData.firstMessage && charData.firstMessage.length >= 10)
          ? charData.firstMessage
          : generateFallbackFirstMessage(charData.name),
        tags: [...(charData.tags || []), originalChar.name],
        worldInfoId: result.worldEntries.length > 0 ? worldInfoId : undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await characterOps.add(card);
      addCharacter(card);
    }

    // 3. 处理角色关系
    for (const charData of result.characters) {
      if (!charData.relations?.length) continue;
      const charId = characterIdMap.get(charData.name);
      if (!charId) continue;

      const resolvedRelations: any[] = [];
      for (const rel of charData.relations) {
        const targetId = characterIdMap.get(rel.targetName);
        if (!targetId) continue;
        resolvedRelations.push({
          id: generateUUID(),
          targetId,
          relationType: rel.relationType,
          summary: rel.summary,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      if (resolvedRelations.length > 0) {
        await characterOps.update(charId, { relations: resolvedRelations });
      }
    }

    // 4. 创建群聊（角色数 >= 2）
    if (createdCharIds.length >= 2) {
      try {
        const groupChatId = generateUUID();
        const members = createdCharIds.map(charId => ({
          characterId: charId,
          talkativeness: 5,
          isActive: true,
        }));

        const groupChat = {
          id: groupChatId,
          name: `${novelTitle} - 角色群聊`,
          members,
          turnMode: 'natural' as const,
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        await groupChatOps.add(groupChat);
      } catch (e) {
        console.debug('Failed to create group chat:', e);
      }
    }
  }

  const handleImportFromUrl = async () => {
    if (!importUrl.trim()) return;
    
    setIsFetchingUrl(true);
    setUrlError(null);
    
    try {
      const result = await fetchCharacterFromUrl(importUrl.trim());
      
      if (!result || !result.character) {
        setUrlError(t('characterImport.urlError'));
        return;
      }
      
      const { character: charData } = result;

      // Validate
      const validation = validateCharacter(charData);
      if (!validation.valid) {
        setUrlError(validation.errors.join(', '));
        return;
      }

      // Create full character
      const character: CharacterCard = {
        id: (charData as CharacterCard).id || generateUUID(),
        name: (charData as CharacterCard).name!,
        description: (charData as CharacterCard).description || '',
        personality: (charData as CharacterCard).personality || '',
        scenario: (charData as CharacterCard).scenario || '',
        firstMessage: (charData as CharacterCard).firstMessage!,
        systemPrompt: (charData as CharacterCard).systemPrompt,
        postHistoryInstructions: (charData as CharacterCard).postHistoryInstructions,
        creatorNotes: (charData as CharacterCard).creatorNotes,
        tags: (charData as CharacterCard).tags || [],
        avatar: (charData as CharacterCard).avatar,
        alternateGreetings: (charData as CharacterCard).alternateGreetings,
        characterBook: (charData as CharacterCard).characterBook,
        mesExamples: (charData as CharacterCard).mesExamples,
        gallery: (charData as CharacterCard).gallery,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Save to database
      await characterOps.add(character);
      addCharacter(character);

      setResults([{
        filename: result.filename,
        success: true,
        character,
      }]);
      
      setImportUrl('');
    } catch (error) {
      setUrlError(error instanceof Error ? error.message : 'Failed to fetch character from URL');
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setIsImporting(true);
    setImportProgress(null);
    setResults([]);

    const importResults: ImportResult[] = [];
    const validCharacters: CharacterCard[] = [];

    // Phase 1: Parse all files locally (no server calls)
    for (let i = 0; i < acceptedFiles.length; i++) {
      const file = acceptedFiles[i];
      if (acceptedFiles.length > 10) {
        setImportProgress(`Parsing ${i + 1} / ${acceptedFiles.length}…`);
      }
      try {
        const result = await importCharacterFromFile(file);

        if (!result || !result.character) {
          importResults.push({
            filename: file.name,
            success: false,
            error: t('characterImport.fileError'),
          });
          continue;
        }

        const { character: charData } = result;

        const validation = validateCharacter(charData);
        if (!validation.valid) {
          importResults.push({
            filename: file.name,
            success: false,
            error: validation.errors.join(', '),
          });
          continue;
        }

        const character: CharacterCard = {
          id: charData.id || generateUUID(),
          name: charData.name!,
          description: charData.description || '',
          personality: charData.personality || '',
          scenario: charData.scenario || '',
          firstMessage: charData.firstMessage!,
          systemPrompt: charData.systemPrompt,
          postHistoryInstructions: charData.postHistoryInstructions,
          creatorNotes: charData.creatorNotes,
          tags: charData.tags || [],
          avatar: charData.avatar,
          alternateGreetings: charData.alternateGreetings,
          characterBook: charData.characterBook,
          mesExamples: charData.mesExamples,
          gallery: charData.gallery,
          createdAt: charData.createdAt || Date.now(),
          updatedAt: Date.now(),
        };

        validCharacters.push(character);
        importResults.push({ filename: file.name, success: true, character });
      } catch (err) {
        importResults.push({
          filename: file.name,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // Phase 2: Save all valid characters in one batch (single read+write on server)
    if (validCharacters.length > 0) {
      setImportProgress(`Saving ${validCharacters.length} character${validCharacters.length !== 1 ? 's' : ''}…`);
      try {
        await characterOps.batchAdd(validCharacters);
        for (const char of validCharacters) {
          addCharacter(char);
        }
      } catch (err) {
        // Mark all previously-successful results as failed
        const saveError = err instanceof Error ? err.message : 'Failed to save';
        for (const r of importResults) {
          if (r.success) {
            r.success = false;
            r.error = `Save failed: ${saveError}`;
          }
        }
      }
    }

    setImportProgress(null);
    setResults(importResults);
    setIsImporting(false);
  }, [addCharacter]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'application/json': ['.json'],
    },
    multiple: true,
  });

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white font-serif tracking-tight">{t('characterImport.title')}</h1>
          <p className="text-gray-600 text-sm mt-1">
            {t('characterImport.subtitle')}
          </p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/characters')}>
          <X className="w-4 h-4" />
          {t('characterImport.done')}
        </Button>
      </div>

      {/* URL Import */}
      <div className="glass p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Link className="w-5 h-5 text-parlor-400" />
          <h2 className="font-medium text-white">{t('characterImport.importFromUrl')}</h2>
        </div>
        <div className="flex gap-2">
          <Input
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            placeholder={t('characterImport.urlPlaceholder')}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleImportFromUrl();
              }
            }}
          />
          <Button
            onClick={handleImportFromUrl}
            disabled={!importUrl.trim() || isFetchingUrl}
          >
            {isFetchingUrl ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {t('characterImport.import')}
          </Button>
        </div>
        {urlError && (
          <p className="text-sm text-red-400 mt-2 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {urlError}
          </p>
        )}
        <p className="text-xs text-gray-500 mt-2">
          {t('characterImport.urlHint')}
        </p>
      </div>

      {/* File Drop Zone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
          transition-all duration-200
          ${isDragActive 
            ? 'border-parlor-500 bg-parlor-500/10' 
            : 'border-glass-border hover:border-parlor-400/50 bg-glass-white/30'}
          ${isImporting ? 'pointer-events-none opacity-50' : ''}
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-4">
          {isImporting ? (
            <>
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-parlor-500" />
              <p className="text-lg font-medium text-white">
                {importProgress ?? 'Importing…'}
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-dark-200 flex items-center justify-center">
                <Upload className="w-8 h-8 text-parlor-400" />
              </div>
              <div>
                <p className="text-lg font-medium text-white">
                  {isDragActive ? t('characterImport.dropActive') : t('characterImport.dragDrop')}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  {t('characterImport.orClick')}
                </p>
              </div>
              <div className="flex gap-4 mt-4">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Image className="w-4 h-4" />
                  {t('characterImport.pngCards')}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <FileJson className="w-4 h-4" />
                  {t('characterImport.jsonFiles')}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Results */}
      <AnimatePresence>
        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mt-6"
          >
            {/* Summary */}
            <div className="flex items-center gap-4 mb-4">
              <h2 className="text-lg font-semibold text-white font-serif tracking-tight">{t('characterImport.importResults')}</h2>
              <div className="flex gap-3 text-sm">
                {successCount > 0 && (
                  <span className="flex items-center gap-1 text-green-400">
                    <CheckCircle className="w-4 h-4" />
                    {t('characterImport.imported', { count: successCount })}
                  </span>
                )}
                {failCount > 0 && (
                  <span className="flex items-center gap-1 text-red-400">
                    <AlertCircle className="w-4 h-4" />
                    {t('characterImport.failed', { count: failCount })}
                  </span>
                )}
              </div>
            </div>

            {/* Result List */}
            <div className="space-y-2">
              {results.map((result, index) => (
                <motion.div
                  key={`${result.filename}-${index}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`
                    glass-sm p-4 flex items-center gap-4
                    ${result.success ? '' : 'border-red-500/30'}
                  `}
                >
                  {result.success ? (
                    <>
                      <Avatar
                        src={result.character?.avatar}
                        name={result.character?.name || 'Character'}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white">
                          {result.character?.name}
                        </p>
                        <p className="text-sm text-gray-400">
                          {result.filename}
                        </p>
                        {/* AI 拆解按钮/结果 */}
                        {result.character && activeConn && (
                          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                            {!splitResults[result.character.id] ? (
                              <button
                                onClick={() => handleSplitCharacter(result.character!)}
                                disabled={splittingId === result.character.id}
                                className="flex items-center gap-1 text-xs text-parlor-500 hover:text-parlor-600 disabled:opacity-50 transition-colors"
                              >
                                {splittingId === result.character.id ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <Sparkles size={12} />
                                )}
                                <span>{splittingId === result.character.id ? 'AI 拆解中...' : 'AI 拆解群聊角色'}</span>
                              </button>
                            ) : splitResults[result.character.id].success ? (
                              <div className="text-xs">
                                <p className="text-green-500 font-medium flex items-center gap-1">
                                  <CheckCircle size={12} />
                                  <span>拆解完成</span>
                                </p>
                                {splitResults[result.character.id].data && (
                                  <div className="mt-1 text-gray-500 space-y-0.5">
                                    <p>共拆解 {splitResults[result.character.id].data!.characters.length} 个角色</p>
                                    {splitResults[result.character.id].data!.worldEntries.length > 0 && (
                                      <p>{splitResults[result.character.id].data!.worldEntries.length} 个世界观条目</p>
                                    )}
                                    {splitResults[result.character.id].data!.isMultiCharacter && (
                                      <p className="text-parlor-500">已创建群聊「{splitResults[result.character.id].data!.groupName || result.character.name} - 角色群聊」</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-red-400 flex items-center gap-1">
                                <AlertCircle size={12} />
                                <span>拆解失败: {splitResults[result.character.id].error}</span>
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                        <AlertCircle className="w-6 h-6 text-red-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white">
                          {result.filename}
                        </p>
                        <p className="text-sm text-red-400">
                          {result.error}
                        </p>
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Actions */}
            {successCount > 0 && (
              <div className="flex gap-3 mt-6 justify-end">
                <Button variant="secondary" onClick={() => setResults([])}>
                  {t('characterImport.importMore')}
                </Button>
                <Button onClick={() => navigate('/characters')}>
                  {t('characterImport.viewCharacters', { count: successCount })}
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default CharacterImportPage;