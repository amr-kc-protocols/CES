import { useState } from 'react'
import { Empty, Modal, ProgressBar } from '../../components/ui'
import { formatDate, todayISO } from '../../lib/date'
import {
  useStudents,
  useEncounters,
  useClinicalStanding,
  addEncounter,
  deleteEncounter,
  progressFor,
} from './aemtStore'
import { KAR_109_11_8 } from '../../data/aemt'
import { useCan } from '../../lib/role'
import type { AemtCourse, AemtSiteKind } from '../../types'

const SITE_KINDS: { value: AemtSiteKind; label: string }[] = [
  { value: 'field', label: 'Field internship (AMR)' },
  { value: 'hospital', label: 'Hospital clinical' },
  { value: 'lab', label: 'Skills lab / sim' },
]

const SITE_LABEL: Record<AemtSiteKind, string> = {
  field: 'Field',
  hospital: 'Hospital',
  lab: 'Lab',
}

function LogForm({
  course,
  studentId,
  onClose,
}: {
  course: AemtCourse
  studentId: string
  onClose: () => void
}) {
  const [date, setDate] = useState(todayISO())
  const [requirementId, setReq] = useState(KAR_109_11_8[0].id)
  const [siteKind, setSiteKind] = useState<AemtSiteKind>('field')
  const [site, setSite] = useState('')
  const [count, setCount] = useState(1)
  const [initiatedInfusion, setInfusion] = useState(false)
  const [preceptor, setPreceptor] = useState('')

  const req = KAR_109_11_8.find((r) => r.id === requirementId)!
  const fieldOnly = (req.fieldMinimum ?? 0) > 0

  return (
    <Modal title="Log encounter" onClose={onClose}>
      <div className="banner warn" style={{ marginBottom: 12 }}>
        <strong>No patient information.</strong> This log records the skill, site, and preceptor
        only — never names, dates of birth, or any other PHI.
      </div>
      <div className="field">
        <label htmlFor="ae-req">Requirement</label>
        <select id="ae-req" value={requirementId} onChange={(e) => setReq(e.target.value)}>
          {KAR_109_11_8.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label} (min {r.minimum})
            </option>
          ))}
        </select>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="ae-date">Date</label>
          <input id="ae-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ae-count">Reps</label>
          <input
            id="ae-count"
            type="number"
            min={1}
            value={count}
            onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="ae-kind">Setting</label>
        <select
          id="ae-kind"
          value={siteKind}
          onChange={(e) => setSiteKind(e.target.value as AemtSiteKind)}
        >
          {SITE_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        {!req.allowedSettings.includes(siteKind) && (
          <div className="help-text" style={{ color: 'var(--crit)' }}>
            {req.label} does not count in this setting — it will be logged but excluded from the
            total. Allowed: {req.allowedSettings.join(', ')}.
          </div>
        )}
        {req.allowedSettings.includes(siteKind) && fieldOnly && siteKind !== 'field' && (
          <div className="help-text" style={{ color: 'var(--crit)' }}>
            {req.label} needs {req.fieldMinimum} in the field — this entry will not count toward
            that part of the minimum.
          </div>
        )}
      </div>
      <div className="field">
        <label htmlFor="ae-site">Site (optional)</label>
        <input
          id="ae-site"
          value={site}
          onChange={(e) => setSite(e.target.value)}
          placeholder="AdventHealth KC — ED"
        />
      </div>
      {req.subRequirement && (
        <label className="field" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={initiatedInfusion}
            onChange={(e) => setInfusion(e.target.checked)}
            style={{ width: 'auto', minHeight: 0 }}
          />
          <span>
            This stick {req.subRequirement.label} ({req.subRequirement.minimum} of{' '}
            {req.minimum} required)
          </span>
        </label>
      )}
      <div className="field">
        <label htmlFor="ae-prec">Preceptor</label>
        <input id="ae-prec" value={preceptor} onChange={(e) => setPreceptor(e.target.value)} />
      </div>
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          className="btn primary"
          onClick={() => {
            addEncounter(course.id, studentId, {
              date,
              requirementId,
              siteKind,
              site: site.trim() || undefined,
              count,
              initiatedInfusion: req.subRequirement ? initiatedInfusion : undefined,
              preceptor: preceptor.trim() || undefined,
            })
            onClose()
          }}
        >
          Log it
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}

