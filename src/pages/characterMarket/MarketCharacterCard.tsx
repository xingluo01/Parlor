import { memo } from 'react';
import { Globe, Star, MessageSquare, Heart, Download, Languages as TranslateIcon, ExternalLink, Loader2 } from 'lucide-react';

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

interface MarketCharacterCardProps {
  node: ChubSearchNode;
  variantCount: number;
  translatedText: string | undefined;
  importingId: string | null;
  translatingId: string | null;
  onPreview: (node: ChubSearchNode) => void;
  onImport: (node: ChubSearchNode) => void;
  onTranslate: (node: ChubSearchNode) => void;
  t: (key: string) => string;
}

export default memo(function MarketCharacterCard({
  node,
  variantCount,
  translatedText,
  importingId,
  translatingId,
  onPreview,
  onImport,
  onTranslate,
  t,
}: MarketCharacterCardProps) {
  return (
    <div
      key={node.fullPath}
      className="glass border border-glass-border rounded-lg overflow-hidden h-[220px] hover:shadow-glass-sm transition-shadow group cursor-pointer flex flex-col"
      onClick={() => onPreview(node)}
    >
      {/* 角色头像 */}
      <div className="aspect-[3/2] bg-dark-50 relative overflow-hidden">
        {node.avatar_url ? (
          <img
            src={node.avatar_url}
            alt={node.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500">
            <Globe size={32} />
          </div>
        )}
        {/* 评分角标 */}
        <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1">
          <Star size={10} className="text-yellow-400 fill-yellow-400" />
          {node.starCount}
        </div>
      </div>

      {/* 角色信息 */}
      <div className="p-3 flex flex-col flex-1 min-h-0">
        <h4 className="font-semibold text-white text-sm truncate shrink-0 flex items-center" title={node.name}>
          {node.name}
          {variantCount > 1 && (
            <span className="text-[10px] text-parlor-400 ml-1 shrink-0">
              +{variantCount - 1}
            </span>
          )}
        </h4>
        {node.description && (
          <p className="text-xs text-gray-400 mt-1 line-clamp-2">
            {node.description}
          </p>
        )}

        {/* 翻译结果 */}
        {translatedText && (
          <div className="mt-1 pt-1 border-t border-glass-border shrink-0">
            <p className="text-xs text-parlor-300 leading-tight">
              {translatedText}
            </p>
          </div>
        )}

        {/* 标签 */}
        {node.topics && node.topics.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 shrink-0">
            {node.topics.slice(0, 3).map(tag => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-glass-white text-gray-400 rounded">
                {tag}
              </span>
            ))}
            {node.topics.length > 3 && (
              <span className="text-[10px] px-1.5 py-0.5 text-gray-500">
                +{node.topics.length - 3}
              </span>
            )}
          </div>
        )}

        {/* 统计信息 */}
        <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500 shrink-0">
          <span className="flex items-center gap-1">
            <MessageSquare size={10} /> {node.nChats}
          </span>
          <span className="flex items-center gap-1">
            <Heart size={10} /> {node.nFavorites || 0}
          </span>
          <span className="flex items-center gap-1">
            <span className="font-mono">{node.nTokens}</span>
          </span>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2 mt-auto pt-2 shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onImport(node); }}
            disabled={importingId === node.fullPath}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs bg-parlor-500 text-white rounded-lg hover:bg-parlor-600 disabled:opacity-50 transition-colors"
          >
            {importingId === node.fullPath ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Download size={12} />
            )}
            <span>{importingId === node.fullPath ? t('characterMarket.importing') : t('common.import')}</span>
          </button>
          {/* 翻译按钮 */}
          <button
            onClick={e => { e.stopPropagation(); onTranslate(node); }}
            disabled={translatingId === node.fullPath}
            className="px-2 py-1.5 text-xs border border-glass-border rounded-lg hover:bg-glass-white transition-colors flex items-center gap-1 text-gray-400 hover:text-parlor-300 disabled:opacity-50"
            title="翻译"
          >
            <TranslateIcon size={12} />
          </button>
          <a
            href={`https://www.chub.ai/characters/${node.fullPath}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs border border-glass-border rounded-lg hover:bg-glass-white transition-colors flex items-center gap-1 text-gray-400 hover:text-white"
          >
            <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  );
});
