import { Link, useParams } from 'react-router-dom'
import { Empty, ProgressBar } from '../../components/ui'
import { SHEETS } from '../../data/checkoffSheets'
import { useSelector } from '../../lib/store'
import type { SkillSheetId } from '../../types'
import { useCohort, useCohortTrainees, sheetFor } from './academyStore'

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
  // Clinical sheets differ by operation (KC/Cass run BLS, Linn medics their
  // own) — each trainee's row opens THEIR sheet so nobody fills the wrong one.
  const clinical = sheet === 'bls' || sheet === 'linn-medic'

  return (
    <div>
      <Link to={`/academy/${cohortId}?tab=schedule`} className="link-btn">← {cohort.label} schedule</Link>
      <div className="page-head" style={{ marginTop: 8 }}>
        <div>
          <h1>{meta.icon} {meta.label}</h1>
          <div className="subtle">Class check-off · tap a trainee to sign them off</div>
        </div>
      </div>

      {trainees.length === 0 ? (
        <Empty icon="🎓" title="No trainees on this cohort's roster yet" />
      ) : (
        <div className="list">
          {trainees.map((t) => {
            const tSheet = clinical ? sheetFor(t) : sheet
            const total = SHEETS[tSheet].skills.length
            const check = checks.find((c) => c.traineeId === t.id && c.sheet === tSheet)
            const passed = Object.values(check?.results ?? {}).filter((r) => r === 'pass').length
            return (
              <Link key={t.id} to={`/academy/${cohortId}/skills/${t.id}/${tSheet}`} className="row" style={{ color: 'inherit' }}>
                <div className="grow">
                  <div className="title">
                    {t.name}
                    {tSheet !== sheet && (
                      <span className="pill muted" style={{ marginLeft: 8, fontWeight: 500 }}>
                        {SHEETS[tSheet].label}
                      </span>
                    )}
                  </div>
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
