import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FTO_CREWS,
  FTOS_WITHOUT_LINE,
  FTO_ROTATION_ANCHOR,
  crewsOnDate,
  rotationWeek,
  shiftWindow,
  type FtoCrew,
} from '../../data/ftoSchedule'
import { addDays, formatDate, todayISO } from '../../lib/date'
import { weekdayLabel } from './calendar'

// Ride-along planning view: who is on shift with an FTO aboard, day by day,
// extrapolated from the operations master schedule's two-week rotation.

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function CrewLine({ unit, level, window, crew }: { unit: string; level: string; window: string; crew: { name: string; fto: boolean }[] }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', padding: '6px 0' }}>
      <span className="pill info" style={{ minWidth: 62, justifyContent: 'center' }}>
        {unit}
      </span>
      <span style={{ flex: 1, minWidth: 180 }}>
        {crew.map((m, i) => (
          <span key={m.name}>
            {i > 0 && <span className="subtle"> · </span>}
            <span style={{ fontWeight: m.fto ? 700 : 400 }}>
              {m.name}
              {m.fto && <span className="pill ok" style={{ marginLeft: 5, padding: '1px 7px', fontSize: 10 }}>FTO</span>}
            </span>
          </span>
        ))}
      </span>
      <span className="subtle" style={{ whiteSpace: 'nowrap' }}>
        {window} · {level}
      </span>
    </div>
  )
}

export default function FtoScheduleView() {
  const [from, setFrom] = useState(todayISO())
  const [ftoFilter, setFtoFilter] = useState('')
  const days = Array.from({ length: 14 }, (_, i) => addDays(from, i))

  const ftoNames = [...new Set(FTO_CREWS.flatMap((c) => c.crew.filter((m) => m.fto).map((m) => m.name)))]
  const matchesFilter = (c: FtoCrew) =>
    !ftoFilter || c.crew.some((m) => m.fto && m.name === ftoFilter)
  const visibleCrews = FTO_CREWS.filter(matchesFilter)

  return (
    <div>
      <Link to="/academy" className="link-btn">
        ← Back to Academy
      </Link>

      <div className="page-head" style={{ marginTop: 8 }}>
        <div>
          <h1>FTO Shifts</h1>
          <div className="subtle">Plan ride-alongs around when FTOs are on a truck</div>
        </div>
      </div>

      <div className="banner info">
        Extrapolated from the operations master schedule's two-week rotation (Week 1 anchored to{' '}
        {formatDate(FTO_ROTATION_ANCHOR)}). Always confirm against the live schedule — trades and
        call-offs won't show here.
      </div>

      <div className="toolbar">
        <label className="subtle" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          Show 14 days from
          <input
            type="date"
            value={from}
            onChange={(e) => e.target.value && setFrom(e.target.value)}
            style={{ padding: '6px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit' }}
          />
        </label>
        <div className="spacer" />
        <button className="btn sm" onClick={() => setFrom(todayISO())}>
          Today
        </button>
      </div>

      {/* Filter to one FTO when planning that trainee's next ride. */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        <button className={`choice${ftoFilter === '' ? ' active' : ''}`} style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => setFtoFilter('')}>
          All FTOs
        </button>
        {ftoNames.map((n) => (
          <button
            key={n}
            className={`choice${ftoFilter === n ? ' active' : ''}`}
            style={{ padding: '6px 12px', fontSize: 13 }}
            onClick={() => setFtoFilter(ftoFilter === n ? '' : n)}
          >
            {n.split(' ').slice(-1)[0]}
          </button>
        ))}
      </div>

      <div className="list">
        {days.map((d) => {
          const crews = crewsOnDate(d).filter(matchesFilter)
          const isToday = d === todayISO()
          return (
            <div key={d} className="card" style={{ padding: '10px 14px', ...(isToday ? { borderColor: 'var(--navy-600)' } : {}) }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: crews.length ? 4 : 0 }}>
                <span style={{ fontWeight: 700 }}>
                  {weekdayLabel(d)} {formatDate(d)}
                </span>
                {isToday && <span className="pill info">Today</span>}
                <span className="pill muted" title="Rotation week">
                  Wk {rotationWeek(d)}
                </span>
                <span className="spacer" />
                <span className="subtle" style={{ fontSize: 12 }}>
                  {crews.length === 0 ? 'No FTOs on shift' : `${crews.length} FTO crew${crews.length === 1 ? '' : 's'}`}
                </span>
              </div>
              {crews.map((c) => (
                <CrewLine key={c.unit + c.start} unit={c.unit} level={c.level} window={shiftWindow(c)} crew={c.crew} />
              ))}
            </div>
          )
        })}
      </div>

      <div className="section-title">Crew rotation patterns</div>
      <div className="list">
        {visibleCrews.map((c) => (
          <div key={c.unit + c.start} className="card" style={{ padding: 14 }}>
            <CrewLine unit={c.unit} level={c.level} window={shiftWindow(c)} crew={c.crew} />
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 6 }}>
              {([1, 2] as const).map((wk) => (
                <div key={wk} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span className="subtle" style={{ fontSize: 12, fontWeight: 700, marginRight: 2 }}>
                    Wk {wk}
                  </span>
                  {DOW.map((label, dow) => {
                    const on = (wk === 1 ? c.week1 : c.week2).includes(dow)
                    return (
                      <span
                        key={label}
                        className={`pill ${on ? 'info' : 'muted'}`}
                        style={{ padding: '2px 7px', fontSize: 11, opacity: on ? 1 : 0.45 }}
                      >
                        {label}
                      </span>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {FTOS_WITHOUT_LINE.length > 0 && (
        <div className="banner warn" style={{ marginTop: 12 }}>
          FTO{FTOS_WITHOUT_LINE.length === 1 ? '' : 's'} without a recurring line on the master
          schedule: {FTOS_WITHOUT_LINE.join(', ')} — schedule rides with them directly.
        </div>
      )}
    </div>
  )
}
