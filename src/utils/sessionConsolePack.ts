import { fileExtension } from './assetContentType';
import { runWithConcurrency } from './campaignAssets';
import {
  isAllowedAudioFileName,
  pushLocalAudioSizeWarning,
  shouldWarnLocalAudioSize,
} from './localAudioLimits';
import {
  clampVolumeOffset,
  emptySessionConsoleCatalog,
  isTrackAccent,
  isYouTubeHostname,
  parseYouTubeVideoId,
} from '../types/sessionConsole';

import type {
  SessionConsoleCatalog,
  SfxDefinition,
  StageImage,
  Track,
  TrackAccent,
  TrackGroup,
} from '../types/sessionConsole';

/* Public authoring API: consumed by Vitest, Electron ingest, and Settings import/export. */
/* eslint-disable import/no-unused-modules */

export const SESSION_CONSOLE_PACK_KIND = 'graphium.sessionConsolePack';
export const PACK_HTTP_MAX_BYTES = 25 * 1024 * 1024;

const FILE_NAME_WITH_EXT = /\.[a-zA-Z0-9]{2,5}$/;

function pathBasename(filePath: string): string {
  const base = filePath.replace(/\\/g, '/').split('/').pop();
  return base && base.length > 0 ? base : '';
}

function isNetworkFilePath(filePath: string): boolean {
  return /^(?:\\\\|\/\/)/.test(filePath);
}

function isAbsolutePath(filePath: string): boolean {
  return /^(?:[a-zA-Z]:[\\/]|\/|\\\\)/.test(filePath);
}

function fileUrlToPath(fileUrl: string): string {
  const url = new URL(fileUrl);
  if (url.protocol !== 'file:') {
    throw new TypeError('Invalid URL');
  }
  let pathname = decodeURIComponent(url.pathname);
  if (/^\/[a-zA-Z]:/.test(pathname)) {
    pathname = pathname.slice(1);
  }
  return pathname;
}

function normalizePath(input: string): string {
  const replaced = input.replace(/\\/g, '/');
  const driveMatch = replaced.match(/^([a-zA-Z]:)(\/.*)?$/);
  const isAbs = replaced.startsWith('/') || Boolean(driveMatch);
  const body = driveMatch ? (driveMatch[2] ?? '/') : replaced;
  const segments: string[] = [];
  for (const part of body.split('/')) {
    if (part === '' || part === '.') {
      continue;
    }
    if (part === '..') {
      if (segments.length > 0) {
        segments.pop();
      } else if (!isAbs) {
        segments.push('..');
      }
    } else {
      segments.push(part);
    }
  }
  if (driveMatch?.[1]) {
    return `${driveMatch[1]}/${segments.join('/')}`;
  }
  if (replaced.startsWith('/')) {
    return `/${segments.join('/')}`;
  }
  return segments.join('/') || '.';
}

function pathRelative(from: string, to: string): string {
  const fromNorm = normalizePath(from);
  const toNorm = normalizePath(to);
  if (fromNorm === toNorm) {
    return '';
  }
  const fromParts = fromNorm.split('/').filter((part) => part !== '' && part !== '.');
  const toParts = toNorm.split('/').filter((part) => part !== '' && part !== '.');
  let shared = 0;
  while (
    shared < fromParts.length &&
    shared < toParts.length &&
    fromParts[shared] === toParts[shared]
  ) {
    shared += 1;
  }
  const ups = fromParts.slice(shared).map(() => '..');
  return [...ups, ...toParts.slice(shared)].join('/');
}

export type PackSrcClassification =
  | { kind: 'youtube'; youtubeId: string }
  | { kind: 'relative'; path: string }
  | { kind: 'absolute'; path: string }
  | { kind: 'http'; url: string }
  | { kind: 'invalid'; reason: string };

export interface SessionConsolePackImage {
  id: string;
  name: string;
  cue: string;
  src: string;
  alt: string;
}

export interface SessionConsolePackImageSet {
  id: string;
  title: string;
  note: string;
  images: SessionConsolePackImage[];
}

