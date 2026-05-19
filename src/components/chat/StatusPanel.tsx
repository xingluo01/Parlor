import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Clock,
  X,
} from 'lucide-react';

export interface CharacterStatus {
  sceneHeader?: string;
  infoLines: { label: string; value: string }[];
  statusLines: { label: string; value: string }[];
}

interface StatusPanelProps {
  statuses: CharacterStatus[];
  currentPage: number;
  onPageChange: (page: number) => void;
  enablePagination?: boolean;
}

function renderLines(
  lines: { label: string; value: string }[],
) {
  if (lines.length === 0) return null;
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        try {
          const label = typeof line?.label === 'string' ? line.label : String(line?.label ?? '');
          const value = typeof line?.value === 'string' ? line.value : String(line?.value ?? '');
          return (
            <div key={i} className="flex justify-between gap-1">
              <span className="text-[10px] text-gray-400 shrink-0">{label}</span>
              <span className="text-[10px] text-gray-200 text-right truncate">{value}</span>
            </div>
          );
        } catch (err) {
          console.error('[Parlor] StatusPanel renderLines error:', err, 'line data:', JSON.stringify(line));
          return null;
        }
      })}
    </div>
  );
}

export default function StatusPanel({
  statuses,
  currentPage,
  onPageChange,
  enablePagination = true,
}: StatusPanelProps) {
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const status = statuses[currentPage];
  const hasData = status && (status.sceneHeader || status.infoLines.length > 0 || status.statusLines.length > 0);
  const totalStatuses = statuses.length;

  // 检查是否有任何状态数据（用于移动端角标）
  const anyStatus = statuses.some(
    s => s.sceneHeader || s.infoLines.length > 0 || s.statusLines.length > 0,
  );

  // ===== 桌面端侧边栏（原有逻辑，仅 md 以上显示） =====
  const desktopPanel = (
    <div className="w-64 shrink-0 border-l border-glass-border bg-dark-200/80 p-3 overflow-y-auto">
      {/* 标题 */}
      <div className="flex items-center gap-1.5 mb-2">
        <Activity size={12} className="text-parlor-400" />
        <span className="text-[10px] font-semibold text-gray-300 tracking-wider">
          STATUS
        </span>
        {enablePagination && totalStatuses > 1 && (
          <span className="text-[9px] text-gray-500 ml-auto">
            {currentPage + 1}/{totalStatuses}
          </span>
        )}
      </div>

      {hasData ? (
        <div className="space-y-2">
          {/* 场景头 */}
          {status.sceneHeader && (
            <div className="flex items-start gap-1.5 bg-dark-300/50 rounded p-1.5">
              <Clock size={10} className="text-parlor-400 mt-0.5 shrink-0" />
              <span className="text-[10px] text-gray-300 leading-tight">
                {status.sceneHeader}
              </span>
            </div>
          )}

          {/* INFO 区块 */}
          {status.infoLines.length > 0 && (
            <div>
              <div className="text-[9px] font-semibold text-gray-500 mb-1 tracking-wider">
                INFO
              </div>
              {renderLines(status.infoLines)}
            </div>
          )}

          {/* STATUS 区块 */}
          {status.statusLines.length > 0 && (
            <div>
              <div className="text-[9px] font-semibold text-gray-500 mb-1 tracking-wider">
                STATUS
              </div>
              {renderLines(status.statusLines)}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 text-gray-500">
          <Activity size={16} className="mb-1" />
          <span className="text-[10px]">{t('statusPanel.waiting')}</span>
        </div>
      )}

      {/* 翻页 */}
      {enablePagination && totalStatuses > 1 && (
        <div className="flex items-center justify-center gap-2 mt-2">
          <button
            onClick={() => onPageChange(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="p-0.5 rounded hover:bg-dark-300 disabled:opacity-30"
          >
            <ChevronLeft size={12} />
          </button>
          <span className="text-[9px] text-gray-400">
            {currentPage + 1} / {totalStatuses}
          </span>
          <button
            onClick={() => onPageChange(Math.min(totalStatuses - 1, currentPage + 1))}
            disabled={currentPage >= totalStatuses - 1}
            className="p-0.5 rounded hover:bg-dark-300 disabled:opacity-30"
          >
            <ChevronRight size={12} />
          </button>
        </div>
      )}
    </div>
  );

  // ===== 移动端悬浮按钮 =====
  const mobileFloatingButton = (
    <button
      onClick={() => setMobileOpen(true)}
      className="md:hidden fixed bottom-20 right-4 z-40 w-10 h-10 rounded-full bg-parlor-600 text-white shadow-lg flex items-center justify-center hover:bg-parlor-500 active:scale-95 transition-all"
    >
      <Activity size={18} />
      {anyStatus && (
        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900" />
      )}
    </button>
  );

  // ===== 移动端展开弹窗 =====
  const mobileOverlay = mobileOpen && (
    <div className="md:hidden fixed inset-0 z-50 flex items-end">
      {/* 半透明背景 */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => setMobileOpen(false)}
      />
      {/* 底部弹出的面板 */}
      <div
        className="relative w-full max-h-[60vh] bg-dark-200 border-t border-glass-border rounded-t-xl overflow-y-auto animate-slide-up-mobile"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 拖动条 */}
        <div className="sticky top-0 bg-dark-200 pt-2 pb-1 flex justify-center">
          <div className="w-8 h-1 rounded-full bg-gray-500/50" />
        </div>

        {/* 关闭按钮 */}
        <div className="absolute top-2 right-3 z-10">
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1 rounded-full hover:bg-dark-300 text-gray-400"
          >
            <X size={14} />
          </button>
        </div>

        {/* 内容 */}
        <div className="px-4 pb-4 pt-1">
          {/* 标题 */}
          <div className="flex items-center gap-1.5 mb-2">
            <Activity size={11} className="text-parlor-400" />
            <span className="text-[10px] font-semibold text-gray-300 tracking-wider">
              STATUS
            </span>
            {enablePagination && totalStatuses > 1 && (
              <span className="text-[9px] text-gray-500 ml-auto">
                {currentPage + 1}/{totalStatuses}
              </span>
            )}
          </div>

          {hasData ? (
            <div className="space-y-2">
              {status.sceneHeader && (
                <div className="flex items-start gap-1.5 bg-dark-300/50 rounded p-1.5">
                  <Clock size={9} className="text-parlor-400 mt-0.5 shrink-0" />
                  <span className="text-[10px] text-gray-300 leading-tight">
                    {status.sceneHeader}
                  </span>
                </div>
              )}

              {status.infoLines.length > 0 && (
                <div>
                  <div className="text-[8px] font-semibold text-gray-500 mb-1 tracking-wider">
                    INFO
                  </div>
                  {renderLines(status.infoLines)}
                </div>
              )}

              {status.statusLines.length > 0 && (
                <div>
                  <div className="text-[8px] font-semibold text-gray-500 mb-1 tracking-wider">
                    STATUS
                  </div>
                  {renderLines(status.statusLines)}
                </div>
              )}

              {/* 翻页 */}
              {enablePagination && totalStatuses > 1 && (
                <div className="flex items-center justify-center gap-2 mt-2">
                  <button
                    onClick={() => onPageChange(Math.max(0, currentPage - 1))}
                    disabled={currentPage === 0}
                    className="p-0.5 rounded hover:bg-dark-300 disabled:opacity-30"
                  >
                    <ChevronLeft size={11} />
                  </button>
                  <span className="text-[9px] text-gray-400">
                    {currentPage + 1} / {totalStatuses}
                  </span>
                  <button
                    onClick={() => onPageChange(Math.min(totalStatuses - 1, currentPage + 1))}
                    disabled={currentPage >= totalStatuses - 1}
                    className="p-0.5 rounded hover:bg-dark-300 disabled:opacity-30"
                  >
                    <ChevronRight size={11} />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-gray-500">
              <Activity size={14} className="mb-1" />
              <span className="text-[10px]">{t('statusPanel.waiting')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* 桌面端侧边栏 */}
      <div className="hidden md:block h-full">
        {desktopPanel}
      </div>

      {/* 移动端悬浮按钮 + 弹窗 */}
      {mobileFloatingButton}
      {mobileOverlay}
    </>
  );
}
