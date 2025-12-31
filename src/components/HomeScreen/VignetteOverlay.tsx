/**
 * VignetteOverlay - Creates an "infinity fade" effect on the edges
 *
 * Applies a radial gradient that fades from transparent in the center
 * to the background color at the edges, creating a vignette effect.
 * This gives the background a "fade into infinity" aesthetic.
 */
export function VignetteOverlay() {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        background: `radial-gradient(
          ellipse at center,
          transparent 0%,
          transparent 50%,
          var(--app-bg-base) 100%
        )`,
      }}
    />
  );
}
