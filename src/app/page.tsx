'use client';

import Link from 'next/link';
import { useState } from 'react';

import { GameMode } from '@/engine/types';
import { getModeConfig } from '@/engine/game/modeConfigs';

const MODES: GameMode[] = ['snooker', 'eightball', 'nineball', 'brazilian'];

export default function HomePage(): JSX.Element {
  const [selectedMode, setSelectedMode] = useState<GameMode>('snooker');

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#020617,#07111d_38%,#0f172a)] px-6 py-10 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <section className="overflow-hidden rounded-[36px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-8 shadow-[0_28px_90px_rgba(0,0,0,0.45)] backdrop-blur md:p-12">
          <p className="text-xs uppercase tracking-[0.38em] text-emerald-300/75">Sinuca Premiere</p>
          <h1 className="mt-4 max-w-4xl text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
            Premium pool with tactile physics and a broadcast-grade table feel.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
            Multi-mode billiards engine featuring Snooker, 8-Ball, 9-Ball, and Brazilian Sinuca.
            Deterministic Matter.js simulation, premium canvas rendering, and strict typing.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={`/game?mode=${selectedMode}`}
              className="rounded-full bg-emerald-500 px-6 py-3 font-medium text-slate-950 transition hover:bg-emerald-400"
            >
              Launch Table
            </Link>
            <Link
              href="/lobby"
              className="rounded-full border border-white/15 px-6 py-3 font-medium text-slate-100 transition hover:border-white/30 hover:bg-white/10"
            >
              Open Lobby
            </Link>
          </div>
        </section>

        {/* Mode Selection */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-white/80">Select Game Mode</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {MODES.map(mode => {
              const config = getModeConfig(mode);
              const isSelected = selectedMode === mode;

              return (
                <button
                  key={mode}
                  onClick={() => setSelectedMode(mode)}
                  className={`rounded-[28px] border p-6 text-left backdrop-blur transition ${
                    isSelected
                      ? 'border-emerald-500/50 bg-emerald-500/10'
                      : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-semibold">{config.name}</p>
                    {isSelected && (
                      <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-medium text-slate-950">
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-400">{config.description}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-white/60">
                      {config.ballCount} balls
                    </span>
                    {config.hasColors && (
                      <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-white/60">
                        Colors
                      </span>
                    )}
                    {config.hasGroups && (
                      <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-white/60">
                        Groups
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Stats */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ['Language', 'English-first'],
            ['Physics', 'Matter.js 2D / 60fps'],
            ['Renderer', 'Canvas 2.5D lighting'],
            ['State', 'Zustand strict store'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur">
              <p className="text-sm text-slate-400">{label}</p>
              <p className="mt-3 text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
