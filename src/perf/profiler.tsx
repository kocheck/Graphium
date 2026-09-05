import { memo, Profiler } from 'react';
import type { ComponentProps, JSX, ProfilerOnRenderCallback, ReactNode } from 'react';

import CanvasManager from '../components/Canvas/CanvasManager';
import Sidebar from '../components/Sidebar';

interface ProfileEntry {
  id: string;
  phase: Parameters<ProfilerOnRenderCallback>[1];
  actualDuration: number;
  timestamp: number;
}

declare global {
  interface Window {
    __profile?: ProfileEntry[];
    __profileDump?: () => string;
  }
}

const onRender: ProfilerOnRenderCallback = (id, phase, actualDuration) => {
  window.__profile?.push({ id, phase, actualDuration, timestamp: performance.now() });
};

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__profile = [];
  window.__profileDump = (): string => JSON.stringify(window.__profile ?? []);
}

/**
 * Dev-only render counter for an UNMEMOISED child (plan 005). A Profiler commits whenever its
 * subtree renders, which for an unmemoised child equals the number of times the parent rendered
 * it. In production builds this is a plain fragment.
 */
export function ProfiledBoundary({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}): JSX.Element {
  if (!import.meta.env.DEV) {
    return <>{children}</>;
  }
  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  );
}

/**
 * Sidebar is `memo()` with no props. A plain ProfiledBoundary around it would still commit on
 * every App render (the boundary's own element changes), so this wrapper is memoised and
 * prop-less exactly like Sidebar: it bails out with Sidebar and commits only when Sidebar's own
 * store subscriptions update it.
 */
export const ProfiledSidebar = memo(function ProfiledSidebar(): JSX.Element {
  if (!import.meta.env.DEV) {
    return <Sidebar />;
  }
  return (
    <Profiler id="Sidebar" onRender={onRender}>
      <Sidebar />
    </Profiler>
  );
});

type CanvasManagerProps = ComponentProps<typeof CanvasManager>;

/** Same idea for CanvasManager: memoised with the same shallow prop comparison as the real one. */
export const ProfiledCanvasManager = memo(function ProfiledCanvasManager(
  props: CanvasManagerProps,
): JSX.Element {
  if (!import.meta.env.DEV) {
    return <CanvasManager {...props} />;
  }
  return (
    <Profiler id="CanvasManager" onRender={onRender}>
      <CanvasManager {...props} />
    </Profiler>
  );
});
