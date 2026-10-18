// Regenerates macos/Tests/GraphiumCoreTests/TSFixtures.swift: .graphium ZIPs written by
// the Electron app's own serializer, so the Swift importer is tested against the real
// writer rather than hand-built fixtures (issue #324).
//
//   npm ci --prefix archive/web   # for jszip, from the repo root
//   node --experimental-strip-types macos/Tests/make-ts-fixture.mts
//
// main.ts imports electron, so the three small functions behind writeCampaignZip
// (processAssetForZip, serializeCampaignToZip, writeCampaignZip) are copied below
// verbatim; everything they call is imported from the app's TypeScript sources.
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { allocateUniqueZipBasename, isRealPathInsideAllowedRoots } from '../../archive/web/electron/pathSecurity.ts';
import { rewriteCampaignAssetSrcs } from '../../archive/web/src/utils/campaignAssets.ts';

const require = createRequire(import.meta.url);
const JSZip = require(process.env.JSZIP_PATH ?? '../../archive/web/node_modules/jszip');
type JSZip = any;
type SerializableCampaign = any;

// --- Copied from archive/web/electron/main.ts ------------------------------------

async function processAssetForZip(
  src: string,
  allowedAssetRoots: string[],
  processedAssets: Map<string, string>,
  usedBasenames: Set<string>,
  assetsFolder: JSZip | null,
): Promise<string> {
  if (!src.startsWith('file://')) {
    return src;
  }
  const absolutePath = fileURLToPath(src);
  const resolvedAssetPath = path.resolve(absolutePath);

  let realAssetPath: string;
  try {
    realAssetPath = await fs.realpath(resolvedAssetPath);
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    if (code === 'ENOENT') {
      throw new Error(`Campaign asset file not found: ${path.basename(resolvedAssetPath)}`);
    }
    throw error;
  }

  const isWithinAllowedRoots = await isRealPathInsideAllowedRoots(realAssetPath, allowedAssetRoots);
  if (!isWithinAllowedRoots) {
    throw new Error(
      `Campaign asset is outside allowed directories: ${path.basename(resolvedAssetPath)}`,
    );
  }

  const cached = processedAssets.get(realAssetPath);
  if (cached !== undefined) {
    return cached;
  }

  const zipBasename = allocateUniqueZipBasename(realAssetPath, usedBasenames);
  const content = await fs.readFile(realAssetPath);
  assetsFolder?.file(zipBasename, content);
  const relativePath = `assets/${zipBasename}`;
  processedAssets.set(realAssetPath, relativePath);
  return relativePath;
}

async function serializeCampaignToZip(
  campaign: SerializableCampaign,
  zip: JSZip,
  allowedAssetRoots: string[],
): Promise<SerializableCampaign> {
  const assetsFolder = zip.folder('assets');
  const campaignToSave = JSON.parse(JSON.stringify(campaign)) as SerializableCampaign;
  const processedAssets = new Map<string, string>();
  const usedBasenames = new Set<string>();

  const processAsset = async (src: string): Promise<string> =>
    processAssetForZip(src, allowedAssetRoots, processedAssets, usedBasenames, assetsFolder);

  await rewriteCampaignAssetSrcs(campaignToSave, processAsset, { includeThumbnails: true });
  return campaignToSave;
}

// writeCampaignZip, returning the bytes instead of writing them; `indent` adds the
// web export's JSON.stringify(…, null, 2) whitespace.
async function campaignZip(
  campaign: SerializableCampaign,
  allowedAssetRoots: string[],
  indent?: number,
): Promise<Buffer> {
  const zip = new JSZip();
  const campaignToSave = await serializeCampaignToZip(campaign, zip, allowedAssetRoots);
  zip.file('manifest.json', JSON.stringify(campaignToSave, null, indent));
  return zip.generateAsync({ type: 'nodebuffer' });
}

// --- Campaign ----------------------------------------------------------------------

const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'graphium-fixture-'));
const roots = ['temp_assets', 'sessions', 'library'].map((r) => path.join(userData, r));

async function file(relative: string, bytes: number[]): Promise<string> {
  const full = path.join(userData, relative);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, Buffer.from(bytes));
  return pathToFileURL(full).href;
}

const cave = await file('temp_assets/1700000000000-cave.png', [1, 1, 1]);
const otherCave = await file('sessions/1700000000001/assets/1700000000000-cave.png', [2, 2, 2, 2]);
const goblin = await file('library/assets/goblin-id.webp', [3, 3, 3, 3, 3]);
const goblinThumb = await file('library/assets/thumb-goblin-id.webp', [4]);
const gate = await file('temp_assets/1700000000002-gate.webp', [5, 5]);
const gateThumb = await file('temp_assets/1700000000003-gate-thumb.webp', [6]);
const rain = await file('temp_assets/1700000000004-rain.mp3', [7, 7, 7]);
const door = await file('temp_assets/1700000000005-door.wav', [8, 8]);

const pngDataURL = 'data:image/png;base64,iVBORw0KGgo=';
const svgDataURL = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=';

