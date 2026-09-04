import { getStorage } from '../services/storage';

const ALLOWED_AUDIO_EXTENSIONS = new Set(['mp3', 'ogg', 'wav', 'm4a']);
const WARN_BYTES = 8 * 1024 * 1024;
const REJECT_BYTES = 25 * 1024 * 1024;

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

/**
 * Copy a local audio file into temp asset storage (no transcode / WebP).
 * Warns above 8MB and rejects above 25MB.
 */
export async function saveLocalAudioFile(file: File): Promise<string> {
  if (!isAllowedAudioFileName(file.name)) {
    throw new Error(
      `Unsupported audio file "${file.name}". Allowed extensions: mp3, ogg, wav, m4a.`,
    );
  }

  if (file.size > REJECT_BYTES) {
    throw new Error(`Audio file is larger than 25MB and cannot be added to the campaign.`);
  }

  if (file.size > WARN_BYTES) {
    console.warn(
      `Audio file "${file.name}" is larger than 8MB. Large local beds bloat the campaign zip.`,
    );
  }

  const buffer = await file.arrayBuffer();
  return getStorage().saveAssetTemp(buffer, file.name);
}
