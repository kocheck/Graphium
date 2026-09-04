import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';

import { mockIpcRenderer } from '../../test/setup';
import { useGameStore } from '../../store/gameStore';
import {
  emptySessionConsoleCatalog,
  emptySessionConsoleRuntime,
  type SessionConsoleRuntime,
} from '../../types/sessionConsole';
import { WorldStage } from './WorldStage';

interface MockYtPlayer {
  mute: ReturnType<typeof vi.fn>;
  unMute: ReturnType<typeof vi.fn>;
  setVolume: ReturnType<typeof vi.fn>;
  getVolume: ReturnType<typeof vi.fn>;
  loadVideoById: ReturnType<typeof vi.fn>;
  playVideo: ReturnType<typeof vi.fn>;
  pauseVideo: ReturnType<typeof vi.fn>;
  stopVideo: ReturnType<typeof vi.fn>;
  seekTo: ReturnType<typeof vi.fn>;
}

const plate = {
  id: 'img-keep',
  src: 'file:///tmp/keep.webp',
  alt: 'Dawn over the keep',
  name: 'Keep dawn',
};

function runtime(partial: Partial<SessionConsoleRuntime> = {}): SessionConsoleRuntime {
  return { ...emptySessionConsoleRuntime(), ...partial };
}

function seedStore(partial: Partial<SessionConsoleRuntime> = {}): void {
  const catalog = emptySessionConsoleCatalog('Ash Crown');
  catalog.stage = {
    title: 'Skeldra expedition',
    subtitle: 'Beneath the Ashen Crown',
    showFrame: true,
  };
  useGameStore.setState({
    sessionConsole: catalog,
    campaign: {
      ...useGameStore.getState().campaign,
      name: 'Ash Crown',
      sessionConsole: catalog,
    },
    sessionConsoleRuntime: runtime({
      stage: catalog.stage,
      duckPercent: catalog.defaults.duckPercent,
      volume: catalog.defaults.volume,
      ...partial,
    }),
  });
}

