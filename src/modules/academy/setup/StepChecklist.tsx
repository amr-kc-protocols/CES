import { GENERAL_MODULES } from '../../../data/academy'
import { idFromLabel } from '../program'
import { AudiencePicker, RowActions, move } from './fields'
import type { StepProps } from './shared'
import type { NeopChecklistItem } from '../../../types'

// Step 2 — what a hire has to finish before FTO rides.

export default function StepChecklist({ draft, update, inUse }: StepProps) {
  const set = (i: number, patch: Partial<NeopChecklistItem>) =>
    update((p) => ({ ...p, checklist: p.checklist.map((m, j) => (j === i ? { ...m, ...patch } : m)) }))

  const taken = draft.checklist.map((m) => m.id)
  // The AMR-wide modules not on the list yet, offered back with one tap — for
  // an operation that started blank, or deleted one and changed its mind.
  const missingCommon = GENERAL_MODULES.filter((g) => !taken.includes(g.id))

  return (
    <div>
      <p className="step-intro">
        Everything a new hire has to finish before FTO rides. Each hire gets the items that apply to
        their credential and station, and moves on to FTO rides automatically once every one is ticked
        off on the roster.
      </p>

      {draft.checklist.length === 0 && (
        <div className="banner info">
          The checklist is empty, so hires go straight to FTO rides. Add an item below, or add the
          common AMR ones.
        </div>
      )}

      <div className="edit-rows">
        {draft.checklist.map((m, i) => (
          <div key={m.id} className="edit-row">
            <div className="edit-row-fields">
              <div className="field" style={{ marginBottom: 6 }}>
                <label htmlFor={`cl-${i}`}>Requirement</label>
                <input id={`cl-${i}`} value={m.label} placeholder="e.g. County protocol test" onChange={(e) => set(i, { label: e.target.value })} />
              </div>
              <div className="edit-row-meta">
                <span className="subtle">Who needs it:</span>
                <AudiencePicker
                  idPrefix={`cl-${i}`}
                  value={m.who}
                  onChange={(who) => set(i, { who })}
                  credentials={draft.credentials}
                  locations={draft.locations}
                />
                <label className="inline-check">
                  <input type="checkbox" checked={!!m.waivable} onChange={(e) => set(i, { waivable: e.target.checked || undefined })} />
                  Transfers can waive it
                </label>
              </div>
            </div>
            <RowActions
              index={i}
              count={draft.checklist.length}
              label={m.label || 'item'}
              onMove={(from, to) => update((p) => ({ ...p, checklist: move(p.checklist, from, to) }))}
              onRemove={() => update((p) => ({ ...p, checklist: p.checklist.filter((_, j) => j !== i) }))}
            />
            {inUse.checklist.has(m.id) && (
              <div className="help-text">
                Already ticked off for some hires. Renaming it keeps their ticks.
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="btn-row">
        <button
          type="button"
          className="btn sm"
          onClick={() =>
            update((p) => ({
              ...p,
              checklist: [...p.checklist, { id: idFromLabel('requirement', p.checklist.map((x) => x.id), 'm-'), label: '' }],
            }))
          }
        >
          + Add a requirement
        </button>
        {missingCommon.length > 0 && (
          <button
            type="button"
            className="btn sm ghost"
            title={missingCommon.map((g) => g.label).join(', ')}
            onClick={() =>
              update((p) => ({
                ...p,
                checklist: [
                  ...p.checklist,
                  ...missingCommon.map((g) => ({
                    id: g.id,
                    label: g.label,
                    waivable: g.id !== 'report_writing',
                  })),
                ],
              }))
            }
          >
            + Add the common AMR items ({missingCommon.length})
          </button>
        )}
      </div>
    </div>
  )
}
