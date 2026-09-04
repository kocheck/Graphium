import { useEffect, type MutableRefObject } from 'react';

import { currentLevel, resumeOrRestart, startTrack, type YouTubePlayer } from './worldAudioYoutube';
import { type SessionConsoleRuntime } from '../../types/sessionConsole';

interface TransportRefs {
  player: MutableRefObject<YouTubePlayer | null>;
  audioEl: MutableRefObject<HTMLAudioElement | null>;
  pauseRequested: MutableRefObject<boolean>;
  generation: MutableRefObject<number>;
  lastAudio: MutableRefObject<SessionConsoleRuntime['audio']>;
  lastMixer: MutableRefObject<{ volume: number; ducked: boolean }>;
}

export function useWorldTransport(
  runtime: SessionConsoleRuntime,
  refs: TransportRefs,
  fade: (target: number, duration: number, done?: () => void) => void,
): void {
  const { audio, volume, ducked, worldArmed } = runtime;

  useEffect(() => {
    const previous = refs.lastAudio.current;
    refs.lastAudio.current = audio;
    if (!worldArmed) {
      return;
    }

    const level = currentLevel(volume, ducked, audio.trackId);
    const player = refs.player.current;
    const element = refs.audioEl.current;

    if (audio.status === 'stopped') {
      refs.generation.current += 1;
      refs.pauseRequested.current = false;
      fade(0, 500, () => {
        player?.stopVideo();
        if (element) {
          element.pause();
          element.removeAttribute('src');
        }
      });
      refs.lastMixer.current = { volume, ducked };
      return;
    }

    if (audio.status === 'paused') {
      refs.pauseRequested.current = true;
      player?.pauseVideo();
      element?.pause();
      refs.lastMixer.current = { volume, ducked };
      return;
    }

    refs.pauseRequested.current = false;
    const sameSource =
      previous.trackId === audio.trackId &&
      previous.youtubeId === audio.youtubeId &&
      previous.src === audio.src;
    const mixerChanged =
      refs.lastMixer.current.volume !== volume || refs.lastMixer.current.ducked !== ducked;
    refs.lastMixer.current = { volume, ducked };

    if (sameSource && previous.status === 'playing' && mixerChanged) {
      fade(level, 250);
      return;
    }

    if (
      sameSource &&
      resumeOrRestart({
        audio,
        previousStatus: previous.status,
        previousRestartSeq: previous.restartSeq,
        player,
        element,
        level,
        fade,
      })
    ) {
      return;
    }

    refs.generation.current += 1;
    const generation = refs.generation.current;
    const start = (): void => {
      if (generation !== refs.generation.current) {
        return;
      }
      startTrack(audio, player, element, level, fade);
    };

    if (previous.status === 'playing' && !sameSource) {
      fade(0, 300, start);
    } else {
      start();
    }
  }, [audio, ducked, fade, refs, volume, worldArmed]);
}