describe('WorldStage', () => {
  let playerConfig: {
    events?: {
      onReady?: () => void;
      onStateChange?: (e: { data: number }) => void;
      onError?: (e: { data: number }) => void;
    };
  };
  let player: MockYtPlayer;
  let createOscillator: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    playerConfig = {};
    player = {
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

    function MockPlayer(
      this: MockYtPlayer,
      _el: unknown,
      config: typeof playerConfig,
    ): MockYtPlayer {
      playerConfig = config;
      Object.assign(this, player);
      config.events?.onReady?.();
      return this;
    }

    vi.stubGlobal('YT', {
      PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 },
      Player: MockPlayer,
    });

    createOscillator = vi.fn(() => ({
      type: 'sine',
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      detune: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }));

    vi.stubGlobal(
      'AudioContext',
      class {
        currentTime = 0;
        sampleRate = 44100;
        state = 'running';
        destination = {};
        resume = vi.fn().mockResolvedValue(undefined);
        createOscillator = createOscillator;
        createGain = vi.fn(() => ({
          gain: {
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
        }));
        createBiquadFilter = vi.fn(() => ({
          type: 'lowpass',
          frequency: { value: 0 },
          connect: vi.fn(),
        }));
        createBuffer = vi.fn((_c: number, length: number) => ({
          length,
          getChannelData: () => new Float32Array(length),
        }));
        createBufferSource = vi.fn(() => ({
          buffer: null,
          connect: vi.fn(),
          start: vi.fn(),
        }));
      },
    );

    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.pause = vi.fn();

    mockIpcRenderer.send.mockClear();
    seedStore();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('hides the plate when stageVisible is false but keeps the audio engine mounted', () => {
    seedStore({ stageVisible: false, activeImage: plate, worldArmed: true });
    render(<WorldStage />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByTestId('world-audio-engine')).toBeInTheDocument();
  });

  it('shows an arm button when World is unarmed', async () => {
    seedStore({ worldArmed: false });
    render(<WorldStage />);

    expect(await screen.findByRole('button', { name: /arm audio/i })).toBeInTheDocument();
  });

  it('uses runtime alt text on the stage plate', () => {
    seedStore({
      worldArmed: true,
      stageVisible: true,
      activeImage: plate,
    });
    render(<WorldStage />);

    expect(screen.getByRole('img', { name: 'Dawn over the keep' })).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', 'media:///tmp/keep.webp');
  });

  it('renders stage chrome from runtime, not campaign.sessionConsole', () => {
    const catalog = emptySessionConsoleCatalog('Ash Crown');
    catalog.stage = { title: 'Catalog secret title', subtitle: 'do not show', showFrame: false };
    useGameStore.setState({
      sessionConsole: catalog,
      campaign: {
        ...useGameStore.getState().campaign,
        sessionConsole: catalog,
      },
      sessionConsoleRuntime: runtime({
        worldArmed: true,
        stageVisible: true,
        activeImage: plate,
        stage: { title: 'Player keep', subtitle: 'Dawn watch', showFrame: true },
      }),
    });
    render(<WorldStage />);

    expect(screen.getByText('Player keep')).toBeInTheDocument();
    expect(screen.getByText('Dawn watch')).toBeInTheDocument();
    expect(screen.queryByText('Catalog secret title')).not.toBeInTheDocument();
  });

  it('arms locally and sends SESSION_CONSOLE_WORLD_EVENT armed', async () => {
    const user = userEvent.setup();
    seedStore({ worldArmed: false });
    render(<WorldStage />);

    const button = await screen.findByRole('button', { name: /arm audio/i });
    await user.click(button);

    await act(async () => {
      playerConfig.events?.onStateChange?.({ data: 1 });
    });

    await waitFor(() => {
      expect(useGameStore.getState().sessionConsoleRuntime.worldArmed).toBe(true);
    });
    expect(mockIpcRenderer.send).toHaveBeenCalledWith('SESSION_CONSOLE_WORLD_EVENT', {
      type: 'armed',
    });
  });

  it('reports a sanitized local audio error without file paths', async () => {
    seedStore({
      worldArmed: true,
      audio: {
        trackId: 'local-1',
        title: 'Rain',
        source: 'local',
        youtubeId: null,
        src: 'file:///Users/janedoe/Music/bed.mp3',
        status: 'playing',
        loop: true,
        restartSeq: 0,
        volumeOffset: 0,
      },
    });
    render(<WorldStage />);

    const audio = document.querySelector('audio');
    expect(audio).toBeTruthy();
    fireEvent.error(audio as HTMLAudioElement);

    expect(mockIpcRenderer.send).toHaveBeenCalledWith(
      'SESSION_CONSOLE_WORLD_EVENT',
      expect.objectContaining({
        type: 'error',
        message: expect.stringMatching(/audio/i),
      }),
    );
    const payload = mockIpcRenderer.send.mock.calls.find(
      (call) => call[0] === 'SESSION_CONSOLE_WORLD_EVENT' && call[1]?.type === 'error',
    )?.[1] as { message?: string };
    expect(payload.message).not.toMatch(/file:\/\//);
    expect(payload.message).not.toContain('janedoe');
    expect(payload.message).not.toContain('/Users/');
  });

  it('reports YouTube embed errors 101/150/153 to Architect', async () => {
    seedStore({ worldArmed: true });
    render(<WorldStage />);

    await waitFor(() => {
      expect(playerConfig.events?.onError).toBeTypeOf('function');
    });

    act(() => {
      playerConfig.events?.onError?.({ data: 101 });
    });

    expect(mockIpcRenderer.send).toHaveBeenCalledWith(
      'SESSION_CONSOLE_WORLD_EVENT',
      expect.objectContaining({
        type: 'error',
        message: expect.stringMatching(/embed|copy links/i),
      }),
    );
  });

  it('fires synth SFX when sfxSeq increments', async () => {
    seedStore({ worldArmed: true, sfxSeq: 0, sfxId: null });
    render(<WorldStage />);

    await waitFor(() => {
      expect(playerConfig.events?.onReady).toBeTypeOf('function');
    });

    act(() => {
      useGameStore.setState({
        sessionConsoleRuntime: {
          ...useGameStore.getState().sessionConsoleRuntime,
          sfxSeq: 1,
          sfxId: 'chime',
        },
      });
    });

    await waitFor(() => {
      expect(createOscillator).toHaveBeenCalled();
    });
  });

  it('fades the plate on activeImage.id change', async () => {
    seedStore({
      worldArmed: true,
      stageVisible: true,
      activeImage: plate,
    });
    render(<WorldStage />);

    const img = screen.getByRole('img', { name: 'Dawn over the keep' });
    expect(img).toHaveClass('opacity-100');

    act(() => {
      useGameStore.setState({
        sessionConsoleRuntime: {
          ...useGameStore.getState().sessionConsoleRuntime,
          activeImage: {
            id: 'img-hall',
            src: 'file:///tmp/hall.webp',
            alt: 'The hall',
            name: 'Hall',
          },
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByRole('img')).toHaveClass('opacity-0');
    });
    expect(screen.getByRole('img')).toHaveClass('transition-opacity');
  });

  it('shows the plate after a broken image load during fade', async () => {
    seedStore({
      worldArmed: true,
      stageVisible: true,
      activeImage: plate,
    });
    render(<WorldStage />);

    act(() => {
      useGameStore.setState({
        sessionConsoleRuntime: {
          ...useGameStore.getState().sessionConsoleRuntime,
          activeImage: {
            id: 'img-broken',
            src: 'file:///tmp/broken.webp',
            alt: 'Broken plate',
            name: 'Broken',
          },
        },
      });
    });

    const img = await waitFor(() => {
      const el = screen.getByRole('img', { name: 'Broken plate' });
      expect(el).toHaveClass('opacity-0');
      return el;
    });

    fireEvent.error(img);

    expect(img).toHaveClass('opacity-100');
  });
});
