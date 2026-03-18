/**
 * PressureSensitiveLine — PixiJS Mesh implementation
 *
 * Renders a variable-width stroke ribbon using a PixiJS Mesh driven by
 * buildStrokeGeometry().  The component is imperative: it adds a Mesh to
 * worldContainer on mount and removes it on unmount, returning null from JSX.
 *
 * Performance notes:
 * - Wrapped in React.memo — only re-renders when props change.
 * - Geometry and shader objects are recreated on each render pass; the old
 *   Mesh is destroyed and a new one added so worldContainer stays consistent.
 * - zIndex = 30 keeps strokes above the map background (10) and grid (20).
 */

import { useEffect, useRef, memo } from 'react';

import { GlProgram, Mesh, MeshGeometry, Shader, UniformGroup } from 'pixi.js';

import { buildStrokeGeometry } from './drawing/strokeGeometry';

import type { Container } from 'pixi.js';

// ---------------------------------------------------------------------------
// GLSL shaders
// ---------------------------------------------------------------------------

// mirrors: colour passed in as a vec4 uniform, no texture sampling
const VERTEX_GLSL = `
in vec2 aPosition;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

void main(void) {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
}
`.trim();

const FRAGMENT_GLSL = `
uniform vec4 uColor;

out vec4 outColor;

void main(void) {
  outColor = uColor;
}
`.trim();

// ---------------------------------------------------------------------------
// Shared cached GlProgram (reused across all instances)
// mirrors var(--app-drawing-stroke) in spirit; actual colour comes via uniform
// ---------------------------------------------------------------------------

let _sharedGlProgram: GlProgram | null = null;

function getSharedGlProgram(): GlProgram {
  if (!_sharedGlProgram) {
    _sharedGlProgram = new GlProgram({ vertex: VERTEX_GLSL, fragment: FRAGMENT_GLSL });
  }
  return _sharedGlProgram;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PressureSensitiveLineProps {
  /** Unique DOM/Pixi id used as Mesh name for debug tooling */
  id: string;
  /** Flat coordinate array [x0, y0, x1, y1, …] */
  points: number[];
  /** Per-point pressure values [p0, p1, …], length === points.length / 2 */
  pressures?: number[];
  /** Hex colour string e.g. "#e87722" */
  stroke: string;
  /** Base stroke width in pixels (scaled by pressure) */
  strokeWidth: number;
  /** Alpha value 0.0–1.0, default 1.0 */
  opacity?: number;
  /** PixiJS Container to add the Mesh to */
  worldContainer: Container | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a CSS hex string (#rrggbb or #rgb) to [r, g, b] floats in [0, 1]. */
function hexToRgb(hex: string): [number, number, number] {
  const raw = hex.replace('#', '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  const colorHex = parseInt(full, 16);
  return [((colorHex >> 16) & 255) / 255, ((colorHex >> 8) & 255) / 255, (colorHex & 255) / 255];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function PressureSensitiveLineComponent({
  id,
  points,
  pressures,
  stroke,
  strokeWidth,
  opacity = 1,
  worldContainer,
}: PressureSensitiveLineProps): null {
  const meshRef = useRef<Mesh<MeshGeometry, Shader> | null>(null);

  useEffect(() => {
    if (!worldContainer || points.length < 4) {
      return;
    }

    // Build ordered samples from the flat points array
    const sampleCount = Math.floor(points.length / 2);
    const samples: Array<{ x: number; y: number; pressure: number }> = [];
    for (let i = 0; i < sampleCount; i++) {
      const px = points[i * 2] ?? 0;
      const py = points[i * 2 + 1] ?? 0;
      samples.push({
        x: px,
        y: py,
        pressure: pressures?.[i] ?? 1.0,
      });
    }

    const { vertices, indices } = buildStrokeGeometry(samples, strokeWidth);

    if (vertices.length === 0) {
      return;
    }

    // MeshGeometry requires uvs at least as long as positions
    const uvs = new Float32Array(vertices.length);

    const geometry = new MeshGeometry({
      positions: vertices,
      uvs,
      indices,
    });

    // Colour uniform — vec4 (r, g, b, a)
    const [r, g, b] = hexToRgb(stroke);
    const uniformGroup = new UniformGroup({
      uColor: { value: new Float32Array([r, g, b, opacity]), type: 'vec4<f32>' },
    });

    const shader = new Shader({
      glProgram: getSharedGlProgram(),
      resources: {
        uniforms: uniformGroup,
      },
    });

    const mesh = new Mesh({ geometry, shader });
    mesh.name = id;
    mesh.zIndex = 30;

    worldContainer.addChild(mesh);
    meshRef.current = mesh;

    return () => {
      if (meshRef.current) {
        worldContainer.removeChild(meshRef.current);
        meshRef.current.destroy();
        meshRef.current = null;
      }
    };
  }, [id, points, pressures, stroke, strokeWidth, opacity, worldContainer]);

  return null;
}

/**
 * Memoized export — only re-renders when points, pressures, stroke, or
 * strokeWidth change.
 */
const PressureSensitiveLine = memo(PressureSensitiveLineComponent);

PressureSensitiveLine.displayName = 'PressureSensitiveLine';

export default PressureSensitiveLine;
