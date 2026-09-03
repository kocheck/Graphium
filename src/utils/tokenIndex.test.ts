import { describe, expect, it } from 'vitest';

import {
  buildTokenIndex,
  patchTokenInIndex,
  patchTokenPositions,
  withTokenIndex,
} from './tokenIndex';

import type { Token } from '../store/gameStore';

const tokenA: Token = { id: 'a', x: 0, y: 0, src: 'a.png' };
const tokenB: Token = { id: 'b', x: 10, y: 10, src: 'b.png' };

describe('tokenIndex', () => {
  it('builds an id map', () => {
    expect(buildTokenIndex([tokenA, tokenB])).toEqual({ a: tokenA, b: tokenB });
  });

  it('pairs tokens with an index', () => {
    expect(withTokenIndex([tokenA])).toEqual({
      tokens: [tokenA],
      tokensById: { a: tokenA },
      tokenIds: ['a'],
    });
  });

  it('patches one token without rewriting other object identities', () => {
    const tokens = [tokenA, tokenB];
    const index = buildTokenIndex(tokens);
    const patched = patchTokenInIndex(tokens, index, 'a', { x: 42 });
    expect(patched).not.toBeNull();
    expect(patched?.tokens[1]).toBe(tokenB);
    expect(patched?.tokensById.b).toBe(tokenB);
    expect(patched?.tokensById.a).toMatchObject({ id: 'a', x: 42, y: 0 });
  });

  it('returns null when the id is missing', () => {
    expect(patchTokenInIndex([tokenA], buildTokenIndex([tokenA]), 'missing', { x: 1 })).toBeNull();
  });

  it('patches multiple positions without rewriting untouched tokens', () => {
    const tokens = [tokenA, tokenB];
    const patched = patchTokenPositions(tokens, buildTokenIndex(tokens), [
      { id: 'a', x: 5, y: 6 },
      { id: 'b', x: 7, y: 8 },
    ]);
    expect(patched?.tokensById.a).toMatchObject({ x: 5, y: 6 });
    expect(patched?.tokensById.b).toMatchObject({ x: 7, y: 8 });
    expect(patched?.tokens[0]).not.toBe(tokenA);
    expect(patched?.tokens[1]).not.toBe(tokenB);
  });

  it('returns null for an empty position batch', () => {
    expect(patchTokenPositions([tokenA], buildTokenIndex([tokenA]), [])).toBeNull();
  });
});
