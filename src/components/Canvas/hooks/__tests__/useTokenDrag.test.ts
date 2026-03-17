import { describe, it, expect } from 'vitest';
import { snapPositionToGrid } from '../useTokenDrag';

describe('snapPositionToGrid', () => {
  it('snaps to nearest grid cell', () => {
    expect(snapPositionToGrid({ x: 110, y: 90 }, 100)).toEqual({ x: 100, y: 100 });
  });

  it('snaps down when below half-cell', () => {
    expect(snapPositionToGrid({ x: 149, y: 149 }, 100)).toEqual({ x: 100, y: 100 });
  });

  it('snaps up when at or above half-cell', () => {
    expect(snapPositionToGrid({ x: 150, y: 150 }, 100)).toEqual({ x: 200, y: 200 });
  });
});
