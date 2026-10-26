import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Tabs, tabPanelProps } from '../../components/Tabs'
import { useCan } from '../../lib/role'
import { useSyncStatus } from '../../lib/sync'
import { formatDate, todayISO } from '../../lib/date'
import {
  COMPLETION_WORDING,
  COURSE_TITLE,
  COURSE_VERSION,
  CRITICAL_ERRORS,
  LESSON_BY_ID,
  LESSONS,
  RUBRIC,
  SESSIONS,
  TRACK_LABEL,
  lessonsFor,
} from '../../data/docAcademy/lessons'
import { CASES, PRIORITY_CASE_IDS } from '../../data/docAcademy/cases'
import { EXAM_FORM_A, QUESTION_BY_ID } from '../../data/docAcademy/questions'
import { AUTHORITY_LABEL, SOURCES } from '../../data/docAcademy/sources'
import type { Authority, RubricDomainId, Track } from '../../data/docAcademy/types'
import { SourceDetail } from './SourceChips'
import {
  addLearner,
  issueCompletion,
  latestExam,
  removeLearner,
  savePractical,
  setActive,
  setSignoff,
  useAcademy,
  useActiveLearner,
  type LearnerRecord,
} from './academyStore'
import { completionGaps, needsLeadership, scorePractical, type DomainScore, type PracticalInput } from './scoring'

// ---------------------------------------------------------------------------
// Ambulance Documentation & Review Academy — course home.
//
// An original internal course: six hours of common core for every track and a
// two-hour leadership practicum for FTOs, managers and educators. Completion
// reads "Internal training completed" and nothing else — it is not CADS, not
// NAAC-endorsed, and not CE unless separately authorized.
// ---------------------------------------------------------------------------

type Tab = 'course' | 'lab' | 'review' | 'sources'
const TABS: { id: Tab; label: string }[] = [
  { id: 'course', label: 'Course' },
  { id: 'lab', label: 'Chart lab' },
  { id: 'review', label: 'Review & completion' },
  { id: 'sources', label: 'Sources' },
]

const minutesOf = (track: Track) => lessonsFor(track).reduce((n, l) => n + l.minutes, 0)

function LearnerPicker() {
  const { learners, activeId } = useAcademy()
  const me = useActiveLearner()
  const { signedIn, role } = useSyncStatus()
  const self = signedIn && role !== 'admin'
  const [name, setName] = useState('')
  const [track, setTrack] = useState<Track>(self && role === 'fto' ? 'fto' : 'learner')

  // A signed-in FTO or new hire enrols once, as themselves, and that is the
  // only record their account can write.
  if (self && me) return null

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="section-title" style={{ marginTop: 0 }}>{self ? 'Enrol' : 'Learners'}</div>
      {!self && learners.length > 0 && (
        <div className="btn-row" style={{ flexWrap: 'wrap', marginBottom: 10 }}>
          {learners.map((l) => (
            <button
              key={l.id}
              className={`btn sm ${l.id === activeId ? 'primary' : ''}`}
              aria-pressed={l.id === activeId}
              onClick={() => setActive(l.id)}
            >
              {l.name} · {TRACK_LABEL[l.track]}
            </button>
          ))}
        </div>
      )}
      <form
        className="btn-row"
        style={{ flexWrap: 'wrap' }}
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) {
            addLearner(name, track)
            setName('')
          }
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={self ? 'Your name' : 'Staff name'}
          aria-label={self ? 'Your name' : 'Staff name'}
          style={{ flex: '1 1 12rem', padding: 8, font: 'inherit' }}
        />
        <select value={track} onChange={(e) => setTrack(e.target.value as Track)} aria-label="Role" style={{ padding: 8, font: 'inherit' }}>
          {(Object.keys(TRACK_LABEL) as Track[]).map((t) => (
            <option key={t} value={t}>
              {TRACK_LABEL[t]} — {minutesOf(t) / 60} h
            </option>
          ))}
        </select>
        <button className="btn" type="submit" disabled={!name.trim()}>
          {self ? 'Start the course' : 'Add learner'}
        </button>
      </form>
      <div className="help-text">
        {signedIn
          ? 'Progress, attempts and reviews sync to the CES cloud with the rest of this operation’s records.'
          : 'Not signed in: progress stays on this device until someone signs in under Settings → Cloud sync and syncs it.'}
      </div>
    </div>
  )
}

