import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './modules/dashboard/Dashboard'
import CETracker from './modules/ce/CETracker'
import QAQueue from './modules/qa/QAQueue'
import QAPeriodView from './modules/qa/QAPeriodView'
import ChartReviewScreen from './modules/qa/ChartReviewScreen'
import Settings from './modules/settings/Settings'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="ce" element={<CETracker />} />
        <Route path="qa" element={<QAQueue />} />
        <Route path="qa/:periodId" element={<QAPeriodView />} />
        <Route path="qa/:periodId/chart/:chartId" element={<ChartReviewScreen />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Dashboard />} />
      </Route>
    </Routes>
  )
}
