import React, { useEffect, useState } from 'react';
import { Rect } from 'react-konva';

interface PaperNoiseOverlayProps {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  opacity?: number;
}

/**
 * PaperNoiseOverlay - Adds a subtle paper texture over the map background
 *
 * Creates a soft noise pattern using SVG that gives the map a textured paper feel.
 * The overlay moves with the map during panning/zooming since it uses the same
 * transform properties, and it is non-interactive (`listening={false}`) so all
 * pointer events pass through to underlying map and token layers.
 */
const PaperNoiseOverlay: React.FC<PaperNoiseOverlayProps> = ({
  x,
  y,
  width,
  height,
  scaleX,
  scaleY,
  opacity = 0.15,
}) => {
  const [patternImage, setPatternImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    // Create SVG noise pattern using feTurbulence for realistic paper texture
    const svgNoise = `
      <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
        <filter id="noise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="4"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0"/>
        </filter>
        <rect width="200" height="200" filter="url(#noise)" opacity="1"/>
      </svg>
    `;

    const encodedSvg = encodeURIComponent(svgNoise);
    const dataUri = `data:image/svg+xml,${encodedSvg}`;

    // Load the SVG as an image for Konva
    const img = new Image();
    img.onload = () => {
      setPatternImage(img);
    };
    img.src = dataUri;

    return () => {
      img.onload = null;
    };
  }, []);

  if (!patternImage) {
    return null;
  }

  return (
    <Rect
      x={x}
      y={y}
      width={width}
      height={height}
      scaleX={scaleX}
      scaleY={scaleY}
      fillPatternImage={patternImage}
      fillPatternRepeat="repeat"
      fillPatternScale={{ x: 1, y: 1 }}
      opacity={opacity}
      listening={false}
      // Using multiply blend mode for subtle texture that darkens slightly
      globalCompositeOperation="multiply"
    />
  );
};

export default PaperNoiseOverlay;
