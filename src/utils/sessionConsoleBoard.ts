import { processImage } from './AssetProcessor';
import { runWithConcurrency } from './campaignAssets';
import {
  LOCAL_AUDIO_SIZE_WARN_MESSAGE,
  saveLocalAudioFile,
  shouldWarnLocalAudioSize,
} from './localAudioAsset';
import { toMediaProtocol } from './mediaProtocol';
import { sanitizeSessionConsoleErrorMessage } from './syncUtils';
import {
  parseYouTubeVideoId,
  type SessionConsoleCatalog,
  type StageImage,
  type Track,
} from '../types/sessionConsole';

import type { GameState } from '../store/gameStore';

const IMAGE_FILE_RE = /^image\//;
const AUDIO_EXT_RE = /\.(mp3|ogg|wav|m4a)$/i;

function fileNameStem(name: string): string {
  return name.replace(/\.[^.]+$/, '') || 'Untitled';
}

export function flattenTracks(catalog: SessionConsoleCatalog): Track[] {
  return catalog.trackGroups.flatMap((group) => group.tracks);
}

export function formatTrackFallbackLine(index: number, track: Track): string {
  if (track.source === 'youtube' && track.youtubeId) {
    return `${index}. ${track.title} — https://www.youtube.com/watch?v=${track.youtubeId}`;
  }
  return `${index}. ${track.title} — (local file)`;
}

export function formatSessionConsoleFallbackLinks(catalog: SessionConsoleCatalog): string {
  return flattenTracks(catalog)
    .map((track, index) => formatTrackFallbackLine(index + 1, track))
    .join('\n');
}

// eslint-disable-next-line import/no-unused-modules -- unit tests import this helper
export function folderTitleFromFiles(files: File[]): string | undefined {
  const relative = files.find((file) => file.webkitRelativePath)?.webkitRelativePath ?? '';
  const folder = relative.split('/')[0];
  return folder ? folder : undefined;
}

function nextBoardTitle(existing: Array<{ title: string }>, base: string): string {
  if (!existing.some((item) => item.title === base)) {
    return base;
  }
  let suffix = 2;
  while (existing.some((item) => item.title === `${base} ${suffix}`)) {
    suffix += 1;
  }
  return `${base} ${suffix}`;
}

function addImageSet(store: GameState, title: string): string {
  const id = crypto.randomUUID();
  store.updateSessionConsole({
    type: 'ADD_IMAGE_SET',
    set: { id, title, note: '', images: [] },
  });
  return id;
}

function addTrackGroup(store: GameState, title: string): string {
  const id = crypto.randomUUID();
  store.updateSessionConsole({
    type: 'ADD_TRACK_GROUP',
    group: { id, title, note: '', accent: 'bed', tracks: [] },
  });
  return id;
}

function ensureImageSet(store: GameState, title?: string): string {
  if (title) {
    const named = store.sessionConsole.imageSets.find((set) => set.title === title);
    if (named) {
      return named.id;
    }
    return addImageSet(store, title);
  }
  const last = store.sessionConsole.imageSets.at(-1);
  if (last) {
    return last.id;
  }
  return addImageSet(store, 'Plates');
}

function ensureTrackGroup(store: GameState, groupId?: string): string {
  if (groupId) {
    const named = store.sessionConsole.trackGroups.find((group) => group.id === groupId);
    if (named) {
      return named.id;
    }
  }
  const last = store.sessionConsole.trackGroups.at(-1);
  if (last) {
    return last.id;
  }
  return addTrackGroup(store, 'Tracks');
}

export function addNewImageSet(store: GameState): string {
  return addImageSet(store, nextBoardTitle(store.sessionConsole.imageSets, 'Plates'));
}

export function addNewTrackGroup(store: GameState): string {
  return addTrackGroup(store, nextBoardTitle(store.sessionConsole.trackGroups, 'Tracks'));
}

interface BoardDropTarget {
  setId?: string;
  groupId?: string;
}

async function processPlateSources(file: File): Promise<{ src: string; thumbnailSrc: string }> {
  const mapHandle = processImage(file, 'MAP');
  const thumbHandle = processImage(file, 'THUMB');
  try {
    const [src, thumbnailSrc] = await Promise.all([mapHandle.promise, thumbHandle.promise]);
    return { src, thumbnailSrc };
  } catch {
    const src = await mapHandle.promise;
    return { src, thumbnailSrc: src };
  }
}

async function fileFromImageSrc(src: string, name: string): Promise<File> {
  const response = await fetch(toMediaProtocol(src));
  if (!response.ok) {
    throw new Error('Failed to read plate image');
  }
  const blob = await response.blob();
  const filename = /\.[^.]+$/.test(name) ? name : `${name}.webp`;
  return new File([blob], filename, { type: blob.type || 'image/webp' });
}

