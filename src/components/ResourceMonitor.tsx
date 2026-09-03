import { useEffect, useState, useRef } from 'react';

import { useGameStore } from '../store/gameStore';
import { consumePerfSnapshot, estimatePayloadBytes } from '../utils/perfCounters';
import { loadStressFixture } from '../utils/stressFixture';

interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
  memory: PerformanceMemory;
}

interface PerformanceMetrics {
  fps: number;
  memory: {
    used: number;
    total: number;
    limit: number;
  } | null;
  tokenCount: number;
  drawingCount: number;
  ipcMessageCount: number;
  ipcBandwidth: number; // bytes/sec
  activeWorkers: number;
  renderTime: number; // ms
  lastUpdate: number;
  fowRecalcCount: number;
  canvasCommitMs: number;
  ipcActionsByType: Record<string, number>;
}

type IpcSendFn = (channel: string, ...args: unknown[]) => void;
type IpcListenerFn = (...args: unknown[]) => void;
type IpcOnFn = (channel: string, listener: IpcListenerFn) => IpcOnFn;

/**
 * ResourceMonitor - Real-time Performance Diagnostics Overlay
 *
 * **Purpose:** Help diagnose performance issues and validate optimizations.
 * Displays live metrics for CPU, memory, rendering, and network usage.
 *
 * **Metrics Tracked:**
 * - FPS (frames per second) - Target: 60fps
 * - Memory usage (heap size, % of limit)
 * - Token/Drawing counts (affects render complexity)
 * - IPC message rate (delta sync effectiveness)
 * - IPC bandwidth (bytes/sec, should be low with delta updates)
 * - Active Web Workers (detect leaks)
 * - Canvas render time (identifies bottlenecks)
 *
 * **Performance Impact:**
 * - Minimal: Uses requestAnimationFrame for FPS tracking
 * - Updates every 500ms (not every frame)
 * - Can be toggled off when not needed
 *
 * **Usage Scenarios:**
 * 1. **Validating Optimizations:** Check if delta IPC reduces bandwidth
 * 2. **Finding Bottlenecks:** See which operations spike render time
 * 3. **Memory Leak Detection:** Monitor memory growth over time
 * 4. **Worker Leak Detection:** Ensure workers terminate properly
 *
 * @example
 * // In App.tsx
 * const [showResourceMonitor, setShowResourceMonitor] = useState(false);
 *
 * {showResourceMonitor && <ResourceMonitor />}
 *
 * <button onClick={() => setShowResourceMonitor(!showResourceMonitor)}>
 *   Toggle Resource Monitor
 * </button>
 */
