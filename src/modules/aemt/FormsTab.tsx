import { useState } from 'react'
import { Empty, Modal } from '../../components/ui'
import { confirmAction } from '../../lib/dialog'
import { formatDate, todayISO } from '../../lib/date'
import {
  useStudents,
  useFormResponses,
  addFormResponse,
  deleteFormResponse,
  flaggedResponses,
  openConcerns,
  resolveFormResponse,
  useRecordSafety,
  useShifts,
  useCourse,
  formOwedFor,
  instructorsOfRecord,
} from './aemtStore'
import type { AemtFormResponse } from '../../types'
import { useAemtForms, liveAemtForm, aemtFormAtVersion } from '../templates/resolve'
import type { AemtFormDef, FormField } from '../../data/aemtForms'
import { useCan } from '../../lib/role'
import type { AemtCourse } from '../../types'

type Values = Record<string, string | number | boolean>

function Field({
  field,
  value,
  onChange,
  options,
}: {
  field: FormField
  value: string | number | boolean | undefined
  onChange: (v: string | number | boolean | undefined) => void
  /**
   * A closed answer set, where the course knows one. Only the instructor name
   * has one today, and it matters: the record of which instructors a student
   * evaluated is counted by distinct name, so "J. Jones" typed once and
   * "Jordan Jones" typed again is two instructors evaluated and a co-instructor
   * still not evaluated by anybody.
   */
  options?: string[]
}) {
  if (field.kind === 'scale' && field.scale) {
    const { min, max, minLabel, maxLabel } = field.scale
    const opts = Array.from({ length: max - min + 1 }, (_, i) => min + i)
    return (
      <div style={{ padding: '8px 0' }}>
        <div style={{ fontSize: 14, marginBottom: 6 }}>{field.label}</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {opts.map((n) => (
            <button
              key={n}
              className={`choice${value === n ? ' active' : ''}`}
              style={{ flex: 1, padding: '6px 4px' }}
              onClick={() => onChange(value === n ? undefined : n)}
              aria-label={`${field.label}: ${n} of ${max}`}
            >
              {n}
            </button>
          ))}
        </div>
        <div
          className="subtle"
          style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 3 }}
        >
          <span>
            {min} = {minLabel}
          </span>
          <span>
            {max} = {maxLabel}
          </span>
        </div>
      </div>
    )
  }

  if (field.kind === 'yesno') {
    return (
      <div style={{ padding: '8px 0' }}>
        <div style={{ fontSize: 14, marginBottom: 6 }}>{field.label}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[true, false].map((b) => (
            <button
              key={String(b)}
              className={`choice${value === b ? ' active' : ''}`}
              style={{ flex: 1 }}
              onClick={() => onChange(value === b ? undefined : b)}
            >
              {b ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
        {field.help && <div className="help-text">{field.help}</div>}
      </div>
    )
  }

  if (options?.length) {
    return (
      <div className="field">
        <label htmlFor={`f-${field.id}`}>{field.label}</label>
        <select
          id={`f-${field.id}`}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value || undefined)}
        >
          <option value="">— select —</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        {field.help && <div className="help-text">{field.help}</div>}
      </div>
    )
  }

  return (
    <div className="field">
      <label htmlFor={`f-${field.id}`}>{field.label}</label>
      {field.kind === 'longtext' ? (
        <textarea
          id={`f-${field.id}`}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      ) : (
        <input
          id={`f-${field.id}`}
          type={field.kind === 'number' ? 'number' : 'text'}
          value={(value as string) ?? ''}
          onChange={(e) =>
            onChange(
              field.kind === 'number'
                ? e.target.value === ''
                  ? undefined
                  : Number(e.target.value)
                : e.target.value || undefined,
            )
          }
        />
      )}
      {field.help && <div className="help-text">{field.help}</div>}
    </div>
  )
}

/**
 * Close out a flagged remediation or behaviour conference.
 *
 * Completion readiness gates on nothing being open, and until this existed
 * nothing could set `resolvedDate` — so the first evaluation flagging remedial
 * education blocked that student permanently, and the only ways past were an
 * override that recorded a policy breach the program had not committed, or
 * deleting a record with a three-year retention obligation.
 */
