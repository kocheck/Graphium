/**
 * Session Console type definitions and helpers
 *
 * Campaign-owned catalog for player-safe artwork and ambience, plus runtime
 * state synced from Architect to World View.
 */

export interface StageImage {
  id: string;
  name: string;
  cue: string;
  src: string;
  thumbnailSrc: string;
  alt: string;
}

export interface ImageSet {
  id: string;
  title: string;
  note: string;
  images: StageImage[];
}

export type TrackAccent = 'bed' | 'road' | 'dread' | 'combat' | 'arrive';

export interface Track {
  id: string;
  title: string;
  cue: string;
  tag: string;
  source: 'youtube' | 'local';
  youtubeId?: string;
  src?: string;
  volumeOffset: number;
  loop: boolean;
  recommendedImageId?: string;
}

export interface TrackGroup {
  id: string;
  title: string;
  note: string;
  accent: TrackAccent;
  tracks: Track[];
}

export type SynthType = 'chime' | 'drone' | 'snap' | 'ping' | 'test-tone';

export interface SfxDefinition {
  id: string;
  label: string;
  kind: 'synth' | 'local';
  synthType?: SynthType;
  src?: string;
}

export interface SessionConsoleCatalog {
  version: 1;
  stage: {
    title: string;
    subtitle: string;
    showFrame: boolean;
  };
  defaults: {
    volume: number;
    duckPercent: number;
  };
  imageSets: ImageSet[];
  trackGroups: TrackGroup[];
  sfx: SfxDefinition[];
}

export interface SessionConsoleRuntime {
  stageVisible: boolean;
  activeImage: { id: string; src: string; alt: string; name: string } | null;
  audio: {
    trackId: string | null;
    title: string;
    source: 'youtube' | 'local' | null;
    youtubeId: string | null;
    src: string | null;
    status: 'stopped' | 'playing' | 'paused';
    loop: boolean;
  };
  volume: number;
  ducked: boolean;
  sfxSeq: number;
  sfxId: string | null;
  worldArmed: boolean;
}

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const DEFAULT_VOLUME = 45;
const DEFAULT_DUCK_PERCENT = 27;

const SYNTH_SFX: SfxDefinition[] = [
  { id: 'chime', label: 'Chime', kind: 'synth', synthType: 'chime' },
  { id: 'drone', label: 'Drone', kind: 'synth', synthType: 'drone' },
  { id: 'snap', label: 'Snap', kind: 'synth', synthType: 'snap' },
  { id: 'ping', label: 'Ping', kind: 'synth', synthType: 'ping' },
  { id: 'test-tone', label: 'Test Tone', kind: 'synth', synthType: 'test-tone' },
];

/**
 * Clamp a volume value to the 0–100 range.
 */
export function clampVolume(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/**
 * Compute effective playback volume after offset and optional ducking.
 */
export function effectiveVolume(
  volume: number,
  ducked: boolean,
  offset?: number,
  duckPercent?: number,
): number {
  const clamped = clampVolume(volume + (offset ?? 0));
  if (!ducked) {
    return clamped;
  }
  return Math.round((clamped * (duckPercent ?? DEFAULT_DUCK_PERCENT)) / 100);
}

/**
 * Extract a canonical 11-char YouTube video id from a raw id or URL.
 * Returns null for invalid input or playlist-only URLs without a video id.
 */
export function parseYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  if (VIDEO_ID_PATTERN.test(trimmed)) {
    return trimmed;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const hostname = url.hostname.replace(/^www\./, '');

  if (hostname === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return id && VIDEO_ID_PATTERN.test(id) ? id : null;
  }

  if (
    hostname === 'youtube.com' ||
    hostname === 'm.youtube.com' ||
    hostname === 'music.youtube.com'
  ) {
    const vParam = url.searchParams.get('v');
    if (vParam && VIDEO_ID_PATTERN.test(vParam)) {
      return vParam;
    }

    const pathMatch = url.pathname.match(/^\/(?:shorts|embed|v)\/([A-Za-z0-9_-]{11})/);
    if (pathMatch?.[1] && VIDEO_ID_PATTERN.test(pathMatch[1])) {
      return pathMatch[1];
    }

    return null;
  }

  return null;
}

/**
 * Create an empty session console catalog seeded with default settings and synth SFX.
 */
export function emptySessionConsoleCatalog(campaignName: string): SessionConsoleCatalog {
  return {
    version: 1,
    stage: {
      title: campaignName,
      subtitle: '',
      showFrame: true,
    },
    defaults: {
      volume: DEFAULT_VOLUME,
      duckPercent: DEFAULT_DUCK_PERCENT,
    },
    imageSets: [],
    trackGroups: [],
    sfx: SYNTH_SFX.map((item) => ({ ...item })),
  };
}

/**
 * Create the initial runtime snapshot for a new session console.
 */
export function emptySessionConsoleRuntime(): SessionConsoleRuntime {
  return {
    stageVisible: false,
    activeImage: null,
    audio: {
      trackId: null,
      title: '',
      source: null,
      youtubeId: null,
      src: null,
      status: 'stopped',
      loop: true,
    },
    volume: DEFAULT_VOLUME,
    ducked: false,
    sfxSeq: 0,
    sfxId: null,
    worldArmed: false,
  };
}
