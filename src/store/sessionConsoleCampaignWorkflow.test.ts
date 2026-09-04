import { afterEach, describe, expect, it } from 'vitest';

import { rewriteCampaignAssetSrcs } from '../utils/campaignAssets';
import { useGameStore } from './gameStore';

describe('session console campaign workflow', () => {
  afterEach(() => {
    useGameStore.getState().resetToNewCampaign();
  });

  it('show plate, play YouTube, return to map keeps audio, and rewrite still walks session console srcs', async () => {
    const store = useGameStore.getState();
    store.resetToNewCampaign();

    store.updateSessionConsole({
      type: 'ADD_IMAGE_SET',
      set: { id: 'set-1', title: 'Plates', note: '', images: [] },
    });
    store.updateSessionConsole({
      type: 'ADD_IMAGE',
      setId: 'set-1',
      image: {
        id: 'plate-1',
        name: 'The statue opens',
        cue: 'DM-only',
        src: 'file://plate.webp',
        thumbnailSrc: 'file://plate-thumb.webp',
        alt: 'Statue',
      },
    });
    store.updateSessionConsole({
      type: 'ADD_TRACK_GROUP',
      group: { id: 'g1', title: 'Beds', note: '', accent: 'bed', tracks: [] },
    });
    store.updateSessionConsole({
      type: 'ADD_TRACK',
      groupId: 'g1',
      track: {
        id: 'yt-1',
        title: 'Tavern',
        cue: '',
        tag: 'bed',
        source: 'youtube',
        youtubeId: 'bLZApMsorjA',
        volumeOffset: 0,
        loop: true,
      },
    });
    store.updateSessionConsole({
      type: 'ADD_TRACK',
      groupId: 'g1',
      track: {
        id: 'local-1',
        title: 'Door slam',
        cue: '',
        tag: 'sting',
        source: 'local',
        src: 'file://door.mp3',
        volumeOffset: 0,
        loop: false,
      },
    });
    store.updateSessionConsole({
      type: 'MERGE_CATALOG',
      catalog: {
        ...useGameStore.getState().sessionConsole,
        imageSets: [],
        trackGroups: [],
        sfx: [{ id: 'local-sfx', label: 'Snap file', kind: 'local', src: 'file://snap.wav' }],
      },
    });

    store.dispatchSessionConsole({ type: 'SHOW_PLATE', imageId: 'plate-1' });
    expect(useGameStore.getState().sessionConsoleRuntime.stageVisible).toBe(true);
    expect(useGameStore.getState().sessionConsoleRuntime.activeImage?.id).toBe('plate-1');

    store.dispatchSessionConsole({ type: 'PLAY_TRACK', trackId: 'yt-1' });
    expect(useGameStore.getState().sessionConsoleRuntime.audio).toMatchObject({
      trackId: 'yt-1',
      source: 'youtube',
      youtubeId: 'bLZApMsorjA',
      status: 'playing',
    });
    expect(useGameStore.getState().sessionConsoleRuntime.activeImage?.id).toBe('plate-1');

    store.dispatchSessionConsole({ type: 'RETURN_TO_MAP' });
    const runtime = useGameStore.getState().sessionConsoleRuntime;
    expect(runtime.stageVisible).toBe(false);
    expect(runtime.activeImage?.id).toBe('plate-1');
    expect(runtime.audio.status).toBe('playing');
    expect(runtime.audio.trackId).toBe('yt-1');
    expect(runtime.audio.youtubeId).toBe('bLZApMsorjA');

    const campaign = structuredClone(useGameStore.getState().campaign);
    await rewriteCampaignAssetSrcs(campaign, async (src) => src.replace('file://', 'assets/'));

    expect(campaign.sessionConsole?.imageSets[0]?.images[0]?.src).toBe('assets/plate.webp');
    expect(campaign.sessionConsole?.imageSets[0]?.images[0]?.thumbnailSrc).toBe(
      'assets/plate-thumb.webp',
    );
    const tracks = campaign.sessionConsole?.trackGroups[0]?.tracks ?? [];
    expect(tracks.find((track) => track.id === 'local-1')?.src).toBe('assets/door.mp3');
    expect(tracks.find((track) => track.id === 'yt-1')?.youtubeId).toBe('bLZApMsorjA');
    expect(tracks.find((track) => track.id === 'yt-1')?.src).toBeUndefined();
    expect(campaign.sessionConsole?.sfx.find((sfx) => sfx.id === 'local-sfx')?.src).toBe(
      'assets/snap.wav',
    );
  });
});
