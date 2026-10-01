import { CREDENTIAL_LABELS } from '../../../data/academy'
import { ALL_CREDENTIALS, idFromLabel } from '../program'
import { ChipToggle, RowActions, move } from './fields'
import type { StepProps } from './shared'

// Step 1 — what the program is called, who it hires, and where they're based.

export default function StepBasics({ draft, update, inUse }: StepProps) {
  const setLocation = (i: number, patch: { name?: string; short?: string }) =>
    update((p) => ({
      ...p,
      locations: p.locations.map((l, j) => (j === i ? { ...l, ...patch } : l)),
    }))

  return (
    <div>
      <div className="field">
        <label htmlFor="nb-name">Name of your NEOP</label>
        <input
          id="nb-name"
          value={draft.name}
          onChange={(e) => update((p) => ({ ...p, name: e.target.value, schedule: { ...p.schedule, name: e.target.value } }))}
          placeholder="AMR Topeka New Hire Academy"
        />
        <div className="help-text">Printed at the top of the schedule.</div>
      </div>

      <div className="field">
        <label htmlFor="nb-header">Folder label heading</label>
        <input
          id="nb-header"
          value={draft.header}
          onChange={(e) => update((p) => ({ ...p, header: e.target.value }))}
          placeholder="AMR TOPEKA — NEW HIRE ACADEMY"
        />
        <div className="help-text">The line across the top of each hire's folder cover.</div>
      </div>

      <fieldset className="field plain-fieldset">
        <legend>Who you hire</legend>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ALL_CREDENTIALS.map((c) => (
            <ChipToggle
              key={c}
              on={draft.credentials.includes(c)}
              onClick={() =>
                update((p) => ({
                  ...p,
                  credentials: p.credentials.includes(c)
                    ? p.credentials.filter((x) => x !== c)
                    : ALL_CREDENTIALS.filter((x) => x === c || p.credentials.includes(x)),
                }))
              }
            >
              {CREDENTIAL_LABELS[c]}
            </ChipToggle>
          ))}
        </div>
        <div className="help-text">Only these appear when you add a hire to a cohort.</div>
      </fieldset>

      <fieldset className="field plain-fieldset">
        <legend>Stations</legend>
        <div className="help-text" style={{ marginTop: 0, marginBottom: 8 }}>
          Most operations have one. Add more only if hires based at different stations need different
          requirements — Kansas City lists KC, Cass County and Linn County because each station's
          paramedics train on different airway equipment.
        </div>
        <div className="edit-rows">
          {draft.locations.map((l, i) => (
            <div key={l.id} className="edit-row">
              <div className="edit-row-fields two">
                <div className="field">
                  <label htmlFor={`nb-loc-${i}`}>Station name</label>
                  <input id={`nb-loc-${i}`} value={l.name} onChange={(e) => setLocation(i, { name: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor={`nb-loc-short-${i}`}>Short name</label>
                  <input
                    id={`nb-loc-short-${i}`}
                    value={l.short ?? ''}
                    placeholder={l.name}
                    onChange={(e) => setLocation(i, { short: e.target.value || undefined })}
                  />
                </div>
              </div>
              <RowActions
                index={i}
                count={draft.locations.length}
                label={l.name || 'station'}
                onMove={(from, to) => update((p) => ({ ...p, locations: move(p.locations, from, to) }))}
                onRemove={() =>
                  update((p) => ({ ...p, locations: p.locations.filter((_, j) => j !== i) }))
                }
              />
              {inUse.locations.has(l.id) && (
                <div className="help-text">
                  Hires are already based here. Removing it keeps them as they are; their station shows
                  by its old name.
                </div>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn sm"
          onClick={() =>
            update((p) => ({
              ...p,
              locations: [
                ...p.locations,
                { id: idFromLabel(`station ${p.locations.length + 1}`, p.locations.map((l) => l.id)), name: `Station ${p.locations.length + 1}` },
              ],
            }))
          }
        >
          + Add a station
        </button>
      </fieldset>
    </div>
  )
}
