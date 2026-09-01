import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Empty } from '../../components/ui'
import { monthLabel } from '../../lib/date'
import { AIR_OPERATIONS, CQMP_OPERATIONS, GROUND_OPERATIONS } from '../../data/cqmp'
import {
  createReport,
  currentMonth,
  progressOf,
  referencedImageKeys,
  useCqmpReports,
  usedMonths,
} from './cqmpStore'
import { purgeOrphanScreenshots } from './images'

// ---------------------------------------------------------------------------
// CQMP — one report per month, newest first.
//
// The monthly job is: read each KPI off Clinical Analytics, screenshot the
// chart, type the number in, say what happened, generate the deck. This screen
// is the index of those months; CqmpReportView is where the month is filled in.
// ---------------------------------------------------------------------------

export default function CqmpView() {
  const reports = useCqmpReports()
  const navigate = useNavigate()
  const taken = usedMonths(reports)
  const [month, setMonth] = useState(currentMonth())

  // Screenshots belonging to deleted reports are collected here rather than at
  // the moment of deletion, which is undoable for ten seconds. By the time this
  // screen is opened again that window is long gone.
  useEffect(() => {
    void purgeOrphanScreenshots(referencedImageKeys())
  }, [])

  function open(): void {
    if (!month) return
    const existing = reports.find((r) => r.month === month)
    navigate(`/cqmp/${(existing ?? createReport(month)).id}`)
  }

  const measures = CQMP_OPERATIONS.reduce((n, op) => n + op.kpis.length, 0)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>CQMP</h1>
          <div className="subtle">
            Monthly Clinical Quality Management Plan KPI review — numbers, dashboard captures and
            notes in, PowerPoint out
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 14 }}>
        <div className="section-title" style={{ marginTop: 0 }}>
          Start a month
        </div>
        <div className="field-row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ maxWidth: 220 }}>
            <label htmlFor="cqmp-month">Reporting month</label>
            <input
              id="cqmp-month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
          <div className="btn-row" style={{ marginBottom: 12 }}>
            <button className="btn primary" onClick={open} disabled={!month}>
              {taken.has(month) ? 'Open month' : 'Create month'}
            </button>
          </div>
        </div>
        {/* What a month costs, in one line. The full operation-by-measure
            breakdown used to be spelled out here — six lines of dense text on
            the landing screen, restating a catalogue that is already on the
            month's own page, and asserting two things that are no longer true:
            that this is a market list, and that targets carry forward. */}
        <div className="subtle" style={{ fontSize: 12 }}>
          {measures} measures across {CQMP_OPERATIONS.length} operations in Region 41 —{' '}
          {GROUND_OPERATIONS.length} ground, {AIR_OPERATIONS.length} air. Targets are fixed per
          measure.
        </div>
      </div>

      <div className="section-title">Reports</div>
      {reports.length === 0 ? (
        <Empty icon="📊" title="No CQMP months yet">
          Create the month above, then work down the list of measures.
        </Empty>
      ) : (
        <div className="list">
          {reports.map((r) => {
            const p = progressOf(r)
            const complete = p.reported === p.expected
            return (
              <Link
                key={r.id}
                to={`/cqmp/${r.id}`}
                className={`row left-accent ${complete ? 'acc-ok' : 'acc-warn'}`}
              >
                {/* A div, not a span: `.title` and `.meta` are block styles, so
                    as spans they laid out inline and the month ran straight
                    into its own count — "April 202611 of 26 measures". */}
                <div className="grow">
                  <div className="title">{monthLabel(r.month)}</div>
                  <div className="meta">{p.reported} of {p.expected} measures reported</div>
                </div>
                <span className={`pill ${complete ? 'ok' : 'muted'}`}>
                  {complete ? 'Ready' : 'In progress'}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
