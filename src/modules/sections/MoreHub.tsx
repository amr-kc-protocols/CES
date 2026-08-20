import { HubHead, HubLocked, HubRow, itemAt } from './SectionHub'
import { useSection } from '../../lib/nav'
import { useDB } from '../../lib/store'
import { useSyncStatus } from '../../lib/sync'
import { marketName } from '../../lib/market'
import { useCESummary } from '../ce/ceStore'

// Class history is left with its own blurb on purpose. Its figures come from
// the transcribed legacy record — a large data module the History screen loads
// on demand — and importing it to print a count here would pull that whole
// file into this landing for everyone who taps More.

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export default function MoreHub() {
  const section = useSection('/more')
  const db = useDB()
  const { configured, signedIn, email, market } = useSyncStatus()
  const ce = useCESummary()

  const history = itemAt(section, '/history')
  const cqmp = itemAt(section, '/cqmp')
  const ceItem = itemAt(section, '/ce')
  const settings = itemAt(section, '/settings')

  const latest = db.cqmpReports.reduce<string>((best, r) => (r.month > best ? r.month : best), '')

  // What Settings is actually for, from where the person standing here sits:
  // whether this device's records are going anywhere but this device.
  const syncLine = !configured
    ? 'Local only — records stay on this device'
    : signedIn
      ? `Signed in${email ? ` as ${email}` : ''} · ${marketName(market)} · syncing`
      : 'Signed out — records stay on this device until you sign in'

  if (!section) return <HubLocked title="Nothing here" why="No additional screens are available to this account." />

  return (
    <div>
      <HubHead section={section} />
      <div className="list">
        {history && <HubRow item={history} />}
        {cqmp && (
          <HubRow
            item={cqmp}
            meta={
              db.cqmpReports.length
                ? `${db.cqmpReports.length} report${db.cqmpReports.length === 1 ? '' : 's'} · latest ${monthLabel(latest)}`
                : undefined
            }
          />
        )}
        {ceItem && (
          <HubRow
            item={ceItem}
            meta={`${ce.overdue} overdue · ${ce.dueThisWeek} due this week`}
            pill={
              ce.overdue + ce.dueThisWeek > 0 ? (
                <span className="pill crit">{ce.overdue + ce.dueThisWeek}</span>
              ) : undefined
            }
          />
        )}
        {settings && <HubRow item={settings} meta={syncLine} />}
      </div>
    </div>
  )
}
