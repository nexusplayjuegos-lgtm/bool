import { Ball, GameEvent, GameMode, GameState } from '@/engine/types';

export interface ShotResult {
  valid: boolean;
  points: number;
  fouls: string[];
  events: GameEvent[];
  nextPlayer: 1 | 2;
  gameOver?: boolean;
  winner?: 1 | 2 | null;
}

export interface RuleEngine {
  calculateShotResult: (
    state: GameState,
    ballsPocketed: Ball[],
    whiteHitBalls: Ball[],
    whitePocketed: boolean,
    cushionHits: number,
    firstHitBall: Ball | null
  ) => ShotResult;
  checkVictory: (state: GameState) => { winner: 1 | 2 | null; finished: boolean };
  getValidTargets: (state: GameState) => Ball[];
}

// ==================== RULE ENGINE FACTORY ====================
export function createRuleEngine(mode: GameMode): RuleEngine {
  switch (mode) {
    case 'eightball':
      return new EightBallRules();
    case 'nineball':
      return new NineBallRules();
    case 'brazilian':
      return new BrazilianRules();
    case 'snooker':
    default:
      return new SnookerRules();
  }
}

// ==================== SNOOKER RULES ====================
class SnookerRules implements RuleEngine {
  calculateShotResult(
    state: GameState,
    ballsPocketed: Ball[],
    whiteHitBalls: Ball[],
    whitePocketed: boolean,
    cushionHits: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _firstHitBall: Ball | null
  ): ShotResult {
    const events: GameEvent[] = [];
    const fouls: string[] = [];

    // Basic fouls
    if (whitePocketed) {
      fouls.push('Cue ball pocketed');
      events.push({ type: 'FOUL', reason: 'Cue ball pocketed' });
    }

    if (whiteHitBalls.length === 0 && !whitePocketed) {
      fouls.push('Empty strike');
      events.push({ type: 'FOUL', reason: 'Empty strike' });
    }

    if (cushionHits === 0 && ballsPocketed.length === 0 && whiteHitBalls.length > 0) {
      fouls.push('No rail or pocket after contact');
      events.push({ type: 'FOUL', reason: 'No rail or pocket after contact' });
    }

    let points = 0;

    ballsPocketed.forEach(ball => {
      events.push({
        type: 'BALL_POCKETED',
        ball,
        pocketId: ball.pocketedAt ? String(ball.pocketedAt) : 'unknown',
      });

      if (ball.type === 'color') {
        points += ball.number;
      } else if (ball.type === 'red') {
        points += 1;
      }
    });

    const valid = fouls.length === 0;
    const nextPlayer = valid ? state.currentPlayer : (state.currentPlayer === 1 ? 2 : 1);

    return {
      valid,
      points: valid ? points : 0,
      fouls,
      events,
      nextPlayer,
    };
  }

  checkVictory(state: GameState): { winner: 1 | 2 | null; finished: boolean } {
    const targetScore = 100;
    if (state.scores.p1 >= targetScore) {
      return { winner: 1, finished: true };
    }
    if (state.scores.p2 >= targetScore) {
      return { winner: 2, finished: true };
    }
    return { winner: null, finished: false };
  }

  getValidTargets(state: GameState): Ball[] {
    // In snooker, alternate between reds and colors
    const remainingReds = state.balls.filter(b => b.type === 'red' && !b.inPocket);
    if (remainingReds.length > 0) {
      return remainingReds;
    }
    // If no reds, target colors in order
    return state.balls.filter(b => b.type === 'color' && !b.inPocket)
      .sort((a, b) => a.number - b.number);
  }
}

