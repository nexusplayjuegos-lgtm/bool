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
  const gameRef = useRef<ReturnType<typeof createGame> | null>(null);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Initialize game store
  if (!gameRef.current) {
    gameRef.current = createGame(gameMode);
  }

  const game = gameRef.current();

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

  // Render loop - optimized at 60fps
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    const render = (timestamp: number) => {
      // Throttle to ~60fps
      if (timestamp - lastTimeRef.current < 16) {
        animationRef.current = requestAnimationFrame(render);
        return;
      }
      lastTimeRef.current = timestamp;

      const currentGame = game;

      renderer.clear();
      renderer.renderTable(currentGame.table);

      currentGame.balls.forEach((ball) => {
        renderer.renderBall(ball);
      });

      const whiteBall = currentGame.balls.find((b) => b.id === 'white');
      if (whiteBall) {
        renderer.renderCue(currentGame.cue, currentGame.phase, whiteBall.position);
      }

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [game]);

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

      if (game.phase === 'aiming') {
        game.updateAim(point);
      } else if (game.phase === 'charging') {
        const whiteBall = game.balls.find((b) => b.id === 'white');
        if (!whiteBall) return;

        const dx = point.x - whiteBall.position.x;
        const dy = point.y - whiteBall.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        game.updatePower(Math.min(100, Math.max(10, distance * 0.5)));
      }
    },
    [game, getPointerPosition]
  );

  const handleMouseDown = useCallback(() => {
    if (game.phase === 'aiming') {
      game.startCharging();
    }
  }, [game]);

  const handleMouseUp = useCallback(() => {
    if (game.phase === 'charging') {
      game.shoot();
    }
  }, [game]);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (!touch) return;

      const point = getPointerPosition(touch.clientX, touch.clientY);
      if (!point) return;

      if (game.phase === 'aiming') {
        game.updateAim(point);
      } else if (game.phase === 'charging') {
        const whiteBall = game.balls.find((b) => b.id === 'white');
        if (!whiteBall) return;

        const dx = point.x - whiteBall.position.x;
        const dy = point.y - whiteBall.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        game.updatePower(Math.min(100, Math.max(10, distance * 0.5)));
      }
    },
    [game, getPointerPosition]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      if (game.phase === 'aiming') {
        game.startCharging();
      }
    },
    [game]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      if (game.phase === 'charging') {
        game.shoot();
      }
    },
    [game]
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
        mode={game.mode}
        scores={game.scores}
        currentPlayer={game.currentPlayer}
        phase={game.phase}
        power={game.cue.power}
        fouls={game.fouls}
        lastShotValid={game.lastShotValid}
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
