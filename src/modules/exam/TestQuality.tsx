import { useState } from 'react'
import { listAttemptsForAnalysis, listExamBank, type BankRow } from '../../lib/exam'
import {
  analyseExam,
  MIN_N_ITEM,
  type ExamAnalysis,
  type ItemFlag,
  type ItemStat,
} from '../../lib/itemAnalysis'

// Whether the selection exam can tell candidates apart at all.
//
// This is the question a results table sorted by percent cannot answer. A
// cohort drawn from serving EMTs is already a narrow ability band; a test that
// is easy for them produces a pile of scores in the high eighties and ranks
// people on noise. That looks fine in a list and is useless as a decision.

const FLAG_LABEL: Record<ItemFlag, string> = {
  'too-easy': 'Too easy — sorts nobody',
  'too-hard': 'Very hard — near guessing',
  'weak-discrimination': 'Weak discrimination',
  'negative-discrimination': 'NEGATIVE — check the key',
  'dead-distractors': 'Dead distractors',
  'low-n': 'Too few candidates',
}

const FLAG_TONE: Record<ItemFlag, string> = {
  'too-easy': 'warn',
  'too-hard': 'warn',
  'weak-discrimination': 'warn',
  'negative-discrimination': 'danger',
  'dead-distractors': 'muted',
  'low-n': 'muted',
}

function Histogram({ a }: { a: ExamAnalysis }) {
  const max = Math.max(1, ...a.distribution.buckets.map((b) => b.n))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120, marginTop: 8 }}>
      {a.distribution.buckets.map((b) => (
        <div key={b.from} style={{ flex: 1, textAlign: 'center' }}>
          <div
            title={`${b.from}–${b.to}%: ${b.n} candidate${b.n === 1 ? '' : 's'}`}
            style={{
              height: `${(b.n / max) * 90}px`,
              background: b.from >= 80 ? 'var(--amber, #d68000)' : 'var(--navy, #1f3864)',
              borderRadius: '3px 3px 0 0',
              minHeight: b.n ? 3 : 0,
            }}
          />
          <div className="subtle" style={{ fontSize: 10, marginTop: 3 }}>
            {b.from}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function TestQuality() {
  const [a, setA] = useState<ExamAnalysis | null>(null)
  const [bank, setBank] = useState<Map<number, BankRow>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setLoading(true)
    setError(null)
    const [att, bk] = await Promise.all([listAttemptsForAnalysis(), listExamBank()])
    setLoading(false)
    if (att.error || bk.error) {
      setError(att.error || bk.error || 'Could not load.')
      return
    }
    const key: Record<string, number> = {}
    const map = new Map<number, BankRow>()
    for (const q of bk.rows ?? []) {
      key[String(q.id)] = q.answer
      map.set(q.id, q)
    }
    setBank(map)
    setA(
      analyseExam(
        (att.rows ?? []).map((r) => ({
          questionIds: r.question_ids ?? [],
          responses: r.responses ?? {},
        })),
        key,
      ),
    )
  }

  const flagged = (a?.items ?? []).filter((i) =>
    i.flags.some((f) => f !== 'low-n' && f !== 'dead-distractors'),
  )

  const row = (it: ItemStat) => (
    <tr key={it.id}>
      <td style={{ maxWidth: 420 }}>
        {bank.get(it.id)?.stem ?? `Item ${it.id}`}
        <div className="subtle" style={{ fontSize: 11 }}>{bank.get(it.id)?.domain}</div>
      </td>
      <td className="num">{it.p === undefined ? '—' : (it.p * 100).toFixed(0) + '%'}</td>
      <td className="num">{it.discrimination === undefined ? '—' : it.discrimination.toFixed(2)}</td>
      <td className="num">{it.n}</td>
      <td>
        {it.flags
          .filter((f) => f !== 'low-n')
          .map((f) => (
            <span key={f} className={`pill ${FLAG_TONE[f]}`} style={{ marginRight: 4 }}>
              {FLAG_LABEL[f]}
            </span>
          ))}
      </td>
    </tr>
  )

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="toolbar" style={{ marginTop: 0 }}>
        <strong>Test quality</strong>
        <div className="spacer" />
        <button className="btn" onClick={run} disabled={loading}>
          {loading ? 'Analysing…' : a ? 'Re-run' : 'Analyse the exam'}
        </button>
      </div>
      <p className="subtle" style={{ fontSize: 12.5, marginTop: 4 }}>
        Whether this exam can tell candidates apart — not whether it predicts anything, which only
        outcome data can show. Candidates here are serving EMTs who already passed a course and a
        hiring process, so the ability range is narrow to begin with; a test that is easy for that
        group ranks people on noise.
      </p>

      {error && <div className="banner warn" style={{ marginTop: 8 }}>{error}</div>}

      {a && (
        <>
          <div
            className={`banner ${a.verdict.level === 'problem' ? 'warn' : a.verdict.level === 'ok' ? 'ok' : 'info'}`}
            style={{ marginTop: 10 }}
          >
            <strong>{a.verdict.headline}</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {a.verdict.detail.map((d, i) => (
                <li key={i} style={{ fontSize: 12.5, marginTop: 2 }}>{d}</li>
              ))}
            </ul>
          </div>

          <div className="section-title">Score distribution</div>
          <div className="field-row">
            <div><span className="subtle">Candidates</span><div><strong>{a.distribution.n}</strong></div></div>
            <div><span className="subtle">Mean</span><div><strong>{a.distribution.mean.toFixed(1)}%</strong></div></div>
            <div><span className="subtle">SD</span><div><strong>{a.distribution.sd.toFixed(1)}</strong></div></div>
            <div><span className="subtle">Range</span><div><strong>{a.distribution.min.toFixed(0)}–{a.distribution.max.toFixed(0)}%</strong></div></div>
            <div><span className="subtle">At or above 85%</span><div><strong>{a.distribution.atOrAbove85.toFixed(0)}%</strong></div></div>
          </div>
          <Histogram a={a} />
          <p className="subtle" style={{ fontSize: 11.5, marginTop: 4 }}>
            Bars from 80% up are amber: a healthy selection test has candidates spread across the
            range, not stacked at the top.
          </p>

          {a.kr20 !== undefined && (
            <>
              <div className="section-title">Reliability</div>
              <p style={{ fontSize: 13, margin: 0 }}>
                <strong>KR-20 {a.kr20.toFixed(2)}</strong>
                {a.maxValidity !== undefined && (
                  <> · caps any validity coefficient at about <strong>{a.maxValidity.toFixed(2)}</strong></>
                )}
              </p>
              <p className="subtle" style={{ fontSize: 12, marginTop: 2 }}>
                Every candidate sees a different random draw, so this is the standard adaptation of
                KR-20 rather than the textbook formula — read it as an estimate.
              </p>
            </>
          )}

          <div className="section-title">
            Items worth attention {flagged.length ? `(${flagged.length})` : ''}
          </div>
          {a.distribution.n < MIN_N_ITEM ? (
            <p className="subtle" style={{ fontSize: 12.5 }}>
              Item statistics need at least {MIN_N_ITEM} candidates. Nothing is shown here until
              then rather than showing numbers that cannot mean anything yet.
            </p>
          ) : flagged.length === 0 ? (
            <p className="subtle" style={{ fontSize: 12.5 }}>
              No item is too easy, miskeyed or non-discriminating. Nothing to fix.
            </p>
          ) : (
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="num">Correct</th>
                    <th className="num">Discrim.</th>
                    <th className="num">n</th>
                    <th>Flags</th>
                  </tr>
                </thead>
                <tbody>{flagged.map(row)}</tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
