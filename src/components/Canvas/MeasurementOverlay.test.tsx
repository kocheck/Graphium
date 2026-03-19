/**
 * Test Suite for MeasurementOverlay Component (PixiJS imperative)
 *
 * Since PixiJS cannot run WebGL in vitest/jsdom, pixi.js is fully mocked.
 * Tests verify:
 * - null worldContainer → no crash, nothing mounted
 * - valid worldContainer → Container mounted via addChild
 * - null measurement → graphics cleared (no children on layer container)
 * - ruler / blast / cone types → no throw
 * - custom color props accepted
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// PixiJS mock — vi.hoisted so the factory values are available in vi.mock.
// ---------------------------------------------------------------------------
const { MockContainer, MockGraphics, MockText, MockTextStyle } = vi.hoisted(() => {
  class Container {
    zIndex = 0;
    children: unknown[] = [];
    addChild(child: unknown): unknown {
      this.children.push(child);
      return child;
    }
    removeChild(_child: unknown): void {
      /* no-op */
    }
    removeChildren(): unknown[] {
      const removed = [...this.children];
      this.children = [];
      return removed;
    }
    destroy(_opts?: unknown): void {
      /* no-op */
    }
  }

  class Graphics {
    clear(): this {
      return this;
    }
    moveTo(_x: number, _y: number): this {
      return this;
    }
    lineTo(_x: number, _y: number): this {
      return this;
    }
    stroke(_opts?: unknown): this {
      return this;
    }
    circle(_x: number, _y: number, _r: number): this {
      return this;
    }
    fill(_opts?: unknown): this {
      return this;
    }
    poly(_pts: unknown, _close?: boolean): this {
      return this;
    }
    closePath(): this {
      return this;
    }
    destroy(_opts?: unknown): void {
      /* no-op */
    }
  }

  class Text {
    x = 0;
    y = 0;
    constructor(_opts?: unknown) {
      /* no-op */
    }
    destroy(_opts?: unknown): void {
      /* no-op */
    }
  }

  class TextStyle {
    constructor(_opts?: unknown) {
      /* no-op */
    }
  }

  return {
    MockContainer: Container,
    MockGraphics: Graphics,
    MockText: Text,
    MockTextStyle: TextStyle,
  };
});

vi.mock('pixi.js', () => ({
  Container: MockContainer,
  Graphics: MockGraphics,
  Text: MockText,
  TextStyle: MockTextStyle,
}));

vi.mock('../../utils/measurement', () => ({
  formatDistance: (feet: number) => `${feet} ft`,
  formatRadius: (feet: number) => `Radius: ${feet} ft`,
  formatCone: (length: number, angle: number) => `${length} ft cone (${angle}°)`,
}));

// ---------------------------------------------------------------------------
// Import component AFTER mocks are in place.
// ---------------------------------------------------------------------------
import { render } from '@testing-library/react';
import { MeasurementOverlay } from './MeasurementOverlay';
import type { RulerMeasurement, BlastMeasurement, ConeMeasurement } from '../../types/measurement';

