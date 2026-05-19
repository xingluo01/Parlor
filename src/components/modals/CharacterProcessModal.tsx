import { useState } from 'react';
import { X, Sparkles, Loader2, CheckSquare, Square } from 'lucide-react';
import { generateUUID } from '../../utils/uuid';
import { useCharacterStore } from '../../stores';
import type { CharacterCard } from '../../types';
import { callAI } from '../../services/ai';
import { extractJSON } from '../../utils/prompts';

interface CharacterProcessModalProps {
  character: CharacterCard;
  onClose: () => void;
  onComplete: () => void;
}

const PROCESS_OPTIONS = [
  { key: 'polish', label: '润色', desc: '优化角色描述和性格表达' },
  { key: 'expand', label: '扩写', desc: '丰富角色细节和背景' },
  { key: 'abridge', label: '缩写', desc: '精简角色信息保留核心' },
  { key: 'erotic', label: '色情化', desc: '以保持核心设定为前提对角色描述性化处理' },
  { key: 'localize', label: '本地化', desc: '将角色信息翻译为当前语言' },
] as const;

const AUTO_OPTIONS = [
  { key: 'fillDetails', label: '自动补充角色详细信息', desc: 'AI 自动填充年龄、外貌、性格特质等详细字段' },
  { key: 'createWorld', label: '自动创建世界观', desc: '基于角色信息生成世界观分组和条目' },
  { key: 'createPersona', label: '附加创建用户人设', desc: '生成一个匹配该角色世界观的人设' },
] as const;