function ResolveModal({
  response,
  studentName,
  actor,
  onClose,
}: {
  response: AemtFormResponse
  studentName: string
  actor: string
  onClose: () => void
}) {
  const [by, setBy] = useState(actor === 'local' ? '' : actor)
  const [note, setNote] = useState('')
  const valid = by.trim() !== '' && note.trim().length >= 4

  return (
    <Modal title={`Close out — ${studentName}`} onClose={onClose}>
      <div className="banner info" style={{ marginTop: 0 }}>
        {aemtFormAtVersion(response.formId, response.templateVersion).form?.title} ·{' '}
        {formatDate(response.date)} ·{' '}
        {response.values?.remedial === true
          ? 'remedial education indicated'
          : 'behaviour conference indicated'}
      </div>
      <div className="field">
        <label htmlFor="rs-by">Closed out by</label>
        <input
          id="rs-by"
          value={by}
          onChange={(e) => setBy(e.target.value)}
          placeholder="Program manager"
        />
      </div>
      <div className="field">
        <label htmlFor="rs-note">What was done</label>
        <textarea
          id="rs-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Remedial IV lab completed 14 Mar with the lead instructor; re-assessed and passed."
        />
        <div className="help-text">
          The record stays on file either way. This says what closed it, which is what the completion
          readiness check is asking for.
        </div>
      </div>
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          className="btn primary"
          disabled={!valid}
          onClick={() => {
            resolveFormResponse(response.id, by.trim(), note.trim())
            onClose()
          }}
        >
          Close it out
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}

function FillForm({
  course,
  def,
  onDone,
}: {
  course: AemtCourse
  def: AemtFormDef
  onDone: () => void
}) {
  const students = useStudents(course.id)
  const responses = useFormResponses(course.id)
  const instructors = instructorsOfRecord(useCourse(course.id))
  const [studentId, setStudentId] = useState(students[0]?.id ?? '')
  const [date, setDate] = useState(todayISO())
  const [values, setValues] = useState<Values>({})

  // Which instructors this student has already evaluated, so the person filling
  // it in is not guessing. The gap between this and the roster is exactly what
  // the completion gate is counting.
  const alreadyEvaluated =
    def.id === 'instructor-eval'
      ? new Set(
          responses
            .filter((r) => r.formId === def.id && r.studentId === studentId)
            .map((r) => String(r.values?.instructor ?? '').trim().toLowerCase())
            .filter(Boolean),
        )
      : new Set<string>()
  const stillOwed = instructors.filter((n) => !alreadyEvaluated.has(n.toLowerCase()))

  const set = (id: string, v: string | number | boolean | undefined) =>
    setValues((prev) => {
      const next = { ...prev }
      if (v === undefined) delete next[id]
      else next[id] = v
      return next
    })

  return (
    <div>
      <button className="link-btn" onClick={onDone}>
        ← All forms
      </button>

      <div className="page-head" style={{ marginTop: 4 }}>
        <div>
          <h2 style={{ fontSize: 18 }}>{def.title}</h2>
          <div className="subtle" style={{ fontSize: 12 }}>
            {def.subtitle} · completed by {def.completedBy}
          </div>
        </div>
      </div>

      {def.draft ? (
        <div className="banner warn" style={{ marginTop: 10 }}>
          <strong>Draft form.</strong> Drafted from the program's own description of it. Have the
          Program Manager and Medical Director review the wording, then record the review under
          <strong> Instruments</strong> — what comes back on this form is retained for three years.
        </div>
      ) : (
        def.reviewedBy && (
          <div className="banner ok" style={{ marginTop: 10 }}>
            Reviewed and approved by {def.reviewedBy}
            {def.reviewedOn ? ` on ${formatDate(def.reviewedOn)}` : ''}.
          </div>
        )
      )}

      {def.id === 'instructor-eval' && instructors.length > 0 && (
        <div className={`banner ${stillOwed.length ? 'warn' : 'ok'}`} style={{ marginTop: 10 }}>
          {stillOwed.length ? (
            <>
              This student still owes an evaluation of{' '}
              <strong>{stillOwed.join(' and ')}</strong>. K.A.R. 109-17-3 asks for one per
              instructor who taught them, not one for the course.
            </>
          ) : (
            <>✓ This student has evaluated every instructor of record.</>
          )}
        </div>
      )}
      {def.id === 'instructor-eval' && instructors.length === 0 && (
        <div className="banner warn" style={{ marginTop: 10 }}>
          No instructors are filed on this course, so there is nothing to count these against. Add
          them in <strong>Course setup</strong>.
        </div>
      )}

      <div className="field-row" style={{ marginTop: 12 }}>
        <div className="field">
          <label htmlFor="fm-student">Student</label>
          <select id="fm-student" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="fm-date">Date</label>
          <input id="fm-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {def.sections.map((section, i) => (
        <div key={i} style={{ marginTop: 14 }}>
          <div className="section-title" style={{ marginTop: 0 }}>
            {section.title}
          </div>
          {section.help && (
            <div className="help-text" style={{ marginTop: 0, marginBottom: 8 }}>
              {section.help}
            </div>
          )}
          {section.fields.map((f) => (
            <Field
              key={f.id}
              field={f}
              value={values[f.id]}
              onChange={(v) => set(f.id, v)}
              options={
                def.id === 'instructor-eval' && f.id === 'instructor' && instructors.length
                  ? instructors
                  : undefined
              }
            />
          ))}
        </div>
      ))}

      <div className="btn-row" style={{ marginTop: 16 }}>
        <button
          className="btn primary"
          disabled={!studentId || Object.keys(values).length === 0}
          onClick={() => {
            addFormResponse(course.id, def.id, { studentId, date, values })
            onDone()
          }}
        >
          Submit evaluation
        </button>
        <button className="btn" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function FormsTab({ course }: { course: AemtCourse }) {
  const students = useStudents(course.id)
  const responses = useFormResponses(course.id)
  const shifts = useShifts(course.id)
  const instructors = instructorsOfRecord(useCourse(course.id))
  // manageAemt, not editRideWork: the latter is true for FTOs, who must not
  // write to certification records.
  const { manageAemt: canEdit } = useCan()
  const [filling, setFilling] = useState<string | null>(null)
  const [resolving, setResolving] = useState<AemtFormResponse | null>(null)
  const safety = useRecordSafety()
  const FORMS = useAemtForms()

  if (students.length === 0) {
    return (
      <Empty icon="🧑‍🚒" title="No students yet">
        Add students on the Roster tab before recording evaluations.
      </Empty>
    )
  }

  const def = filling ? liveAemtForm(filling) : undefined
  if (def) {
    return <FillForm course={course} def={def} onDone={() => setFilling(null)} />
  }

  // Open concerns are what the readiness check reads; resolved ones are shown
  // separately rather than staying in a queue labelled "needs review".
  const open = openConcerns(responses)
  const closed = flaggedResponses(responses).filter((r) => r.resolvedDate)
  const nameOf = (id?: string) => students.find((s) => s.id === id)?.name ?? 'Unknown'

  return (
    <div>
      <div className="banner info">
        The program's evaluation instruments. Records are retained with the course for three years
        under K.A.R. 109-11-4a.
      </div>

      {open.length > 0 && (
        <>
          <div className="section-title">
            Needs Program Manager review
            <span className="pill crit" style={{ marginLeft: 8 }}>
              {open.length}
            </span>
          </div>
          <div className="help-text" style={{ marginTop: 0, marginBottom: 8 }}>
            Each of these holds back that student's completion readiness until it is closed out.
          </div>
          <div className="list">
            {open.map((r) => (
              <div key={r.id} className="row left-accent acc-crit">
                <div className="grow">
                  <div className="title">{nameOf(r.studentId)}</div>
                  <div className="meta">
                    {aemtFormAtVersion(r.formId, r.templateVersion).form?.title} · {formatDate(r.date)} ·{' '}
                    {r.values?.remedial === true
                      ? 'remedial education indicated'
                      : 'behaviour conference indicated'}
                  </div>
                </div>
                {canEdit && (
                  <button className="btn sm primary" onClick={() => setResolving(r)}>
                    Close out
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {closed.length > 0 && (
        <>
          <div className="section-title">
            Closed out
            <span className="pill ok" style={{ marginLeft: 8 }}>
              {closed.length}
            </span>
          </div>
          <div className="list">
            {closed.map((r) => (
              <div key={r.id} className="row left-accent acc-ok">
                <div className="grow">
                  <div className="title">{nameOf(r.studentId)}</div>
                  <div className="meta">
                    {aemtFormAtVersion(r.formId, r.templateVersion).form?.title} · {formatDate(r.date)} · closed{' '}
                    {formatDate(r.resolvedDate)} by {r.resolvedBy}
                  </div>
                  {r.resolutionNote && <div className="help-text">{r.resolutionNote}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-title">Forms</div>
      <div className="list">
        {FORMS.map((f) => {
          const count = responses.filter((r) => r.formId === f.id).length
          // Per student, then summed — a course total cannot say which student
          // is short, and "18 of 24" across six students hides the one who has
          // filed nothing. Counted the same way the completion gate counts it.
          const perStudent = students.map((st) =>
            formOwedFor(
              f,
              responses.filter((r) => r.studentId === st.id),
              shifts.filter((sh) => sh.studentId === st.id).length,
              instructors,
            ),
          )
          const owed = perStudent.reduce((n, o) => n + o.owed, 0)
          const behind = perStudent.filter((o) => o.owed > 0).length
          const basis = perStudent[0]?.basis
          return (
            <div key={f.id} className={`row left-accent ${owed > 0 ? 'acc-warn' : 'acc-ok'}`}>
              <div className="grow">
                <div className="title">
                  {f.title}
                  {f.draft && (
                    <span className="pill warn" style={{ marginLeft: 8 }}>
                      draft
                    </span>
                  )}
                </div>
                <div className="meta">
                  {f.subtitle} · by {f.completedBy}
                </div>
                <div className="meta">
                  {count} recorded
                  {basis ? ` · ${basis}` : ''}
                </div>
                {owed > 0 && (
                  <div className="meta" style={{ color: 'var(--warn)' }}>
                    {owed} outstanding across {behind} student{behind === 1 ? '' : 's'}
                  </div>
                )}
              </div>
              <span className={`pill ${owed > 0 ? 'warn' : 'ok'}`}>
                {owed > 0 ? `${owed} owed` : '✓ complete'}
              </span>
              {canEdit && (
                <button className="btn sm primary" onClick={() => setFilling(f.id)}>
                  Fill in
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div className="section-title">Recent · {responses.length} total</div>
      {responses.length === 0 ? (
        <div className="banner info">Nothing recorded yet.</div>
      ) : (
        <div className="list">
          {responses.slice(0, 25).map((r) => (
            <div key={r.id} className="row">
              <div className="grow">
                <div className="title">
                  {aemtFormAtVersion(r.formId, r.templateVersion).form?.title ?? r.formId}
                </div>
                <div className="meta">
                  {nameOf(r.studentId)} · {formatDate(r.date)}
                </div>
              </div>
              {canEdit && (
                <button
                  className="btn sm danger"
                  aria-label={`Delete this evaluation for ${nameOf(r.studentId)}`}
                  onClick={async () => {
                    const ok = await confirmAction({
                      title: 'Delete this evaluation?',
                      body:
                        'Evaluations are a program record retained for three years under ' +
                        'K.A.R. 109-17-3. If this one flagged a concern, closing it out keeps the ' +
                        'record and still clears the readiness check. Undo is offered afterwards.',
                      confirmLabel: 'Delete evaluation',
                    })
                    if (ok) deleteFormResponse(r.id)
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {resolving && (
        <ResolveModal
          response={resolving}
          studentName={nameOf(resolving.studentId)}
          actor={safety.actor}
          onClose={() => setResolving(null)}
        />
      )}
    </div>
  )
}
