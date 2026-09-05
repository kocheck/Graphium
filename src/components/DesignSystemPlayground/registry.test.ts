import { describe, expect, it } from 'vitest';

import { categories, componentExamples } from './playground-registry';

const uiFiles = Object.keys(import.meta.glob('/src/components/ui/*.tsx')).filter(
  (file) => !file.endsWith('.test.tsx'),
);

describe('playground registry contract', () => {
  it('every example category is in the categories array (otherwise it is never rendered)', () => {
    const known = new Set(categories.map((c) => c.id));
    const orphans = componentExamples.filter((e) => !known.has(e.category)).map((e) => e.id);
    expect(orphans).toEqual([]);
  });

  it('every example id is unique', () => {
    const ids = componentExamples.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every primitive in src/components/ui has a registry entry id "ui-<file>"', () => {
    expect(uiFiles.length).toBeGreaterThan(0);
    const ids = componentExamples.map((e) => e.id);
    const missing = uiFiles
      .map((file) => file.replace(/^.*\//, '').replace(/\.tsx$/, ''))
      .filter((base) => !ids.some((id) => id === `ui-${base}` || id.startsWith(`ui-${base}-`)));
    expect(missing).toEqual([]);
  });
});
