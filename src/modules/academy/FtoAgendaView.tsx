import { Link, useParams } from 'react-router-dom'
import { Empty, ProgressBar } from '../../components/ui'
import {
  AGENDA_ORIENTEE_NOTE,
  AGENDA_RECOMMENDATIONS,
  FTO_TRACKS,
  trackById,
  type AgendaDay,
} from '../../data/ftoAgenda'
import { allFtos } from '../../data/ftoSchedule'
import { formatDate } from '../../lib/date'
import {
  agendaProgress,
  setAgendaComments,
  setAgendaRecommendation,
  setAgendaSkills,
  setFtoTrack,
  toggleAgendaItem,
  updateTrainee,
  useCohort,
  useCohortTrainees,
} from './academyStore'
import { printDoc, downloadDoc, safeFilename, ftoAgendaHTML } from './docGen'
import type { Trainee } from '../../types'

// Wichita's day-by-day FTO orientation agenda. The FTO-facing fillable
// version of FTO_Agenda{Red,Green}_Track.docx: same days, same checklists,
// same comments boxes and the same release-or-remediate recommendation, with
// each item tapped off during the shift and stamped with the FTO's initials.

const inputStyle = {
  display: 'block',
  width: '100%',
  marginTop: 2,
  padding: '6px 8px',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  font: 'inherit',
} as const

