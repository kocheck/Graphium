import { describe, it, expect } from 'vitest';
import { pressureToWidth } from '../pressureWidth';

describe('pressureToWidth', () => {
  it('maps full pressure to max width', () => {
    expect(pressureToWidth(1.0, 10, { min: 0.5, max: 2.0 })).toBe(20);
  });
  it('maps zero pressure to min width', () => {
    expect(pressureToWidth(0.0, 10, { min: 0.5, max: 2.0 })).toBe(5);
  });
  it('interpolates linearly', () => {
    expect(pressureToWidth(0.5, 10, { min: 0.5, max: 2.0 })).toBeCloseTo(12.5);
  });
});
