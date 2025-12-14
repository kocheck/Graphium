import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import PrivacyErrorBoundary from './components/PrivacyErrorBoundary.tsx'
import PendingErrorsIndicator from './components/PendingErrorsIndicator.tsx'
import { initGlobalErrorHandlers } from './utils/globalErrorHandler.ts'
import './index.css'

// Initialize global error handlers for non-React errors
// This catches window.onerror and unhandled promise rejections
initGlobalErrorHandlers()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PrivacyErrorBoundary supportEmail="support@hyle.app">
      <App />
      <PendingErrorsIndicator supportEmail="support@hyle.app" position="bottom-right" />
    </PrivacyErrorBoundary>
  </React.StrictMode>,
)

// Use contextBridge
window.ipcRenderer.on('main-process-message', (_event, message) => {
  console.log(message)
})
