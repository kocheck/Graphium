/**
 * Pure catalog and runtime reducers for Session Console.
 * Architect-owned catalog edits stay here; World receives runtime snapshots only.
 *
 * Action/command types are consumed by Task 3 store wiring; tests are eslint-ignored.
 */
/* eslint-disable import/no-unused-modules */

import {
  clampVolume,
  type ImageSet,
  type SessionConsoleCatalog,
  type SessionConsoleRuntime,
  type SfxDefinition,
  type StageImage,
  type Track,
  type TrackGroup,
} from '../types/sessionConsole';

export type SessionConsoleCatalogAction =
  | { type: 'ADD_IMAGE_SET'; set: ImageSet }
  | { type: 'UPDATE_IMAGE_SET'; setId: string; patch: Partial<Omit<ImageSet, 'id' | 'images'>> }
  | { type: 'REMOVE_IMAGE_SET'; setId: string }
  | { type: 'REORDER_IMAGE_SETS'; orderedIds: string[] }
  | { type: 'ADD_IMAGE'; setId: string; image: StageImage }
  | { type: 'UPDATE_IMAGE'; imageId: string; patch: Partial<Omit<StageImage, 'id'>> }
  | { type: 'REMOVE_IMAGE'; imageId: string }
  | { type: 'REORDER_IMAGES'; setId: string; orderedIds: string[] }
  | { type: 'ADD_TRACK_GROUP'; group: TrackGroup }
  | {
      type: 'UPDATE_TRACK_GROUP';
      groupId: string;
      patch: Partial<Omit<TrackGroup, 'id' | 'tracks'>>;
    }
  | { type: 'REMOVE_TRACK_GROUP'; groupId: string }
  | { type: 'REORDER_TRACK_GROUPS'; orderedIds: string[] }
  | { type: 'ADD_TRACK'; groupId: string; track: Track }
  | { type: 'UPDATE_TRACK'; trackId: string; patch: Partial<Omit<Track, 'id'>> }
  | { type: 'REMOVE_TRACK'; trackId: string }
  | { type: 'REORDER_TRACKS'; groupId: string; orderedIds: string[] }
  | { type: 'UPDATE_STAGE_CHROME'; patch: Partial<SessionConsoleCatalog['stage']> }
  | { type: 'UPDATE_DEFAULTS'; patch: Partial<SessionConsoleCatalog['defaults']> }
  | { type: 'REPLACE_CATALOG'; catalog: SessionConsoleCatalog }
  | { type: 'MERGE_CATALOG'; catalog: SessionConsoleCatalog };

export type SessionConsoleRuntimeCommand =
  | { type: 'SHOW_PLATE'; imageId: string }
  | { type: 'RETURN_TO_MAP' }
  | { type: 'PLAY_TRACK'; trackId: string }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'RESTART' }
  | { type: 'STOP' }
  | { type: 'SET_VOLUME'; volume: number }
  | { type: 'SET_DUCKED'; ducked: boolean }
  | { type: 'FIRE_SFX'; sfxId: string };

function findImage(catalog: SessionConsoleCatalog, imageId: string): StageImage | undefined {
  for (const set of catalog.imageSets) {
    const image = set.images.find((item) => item.id === imageId);
    if (image) {
      return image;
    }
  }
  return undefined;
}

function findTrack(catalog: SessionConsoleCatalog, trackId: string): Track | undefined {
  for (const group of catalog.trackGroups) {
    const track = group.tracks.find((item) => item.id === trackId);
    if (track) {
      return track;
    }
  }
  return undefined;
}

function findSfx(catalog: SessionConsoleCatalog, sfxId: string): SfxDefinition | undefined {
  return catalog.sfx.find((item) => item.id === sfxId);
}

function atIndex<T>(items: readonly T[], index: number): T | undefined {
  return items[index];
}

function replaceAt<T>(items: readonly T[], index: number, next: T): T[] {
  const copy = items.slice();
  copy[index] = next;
  return copy;
}

