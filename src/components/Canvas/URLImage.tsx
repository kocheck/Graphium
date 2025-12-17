import { useRef, useEffect } from 'react';
import { Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import Konva from 'konva';
import { KonvaEventObject } from 'konva/lib/Node';

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
  onSelect?: (e: KonvaEventObject<MouseEvent>) => void;
  onDragStart?: (e: KonvaEventObject<DragEvent>) => void;
  onDragEnd?: (e: KonvaEventObject<DragEvent>) => void;
  draggable: boolean;
  opacity?: number;
  listening?: boolean;
  filters?: any[];
  blurRadius?: number;
  brightness?: number;
}

const URLImage = ({ src, x, y, width, height, scaleX = 1, scaleY = 1, id, onSelect, onDragEnd, onDragStart, draggable, name, opacity, listening, filters, blurRadius, brightness }: URLImageProps) => {
  const safeSrc = src.startsWith('file:') ? src.replace('file:', 'media:') : src;
  const [img] = useImage(safeSrc);
  const imageRef = useRef<Konva.Image>(null);

  useEffect(() => {
    if (imageRef.current && filters && img) {
        imageRef.current.cache();
    }
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
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={onDragEnd}
      onDragStart={onDragStart}
      opacity={opacity}
      listening={listening}
      filters={filters}
      blurRadius={blurRadius}
      brightness={brightness}
    />
  );
};

export default URLImage;
