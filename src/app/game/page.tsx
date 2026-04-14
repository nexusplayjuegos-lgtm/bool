'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import { GameUI } from '@/components/GameUI';
import { GameMode, Vector2 } from '@/engine/types';
import { createGame } from '@/hooks/useGame';
import { useAutoFullscreen } from '@/hooks/useAutoFullscreen';
import { AdaptiveRenderer } from '@/render/canvas/AdaptiveRenderer';

function GamePageContent(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modeParam = searchParams.get('mode') as GameMode | null;
  const gameMode: GameMode = modeParam && ['snooker', 'eightball', 'nineball', 'brazilian'].includes(modeParam)
    ? modeParam
    : 'snooker';

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<AdaptiveRenderer | null>(null);
  const gameStoreRef = useRef<ReturnType<typeof createGame> | null>(null);
  const animationRef = useRef<number>(0);

  // Initialize game store once
  if (!gameStoreRef.current) {
    gameStoreRef.current = createGame(gameMode);
  }

  const gameStore = gameStoreRef.current;

  // Subscribe to game state changes
  const [gameState, setGameState] = useState(() => gameStore.getState());

  useEffect(() => {
    const unsubscribe = gameStore.subscribe((state) => {
      setGameState(state);
    });
    return unsubscribe;
  }, [gameStore]);

  // Viewport state
  const [viewport, setViewport] = useState<{
    width: number;
    height: number;
    device: 'mobile' | 'tablet' | 'desktop';
  }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
    device: 'desktop',
  });

  // Auto fullscreen
  const { isFullscreen, toggleFullscreen } = useAutoFullscreen({
    enabled: true,
  });

  // Update viewport on resize
  useEffect(() => {
    const updateViewport = () => {
      const width = Math.max(window.innerWidth, 320);
      const height = Math.max(window.innerHeight, 500);
      const device = width < 768 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';
      setViewport({ width, height, device });
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);

    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
    };
  }, []);

  // Initialize/update renderer
  useEffect(() => {
    if (!canvasRef.current) return;

    if (!rendererRef.current) {
      rendererRef.current = new AdaptiveRenderer(canvasRef.current, viewport);
    } else {
      rendererRef.current.updateViewport(viewport, canvasRef.current);
    }
  }, [viewport]);

  // Render loop
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    const render = () => {
      const state = gameStore.getState();

      renderer.clear();
      renderer.renderTable(state.table);

      state.balls.forEach((ball) => {
        if (!ball.inPocket) {
          renderer.renderBall(ball);
        }
      });

      const whiteBall = state.balls.find((b) => b.id === 'white');
      if (whiteBall && !whiteBall.inPocket) {
        renderer.renderCue(state.cue, state.phase, whiteBall.position);
      }

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [gameStore]);

  // Input handlers
  const getPointerPosition = useCallback(
    (clientX: number, clientY: number): Vector2 | null => {
      const renderer = rendererRef.current;
      if (!renderer) return null;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return null;

      const screenX = clientX - rect.left;
      const screenY = clientY - rect.top;

      return renderer.toTable(screenX, screenY);
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const point = getPointerPosition(e.clientX, e.clientY);
      if (!point) return;

      const state = gameStore.getState();
      if (state.phase === 'aiming') {
        gameStore.getState().updateAim(point);
      } else if (state.phase === 'charging') {
        const whiteBall = state.balls.find((b) => b.id === 'white');
        if (!whiteBall) return;

        const dx = point.x - whiteBall.position.x;
        const dy = point.y - whiteBall.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        gameStore.getState().updatePower(Math.min(100, Math.max(10, distance * 0.5)));
      }
    },
    [gameStore, getPointerPosition]
  );

  const handleMouseDown = useCallback(() => {
    const state = gameStore.getState();
    if (state.phase === 'aiming') {
      gameStore.getState().startCharging();
    }
  }, [gameStore]);

  const handleMouseUp = useCallback(() => {
    const state = gameStore.getState();
    if (state.phase === 'charging') {
      gameStore.getState().shoot();
    }
  }, [gameStore]);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (!touch) return;

      const point = getPointerPosition(touch.clientX, touch.clientY);
      if (!point) return;

      const state = gameStore.getState();
      if (state.phase === 'aiming') {
        gameStore.getState().updateAim(point);
      } else if (state.phase === 'charging') {
        const whiteBall = state.balls.find((b) => b.id === 'white');
        if (!whiteBall) return;

        const dx = point.x - whiteBall.position.x;
        const dy = point.y - whiteBall.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        gameStore.getState().updatePower(Math.min(100, Math.max(10, distance * 0.5)));
      }
    },
    [gameStore, getPointerPosition]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      const state = gameStore.getState();
      if (state.phase === 'aiming') {
        gameStore.getState().startCharging();
      }
    },
    [gameStore]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      const state = gameStore.getState();
      if (state.phase === 'charging') {
        gameStore.getState().shoot();
      }
    },
    [gameStore]
  );

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0a0a0f]">
      {/* Canvas - fills entire screen */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block touch-none"
        style={{ touchAction: 'none' }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchMove={handleTouchMove}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      />

      {/* Game UI */}
      <GameUI
        mode={gameState.mode}
        scores={gameState.scores}
        currentPlayer={gameState.currentPlayer}
        phase={gameState.phase}
        power={gameState.cue.power}
        fouls={gameState.fouls}
        lastShotValid={gameState.lastShotValid}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        onExit={() => router.push('/')}
      />
    </div>
  );
}

export default function GamePage(): JSX.Element {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#0a0a0f] text-white">Loading...</div>}>
      <GamePageContent />
    </Suspense>
  );
}
