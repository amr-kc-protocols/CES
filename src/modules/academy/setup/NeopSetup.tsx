import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Empty } from '../../../components/ui'
import { useCan } from '../../../lib/role'
import { useSelector } from '../../../lib/store'
import { activeMarket, marketKey, marketName, MARKETS } from '../../../lib/market'
import { formatDate } from '../../../lib/date'
import { CREDENTIAL_LABELS } from '../../../data/academy'
import { neopSheetMeta } from '../../templates/resolve'
import {
  cloneProgramPart,
  copyableOperations,
  describeAudience,
  programProblems,
  scheduleSummary,
  startingProgram,
  type StartingPoint,
} from '../program'
import { saveProgram, useHasOwnProgram, useProgram } from '../programStore'
import StepBasics from './StepBasics'
import StepChecklist from './StepChecklist'
import StepSchedule from './StepSchedule'
import StepFtoPhase from './StepFtoPhase'
import StepFtos from './StepFtos'
import StepDocuments from './StepDocuments'
import type { StepProps } from './shared'
import type { NeopProgram } from '../../../types'

// ---------------------------------------------------------------------------
// Build or change an operation's NEOP, one step at a time.
//
// Designed for a facilitator who has never seen it and has ten minutes:
//
//  - Every step has a sensible default, so Next always works. Nothing is
//    required beyond a name, a station and one credential.
//  - Steps can be visited in any order once started, and Save works from any
//    of them — fixing an FTO's name should not mean walking through six pages.
//  - Work in progress is kept on this device until it is saved or discarded,
//    so closing the tab halfway through a schedule loses nothing.
//  - Saving changes what NEW cohorts get. Existing cohorts keep the checklist
//    and schedule they started with, and the save screen says so plainly.
// ---------------------------------------------------------------------------

const STEPS = [
  { id: 'basics', label: 'Name & stations', component: StepBasics },
  { id: 'checklist', label: 'Checklist', component: StepChecklist },
  { id: 'schedule', label: 'Schedule', component: StepSchedule },
  { id: 'fto', label: 'FTO phase', component: StepFtoPhase },
  { id: 'ftos', label: 'FTOs & shifts', component: StepFtos },
  { id: 'documents', label: 'Documents', component: StepDocuments },
] as const

type StepId = (typeof STEPS)[number]['id'] | 'start' | 'review'

const DRAFT_KEY = () => marketKey('ces.neopSetupDraft')

interface StoredDraft {
  program: NeopProgram
  at: string
}

function readDraft(): StoredDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY())
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredDraft
    return parsed?.program?.schema === 1 ? parsed : null
  } catch {
    return null
  }
}

function writeDraft(program: NeopProgram | null) {
  try {
    if (program) localStorage.setItem(DRAFT_KEY(), JSON.stringify({ program, at: new Date().toISOString() }))
    else localStorage.removeItem(DRAFT_KEY())
  } catch {
    // Private mode or full storage: the draft lives only as long as the page.
  }
}

/**
 * Same program, ignoring when it was last saved. Comparing the stamp too made
 * every just-saved program look changed — the draft lacks the stamp the save
 * adds — so the draft was written straight back and the next visit offered to
 * "pick up unsaved changes" that did not exist.
 */
const same = (a: NeopProgram | null | undefined, b: NeopProgram | null | undefined) =>
  JSON.stringify(a ? { ...a, updatedAt: '' } : a) === JSON.stringify(b ? { ...b, updatedAt: '' } : b)

// ----- start ---------------------------------------------------------------------

function StartStep({ onPick }: { onPick: (p: StartingPoint) => void }) {
  const market = activeMarket()
  const copyable = copyableOperations().filter((m) => m !== market)
  const [from, setFrom] = useState(copyable[0] ?? 'kc')
  return (
    <div>
      <p className="step-intro">
        Pick where to start. Whatever you choose, every step after this can be changed, and you can
        come back to any of them later.
      </p>
      <div className="start-cards">
        <button type="button" className="start-card recommended" onClick={() => onPick('basics')}>
          <span className="pill info">Recommended</span>
          <strong>Start from the AMR basics</strong>
          <span>
            The six requirements every AMR hire completes, the stretcher and EVOC check-offs, a
            five-day academy week, and release at 20 patient contacts. Add your own from there.
          </span>
        </button>
        {copyable.length > 0 && (
          <div className="start-card">
            <strong>Copy another operation's NEOP</strong>
            <span>
              Their checklist, schedule and skill sheets. Not their FTOs, shifts or hospitals — those
              are facts about their operation, and you enter your own.
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <label htmlFor="start-from" className="sr-only">Operation to copy</label>
              <select id="start-from" value={from} onChange={(e) => setFrom(e.target.value as typeof from)}>
                {copyable.map((m) => (
                  <option key={m} value={m}>
                    {MARKETS.find((x) => x.id === m)?.short}
                  </option>
                ))}
              </select>
              <button type="button" className="btn" onClick={() => onPick(`copy:${from}`)}>
                Copy
              </button>
            </div>
          </div>
        )}
        <button type="button" className="start-card" onClick={() => onPick('blank')}>
          <strong>Start from scratch</strong>
          <span>An empty checklist and schedule. For an academy that looks nothing like the others.</span>
        </button>
      </div>
    </div>
  )
}

