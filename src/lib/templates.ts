import { useMemo } from 'react'
import { getState, setState, useSelector } from './store'
import { uid } from './id'
import { pushUndo } from './undo'
import type { TemplateKind, TemplateStatus, TemplateVersion } from '../types'

// ---------------------------------------------------------------------------
// Versioned instrument registry.
//
// Skill sheets and evaluation forms shipped as code, so changing a criterion's
// wording for one operation meant a deploy. They are editable in-app now — but
// they cannot simply be mutated, because competency records point at them. A
// criterion renamed after somebody was graded against it silently changes what
// their assessment says they did, and for the AEMT sheets that assessment is a
// K.A.R. 109-11-8(a)(2) record retained three years.
//
// So editing publishes a NEW VERSION and leaves every prior one intact.
// Records pin the version they were assessed under and always render against
// it. This is the same rule the module already applies to a signature: what was
// signed does not change afterwards, and if it must, the change is visible.
//
// VERSION 0 IS THE BUNDLED DEFAULT. A record with no pin resolves to the
// definition shipped in src/data, so nothing written before this feature needs
// migrating and no copy of an unedited sheet is ever stored.
// ---------------------------------------------------------------------------

/**
 * The bundled definitions, registered by the data modules at import time.
 *
 * Injected rather than imported so this module stays generic: it knows how to
 * version and resolve a body, and nothing about what a skill sheet is. That
 * also keeps src/data free of a dependency on the store.
 */
export interface BundledTemplate<B = unknown> {
  templateId: string
  body: B
  /** Display name for the admin list, before any body-specific parsing. */
  label: string
  /** Grouping shown in the editor list, e.g. 'Advanced' or 'BLS'. */
  group?: string
}

const BUNDLED = new Map<TemplateKind, BundledTemplate[]>()

export function registerBundled(kind: TemplateKind, items: BundledTemplate[]): void {
  BUNDLED.set(kind, items)
}

export function bundledTemplates(kind: TemplateKind): BundledTemplate[] {
  return BUNDLED.get(kind) ?? []
}

export function bundledBody<B>(kind: TemplateKind, templateId: string): B | undefined {
  return BUNDLED.get(kind)?.find((t) => t.templateId === templateId)?.body as B | undefined
}

// ----- resolution ------------------------------------------------------------

function versionsFor(
  all: TemplateVersion[],
  kind: TemplateKind,
  templateId: string,
): TemplateVersion[] {
  return all
    .filter((t) => t.kind === kind && t.templateId === templateId)
    .sort((a, b) => a.version - b.version)
}

/** The version in force right now: highest published, or 0 for the default. */
export function currentVersionNumber(
  all: TemplateVersion[],
  kind: TemplateKind,
  templateId: string,
): number {
  const published = versionsFor(all, kind, templateId).filter((t) => t.status === 'published')
  return published.length ? published[published.length - 1].version : 0
}

/**
 * The definition to ASSESS against — the current published version, else the
 * bundled default. This is what a blank form or an ungraded sheet renders.
 */
export function resolveCurrent<B>(kind: TemplateKind, templateId: string): B | undefined {
  const all = getState().templates
  const v = currentVersionNumber(all, kind, templateId)
  if (v === 0) return bundledBody<B>(kind, templateId)
  return versionsFor(all, kind, templateId).find((t) => t.version === v)?.body as B | undefined
}

/**
 * The definition a RECORD was assessed against.
 *
 * Falls back to the bundled default for version 0 or absent, and — importantly
 * — falls back to the current definition rather than nothing if a pinned
 * version cannot be found. A record that outlives its version should render
 * with a warning, not vanish; callers get `exact: false` so they can say so.
 */
export function resolveAt<B>(
  kind: TemplateKind,
  templateId: string,
  version: number | undefined,
): { body?: B; exact: boolean; version: number } {
  const all = getState().templates
  if (!version) {
    const body = bundledBody<B>(kind, templateId)
    // A custom instrument has no version 0. An unpinned record against one can
    // only be shown against its current definition, and that is worth flagging.
    if (body) return { body, exact: true, version: 0 }
    const cur = currentVersionNumber(all, kind, templateId)
    return { body: resolveCurrent<B>(kind, templateId), exact: cur === 0, version: cur }
  }
  const hit = versionsFor(all, kind, templateId).find((t) => t.version === version)
  if (hit) return { body: hit.body as B, exact: true, version }
  return { body: resolveCurrent<B>(kind, templateId), exact: false, version }
}

