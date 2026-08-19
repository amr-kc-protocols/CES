import { Stat } from '../../components/ui'
import { HubHead, HubLocked, HubRow, itemAt } from './SectionHub'
import { useSection } from '../../lib/nav'
import { useDB } from '../../lib/store'
import { formatDate } from '../../lib/date'

// Both tools keep their records in the local store, so the counts here are the
// same rows their own screens list — no separate tally to fall out of step.

function lastOf<T>(rows: T[], at: (r: T) => string): T | undefined {
  return rows.reduce<T | undefined>((best, r) => (!best || at(r) > at(best) ? r : best), undefined)
}

export default function ToolsHub() {
  const section = useSection('/tools')
  const db = useDB()

  const reviewItem = itemAt(section, '/review')
  const simItem = itemAt(section, '/simulator')
  const qaItem = itemAt(section, '/qa')
  const botItem = itemAt(section, '/bot')

  const lastReview = lastOf(db.chartReviews, (r) => r.reviewedAt)
  const lastRun = lastOf(db.simRuns, (r) => r.startedAt)
  const flagged = db.simRuns.filter((r) => r.result === 'nr').length

  if (!section) {
    return (
      <HubLocked
        title="No tools on this account"
        why="Chart review and the simulator are limited to clinical leadership and instructors. Ask the Clinical Educator if you need access."
      />
    )
  }

  return (
    <div>
      <HubHead section={section} />

      {(reviewItem || simItem) && (
        <div className="stat-grid">
          {reviewItem && <Stat value={db.chartReviews.length} label="Charts reviewed" />}
          {simItem && <Stat value={db.simRuns.length} label="Simulations run" />}
          {simItem && flagged > 0 && <Stat value={flagged} label="Megacodes marked NR" alert />}
        </div>
      )}

      <div className="list">
        {reviewItem && (
          <HubRow
            item={reviewItem}
            meta={
              lastReview
                ? `${db.chartReviews.length} saved · last ${formatDate(lastReview.reviewedAt.slice(0, 10))}${
                    lastReview.reviewer ? ` by ${lastReview.reviewer}` : ''
                  }`
                : undefined
            }
          />
        )}
        {simItem && (
          <HubRow
            item={simItem}
            meta={
              lastRun
                ? `${db.simRuns.length} recorded · last ${lastRun.scenarioName} on ${formatDate(
                    lastRun.startedAt.slice(0, 10),
                  )}`
                : undefined
            }
          />
        )}
        {qaItem && <HubRow item={qaItem} meta={`${db.qaPeriods.length} sampling period${db.qaPeriods.length === 1 ? '' : 's'}`} />}
        {botItem && <HubRow item={botItem} />}
      </div>
    </div>
  )
}
