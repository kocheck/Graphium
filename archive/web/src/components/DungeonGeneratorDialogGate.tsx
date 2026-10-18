import { lazy, Suspense } from 'react';
import type { JSX } from 'react';

import { useGameStore } from '../store/gameStore';

const DungeonGeneratorDialog = lazy(async () => {
  const module = await import('./DungeonGeneratorDialog');
  return { default: module.DungeonGeneratorDialog };
});

/**
 * Mounts the Dungeon Generator only while `gameStore.dungeonDialog` is true, so App itself never
 * subscribes to that flag and the dialog's chunk is fetched on first open (plan 005).
 */
export default function DungeonGeneratorDialogGate(): JSX.Element | null {
  const open = useGameStore((state) => state.dungeonDialog);
  if (!open) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <DungeonGeneratorDialog />
    </Suspense>
  );
}
