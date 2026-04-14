'use client';

import Matter from 'matter-js';
import { create } from 'zustand';

import { createRuleEngine, RuleEngine } from '@/engine/game/rules';
import { BALL_RADIUS, createInitialBalls, createTable } from '@/engine/game/setup';
import {
  applyCueStrike,
  createBallBody,
  createPhysicsWorld,
  createTableBodies,
  isWorldSleeping,
  syncBallsFromBodies,
} from '@/engine/physics/world';
import { Ball, Cue, GameEvent, GameMode, GameState, Table, Vector2 } from '@/engine/types';

export type MultiplayerGameEvent =
  | { type: 'SHOT_FIRED'; angle: number; power: number; spin: Vector2 }
  | { type: 'BALL_POCKETED'; ballId: string; pocketId: string }
  | { type: 'TURN_END'; nextPlayer: 1 | 2 }
  | { type: 'GAME_OVER'; winner: 1 | 2; finalScore: { p1: number; p2: number } }
  | { type: 'GROUP_ASSIGNED'; player: 1 | 2; group: 'solid' | 'stripe' };

type GameEventListener = (event: MultiplayerGameEvent) => void;

interface GameStore extends GameState {
  events: GameEvent[];
  table: Table;
  ruleEngine: RuleEngine;
  startAiming: () => void;
  updateAim: (mousePos: Vector2) => void;
  startCharging: () => void;
  updatePower: (power: number) => void;
  shoot: () => void;
  applyOpponentShot: (angle: number, power: number, spin: Vector2) => void;
  applyRemoteEvent: (event: MultiplayerGameEvent) => void;
  onGameEvent: (listener: GameEventListener) => () => void;
  resetGame: (mode?: GameMode) => void;
  setMode: (mode: GameMode) => void;
}

type ShotTracker = {
  pocketedBallIds: Set<string>;
  pocketedByBallId: Map<string, string>;
  whiteHitBallIds: Set<string>;
  firstHitBallId: string | null;
  whitePocketed: boolean;
  cushionHits: number;
};

const DEFAULT_CUE: Cue = {
  angle: 0,
  power: 0,
  spin: { x: 0, y: 0 },
  position: { x: 0, y: 0 },
  isAiming: true,
};

function isBallLabel(label: string): boolean {
  return label.startsWith('ball-');
}

function isPocketLabel(label: string): boolean {
  return label.startsWith('pocket-');
}

function isCushionLabel(label: string): boolean {
  return label.startsWith('cushion-') || label.startsWith('corner-');
}

function getPocketId(label: string): string {
  return label.replace('pocket-', '');
}

function getBallId(label: string): string {
  return label.replace('ball-', '');
}

