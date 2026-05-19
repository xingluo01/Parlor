import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import {
  FileText, Upload, Loader2, CheckCircle, AlertCircle, X,
  BookOpen, User, Sparkles, Search, Download,
  Square, CheckSquare, BookMarked, ListTree, AlignLeft, Trash2,
} from 'lucide-react';
import { generateUUID } from '../utils/uuid';
import { connectionOps, characterOps, worldInfoOps, settingsOps } from '../db';
import { useCharacterStore } from '../stores';
import type { ConnectionProfile, WorldInfo, LorebookEntry, CharacterCard, NovelParseResult, CharacterRelation } from '../types';
import { SYSTEM_PROMPT, extractJSON } from '../utils/prompts';

// ===== 类型定义 =====

type Chapter = {
  index: number;
  title: string;
  startPos: number;
  endPos: number;
};

type Novel = {
  id: string;
  title: string;
  fileName: string;
  content: string;
  chapters: Chapter[];
  charCount: number;
  parsed: boolean;
  parseResult?: {
    worldEntryCount: number;
    characterCount: number;
  };
  parseData?: NovelParseResult;  // 完整的解析结果数据
  createdAt: number;
  updatedAt: number;
};

// ===== 章节检测 =====

function detectChapters(content: string): Chapter[] {
  // 支持多种章节格式
  const patterns = [
    /^第[一二三四五六七八九十百千万\d]+[章章节回\s]+[^\n]*/gm,     // "第一章 XXXX" / "第1章 XXXX"
    /^第\d+[章章节回][^\n]*/gm,                                      // "第1章XXXX"
    /^(?:Chapter|CHAPTER)\s+\d+[：:.\s][^\n]*/gm,                    // "Chapter 1: XXXX"
    /^(?:Chapter|CHAPTER)\s+\d+/gm,                                   // "Chapter 1"
    /^[卷部][一二三四五六七八九十百千万\d][^\n]*/gm,                  // "卷一 XXXX"
    /^[\[【][^\n]*[\]】][^\n]*/gm,                                   // "【第1章】"
  ];

  const matches: { index: number; title: string; pos: number }[] = [];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      // 去重：避免同一位置被多个模式匹配
      const isDuplicate = matches.some(m => Math.abs(m.pos - match!.index) < 3);
      if (!isDuplicate) {
        matches.push({
          index: matches.length,
          title: match[0].trim(),
          pos: match.index,
        });
      }
    }
  }

  // 按位置排序
  matches.sort((a, b) => a.pos - b.pos);

  if (matches.length === 0) {
    // 没有检测到章节，整个作为一个章节
    return [{ index: 0, title: '全文', startPos: 0, endPos: content.length }];
  }

  // 构建章节列表
  const chapters: Chapter[] = [];
  for (let i = 0; i < matches.length; i++) {
    chapters.push({
      index: i,
      title: matches[i].title,
      startPos: matches[i].pos,
      endPos: i < matches.length - 1 ? matches[i + 1].pos : content.length,
    });
  }

  return chapters;
}

// ===== AI 提示词和调用 =====

async function callAIForNovel(novelContent: string, connection: ConnectionProfile): Promise<string> {
  const { provider, apiKey, endpoint, model } = connection;
  const baseUrl = endpoint?.replace(/\/$/, '') || 'https://api.deepseek.com';
  const supportsJsonMode = provider === 'deepseek';
  const body: any = {
    model: model || 'deepseek-chat',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `请分析以下小说文本：\n\n${novelContent}` }
    ],
    temperature: 0.3,
    max_tokens: 8192,
  };
  if (supportsJsonMode) body.response_format = { type: 'json_object' };
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// ===== API 基础 =====

const API_BASE = '';

// ===== 主页面 =====

