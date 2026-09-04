export type ImageAssetType = 'MAP' | 'TOKEN' | 'THUMB';

const MAX_MAP_DIMENSION = 4096;
const MAX_TOKEN_DIMENSION = 512;
const MAX_THUMB_DIMENSION = 256;

export function maxDimensionForType(type: ImageAssetType): number {
  if (type === 'MAP') {
    return MAX_MAP_DIMENSION;
  }
  if (type === 'THUMB') {
    return MAX_THUMB_DIMENSION;
  }
  return MAX_TOKEN_DIMENSION;
}
