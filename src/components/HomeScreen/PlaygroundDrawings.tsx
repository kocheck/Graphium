import { Line, Circle, Arrow } from 'react-konva';

/**
 * PlaygroundDrawings - Static tactical markers for the HomeScreen demo
 *
 * Renders a collection of drawing elements (paths, circles, arrows) to make
 * the landing page feel like an active game in progress. These are purely
 * decorative and demonstrate the drawing tools available in the app.
 */
export function PlaygroundDrawings() {
  // Calculate positions relative to viewport center
  const centerX = typeof window !== 'undefined' ? window.innerWidth / 2 : 800;
  const centerY = typeof window !== 'undefined' ? window.innerHeight / 2 : 600;

  return (
    <>
      {/* Tactical movement path - curved line from bottom-left */}
      <Line
        points={[
          centerX - 300, centerY + 200,
          centerX - 250, centerY + 150,
          centerX - 200, centerY + 100,
          centerX - 150, centerY + 80,
          centerX - 100, centerY + 70,
        ]}
        stroke="#3b82f6"
        strokeWidth={4}
        tension={0.5}
        lineCap="round"
        lineJoin="round"
        opacity={0.6}
        listening={false}
      />

      {/* Danger zone circle - red circle around top-right area */}
      <Circle
        x={centerX + 220}
        y={centerY - 180}
        radius={60}
        stroke="#ef4444"
        strokeWidth={3}
        opacity={0.5}
        listening={false}
      />

      {/* Area of interest circle - yellow around bottom */}
      <Circle
        x={centerX + 50}
        y={centerY + 150}
        radius={45}
        stroke="#f59e0b"
        strokeWidth={3}
        opacity={0.5}
        listening={false}
      />

      {/* Tactical arrow - pointing from left to center-left token */}
      <Arrow
        points={[
          centerX - 380, centerY - 50,
          centerX - 280, centerY - 20,
        ]}
        stroke="#10b981"
        strokeWidth={4}
        fill="#10b981"
        pointerLength={15}
        pointerWidth={15}
        opacity={0.6}
        listening={false}
        perfectDrawEnabled={false}
      />

      {/* Strategy line - dashed line connecting two areas */}
      <Line
        points={[
          centerX + 150, centerY - 100,
          centerX - 50, centerY + 100,
        ]}
        stroke="#8b5cf6"
        strokeWidth={3}
        dash={[10, 8]}
        opacity={0.5}
        listening={false}
      />

      {/* Freehand marker annotation - squiggly line */}
      <Line
        points={[
          centerX - 150, centerY - 180,
          centerX - 130, centerY - 175,
          centerX - 110, centerY - 185,
          centerX - 90, centerY - 180,
          centerX - 70, centerY - 190,
          centerX - 50, centerY - 185,
        ]}
        stroke="#df4b26"
        strokeWidth={5}
        tension={0.3}
        lineCap="round"
        lineJoin="round"
        opacity={0.7}
        listening={false}
      />

      {/* Highlight circle - smaller accent circle */}
      <Circle
        x={centerX - 250}
        y={centerY - 50}
        radius={35}
        stroke="#06b6d4"
        strokeWidth={3}
        opacity={0.5}
        listening={false}
      />
    </>
  );
}
