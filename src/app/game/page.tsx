'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Ball, Cue, GameEvent, GamePhase, Table, Vector2 } from '@/engine/types';
import { MultiplayerGameEvent } from '@/hooks/useGame';
import { useGame } from '@/hooks/useGame';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { PremiumRenderer } from '@/render/canvas/PremiumRenderer';

const TABLE_WIDTH = 1200;
const TABLE_HEIGHT = 600;
const MOBILE_SHORT_HEIGHT = 540;

type PlayerNumber = 1 | 2;

interface BaseGameView {
  phase: GamePhase;
  balls: Ball[];
  cue: Cue;
  table: Table;
  currentPlayer: 1 | 2;
  scores: { p1: number; p2: number };
  fouls: string[];
  lastShotValid: boolean;
  events: GameEvent[];
  startCharging: () => void;
  updateAim: (mousePos: Vector2) => void;
  updatePower: (power: number) => void;
  shoot: () => void;
  resetGame: () => void;
}

interface MultiplayerGameView extends BaseGameView {
  broadcastShot: (angle: number, power: number, spin: Vector2) => void;
  isMyTurn: boolean;
  isHost: boolean;
  applyOpponentShot: (angle: number, power: number, spin: Vector2) => void;
  applyRemoteEvent: (event: MultiplayerGameEvent) => void;
  onGameEvent: (listener: (event: MultiplayerGameEvent) => void) => () => void;
}

type GameStoreView = BaseGameView | MultiplayerGameView;

interface SharedGameCanvasProps {
  game: GameStoreView;
  multiplayer: boolean;
  roomId: string | null;
  playerNumber: PlayerNumber | null;
}

function isMultiplayerGameView(game: GameStoreView): game is MultiplayerGameView {
  return 'broadcastShot' in game && 'isMyTurn' in game;
}

export default function GamePage(): JSX.Element {
  return (
    <Suspense fallback={<LoadingScreen message="Loading match..." />}>
      <GamePageContent />
    </Suspense>
  );
}

function GamePageContent(): JSX.Element {
  const searchParams = useSearchParams();
  const roomId = searchParams.get('room');
  const [playerNumber, setPlayerNumber] = useState<PlayerNumber | null>(null);
  const [loading, setLoading] = useState(Boolean(roomId));

  useEffect(() => {
    if (!roomId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const resolvePlayerNumber = async (): Promise<void> => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) {
          setLoading(false);
        }
        return;
      }

      const { data } = await supabase
        .from('room_players')
        .select('player_number')
        .eq('room_id', roomId)
        .eq('user_id', user.id)
        .single();

      if (!cancelled) {
        setPlayerNumber((data?.player_number as PlayerNumber | undefined) ?? null);
        setLoading(false);
      }
    };

    void resolvePlayerNumber();

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  if (roomId && loading) {
    return <LoadingScreen message="Loading multiplayer table..." />;
  }

  if (roomId && !playerNumber) {
    return <ErrorScreen message="You are not part of this room." />;
  }

  return roomId && playerNumber ? (
    <MultiplayerGame roomId={roomId} playerNumber={playerNumber} />
  ) : (
    <LocalGame />
  );
}

function MultiplayerGame({
  roomId,
  playerNumber,
}: {
  roomId: string;
  playerNumber: PlayerNumber;
}): JSX.Element {
  const game = useMultiplayer(roomId, playerNumber) as MultiplayerGameView;
  return (
    <SharedGameCanvas
      game={game}
      multiplayer
      roomId={roomId}
      playerNumber={playerNumber}
    />
  );
}

function LocalGame(): JSX.Element {
  const game = useGame() as BaseGameView;
  return <SharedGameCanvas game={game} multiplayer={false} roomId={null} playerNumber={null} />;
}

