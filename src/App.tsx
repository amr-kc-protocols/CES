import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import { Empty } from './components/ui'
import { useCan } from './lib/role'
import Layout from './components/Layout'
import Dashboard from './modules/dashboard/Dashboard'
import { QA_ENABLED, CE_ENABLED, FIELD_OBJECTIVES_ENABLED } from './config/features'
import { HAS_FTO_AGENDA } from './data/ftoAgenda'
import { HAS_FIELD_OBJECTIVES } from './data/ftObjectives'
import { HAS_EXIT_SURVEY } from './data/exitSurvey'

// Route components are code-split: each screen loads on demand, so the initial
// payload is just the shell + dashboard. Layout wraps <Outlet> in Suspense.
const CETracker = lazy(() => import('./modules/ce/CETracker'))
const AcademyList = lazy(() => import('./modules/academy/AcademyList'))
const CohortView = lazy(() => import('./modules/academy/CohortView'))
const FieldChecklistView = lazy(() => import('./modules/academy/FieldChecklistView'))
const FtoAgendaView = lazy(() => import('./modules/academy/FtoAgendaView'))
const ExitSurveyView = lazy(() => import('./modules/academy/ExitSurveyView'))
const FtoScheduleView = lazy(() => import('./modules/academy/FtoScheduleView'))
const DailyEvalView = lazy(() => import('./modules/academy/DailyEvalView'))
const SkillSheetView = lazy(() => import('./modules/academy/SkillSheetView'))
const ClassCheckoffView = lazy(() => import('./modules/academy/ClassCheckoffView'))
const ReviewView = lazy(() => import('./modules/review/ReviewView'))
const TemplatesView = lazy(() => import('./modules/templates/TemplatesView'))
const AemtList = lazy(() => import('./modules/aemt/AemtList'))
const AemtCourseView = lazy(() => import('./modules/aemt/AemtCourseView'))
const HistoryView = lazy(() => import('./modules/history/HistoryView'))
const LearningView = lazy(() => import('./modules/learning/LearningView'))
const CourseViewer = lazy(() => import('./modules/learning/CourseViewer'))
const EmsReference = lazy(() => import('./modules/reference/EmsReference'))
const IntakeForm = lazy(() => import('./modules/intake/IntakeForm'))
const IntakeResults = lazy(() => import('./modules/intake/IntakeResults'))
const ExamPage = lazy(() => import('./modules/exam/ExamPage'))
const ExamResults = lazy(() => import('./modules/exam/ExamResults'))
const BankReview = lazy(() => import('./modules/exam/BankReview'))
const SimulatorView = lazy(() => import('./modules/simulator/SimulatorView'))
const CqmpView = lazy(() => import('./modules/cqmp/CqmpView'))
const CqmpReportView = lazy(() => import('./modules/cqmp/CqmpReportView'))
const Settings = lazy(() => import('./modules/settings/Settings'))
const QAQueue = lazy(() => import('./modules/qa/QAQueue'))
const QAPeriodView = lazy(() => import('./modules/qa/QAPeriodView'))
const ChartReviewScreen = lazy(() => import('./modules/qa/ChartReviewScreen'))
const BotTab = lazy(() => import('./modules/qa/BotTab'))

/**
 * Route-level gate.
 *
 * Hiding the nav tab is not access control — an FTO with a bookmark, a shared
 * link, or a browser that remembers the last URL lands straight on the records
 * otherwise. The screens inside also gate their own actions; this stops the
 * data being rendered at all.
 */
function Gated({ allowed, why, children }: { allowed: boolean; why: string; children: ReactNode }) {
  if (allowed) return <>{children}</>
  return (
    <div>
      <Empty icon="🔒" title="Not available on this account">
        {why}
      </Empty>
      <Link to="/" className="link-btn">
        ← Back to Home
      </Link>
    </div>
  )
}

function AemtOnly({ children }: { children: ReactNode }) {
  const { manageAemt } = useCan()
  return (
    <Gated
      allowed={manageAemt}
      why="The AEMT program holds Kansas certification records and cohort selection data. Ask the Clinical Educator if you need access."
    >
      {children}
    </Gated>
  )
}

/**
 * Selection exam results and the bank behind them.
 *
 * Same administrator gate as the instruments, for its own reason: these rows
 * are job applicants' names, contact details and their own answers about what
 * they want from a career, and an applicant may be a current colleague of the
 * FTO who would otherwise read them.
 */
function HiringOnly({ children }: { children: ReactNode }) {
  const { manageAcademy } = useCan()
  return (
    <Gated
      allowed={manageAcademy}
      why="Selection exam results carry applicants' contact details and their own answers about what they want from a career. Administrators only."
    >
      {children}
    </Gated>
  )
}

/**
 * The patient simulator.
 *
 * Administrator-only for a different reason than the screens below: it holds no
 * records at all. It is the instructor's console — whoever has it open decides
 * what the crew's monitor shows mid-scenario, so it belongs to the person
 * running the session rather than to everyone in the room.
 */
