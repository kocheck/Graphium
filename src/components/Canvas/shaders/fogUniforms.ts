const MAX_LIGHTS = 32; // Must match shader constant
const FLOATS_PER_LIGHT = 8; // [u, v, radius, r, g, b, falloff, _pad]

export interface LightToken {
  id: string;
  x: number;
  y: number;
  visionRadius: number;
  lightColor: [number, number, number]; // RGB 0–1
}

export interface MapDimensions {
  mapWidth: number;
  mapHeight: number;
  gridSize: number;
}

export function worldToUV(
  pos: { x: number; y: number },
  dims: { mapWidth: number; mapHeight: number },
): { u: number; v: number } {
  return {
    u: Math.min(Math.max(pos.x / dims.mapWidth, 0), 1),
    v: Math.min(Math.max(pos.y / dims.mapHeight, 0), 1),
  };
}

export function tokensToLightUniforms(tokens: LightToken[], dims: MapDimensions): Float32Array {
  const data = new Float32Array(MAX_LIGHTS * FLOATS_PER_LIGHT);
  tokens.slice(0, MAX_LIGHTS).forEach((token, i) => {
    const { u, v } = worldToUV({ x: token.x, y: token.y }, dims);
    const radiusUV = (token.visionRadius * dims.gridSize) / Math.max(dims.mapWidth, dims.mapHeight);
    const offset = i * FLOATS_PER_LIGHT;
    data[offset + 0] = u;
    data[offset + 1] = v;
    data[offset + 2] = radiusUV;
    data[offset + 3] = token.lightColor[0];
    data[offset + 4] = token.lightColor[1];
    data[offset + 5] = token.lightColor[2];
    data[offset + 6] = 2.0; // Quadratic falloff exponent
    data[offset + 7] = 0.0; // pad
  });
  return data;
}
