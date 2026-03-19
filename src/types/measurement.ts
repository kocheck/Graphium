/**
 * Type definitions for Measurement and AoE tools
 */

import type { Point } from './geometry';

/**
 * Measurement tool modes
 */
// eslint-disable-next-line import/no-unused-modules
export type MeasurementMode = 'ruler' | 'blast' | 'cone';

/**
 * Base measurement shape interface
 */
// eslint-disable-next-line import/no-unused-modules
export interface BaseMeasurement {
  /** Unique identifier for the measurement */
  id: string;

  /** Type of measurement */
  type: MeasurementMode;

  /** Origin point of the measurement */
  origin: Point;
}

/**
 * Ruler (line) measurement
 * Measures distance between two points
 */
// eslint-disable-next-line import/no-unused-modules
export interface RulerMeasurement extends BaseMeasurement {
  type: 'ruler';

  /** End point of the ruler */
  end: Point;

  /** Distance in feet */
  distanceFeet: number;
}

/**
 * Blast (circle) measurement
 * Measures a circular AoE from a center point
 */
// eslint-disable-next-line import/no-unused-modules
export interface BlastMeasurement extends BaseMeasurement {
  type: 'blast';

  /** Radius in pixels */
  radius: number;

  /** Radius in feet */
  radiusFeet: number;
}

/**
 * Cone measurement
 * Measures a cone-shaped AoE
 */
// eslint-disable-next-line import/no-unused-modules
export interface ConeMeasurement extends BaseMeasurement {
  type: 'cone';

  /** Target point that defines direction and length */
  target: Point;

  /** Length of the cone in feet */
  lengthFeet: number;

  /** Cone angle in degrees (typically 53 for D&D 5e) */
  angleDegrees: number;

  /** Three vertices of the cone [origin, left, right] */
  vertices: [Point, Point, Point];
}

/**
 * Union type for all measurement shapes
 */
export type Measurement = RulerMeasurement | BlastMeasurement | ConeMeasurement;

/**
 * Measurement state in the game store
 */
// eslint-disable-next-line import/no-unused-modules
export interface MeasurementState {
  /** Currently active measurement being drawn */
  activeMeasurement: Measurement | null;

  /** Whether to broadcast measurements to World View */
  broadcastToPlayers: boolean;

  /** Synced measurement from DM (for World View) */
  dmMeasurement: Measurement | null;
}
