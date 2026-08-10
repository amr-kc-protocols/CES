import { useState } from 'react'
import { Empty, Modal } from '../../components/ui'
import { Tabs, tabPanelProps } from '../../components/Tabs'
import { confirmAction, notifyUser } from '../../lib/dialog'
import { useCan } from '../../lib/role'
import { useSyncStatus } from '../../lib/sync'
import {
  bundledBody,
  createTemplate,
  deleteTemplate,
  resolveCurrent,
  setArchived,
  useTemplateList,
} from '../../lib/templates'
import { useTemplateUsage } from './usage'
import TemplateEditor from './TemplateEditor'
import type { TemplateKind } from '../../types'

// ---------------------------------------------------------------------------
// Admin home for the editable instruments.
//
// Everything an operation grades on lives here: the AEMT psychomotor sheets,
// the AEMT evaluation forms, the academy check-off sheets, and the FTO daily
// evaluation. Editing any of them used to mean a code change and a deploy.
// ---------------------------------------------------------------------------

const KINDS: { id: TemplateKind; label: string; blurb: string }[] = [
  {
    id: 'aemt-skill',
    label: 'AEMT skill sheets',
    blurb:
      'Psychomotor check-off sheets. Sign-offs on these are the K.A.R. 109-11-8(a)(2) competency record and gate course completion, so every edit is versioned and past assessments keep the wording they were graded on.',
  },
  {
    id: 'aemt-form',
    label: 'AEMT evaluation forms',
    blurb:
      'The preceptor daily evaluation, the affective evaluation, and the end-of-course instruments. Two questions — remediation and behaviour concern — feed the completion readiness check; the editor warns if an edit would remove them.',
  },
  {
    id: 'neop-skill',
    label: 'Academy check-off sheets',
    blurb:
      'New-hire clinical and equipment sheets. Skills can be scoped to particular operations, so one sheet can cover several without showing everyone everything.',
  },
  {
    id: 'neop-daily-eval',
    label: 'FTO daily evaluation',
    blurb:
      'The end-of-shift performance evaluation. Its rating categories used to be fixed in code; they are editable now, and shift-over-shift averages follow whatever categories are in force.',
  },
]

