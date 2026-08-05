import { useMemo, useState } from 'react'
import {
  AEMT_INTAKE,
  AEMT_INTAKE_DEADLINE,
  intakeClosed,
  submitIntake,
  type IntakeField,
} from '../../lib/intake'

// Public, no-login AEMT intake form. Rendered outside the app shell (its own
// route, no tab bar) so a candidate just opens a link and fills it out.

type Values = Record<string, string | string[]>

function isShown(field: IntakeField, values: Values): boolean {
  if (!field.showIf) return true
  return values[field.showIf.key] === field.showIf.equals
}

function Field({
  field,
  value,
  onChange,
  invalid,
}: {
  field: IntakeField
  value: string | string[]
  onChange: (v: string | string[]) => void
  invalid: boolean
}) {
  const id = `f_${field.key}`
  const req = field.required ? (
    <span aria-hidden style={{ color: 'var(--red)' }}> *</span>
  ) : null

  if (field.type === 'yesno' || field.type === 'radio') {
    const options = field.type === 'yesno' ? ['Yes', 'No'] : field.options ?? []
    return (
      <div className="field" style={invalid ? { outline: 'none' } : undefined}>
        <label>
          {field.label}
          {req}
        </label>
        <div className="choice-row" role="radiogroup" aria-label={field.label}>
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`choice${value === opt ? ' active' : ''}`}
              aria-pressed={value === opt}
              onClick={() => onChange(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
        {invalid && <div className="help-text" style={{ color: 'var(--crit)' }}>Please choose one.</div>}
      </div>
    )
  }

  if (field.type === 'checkboxes') {
    const arr = Array.isArray(value) ? value : []
    const toggle = (opt: string) =>
      onChange(arr.includes(opt) ? arr.filter((o) => o !== opt) : [...arr, opt])
    return (
      <div className="field">
        <label>
          {field.label}
          {req}
        </label>
        <div className="choice-row">
          {(field.options ?? []).map((opt) => (
            <button
              key={opt}
              type="button"
              className={`choice${arr.includes(opt) ? ' active' : ''}`}
              aria-pressed={arr.includes(opt)}
              onClick={() => toggle(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
        {invalid && <div className="help-text" style={{ color: 'var(--crit)' }}>Pick at least one.</div>}
      </div>
    )
  }

  if (field.type === 'select') {
    return (
      <div className="field">
        <label htmlFor={id}>
          {field.label}
          {req}
        </label>
        <select id={id} value={(value as string) || ''} onChange={(e) => onChange(e.target.value)}>
          <option value="" disabled>
            Choose…
          </option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {invalid && <div className="help-text" style={{ color: 'var(--crit)' }}>Required.</div>}
      </div>
    )
  }

  if (field.type === 'textarea') {
    return (
      <div className="field">
        <label htmlFor={id}>
          {field.label}
          {req}
        </label>
        <textarea
          id={id}
          rows={3}
          value={(value as string) || ''}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    )
  }

  return (
    <div className="field">
      <label htmlFor={id}>
        {field.label}
        {req}
      </label>
      <input
        id={id}
        type={field.type}
        value={(value as string) || ''}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {invalid && <div className="help-text" style={{ color: 'var(--crit)' }}>Required.</div>}
    </div>
  )
}

export default function IntakeForm() {
  const [values, setValues] = useState<Values>({})
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)

  const set = (key: string, v: string | string[]) => setValues((prev) => ({ ...prev, [key]: v }))

  // A field is missing only if it's required, currently shown, and empty.
  const missing = useMemo(() => {
    const out = new Set<string>()
    for (const section of AEMT_INTAKE) {
      for (const field of section.fields) {
        if (!field.required || !isShown(field, values)) continue
        const v = values[field.key]
        const empty = Array.isArray(v) ? v.length === 0 : !v
        if (empty) out.add(field.key)
      }
    }
    return out
  }, [values])

  const closed = intakeClosed()

  const onSubmit = async () => {
    if (closed) return
    setShowErrors(true)
    setError(null)
    if (missing.size > 0 || !consent) {
      setError(!consent && missing.size === 0 ? 'Please confirm the acknowledgement below.' : 'Please complete the required fields highlighted above.')
      return
    }
    setSubmitting(true)
    // Drop values for fields that are hidden by a showIf, so a "Yes → No"
    // change doesn't leave a stale answer behind.
    const clean: Record<string, unknown> = {}
    for (const section of AEMT_INTAKE) {
      for (const field of section.fields) {
        if (isShown(field, values) && values[field.key] != null && values[field.key] !== '') {
          clean[field.key] = values[field.key]
        }
      }
    }
    const { error: err } = await submitIntake(clean)
    setSubmitting(false)
    if (err) {
      setError(err + ' — please check your connection and try again.')
      return
    }
    setDone(true)
    window.scrollTo(0, 0)
  }

  return (
    <div className="intake-page">
      <header className="intake-head">
        <img src="/pwa-192x192.png" alt="" />
        <div>
          <div className="intake-title">AMR Kansas City</div>
          <div className="intake-sub">AEMT Program — Interest &amp; Availability</div>
        </div>
      </header>

      <main className="intake-body">
        {done ? (
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
            <h2 style={{ marginBottom: 8 }}>Thanks — we've got it.</h2>
            <p className="subtle" style={{ margin: 0 }}>
              Your information has been submitted to the AMR KC education team. If you're a fit for
              the next AEMT cohort, someone will reach out. You can close this page.
            </p>
          </div>
        ) : closed ? (
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🔒</div>
            <h2 style={{ marginBottom: 8 }}>Applications are closed</h2>
            <p className="subtle" style={{ margin: 0 }}>
              The window to submit closed on <strong>{AEMT_INTAKE_DEADLINE.display}</strong>. If you
              missed the deadline, reach out to the AMR KC education team.
            </p>
          </div>
        ) : (
          <>
            <div className="intake-deadline">
              ⏰ Applications close <strong>{AEMT_INTAKE_DEADLINE.display}</strong>. Please submit
              before then.
            </div>

            <div className="banner info">
              This short form helps us plan the next AEMT class. It's about your{' '}
              <strong>availability and time</strong> — there are no wrong answers. Takes about
              3 minutes.
            </div>

            {AEMT_INTAKE.map((section) => (
              <section key={section.title} className="card intake-section">
                <h2>{section.title}</h2>
                {section.intro && <p className="subtle intake-intro">{section.intro}</p>}
                {section.fields.map((field) =>
                  isShown(field, values) ? (
                    <Field
                      key={field.key}
                      field={field}
                      value={values[field.key] ?? (field.type === 'checkboxes' ? [] : '')}
                      onChange={(v) => set(field.key, v)}
                      invalid={showErrors && missing.has(field.key)}
                    />
                  ) : null,
                )}
              </section>
            ))}

            <label className="intake-consent">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>The information above is accurate to the best of my knowledge.</span>
            </label>

            {error && (
              <div className="banner crit" role="alert">
                {error}
              </div>
            )}

            <button
              type="button"
              className="btn primary"
              style={{ width: '100%', marginTop: 4 }}
              disabled={submitting}
              onClick={onSubmit}
            >
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
            <div className="intake-foot subtle">
              Your answers go only to the AMR KC education team. No account needed.
            </div>
          </>
        )}
      </main>
    </div>
  )
}
