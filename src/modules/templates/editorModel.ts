import type { AemtSkillSheet } from '../../data/aemtSkills'
import type { AemtFormDef, FieldKind } from '../../data/aemtForms'
import type { SkillDef } from '../../data/skillSheets'
import type { DailyEvalTemplate, TemplateKind } from '../../types'

// ---------------------------------------------------------------------------
// One shape the editor can render, and the translations to and from the four
// real instrument formats.
//
// The alternative was four editors. These instruments genuinely are the same
// thing underneath — a titled document, of titled groups, of labelled rows —
// and the differences that matter (a criterion has no answer type, a form field
// does; a skill sheet has critical-failure criteria, nothing else does) fit as
// optional properties. What each row means is carried by `rowKind` so the
// editor can label and validate honestly rather than calling everything a
// "field".
// ---------------------------------------------------------------------------

export type RowKind =
  /** AEMT skill criterion, or a NEOP skill line. Pass/fail, no answer type. */
  | 'criterion'
  /** An evaluation-form field, which has an answer type. */
  | 'field'
  /** A 1–5 rating row on the daily evaluation. */
  | 'rating'
  /** A yes/no confirmation on the daily evaluation. */
  | 'check'
  /** A free-text prompt on the daily evaluation. */
  | 'text'

export interface EditorRow {
  id: string
  label: string
  rowKind: RowKind
  /** 'field' rows only. */
  kind?: FieldKind
  help?: string
  scale?: { min: number; max: number; minLabel: string; maxLabel: string }
  /** NEOP skill lines that are checked off step by step. */
  steps?: string[]
  /** NEOP skills scoped to particular operations. */
  ops?: string[]
}

export interface EditorGroup {
  title: string
  help?: string
  rows: EditorRow[]
}

