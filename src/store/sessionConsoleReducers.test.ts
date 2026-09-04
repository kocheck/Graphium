import { describe, expect, it } from 'vitest';

import {
  emptySessionConsoleCatalog,
  emptySessionConsoleRuntime,
  type ImageSet,
  type SessionConsoleCatalog,
  type SessionConsoleRuntime,
  type StageImage,
  type Track,
  type TrackGroup,
} from '../types/sessionConsole';
import { applyCatalogAction, applyRuntimeCommand } from './sessionConsoleReducers';

function makeImage(overrides: Partial<StageImage> & Pick<StageImage, 'id'>): StageImage {
  return {
    name: 'Plate',
    cue: 'DM-only cue text',
    src: 'file://plate.webp',
    thumbnailSrc: 'file://plate-thumb.webp',
    alt: 'A plate',
    ...overrides,
  };
}

function makeTrack(overrides: Partial<Track> & Pick<Track, 'id'>): Track {
  return {
    title: 'Tavern',
    cue: 'recommended after the riddle',
    tag: 'bed',
    source: 'youtube',
    youtubeId: 'bLZApMsorjA',
    volumeOffset: 0,
    loop: true,
    recommendedImageId: 'session-3-05',
    ...overrides,
  };
}

function catalogWithPlate(): SessionConsoleCatalog {
  const catalog = emptySessionConsoleCatalog('Ashen Crown');
  return {
    ...catalog,
    imageSets: [
      {
        id: 'set-1',
        title: 'Session 3',
        note: '',
        images: [
          makeImage({
            id: 'session-3-05',
            name: 'The statue opens',
            cue: 'recommended reveal after the riddle',
            src: 'file://plate.webp',
            thumbnailSrc: 'file://plate-thumb.webp',
            alt: 'The statue opening',
          }),
          makeImage({
            id: 'a',
            name: 'A',
            src: 'file://a.webp',
            thumbnailSrc: 'file://a-thumb.webp',
            alt: 'A',
          }),
        ],
      },
    ],
    trackGroups: [
      {
        id: 'g1',
        title: 'Beds',
        note: '',
        accent: 'bed',
        tracks: [makeTrack({ id: 't1' })],
      },
    ],
  };
}

function runtimePlaying(): SessionConsoleRuntime {
  return {
    ...emptySessionConsoleRuntime(),
    audio: {
      trackId: 't1',
      title: 'Tavern',
      source: 'youtube',
      youtubeId: 'bLZApMsorjA',
      src: null,
      status: 'playing',
      loop: true,
      restartSeq: 0,
      volumeOffset: 0,
    },
  };
}