// eslint-disable-next-line max-lines-per-function, complexity
function ResourceMonitor(): React.JSX.Element {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    memory: null,
    tokenCount: 0,
    drawingCount: 0,
    ipcMessageCount: 0,
    ipcBandwidth: 0,
    activeWorkers: 0,
    renderTime: 0,
    lastUpdate: Date.now(),
    fowRecalcCount: 0,
    canvasCommitMs: 0,
    ipcActionsByType: {},
  });

  const [isExpanded, setIsExpanded] = useState(true);

  // FPS tracking
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(Date.now());
  const fpsUpdateIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // IPC tracking
  const ipcMessageCountRef = useRef(0);
  const ipcBytesRef = useRef(0);
  const lastIPCResetRef = useRef(Date.now());

  // Get store data
  const tokenCount = useGameStore((state) => state.tokens.length);
  const drawingCount = useGameStore((state) => state.drawings.length);

  /**
   * FPS Counter using requestAnimationFrame
   * Counts frames and calculates FPS every second
   */
  useEffect((): (() => void) => {
    let animationFrameId: number;

    const countFrame = (): void => {
      frameCountRef.current++;
      animationFrameId = requestAnimationFrame(countFrame);
    };

    animationFrameId = requestAnimationFrame(countFrame);

    // Calculate FPS every second
    fpsUpdateIntervalRef.current = setInterval((): void => {
      const now = Date.now();
      const elapsed = (now - lastFrameTimeRef.current) / 1000;
      const fps = Math.round(frameCountRef.current / elapsed);

      frameCountRef.current = 0;
      lastFrameTimeRef.current = now;

      setMetrics((prev) => ({ ...prev, fps }));
    }, 1000);

    return (): void => {
      cancelAnimationFrame(animationFrameId);
      if (fpsUpdateIntervalRef.current !== undefined) {
        clearInterval(fpsUpdateIntervalRef.current);
      }
    };
  }, []);

  /**
   * Memory, Token Count, and IPC Metrics
   * Updates every 500ms
   */
  useEffect((): (() => void) => {
    const updateMetrics = (): void => {
      // Memory API (Chrome/Edge only)
      let memory = null;
      const perf = performance as PerformanceWithMemory;
      if ('memory' in performance && perf.memory) {
        const mem = perf.memory;
        memory = {
          used: mem.usedJSHeapSize,
          total: mem.totalJSHeapSize,
          limit: mem.jsHeapSizeLimit,
        };
      }

      // Active worker count
      // NOTE: Using Performance API resource entries to infer active workers is unreliable,
      // as terminated workers still appear in the resource list. Until a dedicated worker
      // registry (e.g., in AssetProcessor) is wired into this component, we report 0 here
      // rather than a misleading approximate value.
      const activeWorkers = 0;

      // If a reliable source of truth for active workers becomes available, replace the
      // above with that data (e.g., from useGameStore or a dedicated tracking module).

      // Calculate IPC bandwidth
      const now = Date.now();
      const elapsedSec = (now - lastIPCResetRef.current) / 1000;
      const bandwidth = elapsedSec > 0 ? Math.round(ipcBytesRef.current / elapsedSec) : 0;

      setMetrics((prev) => ({
        ...prev,
        memory,
        tokenCount,
        drawingCount,
        ipcMessageCount: ipcMessageCountRef.current,
        ipcBandwidth: bandwidth,
        activeWorkers,
        lastUpdate: now,
        ...consumePerfSnapshot(),
      }));

      // Reset IPC counters every update
      ipcMessageCountRef.current = 0;
      ipcBytesRef.current = 0;
      lastIPCResetRef.current = now;
    };

    const interval = setInterval(updateMetrics, 500);
    updateMetrics(); // Initial update

    return (): void => clearInterval(interval);
  }, [tokenCount, drawingCount]);

  /**
   * IPC Message Interceptor
   * Tracks message count and bandwidth
   *
   * **Error Handling:** Wrapped in try-catch to prevent crashes if:
   * - IPC methods don't exist or are malformed
   * - JSON.stringify fails on circular references
   * - Method interception fails in strict mode
   *
   * **Cleanup Strategy:** When this component unmounts, wrapped listeners remain
   * in place for existing listeners, but tracking is disabled via the isTracking flag.
   * This prevents memory leaks while ensuring IPC continues to function normally.
   */
  useEffect((): (() => void) | undefined => {
    if (!window.ipcRenderer) {
      return;
    }

    // Guard: Check if IPC methods exist and are functions
    if (
      typeof window.ipcRenderer.send !== 'function' ||
      typeof window.ipcRenderer.on !== 'function'
    ) {
      if (import.meta.env.DEV) {
        console.warn('[ResourceMonitor] IPC methods not available, skipping interception');
      }
      return;
    }

    let originalSend: IpcSendFn | undefined;
    let originalOn: IpcOnFn | undefined;
    let isTracking = true;

    try {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      originalSend = window.ipcRenderer.send as IpcSendFn;
      // eslint-disable-next-line @typescript-eslint/unbound-method
      originalOn = window.ipcRenderer.on as IpcOnFn;

      // Intercept send (outgoing messages)
      window.ipcRenderer.send = function (channel: string, ...args: unknown[]): void {
        if (isTracking) {
          try {
            ipcMessageCountRef.current++;
            // Estimate message size (rough approximation, with circular ref protection)
            const size = estimatePayloadBytes(args);
            ipcBytesRef.current += size;
          } catch {
            // Ignore errors in metrics collection (don't break IPC)
            if (import.meta.env.DEV) {
              console.warn('[ResourceMonitor] Failed to track IPC send');
            }
          }
        }
        if (originalSend) {
          originalSend.call(this as unknown as typeof window.ipcRenderer, channel, ...args);
        }
      };

      // Intercept on (incoming messages)
      // ⚠️ CRITICAL LIMITATION: This IPC method interception creates wrapped listeners that
      // cannot be properly removed via `off()`, leading to MEMORY LEAKS. When a listener is
      // registered while ResourceMonitor is active, it gets wrapped, and the IPC system stores
      // the wrapped version. Subsequent attempts to remove the listener will fail because the
      // reference doesn't match. Additionally, after unmount, listeners registered during
      // monitoring will break or continue tracking metrics.
      //
      // This makes the current implementation UNSUITABLE FOR PRODUCTION USE in its current form.
      //
      // To fix this, implement a WeakMap to maintain original-to-wrapped listener mappings:
      // const listenerMap = new WeakMap<Function, Function>();
      // Then store the mapping and use it for proper cleanup in the `off()` interceptor.
      window.ipcRenderer.on = function (channel: string, listener: IpcListenerFn): IpcOnFn {
        const wrappedListener = (...args: unknown[]): void => {
          if (isTracking) {
            try {
              ipcMessageCountRef.current++;
              const size = estimatePayloadBytes(args);
              ipcBytesRef.current += size;
            } catch {
              // Ignore errors in metrics collection
              if (import.meta.env.DEV) {
                console.warn('[ResourceMonitor] Failed to track IPC receive');
              }
            }
          }
          listener(...args);
        };
        if (originalOn) {
          return originalOn.call(
            this as unknown as typeof window.ipcRenderer,
            channel,
            wrappedListener,
          );
        }
        return this as unknown as IpcOnFn;
      };
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[ResourceMonitor] Failed to intercept IPC methods:', err);
      }
      // Don't throw - just skip interception
      return;
    }

    return (): void => {
      // Disable tracking before restoring to prevent metrics updates during cleanup
      isTracking = false;

      // Restore original methods (cleanup)
      try {
        if (originalSend && window.ipcRenderer) {
          window.ipcRenderer.send = originalSend as typeof window.ipcRenderer.send;
        }
        if (originalOn && window.ipcRenderer) {
          window.ipcRenderer.on = originalOn as typeof window.ipcRenderer.on;
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('[ResourceMonitor] Failed to restore IPC methods:', err);
        }
      }
    };
  }, []);

  /**
   * Format bytes to human-readable string
   */
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) {
      return '0 B';
    }
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i)) + ' ' + sizes[i];
  };

  /**
   * Get FPS color (green = good, yellow = ok, red = bad)
   */
  const getFPSColor = (fps: number): string => {
    if (fps >= 55) {
      return '#4CAF50';
    } // Green
    if (fps >= 30) {
      return '#FFC107';
    } // Yellow
    return '#f44336'; // Red
  };

  /**
   * Get memory usage percentage
   */
  const getMemoryPercent = (): number => {
    if (!metrics.memory) {
      return 0;
    }
    return Math.round((metrics.memory.used / metrics.memory.limit) * 100);
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        color: '#fff',
        padding: '12px',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '12px',
        zIndex: 9999,
        minWidth: isExpanded ? '280px' : '120px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: isExpanded ? '10px' : '0',
          borderBottom: isExpanded ? '1px solid rgba(255,255,255,0.2)' : 'none',
          paddingBottom: isExpanded ? '8px' : '0',
        }}
      >
        <strong style={{ fontSize: '14px' }}>⚡ Performance</strong>
        <button
          onClick={(): void => setIsExpanded(!isExpanded)}
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '0 4px',
          }}
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {isExpanded && (
        <>
          {/* FPS */}
          <div style={{ marginBottom: '8px' }}>
            <strong style={{ color: getFPSColor(metrics.fps) }}>FPS: {metrics.fps}</strong>
            {metrics.fps < 55 && (
              <span style={{ color: '#FFC107', marginLeft: '8px', fontSize: '11px' }}>⚠️ Low</span>
            )}
          </div>

          {/* Memory */}
          {metrics.memory && (
            <div style={{ marginBottom: '8px' }}>
              <div>Memory: {formatBytes(metrics.memory.used)}</div>
              <div style={{ fontSize: '11px', color: '#aaa' }}>
                {getMemoryPercent()}% of {formatBytes(metrics.memory.limit)}
              </div>
              <div
                style={{
                  width: '100%',
                  height: '4px',
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  borderRadius: '2px',
                  marginTop: '4px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${getMemoryPercent()}%`,
                    height: '100%',
                    backgroundColor: getMemoryPercent() > 80 ? '#f44336' : '#4CAF50',
                    transition: 'width 0.3s',
                  }}
                />
              </div>
            </div>
          )}

          {/* Entity Counts */}
          <div style={{ marginBottom: '8px', fontSize: '11px' }}>
            <div>Tokens: {metrics.tokenCount}</div>
            <div>Drawings: {metrics.drawingCount}</div>
          </div>

          <div style={{ marginBottom: '8px', fontSize: '11px' }}>
            <div>FOW recals / 0.5s: {metrics.fowRecalcCount}</div>
            <div>Canvas commit: {metrics.canvasCommitMs.toFixed(1)} ms</div>
          </div>

          {/* IPC Metrics */}
          <div
            style={{
              marginBottom: '8px',
              fontSize: '11px',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              paddingTop: '8px',
            }}
          >
            <div>IPC Messages: {metrics.ipcMessageCount}/sec</div>
            <div>IPC Bandwidth: {formatBytes(metrics.ipcBandwidth)}/s</div>
            {Object.keys(metrics.ipcActionsByType).length > 0 && (
              <div style={{ color: '#aaa', marginTop: '4px' }}>
                {Object.entries(metrics.ipcActionsByType)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6)
                  .map(([type, count]) => (
                    <div key={type}>
                      {type}: {count}
                    </div>
                  ))}
              </div>
            )}
            {metrics.ipcBandwidth > 100000 && (
              <div style={{ color: '#FFC107', fontSize: '10px', marginTop: '2px' }}>
                ⚠️ High bandwidth (check delta sync)
              </div>
            )}
          </div>

          {/* Web Workers */}
          <div style={{ marginBottom: '8px', fontSize: '11px' }}>
            <div>Active Workers: {metrics.activeWorkers}</div>
            {metrics.activeWorkers > 2 && (
              <div style={{ color: '#f44336', fontSize: '10px', marginTop: '2px' }}>
                ⚠️ Possible worker leak
              </div>
            )}
          </div>

          {/* Performance Tips */}
          {(metrics.fps < 30 || getMemoryPercent() > 80 || metrics.ipcBandwidth > 100000) && (
            <div
              style={{
                marginTop: '8px',
                padding: '6px',
                backgroundColor: 'rgba(255, 193, 7, 0.2)',
                borderRadius: '4px',
                fontSize: '10px',
                borderLeft: '2px solid #FFC107',
              }}
            >
              <strong>⚠️ Performance Issues Detected:</strong>
              <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
                {metrics.fps < 30 && <li>Low FPS - Check FOW complexity</li>}
                {getMemoryPercent() > 80 && <li>High memory - Reduce tokens/drawings</li>}
                {metrics.ipcBandwidth > 100000 && <li>High IPC - Delta sync may not be working</li>}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={(): void => loadStressFixture()}
            style={{
              width: '100%',
              marginTop: '8px',
              padding: '6px 8px',
              background: 'rgba(255,255,255,0.08)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            Load stress fixture (200 tokens)
          </button>

          {/* Last Update */}
          <div
            style={{
              marginTop: '8px',
              fontSize: '10px',
              color: '#666',
              textAlign: 'right',
            }}
          >
            Updated: {new Date(metrics.lastUpdate).toLocaleTimeString()}
          </div>
        </>
      )}
    </div>
  );
}

export default ResourceMonitor;
