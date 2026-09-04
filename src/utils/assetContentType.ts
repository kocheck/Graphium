export const AUDIO_CONTENT_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
};

const IMAGE_CONTENT_TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

export function fileExtension(filePath: string): string {
  const base = filePath.replace(/\\/g, '/').split('/').pop() ?? filePath;
  const lastDot = base.lastIndexOf('.');
  return lastDot >= 0 ? base.slice(lastDot).toLowerCase() : '';
}

/**
 * Audio MIME for `media://` local files. Unknown extensions return undefined
 * so Electron can fall through to its default handler.
 */
export function contentTypeForMediaPath(filePath: string): string | undefined {
  return AUDIO_CONTENT_TYPES[fileExtension(filePath)];
}

/**
 * MIME type for a temp asset blob. Audio matches Electron's media map;
 * images stay webp/png/jpeg (default webp).
 */
export function contentTypeForAssetFileName(fileName: string): string {
  const ext = fileExtension(fileName);
  return AUDIO_CONTENT_TYPES[ext] ?? IMAGE_CONTENT_TYPES[ext] ?? 'image/webp';
}

const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries({ ...AUDIO_CONTENT_TYPES, ...IMAGE_CONTENT_TYPES }).map(([ext, type]) => [
      type,
      ext,
    ]),
  ),
  'image/jpeg': '.jpg',
};

export function extensionForContentType(contentType: string): string {
  const normalized = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  return CONTENT_TYPE_EXTENSIONS[normalized] ?? '';
}