// ==================== 8-BALL RULES ====================
class EightBallRules implements RuleEngine {
  calculateShotResult(
    state: GameState,
    ballsPocketed: Ball[],
    whiteHitBalls: Ball[],
    whitePocketed: boolean,
    _cushionHits: number,
    firstHitBall: Ball | null
  ): ShotResult {
    const events: GameEvent[] = [];
    const fouls: string[] = [];
    const currentGroup = state.currentPlayer === 1
      ? state.playerGroups?.p1
      : state.playerGroups?.p2;

    // Basic fouls
    if (whitePocketed) {
      fouls.push('Cue ball pocketed');
      events.push({ type: 'FOUL', reason: 'Cue ball pocketed' });
    }

    if (whiteHitBalls.length === 0 && !whitePocketed) {
      fouls.push('Empty strike');
      events.push({ type: 'FOUL', reason: 'Empty strike' });
    }

    // Check if 8-ball was pocketed
    const blackPocketed = ballsPocketed.some(b => b.type === 'black');
    const playerBalls = state.balls.filter(b =>
      b.group === currentGroup && !b.inPocket && b.type !== 'black'
    );

    if (blackPocketed) {
      if (playerBalls.length > 0) {
        // Pocketed 8-ball too early - lose
        fouls.push('8-ball pocketed too early');
        events.push({ type: 'FOUL', reason: '8-ball pocketed too early' });
        return {
          valid: false,
          points: 0,
          fouls,
          events,
          nextPlayer: state.currentPlayer === 1 ? 2 : 1,
          gameOver: true,
          winner: state.currentPlayer === 1 ? 2 : 1,
        };
      } else {
        // Legitimate 8-ball win
        events.push({ type: 'BALL_POCKETED', ball: ballsPocketed.find(b => b.type === 'black')!, pocketId: 'win' });
        return {
          valid: true,
          points: 0,
          fouls: [],
          events,
          nextPlayer: state.currentPlayer,
          gameOver: true,
          winner: state.currentPlayer,
        };
      }
    }

    // Check first hit
    if (firstHitBall && currentGroup && firstHitBall.group !== currentGroup && firstHitBall.type !== 'black') {
      fouls.push(`Must hit ${currentGroup} ball first`);
      events.push({ type: 'FOUL', reason: 'Wrong ball hit first' });
    }

    const valid = fouls.length === 0;
    const nextPlayer = valid ? state.currentPlayer : (state.currentPlayer === 1 ? 2 : 1);

    return {
      valid,
      points: 0,
      fouls,
      events,
      nextPlayer,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  checkVictory(_state: GameState): { winner: 1 | 2 | null; finished: boolean } {
    // Victory handled in shot result for 8-ball
    return { winner: null, finished: false };
  }

  getValidTargets(state: GameState): Ball[] {
    const currentGroup = state.currentPlayer === 1
      ? state.playerGroups?.p1
      : state.playerGroups?.p2;

    if (currentGroup) {
      return state.balls.filter(b => b.group === currentGroup && !b.inPocket);
    }
    // No group assigned yet - any ball is valid
    return state.balls.filter(b => (b.type === 'solid' || b.type === 'stripe') && !b.inPocket);
  }
}

// ==================== 9-BALL RULES ====================
class NineBallRules implements RuleEngine {
  calculateShotResult(
    state: GameState,
    ballsPocketed: Ball[],
    whiteHitBalls: Ball[],
    whitePocketed: boolean,
    _cushionHits: number,
    firstHitBall: Ball | null
  ): ShotResult {
    const events: GameEvent[] = [];
    const fouls: string[] = [];

    // Find lowest numbered ball on table
    const remainingBalls = state.balls.filter(b =>
      b.type !== 'white' && !b.inPocket
    );
    const lowestBall = remainingBalls.sort((a, b) => a.number - b.number)[0];

    // Basic fouls
    if (whitePocketed) {
      fouls.push('Cue ball pocketed');
      events.push({ type: 'FOUL', reason: 'Cue ball pocketed' });
    }

    if (whiteHitBalls.length === 0 && !whitePocketed) {
      fouls.push('Empty strike');
      events.push({ type: 'FOUL', reason: 'Empty strike' });
    }

    // Must hit lowest numbered ball first
    if (firstHitBall && lowestBall && firstHitBall.number !== lowestBall.number) {
      fouls.push(`Must hit lowest ball (${lowestBall.number}) first`);
      events.push({ type: 'FOUL', reason: 'Did not hit lowest ball first' });
    }

    // Check for 9-ball win (combination or direct)
    const ninePocketed = ballsPocketed.some(b => b.number === 9);
    if (ninePocketed) {
      events.push({ type: 'BALL_POCKETED', ball: ballsPocketed.find(b => b.number === 9)!, pocketId: 'win' });
      return {
        valid: true,
        points: 0,
        fouls: [],
        events,
        nextPlayer: state.currentPlayer,
        gameOver: true,
        winner: state.currentPlayer,
      };
    }

    ballsPocketed.forEach(ball => {
      events.push({
        type: 'BALL_POCKETED',
        ball,
        pocketId: ball.pocketedAt ? String(ball.pocketedAt) : 'unknown',
      });
    });

    const valid = fouls.length === 0;
    const nextPlayer = valid ? state.currentPlayer : (state.currentPlayer === 1 ? 2 : 1);

    return {
      valid,
      points: 0,
      fouls,
      events,
      nextPlayer,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  checkVictory(_state: GameState): { winner: 1 | 2 | null; finished: boolean } {
    // Victory handled in shot result
    return { winner: null, finished: false };
  }

  getValidTargets(state: GameState): Ball[] {
    const remainingBalls = state.balls.filter(b =>
      b.type !== 'white' && !b.inPocket
    );
    return remainingBalls.sort((a, b) => a.number - b.number).slice(0, 1);
  }
}

// ==================== BRAZILIAN RULES ====================
class BrazilianRules implements RuleEngine {
  calculateShotResult(
    state: GameState,
    ballsPocketed: Ball[],
    whiteHitBalls: Ball[],
    whitePocketed: boolean,
    cushionHits: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _firstHitBall: Ball | null
  ): ShotResult {
    const events: GameEvent[] = [];
    const fouls: string[] = [];

    // Similar to snooker but with different scoring
    if (whitePocketed) {
      fouls.push('Cue ball pocketed');
      events.push({ type: 'FOUL', reason: 'Cue ball pocketed' });
    }

    if (whiteHitBalls.length === 0 && !whitePocketed) {
      fouls.push('Empty strike');
      events.push({ type: 'FOUL', reason: 'Empty strike' });
    }

    if (cushionHits === 0 && ballsPocketed.length === 0 && whiteHitBalls.length > 0) {
      fouls.push('No rail or pocket after contact');
      events.push({ type: 'FOUL', reason: 'No rail or pocket after contact' });
    }

    let points = 0;

    ballsPocketed.forEach(ball => {
      events.push({
        type: 'BALL_POCKETED',
        ball,
        pocketId: ball.pocketedAt ? String(ball.pocketedAt) : 'unknown',
      });

      if (ball.type === 'color') {
        // Brazilian scoring: 2-7 points for colors
        points += ball.number;
      } else if (ball.type === 'red') {
        points += 1;
      }
    });

    const valid = fouls.length === 0;
    const nextPlayer = valid ? state.currentPlayer : (state.currentPlayer === 1 ? 2 : 1);

    return {
      valid,
      points: valid ? points : 0,
      fouls,
      events,
      nextPlayer,
    };
  }

  checkVictory(state: GameState): { winner: 1 | 2 | null; finished: boolean } {
    const targetScore = 75; // Brazilian typically has lower target
    if (state.scores.p1 >= targetScore) {
      return { winner: 1, finished: true };
    }
    if (state.scores.p2 >= targetScore) {
      return { winner: 2, finished: true };
    }
    return { winner: null, finished: false };
  }

  getValidTargets(state: GameState): Ball[] {
    const remainingReds = state.balls.filter(b => b.type === 'red' && !b.inPocket);
    if (remainingReds.length > 0) {
      return remainingReds;
    }
    return state.balls.filter(b => b.type === 'color' && !b.inPocket)
      .sort((a, b) => a.number - b.number);
  }
}
