/**
 * Leading-edge throttle with a trailing call so the last invocation still runs.
 */
export function throttle<Args extends unknown[]>(
  func: (...args: Args) => void,
  limit: number,
): ((...args: Args) => void) & { cancel: () => void } {
  let lastFunc: ReturnType<typeof setTimeout> | undefined;
  let lastRan: number | undefined;

  const throttled = (...args: Args): void => {
    if (lastRan === undefined) {
      func(...args);
      lastRan = Date.now();
      return;
    }

    if (lastFunc) {
      clearTimeout(lastFunc);
    }
    lastFunc = setTimeout(
      () => {
        if (Date.now() - (lastRan ?? 0) >= limit) {
          func(...args);
          lastRan = Date.now();
        }
      },
      limit - (Date.now() - (lastRan ?? 0)),
    );
  };

  throttled.cancel = (): void => {
    if (lastFunc) {
      clearTimeout(lastFunc);
      lastFunc = undefined;
    }
  };

  return throttled;
}
