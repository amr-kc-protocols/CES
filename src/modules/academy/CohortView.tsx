import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Empty, Modal, ProgressBar, Stat } from '../../components/ui'
import { OPERATIONS, operationShort } from '../../data/operations'
import {
  curriculumFor,
  phaseOf,
  PHASE_LABELS,
  CREDENTIAL_LABELS,
  RELEASE_MIN_CONTACTS,
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
} from './academyStore'
import CohortForm from './CohortForm'
import ScheduleEditor from './ScheduleEditor'
import Phase2View from './Phase2View'
import DocumentsPanel from './DocumentsPanel'
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
  const [error, setError] = useState('')

  function save(keepOpen: boolean) {
    if (!name.trim()) return setError('Name is required.')
    addTrainee(cohortId, { name, operation, credential, employeeNumber, email, phone })
    setName('')
    setEmployeeNumber('')
    setEmail('')
    setPhone('')
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
      {operation === 'kc' && credential === 'paramedic' && (
        <div className="banner info">
          KC paramedic — the critical-care specialization block (ventilator, vasopressor &amp;
          sedative infusions) is added to their checklist.
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
  const phase = phaseOf(trainee)
  const modules = curriculumFor(trainee.operation, trainee.credential)
  const done = modules.filter((m) => !!trainee.checklist[m.id]).length
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

          <div className="section-title" style={{ margin: '0 0 8px' }}>
            Academy checklist
          </div>
          {[{ label: 'General AMR block', items: general }, ...(kcMedic.length ? [{ label: 'KC critical-care specialization', items: kcMedic }] : [])].map(
            (group) => (
              <div key={group.label} style={{ marginBottom: 10 }}>
                <div className="subtle" style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
                  {group.label}
                </div>
                {group.items.map((m) => (
                  <label
                    key={m.id}
                    style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 0' }}
                  >
                    <input
                      type="checkbox"
                      checked={!!trainee.checklist[m.id]}
                      onChange={() => toggleModule(trainee.id, m.id)}
                    />
                    <span style={{ flex: 1 }}>{m.label}</span>
                    {trainee.checklist[m.id] && (
                      <span className="subtle" style={{ fontSize: 12 }}>
                        {formatDate(trainee.checklist[m.id])}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            ),
          )}

          <div className="section-title" style={{ margin: '14px 0 8px' }}>
            FTO rides · release at {RELEASE_MIN_CONTACTS}–30 contacts
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
                    : `Needs a complete checklist and at least ${RELEASE_MIN_CONTACTS} contacts`
                }
                onClick={() => releaseTrainee(trainee.id)}
              >
                🎓 Release to solo practice
              </button>
            )}
            <div className="spacer" />
            <button
              className="btn danger sm"
              onClick={() => {
                if (confirm(`Remove ${trainee.name} from this cohort?`)) deleteTrainee(trainee.id)
              }}
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

type CohortTab = 'roster' | 'schedule' | 'phase2' | 'docs'

export default function CohortView() {
  const { cohortId = '' } = useParams()
  const cohort = useCohort(cohortId)
  const trainees = useCohortTrainees(cohortId)
  const navigate = useNavigate()
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [tab, setTab] = useState<CohortTab>('roster')

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
        <button className="btn" onClick={() => setShowEdit(true)}>
          Edit
        </button>
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
          <button className={tab === 'phase2' ? 'active' : ''} onClick={() => setTab('phase2')}>
            Phase 2
          </button>
          <button className={tab === 'docs' ? 'active' : ''} onClick={() => setTab('docs')}>
            Documents
          </button>
        </div>
        <div className="spacer" />
        {tab === 'roster' && (
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

      {tab === 'schedule' && <ScheduleEditor cohort={cohort} />}

      {tab === 'phase2' && <Phase2View cohort={cohort} />}

      {tab === 'docs' && <DocumentsPanel cohort={cohort} trainees={trainees} />}

      {showAdd && <AddTraineeModal cohortId={cohort.id} onClose={() => setShowAdd(false)} />}
      {showEdit && (
        <CohortForm
          editing={cohort}
          onClose={() => {
            setShowEdit(false)
            // Cohort may have been deleted from the form.
            if (!cohort) navigate('/academy')
          }}
        />
      )}
    </div>
  )
}
