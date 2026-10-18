import { useSessionConsoleEscapeStop } from './useSessionConsoleHotkeys';

export function SessionConsoleEscapeStop({ defer = false }: { defer?: boolean }): null {
  useSessionConsoleEscapeStop(defer);
  return null;
}
