import { describe, it, expect } from 'vitest';
import { emptySessionConsoleRuntime } from '../types/sessionConsole';
import { sanitizeStack } from './errorSanitizer';
import {
  isEqual,
  detectChanges,
  coalesceSyncActions,
  detectWorldViewTokenUpdates,
  isTokenDragAction,
  FULL_SYNC_ACTION_THRESHOLD,
  applyAction,
  buildFullSyncPayload,
  cloneSyncableStateFromGame,
  cloneSyncableStateFromPayload,
  isSyncSliceUnchanged,
  parseSessionConsoleWorldEvent,
  sanitizeSessionConsoleErrorMessage,
} from './syncUtils';
import type { SessionConsoleRuntime } from '../types/sessionConsole';
import type { GameState } from '../store/gameStore';

function runtime(overrides: Partial<SessionConsoleRuntime> = {}): SessionConsoleRuntime {
  const base = emptySessionConsoleRuntime();
  return {
    ...base,
    ...overrides,
    stage: { ...base.stage, ...overrides.stage },
    audio: { ...base.audio, ...overrides.audio },
    activeImage: overrides.activeImage === undefined ? base.activeImage : overrides.activeImage,
  };
}

const plateImage = {
  id: 'img-1',
  src: 'file:///tmp/plate.webp',
  alt: 'A forest path',
  name: 'Forest',
};

const playingAudio: SessionConsoleRuntime['audio'] = {
  trackId: 'track-1',
  title: 'Road bed',
  source: 'local',
  youtubeId: null,
  src: 'file:///tmp/bed.mp3',
  status: 'playing',
  loop: true,
  restartSeq: 0,
  volumeOffset: 0,
};