describe('applyRuntimeCommand', () => {
  const catalog = catalogWithPlate();
  const empty = emptySessionConsoleRuntime();

  it('SHOW_PLATE copies player-safe fields only', () => {
    const next = applyRuntimeCommand(
      emptySessionConsoleRuntime(),
      {
        type: 'SHOW_PLATE',
        imageId: 'session-3-05',
      },
      catalog,
    );
    expect(next.stageVisible).toBe(true);
    expect(next.activeImage).toEqual({
      id: 'session-3-05',
      src: 'file://plate.webp',
      alt: 'The statue opening',
      name: 'The statue opens',
    });
    expect(JSON.stringify(next)).not.toMatch(/cue|recommended/i);
  });

  it('RETURN_TO_MAP hides stage and does not stop audio', () => {
    const playing = { ...runtimePlaying(), stageVisible: true };
    const next = applyRuntimeCommand(playing, { type: 'RETURN_TO_MAP' }, catalog);
    expect(next.stageVisible).toBe(false);
    expect(next.audio.status).toBe('playing');
  });

  it('PLAY_TRACK copies player-safe fields and volumeOffset onto runtime.audio', () => {
    const withPlate = applyRuntimeCommand(empty, { type: 'SHOW_PLATE', imageId: 'a' }, catalog);
    const loudCatalog = applyCatalogAction(catalog, {
      type: 'UPDATE_TRACK',
      trackId: 't1',
      patch: { volumeOffset: -8 },
    });
    const next = applyRuntimeCommand(withPlate, { type: 'PLAY_TRACK', trackId: 't1' }, loudCatalog);
    expect(next.activeImage?.id).toBe('a');
    expect(next.audio.trackId).toBe('t1');
    expect(next.audio.status).toBe('playing');
    expect(next.audio.volumeOffset).toBe(-8);
    expect(JSON.stringify(next.audio)).not.toMatch(/cue|recommended/i);
  });

  it('FIRE_SFX increments seq', () => {
    const next = applyRuntimeCommand(empty, { type: 'FIRE_SFX', sfxId: 'chime' }, catalog);
    expect(next.sfxSeq).toBe(1);
    expect(next.sfxId).toBe('chime');
  });

  it('unknown ids are no-ops and return the previous reference', () => {
    expect(applyRuntimeCommand(empty, { type: 'SHOW_PLATE', imageId: 'missing' }, catalog)).toBe(
      empty,
    );
    expect(applyRuntimeCommand(empty, { type: 'PLAY_TRACK', trackId: 'missing' }, catalog)).toBe(
      empty,
    );
    expect(applyRuntimeCommand(empty, { type: 'FIRE_SFX', sfxId: 'missing' }, catalog)).toBe(empty);
  });

  it('PAUSE, RESUME, RESTART, and STOP only change transport status', () => {
    const playing = runtimePlaying();
    const paused = applyRuntimeCommand(playing, { type: 'PAUSE' }, catalog);
    expect(paused.audio.status).toBe('paused');
    expect(paused.audio.trackId).toBe('t1');

    const resumed = applyRuntimeCommand(paused, { type: 'RESUME' }, catalog);
    expect(resumed.audio.status).toBe('playing');

    const restarted = applyRuntimeCommand(paused, { type: 'RESTART' }, catalog);
    expect(restarted.audio.status).toBe('playing');
    expect(restarted.audio.trackId).toBe('t1');
    expect(restarted.audio.restartSeq).toBe(1);

    const stopped = applyRuntimeCommand(playing, { type: 'STOP' }, catalog);
    expect(stopped.audio.status).toBe('stopped');
    expect(stopped.audio.trackId).toBe('t1');
  });

  it('SET_VOLUME clamps and SET_DUCKED toggles without touching the plate', () => {
    const withPlate = applyRuntimeCommand(empty, { type: 'SHOW_PLATE', imageId: 'a' }, catalog);
    const loud = applyRuntimeCommand(withPlate, { type: 'SET_VOLUME', volume: 240 }, catalog);
    expect(loud.volume).toBe(100);
    expect(loud.activeImage?.id).toBe('a');

    const ducked = applyRuntimeCommand(loud, { type: 'SET_DUCKED', ducked: true }, catalog);
    expect(ducked.ducked).toBe(true);
    expect(ducked.activeImage?.id).toBe('a');
  });

  it('RESTART increments restartSeq while already playing', () => {
    const playing = runtimePlaying();
    const next = applyRuntimeCommand(playing, { type: 'RESTART' }, catalog);
    expect(next.audio.status).toBe('playing');
    expect(next.audio.restartSeq).toBe(1);
    expect(next.audio.trackId).toBe('t1');
    expect(playing.audio.restartSeq).toBe(0);

    const again = applyRuntimeCommand(next, { type: 'RESTART' }, catalog);
    expect(again.audio.restartSeq).toBe(2);
  });
});