export interface SessionConsolePackTrack {
  id?: string;
  title: string;
  cue: string;
  tag: string;
  src: string;
  recommendedImage?: string;
  loop?: boolean;
  volumeOffset?: number;
}

export interface SessionConsolePackTrackGroup {
  id: string;
  title: string;
  note: string;
  accent: TrackAccent;
  tracks: SessionConsolePackTrack[];
}

export interface SessionConsolePackSfx {
  id: string;
  label: string;
  kind: 'synth' | 'local';
  synthType?: SfxDefinition['synthType'];
  src?: string;
}

export interface SessionConsolePack {
  version: 1;
  kind: typeof SESSION_CONSOLE_PACK_KIND;
  stage: {
    title: string;
    subtitle: string;
    showFrame: boolean;
  };
  defaults: {
    volume: number;
    duckPercent: number;
  };
  imageSets: SessionConsolePackImageSet[];
  trackGroups: SessionConsolePackTrackGroup[];
  sfx?: SessionConsolePackSfx[];
}

export const PACK_INGEST_CONCURRENCY = 8;

export type PackHttpFetchResult =
  | { status: 'ok'; buffer: ArrayBuffer }
  | { status: 'too-large' }
  | { status: 'failed' };

type PersistBuffer = (buffer: ArrayBuffer, fileName: string) => Promise<string | null>;
type FetchHttp = (url: string) => Promise<PackHttpFetchResult | ArrayBuffer | null>;
type PackFileResolveResult = string | null | { skip: string };
type ResolvePackFile = (relativeOrAbsolute: string) => Promise<PackFileResolveResult>;

export interface MaterializePackOptions {
  localFileSkipReason?: string;
}

export interface PackHttpResponse {
  ok: boolean;
  headers: { get: (name: string) => string | null };
  body?: ReadableStream<Uint8Array> | null;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

/**
 * Read a fetch Response up to `maxBytes`, aborting when Content-Length or the
 * streamed body exceeds the cap.
 */
export async function readResponseCapped(
  response: PackHttpResponse,
  maxBytes: number,
): Promise<PackHttpFetchResult> {
  if (!response.ok) {
    return { status: 'failed' };
  }
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { status: 'too-large' };
  }
  if (response.body) {
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { status: 'too-large' };
      }
      chunks.push(new Uint8Array(value));
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { status: 'ok', buffer: merged.buffer };
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > maxBytes) {
    return { status: 'too-large' };
  }
  return { status: 'ok', buffer };
}

/**
 * Fetch a remote pack asset with a hard byte cap.
 */
function isPrivateOrLocalIpv4(host: string): boolean {
  const parts = host.split('.').map((part) => Number(part));
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }
  const first = parts[0] ?? -1;
  const second = parts[1] ?? -1;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

/** Remote pack assets must be public https — no loopback, link-local, or private LAN. */
export function isSafePackHttpUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') {
    return false;
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host === 'metadata.google.internal' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.startsWith('fe80:') ||
    host.startsWith('fc') ||
    host.startsWith('fd')
  ) {
    return false;
  }
  if (isPrivateOrLocalIpv4(host)) {
    return false;
  }
  return true;
}

export async function fetchHttpCapped(
  url: string,
  maxBytes = PACK_HTTP_MAX_BYTES,
  fetchImpl: (input: string) => Promise<PackHttpResponse> = fetch,
): Promise<PackHttpFetchResult> {
  if (!isSafePackHttpUrl(url)) {
    return { status: 'failed' };
  }
  try {
    const response = await fetchImpl(url);
    return await readResponseCapped(response, maxBytes);
  } catch {
    return { status: 'failed' };
  }
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length });
  await runWithConcurrency(
    items.map((item, index) => async () => {
      results[index] = await mapper(item, index);
    }),
    limit,
  );
  return results;
}