function reorderByIds<T extends { id: string }>(items: T[], orderedIds: string[]): T[] | null {
  const byId = new Map(items.map((item) => [item.id, item]));
  if (!orderedIds.every((id) => byId.has(id))) {
    return null;
  }

  const seen = new Set<string>();
  const next: T[] = [];
  for (const id of orderedIds) {
    if (seen.has(id)) {
      continue;
    }
    const item = byId.get(id);
    if (item) {
      next.push(item);
      seen.add(id);
    }
  }
  for (const item of items) {
    if (!seen.has(item.id)) {
      next.push(item);
    }
  }
  return next;
}

function collectIds(catalog: SessionConsoleCatalog): Set<string> {
  const ids = new Set<string>();
  for (const set of catalog.imageSets) {
    ids.add(set.id);
    for (const image of set.images) {
      ids.add(image.id);
    }
  }
  for (const group of catalog.trackGroups) {
    ids.add(group.id);
    for (const track of group.tracks) {
      ids.add(track.id);
    }
  }
  for (const sfx of catalog.sfx) {
    ids.add(sfx.id);
  }
  return ids;
}

function allocateId(preferred: string, used: Set<string>): string {
  if (!used.has(preferred)) {
    used.add(preferred);
    return preferred;
  }

  let next = crypto.randomUUID();
  while (used.has(next)) {
    next = crypto.randomUUID();
  }
  used.add(next);
  return next;
}

function remapImageSet(
  set: ImageSet,
  used: Set<string>,
  imageIdMap: Map<string, string>,
): ImageSet {
  return {
    ...set,
    id: allocateId(set.id, used),
    images: set.images.map((image) => {
      const nextId = allocateId(image.id, used);
      if (nextId !== image.id) {
        imageIdMap.set(image.id, nextId);
      }
      return { ...image, id: nextId };
    }),
  };
}

function remapTrackGroup(
  group: TrackGroup,
  used: Set<string>,
  imageIdMap: Map<string, string>,
): TrackGroup {
  return {
    ...group,
    id: allocateId(group.id, used),
    tracks: group.tracks.map((track) => {
      const recommended = track.recommendedImageId;
      const remappedRecommended = recommended
        ? (imageIdMap.get(recommended) ?? recommended)
        : recommended;
      return {
        ...track,
        id: allocateId(track.id, used),
        recommendedImageId: remappedRecommended,
      };
    }),
  };
}

function cloneStageImage(image: StageImage): StageImage {
  return { ...image };
}

function cloneImageSet(set: ImageSet): ImageSet {
  return {
    ...set,
    images: set.images.map(cloneStageImage),
  };
}

function cloneTrack(track: Track): Track {
  return { ...track };
}

function cloneTrackGroup(group: TrackGroup): TrackGroup {
  return {
    ...group,
    tracks: group.tracks.map(cloneTrack),
  };
}

function mergeCatalog(
  catalog: SessionConsoleCatalog,
  incoming: SessionConsoleCatalog,
): SessionConsoleCatalog {
  const used = collectIds(catalog);
  const imageIdMap = new Map<string, string>();

  const appendedSets = incoming.imageSets.map((set) => remapImageSet(set, used, imageIdMap));
  const appendedGroups = incoming.trackGroups.map((group) =>
    remapTrackGroup(group, used, imageIdMap),
  );
  const existingSfxIds = new Set(catalog.sfx.map((sfx) => sfx.id));
  const appendedSfx = incoming.sfx
    .filter((sfx) => !existingSfxIds.has(sfx.id))
    .map((sfx) => ({ ...sfx, id: allocateId(sfx.id, used) }));

  return {
    ...catalog,
    imageSets: [...catalog.imageSets, ...appendedSets],
    trackGroups: [...catalog.trackGroups, ...appendedGroups],
    sfx: [...catalog.sfx, ...appendedSfx],
  };
}

function cloneCatalog(catalog: SessionConsoleCatalog): SessionConsoleCatalog {
  return {
    ...catalog,
    stage: { ...catalog.stage },
    defaults: { ...catalog.defaults },
    imageSets: catalog.imageSets.map(cloneImageSet),
    trackGroups: catalog.trackGroups.map(cloneTrackGroup),
    sfx: catalog.sfx.map((sfx) => ({ ...sfx })),
  };
}

function clampDuckPercent(value: number): number {
  return Math.min(100, Math.max(1, value));
}

