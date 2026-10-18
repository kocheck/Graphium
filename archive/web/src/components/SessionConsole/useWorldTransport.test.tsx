import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

import { emptySessionConsoleRuntime, type SessionConsoleRuntime } from '../../types/sessionConsole';
import { toMediaProtocol } from '../../utils/mediaProtocol';
import { useWorldTransport } from './useWorldTransport';
import { type YouTubePlayer } from './worldAudioYoutube';

const TRACK_A_ID = 'bLZApMsorjA';
const TRACK_B_ID = 'dQw4w9WgXcQ';

function playingAudio(trackId: string, youtubeId: string): SessionConsoleRuntime['audio'] {
  return {
    trackId,
    title: trackId,
    source: 'youtube',
    youtubeId,
    src: null,
    status: 'playing',
    loop: true,
    restartSeq: 0,
    volumeOffset: 0,
  };
}

function localPlayingAudio(trackId: string, src: string): SessionConsoleRuntime['audio'] {
  return {
    trackId,
    title: trackId,
    source: 'local',
    youtubeId: null,
    src,
    status: 'playing',
    loop: true,
    restartSeq: 0,
    volumeOffset: 0,
  };
}

function immediateFade(): (target: number, duration: number, done?: () => void) => void {
  return vi.fn((_target: number, _duration: number, done?: () => void) => {
    done?.();
  });
}

function runtimeWithAudio(
  audio: SessionConsoleRuntime['audio'],
  extra: Partial<SessionConsoleRuntime> = {},
): SessionConsoleRuntime {
  return {
    ...emptySessionConsoleRuntime(),
    worldArmed: true,
    volume: 45,
    ducked: false,
    duckPercent: 27,
    audio,
    ...extra,
  };
}

function mockPlayer(): YouTubePlayer {
  return {
    mute: vi.fn(),
    unMute: vi.fn(),
    setVolume: vi.fn(),
    getVolume: vi.fn(() => 0),
    loadVideoById: vi.fn(),
    playVideo: vi.fn(),
    pauseVideo: vi.fn(),
    stopVideo: vi.fn(),
    seekTo: vi.fn(),
  };
}

function mockAudio(): HTMLAudioElement {
  return {
    pause: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
    removeAttribute: vi.fn(),
    volume: 0,
    loop: true,
    src: '',
    currentTime: 0,
  } as unknown as HTMLAudioElement;
}

function cancellingFade(): {
  fade: (target: number, duration: number, done?: () => void) => void;
  runPending: () => void;
} {
  let token = 0;
  let pending: (() => void) | undefined;
  const fade = vi.fn((_target: number, _duration: number, done?: () => void) => {
    token += 1;
    const current = token;
    pending = () => {
      if (current !== token) {
        return;
      }
      done?.();
    };
  });
  return {
    fade,
    runPending: () => pending?.(),
  };
}

function TransportHarness({
  runtime,
  fade,
  player,
  audioEl,
}: {
  runtime: SessionConsoleRuntime;
  fade: (target: number, duration: number, done?: () => void) => void;
  player: YouTubePlayer;
  audioEl: HTMLAudioElement;
}): null {
  const refs = useRef({
    player: { current: player },
    audioEl: { current: audioEl },
    pauseRequested: { current: false },
    generation: { current: 0 },
    sourceStarted: { current: false },
    startPending: { current: false },
    lastAudio: { current: emptySessionConsoleRuntime().audio },
    lastMixer: {
      current: {
        volume: runtime.volume,
        ducked: runtime.ducked,
        duckPercent: runtime.duckPercent,
        volumeOffset: runtime.audio.volumeOffset,
      },
    },
  }).current;
  refs.player.current = player;
  refs.audioEl.current = audioEl;
  useWorldTransport(runtime, refs, fade);
  return null;
}

