import { Ball, BallColor, GameMode, Table, Vector2 } from '@/engine/types';
import { getModeConfig } from './modeConfigs';

export const TABLE_WIDTH = 1200;
export const TABLE_HEIGHT = 600;
export const BALL_RADIUS = 12;

export const POCKET_POSITIONS = [
  { id: 'tl', x: 45, y: 45, radius: 22 },
  { id: 'tc', x: 600, y: 30, radius: 20 },
  { id: 'tr', x: 1155, y: 45, radius: 22 },
  { id: 'bl', x: 45, y: 555, radius: 22 },
  { id: 'bc', x: 600, y: 570, radius: 20 },
  { id: 'br', x: 1155, y: 555, radius: 22 },
] as const;

export function createTable(mode?: GameMode): Table {
  const config = mode ? getModeConfig(mode) : null;
  const ratio = config?.tableRatio ?? 2;
  const height = TABLE_HEIGHT;
  const width = height * ratio;

  return {
    width,
    height,
    cushionWidth: 20,
    pockets: POCKET_POSITIONS.map(pocket => ({
      id: pocket.id,
      position: { x: pocket.x, y: pocket.y },
      radius: pocket.radius,
    })),
  };
}

export function createInitialBalls(mode: GameMode = 'snooker'): Ball[] {
  switch (mode) {
    case 'eightball':
      return createEightBallBalls();
    case 'nineball':
      return createNineBallBalls();
    case 'brazilian':
      return createBrazilianBalls();
    case 'snooker':
    default:
      return createSnookerBalls();
  }
}

function createWhiteBall(position: Vector2): Ball {
  return {
    id: 'white',
    type: 'white',
    color: 'white',
    number: 0,
    position,
    velocity: { x: 0, y: 0 },
    radius: BALL_RADIUS,
    mass: 1,
    inPocket: false,
  };
}

// ==================== SNOOKER ====================
function createSnookerBalls(): Ball[] {
  const balls: Ball[] = [
    createWhiteBall({ x: TABLE_WIDTH * 0.25, y: TABLE_HEIGHT / 2 }),
  ];

  const startX = TABLE_WIDTH * 0.75;
  const startY = TABLE_HEIGHT / 2;
  const spacing = BALL_RADIUS * 2.1;

  let redCount = 0;
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col <= row; col += 1) {
      const x = startX + row * spacing * 0.866;
      const y = startY + (col - row / 2) * spacing;

      balls.push({
        id: `red-${redCount}`,
        type: 'red',
        color: 'red',
        number: 1,
        position: { x, y },
        velocity: { x: 0, y: 0 },
        radius: BALL_RADIUS,
        mass: 1,
        inPocket: false,
      });

      redCount += 1;
    }
  }

  const colors: Array<{ color: BallColor; number: number; x: number; y: number }> = [
    { color: 'yellow', number: 2, x: TABLE_WIDTH * 0.2, y: TABLE_HEIGHT * 0.35 },
    { color: 'green', number: 3, x: TABLE_WIDTH * 0.2, y: TABLE_HEIGHT * 0.65 },
    { color: 'brown', number: 4, x: TABLE_WIDTH * 0.2, y: TABLE_HEIGHT * 0.5 },
    { color: 'blue', number: 5, x: TABLE_WIDTH * 0.5, y: TABLE_HEIGHT * 0.5 },
    { color: 'pink', number: 6, x: startX - 50, y: TABLE_HEIGHT * 0.5 },
    { color: 'black', number: 7, x: TABLE_WIDTH * 0.91, y: TABLE_HEIGHT * 0.5 },
  ];

  colors.forEach(({ color, number, x, y }, index) => {
    balls.push({
      id: `color-${index}`,
      type: 'color',
      color,
      number,
      position: { x, y },
      velocity: { x: 0, y: 0 },
      radius: BALL_RADIUS,
      mass: 1,
      inPocket: false,
    });
  });

  return balls;
}

// ==================== 8-BALL ====================
function createEightBallBalls(): Ball[] {
  const balls: Ball[] = [
    createWhiteBall({ x: TABLE_WIDTH * 0.25, y: TABLE_HEIGHT / 2 }),
  ];

  const startX = TABLE_WIDTH * 0.75;
  const startY = TABLE_HEIGHT / 2;
  const spacing = BALL_RADIUS * 2.05;

  // 8-ball formation: triangle with alternating solid/stripe
  // Row structure (0-indexed):
  // Row 0: 1 ball (apex)
  // Row 1: 2 balls
  // Row 2: 3 balls (center is 8-ball)
  // Row 3: 4 balls
  // Row 4: 5 balls

  const solidNumbers = [1, 2, 3, 4, 5, 6, 7];
  const stripeNumbers = [9, 10, 11, 12, 13, 14, 15];

  // Shuffle for random placement
  const shuffledSolids = [...solidNumbers].sort(() => Math.random() - 0.5);
  const shuffledStripes = [...stripeNumbers].sort(() => Math.random() - 0.5);

  let solidIndex = 0;
  let stripeIndex = 0;
  let ballCount = 0;

  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col <= row; col += 1) {
      const x = startX + row * spacing * 0.866;
      const y = startY + (col - row / 2) * spacing;

      // 8-ball is at row 2, col 1 (center of third row)
      if (row === 2 && col === 1) {
        balls.push({
          id: 'black-8',
          type: 'black',
          color: 'black',
          number: 8,
          position: { x, y },
          velocity: { x: 0, y: 0 },
          radius: BALL_RADIUS,
          mass: 1,
          inPocket: false,
        });
      } else {
        // Alternate solid/stripe in a pattern
        const isSolid = (row + col) % 2 === 0;
        const number = isSolid
          ? shuffledSolids[solidIndex++]
          : shuffledStripes[stripeIndex++];

        balls.push({
          id: `ball-${ballCount}`,
          type: isSolid ? 'solid' : 'stripe',
          color: getBallColor(number),
          number,
          group: isSolid ? 'solid' : 'stripe',
          position: { x, y },
          velocity: { x: 0, y: 0 },
          radius: BALL_RADIUS,
          mass: 1,
          inPocket: false,
        });
      }

      ballCount += 1;
    }
  }

  return balls;
}

