import { useEffect, useRef, useState } from 'react';

import { WorldAudioEngine } from './WorldAudioEngine';
import { useGameStore } from '../../store/gameStore';
import { toMediaProtocol } from '../../utils/mediaProtocol';

const PLATE_FADE_MS = 500;

export function WorldStage(): JSX.Element {
  const stageVisible = useGameStore((state) => state.sessionConsoleRuntime.stageVisible);
  const activeImage = useGameStore((state) => state.sessionConsoleRuntime.activeImage);
  const stage = useGameStore((state) => state.campaign.sessionConsole.stage);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [displayed, setDisplayed] = useState(activeImage);
  const [opaque, setOpaque] = useState(true);
  const requestIdRef = useRef(0);
  const appliedRequestRef = useRef(0);
  const displayedIdRef = useRef(activeImage?.id ?? null);

  useEffect(() => {
    displayedIdRef.current = displayed?.id ?? null;
  }, [displayed]);

  useEffect(() => {
    if (!activeImage) {
      requestIdRef.current += 1;
      setDisplayed(null);
      setOpaque(true);
      return;
    }

    if (displayedIdRef.current === activeImage.id) {
      setDisplayed(activeImage);
      return;
    }

    const requestId = ++requestIdRef.current;

    const applyImage = (): void => {
      if (requestId !== requestIdRef.current) {
        return;
      }
      appliedRequestRef.current = requestId;
      setDisplayed(activeImage);
      if (reducedMotion) {
        setOpaque(true);
      }
    };

    if (reducedMotion || displayedIdRef.current === null) {
      applyImage();
      setOpaque(true);
      return;
    }

    setOpaque(false);
    const timeoutId = window.setTimeout(applyImage, PLATE_FADE_MS);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeImage, reducedMotion]);

  const handleLoad = (): void => {
    if (appliedRequestRef.current !== requestIdRef.current) {
      return;
    }
    setOpaque(true);
  };

  return (
    <>
      {stageVisible && displayed ? (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black"
          data-testid="world-stage-art"
        >
          <img
            src={toMediaProtocol(displayed.src)}
            alt={displayed.alt}
            onLoad={handleLoad}
            className={`absolute inset-0 w-full h-full object-contain ${
              opaque ? 'opacity-100' : 'opacity-0'
            } ${reducedMotion ? '' : 'transition-opacity duration-500'}`}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse at center, transparent 48%, rgba(2,3,3,0.22) 78%, rgba(2,3,3,0.68) 100%)',
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
