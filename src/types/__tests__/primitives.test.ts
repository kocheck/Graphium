import { describe, it, expect } from 'vitest';
import { toHexColor, toPixelSize } from '../primitives';

describe('toHexColor', () => {
  it('accepts #rgb', () => {
    expect(toHexColor('#abc')).toBe('#abc');
  });
  it('accepts #rrggbb', () => {
    expect(toHexColor('#ff0000')).toBe('#ff0000');
  });
  it('accepts #rrggbb mixed case', () => {
    expect(toHexColor('#FF0000')).toBe('#FF0000');
  });
  it('accepts #rrggbbaa', () => {
    expect(toHexColor('#ff000080')).toBe('#ff000080');
  });
  it('rejects named colors', () => {
    expect(() => toHexColor('red')).toThrow('Invalid hex color');
  });
  it('rejects empty string', () => {
    expect(() => toHexColor('')).toThrow('Invalid hex color');
  });
});

describe('toPixelSize', () => {
  it('accepts positive integers', () => {
    expect(toPixelSize(50)).toBe(50);
  });
  it('rounds fractional values', () => {
    expect(toPixelSize(50.7)).toBe(51);
  });
  it('rejects zero', () => {
    expect(() => toPixelSize(0)).toThrow('Invalid pixel size');
  });
  it('rejects negative', () => {
    expect(() => toPixelSize(-1)).toThrow('Invalid pixel size');
  });
  it('rejects Infinity', () => {
    expect(() => toPixelSize(Infinity)).toThrow('Invalid pixel size');
  });
  it('rejects NaN', () => {
    expect(() => toPixelSize(NaN)).toThrow('Invalid pixel size');
  });
});