function NewTemplateModal({
  kind,
  actor,
  onClose,
  onCreated,
}: {
  kind: TemplateKind
  actor: string
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const list = useTemplateList(kind)
  const [title, setTitle] = useState('')
  const [id, setId] = useState('')
  const [from, setFrom] = useState('')

  const suggested = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const finalId = (id.trim() || suggested).replace(/[^a-z0-9-]+/g, '-')

  return (
    <Modal title="New instrument" onClose={onClose}>
      <div className="field">
        <label htmlFor="nt-title">Title</label>
        <input
          id="nt-title"
          value={title}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Mechanical CPR — Auto Pulse"
        />
      </div>
      <div className="field">
        <label htmlFor="nt-id">Id</label>
        <input
          id="nt-id"
          value={id}
          placeholder={suggested || 'auto-pulse'}
          onChange={(e) => setId(e.target.value)}
        />
        <div className="help-text">
          Permanent. Every assessment recorded against this instrument is stored under it, so it
          cannot be changed later without orphaning them. Leave it blank to use{' '}
          <code>{suggested || '—'}</code>.
        </div>
      </div>
      <div className="field">
        <label htmlFor="nt-from">Start from</label>
        <select id="nt-from" value={from} onChange={(e) => setFrom(e.target.value)}>
          <option value="">An empty instrument</option>
          {list.map((t) => (
            <option key={t.templateId} value={t.templateId}>
              A copy of {t.label}
            </option>
          ))}
        </select>
      </div>
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          className="btn primary"
          disabled={!title.trim() || !finalId}
          onClick={() => {
            const source = from ? resolveCurrent<Record<string, unknown>>(kind, from) : undefined
            const body = source
              ? { ...JSON.parse(JSON.stringify(source)), id: finalId, title: title.trim(), label: title.trim() }
              : blankBody(kind, finalId, title.trim())
            const res = createTemplate(kind, finalId, body, actor)
            if (!res.ok) {
              notifyUser(res.refused ?? 'Could not create it.', 'crit')
              return
            }
            onCreated(finalId)
            onClose()
          }}
        >
          Create draft
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}

function blankBody(kind: TemplateKind, id: string, title: string): unknown {
  if (kind === 'aemt-skill') {
    return {
      id,
      title,
      levelLabel: 'AEMT',
      levels: ['aemt'],
      sections: [{ title: 'Performance criteria', criteria: [] }],
      criticalFailures: [],
    }
  }
  if (kind === 'aemt-form') {
    return {
      id,
      title,
      subtitle: '',
      completedBy: '',
      cadence: 'shift',
      sections: [{ title: 'Section 1', fields: [] }],
    }
  }
  if (kind === 'neop-skill') {
    return { label: title, short: title.slice(0, 12), icon: '📋', skills: [] }
  }
  return {
    id,
    title,
    categories: [],
    checks: [],
    texts: [],
    readinessLabel: 'Ready to work independently without an FTO',
  }
}

function KindPanel({ kind, actor }: { kind: TemplateKind; actor: string }) {
  const list = useTemplateList(kind)
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const meta = KINDS.find((k) => k.id === kind)!

  if (editing) {
    return (
      <TemplateEditor kind={kind} templateId={editing} actor={actor} onClose={() => setEditing(null)} />
    )
  }

  const visible = list.filter((t) => showArchived || !t.archived)
  const archivedCount = list.filter((t) => t.archived).length
  const groups = [...new Set(visible.map((t) => t.group ?? ''))]

  return (
    <div>
      <div className="banner info">{meta.blurb}</div>

      <div className="toolbar" style={{ marginTop: 12 }}>
        <span className="subtle">
          {visible.length} instrument{visible.length === 1 ? '' : 's'}
          {list.some((t) => t.hasDraft) &&
            ` · ${list.filter((t) => t.hasDraft).length} with an unpublished draft`}
        </span>
        <div className="spacer" />
        {archivedCount > 0 && (
          <button className="link-btn" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? 'Hide' : `Show ${archivedCount} hidden`}
          </button>
        )}
        <button className="btn sm primary" onClick={() => setCreating(true)}>
          + New
        </button>
      </div>

      {visible.length === 0 ? (
        <Empty icon="📋" title="Nothing here yet">
          Create the first instrument for this operation.
        </Empty>
      ) : (
        groups.map((g) => (
          <div key={g}>
            {g && <div className="section-title">{g}</div>}
            <div className="list">
              {visible
                .filter((t) => (t.group ?? '') === g)
                .map((t) => (
                  <TemplateRow
                    key={t.templateId}
                    kind={kind}
                    actor={actor}
                    summary={t}
                    onEdit={() => setEditing(t.templateId)}
                  />
                ))}
            </div>
          </div>
        ))
      )}

      {creating && (
        <NewTemplateModal
          kind={kind}
          actor={actor}
          onClose={() => setCreating(false)}
          onCreated={(id) => setEditing(id)}
        />
      )}
    </div>
  )
}

function TemplateRow({
  kind,
  actor,
  summary,
  onEdit,
}: {
  kind: TemplateKind
  actor: string
  summary: ReturnType<typeof useTemplateList>[number]
  onEdit: () => void
}) {
  const usage = useTemplateUsage(kind, summary.templateId)
  const isBundled = !!bundledBody(kind, summary.templateId)

  return (
    <div className={`row left-accent ${summary.archived ? '' : summary.hasDraft ? 'acc-warn' : ''}`}>
      <div className="grow">
        <div className="title">
          {summary.label}
          {summary.hasDraft && (
            <span className="pill warn" style={{ marginLeft: 8 }}>
              draft
            </span>
          )}
          {summary.archived && (
            <span className="pill muted" style={{ marginLeft: 8 }}>
              hidden
            </span>
          )}
          {summary.custom && (
            <span className="pill info" style={{ marginLeft: 8 }}>
              custom
            </span>
          )}
        </div>
        <div className="meta">
          {summary.version === 0 ? 'As shipped' : `Version ${summary.version}`}
          {summary.revisions > 0 && ` · ${summary.revisions} revision${summary.revisions === 1 ? '' : 's'}`}
          {usage.records > 0
            ? ` · ${usage.records} record${usage.records === 1 ? '' : 's'} assessed`
            : ' · nothing assessed yet'}
        </div>
        {usage.versionsInUse.length > 1 && (
          <div className="meta">
            Records exist against version{usage.versionsInUse.length === 2 ? 's' : 's'}{' '}
            {usage.versionsInUse.map((v) => (v === 0 ? 'as-shipped' : v)).join(', ')} — each renders
            against its own.
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button className="btn sm" onClick={onEdit}>
          Edit
        </button>
        <button
          className="btn sm"
          onClick={async () => {
            const ok = await confirmAction({
              title: summary.archived ? `Show ${summary.label} again?` : `Hide ${summary.label}?`,
              body: summary.archived
                ? 'It reappears wherever this kind of instrument is used.'
                : 'It stops appearing for new assessments. Records already made against it keep rendering — hiding is not deleting, because those records still need their sheet.',
              confirmLabel: summary.archived ? 'Show it' : 'Hide it',
              danger: !summary.archived,
            })
            if (ok) setArchived(kind, summary.templateId, !summary.archived, actor)
          }}
        >
          {summary.archived ? 'Show' : 'Hide'}
        </button>
        {!isBundled && usage.deletable && (
          <button
            className="btn sm danger"
            onClick={async () => {
              const ok = await confirmAction({
                title: `Delete ${summary.label}?`,
                body: 'Nothing has been assessed against it, so nothing points at it. Undo is offered afterwards.',
                confirmLabel: 'Delete',
              })
              if (ok) deleteTemplate(kind, summary.templateId, summary.label)
            }}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  )
}

export default function TemplatesView() {
  const { manageAcademy } = useCan()
  const { email } = useSyncStatus()
  const [tab, setTab] = useState<TemplateKind>('aemt-skill')

  if (!manageAcademy) {
    return (
      <Empty icon="🔒" title="Administrators only">
        Skill sheets and evaluation forms are the instruments every assessment is recorded against,
        so editing them is limited to administrators.
      </Empty>
    )
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Sheets &amp; forms</h1>
          <div className="subtle">
            Edit any skill sheet or evaluation form for your operation. Changes are versioned —
            assessments already recorded keep the wording they were graded against.
          </div>
        </div>
      </div>

      <Tabs
        idPrefix="tpl"
        label="Instrument type"
        style={{ marginTop: 12 }}
        tabs={KINDS.map((k) => ({ id: k.id, label: k.label }))}
        value={tab}
        onChange={(t) => setTab(t as TemplateKind)}
      />

      <div style={{ marginTop: 14 }} {...tabPanelProps('tpl', tab)}>
        <KindPanel kind={tab} actor={email ?? 'local'} />
      </div>
    </div>
  )
}
