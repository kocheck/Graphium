/**
 * Window interface extensions for debugging and testing utilities
 */

import type { useGameStore } from './store/gameStore';

export interface ErrorContext {
  componentName?: string;
  props?: Record<string, unknown>;
  state?: Record<string, unknown>;
  performance?: {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
    timing?: Record<string, number>;
  };
  breadcrumbs?: Array<{
    timestamp: number;
    action: string;
    data?: Record<string, unknown>;
  }>;
  importFailed?: boolean;
}

export interface ErrorInfo {
  tokenId?: string;
  overlayName?: string;
  error: string;
  timestamp: number;
  context?: ErrorContext;
}

declare global {
  interface Window {
    // Game store exposed for testing
    __GAME_STORE__?: typeof useGameStore;
    
    // Error boundary debugging
    __LAST_TOKEN_ERROR__?: ErrorInfo;
    __LAST_OVERLAY_ERROR__?: ErrorInfo;
    __LAST_ASSET_PROCESSING_ERROR__?: ErrorInfo;
    __ERROR_HISTORY__?: Array<ErrorInfo>;
    
    // Error boundary utilities
    __clearErrorHistory__?: () => void;
    __getErrorHistory__?: () => Array<ErrorInfo>;
    __simulateTokenError__?: (tokenId: string) => void;
    __simulateOverlayError__?: (overlayName: string) => void;
  }
}
