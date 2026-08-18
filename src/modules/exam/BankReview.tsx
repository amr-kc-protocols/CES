import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Empty } from '../../components/ui'
import { toCSV, downloadCSV } from '../../lib/csv'
import {
  listAttemptsForAnalysis,
  listExamBank,
  type BankRow,
  type ExamProgram,
} from '../../lib/exam'
import { analyseExam, type ItemStat } from '../../lib/itemAnalysis'

// ---------------------------------------------------------------------------
// Question bank review — for a subject-matter audit of every item.
//
// A reviewer cannot judge this exam without seeing the items, and the two ways
// to see them were both bad: read the bank out of the database by hand, or
// start a real attempt and contaminate the live selection records with a
// reviewer's answers.
//
// This is the third way. It reads the bank directly — admin-only, by the RLS
// policy that already exists — and creates NO attempt. Nothing here writes.
//
// It shows each item as a candidate sees it, with the key revealed on demand
// and the item's own statistics beside it, because content and behaviour are
// easier to judge together: an item three SMEs call fair and 97% of candidates
// answer correctly is still an item that sorts nobody.
// ---------------------------------------------------------------------------

const LETTER = ['A', 'B', 'C', 'D']

/**
 * The columns a subject-matter review actually needs to fill in.
 *
 * Deliberately blank in the export. They are the classification an SME panel
 * applies independently, and pre-filling them with a guess would anchor the
 * very judgement the panel exists to make.
 */
const SME_COLUMNS = [
  'SME: EMT prerequisite? (Y/N)',
  'SME: relevant to this course? (Y/N)',
  'SME: cognitive level (recall / application / analysis)',
  'SME: NREMT domain',
  'SME: difficulty (easy / moderate / hard)',
  'SME: single defensible answer? (Y/N)',
  'SME: reading load appropriate? (Y/N)',
  'SME: notes',
]

type Filter = 'all' | 'flagged' | 'too-easy' | 'weak' | 'unseen'

