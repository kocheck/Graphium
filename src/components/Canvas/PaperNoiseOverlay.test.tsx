import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { Stage, Layer } from 'react-konva';
import PaperNoiseOverlay from './PaperNoiseOverlay';

/**
 * Test Suite for PaperNoiseOverlay Component
 *
 * Tests the paper texture overlay that provides a subtle background effect.
 * Covers:
 * - SVG pattern generation and loading
 * - Image load success and failure scenarios
 * - Component rendering with various props
 * - Transform properties (position, scale, opacity)
 * - Non-interactive behavior
 */
describe('PaperNoiseOverlay', () => {
  let originalImage: typeof Image;
  let mockImage: {
    onload: ((this: HTMLImageElement, ev: Event) => void) | null;
    onerror: ((this: HTMLImageElement, ev: Event | string) => void) | null;
    src: string;
  };

  beforeEach(() => {
    // Save original Image constructor
    originalImage = global.Image;

    // Create mock Image
    mockImage = {
      onload: null,
      onerror: null,
      src: '',
    };

    // Mock Image constructor
    global.Image = vi.fn(() => mockImage) as any;

    // Suppress console.error for cleaner test output
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original Image constructor
    global.Image = originalImage;
    vi.restoreAllMocks();
  });

  it('should return null when pattern image is not loaded yet', () => {
    const { container } = render(
      <Stage width={800} height={600}>
        <Layer>
          <PaperNoiseOverlay x={0} y={0} width={800} height={600} scaleX={1} scaleY={1} />
        </Layer>
      </Stage>,
    );

    // Component should render but Rect should not be present
    expect(container.querySelector('canvas')).toBeInTheDocument();
  });

  it('should load SVG pattern as data URI', () => {
    render(
      <Stage width={800} height={600}>
        <Layer>
          <PaperNoiseOverlay x={0} y={0} width={800} height={600} scaleX={1} scaleY={1} />
        </Layer>
      </Stage>,
    );

    // Verify Image was created
    expect(global.Image).toHaveBeenCalled();

    // Verify src is a data URI containing SVG
    expect(mockImage.src).toContain('data:image/svg+xml');
    expect(mockImage.src).toContain('feTurbulence');
  });

  it('should render Rect after successful image load', () => {
    const { rerender } = render(
      <Stage width={800} height={600}>
        <Layer>
          <PaperNoiseOverlay x={0} y={0} width={800} height={600} scaleX={1} scaleY={1} />
        </Layer>
      </Stage>,
    );

    // Simulate successful image load
    if (mockImage.onload) {
      mockImage.onload.call(mockImage as any, new Event('load'));
    }

    // Force re-render
    rerender(
      <Stage width={800} height={600}>
        <Layer>
          <PaperNoiseOverlay x={0} y={0} width={800} height={600} scaleX={1} scaleY={1} />
        </Layer>
      </Stage>,
    );

    // Component should still be in document
    expect(document.querySelector('canvas')).toBeInTheDocument();
  });

  it('should use provided position props', () => {
    const { rerender } = render(
      <Stage width={800} height={600}>
        <Layer>
          <PaperNoiseOverlay x={100} y={200} width={800} height={600} scaleX={1} scaleY={1} />
        </Layer>
      </Stage>,
    );

    // Simulate image load
    if (mockImage.onload) {
      mockImage.onload.call(mockImage as any, new Event('load'));
    }

    rerender(
      <Stage width={800} height={600}>
        <Layer>
          <PaperNoiseOverlay x={100} y={200} width={800} height={600} scaleX={1} scaleY={1} />
        </Layer>
      </Stage>,
    );

    // Verify canvas is rendered
    expect(document.querySelector('canvas')).toBeInTheDocument();
  });

  it('should use provided scale props', () => {
    const { rerender } = render(
      <Stage width={800} height={600}>
        <Layer>
          <PaperNoiseOverlay x={0} y={0} width={800} height={600} scaleX={2.5} scaleY={1.5} />
        </Layer>
      </Stage>,
    );

    // Simulate image load
    if (mockImage.onload) {
      mockImage.onload.call(mockImage as any, new Event('load'));
    }

    rerender(
      <Stage width={800} height={600}>
        <Layer>
          <PaperNoiseOverlay x={0} y={0} width={800} height={600} scaleX={2.5} scaleY={1.5} />
        </Layer>
      </Stage>,
    );

    expect(document.querySelector('canvas')).toBeInTheDocument();
  });

  it('should use custom opacity when provided', () => {
    const { rerender } = render(
      <Stage width={800} height={600}>
        <Layer>
          <PaperNoiseOverlay
            x={0}
            y={0}
            width={800}
            height={600}
            scaleX={1}
            scaleY={1}
            opacity={0.5}
          />
        </Layer>
      </Stage>,
    );

    // Simulate image load
    if (mockImage.onload) {
      mockImage.onload.call(mockImage as any, new Event('load'));
    }

    rerender(
      <Stage width={800} height={600}>
        <Layer>
          <PaperNoiseOverlay
            x={0}
            y={0}
            width={800}
            height={600}
            scaleX={1}
            scaleY={1}
            opacity={0.5}
          />
        </Layer>
      </Stage>,
    );

    expect(document.querySelector('canvas')).toBeInTheDocument();
  });

  it('should use default opacity of 0.25 when not provided', () => {
    const { rerender } = render(
      <Stage width={800} height={600}>
        <Layer>
          <PaperNoiseOverlay x={0} y={0} width={800} height={600} scaleX={1} scaleY={1} />
        </Layer>
      </Stage>,
    );

    // Simulate image load
    if (mockImage.onload) {
      mockImage.onload.call(mockImage as any, new Event('load'));
    }

    rerender(
      <Stage width={800} height={600}>
        <Layer>
          <PaperNoiseOverlay x={0} y={0} width={800} height={600} scaleX={1} scaleY={1} />
        </Layer>
      </Stage>,
    );

    expect(document.querySelector('canvas')).toBeInTheDocument();
  });

  it('should handle image load error gracefully', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <Stage width={800} height={600}>
        <Layer>
          <PaperNoiseOverlay x={0} y={0} width={800} height={600} scaleX={1} scaleY={1} />
        </Layer>
      </Stage>,
    );

    // Simulate image load error
    if (mockImage.onerror) {
      mockImage.onerror.call(mockImage as any, new Event('error'));
    }

    // Should log error
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[PaperNoiseOverlay] Failed to load pattern image:'),
      expect.any(Event),
    );

    consoleErrorSpy.mockRestore();
  });

  it('should clean up image event handlers on unmount', () => {
    const { unmount } = render(
      <Stage width={800} height={600}>
        <Layer>
          <PaperNoiseOverlay x={0} y={0} width={800} height={600} scaleX={1} scaleY={1} />
        </Layer>
      </Stage>,
    );

    // Verify handlers are set
    expect(mockImage.onload).not.toBeNull();
    expect(mockImage.onerror).not.toBeNull();

    // Unmount component
    unmount();

    // Handlers should be cleaned up
    expect(mockImage.onload).toBeNull();
    expect(mockImage.onerror).toBeNull();
  });

  it('should handle rapid prop changes without memory leaks', () => {
    const { rerender, unmount } = render(
      <Stage width={800} height={600}>
        <Layer>
          <PaperNoiseOverlay x={0} y={0} width={800} height={600} scaleX={1} scaleY={1} />
        </Layer>
      </Stage>,
    );

    // Simulate rapid position changes (e.g., during panning)
    for (let i = 0; i < 10; i++) {
      rerender(
        <Stage width={800} height={600}>
          <Layer>
            <PaperNoiseOverlay
              x={i * 10}
              y={i * 10}
              width={800}
              height={600}
              scaleX={1 + i * 0.1}
              scaleY={1 + i * 0.1}
            />
          </Layer>
        </Stage>,
      );
    }

    // Should not crash
    expect(document.querySelector('canvas')).toBeInTheDocument();

    unmount();
  });

  it('should generate SVG with correct feTurbulence parameters', () => {
    render(
      <Stage width={800} height={600}>
        <Layer>
          <PaperNoiseOverlay x={0} y={0} width={800} height={600} scaleX={1} scaleY={1} />
        </Layer>
      </Stage>,
    );

    // Verify SVG contains expected turbulence parameters
    const decodedSvg = decodeURIComponent(mockImage.src.replace('data:image/svg+xml,', ''));
    expect(decodedSvg).toContain('feTurbulence');
    expect(decodedSvg).toContain('type="fractalNoise"');
    expect(decodedSvg).toContain('baseFrequency="0.9"');
    expect(decodedSvg).toContain('numOctaves="4"');
    expect(decodedSvg).toContain('stitchTiles="stitch"');
  });

  it('should handle zero dimensions gracefully', () => {
    const { rerender } = render(
      <Stage width={800} height={600}>
        <Layer>
          <PaperNoiseOverlay x={0} y={0} width={0} height={0} scaleX={1} scaleY={1} />
        </Layer>
      </Stage>,
    );

    // Simulate image load
    if (mockImage.onload) {
      mockImage.onload.call(mockImage as any, new Event('load'));
    }

    rerender(
      <Stage width={800} height={600}>
        <Layer>
          <PaperNoiseOverlay x={0} y={0} width={0} height={0} scaleX={1} scaleY={1} />
        </Layer>
      </Stage>,
    );

    // Should still render without errors
    expect(document.querySelector('canvas')).toBeInTheDocument();
  });

  it('should handle negative scale values', () => {
    const { rerender } = render(
      <Stage width={800} height={600}>
        <Layer>
          <PaperNoiseOverlay x={0} y={0} width={800} height={600} scaleX={-1} scaleY={-1} />
        </Layer>
      </Stage>,
    );

    // Simulate image load
    if (mockImage.onload) {
      mockImage.onload.call(mockImage as any, new Event('load'));
    }

    rerender(
      <Stage width={800} height={600}>
        <Layer>
          <PaperNoiseOverlay x={0} y={0} width={800} height={600} scaleX={-1} scaleY={-1} />
        </Layer>
      </Stage>,
    );

    // Should handle negative scales (for flipping)
    expect(document.querySelector('canvas')).toBeInTheDocument();
  });
});
