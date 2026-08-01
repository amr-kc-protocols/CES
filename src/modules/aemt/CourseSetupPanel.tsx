import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '../../components/ui'
import { updateCourse, deleteCourse, useCourseFootprint } from './aemtStore'
import { PRECEPTOR_LABELS } from '../../data/aemt'
import type { PreceptorCredential } from '../../data/aemt'
import { agreementStatus } from '../../data/aemtRecords'
import type { AemtCourse, AemtSite, PreceptorCredentialId } from '../../types'

// ---------------------------------------------------------------------------
// Course setup and its readiness for the KBEMS approval application.
//
// K.A.R. 109-11-4a wants the sponsoring organization, the primary instructor,
// and the clinical and field sites with executed agreements. Course records
// were previously write-once — the creation form even promised the KSBEMS
// number could be added "once the course is approved", with no way to do it.
// ---------------------------------------------------------------------------

const SITE_KINDS: { value: AemtSite['kind']; label: string }[] = [
  { value: 'clinical', label: 'Hospital clinical' },
  { value: 'field', label: 'Field internship' },
]

/** What the approval application still needs. */
export function applicationGaps(course: AemtCourse): string[] {
  const gaps: string[] = []
  if (!course.organization?.trim()) gaps.push('sponsoring organization')
  if (!course.primaryInstructor?.trim()) gaps.push('primary instructor')
  if (!course.medicalDirector?.trim()) gaps.push('medical director')
  const sites = course.sites ?? []
  if (!sites.some((s) => s.kind === 'clinical')) gaps.push('clinical site')
  if (!sites.some((s) => s.kind === 'field')) gaps.push('field internship site')
  // Derived from the evidence on each site, not from a stored label.
  if (sites.some((s) => agreementStatus(s, course).value !== 'executed')) {
    gaps.push('executed site agreements')
  }
  return gaps
}

