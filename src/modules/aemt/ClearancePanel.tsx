import { useMemo, useState } from 'react'
import { Modal } from '../../components/ui'
import { formatDate, todayISO } from '../../lib/date'
import { notifyUser } from '../../lib/dialog'
import { printDoc, downloadDoc, safeFilename } from '../academy/docGen'
import { clearanceReview, type ClearanceItem, type ClearanceState } from '../../data/aemtClearance'
import { goodStandingLetterHTML, letterFilename, letterTitle } from './goodStandingLetter'
import { useStudents, updateStudent } from './aemtStore'
import { useDB } from '../../lib/store'
import { useCan } from '../../lib/role'
import type { AemtClearance, AemtCourse, AemtSite, AemtStudent } from '../../types'

// ---------------------------------------------------------------------------
// Clinical clearance, per student.
//
// The affiliation agreement gates a rotation on a list of dated records, and
// the program has to be able to state in writing that it holds them. This is
// where they are held, and the letter that states them is generated from here
// rather than typed — a letter typed from memory is a letter that can say
// something the file does not support.
// ---------------------------------------------------------------------------

const STATE_PILL: Record<ClearanceState, string> = {
  ok: 'ok',
  noted: 'info',
  exempt: 'muted',
  expiring: 'warn',
  missing: 'crit',
}
const STATE_MARK: Record<ClearanceState, string> = {
  ok: '✓',
  noted: '•',
  exempt: '—',
  expiring: '!',
  missing: '✗',
}