function SimulatorOnly({ children }: { children: ReactNode }) {
  const { manageAcademy } = useCan()
  return (
    <Gated
      allowed={manageAcademy}
      why="The simulator drives what the patient monitor shows during a scenario. It is limited to the instructor running the session."
    >
      {children}
    </Gated>
  )
}

function AdminOnly({ children }: { children: ReactNode }) {
  const { manageAcademy } = useCan()
  return (
    <Gated
      allowed={manageAcademy}
      why="Editable instruments and the CQMP KPI review are limited to administrators — one is what every assessment is recorded against, the other is what clinical leadership is shown."
    >
      {children}
    </Gated>
  )
}

function ReviewOnly({ children }: { children: ReactNode }) {
  const { reviewCharts } = useCan()
  return (
    <Gated
      allowed={reviewCharts}
      why="Chart review handles patient care reports and is limited to clinical leadership. Ask the Clinical Educator if you need access."
    >
      {children}
    </Gated>
  )
}

export default function App() {
  return (
    <Routes>
      {/* Public, no-login candidate intake — rendered outside the app shell
          (its own Suspense; no tab bar). */}
      <Route
        path="/intake"
        element={
          <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
            <IntakeForm />
          </Suspense>
        }
      />
      <Route
        path="/exam"
        element={
          <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
            <ExamPage />
          </Suspense>
        }
      />
      {/* The new-hire selection exam for the Kansas City interfacility
          operation. Same page, same server functions, different program — the
          job briefing renders above the Start button and the clock does not
          begin until they press it. */}
      <Route
        path="/neop-exam"
        element={
          <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
            <ExamPage program="neop" />
          </Suspense>
        }
      />
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
        <Route
          path="academy/exam-results"
          element={
            <HiringOnly>
              <ExamResults program="neop" />
            </HiringOnly>
          }
        />
        <Route
          path="academy/exam-bank"
          element={
            <HiringOnly>
              <BankReview program="neop" />
            </HiringOnly>
          }
        />
        <Route path="academy/:cohortId" element={<CohortView />} />
        {FIELD_OBJECTIVES_ENABLED && HAS_FIELD_OBJECTIVES && (
          <Route path="academy/:cohortId/checklist/:traineeId" element={<FieldChecklistView />} />
        )}
        {HAS_FTO_AGENDA && (
          <Route path="academy/:cohortId/agenda/:traineeId" element={<FtoAgendaView />} />
        )}
        <Route path="academy/:cohortId/eval/:traineeId" element={<DailyEvalView />} />
        <Route path="academy/:cohortId/skills/:traineeId" element={<SkillSheetView />} />
        <Route path="academy/:cohortId/skills/:traineeId/:sheet" element={<SkillSheetView />} />
        <Route path="academy/:cohortId/checkoff/:sheet" element={<ClassCheckoffView />} />
        {HAS_EXIT_SURVEY && (
          <Route path="academy/:cohortId/survey/:traineeId" element={<ExitSurveyView />} />
        )}
        <Route
          path="aemt"
          element={
            <AemtOnly>
              <AemtList />
            </AemtOnly>
          }
        />
        <Route
          path="aemt/intake"
          element={
            <AemtOnly>
              <IntakeResults />
            </AemtOnly>
          }
        />
        <Route
          path="aemt/exam-results"
          element={
            <AemtOnly>
              <ExamResults />
            </AemtOnly>
          }
        />
        {/* Reads the bank for a subject-matter audit. Same gate as the
            results screen — it shows the answer key, and RLS is the real
            enforcement. Creates no attempt and writes nothing. */}
        <Route
          path="aemt/exam-bank"
          element={
            <AemtOnly>
              <BankReview />
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
        {/* Both chart tools share one route branch and one gate — same data
            sensitivity, same audience. ReviewView picks the tool from the path. */}
        <Route
          path="review"
          element={
            <ReviewOnly>
              <ReviewView />
            </ReviewOnly>
          }
        />
        <Route
          path="review/charts"
          element={
            <ReviewOnly>
              <ReviewView />
            </ReviewOnly>
          }
        />
        <Route
          path="review/necessity"
          element={
            <ReviewOnly>
              <ReviewView />
            </ReviewOnly>
          }
        />
        {/* The CQMP deck is leadership-facing reporting on operations, not
            training records. Same administrator gate as the instruments. */}
        <Route
          path="cqmp"
          element={
            <AdminOnly>
              <CqmpView />
            </AdminOnly>
          }
        />
        <Route
          path="cqmp/:reportId"
          element={
            <AdminOnly>
              <CqmpReportView />
            </AdminOnly>
          }
        />
        <Route
          path="simulator"
          element={
            <SimulatorOnly>
              <SimulatorView />
            </SimulatorOnly>
          }
        />
        <Route path="courses" element={<LearningView />} />
        <Route path="courses/view" element={<CourseViewer />} />
        <Route path="ems" element={<EmsReference />} />
        <Route path="history" element={<HistoryView />} />
        <Route
          path="templates"
          element={
            <AdminOnly>
              <TemplatesView />
            </AdminOnly>
          }
        />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Dashboard />} />
      </Route>
    </Routes>
  )
}
