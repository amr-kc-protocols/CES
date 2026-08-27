import { useMemo, useState } from 'react'
import { Modal } from '../../components/ui'
import { notifyUser } from '../../lib/dialog'
import { CQMP_KPIS, CQMP_OPERATIONS, cqmpOperationName, cqmpTarget } from '../../data/cqmp'
import { findMetric, isReported, updateMetric } from './cqmpStore'
import { readPastedKpis, type KpiFinding, type ReadConfidence } from './kpiParse'
import type { CqmpReport } from '../../types'

// ---------------------------------------------------------------------------
// Paste the month's summary in; take the numbers out.
//
// A review queue, not an importer. Every figure arrives switched on or off
// according to how confident the read was, with the line that produced it
// underneath, and nothing is written until Apply. These numbers go onto a
// document that goes to a regional director — the point is to save the typing,
// not to remove the reading.
//
// Two rules the layout exists to enforce:
//
//   A figure the app is unsure about starts UNCHECKED. The default has to be
//   the safe one, because the way this fails is somebody pressing Apply without
//   scrolling.
//
//   A measure that already has a number typed by hand is called out as a
//   conflict and also starts unchecked. Silently overwriting what a person
//   entered is the worst thing an importer can do.
//
// The pasted text is never stored. It lives in the box until the numbers are
// applied, and only the result and its case counts are kept — targets are
// fixed in the catalogue and are never written from a paste.
// ---------------------------------------------------------------------------

const CONF_LABEL: Record<ReadConfidence, string> = {
  read: 'Read',
  inferred: 'Inferred',
  uncertain: 'Needs a look',
}

const CONF_CLASS: Record<ReadConfidence, string> = {
  read: 'ok',
  inferred: 'warn',
  uncertain: 'crit',
}

const EXAMPLE = `Kansas City
Blood glucose verification: 81.4% (goal 90%)
Advanced airway verification: 100% — 4 of 4

Linn County
Blood glucose 96.2%, stroke bundle 82.4%, STEMI bundle 91.7%`

interface Row {
  key: string
  opId: string
  finding: KpiFinding
  opBecause: string
  opConfidence: ReadConfidence
  /** A number already on the record that this would replace. */
  existing: number | null
  take: boolean
}

