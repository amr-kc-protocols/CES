import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import DebouncedInput from '../../components/DebouncedInput'
import { Empty, Stat } from '../../components/ui'
import { confirmAction, notifyUser } from '../../lib/dialog'
import { monthLabel } from '../../lib/date'
import { activeMarket } from '../../lib/market'
import { CQMP_KPIS, CQMP_OPERATIONS, type CqmpKpiId } from '../../data/cqmp'
import MetricCard from './MetricCard'
import MeetingPanel from './MeetingPanel'
import {
  deleteReport,
  findMetric,
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
          <button className="btn primary" onClick={() => void generate()} disabled={generating}>
            {generating ? 'Building…' : '📊 Generate PowerPoint'}
          </button>
          <button className="btn" onClick={() => printMinutes(report, prior)}>
            🖨 Minutes
          </button>
          <button className="btn" onClick={() => downloadMinutes(report, prior)}>
            ⬇ Minutes (.doc)
          </button>
          <button className="btn danger" onClick={() => void remove()}>
            Delete
          </button>
        </div>
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

      {CQMP_OPERATIONS.map((op) => (
        <section key={op.id}>
          <div className="section-title">
            {op.name} <span className="subtle" style={{ fontWeight: 400 }}>· {op.model}</span>
          </div>
          {op.kpis.map((kpiId: CqmpKpiId) => {
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
      ))}

      <div className="subtle" style={{ fontSize: 12, margin: '16px 0 8px' }}>
        Screenshots stay on this device. The numbers, targets and notes sync to the other
        administrator devices; the images do not, so generate the deck on the machine the captures
        were taken on.
      </div>
    </div>
  )
}
