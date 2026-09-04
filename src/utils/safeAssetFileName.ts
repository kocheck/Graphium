/**
 * Rewrite an upload filename so Electron SAVE_ASSET_TEMP can store it.
 * Strips path segments and characters outside [A-Za-z0-9._-].
 */
export function rewriteSafeAssetFileName(name: string): string {
  const base = name.replace(/\\/g, '/').split('/').pop() ?? name;
  const lastDot = base.lastIndexOf('.');
  const ext =
    lastDot >= 0
      ? base
          .slice(lastDot)
          .toLowerCase()
          .replace(/[^a-z0-9.]/g, '')
      : '';
  const stem = (lastDot >= 0 ? base.slice(0, lastDot) : base)
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const safe = `${stem || 'asset'}${ext}`;
  if (safe === '.' || safe === '..') {
    return 'asset';
  }
  return safe;
}
