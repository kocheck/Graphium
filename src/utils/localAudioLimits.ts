const ALLOWED_AUDIO_EXTENSIONS = new Set(['mp3', 'ogg', 'wav', 'm4a']);

const LOCAL_AUDIO_WARN_BYTES = 8 * 1024 * 1024;
export const LOCAL_AUDIO_REJECT_BYTES = 25 * 1024 * 1024;
export const LOCAL_AUDIO_SIZE_WARN_MESSAGE =
  'This audio file is larger than 8MB and will bloat the campaign zip.';

export function shouldWarnLocalAudioSize(byteLength: number): boolean {
  return byteLength > LOCAL_AUDIO_WARN_BYTES && byteLength <= LOCAL_AUDIO_REJECT_BYTES;
}

export function pushLocalAudioSizeWarning(warnings: string[]): void {
  if (!warnings.includes(LOCAL_AUDIO_SIZE_WARN_MESSAGE)) {
    warnings.push(LOCAL_AUDIO_SIZE_WARN_MESSAGE);
  }
}

/**
 * Returns true when the filename has an allowed local-audio extension.
 * Checks the extension only — not MIME type or contents.
 */
export function isAllowedAudioFileName(name: string): boolean {
  const lastDot = name.lastIndexOf('.');
  if (lastDot < 0 || lastDot === name.length - 1) {
    return false;
  }
  const ext = name.slice(lastDot + 1).toLowerCase();
  return ALLOWED_AUDIO_EXTENSIONS.has(ext);
}
