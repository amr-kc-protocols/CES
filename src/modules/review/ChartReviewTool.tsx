import { useMemo, useState } from 'react'
import { Empty } from '../../components/ui'
import SavedIndicator from '../../components/SavedIndicator'
import { confirmAction, notifyUser } from '../../lib/dialog'
import { formatDate, todayISO } from '../../lib/date'
import { downloadXlsx } from '../../lib/xlsx'
import {
  REVIEW_TYPES,
  visibleSections,
  type ReviewQuestion,
  type ReviewType,
} from '../../data/chartReview'
import {
  addChartReview,
  blankReview,
  crewTally,
  deleteChartReview,
  inRange,
  overall,
  reviewWorkbook,
  tally,
  unanswered,
  updateChartReview,
  useChartReviews,
} from './chartReviewStore'
import { useSyncStatus } from '../../lib/sync'
import type { ChartReviewEntry } from '../../types'

// ---------------------------------------------------------------------------
// The Ninth Brain chart review questionnaire, run in CES.
//
// Three things this does that the form it replaces could not: it keeps every
// review in one place, it tallies them per question and per crew member, and it
// exports the lot as a workbook. The questionnaire itself is a transcription —
// see data/chartReview.ts, which is where a new review category lands.
// ---------------------------------------------------------------------------

type Draft = Omit<ChartReviewEntry, 'id' | 'updatedAt'> & { id?: string }

function YesNo({
  value,
  onChange,
  disabled,
}: {
  value: boolean | undefined
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="btn-row" role="group">
      {[true, false].map((v) => (
        <button
          key={String(v)}
          type="button"
          disabled={disabled}
          className={`btn sm${value === v ? ' primary' : ''}`}
          aria-pressed={value === v}
          onClick={() => onChange(v)}
        >
          {v ? 'Yes' : 'No'}
        </button>
      ))}
    </div>
  )
}