function asFetchResult(value: PackHttpFetchResult | ArrayBuffer | null): PackHttpFetchResult {
  if (value === null) {
    return { status: 'failed' };
  }
  if (value instanceof ArrayBuffer || !('status' in (value as object))) {
    return { status: 'ok', buffer: value as ArrayBuffer };
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function emptyPack(title = ''): SessionConsolePack {
  const catalog = emptySessionConsoleCatalog(title);
  return {
    version: 1,
    kind: SESSION_CONSOLE_PACK_KIND,
    stage: catalog.stage,
    defaults: catalog.defaults,
    imageSets: [],
    trackGroups: [],
  };
}

function classifyFileUrl(trimmed: string): PackSrcClassification {
  try {
    const filePath = fileUrlToPath(trimmed);
    if (isNetworkFilePath(filePath)) {
      return { kind: 'invalid', reason: 'network path is not allowed' };
    }
    return { kind: 'absolute', path: filePath };
  } catch {
    return { kind: 'invalid', reason: 'invalid file URL' };
  }
}

function classifyHttpSrc(trimmed: string): PackSrcClassification {
  try {
    const url = new URL(trimmed);
    if (isYouTubeHostname(url.hostname)) {
      return { kind: 'invalid', reason: 'youtube URL is missing a video id' };
    }
  } catch {
    return { kind: 'invalid', reason: 'invalid http URL' };
  }
  if (!isSafePackHttpUrl(trimmed)) {
    return { kind: 'invalid', reason: 'remote file host is not allowed' };
  }
  return { kind: 'http', url: trimmed };
}

function classifyFileLikeSrc(trimmed: string): PackSrcClassification {
  if (isNetworkFilePath(trimmed)) {
    return { kind: 'invalid', reason: 'network path is not allowed' };
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) && !/^[a-zA-Z]:[\\/]/.test(trimmed)) {
    return { kind: 'invalid', reason: `unsupported scheme in "${trimmed}"` };
  }
  if (isAbsolutePath(trimmed)) {
    return { kind: 'absolute', path: trimmed };
  }
  const looksRelative =
    trimmed.startsWith('./') ||
    trimmed.startsWith('../') ||
    trimmed.includes('/') ||
    trimmed.includes('\\') ||
    FILE_NAME_WITH_EXT.test(trimmed);
  if (looksRelative) {
    return { kind: 'relative', path: trimmed };
  }
  return { kind: 'invalid', reason: `unrecognized src "${trimmed}"` };
}

/**
 * Classify a pack `src` string into youtube / relative / absolute / http / invalid.
 */
export function classifyPackSrc(src: string): PackSrcClassification {
  const trimmed = src.trim();
  if (!trimmed) {
    return { kind: 'invalid', reason: 'empty src' };
  }

  const youtubeId = parseYouTubeVideoId(trimmed);
  if (youtubeId) {
    return { kind: 'youtube', youtubeId };
  }
  if (/^file:/i.test(trimmed)) {
    return classifyFileUrl(trimmed);
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return classifyHttpSrc(trimmed);
  }
  return classifyFileLikeSrc(trimmed);
}

/**
 * True when `candidate` resolves inside `packRoot` (or is the root itself).
 */
export function isPathInsidePackRoot(packRoot: string, candidate: string): boolean {
  const root = normalizePath(packRoot);
  const target = normalizePath(candidate);
  const relativePath = pathRelative(root, target);
  return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolutePath(relativePath));
}

function parseImage(
  raw: unknown,
  setId: string,
  index: number,
  errors: string[],
): SessionConsolePackImage | null {
  if (!isRecord(raw)) {
    errors.push(`Image set "${setId}" image ${index} is not an object`);
    return null;
  }
  const id = asString(raw['id']);
  const src = asString(raw['src']).trim();
  if (!id || !src) {
    errors.push(`Image set "${setId}" image ${index} is missing id or src`);
    return null;
  }
  const classified = classifyPackSrc(src);
  if (classified.kind === 'invalid' || classified.kind === 'youtube') {
    errors.push(
      `Image "${id}": ${classified.kind === 'invalid' ? classified.reason : 'must be a file or http src'}`,
    );
    return null;
  }
  return {
    id,
    name: asString(raw['name'], id),
    cue: asString(raw['cue']),
    src,
    alt: asString(raw['alt']),
  };
}

