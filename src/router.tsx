import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router'

import { Cursor } from '@/ui/Cursor'
import { ServerWakeNotice } from '@/ui/ServerWakeNotice'
import { PublicLayout } from '@/layouts/PublicLayout'
import { ImmersiveLayout } from '@/layouts/ImmersiveLayout'
import { Placeholder } from '@/pages/Placeholder'
import { ensureSections } from '@/i18n/config'
// The landing is the first paint for most visitors: it ships in the entry
// chunk instead of waiting on a second round trip. Its 3D scene and QR dialog
// stay lazy inside it.
import Landing from '@/pages/Landing'

/**
 * Load a route chunk and its feature translations together. Suspense already
 * covers the wait, so a screen never paints before its copy is in place — and
 * the entry bundle stays free of translations for screens nobody opened.
 */
function page<T>(load: () => Promise<T>, pick: (m: T) => React.ComponentType) {
  return lazy(() => Promise.all([load(), ensureSections()]).then(([m]) => ({ default: pick(m) })))
}

/* Every other route is its own chunk. The 3D-heavy ones especially must never
   land in the entry bundle. */
const Styleguide = lazy(() => import('@/pages/Styleguide'))
const LegacyApp = lazy(() => import('@/App.jsx'))
const NotFound = page(() => import('@/pages/NotFound'), (m) => m.NotFound)

const Gallery = page(() => import('@/pages/public/Gallery'), (m) => m.Gallery)
const StylesPage = page(() => import('@/pages/public/StylesPage'), (m) => m.StylesPage)
const About = page(() => import('@/pages/public/About'), (m) => m.About)
const Contact = page(() => import('@/pages/public/Contact'), (m) => m.Contact)
const HowItWorksPage = page(() => import('@/pages/public/Simple'), (m) => m.HowItWorksPage)
const PricingPage = page(() => import('@/pages/public/Simple'), (m) => m.PricingPage)
const FaqPage = page(() => import('@/pages/public/Simple'), (m) => m.FaqPage)
const ForBusinessPage = page(
  () => import('@/pages/public/ForBusinessPage'),
  (m) => m.ForBusinessPage
)

const Login = page(() => import('@/pages/auth/Login'), (m) => m.Login)
const Signup = page(() => import('@/pages/auth/Signup'), (m) => m.Signup)

const Dashboard = page(() => import('@/pages/app/Dashboard'), (m) => m.Dashboard)
const Saved = page(() => import('@/pages/app/Saved'), (m) => m.Saved)
const Settings = page(() => import('@/pages/app/Settings'), (m) => m.Settings)
const Capture = page(() => import('@/pages/app/Capture'), (m) => m.Capture)
const Result = page(() => import('@/pages/app/Result'), (m) => m.Result)
const Live = page(() => import('@/pages/app/Live'), (m) => m.Live)
const RoomBuilder = page(() => import('@/pages/app/RoomBuilder'), (m) => m.RoomBuilder)

const Catalog = page(() => import('@/pages/Catalog'), (m) => m.Catalog)
const CatalogItem = page(() => import('@/pages/CatalogItem'), (m) => m.CatalogItem)

const BizOverview = page(() => import('@/pages/business/Overview'), (m) => m.Overview)
const BizProducts = page(() => import('@/pages/business/Products'), (m) => m.Products)
const BizLeads = page(() => import('@/pages/business/Leads'), (m) => m.Leads)
const BizAnalytics = page(() => import('@/pages/business/Analytics'), (m) => m.Analytics)
const BizBranding = page(() => import('@/pages/business/Branding'), (m) => m.Branding)
const BizTeam = page(() => import('@/pages/business/Team'), (m) => m.Team)
const StorePage = page(() => import('@/pages/business/StorePage'), (m) => m.StorePage)

function Legacy() {
  return (
    <div className="legacy-root">
      <LegacyApp />
    </div>
  )
}

/** The old "new project" placeholder: every such CTA now starts in capture.
    The query (?style=, ?mode=, ?product=) carries over untouched. */
function NewProjectRedirect() {
  const { search } = useLocation()
  return <Navigate to={'/app/capture' + search} replace />
}

/* What is not built yet still resolves, naming the step of the rebuild that
   replaces it — so the site can be walked end to end without a dead link. */
const PLACEHOLDERS: Array<{ path: string; labelKey: string; titleKey: string; step: number }> = [
  { path: '/legal/terms', labelKey: 'placeholder.legal', titleKey: 'landing.footer.terms', step: 3 },
  { path: '/legal/privacy', labelKey: 'placeholder.legal', titleKey: 'landing.footer.privacy', step: 3 },
]

/**
 * No Suspense or transition wrapper out here: each layout suspends inside its
 * own <main>, so the header, dock and backdrop stay mounted while a route
 * chunk loads and never re-animate on navigation.
 */
function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />

        {/* public */}
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/styles" element={<StylesPage />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/for-business" element={<ForBusinessPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />

        {/* auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* user app */}
        <Route path="/app" element={<Dashboard />} />
        <Route path="/app/new" element={<NewProjectRedirect />} />
        <Route path="/app/saved" element={<Saved />} />
        <Route path="/app/settings" element={<Settings />} />
        {/* Capture keeps the header; PublicLayout drops the dock and footer. */}
        <Route path="/app/capture" element={<Capture />} />
        {/* Capture navigates to /app/result/:id; the brief's sitemap
            calls it /app/projects/:id. Both resolve to the same page. */}
        <Route path="/app/result/:id" element={<Result />} />
        <Route path="/app/projects/:id" element={<Result />} />

        {/* public catalog */}
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/catalog/:id" element={<CatalogItem />} />

        {/* business dashboard */}
        <Route path="/business" element={<BizOverview />} />
        <Route path="/business/products" element={<BizProducts />} />
        <Route path="/business/orders-leads" element={<BizLeads />} />
        <Route path="/business/leads" element={<Navigate to="/business/orders-leads" replace />} />
        <Route path="/business/analytics" element={<BizAnalytics />} />
        <Route path="/business/branding" element={<BizBranding />} />
        <Route path="/business/team" element={<BizTeam />} />

        {/* a store's branded public catalog */}
        <Route path="/store/:slug" element={<StorePage />} />

        {PLACEHOLDERS.map((p) => (
          <Route
            key={p.path}
            path={p.path}
            element={
              <Placeholder labelKey={p.labelKey} titleKey={p.titleKey} step={p.step} path={p.path} />
            }
          />
        ))}

        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Full-screen camera views: no header, dock, footer or backdrop. */}
      <Route element={<ImmersiveLayout />}>
        <Route path="/app/projects/:id/live" element={<Live />} />
        <Route path="/app/live/:id" element={<Live />} />
      </Route>

      {/* The builder keeps the header as its way home, nothing else. */}
      <Route element={<ImmersiveLayout compact />}>
        <Route path="/app/room/:id" element={<RoomBuilder />} />
      </Route>

      {/* Outside every shell. */}
      <Route
        path="/styleguide"
        element={
          <Suspense fallback={null}>
            <Styleguide />
          </Suspense>
        }
      />
      <Route
        path="/legacy"
        element={
          <Suspense fallback={null}>
            <Legacy />
          </Suspense>
        }
      />
      <Route path="/legacy/*" element={<Navigate to="/legacy" replace />} />
    </Routes>
  )
}

export function Router() {
  return (
    <BrowserRouter>
      <Cursor />
      <ServerWakeNotice />
      <AppRoutes />
    </BrowserRouter>
  )
}
