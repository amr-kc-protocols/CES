import { COMPLIANCE_DOCS } from '../complianceDocs'
import { LinesField, RowActions, move } from './fields'
import type { StepProps } from './shared'
import type { NeopFacility, NeopKitItem } from '../../../types'

// Step 6 — the local half of the paperwork.
//
// The per-hire forms (Hep B, PPD, fit test, EVOC certificate) are AMR's and
// the same everywhere; they print with each hire's details already filled in
// and there is nothing to set up. What differs by operation is the hospitals a
// new hire transfers to and what goes in their Day 1 folder.

export default function StepDocuments({ draft, update }: StepProps) {
  const d = draft.documents
  const setDocs = (patch: Partial<typeof d>) => update((p) => ({ ...p, documents: { ...p.documents, ...patch } }))
  const setFacility = (i: number, patch: Partial<NeopFacility>) =>
    setDocs({ facilities: d.facilities.map((f, j) => (j === i ? { ...f, ...patch } : f)) })
  const setKit = (i: number, patch: Partial<NeopKitItem>) =>
    setDocs({ welcomeKit: d.welcomeKit.map((k, j) => (j === i ? { ...k, ...patch } : k)) })

  return (
    <div>
      <p className="step-intro">
        Each hire's packet prints with their name, station and employee number already filled in:
        folder label, {COMPLIANCE_DOCS.map((x) => x.label.toLowerCase()).join(', ')}. Those are AMR's
        and need nothing here. Add your own local documents below.
      </p>

      <fieldset className="field plain-fieldset">
        <legend>Receiving hospitals</legend>
        <div className="help-text" style={{ marginTop: 0, marginBottom: 8 }}>
          Printed as a one-page cheat sheet for new hires. Leave it empty and the cheat sheet is not
          offered.
        </div>
        <div className="edit-rows">
          {d.facilities.map((f, i) => (
            <div key={i} className="edit-row">
              <div className="edit-row-fields three">
                <div className="field">
                  <label htmlFor={`fa-n-${i}`}>Hospital</label>
                  <input id={`fa-n-${i}`} value={f.name} onChange={(e) => setFacility(i, { name: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor={`fa-a-${i}`}>Address</label>
                  <input id={`fa-a-${i}`} value={f.address} onChange={(e) => setFacility(i, { address: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor={`fa-x-${i}`}>What it's for</label>
                  <input id={`fa-x-${i}`} value={f.notes} placeholder="STEMI · Stroke · Peds" onChange={(e) => setFacility(i, { notes: e.target.value })} />
                </div>
              </div>
              <RowActions
                index={i}
                count={d.facilities.length}
                label={f.name || 'hospital'}
                onMove={(from, to) => setDocs({ facilities: move(d.facilities, from, to) })}
                onRemove={() => setDocs({ facilities: d.facilities.filter((_, j) => j !== i) })}
              />
            </div>
          ))}
        </div>
        <button type="button" className="btn sm" onClick={() => setDocs({ facilities: [...d.facilities, { name: '', address: '', notes: '' }] })}>
          + Add a hospital
        </button>
      </fieldset>

      <LinesField
        id="doc-points"
        label="Key things to know"
        help="One per line, printed under the hospital list — e.g. where STEMIs go."
        value={d.keyPoints}
        onChange={(keyPoints) => setDocs({ keyPoints })}
      />

      <fieldset className="field plain-fieldset">
        <legend>Day 1 welcome kit</legend>
        <div className="help-text" style={{ marginTop: 0, marginBottom: 8 }}>
          What goes in each hire's folder. Prints as an assembly checklist with the cohort's roster.
        </div>
        <div className="edit-rows">
          {d.welcomeKit.map((k, i) => (
            <div key={i} className="edit-row">
              <div className="edit-row-fields two">
                <div className="field">
                  <label htmlFor={`wk-i-${i}`}>Item</label>
                  <input id={`wk-i-${i}`} value={k.item} onChange={(e) => setKit(i, { item: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor={`wk-s-${i}`}>Where it comes from</label>
                  <input id={`wk-s-${i}`} value={k.source} onChange={(e) => setKit(i, { source: e.target.value })} />
                </div>
              </div>
              <RowActions
                index={i}
                count={d.welcomeKit.length}
                label={k.item || 'item'}
                onMove={(from, to) => setDocs({ welcomeKit: move(d.welcomeKit, from, to) })}
                onRemove={() => setDocs({ welcomeKit: d.welcomeKit.filter((_, j) => j !== i) })}
              />
            </div>
          ))}
        </div>
        <button type="button" className="btn sm" onClick={() => setDocs({ welcomeKit: [...d.welcomeKit, { item: '', source: '' }] })}>
          + Add an item
        </button>
      </fieldset>

      <label className="inline-check" style={{ marginTop: 8 }}>
        <input type="checkbox" checked={d.roadmap} onChange={(e) => setDocs({ roadmap: e.target.checked })} />
        Offer the corporate new-hire onboarding roadmap
        <span className="subtle"> — written for Kansas City and Linn County hires</span>
      </label>
    </div>
  )
}