async function processImportedPlate(image: StageImage): Promise<StageImage> {
  const file = await fileFromImageSrc(image.src, image.name);
  const { src, thumbnailSrc } = await processPlateSources(file);
  return { ...image, src, thumbnailSrc };
}

export async function processImportedCatalogPlates(
  catalog: SessionConsoleCatalog,
): Promise<SessionConsoleCatalog> {
  const imageSets = catalog.imageSets.map((set) => ({
    ...set,
    images: set.images.slice(),
  }));
  await runWithConcurrency(
    imageSets.flatMap((set) =>
      set.images.map((image, index) => async () => {
        try {
          set.images[index] = await processImportedPlate(image);
        } catch {
          set.images[index] = image;
        }
      }),
    ),
  );
  return { ...catalog, imageSets };
}

async function addDroppedImage(store: GameState, file: File, setId: string): Promise<void> {
  const { src, thumbnailSrc } = await processPlateSources(file);
  const name = fileNameStem(file.name);
  store.updateSessionConsole({
    type: 'ADD_IMAGE',
    setId,
    image: {
      id: crypto.randomUUID(),
      name,
      cue: '',
      src,
      thumbnailSrc,
      alt: name,
    },
  });
}

async function addDroppedAudio(store: GameState, file: File, groupId: string): Promise<void> {
  const src = await saveLocalAudioFile(file);
  const title = fileNameStem(file.name);
  store.updateSessionConsole({
    type: 'ADD_TRACK',
    groupId,
    track: {
      id: crypto.randomUUID(),
      title,
      cue: '',
      tag: 'bed',
      source: 'local',
      src,
      volumeOffset: 0,
      loop: true,
    },
  });
}

export function addYouTubeFromText(
  store: GameState,
  raw: string,
  target: BoardDropTarget = {},
): boolean {
  const youtubeId = parseYouTubeVideoId(raw);
  if (!youtubeId) {
    store.showToast('Invalid YouTube link', 'error');
    return false;
  }
  const groupId = ensureTrackGroup(store, target.groupId);
  store.updateSessionConsole({
    type: 'ADD_TRACK',
    groupId,
    track: {
      id: crypto.randomUUID(),
      title: `YouTube ${youtubeId}`,
      cue: '',
      tag: 'bed',
      source: 'youtube',
      youtubeId,
      volumeOffset: 0,
      loop: true,
    },
  });
  return true;
}

function isImageFile(file: File): boolean {
  return IMAGE_FILE_RE.test(file.type) || /\.(png|jpe?g|webp|gif|avif)$/i.test(file.name);
}

function isAudioFile(file: File): boolean {
  return file.type.startsWith('audio/') || AUDIO_EXT_RE.test(file.name);
}

const INGEST_PROGRESS_INTERVAL_MS = 200;

function resolveDropImageSetId(
  store: GameState,
  folderTitle: string | undefined,
  setId?: string,
): string {
  if (setId && store.sessionConsole.imageSets.some((set) => set.id === setId)) {
    return setId;
  }
  return ensureImageSet(store, folderTitle);
}

export async function ingestDroppedFiles(
  store: GameState,
  files: File[],
  target: BoardDropTarget = {},
): Promise<void> {
  const folderTitle = folderTitleFromFiles(files);
  const imageFiles = files.filter(isImageFile);
  const audioFiles = files.filter(isAudioFile);
  const setId =
    imageFiles.length > 0 ? resolveDropImageSetId(store, folderTitle, target.setId) : '';
  const groupId = audioFiles.length > 0 ? ensureTrackGroup(store, target.groupId) : '';
  if (audioFiles.some((file) => shouldWarnLocalAudioSize(file.size))) {
    store.showToast(LOCAL_AUDIO_SIZE_WARN_MESSAGE, 'info');
  }
  const jobs = [
    ...imageFiles.map((file) => async () => addDroppedImage(store, file, setId)),
    ...audioFiles.map((file) => async () => addDroppedAudio(store, file, groupId)),
  ];
  let done = 0;
  const total = jobs.length;
  let lastProgressAt = 0;
  await runWithConcurrency(
    jobs.map((job) => async () => {
      try {
        await job();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to add board file';
        store.showToast(sanitizeSessionConsoleErrorMessage(message), 'error');
      } finally {
        done += 1;
        const now = Date.now();
        const shouldPublish =
          total > 1 &&
          (done === total ||
            lastProgressAt === 0 ||
            now - lastProgressAt >= INGEST_PROGRESS_INTERVAL_MS);
        if (shouldPublish) {
          lastProgressAt = now;
          store.showToast(`Adding files… ${done}/${total}`, 'info');
        }
      }
    }),
  );
}
