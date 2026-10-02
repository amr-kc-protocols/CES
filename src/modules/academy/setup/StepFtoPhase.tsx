import { Link } from 'react-router-dom'
import { activeMarket } from '../../../lib/market'
import { neopSheetMeta } from '../../templates/resolve'
import { SHEET_CHOICES } from '../program'
import { AudiencePicker, NumberField } from './fields'
import type { StepProps } from './shared'

// Step 4 — what happens on FTO rides and when a hire is released.

export default function StepFtoPhase({ draft, update }: StepProps) {
  const running = new Map(draft.sheets.map((s) => [s.id, s]))
  return (
    <div>
      <p className="step-intro">
        Once a hire's checklist is done they ride with FTOs. FTOs log patient contacts and daily
        evaluations, and sign off the skill sheets below. The release button unlocks when the hire
        reaches the contact count.
      </p>

      <div className="field-row">
        <NumberField
          id="fp-min"
          label="Patient contacts before release"
          value={draft.release.minContacts}
          onChange={(n) => update((p) => ({ ...p, release: { ...p.release, minContacts: Math.round(n) } }))}
          max={200}
          help="The release button stays locked until a hire reaches this."
        />
        <NumberField
          id="fp-target"
          label="Target shown for each new hire"
          value={draft.release.defaultTarget}
          onChange={(n) => update((p) => ({ ...p, release: { ...p.release, defaultTarget: Math.round(n) } }))}
          max={200}
          help="What their progress bar counts toward. Lower it per hire for an AMR transfer."
        />
      </div>
      {draft.release.defaultTarget < draft.release.minContacts && (
        <div className="banner warn">
          The target is below the release count, so a hire's bar fills before they can be released.
          The release button follows whichever is lower.
        </div>
      )}

      <fieldset className="field plain-fieldset">
        <legend>Skill sheets your FTOs sign off</legend>
        <div className="edit-rows">
          {SHEET_CHOICES.map((choice) => {
            const use = running.get(choice.id)
            const meta = neopSheetMeta(choice.id)
            return (
              <div key={choice.id} className="edit-row sheet-row">
                <label className="inline-check sheet-pick">
                  <input
                    type="checkbox"
                    checked={!!use}
                    onChange={(e) =>
                      update((p) => ({
                        ...p,
                        sheets: e.target.checked
                          ? // Keep the shipped order, so the buttons on a hire's card do not reshuffle.
                            SHEET_CHOICES.filter((c) => c.id === choice.id || p.sheets.some((s) => s.id === c.id)).map(
                              (c) => p.sheets.find((s) => s.id === c.id) ?? { id: c.id, ...(c.defaultWho ? { who: c.defaultWho } : {}) },
                            )
                          : p.sheets.filter((s) => s.id !== choice.id),
                      }))
                    }
                  />
                  <span>
                    <strong>
                      {meta.icon} {meta.label}
                    </strong>
                    <span className="subtle"> — {choice.hint}</span>
                  </span>
                </label>
                {use && (
                  <div className="edit-row-meta" style={{ paddingLeft: 26 }}>
                    <span className="subtle">For:</span>
                    <AudiencePicker
                      idPrefix={`sh-${choice.id}`}
                      value={use.who}
                      onChange={(who) =>
                        update((p) => ({ ...p, sheets: p.sheets.map((s) => (s.id === choice.id ? { id: s.id, ...(who ? { who } : {}) } : s)) }))
                      }
                      credentials={draft.credentials}
                      locations={draft.locations}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="help-text">
          To change what is on a sheet — its skills, or the reminder printed on it — use{' '}
          <Link to="/templates" className="link-btn">
            Sheets &amp; forms
          </Link>
          . Changes there are kept as a new version, so hires already signed off keep the sheet they
          were assessed on.
        </div>
      </fieldset>

      <div className="banner info">
        <strong>Daily evaluations</strong> run for every operation. Their categories can be changed in{' '}
        <Link to="/templates" className="link-btn">
          Sheets &amp; forms
        </Link>
        .
        {activeMarket() !== 'kc' && (
          <>
            {' '}
            The <strong>exit survey</strong> is Kansas City's for now: it reports to Kansas City's own
            sheet, so turning it on here would send your hires' answers into Kansas City's results.
          </>
        )}
      </div>
    </div>
  )
}
