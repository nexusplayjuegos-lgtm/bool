'use client';

import { useState, useEffect, useCallback } from 'react';
import { GameMode } from '@/engine/types';
import { getModeConfig } from '@/engine/game/modeConfigs';

interface GameUIProps {
  mode: GameMode;
  scores: { p1: number; p2: number };
  currentPlayer: 1 | 2;
  phase: string;
  power: number;
  fouls: string[];
  lastShotValid: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onExit: () => void;
}

export function GameUI({
  mode,
  scores,
  currentPlayer,
  phase,
  power,
  fouls,
  lastShotValid,
  isFullscreen,
  onToggleFullscreen,
  onExit,
}: GameUIProps) {
  const [showControls, setShowControls] = useState(false);
  const [hideTimeout, setHideTimeout] = useState<NodeJS.Timeout | null>(null);

  const scheduleHide = useCallback(() => {
    if (hideTimeout) clearTimeout(hideTimeout);
    const timeout = setTimeout(() => {
      setShowControls(false);
    }, 4000);
    setHideTimeout(timeout);
  }, [hideTimeout]);

  const toggleControls = () => {
    setShowControls(prev => {
      const next = !prev;
      if (next) scheduleHide();
      return next;
    });
  };

  useEffect(() => {
    return () => {
      if (hideTimeout) clearTimeout(hideTimeout);
    };
  }, [hideTimeout]);

  const modeName = getModeConfig(mode).name;

  return (
    <>
      {/* Top bar - always visible */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-center justify-between p-3">
        {/* Mode name */}
        <div className="pointer-events-auto rounded-lg bg-black/60 px-3 py-1.5 backdrop-blur-sm">
          <span className="text-[10px] uppercase tracking-wider text-white/50">{modeName}</span>
        </div>

        {/* Menu button - opens controls */}
        <button
          onClick={toggleControls}
          className="pointer-events-auto rounded-lg bg-black/60 p-2 text-white/70 backdrop-blur-sm transition hover:bg-black/80 hover:text-white"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Controls overlay - only when active */}
      {showControls && (
        <div
          className="absolute inset-0 z-30 flex flex-col bg-black/60 backdrop-blur-sm"
          onClick={() => setShowControls(false)}
        >
          {/* Top controls */}
          <div className="flex items-start justify-between p-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExit();
              }}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              ← Back
            </button>

            {!isFullscreen && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFullscreen();
                }}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-lg transition hover:bg-emerald-500"
              >
                ⛶ Fullscreen
              </button>
            )}

            {isFullscreen && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFullscreen();
                }}
                className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                ⛶ Exit
              </button>
            )}
          </div>

          {/* Center - closes controls */}
          <div className="flex-1" onClick={() => setShowControls(false)} />

          {/* Bottom HUD */}
          <div
            className="mx-auto mb-4 w-full max-w-md rounded-2xl bg-black/80 p-4 backdrop-blur-md"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Scores */}
            <div className="mb-3 flex gap-3">
              <div className={`flex-1 rounded-xl p-3 ${currentPlayer === 1 ? 'bg-blue-500/20' : 'bg-white/5'}`}>
                <div className="text-xs text-white/50">Player 1</div>
                <div className={`text-2xl font-bold ${currentPlayer === 1 ? 'text-blue-400' : 'text-white'}`}>
                  {scores.p1}
                </div>
              </div>
              <div className={`flex-1 rounded-xl p-3 ${currentPlayer === 2 ? 'bg-pink-500/20' : 'bg-white/5'}`}>
                <div className="text-xs text-white/50">Player 2</div>
                <div className={`text-2xl font-bold ${currentPlayer === 2 ? 'text-pink-400' : 'text-white'}`}>
                  {scores.p2}
                </div>
              </div>
            </div>

            {/* Power bar */}
            <div className="mb-3">
              <div className="mb-1 flex justify-between text-xs text-white/50">
                <span>Power</span>
                <span>{Math.round(power)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all"
                  style={{ width: `${power}%` }}
                />
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/50">Phase: <span className="text-white capitalize">{phase}</span></span>
              <span className={lastShotValid ? 'text-green-400' : 'text-red-400'}>
                {lastShotValid ? 'Valid shot' : fouls.length > 0 ? fouls[0] : 'Foul'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Minimal HUD - always visible, doesn't block game */}
      <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-20 flex items-end justify-between">
        {/* Score mini */}
        <div className="flex gap-2">
          <div className={`rounded-lg px-2 py-1 text-sm font-bold ${currentPlayer === 1 ? 'bg-blue-500/40 text-blue-200' : 'bg-white/10 text-white/60'}`}>
            P1: {scores.p1}
          </div>
          <div className={`rounded-lg px-2 py-1 text-sm font-bold ${currentPlayer === 2 ? 'bg-pink-500/40 text-pink-200' : 'bg-white/10 text-white/60'}`}>
            P2: {scores.p2}
          </div>
        </div>

        {/* Phase indicator */}
        <div className="rounded-lg bg-black/40 px-2 py-1 text-[10px] text-white/40 capitalize">
          {phase}
        </div>
      </div>
    </>
  );
}
