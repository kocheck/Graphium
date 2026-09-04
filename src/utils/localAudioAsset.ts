import {
  isAllowedAudioFileName,
  LOCAL_AUDIO_REJECT_BYTES,
  LOCAL_AUDIO_SIZE_WARN_MESSAGE,
  shouldWarnLocalAudioSize,
} from './localAudioLimits';
import { getStorage } from '../services/storage';

export {
  isAllowedAudioFileName,
  LOCAL_AUDIO_REJECT_BYTES,
  LOCAL_AUDIO_SIZE_WARN_MESSAGE,
  LOCAL_AUDIO_WARN_BYTES,
  shouldWarnLocalAudioSize,
} from './localAudioLimits';

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

  if (file.size > LOCAL_AUDIO_REJECT_BYTES) {
    throw new Error(`Audio file is larger than 25MB and cannot be added to the campaign.`);
  }

  if (shouldWarnLocalAudioSize(file.size)) {
    console.warn(LOCAL_AUDIO_SIZE_WARN_MESSAGE);
  }

  const buffer = await file.arrayBuffer();
  return getStorage().saveAssetTemp(buffer, file.name);
}
