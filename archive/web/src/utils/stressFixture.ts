import { withTokenIndex } from './tokenIndex';
import { useGameStore } from '../store/gameStore';

import type { Drawing, Token } from '../store/gameStore';

const TOKEN_COUNT = 200;
const PC_COUNT = 5;
const WALL_COUNT = 50;
const STROKE_COUNT = 200;
const GRID = 50;

function makeToken(index: number): Token {
  const isPc = index < PC_COUNT;
  const col = index % 20;
  const row = Math.floor(index / 20);
  return {
    id: `stress-token-${index}`,
    x: col * GRID * 2,
    y: row * GRID * 2,
    src: '',
    name: isPc ? `PC ${index + 1}` : `NPC ${index + 1}`,
    type: isPc ? 'PC' : 'NPC',
    scale: 1,
    visionRadius: isPc ? 60 : undefined,
    movementSpeed: 30,
  };
}

function makeWall(index: number): Drawing {
  const x = (index % 10) * GRID * 4;
  const y = Math.floor(index / 10) * GRID * 4;
  return {
    id: `stress-wall-${index}`,
    tool: 'wall',
    points: [x, y, x + GRID * 3, y, x + GRID * 3, y + GRID * 2],
    color: '#000000',
    size: 4,
  };
}

function makeStroke(index: number): Drawing {
  const x = (index % 20) * GRID;
  const y = 800 + Math.floor(index / 20) * GRID;
  return {
    id: `stress-stroke-${index}`,
    tool: 'marker',
    points: [x, y, x + 30, y + 10, x + 60, y],
    color: '#df4b26',
    size: 3,
  };
}

/** Loads a deterministic combat-scale campaign for Resource Monitor baselines. */
export function loadStressFixture(): void {
  const tokens = Array.from({ length: TOKEN_COUNT }, (_, i) => makeToken(i));
  const drawings = [
    ...Array.from({ length: WALL_COUNT }, (_, i) => makeWall(i)),
    ...Array.from({ length: STROKE_COUNT }, (_, i) => makeStroke(i)),
  ];

  useGameStore.setState({
    ...withTokenIndex(tokens),
    drawings,
    doors: [],
    stairs: [],
    gridSize: GRID,
    gridType: 'LINES',
    map: null,
    exploredRegions: [],
    isDaylightMode: false,
  });
}

export function shouldAutoloadStressFixture(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return new URLSearchParams(window.location.search).get('stress') === '1';
}
