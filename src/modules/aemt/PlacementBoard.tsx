import { useMemo, useState } from 'react'
import { Empty, Modal } from '../../components/ui'
import { confirmAction } from '../../lib/dialog'
import { formatDate, todayISO } from '../../lib/date'
import {
  addPlacement,
  addPreceptor,
  deletePlacement,
  deletePreceptor,
  phasesFor,
  placeableSites,
  seedSites,
  updatePlacement,
  updateUnit,
  usePlacements,
  usePreceptors,
  useStudents,
  workPlacement,
} from './aemtStore'
import {
  blocking,
  phaseCoverage,
  placementIssues,
  studentLoad,
  unitLoad,
  weekStart,
  weeksBetween,
} from './placement'
import { PLANNED_SHIFTS } from '../../data/aemtPhases'
import { PRECEPTOR_LABELS, SETTING_PRECEPTORS } from '../../data/aemt'
import type { PreceptorCredential } from '../../data/aemt'
import { useCan } from '../../lib/role'
import type {
  AemtCourse,
  AemtPlacement,
  AemtSite,
  AemtSiteUnit,
  PreceptorCredentialId,
} from '../../types'

// ---------------------------------------------------------------------------
// The placement board.
//
// This screen exists because Fisdap's scheduler is not licensed for this
// cohort. Ninety placements across two organisations, with a department taking
// one student a week, is otherwise a whiteboard and a text-message thread.
//
// The layout is weeks down, departments across — because the question being
// asked is almost always "who can go where next week", and because a full
// department has to be visible as full rather than discovered on submit. The
// coverage strip above it answers the slower question: does the capacity that
// physically exists cover what each phase is asking for. That one is worth
// looking at in October, when there is still time to open another campus.
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<AemtPlacement['status'], string> = {
  open: 'Open',
  assigned: 'Assigned',
  confirmed: 'Confirmed',
  worked: 'Worked',
  cancelled: 'Cancelled',
}

const STATUS_CLASS: Record<AemtPlacement['status'], string> = {
  open: '',
  assigned: 'warn',
  confirmed: 'ok',
  worked: 'ok',
  cancelled: 'crit',
}

