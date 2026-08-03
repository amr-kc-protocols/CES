import { lazy } from 'react'
import type { ReactNode } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import { Empty } from './components/ui'
import { useCan } from './lib/role'
import Layout from './components/Layout'
import Dashboard from './modules/dashboard/Dashboard'
import { QA_ENABLED, CE_ENABLED, FIELD_OBJECTIVES_ENABLED } from './config/features'

// Route components are code-split: each screen loads on demand, so the initial
// payload is just the shell + dashboard. Layout wraps <Outlet> in Suspense.
const CETracker = lazy(() => import('./modules/ce/CETracker'))
const AcademyList = lazy(() => import('./modules/academy/AcademyList'))
const CohortView = lazy(() => import('./modules/academy/CohortView'))
const FieldChecklistView = lazy(() => import('./modules/academy/FieldChecklistView'))
const ExitSurveyView = lazy(() => import('./modules/academy/ExitSurveyView'))
const FtoScheduleView = lazy(() => import('./modules/academy/FtoScheduleView'))
const DailyEvalView = lazy(() => import('./modules/academy/DailyEvalView'))
const SkillSheetView = lazy(() => import('./modules/academy/SkillSheetView'))
const ClassCheckoffView = lazy(() => import('./modules/academy/ClassCheckoffView'))
const AemtList = lazy(() => import('./modules/aemt/AemtList'))
const AemtCourseView = lazy(() => import('./modules/aemt/AemtCourseView'))
const HistoryView = lazy(() => import('./modules/history/HistoryView'))
const LearningView = lazy(() => import('./modules/learning/LearningView'))
const CourseViewer = lazy(() => import('./modules/learning/CourseViewer'))
const Settings = lazy(() => import('./modules/settings/Settings'))
const QAQueue = lazy(() => import('./modules/qa/QAQueue'))
const QAPeriodView = lazy(() => import('./modules/qa/QAPeriodView'))
const ChartReviewScreen = lazy(() => import('./modules/qa/ChartReviewScreen'))
const BotTab = lazy(() => import('./modules/qa/BotTab'))

/**
 * Route-level gate for the AEMT program.
 *
 * Hiding the nav tab is not access control — an FTO with a bookmark, a shared
 * link, or a browser that remembers the last URL lands straight on the records
 * otherwise. The screens inside also gate their own actions; this stops the
 * data being rendered at all.
 */
function AemtOnly({ children }: { children: ReactNode }) {
  const { manageAemt } = useCan()
  if (manageAemt) return <>{children}</>
  return (
    <div>
      <Empty icon="🔒" title="Not available on this account">
        The AEMT program holds Kansas certification records and cohort selection data. Ask the
        Clinical Educator if you need access.
      </Empty>
      <Link to="/" className="link-btn">
        ← Back to Home
      </Link>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        {CE_ENABLED && <Route path="ce" element={<CETracker />} />}
        {QA_ENABLED && (
          <>
            <Route path="qa" element={<QAQueue />} />
            <Route path="qa/:periodId" element={<QAPeriodView />} />
            <Route path="qa/:periodId/chart/:chartId" element={<ChartReviewScreen />} />
            <Route path="bot" element={<BotTab />} />
          </>
        )}
        <Route path="academy" element={<AcademyList />} />
        <Route path="academy/ftos" element={<FtoScheduleView />} />
        <Route path="academy/:cohortId" element={<CohortView />} />
        {FIELD_OBJECTIVES_ENABLED && (
          <Route path="academy/:cohortId/checklist/:traineeId" element={<FieldChecklistView />} />
        )}
        <Route path="academy/:cohortId/eval/:traineeId" element={<DailyEvalView />} />
        <Route path="academy/:cohortId/skills/:traineeId" element={<SkillSheetView />} />
        <Route path="academy/:cohortId/skills/:traineeId/:sheet" element={<SkillSheetView />} />
        <Route path="academy/:cohortId/checkoff/:sheet" element={<ClassCheckoffView />} />
        <Route path="academy/:cohortId/survey/:traineeId" element={<ExitSurveyView />} />
        <Route
          path="aemt"
          element={
            <AemtOnly>
              <AemtList />
            </AemtOnly>
          }
        />
        <Route
          path="aemt/:courseId"
          element={
            <AemtOnly>
              <AemtCourseView />
            </AemtOnly>
          }
        />
        <Route path="courses" element={<LearningView />} />
        <Route path="courses/view" element={<CourseViewer />} />
        <Route path="history" element={<HistoryView />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Dashboard />} />
      </Route>
    </Routes>
  )
}