// ----- review --------------------------------------------------------------------

function ReviewStep({ draft, go }: { draft: NeopProgram; go: (s: StepId) => void }) {
  const sheetNames = draft.sheets.map((s) => `${neopSheetMeta(s.id).short}${s.who ? ` (${describeAudience(s.who, draft.locations).toLowerCase()})` : ''}`)
  const Row = ({ step, label, children }: { step: StepId; label: string; children: ReactNode }) => (
    <div className="review-row">
      <div className="review-label">{label}</div>
      <div className="review-value">{children}</div>
      <button type="button" className="btn sm ghost" onClick={() => go(step)}>
        Change
      </button>
    </div>
  )
  return (
    <div className="review">
      <Row step="basics" label="Name">
        {draft.name || <em>not set</em>}
      </Row>
      <Row step="basics" label="Hires">
        {draft.credentials.map((c) => CREDENTIAL_LABELS[c]).join(', ') || <em>none picked</em>} ·{' '}
        {draft.locations.length === 1 ? draft.locations[0].name : `${draft.locations.length} stations: ${draft.locations.map((l) => l.short || l.name).join(', ')}`}
      </Row>
      <Row step="checklist" label="Checklist">
        {draft.checklist.length === 0
          ? 'Empty — hires go straight to FTO rides'
          : `${draft.checklist.length} requirement${draft.checklist.length === 1 ? '' : 's'}, ${draft.checklist.filter((m) => m.waivable).length} waivable for transfers`}
      </Row>
      <Row step="schedule" label="Schedule">
        {scheduleSummary(draft.schedule)}
      </Row>
      <Row step="fto" label="Release">
        At {draft.release.minContacts} patient contacts · sheets: {sheetNames.join(', ') || 'none'}
      </Row>
      <Row step="ftos" label="FTOs">
        {draft.ftos.names.length} FTO{draft.ftos.names.length === 1 ? '' : 's'}
        {draft.ftos.evaluators.length ? `, ${draft.ftos.evaluators.length} other evaluator${draft.ftos.evaluators.length === 1 ? '' : 's'}` : ''} ·{' '}
        {draft.ftos.crews.length ? `${draft.ftos.crews.length} shift${draft.ftos.crews.length === 1 ? '' : 's'}` : 'no shifts entered'}
      </Row>
      <Row step="documents" label="Documents">
        {draft.documents.facilities.length} hospital{draft.documents.facilities.length === 1 ? '' : 's'} ·{' '}
        {draft.documents.welcomeKit.length} welcome-kit item{draft.documents.welcomeKit.length === 1 ? '' : 's'}
      </Row>
    </div>
  )
}

// ----- the page ------------------------------------------------------------------

