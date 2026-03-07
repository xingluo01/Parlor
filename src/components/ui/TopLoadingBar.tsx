import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Thin progress bar that sweeps across the top of the viewport on every
 * route change. Gives immediate feedback that the app responded to navigation
 * before the new page's own loading state kicks in.
 */
export function TopLoadingBar() {
  const location = useLocation();
  const [active, setActive] = useState(false);
  const prevPath = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Skip the very first render — no "navigation" has occurred yet.
    if (prevPath.current === null) {
      prevPath.current = location.pathname;
      return;
    }
    if (prevPath.current === location.pathname) return;
    prevPath.current = location.pathname;

    if (timerRef.current) clearTimeout(timerRef.current);
    setActive(true);
    // Hide after the sweep animation completes (+ a little grace for exit fade)
    timerRef.current = setTimeout(() => setActive(false), 650);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [location.pathname]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="top-loading-bar"
          className="fixed top-0 left-0 right-0 h-[2px] z-[200] pointer-events-none"
          initial={{ scaleX: 0, originX: 0 }}
          animate={{ scaleX: 1, originX: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          style={{
            background: 'linear-gradient(90deg, rgb(var(--parlor-500)), rgb(var(--parlor-400)), #d4a857)',
            boxShadow: '0 0 12px rgba(194, 51, 80, 0.4)',
          }}
        />
      )}
    </AnimatePresence>
  );
}
