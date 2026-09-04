import path from 'node:path';

import { isPathInsideOrEqual } from './pathSecurity.js';
import { AUDIO_CONTENT_TYPES, contentTypeForMediaPath } from '../src/utils/assetContentType.js';

const GRAPHIUM_SCHEME = 'graphium';
const GRAPHIUM_HOST = 'app';
const GRAPHIUM_INDEX_URL = `${GRAPHIUM_SCHEME}://${GRAPHIUM_HOST}/index.html`;

type GraphiumPathResolveResult = { ok: true; filePath: string } | { ok: false; status: 400 | 403 };

const RENDERER_CONTENT_TYPES: Record<string, string> = {
  ...AUDIO_CONTENT_TYPES,
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

/**
 * Production Architect/World load URL. Dev still uses VITE_DEV_SERVER_URL.
 */
export const productionRendererUrl = (search = ''): string => {
  const url = new URL(GRAPHIUM_INDEX_URL);
  if (search.length > 0) {
    url.search = search.startsWith('?') ? search.slice(1) : search;
  }
  return url.toString();
};

export { contentTypeForMediaPath };

export const contentTypeForRendererPath = (filePath: string): string | undefined =>
  RENDERER_CONTENT_TYPES[path.extname(filePath).toLowerCase()];

/**
 * Maps a relative URL path onto RENDERER_DIST. Rejects `..` segments, backslashes,
 * null bytes, and any resolve() result outside the dist root.
 */
const mapRendererRelativePath = (
  urlPathname: string,
  rendererDist: string,
): GraphiumPathResolveResult => {
  if (urlPathname.includes('\0') || urlPathname.includes('\\')) {
    return { ok: false, status: 400 };
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPathname);
  } catch {
    return { ok: false, status: 400 };
  }

  if (decoded.includes('\0') || decoded.includes('\\')) {
    return { ok: false, status: 400 };
  }

  const posixPath = decoded.startsWith('/') ? decoded : `/${decoded}`;
  const segments = posixPath.split('/').filter((segment) => segment.length > 0);
  if (segments.some((segment) => segment === '..' || segment === '.')) {
    return { ok: false, status: 403 };
  }

  const relativePath = segments.length === 0 ? 'index.html' : segments.join(path.sep);
  const candidate = path.resolve(rendererDist, relativePath);

  if (!isPathInsideOrEqual(rendererDist, candidate)) {
    return { ok: false, status: 403 };
  }

  return { ok: true, filePath: candidate };
};

/**
 * Resolves a `graphium://app/...` request to a file under RENDERER_DIST.
 * Does not read the filesystem; callers should realpath-sandbox like media://.
 */
export const resolveGraphiumRendererPath = (
  requestUrl: string,
  rendererDist: string,
): GraphiumPathResolveResult => {
  if (/\.\.|%2e%2e/i.test(requestUrl)) {
    return { ok: false, status: 403 };
  }

  let parsed: URL;
  try {
    parsed = new URL(requestUrl);
  } catch {
    return { ok: false, status: 400 };
  }

  if (parsed.protocol !== `${GRAPHIUM_SCHEME}:`) {
    return { ok: false, status: 400 };
  }

  if (parsed.hostname !== GRAPHIUM_HOST) {
    return { ok: false, status: 403 };
  }

  const pathname =
    parsed.pathname === '' || parsed.pathname === '/' ? '/index.html' : parsed.pathname;
  return mapRendererRelativePath(pathname, rendererDist);
};
