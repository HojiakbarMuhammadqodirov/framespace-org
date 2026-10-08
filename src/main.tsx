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
import { initPrefs } from './store/prefs'
import { initSession } from './store/session'
import { Router } from './router'

initPrefs()
initSession()

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>
)
