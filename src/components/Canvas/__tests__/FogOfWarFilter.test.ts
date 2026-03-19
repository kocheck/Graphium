import { vi, describe, it, expect } from 'vitest';

// vi.mock factories are hoisted — class bodies must be inline here, NOT
// referencing outer variables that are not yet initialized at hoist time.

vi.mock('pixi.js', () => {
  class MockUniformGroup {
    uniforms: Record<string, unknown> = {};
    constructor(structures: Record<string, { value: unknown }>) {
      for (const [key, desc] of Object.entries(structures)) {
        this.uniforms[key] = desc.value;
      }
    }
  }

  class MockGlProgram {
    constructor(_opts?: unknown) {}
    static from(_opts?: unknown) {
      return new MockGlProgram();
    }
  }

  // Filter stores resources and nothing else — FogOfWarFilter adds the
  // .uniforms getter pointing at resources.fogUniforms.uniforms.
  class MockFilter {
    resources: Record<string, unknown> = {};
    constructor(_opts?: unknown) {}
    destroy() {}
  }

  return {
    Filter: MockFilter,
    GlProgram: MockGlProgram,
    UniformGroup: MockUniformGroup,
    defaultFilterVert: 'mock-default-vertex',
  };
});

// Prevent Rollup from parsing the raw GLSL source during test transforms.
vi.mock('../shaders/fog.frag.glsl', () => ({ default: 'mock-frag-shader' }));

import { FogOfWarFilter } from '../FogOfWarFilter';

describe('FogOfWarFilter', () => {
  it('initializes with default fog alpha of 0.94', () => {
    const filter = new FogOfWarFilter();
    expect(filter.fogAlpha).toBe(0.94);
  });

  it('revealAll=true sets uRevealAll uniform to 1', () => {
    const filter = new FogOfWarFilter();
    filter.revealAll = true;
    expect(filter.uniforms['uRevealAll']).toBe(1.0);
  });

  it('revealAll=false sets uRevealAll uniform to 0', () => {
    const filter = new FogOfWarFilter();
    filter.revealAll = false;
    expect(filter.uniforms['uRevealAll']).toBe(0.0);
  });
});