function SharedGameCanvas({
  game,
  multiplayer,
  roomId,
  playerNumber,
}: SharedGameCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PremiumRenderer | null>(null);
  const latestGameRef = useRef<GameStoreView>(game);
  const resizeFrameRef = useRef<number | null>(null);
  const [showHud, setShowHud] = useState(true);
  const [canvasScale, setCanvasScale] = useState(1);
  const [isPortrait, setIsPortrait] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: TABLE_WIDTH, height: TABLE_HEIGHT });

  latestGameRef.current = game;

  const isMyTurn = multiplayer ? (isMultiplayerGameView(game) ? game.isMyTurn : false) : true;
  const recentEvents = useMemo(() => game.events.slice(-4).reverse(), [game.events]);
  const isCompactLandscape = useMemo(
    () => !isPortrait && viewportSize.height <= MOBILE_SHORT_HEIGHT,
    [isPortrait, viewportSize.height]
  );

  useEffect(() => {
    const syncViewport = (): void => {
      const nextWidth = window.visualViewport?.width ?? window.innerWidth;
      const nextHeight = window.visualViewport?.height ?? window.innerHeight;

      setViewportSize({
        width: Math.round(nextWidth),
        height: Math.round(nextHeight),
      });
      setIsPortrait(nextHeight > nextWidth);
    };

    const scheduleSync = (): void => {
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
      }

      resizeFrameRef.current = window.requestAnimationFrame(() => {
        resizeFrameRef.current = null;
        syncViewport();
      });
    };

    syncViewport();
    window.addEventListener('resize', scheduleSync);
    window.addEventListener('orientationchange', scheduleSync);
    window.visualViewport?.addEventListener('resize', scheduleSync);
    window.visualViewport?.addEventListener('scroll', scheduleSync);

    return () => {
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
      }
      window.removeEventListener('resize', scheduleSync);
      window.removeEventListener('orientationchange', scheduleSync);
      window.visualViewport?.removeEventListener('resize', scheduleSync);
      window.visualViewport?.removeEventListener('scroll', scheduleSync);
    };
  }, []);

  useEffect(() => {
    const enterFullscreen = async (): Promise<void> => {
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
      }

      try {
        const orientation = (screen as Screen & {
          orientation?: { lock?: (value: string) => Promise<void> };
        }).orientation;

        if (orientation?.lock) {
          await orientation.lock('landscape');
        }
      } catch {
      }

      if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
        setTimeout(() => window.scrollTo(0, 1), 100);
      }
    };

    void enterFullscreen();
    window.addEventListener('orientationchange', enterFullscreen);

    return () => window.removeEventListener('orientationchange', enterFullscreen);
  }, []);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    if (!rendererRef.current) {
      rendererRef.current = new PremiumRenderer(canvasRef.current, {
        width: game.table.width,
        height: game.table.height,
      });
      return;
    }

    rendererRef.current.resize(game.table.width, game.table.height);
  }, [game.table.height, game.table.width]);

  useEffect(() => {
    const updateScale = (): void => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const computed = window.getComputedStyle(container);
      const horizontalPadding =
        Number.parseFloat(computed.paddingLeft) + Number.parseFloat(computed.paddingRight);
      const verticalPadding =
        Number.parseFloat(computed.paddingTop) + Number.parseFloat(computed.paddingBottom);

      const availableWidth = Math.max(container.clientWidth - horizontalPadding, 260);
      const availableHeight = Math.max(container.clientHeight - verticalPadding, 180);
      const nextScale = Math.min(availableWidth / TABLE_WIDTH, availableHeight / TABLE_HEIGHT, 1);

      setCanvasScale(nextScale);
    };

    updateScale();

    const observer = new ResizeObserver(updateScale);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    window.addEventListener('resize', updateScale);
    window.addEventListener('orientationchange', updateScale);
    window.visualViewport?.addEventListener('resize', updateScale);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateScale);
      window.removeEventListener('orientationchange', updateScale);
      window.visualViewport?.removeEventListener('resize', updateScale);
    };
  }, [showHud, isCompactLandscape]);

  useEffect(() => {
    if (isCompactLandscape) {
      setShowHud(false);
    }
  }, [isCompactLandscape]);

  useEffect(() => {
    let animationFrameId = 0;

    const render = (): void => {
      const renderer = rendererRef.current;
      const currentGame = latestGameRef.current;
      if (!renderer) {
        animationFrameId = window.requestAnimationFrame(render);
        return;
      }

      renderer.clear();
      renderer.renderTable(currentGame.table);
      currentGame.balls.forEach(ball => {
        renderer.renderBall(ball);
      });

      const whiteBall = currentGame.balls.find(ball => ball.id === 'white');
      if (whiteBall) {
        renderer.renderCue(currentGame.cue, currentGame.phase, whiteBall.position);
      }

      animationFrameId = window.requestAnimationFrame(render);
    };

    animationFrameId = window.requestAnimationFrame(render);
    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'h' || event.key === 'H') {
        setShowHud(current => !current);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const getPointerPosition = useCallback(
    (clientX: number, clientY: number): Vector2 | null => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) {
        return null;
      }

      const scaleX = game.table.width / rect.width;
      const scaleY = game.table.height / rect.height;

      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    },
    [game.table.height, game.table.width]
  );

  const updateInteraction = useCallback(
    (clientX: number, clientY: number) => {
      if (multiplayer && !isMyTurn) {
        return;
      }

      const point = getPointerPosition(clientX, clientY);
      if (!point) {
        return;
      }

      if (game.phase === 'aiming') {
        game.updateAim(point);
        return;
      }

      if (game.phase === 'charging') {
        const whiteBall = game.balls.find(ball => ball.id === 'white');
        if (!whiteBall) {
          return;
        }

        const dx = point.x - whiteBall.position.x;
        const dy = point.y - whiteBall.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        game.updatePower(Math.min(100, Math.max(10, distance * 0.55)));
      }
    },
    [game, getPointerPosition, isMyTurn, multiplayer]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      updateInteraction(event.clientX, event.clientY);
    },
    [updateInteraction]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      if (multiplayer && !isMyTurn) {
        return;
      }

      event.currentTarget.setPointerCapture(event.pointerId);
      updateInteraction(event.clientX, event.clientY);

      if (game.phase === 'aiming') {
        game.startCharging();
      }
    },
    [game, isMyTurn, multiplayer, updateInteraction]
  );

  const finishShot = useCallback(() => {
    if (multiplayer && !isMyTurn) {
      return;
    }
    if (game.phase !== 'charging') {
      return;
    }

    if (multiplayer && isMultiplayerGameView(game)) {
      game.broadcastShot(game.cue.angle, game.cue.power, game.cue.spin);
    }

    game.shoot();
  }, [game, isMyTurn, multiplayer]);

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      finishShot();
    },
    [finishShot]
  );

  const handlePointerCancel = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      finishShot();
    },
    [finishShot]
  );

  const tableCardStyle = useMemo(
    () => ({
      width: `${TABLE_WIDTH * canvasScale}px`,
      height: `${TABLE_HEIGHT * canvasScale}px`,
      boxShadow: '0 30px 80px rgba(0, 0, 0, 0.68)',
    }),
    [canvasScale]
  );

  if (isPortrait) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#0a0a0f] px-6 text-white">
        <div className="text-5xl">Rotate</div>
        <p className="mt-4 text-center text-sm text-white/60">
          Gire o dispositivo para o modo horizontal
          <br />
          para ver a mesa inteira
        </p>
      </div>
    );
  }

  return (
    <main className="game-shell flex min-h-[100dvh] w-full flex-col overflow-hidden bg-[#0a0a0f] text-white">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2 md:px-6 md:py-3">
        <h1 className="truncate text-sm font-semibold text-white/80 md:text-lg">
          {multiplayer ? `Room - P${playerNumber}` : 'Bool Eight'}
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href={multiplayer && roomId ? `/room/${roomId}` : '/'}
            className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/70 transition hover:border-white/30 hover:bg-white/10"
          >
            {multiplayer ? 'Back' : 'Home'}
          </Link>
          <button
            type="button"
            onClick={game.resetGame}
            className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-white/85"
          >
            Reset
          </button>
        </div>
      </header>

      <section
        className={`game-layout relative flex flex-1 overflow-hidden ${
          isCompactLandscape ? 'pb-14' : ''
        }`}
      >
        <div
          ref={containerRef}
          className={`game-stage flex flex-1 items-center justify-center overflow-hidden ${
            showHud && !isCompactLandscape ? 'pr-2 md:pr-[304px]' : ''
          }`}
        >
          <div
            className="game-table-frame overflow-hidden rounded-[10px] border border-white/10 bg-black/30"
            style={tableCardStyle}
          >
            <canvas
              ref={canvasRef}
              width={TABLE_WIDTH}
              height={TABLE_HEIGHT}
              onPointerMove={handlePointerMove}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              className="game-canvas block h-full w-full cursor-crosshair"
            />
          </div>
        </div>

        {showHud ? (
          <HudPanel
            game={game}
            isMyTurn={isMyTurn}
            multiplayer={multiplayer}
            recentEvents={recentEvents}
            onHide={() => setShowHud(false)}
            compact={isCompactLandscape}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowHud(true)}
            className={`absolute rounded-full border border-white/10 bg-black/70 px-3 py-1.5 text-[11px] text-white/60 backdrop-blur ${
              isCompactLandscape
                ? 'bottom-2 left-1/2 z-20 -translate-x-1/2'
                : 'bottom-3 right-3 z-20 md:bottom-4 md:left-1/2 md:right-auto md:-translate-x-1/2'
            }`}
          >
            Controles
          </button>
        )}
      </section>
    </main>
  );
}

