import { Component, ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Error Boundary for Minimap Component
 *
 * Prevents minimap rendering errors from crashing the entire canvas.
 * If minimap fails, it simply doesn't render rather than breaking World View.
 *
 * **Why This Matters:**
 * - Canvas2D operations can fail (e.g., out of memory, invalid coordinates)
 * - Minimap is a nice-to-have feature, not critical for gameplay
 * - Should gracefully degrade rather than crash the whole view
 *
 * **Behavior:**
 * - Catches errors during minimap rendering
 * - Returns null (hides minimap) instead of showing error UI
 * - Logs error to console for debugging
 * - Rest of World View continues working normally
 *
 * @example
 * <MinimapErrorBoundary>
 *   <Minimap {...props} />
 * </MinimapErrorBoundary>
 */
class MinimapErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[MinimapErrorBoundary] Minimap rendering error:', error);
    console.error('[MinimapErrorBoundary] Error info:', errorInfo);
    console.warn('[MinimapErrorBoundary] Minimap has been hidden due to error. World View continues working.');
  }

  render() {
    if (this.state.hasError) {
      // Return null to hide the minimap without showing error UI
      // This is a graceful degradation - minimap is not critical
      return null;
    }

    return this.props.children;
  }
}

export default MinimapErrorBoundary;