// ----- react bindings --------------------------------------------------------

export function useTemplates(): TemplateVersion[] {
  return useSelector((db) => db.templates)
}

/** The current definition for one instrument, re-rendering when it is edited. */
export function useCurrentTemplate<B>(kind: TemplateKind, templateId: string): B | undefined {
  const all = useTemplates()
  return useMemo(() => {
    const v = currentVersionNumber(all, kind, templateId)
    if (v === 0) return bundledBody<B>(kind, templateId)
    return versionsFor(all, kind, templateId).find((t) => t.version === v)?.body as B | undefined
  }, [all, kind, templateId])
}

/** Every instrument of a kind, bundled and custom, with its current state. */
export interface TemplateSummary {
  templateId: string
  label: string
  group?: string
  /** 0 = running the bundled default. */
  version: number
  /** No bundled definition behind it — authored here. */
  custom: boolean
  /** Hidden from the surfaces that use this kind. */
  archived: boolean
  /** An unpublished draft exists on top of the current version. */
  hasDraft: boolean
  /** How many published revisions have been made. */
  revisions: number
}

export function useTemplateList(kind: TemplateKind): TemplateSummary[] {
  const all = useTemplates()
  return useMemo(() => {
    const ids = new Set<string>(bundledTemplates(kind).map((b) => b.templateId))
    for (const t of all) if (t.kind === kind) ids.add(t.templateId)

    return [...ids]
      .map((templateId) => {
        const mine = versionsFor(all, kind, templateId)
        const bundled = bundledTemplates(kind).find((b) => b.templateId === templateId)
        const version = currentVersionNumber(all, kind, templateId)
        const live = mine.find((t) => t.version === version)
        const body = (live?.body ?? bundled?.body) as { title?: string; label?: string } | undefined
        return {
          templateId,
          // Prefer the live body's own title so a renamed sheet lists renamed.
          label: body?.title ?? body?.label ?? bundled?.label ?? templateId,
          group: bundled?.group,
          version,
          custom: !bundled,
          // Hidden when the newest version is an archive marker — the same
          // test activeTemplateIds uses, so the list and the surfaces agree.
          archived: mine.length > 0 && mine[mine.length - 1].status === 'archived',
          hasDraft: mine.some((t) => t.status === 'draft'),
          revisions: mine.filter((t) => t.status === 'published').length,
        }
      })
      .sort((a, b) => (a.group ?? '').localeCompare(b.group ?? '') || a.label.localeCompare(b.label))
  }, [all, kind])
}

/** Full history for one instrument, newest first. */
export function useTemplateHistory(kind: TemplateKind, templateId: string): TemplateVersion[] {
  const all = useTemplates()
  return useMemo(
    () => versionsFor(all, kind, templateId).slice().reverse(),
    [all, kind, templateId],
  )
}

/** Instruments of a kind that surfaces should show — archived ones excluded. */
export function activeTemplateIds(kind: TemplateKind): string[] {
  const all = getState().templates
  const ids = new Set<string>(bundledTemplates(kind).map((b) => b.templateId))
  for (const t of all) if (t.kind === kind) ids.add(t.templateId)
  return [...ids].filter((id) => {
    const mine = versionsFor(all, kind, id)
    return !(mine.length && mine[mine.length - 1].status === 'archived')
  })
}

// ----- mutation --------------------------------------------------------------

function nextVersion(all: TemplateVersion[], kind: TemplateKind, templateId: string): number {
  const mine = versionsFor(all, kind, templateId)
  return mine.length ? mine[mine.length - 1].version + 1 : 1
}

/**
 * Save an edit as an unpublished draft. Nothing that assesses against this
 * instrument changes until it is published, so an admin can work on a sheet
 * across several sittings without a half-finished version reaching a student.
 */
export function saveDraft(
  kind: TemplateKind,
  templateId: string,
  body: unknown,
  actor: string,
  opts: { note?: string; custom?: boolean } = {},
): TemplateVersion {
  const all = getState().templates
  const existing = versionsFor(all, kind, templateId).find((t) => t.status === 'draft')
  const now = new Date().toISOString()

  const draft: TemplateVersion = existing
    ? { ...existing, body, note: opts.note ?? existing.note }
    : {
        id: uid('tpl'),
        kind,
        templateId,
        version: nextVersion(all, kind, templateId),
        status: 'draft',
        body,
        note: opts.note,
        createdAt: now,
        createdBy: actor,
        custom: opts.custom || !bundledBody(kind, templateId),
      }

  setState((db) => ({
    ...db,
    templates: existing
      ? db.templates.map((t) => (t.id === existing.id ? draft : t))
      : [...db.templates, draft],
  }))
  return draft
}