/** A date field that writes straight through to the record. */
function DateField({
  id,
  label,
  value,
  onChange,
  help,
}: {
  id: string
  label: string
  value?: string
  onChange: (v: string | undefined) => void
  help?: string
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="date"
        value={value?.slice(0, 10) ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
      />
      {help && <div className="help-text">{help}</div>}
    </div>
  )
}

function ClearanceForm({
  student,
  course,
  onClose,
}: {
  student: AemtStudent
  course: AemtCourse
  onClose: () => void
}) {
  const db = useDB()
  const [c, setC] = useState<AemtClearance>(student.clearance ?? {})
  const set = (patch: Partial<AemtClearance>) => setC((prev) => ({ ...prev, ...patch }))
  const review = useMemo(() => clearanceReview(c, {}), [c])

  const save = () => {
    const next: AemtClearance = {
      ...c,
      verifiedBy: db.settings.reviewer || c.verifiedBy,
      verifiedAt: new Date().toISOString(),
    }
    const res = updateStudent(student.id, { clearance: next })
    if (!res.ok) {
      notifyUser(res.refused ?? 'That change was refused.', 'crit')
      return
    }
    onClose()
  }

  return (
    <Modal title={`Clinical clearance — ${student.name}`} onClose={onClose}>
      <p className="subtle" style={{ marginTop: 0 }}>
        Every field is a date or a recorded result, because the letter this produces asserts these
        facts to a hospital that may ask to see the record behind any of them. Course:{' '}
        {course.label}.
      </p>

      <label className="check-row" style={{ marginBottom: 10 }}>
        <input
          type="checkbox"
          checked={!!c.facilityEmployee}
          onChange={(e) => set({ facilityEmployee: e.target.checked || undefined })}
        />
        <span>
          Employed by the facility, in good standing
          <span className="help-text">
            Exempts the physical, background check and drug screen under §4.21. Immunizations and TB
            screening are not exempt.
          </span>
        </span>
      </label>

      {!c.facilityEmployee && (
        <DateField
          id="cl-phys"
          label="Physical examination"
          value={c.physicalDate}
          onChange={(v) => set({ physicalDate: v })}
        />
      )}

      <div className="section-title">Immunizations</div>
      <div className="field-row">
        <DateField
          id="cl-var"
          label="Varicella"
          value={c.varicellaDate}
          onChange={(v) => set({ varicellaDate: v })}
        />
        <div className="field">
          <label htmlFor="cl-vart">Varicella titer</label>
          <select
            id="cl-vart"
            value={c.varicellaTiter ?? ''}
            onChange={(e) =>
              set({ varicellaTiter: (e.target.value || undefined) as AemtClearance['varicellaTiter'] })
            }
          >
            <option value="">Not done</option>
            <option value="positive">Positive — immune</option>
            <option value="negative">Negative — vaccinate</option>
          </select>
        </div>
      </div>
      <div className="field-row">
        <DateField id="cl-hep" label="Hepatitis B" value={c.hepBDate} onChange={(v) => set({ hepBDate: v })} />
        <div className="field">
          <label className="check-row" style={{ marginTop: 26 }}>
            <input
              type="checkbox"
              checked={!!c.hepBDeclined}
              onChange={(e) => set({ hepBDeclined: e.target.checked || undefined })}
            />
            <span>Signed declination on file</span>
          </label>
        </div>
      </div>
      <div className="field-row">
        <DateField id="cl-mmr" label="MMR" value={c.mmrDate} onChange={(v) => set({ mmrDate: v })} />
        <DateField id="cl-tdap" label="Tdap" value={c.tdapDate} onChange={(v) => set({ tdapDate: v })} />
      </div>
      <DateField
        id="cl-flu"
        label="Influenza"
        value={c.fluDate}
        onChange={(v) => set({ fluDate: v })}
        help="Optional — without it the student masks from November through March."
      />

      <div className="section-title">Tuberculosis screening</div>
      <div className="field-row">
        <DateField id="cl-ppd" label="PPD placed" value={c.ppdDate} onChange={(v) => set({ ppdDate: v })} />
        <div className="field">
          <label htmlFor="cl-ppdr">Result</label>
          <select
            id="cl-ppdr"
            value={c.ppdResult ?? ''}
            onChange={(e) =>
              set({ ppdResult: (e.target.value || undefined) as AemtClearance['ppdResult'] })
            }
          >
            <option value="">Not read</option>
            <option value="negative">Negative</option>
            <option value="positive">Positive</option>
          </select>
        </div>
      </div>
      {c.ppdResult === 'positive' && (
        <div className="field-row">
          <DateField id="cl-cxr" label="Chest radiograph" value={c.cxrDate} onChange={(v) => set({ cxrDate: v })} />
          <div className="field">
            <label className="check-row" style={{ marginTop: 26 }}>
              <input
                type="checkbox"
                checked={!!c.cxrClear}
                onChange={(e) => set({ cxrClear: e.target.checked || undefined })}
              />
              <span>Clear, no active symptoms</span>
            </label>
          </div>
        </div>
      )}

      {!c.facilityEmployee && (
        <>
          <div className="section-title">Background check</div>
          <DateField
            id="cl-bg"
            label="Completed"
            value={c.backgroundDate}
            onChange={(v) => set({ backgroundDate: v })}
          />
          <label className="check-row">
            <input
              type="checkbox"
              checked={!!c.backgroundSevenYear}
              onChange={(e) => set({ backgroundSevenYear: e.target.checked || undefined })}
            />
            <span>Covers seven years, every city, county and state lived or worked in</span>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={!!c.backgroundCleared}
              onChange={(e) => set({ backgroundCleared: e.target.checked || undefined })}
            />
            <span>Screened against the facility's disqualification list — not disqualified</span>
          </label>

          <div className="section-title">Drug screen</div>
          <DateField
            id="cl-drug"
            label="Collected"
            value={c.drugScreenDate}
            onChange={(v) => set({ drugScreenDate: v })}
          />
          <label className="check-row">
            <input
              type="checkbox"
              checked={!!c.drugScreenNinePanel}
              onChange={(e) => set({ drugScreenNinePanel: e.target.checked || undefined })}
            />
            <span>
              Nine-panel
              <span className="help-text">
                Amphetamines, barbiturates, methadone, benzodiazepines, cocaine metabolite,
                methamphetamines, opiates, PCP, THC. A five-panel is not this.
              </span>
            </span>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={!!c.drugScreenNegative}
              onChange={(e) => set({ drugScreenNegative: e.target.checked || undefined })}
            />
            <span>Negative on all nine</span>
          </label>
        </>
      )}

      <div className="section-title">Health insurance</div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="cl-ins">Carrier</label>
          <input
            id="cl-ins"
            value={c.insuranceCarrier ?? ''}
            onChange={(e) => set({ insuranceCarrier: e.target.value || undefined })}
          />
        </div>
        <DateField
          id="cl-inst"
          label="In force through"
          value={c.insuranceThrough}
          onChange={(v) => set({ insuranceThrough: v })}
        />
      </div>

      <div className="field">
        <label htmlFor="cl-notes">Notes</label>
        <input
          id="cl-notes"
          value={c.notes ?? ''}
          onChange={(e) => set({ notes: e.target.value || undefined })}
          placeholder="Where the source documents live, exceptions agreed with the facility…"
        />
      </div>

      <div className={`banner ${review.ready ? 'ok' : 'warn'}`} style={{ marginTop: 12 }}>
        {review.ready
          ? 'Cleared — the letter of good standing can be produced.'
          : `Outstanding: ${review.blocking.map((b) => b.label.toLowerCase()).join(', ')}.`}
      </div>

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn primary" onClick={save}>
          Save clearance
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}

function LetterModal({
  student,
  course,
  onClose,
}: {
  student: AemtStudent
  course: AemtCourse
  onClose: () => void
}) {
  const db = useDB()
  const sites = (course.sites ?? []).filter((s) => s.kind === 'clinical')
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '')
  const [start, setStart] = useState(todayISO())
  const [end, setEnd] = useState('')
  const site: AemtSite | undefined = sites.find((s) => s.id === siteId)

  const review = clearanceReview(student.clearance, { rotationStart: start, rotationEnd: end || undefined })
  const html = review.ready
    ? goodStandingLetterHTML(student, course, {
        site,
        rotationStart: start,
        rotationEnd: end || undefined,
        contactName: db.settings.reviewer || course.coordinator,
        contactTitle: 'Clinical Education',
      })
    : null

  return (
    <Modal title={`Letter of good standing — ${student.name}`} onClose={onClose}>
      <div className="field">
        <label htmlFor="lt-site">Facility</label>
        <select id="lt-site" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          {sites.length === 0 && <option value="">No clinical sites on this course</option>}
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.contact ? ` — ${s.contact}` : ''}
            </option>
          ))}
        </select>
        {sites.length === 0 && (
          <div className="help-text">
            Add the facility under Course setup, with its liaison and the agreement's effective date,
            and the letter will address itself.
          </div>
        )}
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="lt-start">Rotation starts</label>
          <input id="lt-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="lt-end">Rotation ends</label>
          <input id="lt-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>

      {!review.ready && (
        <div className="banner crit" style={{ marginTop: 10 }}>
          <strong>No letter for these dates.</strong> The record does not support it:{' '}
          {review.blocking.map((b) => `${b.label.toLowerCase()} — ${b.detail.toLowerCase()}`).join('; ')}.
        </div>
      )}

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          className="btn primary"
          disabled={!html}
          onClick={() => html && printDoc(letterTitle(student), html)}
        >
          🖨 Print letter
        </button>
        <button
          className="btn"
          disabled={!html}
          onClick={() => html && downloadDoc(safeFilename(letterFilename(student, site)), letterTitle(student), html)}
        >
          ⬇ Download .doc
        </button>
        <button className="btn" onClick={onClose} style={{ marginLeft: 'auto' }}>
          Close
        </button>
      </div>
    </Modal>
  )
}

