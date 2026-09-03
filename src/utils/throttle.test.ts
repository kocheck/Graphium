import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { throttle } from './throttle';

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('invokes immediately on the first call', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled('a');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('invokes the trailing call after the window', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled('a');
    throttled('b');
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('b');
  });

  it('cancel prevents the trailing call', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled('a');
    throttled('b');
    throttled.cancel();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
