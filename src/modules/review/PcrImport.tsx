import { useRef, useState } from 'react'
import { notifyUser } from '../../lib/dialog'
import { todayISO } from '../../lib/date'
import { addChartReview, allReviews } from './chartReviewStore'
import { autoReview, type AutoReview } from './autoAnswer'
import { REVIEW_TYPES } from '../../data/chartReview'
import { parseCharts, looksLikePcr } from './pcrParse'
import { readPcrPdf } from './pcrText'
import type { ChartReviewEntry } from '../../types'

// ---------------------------------------------------------------------------
// Bulk import: drop a stack of printed PCRs, get a stack of finished reviews.
//
// This is the time saver. A month of charts is a few hundred pages, most of
// them documented properly, and reading every one to tick Yes twenty-seven
// times is the work this removes. The app reads each chart, answers what the
// export can answer, and pulls a human in only where something is actually
// wrong.
//
// THE PDF NEVER LEAVES THIS MACHINE. pdf.js runs in the browser, the file is
// held in memory for as long as it takes to read, and what gets stored is the
// run number and the answers — no name, no address, no narrative. That is not
// incidental: these are patient records, and an import screen that posted them
// to a server would be a worse problem than the one it solves.
// ---------------------------------------------------------------------------

type Row = AutoReview & { file: string; alreadyReviewed: boolean }

const severityLabel = (s: string) => (s === 'stop' ? 'Needs a decision' : 'Worth a look')

/** 'cqm' is what gets stored; "CQM (Clinical Quality Management)" is what a person reads. */
const typeLabels = (ids: string[]) =>
  ids.map((id) => REVIEW_TYPES.find((t) => t.id === id)?.label ?? id).join(', ')