// ==================== GAME STORE FACTORY ====================
function createGameStore(mode: GameMode = 'snooker') {
  return create<GameStore>((set, get) => {
    const engine = createPhysicsWorld();
    const table = createTable(mode);
    const ruleEngine = createRuleEngine(mode);
    const ballBodies = new Map<string, Matter.Body>();
    const listeners = new Set<GameEventListener>();
    let frameId: number | null = null;
    let tracker: ShotTracker = {
      pocketedBallIds: new Set<string>(),
      pocketedByBallId: new Map<string, string>(),
      whiteHitBallIds: new Set<string>(),
      firstHitBallId: null,
      whitePocketed: false,
      cushionHits: 0,
    };

    function emitGameEvent(event: MultiplayerGameEvent): void {
      listeners.forEach(listener => listener(event));
    }

    function clearFrame(): void {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
        frameId = null;
      }
    }

    function resetTracker(): void {
      tracker = {
        pocketedBallIds: new Set<string>(),
        pocketedByBallId: new Map<string, string>(),
        whiteHitBallIds: new Set<string>(),
        firstHitBallId: null,
        whitePocketed: false,
        cushionHits: 0,
      };
    }

    function repopulateWorld(nextBalls: Ball[]): void {
      Matter.Composite.clear(engine.world, false);
      ballBodies.clear();

      nextBalls.forEach(ball => {
        const body = createBallBody(ball);
        ballBodies.set(ball.id, body);
        Matter.Composite.add(engine.world, body);
      });

      const { cushionBodies, pocketBodies } = createTableBodies(table);
      Matter.Composite.add(engine.world, [...cushionBodies, ...pocketBodies]);
    }

    function finalizeTurn(): void {
      const state = get();
      const balls = syncBallsFromBodies(state.balls, ballBodies).map(ball => {
        if (!tracker.pocketedBallIds.has(ball.id)) {
          return ball;
        }

        return {
          ...ball,
          inPocket: true,
          velocity: { x: 0, y: 0 },
          pocketedAt: Date.now(),
        };
      });

      const ballsPocketed = balls.filter(ball => tracker.pocketedBallIds.has(ball.id) && ball.id !== 'white');
      const whiteHitBalls = balls.filter(ball => tracker.whiteHitBallIds.has(ball.id));
      const firstHitBall = tracker.firstHitBallId
        ? balls.find(b => b.id === tracker.firstHitBallId) ?? null
        : null;

      const result = state.ruleEngine.calculateShotResult(
        state,
        ballsPocketed,
        whiteHitBalls,
        tracker.whitePocketed,
        tracker.cushionHits,
        firstHitBall
      );

      // Update scores
      const scores =
        state.currentPlayer === 1
          ? { ...state.scores, p1: state.scores.p1 + result.points }
          : { ...state.scores, p2: state.scores.p2 + result.points };

      // Handle group assignment for 8-ball
      let playerGroups = state.playerGroups;
      if (state.mode === 'eightball' && !playerGroups?.p1 && !playerGroups?.p2) {
        const pocketedGroup = ballsPocketed.find(b => b.group)?.group;
        if (pocketedGroup) {
          playerGroups = {
            p1: state.currentPlayer === 1 ? pocketedGroup : (pocketedGroup === 'solid' ? 'stripe' : 'solid'),
            p2: state.currentPlayer === 2 ? pocketedGroup : (pocketedGroup === 'solid' ? 'stripe' : 'solid'),
          };
          emitGameEvent({ type: 'GROUP_ASSIGNED', player: 1, group: playerGroups.p1! });
          emitGameEvent({ type: 'GROUP_ASSIGNED', player: 2, group: playerGroups.p2! });
        }
      }

      // Handle cue ball respawn
      const cueBall = balls.find(ball => ball.id === 'white');
      const cuePosition = cueBall?.inPocket
        ? { x: table.width * 0.25, y: table.height / 2 }
        : cueBall?.position ?? DEFAULT_CUE.position;

      const normalizedBalls = balls.map(ball => {
        if (ball.id !== 'white' || !ball.inPocket) {
          return ball;
        }

        return {
          ...ball,
          inPocket: false,
          pocketedAt: undefined,
          position: cuePosition,
          velocity: { x: 0, y: 0 },
        };
      });

      repopulateWorld(normalizedBalls);

      const nextEvents = [...state.events, ...result.events, { type: 'TURN_END' as const }];

      set({
        balls: normalizedBalls,
        phase: 'aiming',
        currentPlayer: result.nextPlayer,
        scores,
        fouls: result.fouls,
        lastShotValid: result.valid,
        events: nextEvents,
        playerGroups,
        cue: {
          ...state.cue,
          power: 0,
          isAiming: true,
          position: cuePosition,
        },
      });

      ballsPocketed.forEach(ball => {
        emitGameEvent({
          type: 'BALL_POCKETED',
          ballId: ball.id,
          pocketId: tracker.pocketedByBallId.get(ball.id) ?? 'unknown',
        });
      });

      emitGameEvent({
        type: 'TURN_END',
        nextPlayer: result.nextPlayer,
      });

      // Check victory
      if (result.gameOver && result.winner) {
        emitGameEvent({
          type: 'GAME_OVER',
          winner: result.winner,
          finalScore: scores,
        });
        set({ phase: 'scoring' });
      } else {
        const victory = state.ruleEngine.checkVictory({ ...state, scores });
        if (victory.finished && victory.winner) {
          emitGameEvent({
            type: 'GAME_OVER',
            winner: victory.winner,
            finalScore: scores,
          });
          set({ phase: 'scoring' });
        }
      }

      resetTracker();
    }

    function runPhysicsLoop(): void {
      Matter.Engine.update(engine, 1000 / 60);

      const nextBalls = syncBallsFromBodies(get().balls, ballBodies).map(ball => ({
        ...ball,
        inPocket: tracker.pocketedBallIds.has(ball.id) ? true : ball.inPocket,
      }));

      set({
        balls: nextBalls,
        phase: 'simulating',
      });

      if (isWorldSleeping(engine)) {
        clearFrame();
        set({ phase: 'scoring' });
        finalizeTurn();
        return;
      }

      frameId = window.requestAnimationFrame(runPhysicsLoop);
    }

    function executeShot(cue: Cue, source: 'local' | 'remote'): void {
      const whiteBody = ballBodies.get('white');
      if (!whiteBody || cue.power < 5) {
        return;
      }

      clearFrame();
      resetTracker();
      applyCueStrike(whiteBody, cue);

      set(state => ({
        phase: 'shooting',
        cue: { ...cue, power: 0, isAiming: false },
        events: [...state.events, { type: 'CUE_HIT', velocity: cue.power }],
      }));

      if (source === 'local') {
        emitGameEvent({
          type: 'SHOT_FIRED',
          angle: cue.angle,
          power: cue.power,
          spin: cue.spin,
        });
      }

      frameId = window.requestAnimationFrame(runPhysicsLoop);
    }

    const initialBalls = createInitialBalls(mode);
    repopulateWorld(initialBalls);

    Matter.Events.on(engine, 'collisionStart', event => {
      event.pairs.forEach(pair => {
        const labels = [pair.bodyA.label, pair.bodyB.label];
        const ballBody = isBallLabel(labels[0]) ? pair.bodyA : isBallLabel(labels[1]) ? pair.bodyB : null;
        const otherBody = ballBody === pair.bodyA ? pair.bodyB : pair.bodyA;

        if (!ballBody || !otherBody) {
          return;
        }

        const ballId = getBallId(ballBody.label);

        // Track pocketing
        if (isPocketLabel(otherBody.label)) {
          tracker.pocketedBallIds.add(ballId);
          tracker.pocketedByBallId.set(ballId, getPocketId(otherBody.label));
          if (ballId === 'white') {
            tracker.whitePocketed = true;
          }
          Matter.Body.setVelocity(ballBody, { x: 0, y: 0 });
          Matter.Body.setPosition(ballBody, { x: otherBody.position.x, y: otherBody.position.y });
        }

        // Track white ball hits (only first hit)
        if (ballId === 'white' && isBallLabel(otherBody.label)) {
          const hitBallId = getBallId(otherBody.label);
          tracker.whiteHitBallIds.add(hitBallId);
          if (!tracker.firstHitBallId) {
            tracker.firstHitBallId = hitBallId;
          }
        }

        // Track cushion hits
        if (isCushionLabel(otherBody.label)) {
          tracker.cushionHits += 1;
        }
      });
    });

    return {
      mode,
      phase: 'aiming',
      balls: initialBalls,
      cue: {
        ...DEFAULT_CUE,
        position: initialBalls[0]?.position ?? { x: BALL_RADIUS * 8, y: BALL_RADIUS * 8 },
      },
      table,
      currentPlayer: 1,
      scores: { p1: 0, p2: 0 },
      fouls: [],
      lastShotValid: true,
      events: [],
      playerGroups: { p1: null, p2: null },
      remainingReds: mode === 'snooker' || mode === 'brazilian' ? 15 : undefined,
      ruleEngine,

      startAiming: () => {
        const state = get();
        set({
          phase: 'aiming',
          cue: { ...state.cue, isAiming: true },
        });
      },

      updateAim: mousePos => {
        const { balls, cue, phase } = get();
        if (phase !== 'aiming' && phase !== 'charging') {
          return;
        }

        const whiteBall = balls.find(ball => ball.id === 'white');
        if (!whiteBall) {
          return;
        }

        const dx = mousePos.x - whiteBall.position.x;
        const dy = mousePos.y - whiteBall.position.y;
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

        set({
          cue: {
            ...cue,
            angle: angle + 180,
            position: whiteBall.position,
          },
        });
      },

      startCharging: () => {
        const state = get();
        if (state.phase !== 'aiming') {
          return;
        }

        set({
          phase: 'charging',
          cue: { ...state.cue, isAiming: true, power: 12 },
        });
      },

      updatePower: power => {
        const state = get();
        if (state.phase !== 'charging') {
          return;
        }

        set({
          cue: {
            ...state.cue,
            power: Math.max(0, Math.min(100, power)),
          },
        });
      },

      shoot: () => {
        const state = get();
        if (state.phase !== 'charging') {
          set({
            phase: 'aiming',
            cue: { ...state.cue, power: 0, isAiming: true },
          });
          return;
        }

        executeShot(state.cue, 'local');
      },

      applyOpponentShot: (angle, power, spin) => {
        const whiteBall = get().balls.find(ball => ball.id === 'white');
        const cue: Cue = {
          angle,
          power,
          spin,
          position: whiteBall?.position ?? DEFAULT_CUE.position,
          isAiming: false,
        };

        set({ cue });
        executeShot(cue, 'remote');
      },

      applyRemoteEvent: event => {
        if (event.type === 'BALL_POCKETED') {
          set(state => ({
            balls: state.balls.map(ball =>
              ball.id === event.ballId
                ? {
                    ...ball,
                    inPocket: true,
                    pocketedAt: Date.now(),
                    velocity: { x: 0, y: 0 },
                  }
                : ball
            ),
          }));
          return;
        }

        if (event.type === 'GROUP_ASSIGNED') {
          set(state => {
            const newGroups: { p1: 'solid' | 'stripe' | null; p2: 'solid' | 'stripe' | null } = {
              p1: state.playerGroups?.p1 ?? null,
              p2: state.playerGroups?.p2 ?? null,
            };
            if (event.player === 1) {
              newGroups.p1 = event.group;
            } else {
              newGroups.p2 = event.group;
            }
            return { playerGroups: newGroups };
          });
          return;
        }

        if (event.type === 'TURN_END') {
          set(state => ({
            currentPlayer: event.nextPlayer,
            phase: 'aiming',
            cue: { ...state.cue, power: 0, isAiming: true },
          }));
          return;
        }

        if (event.type === 'GAME_OVER') {
          set({
            phase: 'scoring',
            scores: event.finalScore,
          });
        }
      },

      onGameEvent: listener => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },

      resetGame: (newMode?: GameMode) => {
        clearFrame();
        resetTracker();
        const gameMode = newMode ?? get().mode;
        const nextTable = createTable(gameMode);
        const nextBalls = createInitialBalls(gameMode);
        const nextRuleEngine = createRuleEngine(gameMode);

        // Recreate world with new table
        Matter.Composite.clear(engine.world, false);
        ballBodies.clear();

        nextBalls.forEach(ball => {
          const body = createBallBody(ball);
          ballBodies.set(ball.id, body);
          Matter.Composite.add(engine.world, body);
        });

        const { cushionBodies, pocketBodies } = createTableBodies(nextTable);
        Matter.Composite.add(engine.world, [...cushionBodies, ...pocketBodies]);

        set({
          mode: gameMode,
          phase: 'aiming',
          balls: nextBalls,
          table: nextTable,
          cue: {
            ...DEFAULT_CUE,
            position: nextBalls[0]?.position ?? DEFAULT_CUE.position,
          },
          currentPlayer: 1,
          scores: { p1: 0, p2: 0 },
          fouls: [],
          lastShotValid: true,
          events: [],
          playerGroups: { p1: null, p2: null },
          remainingReds: gameMode === 'snooker' || gameMode === 'brazilian' ? 15 : undefined,
          ruleEngine: nextRuleEngine,
        });
      },

      setMode: (newMode: GameMode) => {
        get().resetGame(newMode);
      },
    };
  });
}

// Default store instance (snooker mode)
export const useGame = createGameStore('snooker');

// Factory for creating mode-specific stores
export function createGame(mode: GameMode = 'snooker') {
  return createGameStore(mode);
}
