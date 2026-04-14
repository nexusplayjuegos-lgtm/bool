import { GameMode, ModeConfig } from '@/engine/types';

export const MODE_CONFIGS: Record<GameMode, ModeConfig> = {
  snooker: {
    id: 'snooker',
    name: 'Snooker',
    description: '15 reds + 6 colors. Red then color alternately.',
    ballCount: 22,
    tableRatio: 2,
    pocketCount: 6,
    hasColors: true,
    hasGroups: false,
    formation: { type: 'snooker_triangle', rows: 5, startX: 900, startY: 300 }
  },
  eightball: {
    id: 'eightball',
    name: '8-Ball Pool',
    description: '7 solids vs 7 stripes. Black ball last.',
    ballCount: 16,
    tableRatio: 2,
    pocketCount: 6,
    hasColors: false,
    hasGroups: true,
    formation: { type: 'eightball_triangle', base: 'alternating' }
  },
  nineball: {
    id: 'nineball',
    name: '9-Ball',
    description: 'Diamond rack. Always hit lowest number first.',
    ballCount: 10,
    tableRatio: 2,
    pocketCount: 6,
    hasColors: false,
    hasGroups: false,
    formation: { type: 'nineball_diamond', size: 3 }
  },
  brazilian: {
    id: 'brazilian',
    name: 'Sinuca Brasileira',
    description: 'Carambola style. 15 reds + 6 colors.',
    ballCount: 22,
    tableRatio: 2,
    pocketCount: 6,
    hasColors: true,
    hasGroups: false,
    formation: { type: 'brazilian_triangle', rows: 5 }
  }
};

export function getModeConfig(mode: GameMode): ModeConfig {
  return MODE_CONFIGS[mode];
}

export function getAvailableModes(): GameMode[] {
  return ['snooker', 'eightball', 'nineball', 'brazilian'];
}