function applyImageSetAction(
  catalog: SessionConsoleCatalog,
  action: Extract<
    SessionConsoleCatalogAction,
    | { type: 'ADD_IMAGE_SET' }
    | { type: 'UPDATE_IMAGE_SET' }
    | { type: 'REMOVE_IMAGE_SET' }
    | { type: 'REORDER_IMAGE_SETS' }
  >,
): SessionConsoleCatalog {
  switch (action.type) {
    case 'ADD_IMAGE_SET': {
      if (catalog.imageSets.some((set) => set.id === action.set.id)) {
        return catalog;
      }
      return { ...catalog, imageSets: [...catalog.imageSets, cloneImageSet(action.set)] };
    }
    case 'UPDATE_IMAGE_SET': {
      const index = catalog.imageSets.findIndex((set) => set.id === action.setId);
      const current = atIndex(catalog.imageSets, index);
      if (!current) {
        return catalog;
      }
      return {
        ...catalog,
        imageSets: replaceAt(catalog.imageSets, index, {
          ...current,
          ...action.patch,
          id: current.id,
          images: current.images,
        }),
      };
    }
    case 'REMOVE_IMAGE_SET': {
      if (!catalog.imageSets.some((set) => set.id === action.setId)) {
        return catalog;
      }
      return {
        ...catalog,
        imageSets: catalog.imageSets.filter((set) => set.id !== action.setId),
      };
    }
    case 'REORDER_IMAGE_SETS': {
      const next = reorderByIds(catalog.imageSets, action.orderedIds);
      return next ? { ...catalog, imageSets: next } : catalog;
    }
    default:
      return catalog;
  }
}

function applyImageAction(
  catalog: SessionConsoleCatalog,
  action: Extract<
    SessionConsoleCatalogAction,
    | { type: 'ADD_IMAGE' }
    | { type: 'UPDATE_IMAGE' }
    | { type: 'REMOVE_IMAGE' }
    | { type: 'REORDER_IMAGES' }
  >,
): SessionConsoleCatalog {
  switch (action.type) {
    case 'ADD_IMAGE': {
      const index = catalog.imageSets.findIndex((set) => set.id === action.setId);
      const current = atIndex(catalog.imageSets, index);
      if (!current || findImage(catalog, action.image.id)) {
        return catalog;
      }
      return {
        ...catalog,
        imageSets: replaceAt(catalog.imageSets, index, {
          ...current,
          images: [...current.images, cloneStageImage(action.image)],
        }),
      };
    }
    case 'UPDATE_IMAGE': {
      const setIndex = catalog.imageSets.findIndex((set) =>
        set.images.some((image) => image.id === action.imageId),
      );
      const currentSet = atIndex(catalog.imageSets, setIndex);
      if (!currentSet) {
        return catalog;
      }
      return {
        ...catalog,
        imageSets: replaceAt(catalog.imageSets, setIndex, {
          ...currentSet,
          images: currentSet.images.map((image) =>
            image.id === action.imageId ? { ...image, ...action.patch, id: image.id } : image,
          ),
        }),
      };
    }
    case 'REMOVE_IMAGE': {
      const setIndex = catalog.imageSets.findIndex((set) =>
        set.images.some((image) => image.id === action.imageId),
      );
      const currentSet = atIndex(catalog.imageSets, setIndex);
      if (!currentSet) {
        return catalog;
      }
      return {
        ...catalog,
        imageSets: replaceAt(catalog.imageSets, setIndex, {
          ...currentSet,
          images: currentSet.images.filter((image) => image.id !== action.imageId),
        }),
      };
    }
    case 'REORDER_IMAGES': {
      const index = catalog.imageSets.findIndex((set) => set.id === action.setId);
      const current = atIndex(catalog.imageSets, index);
      if (!current) {
        return catalog;
      }
      const nextImages = reorderByIds(current.images, action.orderedIds);
      if (!nextImages) {
        return catalog;
      }
      return {
        ...catalog,
        imageSets: replaceAt(catalog.imageSets, index, { ...current, images: nextImages }),
      };
    }
    default:
      return catalog;
  }
}

