import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './modules/dashboard/Dashboard'
import CETracker from './modules/ce/CETracker'
import QAQueue from './modules/qa/QAQueue'
import QAPeriodView from './modules/qa/QAPeriodView'
import ChartReviewScreen from './modules/qa/ChartReviewScreen'
import AcademyList from './modules/academy/AcademyList'
import CohortView from './modules/academy/CohortView'
import BotTab from './modules/qa/BotTab'
import Settings from './modules/settings/Settings'
import { QA_ENABLED } from './config/features'

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
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Dashboard />} />
      </Route>
    </Routes>
  )
}
