precision mediump float;

// Texture coordinates from vertex shader
varying vec2 vUvs;

// Fog uniforms
uniform float uFogAlpha;        // Base fog opacity (0–1)
uniform float uRevealAll;       // 1.0 = DM reveal mode, 0.0 = normal
uniform int uLightCount;        // Active light count
uniform vec3 uFogColor;         // Fog color (RGB)
uniform vec3 uExploredColor;    // Explored-but-not-visible color

// Light source data (MAX_LIGHTS × 8 floats packed as vec4 pairs)
// Layout: [u, v, radiusUV, r, g, b, falloff, _pad]
#define MAX_LIGHTS 32
uniform vec4 uLightsA[MAX_LIGHTS]; // [u, v, radiusUV, r]
uniform vec4 uLightsB[MAX_LIGHTS]; // [g, b, falloff, _pad]

void main() {
  if (uRevealAll > 0.5) {
    gl_FragColor = vec4(0.0); // Fully transparent — everything visible
    return;
  }

  vec3 totalLight = vec3(0.0);
  float maxVisibility = 0.0;

  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (i >= uLightCount) break;

    vec2 lightPos = uLightsA[i].xy;
    float radius = uLightsA[i].z;
    vec3 lightColor = vec3(uLightsA[i].w, uLightsB[i].x, uLightsB[i].y);
    float falloff = uLightsB[i].z;

    float dist = distance(vUvs, lightPos);
    if (dist < radius) {
      float t = 1.0 - (dist / radius);
      float intensity = pow(t, falloff); // Quadratic falloff
      totalLight += lightColor * intensity;
      maxVisibility = max(maxVisibility, intensity);
    }
  }

  // Areas with any visibility are clear; full fog elsewhere
  float fogStrength = (1.0 - maxVisibility) * uFogAlpha;
  vec3 fogTint = mix(uExploredColor, uFogColor, clamp(fogStrength, 0.0, 1.0));
  gl_FragColor = vec4(fogTint, fogStrength);
}
