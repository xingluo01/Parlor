import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar, BottomNav, MobileHeader } from './Sidebar';
import { TopLoadingBar } from '../ui/TopLoadingBar';
import { useUIStore } from '../../stores';
import { settingsOps } from '../../db';
import type { AppSettings } from '../../types';

export function Layout() {
  const { setIsMobile, isMobile } = useUIStore();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [navVisible, setNavVisible] = useState(true);
  const lastScrollY = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Load settings
  useEffect(() => {
    settingsOps.get().then(s => setSettings(s ?? null));
  }, []);

  // Check for mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [setIsMobile]);

  // Reset nav visibility on route change
  useEffect(() => {
    setNavVisible(true);
    lastScrollY.current = 0;
  }, [location.pathname]);

  // Handle scroll for auto-hide
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !isMobile) return;
    if (!settings?.autoHideMobileMenus) return;

    const handleScroll = () => {
      const currentScrollY = container.scrollTop;
      const scrollDiff = currentScrollY - lastScrollY.current;

      if (scrollDiff > 10 && currentScrollY > 100) {
        setNavVisible(false);
      } else if (scrollDiff < -10) {
        setNavVisible(true);
      }

      lastScrollY.current = currentScrollY;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isMobile, settings?.autoHideMobileMenus]);

  const isChatPage = location.pathname.startsWith('/chat/');
  const hideMobileChrome = isMobile && isChatPage;

  const shouldAutoHide = settings?.autoHideMobileMenus && isMobile && !isChatPage;
  const showNav = !shouldAutoHide || navVisible;

  return (
    <div className="flex h-screen bg-dark-300 overflow-hidden scene-grain">
      <TopLoadingBar />

      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {!hideMobileChrome && (
          <div
            className={`transition-transform duration-300 ease-in-out ${
              shouldAutoHide && !showNav ? '-translate-y-12' : 'translate-y-0'
            }`}
          >
            <MobileHeader />
          </div>
        )}

        {/* Page Content */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto"
        >
          <Outlet />
        </div>

        {/* Mobile Bottom Navigation */}
        {!hideMobileChrome && (
          <div
            className={`transition-transform duration-300 ease-in-out ${
              shouldAutoHide && !showNav ? 'translate-y-full' : 'translate-y-0'
            }`}
          >
            <BottomNav />
          </div>
        )}
      </main>
    </div>
  );
}