export default function CharacterProcessModal({ character, onClose, onComplete }: CharacterProcessModalProps) {
  const [selectedProcess, setSelectedProcess] = useState<string[]>([]);
  const [selectedAuto, setSelectedAuto] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function toggleProcess(key: string) {
    setSelectedProcess(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev]);
  }

  function toggleAuto(key: string) {
    setSelectedAuto(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev]);
  }

  // 构建 AI prompt
  function buildPrompt(): string {
    const processNames: Record<string, string> = { polish: '润色', expand: '扩写', abridge: '缩写', erotic: '色情化', localize: '本地化翻译' };
    const processText = selectedProcess.map(k => processNames[k] || k).join('、');

    let prompt = `请对以下角色卡进行${processText}处理。\n\n角色名称：${character.name}\n描述：${character.description || '无'}\n性格：${character.personality || '无'}\n场景：${character.scenario || '无'}\n开场白：${character.firstMessage || '无'}`;

    if (selectedAuto.includes('fillDetails')) {
      prompt += '\n\n【补充详细信息】请在 JSON 中同时输出 age、gender、appearance、personalityTraits、likes、dislikes、background、speechStyle 等详细字段。';
    }

    if (selectedProcess.includes('localize')) {
      prompt = `请将以下角色卡信息翻译为简体中文，保持角色设定不变。\n\n角色名称：${character.name}\n描述：${character.description || '无'}\n性格：${character.personality || '无'}\n场景：${character.scenario || '无'}\n开场白：${character.firstMessage || '无'}`;
      if (selectedAuto.includes('fillDetails')) {
        prompt += '\n\n【补充详细信息】请在 JSON 中同时输出 age、gender、appearance、personalityTraits、likes、dislikes、background、speechStyle 等翻译后的详细字段。';
      }
    }

    prompt += '\n\n请严格按照以下 JSON 格式输出（纯 JSON）：\n{"name":"角色名","description":"处理后描述","personality":"处理后性格","scenario":"处理后场景","firstMessage":"处理后开场白"';

    if (selectedAuto.includes('fillDetails')) {
      prompt += ',"age":"","gender":"","appearance":"","personalityTraits":[],"likes":[],"dislikes":[],"background":"","speechStyle":""';
    }

    prompt += '}';

    return prompt;
  }

  async function handleProcess() {
    if (selectedProcess.length === 0) return;
    setProcessing(true);
    setResult(null);

    try {
      const { connectionOps, characterOps } = await import('../../db');
      const connection = await connectionOps.getActive();
      if (!connection) { alert('请先配置 AI 连接'); return; }

      const prompt = buildPrompt();
      const resultText = await callAI(connection, '你是一个专业的角色卡编辑专家。', prompt, { temperature: 0.7, maxTokens: 4096 });

      const result = extractJSON(resultText);
      if (!result.name) throw new Error('AI 未返回有效角色名');

      // 更新角色卡
      const updated: Partial<CharacterCard> = {};
      if (result.description) updated.description = result.description;
      if (result.personality) updated.personality = result.personality;
      if (result.scenario) updated.scenario = result.scenario;
      if (result.firstMessage) updated.firstMessage = result.firstMessage;
      if (result.age) (updated as any).age = result.age;
      if (result.gender) (updated as any).gender = result.gender;
      if (result.appearance) (updated as any).appearance = result.appearance;
      if (result.personalityTraits) (updated as any).personalityTraits = result.personalityTraits;
      if (result.likes) (updated as any).likes = result.likes;
      if (result.dislikes) (updated as any).dislikes = result.dislikes;
      if (result.background) (updated as any).background = result.background;
      if (result.speechStyle) (updated as any).speechStyle = result.speechStyle;

      await characterOps.update(character.id, updated);
      useCharacterStore.getState().updateCharacter(character.id, updated);
      setResult(`${selectedProcess.join(', ')}处理完成！`);

      // 自动创建世界观
      if (selectedAuto.includes('createWorld')) {
        try {
          const { worldInfoOps } = await import('../../db');
          const worldInfo = {
            id: generateUUID(),
            name: `${character.name}的世界`,
            enabled: true,
            entries: [
              { id: generateUUID(), keywords: [character.name], content: `${character.name}的角色设定相关世界观`, enabled: true, insertionOrder: 0 }
            ],
            createdAt: Date.now(), updatedAt: Date.now(),
          };
          await worldInfoOps.add(worldInfo);
          setResult(prev => (prev || '') + '\n✅ 世界观已创建');
        } catch {}
      }

      // 自动创建人设
      if (selectedAuto.includes('createPersona')) {
        try {
          const { personaOps } = await import('../../db');
          const persona = {
            id: generateUUID(),
            name: `${character.name}的旅伴`,
            description: `一个与${character.name}生活在同一世界的人`,
            personality: '待探索',
            isDefault: false,
            createdAt: Date.now(), updatedAt: Date.now(),
          };
          await personaOps.add(persona);
          setResult(prev => (prev || '') + '\n✅ 人设已创建');
        } catch {}
      }

    } catch (e: any) {
      alert(`处理失败: ${e.message}`);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-md mx-4 p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">角色卡处理 — {character.name}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><X size={16} /></button>
        </div>

        {result ? (
          <div className="text-center py-4">
            <p className="text-green-500 text-sm whitespace-pre-wrap">{result}</p>
            <button onClick={onComplete} className="mt-3 px-4 py-2 text-sm bg-parlor-500 text-white rounded-lg">完成</button>
          </div>
        ) : (
          <>
            {/* 处理选项 */}
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-400 mb-1.5">处理方式（至少选一项）</p>
              <div className="grid grid-cols-2 gap-1.5">
                {PROCESS_OPTIONS.map(opt => (
                  <button key={opt.key} onClick={() => toggleProcess(opt.key)}
                    className={`flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-lg border transition-colors ${
                      selectedProcess.includes(opt.key)
                        ? 'bg-parlor-500/20 border-parlor-500/50 text-parlor-300'
                        : 'bg-dark-100 border-glass-border text-gray-400 hover:text-white'
                    }`}
                  >
                    {selectedProcess.includes(opt.key) ? <CheckSquare size={12} /> : <Square size={12} />}
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 自动选项 */}
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-400 mb-1.5">附加操作（可选）</p>
              <div className="space-y-1">
                {AUTO_OPTIONS.map(opt => (
                  <button key={opt.key} onClick={() => toggleAuto(opt.key)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg border transition-colors ${
                      selectedAuto.includes(opt.key)
                        ? 'bg-parlor-500/20 border-parlor-500/50 text-parlor-300'
                        : 'bg-dark-100 border-glass-border text-gray-400 hover:text-white'
                    }`}
                  >
                    {selectedAuto.includes(opt.key) ? <CheckSquare size={12} /> : <Square size={12} />}
                    <div className="text-left">
                      <span>{opt.label}</span>
                      <span className="text-[10px] text-gray-500 block">{opt.desc}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">取消</button>
              <button onClick={handleProcess} disabled={selectedProcess.length === 0 || processing}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-parlor-500 text-white rounded-lg disabled:opacity-50">
                {processing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {processing ? '处理中...' : '开始处理'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
