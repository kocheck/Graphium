import { useCallback, useEffect, useRef } from 'react';

import { useWorldTransport } from './useWorldTransport';
import { useWorldYouTubeArm } from './useWorldYouTubeArm';
import { fadeToLevel, sendWorldEvent, type YouTubePlayer } from './worldAudioYoutube';
import {
  getStageAudioContext,
  playLocalSfx,
  playStageSfx,
  resolveSynthType,
} from './worldStageSfx';
import { useGameStore } from '../../store/gameStore';
import { toMediaProtocol } from '../../utils/mediaProtocol';
import { sanitizeSessionConsoleErrorMessage } from '../../utils/syncUtils';

export function WorldAudioEngine(): JSX.Element {
  const runtime = useGameStore((state) => state.sessionConsoleRuntime);
  const setArmed = useGameStore((state) => state.setSessionConsoleWorldArmed);

  const ytHostRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const armPendingRef = useRef(false);
  const finishedArmRef = useRef(false);
  const pauseRequestedRef = useRef(false);
  const generationRef = useRef(0);
  const sourceStartedRef = useRef(false);
  const startPendingRef = useRef(false);
  const fadeTimerRef = useRef<number | null>(null);
  const lastSfxSeqRef = useRef(runtime.sfxSeq);
  const lastAudioRef = useRef(runtime.audio);
  const lastMixerRef = useRef({
    volume: runtime.volume,
    ducked: runtime.ducked,
    duckPercent: runtime.duckPercent,
    volumeOffset: runtime.audio.volumeOffset,
  });
  const lastLoopRef = useRef({ loop: runtime.audio.loop, youtubeId: runtime.audio.youtubeId });
  lastLoopRef.current = { loop: runtime.audio.loop, youtubeId: runtime.audio.youtubeId };

  const transportRefs = useRef({
    player: playerRef,
    audioEl: audioRef,
    pauseRequested: pauseRequestedRef,
    generation: generationRef,
    sourceStarted: sourceStartedRef,
    startPending: startPendingRef,
    lastAudio: lastAudioRef,
    lastMixer: lastMixerRef,
  }).current;

  const clearFade = useCallback(() => {
    if (fadeTimerRef.current !== null) {
      window.clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }, []);

  const fade = useCallback(
    (target: number, durationMs: number, done?: () => void) => {
      fadeToLevel({
        player: playerRef.current,
        audio: audioRef.current,
        usingYoutube: runtime.audio.source === 'youtube',
        target,
        durationMs,
        clearFade,
        setTimer: (id) => {
          fadeTimerRef.current = id;
        },
        done,
      });
    },
    [clearFade, runtime.audio.source],
  );

  const { armEnabled, handleArm } = useWorldYouTubeArm({
    ytHostRef,
    audioRef,
    playerRef,
    audioContextRef,
    armPendingRef,
    finishedArmRef,
    pauseRequestedRef,
    lastLoopRef,
    clearFade,
    setArmed,
  });

  useWorldTransport(runtime, transportRefs, fade);

  const handleLocalAudioError = useCallback((): void => {
    const element = audioRef.current;
    const expected = runtime.audio.src ? toMediaProtocol(runtime.audio.src) : '';
    const actualAttr = element?.getAttribute('src') ?? '';
    if (!element || !expected) {
      return;
    }
    if (actualAttr !== expected && element.src !== expected) {
      return;
    }
    if (startPendingRef.current || runtime.audio.status === 'stopped') {
      return;
    }
    if (runtime.audio.source !== 'local') {
      return;
    }
    sendWorldEvent('error', sanitizeSessionConsoleErrorMessage('Local audio failed to play.'));
  }, [runtime.audio.source, runtime.audio.src, runtime.audio.status]);

  useEffect(() => {
    if (runtime.sfxSeq === lastSfxSeqRef.current) {
      return;
    }
    lastSfxSeqRef.current = runtime.sfxSeq;
    if (!runtime.worldArmed || runtime.sfxSeq <= 0) {
      return;
    }
    const context = getStageAudioContext(audioContextRef.current);
    if (!context) {
      return;
    }
    audioContextRef.current = context;
    if (runtime.sfxKind === 'local' && runtime.sfxSrc) {
      void playLocalSfx(context, runtime.sfxSrc).catch(() => {
        sendWorldEvent('error', sanitizeSessionConsoleErrorMessage('Local SFX failed to play.'));
      });
      return;
    }
    const synth = resolveSynthType(runtime.sfxId, runtime.sfxSynthType);
    if (!synth) {
      return;
    }
    playStageSfx(context, synth);
  }, [
    runtime.sfxId,
    runtime.sfxKind,
    runtime.sfxSeq,
    runtime.sfxSrc,
    runtime.sfxSynthType,
    runtime.worldArmed,
  ]);

  return (
    <>
      {!runtime.worldArmed && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/80">
          <section
            className="max-w-md mx-5 p-6 rounded-lg text-center border border-[var(--app-border-default)] bg-[var(--app-bg-surface)] shadow-lg"
            aria-label="Arm World View audio"
          >
            <h2 className="text-2xl font-semibold text-[var(--app-text-primary)] mb-2">
              World View
            </h2>
            <p className="text-sm text-[var(--app-text-secondary)] mb-4">
              This window owns campaign audio and artwork. Arm it once, then share this window in
              Discord.
            </p>
            <button
              type="button"
              disabled={!armEnabled}
              onClick={() => {
                void handleArm();
              }}
              className="min-w-[170px] px-4 py-2 rounded font-medium bg-[var(--app-accent-solid)] hover:bg-[var(--app-accent-solid-hover)] text-white disabled:opacity-50 disabled:cursor-wait"
            >
              {armEnabled ? 'Arm audio' : 'Loading audio…'}
            </button>
          </section>
        </div>
      )}
      <div
        data-testid="world-audio-engine"
        className="fixed w-[200px] h-[200px] -left-[220px] -bottom-[220px] opacity-[0.001] pointer-events-none overflow-hidden"
        aria-hidden="true"
      >
        <div ref={ytHostRef} id="session-console-yt-player" />
        <audio ref={audioRef} onError={handleLocalAudioError} />
      </div>
    </>
  );
}