function PlacementModal({
  course,
  sites,
  existing,
  preset,
  onClose,
}: {
  course: AemtCourse
  sites: AemtSite[]
  existing?: AemtPlacement
  preset?: { date: string; siteId: string; unitId: string }
  onClose: () => void
}) {
  const students = useStudents(course.id)
  const preceptors = usePreceptors(course.id)
  const placements = usePlacements(course.id)
  const [date, setDate] = useState(existing?.date ?? preset?.date ?? todayISO())
  const [siteId, setSiteId] = useState(existing?.siteId ?? preset?.siteId ?? sites[0]?.id ?? '')
  const [unitId, setUnitId] = useState(existing?.unitId ?? preset?.unitId ?? '')
  const [studentId, setStudentId] = useState(existing?.studentId ?? '')
  const [preceptorId, setPreceptorId] = useState(existing?.preceptorId ?? '')
  const [hours, setHours] = useState(String(existing?.hours ?? 12))
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [refused, setRefused] = useState('')

  const site = sites.find((s) => s.id === siteId)
  const units = site?.units ?? []
  const hoursNum = Number(hours)
  const input = {
    studentId: studentId || undefined,
    date,
    siteId,
    unitId,
    hours: hoursNum,
    status: existing?.status ?? (studentId ? ('assigned' as const) : ('open' as const)),
  }
  const issues = placementIssues(input, {
    placements,
    sites,
    phases: phasesFor(course),
    ignoreId: existing?.id,
    courseStart: course.startDate,
    courseEnd: course.endDate,
  })
  const blocks = blocking(issues)
  const notes_ = issues.filter((i) => i.severity === 'note')
  const issueOn = (field: string) => blocks.find((i) => i.field === field)?.message

  return (
    <Modal title={existing ? 'Edit placement' : 'Place a shift'} onClose={onClose}>
      <div className="field-row">
        <div className="field">
          <label htmlFor="pl-date">Date</label>
          <input id="pl-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          {issueOn('date') && <div className="help-text crit-text">{issueOn('date')}</div>}
        </div>
        <div className="field">
          <label htmlFor="pl-hours">Hours</label>
          <input
            id="pl-hours"
            type="number"
            min={1}
            max={24}
            step={0.5}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
          {issueOn('hours') && <div className="help-text crit-text">{issueOn('hours')}</div>}
        </div>
      </div>

      <div className="field">
        <label htmlFor="pl-site">Site</label>
        <select
          id="pl-site"
          value={siteId}
          onChange={(e) => {
            setSiteId(e.target.value)
            setUnitId('')
          }}
        >
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.active === false ? ' (not in use)' : ''}
            </option>
          ))}
        </select>
        {issueOn('siteId') && <div className="help-text crit-text">{issueOn('siteId')}</div>}
      </div>

      <div className="field">
        <label htmlFor="pl-unit">Department</label>
        <select id="pl-unit" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
          <option value="">Pick a department…</option>
          {units.map((u) => {
            const load = unitLoad(placements, u.id, date, existing?.id)
            return (
              <option key={u.id} value={u.id}>
                {u.name} — {load}/{u.weeklySlotCap} that week
              </option>
            )
          })}
        </select>
        {issueOn('unitId') && <div className="help-text crit-text">{issueOn('unitId')}</div>}
        {/* What the department is worth, so the choice is about the skills the
            student is short on rather than about which cell is empty. */}
        {unitId && (
          <div className="help-text">
            Produces: {units.find((u) => u.id === unitId)?.produces.join(', ') || 'nothing counted'}
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor="pl-student">Student</label>
        <select
          id="pl-student"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
        >
          <option value="">Leave the slot open</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {issueOn('studentId') && <div className="help-text crit-text">{issueOn('studentId')}</div>}
      </div>

      <div className="field">
        <label htmlFor="pl-prec">Preceptor</label>
        <select
          id="pl-prec"
          value={preceptorId}
          onChange={(e) => setPreceptorId(e.target.value)}
        >
          <option value="">Not known yet</option>
          {preceptors
            .filter((p) => p.siteId === siteId && p.active)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({PRECEPTOR_LABELS[p.credential as PreceptorCredential]})
              </option>
            ))}
        </select>
        <div className="help-text">
          Field placements often do not have one until the week of. The shift takes the name that
          actually signs it, not this one.
        </div>
      </div>

      <div className="field">
        <label htmlFor="pl-notes">Note (optional)</label>
        <input id="pl-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {notes_.map((n, i) => (
        <div key={i} className="banner warn">
          {n.message}
        </div>
      ))}
      {refused && <div className="banner crit">{refused}</div>}

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          className="btn primary"
          disabled={blocks.length > 0 || !unitId}
          onClick={() => {
            const payload = {
              ...input,
              preceptorId: preceptorId || undefined,
              notes: notes.trim() || undefined,
            }
            const result = existing
              ? updatePlacement(existing.id, payload)
              : addPlacement(course.id, payload)
            if (result.ok) onClose()
            else setRefused(result.refused ?? 'Refused.')
          }}
        >
          {existing ? 'Save' : 'Place it'}
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        {existing && (
          <button
            className="btn danger"
            style={{ marginLeft: 'auto' }}
            onClick={async () => {
              const ok = await confirmAction({
                title: 'Remove this placement?',
                body: existing.shiftId
                  ? 'The shift stays on the record — only the plan is removed. Undo is offered afterwards.'
                  : 'The slot frees up. Undo is offered afterwards.',
                confirmLabel: 'Remove',
              })
              if (ok) {
                deletePlacement(existing.id)
                onClose()
              }
            }}
          >
            Remove
          </button>
        )}
      </div>
    </Modal>
  )
}