function parseTrack(
  raw: unknown,
  groupId: string,
  index: number,
  errors: string[],
): SessionConsolePackTrack | null {
  if (!isRecord(raw)) {
    errors.push(`Track group "${groupId}" track ${index} is not an object`);
    return null;
  }
  const title = asString(raw['title']);
  const src = asString(raw['src']).trim();
  if (!title || !src) {
    errors.push(`Track group "${groupId}" track ${index} is missing title or src`);
    return null;
  }
  const classified = classifyPackSrc(src);
  if (classified.kind === 'invalid') {
    errors.push(`Track "${title}": ${classified.reason}`);
    return null;
  }
  const recommendedImage = asString(raw['recommendedImage']) || undefined;
  const id = asString(raw['id']) || undefined;
  return {
    ...(id ? { id } : {}),
    title,
    cue: asString(raw['cue']),
    tag: asString(raw['tag']),
    src,
    ...(recommendedImage ? { recommendedImage } : {}),
    loop: typeof raw['loop'] === 'boolean' ? raw['loop'] : true,
    volumeOffset: asNumber(raw['volumeOffset'], 0),
  };
}

function parseImageSet(
  raw: unknown,
  index: number,
  errors: string[],
): SessionConsolePackImageSet | null {
  if (!isRecord(raw)) {
    errors.push(`imageSets[${index}] is not an object`);
    return null;
  }
  const id = asString(raw['id']) || `image-set-${index + 1}`;
  const imagesRaw = raw['images'];
  const images: SessionConsolePackImage[] = [];
  if (Array.isArray(imagesRaw)) {
    imagesRaw.forEach((item, imageIndex) => {
      const parsed = parseImage(item, id, imageIndex, errors);
      if (parsed) {
        images.push(parsed);
      }
    });
  }
  return {
    id,
    title: asString(raw['title'], id),
    note: asString(raw['note']),
    images,
  };
}

function parseTrackGroup(
  raw: unknown,
  index: number,
  errors: string[],
): SessionConsolePackTrackGroup | null {
  if (!isRecord(raw)) {
    errors.push(`trackGroups[${index}] is not an object`);
    return null;
  }
  const id = asString(raw['id']) || `track-group-${index + 1}`;
  const accentRaw = asString(raw['accent'], 'bed');
  const accent: TrackAccent = isTrackAccent(accentRaw) ? accentRaw : 'bed';
  if (accentRaw && !isTrackAccent(accentRaw)) {
    errors.push(`Track group "${id}" has invalid accent "${accentRaw}"; using bed`);
  }
  const tracks: SessionConsolePackTrack[] = [];
  if (Array.isArray(raw['tracks'])) {
    raw['tracks'].forEach((item, trackIndex) => {
      const parsed = parseTrack(item, id, trackIndex, errors);
      if (parsed) {
        tracks.push(parsed);
      }
    });
  }
  return {
    id,
    title: asString(raw['title'], id),
    note: asString(raw['note']),
    accent,
    tracks,
  };
}

/**
 * Parse authoring JSON into a board pack, collecting per-row errors.
 */
