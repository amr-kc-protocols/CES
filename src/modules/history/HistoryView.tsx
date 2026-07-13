import { useMemo } from 'react'
import { Empty, ProgressBar, Stat } from '../../components/ui'
import { formatDate, monthLabel } from '../../lib/date'
import { useDB } from '../../lib/store'
import { useSyncStatus } from '../../lib/sync'
import { evalAverage } from '../academy/academyStore'
import { HISTORICAL_EVALS, HISTORICAL_SKILLS, HISTORICAL_SURVEYS } from '../../data/history'
import { BLS_SKILLS, LINN_MEDIC_SKILLS } from '../../data/skillSheets'
import type { DailyEval, SkillCheck } from '../../types'

// Historical + live record of every new hire class: exit surveys, daily
// performance evaluations, and clinical skill sheets, merged by canonical
// hire name so legacy Microsoft Forms data and in-app data read as one set.

interface HireRecord {
  name: string
  firstSeen: string
  evals: DailyEval[]
  skills: SkillCheck[]
  surveys: Record<string, string | number>[]
}

const num = (v: unknown): number | null => (typeof v === 'number' && !Number.isNaN(v) ? v : null)

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}

function useHires(): HireRecord[] {
  const db = useDB()
  return useMemo(() => {
    const surveys: Record<string, string | number>[] = [
      ...HISTORICAL_SURVEYS,
      ...db.surveyResponses.map((r) => ({ ...r.data, submittedAt: r.submittedAt })),
    ]
    const evals = [...HISTORICAL_EVALS, ...db.dailyEvals]
    const skills = [...HISTORICAL_SKILLS, ...db.skillChecks]

    const map = new Map<string, HireRecord>()
    const get = (name: string) => {
      const key = name.trim()
      let h = map.get(key)
      if (!h) {
        h = { name: key, firstSeen: '9999-12-31', evals: [], skills: [], surveys: [] }
        map.set(key, h)
      }
      return h
    }
    for (const e of evals) {
      const h = get(e.traineeName)
      h.evals.push(e)
      if (e.date && e.date < h.firstSeen) h.firstSeen = e.date
    }
    for (const s of skills) {
      const h = get(s.traineeName)
      h.skills.push(s)
      if (s.date && s.date < h.firstSeen) h.firstSeen = s.date
    }
    for (const s of surveys) {
      const name = String(s.fullName ?? '').trim()
      if (!name) continue
      const h = get(name)
      h.surveys.push(s)
      const d = String(s.orientationEndDate ?? s.submittedAt ?? '').slice(0, 10)
      if (d && d < h.firstSeen) h.firstSeen = d
    }
    for (const h of map.values()) h.evals.sort((a, b) => a.date.localeCompare(b.date))
    return [...map.values()].sort((a, b) => b.firstSeen.localeCompare(a.firstSeen) || a.name.localeCompare(b.name))
  }, [db.dailyEvals, db.skillChecks, db.surveyResponses])
}

function skillsSummary(h: HireRecord): { passed: number; total: number } | null {
  if (!h.skills.length) return null
  let passed = 0
  let total = 0
  for (const s of h.skills) {
    const defs = s.sheet === 'linn-medic' ? LINN_MEDIC_SKILLS : BLS_SKILLS
    total += defs.length
    passed += Object.values(s.results).filter((r) => r === 'pass').length
  }
  return { passed, total }
}

