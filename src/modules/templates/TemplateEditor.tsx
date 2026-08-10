import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../../components/ui'
import { confirmAction, notifyUser } from '../../lib/dialog'
import { formatDateTime } from '../../lib/date'
import {
  bundledBody,
  discardDraft,
  publishDraft,
  resolveCurrent,
  saveDraft,
  useTemplateHistory,
} from '../../lib/templates'
import { useTemplateUsage } from './usage'
import {
  allRowIds,
  allowedRowKinds,
  fromEditor,
  slugId,
  toEditor,
  validateDoc,
  FIELD_KINDS,
  ROW_KIND_LABEL,
} from './editorModel'
import type { EditorDoc, EditorGroup, EditorRow, RowKind } from './editorModel'
import type { FieldKind } from '../../data/aemtForms'
import type { TemplateKind } from '../../types'

// ---------------------------------------------------------------------------
// The instrument editor.
//
// Edits are drafts. Publishing creates a version and leaves every earlier one
// intact, because records point at the version they were assessed under. The
// screen leads with what already points at this instrument, so an admin knows
// before they start whether they are adjusting an unused sheet or changing one
// twelve students have been graded on.
// ---------------------------------------------------------------------------

function Row({
  row,
  kind,
  onChange,
  onDelete,
  onMove,
  first,
  last,
}: {
  row: EditorRow
  kind: TemplateKind
  onChange: (r: EditorRow) => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
  first: boolean
  last: boolean
}) {
  const [open, setOpen] = useState(false)
  const showKind = row.rowKind === 'field'

  return (
    <div className="card" style={{ padding: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button
            className="btn sm"
            style={{ padding: '2px 7px', minHeight: 0 }}
            disabled={first}
            aria-label="Move up"
            onClick={() => onMove(-1)}
          >
            ↑
          </button>
          <button
            className="btn sm"
            style={{ padding: '2px 7px', minHeight: 0 }}
            disabled={last}
            aria-label="Move down"
            onClick={() => onMove(1)}
          >
            ↓
          </button>
        </div>
        <div className="grow" style={{ minWidth: 0 }}>
          <textarea
            value={row.label}
            rows={2}
            aria-label="Wording"
            onChange={(e) => onChange({ ...row, label: e.target.value })}
            style={{ width: '100%', minHeight: 0 }}
          />
          <div
            className="subtle"
            style={{ fontSize: 11, display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2 }}
          >
            <span>
              id <code>{row.id}</code>
            </span>
            {showKind && <span>{FIELD_KINDS.find((f) => f.value === row.kind)?.label}</span>}
            <button className="link-btn" style={{ minHeight: 0, fontSize: 11 }} onClick={() => setOpen(!open)}>
              {open ? 'Less' : 'More'}
            </button>
          </div>
        </div>
        <button className="btn sm danger" aria-label="Remove row" onClick={onDelete}>
          ✕
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          {showKind && (
            <div className="field">
              <label>Answer type</label>
              <select
                value={row.kind ?? 'text'}
                onChange={(e) => onChange({ ...row, kind: e.target.value as FieldKind })}
              >
                {FIELD_KINDS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {showKind && row.kind === 'scale' && (
            <div className="field-row">
              <div className="field">
                <label>Low label</label>
                <input
                  value={row.scale?.minLabel ?? 'needs work'}
                  onChange={(e) =>
                    onChange({
                      ...row,
                      scale: { min: 1, max: 5, maxLabel: 'excellent', ...row.scale, minLabel: e.target.value },
                    })
                  }
                />
              </div>
              <div className="field">
                <label>High label</label>
                <input
                  value={row.scale?.maxLabel ?? 'excellent'}
                  onChange={(e) =>
                    onChange({
                      ...row,
                      scale: { min: 1, max: 5, minLabel: 'needs work', ...row.scale, maxLabel: e.target.value },
                    })
                  }
                />
              </div>
              <div className="field">
                <label>Top of scale</label>
                <input
                  type="number"
                  min={2}
                  max={10}
                  value={row.scale?.max ?? 5}
                  onChange={(e) =>
                    onChange({
                      ...row,
                      scale: {
                        min: 1,
                        minLabel: 'needs work',
                        maxLabel: 'excellent',
                        ...row.scale,
                        max: Math.min(10, Math.max(2, Number(e.target.value) || 5)),
                      },
                    })
                  }
                />
              </div>
            </div>
          )}
          {showKind && (
            <div className="field">
              <label>Helper text</label>
              <input
                value={row.help ?? ''}
                placeholder="Shown under the question"
                onChange={(e) => onChange({ ...row, help: e.target.value || undefined })}
              />
            </div>
          )}
          {kind === 'neop-skill' && (
            <div className="field">
              <label>Observable steps</label>
              <textarea
                value={(row.steps ?? []).join('\n')}
                placeholder="One step per line — leave blank for a single pass/fail line"
                onChange={(e) =>
                  onChange({
                    ...row,
                    steps: e.target.value.trim()
                      ? e.target.value.split('\n').map((s) => s.trim()).filter(Boolean)
                      : undefined,
                  })
                }
              />
              <div className="help-text">
                A skill with steps is checked off step by step; one without is a single pass/fail.
              </div>
            </div>
          )}
          <div className="help-text">
            The id is fixed once a row exists — answers are stored against it, so changing it would
            orphan every answer already recorded. Delete the row and add a new one if you need a
            different id.
          </div>
        </div>
      )}
    </div>
  )
}

function GroupBlock({
  group,
  kind,
  doc,
  onChange,
  onDelete,
  onMove,
  first,
  last,
}: {
  group: EditorGroup
  kind: TemplateKind
  doc: EditorDoc
  onChange: (g: EditorGroup) => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
  first: boolean
  last: boolean
}) {
  const kinds = allowedRowKinds(kind)
  const [newKind, setNewKind] = useState<RowKind>(kinds[0])

  const addRow = () => {
    const id = slugId('new item', allRowIds(doc))
    const row: EditorRow = {
      id,
      label: '',
      rowKind: newKind,
      ...(newKind === 'field' ? { kind: 'scale' as FieldKind, scale: { min: 1, max: 5, minLabel: 'needs work', maxLabel: 'excellent' } } : {}),
    }
    onChange({ ...group, rows: [...group.rows, row] })
  }

  const setRow = (i: number, r: EditorRow) =>
    onChange({ ...group, rows: group.rows.map((x, j) => (j === i ? r : x)) })

  const moveRow = (i: number, dir: -1 | 1) => {
    const next = [...group.rows]
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange({ ...group, rows: next })
  }

  return (
    <div className="card" style={{ padding: 12, marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <div className="field grow" style={{ marginBottom: 0 }}>
          <label>Group heading</label>
          <input value={group.title} onChange={(e) => onChange({ ...group, title: e.target.value })} />
        </div>
        <button className="btn sm" disabled={first} aria-label="Move group up" onClick={() => onMove(-1)}>
          ↑
        </button>
        <button className="btn sm" disabled={last} aria-label="Move group down" onClick={() => onMove(1)}>
          ↓
        </button>
        <button className="btn sm danger" onClick={onDelete}>
          Remove
        </button>
      </div>

      {kind === 'aemt-form' && (
        <div className="field" style={{ marginTop: 8 }}>
          <label>Group note</label>
          <input
            value={group.help ?? ''}
            placeholder="Optional instruction shown under the heading"
            onChange={(e) => onChange({ ...group, help: e.target.value || undefined })}
          />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
        {group.rows.map((r, i) => (
          <Row
            key={r.id}
            row={r}
            kind={kind}
            first={i === 0}
            last={i === group.rows.length - 1}
            onChange={(next) => setRow(i, next)}
            onMove={(d) => moveRow(i, d)}
            onDelete={() => onChange({ ...group, rows: group.rows.filter((_, j) => j !== i) })}
          />
        ))}
        {group.rows.length === 0 && (
          <div className="subtle" style={{ fontSize: 13 }}>
            Nothing in this group yet.
          </div>
        )}
      </div>

      <div className="btn-row" style={{ marginTop: 10 }}>
        {kinds.length > 1 && (
          <select value={newKind} onChange={(e) => setNewKind(e.target.value as RowKind)} style={{ maxWidth: 180 }}>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {ROW_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        )}
        <button className="btn sm" onClick={addRow}>
          + Add {ROW_KIND_LABEL[newKind].toLowerCase()}
        </button>
      </div>
    </div>
  )
}

export default function TemplateEditor({
  kind,
  templateId,
  actor,
  onClose,
}: {
  kind: TemplateKind
  templateId: string
  actor: string
  onClose: () => void
}) {
  const history = useTemplateHistory(kind, templateId)
  const usage = useTemplateUsage(kind, templateId)
  const draft = history.find((h) => h.status === 'draft')

  // Seed from the draft if one exists, else the version in force.
  const seed = useMemo(
    () => toEditor(kind, templateId, draft?.body ?? resolveCurrent(kind, templateId)),
    // Only re-seed when the instrument changes, never on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, templateId],
  )
  const [doc, setDoc] = useState<EditorDoc>(seed)
  const [dirty, setDirty] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [note, setNote] = useState('')
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    setDoc(seed)
    setDirty(false)
  }, [seed])

  const problems = validateDoc(kind, doc)
  const blocking = problems.filter((p) => p.blocking)
  const warnings = problems.filter((p) => !p.blocking)

  const edit = (next: EditorDoc) => {
    setDoc(next)
    setDirty(true)
  }

  const setGroup = (i: number, g: EditorGroup) =>
    edit({ ...doc, groups: doc.groups.map((x, j) => (j === i ? g : x)) })

  const moveGroup = (i: number, dir: -1 | 1) => {
    const next = [...doc.groups]
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    edit({ ...doc, groups: next })
  }

  const save = () => {
    saveDraft(kind, templateId, fromEditor(kind, doc), actor)
    setDirty(false)
    notifyUser('Saved as a draft. Nothing changes for anyone until you publish it.')
  }

  const isBundled = !!bundledBody(kind, templateId)

  return (
    <div>
      <button
        className="link-btn"
        onClick={async () => {
          if (dirty) {
            const ok = await confirmAction({
              title: 'Leave without saving?',
              body: 'Your changes to this instrument have not been saved as a draft yet.',
              confirmLabel: 'Discard changes',
            })
            if (!ok) return
          }
          onClose()
        }}
      >
        ← All instruments
      </button>

      <div className="page-head" style={{ marginTop: 4 }}>
        <div>
          <h2 style={{ fontSize: 18 }}>{doc.title || 'Untitled'}</h2>
          <div className="subtle" style={{ fontSize: 12 }}>
            <code>{templateId}</code> ·{' '}
            {history.some((h) => h.status === 'published')
              ? `version ${history.find((h) => h.status === 'published')!.version} in force`
              : 'running the version shipped with the app'}
            {!isBundled && ' · created here'}
          </div>
        </div>
      </div>

      {/* What already points at this instrument. Leads, because it decides how
          careful an edit has to be. */}
      <div className={`banner ${usage.records === 0 ? 'info' : usage.signed > 0 ? 'warn' : 'info'}`}>
        {usage.records === 0 ? (
          <>Nothing has been assessed against this yet, so an edit affects no existing record.</>
        ) : (
          <>
            <strong>
              {usage.records} record{usage.records === 1 ? '' : 's'} already assessed against this
              {usage.signed > 0 && `, ${usage.signed} of them signed`}.
            </strong>{' '}
            They stay pinned to the version they were assessed under and will keep rendering against
            it — publishing a new version changes what happens from now on, not what those records
            say.
          </>
        )}
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="tpl-title">Title</label>
        <input id="tpl-title" value={doc.title} onChange={(e) => edit({ ...doc, title: e.target.value })} />
      </div>

      {kind !== 'neop-skill' && (
        <div className="field">
          <label htmlFor="tpl-sub">
            {kind === 'aemt-skill'
              ? 'Scope marking'
              : kind === 'neop-daily-eval'
                ? 'Readiness question'
                : 'Subtitle'}
          </label>
          <input
            id="tpl-sub"
            value={doc.subtitle ?? ''}
            onChange={(e) => edit({ ...doc, subtitle: e.target.value })}
          />
        </div>
      )}

      {kind === 'aemt-form' && (
        <div className="field">
          <label htmlFor="tpl-by">Completed by</label>
          <input
            id="tpl-by"
            value={doc.completedBy ?? ''}
            placeholder="Preceptor / Student / Instructor"
            onChange={(e) => edit({ ...doc, completedBy: e.target.value })}
          />
        </div>
      )}

      {kind === 'neop-skill' && (
        <div className="field">
          <label htmlFor="tpl-note">Reminder printed on the sheet</label>
          <textarea
            id="tpl-note"
            value={doc.note ?? ''}
            onChange={(e) => edit({ ...doc, note: e.target.value || undefined })}
          />
        </div>
      )}

      {doc.groups.map((g, i) => (
        <GroupBlock
          key={i}
          group={g}
          kind={kind}
          doc={doc}
          first={i === 0}
          last={i === doc.groups.length - 1}
          onChange={(next) => setGroup(i, next)}
          onMove={(d) => moveGroup(i, d)}
          onDelete={() => edit({ ...doc, groups: doc.groups.filter((_, j) => j !== i) })}
        />
      ))}

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          className="btn"
          onClick={() => edit({ ...doc, groups: [...doc.groups, { title: 'New group', rows: [] }] })}
        >
          + Add group
        </button>
      </div>

      {kind === 'aemt-skill' && (
        <div className="card" style={{ padding: 12, marginTop: 14 }}>
          <div className="section-title" style={{ marginTop: 0 }}>
            Critical failure criteria
          </div>
          <div className="help-text" style={{ marginTop: 0 }}>
            Any one of these fails the sheet outright, whatever the criteria above show. One per
            line. These are matched by their exact wording, so editing a line here does not carry
            over to a student already marked against the old wording — that record keeps the version
            it was assessed on.
          </div>
          <textarea
            value={(doc.criticalFailures ?? []).join('\n')}
            rows={4}
            aria-label="Critical failure criteria, one per line"
            onChange={(e) =>
              edit({
                ...doc,
                criticalFailures: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
              })
            }
          />
        </div>
      )}

      {blocking.length > 0 && (
        <div className="banner crit" style={{ marginTop: 14 }}>
          <strong>Not publishable yet.</strong>
          {blocking.map((p) => (
            <div key={p.text}>{p.text}</div>
          ))}
        </div>
      )}
      {warnings.length > 0 && (
        <div className="banner warn" style={{ marginTop: 10 }}>
          {warnings.map((p) => (
            <div key={p.text}>{p.text}</div>
          ))}
        </div>
      )}

      <div className="btn-row" style={{ marginTop: 14 }}>
        <button className="btn" disabled={!dirty} onClick={save}>
          Save draft
        </button>
        <button
          className="btn primary"
          disabled={blocking.length > 0}
          onClick={() => {
            if (dirty) save()
            setPublishing(true)
          }}
        >
          Publish version {(history[0]?.version ?? 0) + (draft ? 0 : 1)}
        </button>
        {draft && (
          <button
            className="btn danger"
            style={{ marginLeft: 'auto' }}
            onClick={async () => {
              const ok = await confirmAction({
                title: 'Discard the draft?',
                body: 'Everything unpublished on this instrument goes. The version in force is unaffected.',
                confirmLabel: 'Discard draft',
              })
              if (ok) {
                discardDraft(kind, templateId)
                onClose()
              }
            }}
          >
            Discard draft
          </button>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <button className="link-btn" onClick={() => setShowHistory(!showHistory)}>
          {showHistory ? 'Hide' : 'Show'} version history ({history.length})
        </button>
      </div>

      {showHistory && (
        <div className="list" style={{ marginTop: 8 }}>
          <div className="row">
            <div className="grow">
              <div className="title" style={{ fontSize: 14 }}>
                Version 0 — shipped with the app
              </div>
              <div className="meta">
                {isBundled
                  ? 'The definition in the source data. Records with no version pinned resolve here.'
                  : 'No bundled version — this instrument was created in the app.'}
              </div>
            </div>
          </div>
          {history.map((h) => (
            <div key={h.id} className="row">
              <div className="grow">
                <div className="title" style={{ fontSize: 14 }}>
                  Version {h.version}
                  <span className={`pill ${h.status === 'published' ? 'ok' : h.status === 'draft' ? 'warn' : 'muted'}`} style={{ marginLeft: 8 }}>
                    {h.status}
                  </span>
                </div>
                <div className="meta">
                  {h.publishedAt
                    ? `${formatDateTime(h.publishedAt)} · ${h.publishedBy}`
                    : `saved ${formatDateTime(h.createdAt)} · ${h.createdBy}`}
                </div>
                {h.note && <div className="meta">{h.note}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {publishing && (
        <Modal title={`Publish this version`} onClose={() => setPublishing(false)}>
          <p style={{ marginTop: 0, lineHeight: 1.55 }}>
            From now on, assessments use this version. The{' '}
            {usage.records === 0 ? 'records' : `${usage.records} existing record${usage.records === 1 ? '' : 's'}`}{' '}
            stay on the version they were assessed under.
          </p>
          <div className="field">
            <label htmlFor="pub-note">What changed, and why</label>
            <textarea
              id="pub-note"
              value={note}
              autoFocus
              placeholder="Added a capnography criterion; reworded step 4 to match the new pump."
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="help-text">
              This is the whole version history. Somebody reading it in two years has only this
              sentence to tell them why the sheet changed.
            </div>
          </div>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button
              className="btn primary"
              disabled={note.trim().length < 4}
              onClick={() => {
                const res = publishDraft(kind, templateId, actor, note)
                if (!res.ok) {
                  notifyUser(res.refused ?? 'Could not publish.', 'crit')
                  return
                }
                setPublishing(false)
                setNote('')
                notifyUser(`Published version ${res.version}.`)
                onClose()
              }}
            >
              Publish
            </button>
            <button className="btn" onClick={() => setPublishing(false)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
