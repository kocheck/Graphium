import { createRef, Profiler } from 'react';

import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from '../store/uiStore';

import { ThemeManager } from './ThemeManager';
import Toolbar from './Toolbar';

import type { ProfilerOnRenderCallback } from 'react';

/**
 * Plan 005 regression guard: a tool change in uiStore must re-render the Toolbar exactly once
 * and must not re-render an unmemoised sibling. If someone reintroduces `tool` as a prop fed from
 * a parent's state, the sibling starts committing and this test fails.
 */
describe('Toolbar render count', () => {
  beforeEach(() => {
    useUiStore.setState({ tool: 'select' });
  });

  it('re-renders only the toolbar when the tool changes', () => {
    const commits: Record<string, number> = {};
    let counting = false;
    const onRender: ProfilerOnRenderCallback = (id, phase) => {
      // Count only `update`. Radix Tooltip adapters also fire `nested-update` on the same
      // commit; `phase !== 'mount'` would count those and fail toBe(1) with one useUiStore.
      if (counting && phase === 'update') {
        commits[id] = (commits[id] ?? 0) + 1;
      }
    };
    const noop = (): void => {};
    render(
      <>
        <Profiler id="ThemeManager" onRender={onRender}>
          <ThemeManager />
        </Profiler>
        <Profiler id="Toolbar" onRender={onRender}>
          <Toolbar
            colorInputRef={createRef<HTMLInputElement>()}
            broadcastMeasurement={false}
            setBroadcastMeasurement={noop}
            isGamePaused={false}
            onPauseToggle={noop}
          />
        </Profiler>
      </>,
    );
    expect(screen.getByLabelText('Select tool')).toHaveAttribute('aria-pressed', 'true');

    counting = true;
    act(() => {
      useUiStore.setState({ tool: 'marker' });
    });

    expect(commits['Toolbar']).toBe(1);
    expect(commits['ThemeManager'] ?? 0).toBe(0);
    expect(screen.getByLabelText('Marker tool')).toHaveAttribute('aria-pressed', 'true');
  });
});
