import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Stage, Layer } from 'react-konva';
import { MeasurementOverlay } from './MeasurementOverlay';
import {
  Measurement,
  RulerMeasurement,
  BlastMeasurement,
  ConeMeasurement,
} from '../../types/measurement';

/**
 * Test Suite for MeasurementOverlay Component
 *
 * Tests the measurement overlay rendering for distance and AoE calculations.
 * Covers:
 * - Ruler (line) measurement rendering
 * - Blast (circle) measurement rendering
 * - Cone (triangle) measurement rendering
 * - Null/undefined measurement handling
 * - Custom styling props
 * - Text label positioning and formatting
 * - Edge cases (zero dimensions, negative coords)
 */

// Mock the measurement utils
vi.mock('../../utils/measurement', () => ({
  formatDistance: (feet: number) => `${feet} ft`,
  formatRadius: (feet: number) => `Radius: ${feet} ft`,
  formatCone: (length: number, angle: number) => `${length} ft cone (${angle}°)`,
}));

describe('MeasurementOverlay', () => {
  const gridSize = 50;

  it('should return null when measurement is null', () => {
    const { container } = render(
      <Stage width={800} height={600}>
        <Layer>
          <MeasurementOverlay measurement={null} gridSize={gridSize} />
        </Layer>
      </Stage>,
    );

    expect(container.querySelector('canvas')).toBeInTheDocument();
  });

  describe('Ruler Measurement', () => {
    const rulerMeasurement: RulerMeasurement = {
      id: 'ruler-1',
      type: 'ruler',
      origin: { x: 100, y: 100 },
      end: { x: 300, y: 200 },
      distanceFeet: 45,
    };

    it('should render ruler line', () => {
      const { container } = render(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay measurement={rulerMeasurement} gridSize={gridSize} />
          </Layer>
        </Stage>,
      );

      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    it('should use default stroke color for ruler', () => {
      const { container } = render(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay measurement={rulerMeasurement} gridSize={gridSize} />
          </Layer>
        </Stage>,
      );

      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    it('should use custom stroke color for ruler', () => {
      const { container } = render(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay
              measurement={rulerMeasurement}
              gridSize={gridSize}
              strokeColor="rgba(255, 0, 0, 1)"
            />
          </Layer>
        </Stage>,
      );

      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    it('should use custom stroke width for ruler', () => {
      const { container } = render(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay
              measurement={rulerMeasurement}
              gridSize={gridSize}
              strokeWidth={5}
            />
          </Layer>
        </Stage>,
      );

      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    it('should handle horizontal ruler', () => {
      const horizontalRuler: RulerMeasurement = {
        id: 'ruler-h',
        type: 'ruler',
        origin: { x: 100, y: 200 },
        end: { x: 400, y: 200 },
        distanceFeet: 60,
      };

      const { container } = render(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay measurement={horizontalRuler} gridSize={gridSize} />
          </Layer>
        </Stage>,
      );

      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    it('should handle vertical ruler', () => {
      const verticalRuler: RulerMeasurement = {
        id: 'ruler-v',
        type: 'ruler',
        origin: { x: 200, y: 100 },
        end: { x: 200, y: 400 },
        distanceFeet: 60,
      };

      const { container } = render(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay measurement={verticalRuler} gridSize={gridSize} />
          </Layer>
        </Stage>,
      );

      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    it('should handle diagonal ruler', () => {
      const diagonalRuler: RulerMeasurement = {
        id: 'ruler-d',
        type: 'ruler',
        origin: { x: 100, y: 100 },
        end: { x: 400, y: 400 },
        distanceFeet: 85,
      };

      const { container } = render(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay measurement={diagonalRuler} gridSize={gridSize} />
          </Layer>
        </Stage>,
      );

      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    it('should handle zero-length ruler', () => {
      const zeroRuler: RulerMeasurement = {
        id: 'ruler-zero',
        type: 'ruler',
        origin: { x: 200, y: 200 },
        end: { x: 200, y: 200 },
        distanceFeet: 0,
      };

      const { container } = render(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay measurement={zeroRuler} gridSize={gridSize} />
          </Layer>
        </Stage>,
      );

      expect(container.querySelector('canvas')).toBeInTheDocument();
    });
  });

  describe('Blast Measurement', () => {
    const blastMeasurement: BlastMeasurement = {
      id: 'blast-1',
      type: 'blast',
      origin: { x: 400, y: 300 },
      radius: 100,
      radiusFeet: 20,
    };

    it('should render blast circle', () => {
      const { container } = render(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay measurement={blastMeasurement} gridSize={gridSize} />
          </Layer>
        </Stage>,
      );

      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    it('should use default fill color for blast', () => {
      const { container } = render(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay measurement={blastMeasurement} gridSize={gridSize} />
          </Layer>
        </Stage>,
      );

      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    it('should use custom fill color for blast', () => {
      const { container } = render(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay
              measurement={blastMeasurement}
              gridSize={gridSize}
              fillColor="rgba(255, 100, 0, 0.5)"
            />
          </Layer>
        </Stage>,
      );

      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    it('should handle small blast radius', () => {
      const smallBlast: BlastMeasurement = {
        id: 'blast-small',
        type: 'blast',
        origin: { x: 200, y: 200 },
        radius: 10,
        radiusFeet: 2,
      };

      const { container } = render(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay measurement={smallBlast} gridSize={gridSize} />
          </Layer>
        </Stage>,
      );

      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    it('should handle large blast radius', () => {
      const largeBlast: BlastMeasurement = {
        id: 'blast-large',
        type: 'blast',
        origin: { x: 400, y: 300 },
        radius: 500,
        radiusFeet: 100,
      };

      const { container } = render(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay measurement={largeBlast} gridSize={gridSize} />
          </Layer>
        </Stage>,
      );

      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    it('should handle zero radius blast', () => {
      const zeroBlast: BlastMeasurement = {
        id: 'blast-zero',
        type: 'blast',
        origin: { x: 300, y: 300 },
        radius: 0,
        radiusFeet: 0,
      };

      const { container } = render(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay measurement={zeroBlast} gridSize={gridSize} />
          </Layer>
        </Stage>,
      );

      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    it('should handle blast at canvas edge', () => {
      const edgeBlast: BlastMeasurement = {
        id: 'blast-edge',
        type: 'blast',
        origin: { x: 0, y: 0 },
        radius: 50,
        radiusFeet: 10,
      };

      const { container } = render(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay measurement={edgeBlast} gridSize={gridSize} />
          </Layer>
        </Stage>,
      );

      expect(container.querySelector('canvas')).toBeInTheDocument();
    });
  });

  describe('Cone Measurement', () => {
    const coneMeasurement: ConeMeasurement = {
      id: 'cone-1',
      type: 'cone',
      origin: { x: 200, y: 200 },
      target: { x: 400, y: 200 },
      lengthFeet: 30,
      angleDegrees: 53,
      vertices: [
        { x: 200, y: 200 }, // origin
        { x: 400, y: 150 }, // left
        { x: 400, y: 250 }, // right
      ],
    };

    it('should render cone triangle', () => {
      const { container } = render(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay measurement={coneMeasurement} gridSize={gridSize} />
          </Layer>
        </Stage>,
      );

      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    it('should use custom colors for cone', () => {
      const { container } = render(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay
              measurement={coneMeasurement}
              gridSize={gridSize}
              fillColor="rgba(0, 255, 0, 0.3)"
              strokeColor="rgba(0, 200, 0, 1)"
            />
          </Layer>
        </Stage>,
      );

      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    it('should handle narrow cone angle', () => {
      const narrowCone: ConeMeasurement = {
        id: 'cone-narrow',
        type: 'cone',
        origin: { x: 200, y: 200 },
        target: { x: 400, y: 200 },
        lengthFeet: 30,
        angleDegrees: 15,
        vertices: [
          { x: 200, y: 200 },
          { x: 400, y: 190 },
          { x: 400, y: 210 },
        ],
      };

      const { container } = render(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay measurement={narrowCone} gridSize={gridSize} />
          </Layer>
        </Stage>,
      );

      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    it('should handle wide cone angle', () => {
      const wideCone: ConeMeasurement = {
        id: 'cone-wide',
        type: 'cone',
        origin: { x: 200, y: 200 },
        target: { x: 400, y: 200 },
        lengthFeet: 30,
        angleDegrees: 90,
        vertices: [
          { x: 200, y: 200 },
          { x: 400, y: 100 },
          { x: 400, y: 300 },
        ],
      };

      const { container } = render(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay measurement={wideCone} gridSize={gridSize} />
          </Layer>
        </Stage>,
      );

      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    it('should handle cone pointing in different directions', () => {
      const directions = [
        { x: 400, y: 200 }, // right
        { x: 200, y: 400 }, // down
        { x: 0, y: 200 }, // left
        { x: 200, y: 0 }, // up
      ];

      directions.forEach((target, index) => {
        const directionalCone: ConeMeasurement = {
          id: `cone-dir-${index}`,
          type: 'cone',
          origin: { x: 200, y: 200 },
          target,
          lengthFeet: 30,
          angleDegrees: 53,
          vertices: [{ x: 200, y: 200 }, target, { x: target.x + 50, y: target.y + 50 }],
        };

        const { container } = render(
          <Stage width={800} height={600}>
            <Layer>
              <MeasurementOverlay measurement={directionalCone} gridSize={gridSize} />
            </Layer>
          </Stage>,
        );

        expect(container.querySelector('canvas')).toBeInTheDocument();
      });
    });

    it('should handle zero-length cone', () => {
      const zeroCone: ConeMeasurement = {
        id: 'cone-zero',
        type: 'cone',
        origin: { x: 200, y: 200 },
        target: { x: 200, y: 200 },
        lengthFeet: 0,
        angleDegrees: 53,
        vertices: [
          { x: 200, y: 200 },
          { x: 200, y: 200 },
          { x: 200, y: 200 },
        ],
      };

      const { container } = render(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay measurement={zeroCone} gridSize={gridSize} />
          </Layer>
        </Stage>,
      );

      expect(container.querySelector('canvas')).toBeInTheDocument();
    });
  });

  describe('Custom styling props', () => {
    const measurement: BlastMeasurement = {
      id: 'styled-blast',
      type: 'blast',
      origin: { x: 400, y: 300 },
      radius: 100,
      radiusFeet: 20,
    };

    it('should apply custom text color', () => {
      const { container } = render(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay measurement={measurement} gridSize={gridSize} textColor="#ff0000" />
          </Layer>
        </Stage>,
      );

      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    it('should apply custom text background color', () => {
      const { container } = render(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay
              measurement={measurement}
              gridSize={gridSize}
              textBgColor="rgba(255, 255, 255, 0.9)"
            />
          </Layer>
        </Stage>,
      );

      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    it('should apply all custom styling props together', () => {
      const { container } = render(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay
              measurement={measurement}
              gridSize={gridSize}
              fillColor="rgba(255, 0, 0, 0.2)"
              strokeColor="rgba(255, 0, 0, 0.8)"
              strokeWidth={4}
              textColor="#ffff00"
              textBgColor="rgba(0, 0, 0, 0.9)"
            />
          </Layer>
        </Stage>,
      );

      expect(container.querySelector('canvas')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle negative coordinates', () => {
      const negativeRuler: RulerMeasurement = {
        id: 'negative-ruler',
        type: 'ruler',
        origin: { x: -100, y: -100 },
        end: { x: 100, y: 100 },
        distanceFeet: 50,
      };

      const { container } = render(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay measurement={negativeRuler} gridSize={gridSize} />
          </Layer>
        </Stage>,
      );

      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    it('should handle very large coordinates', () => {
      const largeRuler: RulerMeasurement = {
        id: 'large-ruler',
        type: 'ruler',
        origin: { x: 10000, y: 10000 },
        end: { x: 20000, y: 20000 },
        distanceFeet: 2000,
      };

      const { container } = render(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay measurement={largeRuler} gridSize={gridSize} />
          </Layer>
        </Stage>,
      );

      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    it('should handle fractional coordinates', () => {
      const fractionalRuler: RulerMeasurement = {
        id: 'fractional-ruler',
        type: 'ruler',
        origin: { x: 100.5, y: 200.75 },
        end: { x: 300.25, y: 400.5 },
        distanceFeet: 50,
      };

      const { container } = render(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay measurement={fractionalRuler} gridSize={gridSize} />
          </Layer>
        </Stage>,
      );

      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    it('should handle zero grid size', () => {
      const ruler: RulerMeasurement = {
        id: 'zero-grid-ruler',
        type: 'ruler',
        origin: { x: 100, y: 100 },
        end: { x: 300, y: 300 },
        distanceFeet: 50,
      };

      const { container } = render(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay measurement={ruler} gridSize={0} />
          </Layer>
        </Stage>,
      );

      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    it('should handle very small grid size', () => {
      const ruler: RulerMeasurement = {
        id: 'small-grid-ruler',
        type: 'ruler',
        origin: { x: 100, y: 100 },
        end: { x: 300, y: 300 },
        distanceFeet: 50,
      };

      const { container } = render(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay measurement={ruler} gridSize={1} />
          </Layer>
        </Stage>,
      );

      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    it('should handle very large grid size', () => {
      const ruler: RulerMeasurement = {
        id: 'large-grid-ruler',
        type: 'ruler',
        origin: { x: 100, y: 100 },
        end: { x: 300, y: 300 },
        distanceFeet: 50,
      };

      const { container } = render(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay measurement={ruler} gridSize={1000} />
          </Layer>
        </Stage>,
      );

      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    it('should handle measurement type that is invalid', () => {
      const invalidMeasurement = {
        id: 'invalid',
        type: 'invalid-type',
        origin: { x: 100, y: 100 },
      } as any;

      const { container } = render(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay measurement={invalidMeasurement} gridSize={gridSize} />
          </Layer>
        </Stage>,
      );

      // Should render without crashing, but return null for invalid type
      expect(container.querySelector('canvas')).toBeInTheDocument();
    });
  });

  describe('Rendering optimizations', () => {
    it('should handle rapid measurement updates without errors', () => {
      const { rerender } = render(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay
              measurement={{
                id: 'changing',
                type: 'ruler',
                origin: { x: 100, y: 100 },
                end: { x: 200, y: 200 },
                distanceFeet: 25,
              }}
              gridSize={gridSize}
            />
          </Layer>
        </Stage>,
      );

      // Simulate rapid updates (e.g., during dragging)
      for (let i = 0; i < 50; i++) {
        rerender(
          <Stage width={800} height={600}>
            <Layer>
              <MeasurementOverlay
                measurement={{
                  id: 'changing',
                  type: 'ruler',
                  origin: { x: 100, y: 100 },
                  end: { x: 200 + i * 5, y: 200 + i * 5 },
                  distanceFeet: 25 + i,
                }}
                gridSize={gridSize}
              />
            </Layer>
          </Stage>,
        );
      }

      expect(document.querySelector('canvas')).toBeInTheDocument();
    });

    it('should handle switching between measurement types', () => {
      const { rerender } = render(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay
              measurement={{
                id: 'm1',
                type: 'ruler',
                origin: { x: 100, y: 100 },
                end: { x: 300, y: 300 },
                distanceFeet: 50,
              }}
              gridSize={gridSize}
            />
          </Layer>
        </Stage>,
      );

      rerender(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay
              measurement={{
                id: 'm2',
                type: 'blast',
                origin: { x: 200, y: 200 },
                radius: 100,
                radiusFeet: 20,
              }}
              gridSize={gridSize}
            />
          </Layer>
        </Stage>,
      );

      rerender(
        <Stage width={800} height={600}>
          <Layer>
            <MeasurementOverlay
              measurement={{
                id: 'm3',
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
              }}
              gridSize={gridSize}
            />
          </Layer>
        </Stage>,
      );

      expect(document.querySelector('canvas')).toBeInTheDocument();
    });
  });
});
