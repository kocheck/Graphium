import { describe, it, expect } from 'vitest';
import { buildGridGeometry } from '../GridOverlay';

describe('buildGridGeometry', () => {
  it('generates correct number of lines for a square grid', () => {
    const result = buildGridGeometry({
      gridSize: 100,
      mapWidth: 400,
      mapHeight: 300,
      gridType: 'square',
    });
    expect(result.horizontal.length).toBe(4); // 300/100 + 1 = 4 lines (y=0,100,200,300)
    expect(result.vertical.length).toBe(5); // 400/100 + 1 = 5 lines (x=0,100,200,300,400)
  });

  it('includes boundary lines at 0 and map edge', () => {
    const result = buildGridGeometry({
      gridSize: 100,
      mapWidth: 200,
      mapHeight: 100,
      gridType: 'square',
    });
    expect(result.horizontal[0]).toEqual({ x1: 0, y1: 0, x2: 200, y2: 0 });
    expect(result.horizontal[result.horizontal.length - 1]).toEqual({
      x1: 0,
      y1: 100,
      x2: 200,
      y2: 100,
    });
  });

  it('returns empty lines for zero gridSize (guard against division by zero)', () => {
    const result = buildGridGeometry({
      gridSize: 0,
      mapWidth: 400,
      mapHeight: 300,
      gridType: 'square',
    });
    expect(result.horizontal.length).toBe(0);
    expect(result.vertical.length).toBe(0);
  });
});