function HireRow({ h }: { h: HireRecord }) {
  const avg = mean(h.evals.map(evalAverage).filter((v): v is number => v !== null))
  const firstAvg = h.evals.length >= 2 ? evalAverage(h.evals[0]) : null
  const lastAvg = h.evals.length >= 2 ? evalAverage(h.evals[h.evals.length - 1]) : null
  const survey = h.surveys[0]
  const sk = skillsSummary(h)
  const lastReady = [...h.evals].reverse().find((e) => e.readyIndependent !== undefined)?.readyIndependent

  return (
    <details style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <summary style={{ cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ flex: 1, minWidth: 140, fontWeight: 600 }}>{h.name}</span>
        {avg !== null && (
          <span className={`pill ${avg >= 4 ? 'ok' : avg >= 3 ? 'info' : 'warn'}`} title="Average daily-eval score">
            {avg.toFixed(1)} avg
          </span>
        )}
        {firstAvg !== null && lastAvg !== null && lastAvg - firstAvg > 0.2 && (
          <span className="pill ok" title={`First shift ${firstAvg.toFixed(1)} → last shift ${lastAvg.toFixed(1)}`}>
            ↗ +{(lastAvg - firstAvg).toFixed(1)}
          </span>
        )}
        {lastReady === true && <span className="pill ok">Ready</span>}
        {sk && <span className="pill muted">🩺 {sk.passed}/{sk.total}</span>}
        {survey && num(survey.overallRating) !== null && (
          <span className="pill muted" title="Exit-survey program rating">📝 {survey.overallRating}/5</span>
        )}
        <span className="subtle" style={{ fontSize: 12 }}>{h.evals.length} eval{h.evals.length === 1 ? '' : 's'}</span>
      </summary>

      <div style={{ padding: '8px 0 8px 12px' }}>
        {h.evals.map((e) => {
          const a = evalAverage(e)
          return (
            <div key={e.id} className="subtle" style={{ fontSize: 13, padding: '3px 0' }}>
              {formatDate(e.date)}
              {e.fto && ` · ${e.fto}`}
              {a !== null && ` · ${a.toFixed(1)}`}
              {e.readyIndependent === true && ' · ✅ ready'}
              {e.improvements && (
                <span style={{ display: 'block', paddingLeft: 12 }}>🎯 {e.improvements.slice(0, 160)}{e.improvements.length > 160 ? '…' : ''}</span>
              )}
            </div>
          )
        })}
        {survey && (
          <div style={{ fontSize: 13, marginTop: 6 }}>
            📝 <strong>Exit survey</strong>
            {num(survey.overallRating) !== null && ` · program ${survey.overallRating}/5`}
            {num(survey.ftoRating) !== null && ` · FTOs ${survey.ftoRating}/5`}
            {survey.readinessLevel && ` · ${survey.readinessLevel}`}
            {survey.ftoList && <span style={{ display: 'block' }} className="subtle">Rode with {survey.ftoList}</span>}
            {survey.ftoStandout && <span style={{ display: 'block' }} className="subtle">⭐ {String(survey.ftoStandout).slice(0, 200)}</span>}
          </div>
        )}
        {h.skills.map((s) => (
          <div key={s.id} className="subtle" style={{ fontSize: 13, marginTop: 4 }}>
            🩺 {s.sheet === 'linn-medic' ? 'Linn medic sheet' : 'BLS skills'} · {formatDate(s.date)} ·{' '}
            {Object.values(s.results).filter((r) => r === 'pass').length} passed
            {s.evaluator && ` · ${s.evaluator}`}
          </div>
        ))}
      </div>
    </details>
  )
}