export default function BankReview({ program = 'aemt' }: { program?: ExamProgram }) {
  const [bank, setBank] = useState<BankRow[]>([])
  const [stats, setStats] = useState<Map<number, ItemStat>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reveal, setReveal] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [domain, setDomain] = useState('')

  useEffect(() => {
    void (async () => {
      setLoading(true)
      const [bk, att] = await Promise.all([
        listExamBank(program),
        listAttemptsForAnalysis(program),
      ])
      setLoading(false)
      if (bk.error) {
        setError(bk.error)
        return
      }
      const rows = bk.rows ?? []
      setBank(rows)
      // Statistics are a bonus, not a requirement — the audit is worth doing
      // before anybody has sat the exam.
      if (!att.error) {
        // Keyed items only — an unscored preference item has no statistics to
        // have, and including it would report every candidate as wrong on it.
        const key: Record<string, number> = {}
        for (const q of rows) if (q.answer !== null && q.answer !== undefined) key[String(q.id)] = q.answer
        const a = analyseExam(
          (att.rows ?? []).map((r) => ({
            questionIds: (r.question_ids ?? []).filter((id) => key[String(id)] !== undefined),
            responses: r.responses ?? {},
          })),
          key,
        )
        setStats(new Map(a.items.map((i) => [i.id, i])))
      }
    })()
  }, [program])

  const domains = useMemo(() => [...new Set(bank.map((q) => q.domain))].sort(), [bank])

  const shown = useMemo(() => {
    return bank.filter((q) => {
      if (domain && q.domain !== domain) return false
      const s = stats.get(q.id)
      switch (filter) {
        case 'flagged':
          return !!s?.flags.some((f) => f !== 'low-n')
        case 'too-easy':
          return !!s?.flags.includes('too-easy')
        case 'weak':
          return !!s?.flags.some((f) => f === 'weak-discrimination' || f === 'negative-discrimination')
        case 'unseen':
          return !s || s.n === 0
        default:
          return true
      }
    })
  }, [bank, stats, filter, domain])

  const exportCsv = () => {
    const headers = [
      'Item id', 'Domain', 'Stem',
      'Option A', 'Option B', 'Option C', 'Option D',
      'Correct', 'Correct text',
      'Candidates seen', '% correct', 'Discrimination (rest)', 'Flags',
      ...SME_COLUMNS,
    ]
    const rows = bank.map((q) => {
      const s = stats.get(q.id)
      return [
        q.id, q.domain, q.stem,
        q.options[0] ?? '', q.options[1] ?? '', q.options[2] ?? '', q.options[3] ?? '',
        q.answer === null || q.answer === undefined ? 'unscored' : LETTER[q.answer] ?? '?',
        q.answer === null || q.answer === undefined ? '' : q.options[q.answer] ?? '',
        s?.n ?? 0,
        s?.p === undefined ? '' : (s.p * 100).toFixed(0),
        s?.discrimination === undefined ? '' : s.discrimination.toFixed(2),
        (s?.flags ?? []).filter((f) => f !== 'low-n').join('; '),
        ...SME_COLUMNS.map(() => ''),
      ]
    })
    downloadCSV(
      `${program.toUpperCase()}_exam_bank_${new Date().toISOString().slice(0, 10)}.csv`,
      toCSV(headers, rows),
    )
  }

  if (loading) return <div className="subtle">Loading the bank…</div>
  if (error) return <Empty icon="🔒" title="Could not load the bank">{error}</Empty>

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Question bank review</h1>
          <div className="subtle">
            {bank.length} items · {shown.length} shown · nothing here records an attempt
          </div>
        </div>
        <div className="btn-row">
          <Link to={program === 'neop' ? '/academy/exam-results' : '/aemt/exam-results'} className="btn sm">
            ← Results
          </Link>
          <button className="btn sm" onClick={() => setReveal((r) => !r)}>
            {reveal ? '🙈 Hide answers' : '👁 Reveal answers'}
          </button>
          <button className="btn sm primary" onClick={exportCsv}>⬇ Export for SME review</button>
        </div>
      </div>

      <div className="banner warn">
        <strong>This page and its export contain the answer key.</strong> The export is a plain
        spreadsheet with a correct-answer column — treat the file the way you would treat the exam
        itself, and do not send it to anyone who may sit or re-sit it. Viewing here creates no
        attempt and writes nothing.
      </div>

      <p className="subtle" style={{ fontSize: 12.5 }}>
        The blank <strong>SME</strong> columns in the export are the classification a reviewer
        panel fills in independently — prerequisite, relevance, cognitive level, domain,
        difficulty, whether a single answer is defensible, and whether the reading load is
        appropriate. They ship empty on purpose: pre-filling them would anchor the judgement the
        panel exists to make.
      </p>

      <div className="toolbar">
        <div className="field">
          <label htmlFor="bf">Show</label>
          <select id="bf" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            <option value="all">All items</option>
            <option value="flagged">Flagged by the analysis</option>
            <option value="too-easy">Too easy</option>
            <option value="weak">Weak or negative discrimination</option>
            <option value="unseen">Never served yet</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="bd">Domain</label>
          <select id="bd" value={domain} onChange={(e) => setDomain(e.target.value)}>
            <option value="">All</option>
            {domains.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {shown.length === 0 ? (
        <Empty icon="🔍" title="Nothing matches">Try a wider filter.</Empty>
      ) : (
        shown.map((q) => {
          const s = stats.get(q.id)
          return (
            <div className="card" key={q.id} style={{ padding: 14, marginTop: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span className="subtle" style={{ fontSize: 12 }}>#{q.id}</span>
                <span className="pill muted">{q.domain}</span>
                {s && s.n > 0 && (
                  <>
                    <span className="pill info">{((s.p ?? 0) * 100).toFixed(0)}% correct · n={s.n}</span>
                    {s.discrimination !== undefined && (
                      <span className="pill info">r={s.discrimination.toFixed(2)}</span>
                    )}
                  </>
                )}
                {(s?.flags ?? [])
                  .filter((f) => f !== 'low-n')
                  .map((f) => <span key={f} className="pill warn">{f}</span>)}
              </div>

              <div style={{ fontWeight: 600, margin: '8px 0 6px' }}>{q.stem}</div>
              <ol type="A" style={{ margin: 0, paddingLeft: 22 }}>
                {q.options.map((o, i) => {
                  // An unscored item has no key to reveal, and nothing here
                  // should imply one of its options is the right one.
                  const isKey = q.answer !== null && q.answer !== undefined && i === q.answer
                  const picked = s?.chosen?.[i] ?? 0
                  return (
                    <li
                      key={i}
                      style={{
                        padding: '2px 0',
                        fontWeight: reveal && isKey ? 700 : 400,
                        color: reveal && isKey ? 'var(--ok, #1a7f37)' : undefined,
                      }}
                    >
                      {o}
                      {reveal && isKey && ' ✓'}
                      {s && s.n > 0 && (
                        <span className="subtle" style={{ fontSize: 11.5, marginLeft: 8 }}>
                          {picked} chose ({Math.round((picked / s.n) * 100)}%)
                        </span>
                      )}
                    </li>
                  )
                })}
              </ol>
            </div>
          )
        })
      )}
    </div>
  )
}