export default function ClinicalTab({ course }: { course: AemtCourse }) {
  const students = useStudents(course.id)
  const encounters = useEncounters(course.id)
  const standing = useClinicalStanding(course.id)
  const { editRideWork: canEdit } = useCan()
  const [selectedId, setSelected] = useState<string | null>(null)
  const [logging, setLogging] = useState(false)

  if (students.length === 0) {
    return (
      <Empty icon="🧑‍🚒" title="No students yet">
        Add students on the Roster tab, then log their clinical and field encounters here.
      </Empty>
    )
  }

  const studentId = selectedId ?? students[0].id
  const student = students.find((s) => s.id === studentId) ?? students[0]
  const progress = progressFor(encounters, student.id)
  const mine = encounters.filter((e) => e.studentId === student.id)
  const metCount = progress.filter((p) => p.met).length

  return (
    <div>
      <div className="banner info">
        Progress toward the <strong>K.A.R. 109-11-8</strong> clinical minimums. Each requirement
        counts only the settings it allows — simulation counts for IO, but not for ECG, which the
        regulation requires on real patients. Entries in a setting that does not count are kept and
        shown, never folded into the total.
      </div>

      {/* Class overview — who is short, at a glance. */}
      <div className="section-title">Class standing</div>
      <div className="list">
        {standing.map((s) => (
          <button
            key={s.student.id}
            className="row"
            style={{
              width: '100%',
              textAlign: 'left',
              background: s.student.id === student.id ? 'var(--muted-bg)' : undefined,
              border: 'none',
              font: 'inherit',
            }}
            onClick={() => setSelected(s.student.id)}
          >
            <div className="grow">
              <div className="title">{s.student.name}</div>
              <div className="meta">
                {s.metCount} of {s.progress.length} requirements complete
              </div>
              <div style={{ marginTop: 6 }}>
                <ProgressBar
                  pct={Math.round((s.metCount / s.progress.length) * 100)}
                  complete={s.complete}
                />
              </div>
            </div>
            {s.complete && <span className="pill ok">✓ All met</span>}
          </button>
        ))}
      </div>

      <div className="section-title">
        {student.name} · {metCount} of {progress.length} met
      </div>

      {canEdit && (
        <div className="toolbar">
          <div className="spacer" />
          <button className="btn primary" onClick={() => setLogging(true)}>
            + Log encounter
          </button>
        </div>
      )}

      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th>Requirement</th>
              <th style={{ textAlign: 'right' }}>Logged</th>
              <th style={{ textAlign: 'right' }}>Min</th>
              <th style={{ textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {progress.map((p) => (
              <tr key={p.requirement.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{p.requirement.label}</div>
                  {p.requirement.fieldMinimum ? (
                    <div
                      className="subtle"
                      style={{ fontSize: 12, color: p.fieldMet ? undefined : 'var(--crit)' }}
                    >
                      field {p.field}/{p.requirement.fieldMinimum}
                      {!p.fieldMet && ' — field share not met'}
                    </div>
                  ) : null}
                  {p.ineligible > 0 ? (
                    <div className="subtle" style={{ fontSize: 12, color: 'var(--warn)' }}>
                      {p.ineligible} logged in a setting that does not count toward this
                    </div>
                  ) : null}
                  {p.requirement.subRequirement ? (
                    <div
                      className="subtle"
                      style={{ fontSize: 12, color: p.subMet ? undefined : 'var(--crit)' }}
                    >
                      {p.sub}/{p.requirement.subRequirement.minimum}{' '}
                      {p.requirement.subRequirement.label}
                    </div>
                  ) : null}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{p.total}</td>
                <td style={{ textAlign: 'right' }} className="subtle">
                  {p.requirement.minimum}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span className={`pill ${p.met ? 'ok' : 'warn'}`}>{p.met ? '✓' : 'open'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-title">Log · {mine.length} entries</div>
      {mine.length === 0 ? (
        <div className="banner info">Nothing logged for {student.name} yet.</div>
      ) : (
        <div className="list">
          {mine.map((e) => {
            const req = KAR_109_11_8.find((r) => r.id === e.requirementId)
            return (
              <div key={e.id} className="row">
                <div className="grow">
                  <div className="title">
                    {req?.label ?? e.requirementId}
                    {e.count > 1 && <span className="subtle"> ×{e.count}</span>}
                    {e.initiatedInfusion && (
                      <span className="pill info" style={{ marginLeft: 8 }}>
                        infusion
                      </span>
                    )}
                  </div>
                  <div className="meta">
                    {formatDate(e.date)} · {SITE_LABEL[e.siteKind]}
                    {e.site && ` · ${e.site}`}
                    {e.preceptor && ` · ${e.preceptor}`}
                  </div>
                </div>
                {canEdit && (
                  <button className="btn sm danger" onClick={() => deleteEncounter(e.id)}>
                    ✕
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {logging && (
        <LogForm course={course} studentId={student.id} onClose={() => setLogging(false)} />
      )}
    </div>
  )
}