export function parseSessionConsolePack(json: unknown): {
  pack: SessionConsolePack;
  errors: string[];
} {
  const errors: string[] = [];
  if (!isRecord(json)) {
    errors.push('Pack JSON must be an object');
    return { pack: emptyPack(), errors };
  }
  if (json['kind'] !== SESSION_CONSOLE_PACK_KIND) {
    errors.push(`Expected kind "${SESSION_CONSOLE_PACK_KIND}"`);
    return { pack: emptyPack(), errors };
  }
  if (json['version'] !== 1) {
    errors.push('Expected pack version 1');
    return { pack: emptyPack(), errors };
  }

  const stageRaw = isRecord(json['stage']) ? json['stage'] : {};
  const defaultsRaw = isRecord(json['defaults']) ? json['defaults'] : {};
  const imageSets: SessionConsolePackImageSet[] = [];
  if (Array.isArray(json['imageSets'])) {
    json['imageSets'].forEach((item, index) => {
      const parsed = parseImageSet(item, index, errors);
      if (parsed) {
        imageSets.push(parsed);
      }
    });
  }
  const trackGroups: SessionConsolePackTrackGroup[] = [];
  if (Array.isArray(json['trackGroups'])) {
    json['trackGroups'].forEach((item, index) => {
      const parsed = parseTrackGroup(item, index, errors);
      if (parsed) {
        trackGroups.push(parsed);
      }
    });
  }

  const pack: SessionConsolePack = {
    version: 1,
    kind: SESSION_CONSOLE_PACK_KIND,
    stage: {
      title: asString(stageRaw['title']),
      subtitle: asString(stageRaw['subtitle']),
      showFrame: typeof stageRaw['showFrame'] === 'boolean' ? stageRaw['showFrame'] : true,
    },
    defaults: {
      volume: asNumber(defaultsRaw['volume'], 45),
      duckPercent: asNumber(defaultsRaw['duckPercent'], 27),
    },
    imageSets,
    trackGroups,
  };

  if (Array.isArray(json['sfx'])) {
    pack.sfx = json['sfx'].flatMap((item, index) => {
      if (!isRecord(item) || !asString(item['id'])) {
        errors.push(`sfx[${index}] is invalid`);
        return [];
      }
      const kind = item['kind'] === 'local' ? 'local' : 'synth';
      return [
        {
          id: asString(item['id']),
          label: asString(item['label'], asString(item['id'])),
          kind,
          ...(typeof item['synthType'] === 'string'
            ? { synthType: item['synthType'] as SfxDefinition['synthType'] }
            : {}),
          ...(typeof item['src'] === 'string' ? { src: item['src'] } : {}),
        },
      ];
    });
  }

  return { pack, errors };
}

