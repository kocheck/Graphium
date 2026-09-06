import { useEffect, useRef, useState } from 'react';

import { WorldAudioEngine } from './WorldAudioEngine';
import { useGameStore } from '../../store/gameStore';
import { toMediaProtocol } from '../../utils/mediaProtocol';

import type { SessionConsoleRuntime } from '../../types/sessionConsole';

const PLATE_FADE_MS = 500;

type Plate = NonNullable<SessionConsoleRuntime['activeImage']>;

function PlateImage({
  plate,
  opaque,
  reducedMotion,
  onReady,
}: {
  plate: Plate;
  opaque: boolean;
  reducedMotion: boolean;
  onReady: () => void;
}): JSX.Element {
  return (
    <img
      src={toMediaProtocol(plate.src)}
      alt={plate.alt}
      onLoad={onReady}
      onError={onReady}
      className={`absolute inset-0 w-full h-full object-contain ${
        opaque ? 'opacity-100' : 'opacity-0'
      } ${reducedMotion ? '' : 'transition-opacity duration-slow'}`}
    />
  );
}

export function WorldStage(): JSX.Element {
  const stageVisible = useGameStore((state) => state.sessionConsoleRuntime.stageVisible);
  const activeImage = useGameStore((state) => state.sessionConsoleRuntime.activeImage);
  const stage = useGameStore((state) => state.sessionConsoleRuntime.stage);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [front, setFront] = useState<Plate | null>(activeImage);
  const [back, setBack] = useState<Plate | null>(null);
  const [frontOpaque, setFrontOpaque] = useState(true);
  const requestIdRef = useRef(0);
  const frontRef = useRef<Plate | null>(activeImage);

  useEffect(() => {
    frontRef.current = front;
  }, [front]);

  useEffect(() => {
    if (!activeImage) {
      requestIdRef.current += 1;
      frontRef.current = null;
      setFront(null);
      setBack(null);
      setFrontOpaque(true);
      return;
    }

    const current = frontRef.current;
    if (current?.id === activeImage.id) {
      setFront(activeImage);
      return;
    }

    const requestId = ++requestIdRef.current;

    if (reducedMotion || !current) {
      frontRef.current = activeImage;
      setBack(null);
      setFront(activeImage);
      setFrontOpaque(true);
      return;
    }

    setBack(current);
    frontRef.current = activeImage;
    setFront(activeImage);
    setFrontOpaque(false);
    const timeoutId = window.setTimeout(() => {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setBack(null);
    }, PLATE_FADE_MS);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeImage, reducedMotion]);

  const handleFrontReady = (): void => {
    setFrontOpaque(true);
  };

  return (
    <>
      {stageVisible && front ? (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black"
          data-testid="world-stage-art"
        >
          {back ? (
            <PlateImage
              plate={back}
              opaque
              reducedMotion={reducedMotion}
              onReady={() => undefined}
            />
          ) : null}
          <PlateImage
            plate={front}
            opaque={frontOpaque}
            reducedMotion={reducedMotion}
            onReady={handleFrontReady}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse at center, transparent 48%, var(--app-overlay) 100%)',
            }}
          />
          {stage.showFrame && (
            <div
              className="absolute inset-4 pointer-events-none border"
              style={{ borderColor: 'var(--app-border-hover)' }}
              aria-hidden="true"
            />
          )}
          {(stage.title || stage.subtitle) && (
            <div className="absolute left-8 top-8 pointer-events-none text-[var(--app-text-secondary)] text-xs tracking-widest uppercase">
              {stage.title}
              {stage.subtitle ? (
                <span className="block mt-1 normal-case tracking-normal text-sm text-[var(--app-accent-text)]">
                  {stage.subtitle}
                </span>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
      <WorldAudioEngine />
    </>
  );
}
