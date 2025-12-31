import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import PrivacyErrorBoundary from './components/PrivacyErrorBoundary.tsx'
import PendingErrorsIndicator from './components/PendingErrorsIndicator.tsx'
import { initGlobalErrorHandlers } from './utils/globalErrorHandler.ts'
import { initStorage } from './services/storage.ts'
import './index.css'

// Initialize global error handlers for non-React errors
// This catches window.onerror and unhandled promise rejections
initGlobalErrorHandlers()

/**
 * Initialize app with async dependencies
 *
 * Storage service must be initialized before React renders,
 * as components may call getStorage() during mount.
 */
async function initApp() {
  try {
    // Initialize storage service (detects Electron vs Web)
    await initStorage()
  } catch (error) {
    console.error('[main] Failed to initialize storage:', error)

    // Show user-friendly error screen instead of rendering broken app
    const root = document.getElementById('root')
    if (root) {
      root.innerHTML = `
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          background-color: #0a0a0a;
          color: #ffffff;
          font-family: system-ui, -apple-system, sans-serif;
          padding: 2rem;
          text-align: center;
        ">
          <div style="max-width: 500px;">
            <h1 style="font-size: 2rem; margin-bottom: 1rem; color: #ef4444;">
              Failed to Initialize Storage
            </h1>
            <p style="font-size: 1rem; margin-bottom: 2rem; color: #a3a3a3; line-height: 1.5;">
              Graphium couldn't initialize its storage system. This may be due to:
            </p>
            <ul style="text-align: left; margin-bottom: 2rem; color: #a3a3a3; line-height: 1.8;">
              <li>Insufficient browser permissions (IndexedDB blocked)</li>
              <li>Private/Incognito mode restrictions</li>
              <li>Corrupted local data</li>
            </ul>
            <button
              onclick="window.location.reload()"
              style="
                background-color: #3b82f6;
                color: white;
                border: none;
                padding: 0.75rem 1.5rem;
                font-size: 1rem;
                border-radius: 0.375rem;
                cursor: pointer;
                margin-right: 0.5rem;
              "
              onmouseover="this.style.backgroundColor='#2563eb'"
              onmouseout="this.style.backgroundColor='#3b82f6'"
            >
              Retry
            </button>
            <button
              onclick="localStorage.clear(); indexedDB.deleteDatabase('graphium-storage'); window.location.reload()"
              style="
                background-color: transparent;
                color: #a3a3a3;
                border: 1px solid #525252;
                padding: 0.75rem 1.5rem;
                font-size: 1rem;
                border-radius: 0.375rem;
                cursor: pointer;
              "
              onmouseover="this.style.borderColor='#737373'"
              onmouseout="this.style.borderColor='#525252'"
            >
              Clear Data & Retry
            </button>
          </div>
        </div>
      `
    }
    return // Don't render React app if storage failed
  }

  // Render React app
  const rootElement = document.getElementById('root')
  if (!rootElement) {
    console.error('[main] Root element not found!')
    return
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <PrivacyErrorBoundary>
        <App />
        <PendingErrorsIndicator position="bottom-right" />
      </PrivacyErrorBoundary>
    </React.StrictMode>,
  )
}

// Start app initialization
initApp().catch((error) => {
  console.error('[main] Fatal error during app initialization:', error)
  // Show error on screen
  const root = document.getElementById('root')
  if (root) {
    root.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        background-color: #0a0a0a;
        color: #ffffff;
        font-family: system-ui, -apple-system, sans-serif;
        padding: 2rem;
        text-align: center;
      ">
        <h1 style="font-size: 2rem; margin-bottom: 1rem; color: #ef4444;">
          Fatal Error
        </h1>
        <pre style="background: #1a1a1a; padding: 1rem; border-radius: 0.5rem; overflow: auto; max-width: 800px; text-align: left;">
          ${error.toString()}
          ${error.stack || ''}
        </pre>
        <button
          onclick="window.location.reload()"
          style="
            background-color: #3b82f6;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            font-size: 1rem;
            border-radius: 0.375rem;
            cursor: pointer;
            margin-top: 1rem;
          "
        >
          Reload
        </button>
      </div>
    `
  }
})

// Use contextBridge (if available - not present in browser testing)
if (window.ipcRenderer) {
  window.ipcRenderer.on('main-process-message', (_event, message) => {
    console.log(message)
  })
}