export function discardDraft(kind: TemplateKind, templateId: string): void {
  setState((db) => ({
    ...db,
    templates: db.templates.filter(
      (t) => !(t.kind === kind && t.templateId === templateId && t.status === 'draft'),
    ),
  }))
}

/**
 * Publish the draft. From this moment new assessments use it; every record
 * already pinned to an earlier version keeps rendering against that version.
 *
 * A note is required. "What changed and why" is the only part of a version
 * history that is worth anything to somebody reading it two years later, and
 * it is the part nobody writes unless asked.
 */
export function publishDraft(
  kind: TemplateKind,
  templateId: string,
  actor: string,
  note: string,
): { ok: boolean; refused?: string; version?: number } {
  const all = getState().templates
  const draft = versionsFor(all, kind, templateId).find((t) => t.status === 'draft')
  if (!draft) return { ok: false, refused: 'There is no draft to publish.' }
  if (note.trim().length < 4) {
    return { ok: false, refused: 'Say what changed — the note is what a later reader relies on.' }
  }
  const now = new Date().toISOString()
  setState((db) => ({
    ...db,
    templates: db.templates.map((t) =>
      t.id === draft.id
        ? { ...t, status: 'published' as TemplateStatus, publishedAt: now, publishedBy: actor, note: note.trim() }
        : t,
    ),
  }))
  return { ok: true, version: draft.version }
}

/**
 * Hide an instrument from the surfaces that use it.
 *
 * Archived rather than deleted, and prior versions stay: an operation that does
 * not run LUCAS should not see the sheet, but the records of everyone already
 * assessed on it still have to render.
 */
export function setArchived(
  kind: TemplateKind,
  templateId: string,
  archived: boolean,
  actor: string,
): void {
  const all = getState().templates
  const mine = versionsFor(all, kind, templateId)
  const now = new Date().toISOString()

  if (archived) {
    const body = resolveCurrent(kind, templateId)
    const marker: TemplateVersion = {
      id: uid('tpl'),
      kind,
      templateId,
      version: nextVersion(all, kind, templateId),
      status: 'archived',
      body,
      note: 'Hidden from this operation',
      createdAt: now,
      createdBy: actor,
      publishedAt: now,
      publishedBy: actor,
      custom: !bundledBody(kind, templateId),
    }
    setState((db) => ({ ...db, templates: [...db.templates, marker] }))
    return
  }

  // Un-archiving drops the trailing archive markers, exposing the published
  // version underneath — which is the version that was in force before.
  const trailing = new Set<string>()
  for (let i = mine.length - 1; i >= 0 && mine[i].status === 'archived'; i--) {
    trailing.add(mine[i].id)
  }
  setState((db) => ({ ...db, templates: db.templates.filter((t) => !trailing.has(t.id)) }))
}

/** Start a new instrument, optionally seeded from an existing one. */
export function createTemplate(
  kind: TemplateKind,
  templateId: string,
  body: unknown,
  actor: string,
): { ok: boolean; refused?: string } {
  const clean = templateId.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '')
  if (!clean) return { ok: false, refused: 'That id has no usable characters in it.' }
  const taken =
    bundledTemplates(kind).some((b) => b.templateId === clean) ||
    getState().templates.some((t) => t.kind === kind && t.templateId === clean)
  if (taken) return { ok: false, refused: `An instrument with the id "${clean}" already exists.` }

  saveDraft(kind, clean, body, actor, { custom: true, note: 'Created' })
  return { ok: true }
}

/**
 * Delete a custom instrument outright, with undo.
 *
 * Only ever offered for one nothing has been assessed against — the caller
 * checks that. A bundled instrument cannot be deleted at all; archiving is what
 * hides those, because the definition has to survive for old records.
 */
export function deleteTemplate(kind: TemplateKind, templateId: string, label: string): void {
  setState((db) => {
    const doomed = db.templates.filter((t) => t.kind === kind && t.templateId === templateId)
    if (doomed.length) {
      pushUndo(`Deleted ${label}`, () =>
        setState((cur) => ({ ...cur, templates: [...cur.templates, ...doomed] })),
      )
    }
    return {
      ...db,
      templates: db.templates.filter((t) => !(t.kind === kind && t.templateId === templateId)),
    }
  })
}
