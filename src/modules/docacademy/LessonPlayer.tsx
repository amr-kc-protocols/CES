import { Link, useParams } from 'react-router-dom'
import { LESSON_BY_ID, LESSONS } from '../../data/docAcademy/lessons'
import { CASE_BY_ID } from '../../data/docAcademy/cases'
import SourceChips from './SourceChips'
import { markLesson, useActiveLearner } from './academyStore'

// One lesson: short sections, each with its sources, then the activity and the
// cases it uses. Progress is a tick the learner sets, stamped with the lesson
// version it was done against.

export default function LessonPlayer() {
  const { lessonId = '' } = useParams()
  const lesson = LESSON_BY_ID[lessonId]
  const learner = useActiveLearner()

  if (!lesson) {
    return (
      <div>
        <Link to="/doc-academy" className="btn ghost">‹ Course</Link>
        <div className="banner warn" style={{ marginTop: 12 }}>That lesson could not be found.</div>
      </div>
    )
  }

  const idx = LESSONS.findIndex((l) => l.id === lesson.id)
  const next = LESSONS[idx + 1]
  const done = !!learner?.lessonsDone[lesson.id]

  return (
    <div>
      <Link to="/doc-academy" className="btn ghost" style={{ paddingLeft: 0 }}>
        ‹ Course
      </Link>
      <div className="page-head">
        <div>
          <h1>
            {lesson.id} · {lesson.title}
          </h1>
          <div className="subtle">
            {lesson.minutes} minutes · version {lesson.version}
          </div>
        </div>
      </div>

      {lesson.approval === 'draft' && (
        <div className="banner warn">
          <strong>Draft.</strong> Not yet reviewed by {lesson.reviewers.join(' and ')}. Teach from it in the pilot only.
        </div>
      )}

      <div className="card" style={{ padding: 14 }}>
        <div className="section-title" style={{ marginTop: 0 }}>You will be able to</div>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.55 }}>
          {lesson.objectives.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </div>

      {lesson.sections.map((s) => (
        <section key={s.heading} className="card" style={{ padding: 14 }}>
          <h2 style={{ fontSize: 17, margin: '0 0 8px' }}>{s.heading}</h2>
          {s.body.map((p) => (
            <p key={p} style={{ margin: '0 0 8px', lineHeight: 1.55 }}>
              {p}
            </p>
          ))}
          <SourceChips ids={s.sourceIds} />
        </section>
      ))}

      {lesson.emphasis && (
        <div className="card" style={{ padding: 14 }}>
          <div className="section-title" style={{ marginTop: 0 }}>Emphasis by role</div>
          <p style={{ margin: '0 0 6px' }}>
            <strong>FTO:</strong> {lesson.emphasis.fto}
          </p>
          <p style={{ margin: 0 }}>
            <strong>Manager / educator:</strong> {lesson.emphasis.manager}
          </p>
        </div>
      )}

      <div className="card" style={{ padding: 14 }}>
        <div className="section-title" style={{ marginTop: 0 }}>Activity</div>
        <p style={{ margin: 0 }}>{lesson.activity}</p>
        {lesson.caseIds.length > 0 && (
          <div className="list" style={{ gap: 6, marginTop: 10 }}>
            {lesson.caseIds.map((cid) => {
              const c = CASE_BY_ID[cid]
              return (
                <Link key={cid} to={`/doc-academy/case/${cid}`} className="row" style={{ color: 'inherit' }}>
                  <div className="grow">
                    <div className="title">
                      {c.id} · {c.title}
                    </div>
                    <div className="meta">{c.learnerTask}</div>
                  </div>
                  {!c.authored && <span className="pill muted">Seed</span>}
                  <span className="subtle" aria-hidden>›</span>
                </Link>
              )
            })}
          </div>
        )}
        {lesson.id === 'C00' && (
          <Link to="/doc-academy/exam/baseline" className="btn" style={{ marginTop: 10 }}>
            Take the baseline (ungraded)
          </Link>
        )}
        {lesson.id === 'C09' && (
          <Link to="/doc-academy/exam/A" className="btn primary" style={{ marginTop: 10 }}>
            Take the common-core exam
          </Link>
        )}
      </div>

      <div className="btn-row" style={{ marginTop: 12 }}>
        {learner ? (
          <button
            className={`btn ${done ? '' : 'primary'}`}
            onClick={() => markLesson(learner.id, lesson.id, lesson.version, !done)}
          >
            {done ? '✓ Completed — undo' : 'Mark lesson complete'}
          </button>
        ) : (
          <span className="subtle">Choose a learner on the course page to track progress.</span>
        )}
        {next && (
          <Link to={`/doc-academy/lesson/${next.id}`} className="btn ghost">
            Next: {next.id} ›
          </Link>
        )}
      </div>
    </div>
  )
}