function ItemChips({ items }: { items: ClearanceItem[] }) {
  return (
    <div className="clr-chips">
      {items.map((i) => (
        <span key={i.id} className={`pill ${STATE_PILL[i.state]}`} title={`${i.clause} · ${i.detail}`}>
          {STATE_MARK[i.state]} {i.label}
        </span>
      ))}
    </div>
  )
}

export default function ClearancePanel({ course }: { course: AemtCourse }) {
  const students = useStudents(course.id).filter((s) => s.status === 'active')
  const { manageAemt } = useCan()
  const [editing, setEditing] = useState<AemtStudent | null>(null)
  const [lettering, setLettering] = useState<AemtStudent | null>(null)
  const [open, setOpen] = useState(false)

  const reviews = useMemo(
    () => students.map((s) => ({ student: s, review: clearanceReview(s.clearance, {}) })),
    [students],
  )
  const cleared = reviews.filter((r) => r.review.ready).length
  const blocked = reviews.length - cleared

  if (students.length === 0) return null

  return (
    <section className="card clr-card">
      <button className="clr-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div className="grow">
          <div className="title">Clinical clearance</div>
          <div className="meta">
            What the affiliation agreement requires of each student before a rotation
          </div>
        </div>
        <span className={`pill ${blocked ? 'warn' : 'ok'}`}>
          {cleared}/{students.length} cleared
        </span>
        <span className="subtle">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="clr-body">
          {reviews.map(({ student, review }) => (
            <div key={student.id} className="clr-row">
              <div className="clr-name">
                <div className="title">{student.name}</div>
                <div className="meta">
                  {review.ready ? (
                    <span className="ok-text">Cleared</span>
                  ) : (
                    `${review.blocking.length} outstanding`
                  )}
                  {student.clearance?.verifiedAt && (
                    <> · checked {formatDate(student.clearance.verifiedAt.slice(0, 10))}</>
                  )}
                </div>
              </div>
              <ItemChips items={review.items} />
              <div className="clr-acts">
                {manageAemt && (
                  <button className="btn sm" onClick={() => setEditing(student)}>
                    Edit
                  </button>
                )}
                <button
                  className="btn sm primary"
                  disabled={!review.ready}
                  title={review.ready ? 'Produce the letter for a facility' : 'The record does not support a letter yet'}
                  onClick={() => setLettering(student)}
                >
                  Letter
                </button>
              </div>
            </div>
          ))}
          <p className="subtle clr-foot">
            Preceptor applications are due to the facility at least <strong>20 days</strong> before a
            student's first shift, and the facility has 10 days to answer — clearance being finished
            the week before is already late.
          </p>
        </div>
      )}

      {editing && (
        <ClearanceForm student={editing} course={course} onClose={() => setEditing(null)} />
      )}
      {lettering && (
        <LetterModal student={lettering} course={course} onClose={() => setLettering(null)} />
      )}
    </section>
  )
}