export interface EditorDoc {
  templateId: string
  title: string
  /** Sub-heading, where the instrument has one. */
  subtitle?: string
  /** Who completes it — forms and sheets both print this. */
  completedBy?: string
  groups: EditorGroup[]
  /** AEMT skill sheets: any one of these fails the sheet outright. */
  criticalFailures?: string[]
  /** A reminder printed on the sheet. */
  note?: string
  /** Carried through untouched so an edit never drops what it does not show. */
  passthrough: Record<string, unknown>
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

/** A stable, readable id from a label — only used for rows the admin adds. */
export function slugId(label: string, taken: Set<string>): string {
  const base =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'item'
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

export function allRowIds(doc: EditorDoc): Set<string> {
  return new Set(doc.groups.flatMap((g) => g.rows.map((r) => r.id)))
}

// ----- in ---------------------------------------------------------------------

export function toEditor(kind: TemplateKind, templateId: string, body: unknown): EditorDoc {
  if (kind === 'aemt-skill') {
    const s = body as AemtSkillSheet
    const { sections, criticalFailures, title, id, ...rest } = s
    return {
      templateId,
      title,
      subtitle: s.levelLabel,
      groups: sections.map((sec) => ({
        title: sec.title,
        rows: sec.criteria.map((c) => ({ id: c.id, label: c.label, rowKind: 'criterion' as const })),
      })),
      criticalFailures: [...(criticalFailures ?? [])],
      passthrough: clone(rest) as Record<string, unknown>,
    }
  }

  if (kind === 'aemt-form') {
    const f = body as AemtFormDef
    const { sections, title, subtitle, completedBy, id, ...rest } = f
    return {
      templateId,
      title,
      subtitle,
      completedBy,
      groups: sections.map((sec) => ({
        title: sec.title,
        help: sec.help,
        rows: sec.fields.map((fl) => ({
          id: fl.id,
          label: fl.label,
          rowKind: 'field' as const,
          kind: fl.kind,
          help: fl.help,
          scale: fl.scale,
        })),
      })),
      passthrough: clone(rest) as Record<string, unknown>,
    }
  }

  if (kind === 'neop-skill') {
    const m = body as { label: string; short: string; icon: string; note?: string; skills: SkillDef[] }
    const { skills, label, note, ...rest } = m
    return {
      templateId,
      title: label,
      note,
      groups: [
        {
          title: 'Skills',
          rows: skills.map((sk) => ({
            id: sk.id,
            label: sk.label,
            rowKind: 'criterion' as const,
            steps: sk.steps ? [...sk.steps] : undefined,
            ops: sk.ops ? [...sk.ops] : undefined,
          })),
        },
      ],
      passthrough: clone(rest) as Record<string, unknown>,
    }
  }

  const d = body as DailyEvalTemplate
  return {
    templateId,
    title: d.title,
    subtitle: d.readinessLabel,
    groups: [
      {
        title: 'Ratings (1–5)',
        rows: d.categories.map((c) => ({ id: c.id, label: c.label, rowKind: 'rating' as const })),
      },
      {
        title: 'Confirmations',
        rows: d.checks.map((c) => ({ id: c.id, label: c.label, rowKind: 'check' as const })),
      },
      {
        title: 'Comments',
        rows: d.texts.map((t) => ({ id: t.id, label: t.label, rowKind: 'text' as const })),
      },
    ],
    passthrough: {},
  }
}

// ----- out --------------------------------------------------------------------

export function fromEditor(kind: TemplateKind, doc: EditorDoc): unknown {
  if (kind === 'aemt-skill') {
    return {
      ...doc.passthrough,
      id: doc.templateId,
      title: doc.title,
      levelLabel: doc.subtitle ?? '',
      sections: doc.groups.map((g) => ({
        title: g.title,
        criteria: g.rows.map((r) => ({ id: r.id, label: r.label })),
      })),
      criticalFailures: doc.criticalFailures ?? [],
    }
  }

  if (kind === 'aemt-form') {
    return {
      ...doc.passthrough,
      id: doc.templateId,
      title: doc.title,
      subtitle: doc.subtitle ?? '',
      completedBy: doc.completedBy ?? '',
      sections: doc.groups.map((g) => ({
        title: g.title,
        help: g.help,
        fields: g.rows.map((r) => ({
          id: r.id,
          label: r.label,
          kind: r.kind ?? 'text',
          ...(r.help ? { help: r.help } : {}),
          ...(r.kind === 'scale' ? { scale: r.scale ?? { min: 1, max: 5, minLabel: 'needs work', maxLabel: 'excellent' } } : {}),
        })),
      })),
    }
  }

  if (kind === 'neop-skill') {
    return {
      ...doc.passthrough,
      label: doc.title,
      ...(doc.note ? { note: doc.note } : {}),
      skills: doc.groups.flatMap((g) =>
        g.rows.map((r) => ({
          id: r.id,
          label: r.label,
          ...(r.steps?.length ? { steps: r.steps } : {}),
          ...(r.ops?.length ? { ops: r.ops } : {}),
        })),
      ),
    }
  }

  const byKind = (k: RowKind) => doc.groups.flatMap((g) => g.rows.filter((r) => r.rowKind === k))
  return {
    id: doc.templateId,
    title: doc.title,
    categories: byKind('rating').map((r) => ({ id: r.id, label: r.label })),
    checks: byKind('check').map((r) => ({ id: r.id, label: r.label })),
    texts: byKind('text').map((r) => ({ id: r.id, label: r.label })),
    readinessLabel: doc.subtitle ?? 'Ready to work independently without an FTO',
  }
}

/** Which row kinds an instrument of this kind may contain. */
export function allowedRowKinds(kind: TemplateKind): RowKind[] {
  if (kind === 'aemt-form') return ['field']
  if (kind === 'neop-daily-eval') return ['rating', 'check', 'text']
  return ['criterion']
}

export const ROW_KIND_LABEL: Record<RowKind, string> = {
  criterion: 'Criterion',
  field: 'Question',
  rating: 'Rating (1–5)',
  check: 'Yes / no',
  text: 'Free text',
}

export const FIELD_KINDS: { value: FieldKind; label: string }[] = [
  { value: 'scale', label: 'Rating scale' },
  { value: 'yesno', label: 'Yes / no' },
  { value: 'text', label: 'Short text' },
  { value: 'longtext', label: 'Long text' },
  { value: 'number', label: 'Number' },
]

// ----- validation --------------------------------------------------------------

export interface DocProblem {
  /** Blocks publishing. A warning does not. */
  blocking: boolean
  text: string
}

export function validateDoc(kind: TemplateKind, doc: EditorDoc): DocProblem[] {
  const out: DocProblem[] = []
  if (!doc.title.trim()) out.push({ blocking: true, text: 'The instrument needs a title.' })

  const rows = doc.groups.flatMap((g) => g.rows)
  if (rows.length === 0) {
    out.push({ blocking: true, text: 'There is nothing on this instrument to assess.' })
  }

  const seen = new Map<string, number>()
  for (const r of rows) seen.set(r.id, (seen.get(r.id) ?? 0) + 1)
  for (const [id, n] of seen) {
    if (n > 1) {
      out.push({
        blocking: true,
        // Records are keyed by row id, so a duplicate makes two different
        // answers indistinguishable in storage.
        text: `Two rows share the id "${id}". Answers are stored against the id, so they would overwrite each other.`,
      })
    }
  }

  for (const r of rows) {
    if (!r.label.trim()) {
      out.push({ blocking: true, text: `A row in "${doc.groups.find((g) => g.rows.includes(r))?.title ?? 'a group'}" has no wording.` })
    }
  }
  for (const g of doc.groups) {
    if (!g.title.trim()) out.push({ blocking: true, text: 'Every group needs a heading.' })
  }

  if (kind === 'aemt-form') {
    // The completion readiness gate reads these two ids by name.
    const ids = new Set(rows.map((r) => r.id))
    if (doc.templateId === 'clinical-daily' && !ids.has('remedial')) {
      out.push({
        blocking: false,
        text: 'This form no longer has a "remedial" question. That is the field the completion readiness check watches for remediation — without it, a flagged concern can never be raised from this form.',
      })
    }
    if (doc.templateId === 'affective' && !ids.has('concernRaised')) {
      out.push({
        blocking: false,
        text: 'This form no longer has a "concernRaised" question. That is the field the completion readiness check watches for behaviour conferences.',
      })
    }
  }

  if (kind === 'neop-daily-eval') {
    if (!rows.some((r) => r.rowKind === 'rating')) {
      out.push({ blocking: false, text: 'No rating rows, so shift-over-shift averages will have nothing to plot.' })
    }
  }

  return out
}
