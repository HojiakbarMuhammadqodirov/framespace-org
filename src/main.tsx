import React from 'react'
import { createRoot } from 'react-dom/client'

// Order matters: legacy styles first, then the new token layer, so the
// redesign wins any overlap while the old screens keep their own classes.
import './index.css'
import './design/tokens.css'
import './design/base.css'
import './design/components.css'
import './design/luxury.css'

import './i18n/config'
import { installErrorReporter, reportError } from './lib/errorReporter'
import { initPrefs } from './store/prefs'
import { initSession } from './store/session'
import { Router } from './router'

// First, so errors during start-up are reported too.
installErrorReporter()
initPrefs()
initSession()

createRoot(document.getElementById('root')!, {
  // React 19 hands render errors to the root instead of window.onerror.
  onUncaughtError: (error, info) => {
    reportError(error, 'react', { source: info?.componentStack?.slice(0, 300) })
    console.error(error)
  },
  onCaughtError: (error, info) => {
    reportError(error, 'react', { source: info?.componentStack?.slice(0, 300) })
    console.error(error)
  },
}).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>
)