describe('MeasurementOverlay', () => {
  const gridSize = 50;

  let mockWorldContainer: InstanceType<typeof MockContainer>;

  beforeEach(() => {
    mockWorldContainer = new MockContainer();
  });

  // -------------------------------------------------------------------------
  // null worldContainer
  // -------------------------------------------------------------------------

  it('renders null and does not crash when worldContainer is null', () => {
    const { container } = render(
      <MeasurementOverlay worldContainer={null} measurement={null} gridSize={gridSize} />,
    );
    // Component always returns null — no DOM output
    expect(container.firstChild).toBeNull();
    // Nothing was mounted on the standalone mockWorldContainer
    expect(mockWorldContainer.children).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Container mounting
  // -------------------------------------------------------------------------

  it('mounts a Container onto worldContainer when worldContainer is provided', () => {
    render(
      <MeasurementOverlay
        worldContainer={mockWorldContainer}
        measurement={null}
        gridSize={gridSize}
      />,
    );
    expect(mockWorldContainer.children).toHaveLength(1);
  });

  it('unmounts Container from worldContainer on component unmount', () => {
    const removeChildSpy = vi.spyOn(mockWorldContainer, 'removeChild');

    const { unmount } = render(
      <MeasurementOverlay
        worldContainer={mockWorldContainer}
        measurement={null}
        gridSize={gridSize}
      />,
    );

    unmount();
    expect(removeChildSpy).toHaveBeenCalledOnce();
  });

  // -------------------------------------------------------------------------
  // null measurement
  // -------------------------------------------------------------------------

  it('clears children when measurement switches to null', () => {
    const rulerMeasurement: RulerMeasurement = {
      id: 'ruler-1',
      type: 'ruler',
      origin: { x: 100, y: 100 },
      end: { x: 300, y: 200 },
      distanceFeet: 45,
    };

    const { rerender } = render(
      <MeasurementOverlay
        worldContainer={mockWorldContainer}
        measurement={rulerMeasurement}
        gridSize={gridSize}
      />,
    );

    rerender(
      <MeasurementOverlay
        worldContainer={mockWorldContainer}
        measurement={null}
        gridSize={gridSize}
      />,
    );

    // Layer container (first child of worldContainer) should have no graphics
    const layerContainer = mockWorldContainer.children[0] as InstanceType<typeof MockContainer>;
    expect(layerContainer.children).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Measurement types — no throw
  // -------------------------------------------------------------------------

  it('does not throw for ruler measurement type', () => {
    const rulerMeasurement: RulerMeasurement = {
      id: 'ruler-1',
      type: 'ruler',
      origin: { x: 100, y: 100 },
      end: { x: 300, y: 200 },
      distanceFeet: 45,
    };

    expect(() => {
      render(
        <MeasurementOverlay
          worldContainer={mockWorldContainer}
          measurement={rulerMeasurement}
          gridSize={gridSize}
        />,
      );
    }).not.toThrow();
  });

  it('does not throw for blast measurement type', () => {
    const blastMeasurement: BlastMeasurement = {
      id: 'blast-1',
      type: 'blast',
      origin: { x: 400, y: 300 },
      radius: 100,
      radiusFeet: 20,
    };

    expect(() => {
      render(
        <MeasurementOverlay
          worldContainer={mockWorldContainer}
          measurement={blastMeasurement}
          gridSize={gridSize}
        />,
      );
    }).not.toThrow();
  });

  it('does not throw for cone measurement type', () => {
    const coneMeasurement: ConeMeasurement = {
      id: 'cone-1',
      type: 'cone',
      origin: { x: 200, y: 200 },
      target: { x: 400, y: 200 },
      lengthFeet: 30,
      angleDegrees: 53,
      vertices: [
        { x: 200, y: 200 },
        { x: 400, y: 150 },
        { x: 400, y: 250 },
      ],
    };

    expect(() => {
      render(
        <MeasurementOverlay
          worldContainer={mockWorldContainer}
          measurement={coneMeasurement}
          gridSize={gridSize}
        />,
      );
    }).not.toThrow();
  });

  it('does not throw for unknown measurement type (switch default branch)', () => {
    const unknownMeasurement = {
      id: 'unknown-1',
      type: 'unknown-type',
      origin: { x: 100, y: 100 },
    } as unknown as RulerMeasurement;

    expect(() => {
      render(
        <MeasurementOverlay
          worldContainer={mockWorldContainer}
          measurement={unknownMeasurement}
          gridSize={gridSize}
        />,
      );
    }).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // Custom color props
  // -------------------------------------------------------------------------

  it('accepts all custom styling props without throwing', () => {
    const blastMeasurement: BlastMeasurement = {
      id: 'blast-styled',
      type: 'blast',
      origin: { x: 400, y: 300 },
      radius: 100,
      radiusFeet: 20,
    };

    expect(() => {
      render(
        <MeasurementOverlay
          worldContainer={mockWorldContainer}
          measurement={blastMeasurement}
          gridSize={gridSize}
          fillColor="rgba(255, 0, 0, 0.3)"
          strokeColor="rgba(255, 0, 0, 1)"
          strokeWidth={4}
          textColor="#ffffff"
          textBgColor="rgba(0,0,0,0.9)"
        />,
      );
    }).not.toThrow();
  });
});