/** Recording that a placement was actually worked, which creates the shift. */
function WorkModal({
  course,
  placement,
  site,
  onClose,
}: {
  course: AemtCourse
  placement: AemtPlacement
  site: AemtSite | undefined
  onClose: () => void
}) {
  const preceptors = usePreceptors(course.id)
  const known = preceptors.find((p) => p.id === placement.preceptorId)
  const setting = site?.kind === 'field' ? 'field' : 'hospital'
  const allowed = SETTING_PRECEPTORS[setting]
  const [name, setName] = useState(known?.name ?? '')
  const [cred, setCred] = useState<PreceptorCredentialId>(
    known?.credential ?? (setting === 'field' ? 'paramedic' : 'rn'),
  )
  const [cert, setCert] = useState(known?.certNumber ?? '')
  const [hours, setHours] = useState(String(placement.hours))
  const [refused, setRefused] = useState('')

  const credOk = allowed.includes(cred as PreceptorCredential)
  const valid = name.trim() !== '' && credOk && Number(hours) >= 1 && Number(hours) <= 24

  return (
    <Modal title="Record this as worked" onClose={onClose}>
      <div className="banner info" style={{ marginTop: 0 }}>
        {formatDate(placement.date)} · {site?.name}
      </div>
      <div className="help-text" style={{ marginTop: 0 }}>
        This creates the shift record. Encounters are logged against it on the Clinical tab, and the
        preceptor still has to attest it before anything counts.
      </div>
      <div className="field">
        <label htmlFor="wk-name">Preceptor who actually supervised it</label>
        <input id="wk-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="wk-cred">Credential</label>
          <select
            id="wk-cred"
            value={cred}
            onChange={(e) => setCred(e.target.value as PreceptorCredentialId)}
          >
            {(Object.keys(PRECEPTOR_LABELS) as PreceptorCredential[]).map((c) => (
              <option key={c} value={c}>
                {PRECEPTOR_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="wk-hours">Hours worked</label>
          <input
            id="wk-hours"
            type="number"
            min={1}
            max={24}
            step={0.5}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="wk-cert">Licence / cert #</label>
        <input id="wk-cert" value={cert} onChange={(e) => setCert(e.target.value)} />
      </div>
      {!credOk && (
        <div className="banner crit">
          A {PRECEPTOR_LABELS[cred as PreceptorCredential]} cannot precept a {setting} shift under
          K.A.R. 109-1-1. Allowed: {allowed.map((c) => PRECEPTOR_LABELS[c]).join(', ')}.
        </div>
      )}
      {refused && <div className="banner crit">{refused}</div>}
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          className="btn primary"
          disabled={!valid}
          onClick={() => {
            const r = workPlacement(placement.id, {
              preceptorName: name,
              preceptorCredential: cred,
              preceptorCertNumber: cert,
              hours: Number(hours),
            })
            if (r.ok) onClose()
            else setRefused(r.refused ?? 'Refused.')
          }}
        >
          Create the shift
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}

function PreceptorModal({ course, onClose }: { course: AemtCourse; onClose: () => void }) {
  const sites = placeableSites(course)
  const preceptors = usePreceptors(course.id)
  const [name, setName] = useState('')
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '')
  const [cred, setCred] = useState<PreceptorCredentialId>('paramedic')
  const [cert, setCert] = useState('')

  const site = sites.find((s) => s.id === siteId)
  const allowed = SETTING_PRECEPTORS[site?.kind === 'field' ? 'field' : 'hospital']
  const credOk = allowed.includes(cred as PreceptorCredential)

  return (
    <Modal title="Preceptors" onClose={onClose}>
      <div className="help-text" style={{ marginTop: 0 }}>
        A contact list, so a name and credential are entered once rather than on every shift. A
        worked shift keeps whatever it was signed under — editing someone here never changes
        evidence already on the record.
      </div>

      <div className="list">
        {preceptors.length === 0 && (
          <div className="banner info">
            None yet. AdventHealth has not named theirs, and the AMR field preceptors depend on FTO
            availability — placements can be made without one and named later.
          </div>
        )}
        {preceptors.map((p) => (
          <div key={p.id} className="row">
            <div className="grow">
              <div className="title">{p.name}</div>
              <div className="meta">
                {PRECEPTOR_LABELS[p.credential as PreceptorCredential]}
                {p.certNumber ? ` #${p.certNumber}` : ''} ·{' '}
                {sites.find((s) => s.id === p.siteId)?.name ?? 'site removed'}
              </div>
            </div>
            <button
              className="btn sm danger"
              onClick={async () => {
                const ok = await confirmAction({
                  title: `Remove ${p.name}?`,
                  body: 'Placements pointing at them keep their date and department and lose the name. Shifts already worked are untouched.',
                  confirmLabel: 'Remove',
                })
                if (ok) deletePreceptor(p.id)
              }}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="section-title" style={{ marginTop: 14 }}>
        Add
      </div>
      <div className="field">
        <label htmlFor="pr-name">Name</label>
        <input id="pr-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="pr-site">Site</label>
        <select id="pr-site" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="pr-cred">Credential</label>
          <select
            id="pr-cred"
            value={cred}
            onChange={(e) => setCred(e.target.value as PreceptorCredentialId)}
          >
            {(Object.keys(PRECEPTOR_LABELS) as PreceptorCredential[]).map((c) => (
              <option key={c} value={c}>
                {PRECEPTOR_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="pr-cert">Licence / cert #</label>
          <input id="pr-cert" value={cert} onChange={(e) => setCert(e.target.value)} />
        </div>
      </div>
      {!credOk && (
        <div className="banner crit">
          A {PRECEPTOR_LABELS[cred as PreceptorCredential]} cannot precept at a{' '}
          {site?.kind === 'field' ? 'field' : 'hospital'} site under K.A.R. 109-1-1.
        </div>
      )}
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          className="btn primary"
          disabled={!name.trim() || !siteId || !credOk}
          onClick={() => {
            addPreceptor(course.id, {
              siteId,
              name: name.trim(),
              credential: cred,
              certNumber: cert.trim() || undefined,
              active: true,
            })
            setName('')
            setCert('')
          }}
        >
          Add preceptor
        </button>
        <button className="btn" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  )
}

/** Editing one department's weekly cap — the number most likely to be wrong. */
function CapModal({
  course,
  site,
  onClose,
}: {
  course: AemtCourse
  site: AemtSite
  onClose: () => void
}) {
  return (
    <Modal title={`${site.name} — capacity`} onClose={onClose}>
      <div className="banner warn" style={{ marginTop: 0 }}>
        Every department is seeded at <strong>one student a week</strong>, which is the working
        assumption while AdventHealth has not answered on capacity. Correct these as the real
        numbers arrive — everything the board refuses is refused against them.
      </div>
      <div className="list">
        {(site.units ?? []).map((u: AemtSiteUnit) => (
          <div key={u.id} className="row">
            <div className="grow">
              <div className="title">{u.name}</div>
              <div className="meta">{u.produces.join(', ') || 'nothing counted'}</div>
            </div>
            <input
              type="number"
              min={0}
              max={10}
              value={u.weeklySlotCap}
              aria-label={`${u.name} students per week`}
              style={{ width: 72 }}
              onChange={(e) =>
                updateUnit(course.id, site.id, u.id, {
                  weeklySlotCap: Math.max(0, Number(e.target.value) || 0),
                })
              }
            />
            <span className="subtle">/wk</span>
          </div>
        ))}
      </div>
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  )
}

export default function PlacementBoard({ course }: { course: AemtCourse }) {
  const { manageAemt: canEdit } = useCan()
  const students = useStudents(course.id)
  const placements = usePlacements(course.id)
  const sites = placeableSites(course)
  const [kind, setKind] = useState<'clinical' | 'field'>('clinical')
  const [editing, setEditing] = useState<AemtPlacement | null>(null)
  const [placing, setPlacing] = useState<{ date: string; siteId: string; unitId: string } | null>(
    null,
  )
  const [working, setWorking] = useState<AemtPlacement | null>(null)
  const [preceptorsOpen, setPreceptors] = useState(false)
  const [caps, setCaps] = useState<AemtSite | null>(null)

  const phases = phasesFor(course)
  // The first phase that actually has clinical in it — no point showing eight
  // weeks of empty board before anyone is allowed on a unit.
  const first = phases.find((p) => p.shiftsRequired > 0)
  const weeks = useMemo(
    () => weeksBetween(first?.windowStart ?? course.startDate, course.endDate),
    [first, course.startDate, course.endDate],
  )
  const shown = sites.filter((s) => s.kind === kind && s.active !== false)
  const columns = shown.flatMap((s) => (s.units ?? []).map((u) => ({ site: s, unit: u })))
  const coverage = phaseCoverage(phases, sites, placements, students.length, kind)
  const load = studentLoad(students, placements)
  const thisWeek = weekStart(todayISO())

  if (sites.length === 0) {
    return (
      <Empty icon="🗓" title="No sites set up yet">
        <p>
          The board schedules against departments, not just hospitals — a shift in pre-op and a
          shift in L&amp;D are not the same shift. Seed the site list to get started.
        </p>
        {canEdit && (
          <button className="btn primary" onClick={() => seedSites(course.id)}>
            Seed sites and departments
          </button>
        )}
      </Empty>
    )
  }

  return (
    <div>
      <div className="banner info">
        Ninety placements across two organisations, with each department taking one student a week
        until AdventHealth confirms otherwise. A full department is shown as full — the board
        refuses an over-capacity placement rather than accepting it and letting the site discover it.
      </div>

      <div className="toolbar">
        <div className="seg">
          <button
            className={`btn sm ${kind === 'clinical' ? 'primary' : ''}`}
            onClick={() => setKind('clinical')}
          >
            Hospital
          </button>
          <button
            className={`btn sm ${kind === 'field' ? 'primary' : ''}`}
            onClick={() => setKind('field')}
          >
            Field
          </button>
        </div>
        <div className="spacer" />
        {canEdit && (
          <>
            <button className="btn sm" onClick={() => setPreceptors(true)}>
              Preceptors
            </button>
            {shown.map((s) => (
              <button key={s.id} className="btn sm" onClick={() => setCaps(s)}>
                {s.name.replace('AdventHealth ', '').replace('AMR ', '')} caps
              </button>
            ))}
          </>
        )}
      </div>

      {/* The slow question: does the capacity that exists cover the plan? */}
      <div className="section-title">Coverage by phase</div>
      <div className="list">
        {coverage.map((c) => (
          <div
            key={c.phase.ordinal}
            className={`row left-accent ${
              c.shortfall > 0 ? 'acc-crit' : c.placed >= c.demand ? 'acc-ok' : 'acc-warn'
            }`}
          >
            <div className="grow">
              <div className="title">
                {c.phase.ordinal}. {c.phase.name}
              </div>
              <div className="meta">
                {formatDate(c.phase.windowStart)} – {formatDate(c.phase.windowEnd)} · needs{' '}
                {c.demand} {kind === 'clinical' ? 'hospital' : 'field'} shift
                {c.demand === 1 ? '' : 's'} · {c.supply} slot{c.supply === 1 ? '' : 's'} exist
              </div>
              {c.shortfall > 0 && (
                <div className="meta" style={{ color: 'var(--crit)' }}>
                  {c.shortfall} short of what the sites can physically take. This is a capacity
                  problem, not a student problem — another campus, a higher cap, or a longer window.
                </div>
              )}
            </div>
            <span
              className={`pill ${
                c.shortfall > 0 ? 'crit' : c.placed >= c.demand ? 'ok' : 'warn'
              }`}
            >
              {c.placed}/{c.demand} placed
            </span>
          </div>
        ))}
      </div>

      <div className="section-title" style={{ marginTop: 16 }}>
        Per student
      </div>
      <div className="list">
        {load.map((l) => (
          <div key={l.student.id} className="row">
            <div className="grow">
              <div className="title">{l.student.name}</div>
              <div className="meta">
                {l.worked} worked · {l.assigned - l.worked} scheduled · {PLANNED_SHIFTS} planned
              </div>
            </div>
            <span className={`pill ${l.assigned >= PLANNED_SHIFTS ? 'ok' : 'warn'}`}>
              {l.assigned}/{PLANNED_SHIFTS}
            </span>
          </div>
        ))}
      </div>

      <div className="section-title" style={{ marginTop: 16 }}>
        The board
      </div>
      {columns.length === 0 ? (
        <div className="banner warn">
          No active {kind === 'clinical' ? 'hospital' : 'field'} departments. Activate a site on the
          Records tab, or seed the list again.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="grid-table">
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0 }}>Week</th>
                {columns.map(({ site, unit }) => (
                  <th key={unit.id}>
                    <div>{unit.name}</div>
                    <div className="subtle" style={{ fontWeight: 400, fontSize: 11 }}>
                      {site.name.replace('AdventHealth ', '').replace('AMR ', '')} · {unit.weeklySlotCap}/wk
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <tr key={week} className={week === thisWeek ? 'is-now' : undefined}>
                  <th style={{ position: 'sticky', left: 0, whiteSpace: 'nowrap' }}>
                    {formatDate(week)}
                    {week === thisWeek && <div className="subtle">this week</div>}
                  </th>
                  {columns.map(({ site, unit }) => {
                    const cell = placements.filter(
                      (p) =>
                        p.unitId === unit.id &&
                        weekStart(p.date) === week &&
                        p.status !== 'cancelled',
                    )
                    const full = cell.length >= unit.weeklySlotCap
                    return (
                      <td key={unit.id}>
                        {cell.map((p) => (
                          <button
                            key={p.id}
                            className={`pill ${STATUS_CLASS[p.status]}`}
                            style={{
                              display: 'block',
                              width: '100%',
                              textAlign: 'left',
                              marginBottom: 4,
                              border: 'none',
                              font: 'inherit',
                              cursor: canEdit ? 'pointer' : 'default',
                            }}
                            disabled={!canEdit}
                            onClick={() => setEditing(p)}
                          >
                            {students.find((s) => s.id === p.studentId)?.name ?? 'Open slot'}
                            <span className="subtle" style={{ display: 'block', fontSize: 11 }}>
                              {formatDate(p.date)} · {STATUS_LABEL[p.status]}
                            </span>
                          </button>
                        ))}
                        {canEdit && !full && (
                          <button
                            className="btn sm"
                            style={{ width: '100%' }}
                            aria-label={`Place a shift in ${unit.name}, week of ${week}`}
                            onClick={() =>
                              setPlacing({ date: week, siteId: site.id, unitId: unit.id })
                            }
                          >
                            +
                          </button>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Everything scheduled but not yet recorded as worked, so the board has
          somewhere to close the loop from. */}
      {(() => {
        const due = placements.filter(
          (p) => p.studentId && p.date <= todayISO() && p.status !== 'worked' && p.status !== 'cancelled',
        )
        if (!due.length) return null
        return (
          <>
            <div className="section-title" style={{ marginTop: 16 }}>
              Past and not recorded ({due.length})
            </div>
            <div className="list">
              {due.map((p) => {
                const site = sites.find((s) => s.id === p.siteId)
                return (
                  <div key={p.id} className="row left-accent acc-warn">
                    <div className="grow">
                      <div className="title">
                        {students.find((s) => s.id === p.studentId)?.name} ·{' '}
                        {site?.units?.find((u) => u.id === p.unitId)?.name}
                      </div>
                      <div className="meta">
                        {formatDate(p.date)} · {site?.name} · {STATUS_LABEL[p.status]}
                      </div>
                    </div>
                    {canEdit && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="btn sm primary" onClick={() => setWorking(p)}>
                          Worked
                        </button>
                        <button
                          className="btn sm"
                          onClick={() => updatePlacement(p.id, { status: 'cancelled' })}
                        >
                          Cancelled
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )
      })()}

      {(editing || placing) && (
        <PlacementModal
          course={course}
          sites={sites}
          existing={editing ?? undefined}
          preset={placing ?? undefined}
          onClose={() => {
            setEditing(null)
            setPlacing(null)
          }}
        />
      )}
      {working && (
        <WorkModal
          course={course}
          placement={working}
          site={sites.find((s) => s.id === working.siteId)}
          onClose={() => setWorking(null)}
        />
      )}
      {preceptorsOpen && <PreceptorModal course={course} onClose={() => setPreceptors(false)} />}
      {caps && <CapModal course={course} site={caps} onClose={() => setCaps(null)} />}
    </div>
  )
}