describe('useWorldTransport', () => {
  it('still starts bed B when duck arrives during the track-change fade', () => {
    const player = mockPlayer();
    const { fade, runPending } = cancellingFade();
    const playingA = runtimeWithAudio(playingAudio('track-a', TRACK_A_ID));

    const { rerender } = render(
      <TransportHarness runtime={playingA} fade={fade} player={player} audioEl={mockAudio()} />,
    );
    expect(player.loadVideoById).toHaveBeenCalledWith(TRACK_A_ID);

    const playingB = runtimeWithAudio(playingAudio('track-b', TRACK_B_ID));
    rerender(
      <TransportHarness runtime={playingB} fade={fade} player={player} audioEl={mockAudio()} />,
    );
    expect(fade).toHaveBeenCalledWith(0, 300, expect.any(Function));

    const duckedB = runtimeWithAudio(playingAudio('track-b', TRACK_B_ID), { ducked: true });
    rerender(
      <TransportHarness runtime={duckedB} fade={fade} player={player} audioEl={mockAudio()} />,
    );

    runPending();
    expect(player.loadVideoById).toHaveBeenCalledWith(TRACK_B_ID);
  });

  it('does not let a Stop fade callback tear down a newer bed', () => {
    const player = mockPlayer();
    const fadeDones: Array<() => void> = [];
    const fade = vi.fn((_target: number, _duration: number, done?: () => void) => {
      if (done) {
        fadeDones.push(done);
      }
    });
    const playingA = runtimeWithAudio(playingAudio('track-a', TRACK_A_ID));

    const { rerender } = render(
      <TransportHarness runtime={playingA} fade={fade} player={player} audioEl={mockAudio()} />,
    );

    const stopped = runtimeWithAudio({
      ...playingAudio('track-a', TRACK_A_ID),
      status: 'stopped',
    });
    rerender(
      <TransportHarness runtime={stopped} fade={fade} player={player} audioEl={mockAudio()} />,
    );
    expect(fade).toHaveBeenCalledWith(0, 500, expect.any(Function));
    const stopDone = fadeDones[fadeDones.length - 1];
    expect(stopDone).toBeTypeOf('function');

    const playingB = runtimeWithAudio(playingAudio('track-b', TRACK_B_ID));
    rerender(
      <TransportHarness runtime={playingB} fade={fade} player={player} audioEl={mockAudio()} />,
    );
    expect(player.loadVideoById).toHaveBeenCalledWith(TRACK_B_ID);
    (player.stopVideo as ReturnType<typeof vi.fn>).mockClear();

    stopDone?.();
    expect(player.stopVideo).not.toHaveBeenCalled();
  });

  it('starts the same youtube bed after Stop then Play without bumping restartSeq', () => {
    const player = mockPlayer();
    const fade = immediateFade();
    const playing = runtimeWithAudio(playingAudio('track-a', TRACK_A_ID));

    const { rerender } = render(
      <TransportHarness runtime={playing} fade={fade} player={player} audioEl={mockAudio()} />,
    );
    expect(player.loadVideoById).toHaveBeenCalledWith(TRACK_A_ID);
    (player.loadVideoById as ReturnType<typeof vi.fn>).mockClear();

    const stopped = runtimeWithAudio({
      ...playingAudio('track-a', TRACK_A_ID),
      status: 'stopped',
    });
    rerender(
      <TransportHarness runtime={stopped} fade={fade} player={player} audioEl={mockAudio()} />,
    );

    const playAgain = runtimeWithAudio(playingAudio('track-a', TRACK_A_ID));
    rerender(
      <TransportHarness runtime={playAgain} fade={fade} player={player} audioEl={mockAudio()} />,
    );
    expect(player.loadVideoById).toHaveBeenCalledWith(TRACK_A_ID);
  });

  it('starts the same local bed after Stop then Play without bumping restartSeq', () => {
    const player = mockPlayer();
    const audioEl = mockAudio();
    const fade = immediateFade();
    const src = 'file:///tmp/bed.mp3';
    const playing = runtimeWithAudio(localPlayingAudio('local-a', src));

    const { rerender } = render(
      <TransportHarness runtime={playing} fade={fade} player={player} audioEl={audioEl} />,
    );
    expect(audioEl.src).toBe(toMediaProtocol(src));
    audioEl.src = '';

    const stopped = runtimeWithAudio({
      ...localPlayingAudio('local-a', src),
      status: 'stopped',
    });
    rerender(<TransportHarness runtime={stopped} fade={fade} player={player} audioEl={audioEl} />);

    const playAgain = runtimeWithAudio(localPlayingAudio('local-a', src));
    rerender(
      <TransportHarness runtime={playAgain} fade={fade} player={player} audioEl={audioEl} />,
    );
    expect(audioEl.src).toBe(toMediaProtocol(src));
  });

  it('starts the current bed when World View is armed while already playing', () => {
    const player = mockPlayer();
    const fade = immediateFade();
    const unarmed = runtimeWithAudio(playingAudio('track-a', TRACK_A_ID), { worldArmed: false });

    const { rerender } = render(
      <TransportHarness runtime={unarmed} fade={fade} player={player} audioEl={mockAudio()} />,
    );
    expect(player.loadVideoById).not.toHaveBeenCalled();

    const armed = runtimeWithAudio(playingAudio('track-a', TRACK_A_ID), { worldArmed: true });
    rerender(
      <TransportHarness runtime={armed} fade={fade} player={player} audioEl={mockAudio()} />,
    );
    expect(player.loadVideoById).toHaveBeenCalledWith(TRACK_A_ID);
  });

  it('starts the current bed after unarm, a mixer change, then re-arm', () => {
    const player = mockPlayer();
    const fade = immediateFade();
    const playing = runtimeWithAudio(playingAudio('track-a', TRACK_A_ID));

    const { rerender } = render(
      <TransportHarness runtime={playing} fade={fade} player={player} audioEl={mockAudio()} />,
    );
    expect(player.loadVideoById).toHaveBeenCalledWith(TRACK_A_ID);
    (player.loadVideoById as ReturnType<typeof vi.fn>).mockClear();

    rerender(
      <TransportHarness
        runtime={runtimeWithAudio(playingAudio('track-a', TRACK_A_ID), { worldArmed: false })}
        fade={fade}
        player={player}
        audioEl={mockAudio()}
      />,
    );

    rerender(
      <TransportHarness
        runtime={runtimeWithAudio(playingAudio('track-a', TRACK_A_ID), {
          worldArmed: false,
          volume: 20,
        })}
        fade={fade}
        player={player}
        audioEl={mockAudio()}
      />,
    );
    expect(player.loadVideoById).not.toHaveBeenCalled();

    rerender(
      <TransportHarness
        runtime={runtimeWithAudio(playingAudio('track-a', TRACK_A_ID), {
          worldArmed: true,
          volume: 20,
        })}
        fade={fade}
        player={player}
        audioEl={mockAudio()}
      />,
    );
    expect(player.loadVideoById).toHaveBeenCalledWith(TRACK_A_ID);
  });
});
