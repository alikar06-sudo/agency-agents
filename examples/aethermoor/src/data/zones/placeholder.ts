import type { ZoneDef, ZoneId } from '../types';

// Временная заготовка зоны (заменяется полноценными картами).
export function placeholder(id: ZoneId, name: string, back: ZoneId): ZoneDef {
  return {
    id, name, subtitle: 'В разработке', theme: 'castle', outdoor: false, music: 'castle', ambient: [], floor: '.', fog: [16, 50], mapPos: [0.5, 0.5],
    map: [
      '##########',
      '#........#',
      '#...1....#',
      '#........#',
      '####A#####',
    ],
    markers: {
      '1': { kind: 'spawn', id: 'from_hall' },
      'A': { kind: 'exit', id: 'back', to: back, spawn: 'from_' + id, label: 'Назад' },
    },
  };
}