// ==================== 9-BALL ====================
function createNineBallBalls(): Ball[] {
  const balls: Ball[] = [
    createWhiteBall({ x: TABLE_WIDTH * 0.25, y: TABLE_HEIGHT / 2 }),
  ];

  const startX = TABLE_WIDTH * 0.75;
  const startY = TABLE_HEIGHT / 2;
  const spacing = BALL_RADIUS * 2.05;

  // Diamond formation for 9-ball
  //   1
  //  2 3
  // 4 9 5
  //  6 7
  //   8

  const diamondPositions: Array<{ row: number; col: number; num: number }> = [
    { row: 0, col: 0, num: 1 },
    { row: 1, col: -0.5, num: 2 },
    { row: 1, col: 0.5, num: 3 },
    { row: 2, col: -1, num: 4 },
    { row: 2, col: 0, num: 9 },
    { row: 2, col: 1, num: 5 },
    { row: 3, col: -0.5, num: 6 },
    { row: 3, col: 0.5, num: 7 },
    { row: 4, col: 0, num: 8 },
  ];

  diamondPositions.forEach(({ row, col, num }) => {
    const x = startX + row * spacing * 0.866;
    const y = startY + col * spacing;

    balls.push({
      id: `ball-${num}`,
      type: num === 9 ? 'black' : 'solid',
      color: getBallColor(num),
      number: num,
      position: { x, y },
      velocity: { x: 0, y: 0 },
      radius: BALL_RADIUS,
      mass: 1,
      inPocket: false,
    });
  });

  return balls;
}

// ==================== BRAZILIAN ====================
function createBrazilianBalls(): Ball[] {
  // Brazilian is similar to snooker but with different scoring/rules
  const balls: Ball[] = [
    createWhiteBall({ x: TABLE_WIDTH * 0.25, y: TABLE_HEIGHT / 2 }),
  ];

  const startX = TABLE_WIDTH * 0.75;
  const startY = TABLE_HEIGHT / 2;
  const spacing = BALL_RADIUS * 2.1;

  let redCount = 0;
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col <= row; col += 1) {
      const x = startX + row * spacing * 0.866;
      const y = startY + (col - row / 2) * spacing;

      balls.push({
        id: `red-${redCount}`,
        type: 'red',
        color: 'red',
        number: 1,
        position: { x, y },
        velocity: { x: 0, y: 0 },
        radius: BALL_RADIUS,
        mass: 1,
        inPocket: false,
      });

      redCount += 1;
    }
  }

  // Brazilian uses same colors as snooker but different positions
  const colors: Array<{ color: BallColor; number: number; x: number; y: number }> = [
    { color: 'yellow', number: 2, x: TABLE_WIDTH * 0.15, y: TABLE_HEIGHT * 0.3 },
    { color: 'blue', number: 3, x: TABLE_WIDTH * 0.15, y: TABLE_HEIGHT * 0.5 },
    { color: 'red', number: 4, x: TABLE_WIDTH * 0.15, y: TABLE_HEIGHT * 0.7 },
    { color: 'purple', number: 5, x: TABLE_WIDTH * 0.5, y: TABLE_HEIGHT * 0.5 },
    { color: 'pink', number: 6, x: startX - 50, y: TABLE_HEIGHT * 0.5 },
    { color: 'black', number: 7, x: TABLE_WIDTH * 0.91, y: TABLE_HEIGHT * 0.5 },
  ];

  colors.forEach(({ color, number, x, y }, index) => {
    balls.push({
      id: `color-${index}`,
      type: 'color',
      color,
      number,
      position: { x, y },
      velocity: { x: 0, y: 0 },
      radius: BALL_RADIUS,
      mass: 1,
      inPocket: false,
    });
  });

  return balls;
}

// ==================== UTILITIES ====================
function getBallColor(number: number): BallColor {
  const colors: Record<number, BallColor> = {
    0: 'white',
    1: 'yellow',
    2: 'blue',
    3: 'red',
    4: 'purple',
    5: 'orange',
    6: 'green',
    7: 'maroon',
    8: 'black',
    9: 'yellow',
    10: 'blue',
    11: 'red',
    12: 'purple',
    13: 'orange',
    14: 'green',
    15: 'maroon',
  };

  return colors[number] ?? 'white';
}
