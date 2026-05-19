import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { X, Loader2, Download, ChevronLeft, ChevronRight } from 'lucide-react';

interface ChubSearchNode {
  name: string;
  fullPath: string;
  description: string;
  starCount: number;
  topics: string[];
  avatar_url: string;
  max_res_url: string;
  nTokens: number;
  nChats: number;
  nFavorites?: number;
  relatedLorebooks?: { id: string; name?: string }[];
}

const CHUB_API = 'https://api.chub.ai';

const chubDetailCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 10 * 60 * 1000;
const MAX_CACHE = 100;

async function fetchChubCharacter(fullPath: string) {
  const cached = chubDetailCache.get(fullPath);
  if (cached && Date.now() - cached.ts <= CACHE_TTL) return cached.data;
  const url = `${CHUB_API}/api/characters/${fullPath}?full=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Chub detail fetch failed: ${res.status}`);
  const data = await res.json();
  if (chubDetailCache.size >= MAX_CACHE) {
    const oldest = chubDetailCache.keys().next().value;
    if (oldest) chubDetailCache.delete(oldest);
  }
  chubDetailCache.set(fullPath, { data: data.node, ts: Date.now() });
  return data.node;
}

interface CharacterPreviewModalProps {
  previewNode: ChubSearchNode | null;
  previewDetail: any;
  previewLoading: boolean;
  previewVariants: ChubSearchNode[];
  previewVariantIndex: number;
  importingId: string | null;
  onClose: () => void;
  onVariantChange: (index: number, node: ChubSearchNode) => void;
  onImport: (node: ChubSearchNode) => void;
}

const CharacterPreviewModal = memo(function CharacterPreviewModal({
  previewNode,
  previewDetail,
  previewLoading: parentLoading,
  previewVariants,
  previewVariantIndex,
  importingId,
  onClose,
  onVariantChange,
  onImport,
}: CharacterPreviewModalProps) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const trackedPath = useRef<string | null>(null);

  // Sync from parent when parent provides fresh detail for the current node
  useEffect(() => {
    if (!previewNode) return;
    const path = previewNode.fullPath;
    if (previewDetail && path === trackedPath.current) {
      setDetail(previewDetail);
      setLoading(false);
    }
  }, [previewDetail, previewNode]);

  // Internal fetch on node or loading trigger
  useEffect(() => {
    if (!previewNode || !parentLoading) return;
    const path = previewNode.fullPath;
    trackedPath.current = path;
    setLoading(true);
    setDetail(null);
    fetchChubCharacter(path)
      .then(d => setDetail(d))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [previewNode?.fullPath, parentLoading]);

  const isDetail = detail ?? previewDetail;
  const isLoading = loading || parentLoading;

  const handlePrev = useCallback(() => {
    if (!previewNode || previewVariantIndex === 0) return;
    const newIdx = previewVariantIndex - 1;
    const nextNode = previewVariants[newIdx];
    trackedPath.current = nextNode.fullPath;
    onVariantChange(newIdx, nextNode);
  }, [previewNode, previewVariantIndex, previewVariants, onVariantChange]);

  const handleNext = useCallback(() => {
    if (!previewNode || previewVariantIndex >= previewVariants.length - 1) return;
    const newIdx = previewVariantIndex + 1;
    const nextNode = previewVariants[newIdx];
    trackedPath.current = nextNode.fullPath;
    onVariantChange(newIdx, nextNode);
  }, [previewNode, previewVariantIndex, previewVariants, onVariantChange]);

  const handleImport = useCallback(() => {
    if (!previewNode) return;
    onImport(previewNode);
  }, [previewNode, onImport]);

  if (!previewNode) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="glass border-glass-border rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl mx-4" onClick={e => e.stopPropagation()}>
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-4 border-b border-glass-border">
          <h2 className="font-semibold text-sm truncate">{previewNode.name}</h2>
          <button onClick={onClose} className="p-1 hover:bg-glass-white rounded">
            <X size={16} />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="space-y-4 p-4">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-dark-100/50 animate-pulse" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-1/3 bg-dark-100/50 animate-pulse rounded" />
                  <div className="h-3 w-1/4 bg-dark-100/50 animate-pulse rounded" />
                </div>
              </div>
              <div className="h-3 w-full bg-dark-100/50 animate-pulse rounded" />
              <div className="h-3 w-5/6 bg-dark-100/50 animate-pulse rounded" />
              <div className="h-3 w-3/4 bg-dark-100/50 animate-pulse rounded" />
            </div>
          ) : isDetail ? (
            <>
              {/* 头像 + 基本信息 */}
              <div className="flex items-center gap-3">
                {previewNode.avatar_url && (
                  <img src={previewNode.avatar_url} alt={previewNode.name}
                    className="w-16 h-16 rounded-full object-cover border border-glass-border"
                  />
                )}
                <div>
                  <h3 className="font-medium text-sm">{isDetail.definition?.name || previewNode.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                    <span>⭐ {previewNode.starCount || 0}</span>
                    <span>💬 {previewNode.nChats || 0}</span>
                    <span>📎 {previewNode.nTokens || 0} tokens</span>
                  </div>
                </div>
              </div>

              {/* 描述 */}
              {(isDetail.definition?.description || previewNode.description) && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase mb-1">描述</h4>
                  <p className="text-sm text-gray-300">{isDetail.definition?.description || previewNode.description}</p>
                </div>
              )}

              {/* 性格 */}
              {isDetail.definition?.personality && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase mb-1">性格</h4>
                  <p className="text-sm text-gray-300">{isDetail.definition.personality}</p>
                </div>
              )}

              {/* 场景 */}
              {isDetail.definition?.scenario && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase mb-1">场景</h4>
                  <p className="text-sm text-gray-300">{isDetail.definition.scenario}</p>
                </div>
              )}

              {/* 开场白 */}
              {isDetail.definition?.first_message && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase mb-1">开场白</h4>
                  <div className="text-sm text-gray-300 bg-dark-100 rounded p-2 whitespace-pre-wrap max-h-32 overflow-y-auto">{isDetail.definition.first_message}</div>
                </div>
              )}

              {/* 标签 */}
              {previewNode.topics && previewNode.topics.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase mb-1">标签</h4>
                  <div className="flex flex-wrap gap-1">
                    {previewNode.topics.map(t => (
                      <span key={t} className="text-[10px] px-2 py-0.5 bg-dark-100 border border-glass-border rounded-full text-gray-400">{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">无法加载详情，可直接导入</p>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-between gap-2 p-4 border-t border-glass-border">
          {/* 左侧：变体翻页 */}
          {previewVariants.length > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handlePrev}
                disabled={previewVariantIndex === 0}
                className="p-1 rounded hover:bg-glass-white disabled:opacity-30"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs text-gray-400 tabular-nums">
                {previewVariantIndex + 1}/{previewVariants.length}
              </span>
              <button
                onClick={handleNext}
                disabled={previewVariantIndex >= previewVariants.length - 1}
                className="p-1 rounded hover:bg-glass-white disabled:opacity-30"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}

          {/* 右侧：关闭 + 导入 */}
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:bg-glass-white rounded-lg">关闭</button>
            <button
              onClick={handleImport}
              disabled={importingId === previewNode.fullPath}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-parlor-500 text-white rounded-lg hover:bg-parlor-600 disabled:opacity-50"
            >
              {importingId === previewNode.fullPath ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              导入角色
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default CharacterPreviewModal;