export default function NeopSetup() {
  const can = useCan()
  const program = useProgram()
  const ownProgram = useHasOwnProgram()
  const market = activeMarket()
  const [params, setParams] = useSearchParams()

  const trainees = useSelector((db) => db.trainees)
  const inUse = useMemo(
    () => ({
      locations: new Set(trainees.map((t) => t.operation)),
      checklist: new Set(trainees.flatMap((t) => [...Object.keys(t.checklist ?? {}), ...Object.keys(t.waived ?? {})])),
    }),
    [trainees],
  )

  const [restored, setRestored] = useState(readDraft)
  const [draft, setDraft] = useState<NeopProgram | null>(() => restored?.program ?? (program ? cloneProgramPart(program) : null))
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const wanted = params.get('step') as StepId | null
  const valid = (s: StepId | null): s is StepId =>
    !!s && (s === 'review' || s === 'start' || STEPS.some((x) => x.id === s))
  const step: StepId = !draft ? 'start' : valid(wanted) && wanted !== 'start' ? wanted : 'basics'
  const go = (s: StepId) => {
    setParams(s === 'basics' ? {} : { step: s }, { replace: true })
    setSavedAt(null)
    window.scrollTo({ top: 0 })
  }

  useEffect(() => {
    if (!draft) return
    // Only keep a draft that differs from what is saved; an unchanged one is noise.
    writeDraft(program && same(draft, program) ? null : draft)
  }, [draft, program])

  if (!can.manageAcademy) {
    return (
      <Empty icon="🔒" title="NEOP setup is for administrators">
        Your clinical education specialist sets up how your academy runs.{' '}
        <Link to="/academy" className="link-btn">Back to NEOP</Link>
      </Empty>
    )
  }

  const update: StepProps['update'] = (fn) => setDraft((d) => (d ? fn(d) : d))
  const problems = draft ? programProblems(draft) : []
  // Changed from what is saved. A shipped program can be saved unchanged too:
  // that is how an operation adopts it as its own.
  const changed = !!draft && (!program || !same(draft, program))
  const canSave = !!draft && (changed || !ownProgram) && problems.length === 0
  const idx = STEPS.findIndex((s) => s.id === step)
  const Current = idx >= 0 ? STEPS[idx].component : null

  const save = () => {
    if (!draft || problems.length) return
    saveProgram(draft)
    writeDraft(null)
    setSavedAt(new Date().toISOString())
    // The draft now IS the saved program; nothing left to pick up.
    setRestored(null)
  }

  const discard = () => {
    writeDraft(null)
    setRestored(null)
    setDraft(program ? cloneProgramPart(program) : null)
    setParams({}, { replace: true })
    setSavedAt(null)
  }

  return (
    <div className="neop-setup">
      <Link to="/academy" className="link-btn">
        ← Back to NEOP
      </Link>
      <div className="page-head" style={{ marginTop: 8 }}>
        <div>
          <h1>NEOP setup</h1>
          <div className="subtle">
            How {marketName(market)}'s new-hire academy runs. New cohorts are built from this.
          </div>
        </div>
      </div>

      {restored && draft && !same(draft, program) && (
        <div className="banner info">
          Picking up your unsaved changes from {formatDate(restored.at.slice(0, 10))}.{' '}
          <button type="button" className="link-btn" onClick={discard}>
            Discard them
          </button>
        </div>
      )}
      {!ownProgram && program && step !== 'start' && (
        <div className="banner info">
          This is the NEOP {marketName(market)} shipped with. Change anything, then save to make it yours.
        </div>
      )}

      {draft && (
        <nav className="setup-steps" aria-label="Setup steps">
          <ol>
            {STEPS.map((s, i) => (
              <li key={s.id}>
                <button type="button" aria-current={step === s.id ? 'step' : undefined} onClick={() => go(s.id)}>
                  <span className="setup-step-n">{i + 1}</span>
                  <span>{s.label}</span>
                </button>
              </li>
            ))}
            <li>
              <button type="button" aria-current={step === 'review' ? 'step' : undefined} onClick={() => go('review')}>
                <span className="setup-step-n">✓</span>
                <span>Review &amp; save</span>
              </button>
            </li>
          </ol>
        </nav>
      )}

      <div className="card setup-body">
        <h2 className="setup-step-title">
          {step === 'start' ? 'Where to start' : step === 'review' ? 'Review & save' : STEPS[idx].label}
        </h2>

        {step === 'start' && (
          <StartStep
            onPick={(p) => {
              setDraft(startingProgram(p, market))
              go('basics')
            }}
          />
        )}
        {draft && Current && <Current draft={draft} update={update} inUse={inUse} />}
        {draft && step === 'review' && <ReviewStep draft={draft} go={go} />}

        {savedAt ? (
          <div className="banner ok" role="status" style={{ marginTop: 16 }}>
            <strong>Saved.</strong> New cohorts use this from now on. Cohorts already running keep the
            checklist and schedule they started with — bring one up to date from its <em>Edit</em>{' '}
            button.
            <div className="btn-row" style={{ marginTop: 10 }}>
              <Link to="/academy" className="btn primary">
                Back to NEOP
              </Link>
            </div>
          </div>
        ) : (
          problems.length > 0 &&
          step !== 'start' && (
            <div className="banner warn" style={{ marginTop: 16 }}>
              Before saving: {problems.join(' ')}
            </div>
          )
        )}
      </div>

      {draft && (
        <div className="setup-footer">
          <button type="button" className="btn" disabled={idx <= 0 && step !== 'review'} onClick={() => go(step === 'review' ? STEPS[STEPS.length - 1].id : STEPS[Math.max(0, idx - 1)].id)}>
            ← Back
          </button>
          {step !== 'review' && (
            <button type="button" className="btn" onClick={() => go(idx === STEPS.length - 1 ? 'review' : STEPS[idx + 1].id)}>
              {idx === STEPS.length - 1 ? 'Review' : 'Next'} →
            </button>
          )}
          <div className="spacer" />
          {changed && program && (
            <button type="button" className="btn ghost" onClick={discard}>
              Discard changes
            </button>
          )}
          <button type="button" className="btn primary" disabled={!canSave} onClick={save}>
            {program && ownProgram ? 'Save changes' : 'Save NEOP'}
          </button>
        </div>
      )}
    </div>
  )
}
