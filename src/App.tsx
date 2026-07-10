import { lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './modules/dashboard/Dashboard'
import { QA_ENABLED } from './config/features'

// Route components are code-split: each screen loads on demand, so the initial
// payload is just the shell + dashboard. Layout wraps <Outlet> in Suspense.
const CETracker = lazy(() => import('./modules/ce/CETracker'))
const AcademyList = lazy(() => import('./modules/academy/AcademyList'))
const CohortView = lazy(() => import('./modules/academy/CohortView'))
const FieldChecklistView = lazy(() => import('./modules/academy/FieldChecklistView'))
const Settings = lazy(() => import('./modules/settings/Settings'))
const QAQueue = lazy(() => import('./modules/qa/QAQueue'))
const QAPeriodView = lazy(() => import('./modules/qa/QAPeriodView'))
const ChartReviewScreen = lazy(() => import('./modules/qa/ChartReviewScreen'))
const BotTab = lazy(() => import('./modules/qa/BotTab'))

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="ce" element={<CETracker />} />
        {QA_ENABLED && (
          <>
            <Route path="qa" element={<QAQueue />} />
            <Route path="qa/:periodId" element={<QAPeriodView />} />
            <Route path="qa/:periodId/chart/:chartId" element={<ChartReviewScreen />} />
            <Route path="bot" element={<BotTab />} />
          </>
        )}
        <Route path="academy" element={<AcademyList />} />
        <Route path="academy/:cohortId" element={<CohortView />} />
        <Route path="academy/:cohortId/checklist/:traineeId" element={<FieldChecklistView />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Dashboard />} />
      </Route>
    </Routes>
  )
}
