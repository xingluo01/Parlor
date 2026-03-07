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
} from 'lucide-react';
import { useUIStore } from '../../stores';
import logoSrc from '../../assets/logo.png';
import { backupOps } from '../../db';
import { saveAs } from 'file-saver';
import { Button } from '../ui';

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/characters', icon: Users, label: 'Characters' },
  { path: '/chats', icon: MessageSquare, label: 'Chats' },
  { path: '/personas', icon: User, label: 'Personas' },
  { path: '/lorebook', icon: BookOpen, label: 'Lorebook' },
  { path: '/databank', icon: Database, label: 'Data Bank' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  const location = useLocation();
  const { sidebarOpen, toggleSidebar, isMobile } = useUIStore();

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
                <Link to="/" className="flex items-center gap-2.5 group">
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
                <Link to="/characters/new">
                  <Button variant="secondary" size="sm" className="w-full justify-start text-xs">
                    <Plus className="w-3.5 h-3.5" />
                    New Character
                  </Button>
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
                      className={`
                        flex items-center gap-3 px-3 py-2 rounded-lg
                        transition-all duration-200 group relative
                        ${
                          isActive
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
                      <item.icon className={`w-[17px] h-[17px] flex-shrink-0 ${isActive ? 'text-parlor-400' : 'group-hover:text-gray-400'}`} />
                      <span className="font-medium text-[13px]">{item.label}</span>
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
                  Quick Backup
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
          onClick={toggleSidebar}
          className="hidden md:flex items-center justify-center w-10 h-10 m-2 rounded-lg bg-dark-200 border border-glass-border hover:bg-glass-hover transition-colors"
        >
          <img src={logoSrc} alt="Parlor" className="w-5 h-5 rounded" />
        </motion.button>
      )}
    </>
  );
}

// Mobile Bottom Navigation
export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="w-full bg-dark-200/95 backdrop-blur-md border-t border-glass-border mobile-nav-grid md:hidden safe-bottom">
      {navItems.filter(item => item.path !== '/lorebook' && item.path !== '/databank').map((item) => {
        const isHome = item.path === '/';
        const isActive = isHome
          ? location.pathname === '/'
          : location.pathname.startsWith(item.path);
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`mobile-nav-item transition-colors relative ${isActive ? 'text-parlor-400' : 'text-gray-600'}`}
          >
            {isActive && (
              <motion.div
                layoutId="mobile-nav-active"
                className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-parlor-500 rounded-full"
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              />
            )}
            <item.icon className="mobile-nav-icon" />
            <span className="mobile-nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// Mobile Header
export function MobileHeader() {
  const location = useLocation();

  const getPageTitle = () => {
    if (location.pathname.startsWith('/chat/')) return 'Chat';
    if (location.pathname.startsWith('/characters/')) return 'Characters';
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
          className="p-1.5 rounded-lg hover:bg-glass-white transition-colors"
        >
          <Settings className="w-4 h-4 text-gray-600" />
        </Link>
      )}
    </header>
  );
}