export default function NovelParserPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const contentRef = useRef<HTMLDivElement>(null);

  // 小说列表
  const [novels, setNovels] = useState<Novel[]>([]);
  const [selectedNovelId, setSelectedNovelId] = useState<string>('');
  const [view, setView] = useState<'grid' | 'detail'>('grid');
  const [loadingNovels, setLoadingNovels] = useState(true);

  // 当前选中的小说
  const selectedNovel = novels.find(n => n.id === selectedNovelId) || null;

  // ===== 选择小说（从网格进入详情） =====

  async function handleSelectNovel(id: string) {
    setView('detail');
    setSelectedNovelId(id);

    let novel = novels.find(n => n.id === id);

    // 如果 compact 加载没有 content，从服务端拉取完整数据
    if (novel && !novel.content) {
      try {
        const res = await fetch(`${API_BASE}/api/novels/${id}`);
        if (res.ok) {
          const fullNovel = await res.json();
          setNovels(prev => prev.map(n => n.id === id ? fullNovel : n));
          novel = fullNovel;
        }
      } catch (e) {
        console.debug('Failed to load novel content:', e);
      }
    }

    if (novel?.parsed && novel.parseData) {
      setParseResult(novel.parseData);
      setActiveTab('results');
      setSelectedWorldEntries(new Set(novel.parseData.worldEntries.map((_, i) => i)));
      setSelectedCharacters(new Set(novel.parseData.characters.map((_, i) => i)));
    } else if (novel?.parsed && !novel.parseData) {
      setActiveTab('results');
      setParseResult(null);
    } else {
      setActiveTab('chapters');
      setParseResult(null);
    }
  }

  // Tab
  const [activeTab, setActiveTab] = useState<'chapters' | 'content' | 'results'>('chapters');

  // 选中的章节
  const [selectedChapter, setSelectedChapter] = useState<number>(0);

  // AI 连接
  const [activeConn, setActiveConn] = useState<ConnectionProfile | null>(null);
  const [_loadingConn, setLoadingConn] = useState(true);

  // 解析状态
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [parseResult, setParseResult] = useState<NovelParseResult | null>(null);
  const [error, setError] = useState('');

  // 选中导入
  const [selectedWorldEntries, setSelectedWorldEntries] = useState<Set<number>>(new Set());
  const [selectedCharacters, setSelectedCharacters] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ world: number; chars: number } | null>(null);
  const [autoImportResult, setAutoImportResult] = useState<{ worldEntryCount: number; characterCount: number } | null>(null);

  // 追加解析
  const [showAppendPanel, setShowAppendPanel] = useState(false);
  const [appendInput, setAppendInput] = useState('');
  const [appending, setAppending] = useState(false);

  // 解析策略
  const [parseStrategy, setParseStrategy] = useState<'auto' | 'chapters' | 'wordCount' | 'percentage'>('auto');
  const [concurrency, setConcurrency] = useState(3);
  const [segmentWordCount, setSegmentWordCount] = useState(5000);
  const [segmentPercentage, setSegmentPercentage] = useState(25);
  const [parseProgress, setParseProgress] = useState({ current: 0, total: 0 });

  // 分组选择
  const [existingBooks, setExistingBooks] = useState<WorldInfo[]>([]);
  const [groupMode, setGroupMode] = useState<'new' | 'existing'>('new');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [newGroupName, setNewGroupName] = useState('');

  // 文件上传
  const [uploading, setUploading] = useState(false);

  // ===== 持久化解析策略配置 =====

  async function persistParseConfig() {
    try {
      const settings = await settingsOps.get();
      if (!settings) return;
      const currentSettings = settings as any;
      currentSettings.novelParser = {
        strategy: parseStrategy,
        concurrency,
        segmentWordCount,
        segmentPercentage,
      };
      await settingsOps.update(currentSettings);
    } catch (e) {
      console.debug('Failed to persist parse config:', e);
    }
  }

  // ===== 加载数据 =====

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/novels?compact=true`).then(r => r.json()).catch(() => []),
      connectionOps.getActive().catch(() => null),
      worldInfoOps.getAll().catch(() => []),
      settingsOps.get().catch(() => undefined),
    ]).then(([novelsData, conn, books, settings]) => {
      if (Array.isArray(novelsData)) setNovels(novelsData);
      setActiveConn(conn || null);
      if (Array.isArray(books)) setExistingBooks(books);

      // 加载持久化的解析策略配置
      if (settings) {
        const config = (settings as any).novelParser;
        if (config) {
          if (config.strategy) setParseStrategy(config.strategy);
          if (config.concurrency) setConcurrency(config.concurrency);
          if (config.segmentWordCount) setSegmentWordCount(config.segmentWordCount);
          if (config.segmentPercentage) setSegmentPercentage(config.segmentPercentage);
        }
      }
    }).finally(() => {
      setLoadingNovels(false);
      setLoadingConn(false);
    });
  }, []);

  // ===== 配置变化自动持久化 =====

  useEffect(() => {
    if (!loadingNovels) {
      persistParseConfig();
    }
  }, [parseStrategy, concurrency, segmentWordCount, segmentPercentage, loadingNovels]);

  // ===== 文件上传 =====

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const f = acceptedFiles[0];
    if (!f || !f.name.endsWith('.txt')) {
      setError('仅支持 .txt 格式文件');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const text = await f.text();
      const chapters = detectChapters(text);
      
      const novel: Novel = {
        id: generateUUID(),
        title: f.name.replace(/\.txt$/i, ''),
        fileName: f.name,
        content: text,
        chapters,
        charCount: text.length,
        parsed: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // 保存到后端
      const res = await fetch(`${API_BASE}/api/novels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novel),
      });

      if (res.ok) {
        const saved = await res.json();
        setNovels(prev => [...prev, saved]);
        setSelectedNovelId(saved.id);
        setActiveTab('chapters');
        setParseResult(null);
        setImportResult(null);
        setView('detail');
      } else {
        throw new Error('保存失败');
      }
    } catch (e: any) {
      setError(e.message || '上传失败');
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/plain': ['.txt'] },
    maxFiles: 1,
    multiple: false,
  });

  // ===== 删除小说 =====

  async function handleDeleteNovel(id: string) {
    if (!confirm('确定删除此小说？关联的解析结果不会被删除。')) return;
    try {
      await fetch(`${API_BASE}/api/novels/${id}`, { method: 'DELETE' });
      setNovels(prev => prev.filter(n => n.id !== id));
      if (selectedNovelId === id) {
        const nextId = novels.find(n => n.id !== id)?.id || '';
        if (nextId) {
          handleSelectNovel(nextId);
        } else {
          setSelectedNovelId('');
          setParseResult(null);
          setImportResult(null);
        }
      }
    } catch (e: any) {
      setError('删除失败');
    }
  }

  // ===== NovelCard 卡片组件 =====

  function NovelCard({ novel, onClick }: { novel: Novel; onClick: () => void }) {
    return (
      <div className="character-card group cursor-pointer" onClick={onClick}>
        {/* Hover 操作按钮 */}
        <div className="absolute top-2 right-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex gap-1 z-10">
          <button
            onClick={(e) => { e.stopPropagation(); handleAnalyze(); }}
            className="p-1.5 rounded-lg bg-dark-200/90 hover:bg-dark-100 text-gray-500 hover:text-white transition-colors"
            title="AI 解析"
          >
            <Sparkles size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDeleteNovel(novel.id); }}
            className="p-1.5 rounded-lg bg-dark-200/90 hover:bg-red-500/15 text-gray-500 hover:text-red-400 transition-colors"
            title="删除"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* 卡片主体 */}
        <div className="flex flex-col items-center text-center">
          {/* 封面占位：首字母渐变圆 */}
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-parlor-500 to-parlor-700 flex items-center justify-center text-2xl font-bold text-white mb-3 shadow-lg">
            {novel.title.charAt(0)}
          </div>
          <h3 className="font-medium text-white truncate w-full text-sm">{novel.title}</h3>
          <p className="text-xs text-gray-400 mt-1">
            {novel.chapters.length} 章 · {(novel.charCount / 10000).toFixed(1)} 万字
          </p>
          {novel.parsed && (
            <span className="text-xs text-green-400 mt-1 flex items-center gap-1">
              <CheckCircle size={10} /> 已解析
            </span>
          )}
        </div>
      </div>
    );
  }

  // ===== AI 解析 =====

  async function handleAnalyze() {
    if (!selectedNovel || !activeConn) return;
    if (!selectedNovel.content) { setError('小说内容尚未加载，请稍后重试'); return; }
    setIsAnalyzing(true);
    setError('');
    setParseResult(null);
    setImportResult(null);
    setAutoImportResult(null);
    setParseProgress({ current: 0, total: 0 });

    try {
      const isLong = selectedNovel.content.length > 30000;
      const strategy = parseStrategy === 'auto' && !isLong ? 'auto' : parseStrategy;

      let resultData: NovelParseResult | null = null;

      if (!isLong || strategy === 'auto') {
        // 短小说：直接全量分析
        const content = selectedNovel.content;
        const raw = await callAIForNovel(content, activeConn);
        const parsed = extractJSON(raw) as NovelParseResult;
        if (!parsed.worldEntries || !parsed.characters) throw new Error('AI 返回格式不正确');
        resultData = parsed;
      } else {
        // 长小说：分段并发分析
        const { segments } = splitIntoSegments(selectedNovel, strategy);
        setParseProgress({ current: 0, total: segments.length });

        const allResults: NovelParseResult[] = [];

        for (let i = 0; i < segments.length; i += concurrency) {
          const batch = segments.slice(i, i + concurrency);
          const batchResults = await Promise.all(
            batch.map(async (content) => {
              try {
                const raw = await callAIForNovel(content, activeConn);
                return extractJSON(raw) as NovelParseResult;
              } catch (e: any) {
                console.error('Segment analysis failed:', e);
                return { title: '', worldEntries: [], characters: [] } as NovelParseResult;
              }
            })
          );
          allResults.push(...batchResults);
          setParseProgress({ current: Math.min(i + concurrency, segments.length), total: segments.length });
        }

        // 合并结果
        const merged = mergeResults(allResults);
        if (merged.worldEntries.length === 0 && merged.characters.length === 0) {
          throw new Error('所有分段均未能提取到有效内容');
        }
        resultData = merged;
      }

      if (resultData) {
        setParseResult(resultData);
        setSelectedWorldEntries(new Set(resultData.worldEntries.map((_, i) => i)));
        setSelectedCharacters(new Set(resultData.characters.map((_, i) => i)));

        // 将完整解析结果保存到后端
        try {
          await fetch(`${API_BASE}/api/novels/${selectedNovel.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              parsed: true,
              parseResult: {
                worldEntryCount: resultData.worldEntries.length,
                characterCount: resultData.characters.length,
              },
              parseData: resultData,
            }),
          });
          setNovels(prev => prev.map(n =>
            n.id === selectedNovel.id
              ? {
                  ...n,
                  parsed: true,
                  parseResult: {
                    worldEntryCount: resultData.worldEntries.length,
                    characterCount: resultData.characters.length,
                  },
                  parseData: resultData,
                }
              : n
          ));
        } catch (e) {
          console.debug('Failed to persist parse result:', e);
        }

        // ---- 自动导入角色和世界观（含同名合并） ----
        try {
          const novelTitle = resultData.title || selectedNovel.title;

          // 1. 创建/合并世界书分组
          const loreEntries: LorebookEntry[] = resultData.worldEntries.map((entry, idx) => ({
            id: generateUUID(),
            keywords: entry.keywords?.length ? entry.keywords : [entry.name],
            content: entry.content,
            enabled: true,
            insertionOrder: idx,
          }));

          const { worldInfoId: targetWorldInfoId, isNew: isNewBook } = await findAndMergeWorldBook(
            `${novelTitle}世界观`,
            loreEntries
          );

          if (isNewBook) {
            const worldInfo: WorldInfo = {
              id: targetWorldInfoId,
              name: `${novelTitle}世界观`,
              enabled: true,
              entries: loreEntries,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            await worldInfoOps.add(worldInfo);
            setExistingBooks(prev => [...prev, worldInfo]);
          }

          // 2. 第一阶段：创建/合并所有角色（带 worldInfoId + 小说标签）
          const characterIdMap = new Map<string, string>();
          const allExistingChars = await characterOps.getAll();

          for (const char of resultData.characters) {
            const existingChar = allExistingChars.find(c => c.name === char.name);

            if (existingChar) {
              // 同名角色已存在 → 合并字段
              characterIdMap.set(char.name, existingChar.id);

              const merged = mergeCharacterData(existingChar, char as any, novelTitle);
              // 如果现有角色没有关联分组，用新/合并后的分组
              if (!existingChar.worldInfoId) {
                merged.worldInfoId = targetWorldInfoId;
              }

              await characterOps.update(existingChar.id, merged);
              useCharacterStore.getState().updateCharacter(existingChar.id, merged);
            } else {
              // 创建新角色
              const charId = generateUUID();
              characterIdMap.set(char.name, charId);

              const tags = [...(char.tags || [])];
              if (!tags.includes(novelTitle)) tags.push(novelTitle);

              const card: CharacterCard = {
                id: charId,
                name: char.name,
                description: char.description || '',
                personality: char.personality || '',
                scenario: char.scenario || '',
                firstMessage: char.firstMessage || `*${char.name}出现了*`,
                tags,
                worldInfoId: targetWorldInfoId,
                age: char.age,
                gender: char.gender,
                race: char.race,
                occupation: char.occupation,
                height: char.height,
                appearance: char.appearance,
                hairStyle: char.hairStyle,
                eyeColor: char.eyeColor,
                clothing: char.clothing,
                bodyFeatures: char.bodyFeatures,
                personalityTraits: char.personalityTraits,
                mbti: char.mbti,
                likes: char.likes,
                dislikes: char.dislikes,
                habits: char.habits,
                background: char.background,
                keyEvents: char.keyEvents,
                abilities: char.abilities,
                speechStyle: char.speechStyle,
                catchphrases: char.catchphrases,
                intimateDetails: char.intimateDetails,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              };
              await characterOps.add(card);
              useCharacterStore.getState().addCharacter(card);
            }
          }

          // 3. 第二阶段：填充角色关系（合并模式下保留现有 relations 并去重）
          for (const char of resultData.characters) {
            if (!char.relations?.length) continue;
            const charId = characterIdMap.get(char.name);
            if (!charId) continue;

            const existingCard = await characterOps.getById(charId);
            if (!existingCard) continue;

            const existingRelations = existingCard.relations || [];
            const existingRelKeys = new Set(existingRelations.map(r => `${r.targetId}-${r.relationType}`));
            const mergedRelations: CharacterRelation[] = [...existingRelations];

            for (const rel of char.relations) {
              const targetId = characterIdMap.get(rel.targetName);
              if (!targetId) continue;
              const relKey = `${targetId}-${rel.relationType}`;
              if (!existingRelKeys.has(relKey)) {
                mergedRelations.push({
                  id: generateUUID(),
                  targetId,
                  relationType: rel.relationType,
                  summary: rel.summary,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                });
                existingRelKeys.add(relKey);
              }
            }

            if (mergedRelations.length > existingRelations.length) {
              await characterOps.update(charId, { relations: mergedRelations });
              useCharacterStore.getState().updateCharacter(charId, { relations: mergedRelations });
            }
          }

          // 保存导入结果供 UI 展示
          setAutoImportResult({
            worldEntryCount: loreEntries.length,
            characterCount: resultData.characters.length,
          });
        } catch (e: any) {
          console.debug('Auto import failed:', e);
          setError(`自动导入失败: ${e.message}，但解析结果已保存`);
        }
      }

      setActiveTab('results');
    } catch (e: any) {
      setError(e.message || '分析失败');
    } finally {
      setIsAnalyzing(false);
      setParseProgress({ current: 0, total: 0 });
    }
  }

  // ===== 导入 =====

  async function handleImport() {
    if (!parseResult) return;
    setImporting(true);
    setError('');

    let worldCount = 0;
    let charCount = 0;

    try {
      let createdBookId: string | undefined;
      if (selectedWorldEntries.size > 0) {
        const entriesToImport: LorebookEntry[] = [...selectedWorldEntries].map(idx => ({
          id: generateUUID(),
          keywords: parseResult.worldEntries[idx].keywords || [parseResult.worldEntries[idx].name],
          content: parseResult.worldEntries[idx].content,
          enabled: true,
          insertionOrder: idx,
        }));

        if (groupMode === 'new') {
          const bookName = newGroupName.trim() || `${parseResult.title || selectedNovel?.title || '小说'}世界观`;
          const { worldInfoId: foundId, isNew } = await findAndMergeWorldBook(bookName, entriesToImport);
          createdBookId = foundId;

          if (isNew) {
            const book: WorldInfo = {
              id: foundId,
              name: bookName,
              enabled: true,
              entries: entriesToImport,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            await worldInfoOps.add(book);
            setExistingBooks(prev => [...prev, book]);
          }
          worldCount = entriesToImport.length;
        } else if (groupMode === 'existing' && selectedGroupId) {
          const book = existingBooks.find(b => b.id === selectedGroupId);
          if (book) {
            await worldInfoOps.update(selectedGroupId, { entries: [...book.entries, ...entriesToImport] });
            worldCount = entriesToImport.length;
          }
        }
      }

      // Phase 1: 创建/合并所有选中角色（建立 name→id 映射，不含 relations）
      const characterIdMap = new Map<string, string>();
      const allExistingChars = await characterOps.getAll();
      const novelTitle = selectedNovel?.title || '';

      for (const idx of selectedCharacters) {
        const char = parseResult.characters[idx];
        const existingChar = allExistingChars.find(c => c.name === char.name);

        if (existingChar) {
          // 同名角色已存在 → 合并字段
          characterIdMap.set(char.name, existingChar.id);

          const merged = mergeCharacterData(existingChar, char as any, novelTitle);
          // 关联分组
          if (groupMode === 'new' && createdBookId) {
            merged.worldInfoId = createdBookId;
          } else if (groupMode === 'existing' && selectedGroupId && !existingChar.worldInfoId) {
            merged.worldInfoId = selectedGroupId;
          }

          await characterOps.update(existingChar.id, merged);
          useCharacterStore.getState().updateCharacter(existingChar.id, merged);
          charCount++;
        } else {
          // 创建新角色
          const charId = generateUUID();
          characterIdMap.set(char.name, charId);

          const tags = [...(char.tags || [])];
          if (novelTitle && !tags.includes(novelTitle)) tags.push(novelTitle);

          const card: CharacterCard = {
            id: charId,
            name: char.name,
            description: char.description || '',
            personality: char.personality || '',
            scenario: char.scenario || '',
            firstMessage: char.firstMessage || `*${char.name}出现了*`,
            tags,
            worldInfoId: groupMode === 'new' ? createdBookId : (groupMode === 'existing' ? selectedGroupId || undefined : undefined),
            age: char.age,
            gender: char.gender,
            race: char.race,
            occupation: char.occupation,
            height: char.height,
            appearance: char.appearance,
            hairStyle: char.hairStyle,
            eyeColor: char.eyeColor,
            clothing: char.clothing,
            bodyFeatures: char.bodyFeatures,
            personalityTraits: char.personalityTraits,
            mbti: char.mbti,
            likes: char.likes,
            dislikes: char.dislikes,
            habits: char.habits,
            background: char.background,
            keyEvents: char.keyEvents,
            abilities: char.abilities,
            speechStyle: char.speechStyle,
            catchphrases: char.catchphrases,
            intimateDetails: char.intimateDetails,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          await characterOps.add(card);
          useCharacterStore.getState().addCharacter(card);
          charCount++;
        }
      }

      // Phase 2: 再批量处理 relations（所有角色 ID 已就绪，合并去重）
      for (const idx of selectedCharacters) {
        const char = parseResult.characters[idx];
        if (!char.relations?.length) continue;
        const charId = characterIdMap.get(char.name);
        if (!charId) continue;
        const currentCard = await characterOps.getById(charId);
        if (!currentCard) continue;

        const existingRelations = currentCard.relations || [];
        const existingRelKeys = new Set(existingRelations.map(r => `${r.targetId}-${r.relationType}`));
        const mergedRelations: CharacterRelation[] = [...existingRelations];

        for (const rel of char.relations) {
          const targetId = characterIdMap.get(rel.targetName);
          if (!targetId) {
            console.debug(`[handleImport] 未找到关联角色「${rel.targetName}」，跳过关系`);
            continue;
          }
          const relKey = `${targetId}-${rel.relationType}`;
          if (!existingRelKeys.has(relKey)) {
            mergedRelations.push({
              id: generateUUID(),
              targetId,
              relationType: rel.relationType,
              customType: rel.customType,
              summary: rel.summary,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
            existingRelKeys.add(relKey);
          }
        }
        if (mergedRelations.length > existingRelations.length) {
          await characterOps.update(charId, { ...currentCard, relations: mergedRelations });
          useCharacterStore.getState().updateCharacter(charId, { relations: mergedRelations });
        }
      }

      setImportResult({ world: worldCount, chars: charCount });
    } catch (e: any) {
      setError(`导入失败: ${e.message}`);
    } finally {
      setImporting(false);
    }
  }

  // ===== 追加解析 =====

  function parseAppendInput(input: string): { name: string; aliases: string[] }[] {
    const parts = input.split(/[，,]\s*/).filter(Boolean);
    return parts.map(part => {
      const match = part.match(/^(.+?)\{(.+?)\}$/);
      if (match) {
        const name = match[1].trim();
        const aliases = match[2].split(/[，,]/).map(a => a.trim()).filter(Boolean);
        return { name, aliases };
      }
      return { name: part.trim(), aliases: [] };
    });
  }

  async function handleAppendAnalyze() {
    if (!selectedNovel || !activeConn) return;
    if (!selectedNovel.content) { setError('小说内容尚未加载，请稍后重试'); return; }

    const targets = parseAppendInput(appendInput);
    if (targets.length === 0) {
      setError('请输入至少一个角色名');
      return;
    }

    setAppending(true);
    setError('');

    try {
      const targetNames = targets.map(t => t.name + (t.aliases.length > 0 ? `(别名: ${t.aliases.join('、')})` : '')).join('、');
      const prompt = `你是一个专业的角色分析专家。请分析小说"${selectedNovel.title}"中的以下角色，提供每个角色的详细信息。

需要分析的角色：${targetNames}

小说全文内容：
${selectedNovel.content.slice(0, 100000)}

请为每个角色严格按照以下 JSON 格式输出，不要包含其他内容（纯 JSON，不要 markdown 代码块）：

{
  "characters": [
    {
      "name": "角色名",
      "aliases": ["别名1", "别名2"],
      "description": "角色详细描述，包括外貌、身份背景、能力特长、与其他角色的关系等（100-300字）",
      "personality": "角色性格特征的多维度描述（50-150字）",
      "firstMessage": "至少30字的第一句话，包含*号包裹的动作描写和人物对话，要高度符合角色性格",
      "scenario": "角色在故事中出现的典型场景描述",
      "tags": ["标签1", "标签2", "标签3"],
      "age": "年龄",
      "gender": "性别",
      "race": "种族",
      "occupation": "职业",
      "height": "身高",
      "appearance": "整体外貌描述",
      "hairStyle": "发型",
      "eyeColor": "瞳色",
      "clothing": "服饰风格",
      "bodyFeatures": "身体特征",
      "personalityTraits": ["勇敢", "执着"],
      "mbti": "MBTI类型",
      "likes": ["喜好1"],
      "dislikes": ["厌恶1"],
      "habits": ["习惯1"],
      "background": "详细背景故事",
      "keyEvents": "关键事件",
      "abilities": "能力描述",
      "speechStyle": "说话风格",
      "catchphrases": ["口头禅1"],
      "intimateDetails": "隐秘特征"
    }
  ]
}

要求：
1. 如果角色在小说中有别名、绰号、化名等，请在 aliases 数组中列出
2. 只分析指定的角色，不要添加其他角色
3. 如果某个角色在小说中找不到相关信息，请在 description 中注明"小说中未找到该角色的详细信息"
4. 尽可能提取每个角色的详细字段信息，如果小说中没有提供，可以省略`;

      // 直接使用 fetch 调用 AI API（callAIForNovel 不支持自定义 prompt）
      const { provider, apiKey, endpoint, model } = activeConn;
      const baseUrl = endpoint?.replace(/\/$/, '') || 'https://api.deepseek.com';
      const supportsJsonMode = provider === 'deepseek';
      let raw = '';
      const body: any = {
        model: model || 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 8192,
      };
      if (supportsJsonMode) body.response_format = { type: 'json_object' };
      const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      raw = data.choices?.[0]?.message?.content || '';

      const parsed = extractJSON(raw) as { characters: any[] };

      if (!parsed.characters || !Array.isArray(parsed.characters)) {
        throw new Error('AI 返回格式不正确');
      }

      // 处理每个角色
      for (const target of targets) {
        const charData = parsed.characters.find((c: any) => c.name === target.name);
        if (!charData) {
          console.debug(`[AppendAnalyze] AI 未返回角色「${target.name}」的信息`);
          continue;
        }

        // 查找是否已存在同名角色
        const allChars = useCharacterStore.getState().characters;
        const existingChar = allChars.find(c => c.name === target.name);

        const novelTitle = selectedNovel.title;
        const tags = [...(charData.tags || [])];
        if (novelTitle && !tags.includes(novelTitle)) tags.push(novelTitle);
        // 合并别名到 tags
        for (const alias of [...target.aliases, ...(charData.aliases || [])]) {
          if (!tags.includes(alias)) tags.push(alias);
        }

        if (existingChar) {
          // 更新已有角色
          const updated: Partial<CharacterCard> = {
            description: charData.description || existingChar.description,
            personality: charData.personality || existingChar.personality,
            scenario: charData.scenario || existingChar.scenario,
            firstMessage: charData.firstMessage || existingChar.firstMessage,
            tags,
            age: charData.age,
            gender: charData.gender,
            race: charData.race,
            occupation: charData.occupation,
            height: charData.height,
            appearance: charData.appearance,
            hairStyle: charData.hairStyle,
            eyeColor: charData.eyeColor,
            clothing: charData.clothing,
            bodyFeatures: charData.bodyFeatures,
            personalityTraits: charData.personalityTraits,
            mbti: charData.mbti,
            likes: charData.likes,
            dislikes: charData.dislikes,
            habits: charData.habits,
            background: charData.background,
            keyEvents: charData.keyEvents,
            abilities: charData.abilities,
            speechStyle: charData.speechStyle,
            catchphrases: charData.catchphrases,
            intimateDetails: charData.intimateDetails,
          };
          await characterOps.update(existingChar.id, updated);
          useCharacterStore.getState().updateCharacter(existingChar.id, updated);
        } else {
          // 创建新角色（关联到世界书）
          const card: CharacterCard = {
            id: generateUUID(),
            name: target.name,
            description: charData.description || '',
            personality: charData.personality || '',
            scenario: charData.scenario || '',
            firstMessage: charData.firstMessage || `*${target.name}出现了*`,
            tags,
            worldInfoId: selectedNovel ? undefined : undefined,
            age: charData.age,
            gender: charData.gender,
            race: charData.race,
            occupation: charData.occupation,
            height: charData.height,
            appearance: charData.appearance,
            hairStyle: charData.hairStyle,
            eyeColor: charData.eyeColor,
            clothing: charData.clothing,
            bodyFeatures: charData.bodyFeatures,
            personalityTraits: charData.personalityTraits,
            mbti: charData.mbti,
            likes: charData.likes,
            dislikes: charData.dislikes,
            habits: charData.habits,
            background: charData.background,
            keyEvents: charData.keyEvents,
            abilities: charData.abilities,
            speechStyle: charData.speechStyle,
            catchphrases: charData.catchphrases,
            intimateDetails: charData.intimateDetails,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          await characterOps.add(card);
          useCharacterStore.getState().addCharacter(card);
        }
      }

      setError('');
      setAppendInput('');
      setShowAppendPanel(false);
      // 提示成功
      setImportResult({ world: 0, chars: targets.length });
    } catch (e: any) {
      setError(`追加解析失败: ${e.message}`);
    } finally {
      setAppending(false);
    }
  }

  // ===== 选中切换 =====

  function toggleWorldEntry(idx: number) {
    setSelectedWorldEntries(prev => { const n = new Set(prev); if (n.has(idx)) n.delete(idx); else n.add(idx); return n; });
  }
  function toggleCharacter(idx: number) {
    setSelectedCharacters(prev => { const n = new Set(prev); if (n.has(idx)) n.delete(idx); else n.add(idx); return n; });
  }

  // ===== 分段策略 =====

  function splitIntoSegments(novel: Novel, strategy: string): { segments: string[]; labels: string[] } {
    const content = novel.content;

    if (strategy === 'chapters' && novel.chapters.length > 1) {
      const chaptersPerSegment = Math.max(1, Math.floor(novel.chapters.length / 10));
      const segments: string[] = [];
      const labels: string[] = [];

      for (let i = 0; i < novel.chapters.length; i += chaptersPerSegment) {
        const end = Math.min(i + chaptersPerSegment, novel.chapters.length);
        const segContent = novel.chapters.slice(i, end).map(ch => content.slice(ch.startPos, ch.endPos)).join('\n\n');
        segments.push(segContent);
        labels.push(`${novel.chapters[i].title}${end - i > 1 ? ` ~ ${novel.chapters[end - 1].title}` : ''}`);
      }
      return { segments, labels };
    }

    if (strategy === 'wordCount') {
      const size = segmentWordCount;
      const segments: string[] = [];
      const labels: string[] = [];
      let pos = 0;
      let idx = 0;
      while (pos < content.length) {
        const end = Math.min(pos + size, content.length);
        segments.push(content.slice(pos, end));
        labels.push(`第 ${idx + 1} 段（${pos.toLocaleString()}-${end.toLocaleString()} 字）`);
        pos = end;
        idx++;
      }
      return { segments, labels };
    }

    if (strategy === 'percentage') {
      const parts = Math.max(2, Math.floor(100 / segmentPercentage));
      const segSize = Math.floor(content.length / parts);
      const segments: string[] = [];
      const labels: string[] = [];
      for (let i = 0; i < parts; i++) {
        const start = i * segSize;
        const end = i === parts - 1 ? content.length : (i + 1) * segSize;
        segments.push(content.slice(start, end));
        labels.push(`${Math.round((start / content.length) * 100)}%-${Math.round((end / content.length) * 100)}%`);
      }
      return { segments, labels };
    }

    // auto/fallback：如果小说较短直接全量，否则按章节
    if (content.length <= 30000) {
      return { segments: [content], labels: ['全文'] };
    }
    // 章节数不足时按字数分段（避免 chapters.length ≤ 1 时无限递归）
    if (novel.chapters.length <= 1) {
      return splitIntoSegments(novel, 'wordCount');
    }
    return splitIntoSegments(novel, 'chapters');
  }

  function mergeResults(results: NovelParseResult[]): NovelParseResult {
    const seenEntryNames = new Set<string>();
    const seenCharNames = new Set<string>();
    const worldEntries: NovelParseResult['worldEntries'] = [];
    const characters: NovelParseResult['characters'] = [];

    for (const result of results) {
      if (!result) continue;
      for (const entry of result.worldEntries || []) {
        if (!seenEntryNames.has(entry.name)) {
          seenEntryNames.add(entry.name);
          worldEntries.push(entry);
        }
      }
      for (const char of result.characters || []) {
        if (!seenCharNames.has(char.name)) {
          seenCharNames.add(char.name);
          characters.push(char);
        }
      }
    }

    return { title: results[0]?.title || '', worldEntries, characters };
  }

  // ===== 同名合并辅助函数 =====

  const CHAR_MERGE_FIELDS: (keyof CharacterCard)[] = [
    'description', 'personality', 'scenario', 'firstMessage', 'age', 'gender', 'race',
    'occupation', 'height', 'appearance', 'hairStyle', 'eyeColor', 'clothing', 'bodyFeatures',
    'personalityTraits', 'mbti', 'likes', 'dislikes', 'habits', 'background', 'keyEvents',
    'abilities', 'speechStyle', 'catchphrases', 'intimateDetails'
  ];

  /** 合并同名角色数据：新值非空则用新值覆盖，否则保留原值 */
  function mergeCharacterData(
    existingChar: CharacterCard,
    newChar: Partial<CharacterCard>,
    novelTitle: string
  ): Partial<CharacterCard> {
    const merged: Partial<CharacterCard> = {};

    for (const field of CHAR_MERGE_FIELDS) {
      const newVal = (newChar as any)[field];
      if (newVal !== undefined && newVal !== null && newVal !== '') {
        (merged as any)[field] = newVal;
      }
    }

    // tags 合并去重
    const mergedTags = [...(existingChar.tags || [])];
    for (const tag of (newChar.tags || [])) {
      if (!mergedTags.includes(tag)) mergedTags.push(tag);
    }
    if (novelTitle && !mergedTags.includes(novelTitle)) mergedTags.push(novelTitle);
    merged.tags = mergedTags;

    return merged;
  }

  /** 查找同名世界书分组，存在则合并 entries（按 keywords 去重），否则仅返回新 ID */
  async function findAndMergeWorldBook(
    bookName: string,
    loreEntries: LorebookEntry[]
  ): Promise<{ worldInfoId: string; isNew: boolean }> {
    const allBooks = await worldInfoOps.getAll();
    const existingBook = allBooks.find(b => b.name === bookName);

    if (existingBook) {
      const existingKeywords = new Set(existingBook.entries.map(e => e.keywords.join(',') || e.id));
      const newEntries = loreEntries.filter(e => !existingKeywords.has(e.keywords.join(',') || e.id));

      if (newEntries.length > 0) {
        const mergedEntries = [...existingBook.entries, ...newEntries];
        await worldInfoOps.update(existingBook.id, { entries: mergedEntries });
        setExistingBooks(prev => prev.map(b =>
          b.id === existingBook.id ? { ...b, entries: mergedEntries } : b
        ));
      }
      return { worldInfoId: existingBook.id, isNew: false };
    }

    return { worldInfoId: generateUUID(), isNew: true };
  }

  // ===== 自动导入逻辑已内联到 handleAnalyze 中 =====

  // ===== 获取当前显示的章节内容 =====

  const currentChapter = selectedNovel?.chapters[selectedChapter];
  const chapterContent = currentChapter && selectedNovel?.content
    ? selectedNovel.content.slice(currentChapter.startPos, currentChapter.endPos)
    : '';

  // ===== 渲染 =====

  const isConnected = !!activeConn;
  const connLabel = activeConn ? `${activeConn.provider.toUpperCase()}: ${activeConn.model}` : '未配置';

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* 标题 */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-parlor-500 to-parlor-600 rounded-lg flex items-center justify-center">
          <FileText size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t('nav.novelParser')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">上传小说 → 自动检测目录 → AI 解析为世界书和角色卡</p>
        </div>
      </div>

      {/* 错误信息 */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto p-1 hover:opacity-70"><X size={14} /></button>
        </div>
      )}

      {/* 导入结果 */}
      {importResult && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
          <CheckCircle size={16} />
          <span>导入完成！已添加 {importResult.world} 个世界书条目和 {importResult.chars} 个角色。</span>
          <button onClick={() => setImportResult(null)} className="ml-auto p-1 hover:opacity-70"><X size={14} /></button>
        </div>
      )}

      {/* 自动导入结果 */}
      {autoImportResult && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-600 dark:text-blue-400 flex items-center gap-2">
          <CheckCircle size={16} />
          <span>自动导入完成！已创建 {autoImportResult.worldEntryCount} 个世界书条目和 {autoImportResult.characterCount} 个角色。</span>
          <button onClick={() => setAutoImportResult(null)} className="ml-auto p-1 hover:opacity-70"><X size={14} /></button>
        </div>
      )}

      {/* ===== 视图一：卡片网格（默认） ===== */}
      {view === 'grid' ? (
        <div>
          {/* 工具栏 */}
          <div className="mb-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div className="flex items-center gap-2">
              <div {...getRootProps()} className="cursor-pointer">
                <input {...getInputProps()} />
                <span className="flex items-center gap-1.5 px-4 py-2 text-sm bg-parlor-500 text-white rounded-lg hover:bg-parlor-600 transition-colors">
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  <span>上传小说</span>
                </span>
              </div>

              {/* AI连接状态 */}
              <span className={`text-xs px-2 py-1 rounded ${isConnected ? 'bg-green-50 dark:bg-green-900/20 text-green-600' : 'bg-red-50 dark:bg-red-900/20 text-red-500'}`}>
                {isConnected ? connLabel : '未配置AI'}
              </span>

              {/* 小说数量 */}
              <span className="text-xs text-gray-400 ml-auto">
                共 {novels.length} 本小说
              </span>
            </div>
            {isDragActive && (
              <div className="mt-2 p-4 border-2 border-dashed border-parlor-500 rounded-lg text-center text-sm text-parlor-500 bg-parlor-50 dark:bg-parlor-900/20">
                松开以上传小说文件
              </div>
            )}
          </div>

          {/* 卡片网格 */}
          {loadingNovels ? (
            <div className="text-center py-20 text-gray-400">
              <Loader2 size={32} className="mx-auto mb-3 animate-spin" />
              <p className="text-sm">加载中...</p>
            </div>
          ) : novels.length === 0 ? (
            <div className="text-center py-20 text-gray-400 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <BookMarked size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">上传一本小说开始解析</p>
              <p className="text-xs mt-1">支持 .txt 格式，自动检测章节目录</p>
              <div {...getRootProps()} className="mt-4 inline-block cursor-pointer">
                <input {...getInputProps()} />
                <span className="flex items-center gap-2 px-6 py-3 bg-parlor-500 text-white rounded-lg hover:bg-parlor-600 transition-colors">
                  <Upload size={16} />
                  上传小说
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {novels.map(novel => (
                <NovelCard
                  key={novel.id}
                  novel={novel}
                  onClick={() => handleSelectNovel(novel.id)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ===== 视图二：详情界面 ===== */
        <>
          {/* 返回栏 */}
          <div className="mb-4 flex items-center gap-3">
            <button
              onClick={() => { setView('grid'); setSelectedNovelId(''); setParseResult(null); setImportResult(null); }}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              ← 返回
            </button>
            <span className="text-sm font-medium truncate">{selectedNovel?.title || ''}</span>
          </div>

          {/* 操作栏（无 select，只显示当前小说名 + 操作按钮） */}
          <div className="mb-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <BookMarked size={16} className="text-parlor-500 shrink-0" />
                <span className="font-medium text-sm truncate">{selectedNovel?.title}</span>
                {selectedNovel && (
                  <span className="text-xs text-gray-400">
                    ({selectedNovel.chapters.length} 章 · {(selectedNovel.charCount / 10000).toFixed(1)} 万字)
                  </span>
                )}
              </div>

              {/* 操作按钮 */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2 py-1 rounded ${isConnected ? 'bg-green-50 dark:bg-green-900/20 text-green-600' : 'bg-red-50 dark:bg-red-900/20 text-red-500'}`}>
                  {isConnected ? connLabel : '未配置AI'}
                </span>
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !isConnected}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-parlor-500 hover:bg-parlor-600 text-white rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  <span>{isAnalyzing ? '解析中...' : 'AI 解析'}</span>
                </button>
                <button
                  onClick={() => setShowAppendPanel(!showAppendPanel)}
                  disabled={!isConnected}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  <Search size={14} />
                  <span>追加解析</span>
                </button>
                <button
                  onClick={() => handleDeleteNovel(selectedNovel!.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  title="删除小说"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* 解析策略（仅长小说显示） */}
            {selectedNovel && (selectedNovel.content?.length ?? 0) > 20000 && (
              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-xs font-medium mb-2">分段解析策略（小说较长，建议分段）：</p>
                <div className="flex flex-wrap gap-2 mb-2">
                  {[
                    { value: 'chapters', label: '按章节并发', desc: `共 ${selectedNovel.chapters.length} 章` },
                    { value: 'wordCount', label: '按字数分段', desc: `每 ${(segmentWordCount / 1000).toFixed(0)}k 字` },
                    { value: 'percentage', label: '按百分比分段', desc: `每 ${segmentPercentage}%` },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setParseStrategy(opt.value as any)}
                      className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                        parseStrategy === opt.value
                          ? 'bg-parlor-500 text-white'
                          : 'bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {opt.label}
                      <span className="ml-1 opacity-70">({opt.desc})</span>
                    </button>
                  ))}
                </div>

                {/* 并发数 */}
                <div className="flex items-center gap-2 text-xs">
                  <span>并发数：</span>
                  {[1, 2, 3, 5, 10].map(n => (
                    <button
                      key={n}
                      onClick={() => setConcurrency(n)}
                      className={`px-2 py-0.5 rounded ${
                        concurrency === n
                          ? 'bg-parlor-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>

                {/* 字数/百分比参数输入 */}
                <div className="flex items-center gap-3 text-xs mt-2">
                  {parseStrategy === 'wordCount' && (
                    <label className="flex items-center gap-1">
                      <span>每段字数：</span>
                      <input
                        type="number"
                        min={1000}
                        max={50000}
                        step={1000}
                        value={segmentWordCount}
                        onChange={e => setSegmentWordCount(Math.max(1000, Number(e.target.value)))}
                        className="w-20 px-1.5 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-xs"
                      />
                    </label>
                  )}
                  {parseStrategy === 'percentage' && (
                    <label className="flex items-center gap-1">
                      <span>每段百分比：</span>
                      <input
                        type="number"
                        min={5}
                        max={50}
                        step={5}
                        value={segmentPercentage}
                        onChange={e => setSegmentPercentage(Math.max(5, Math.min(50, Number(e.target.value))))}
                        className="w-16 px-1.5 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-xs"
                      />
                    </label>
                  )}
                </div>

                {/* 详细分段信息 */}
                {(() => {
                  if (!selectedNovel || isAnalyzing) return null;
                  const { segments } = splitIntoSegments(selectedNovel, parseStrategy);
                  return (
                    <p className="text-xs text-gray-400 mt-2">
                      共 {(selectedNovel.content?.length ?? 0).toLocaleString()} 字 · 分 {segments.length} 段 · 
                      分 {Math.ceil(segments.length / concurrency)} 批执行 · 每批 {concurrency} 段并发
                    </p>
                  );
                })()}
              </div>
            )}

            {/* 解析进度 */}
            {isAnalyzing && parseProgress.total > 0 && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>解析进度：{parseProgress.current}/{parseProgress.total} 段</span>
                  <span>{Math.round((parseProgress.current / parseProgress.total) * 100)}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-parlor-500 rounded-full transition-all duration-300"
                    style={{ width: `${(parseProgress.current / parseProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* 追加解析面板 */}
            {showAppendPanel && (
              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-xs font-medium mb-2">追加解析角色：</p>
                <div className="flex gap-2 flex-col sm:flex-row">
                  <input
                    value={appendInput}
                    onChange={e => setAppendInput(e.target.value)}
                    placeholder="唐三{小三，三哥}，小舞，比比东"
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                    disabled={appending}
                  />
                  <button
                    onClick={handleAppendAnalyze}
                    disabled={appending || !appendInput.trim() || !isConnected}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm bg-parlor-500 text-white rounded-lg hover:bg-parlor-600 disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    {appending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    <span>{appending ? '追加中...' : '开始追加'}</span>
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {'格式：角色名{别名1，别名2}，多个用逗号分隔。如：唐三{小三，三哥}，小舞'}
                </p>
              </div>
            )}
          </div>

          {/* 主内容区：三栏布局 */}
          {selectedNovel ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* 左侧：目录 */}
              <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                  <ListTree size={16} className="text-parlor-500" />
                  <span className="font-semibold text-sm">目录</span>
                  <span className="text-xs text-gray-500">({selectedNovel.chapters.length} 章)</span>
                </div>
                <div className="overflow-y-auto max-h-[70vh]">
                  {selectedNovel.chapters.map((ch, idx) => (
                    <button
                      key={idx}
                      onClick={() => { setSelectedChapter(idx); setActiveTab('content'); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700/50 ${
                        selectedChapter === idx && activeTab === 'content' ? 'bg-parlor-50 dark:bg-parlor-900/20 text-parlor-600 dark:text-parlor-400 font-medium' : ''
                      }`}
                    >
                      <span className="truncate block">{ch.title}</span>
                      <span className="text-[10px] text-gray-400">
                        {(ch.endPos - ch.startPos)} 字
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 右侧：内容 + 结果 */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="flex border-b border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => setActiveTab('content')}
                      className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                        activeTab === 'content' ? 'border-b-2 border-parlor-500 text-parlor-500' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    >
                      <AlignLeft size={14} className="inline mr-1.5" />
                      小说内容
                    </button>
                    <button
                      onClick={() => setActiveTab('results')}
                      className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                        activeTab === 'results' ? 'border-b-2 border-parlor-500 text-parlor-500' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    >
                      <Sparkles size={14} className="inline mr-1.5" />
                      解析结果
                      {selectedNovel.parsed && parseResult && (
                        <span className="ml-1.5 text-xs text-green-500">
                          ({parseResult.worldEntries.length} 条目 · {parseResult.characters.length} 角色)
                        </span>
                      )}
                      {selectedNovel.parsed && !parseResult && (
                        <span className="ml-1.5 text-xs text-gray-400">(已解析，点击查看)</span>
                      )}
                    </button>
                  </div>

                  {activeTab === 'content' && (
                    <div ref={contentRef} className="p-4 max-h-[70vh] overflow-y-auto">
                      <h2 className="text-lg font-bold mb-4 text-center">{currentChapter?.title || selectedNovel.title}</h2>
                      <div className="text-sm leading-relaxed whitespace-pre-wrap font-serif">
                        {chapterContent}
                      </div>
                      {(selectedNovel.content?.length ?? 0) > 50000 && (
                        <p className="mt-4 text-xs text-gray-400 text-center border-t border-gray-200 dark:border-gray-700 pt-3">
                          小说全文 {selectedNovel.charCount.toLocaleString()} 字
                        </p>
                      )}
                    </div>
                  )}

                  {activeTab === 'results' && (
                    <div className="p-4 max-h-[70vh] overflow-y-auto">
                      {!parseResult && (
                        selectedNovel.parsed && !selectedNovel.parseData ? (
                          <div className="text-center py-12 text-gray-400">
                            <Sparkles size={40} className="mx-auto mb-3 opacity-30" />
                            <p className="text-sm">该小说已解析过（旧格式），点击 AI 解析重新分析</p>
                          </div>
                        ) : (
                          <div className="text-center py-12 text-gray-400">
                            <Sparkles size={40} className="mx-auto mb-3 opacity-30" />
                            <p className="text-sm">点击 AI 解析开始分析</p>
                          </div>
                        )
                      )}

                      {isAnalyzing && (
                        <div className="text-center py-12">
                          <Loader2 size={40} className="mx-auto mb-3 animate-spin text-parlor-500" />
                          <p className="text-sm text-gray-500">AI 正在分析小说内容...</p>
                          <p className="text-xs text-gray-400 mt-1">
                            全文 {(selectedNovel.content?.length ?? 0).toLocaleString()} 字
                          </p>
                        </div>
                      )}

                      {parseResult && !isAnalyzing && (
                        <div>
                          {parseResult.title && (
                            <h3 className="font-semibold text-sm mb-3">📖 {parseResult.title}</h3>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold text-sm flex items-center gap-1.5">
                                  <BookOpen size={14} className="text-parlor-500" />
                                  世界书条目 ({parseResult.worldEntries.length})
                                </span>
                                <span className="text-xs text-gray-500">{selectedWorldEntries.size}/{parseResult.worldEntries.length}</span>
                              </div>
                              <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
                                {parseResult.worldEntries.map((entry, idx) => (
                                  <div key={idx} className="flex items-start gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => toggleWorldEntry(idx)}>
                                    <div className="mt-0.5 shrink-0">
                                      {selectedWorldEntries.has(idx) ? <CheckSquare size={14} className="text-parlor-500" /> : <Square size={14} className="text-gray-400" />}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-medium truncate">{entry.name}</p>
                                      <p className="text-[11px] text-gray-500 truncate">{entry.content.slice(0, 60)}...</p>
                                      <div className="flex flex-wrap gap-0.5 mt-0.5">
                                        {entry.keywords.slice(0, 3).map(kw => (
                                          <span key={kw} className="text-[9px] px-1 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded">{kw}</span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold text-sm flex items-center gap-1.5">
                                  <User size={14} className="text-parlor-500" />
                                  角色 ({parseResult.characters.length})
                                </span>
                                <span className="text-xs text-gray-500">{selectedCharacters.size}/{parseResult.characters.length}</span>
                              </div>
                              <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
                                {parseResult.characters.map((char, idx) => (
                                  <div key={idx} className="flex items-start gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => toggleCharacter(idx)}>
                                    <div className="mt-0.5 shrink-0">
                                      {selectedCharacters.has(idx) ? <CheckSquare size={14} className="text-parlor-500" /> : <Square size={14} className="text-gray-400" />}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-medium truncate">{char.name}</p>
                                      <p className="text-[11px] text-gray-500 truncate">{char.description.slice(0, 50)}...</p>
                                      <div className="flex flex-wrap gap-0.5 mt-0.5">
                                        {char.tags.slice(0, 3).map(tag => (
                                          <span key={tag} className="text-[9px] px-1 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded">{tag}</span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                            <p className="text-xs font-medium mb-2">导入目标：</p>
                            <div className="space-y-2">
                              <label className="flex items-center gap-2 text-xs">
                                <input type="radio" name="groupMode" checked={groupMode === 'new'} onChange={() => setGroupMode('new')} className="accent-parlor-500" />
                                创建新分组
                                {groupMode === 'new' && (
                                  <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                                    placeholder="分组名称（可选）"
                                    className="ml-2 flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900" />
                                )}
                              </label>
                              <label className="flex items-center gap-2 text-xs">
                                <input type="radio" name="groupMode" checked={groupMode === 'existing'} onChange={() => setGroupMode('existing')} className="accent-parlor-500" />
                                添加到已有分组
                                {groupMode === 'existing' && (
                                  <select value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)}
                                    className="ml-2 flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900">
                                    <option value="">选择分组...</option>
                                    {existingBooks.filter(b => b.enabled).map(book => (
                                      <option key={book.id} value={book.id}>{book.name} ({book.entries.length} 条目)</option>
                                    ))}
                                  </select>
                                )}
                              </label>
                            </div>
                            <button
                              onClick={handleImport}
                              disabled={importing || (selectedWorldEntries.size === 0 && selectedCharacters.size === 0) || (groupMode === 'existing' && !selectedGroupId)}
                              className="mt-3 w-full flex items-center justify-center gap-1.5 px-4 py-2 text-sm bg-parlor-500 text-white rounded-lg hover:bg-parlor-600 disabled:opacity-50 transition-colors"
                            >
                              {importing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                              <span>{importing ? '导入中...' : `导入选中（${selectedWorldEntries.size} 条目 + ${selectedCharacters.size} 角色）`}</span>
                            </button>
                          </div>

                          <div className="mt-3 flex gap-2">
                            <button onClick={() => navigate('/lorebook')} className="text-xs text-gray-500 hover:text-parlor-500 underline">查看世界书 →</button>
                            <button onClick={() => navigate('/characters')} className="text-xs text-gray-500 hover:text-parlor-500 underline">查看角色 →</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
