/** Converts a local `file:` URL to Graphium's privileged `media:` protocol. */
export function toMediaProtocol(src: string): string {
  return src.startsWith('file:') ? src.replace('file:', 'media:') : src;
}