export default function PcrImport({
  reviewer,
  onClose,
  onOpen,
}: {
  reviewer: string
  onClose: () => void
  onOpen: (incidentNumber: string) => void
}) {
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState('')
  const [problems, setProblems] = useState<string[]>([])
  const [dragging, setDragging] = useState(false)
  const [imported, setImported] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const clear = rows.filter((r) => r.clear && !r.alreadyReviewed)
  const needsLook = rows.filter((r) => !r.clear && !r.alreadyReviewed)
  const duplicates = rows.filter((r) => r.alreadyReviewed)

  async function take(files: File[]) {
    const pdfs = files.filter((f) => /\.pdf$/i.test(f.name))
    if (!pdfs.length) {
      notifyUser('Drop one or more PDF exports from ImageTrend.', 'crit')
      return
    }
    setImported(false)
    setProblems([])
    const found: Row[] = []
    const bad: string[] = []
    const seen = new Set(allReviews().map((r) => r.incidentNumber.trim()).filter(Boolean))

    for (const file of pdfs) {
      setBusy(`Reading ${file.name}…`)
      try {
        const doc = await readPcrPdf(await file.arrayBuffer())
        if (!looksLikePcr(doc)) {
          bad.push(`${file.name} — not an ImageTrend PCR export.`)
          continue
        }
        const charts = parseCharts(doc)
        if (!charts.length) {
          bad.push(`${file.name} — no charts found in ${doc.pages.length} pages.`)
          continue
        }
        for (const chart of charts) {
          const review = autoReview(chart)
          if (!review.incidentNumber) {
            bad.push(`${file.name} pages ${chart.pageFrom}-${chart.pageTo} — no run number.`)
            continue
          }
          // A run number already in the list would double-count in the tally
          // and in the crew figures, so it is shown and skipped rather than
          // quietly added.
          const already = seen.has(review.incidentNumber) || found.some((r) => r.incidentNumber === review.incidentNumber)
          found.push({ ...review, file: file.name, alreadyReviewed: already })
        }
      } catch (err) {
        bad.push(`${file.name} — could not be read (${err instanceof Error ? err.message : 'unknown error'}).`)
      }
    }

    setBusy('')
    setRows(found)
    setProblems(bad)
    if (!found.length && !bad.length) notifyUser('Nothing to import.', 'crit')
  }

  function commit() {
    const stamp = todayISO()
    let count = 0
    for (const r of rows) {
      if (r.alreadyReviewed) continue
      const entry: Omit<ChartReviewEntry, 'id' | 'updatedAt'> = {
        types: r.types,
        categories: r.categories,
        incidentNumber: r.incidentNumber,
        serviceDate: r.serviceDate,
        crew: r.crew,
        reviewer,
        reviewedAt: stamp,
        answers: r.answers as ChartReviewEntry['answers'],
        questionNotes: r.findingNotes,
        source: 'import',
        answerSources: r.sources,
        flags: r.flags,
        // A chart that read clean is finished and counts. One with something to
        // decide is a draft: it stays out of the tally until a person has
        // agreed with it.
        status: r.clear ? 'complete' : 'draft',
      }
      addChartReview(entry)
      count++
    }
    setImported(true)
    notifyUser(
      `Imported ${count} review${count === 1 ? '' : 's'} — ${clear.length} counted, ${needsLook.length} waiting for you.`,
      'info',
    )
  }

  return (
    <div className="cr-import">
      <div className="toolbar cr-bar" style={{ marginBottom: 12 }}>
        <button className="btn" onClick={onClose}>
          ← Back
        </button>
        <div className="spacer" />
        {rows.length > 0 && !imported && (
          <button className="btn primary" onClick={commit} disabled={clear.length + needsLook.length === 0}>
            Import {clear.length + needsLook.length} review
            {clear.length + needsLook.length === 1 ? '' : 's'}
          </button>
        )}
      </div>

      <div className="banner info">
        Drop the printed PCRs here and the app reads them. <strong>The files stay on this
        computer</strong> — they are read in the browser and never uploaded. Only the run number
        and the answers are saved.
      </div>

      <div
        className={`cr-drop${dragging ? ' over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void take([...e.dataTransfer.files])
        }}
        onClick={() => fileInput.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInput.current?.click()
        }}
      >
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(e) => {
            void take([...(e.target.files ?? [])])
            e.target.value = ''
          }}
        />
        <div className="cr-drop-title">{busy || 'Drop PCR exports here, or click to choose'}</div>
        <div className="subtle">
          One export can hold any number of charts back to back — the whole batch at once is fine.
        </div>
      </div>

      {problems.length > 0 && (
        <div className="banner warn" style={{ marginTop: 12 }}>
          <strong>{problems.length} file{problems.length === 1 ? '' : 's'} could not be read.</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="stat-grid" style={{ marginTop: 12 }}>
            <div className="stat">
              <div className="value">{rows.length}</div>
              <div className="label">Charts read</div>
            </div>
            <div className="stat">
              <div className="value">{clear.length}</div>
              <div className="label">Clear — counted on import</div>
            </div>
            <div className="stat">
              <div className="value">{needsLook.length}</div>
              <div className="label">Need your decision</div>
            </div>
            <div className="stat">
              <div className="value">{duplicates.length}</div>
              <div className="label">Already reviewed — skipped</div>
            </div>
          </div>

          {needsLook.length > 0 && (
            <div className="card" style={{ padding: 12, marginTop: 12 }}>
              <div className="cr-import-head">
                {needsLook.length} chart{needsLook.length === 1 ? '' : 's'} to look at
              </div>
              {needsLook.map((r) => (
                <div key={r.incidentNumber} className="cr-import-row">
                  <div className="cr-import-run">
                    <button className="btn sm" onClick={() => onOpen(r.incidentNumber)} disabled={!imported}>
                      {r.incidentNumber}
                    </button>
                    <span className="subtle">
                      {r.serviceDate ?? '—'} · {r.crew.join(', ') || 'crew not read'}
                    </span>
                  </div>
                  <ul className="cr-import-flags">
                    {r.flags.map((f, i) => (
                      <li key={i} className={f.severity === 'stop' ? 'stop' : 'look'}>
                        <span className="cr-flag-tag">{severityLabel(f.severity)}</span>
                        <strong>{f.title}</strong>
                        <div className="subtle">{f.detail}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {clear.length > 0 && (
            <div className="card" style={{ padding: 12, marginTop: 12 }}>
              <div className="cr-import-head">
                {clear.length} chart{clear.length === 1 ? '' : 's'} read clean
              </div>
              <div className="subtle" style={{ marginBottom: 8 }}>
                Answered from the export and counted in the tally. Nothing in them contradicts
                itself and no field that matters is empty.
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Run</th>
                      <th>Date</th>
                      <th>Crew</th>
                      <th>Type</th>
                      <th>Categories</th>
                      <th style={{ textAlign: 'right' }}>Findings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clear.map((r) => (
                      <tr key={r.incidentNumber}>
                        <td>
                          <button className="btn sm" onClick={() => onOpen(r.incidentNumber)} disabled={!imported}>
                            {r.incidentNumber}
                          </button>
                        </td>
                        <td>{r.serviceDate ?? '—'}</td>
                        <td>{r.crew.join(', ') || '—'}</td>
                        <td>{typeLabels(r.types)}</td>
                        <td>{r.categories.join(', ') || '—'}</td>
                        <td style={{ textAlign: 'right' }}>{r.findings.length || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {duplicates.length > 0 && (
            <div className="banner warn" style={{ marginTop: 12 }}>
              <strong>
                {duplicates.length} chart{duplicates.length === 1 ? '' : 's'} already reviewed
              </strong>{' '}
              and skipped, so the tally is not counted twice:{' '}
              {duplicates.map((r) => r.incidentNumber).join(', ')}.
            </div>
          )}
        </>
      )}
    </div>
  )
}