export default function KpiImport({
  report,
  onClose,
}: {
  report: CqmpReport
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const [dropped, setDropped] = useState<Set<string>>(new Set())
  const [taken, setTaken] = useState<Set<string>>(new Set())

  // Re-read on every keystroke. The paste is small, the parse is cheap, and a
  // live read means the person can see straight away whether their summary is
  // in a shape the app understands rather than pressing a button and hoping.
  const { rows, problems } = useMemo(() => {
    if (!text.trim()) return { rows: [] as Row[], problems: [] as string[] }
    const reads = readPastedKpis(text)
    const out: Row[] = []
    const trouble: string[] = []
    for (const read of reads) {
      trouble.push(...read.problems)
      if (!read.opId) continue
      for (const finding of read.findings) {
        const current = findMetric(report, read.opId, finding.kpiId)
        const existing = isReported(current) ? current!.value : null
        const conflict = existing !== null && Math.abs(existing - (finding.value ?? 0)) > 0.01
        out.push({
          key: `${read.opId}:${finding.kpiId}`,
          opId: read.opId,
          finding,
          opBecause: read.opBecause,
          opConfidence: read.opConfidence,
          existing,
          // Confident reads that replace nothing are on. Everything else waits
          // for a person to say yes.
          take:
            finding.confidence === 'read' && read.opConfidence !== 'uncertain' && !conflict,
        })
      }
    }
    const unassigned = reads.filter((r) => !r.opId && r.findings.length > 0)
    if (unassigned.length) {
      trouble.push(
        `${unassigned.reduce((n, r) => n + r.findings.length, 0)} figure(s) could not be matched to an operation — ${unassigned[0].opBecause}. Put the operation name on its own line above its measures.`,
      )
    }
    return { rows: out, problems: [...new Set(trouble)] }
  }, [text, report])

  // The parse is the source of truth; these two sets are the person's overrides
  // on top of it, so retyping the paste never silently re-arms a row they
  // deliberately switched off.
  const isTaken = (r: Row) => (taken.has(r.key) ? true : dropped.has(r.key) ? false : r.take)
  const toggle = (r: Row, on: boolean) => {
    setTaken((s) => {
      const next = new Set(s)
      on ? next.add(r.key) : next.delete(r.key)
      return next
    })
    setDropped((s) => {
      const next = new Set(s)
      on ? next.delete(r.key) : next.add(r.key)
      return next
    })
  }

  const byOp = new Map<string, Row[]>()
  for (const r of rows) {
    if (!byOp.has(r.opId)) byOp.set(r.opId, [])
    byOp.get(r.opId)!.push(r)
  }
  const takingRows = rows.filter(isTaken)
  const missing = CQMP_OPERATIONS.filter((o) => !byOp.has(o.id))
  const allOn = rows.length > 0 && rows.every(isTaken)

  function apply(): void {
    for (const r of takingRows) {
      // Only the result and its counts. Targets are fixed in the catalogue and
      // are never written from a paste — a goal stated in somebody's summary is
      // a claim about the standard, not the standard.
      updateMetric(report.id, r.opId, r.finding.kpiId, {
        value: r.finding.value,
        numerator: r.finding.numerator ?? null,
        denominator: r.finding.denominator ?? null,
      })
    }
    notifyUser(
      `${takingRows.length} figure${takingRows.length === 1 ? '' : 's'} applied. Check them against the source before generating the minutes.`,
    )
    onClose()
  }

  return (
    <Modal title="Paste the month's KPI summary" onClose={onClose}>
      <div className="banner info" style={{ marginTop: 0 }}>
        Paste a summary of the operations' figures — one line per measure, with the operation named
        above its measures or on the same line. <strong>Nothing is saved until you press Apply</strong>,
        and the pasted text itself is never stored.
      </div>

      <div className="field">
        <label htmlFor="kpi-paste">Summary</label>
        <textarea
          id="kpi-paste"
          rows={8}
          value={text}
          placeholder={EXAMPLE}
          onChange={(e) => setText(e.target.value)}
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 }}
        />
        <div className="help-text">
          {rows.length > 0
            ? `${rows.length} figure${rows.length === 1 ? '' : 's'} found across ${byOp.size} operation${byOp.size === 1 ? '' : 's'}.`
            : 'A stated goal is recognised as a goal, not a result, so "goal 90%, actual 81.4%" reads correctly. Targets are fixed and never taken from a paste.'}
        </div>
      </div>

      {problems.length > 0 && (
        <div className="banner warn">
          <strong>
            {problems.length} thing{problems.length === 1 ? '' : 's'} to know
          </strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {problems.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {[...byOp.entries()].map(([opId, opRows]) => (
        <section key={opId}>
          <div className="section-title">
            {cqmpOperationName(opId)}{' '}
            <span className="subtle" style={{ fontWeight: 400 }}>
              · {opRows[0].opBecause}
            </span>
          </div>
          {opRows.map((r) => (
            <label
              key={r.key}
              className={`row left-accent acc-${CONF_CLASS[r.finding.confidence]}`}
              style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                checked={isTaken(r)}
                style={{ width: 'auto', minHeight: 0, marginTop: 4 }}
                onChange={(e) => toggle(r, e.target.checked)}
              />
              <div className="grow">
                <div className="title">
                  {CQMP_KPIS[r.finding.kpiId].short} —{' '}
                  <strong>{r.finding.value?.toFixed(1)}%</strong>
                  {r.finding.numerator !== undefined && (
                    <span className="subtle" style={{ fontWeight: 400 }}>
                      {' '}
                      ({r.finding.numerator} of {r.finding.denominator})
                    </span>
                  )}
                  {/* A goal stated in the paste is only worth showing when it
                      disagrees with the standard — then it is worth checking
                      which of the two is out of date. */}
                  {typeof r.finding.target === 'number' &&
                    r.finding.target !== cqmpTarget(r.finding.kpiId) && (
                      <span style={{ fontWeight: 400, color: 'var(--warn)' }}>
                        {' '}
                        · says goal {r.finding.target}%, ours is{' '}
                        {cqmpTarget(r.finding.kpiId)}%
                      </span>
                    )}
                </div>
                {r.existing !== null && (
                  <div className="meta" style={{ color: 'var(--crit)' }}>
                    Replaces {r.existing.toFixed(1)}% already on the record — check which is right
                    before taking this.
                  </div>
                )}
                {/* The line it came from, verbatim. A number with no provenance
                    is a number nobody can check. */}
                <div className="meta">
                  Line {r.finding.line}: “{r.finding.because}”
                </div>
              </div>
              <span className={`pill ${CONF_CLASS[r.finding.confidence]}`}>
                {CONF_LABEL[r.finding.confidence]}
              </span>
            </label>
          ))}
        </section>
      ))}

      {rows.length > 0 && missing.length > 0 && (
        <div className="banner warn">
          <strong>Nothing read for {missing.map((o) => o.name).join(', ')}.</strong> Those figures
          are not in the paste, or their lines are in a shape the app did not recognise.
        </div>
      )}

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn primary" disabled={takingRows.length === 0} onClick={apply}>
          Apply {takingRows.length} figure{takingRows.length === 1 ? '' : 's'}
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        {rows.length > 0 && (
          <button
            className="btn"
            style={{ marginLeft: 'auto' }}
            onClick={() => {
              if (allOn) {
                setTaken(new Set())
                setDropped(new Set(rows.map((r) => r.key)))
              } else {
                setTaken(new Set(rows.map((r) => r.key)))
                setDropped(new Set())
              }
            }}
          >
            {allOn ? 'Take none' : 'Take all'}
          </button>
        )}
      </div>
    </Modal>
  )
}