function applyTrackGroupAction(
  catalog: SessionConsoleCatalog,
  action: Extract<
    SessionConsoleCatalogAction,
    | { type: 'ADD_TRACK_GROUP' }
    | { type: 'UPDATE_TRACK_GROUP' }
    | { type: 'REMOVE_TRACK_GROUP' }
    | { type: 'REORDER_TRACK_GROUPS' }
  >,
): SessionConsoleCatalog {
  switch (action.type) {
    case 'ADD_TRACK_GROUP': {
      if (catalog.trackGroups.some((group) => group.id === action.group.id)) {
        return catalog;
      }
      return { ...catalog, trackGroups: [...catalog.trackGroups, cloneTrackGroup(action.group)] };
    }
    case 'UPDATE_TRACK_GROUP': {
      const index = catalog.trackGroups.findIndex((group) => group.id === action.groupId);
      const current = atIndex(catalog.trackGroups, index);
      if (!current) {
        return catalog;
      }
      return {
        ...catalog,
        trackGroups: replaceAt(catalog.trackGroups, index, {
          ...current,
          ...action.patch,
          id: current.id,
          tracks: current.tracks,
        }),
      };
    }
    case 'REMOVE_TRACK_GROUP': {
      if (!catalog.trackGroups.some((group) => group.id === action.groupId)) {
        return catalog;
      }
      return {
        ...catalog,
        trackGroups: catalog.trackGroups.filter((group) => group.id !== action.groupId),
      };
    }
    case 'REORDER_TRACK_GROUPS': {
      const next = reorderByIds(catalog.trackGroups, action.orderedIds);
      return next ? { ...catalog, trackGroups: next } : catalog;
    }
    default:
      return catalog;
  }
}

function applyTrackAction(
  catalog: SessionConsoleCatalog,
  action: Extract<
    SessionConsoleCatalogAction,
    | { type: 'ADD_TRACK' }
    | { type: 'UPDATE_TRACK' }
    | { type: 'REMOVE_TRACK' }
    | { type: 'REORDER_TRACKS' }
  >,
): SessionConsoleCatalog {
  switch (action.type) {
    case 'ADD_TRACK': {
      const index = catalog.trackGroups.findIndex((group) => group.id === action.groupId);
      const current = atIndex(catalog.trackGroups, index);
      if (!current || findTrack(catalog, action.track.id)) {
        return catalog;
      }
      return {
        ...catalog,
        trackGroups: replaceAt(catalog.trackGroups, index, {
          ...current,
          tracks: [...current.tracks, cloneTrack(action.track)],
        }),
      };
    }
    case 'UPDATE_TRACK': {
      const groupIndex = catalog.trackGroups.findIndex((group) =>
        group.tracks.some((track) => track.id === action.trackId),
      );
      const current = atIndex(catalog.trackGroups, groupIndex);
      if (!current) {
        return catalog;
      }
      return {
        ...catalog,
        trackGroups: replaceAt(catalog.trackGroups, groupIndex, {
          ...current,
          tracks: current.tracks.map((track) =>
            track.id === action.trackId ? { ...track, ...action.patch, id: track.id } : track,
          ),
        }),
      };
    }
    case 'REMOVE_TRACK': {
      const groupIndex = catalog.trackGroups.findIndex((group) =>
        group.tracks.some((track) => track.id === action.trackId),
      );
      const current = atIndex(catalog.trackGroups, groupIndex);
      if (!current) {
        return catalog;
      }
      return {
        ...catalog,
        trackGroups: replaceAt(catalog.trackGroups, groupIndex, {
          ...current,
          tracks: current.tracks.filter((track) => track.id !== action.trackId),
        }),
      };
    }
    case 'REORDER_TRACKS': {
      const index = catalog.trackGroups.findIndex((group) => group.id === action.groupId);
      const current = atIndex(catalog.trackGroups, index);
      if (!current) {
        return catalog;
      }
      const nextTracks = reorderByIds(current.tracks, action.orderedIds);
      if (!nextTracks) {
        return catalog;
      }
      return {
        ...catalog,
        trackGroups: replaceAt(catalog.trackGroups, index, { ...current, tracks: nextTracks }),
      };
    }
    default:
      return catalog;
  }
}

