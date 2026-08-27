import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import DebouncedInput from '../../components/DebouncedInput'
import { Empty, Stat } from '../../components/ui'
import { confirmAction, notifyUser } from '../../lib/dialog'
import { monthLabel } from '../../lib/date'
import { activeMarket } from '../../lib/market'
import { CQMP_KPIS, CQMP_OPERATIONS, CQMP_SUBMIT_URL, type CqmpKpiId } from '../../data/cqmp'
import MetricCard from './MetricCard'
import MeetingPanel from './MeetingPanel'
import KpiImport from './KpiImport'
import {
  deleteReport,
  findMetric,
  isReported,
  kpiSummary,
  priorReport,
  progressOf,
  updateReport,
  useCqmpReports,
  useReportById,
} from './cqmpStore'
import { downloadDeck } from './deck'
import { downloadMinutes, printMinutes } from './minutes'
import type { CqmpMetric } from '../../types'

// ---------------------------------------------------------------------------
// One month's report: every measure this market owes, in deck order, then the
// button that turns it into the PowerPoint.
// ---------------------------------------------------------------------------

export default function CqmpReportView() {
  const { reportId } = useParams()
  const navigate = useNavigate()
  const report = useReportById(reportId)
  const reports = useCqmpReports()
  const [generating, setGenerating] = useState(false)
  const [importing, setImporting] = useState(false)
  // Which operations the person has opened or closed by hand, overriding the
  // automatic fold. Keyed by operation id; absent means "follow the default".
  const [manual, setManual] = useState<Record<string, boolean>>({})
  const [showAll, setShowAll] = useState(false)

  if (!report) {
    return (
      <div>
        <Empty icon="🔍" title="That CQMP month is not on this device">
          It may have been deleted, or belong to the other market.
        </Empty>
        <Link to="/cqmp" className="link-btn">
          ← Back to CQMP
        </Link>
      </div>
    )
  }

  const prior = priorReport(report.month, reports)
  const progress = progressOf(report)
  const kpis = kpiSummary(report, prior)
  const done = CQMP_OPERATIONS.filter((op) =>
    op.kpis.every((k) => isReported(findMetric(report, op.id, k))),
  )

  async function generate(): Promise<void> {
    if (!report) return
    setGenerating(true)
    try {
      const filename = await downloadDeck({ report, prior, market: activeMarket() })
      notifyUser(`${filename} downloaded.`)
    } catch (err) {
      console.error('CQMP: deck generation failed', err)
      notifyUser(
        err instanceof Error ? `The deck could not be built: ${err.message}` : 'The deck could not be built.',
        'warn',
      )
    } finally {
      setGenerating(false)
    }
  }

  async function remove(): Promise<void> {
    if (!report) return
    const ok = await confirmAction({
      title: `Delete the ${monthLabel(report.month)} report?`,
      body: 'The numbers, notes and screenshots for this month will be removed. You can undo for a few seconds.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    deleteReport(report.id)
    navigate('/cqmp')
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <Link to="/cqmp" className="link-btn">
            ← CQMP
          </Link>
          <h1>{monthLabel(report.month)}</h1>
          <div className="subtle">Clinical Quality Management Plan — monthly KPI review</div>
        </div>
        <div className="btn-row">
          <button className="btn" onClick={() => setImporting(true)}>
            ⬆ Paste KPIs
          </button>
          <button className="btn primary" onClick={() => void generate()} disabled={generating}>
            {generating ? 'Building…' : '📊 Generate PowerPoint'}
          </button>
          <button className="btn" onClick={() => printMinutes(report, prior)}>
            🖨 Minutes
          </button>
          <button className="btn" onClick={() => downloadMinutes(report, prior)}>
            ⬇ Minutes (.doc)
          </button>
          {/* The filing step. Deliberately a link out rather than a submit
              button: there is no API and no credential here, and a PWA that
              silently failed to file a compliance document would be worse than
              one that just opens the form. */}
          <a
            className="btn"
            href={CQMP_SUBMIT_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            ↗ Submit
          </a>
          <button className="btn danger" onClick={() => void remove()}>
            Delete
          </button>
        </div>
      </div>

      <div className="subtle" style={{ fontSize: 12, marginTop: 4 }}>
        Filing: print the minutes to PDF, then <strong>Submit</strong> opens the Smartsheet intake
        form to attach it. The form is the system of record for the submission — this app does not
        post to it, so nothing is filed until you press send there.
      </div>

      <div className="stat-grid">
        <Stat value={`${kpis.met}/${kpis.rows.length}`} label="Meeting target" />
        <Stat value={`${progress.reported}/${progress.expected}`} label="Measures reported" />
        <Stat value={`${progress.withScreenshot}/${progress.expected}`} label="With a screenshot" />
        <Stat value={prior ? monthLabel(prior.month) : '—'} label="Compared against" />
      </div>

      {/* The question the meeting exists to answer, before the twenty-six cards
          that answer it one at a time. A miss with nothing said about it is the
          thing that gets asked in the room, so it is named here by operation
          and measure rather than left to be discovered on the printed page. */}
      {kpis.unexplained.length > 0 && (
        <div className="banner crit">
          <strong>
            {kpis.unexplained.length} measure{kpis.unexplained.length === 1 ? ' is' : 's are'} below
            target with no explanation recorded.
          </strong>{' '}
          The minutes will print “explanation required” against{' '}
          {kpis.unexplained
            .map((r) => `${r.operation.name} ${CQMP_KPIS[r.kpiId].short.toLowerCase()}`)
            .join(', ')}
          .
        </div>
      )}
      {kpis.below === 0 && kpis.notReported === 0 && kpis.rows.length > 0 && (
        <div className="banner ok">
          Every measure reported is at or above target this month.
        </div>
      )}

      {importing && <KpiImport report={report} onClose={() => setImporting(false)} />}

      <MeetingPanel report={report} />

      <div className="card" style={{ padding: 14, marginTop: 12 }}>
        <div className="field">
          <label htmlFor="cqmp-presenter">Presenting</label>
          <DebouncedInput
            id="cqmp-presenter"
            value={report.presenter ?? ''}
            placeholder="Name on the title slide"
            onCommit={(v) => updateReport(report.id, { presenter: v })}
          />
        </div>
        <div className="field">
          <label htmlFor="cqmp-summary">Summary & action items</label>
          <DebouncedInput
            id="cqmp-summary"
            multiline
            value={report.summary ?? ''}
            placeholder="One line per bullet — this becomes the closing slide"
            onCommit={(v) => updateReport(report.id, { summary: v })}
          />
        </div>
      </div>

      <div className="toolbar">
        <div className="grow">
          <div className="section-title" style={{ marginTop: 0 }}>
            KPI entry
          </div>
          <div className="subtle" style={{ fontSize: 12 }}>
            {done.length} of {CQMP_OPERATIONS.length} business units complete
            {done.length > 0 && !showAll && ' — completed ones are folded away'}
          </div>
        </div>
        {done.length > 0 && (
          <button className="btn sm" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Hide completed' : `Show all ${CQMP_OPERATIONS.length}`}
          </button>
        )}
      </div>

      {CQMP_OPERATIONS.map((op) => {
        const reported = op.kpis.filter((k) => isReported(findMetric(report, op.id, k))).length
        const complete = reported === op.kpis.length
        // A finished unit folds away on its own. With eight of them and
        // twenty-six measures, the useful question while typing is what is
        // LEFT — and the way to answer it is for the done ones to stop
        // taking up the screen. Manually opened ones stay open.
        const open = manual[op.id] ?? (!complete || showAll)
        return (
          <section key={op.id}>
            <button
              className={`op-head${complete ? ' is-done' : ''}`}
              aria-expanded={open}
              onClick={() => setManual({ ...manual, [op.id]: !open })}
            >
              <span className="op-caret" aria-hidden="true">
                {open ? '▾' : '▸'}
              </span>
              <span className="grow">
                <span className="title">{op.name}</span>
                <span className="subtle" style={{ fontWeight: 400 }}>
                  {' '}
                  · {op.model}
                </span>
              </span>
              <span className={`pill ${complete ? 'ok' : 'muted'}`}>
                {complete ? '✓ Complete' : `${reported}/${op.kpis.length}`}
              </span>
            </button>
            {open &&
              op.kpis.map((kpiId: CqmpKpiId) => {
                const metric: CqmpMetric = findMetric(report, op.id, kpiId) ?? {
                  opId: op.id,
                  kpiId,
                  value: null,
                  target: null,
                  images: [],
                }
                return (
                  <MetricCard
                    key={`${op.id}-${kpiId}`}
                    reportId={report.id}
                    opId={op.id}
                    kpiId={kpiId}
                    metric={metric}
                    prior={findMetric(prior, op.id, kpiId)}
                  />
                )
              })}
          </section>
        )
      })}

      <div className="subtle" style={{ fontSize: 12, margin: '16px 0 8px' }}>
        Screenshots stay on this device. The numbers, targets and notes sync to the other
        administrator devices; the images do not, so generate the deck on the machine the captures
        were taken on.
      </div>
    </div>
  )
}
