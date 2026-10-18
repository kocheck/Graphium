import { describe, expect, it } from 'vitest';

const RAW_PALETTE =
  /\b(bg|text|border|ring)-(white|black|slate|gray|zinc|neutral|blue|red|green|amber|orange)(-[0-9]{2,3})?\b/g;
const LITERAL_COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\boklch\(/g;

const sources = import.meta.glob<string>('./*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('src/components/ui purity', () => {
  const files = Object.entries(sources).filter(([file]) => !file.endsWith('.test.tsx'));

  it('has primitives to check', () => {
    expect(files.length).toBeGreaterThanOrEqual(14);
  });

  it.each(files)('%s uses no raw Tailwind palette class', (_file, source) => {
    expect(source.match(RAW_PALETTE) ?? []).toEqual([]);
  });

  it.each(files)('%s contains no literal colour', (_file, source) => {
    expect(source.match(LITERAL_COLOUR) ?? []).toEqual([]);
  });
});
