import { useState } from 'react'
import { Modal } from '../../components/ui'
import { formatDate } from '../../lib/date'
import { useSelector } from '../../lib/store'
import {
  useStudents,
  useSessions,
  useShifts,
  useEncounters,
  useSkillChecks,
  useFormResponses,
  useCompletions,
  useAuditEvents,
  useRecordDocs,
  setRecordDoc,
} from './aemtStore'
import {
  REQUIRED_RECORDS,
  RECORD_STATUS,
  RETENTION_YEARS,
  retentionUntil,
} from '../../data/aemtRecords'
import type { RecordStatus, RequiredRecord } from '../../data/aemtRecords'
import { auditPackageHTML } from './auditPackage'
import { printDoc, downloadDoc, safeFilename } from '../academy/docGen'
import { useCan } from '../../lib/role'
import type { AemtCourse, AemtRecordDoc } from '../../types'

function RecordModal({
  course,
  record,
  doc,
  onClose,
}: {
  course: AemtCourse
  record: RequiredRecord
  doc?: AemtRecordDoc
  onClose: () => void
}) {
  const [status, setStatus] = useState<RecordStatus>((doc?.status as RecordStatus) ?? 'missing')
  const [owner, setOwner] = useState(doc?.owner ?? '')
  const [version, setVersion] = useState(doc?.version ?? '')
  const [location, setLocation] = useState(doc?.location ?? '')
  const [approvedBy, setApprovedBy] = useState(doc?.approvedBy ?? '')
  const [notes, setNotes] = useState(doc?.notes ?? '')

  return (
    <Modal title={record.label} onClose={onClose}>
      <div className="help-text" style={{ marginTop: 0, marginBottom: 10 }}>
        {record.why}
      </div>
      <div className="field">
        <label htmlFor="rd-status">Status</label>
        <select
          id="rd-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as RecordStatus)}
        >
          {RECORD_STATUS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="rd-loc">Where it lives</label>
        <input
          id="rd-loc"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="SharePoint path, shared drive folder, Navigate course…"
        />
        <div className="help-text">
          CES does not store the file. Record where an auditor would find it.
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="rd-owner">Owner</label>
          <input id="rd-owner" value={owner} onChange={(e) => setOwner(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="rd-ver">Version</label>
          <input id="rd-ver" value={version} onChange={(e) => setVersion(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="rd-appr">Approved by</label>
        <input
          id="rd-appr"
          value={approvedBy}
          onChange={(e) => setApprovedBy(e.target.value)}
          placeholder="Program manager / medical director"
        />
      </div>
      <div className="field">
        <label htmlFor="rd-notes">Notes</label>
        <textarea id="rd-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          className="btn primary"
          onClick={() => {
            setRecordDoc(course.id, record.id, {
              status,
              owner: owner.trim() || undefined,
              version: version.trim() || undefined,
              location: location.trim() || undefined,
              approvedBy: approvedBy.trim() || undefined,
              approvedDate: status === 'approved' ? (doc?.approvedDate ?? formatDate()) : undefined,
              notes: notes.trim() || undefined,
            })
            onClose()
          }}
        >
          Save
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}

export default function RecordsTab({ course }: { course: AemtCourse }) {
  const students = useStudents(course.id)
  const sessions = useSessions(course.id)
  const shifts = useShifts(course.id)
  const encounters = useEncounters(course.id)
  const skillChecks = useSkillChecks(course.id)
  const forms = useFormResponses(course.id)
  const completions = useCompletions(course.id)
  const audit = useAuditEvents(course.id)
  const docs = useRecordDocs(course.id)
  const attendance = useSelector((db) => db.aemtAttendance.filter((a) => a.courseId === course.id))
  const deadlines = useSelector((db) => db.aemtDeadlines.filter((d) => d.courseId === course.id))
  const { manageAcademy } = useCan()
  const [editing, setEditing] = useState<RequiredRecord | null>(null)

  const buildPackage = () =>
    auditPackageHTML({
      course,
      students,
      sessions,
      attendance,
      shifts,
      encounters,
      skillChecks,
      forms,
      completions,
      deadlines,
      recordDocs: docs,
      audit,
    })

  const external = REQUIRED_RECORDS.filter((r) => r.source === 'external')
  const held = REQUIRED_RECORDS.filter((r) => r.source === 'ces')
  const outstanding = external.filter(
    (r) => (docs.find((d) => d.typeId === r.id)?.status ?? 'missing') !== 'approved',
  )

  return (
    <div>
      <div className="banner info">
        Program records must be retained for {RETENTION_YEARS} years under K.A.R. 109-17-3 — for
        this course, until <strong>{formatDate(retentionUntil(course.endDate))}</strong>.
      </div>

      <div className="toolbar" style={{ marginTop: 12 }}>
        <span className="subtle">
          {outstanding.length === 0
            ? 'All external records approved'
            : `${outstanding.length} external record${outstanding.length === 1 ? '' : 's'} outstanding`}
        </span>
        <div className="spacer" />
        <button className="btn" onClick={() => printDoc(`${course.label} — audit package`, buildPackage())}>
          🖨 Print
        </button>
        <button
          className="btn primary"
          onClick={() =>
            downloadDoc(
              safeFilename(`${course.label}_Audit_Package`),
              `${course.label} — audit package`,
              buildPackage(),
            )
          }
        >
          ⬇ Audit package
        </button>
      </div>

      <div className="section-title">Held in CES</div>
      <div className="list">
        {held.map((r) => (
          <div key={r.id} className="row left-accent acc-ok">
            <div className="grow">
              <div className="title">{r.label}</div>
              <div className="meta">{r.why}</div>
            </div>
            <span className="pill ok">✓ held</span>
          </div>
        ))}
      </div>

      <div className="section-title">Kept elsewhere — tracked here</div>
      <div className="list">
        {external.map((r) => {
          const doc = docs.find((d) => d.typeId === r.id)
          const st = RECORD_STATUS.find((s) => s.value === (doc?.status ?? 'missing'))!
          return (
            <div
              key={r.id}
              className={`row left-accent ${st.value === 'approved' ? 'acc-ok' : st.value === 'missing' ? 'acc-crit' : 'acc-warn'}`}
            >
              <div className="grow">
                <div className="title">{r.label}</div>
                <div className="meta">
                  {doc?.location || <span style={{ color: 'var(--warn)' }}>location not recorded</span>}
                  {doc?.owner && ` · ${doc.owner}`}
                  {doc?.version && ` · v${doc.version}`}
                </div>
                <div className="help-text">{r.why}</div>
              </div>
              <span className={`pill ${st.pill}`}>{st.label}</span>
              {manageAcademy && (
                <button className="btn sm" onClick={() => setEditing(r)}>
                  Edit
                </button>
              )}
            </div>
          )
        })}
      </div>

      {editing && (
        <RecordModal
          course={course}
          record={editing}
          doc={docs.find((d) => d.typeId === editing.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
