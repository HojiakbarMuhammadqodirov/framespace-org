import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import TabBar from './components/TabBar.jsx'
import Landing from './screens/Landing.jsx'
import Capture from './screens/Capture.jsx'
import StylePicker from './screens/StylePicker.jsx'
import Rendering from './screens/Rendering.jsx'
import Result from './screens/Result.jsx'
import News from './screens/News.jsx'
import Archive from './screens/Archive.jsx'
import Contact from './screens/Contact.jsx'
import { getHealth, requestRender } from './lib/api.js'
import { saveProject } from './lib/storage.js'

// three.js is half the bundle and is only needed once you open the 3D view,
// so it loads on demand rather than on first paint.
const Panorama = lazy(() => import('./screens/Panorama.jsx'))

// One project at a time, held here. `flow` is the step of the scan the user is
// on; when it is null a tab screen is showing instead.
const EMPTY_PROJECT = {
  captures: {},
  style: '',
  budget: { limit: '', currency: 'USD' },
  notes: '',
}

export default function App() {
  const [tab, setTab] = useState('home')
  const [flow, setFlow] = useState(null) // capture | style | rendering | result | panorama
  const [project, setProject] = useState(EMPTY_PROJECT)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [health, setHealth] = useState(null)

  useEffect(() => {
    getHealth().then(setHealth)
  }, [])

  // Every screen change starts at the top — otherwise you land halfway down
  // the next screen after scrolling the previous one.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [tab, flow])

  const goTab = useCallback((next) => {
    setTab(next)
    setFlow(null)
    setError(null)
  }, [])

  const startCapture = useCallback(() => {
    setFlow('capture')
    setError(null)
  }, [])

  const setCapture = useCallback((angleId, capture) => {
    setProject((p) => ({ ...p, captures: { ...p.captures, [angleId]: capture } }))
  }, [])

  const clearCapture = useCallback((angleId) => {
    setProject((p) => {
      const captures = { ...p.captures }
      delete captures[angleId]
      return { ...p, captures }
    })
  }, [])

  const runRender = useCallback(async () => {
    setFlow('rendering')
    setError(null)
    try {
      const limit = Number(project.budget.limit) || 0
      const payload = await requestRender({
        captures: project.captures,
        style: project.style,
        budget: limit ? { limit, currency: project.budget.currency } : null,
        notes: project.notes,
      })
      setResult(payload)
      setFlow('result')

      try {
        saveProject({
          style: project.style,
          notes: project.notes,
          budget: payload.brief.budget,
          brief: payload.brief,
          renders: payload.renders,
        })
      } catch (storageErr) {
        // The design is on screen either way; only the Archive copy is lost.
        console.warn('Could not archive this project:', storageErr.message)
      }
    } catch (err) {
      setError(err.message)
      setFlow('style')
    }
  }, [project])

  const startOver = useCallback(() => {
    setProject(EMPTY_PROJECT)
    setResult(null)
    setError(null)
    setFlow('capture')
  }, [])

  const openArchived = useCallback((entry) => {
    setResult({ brief: entry.brief, renders: entry.renders, style: entry.style, archived: true })
    setFlow('result')
  }, [])

  let screen
  if (flow === 'capture') {
    screen = (
      <Capture
        captures={project.captures}
        onCapture={setCapture}
        onClear={clearCapture}
        onContinue={() => setFlow('style')}
        onExit={() => goTab('home')}
      />
    )
  } else if (flow === 'style') {
    screen = (
      <StylePicker
        project={project}
        error={error}
        onChange={(patch) => setProject((p) => ({ ...p, ...patch }))}
        onBack={() => setFlow('capture')}
        onSubmit={runRender}
      />
    )
  } else if (flow === 'rendering') {
    screen = <Rendering style={project.style} demoMode={health?.demoMode} />
  } else if (flow === 'result') {
    screen = (
      <Result
        result={result}
        onBack={() => (result?.archived ? goTab('archive') : setFlow('style'))}
        onOpen3D={() => setFlow('panorama')}
        onStartOver={startOver}
      />
    )
  } else if (flow === 'panorama') {
    screen = (
      <Suspense
        fallback={
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-ink">
            <div className="shimmer h-2 w-40 rounded-full" />
            <p className="text-[13px] text-muted">Loading the 3D view…</p>
          </div>
        }
      >
        <Panorama renders={result?.renders || []} onBack={() => setFlow('result')} />
      </Suspense>
    )
  } else if (tab === 'news') {
    screen = <News />
  } else if (tab === 'archive') {
    screen = <Archive onOpen={openArchived} onStartScan={startCapture} />
  } else if (tab === 'contact') {
    screen = <Contact />
  } else {
    screen = <Landing health={health} onStart={startCapture} onOpenNews={() => goTab('news')} />
  }

  return (
    <div className="min-h-full">
      {screen}
      <TabBar
        active={flow ? null : tab}
        onSelect={goTab}
        onCapture={startCapture}
        captureActive={Boolean(flow)}
      />
    </div>
  )
}
