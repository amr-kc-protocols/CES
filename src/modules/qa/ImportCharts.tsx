import { useMemo, useState } from 'react'
import { Modal } from '../../components/ui'
import { parseTable } from '../../lib/csv'
import { addCharts, importBotReviews, type ChartInput } from './qaStore'
import { parseBotBatch, type ExternalReview } from './botBridge'
import type { OperationId } from '../../types'

// Fields we can pull out of a call-list export. incidentNumber is the only
// required one; the rest enrich the review screen and provider stats.
const FIELDS: { key: keyof ChartInput; label: string; required?: boolean; hints: string[] }[] = [
  { key: 'incidentNumber', label: 'Incident / Run #', required: true, hints: ['incident', 'run', 'pcr', 'report', 'cad', 'call number', 'call #', 'id'] },
  { key: 'date', label: 'Date', hints: ['date', 'dispatch', 'call date', 'service date'] },
  { key: 'provider', label: 'Provider', hints: ['provider', 'primary', 'crew lead', 'author', 'medic', 'clinician', 'attendant'] },
  { key: 'crew', label: 'Crew / Unit', hints: ['crew', 'unit', 'partner', 'vehicle'] },
  { key: 'chiefComplaint', label: 'Chief complaint', hints: ['complaint', 'chief', 'impression', 'reason', 'nature'] },
  { key: 'acuity', label: 'Acuity', hints: ['acuity', 'priority', 'severity', 'level'] },
]

function autoMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {}
  const used = new Set<string>()
  for (const f of FIELDS) {
    const found = headers.find((h) => {
      if (used.has(h)) return false
      const l = h.toLowerCase()
      return f.hints.some((hint) => l.includes(hint))
    })
    if (found) {
      map[f.key] = found
      used.add(found)
    } else {
      map[f.key] = ''
    }
  }
  return map
}

type Tab = 'csv' | 'manual' | 'bot'

