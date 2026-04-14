export type Vector2 = { x: number; y: number };

export type GameMode = 'snooker' | 'eightball' | 'nineball' | 'brazilian';

export type FormationType =
  | { type: 'snooker_triangle'; rows: 5; startX: number; startY: number }
  | { type: 'eightball_triangle'; base: 'random' | 'alternating' }
  | { type: 'nineball_diamond'; size: 3 }
  | { type: 'brazilian_triangle'; rows: 5 };

export interface ModeConfig {
  id: GameMode;
  name: string;
  description: string;
  ballCount: number;
  tableRatio: number;
  pocketCount: 6;
  hasColors: boolean;
  hasGroups: boolean;
  formation: FormationType;
}

export type BallType = 'white' | 'red' | 'color' | 'solid' | 'stripe' | 'black';

export type BallColor =
  | 'white'
  | 'red'
  | 'yellow'
  | 'green'
  | 'brown'
  | 'blue'
  | 'pink'
  | 'black'
  | 'orange'
  | 'purple'
  | 'maroon'
  | 'cyan';

export interface Ball {
  id: string;
  type: BallType;
  color: BallColor;
  number: number;
  group?: 'solid' | 'stripe' | null;
  position: Vector2;
  velocity: Vector2;
  radius: number;
  mass: number;
  inPocket: boolean;
  pocketedAt?: number;
}

export interface Pocket {
  id: string;
  position: Vector2;
  radius: number;
}

export interface Table {
  width: number;
  height: number;
  pockets: Pocket[];
  cushionWidth: number;
}

export interface Cue {
  angle: number;
  power: number;
  spin: Vector2;
  position: Vector2;
  isAiming: boolean;
}

export type GamePhase =
  | 'aiming'
  | 'charging'
  | 'shooting'
  | 'simulating'
  | 'scoring';

export interface GameState {
  mode: GameMode;
  phase: GamePhase;
  balls: Ball[];
  cue: Cue;
  currentPlayer: 1 | 2;
  scores: { p1: number; p2: number };
  fouls: string[];
  lastShotValid: boolean;
  playerGroups?: { p1: 'solid' | 'stripe' | null; p2: 'solid' | 'stripe' | null };
  remainingReds?: number;
}

export type GameEvent =
  | { type: 'BALL_POCKETED'; ball: Ball; pocketId: string }
  | { type: 'CUE_HIT'; velocity: number }
  | { type: 'CUSHION_HIT' }
  | { type: 'FOUL'; reason: string }
  | { type: 'TURN_END' };