function QuestionRow({
  q,
  draft,
  set,
}: {
  q: ReviewQuestion
  draft: Draft
  set: (patch: Partial<Draft>) => void
}) {
  const answer = draft.answers[q.id]
  const setAnswer = (v: boolean | string | string[]) =>
    set({ answers: { ...draft.answers, [q.id]: v } })

  return (
    <div className="cr-q">
      <div className="cr-q-prompt">
        {q.required && <span className="cr-req" aria-hidden="true">*</span>}
        {q.prompt}
      </div>
      {q.help && <div className="help-text" style={{ marginTop: 2 }}>{q.help}</div>}

      <div style={{ marginTop: 6 }}>
        {q.kind === 'yesno' && (
          <YesNo value={typeof answer === 'boolean' ? answer : undefined} onChange={setAnswer} />
        )}

        {q.kind === 'select' && (
          <select
            value={typeof answer === 'string' ? answer : ''}
            onChange={(e) => setAnswer(e.target.value)}
          >
            <option value="">—</option>
            {(q.options ?? []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        )}

        {q.kind === 'multi' && (
          <div className="cr-multi">
            {(q.options ?? []).map((o) => {
              const list = Array.isArray(answer) ? answer : []
              const on = list.includes(o)
              return (
                <label key={o} className={`cr-chip${on ? ' on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      setAnswer(on ? list.filter((x) => x !== o) : [...list, o])
                    }
                  />
                  {o}
                </label>
              )
            })}
          </div>
        )}

        {q.kind === 'text' && (
          <input
            value={typeof answer === 'string' ? answer : ''}
            onChange={(e) => setAnswer(e.target.value)}
          />
        )}
      </div>
    </div>
  )
}

function ReviewForm({
  initial,
  onClose,
}: {
  initial: Draft
  onClose: () => void
}) {
  const [draft, setDraft] = useState<Draft>(initial)
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  // The categories question lives inside the CQM section, so what the form
  // shows depends on an answer the form itself collects. Read it back out
  // rather than keeping a second copy that can disagree.
  const categories = Array.isArray(draft.answers['cqm.categories'])
    ? (draft.answers['cqm.categories'] as string[])
    : []
  const sections = visibleSections(draft.types as ReviewType[], categories)
  const missing = unanswered({ ...draft, categories })

  const save = (status: ChartReviewEntry['status']) => {
    const entry: Draft = { ...draft, categories, status }
    if (draft.id) {
      updateChartReview(draft.id, entry as Partial<ChartReviewEntry>)
    } else {
      const { id: _ignored, ...rest } = entry
      addChartReview(rest)
    }
    notifyUser(
      status === 'complete' ? 'Review saved and counted in the tally.' : 'Draft saved.',
      'info',
    )
    onClose()
  }

  return (
    <div className="cr-form">
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <button className="btn" onClick={onClose}>
          ← Back to reviews
        </button>
        <div className="spacer" />
        <SavedIndicator />
      </div>

      <div className="card" style={{ padding: 14 }}>
        <div className="section-title" style={{ marginTop: 0 }}>
          Chart
        </div>
        <div className="help-text" style={{ marginTop: 0 }}>
          No patient identifiers. The run number is the link back to ImageTrend, which stays the
          system of record.
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="cr-incident">Incident / PCR number</label>
            <input
              id="cr-incident"
              value={draft.incidentNumber}
              onChange={(e) => set({ incidentNumber: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="cr-date">Date of service</label>
            <input
              id="cr-date"
              type="date"
              value={draft.serviceDate ?? ''}
              onChange={(e) => set({ serviceDate: e.target.value })}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="cr-crew">Crew reviewed</label>
          <input
            id="cr-crew"
            value={draft.crew.join(', ')}
            onChange={(e) =>
              set({ crew: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })
            }
            placeholder="Separate names with commas"
          />
          <div className="help-text">
            Every name here gets the review counted against them. This is what makes a per-employee
            tally possible — and what proves a Phase 1 new hire had 100% of their charts reviewed.
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="cr-reviewer">Reviewer</label>
            <input
              id="cr-reviewer"
              value={draft.reviewer}
              onChange={(e) => set({ reviewer: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="cr-reviewed">Review date</label>
            <input
              id="cr-reviewed"
              type="date"
              value={draft.reviewedAt}
              onChange={(e) => set({ reviewedAt: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 14, marginTop: 12 }}>
        <div className="section-title" style={{ marginTop: 0 }}>
          Review selection
        </div>
        <div className="help-text" style={{ marginTop: 0 }}>
          Select at least one. Each adds its own section below.
        </div>
        <div className="cr-multi">
          {REVIEW_TYPES.map((t) => {
            const on = draft.types.includes(t.id)
            return (
              <label key={t.id} className={`cr-chip${on ? ' on' : ''}`}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() =>
                    set({
                      types: on ? draft.types.filter((x) => x !== t.id) : [...draft.types, t.id],
                    })
                  }
                />
                {t.label}
              </label>
            )
          })}
        </div>
      </div>

      {draft.types.length === 0 ? (
        <div className="banner info" style={{ marginTop: 12 }}>
          Choose a review type above to see the questions.
        </div>
      ) : (
        sections.map((s) => (
          <div className="card" style={{ padding: 14, marginTop: 12 }} key={s.id}>
            <div className="section-title" style={{ marginTop: 0 }}>
              {s.title}
            </div>
            {s.intro && (
              <div className="help-text" style={{ marginTop: 0 }}>
                {s.intro}
              </div>
            )}
            {s.questions.map((q) => (
              <QuestionRow key={q.id} q={q} draft={draft} set={set} />
            ))}
            {s.id === 'cqm' && categories.includes('Other') && (
              <div className="field">
                <label htmlFor="cr-other">If Other</label>
                <input
                  id="cr-other"
                  value={draft.categoryOther ?? ''}
                  onChange={(e) => set({ categoryOther: e.target.value })}
                />
              </div>
            )}
          </div>
        ))
      )}

      <div className="card" style={{ padding: 14, marginTop: 12 }}>
        <div className="field">
          <label htmlFor="cr-notes">Notes</label>
          <textarea
            id="cr-notes"
            rows={3}
            value={draft.notes ?? ''}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </div>
      </div>

      {missing.length > 0 && draft.types.length > 0 && (
        <div className="banner warn" style={{ marginTop: 12 }}>
          <strong>
            {missing.length} question{missing.length === 1 ? '' : 's'} still unanswered.
          </strong>{' '}
          A draft can be saved either way — an unanswered question is left out of the tally rather
          than counted as a failure, so a half-finished review does not drag a crew member's score
          down.
        </div>
      )}

      <div className="btn-row" style={{ marginTop: 14, marginBottom: 24 }}>
        <button
          className="btn primary"
          disabled={draft.types.length === 0 || !draft.incidentNumber.trim()}
          onClick={() => save('complete')}
        >
          Save review
        </button>
        <button className="btn" onClick={() => save('draft')}>
          Save as draft
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function ChartReviewTool() {
  const reviews = useChartReviews()
  const { email } = useSyncStatus()
  const [editing, setEditing] = useState<Draft | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const filtered = useMemo(() => inRange(reviews, from || undefined, to || undefined), [reviews, from, to])
  const scored = useMemo(() => filtered.filter((r) => r.status === 'complete'), [filtered])
  const stats = useMemo(() => overall(scored), [scored])
  const rows = useMemo(
    () => tally(scored).filter((t) => t.answered > 0).sort((a, b) => (a.percent ?? 101) - (b.percent ?? 101)),
    [scored],
  )
  const crew = useMemo(() => crewTally(scored), [scored])

  if (editing) {
    return <ReviewForm initial={editing} onClose={() => setEditing(null)} />
  }

  return (
    <div className="cr-tool">
      <div className="banner info">
        The Ninth Brain chart review questionnaire, kept here so every review counts toward a
        running tally. This measures <strong>documentation</strong> — whether the chart records
        what happened, not whether the care was right. <strong>No patient identifiers</strong>: the
        run number links back to ImageTrend.
      </div>

      <div className="stat-grid" style={{ marginTop: 12 }}>
        <div className="stat">
          <div className="value">{stats.reviews}</div>
          <div className="label">Reviews counted</div>
        </div>
        <div className="stat">
          <div className="value">{stats.percent === undefined ? '—' : `${stats.percent}%`}</div>
          <div className="label">Documentation compliant</div>
        </div>
        <div className="stat">
          <div className="value">{stats.escalated}</div>
          <div className="label">Escalated to leadership</div>
        </div>
        <div className="stat">
          <div className="value">{filtered.length - scored.length}</div>
          <div className="label">Drafts (not counted)</div>
        </div>
      </div>

      <div className="toolbar" style={{ marginTop: 12 }}>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="cr-from">From</label>
          <input id="cr-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="cr-to">To</label>
          <input id="cr-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="spacer" />
        <button
          className="btn"
          disabled={filtered.length === 0}
          title="Reviews, per-question tally and per-crew rollup as one workbook"
          onClick={() => {
            const stamp = todayISO()
            downloadXlsx(`chart-reviews-${stamp}.xlsx`, reviewWorkbook(filtered))
            notifyUser(`Exported ${filtered.length} review(s).`, 'info')
          }}
        >
          ⬇ Export workbook
        </button>
        <button className="btn primary" onClick={() => setEditing(blankReview(email ?? ''))}>
          + New review
        </button>
      </div>

      {rows.length > 0 && (
        <div className="card" style={{ padding: 12, marginTop: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
            Where documentation falls short
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Question</th>
                  <th style={{ textAlign: 'right' }}>Asked</th>
                  <th style={{ textAlign: 'right' }}>Compliant</th>
                  <th style={{ textAlign: 'right' }}>%</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((t) => (
                  <tr key={t.question.id}>
                    <td>
                      {t.question.prompt}
                      <div className="help-text" style={{ marginTop: 2 }}>
                        {t.section}
                        {t.question.scoring === 'no-good' && ' · No is the compliant answer'}
                        {t.question.scoring === 'flag' && ' · flag, not scored'}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>{t.answered}</td>
                    <td style={{ textAlign: 'right' }}>
                      {t.percent === undefined ? `${t.yes} yes` : t.compliant}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {t.percent === undefined ? (
                        <span className="pill muted">n/a</span>
                      ) : (
                        <span className={`pill ${t.percent >= 90 ? 'ok' : t.percent >= 75 ? 'warn' : 'crit'}`}>
                          {t.percent}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="help-text">
            Sorted worst first, across {stats.reviews} completed review
            {stats.reviews === 1 ? '' : 's'}. A question is only counted where it was in scope — a
            category block is not held against a review that was never asked it.
          </div>
        </div>
      )}

      {crew.length > 0 && (
        <div className="card" style={{ padding: 12, marginTop: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>By crew member</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Crew</th>
                  <th style={{ textAlign: 'right' }}>Reviews</th>
                  <th style={{ textAlign: 'right' }}>%</th>
                  <th style={{ textAlign: 'right' }}>Escalated</th>
                </tr>
              </thead>
              <tbody>
                {crew.map((c) => (
                  <tr key={c.crew}>
                    <td>{c.crew}</td>
                    <td style={{ textAlign: 'right' }}>{c.reviews}</td>
                    <td style={{ textAlign: 'right' }}>
                      {c.percent === undefined ? '—' : `${c.percent}%`}
                    </td>
                    <td style={{ textAlign: 'right' }}>{c.escalated || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <Empty icon="📋" title="No chart reviews yet">
          Start one with <strong>+ New review</strong>. The questions are the Ninth Brain set.
        </Empty>
      ) : (
        <div className="list" style={{ marginTop: 12 }}>
          {[...filtered]
            .sort((a, b) => (b.serviceDate ?? '').localeCompare(a.serviceDate ?? ''))
            .map((r) => (
              <div className="row" key={r.id}>
                <div className="grow">
                  <div className="title">
                    {r.incidentNumber || 'No run number'}{' '}
                    {r.status === 'draft' && <span className="pill warn">draft</span>}
                  </div>
                  <div className="meta">
                    {r.serviceDate ? formatDate(r.serviceDate) : 'no date'} ·{' '}
                    {r.crew.join(', ') || 'no crew'} ·{' '}
                    {[...r.types, ...r.categories].join(', ') || 'no type'}
                  </div>
                </div>
                <button
                  className="btn sm"
                  onClick={() => setEditing({ ...r, id: r.id })}
                >
                  Open
                </button>
                <button
                  className="btn sm danger"
                  onClick={async () => {
                    const ok = await confirmAction({
                      title: 'Delete this review?',
                      body: `The review of ${r.incidentNumber || 'this chart'} will be removed from the tally. This can be undone for a few seconds.`,
                      confirmLabel: 'Delete',
                      danger: true,
                    })
                    if (ok) deleteChartReview(r.id)
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
