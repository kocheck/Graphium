import { useEffect, type MutableRefObject } from 'react';

import { currentLevel, resumeOrRestart, startTrack, type YouTubePlayer } from './worldAudioYoutube';
import { type SessionConsoleRuntime } from '../../types/sessionConsole';

interface TransportRefs {
  player: MutableRefObject<YouTubePlayer | null>;
  audioEl: MutableRefObject<HTMLAudioElement | null>;
  pauseRequested: MutableRefObject<boolean>;
  generation: MutableRefObject<number>;
  sourceStarted: MutableRefObject<boolean>;
  lastAudio: MutableRefObject<SessionConsoleRuntime['audio']>;
  lastMixer: MutableRefObject<{
    volume: number;
    ducked: boolean;
    duckPercent: number;
    volumeOffset: number;
  }>;
}

type FadeFn = (target: number, duration: number, done?: () => void) => void;

function liveLevel(refs: TransportRefs): number {
  const mixer = refs.lastMixer.current;
  return currentLevel(mixer.volume, mixer.ducked, mixer.volumeOffset, mixer.duckPercent);
}

function recordMixer(
  refs: TransportRefs,
  volume: number,
  ducked: boolean,
  duckPercent: number,
  volumeOffset: number,
): void {
  refs.lastMixer.current = { volume, ducked, duckPercent, volumeOffset };
}

function stopBed(
  refs: TransportRefs,
  fade: FadeFn,
  player: YouTubePlayer | null,
  element: HTMLAudioElement | null,
): void {
  refs.generation.current += 1;
  const generation = refs.generation.current;
  refs.pauseRequested.current = false;
  refs.sourceStarted.current = false;
  fade(0, 500, () => {
    if (generation !== refs.generation.current) {
      return;
    }
    player?.stopVideo();
    if (element) {
      element.pause();
      element.removeAttribute('src');
    }
  });
}

function pauseBed(
  refs: TransportRefs,
  player: YouTubePlayer | null,
  element: HTMLAudioElement | null,
): void {
  refs.generation.current += 1;
  refs.pauseRequested.current = true;
  player?.pauseVideo();
  element?.pause();
}

interface PlayingArgs {
  refs: TransportRefs;
  audio: SessionConsoleRuntime['audio'];
  previous: SessionConsoleRuntime['audio'];
  previousHadStarted: boolean;
  mixerChanged: boolean;
  fade: FadeFn;
  player: YouTubePlayer | null;
  element: HTMLAudioElement | null;
}

function startBed(args: PlayingArgs, fadeOutFirst: boolean): void {
  const { refs, audio, fade, player, element } = args;
  refs.generation.current += 1;
  refs.sourceStarted.current = false;
  const generation = refs.generation.current;
  const start = (): void => {
    if (generation !== refs.generation.current) {
      return;
    }
    refs.sourceStarted.current = true;
    startTrack(audio, player, element, liveLevel(refs), fade);
  };
  if (fadeOutFirst) {
    fade(0, 300, start);
  } else {
    start();
  }
}

function applyPlayingTransport(args: PlayingArgs): void {
  const { refs, audio, previous, previousHadStarted, mixerChanged, fade, player, element } = args;
  const sameSource =
    previous.trackId === audio.trackId &&
    previous.youtubeId === audio.youtubeId &&
    previous.src === audio.src;

  if (sameSource && previous.status === 'playing' && mixerChanged && previousHadStarted) {
    fade(liveLevel(refs), 250);
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
      level: liveLevel(refs),
      fade,
    })
  ) {
    refs.sourceStarted.current = true;
    return;
  }

  if (sameSource && !previousHadStarted) {
    return;
  }

  startBed(args, previous.status === 'playing' && !sameSource && previousHadStarted);
}

export function useWorldTransport(
  runtime: SessionConsoleRuntime,
  refs: TransportRefs,
  fade: FadeFn,
): void {
  const { audio, volume, ducked, duckPercent, worldArmed } = runtime;

  useEffect(() => {
    const previous = refs.lastAudio.current;
    const previousHadStarted = refs.sourceStarted.current;
    refs.lastAudio.current = audio;
    if (!worldArmed) {
      return;
    }

    const player = refs.player.current;
    const element = refs.audioEl.current;

    if (audio.status === 'stopped') {
      stopBed(refs, fade, player, element);
      recordMixer(refs, volume, ducked, duckPercent, audio.volumeOffset);
      return;
    }

    if (audio.status === 'paused') {
      pauseBed(refs, player, element);
      recordMixer(refs, volume, ducked, duckPercent, audio.volumeOffset);
      return;
    }

    refs.pauseRequested.current = false;
    const mixerChanged =
      refs.lastMixer.current.volume !== volume ||
      refs.lastMixer.current.ducked !== ducked ||
      refs.lastMixer.current.duckPercent !== duckPercent ||
      refs.lastMixer.current.volumeOffset !== audio.volumeOffset;
    recordMixer(refs, volume, ducked, duckPercent, audio.volumeOffset);
    applyPlayingTransport({
      refs,
      audio,
      previous,
      previousHadStarted,
      mixerChanged,
      fade,
      player,
      element,
    });
  }, [audio, ducked, duckPercent, fade, refs, volume, worldArmed]);
}
