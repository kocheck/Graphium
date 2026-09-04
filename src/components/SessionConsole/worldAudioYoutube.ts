import { effectiveVolume, type SessionConsoleRuntime } from '../../types/sessionConsole';
import { toMediaProtocol } from '../../utils/mediaProtocol';

export const ARM_VIDEO_ID = 'dxwJuo_KejY';
export const RESTRICTED_YT_ERRORS = new Set([101, 150, 153]);
export const SILENT_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

const IFRAME_API_SRC = 'https://www.youtube.com/iframe_api';

export interface YouTubePlayer {
  mute: () => void;
  unMute: () => void;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  loadVideoById: (id: string | { videoId: string; startSeconds?: number }) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  destroy?: () => void;
}

export interface YouTubePlayerEvent {
  data: number;
}

interface YouTubeNamespace {
  Player: new (
    target: string | HTMLElement,
    options: {
      height: string;
      width: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady: () => void;
        onStateChange: (event: YouTubePlayerEvent) => void;
        onError: (event: YouTubePlayerEvent) => void;
      };
    },
  ) => YouTubePlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
}

function getYouTubeApi(): YouTubeNamespace | undefined {
  return (window as unknown as { YT?: YouTubeNamespace }).YT;
}

export function mountYouTubePlayer(
  host: HTMLElement,
  events: {
    onReady: () => void;
    onStateChange: (event: YouTubePlayerEvent) => void;
    onError: (event: YouTubePlayerEvent) => void;
  },
): YouTubePlayer | null {
  const api = getYouTubeApi();
  if (!api?.Player) {
    return null;
  }
  try {
    return new api.Player(host, {
      height: '200',
      width: '200',
      playerVars: {
        autoplay: 0,
        controls: 0,
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
        origin: window.location.origin,
      },
      events,
    });
  } catch {
    return null;
  }
}

export function sendWorldEvent(
  type: 'armed' | 'unarmed' | 'ready' | 'error',
  message?: string,
): void {
  const payload = message ? { type, message } : { type };
  window.ipcRenderer?.send('SESSION_CONSOLE_WORLD_EVENT', payload);
}

export function youtubeErrorMessage(code: number): string {
  const copyLinks = ' Copy links from Session Console as a fallback.';
  if (code === 101 || code === 150) {
    return `Embedding disabled by uploader.${copyLinks}`;
  }
  if (code === 153) {
    return `Error 153 — serve the renderer from a non-file origin and check referrer settings.${copyLinks}`;
  }
  return `YouTube error ${code}`;
}

export function currentLevel(
  volume: number,
  ducked: boolean,
  offset: number,
  duckPercent: number,
): number {
  return effectiveVolume(volume, ducked, offset, duckPercent);
}

export function ensureIframeApi(onReady: () => void, onUnavailable: () => void): () => void {
  const existing = getYouTubeApi();
  if (existing?.Player) {
    onReady();
    return () => undefined;
  }

  if (!navigator.onLine) {
    onUnavailable();
    return () => undefined;
  }

  const win = window as unknown as { onYouTubeIframeAPIReady?: () => void };
  const previous = win.onYouTubeIframeAPIReady;
  win.onYouTubeIframeAPIReady = () => {
    previous?.();
    onReady();
  };

  let script = document.querySelector<HTMLScriptElement>(`script[src="${IFRAME_API_SRC}"]`);
  if (!script) {
    script = document.createElement('script');
    script.src = IFRAME_API_SRC;
    script.onerror = () => onUnavailable();
    document.head.appendChild(script);
  }

  return () => undefined;
}

interface FadeArgs {
  player: YouTubePlayer | null;
  audio: HTMLAudioElement | null;
  usingYoutube: boolean;
  target: number;
  durationMs: number;
  clearFade: () => void;
  setTimer: (id: number) => void;
  done?: () => void;
}

export function fadeToLevel(args: FadeArgs): void {
  const { player, audio, usingYoutube, target, durationMs, clearFade, setTimer, done } = args;
  clearFade();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || durationMs <= 0) {
    player?.setVolume(target);
    if (audio) {
      audio.volume = Math.min(1, Math.max(0, target / 100));
    }
    done?.();
    return;
  }
  const startPlayer = player?.getVolume() ?? 0;
  const startAudio = audio ? audio.volume * 100 : 0;
  const start = usingYoutube ? startPlayer : startAudio;
  const steps = Math.max(1, Math.round(durationMs / 40));
  let step = 0;
  setTimer(
    window.setInterval(() => {
      step += 1;
      const next = Math.round(start + (target - start) * (step / steps));
      if (usingYoutube) {
        player?.setVolume(next);
      } else if (audio) {
        audio.volume = Math.min(1, Math.max(0, next / 100));
      }
      if (step >= steps) {
        clearFade();
        done?.();
      }
    }, 40),
  );
}

export function startTrack(
  audio: SessionConsoleRuntime['audio'],
  player: YouTubePlayer | null,
  element: HTMLAudioElement | null,
  level: number,
  fade: (target: number, duration: number, done?: () => void) => void,
): void {
  if (audio.source === 'youtube' && audio.youtubeId && player) {
    element?.pause();
    player.loadVideoById(audio.youtubeId);
    player.setVolume(0);
    player.unMute();
    player.playVideo();
    fade(level, 900);
    return;
  }
  if (audio.source === 'local' && audio.src && element) {
    player?.pauseVideo();
    element.loop = audio.loop;
    element.src = toMediaProtocol(audio.src);
    element.volume = 0;
    void element.play();
    fade(level, 900);
  }
}

interface ResumeArgs {
  audio: SessionConsoleRuntime['audio'];
  previousStatus: SessionConsoleRuntime['audio']['status'];
  previousRestartSeq: number;
  player: YouTubePlayer | null;
  element: HTMLAudioElement | null;
  level: number;
  fade: (target: number, duration: number) => void;
}

export function resumeOrRestart(args: ResumeArgs): boolean {
  const { audio, previousStatus, previousRestartSeq, player, element, level, fade } = args;
  if ((audio.restartSeq ?? 0) !== (previousRestartSeq ?? 0)) {
    if (audio.source === 'youtube') {
      player?.seekTo(0, true);
      player?.playVideo();
    } else if (element) {
      element.currentTime = 0;
      void element.play();
    }
    fade(level, 250);
    return true;
  }
  if (previousStatus === 'paused') {
    if (audio.source === 'youtube') {
      player?.playVideo();
    } else {
      void element?.play();
    }
    fade(level, 250);
    return true;
  }
  return false;
}
