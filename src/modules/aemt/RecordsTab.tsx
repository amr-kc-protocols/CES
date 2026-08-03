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
  useRecordSafety,
} from './aemtStore'
import {
  REQUIRED_RECORDS,
  RETENTION_YEARS,
  retentionUntil,
  docStatus,
} from '../../data/aemtRecords'
import type { RequiredRecord } from '../../data/aemtRecords'
import { auditPackageHTML } from './auditPackage'
import { buildEvidenceBundle, bundleHash, formatHash, downloadJSON } from './evidence'
import { recordAuditEvent } from './aemtStore'
import { notifyUser } from '../../lib/dialog'
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
  const [owner, setOwner] = useState(doc?.owner ?? '')
  const [version, setVersion] = useState(doc?.version ?? '')
  const [location, setLocation] = useState(doc?.location ?? '')
  const [approvedBy, setApprovedBy] = useState(doc?.approvedBy ?? '')
  const [notes, setNotes] = useState(doc?.notes ?? '')
  const [approvedDate, setApprovedDate] = useState(doc?.approvedDate ?? '')
  const live = docStatus({ location, owner, version, approvedBy, approvedDate })

  return (
    <Modal title={record.label} onClose={onClose}>
      <div className="help-text" style={{ marginTop: 0, marginBottom: 10 }}>
        {record.why}
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
      <div className="field-row">
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
          <label htmlFor="rd-apprd">Approval date</label>
          <input
            id="rd-apprd"
            type="date"
            value={approvedDate}
            onChange={(e) => setApprovedDate(e.target.value)}
          />
        </div>
      </div>

      {/* Status is computed from the fields above — there is no menu for it.
          A record that reads "Approved" with nothing behind it is exactly
          what an inventory exists to catch. */}
      <div className={`banner ${live.pill === 'ok' ? 'ok' : live.pill === 'crit' ? 'crit' : 'warn'}`}>
        <strong>{live.label}.</strong>{' '}
        {live.missing.length > 0
          ? `Still needed: ${live.missing.join(', ')}.`
          : 'Every field an auditor would ask for is recorded.'}
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
              // Stored so older readers still see something sensible; every
              // display path recomputes it from the fields.
              status: live.value,
              owner: owner.trim() || undefined,
              version: version.trim() || undefined,
              location: location.trim() || undefined,
              approvedBy: approvedBy.trim() || undefined,
              approvedDate: approvedDate || undefined,
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
  const { manageAemt: manageAcademy } = useCan()
  const [editing, setEditing] = useState<RequiredRecord | null>(null)
  const safety = useRecordSafety()

  const input = {
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
  }

  /**
   * Build the packet with its fingerprint, and record the fingerprint in the
   * audit trail as the export happens. That entry is what a later packet gets
   * checked against — without it the hash printed on the page proves only that
   * the page is self-consistent.
   */
  async function buildSigned(): Promise<{ html: string; bundle: ReturnType<typeof buildEvidenceBundle>; hash: string | null }> {
    const bundle = buildEvidenceBundle(input, safety.actor)
    const hash = await bundleHash(bundle)
    recordAuditEvent(
      course.id,
      undefined,
      safety.actor,
      'audit package exported',
      `fingerprint ${hash ? hash.slice(0, 16) : 'unavailable'} · ${bundle.manifest
        .map((m) => `${m.record}:${m.count}`)
        .join(' ')}`,
    )
    return {
      html: auditPackageHTML(input, { hash, actor: safety.actor, manifest: bundle.manifest }),
      bundle,
      hash,
    }
  }

  const external = REQUIRED_RECORDS.filter((r) => r.source === 'external')
  const held = REQUIRED_RECORDS.filter((r) => r.source === 'ces')
  const outstanding = external.filter(
    (r) => docStatus(docs.find((d) => d.typeId === r.id)).value !== 'approved',
  )

  // "Held in CES" has to mean something is actually in it. Counting the
  // underlying records is the only honest way to say so — the previous list
  // printed "✓ held" for an empty course.
  const evidenceCounts: Record<string, number> = {
    attendance: attendance.length,
    skillChecks: skillChecks.length,
    encounters: encounters.length,
    formResponses: forms.length,
    students: students.length,
    sessions: sessions.length,
    completions: completions.length,
  }

  return (
    <div>
      <div className="banner info">
        Program records must be retained for {RETENTION_YEARS} years under K.A.R. 109-17-3 — for
        this course, until <strong>{formatDate(retentionUntil(course.endDate))}</strong>.
      </div>

      {!safety.canRecordOfficial && (
        <div className="banner crit">
          <strong>Draft only.</strong> {safety.reason} The audit package can still be generated, but
          it will not carry an attributable submission or completion.
        </div>
      )}

      <div className="toolbar" style={{ marginTop: 12 }}>
        <span className="subtle">
          {outstanding.length === 0
            ? 'All external records approved'
            : `${outstanding.length} external record${outstanding.length === 1 ? '' : 's'} outstanding`}
        </span>
        <div className="spacer" />
        <button
          className="btn"
          onClick={async () => {
            const { html } = await buildSigned()
            printDoc(`${course.label} — audit package`, html)
          }}
        >
          🖨 Print
        </button>
        <button
          className="btn primary"
          onClick={async () => {
            const { html, bundle, hash } = await buildSigned()
            const base = safeFilename(`${course.label}_Audit_Package`)
            downloadDoc(base, `${course.label} — audit package`, html)
            // The machine-readable half: what the fingerprint is computed over.
            downloadJSON(`${base}_evidence`, bundle)
            notifyUser(
              `Audit package exported. Fingerprint ${formatHash(hash).slice(0, 17)}… recorded in the audit trail.`,
            )
          }}
        >
          ⬇ Audit package + evidence
        </button>
      </div>

      <div className="section-title">Held in CES</div>
      <div className="list">
        {held.map((r) => {
          const n = r.evidence ? evidenceCounts[r.evidence] : undefined
          const empty = n === 0
          return (
            <div key={r.id} className={`row left-accent ${empty ? 'acc-warn' : 'acc-ok'}`}>
              <div className="grow">
                <div className="title">{r.label}</div>
                <div className="meta">{r.why}</div>
                {empty && (
                  <div className="meta" style={{ color: 'var(--warn)' }}>
                    Nothing recorded yet — this record does not exist for this course.
                  </div>
                )}
              </div>
              <span className={`pill ${empty ? 'warn' : 'ok'}`}>
                {n === undefined ? '✓ held' : empty ? 'empty' : `✓ ${n} on file`}
              </span>
            </div>
          )
        })}
      </div>

      <div className="section-title">Kept elsewhere — tracked here</div>
      <div className="list">
        {external.map((r) => {
          const doc = docs.find((d) => d.typeId === r.id)
          const st = docStatus(doc)
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
                  {doc?.approvedDate && ` · approved ${doc.approvedDate}`}
                </div>
                {st.missing.length > 0 && st.value !== 'missing' && (
                  <div className="meta" style={{ color: 'var(--warn)' }}>
                    Missing: {st.missing.join(', ')}
                  </div>
                )}
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

      <div className="section-title">
        Audit trail
        <span className="subtle" style={{ fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
          append-only
        </span>
      </div>
      {audit.length === 0 ? (
        <div className="banner info">
          No consequential actions recorded yet. Completions, overrides, revocations, shift
          attestations and KBEMS submissions are logged here as they happen.
        </div>
      ) : (
        <div className="list">
          {audit.slice(0, 40).map((e) => (
            <div
              key={e.id}
              className={`row left-accent ${/OVERRIDE|revoked|withdrawn/.test(e.action) ? 'acc-crit' : ''}`}
            >
              <div className="grow">
                <div className="title" style={{ fontSize: 14 }}>
                  {e.action}
                </div>
                <div className="meta">{e.detail}</div>
                <div className="meta">
                  {e.at.replace('T', ' ').slice(0, 16)} · {e.actor}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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
