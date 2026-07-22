import { Link, useParams } from 'react-router-dom'
import { Empty, ProgressBar } from '../../components/ui'
import { SHEETS, skillsFor, clinicalSheetsFor } from '../../data/checkoffSheets'
import { useSelector } from '../../lib/store'
import type { SkillSheetId } from '../../types'
import { useCohort, useCohortTrainees } from './academyStore'

// Class-day view of one check-off sheet: the whole roster with progress, one
// tap into each trainee's sheet. Linked from the academy schedule on the days
// the check-off actually runs (EVOC road course, stretcher day).

export default function ClassCheckoffView() {
  const { cohortId = '', sheet: sheetParam = '' } = useParams()
  const cohort = useCohort(cohortId)
  const trainees = useCohortTrainees(cohortId)
  const checks = useSelector((db) => db.skillChecks)

  if (!cohort || !(sheetParam in SHEETS)) {
    return (
      <Empty icon="🤔" title="Check-off not found">
        <Link to="/academy" className="link-btn">Back to Academy</Link>
      </Empty>
    )
  }
  const sheet = sheetParam as SkillSheetId
  const meta = SHEETS[sheet]
  // Stretcher & EVOC run for everyone; the clinical sheets (BLS / ALS / RSI /
  // Vent) list only the trainees that sheet actually applies to.
  const clinical = sheet === 'bls' || sheet === 'linn-medic' || sheet === 'rsi' || sheet === 'vent'
  const roster = clinical ? trainees.filter((t) => clinicalSheetsFor(t).includes(sheet)) : trainees

  return (
    <div>
      <Link to={`/academy/${cohortId}?tab=schedule`} className="link-btn">← {cohort.label} schedule</Link>
      <div className="page-head" style={{ marginTop: 8 }}>
        <div>
          <h1>{meta.icon} {meta.label}</h1>
          <div className="subtle">Class check-off · tap a trainee to sign them off</div>
        </div>
      </div>

      {roster.length === 0 ? (
        <Empty icon="🎓" title={trainees.length === 0 ? "No trainees on this cohort's roster yet" : `No trainees on this roster do the ${meta.label}`} />
      ) : (
        <div className="list">
          {roster.map((t) => {
            // RSI / ventilator scope by operation, so totals differ per trainee.
            const applicable = skillsFor(sheet, t.operation)
            const ids = new Set(applicable.map((sk) => sk.id))
            const total = applicable.length
            const check = checks.find((c) => c.traineeId === t.id && c.sheet === sheet)
            const passed = Object.entries(check?.results ?? {}).filter(([id, r]) => r === 'pass' && ids.has(id)).length
            return (
              <Link key={t.id} to={`/academy/${cohortId}/skills/${t.id}/${sheet}`} className="row" style={{ color: 'inherit' }}>
                <div className="grow">
                  <div className="title">{t.name}</div>
                  <div style={{ marginTop: 6 }}>
                    <ProgressBar pct={Math.round((passed / total) * 100)} complete={passed === total} />
                  </div>
                </div>
                <span className={`pill ${passed === total ? 'ok' : passed ? 'info' : 'muted'}`}>
                  {passed}/{total}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