export default function ImportCharts({
  periodId,
  operation,
  onClose,
}: {
  periodId: string
  operation: OperationId
  onClose: () => void
}) {
  const [tab, setTab] = useState<Tab>('csv')

  // CSV state
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')

  // Manual state
  const [manual, setManual] = useState<ChartInput>({ incidentNumber: '' })

  // Bot-bridge state
  const [botText, setBotText] = useState('')
  const [botReviews, setBotReviews] = useState<ExternalReview[]>([])
  const [botFileName, setBotFileName] = useState('')

  const previewCount = useMemo(() => {
    const col = mapping.incidentNumber
    if (!col) return rows.length
    return rows.filter((r) => (r[col] ?? '').trim() !== '').length
  }, [rows, mapping])

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError('')
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const text = await file.text()
    const table = parseTable(text)
    if (table.headers.length === 0) {
      setError('Could not read any columns from that file.')
      return
    }
    setHeaders(table.headers)
    setRows(table.rows)
    setMapping(autoMap(table.headers))
  }

  function importCsv() {
    const incCol = mapping.incidentNumber
    if (!incCol) return setError('Map the Incident / Run # column first.')
    const inputs: ChartInput[] = rows
      .map((r) => {
        const pick = (k: keyof ChartInput) => {
          const col = mapping[k]
          return col ? r[col]?.trim() || undefined : undefined
        }
        const incidentNumber = (r[incCol] ?? '').trim()
        if (!incidentNumber) return null
        return {
          incidentNumber,
          date: pick('date'),
          provider: pick('provider'),
          crew: pick('crew'),
          chiefComplaint: pick('chiefComplaint'),
          acuity: pick('acuity'),
          raw: r,
        } as ChartInput
      })
      .filter((x): x is ChartInput => x !== null)

    if (inputs.length === 0) return setError('No rows had an incident number.')
    const res = addCharts(periodId, operation, inputs)
    if (res.added === 0) {
      return setError(
        `All ${res.skipped} row${res.skipped === 1 ? ' is' : 's are'} already in this period — nothing imported.`,
      )
    }
    onClose()
    if (res.skipped > 0) {
      setTimeout(
        () =>
          alert(
            `Imported ${res.added} chart${res.added === 1 ? '' : 's'}; ` +
              `skipped ${res.skipped} duplicate${res.skipped === 1 ? '' : 's'} already in this period.`,
          ),
        50,
      )
    }
  }

  function addManual() {
    if (!manual.incidentNumber.trim()) return setError('Incident # is required.')
    const res = addCharts(periodId, operation, [manual])
    if (res.added === 0) {
      return setError(`#${manual.incidentNumber.trim()} is already in this period.`)
    }
    setManual({ incidentNumber: '' })
    setError('')
    onClose()
  }

  function parseBot(text: string) {
    setError('')
    const { reviews, error: err } = parseBotBatch(text)
    if (err) {
      setBotReviews([])
      setError(err)
      return
    }
    setBotReviews(reviews)
  }

  async function onBotFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBotFileName(file.name)
    const text = await file.text()
    setBotText(text)
    parseBot(text)
  }

  function importBot() {
    if (botReviews.length === 0) return setError('Nothing to import — load a bot batch first.')
    const res = importBotReviews(periodId, operation, botReviews)
    setError('')
    onClose()
    // Surface a quick summary of what landed where.
    setTimeout(
      () =>
        alert(
          `Imported ${res.total} bot review${res.total === 1 ? '' : 's'}: ` +
            `${res.matched} matched to existing charts, ${res.created} added as new.`,
        ),
      50,
    )
  }

  return (
    <Modal title="Add charts" onClose={onClose}>
      <div className="segmented" style={{ marginBottom: 14 }}>
        <button className={tab === 'csv' ? 'active' : ''} onClick={() => setTab('csv')}>
          Import CSV
        </button>
        <button className={tab === 'manual' ? 'active' : ''} onClick={() => setTab('manual')}>
          Manual add
        </button>
        <button className={tab === 'bot' ? 'active' : ''} onClick={() => setTab('bot')}>
          Bot reviews
        </button>
      </div>

      {error && <div className="banner crit">{error}</div>}

      {tab === 'csv' && (
        <div>
          <div className="field">
            <label>Call-list export (.csv)</label>
            <input type="file" accept=".csv,text/csv" onChange={onFile} />
            <div className="help-text">
              Export the month’s call list from Ninth Brain / ImageTrend. Columns are matched
              automatically — adjust below if needed.
            </div>
          </div>

          {headers.length > 0 && (
            <>
              <div className="section-title" style={{ marginTop: 8 }}>
                Column mapping · {fileName}
              </div>
              {FIELDS.map((f) => (
                <div className="field" key={f.key} style={{ marginBottom: 10 }}>
                  <label>
                    {f.label} {f.required && <span style={{ color: 'var(--red)' }}>*</span>}
                  </label>
                  <select
                    value={mapping[f.key] ?? ''}
                    onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}
                  >
                    <option value="">— none —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}

              <div className="banner info">
                {previewCount} chart{previewCount === 1 ? '' : 's'} ready to import into the pool.
              </div>
              <div className="btn-row">
                <button className="btn primary" onClick={importCsv} disabled={previewCount === 0}>
                  Import {previewCount} charts
                </button>
                <button className="btn" onClick={onClose}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'manual' && (
        <div>
          <div className="field">
            <label>Incident / Run # *</label>
            <input
              value={manual.incidentNumber}
              onChange={(e) => setManual({ ...manual, incidentNumber: e.target.value })}
              autoFocus
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Date</label>
              <input
                type="date"
                value={manual.date ?? ''}
                onChange={(e) => setManual({ ...manual, date: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Provider</label>
              <input
                value={manual.provider ?? ''}
                onChange={(e) => setManual({ ...manual, provider: e.target.value })}
              />
            </div>
          </div>
          <div className="field">
            <label>Chief complaint</label>
            <input
              value={manual.chiefComplaint ?? ''}
              onChange={(e) => setManual({ ...manual, chiefComplaint: e.target.value })}
            />
          </div>
          <div className="btn-row">
            <button className="btn primary" onClick={addManual}>
              Add chart
            </button>
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {tab === 'bot' && (
        <div>
          <div className="banner info">
            Import scored reviews from the Ninth Brain Chart Review Agent. Reviews are matched to
            charts in this period by incident number; anything new is added as a scored chart.
          </div>
          <div className="field">
            <label>Bot batch (.json or .csv)</label>
            <input type="file" accept=".json,.csv,application/json,text/csv" onChange={onBotFile} />
            {botFileName && <div className="help-text">Loaded {botFileName}</div>}
          </div>
          <div className="field">
            <label>…or paste the batch</label>
            <textarea
              value={botText}
              onChange={(e) => {
                setBotText(e.target.value)
                parseBot(e.target.value)
              }}
              placeholder='{"reviews": [{"incidentNumber": "24001", "scorePct": 92, "notes": "…"}]}'
              style={{ minHeight: 120, fontFamily: 'monospace', fontSize: 13 }}
            />
          </div>
          {botReviews.length > 0 && (
            <div className="banner info">
              {botReviews.length} review{botReviews.length === 1 ? '' : 's'} parsed and ready to
              import.
            </div>
          )}
          <div className="btn-row">
            <button className="btn primary" onClick={importBot} disabled={botReviews.length === 0}>
              Import {botReviews.length || ''} reviews
            </button>
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