export default function HistoryView() {
  // Survey feedback names FTOs candidly; only the signed-in admin sees it.
  // The signed-out "local admin" convenience intentionally doesn't count.
  const { signedIn, role } = useSyncStatus()
  const hires = useHires()

  if (!signedIn || role !== 'admin') {
    return (
      <Empty icon="🔒" title="Admin only">
        Class history — including unredacted survey feedback — is visible to the Clinical
        Educator's account only.
      </Empty>
    )
  }

  const allEvals = hires.flatMap((h) => h.evals)
  const allSurveys = hires.flatMap((h) => h.surveys)
  const evalAvg = mean(allEvals.map(evalAverage).filter((v): v is number => v !== null))
  const surveyAvg = mean(allSurveys.map((s) => num(s.overallRating)).filter((v): v is number => v !== null))
  const ftoAvg = mean(allSurveys.map((s) => num(s.ftoRating)).filter((v): v is number => v !== null))
  const readiness = allSurveys.map((s) => String(s.readinessLevel ?? '')).filter(Boolean)
  const preparedPct = readiness.length
    ? Math.round((readiness.filter((r) => r.toLowerCase().startsWith('yes') || r.toLowerCase().startsWith('mostly')).length / readiness.length) * 100)
    : null

  // Efficacy curve: average eval score by shift number (each hire's evals in
  // date order — shift 1 is their first evaluated shift).
  const byShift: number[][] = []
  for (const h of hires) {
    h.evals.forEach((e, i) => {
      const a = evalAverage(e)
      if (a === null) return
      const bucket = Math.min(i, 5)
      ;(byShift[bucket] ??= []).push(a)
    })
  }

  // Classes: group hires by the month they first appear in the record.
  const classes = new Map<string, HireRecord[]>()
  for (const h of hires) {
    const key = h.firstSeen.slice(0, 7)
    classes.set(key, [...(classes.get(key) ?? []), h])
  }
  const classKeys = [...classes.keys()].sort().reverse()

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>History</h1>
          <div className="subtle">Every new hire class — legacy Forms data + everything recorded in-app</div>
        </div>
      </div>

      <div className="stat-grid" style={{ marginTop: 12 }}>
        <Stat label="Hires on record" value={hires.length} />
        <Stat label="Daily evals" value={allEvals.length} />
        <Stat label="Avg shift score" value={evalAvg !== null ? evalAvg.toFixed(1) : '—'} />
        <Stat label="Program rating" value={surveyAvg !== null ? `${surveyAvg.toFixed(1)}/5` : '—'} />
      </div>

      <div className="card" style={{ padding: 14, marginTop: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 2 }}>The program works — scores climb shift over shift</div>
        <div className="subtle" style={{ fontSize: 12, marginBottom: 10 }}>
          Average daily-evaluation score by ride-along shift number, across every hire on record.
        </div>
        {byShift.map((scores, i) => {
          const a = mean(scores)
          if (a === null) return null
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
              <span className="subtle" style={{ width: 64, fontSize: 12, whiteSpace: 'nowrap' }}>
                Shift {i + 1}{i === 5 ? '+' : ''}
              </span>
              <div style={{ flex: 1 }}>
                <ProgressBar pct={Math.round((a / 5) * 100)} complete={a >= 4.5} />
              </div>
              <span style={{ width: 56, textAlign: 'right', fontWeight: 600 }}>{a.toFixed(2)}</span>
              <span className="subtle" style={{ width: 44, fontSize: 11, textAlign: 'right' }}>n={scores.length}</span>
            </div>
          )
        })}
        <div className="subtle" style={{ fontSize: 12, marginTop: 8 }}>
          {ftoAvg !== null && <>FTOs rated <strong>{ftoAvg.toFixed(1)}/5</strong> by their trainees. </>}
          {preparedPct !== null && <><strong>{preparedPct}%</strong> reported feeling prepared or mostly prepared at release.</>}
        </div>
      </div>

      <div className="section-title">Classes</div>
      {classKeys.map((key) => {
        const group = classes.get(key)!
        const gAvg = mean(group.flatMap((h) => h.evals.map(evalAverage)).filter((v): v is number => v !== null))
        return (
          <details key={key} className="card" style={{ padding: '10px 14px', marginBottom: 8 }}>
            <summary style={{ cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ flex: 1, fontWeight: 700 }}>{monthLabel(key)} class</span>
              <span className="pill info">{group.length} hire{group.length === 1 ? '' : 's'}</span>
              {gAvg !== null && <span className="pill muted">{gAvg.toFixed(1)} avg score</span>}
            </summary>
            <div style={{ marginTop: 8 }}>
              {group.map((h) => (
                <HireRow key={h.name} h={h} />
              ))}
            </div>
          </details>
        )
      })}
    </div>
  )
}
