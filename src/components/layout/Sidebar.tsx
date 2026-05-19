import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import {
  Users,
  MessageSquare,
  User,
  Settings,
  ChevronLeft,
  Plus,
  Download,
  Home,
  BookOpen,
  Database,
  Globe,
  Sparkles,
  FileText,
  MoreHorizontal,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../../stores';
import logoSrc from '../../assets/logo.png';
import { backupOps } from '../../db';
import { saveAs } from 'file-saver';
import { Button } from '../ui';
import { playClickSound } from '../../utils/sound';

const navItems = [
  { path: '/', icon: Home, labelKey: 'nav.home' },
  { path: '/characters', icon: Users, labelKey: 'nav.characters' },
  { path: '/chats', icon: MessageSquare, labelKey: 'nav.chats' },
  { path: '/personas', icon: User, labelKey: 'nav.personas' },
  { path: '/lorebook', icon: BookOpen, labelKey: 'nav.lorebook' },
  { path: '/databank', icon: Database, labelKey: 'nav.databank' },
  { path: '/markets', icon: Globe, labelKey: 'nav.characterMarket' },
  { path: '/image-gen', icon: Sparkles, labelKey: 'nav.imageGenerator' },
  { path: '/novel-parser', icon: FileText, labelKey: 'nav.novelParser' },
  { path: '/settings', icon: Settings, labelKey: 'nav.settings' },
];

export function Sidebar() {
  const location = useLocation();
  const sidebarOpen = useUIStore(s => s.sidebarOpen);
  const toggleSidebar = useUIStore(s => s.toggleSidebar);
  const isMobile = useUIStore(s => s.isMobile);
  const { t } = useTranslation();

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 240 : 0 }}
        className="hidden md:flex flex-col h-screen overflow-hidden bg-dark-200 border-r border-glass-border"
      >
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col h-full"
              style={{ width: 240 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 h-14 border-b border-glass-border flex-shrink-0">
                <Link to="/" onClick={() => playClickSound()} className="flex items-center gap-2.5 group">
                  <img
                    src={logoSrc}
                    alt="Parlor"
                    className="w-7 h-7 rounded-lg ring-1 ring-white/[0.06] group-hover:ring-parlor-500/30 transition-all"
                  />
                  <h1 className="text-lg font-semibold text-white font-serif tracking-tight">Parlor</h1>
                </Link>
                <Button variant="ghost" size="sm" onClick={toggleSidebar} className="p-1.5">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </div>

              {/* Quick Actions */}
              <div className="px-3 pt-3 pb-1">
                <Link to="/characters/new" onClick={() => playClickSound()} className="inline-flex items-center gap-2 w-full justify-start font-medium transition-all duration-150 active:scale-95 select-none focus:outline-none rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-2.5 py-1.5 text-xs">
                  <Plus className="w-3.5 h-3.5" />
                  {t('nav.newCharacter')}
                </Link>
              </div>

              {/* Ornamental divider */}
              <div className="mx-4 my-2 divider" />

                  {/* Navigation */}
                  <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
                    {navItems.map((item) => {
                      const isHome = item.path === '/';
                      const isActive = isHome
                        ? location.pathname === '/'
                        : location.pathname.startsWith(item.path);
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => playClickSound()}
                          className={`
                            inline-flex items-center gap-3 w-full justify-start px-3 py-2 font-medium text-[13px] relative rounded-xl
                            transition-all duration-150 active:scale-95 select-none focus:outline-none
                            bg-transparent
                            ${isActive
                              ? 'bg-parlor-500/10 text-white'
                              : 'text-gray-500 hover:text-gray-300 hover:bg-glass-white'
                            }
                          `}
                        >
                          {isActive && (
                            <motion.div
                              layoutId="sidebar-active"
                              className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-parlor-500 rounded-full"
                              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            />
                          )}
                          <item.icon className={`w-[17px] h-[17px] flex-shrink-0 ${isActive ? 'text-parlor-400' : ''}`} />
                          <span>{t(item.labelKey)}</span>
                        </Link>
                      );
                    })}
                  </nav>

              {/* Footer */}
              <div className="p-3 border-t border-glass-border">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-gray-600 text-xs"
                  onClick={async () => {
                    try {
                      const backup = await backupOps.createQuickBackup();
                      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                      saveAs(blob, `parlor-backup-${new Date().toISOString().slice(0, 10)}.json`);
                    } catch (err) {
                      console.error('Backup failed:', err);
                    }
                  }}
                >
                  <Download className="w-3.5 h-3.5" />
                  {t('nav.quickBackup')}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.aside>

      {/* Collapsed Sidebar Toggle (when closed) */}
      {!sidebarOpen && !isMobile && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => { playClickSound(); toggleSidebar(); }}
          className="hidden md:flex items-center justify-center w-10 h-10 m-2 rounded-lg bg-dark-200 border border-glass-border hover:bg-glass-hover transition-colors"
        >
          <img src={logoSrc} alt="Parlor" className="w-5 h-5 rounded" />
        </motion.button>
      )}
    </>
  );
}