const emptyMap = {
  drawings: [],
  doors: [],
  stairs: [],
  gridSize: 50,
  gridType: 'LINES',
  gridColor: '#222',
  exploredRegions: [],
  isDaylightMode: false,
};

const builtInSfx = [
  { id: 'chime', label: 'Chime', kind: 'synth', synthType: 'chime' },
  { id: 'drone', label: 'Drone', kind: 'synth', synthType: 'drone' },
  { id: 'snap', label: 'Snap', kind: 'synth', synthType: 'snap' },
  { id: 'ping', label: 'Ping', kind: 'synth', synthType: 'ping' },
  { id: 'test-tone', label: 'Test Tone', kind: 'synth', synthType: 'test-tone' },
];

function campaign(extraSfx: object[] = []): SerializableCampaign {
  return {
    id: 'campaign-1',
    name: 'Fixture Campaign',
    // Not alphabetical: the importer must keep file order.
    maps: {
      'map-b': {
        ...emptyMap,
        id: 'map-b',
        name: 'Caves',
        map: { src: cave, x: 0, y: 0, width: 4096, height: 2304, scale: 0.5 },
        tokens: [
          { id: 't-goblin', x: 100, y: 150, src: goblin, libraryItemId: 'goblin-id' },
          { id: 't-dropped', x: 200, y: 150, src: pngDataURL, type: 'NPC', name: 'Dropped' },
          { id: 't-generic', x: 300, y: 150, src: svgDataURL, type: 'NPC', name: 'Generic Token' },
        ],
      },
      'map-a': {
        ...emptyMap,
        id: 'map-a',
        name: 'Second Cave',
        // Same basename as map-b's background, different file: becomes cave-2 in the ZIP.
        map: { src: otherCave, x: 0, y: 0, width: 100, height: 100, scale: 1 },
        tokens: [{ id: 't-goblin-2', x: 50, y: 50, src: goblin, libraryItemId: 'goblin-id', scale: 2 }],
      },
    },
    activeMapId: 'map-a',
    tokenLibrary: [
      {
        id: 'goblin-id',
        name: 'Goblin',
        src: goblin,
        thumbnailSrc: goblinThumb,
        category: 'Monsters',
        tags: ['goblin', 'small'],
        dateAdded: 1700000000000,
        defaultType: 'NPC',
      },
    ],
    sessionConsole: {
      version: 1,
      stage: { title: 'Fixture Campaign', subtitle: 'Act I', showFrame: true },
      defaults: { volume: 70, duckPercent: 35 },
      imageSets: [
        {
          id: 'set-1',
          title: 'Plates',
          note: '',
          images: [{ id: 'plate-gate', name: 'Gate', cue: 'arrival', src: gate, thumbnailSrc: gateThumb, alt: 'A gate' }],
        },
      ],
      trackGroups: [
        {
          id: 'group-1',
          title: 'Ambience',
          note: '',
          accent: 'bed',
          tracks: [
            { id: 'rain', title: 'Rain', cue: '', tag: 'bed', source: 'local', src: rain, volumeOffset: 0, loop: true },
            {
              id: 'tavern',
              title: 'Tavern',
              cue: '',
              tag: 'bed',
              source: 'youtube',
              youtubeId: 'dQw4w9WgXcQ',
              volumeOffset: -10,
              loop: false,
              recommendedImageId: 'plate-gate',
            },
          ],
        },
      ],
      sfx: [...builtInSfx, { id: 'door', label: 'Door', kind: 'local', src: door }, ...extraSfx],
    },
  };
}

const compact = await campaignZip(campaign(), roots);
const webStyle = await campaignZip(campaign(), roots, 2);
const unknownSynth = await campaignZip(
  campaign([{ id: 'thunder', label: 'Thunder', kind: 'synth', synthType: 'thunder' }]),
  roots,
);
await fs.rm(userData, { recursive: true, force: true });

const swift = `import Foundation

// Generated by macos/Tests/make-ts-fixture.mts with the Electron app's own ZIP writer
// (writeCampaignZip + rewriteCampaignAssetSrcs + allocateUniqueZipBasename, JSZip).
// Do not edit by hand.
//
// Campaign "Fixture Campaign": maps "map-b" (background cave.png, a library goblin token,
// a data:image/png token, a data:image/svg+xml Generic Token) then "map-a" (a different
// file also named cave.png, so cave-2.png; goblin token at scale 2), active "map-a";
// library item goblin-id with a thumbnail; one plate with a thumbnail; a local track
// and a YouTube track; the five built-in synth SFX plus a local "door" clip.
enum TSFixtures {
    /// Electron's compact manifest.json.
    static let campaign = Data(base64Encoded: "${compact.toString('base64')}")!

    /// The same campaign with JSON.stringify(…, null, 2) whitespace (web export).
    static let campaignWebWhitespace = Data(base64Encoded: "${webStyle.toString('base64')}")!

    /// The same campaign plus a synth SFX whose synthType ("thunder") Graphium doesn't know.
    static let campaignUnknownSynthType = Data(base64Encoded: "${unknownSynth.toString('base64')}")!
}
`;
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'GraphiumCoreTests', 'TSFixtures.swift');
await fs.writeFile(out, swift);
console.log(`wrote ${out}`);
