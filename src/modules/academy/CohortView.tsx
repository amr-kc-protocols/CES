import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Empty, Modal, ProgressBar, Stat } from '../../components/ui'
import { OPERATIONS, operationShort } from '../../data/operations'
import {
  curriculumFor,
  moduleSatisfied,
  phaseOf,
  PHASE_LABELS,
  CREDENTIAL_LABELS,
  requiredContacts,
  WAIVABLE_MODULE_IDS,
} from '../../data/academy'
import { formatDate } from '../../lib/date'
import {
  useCohort,
  useCohortTrainees,
  cohortProgress,
  addTrainee,
  deleteTrainee,
  toggleModule,
  addContacts,
  setContacts,
  releaseTrainee,
  unreleaseTrainee,
  releaseEligible,
  updateTrainee,
  setTransfer,
  toggleWaiver,
  setModuleDate,
  fieldProgress,
  useRidesFor,
  useEvalsFor,
  useSkillCheckFor,
  sheetFor,
} from './academyStore'
import { SHEETS } from '../../data/checkoffSheets'
import { FIELD_OBJECTIVES_ENABLED } from '../../config/features'
import CohortForm from './CohortForm'
import ScheduleView from './Phase2View'
import AttendanceView from './AttendanceView'
import DocumentsPanel from './DocumentsPanel'
import { useCan } from '../../lib/role'
import type { Credential, Employment, OperationId, Trainee, TraineePhase } from '../../types'

const PHASE_PILL: Record<TraineePhase, string> = {
  academy: 'warn',
  fto: 'info',
  released: 'ok',
}