function slugId(value: string, used: Set<string>): string {
  const base =
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'item';
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

function basenameFromSrc(src: string): string {
  try {
    if (/^https?:\/\//i.test(src)) {
      return pathBasename(new URL(src).pathname) || 'asset';
    }
  } catch {
    return 'asset';
  }
  return pathBasename(src) || 'asset';
}

interface IngestContext {
  resolveFile: ResolvePackFile;
  fetchHttp?: FetchHttp;
  persistBuffer?: PersistBuffer;
  skipped: string[];
  warnings: string[];
  localFileSkipReason?: string;
  srcCache: Map<string, Promise<string | null>>;
}

function pushUniquePackSrc(
  jobs: Array<{ src: string; label: string }>,
  seen: Set<string>,
  src: string,
  label: string,
): void {
  const key = src.trim();
  if (!key || seen.has(key)) {
    return;
  }
  if (classifyPackSrc(key).kind === 'youtube') {
    return;
  }
  seen.add(key);
  jobs.push({ src: key, label });
}

function collectPackSrcJobs(pack: SessionConsolePack): Array<{ src: string; label: string }> {
  const jobs: Array<{ src: string; label: string }> = [];
  const seen = new Set<string>();
  for (const set of pack.imageSets) {
    for (const image of set.images) {
      pushUniquePackSrc(jobs, seen, image.src, `Image "${image.id}"`);
    }
  }
  for (const group of pack.trackGroups) {
    for (const track of group.tracks) {
      pushUniquePackSrc(jobs, seen, track.src, `Track "${track.title}"`);
    }
  }
  for (const sfx of pack.sfx ?? []) {
    if (sfx.kind === 'local' && sfx.src) {
      pushUniquePackSrc(jobs, seen, sfx.src, `SFX "${sfx.id}"`);
    }
  }
  return jobs;
}

async function prefetchPackSrcs(pack: SessionConsolePack, ctx: IngestContext): Promise<void> {
  await mapWithConcurrency(collectPackSrcJobs(pack), PACK_INGEST_CONCURRENCY, (job) =>
    ingestSrc(job.src, job.label, ctx),
  );
}

async function ingestSrc(src: string, label: string, ctx: IngestContext): Promise<string | null> {
  const key = src.trim();
  const cached = ctx.srcCache.get(key);
  if (cached) {
    return cached;
  }
  const pending = ingestSrcUncached(src, label, ctx);
  ctx.srcCache.set(key, pending);
  return pending;
}

async function ingestSrcUncached(
  src: string,
  label: string,
  ctx: IngestContext,
): Promise<string | null> {
  const classified = classifyPackSrc(src);
  if (classified.kind === 'youtube' || classified.kind === 'invalid') {
    ctx.skipped.push(
      `${label}: ${classified.kind === 'invalid' ? classified.reason : 'unexpected youtube src'}`,
    );
    return null;
  }
  if (classified.kind === 'http') {
    return ingestHttpSrc(classified.url, label, ctx);
  }

  const ingested = await ctx.resolveFile(classified.path);
  if (ingested && typeof ingested === 'object') {
    ctx.skipped.push(`${label}: ${ingested.skip}`);
    return null;
  }
  if (!ingested) {
    ctx.skipped.push(ctx.localFileSkipReason ?? `${label}: missing or unsandboxed file`);
    return null;
  }
  return ingested;
}

async function ingestHttpSrc(
  url: string,
  label: string,
  ctx: IngestContext,
): Promise<string | null> {
  if (!ctx.fetchHttp) {
    ctx.skipped.push(`${label}: http src requires fetchHttp`);
    return null;
  }
  const fetched = asFetchResult(await ctx.fetchHttp(url));
  if (fetched.status === 'too-large') {
    ctx.skipped.push(`${label}: remote file is larger than 25MB`);
    return null;
  }
  if (fetched.status !== 'ok') {
    ctx.skipped.push(`${label}: failed to fetch remote file`);
    return null;
  }
  const buffer = fetched.buffer;
  if (buffer.byteLength > PACK_HTTP_MAX_BYTES) {
    ctx.skipped.push(`${label}: remote file is larger than 25MB`);
    return null;
  }
  if (isAllowedAudioFileName(basenameFromSrc(url)) && shouldWarnLocalAudioSize(buffer.byteLength)) {
    pushLocalAudioSizeWarning(ctx.warnings);
  }
  if (!ctx.persistBuffer) {
    ctx.skipped.push(`${label}: http src requires persistBuffer`);
    return null;
  }
  const ingested = await ctx.persistBuffer(buffer, basenameFromSrc(url));
  if (!ingested) {
    ctx.skipped.push(`${label}: failed to ingest remote file`);
    return null;
  }
  return ingested;
}

function unionSfx(seeded: SfxDefinition[], incoming: SfxDefinition[]): SfxDefinition[] {
  const incomingById = new Map(incoming.map((item) => [item.id, item]));
  const seededIds = new Set(seeded.map((item) => item.id));
  return [
    ...seeded.map((item) => incomingById.get(item.id) ?? item),
    ...incoming.filter((item) => !seededIds.has(item.id)),
  ];
}

function recommendedImageId(
  recommendedImage: string | undefined,
  imagesById: Map<string, string>,
  imagesByName: Map<string, string>,
): string | undefined {
  if (!recommendedImage) {
    return undefined;
  }
  return imagesById.get(recommendedImage) ?? imagesByName.get(recommendedImage.toLowerCase());
}

function buildTrack(
  packTrack: SessionConsolePackTrack,
  trackId: string,
  source: Track['source'],
  extra: { youtubeId?: string; src?: string },
  recommended?: string,
): Track {
  return {
    id: trackId,
    title: packTrack.title,
    cue: packTrack.cue,
    tag: packTrack.tag,
    source,
    ...extra,
    volumeOffset: clampVolumeOffset(packTrack.volumeOffset ?? 0),
    loop: packTrack.loop ?? true,
    ...(recommended ? { recommendedImageId: recommended } : {}),
  };
}

async function materializeImageSets(
  pack: SessionConsolePack,
  ctx: IngestContext,
  usedIds: Set<string>,
): Promise<SessionConsoleCatalog['imageSets']> {
  const imageSets: SessionConsoleCatalog['imageSets'] = [];
  for (const set of pack.imageSets) {
    const ingested = await mapWithConcurrency(
      set.images,
      PACK_INGEST_CONCURRENCY,
      async (image) => ({
        image,
        src: await ingestSrc(image.src, `Image "${image.id}"`, ctx),
      }),
    );
    const images: StageImage[] = [];
    for (const { image, src } of ingested) {
      if (!src) {
        continue;
      }
      const id = usedIds.has(image.id) ? slugId(image.id, usedIds) : image.id;
      usedIds.add(id);
      images.push({
        id,
        name: image.name,
        cue: image.cue,
        src,
        thumbnailSrc: src,
        alt: image.alt,
      });
    }
    imageSets.push({ id: set.id, title: set.title, note: set.note, images });
  }
  return imageSets;
}

async function materializeTrackGroups(
  pack: SessionConsolePack,
  ctx: IngestContext,
  usedIds: Set<string>,
  imagesById: Map<string, string>,
  imagesByName: Map<string, string>,
): Promise<TrackGroup[]> {
  const trackGroups: TrackGroup[] = [];
  for (const group of pack.trackGroups) {
    const prepared = await mapWithConcurrency(
      group.tracks,
      PACK_INGEST_CONCURRENCY,
      async (packTrack) => {
        const classified = classifyPackSrc(packTrack.src);
        if (classified.kind === 'youtube') {
          return { packTrack, classified, ingested: null as string | null };
        }
        const ingested = await ingestSrc(packTrack.src, `Track "${packTrack.title}"`, ctx);
        return { packTrack, classified, ingested };
      },
    );
    const tracks: Track[] = [];
    for (const { packTrack, classified, ingested } of prepared) {
      const trackId = slugId(packTrack.id ?? packTrack.title, usedIds);
      const recommended = recommendedImageId(packTrack.recommendedImage, imagesById, imagesByName);
      if (classified.kind === 'youtube') {
        tracks.push(
          buildTrack(
            packTrack,
            trackId,
            'youtube',
            { youtubeId: classified.youtubeId },
            recommended,
          ),
        );
        continue;
      }
      if (!ingested) {
        continue;
      }
      tracks.push(buildTrack(packTrack, trackId, 'local', { src: ingested }, recommended));
    }
    trackGroups.push({
      id: group.id,
      title: group.title,
      note: group.note,
      accent: group.accent,
      tracks,
    });
  }
  return trackGroups;
}

async function materializeSfx(
  packSfx: SessionConsolePackSfx[],
  ctx: IngestContext,
): Promise<SfxDefinition[]> {
  const prepared = await mapWithConcurrency(packSfx, PACK_INGEST_CONCURRENCY, async (sfx) => {
    if (sfx.kind === 'synth') {
      return {
        sfx,
        ingested: null as string | null,
        skip: null as string | null,
      };
    }
    if (!sfx.src) {
      return { sfx, ingested: null, skip: `SFX "${sfx.id}": local clip is missing src` };
    }
    return {
      sfx,
      ingested: await ingestSrc(sfx.src, `SFX "${sfx.id}"`, ctx),
      skip: null,
    };
  });
  const materialized: SfxDefinition[] = [];
  for (const { sfx, ingested, skip } of prepared) {
    if (skip) {
      ctx.skipped.push(skip);
      continue;
    }
    if (sfx.kind === 'synth') {
      materialized.push({
        id: sfx.id,
        label: sfx.label,
        kind: 'synth',
        ...(sfx.synthType ? { synthType: sfx.synthType } : {}),
      });
      continue;
    }
    if (!ingested) {
      continue;
    }
    materialized.push({ id: sfx.id, label: sfx.label, kind: 'local', src: ingested });
  }
  return materialized;
}

/**
 * Turn a parsed pack into a campaign catalog by ingesting local/http bytes.
 */
export async function materializePack(
  pack: SessionConsolePack,
  resolveFile: ResolvePackFile,
  fetchHttp?: FetchHttp,
  persistBuffer?: PersistBuffer,
  options?: MaterializePackOptions,
): Promise<{ catalog: SessionConsoleCatalog; skipped: string[]; warnings: string[] }> {
  const catalog = emptySessionConsoleCatalog(pack.stage.title);
  catalog.stage = { ...pack.stage };
  catalog.defaults = { ...pack.defaults };
  const skipped: string[] = [];
  const warnings: string[] = [];
  const usedIds = new Set<string>(catalog.sfx.map((item) => item.id));
  const ctx: IngestContext = {
    resolveFile,
    fetchHttp,
    persistBuffer,
    skipped,
    warnings,
    localFileSkipReason: options?.localFileSkipReason,
    srcCache: new Map(),
  };

  await prefetchPackSrcs(pack, ctx);

  catalog.imageSets = await materializeImageSets(pack, ctx, usedIds);

  const imagesById = new Map<string, string>();
  const imagesByName = new Map<string, string>();
  for (const set of catalog.imageSets) {
    for (const image of set.images) {
      imagesById.set(image.id, image.id);
      imagesByName.set(image.name.toLowerCase(), image.id);
    }
  }

  catalog.trackGroups = await materializeTrackGroups(pack, ctx, usedIds, imagesById, imagesByName);

  if (pack.sfx && pack.sfx.length > 0) {
    const materialized = await materializeSfx(pack.sfx, ctx);
    catalog.sfx = unionSfx(catalog.sfx, materialized);
  }

  return { catalog, skipped, warnings };
}

/**
 * Web ingest: YouTube + http(s) only. Relative/absolute files are skipped with a board-add reason.
 */
export async function ingestSessionConsolePackFromJson(
  json: unknown,
  persistBuffer: PersistBuffer,
  fetchHttp: FetchHttp = fetchHttpCapped,
): Promise<{ catalog: SessionConsoleCatalog; skipped: string[]; warnings: string[] }> {
  const { pack, errors } = parseSessionConsolePack(json);
  const materialized = await materializePack(
    pack,
    () => Promise.resolve(null),
    fetchHttp,
    persistBuffer,
    {
      localFileSkipReason:
        'Local files cannot be imported in the browser — add files on the board.',
    },
  );
  return {
    catalog: materialized.catalog,
    skipped: [...errors, ...materialized.skipped],
    warnings: materialized.warnings,
  };
}

function sanitizeExportId(id: string): string {
  const base = pathBasename(id);
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    return 'asset';
  }
  return cleaned;
}

