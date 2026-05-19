import { useState } from 'react';
import { X, Sparkles, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { generateUUID } from '../../utils/uuid';
import { connectionOps, worldInfoOps } from '../../db';
import type { WorldInfo, WorldInfoRelation, LorebookEntry, ConnectionProfile } from '../../types';
import { extractJSON, buildBridgePrompt } from '../../utils/prompts';

interface BridgeModalProps {
  sourceWorldInfo: WorldInfo;
  relatedWorldInfos: WorldInfo[];       // 关联的世界书（完整对象）
  relations: WorldInfoRelation[];        // 关联关系列表
  onClose: () => void;
  onComplete: (newBook: WorldInfo) => void;  // 桥接完成后回调
}

// AI 调用：分析两个世界书的 entries，生成桥接条目
async function callAIBridge(
  source: WorldInfo,
  target: WorldInfo,
  connection: ConnectionProfile
): Promise<LorebookEntry[]> {
  const { apiKey, endpoint, model } = connection;
  const baseUrl = endpoint?.replace(/\/$/, '') || 'https://api.openai.com';

  // 构建 AI prompt
  const prompt = buildBridgePrompt(source, target);

  // 简单调用 OpenAI 兼容 API
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: '你是一个专业的世界观融合分析专家，擅长比较和整合设定。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) throw new Error(`AI API error: ${res.status}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';

  const parsed = extractJSON(text);
  if (!parsed.entries || !Array.isArray(parsed.entries)) {
    throw new Error('AI 返回格式不正确：缺少 entries 数组');
  }

  // 校验并转换
  const entries: LorebookEntry[] = [];
  for (const item of parsed.entries) {
    if (!item.keywords?.length || !item.content) continue;
    entries.push({
      id: generateUUID(),
      keywords: item.keywords.slice(0, 10),
      content: item.content,
      enabled: true,
      insertionOrder: entries.length,
    });
  }

  if (entries.length === 0) throw new Error('未能解析出有效的桥接条目');
  return entries;
}

export default function BridgeModal({
  sourceWorldInfo,
  relatedWorldInfos,
  relations: _relations,
  onClose,
  onComplete,
}: BridgeModalProps) {
  const [selectedTargetId, setSelectedTargetId] = useState<string>(
    relatedWorldInfos[0]?.id || ''
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [entries, setEntries] = useState<LorebookEntry[] | null>(null);
  const [error, setError] = useState('');
  const [bridgeName, setBridgeName] = useState(`${sourceWorldInfo.name} ↔ ${relatedWorldInfos[0]?.name || ''} 桥接`);

  const selectedTarget = relatedWorldInfos.find(w => w.id === selectedTargetId);

  async function handleAnalyze() {
    if (!selectedTarget) return;
    setAnalyzing(true);
    setError('');
    setEntries(null);

    try {
      const connection = await connectionOps.getActive();
      if (!connection) {
        throw new Error('未配置 AI 连接，请先在设置中配置');
      }
      const result = await callAIBridge(sourceWorldInfo, selectedTarget, connection);
      setEntries(result);
      setBridgeName(`${sourceWorldInfo.name} ↔ ${selectedTarget.name} 桥接`);
    } catch (e: any) {
      setError(e.message || 'AI 分析失败');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleCreate() {
    if (!entries || entries.length === 0) return;

    const newBook: WorldInfo = {
      id: generateUUID(),
      name: bridgeName.trim() || `${sourceWorldInfo.name} ↔ ${selectedTarget?.name} 桥接`,
      enabled: false,  // 默认禁用，用户手动启用
      entries: entries,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    try {
      await worldInfoOps.add(newBook);
      onComplete(newBook);
      onClose();
    } catch (e: any) {
      setError('创建桥接分组失败: ' + e.message);
    }
  }

  const targetWorldInfo = relatedWorldInfos.find(w => w.id === selectedTargetId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-full sm:w-auto max-w-2xl max-h-[85vh] mx-4 flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* 标题 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-sm">世界观桥接 — {sourceWorldInfo.name}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 选择关联世界书 */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">选择要桥接的世界书</label>
            <select
              value={selectedTargetId}
              onChange={e => { setSelectedTargetId(e.target.value); setEntries(null); setError(''); }}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
            >
              {relatedWorldInfos.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.entries.length} 条目)</option>
              ))}
            </select>
          </div>

          {/* 源和目标世界书摘要 */}
          {targetWorldInfo && (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-xs font-medium mb-1">{sourceWorldInfo.name}</p>
                <p className="text-xs text-gray-500">{sourceWorldInfo.entries.length} 个条目</p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-xs font-medium mb-1">{targetWorldInfo.name}</p>
                <p className="text-xs text-gray-500">{targetWorldInfo.entries.length} 个条目</p>
              </div>
            </div>
          )}

          {/* 错误信息 */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* AI 分析按钮 */}
          <button
            onClick={handleAnalyze}
            disabled={analyzing || !selectedTarget}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-parlor-500 text-white rounded-lg hover:bg-parlor-600 disabled:opacity-50 transition-colors"
          >
            {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            <span>{analyzing ? 'AI 正在分析中...' : 'AI 分析桥接条目'}</span>
          </button>

          {/* 分析结果预览 */}
          {entries && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={14} className="text-green-500" />
                <span className="text-sm font-medium">生成 {entries.length} 个桥接条目</span>
              </div>
              <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
                {entries.map((entry) => (
                  <div key={entry.id} className="p-2">
                    <div className="flex flex-wrap gap-1 mb-1">
                      {entry.keywords.map(kw => (
                        <span key={kw} className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded">{kw}</span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{entry.content.slice(0, 120)}...</p>
                  </div>
                ))}
              </div>

              {/* 桥接分组名称 */}
              <div className="mt-3">
                <label className="text-xs font-medium text-gray-500 mb-1 block">桥接分组名称</label>
                <input
                  value={bridgeName}
                  onChange={e => setBridgeName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
                />
                <p className="text-xs text-gray-400 mt-1">创建后默认禁用，可手动启用</p>
              </div>

              {/* 创建按钮 */}
              <button
                onClick={handleCreate}
                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                <CheckCircle size={14} />
                <span>创建桥接分组</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