function AddTraineeModal({ cohortId, onClose }: { cohortId: string; onClose: () => void }) {
  const [name, setName] = useState('')
  const [operation, setOperation] = useState<OperationId>('kc')
  const [credential, setCredential] = useState<Credential>('paramedic')
  const [employeeNumber, setEmployeeNumber] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [transfer, setTransferFlag] = useState(false)
  const [error, setError] = useState('')

  function save(keepOpen: boolean) {
    if (!name.trim()) return setError('Name is required.')
    addTrainee(cohortId, { name, operation, credential, employeeNumber, email, phone, transfer })
    setName('')
    setEmployeeNumber('')
    setEmail('')
    setPhone('')
    setTransferFlag(false)
    setError('')
    if (!keepOpen) onClose()
  }

  return (
    <Modal title="Add trainee" onClose={onClose}>
      {error && <div className="banner crit">{error}</div>}
      <div className="field">
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. T. Nguyen" />
      </div>
      <div className="field-row">
        <div className="field">
          <label>Home operation</label>
          <select value={operation} onChange={(e) => setOperation(e.target.value as OperationId)}>
            {OPERATIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Credential</label>
          <select value={credential} onChange={(e) => setCredential(e.target.value as Credential)}>
            <option value="paramedic">Paramedic</option>
            <option value="emt">EMT</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label>Employee / Kronos #</label>
        <input
          value={employeeNumber}
          onChange={(e) => setEmployeeNumber(e.target.value)}
          placeholder="Printed on EVOC / fit test forms"
        />
      </div>
      <div className="field-row">
        <div className="field">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@gmr.net"
          />
        </div>
        <div className="field">
          <label>Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(816) 555-0134"
          />
        </div>
      </div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <input type="checkbox" checked={transfer} onChange={(e) => setTransferFlag(e.target.checked)} />
        <span>Transferring from another AMR operation</span>
      </label>
      {transfer && (
        <div className="banner info">
          Transfer — OSHA, Cornerstone, EVOC, stretcher, and HR can be waived on their checklist,
          and the contact target can be lowered.
          {credential === 'paramedic' && (operation === 'kc' || operation === 'cass') &&
            ' Ventilator training is still required.'}
        </div>
      )}
      {credential === 'paramedic' && operation === 'kc' && (
        <div className="banner info">
          KC paramedic — the critical-care specialization block (ventilator, vasopressor &amp;
          sedative infusions) is added to their checklist.
        </div>
      )}
      {credential === 'paramedic' && operation === 'cass' && (
        <div className="banner info">
          Cass paramedic — ventilator management is added to their checklist.
        </div>
      )}
      <div className="btn-row">
        <button className="btn primary" onClick={() => save(false)}>
          Add trainee
        </button>
        <button className="btn" onClick={() => save(true)}>
          Add &amp; next
        </button>
        <button className="btn ghost" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  )
}

function TraineeCard({ trainee }: { trainee: Trainee }) {
  const [open, setOpen] = useState(false)
  const rides = useRidesFor(trainee.id)
  const evals = useEvalsFor(trainee.id)
  const clinicalSheet = sheetFor(trainee)
  const clinicalCheck = useSkillCheckFor(trainee.id, clinicalSheet)
  const stretcherCheck = useSkillCheckFor(trainee.id, 'stretcher')
  const evocCheck = useSkillCheckFor(trainee.id, 'evoc-track')
  const passedOf = (c?: { results: Record<string, string> }) =>
    Object.values(c?.results ?? {}).filter((r) => r === 'pass').length
  const can = useCan()
  const phase = phaseOf(trainee)
  const modules = curriculumFor(trainee.operation, trainee.credential)
  const done = modules.filter((m) => moduleSatisfied(trainee, m.id)).length
  const general = modules.filter((m) => m.block === 'general')
  const kcMedic = modules.filter((m) => m.block === 'kc-medic')
  const contactPct = Math.min(100, Math.round((trainee.contacts / trainee.contactTarget) * 100))

  return (
    <div className="card" style={{ padding: 14 }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
        onClick={() => setOpen(!open)}
      >
        <div className="grow" style={{ flex: 1, minWidth: 0 }}>
          <div className="title">
            {trainee.name}
            <span className="subtle" style={{ fontWeight: 500, marginLeft: 8 }}>
              {operationShort(trainee.operation)} · {CREDENTIAL_LABELS[trainee.credential]}
            </span>
            {trainee.transfer && (
              <span className="pill muted" style={{ marginLeft: 8 }} title="Transferring from another AMR operation — waivers allowed">
                AMR transfer
              </span>
            )}
          </div>
          <div className="meta">
            {phase === 'academy' && `Checklist ${done}/${modules.length}`}
            {phase === 'fto' && `${trainee.contacts}/${trainee.contactTarget} patient contacts`}
            {phase === 'released' && `Released ${formatDate(trainee.releasedDate)}`}
          </div>
        </div>
        <span className={`pill ${PHASE_PILL[phase]}`}>{PHASE_LABELS[phase]}</span>
        <span className="subtle">{open ? '▾' : '▸'}</span>
      </div>

      {phase !== 'released' && (
        <div style={{ marginTop: 10 }}>
          <ProgressBar
            pct={phase === 'academy' ? Math.round((done / modules.length) * 100) : contactPct}
            complete={phase === 'fto' && trainee.contacts >= trainee.contactTarget}
          />
        </div>
      )}

      {open && (
        <div style={{ marginTop: 14 }}>
          <div className="section-title" style={{ margin: '0 0 8px' }}>
            Details (printed on documents)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <label className="subtle" style={{ fontSize: 12 }}>
              Hire date
              <input
                type="date"
                value={trainee.hireDate ?? ''}
                onChange={(e) => updateTrainee(trainee.id, { hireDate: e.target.value || undefined })}
                style={{ display: 'block', width: '100%', marginTop: 2, padding: '6px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit' }}
              />
            </label>
            <label className="subtle" style={{ fontSize: 12 }}>
              Employment
              <select
                value={trainee.employment ?? ''}
                onChange={(e) => updateTrainee(trainee.id, { employment: (e.target.value || undefined) as Employment | undefined })}
                style={{ display: 'block', width: '100%', marginTop: 2, padding: '6px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit' }}
              >
                <option value="">—</option>
                <option value="ft">Full-Time</option>
                <option value="per_diem">Per Diem</option>
              </select>
            </label>
            <label className="subtle" style={{ fontSize: 12 }}>
              Employee / Kronos #
              <input
                value={trainee.employeeNumber ?? ''}
                onChange={(e) => updateTrainee(trainee.id, { employeeNumber: e.target.value || undefined })}
                placeholder="Printed on EVOC / fit test forms"
                style={{ display: 'block', width: '100%', marginTop: 2, padding: '6px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit' }}
              />
            </label>
            <label className="subtle" style={{ fontSize: 12 }}>
              FTOs assigned
              <input
                value={trainee.ftos ?? ''}
                onChange={(e) => updateTrainee(trainee.id, { ftos: e.target.value || undefined })}
                placeholder="e.g. M. Rodriguez, K. Patel"
                style={{ display: 'block', width: '100%', marginTop: 2, padding: '6px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit' }}
              />
            </label>
            <label className="subtle" style={{ fontSize: 12 }}>
              Email
              <input
                type="email"
                value={trainee.email ?? ''}
                onChange={(e) => updateTrainee(trainee.id, { email: e.target.value || undefined })}
                placeholder="name@gmr.net"
                style={{ display: 'block', width: '100%', marginTop: 2, padding: '6px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit' }}
              />
            </label>
            <label className="subtle" style={{ fontSize: 12 }}>
              Phone
              <input
                type="tel"
                value={trainee.phone ?? ''}
                onChange={(e) => updateTrainee(trainee.id, { phone: e.target.value || undefined })}
                placeholder="(816) 555-0134"
                style={{ display: 'block', width: '100%', marginTop: 2, padding: '6px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit' }}
              />
            </label>
          </div>

          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={!!trainee.transfer}
              onChange={(e) => setTransfer(trainee.id, e.target.checked)}
            />
            <span>
              Transferring from another AMR operation
              <span className="subtle"> — unlocks requirement waivers below (unchecking clears them)</span>
            </span>
          </label>

          <div className="section-title" style={{ margin: '0 0 8px' }}>
            Academy checklist
          </div>
          {[{ label: 'General AMR block', items: general }, ...(kcMedic.length ? [{ label: 'Critical-care specialization (not waivable)', items: kcMedic }] : [])].map(
            (group) => (
              <div key={group.label} style={{ marginBottom: 10 }}>
                <div className="subtle" style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
                  {group.label}
                </div>
                {group.items.map((m) => {
                  const waived = !!trainee.waived?.[m.id]
                  return (
                    <label
                      key={m.id}
                      style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 0' }}
                    >
                      <input
                        type="checkbox"
                        checked={!!trainee.checklist[m.id]}
                        disabled={waived}
                        onChange={() => toggleModule(trainee.id, m.id)}
                      />
                      <span style={{ flex: 1, ...(waived ? { textDecoration: 'line-through', opacity: 0.6 } : {}) }}>
                        {m.label}
                      </span>
                      {waived ? (
                        <button
                          className="pill muted"
                          style={{ border: 'none', cursor: 'pointer', font: 'inherit', fontSize: 12 }}
                          title={`Waived ${formatDate(trainee.waived?.[m.id])} — tap to reinstate the requirement`}
                          onClick={(e) => {
                            e.preventDefault()
                            toggleWaiver(trainee.id, m.id)
                          }}
                        >
                          Waived · {formatDate(trainee.waived?.[m.id])} ✕
                        </button>
                      ) : trainee.checklist[m.id] ? (
                        <input
                          type="date"
                          value={trainee.checklist[m.id]}
                          onChange={(e) => setModuleDate(trainee.id, m.id, e.target.value)}
                          title="Real completion date — edit if it wasn't checked off the same day"
                          style={{ padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 6, font: 'inherit', fontSize: 12, color: 'var(--text-muted)' }}
                        />
                      ) : (
                        trainee.transfer &&
                        WAIVABLE_MODULE_IDS.has(m.id) && (
                          <button
                            className="btn sm ghost"
                            title="Waive — completed at their previous AMR operation"
                            onClick={(e) => {
                              e.preventDefault()
                              toggleWaiver(trainee.id, m.id)
                            }}
                          >
                            Waive
                          </button>
                        )
                      )}
                    </label>
                  )
                })}
              </div>
            ),
          )}

          <div className="section-title" style={{ margin: '14px 0 8px' }}>
            FTO rides · release at {requiredContacts(trainee)}+ contacts
            {trainee.transfer && requiredContacts(trainee) < 20 && ' (transfer-adjusted)'}
          </div>
          <div style={{ marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Link to={`/academy/${trainee.cohortId}/eval/${trainee.id}`} className="btn sm">
              ⭐ Daily evals · {evals.length}
            </Link>
            <Link to={`/academy/${trainee.cohortId}/skills/${trainee.id}`} className="btn sm">
              🩺 Clinical · {passedOf(clinicalCheck)}/{SHEETS[clinicalSheet].skills.length}
            </Link>
            <Link to={`/academy/${trainee.cohortId}/skills/${trainee.id}/stretcher`} className="btn sm">
              🛏️ Stretcher · {passedOf(stretcherCheck)}/{SHEETS.stretcher.skills.length}
            </Link>
            <Link to={`/academy/${trainee.cohortId}/skills/${trainee.id}/evoc-track`} className="btn sm">
              🚗 EVOC track · {passedOf(evocCheck)}/{SHEETS['evoc-track'].skills.length}
            </Link>
            {FIELD_OBJECTIVES_ENABLED && (
              <Link to={`/academy/${trainee.cohortId}/checklist/${trainee.id}`} className="btn sm">
                📋 Field checklist · {fieldProgress(trainee).done}/{fieldProgress(trainee).total} objectives
              </Link>
            )}
            {trainee.exitSurveyDate ? (
              <span className="pill ok" title={`Exit survey submitted ${formatDate(trainee.exitSurveyDate)}`}>
                📝 Survey ✓ {formatDate(trainee.exitSurveyDate)}
              </span>
            ) : (
              <Link to={`/academy/${trainee.cohortId}/survey/${trainee.id}`} className="btn sm">
                📝 Exit survey
              </Link>
            )}
          </div>
          <div className="subtle" style={{ fontSize: 12, marginBottom: 10 }}>
            🚑{' '}
            {rides.length === 0 ? (
              <>
                No rides planned — assign shifts on <Link to="/academy/ftos" className="link-btn">FTO Shifts</Link>.
              </>
            ) : (
              <>
                Rides:{' '}
                {rides
                  .slice(0, 4)
                  .map((r) => `${formatDate(r.date)} ${r.unit}`)
                  .join(' · ')}
                {rides.length > 4 && ` · +${rides.length - 4} more`}
              </>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn sm"
              onClick={() => addContacts(trainee.id, -1)}
              disabled={trainee.contacts === 0}
              title="Correct a mis-tap"
            >
              −1
            </button>
            <button className="btn sm" onClick={() => addContacts(trainee.id, 1)}>
              +1 contact
            </button>
            <button className="btn sm" onClick={() => addContacts(trainee.id, 5)}>
              +5
            </button>
            <input
              type="number"
              min={0}
              value={trainee.contacts}
              onChange={(e) => setContacts(trainee.id, Number(e.target.value))}
              style={{ width: 70, padding: '6px 8px', border: '1px solid var(--border-strong)', borderRadius: 6 }}
              aria-label="Patient contacts"
            />
            <span className="subtle">
              of{' '}
              <input
                type="number"
                min={1}
                value={trainee.contactTarget}
                onChange={(e) => updateTrainee(trainee.id, { contactTarget: Math.max(1, Number(e.target.value) || 1) })}
                style={{ width: 56, padding: '6px 8px', border: '1px solid var(--border-strong)', borderRadius: 6 }}
                aria-label="Contact target"
              />{' '}
              target
            </span>
          </div>

          {can.manageAcademy && (
            <div className="btn-row" style={{ marginTop: 14 }}>
              {phase === 'released' ? (
                <button className="btn" onClick={() => unreleaseTrainee(trainee.id)}>
                  Undo release
                </button>
              ) : (
                <button
                  className="btn primary"
                  disabled={!releaseEligible(trainee)}
                  title={
                    releaseEligible(trainee)
                      ? ''
                      : `Needs a complete checklist and at least ${requiredContacts(trainee)} contacts`
                  }
                  onClick={() => releaseTrainee(trainee.id)}
                >
                  🎓 Release to solo practice
                </button>
              )}
              <div className="spacer" />
              <button
                className="btn danger sm"
                title="Remove from cohort (undoable)"
                onClick={() => deleteTrainee(trainee.id)}
              >
                Remove
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const COHORT_TABS = ['roster', 'schedule', 'attendance', 'docs'] as const
type CohortTab = (typeof COHORT_TABS)[number]

export default function CohortView() {
  const { cohortId = '' } = useParams()
  const cohort = useCohort(cohortId)
  const trainees = useCohortTrainees(cohortId)
  const navigate = useNavigate()
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  // Tab lives in the URL so a refresh keeps your place and tabs are linkable.
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab')
  const tab: CohortTab = COHORT_TABS.includes(rawTab as CohortTab) ? (rawTab as CohortTab) : 'roster'
  const setTab = (t: CohortTab) => setSearchParams(t === 'roster' ? {} : { tab: t }, { replace: true })
  const can = useCan()

  if (!cohort) {
    return (
      <div>
        <Link to="/academy" className="link-btn">
          ← Back to Academy
        </Link>
        <Empty icon="🔍" title="Cohort not found" />
      </div>
    )
  }

  const prog = cohortProgress(trainees)

  return (
    <div>
      <Link to="/academy" className="link-btn">
        ← Back to Academy
      </Link>

      <div className="page-head" style={{ marginTop: 8 }}>
        <div>
          <h1>{cohort.label}</h1>
          <div className="subtle">
            {formatDate(cohort.startDate)} – {formatDate(cohort.endDate)}
            {cohort.notes ? ` · ${cohort.notes}` : ''}
          </div>
        </div>
        {can.manageAcademy && (
          <button className="btn" onClick={() => setShowEdit(true)}>
            Edit
          </button>
        )}
      </div>

      <div className="stat-grid" style={{ marginTop: 12 }}>
        <Stat label="Roster" value={prog.trainees} />
        <Stat label="In academy" value={prog.inAcademy} />
        <Stat label="On FTO rides" value={prog.inFto} />
        <Stat label="Released" value={prog.released} />
      </div>

      <div className="toolbar" style={{ marginTop: 14 }}>
        <div className="segmented">
          <button className={tab === 'roster' ? 'active' : ''} onClick={() => setTab('roster')}>
            Roster ({trainees.length})
          </button>
          <button className={tab === 'schedule' ? 'active' : ''} onClick={() => setTab('schedule')}>
            Schedule
          </button>
          <button className={tab === 'attendance' ? 'active' : ''} onClick={() => setTab('attendance')}>
            Attendance
          </button>
          <button className={tab === 'docs' ? 'active' : ''} onClick={() => setTab('docs')}>
            Documents
          </button>
        </div>
        <div className="spacer" />
        {tab === 'roster' && can.manageAcademy && (
          <button className="btn primary" onClick={() => setShowAdd(true)}>
            + Add trainee
          </button>
        )}
      </div>

      {tab === 'roster' &&
        (trainees.length === 0 ? (
          <Empty icon="🧑‍🚒" title="No trainees on the roster yet">
            Add the cohort roster — academies average ~6 participants across all three operations.
          </Empty>
        ) : (
          <div className="list">
            {trainees.map((t) => (
              <TraineeCard key={t.id} trainee={t} />
            ))}
          </div>
        ))}

      {tab === 'schedule' && <ScheduleView cohort={cohort} />}

      {tab === 'attendance' && <AttendanceView cohort={cohort} />}

      {tab === 'docs' && <DocumentsPanel cohort={cohort} trainees={trainees} />}

      {showAdd && <AddTraineeModal cohortId={cohort.id} onClose={() => setShowAdd(false)} />}
      {showEdit && (
        <CohortForm
          editing={cohort}
          onClose={() => setShowEdit(false)}
          onDeleted={() => navigate('/academy')}
        />
      )}
    </div>
  )
}
