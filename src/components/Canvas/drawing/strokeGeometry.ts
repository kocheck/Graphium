/**
 * Stroke vertex buffer geometry utilities
 *
 * Builds indexed triangle-strip geometry for pressure-sensitive strokes.
 * Each sample expands into two vertices (top/bottom of the ribbon),
 * connected into quads via index pairs.
 *
 * Note: indices use Uint32Array to match PixiJS v8 MeshGeometry.indices type.
 */

// eslint-disable-next-line import/no-unused-modules
export interface StrokeSample {
  x: number;
  y: number;
  pressure: number; // 0.0–1.0
}

// eslint-disable-next-line import/no-unused-modules
export interface StrokeGeometry {
  /** Flat array of vertex positions: [x0, y0, x1, y1, ...] */
  vertices: Float32Array;
  /** Triangle indices into the vertex array */
  indices: Uint32Array;
}

const MIN_PRESSURE = 0.1;

/**
 * Build triangle-mesh geometry for a pressure-sensitive stroke ribbon.
 *
 * Each sample produces 2 vertices (top + bottom at ±halfWidth along the
 * normal to the stroke direction).  Adjacent pairs of vertices form quads
 * made up of two triangles.
 *
 * @param samples - Ordered stroke samples with position and pressure
 * @param baseWidth - Base stroke width in pixels (scaled by pressure)
 * @returns vertices (Float32Array) and indices (Uint32Array) ready for GPU upload
 */
export function buildStrokeGeometry(samples: StrokeSample[], baseWidth: number): StrokeGeometry {
  if (samples.length < 2) {
    return { vertices: new Float32Array(0), indices: new Uint32Array(0) };
  }

  // 2 vertices per sample, 2 floats (x, y) per vertex
  const vertexCount = samples.length * 2;
  const vertices = new Float32Array(vertexCount * 2);

  const segmentCount = samples.length - 1;
  // 2 triangles per segment, 3 indices per triangle
  const indices = new Uint32Array(segmentCount * 6);

  samples.forEach((sample, i) => {
    const pressure = Math.max(sample.pressure, MIN_PRESSURE);
    const halfWidth = (baseWidth * pressure) / 2;

    // Compute outward normal perpendicular to the stroke direction at this sample.
    // Forward samples use the direction to the next point;
    // the last sample reuses the direction from the previous point.
    let nx = 0;
    let ny = 1;

    if (i < samples.length - 1) {
      const next = samples[i + 1];
      if (next !== undefined) {
        const dx = next.x - sample.x;
        const dy = next.y - sample.y;
        const len = Math.hypot(dx, dy);
        if (len > 0) {
          nx = -dy / len;
          ny = dx / len;
        }
      }
    } else {
      const prev = samples[i - 1];
      if (prev !== undefined) {
        const dx = sample.x - prev.x;
        const dy = sample.y - prev.y;
        const len = Math.hypot(dx, dy);
        if (len > 0) {
          nx = -dy / len;
          ny = dx / len;
        }
      }
    }

    // Each sample occupies 4 floats: top vertex then bottom vertex
    const vi = i * 4;
    // Top vertex (+ normal direction)
    vertices[vi + 0] = sample.x + nx * halfWidth;
    vertices[vi + 1] = sample.y + ny * halfWidth;
    // Bottom vertex (- normal direction)
    vertices[vi + 2] = sample.x - nx * halfWidth;
    vertices[vi + 3] = sample.y - ny * halfWidth;
  });

  // Build two triangles per segment connecting adjacent vertex pairs:
  //   top[i]    top[i+1]
  //   bot[i]    bot[i+1]
  // Triangle 1: top[i],  bot[i],  top[i+1]
  // Triangle 2: bot[i],  bot[i+1], top[i+1]
  for (let i = 0; i < segmentCount; i++) {
    const v = i * 2; // vertex index base (top of column i)
    const ii = i * 6;
    indices[ii + 0] = v;
    indices[ii + 1] = v + 1;
    indices[ii + 2] = v + 2;
    indices[ii + 3] = v + 1;
    indices[ii + 4] = v + 3;
    indices[ii + 5] = v + 2;
  }

  return { vertices, indices };
}