function applyCatalogMetaAction(
  catalog: SessionConsoleCatalog,
  action: Extract<
    SessionConsoleCatalogAction,
    | { type: 'UPDATE_STAGE_CHROME' }
    | { type: 'UPDATE_DEFAULTS' }
    | { type: 'REPLACE_CATALOG' }
    | { type: 'MERGE_CATALOG' }
  >,
): SessionConsoleCatalog {
  switch (action.type) {
    case 'UPDATE_STAGE_CHROME':
      return { ...catalog, stage: { ...catalog.stage, ...action.patch } };
    case 'UPDATE_DEFAULTS': {
      const volume =
        action.patch.volume === undefined
          ? catalog.defaults.volume
          : clampVolume(action.patch.volume);
      const duckPercent =
        action.patch.duckPercent === undefined
          ? catalog.defaults.duckPercent
          : clampDuckPercent(action.patch.duckPercent);
      return { ...catalog, defaults: { volume, duckPercent } };
    }
    case 'REPLACE_CATALOG':
      return cloneCatalog(action.catalog);
    case 'MERGE_CATALOG':
      return mergeCatalog(catalog, action.catalog);
    default:
      return catalog;
  }
}

function isImageSetAction(
  action: SessionConsoleCatalogAction,
): action is Parameters<typeof applyImageSetAction>[1] {
  return (
    action.type === 'ADD_IMAGE_SET' ||
    action.type === 'UPDATE_IMAGE_SET' ||
    action.type === 'REMOVE_IMAGE_SET' ||
    action.type === 'REORDER_IMAGE_SETS'
  );
}

function isImageAction(
  action: SessionConsoleCatalogAction,
): action is Parameters<typeof applyImageAction>[1] {
  return (
    action.type === 'ADD_IMAGE' ||
    action.type === 'UPDATE_IMAGE' ||
    action.type === 'REMOVE_IMAGE' ||
    action.type === 'REORDER_IMAGES'
  );
}

function isTrackGroupAction(
  action: SessionConsoleCatalogAction,
): action is Parameters<typeof applyTrackGroupAction>[1] {
  return (
    action.type === 'ADD_TRACK_GROUP' ||
    action.type === 'UPDATE_TRACK_GROUP' ||
    action.type === 'REMOVE_TRACK_GROUP' ||
    action.type === 'REORDER_TRACK_GROUPS'
  );
}

function isTrackAction(
  action: SessionConsoleCatalogAction,
): action is Parameters<typeof applyTrackAction>[1] {
  return (
    action.type === 'ADD_TRACK' ||
    action.type === 'UPDATE_TRACK' ||
    action.type === 'REMOVE_TRACK' ||
    action.type === 'REORDER_TRACKS'
  );
}

function isCatalogMetaAction(
  action: SessionConsoleCatalogAction,
): action is Parameters<typeof applyCatalogMetaAction>[1] {
  return (
    action.type === 'UPDATE_STAGE_CHROME' ||
    action.type === 'UPDATE_DEFAULTS' ||
    action.type === 'REPLACE_CATALOG' ||
    action.type === 'MERGE_CATALOG'
  );
}

/**
 * Apply an immutable catalog edit. Unknown ids return the previous reference.
 */
export function applyCatalogAction(
  catalog: SessionConsoleCatalog,
  action: SessionConsoleCatalogAction,
): SessionConsoleCatalog {
  if (isImageSetAction(action)) {
    return applyImageSetAction(catalog, action);
  }
  if (isImageAction(action)) {
    return applyImageAction(catalog, action);
  }
  if (isTrackGroupAction(action)) {
    return applyTrackGroupAction(catalog, action);
  }
  if (isTrackAction(action)) {
    return applyTrackAction(catalog, action);
  }
  if (isCatalogMetaAction(action)) {
    return applyCatalogMetaAction(catalog, action);
  }
  return catalog;
}

function withAudio(
  runtime: SessionConsoleRuntime,
  audio: SessionConsoleRuntime['audio'],
): SessionConsoleRuntime {
  return { ...runtime, audio };
}

function applyStageCommand(
  runtime: SessionConsoleRuntime,
  command: Extract<
    SessionConsoleRuntimeCommand,
    { type: 'SHOW_PLATE' } | { type: 'RETURN_TO_MAP' }
  >,
  catalog: SessionConsoleCatalog,
): SessionConsoleRuntime {
  if (command.type === 'RETURN_TO_MAP') {
    return runtime.stageVisible ? { ...runtime, stageVisible: false } : runtime;
  }

  const image = findImage(catalog, command.imageId);
  if (!image) {
    return runtime;
  }
  return {
    ...runtime,
    stageVisible: true,
    activeImage: {
      id: image.id,
      src: image.src,
      alt: image.alt,
      name: image.name,
    },
  };
}