describe('applyCatalogAction', () => {
  it('adds, updates, reorders, and removes image sets immutably', () => {
    const catalog = emptySessionConsoleCatalog('Ashen Crown');
    const set: ImageSet = { id: 'set-1', title: 'Reveal', note: '', images: [] };

    const added = applyCatalogAction(catalog, { type: 'ADD_IMAGE_SET', set });
    expect(added.imageSets).toEqual([set]);
    expect(catalog.imageSets).toEqual([]);

    const updated = applyCatalogAction(added, {
      type: 'UPDATE_IMAGE_SET',
      setId: 'set-1',
      patch: { title: 'Session 3', note: 'statue' },
    });
    expect(updated.imageSets[0]?.title).toBe('Session 3');
    expect(added.imageSets[0]?.title).toBe('Reveal');

    const extra = applyCatalogAction(updated, {
      type: 'ADD_IMAGE_SET',
      set: { id: 'set-2', title: 'Later', note: '', images: [] },
    });
    const reordered = applyCatalogAction(extra, {
      type: 'REORDER_IMAGE_SETS',
      orderedIds: ['set-2', 'set-1'],
    });
    expect(reordered.imageSets.map((item) => item.id)).toEqual(['set-2', 'set-1']);

    const removed = applyCatalogAction(reordered, { type: 'REMOVE_IMAGE_SET', setId: 'set-2' });
    expect(removed.imageSets.map((item) => item.id)).toEqual(['set-1']);
  });

  it('adds, updates, reorders, and removes images within a set', () => {
    const withSet = applyCatalogAction(emptySessionConsoleCatalog('Ashen Crown'), {
      type: 'ADD_IMAGE_SET',
      set: { id: 'set-1', title: 'Reveal', note: '', images: [] },
    });
    const image = makeImage({ id: 'img-1', name: 'Door' });
    const added = applyCatalogAction(withSet, { type: 'ADD_IMAGE', setId: 'set-1', image });
    expect(added.imageSets[0]?.images).toEqual([image]);

    const updated = applyCatalogAction(added, {
      type: 'UPDATE_IMAGE',
      imageId: 'img-1',
      patch: { name: 'The door', cue: 'after knock' },
    });
    expect(updated.imageSets[0]?.images[0]?.name).toBe('The door');
    expect(added.imageSets[0]?.images[0]?.name).toBe('Door');

    const second = applyCatalogAction(updated, {
      type: 'ADD_IMAGE',
      setId: 'set-1',
      image: makeImage({ id: 'img-2', name: 'Hall' }),
    });
    const reordered = applyCatalogAction(second, {
      type: 'REORDER_IMAGES',
      setId: 'set-1',
      orderedIds: ['img-2', 'img-1'],
    });
    expect(reordered.imageSets[0]?.images.map((item) => item.id)).toEqual(['img-2', 'img-1']);

    const removed = applyCatalogAction(reordered, { type: 'REMOVE_IMAGE', imageId: 'img-2' });
    expect(removed.imageSets[0]?.images.map((item) => item.id)).toEqual(['img-1']);
  });

  it('adds, updates, reorders, and removes track groups and tracks', () => {
    const catalog = emptySessionConsoleCatalog('Ashen Crown');
    const group: TrackGroup = { id: 'g1', title: 'Beds', note: '', accent: 'bed', tracks: [] };
    const withGroup = applyCatalogAction(catalog, { type: 'ADD_TRACK_GROUP', group });
    const renamed = applyCatalogAction(withGroup, {
      type: 'UPDATE_TRACK_GROUP',
      groupId: 'g1',
      patch: { title: 'Travel', accent: 'road' },
    });
    expect(renamed.trackGroups[0]?.title).toBe('Travel');

    const extraGroup = applyCatalogAction(renamed, {
      type: 'ADD_TRACK_GROUP',
      group: { id: 'g2', title: 'Stings', note: '', accent: 'arrive', tracks: [] },
    });
    const reorderedGroups = applyCatalogAction(extraGroup, {
      type: 'REORDER_TRACK_GROUPS',
      orderedIds: ['g2', 'g1'],
    });
    expect(reorderedGroups.trackGroups.map((item) => item.id)).toEqual(['g2', 'g1']);

    const track = makeTrack({ id: 't1', title: 'Road' });
    const withTrack = applyCatalogAction(reorderedGroups, {
      type: 'ADD_TRACK',
      groupId: 'g1',
      track,
    });
    const updatedTrack = applyCatalogAction(withTrack, {
      type: 'UPDATE_TRACK',
      trackId: 't1',
      patch: { title: 'Long road', volumeOffset: -4 },
    });
    expect(updatedTrack.trackGroups.find((item) => item.id === 'g1')?.tracks[0]?.title).toBe(
      'Long road',
    );

    const secondTrack = applyCatalogAction(updatedTrack, {
      type: 'ADD_TRACK',
      groupId: 'g1',
      track: makeTrack({ id: 't2', title: 'Camp' }),
    });
    const reorderedTracks = applyCatalogAction(secondTrack, {
      type: 'REORDER_TRACKS',
      groupId: 'g1',
      orderedIds: ['t2', 't1'],
    });
    expect(
      reorderedTracks.trackGroups.find((item) => item.id === 'g1')?.tracks.map((item) => item.id),
    ).toEqual(['t2', 't1']);

    const removedTrack = applyCatalogAction(reorderedTracks, {
      type: 'REMOVE_TRACK',
      trackId: 't2',
    });
    expect(
      removedTrack.trackGroups.find((item) => item.id === 'g1')?.tracks.map((item) => item.id),
    ).toEqual(['t1']);

    const removedGroup = applyCatalogAction(removedTrack, {
      type: 'REMOVE_TRACK_GROUP',
      groupId: 'g2',
    });
    expect(removedGroup.trackGroups.map((item) => item.id)).toEqual(['g1']);
  });

  it('updates stage chrome and defaults without mutating the previous catalog', () => {
    const catalog = emptySessionConsoleCatalog('Ashen Crown');
    const chrome = applyCatalogAction(catalog, {
      type: 'UPDATE_STAGE_CHROME',
      patch: { title: 'The Crown', subtitle: 'Session 3', showFrame: false },
    });
    expect(chrome.stage).toEqual({ title: 'The Crown', subtitle: 'Session 3', showFrame: false });
    expect(catalog.stage.title).toBe('Ashen Crown');

    const defaults = applyCatalogAction(chrome, {
      type: 'UPDATE_DEFAULTS',
      patch: { volume: 70, duckPercent: 40 },
    });
    expect(defaults.defaults).toEqual({ volume: 70, duckPercent: 40 });
    expect(chrome.defaults).toEqual({ volume: 45, duckPercent: 27 });
  });

  it('REPLACE_CATALOG swaps the catalog', () => {
    const current = catalogWithPlate();
    const replacement = emptySessionConsoleCatalog('New Board');
    const next = applyCatalogAction(current, { type: 'REPLACE_CATALOG', catalog: replacement });
    expect(next.stage.title).toBe('New Board');
    expect(next.imageSets).toEqual([]);
    expect(next.trackGroups).toEqual([]);
    expect(current.imageSets).toHaveLength(1);
  });

  it('MERGE_CATALOG appends; colliding ids get new ids; no silent overwrite', () => {
    const current = catalogWithPlate();
    const incoming: SessionConsoleCatalog = {
      ...emptySessionConsoleCatalog('Incoming'),
      stage: { title: 'Should not overwrite', subtitle: 'nope', showFrame: false },
      defaults: { volume: 99, duckPercent: 10 },
      imageSets: [
        {
          id: 'set-1',
          title: 'Imported set',
          note: 'collision',
          images: [
            makeImage({
              id: 'session-3-05',
              name: 'Imported statue',
              cue: 'incoming cue',
              src: 'file://imported.webp',
              thumbnailSrc: 'file://imported-thumb.webp',
              alt: 'Imported',
            }),
            makeImage({ id: 'fresh-img', name: 'New hall' }),
          ],
        },
      ],
      trackGroups: [
        {
          id: 'g1',
          title: 'Imported beds',
          note: '',
          accent: 'combat',
          tracks: [
            makeTrack({
              id: 't1',
              title: 'Imported bed',
              recommendedImageId: 'session-3-05',
            }),
          ],
        },
      ],
      sfx: [{ id: 'chime', label: 'Imported Chime', kind: 'synth', synthType: 'chime' }],
    };

    const merged = applyCatalogAction(current, { type: 'MERGE_CATALOG', catalog: incoming });

    expect(merged.stage).toEqual(current.stage);
    expect(merged.defaults).toEqual(current.defaults);
    expect(merged.imageSets[0]).toEqual(current.imageSets[0]);
    expect(merged.trackGroups[0]).toEqual(current.trackGroups[0]);
    expect(merged.sfx.find((item) => item.id === 'chime')).toEqual(current.sfx[0]);

    expect(merged.imageSets).toHaveLength(2);
    expect(merged.trackGroups).toHaveLength(2);

    const appendedSet = merged.imageSets[1];
    expect(appendedSet).toBeDefined();
    expect(appendedSet?.id).not.toBe('set-1');
    expect(appendedSet?.title).toBe('Imported set');
    expect(appendedSet?.images[0]?.id).not.toBe('session-3-05');
    expect(appendedSet?.images[0]?.name).toBe('Imported statue');
    expect(appendedSet?.images[1]?.id).toBe('fresh-img');

    const appendedGroup = merged.trackGroups[1];
    expect(appendedGroup?.id).not.toBe('g1');
    expect(appendedGroup?.tracks[0]?.id).not.toBe('t1');
    expect(appendedGroup?.tracks[0]?.recommendedImageId).toBe(appendedSet?.images[0]?.id);

    expect(merged.sfx.find((item) => item.label === 'Imported Chime')).toBeUndefined();
    expect(merged.sfx.filter((item) => item.id === 'chime')).toHaveLength(1);
    expect(merged.sfx).toHaveLength(current.sfx.length);
    expect(current.imageSets).toHaveLength(1);
  });

  it('MERGE_CATALOG skips seeded SFX ids when merging two empty catalogs', () => {
    const merged = applyCatalogAction(emptySessionConsoleCatalog('B'), {
      type: 'MERGE_CATALOG',
      catalog: emptySessionConsoleCatalog('A'),
    });
    expect(merged.sfx.map((item) => item.id)).toEqual([
      'chime',
      'drone',
      'snap',
      'ping',
      'test-tone',
    ]);
    expect(merged.sfx).toHaveLength(5);
  });

  it('MERGE_CATALOG appends incoming SFX with a new id as a clone', () => {
    const extra = {
      id: 'horn',
      label: 'Horn',
      kind: 'synth' as const,
      synthType: 'chime' as const,
    };
    const incoming: SessionConsoleCatalog = {
      ...emptySessionConsoleCatalog('A'),
      sfx: [...emptySessionConsoleCatalog('A').sfx, extra],
    };
    const merged = applyCatalogAction(emptySessionConsoleCatalog('B'), {
      type: 'MERGE_CATALOG',
      catalog: incoming,
    });
    extra.label = 'MUTATED';
    expect(merged.sfx.map((item) => item.id)).toContain('horn');
    expect(merged.sfx).toHaveLength(6);
    expect(merged.sfx.find((item) => item.id === 'horn')?.label).toBe('Horn');
  });

  it('ADD_IMAGE clones the payload so later mutation does not change the catalog', () => {
    const catalogWithSet = applyCatalogAction(emptySessionConsoleCatalog('Ashen Crown'), {
      type: 'ADD_IMAGE_SET',
      set: { id: 'set-1', title: 'Reveal', note: '', images: [] },
    });
    const image = {
      id: 'img-new',
      name: 'A',
      cue: '',
      src: 'file://a.webp',
      thumbnailSrc: 'file://a-t.webp',
      alt: 'A',
    };
    const next = applyCatalogAction(catalogWithSet, { type: 'ADD_IMAGE', setId: 'set-1', image });
    image.name = 'MUTATED';
    expect(next.imageSets[0]?.images.find((item) => item.id === 'img-new')?.name).toBe('A');
  });

  it('ADD_IMAGE_SET clones the payload so later mutation does not change the catalog', () => {
    const nested = makeImage({ id: 'img-1', name: 'Door' });
    const set: ImageSet = { id: 'set-new', title: 'Reveal', note: '', images: [nested] };
    const next = applyCatalogAction(emptySessionConsoleCatalog('Ashen Crown'), {
      type: 'ADD_IMAGE_SET',
      set,
    });
    set.title = 'MUTATED';
    nested.name = 'MUTATED';
    set.images.push(makeImage({ id: 'img-extra', name: 'Extra' }));
    expect(next.imageSets[0]?.title).toBe('Reveal');
    expect(next.imageSets[0]?.images).toHaveLength(1);
    expect(next.imageSets[0]?.images[0]?.name).toBe('Door');
  });

  it('ADD_TRACK clones the payload so later mutation does not change the catalog', () => {
    const withGroup = applyCatalogAction(emptySessionConsoleCatalog('Ashen Crown'), {
      type: 'ADD_TRACK_GROUP',
      group: { id: 'g1', title: 'Beds', note: '', accent: 'bed', tracks: [] },
    });
    const track = makeTrack({ id: 't-new', title: 'Tavern' });
    const next = applyCatalogAction(withGroup, { type: 'ADD_TRACK', groupId: 'g1', track });
    track.title = 'MUTATED';
    expect(next.trackGroups[0]?.tracks.find((item) => item.id === 't-new')?.title).toBe('Tavern');
  });

  it('ADD_TRACK_GROUP clones the payload so later mutation does not change the catalog', () => {
    const nested = makeTrack({ id: 't1', title: 'Road' });
    const group: TrackGroup = {
      id: 'g-new',
      title: 'Beds',
      note: '',
      accent: 'bed',
      tracks: [nested],
    };
    const next = applyCatalogAction(emptySessionConsoleCatalog('Ashen Crown'), {
      type: 'ADD_TRACK_GROUP',
      group,
    });
    group.title = 'MUTATED';
    nested.title = 'MUTATED';
    group.tracks.push(makeTrack({ id: 't-extra', title: 'Extra' }));
    expect(next.trackGroups[0]?.title).toBe('Beds');
    expect(next.trackGroups[0]?.tracks).toHaveLength(1);
    expect(next.trackGroups[0]?.tracks[0]?.title).toBe('Road');
  });

  it('unknown catalog ids are no-ops and return the previous reference', () => {
    const catalog = catalogWithPlate();
    expect(applyCatalogAction(catalog, { type: 'REMOVE_IMAGE_SET', setId: 'missing' })).toBe(
      catalog,
    );
    expect(
      applyCatalogAction(catalog, {
        type: 'UPDATE_IMAGE_SET',
        setId: 'missing',
        patch: { title: 'x' },
      }),
    ).toBe(catalog);
    expect(
      applyCatalogAction(catalog, {
        type: 'ADD_IMAGE',
        setId: 'missing',
        image: makeImage({ id: 'z' }),
      }),
    ).toBe(catalog);
    expect(applyCatalogAction(catalog, { type: 'REMOVE_IMAGE', imageId: 'missing' })).toBe(catalog);
    expect(applyCatalogAction(catalog, { type: 'REMOVE_TRACK', trackId: 'missing' })).toBe(catalog);
    expect(applyCatalogAction(catalog, { type: 'REMOVE_TRACK_GROUP', groupId: 'missing' })).toBe(
      catalog,
    );
  });
});
