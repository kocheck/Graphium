const ASSET_CONTENT_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

/**
 * MIME type for a temp asset blob, matching Electron's media map for audio
 * and keeping images as webp/png/jpeg (default webp, as WebStorageService did).
 */
export function contentTypeForAssetFileName(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  const ext = lastDot >= 0 ? fileName.slice(lastDot).toLowerCase() : '';
  return ASSET_CONTENT_TYPES[ext] ?? 'image/webp';
}
