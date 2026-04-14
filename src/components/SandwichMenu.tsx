'use client';

import { useEffect, useState } from 'react';
import { useFullscreen } from '@/hooks/useFullscreen';

interface GameState {
  phase: string;
  scores: { p1: number; p2: number };
  currentPlayer: 1 | 2;
  cue: { power: number };
  fouls: string[];
  lastShotValid: boolean;
}

interface SandwichMenuProps {
  game: GameState;
  isMyTurn: boolean;
  multiplayer: boolean;
  onReset: () => void;
  onHome: () => void;
}

export function SandwichMenu({ game, isMyTurn, multiplayer, onReset, onHome }: SandwichMenuProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close on swipe right
  const handleTouchStart = (e: React.TouchEvent): void => {
    const touch = e.touches[0];
    (e.currentTarget as HTMLDivElement).dataset.startX = String(touch.clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent): void => {
    const startX = Number((e.currentTarget as HTMLDivElement).dataset.startX);
    const endX = e.changedTouches[0].clientX;
    if (endX - startX > 80) {
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Hamburger button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed right-3 top-3 z-40 rounded-lg bg-black/70 p-2 text-white/80 backdrop-blur-md transition hover:bg-black/90 md:hidden"
        aria-label="Open menu"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Overlay backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-250 ease-out md:hidden ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setIsOpen(false)}
      />

      {/* Drawer panel */}
      <aside
        className={`fixed right-0 top-0 z-50 h-full w-[280px] transform bg-[#0a0a0f] shadow-2xl transition-transform duration-250 ease-out md:hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white/60">Menu</h2>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
            aria-label="Close menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Drawer content */}
        <div className="space-y-4 overflow-y-auto p-4">
          {/* Match section */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-white/40">Match</h3>

            {/* Scores */}
            <div className="mb-3 grid grid-cols-2 gap-2">
              <div className={`rounded-lg p-3 ${game.currentPlayer === 1 ? 'bg-blue-500/20' : 'bg-white/5'}`}>
                <div className="text-[10px] text-white/50">Player 1</div>
                <div className={`text-xl font-bold ${game.currentPlayer === 1 ? 'text-blue-400' : 'text-white'}`}>
                  {game.scores.p1}
                </div>
              </div>
              <div className={`rounded-lg p-3 ${game.currentPlayer === 2 ? 'bg-pink-500/20' : 'bg-white/5'}`}>
                <div className="text-[10px] text-white/50">Player 2</div>
                <div className={`text-xl font-bold ${game.currentPlayer === 2 ? 'text-pink-400' : 'text-white'}`}>
                  {game.scores.p2}
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-white/50">Turn</span>
                <span className={game.currentPlayer === 1 ? 'text-blue-400' : 'text-pink-400'}>
                  Player {game.currentPlayer}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Phase</span>
                <span className="capitalize text-white">{game.phase}</span>
              </div>
              {multiplayer && (
                <div className="flex justify-between">
                  <span className="text-white/50">Status</span>
                  <span className={isMyTurn ? 'text-green-400' : 'text-yellow-400'}>
                    {isMyTurn ? 'Your turn' : 'Waiting'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Power bar */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="mb-2 flex justify-between text-xs">
              <span className="text-white/50">Power</span>
              <span className="text-white">{Math.round(game.cue.power)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all"
                style={{ width: `${game.cue.power}%` }}
              />
            </div>
          </div>

          {/* Last shot */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs">
              <span className={game.lastShotValid ? 'text-green-400' : 'text-rose-400'}>
                {game.lastShotValid ? '✓ Last shot: valid' : '✗ Last shot: foul'}
              </span>
              {game.fouls.length > 0 && (
                <p className="mt-1 text-rose-300">{game.fouls[0]}</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                void toggleFullscreen();
              }}
              className="w-full rounded-lg bg-emerald-600/80 py-3 text-sm font-medium text-white transition hover:bg-emerald-500"
            >
              {isFullscreen ? '⛶ Exit Fullscreen' : '⛶ Enter Fullscreen'}
            </button>
            <button
              type="button"
              onClick={onReset}
              className="w-full rounded-lg bg-white/10 py-3 text-sm font-medium text-white transition hover:bg-white/20"
            >
              ↻ Reset Game
            </button>
            <button
              type="button"
              onClick={onHome}
              className="w-full rounded-lg border border-white/20 py-3 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
