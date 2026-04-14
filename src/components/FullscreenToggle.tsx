'use client';

import { useState, useEffect } from 'react';

export function FullscreenToggle() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggle = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        // Tentar forçar landscape
        if ('orientation' in screen && 'lock' in screen.orientation) {
          await (screen.orientation as unknown as { lock: (orientation: string) => Promise<void> }).lock('landscape');
        }
      } else {
        await document.exitFullscreen();
      }
    } catch {
      console.log('Fullscreen not available');
    }
  };

  return (
    <button
      onClick={toggle}
      className="fixed top-4 right-4 z-50 rounded bg-emerald-600 px-3 py-2 text-sm font-bold text-white shadow-lg will-change-transform hover:bg-emerald-500 active:scale-95"
      style={{ transition: 'none' }}
    >
      {isFullscreen ? '⛶ Exit' : '⛶ Fullscreen'}
    </button>
  );
}
