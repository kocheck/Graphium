import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  contentTypeForMediaPath,
  productionRendererUrl,
  resolveGraphiumRendererPath,
  withYouTubeReferer,
} from '../../electron/graphiumProtocol';

const RENDERER_DIST = path.resolve('/tmp/graphium-renderer-dist');

describe('resolveGraphiumRendererPath', () => {
  it('maps graphium://app/index.html onto RENDERER_DIST', () => {
    const result = resolveGraphiumRendererPath('graphium://app/index.html', RENDERER_DIST);
    expect(result).toEqual({
      ok: true,
      filePath: path.join(RENDERER_DIST, 'index.html'),
    });
  });

  it('serves index.html for the app root', () => {
    const result = resolveGraphiumRendererPath('graphium://app/', RENDERER_DIST);
    expect(result).toEqual({
      ok: true,
      filePath: path.join(RENDERER_DIST, 'index.html'),
    });
  });

  it('maps nested assets and ignores the query string', () => {
    const result = resolveGraphiumRendererPath(
      'graphium://app/assets/index-abc.js?type=world',
      RENDERER_DIST,
    );
    expect(result).toEqual({
      ok: true,
      filePath: path.join(RENDERER_DIST, 'assets', 'index-abc.js'),
    });
  });

  it('does not treat URL pathnames as absolute filesystem paths', () => {
    const result = resolveGraphiumRendererPath('graphium://app/etc/passwd', RENDERER_DIST);
    expect(result).toEqual({
      ok: true,
      filePath: path.join(RENDERER_DIST, 'etc', 'passwd'),
    });
  });

  it('rejects path traversal that would leave RENDERER_DIST', () => {
    const result = resolveGraphiumRendererPath('graphium://app/../../etc/passwd', RENDERER_DIST);
    expect(result).toEqual({ ok: false, status: 403 });
  });

  it('rejects percent-encoded traversal', () => {
    const result = resolveGraphiumRendererPath(
      'graphium://app/%2e%2e/%2e%2e/etc/passwd',
      RENDERER_DIST,
    );
    expect(result).toEqual({ ok: false, status: 403 });
  });

  it('rejects a host other than app', () => {
    const result = resolveGraphiumRendererPath('graphium://evil/index.html', RENDERER_DIST);
    expect(result).toEqual({ ok: false, status: 403 });
  });

  it('rejects non-graphium URLs', () => {
    const result = resolveGraphiumRendererPath('file:///tmp/index.html', RENDERER_DIST);
    expect(result).toEqual({ ok: false, status: 400 });
  });
});

describe('productionRendererUrl', () => {
  it('loads Architect from graphium://app/index.html', () => {
    expect(productionRendererUrl()).toBe('graphium://app/index.html');
  });

  it('loads World View with the type query', () => {
    expect(productionRendererUrl('type=world')).toBe('graphium://app/index.html?type=world');
  });
});

describe('contentTypeForMediaPath', () => {
  it('maps audio extensions used by session console local files', () => {
    expect(contentTypeForMediaPath('/tmp/bed.mp3')).toBe('audio/mpeg');
    expect(contentTypeForMediaPath('/tmp/bed.ogg')).toBe('audio/ogg');
    expect(contentTypeForMediaPath('/tmp/bed.wav')).toBe('audio/wav');
    expect(contentTypeForMediaPath('/tmp/bed.m4a')).toBe('audio/mp4');
  });

  it('returns undefined for unknown extensions', () => {
    expect(contentTypeForMediaPath('/tmp/token.webp')).toBeUndefined();
  });
});

describe('withYouTubeReferer', () => {
  it('sets an HTTPS YouTube Referer so custom-scheme embeds can pass Error 153', () => {
    expect(withYouTubeReferer({ Origin: 'graphium://app' })).toEqual({
      Origin: 'graphium://app',
      Referer: 'https://www.youtube.com/',
    });
  });
});