function HudPanel({
  game,
  isMyTurn,
  multiplayer,
  recentEvents,
  onHide,
  compact = false,
}: {
  game: GameStoreView;
  isMyTurn: boolean;
  multiplayer: boolean;
  recentEvents: Array<{ type: string }>;
  onHide: () => void;
  compact?: boolean;
}): JSX.Element {
  return (
    <aside
      className={`hud-overlay border border-white/10 bg-black/78 backdrop-blur-md ${
        compact
          ? 'absolute inset-x-2 bottom-2 z-20 rounded-2xl p-3'
          : 'absolute right-2 top-2 z-20 w-[200px] rounded-2xl p-3 sm:w-[240px] md:right-6 md:top-6 md:w-[290px] md:p-4'
      }`}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.35em] text-white/55 md:text-xs">
          Match
        </h2>
        <button
          type="button"
          onClick={onHide}
          className="text-[10px] text-white/50 transition hover:text-white md:text-xs"
        >
          [H] hide
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <ScoreCard label="P1" value={game.scores.p1} accent="text-blue-400" />
        <ScoreCard label="P2" value={game.scores.p2} accent="text-pink-400" />
      </div>

      <div
        className={`mt-3 rounded-xl bg-white/5 p-2.5 text-[11px] md:text-xs ${
          compact ? 'grid grid-cols-3 gap-2' : 'space-y-1.5'
        }`}
      >
        <StatusRow
          label="Turn"
          value={`P${game.currentPlayer}`}
          accent={game.currentPlayer === 1 ? 'text-blue-400' : 'text-pink-400'}
        />
        <StatusRow label="Phase" value={game.phase} />
        {multiplayer ? (
          <StatusRow
            label="Status"
            value={isMyTurn ? 'Your turn' : 'Waiting'}
            accent={isMyTurn ? 'text-green-400' : 'text-yellow-400'}
          />
        ) : null}
      </div>

      <div className="mt-3 rounded-xl bg-white/5 p-2.5">
        <div className="mb-1.5 flex items-center justify-between text-[10px] text-white/55 md:text-xs">
          <span>Power</span>
          <span>{Math.round(game.cue.power)}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10 md:h-2">
          <div
            className="h-full bg-[linear-gradient(90deg,#22c55e,#eab308,#dc2626)] transition-all duration-75"
            style={{ width: `${game.cue.power}%` }}
          />
        </div>
      </div>

      <div className={`mt-3 gap-3 ${compact ? 'grid grid-cols-2' : ''}`}>
        <div className="rounded-xl bg-white/5 p-2.5 text-[11px] md:text-xs">
          <p className="font-medium text-white/90">
            {game.lastShotValid ? 'Last shot: valid' : 'Last shot: foul'}
          </p>
          {game.fouls.length > 0 ? (
            <ul className="mt-1.5 space-y-1 text-rose-300">
              {game.fouls.map(foul => (
                <li key={foul}>{foul}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-white/45">No fouls on latest turn.</p>
          )}
        </div>

        <div className="rounded-xl bg-white/5 p-2.5 text-[11px] md:text-xs">
          <p className="font-medium text-white/90">Recent events</p>
          <ul className="mt-1.5 space-y-1 text-white/45">
            {recentEvents.length > 0 ? (
              recentEvents.map((event, index) => <li key={`${event.type}-${index}`}>{event.type}</li>)
            ) : (
              <li>No events yet.</li>
            )}
          </ul>
        </div>
      </div>
    </aside>
  );
}

function ScoreCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}): JSX.Element {
  return (
    <div className="rounded-xl bg-white/5 p-2.5">
      <div className="text-[10px] text-white/45 md:text-xs">{label}</div>
      <div className={`mt-1 text-lg font-bold md:text-2xl ${accent}`}>{value}</div>
    </div>
  );
}

function StatusRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}): JSX.Element {
  return (
    <div className={`${label === 'Phase' ? 'min-w-0' : ''} flex items-center justify-between gap-2`}>
      <span className="text-white/45">{label}</span>
      <span className={`min-w-0 text-right capitalize ${accent ?? 'text-white'}`}>{value}</span>
    </div>
  );
}

function LoadingScreen({ message }: { message: string }): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] text-white">
      <div className="text-center">
        <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-4 border-white/15 border-t-white" />
        <p className="text-white/55">{message}</p>
      </div>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] px-4 text-white">
      <div className="rounded-xl border border-red-500/35 bg-red-500/10 p-5">
        <p className="text-red-300">{message}</p>
      </div>
    </div>
  );
}
