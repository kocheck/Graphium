import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import Konva from 'konva';
import { KonvaEventObject, Filter } from 'konva/lib/Node';

export interface URLImageProps {
  name?: string;
  src: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  scaleX?: number;
  scaleY?: number;
  id: string;
  onSelect?: (e: KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>) => void;
  onDragStart?: (e: KonvaEventObject<DragEvent>) => void;
  onDragMove?: (e: KonvaEventObject<DragEvent>) => void;
  onDragEnd?: (e: KonvaEventObject<DragEvent>) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  draggable: boolean;
  opacity?: number;
  listening?: boolean;
  filters?: Filter[];
  blurRadius?: number;
  brightness?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowForStrokeEnabled?: boolean;
}

const URLImage = forwardRef<Konva.Image, URLImageProps>(
  (
    {
      src,
      x,
      y,
      width,
      height,
      scaleX = 1,
      scaleY = 1,
      id,
      onSelect,
      onDragEnd,
      onDragStart,
      onDragMove,
      onMouseEnter,
      onMouseLeave,
      draggable,
      name,
      opacity,
      listening,
      filters,
      blurRadius,
      brightness,
      shadowColor,
      shadowBlur,
      shadowOffsetX,
      shadowOffsetY,
      shadowForStrokeEnabled,
    },
    ref,
  ) => {
    const safeSrc = src.startsWith('file:') ? src.replace('file:', 'media:') : src;
    const [img] = useImage(safeSrc);
    const imageRef = useRef<Konva.Image>(null);

    // Expose the Konva node to parent via ref
    useImperativeHandle(ref, () => imageRef.current as Konva.Image, []);

    useEffect(() => {
      // Apply cache when filters are present
      if (imageRef.current && filters && img) {
        imageRef.current.cache();
      }

      // Cleanup: clear cache on unmount or before re-caching
      return () => {
        if (imageRef.current) {
          imageRef.current.clearCache();
        }
      };
    }, [img, filters, width, height, blurRadius, brightness]);

    return (
      <KonvaImage
        ref={imageRef}
        name={name}
        id={id}
        image={img}
        x={x}
        y={y}
        width={width}
        height={height}
        scaleX={scaleX}
        scaleY={scaleY}
        draggable={draggable}
        onPointerDown={onSelect}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onDragEnd={onDragEnd}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        opacity={opacity}
        listening={listening}
        filters={filters}
        blurRadius={blurRadius}
        brightness={brightness}
        shadowColor={shadowColor}
        shadowBlur={shadowBlur}
        shadowOffsetX={shadowOffsetX}
        shadowOffsetY={shadowOffsetY}
        shadowForStrokeEnabled={shadowForStrokeEnabled}
      />
    );
  },
);

URLImage.displayName = 'URLImage';

export default URLImage;