function applyTransportCommand(
  runtime: SessionConsoleRuntime,
  command: Extract<
    SessionConsoleRuntimeCommand,
    | { type: 'PLAY_TRACK' }
    | { type: 'PAUSE' }
    | { type: 'RESUME' }
    | { type: 'RESTART' }
    | { type: 'STOP' }
  >,
  catalog: SessionConsoleCatalog,
): SessionConsoleRuntime {
  switch (command.type) {
    case 'PLAY_TRACK': {
      const track = findTrack(catalog, command.trackId);
      if (!track) {
        return runtime;
      }
      return withAudio(runtime, {
        trackId: track.id,
        title: track.title,
        source: track.source,
        youtubeId: track.youtubeId ?? null,
        src: track.src ?? null,
        status: 'playing',
        loop: track.loop,
        restartSeq: runtime.audio.restartSeq,
        volumeOffset: track.volumeOffset,
      });
    }
    case 'PAUSE':
      if (runtime.audio.status !== 'playing' || !runtime.audio.trackId) {
        return runtime;
      }
      return withAudio(runtime, { ...runtime.audio, status: 'paused' });
    case 'RESUME':
      if (runtime.audio.status !== 'paused' || !runtime.audio.trackId) {
        return runtime;
      }
      return withAudio(runtime, { ...runtime.audio, status: 'playing' });
    case 'RESTART':
      if (!runtime.audio.trackId) {
        return runtime;
      }
      return withAudio(runtime, {
        ...runtime.audio,
        status: 'playing',
        restartSeq: runtime.audio.restartSeq + 1,
      });
    case 'STOP':
      if (runtime.audio.status === 'stopped') {
        return runtime;
      }
      return withAudio(runtime, { ...runtime.audio, status: 'stopped' });
    default:
      return runtime;
  }
}

function applyMixerCommand(
  runtime: SessionConsoleRuntime,
  command: Extract<
    SessionConsoleRuntimeCommand,
    { type: 'SET_VOLUME' } | { type: 'SET_DUCKED' } | { type: 'FIRE_SFX' }
  >,
  catalog: SessionConsoleCatalog,
): SessionConsoleRuntime {
  switch (command.type) {
    case 'SET_VOLUME': {
      const volume = clampVolume(command.volume);
      return volume === runtime.volume ? runtime : { ...runtime, volume };
    }
    case 'SET_DUCKED':
      return command.ducked === runtime.ducked ? runtime : { ...runtime, ducked: command.ducked };
    case 'FIRE_SFX': {
      const sfx = findSfx(catalog, command.sfxId);
      if (!sfx) {
        return runtime;
      }
      const synthType =
        sfx.synthType ??
        (sfx.kind === 'synth' &&
        (sfx.id === 'chime' ||
          sfx.id === 'drone' ||
          sfx.id === 'snap' ||
          sfx.id === 'ping' ||
          sfx.id === 'test-tone')
          ? sfx.id
          : null);
      return {
        ...runtime,
        sfxSeq: runtime.sfxSeq + 1,
        sfxId: sfx.id,
        sfxKind: sfx.kind,
        sfxSynthType: synthType,
        sfxSrc: sfx.src ?? null,
      };
    }
    default:
      return runtime;
  }
}

/**
 * Apply an immutable runtime command. Unknown ids return the previous reference.
 */
export function applyRuntimeCommand(
  runtime: SessionConsoleRuntime,
  command: SessionConsoleRuntimeCommand,
  catalog: SessionConsoleCatalog,
): SessionConsoleRuntime {
  switch (command.type) {
    case 'SHOW_PLATE':
    case 'RETURN_TO_MAP':
      return applyStageCommand(runtime, command, catalog);
    case 'PLAY_TRACK':
    case 'PAUSE':
    case 'RESUME':
    case 'RESTART':
    case 'STOP':
      return applyTransportCommand(runtime, command, catalog);
    case 'SET_VOLUME':
    case 'SET_DUCKED':
    case 'FIRE_SFX':
      return applyMixerCommand(runtime, command, catalog);
    default:
      return runtime;
  }
}