function EditModal({ course, onClose }: { course: AemtCourse; onClose: () => void }) {
  const [label, setLabel] = useState(course.label)
  const [organization, setOrg] = useState(course.organization ?? '')
  const [courseNumber, setNumber] = useState(course.courseNumber ?? '')
  const [startDate, setStart] = useState(course.startDate)
  const [endDate, setEnd] = useState(course.endDate)
  const [coordinator, setCoord] = useState(course.coordinator ?? '')
  const [medicalDirector, setMd] = useState(course.medicalDirector ?? '')
  const [instructor, setInstructor] = useState(course.primaryInstructor ?? '')
  const [instructorCred, setInstructorCred] = useState<PreceptorCredentialId>(
    course.primaryInstructorCredential ?? 'paramedic',
  )
  const [instructorCert, setInstructorCert] = useState(course.primaryInstructorCertNumber ?? '')
  // Hour commitments are editable here because they are rarely all known at
  // once — a clinical affiliation is often still being negotiated when the
  // classroom hours are already fixed.
  const num = (v?: number) => (typeof v === 'number' ? String(v) : '')
  const [didactic, setDidactic] = useState(num(course.targets?.didactic))
  const [lab, setLab] = useState(num(course.targets?.lab))
  const [clinical, setClinical] = useState(num(course.targets?.clinical))
  const [field, setField] = useState(num(course.targets?.field))

  const valid = label.trim() !== '' && startDate !== '' && endDate !== '' && startDate <= endDate

  return (
    <Modal title="Edit course" onClose={onClose}>
      <div className="field">
        <label htmlFor="ce-label">Course name</label>
        <input id="ce-label" value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="ce-start">Start date</label>
          <input id="ce-start" type="date" value={startDate} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ce-end">End date</label>
          <input id="ce-end" type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="ce-org">Sponsoring organization</label>
        <input id="ce-org" value={organization} onChange={(e) => setOrg(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="ce-num">KSBEMS course number</label>
        <input
          id="ce-num"
          value={courseNumber}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="Assigned once the course is approved"
        />
      </div>

      <div className="section-title" style={{ marginTop: 14 }}>
        Named on the application
      </div>
      <div className="field">
        <label htmlFor="ce-pi">Primary instructor</label>
        <input id="ce-pi" value={instructor} onChange={(e) => setInstructor(e.target.value)} />
        <div className="help-text">
          Under K.A.R. 109-17-1 they must be certified or licensed in the subject matter. No
          Instructor-Coordinator credential is required.
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="ce-pi-cred">Credential</label>
          <select
            id="ce-pi-cred"
            value={instructorCred}
            onChange={(e) => setInstructorCred(e.target.value as PreceptorCredentialId)}
          >
            {(Object.keys(PRECEPTOR_LABELS) as PreceptorCredential[]).map((c) => (
              <option key={c} value={c}>
                {PRECEPTOR_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ce-pi-cert">Certificate #</label>
          <input
            id="ce-pi-cert"
            value={instructorCert}
            onChange={(e) => setInstructorCert(e.target.value)}
          />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="ce-coord">Program manager</label>
          <input id="ce-coord" value={coordinator} onChange={(e) => setCoord(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ce-md">Medical director</label>
          <input id="ce-md" value={medicalDirector} onChange={(e) => setMd(e.target.value)} />
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 16 }}>
        Filed hours
      </div>
      <div className="help-text" style={{ marginTop: 0, marginBottom: 8 }}>
        Each is reconciled independently. Fill in what has been filed and leave the rest blank —
        blank means "not filed", which is reported as such rather than treated as zero.
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="ce-did">Didactic</label>
          <input id="ce-did" type="number" min={0} value={didactic} onChange={(e) => setDidactic(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ce-lab">Lab</label>
          <input id="ce-lab" type="number" min={0} value={lab} onChange={(e) => setLab(e.target.value)} />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="ce-clin">Hospital clinical</label>
          <input id="ce-clin" type="number" min={0} value={clinical} onChange={(e) => setClinical(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ce-field">Field internship</label>
          <input id="ce-field" type="number" min={0} value={field} onChange={(e) => setField(e.target.value)} />
        </div>
      </div>
      {didactic.trim() !== '' && lab.trim() === '' && (
        <div className="banner warn">
          Classroom hours are reconciled as didactic + lab together, because attendance is taken
          per session. With only one filed, classroom time cannot be compared to anything.
        </div>
      )}

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          className="btn primary"
          disabled={!valid}
          onClick={() => {
            const t = (v: string) => {
              const n = Number(v)
              return v.trim() !== '' && Number.isFinite(n) && n > 0 ? n : undefined
            }
            const targets = {
              didactic: t(didactic),
              lab: t(lab),
              clinical: t(clinical),
              field: t(field),
            }
            updateCourse(course.id, {
              targets: Object.values(targets).some((v) => v !== undefined) ? targets : undefined,
              label: label.trim(),
              organization: organization.trim() || undefined,
              courseNumber: courseNumber.trim() || undefined,
              startDate,
              endDate,
              coordinator: coordinator.trim() || undefined,
              medicalDirector: medicalDirector.trim() || undefined,
              primaryInstructor: instructor.trim() || undefined,
              primaryInstructorCredential: instructor.trim() ? instructorCred : undefined,
              primaryInstructorCertNumber: instructorCert.trim() || undefined,
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

function SiteModal({
  course,
  existing,
  onClose,
}: {
  course: AemtCourse
  existing?: AemtSite
  onClose: () => void
}) {
  const [name, setName] = useState(existing?.name ?? '')
  const [kind, setKind] = useState<AemtSite['kind']>(existing?.kind ?? 'clinical')
  const [contact, setContact] = useState(existing?.contact ?? '')
  const [agreementRef, setRef] = useState(existing?.agreementRef ?? '')
  const [signedDate, setSignedDate] = useState(existing?.signedDate ?? '')
  const [signedBySite, setSite] = useState(existing?.signedBySite ?? '')
  const [signedByProgram, setProgram] = useState(existing?.signedByProgram ?? '')
  const [effectiveFrom, setFrom] = useState(existing?.effectiveFrom ?? '')
  const [effectiveTo, setTo] = useState(existing?.effectiveTo ?? '')
  const [permits, setPermits] = useState(existing?.permits ?? '')

  const live = agreementStatus(
    { agreementRef, signedDate, signedBySite, signedByProgram, effectiveFrom, effectiveTo, permits },
    course,
  )

  const save = () => {
    const sites = [...(course.sites ?? [])]
    const next: AemtSite = {
      id: existing?.id ?? `site-${Date.now()}`,
      name: name.trim(),
      kind,
      // Stored for older readers; every display path recomputes it.
      agreement: live.value,
      contact: contact.trim() || undefined,
      agreementRef: agreementRef.trim() || undefined,
      signedDate: signedDate || undefined,
      signedBySite: signedBySite.trim() || undefined,
      signedByProgram: signedByProgram.trim() || undefined,
      effectiveFrom: effectiveFrom || undefined,
      effectiveTo: effectiveTo || undefined,
      permits: permits.trim() || undefined,
    }
    const i = sites.findIndex((s) => s.id === next.id)
    if (i >= 0) sites[i] = next
    else sites.push(next)
    updateCourse(course.id, { sites })
    onClose()
  }

  return (
    <Modal title={existing ? 'Edit site' : 'Add site'} onClose={onClose}>
      <div className="field">
        <label htmlFor="st-name">Site name</label>
        <input
          id="st-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="AdventHealth Kansas City"
        />
      </div>
      <div className="field">
        <label htmlFor="st-kind">Type</label>
        <select id="st-kind" value={kind} onChange={(e) => setKind(e.target.value as AemtSite['kind'])}>
          {SITE_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="st-ref">Executed agreement — where it lives</label>
        <input
          id="st-ref"
          value={agreementRef}
          onChange={(e) => setRef(e.target.value)}
          placeholder="SharePoint path or file name of the signed agreement"
        />
        <div className="help-text">
          CES does not store the document. Record where an auditor would find it — the status below
          is computed from what is recorded here, not chosen from a menu.
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="st-signed">Date signed</label>
          <input
            id="st-signed"
            type="date"
            value={signedDate}
            onChange={(e) => setSignedDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="st-sig-site">Signed for the site</label>
          <input id="st-sig-site" value={signedBySite} onChange={(e) => setSite(e.target.value)} />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="st-sig-prog">Signed for the program</label>
          <input
            id="st-sig-prog"
            value={signedByProgram}
            onChange={(e) => setProgram(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="st-from">Effective from</label>
          <input id="st-from" type="date" value={effectiveFrom} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="st-to">Effective to</label>
          <input id="st-to" type="date" value={effectiveTo} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="st-permits">What the agreement permits students to do</label>
        <textarea
          id="st-permits"
          value={permits}
          onChange={(e) => setPermits(e.target.value)}
          placeholder="Venipuncture, IV initiation, IM/SubQ injection, medication administration under RN supervision…"
        />
        <div className="help-text">
          K.A.R. 109-11-8 requires venipuncture and injections. An agreement that does not cover
          them cannot support the minimums this course filed.
        </div>
      </div>

      <div className={`banner ${live.pill === 'ok' ? 'ok' : live.pill === 'crit' ? 'crit' : 'warn'}`}>
        <strong>{live.label}.</strong>{' '}
        {live.outOfPeriod
          ? 'The agreement is signed but its effective period does not span this course.'
          : live.missing.length > 0
            ? `Not executed until recorded: ${live.missing.join(', ')}.`
            : 'Everything an auditor would ask for is recorded.'}
      </div>
      <div className="field">
        <label htmlFor="st-contact">Contact</label>
        <input id="st-contact" value={contact} onChange={(e) => setContact(e.target.value)} />
      </div>
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn primary" disabled={!name.trim()} onClick={save}>
          Save
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        {existing && (
          <button
            className="btn danger"
            style={{ marginLeft: 'auto' }}
            onClick={() => {
              updateCourse(course.id, {
                sites: (course.sites ?? []).filter((s) => s.id !== existing.id),
              })
              onClose()
            }}
          >
            Remove
          </button>
        )}
      </div>
    </Modal>
  )
}

/**
 * Deleting a course takes its roster, schedule, encounters, skill check-offs,
 * completions and audit trail with it. That is the right behaviour — orphaned
 * rows help nobody — but it is not something to do behind a one-line confirm,
 * so the modal counts what will go and makes a course carrying real records
 * harder to delete than an empty test one.
 */
function DeleteModal({ course, onClose }: { course: AemtCourse; onClose: () => void }) {
  const f = useCourseFootprint(course.id)
  const navigate = useNavigate()
  const [typed, setTyped] = useState('')

  // A course with verified completions, recorded KBEMS filings or a course
  // number is a filed record with a three-year retention obligation under
  // K.A.R. 109-17-3. Deleting one should take deliberate effort.
  const isOfficial = f.completions > 0 || f.submissions > 0 || !!course.courseNumber
  const canDelete = !isOfficial || typed.trim() === course.label

  const counts: [number, string][] = [
    [f.students, 'student'],
    [f.sessions, 'session'],
    [f.shifts, 'shift'],
    [f.encounters, 'logged encounter'],
    [f.skillChecks, 'skill check-off'],
    [f.formResponses, 'form response'],
    [f.completions, 'verified completion'],
    [f.auditEvents, 'audit event'],
  ]
  const nonZero = counts.filter(([n]) => n > 0)

  return (
    <Modal title={`Delete ${course.label}?`} onClose={onClose}>
      {f.empty ? (
        <div className="banner info" style={{ marginTop: 0 }}>
          Nothing has been recorded against this course. Deleting it removes the course record
          only.
        </div>
      ) : (
        <>
          <div className="banner crit" style={{ marginTop: 0 }}>
            <strong>This deletes everything the course owns.</strong> Undo is offered for ten
            seconds afterwards — after that the records are gone.
          </div>
          <div className="list" style={{ marginTop: 10 }}>
            {nonZero.map(([n, label]) => (
              <div key={label} className="row">
                <div className="grow">
                  <div className="title" style={{ fontSize: 14 }}>
                    {n} {label}
                    {n === 1 ? '' : 's'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {isOfficial && (
        <>
          <div className="banner warn">
            <strong>This looks like a filed course, not a test.</strong>{' '}
            {course.courseNumber && <>It carries KSBEMS #{course.courseNumber}. </>}
            {f.completions > 0 && (
              <>
                {f.completions} student completion{f.completions === 1 ? ' has' : 's have'} been
                verified against it.{' '}
              </>
            )}
            {f.submissions > 0 && (
              <>
                {f.submissions} filing{f.submissions === 1 ? ' has' : 's have'} been recorded as
                submitted to KBEMS.{' '}
              </>
            )}
            Program records must be kept for three years under K.A.R. 109-17-3 — export the audit
            package from the Records tab before deleting.
          </div>
          <div className="field">
            <label htmlFor="del-confirm">
              Type <strong>{course.label}</strong> to confirm
            </label>
            <input
              id="del-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
            />
          </div>
        </>
      )}

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn danger"
          disabled={!canDelete}
          style={{ marginLeft: 'auto' }}
          onClick={() => {
            deleteCourse(course.id)
            onClose()
            navigate('/aemt')
          }}
        >
          Delete course
        </button>
      </div>
    </Modal>
  )
}

export default function CourseSetupPanel({
  course,
  canEdit,
}: {
  course: AemtCourse
  canEdit: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [site, setSite] = useState<AemtSite | null>(null)
  const [addingSite, setAddingSite] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const gaps = applicationGaps(course)
  const sites = course.sites ?? []

  return (
    <>
      <div className="section-title">Approval application</div>

      {gaps.length > 0 ? (
        <div className="banner warn">
          <strong>Not ready to submit.</strong> Still needed: {gaps.join(', ')}.
        </div>
      ) : (
        <div className="banner ok">
          ✓ Everything K.A.R. 109-11-4a names is on file. The schedule still has to show the date,
          time, subject, instructor and lab hours of every session.
        </div>
      )}

      <div className="list" style={{ marginTop: 10 }}>
        <div className="row">
          <div className="grow">
            <div className="title">Course record</div>
            <div className="meta">
              {course.organization || <span style={{ color: 'var(--warn)' }}>no organization</span>}
              {course.courseNumber && ` · KSBEMS #${course.courseNumber}`}
            </div>
            <div className="meta">
              Primary instructor:{' '}
              {course.primaryInstructor ? (
                <>
                  {course.primaryInstructor}
                  {course.primaryInstructorCredential &&
                    ` (${PRECEPTOR_LABELS[course.primaryInstructorCredential as PreceptorCredential]})`}
                </>
              ) : (
                <span style={{ color: 'var(--warn)' }}>not named</span>
              )}
            </div>
            <div className="meta">
              Medical director: {course.medicalDirector || <span style={{ color: 'var(--warn)' }}>not named</span>}
            </div>
          </div>
          {canEdit && (
            <button className="btn sm" onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="toolbar" style={{ marginTop: 10 }}>
        <span className="subtle">
          {sites.length} site{sites.length === 1 ? '' : 's'}
        </span>
        <div className="spacer" />
        {canEdit && (
          <button className="btn sm primary" onClick={() => setAddingSite(true)}>
            + Site
          </button>
        )}
      </div>

      {sites.length === 0 ? (
        <div className="banner info">
          No clinical or field sites recorded. The application names them, and each needs an
          executed agreement first.
        </div>
      ) : (
        <div className="list">
          {sites.map((s) => {
            const a = agreementStatus(s, course)
            return (
              <div key={s.id} className={`row left-accent ${a.pill === 'ok' ? 'acc-ok' : a.pill === 'crit' ? 'acc-crit' : 'acc-warn'}`}>
                <div className="grow">
                  <div className="title">{s.name}</div>
                  <div className="meta">
                    {SITE_KINDS.find((k) => k.value === s.kind)?.label}
                    {s.contact && ` · ${s.contact}`}
                    {s.agreementRef && ` · ${s.agreementRef}`}
                  </div>
                  {a.missing.length > 0 && (
                    <div className="meta" style={{ color: 'var(--warn)' }}>
                      Not executed until recorded: {a.missing.join(', ')}
                    </div>
                  )}
                  {a.outOfPeriod && (
                    <div className="meta" style={{ color: 'var(--crit)' }}>
                      Signed, but the covered period ({s.effectiveFrom}
                      {s.effectiveTo ? ` – ${s.effectiveTo}` : ' onward'}) does not span this
                      course.
                    </div>
                  )}
                  {s.permits && <div className="help-text">Permits: {s.permits}</div>}
                </div>
                <span className={`pill ${a.pill}`}>{a.label}</span>
                {canEdit && (
                  <button className="btn sm" onClick={() => setSite(s)}>
                    Edit
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {canEdit && (
        <div className="toolbar" style={{ marginTop: 10 }}>
          <div className="spacer" />
          <button className="btn sm danger" onClick={() => setDeleting(true)}>
            Delete course
          </button>
        </div>
      )}

      {editing && <EditModal course={course} onClose={() => setEditing(false)} />}
      {addingSite && <SiteModal course={course} onClose={() => setAddingSite(false)} />}
      {site && <SiteModal course={course} existing={site} onClose={() => setSite(null)} />}
      {deleting && <DeleteModal course={course} onClose={() => setDeleting(false)} />}
    </>
  )
}
