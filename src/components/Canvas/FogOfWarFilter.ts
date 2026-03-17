/**
 * FogOfWarFilter — PixiJS v8 Filter wrapping the GLSL fog-of-war shader.
 *
 * In PixiJS v8, uniforms are not stored on the Filter directly. Instead, a
 * `UniformGroup` is placed in `shader.resources` and updated via
 * `resources.fogUniforms.uniforms.*`.  This class exposes a `.uniforms`
 * getter as a convenience so call sites look identical to the spec.
 *
 * Usage:
 *   const filter = new FogOfWarFilter();
 *   sprite.filters = [filter];
 *   filter.updateLights(tokens, { mapWidth, mapHeight, gridSize });
 *   filter.revealAll = true; // DM / reveal-all mode
 */

import { Filter, GlProgram, UniformGroup, defaultFilterVert } from 'pixi.js';

import fogFragSrc from './shaders/fog.frag.glsl';
import { tokensToLightUniforms } from './shaders/fogUniforms';

import type { LightToken, MapDimensions } from './shaders/fogUniforms';

// Suppress unused-import warning — defaultFilterVert is resolved here as a
// build-time check that the symbol exists in the bundled PixiJS package.
void defaultFilterVert;

/**
 * Custom vertex shader that aliases vTextureCoord to vUvs so the fog
 * fragment shader can reference vUvs without diverging from the standard
 * PixiJS filter pipeline.
 */
const FOG_VERTEX_GLSL = `
in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vUvs;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void) {
  return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void) {
  gl_Position   = filterVertexPosition();
  vTextureCoord = filterTextureCoord();
  vUvs          = filterTextureCoord();
}
`;

/** Typed uniform descriptor map — matches PixiJS v8 UniformGroup constructor. */
type FogUniformStructures = {
  uFogAlpha: { value: number; type: 'f32' };
  uRevealAll: { value: number; type: 'f32' };
  uLightCount: { value: number; type: 'i32' };
  uFogColor: { value: number[]; type: 'vec3<f32>' };
  uExploredColor: { value: number[]; type: 'vec3<f32>' };
  uLightsA: { value: Float32Array; type: 'array<vec4<f32>, 32>' };
  uLightsB: { value: Float32Array; type: 'array<vec4<f32>, 32>' };
};

export class FogOfWarFilter extends Filter {
  private _fogAlpha = 0.94;
  private _revealAll = false;

  // UniformGroup stored in resources so PixiJS can sync it to the GPU.
  private readonly _fogUniforms: UniformGroup<FogUniformStructures>;

  constructor() {
    const fogUniforms = new UniformGroup<FogUniformStructures>({
      uFogAlpha: { value: 0.94, type: 'f32' },
      uRevealAll: { value: 0.0, type: 'f32' },
      uLightCount: { value: 0, type: 'i32' },
      uFogColor: { value: [0.0, 0.0, 0.0], type: 'vec3<f32>' },
      uExploredColor: { value: [0.05, 0.03, 0.02], type: 'vec3<f32>' },
      uLightsA: { value: new Float32Array(32 * 4), type: 'array<vec4<f32>, 32>' },
      uLightsB: { value: new Float32Array(32 * 4), type: 'array<vec4<f32>, 32>' },
    });

    super({
      glProgram: new GlProgram({
        fragment: fogFragSrc,
        vertex: FOG_VERTEX_GLSL,
        name: 'fog-of-war-filter',
      }),
      resources: {
        fogUniforms,
      },
    });

    this._fogUniforms = fogUniforms;
  }

  /**
   * Convenience accessor — returns the raw uniform value map so call sites
   * can write `filter.uniforms['uRevealAll']` instead of
   * `filter.resources.fogUniforms.uniforms.uRevealAll`.
   */
  get uniforms(): Record<string, unknown> {
    return this._fogUniforms.uniforms as unknown as Record<string, unknown>;
  }

  /** Fog opacity (0–1). Default: 0.94 */
  get fogAlpha(): number {
    return this._fogAlpha;
  }

  set fogAlpha(v: number) {
    this._fogAlpha = v;
    this._fogUniforms.uniforms.uFogAlpha = v;
  }

  /** When true the fog renders fully transparent — DM reveal mode. */
  get revealAll(): boolean {
    return this._revealAll;
  }

  set revealAll(v: boolean) {
    this._revealAll = v;
    this._fogUniforms.uniforms.uRevealAll = v ? 1.0 : 0.0;
  }

  /**
   * Push token light data into the shader uniforms.
   * Deinterleaves the packed Float32Array from `tokensToLightUniforms` into
   * the two vec4[32] arrays (uLightsA / uLightsB) expected by the shader.
   */
  updateLights(tokens: LightToken[], dims: MapDimensions): void {
    const data = tokensToLightUniforms(tokens, dims);

    const a = new Float32Array(32 * 4);
    const b = new Float32Array(32 * 4);

    for (let i = 0; i < 32; i++) {
      const src = i * 8;
      a[i * 4 + 0] = data[src + 0] ?? 0; // u
      a[i * 4 + 1] = data[src + 1] ?? 0; // v
      a[i * 4 + 2] = data[src + 2] ?? 0; // radius
      a[i * 4 + 3] = data[src + 3] ?? 0; // r (red)
      b[i * 4 + 0] = data[src + 4] ?? 0; // g (green)
      b[i * 4 + 1] = data[src + 5] ?? 0; // b (blue)
      b[i * 4 + 2] = data[src + 6] ?? 0; // falloff exponent
      b[i * 4 + 3] = data[src + 7] ?? 0; // padding
    }

    this._fogUniforms.uniforms.uLightsA = a;
    this._fogUniforms.uniforms.uLightsB = b;
    this._fogUniforms.uniforms.uLightCount = Math.min(tokens.length, 32);
  }
}