function DayCard({ trainee, day }: { trainee: Trainee; day: AgendaDay }) {
  const marked = day.items.filter((i) => trainee.agendaMarks?.[i.id]).length
  const complete = marked === day.items.length

  return (
    <div className="card" style={{ padding: 14, marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 15, flex: 1 }}>
          Day {day.day}: {day.title}
        </h3>
        <span className={`pill ${complete ? 'ok' : 'info'}`}>
          {complete ? '✓ complete' : `${marked}/${day.items.length}`}
        </span>
      </div>

      {/* The FTO guidance printed before this day in the source document. */}
      {day.ftoNote && (
        <p
          className="subtle"
          style={{
            fontSize: 12.5,
            margin: '0 0 10px',
            padding: '8px 10px',
            background: 'var(--surface-2, #f6f7f9)',
            borderLeft: '3px solid var(--border-strong)',
            borderRadius: 4,
          }}
        >
          <strong>FTO:</strong> {day.ftoNote}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {day.items.map((item) => {
          const mark = trainee.agendaMarks?.[item.id]
          return (
            <div key={item.id}>
              <button
                className="row-toggle"
                onClick={() => toggleAgendaItem(trainee.id, item.id)}
                aria-pressed={!!mark}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  width: '100%',
                  textAlign: 'left',
                  padding: '7px 6px',
                  background: 'none',
                  border: 0,
                  borderRadius: 6,
                  font: 'inherit',
                  cursor: 'pointer',
                }}
              >
                <span aria-hidden style={{ fontSize: 15, lineHeight: 1.3 }}>
                  {mark ? '☑' : '☐'}
                </span>
                <span style={{ flex: 1 }}>{item.text}</span>
                {mark && (
                  <span className="pill ok" style={{ whiteSpace: 'nowrap' }}>
                    {formatDate(mark.date)}
                    {mark.fto ? ` · ${mark.fto}` : ''}
                  </span>
                )}
              </button>
              {item.sub && (
                <ul
                  className="subtle"
                  style={{ margin: '0 0 6px 34px', paddingLeft: 16, fontSize: 12.5 }}
                >
                  {item.sub.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      {day.skillsPractice && (
        <label style={{ display: 'block', marginTop: 10, fontSize: 12.5 }}>
          <span className="subtle">Skills practice — skills/procedures reviewed</span>
          <textarea
            value={trainee.agendaSkills?.[day.day] ?? ''}
            onChange={(e) => setAgendaSkills(trainee.id, day.day, e.target.value)}
            rows={3}
            placeholder="One per line"
            style={inputStyle}
          />
        </label>
      )}

      <label style={{ display: 'block', marginTop: 10, fontSize: 12.5 }}>
        <span className="subtle">Comments</span>
        <textarea
          value={trainee.agendaComments?.[day.day] ?? ''}
          onChange={(e) => setAgendaComments(trainee.id, day.day, e.target.value)}
          rows={3}
          style={inputStyle}
        />
      </label>
    </div>
  )
}

export default function FtoAgendaView() {
  const { cohortId, traineeId } = useParams()
  const cohort = useCohort(cohortId)
  const trainee = useCohortTrainees(cohortId).find((t) => t.id === traineeId)

  if (!cohort || !trainee) {
    return <Empty title="Trainee not found">This orientee is no longer on the roster.</Empty>
  }

  const track = trackById(trainee.ftoTrack?.track as never)
  const progress = agendaProgress(trainee, track)
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0
  const rec = trainee.agendaRecommendation

  return (
    <div>
      <Link to={`/academy/${cohortId}`} className="link-btn">
        ← {cohort.label}
      </Link>
      <h2 style={{ margin: '8px 0 2px' }}>{trainee.name} — FTO orientation agenda</h2>
      <p className="subtle" style={{ fontSize: 12.5, margin: '0 0 12px' }}>
        {AGENDA_ORIENTEE_NOTE}
      </p>

      {/* ----- who is signing --------------------------------------------
          Above the track picker on purpose. Assigning a track records who
          made the call, and this is where that name comes from — below the
          picker it would always be blank at the moment it was needed. */}
      <div className="card" style={{ padding: 14 }}>
        <label style={{ display: 'block', fontSize: 12.5, maxWidth: 280 }}>
          <span className="subtle">
            FTO on shift — stamped onto the track assignment and everything signed off from here
          </span>
          <input
            value={trainee.activeFto ?? ''}
            onChange={(e) => updateTrainee(trainee.id, { activeFto: e.target.value || undefined })}
            list="agenda-ftos"
            placeholder="Initials or name"
            style={inputStyle}
          />
          <datalist id="agenda-ftos">
            {allFtos().map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </label>
      </div>

      {/* ----- track assignment ------------------------------------------- */}
      <div className="card" style={{ padding: 14, marginTop: 12 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Track</h3>
        <p className="subtle" style={{ fontSize: 12.5, margin: '0 0 10px' }}>
          Assigned by an FTO or manager. Nothing picks this automatically — the
          two tracks are different lengths of orientation, and which one a hire
          needs is a judgement about that hire.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FTO_TRACKS.map((t) => (
            <button
              key={t.id}
              className={`choice${trainee.ftoTrack?.track === t.id ? ' active' : ''}`}
              style={{ padding: '8px 14px' }}
              onClick={() => setFtoTrack(trainee.id, t.id, trainee.activeFto)}
            >
              {t.label} · {t.length} days
            </button>
          ))}
          {trainee.ftoTrack && (
            <button
              className="btn sm ghost"
              onClick={() => setFtoTrack(trainee.id, null)}
              title="Clear the track assignment. Marks already recorded are kept."
            >
              Clear
            </button>
          )}
        </div>
        {trainee.ftoTrack && (
          <p className="subtle" style={{ fontSize: 12, margin: '8px 0 0' }}>
            Assigned {formatDate(trainee.ftoTrack.date)}
            {trainee.ftoTrack.by ? ` by ${trainee.ftoTrack.by}` : ''}.
          </p>
        )}
      </div>

      {!track ? (
        <Empty title="No track assigned">
          Pick Red or Green above to start the agenda. Marks are kept if the track is changed
          later — the two tracks share their early days.
        </Empty>
      ) : (
        <>
          {/* ----- shift header --------------------------------------------- */}
          <div className="card" style={{ padding: 14, marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <strong style={{ fontSize: 14 }}>
                {progress.done}/{progress.total} signed off
              </strong>
              <span className="subtle" style={{ fontSize: 12.5 }}>
                {progress.daysComplete}/{progress.days} days complete
              </span>
            </div>
            <ProgressBar pct={pct} complete={progress.done === progress.total} />
          </div>

          <div className="toolbar" style={{ marginTop: 12 }}>
            <div className="spacer" />
            <button
              className="btn"
              onClick={() =>
                printDoc(`${trainee.name} — FTO Orientation Agenda`, ftoAgendaHTML(trainee, track))
              }
            >
              🖨 Print (marks filled in)
            </button>
            <button
              className="btn"
              onClick={() =>
                downloadDoc(
                  safeFilename(`${trainee.name}_FTO_Agenda`),
                  `${trainee.name} — FTO Orientation Agenda`,
                  ftoAgendaHTML(trainee, track),
                )
              }
            >
              ⬇ Word
            </button>
          </div>

          {track.days.map((d) => (
            <DayCard key={d.day} trainee={trainee} day={d} />
          ))}

          {/* ----- recommendation -------------------------------------------- */}
          <div className="card" style={{ padding: 14, marginTop: 12 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>FTO recommendation</h3>
            <p className="subtle" style={{ fontSize: 12.5, margin: '0 0 10px' }}>
              One or the other. Tapping the option already selected clears it.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {AGENDA_RECOMMENDATIONS.map((r) => (
                <button
                  key={r.id}
                  className={`choice${rec?.id === r.id ? ' active' : ''}`}
                  style={{ padding: '8px 14px' }}
                  onClick={() => setAgendaRecommendation(trainee.id, r.id)}
                >
                  {r.text}
                </button>
              ))}
            </div>
            {rec && (
              <p className="subtle" style={{ fontSize: 12, margin: '8px 0 0' }}>
                Recorded {formatDate(rec.date)}
                {rec.fto ? ` by ${rec.fto}` : ''}.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