describe('syncUtils', () => {
  describe('isTokenDragAction', () => {
    it('identifies drag motion actions', () => {
      expect(isTokenDragAction({ type: 'TOKEN_DRAG_MOVE', payload: { id: 't', x: 0, y: 0 } })).toBe(
        true,
      );
      expect(
        isTokenDragAction({ type: 'TOKEN_ADD', payload: { id: 't', x: 0, y: 0, src: '' } }),
      ).toBe(false);
    });
  });
  describe('isEqual', () => {
    it('handles primitives', () => {
      expect(isEqual(1, 1)).toBe(true);
      expect(isEqual('a', 'a')).toBe(true);
      expect(isEqual(true, true)).toBe(true);
      expect(isEqual(1, 2)).toBe(false);
    });

    it('handles nested objects', () => {
      const o1 = { a: 1, b: { c: 2 } };
      const o2 = { a: 1, b: { c: 2 } };
      const o3 = { a: 1, b: { c: 3 } };
      expect(isEqual(o1, o2)).toBe(true);
      expect(isEqual(o1, o3)).toBe(false);
    });

    it('handles arrays', () => {
      expect(isEqual([1, 2], [1, 2])).toBe(true);
      expect(isEqual([1, 2], [1, 3])).toBe(false);
    });
  });

  describe('detectChanges', () => {
    it('detects token addition', () => {
      const prev = { tokens: [] };
      const curr = { tokens: [{ id: 't1', x: 0 }] };
      const changes = detectChanges(prev, curr);
      expect(changes).toContainEqual({
        type: 'TOKEN_ADD',
        payload: { id: 't1', x: 0 },
      });
    });

    it('detects token update', () => {
      const prev = { tokens: [{ id: 't1', x: 0, y: 0 }] };
      const curr = { tokens: [{ id: 't1', x: 10, y: 0 }] };
      const changes = detectChanges(prev, curr);
      expect(changes).toContainEqual({
        type: 'TOKEN_UPDATE',
        payload: { id: 't1', changes: { x: 10 } },
      });
    });

    it('detects library update', () => {
      const prev = { tokenLibrary: [] };
      const curr = { tokenLibrary: [{ id: 'l1', name: 'Goblin' }] };
      const changes = detectChanges(prev, curr);
      expect(changes).toContainEqual({
        type: 'LIBRARY_UPDATE',
        payload: [{ id: 'l1', name: 'Goblin' }],
      });
    });

    it('includes gridColor in GRID_UPDATE', () => {
      const prev = {
        gridSize: 50,
        gridType: 'LINES' as const,
        gridColor: '#222222',
        isDaylightMode: false,
      };
      const curr = { ...prev, gridColor: '#ff0000' };
      const changes = detectChanges(prev, curr);
      expect(changes).toContainEqual({
        type: 'GRID_UPDATE',
        payload: {
          gridSize: 50,
          gridType: 'LINES',
          gridColor: '#ff0000',
          isDaylightMode: false,
        },
      });
    });

    it('emits MEASUREMENT_UPDATE when broadcasting', () => {
      const measurement = {
        id: 'active',
        type: 'ruler' as const,
        origin: { x: 0, y: 0 },
        end: { x: 50, y: 0 },
        distanceFeet: 5,
      };
      const prev = { broadcastMeasurement: true, activeMeasurement: null };
      const curr = { broadcastMeasurement: true, activeMeasurement: measurement };
      const changes = detectChanges(prev, curr);
      expect(changes).toContainEqual({
        type: 'MEASUREMENT_UPDATE',
        payload: measurement,
      });
    });

    it('clears measurement when broadcast is disabled', () => {
      const measurement = {
        id: 'active',
        type: 'ruler' as const,
        origin: { x: 0, y: 0 },
        end: { x: 50, y: 0 },
        distanceFeet: 5,
      };
      const prev = { broadcastMeasurement: true, activeMeasurement: measurement };
      const curr = { broadcastMeasurement: false, activeMeasurement: measurement };
      const changes = detectChanges(prev, curr);
      expect(changes).toContainEqual({
        type: 'MEASUREMENT_UPDATE',
        payload: null,
      });
    });

    it('includes activeMeasurement in FULL_SYNC when broadcasting', () => {
      const measurement = {
        id: 'active',
        type: 'ruler' as const,
        origin: { x: 0, y: 0 },
        end: { x: 50, y: 0 },
        distanceFeet: 5,
      };

      const curr = {
        tokens: [],
        tokenLibrary: [],
        drawings: [],
        doors: [],
        stairs: [],
        gridSize: 50,
        gridType: 'LINES' as const,
        gridColor: '#222222',
        map: null,
        exploredRegions: [],
        isDaylightMode: false,
        activeMeasurement: measurement,
        broadcastMeasurement: true,
      };

      const changes = detectChanges(null, curr);
      const fullSync = changes.find((c) => c.type === 'FULL_SYNC');
      expect(fullSync).toBeTruthy();
      if (fullSync && fullSync.type === 'FULL_SYNC') {
        expect(fullSync.payload.activeMeasurement).toEqual(measurement);
        expect(fullSync.payload.broadcastMeasurement).toBe(true);
      }
    });

    it('detects stairs add/remove', () => {
      const stairs = {
        id: 's1',
        x: 0,
        y: 0,
        direction: 'north' as const,
        type: 'up' as const,
        width: 50,
        height: 50,
      };
      expect(detectChanges({ stairs: [] }, { stairs: [stairs] })).toContainEqual({
        type: 'STAIRS_ADD',
        payload: stairs,
      });
      expect(detectChanges({ stairs: [stairs] }, { stairs: [] })).toContainEqual({
        type: 'STAIRS_REMOVE',
        payload: { id: 's1' },
      });
    });

    it('detects explored region updates', () => {
      const regions = [
        {
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
          ],
          timestamp: 1,
        },
      ];
      const changes = detectChanges({ exploredRegions: [] }, { exploredRegions: regions });
      expect(changes).toContainEqual({
        type: 'EXPLORED_UPDATE',
        payload: regions,
      });
    });

    it('emits FULL_SYNC when previous state is null', () => {
      const changes = detectChanges(null, { tokens: [{ id: 't1', x: 0 }] });
      expect(changes).toHaveLength(1);
      expect(changes[0]?.type).toBe('FULL_SYNC');
    });

    it('skips entity diffs when collection references are unchanged', () => {
      const tokens = [{ id: 't1', x: 0, y: 0, src: 'a' }];
      const drawings = [
        { id: 'd1', tool: 'marker' as const, points: [0, 0, 10, 10], color: '#f00', size: 2 },
      ];
      const exploredRegions = [
        {
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
          ],
          timestamp: 1,
        },
      ];
      const prev = { tokens, drawings, exploredRegions };
      const curr = { tokens, drawings, exploredRegions };
      expect(detectChanges(prev, curr)).toEqual([]);
    });

    it('skips deep compare when a token object reference is unchanged', () => {
      const unchanged = { id: 't1', x: 0, y: 0, src: 'a' };
      const moved = { id: 't2', x: 5, y: 5, src: 'b' };
      const prev = { tokens: [unchanged, { id: 't2', x: 0, y: 0, src: 'b' }] };
      const curr = { tokens: [unchanged, moved] };
      expect(detectChanges(prev, curr)).toEqual([
        { type: 'TOKEN_UPDATE', payload: { id: 't2', changes: { x: 5, y: 5 } } },
      ]);
    });

    it('emits STAGE_UPDATE when only the plate changes', () => {
      const prevRt = runtime();
      const currRt = runtime({
        stageVisible: true,
        activeImage: plateImage,
      });
      const changes = detectChanges(
        { sessionConsoleRuntime: prevRt },
        { sessionConsoleRuntime: currRt },
      );
      expect(changes).toEqual([
        {
          type: 'STAGE_UPDATE',
          payload: { stageVisible: true, activeImage: plateImage, stage: currRt.stage },
        },
      ]);
    });

    it('emits AUDIO_UPDATE including restartSeq when it increments', () => {
      const prevRt = runtime({ audio: playingAudio });
      const audio = { ...playingAudio, restartSeq: 1 };
      const currRt = runtime({ audio });
      const changes = detectChanges(
        { sessionConsoleRuntime: prevRt },
        { sessionConsoleRuntime: currRt },
      );
      expect(changes).toEqual([
        {
          type: 'AUDIO_UPDATE',
          payload: { audio, volume: currRt.volume, ducked: false, duckPercent: currRt.duckPercent },
        },
      ]);
      expect(changes[0]?.type === 'AUDIO_UPDATE' && changes[0].payload.audio.restartSeq).toBe(1);
    });

    it('emits AUDIO_UPDATE when a track starts playing', () => {
      const prevRt = runtime({ stageVisible: true, activeImage: plateImage });
      const currRt = runtime({
        stageVisible: true,
        activeImage: plateImage,
        audio: playingAudio,
      });
      const changes = detectChanges(
        { sessionConsoleRuntime: prevRt },
        { sessionConsoleRuntime: currRt },
      );
      expect(changes).toEqual([
        {
          type: 'AUDIO_UPDATE',
          payload: {
            audio: playingAudio,
            volume: currRt.volume,
            ducked: false,
            duckPercent: currRt.duckPercent,
          },
        },
      ]);
    });

    it('does not emit audio stop on RETURN_TO_MAP while audio is still playing', () => {
      const audio = { ...playingAudio };
      const prevRt = runtime({
        stageVisible: true,
        activeImage: plateImage,
        audio,
      });
      const currRt = runtime({
        stageVisible: false,
        activeImage: plateImage,
        audio,
      });
      const changes = detectChanges(
        { sessionConsoleRuntime: prevRt },
        { sessionConsoleRuntime: currRt },
      );
      expect(changes).toEqual([
        {
          type: 'STAGE_UPDATE',
          payload: { stageVisible: false, activeImage: plateImage, stage: currRt.stage },
        },
      ]);
      expect(changes.some((action) => action.type === 'AUDIO_UPDATE')).toBe(false);
      expect(currRt.audio.status).toBe('playing');
    });

    it('emits AUDIO_UPDATE (not FULL_SYNC) for volume and duck changes', () => {
      const audio = { ...playingAudio };
      const prevRt = runtime({ audio, volume: 45, ducked: false });
      const volumeRt = runtime({ audio, volume: 70, ducked: false });
      const duckRt = runtime({ audio, volume: 70, ducked: true });

      const volumeChanges = detectChanges(
        { sessionConsoleRuntime: prevRt },
        { sessionConsoleRuntime: volumeRt },
      );
      expect(volumeChanges).toEqual([
        { type: 'AUDIO_UPDATE', payload: { audio, volume: 70, ducked: false, duckPercent: 27 } },
      ]);
      expect(volumeChanges[0]?.type).not.toBe('FULL_SYNC');

      const duckChanges = detectChanges(
        { sessionConsoleRuntime: volumeRt },
        { sessionConsoleRuntime: duckRt },
      );
      expect(duckChanges).toEqual([
        { type: 'AUDIO_UPDATE', payload: { audio, volume: 70, ducked: true, duckPercent: 27 } },
      ]);
      expect(coalesceSyncActions(duckChanges, { sessionConsoleRuntime: duckRt })[0]?.type).toBe(
        'AUDIO_UPDATE',
      );
    });

    it('emits SFX_FIRE when sfx seq advances', () => {
      const prevRt = runtime({ sfxSeq: 2, sfxId: 'chime' });
      const currRt = runtime({ sfxSeq: 3, sfxId: 'snap' });
      expect(
        detectChanges({ sessionConsoleRuntime: prevRt }, { sessionConsoleRuntime: currRt }),
      ).toEqual([
        {
          type: 'SFX_FIRE',
          payload: { seq: 3, sfxId: 'snap', kind: null, synthType: null, src: null },
        },
      ]);
    });

    it('does not emit session console actions when only worldArmed changes', () => {
      const prevRt = runtime({ worldArmed: false });
      const currRt = runtime({ worldArmed: true });
      expect(
        detectChanges({ sessionConsoleRuntime: prevRt }, { sessionConsoleRuntime: currRt }),
      ).toEqual([]);
    });

    it('includes sessionConsoleRuntime chrome in FULL_SYNC and omits catalog imageSets', () => {
      const currRt = runtime({
        stageVisible: true,
        activeImage: plateImage,
        audio: playingAudio,
        stage: { title: 'Skeldra', subtitle: 'Session 3', showFrame: false },
        duckPercent: 40,
      });
      const changes = detectChanges(null, {
        sessionConsoleRuntime: currRt,
        tokens: [],
      });
      expect(changes).toHaveLength(1);
      expect(changes[0]?.type).toBe('FULL_SYNC');
      if (changes[0]?.type === 'FULL_SYNC') {
        expect(changes[0].payload.sessionConsoleRuntime).toEqual(currRt);
        expect(changes[0].payload.sessionConsoleRuntime?.stage.title).toBe('Skeldra');
        expect(changes[0].payload.sessionConsoleRuntime?.duckPercent).toBe(40);
        expect(changes[0].payload.sessionConsoleRuntime?.audio.volumeOffset).toBe(0);
        expect(changes[0].payload).not.toHaveProperty('sessionConsole');
        expect(changes[0].payload).not.toHaveProperty('campaign');
        expect(changes[0].payload).not.toHaveProperty('imageSets');
        expect(JSON.stringify(changes[0].payload.sessionConsoleRuntime)).not.toMatch(
          /cue|thumbnailSrc|imageSets/i,
        );
      }
    });
  });

  describe('applyAction', () => {
    it('applies STAGE_UPDATE on a consumer runtime without a catalog', () => {
      const stage = { title: 'Keep', subtitle: '', showFrame: true };
      const next = applyAction(runtime(), {
        type: 'STAGE_UPDATE',
        payload: { stageVisible: true, activeImage: plateImage, stage },
      });
      expect(next.stageVisible).toBe(true);
      expect(next.activeImage).toEqual(plateImage);
      expect(next.stage).toEqual(stage);
      expect(next.audio.status).toBe('stopped');
    });

    it('merges AUDIO_UPDATE and SFX_FIRE into runtime without catalog reducers', () => {
      const afterAudio = applyAction(runtime(), {
        type: 'AUDIO_UPDATE',
        payload: { audio: playingAudio, volume: 12, ducked: true, duckPercent: 40 },
      });
      expect(afterAudio.audio).toEqual(playingAudio);
      expect(afterAudio.volume).toBe(12);
      expect(afterAudio.ducked).toBe(true);
      expect(afterAudio.duckPercent).toBe(40);

      const afterSfx = applyAction(afterAudio, {
        type: 'SFX_FIRE',
        payload: { seq: 4, sfxId: 'ping', kind: 'synth', synthType: 'ping', src: null },
      });
      expect(afterSfx.sfxSeq).toBe(4);
      expect(afterSfx.sfxId).toBe('ping');
      expect(afterSfx.sfxKind).toBe('synth');
      expect(afterSfx.sfxSynthType).toBe('ping');
      expect(afterSfx.audio.status).toBe('playing');
    });

    it('applies FULL_SYNC runtime while preserving consumer worldArmed', () => {
      const incoming = runtime({ stageVisible: true, activeImage: plateImage, worldArmed: false });
      const next = applyAction(runtime({ worldArmed: true }), {
        type: 'FULL_SYNC',
        payload: { sessionConsoleRuntime: incoming },
      });
      expect(next.stageVisible).toBe(true);
      expect(next.activeImage).toEqual(plateImage);
      expect(next.worldArmed).toBe(true);
    });
  });

  describe('clone and slice helpers', () => {
    it('clones sessionConsoleRuntime from game and payload without catalog', () => {
      const rt = runtime({ stageVisible: true, activeImage: plateImage });
      const fromGame = cloneSyncableStateFromGame({
        tokens: [],
        drawings: [],
        doors: [],
        stairs: [],
        gridSize: 50,
        gridType: 'LINES',
        gridColor: '#222',
        map: null,
        exploredRegions: [],
        isDaylightMode: false,
        activeMeasurement: null,
        broadcastMeasurement: false,
        campaign: { tokenLibrary: [] },
        sessionConsoleRuntime: rt,
      } as unknown as GameState);

      expect(fromGame.sessionConsoleRuntime).toEqual(rt);
      expect(fromGame.sessionConsoleRuntime).not.toBe(rt);
      expect(fromGame).not.toHaveProperty('sessionConsole');

      const fromPayload = cloneSyncableStateFromPayload(
        { sessionConsoleRuntime: rt },
        { gridColor: '#222' },
      );
      expect(fromPayload.sessionConsoleRuntime).toEqual(rt);
    });

    it('treats sessionConsoleRuntime as part of the Architect sync slice', () => {
      const shared = runtime();
      const campaign = { tokenLibrary: [] };
      const previous = { sessionConsoleRuntime: shared, campaign } as unknown as GameState;
      const unchanged = { sessionConsoleRuntime: shared, campaign } as unknown as GameState;
      const changed = {
        sessionConsoleRuntime: runtime({ volume: 10 }),
        campaign,
      } as unknown as GameState;
      expect(isSyncSliceUnchanged(unchanged, previous)).toBe(true);
      expect(isSyncSliceUnchanged(changed, previous)).toBe(false);
    });

    it('includes runtime in buildFullSyncPayload', () => {
      const rt = runtime({ ducked: true });
      const payload = buildFullSyncPayload({ sessionConsoleRuntime: rt });
      expect(payload.sessionConsoleRuntime).toEqual(rt);
    });
  });

  describe('SESSION_CONSOLE_WORLD_EVENT', () => {
    it('parses armed/unarmed/ready/error and rejects unknown payloads', () => {
      expect(parseSessionConsoleWorldEvent({ type: 'armed' })).toEqual({ type: 'armed' });
      expect(parseSessionConsoleWorldEvent({ type: 'unarmed' })).toEqual({ type: 'unarmed' });
      expect(parseSessionConsoleWorldEvent({ type: 'ready' })).toEqual({ type: 'ready' });
      expect(parseSessionConsoleWorldEvent({ type: 'error', message: 'fail' })).toEqual({
        type: 'error',
        message: 'fail',
      });
      expect(parseSessionConsoleWorldEvent({ type: 'TOKEN_UPDATE' })).toBeNull();
      expect(parseSessionConsoleWorldEvent(null)).toBeNull();
    });

    it('sanitizes file paths in World error messages via errorSanitizer', () => {
      const raw = 'Failed to load /Users/janedoe/Music/bed.mp3';
      const sanitized = sanitizeSessionConsoleErrorMessage(raw);
      expect(sanitized).not.toContain('janedoe');
      expect(sanitized).toContain('<USER>');
      expect(sanitizeStack(new Error(sanitized), 'janedoe').message).toContain('<USER>');
    });
  });

  describe('coalesceSyncActions', () => {
    it('returns an empty list when there are no actions', () => {
      expect(coalesceSyncActions([], {})).toEqual([]);
    });

    it('leaves a single action unwrapped', () => {
      const action = { type: 'TOKEN_REMOVE' as const, payload: { id: 't1' } };
      expect(coalesceSyncActions([action], {})).toEqual([action]);
    });

    it('batches a small set of actions', () => {
      const actions = [
        { type: 'TOKEN_REMOVE' as const, payload: { id: 't1' } },
        { type: 'TOKEN_REMOVE' as const, payload: { id: 't2' } },
      ];
      expect(coalesceSyncActions(actions, {})).toEqual([{ type: 'BATCH', payload: actions }]);
    });

    it('collapses a large set of actions into FULL_SYNC', () => {
      const actions = Array.from({ length: FULL_SYNC_ACTION_THRESHOLD }, (_, i) => ({
        type: 'TOKEN_REMOVE' as const,
        payload: { id: `t${i}` },
      }));
      const coalesced = coalesceSyncActions(actions, { tokens: [] });
      expect(coalesced).toHaveLength(1);
      expect(coalesced[0]?.type).toBe('FULL_SYNC');
    });
  });

  describe('detectWorldViewTokenUpdates', () => {
    it('returns no actions when previous state is null', () => {
      expect(detectWorldViewTokenUpdates(null, [{ id: 't1', x: 1, y: 2, src: 'a' }])).toEqual([]);
    });

    it('emits position-only TOKEN_UPDATE actions', () => {
      const prev = {
        tokens: [{ id: 't1', x: 0, y: 0, src: 'file://a.webp', type: 'PC' as const }],
      };
      const current = [
        { id: 't1', x: 10, y: 20, src: 'file://changed.webp', type: 'NPC' as const },
      ];
      expect(detectWorldViewTokenUpdates(prev as any, current)).toEqual([
        { type: 'TOKEN_UPDATE', payload: { id: 't1', changes: { x: 10, y: 20 } } },
      ]);
    });

    it('ignores newly added or removed tokens', () => {
      const prev = {
        tokens: [{ id: 't1', x: 0, y: 0, src: 'a' }],
      };
      const current = [{ id: 't2', x: 5, y: 5, src: 'b' }];
      expect(detectWorldViewTokenUpdates(prev as any, current)).toEqual([]);
    });
  });
});