// Mobile Top Navigation
export function TopNav() {
  const location = useLocation();
  const { t } = useTranslation();
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // 核心导航项（常驻顶部）
  const coreItems = navItems.filter(item =>
    ['/', '/characters', '/chats', '/novel-parser', '/settings'].includes(item.path)
  );

  // 更多菜单项
  const moreItems = navItems.filter(item =>
    ['/personas', '/lorebook', '/databank', '/markets', '/image-gen'].includes(item.path)
  );

  // 点击外部关闭更多菜单
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMore(false);
      }
    }
    if (showMore) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMore]);

  function isActive(path: string) {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  }

  return (
    <div ref={moreRef} className="relative">
      {/* 更多菜单弹出面板 */}
      {showMore && (
        <>
          {/* 遮罩层 - 点击关闭 */}
          <div className="fixed inset-0 z-40" onClick={() => setShowMore(false)} />
          {/* 菜单面板 */}
          <div className="absolute top-full left-0 right-0 z-50 mt-1 mx-2 bg-dark-100 border border-glass-border rounded-xl overflow-hidden shadow-2xl">
            <div className="grid grid-cols-3 gap-1 p-3">
              {moreItems.map((item) => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => { playClickSound(); setShowMore(false); }}
                    className={`inline-flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg transition-all duration-150 active:scale-95 select-none focus:outline-none bg-transparent ${
                      active
                        ? 'text-parlor-400 bg-parlor-500/10'
                        : 'text-gray-500 hover:text-white hover:bg-glass-white'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="text-[10px] font-medium leading-tight text-center">
                      {t(item.labelKey)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* 顶部导航栏 */}
      <nav className="w-full bg-dark-200/95 backdrop-blur-md border-b border-glass-border safe-top md:hidden">
        <div className="flex items-center justify-around px-2 py-1">
          {coreItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => playClickSound()}
                className={`inline-flex flex-col items-center gap-0.5 py-1.5 px-2 relative rounded-lg transition-all duration-150 active:scale-95 select-none focus:outline-none bg-transparent ${
                  active ? 'text-parlor-400' : 'text-gray-500 hover:text-white hover:bg-glass-white'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="mobile-nav-active"
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-parlor-500 rounded-full"
                    transition={{ type: 'spring', damping: 40, stiffness: 200 }}
                  />
                )}
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{t(item.labelKey)}</span>
              </Link>
            );
          })}

          {/* 更多按钮 */}
          <Button
            variant="ghost"
            onClick={() => setShowMore(!showMore)}
            className={`flex flex-col items-center gap-0.5 py-1.5 px-2 relative ${
              showMore ? 'text-parlor-400' : 'text-gray-500'
            }`}
          >
            {showMore && (
              <motion.div
                layoutId="mobile-nav-active"
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-parlor-500 rounded-full"
                    transition={{ type: 'spring', damping: 40, stiffness: 200 }}
                  />
                )}
                <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] font-medium">{t('nav.more')}</span>
          </Button>
        </div>
      </nav>
    </div>
  );
}

// Mobile Header
export function MobileHeader() {
  const location = useLocation();
  const { t } = useTranslation();

  const getPageTitle = () => {
    if (location.pathname.startsWith('/chat/')) return t('chat.title');
    if (location.pathname.startsWith('/characters/')) return t('nav.characters');
    const path = location.pathname.split('/')[1];
    return path ? path.charAt(0).toUpperCase() + path.slice(1) : 'Parlor';
  };

  return (
    <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-2 bg-dark-200/95 backdrop-blur-md border-b border-glass-border safe-top">
      <div className="flex items-center gap-2.5">
        <img src={logoSrc} alt="Parlor" className="w-6 h-6 rounded-lg ring-1 ring-white/[0.06]" />
        <h1 className="text-base font-semibold text-white font-serif tracking-tight">{getPageTitle()}</h1>
      </div>
      {location.pathname.startsWith('/chat/') && (
        <Link
          to="/settings"
          onClick={() => playClickSound()}
          className="inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 active:scale-95 select-none focus:outline-none bg-transparent hover:bg-glass-white text-gray-500 hover:text-white p-1.5 rounded-lg"
        >
          <Settings className="w-4 h-4 text-gray-600" />
        </Link>
      )}
    </header>
  );
}
