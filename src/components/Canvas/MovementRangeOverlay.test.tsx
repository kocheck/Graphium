/**
 * Test Suite for MovementRangeOverlay Component (PixiJS imperative)
 *
 * Since PixiJS cannot run WebGL in vitest/jsdom, pixi.js is fully mocked.
 * Tests verify:
 * - null worldContainer → no crash, nothing mounted
 * - valid worldContainer → Container mounted via addChild
 * - HIDDEN grid type → nothing rendered inside layer
 * - zero / large movement speed → no crash
 * - all grid types accepted without throwing
 * - custom color props accepted
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// PixiJS mock — vi.hoisted ensures mock classes are ready for vi.mock factory.
// ---------------------------------------------------------------------------
const { MockContainer, MockGraphics } = vi.hoisted(() => {
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
    eventMode: string = 'none';
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

  return { MockContainer: Container, MockGraphics: Graphics };
});

vi.mock('pixi.js', () => ({
  Container: MockContainer,
  Graphics: MockGraphics,
}));

// Mock gridGeometry so BFS runs without real geometry computations
vi.mock('../../utils/gridGeometry', () => ({
  createGridGeometry: () => ({
    pixelToGrid: (x: number, y: number, _gridSize: number) => ({
      q: Math.floor(x / 50),
      r: Math.floor(y / 50),
    }),
    getCellVertices: (cell: { q: number; r: number }, gridSize: number) => [
      { x: cell.q * gridSize, y: cell.r * gridSize },
      { x: cell.q * gridSize + gridSize, y: cell.r * gridSize },
      { x: cell.q * gridSize + gridSize, y: cell.r * gridSize + gridSize },
      { x: cell.q * gridSize, y: cell.r * gridSize + gridSize },
    ],
  }),
}));

// ---------------------------------------------------------------------------
// Import component AFTER mocks are in place.
// ---------------------------------------------------------------------------
import { render } from '@testing-library/react';
import MovementRangeOverlay from './MovementRangeOverlay';

describe('MovementRangeOverlay', () => {
  const gridSize = 50;
  let mockWorldContainer: InstanceType<typeof MockContainer>;

  beforeEach(() => {
    mockWorldContainer = new MockContainer();
  });

  // -------------------------------------------------------------------------
  // null worldContainer
  // -------------------------------------------------------------------------

  it('does not crash when worldContainer is null', () => {
    expect(() => {
      render(
        <MovementRangeOverlay
          worldContainer={null}
          tokenPosition={{ x: 100, y: 100 }}
          movementSpeed={30}
          gridSize={gridSize}
          gridType="LINES"
        />,
      );
    }).not.toThrow();
  });

  it('does not add children to any parent when worldContainer is null', () => {
    render(
      <MovementRangeOverlay
        worldContainer={null}
        tokenPosition={{ x: 100, y: 100 }}
        movementSpeed={30}
        gridSize={gridSize}
        gridType="LINES"
      />,
    );
    expect(mockWorldContainer.children).toHaveLength(0);
  });

  it('returns null (no DOM nodes) regardless of props', () => {
    const { container } = render(
      <MovementRangeOverlay
        worldContainer={mockWorldContainer}
        tokenPosition={{ x: 100, y: 100 }}
        movementSpeed={30}
        gridSize={gridSize}
        gridType="LINES"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Container mounting
  // -------------------------------------------------------------------------

  it('mounts a Container onto worldContainer when worldContainer is provided', () => {
    render(
      <MovementRangeOverlay
        worldContainer={mockWorldContainer}
        tokenPosition={{ x: 100, y: 100 }}
        movementSpeed={30}
        gridSize={gridSize}
        gridType="LINES"
      />,
    );
    expect(mockWorldContainer.children).toHaveLength(1);
  });

  it('unmounts Container from worldContainer on component unmount', () => {
    const removeChildSpy = vi.spyOn(mockWorldContainer, 'removeChild');

    const { unmount } = render(
      <MovementRangeOverlay
        worldContainer={mockWorldContainer}
        tokenPosition={{ x: 100, y: 100 }}
        movementSpeed={30}
        gridSize={gridSize}
        gridType="LINES"
      />,
    );

    unmount();
    expect(removeChildSpy).toHaveBeenCalledOnce();
  });

  // -------------------------------------------------------------------------
  // HIDDEN grid type
  // -------------------------------------------------------------------------

  it('renders no graphics children for HIDDEN grid type', () => {
    render(
      <MovementRangeOverlay
        worldContainer={mockWorldContainer}
        tokenPosition={{ x: 100, y: 100 }}
        movementSpeed={30}
        gridSize={gridSize}
        gridType="HIDDEN"
      />,
    );

    const layerContainer = mockWorldContainer.children[0] as InstanceType<typeof MockContainer>;
    expect(layerContainer.children).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Grid type variants — no throw
  // -------------------------------------------------------------------------

  it('does not throw for LINES grid type', () => {
    expect(() => {
      render(
        <MovementRangeOverlay
          worldContainer={mockWorldContainer}
          tokenPosition={{ x: 100, y: 100 }}
          movementSpeed={30}
          gridSize={gridSize}
          gridType="LINES"
        />,
      );
    }).not.toThrow();
  });

  it('does not throw for DOTS grid type', () => {
    expect(() => {
      render(
        <MovementRangeOverlay
          worldContainer={mockWorldContainer}
          tokenPosition={{ x: 100, y: 100 }}
          movementSpeed={30}
          gridSize={gridSize}
          gridType="DOTS"
        />,
      );
    }).not.toThrow();
  });

  it('does not throw for HEXAGONAL grid type', () => {
    expect(() => {
      render(
        <MovementRangeOverlay
          worldContainer={mockWorldContainer}
          tokenPosition={{ x: 100, y: 100 }}
          movementSpeed={30}
          gridSize={gridSize}
          gridType="HEXAGONAL"
        />,
      );
    }).not.toThrow();
  });

  it('does not throw for ISOMETRIC grid type', () => {
    expect(() => {
      render(
        <MovementRangeOverlay
          worldContainer={mockWorldContainer}
          tokenPosition={{ x: 100, y: 100 }}
          movementSpeed={30}
          gridSize={gridSize}
          gridType="ISOMETRIC"
        />,
      );
    }).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // Movement speed edge cases
  // -------------------------------------------------------------------------

  it('does not throw with zero movement speed', () => {
    expect(() => {
      render(
        <MovementRangeOverlay
          worldContainer={mockWorldContainer}
          tokenPosition={{ x: 100, y: 100 }}
          movementSpeed={0}
          gridSize={gridSize}
          gridType="LINES"
        />,
      );
    }).not.toThrow();
  });

  it('does not throw with large movement speed', () => {
    expect(() => {
      render(
        <MovementRangeOverlay
          worldContainer={mockWorldContainer}
          tokenPosition={{ x: 100, y: 100 }}
          movementSpeed={300}
          gridSize={gridSize}
          gridType="LINES"
        />,
      );
    }).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // Custom color props
  // -------------------------------------------------------------------------

  it('accepts custom fill and stroke colors without throwing', () => {
    expect(() => {
      render(
        <MovementRangeOverlay
          worldContainer={mockWorldContainer}
          tokenPosition={{ x: 100, y: 100 }}
          movementSpeed={30}
          gridSize={gridSize}
          gridType="LINES"
          fillColor="rgba(0, 128, 255, 0.2)"
          strokeColor="rgba(0, 100, 200, 0.5)"
        />,
      );
    }).not.toThrow();
  });
});