function defaultPackExt(folder: 'images' | 'audio'): string {
  return folder === 'images' ? '.png' : '.mp3';
}

function exportAssetRelPath(folder: 'images' | 'audio', id: string, src: string): string {
  const ext = fileExtension(src) || defaultPackExt(folder);
  const safeExt = /^\.[a-zA-Z0-9]{1,5}$/.test(ext) ? ext : defaultPackExt(folder);
  return `./${folder}/${sanitizeExportId(id)}${safeExt}`;
}

/**
 * Serialize a catalog back to authoring pack JSON (relative file srcs + YouTube watch URLs).
 */
export function catalogToSessionConsolePack(catalog: SessionConsoleCatalog): SessionConsolePack {
  return {
    version: 1,
    kind: SESSION_CONSOLE_PACK_KIND,
    stage: { ...catalog.stage },
    defaults: { ...catalog.defaults },
    imageSets: catalog.imageSets.map((set) => ({
      id: set.id,
      title: set.title,
      note: set.note,
      images: set.images.map((image) => ({
        id: image.id,
        name: image.name,
        cue: image.cue,
        src: exportAssetRelPath('images', image.id, image.src),
        alt: image.alt,
      })),
    })),
    trackGroups: catalog.trackGroups.map((group) => ({
      id: group.id,
      title: group.title,
      note: group.note,
      accent: group.accent,
      tracks: group.tracks.map((track) => ({
        id: track.id,
        title: track.title,
        cue: track.cue,
        tag: track.tag,
        src:
          track.source === 'youtube' && track.youtubeId
            ? `https://www.youtube.com/watch?v=${track.youtubeId}`
            : exportAssetRelPath('audio', track.id, track.src ?? ''),
        ...(track.recommendedImageId ? { recommendedImage: track.recommendedImageId } : {}),
        loop: track.loop,
        volumeOffset: track.volumeOffset,
      })),
    })),
    sfx: catalog.sfx.map((item) => ({
      id: item.id,
      label: item.label,
      kind: item.kind,
      ...(item.synthType ? { synthType: item.synthType } : {}),
      ...(item.kind === 'local' && item.src
        ? { src: exportAssetRelPath('audio', item.id, item.src) }
        : {}),
    })),
  };
}
