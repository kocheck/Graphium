import { describe, it, expect } from 'vitest';
import { buildStrokeGeometry } from '../strokeGeometry';

describe('buildStrokeGeometry', () => {
  it('returns empty geometry for fewer than 2 samples', () => {
    const result = buildStrokeGeometry([{ x: 0, y: 0, pressure: 1 }], 10);
    expect(result.vertices.length).toBe(0);
    expect(result.indices.length).toBe(0);
  });

  it('generates 4 vertices for a single segment (2 samples)', () => {
    const result = buildStrokeGeometry(
      [
        { x: 0, y: 0, pressure: 1 },
        { x: 100, y: 0, pressure: 1 },
      ],
      10,
    );
    expect(result.vertices.length).toBe(8); // 4 vertices × 2 coords
    expect(result.indices.length).toBe(6); // 2 triangles = 6 indices
  });

  it('scales quad width by pressure value', () => {
    const full = buildStrokeGeometry(
      [
        { x: 0, y: 0, pressure: 1.0 },
        { x: 100, y: 0, pressure: 1.0 },
      ],
      10,
    );
    const half = buildStrokeGeometry(
      [
        { x: 0, y: 0, pressure: 0.5 },
        { x: 100, y: 0, pressure: 0.5 },
      ],
      10,
    );
    // Half pressure → half width → vertices are closer to center line
    const fullTopY = full.vertices[1]!;
    const halfTopY = half.vertices[1]!;
    expect(Math.abs(halfTopY)).toBeLessThan(Math.abs(fullTopY));
  });
});
