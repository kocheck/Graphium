import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// PixiJS mock — vi.hoisted ensures these values are available inside the
// vi.mock factory, which Vitest hoists to the top of the module before any
// other declarations run.
// ---------------------------------------------------------------------------
const { mockSprite, mockTilingSprite, mockAssetsLoad, getAssetsLoadResolve, setAssetsLoadResolve } =
  vi.hoisted(() => {
    const sprite = {
      zIndex: 0,
      alpha: 0,
      eventMode: '',
      width: 0,
      height: 0,
      destroyed: false,
      destroy: vi.fn(),
    };

    let resolveRef: ((texture: object) => void) | null = null;

    const assetsLoad = vi.fn(
      () =>
        new Promise<object>((resolve) => {
          resolveRef = resolve;
        }),
    );

    // Must use a regular function (not arrow) so it can be called with `new`.
    // eslint-disable-next-line prefer-arrow-callback
    const tilingSprite = vi.fn(function TilingSpriteMock() {
      return sprite;
    });

    return {
      mockSprite: sprite,
      mockTilingSprite: tilingSprite,
      mockAssetsLoad: assetsLoad,
      getAssetsLoadResolve: () => resolveRef,
      setAssetsLoadResolve: (r: ((texture: object) => void) | null) => {
        resolveRef = r;
      },
    };
  });

vi.mock('pixi.js', () => ({
  Assets: { load: mockAssetsLoad },
  TilingSprite: mockTilingSprite,
}));

// ---------------------------------------------------------------------------
// Import component AFTER mocks are in place.
// ---------------------------------------------------------------------------
import { PaperNoiseOverlay } from './PaperNoiseOverlay';
import React from 'react';
import { render } from '@testing-library/react';

/** Shorthand to resolve the pending Assets.load promise in a test. */
const resolveLoad = (texture: object): void => {
  getAssetsLoadResolve()?.(texture);
};

/**
 * Test Suite for PaperNoiseOverlay Component
 *
 * Tests the PixiJS-based paper texture overlay that provides a subtle
 * background effect over the battlemap canvas.
 * Covers:
 * - Sprite creation and attachment to worldContainer
 * - No-op when worldContainer or noiseUrl is absent
 * - Opacity and dimension synchronisation
 * - Cleanup on unmount
 */
