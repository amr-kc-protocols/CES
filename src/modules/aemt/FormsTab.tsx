import { useState } from 'react'
import { Empty } from '../../components/ui'
import { formatDate, todayISO } from '../../lib/date'
import {
  useStudents,
  useFormResponses,
  addFormResponse,
  deleteFormResponse,
  flaggedResponses,
} from './aemtStore'
import { AEMT_FORMS, aemtForm } from '../../data/aemtForms'
import type { AemtFormDef, FormField } from '../../data/aemtForms'
import { useCan } from '../../lib/role'
import type { AemtCourse } from '../../types'

type Values = Record<string, string | number | boolean>

function Field({
  field,
  value,
  onChange,
}: {
  field: FormField
  value: string | number | boolean | undefined
  onChange: (v: string | number | boolean | undefined) => void
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
  const [studentId, setStudentId] = useState(students[0]?.id ?? '')
  const [date, setDate] = useState(todayISO())
  const [values, setValues] = useState<Values>({})

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

      {def.draft && (
        <div className="banner warn" style={{ marginTop: 10 }}>
          <strong>Draft form.</strong> Drafted from the program's own description of it. Have the
          Program Manager and Medical Director review the wording before it becomes a record.
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
            <Field key={f.id} field={f} value={values[f.id]} onChange={(v) => set(f.id, v)} />
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
  const { editRideWork: canEdit } = useCan()
  const [filling, setFilling] = useState<string | null>(null)

  if (students.length === 0) {
    return (
      <Empty icon="🧑‍🚒" title="No students yet">
        Add students on the Roster tab before recording evaluations.
      </Empty>
    )
  }

  const def = filling ? aemtForm(filling) : undefined
  if (def) {
    return <FillForm course={course} def={def} onDone={() => setFilling(null)} />
  }

  const flagged = flaggedResponses(responses)
  const nameOf = (id?: string) => students.find((s) => s.id === id)?.name ?? 'Unknown'

  return (
    <div>
      <div className="banner info">
        The program's evaluation instruments. Records are retained with the course for three years
        under K.A.R. 109-11-4a.
      </div>

      {flagged.length > 0 && (
        <>
          <div className="section-title">
            Needs Program Manager review
            <span className="pill crit" style={{ marginLeft: 8 }}>
              {flagged.length}
            </span>
          </div>
          <div className="list">
            {flagged.map((r) => (
              <div key={r.id} className="row left-accent acc-crit">
                <div className="grow">
                  <div className="title">{nameOf(r.studentId)}</div>
                  <div className="meta">
                    {aemtForm(r.formId)?.title} · {formatDate(r.date)} ·{' '}
                    {r.values.remedial === true
                      ? 'remedial education indicated'
                      : 'behaviour conference indicated'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-title">Forms</div>
      <div className="list">
        {AEMT_FORMS.map((f) => {
          const count = responses.filter((r) => r.formId === f.id).length
          return (
            <div key={f.id} className="row">
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
                  {f.cadence === 'course' && count < students.length && (
                    <> · {students.length - count} student(s) outstanding</>
                  )}
                </div>
              </div>
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
                <div className="title">{aemtForm(r.formId)?.title ?? r.formId}</div>
                <div className="meta">
                  {nameOf(r.studentId)} · {formatDate(r.date)}
                </div>
              </div>
              {canEdit && (
                <button className="btn sm danger" onClick={() => deleteFormResponse(r.id)}>
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
