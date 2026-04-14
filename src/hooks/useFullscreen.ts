'use client';

import { useState, useCallback, useEffect } from 'react';

interface UseFullscreenReturn {
  isFullscreen: boolean;
  toggleFullscreen: () => Promise<void>;
  enterFullscreen: () => Promise<void>;
  exitFullscreen: () => Promise<void>;
}

export function useFullscreen(): UseFullscreenReturn {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Check fullscreen state
  const checkFullscreen = useCallback((): void => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      mozFullScreenElement?: Element | null;
      msFullscreenElement?: Element | null;
    };
    const fullscreen = !!(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );
    setIsFullscreen(fullscreen);
  }, []);

  // Enter fullscreen with Safari iOS workaround
  const enterFullscreen = useCallback(async (): Promise<void> => {
    try {
      const doc = document as Document & {
        webkitFullscreenElement?: Element | null;
        mozFullScreenElement?: Element | null;
        msFullscreenElement?: Element | null;
        webkitExitFullscreen?: () => Promise<void>;
        mozCancelFullScreen?: () => Promise<void>;
        msExitFullscreen?: () => Promise<void>;
      };

      const elem = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
        mozRequestFullScreen?: () => Promise<void>;
        msRequestFullscreen?: () => Promise<void>;
      };

      // Already fullscreen
      if (doc.fullscreenElement || doc.webkitFullscreenElement) {
        return;
      }

      // Try standard fullscreen API
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem.mozRequestFullScreen) {
        await elem.mozRequestFullScreen();
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen();
      }

      // Safari iOS workaround: scroll to hide address bar
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        setTimeout(() => {
          window.scrollTo(0, 1);
        }, 100);
      }

      checkFullscreen();
    } catch {
      // Silent fail - fullscreen not supported
    }
  }, [checkFullscreen]);

  // Exit fullscreen
  const exitFullscreen = useCallback(async (): Promise<void> => {
    try {
      const doc = document as Document & {
        webkitFullscreenElement?: Element | null;
        mozFullScreenElement?: Element | null;
        msFullscreenElement?: Element | null;
        webkitExitFullscreen?: () => Promise<void>;
        mozCancelFullScreen?: () => Promise<void>;
        msExitFullscreen?: () => Promise<void>;
      };

      if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
        return;
      }

      if (doc.exitFullscreen) {
        await doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      } else if (doc.mozCancelFullScreen) {
        await doc.mozCancelFullScreen();
      } else if (doc.msExitFullscreen) {
        await doc.msExitFullscreen();
      }

      checkFullscreen();
    } catch {
      // Silent fail
    }
  }, [checkFullscreen]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(async (): Promise<void> => {
    if (isFullscreen) {
      await exitFullscreen();
    } else {
      await enterFullscreen();
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleChange = (): void => {
      checkFullscreen();
    };

    document.addEventListener('fullscreenchange', handleChange);
    document.addEventListener('webkitfullscreenchange', handleChange);
    document.addEventListener('mozfullscreenchange', handleChange);
    document.addEventListener('MSFullscreenChange', handleChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleChange);
      document.removeEventListener('webkitfullscreenchange', handleChange);
      document.removeEventListener('mozfullscreenchange', handleChange);
      document.removeEventListener('MSFullscreenChange', handleChange);
    };
  }, [checkFullscreen]);

  return {
    isFullscreen,
    toggleFullscreen,
    enterFullscreen,
    exitFullscreen,
  };
}