describe('PaperNoiseOverlay', () => {
  const mockTexture = { id: 'mock-texture' };

  const makeContainer = () => ({
    addChild: vi.fn(),
    removeChild: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    setAssetsLoadResolve(null);
    mockSprite.zIndex = 0;
    mockSprite.alpha = 0;
    mockSprite.eventMode = '';
    mockSprite.width = 0;
    mockSprite.height = 0;
    mockSprite.destroyed = false;
    mockSprite.destroy.mockClear();
    // vi.clearAllMocks resets mock implementations — restore the constructor.
    // eslint-disable-next-line prefer-arrow-callback
    mockTilingSprite.mockImplementation(function TilingSpriteMock() {
      return mockSprite;
    });
    // Restore the Assets.load implementation too.
    mockAssetsLoad.mockImplementation(
      () =>
        new Promise<object>((resolve) => {
          setAssetsLoadResolve(resolve);
        }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  it('renders nothing (returns null) — is a pure side-effect component', () => {
    const container = makeContainer();
    const { container: domContainer } = render(
      <PaperNoiseOverlay
        worldContainer={container as never}
        mapWidth={800}
        mapHeight={600}
        noiseUrl="/noise.png"
      />,
    );
    // Component returns null — no DOM nodes added by the component itself
    expect(domContainer.firstChild).toBeNull();
  });

  // -------------------------------------------------------------------------
  // No-op guards
  // -------------------------------------------------------------------------

  it('does not call Assets.load when worldContainer is null', () => {
    render(
      <PaperNoiseOverlay
        worldContainer={null}
        mapWidth={800}
        mapHeight={600}
        noiseUrl="/noise.png"
      />,
    );
    expect(mockAssetsLoad).not.toHaveBeenCalled();
  });

  it('does not call Assets.load when noiseUrl is undefined', () => {
    const container = makeContainer();
    render(
      <PaperNoiseOverlay worldContainer={container as never} mapWidth={800} mapHeight={600} />,
    );
    expect(mockAssetsLoad).not.toHaveBeenCalled();
  });

  it('does not call Assets.load when noiseUrl is an empty string', () => {
    const container = makeContainer();
    render(
      <PaperNoiseOverlay
        worldContainer={container as never}
        mapWidth={800}
        mapHeight={600}
        noiseUrl=""
      />,
    );
    expect(mockAssetsLoad).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Sprite creation
  // -------------------------------------------------------------------------

  it('calls Assets.load with the provided noiseUrl', () => {
    const container = makeContainer();
    render(
      <PaperNoiseOverlay
        worldContainer={container as never}
        mapWidth={800}
        mapHeight={600}
        noiseUrl="/assets/paper-noise.png"
      />,
    );
    expect(mockAssetsLoad).toHaveBeenCalledWith('/assets/paper-noise.png');
  });

  it('creates a TilingSprite with correct dimensions after texture loads', async () => {
    const container = makeContainer();
    render(
      <PaperNoiseOverlay
        worldContainer={container as never}
        mapWidth={1024}
        mapHeight={768}
        noiseUrl="/noise.png"
      />,
    );

    await act(async () => {
      resolveLoad(mockTexture);
    });

    expect(mockTilingSprite).toHaveBeenCalledWith({
      texture: mockTexture,
      width: 1024,
      height: 768,
    });
  });

  it('sets zIndex to 5 on the sprite', async () => {
    const container = makeContainer();
    render(
      <PaperNoiseOverlay
        worldContainer={container as never}
        mapWidth={800}
        mapHeight={600}
        noiseUrl="/noise.png"
      />,
    );

    await act(async () => {
      resolveLoad(mockTexture);
    });

    expect(mockSprite.zIndex).toBe(5);
  });

  it('uses the provided opacity', async () => {
    const container = makeContainer();
    render(
      <PaperNoiseOverlay
        worldContainer={container as never}
        mapWidth={800}
        mapHeight={600}
        opacity={0.5}
        noiseUrl="/noise.png"
      />,
    );

    await act(async () => {
      resolveLoad(mockTexture);
    });

    expect(mockSprite.alpha).toBe(0.5);
  });

  it('defaults opacity to 0.25', async () => {
    const container = makeContainer();
    render(
      <PaperNoiseOverlay
        worldContainer={container as never}
        mapWidth={800}
        mapHeight={600}
        noiseUrl="/noise.png"
      />,
    );

    await act(async () => {
      resolveLoad(mockTexture);
    });

    expect(mockSprite.alpha).toBe(0.25);
  });

  it('sets eventMode to "none" so the overlay is non-interactive', async () => {
    const container = makeContainer();
    render(
      <PaperNoiseOverlay
        worldContainer={container as never}
        mapWidth={800}
        mapHeight={600}
        noiseUrl="/noise.png"
      />,
    );

    await act(async () => {
      resolveLoad(mockTexture);
    });

    expect(mockSprite.eventMode).toBe('none');
  });

  it('adds the sprite to worldContainer', async () => {
    const container = makeContainer();
    render(
      <PaperNoiseOverlay
        worldContainer={container as never}
        mapWidth={800}
        mapHeight={600}
        noiseUrl="/noise.png"
      />,
    );

    await act(async () => {
      resolveLoad(mockTexture);
    });

    expect(container.addChild).toHaveBeenCalledWith(mockSprite);
  });

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  it('removes sprite from worldContainer on unmount', async () => {
    const container = makeContainer();
    const { unmount } = render(
      <PaperNoiseOverlay
        worldContainer={container as never}
        mapWidth={800}
        mapHeight={600}
        noiseUrl="/noise.png"
      />,
    );

    await act(async () => {
      resolveLoad(mockTexture);
    });

    unmount();

    expect(container.removeChild).toHaveBeenCalledWith(mockSprite);
    expect(mockSprite.destroy).toHaveBeenCalled();
  });

  it('cancels pending texture load on unmount — does not add sprite after unmount', async () => {
    const container = makeContainer();
    const { unmount } = render(
      <PaperNoiseOverlay
        worldContainer={container as never}
        mapWidth={800}
        mapHeight={600}
        noiseUrl="/noise.png"
      />,
    );

    // Unmount BEFORE the texture resolves
    unmount();

    await act(async () => {
      resolveLoad(mockTexture);
    });

    // Sprite should never have been added
    expect(container.addChild).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Prop updates
  // -------------------------------------------------------------------------

  it('remounts sprite with new dimensions when mapWidth/mapHeight props change', async () => {
    const container = makeContainer();
    const { rerender } = render(
      <PaperNoiseOverlay
        worldContainer={container as never}
        mapWidth={800}
        mapHeight={600}
        noiseUrl="/noise.png"
      />,
    );

    // Resolve the first load so the sprite is mounted.
    await act(async () => {
      resolveLoad(mockTexture);
    });

    expect(container.addChild).toHaveBeenCalledTimes(1);

    // Rerender with new dimensions — triggers effect cleanup + re-run.
    rerender(
      <PaperNoiseOverlay
        worldContainer={container as never}
        mapWidth={1600}
        mapHeight={1200}
        noiseUrl="/noise.png"
      />,
    );

    // Old sprite is removed.
    expect(container.removeChild).toHaveBeenCalledWith(mockSprite);

    // Resolve the second load triggered by the remount.
    await act(async () => {
      resolveLoad(mockTexture);
    });

    // New TilingSprite is created with updated dimensions.
    expect(mockTilingSprite).toHaveBeenLastCalledWith({
      texture: mockTexture,
      width: 1600,
      height: 1200,
    });
  });

  it('remounts sprite with new alpha when opacity prop changes', async () => {
    const container = makeContainer();
    const { rerender } = render(
      <PaperNoiseOverlay
        worldContainer={container as never}
        mapWidth={800}
        mapHeight={600}
        opacity={0.1}
        noiseUrl="/noise.png"
      />,
    );

    await act(async () => {
      resolveLoad(mockTexture);
    });

    // Verify initial alpha.
    expect(mockSprite.alpha).toBe(0.1);

    // Change opacity — effect re-runs.
    rerender(
      <PaperNoiseOverlay
        worldContainer={container as never}
        mapWidth={800}
        mapHeight={600}
        opacity={0.8}
        noiseUrl="/noise.png"
      />,
    );

    // Old sprite cleaned up; resolve the new load.
    await act(async () => {
      resolveLoad(mockTexture);
    });

    // New sprite has updated alpha.
    expect(mockSprite.alpha).toBe(0.8);
  });
});