function CourseTab({ learner }: { learner?: LearnerRecord }) {
  const track = learner?.track ?? 'learner'
  const visible = new Set(lessonsFor(learner ? track : 'educator').map((l) => l.id))
  return (
    <>
      <LearnerPicker />
      {SESSIONS.map((s) => {
        const slices = s.slices.filter((x) => visible.has(x.lessonId))
        if (!slices.length) return null
        return (
          <div key={s.id}>
            <div className="section-title">
              {s.label} · {slices.reduce((n, x) => n + x.minutes, 0)} min
            </div>
            <div className="list">
              {slices.map((x) => {
                const l = LESSON_BY_ID[x.lessonId]
                const done = !!learner?.lessonsDone[l.id]
                const split = x.minutes !== l.minutes
                return (
                  <Link key={s.id + l.id} to={`/doc-academy/lesson/${l.id}`} className="row" style={{ color: 'inherit' }}>
                    <span aria-hidden style={{ width: 20 }}>{done ? '✓' : ''}</span>
                    <div className="grow">
                      <div className="title">
                        {l.id} · {l.title}
                      </div>
                      <div className="meta">
                        {x.minutes} min{split ? ` of ${l.minutes}` : ''} · {l.activity}
                      </div>
                    </div>
                    {done && <span className="sr-only">completed</span>}
                    <span className="subtle" aria-hidden>›</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}
      <div className="btn-row" style={{ marginTop: 14 }}>
        <Link to="/doc-academy/exam/baseline" className="btn">Baseline (ungraded)</Link>
        <Link to="/doc-academy/exam/A" className="btn primary">Common-core exam</Link>
      </div>
    </>
  )
}

function LabTab() {
  return (
    <>
      <div className="help-text" style={{ marginTop: 0 }}>
        Fictional cases. Priority cases are fully authored; the rest are seeds for discussion until their vignettes are
        written.
      </div>
      <div className="list">
        {[...CASES]
          .sort((a, b) => Number(b.authored) - Number(a.authored) || a.id.localeCompare(b.id))
          .map((c) => (
            <Link key={c.id} to={`/doc-academy/case/${c.id}`} className="row" style={{ color: 'inherit' }}>
              <div className="grow">
                <div className="title">
                  {c.id} · {c.title}
                </div>
                <div className="meta">{c.learnerTask}</div>
              </div>
              {PRIORITY_CASE_IDS.includes(c.id) ? <span className="pill info">Priority</span> : <span className="pill muted">Seed</span>}
              <span className="subtle" aria-hidden>›</span>
            </Link>
          ))}
      </div>
    </>
  )
}

function PracticalForm({ learner }: { learner: LearnerRecord }) {
  const prior = learner.practical
  const authored = CASES.filter((c) => c.authored)
  const [caseId, setCaseId] = useState(prior?.caseId ?? authored[0].id)
  const [reviewer, setReviewer] = useState(prior?.reviewer ?? '')
  const [scores, setScores] = useState<PracticalInput['scores']>(prior?.scores ?? {})
  const [na, setNa] = useState<PracticalInput['naJustification']>(prior?.naJustification ?? {})
  const [crit, setCrit] = useState<PracticalInput['criticalErrors']>(prior?.criticalErrors ?? [])
  const [feedback, setFeedback] = useState(prior?.feedback ?? '')
  const [saved, setSaved] = useState(false)

  const result = scorePractical({ scores, naJustification: na, criticalErrors: crit })
  const draft = learner.drafts[caseId]

  const setScore = (id: RubricDomainId, v: DomainScore) => {
    setScores((s) => ({ ...s, [id]: v }))
    setSaved(false)
  }

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="section-title" style={{ marginTop: 0 }}>Practical — reviewer scoring</div>
      <div className="btn-row" style={{ flexWrap: 'wrap' }}>
        <label>
          Case{' '}
          <select value={caseId} onChange={(e) => setCaseId(e.target.value)} style={{ padding: 6, font: 'inherit' }}>
            {authored.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} · {c.title}
              </option>
            ))}
          </select>
        </label>
        <input
          value={reviewer}
          onChange={(e) => setReviewer(e.target.value)}
          placeholder="Reviewer name"
          aria-label="Reviewer name"
          style={{ padding: 6, font: 'inherit' }}
        />
      </div>
      <div className="help-text">
        Learner’s workspace for {caseId}: {draft ? <em>“{draft.slice(0, 400)}{draft.length > 400 ? '…' : ''}”</em> : 'nothing saved yet.'}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
        <tbody>
          {RUBRIC.map((d) => (
            <tr key={d.id} style={{ borderTop: '1px solid var(--border, #ddd)' }}>
              <td style={{ padding: '6px 4px' }}>
                <strong>{d.label}</strong>
                <div className="meta">{d.evidence}</div>
                {scores[d.id] === 'na' && (
                  <input
                    value={na[d.id] ?? ''}
                    onChange={(e) => setNa((x) => ({ ...x, [d.id]: e.target.value }))}
                    placeholder="Why not applicable (required)"
                    aria-label={`${d.label} not-applicable justification`}
                    style={{ width: '100%', padding: 4, font: 'inherit', marginTop: 4 }}
                  />
                )}
              </td>
              <td style={{ padding: '6px 4px', whiteSpace: 'nowrap' }}>
                {([0, 1, 2, 'na'] as DomainScore[]).map((v) => (
                  <label key={String(v)} style={{ marginRight: 8 }}>
                    <input type="radio" name={`p-${d.id}`} checked={scores[d.id] === v} onChange={() => setScore(d.id, v)} />{' '}
                    {v === 'na' ? 'N/A' : v}
                  </label>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="section-title">Critical errors</div>
      {CRITICAL_ERRORS.map((e) => {
        const entry = crit.find((x) => x.id === e.id)
        return (
          <div key={e.id} className="row" style={{ gap: 10 }}>
            <label className="grow">
              <input
                type="checkbox"
                checked={!!entry}
                onChange={() =>
                  setCrit((c) => (entry ? c.filter((x) => x.id !== e.id) : [...c, { id: e.id, resolved: false }]))
                }
              />{' '}
              {e.label}
            </label>
            {entry && (
              <label>
                <input
                  type="checkbox"
                  checked={entry.resolved}
                  onChange={() => setCrit((c) => c.map((x) => (x.id === e.id ? { ...x, resolved: !x.resolved } : x)))}
                />{' '}
                Resolved
              </label>
            )}
          </div>
        )
      })}
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        rows={3}
        placeholder="Feedback to the learner"
        aria-label="Feedback to the learner"
        style={{ width: '100%', font: 'inherit', padding: 8, marginTop: 8, boxSizing: 'border-box' }}
      />
      <div className={`banner ${result.passed ? 'ok' : 'warn'}`} style={{ marginTop: 8 }}>
        {result.earned}/{result.maxPoints} applicable points ({result.pct}%) —{' '}
        {result.passed
          ? 'meets the practical standard.'
          : [
              !result.complete && 'every domain needs a score or N/A',
              result.unjustifiedNa.length > 0 && 'every N/A needs a justification',
              result.unresolvedCritical.length > 0 && 'a critical error is unresolved',
              result.complete && result.maxPoints > 0 && result.earned * 100 < 85 * result.maxPoints && 'below 85%',
            ]
              .filter(Boolean)
              .join('; ') + '.'}
      </div>
      <button
        className="btn primary"
        style={{ marginTop: 8 }}
        disabled={!reviewer.trim()}
        onClick={() => {
          savePractical(learner.id, { caseId, reviewer: reviewer.trim(), scores, naJustification: na, criticalErrors: crit, feedback })
          setSaved(true)
        }}
      >
        Save review
      </button>
      {saved && <span className="subtle" role="status" style={{ marginLeft: 8 }}>Saved.</span>}
    </div>
  )
}

function Signoffs({ learner }: { learner: LearnerRecord }) {
  const [who, setWho] = useState('')
  const row = (which: 'coachingApproved' | 'auditPlanApproved', label: string) => {
    const s = learner[which]
    return (
      <div className="row">
        <div className="grow">
          <div className="title">{label}</div>
          <div className="meta">{s ? `Approved by ${s.by}, ${formatDate(s.at.slice(0, 10))}` : 'Not yet approved'}</div>
        </div>
        {s ? (
          <button className="btn sm ghost" onClick={() => setSignoff(learner.id, which, undefined)}>
            Withdraw
          </button>
        ) : (
          <button className="btn sm" disabled={!who.trim()} onClick={() => setSignoff(learner.id, which, who)}>
            Approve
          </button>
        )}
      </div>
    )
  }
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="section-title" style={{ marginTop: 0 }}>Leadership sign-off</div>
      <div className="help-text" style={{ marginTop: 0 }}>
        A person approves these. Text matching cannot establish that a coaching response or a plan is sound.
      </div>
      <input
        value={who}
        onChange={(e) => setWho(e.target.value)}
        placeholder="Approving reviewer"
        aria-label="Approving reviewer"
        style={{ padding: 6, font: 'inherit', marginBottom: 6 }}
      />
      <div className="list">
        {row('coachingApproved', 'One coaching response (L02)')}
        {row('auditPlanApproved', 'One audit/remediation plan (L03–L04)')}
      </div>
    </div>
  )
}

function Completion({ learner }: { learner: LearnerRecord }) {
  const { manageAcademy } = useCan()
  const exam = latestExam(learner)
  const prac = learner.practical
  const practical = prac ? scorePractical(prac) : undefined
  const gaps = completionGaps({
    track: learner.track,
    examPassed: !!exam?.passed,
    practicalPassed: !!practical?.passed,
    lessonsDone: Object.keys(learner.lessonsDone),
    coachingApprovedBy: learner.coachingApproved?.by,
    auditPlanApprovedBy: learner.auditPlanApproved?.by,
  })
  const [minutes, setMinutes] = useState(String(lessonsFor(learner.track).reduce((n, l) => n + l.minutes, 0)))
  const c = learner.completion

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="section-title" style={{ marginTop: 0 }}>Completion record</div>
      {c ? (
        <div className="doc-completion">
          <h2 style={{ fontSize: 18, margin: '0 0 6px' }}>{COMPLETION_WORDING}</h2>
          <p style={{ margin: 0, lineHeight: 1.6 }}>
            <strong>{c.learner}</strong> · {TRACK_LABEL[c.track]} track
            <br />
            {COURSE_TITLE}, version {c.courseVersion}
            <br />
            Knowledge exam {c.examPct}% · practical {c.practicalPct}%
            <br />
            Reviewer {c.reviewer} · {formatDate(c.date)} · {c.instructionalMinutes} instructional minutes
          </p>
          <p className="meta">Internal training only. Not CADS certification, not NAAC-endorsed, and not continuing education unless separately authorized.</p>
          <button className="btn sm" onClick={() => window.print()}>Print</button>
        </div>
      ) : gaps.length ? (
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          {gaps.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      ) : !manageAcademy ? (
        <div className="subtle">All requirements met — a clinical educator issues the completion record.</div>
      ) : (
        <div className="btn-row" style={{ flexWrap: 'wrap' }}>
          <label>
            Actual instructional minutes{' '}
            <input
              type="number"
              min={0}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              style={{ width: 90, padding: 6, font: 'inherit' }}
            />
          </label>
          <button
            className="btn primary"
            onClick={() =>
              issueCompletion(learner.id, {
                learner: learner.name,
                track: learner.track,
                examPct: exam!.pct,
                practicalPct: practical!.pct,
                reviewer: prac!.reviewer,
                date: todayISO(),
                instructionalMinutes: Number(minutes) || 0,
              })
            }
          >
            Issue “{COMPLETION_WORDING}”
          </button>
        </div>
      )}
    </div>
  )
}

function Dashboard() {
  const { learners } = useAcademy()
  const missed = useMemo(() => {
    const n: Record<string, number> = {}
    for (const l of learners) {
      const a = latestExam(l)
      if (!a) continue
      for (const q of EXAM_FORM_A) {
        const ans = a.answers[q.id] ?? []
        if (!(ans.length === q.correctChoiceIds.length && ans.every((x) => q.correctChoiceIds.includes(x)))) n[q.id] = (n[q.id] ?? 0) + 1
      }
    }
    return Object.entries(n).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [learners])
  const queue = learners.filter((l) => latestExam(l)?.passed && !l.practical)

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="section-title" style={{ marginTop: 0 }}>Reviewer dashboard · this operation</div>
      <div className="list">
        {learners.map((l) => {
          const a = latestExam(l)
          const b = latestExam(l, 'baseline')
          return (
            <div key={l.id} className="row">
              <div className="grow">
                <div className="title">
                  {l.name} · {TRACK_LABEL[l.track]}
                </div>
                <div className="meta">
                  Lessons {Object.keys(l.lessonsDone).length}/{lessonsFor(l.track).length} · baseline{' '}
                  {b ? `${b.pct}%` : '—'} · exam {a ? `${a.pct}%${a.passed ? ' ✓' : ''}` : '—'} · practical{' '}
                  {l.practical ? `${scorePractical(l.practical).pct}%` : '—'}
                  {needsLeadership(l.track) ? ` · sign-offs ${[l.coachingApproved, l.auditPlanApproved].filter(Boolean).length}/2` : ''}
                  {l.completion ? ' · completed' : ''}
                </div>
              </div>
            </div>
          )
        })}
        {!learners.length && <div className="subtle">No learners yet.</div>}
      </div>
      {queue.length > 0 && (
        <p className="meta">Coaching queue — exam passed, practical not yet scored: {queue.map((l) => l.name).join(', ')}</p>
      )}
      {missed.length > 0 && (
        <p className="meta">
          Most-missed items:{' '}
          {missed.map(([id, n]) => `${id} (${n}) — ${QUESTION_BY_ID[id].prompt.slice(0, 60)}…`).join(' · ')}
        </p>
      )}
      <p className="meta">
        Course version {COURSE_VERSION}. Lesson approvals:{' '}
        {LESSONS.filter((l) => l.approval !== 'draft').length}/{LESSONS.length} past draft.
      </p>
    </div>
  )
}

function ReviewTab({ learner }: { learner?: LearnerRecord }) {
  const { manageAcademy } = useCan()
  return (
    <>
      {manageAcademy && <Dashboard />}
      {!learner ? (
        <div className="banner info">Choose a learner on the Course tab.</div>
      ) : (
        <>
          {manageAcademy ? (
            <>
              <PracticalForm key={learner.id} learner={learner} />
              {needsLeadership(learner.track) && <Signoffs learner={learner} />}
            </>
          ) : (
            <div className="banner info">Practical scoring and sign-off are done by a clinical educator or administrator.</div>
          )}
          <Completion learner={learner} />
          {manageAcademy && (
            <button
              className="btn ghost danger"
              onClick={() => {
                if (window.confirm(`Remove ${learner.name} and all their attempts and reviews? This syncs.`)) removeLearner(learner.id)
              }}
            >
              Remove learner and their records
            </button>
          )}
        </>
      )}
    </>
  )
}

function SourcesTab() {
  const [q, setQ] = useState('')
  const [auth, setAuth] = useState<Authority | ''>('')
  const shown = SOURCES.filter(
    (s) =>
      (!auth || s.authority === auth) &&
      (!q.trim() || `${s.id} ${s.title} ${s.publisher} ${s.locator ?? ''} ${s.note ?? ''}`.toLowerCase().includes(q.toLowerCase())),
  )
  return (
    <>
      <div className="btn-row" style={{ flexWrap: 'wrap' }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search sources"
          aria-label="Search sources"
          style={{ flex: '1 1 12rem', padding: 8, font: 'inherit' }}
        />
        <select value={auth} onChange={(e) => setAuth(e.target.value as Authority | '')} aria-label="Authority" style={{ padding: 8, font: 'inherit' }}>
          <option value="">All authorities</option>
          {(Object.keys(AUTHORITY_LABEL) as Authority[]).map((a) => (
            <option key={a} value={a}>
              {AUTHORITY_LABEL[a]}
            </option>
          ))}
        </select>
      </div>
      <div className="help-text">
        Federal rules, CMS guidance, contractor education, state rules, payer rules and local policy answer different
        questions. Lessons cite them separately and never blend them.
      </div>
      <div className="list" style={{ gap: 6 }}>
        {shown.map((s) => (
          <SourceDetail key={s.id} s={s} />
        ))}
      </div>
    </>
  )
}

export default function DocAcademyView() {
  const [params, setParams] = useSearchParams()
  const tab = (TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'course') as Tab
  const learner = useActiveLearner()

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{COURSE_TITLE}</h1>
          <div className="subtle">
            Clinical educators, FTOs, managers and field providers · 6 h common core + 2 h leadership practicum ·
            version {COURSE_VERSION}
          </div>
        </div>
      </div>
      <div className="banner info">
        <strong>Internal training.</strong> Completion is recorded as “{COMPLETION_WORDING}”. This is not CADS
        certification and is not endorsed by NAAC. Lessons are drafts awaiting clinical and compliance review.
        {learner && (
          <>
            {' '}
            Learner: <strong>{learner.name}</strong> ({TRACK_LABEL[learner.track]}).
          </>
        )}
      </div>

      <Tabs
        idPrefix="docacad"
        label="Course sections"
        style={{ marginTop: 14 }}
        tabs={TABS}
        value={tab}
        onChange={(t) => setParams(t === 'course' ? {} : { tab: t }, { replace: true })}
      />
      <div style={{ marginTop: 14 }} {...tabPanelProps('docacad', tab)}>
        {tab === 'course' && <CourseTab learner={learner} />}
        {tab === 'lab' && <LabTab />}
        {tab === 'review' && <ReviewTab learner={learner} />}
        {tab === 'sources' && <SourcesTab />}
      </div>
    </div>
  )
}
