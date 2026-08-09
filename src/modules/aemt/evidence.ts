import { RULE_SETS } from '../../data/aemt'
import type { AuditPackageInput } from './auditPackage'

// ---------------------------------------------------------------------------
// Evidence bundle and its fingerprint.
//
// An honest limit first: a browser cannot produce an unalterable file. Anyone
// with the exported HTML can edit it, and no amount of styling changes that.
// What CAN be made defensible is TAMPER-EVIDENCE — a hash over the underlying
// records, printed in the packet and written to the append-only audit trail at
// the moment of export. A packet whose hash does not match the log entry, or
// whose contents do not rehash to the value it carries, is not the packet that
// was generated. That is a claim an auditor can actually check.
//
// The bundle is also the machine-readable half of the export: the printed
// packet is for reading, the JSON is for verifying.
// ---------------------------------------------------------------------------

/**
 * Stable stringify — key order must not depend on object construction.
 *
 * Keys holding `undefined` are skipped, because JSON.stringify drops them and
 * the downloaded bundle is what a verifier re-hashes. Serialising them as null
 * here made the printed fingerprint unreproducible for any course that had ever
 * had an attestation withdrawn or a sign-off revoked — both of those write
 * `undefined` over a field rather than deleting it — which is precisely the
 * check the packet tells an auditor to perform.
 */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null)
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(',')}}`
}

export interface EvidenceBundle {
  /** What was exported, and under which rules. */
  meta: {
    generatedAt: string
    generatedBy: string
    courseId: string
    courseLabel: string
    appVersion: string
    ruleSets: typeof RULE_SETS
  }
  /** Record counts, so a truncated packet is obvious. */
  manifest: { record: string; count: number }[]
  records: Record<string, unknown>
}

const APP_VERSION = 'CES AEMT module — evidence schema 1'

export function buildEvidenceBundle(d: AuditPackageInput, actor: string): EvidenceBundle {
  const records: Record<string, unknown> = {
    course: d.course,
    students: d.students,
    sessions: d.sessions,
    attendance: d.attendance,
    shifts: d.shifts,
    encounters: d.encounters,
    skillChecks: d.skillChecks,
    formResponses: d.forms,
    completions: d.completions,
    deadlines: d.deadlines,
    recordDocs: d.recordDocs,
    audit: d.audit,
  }
  return {
    meta: {
      generatedAt: new Date().toISOString(),
      generatedBy: actor,
      courseId: d.course.id,
      courseLabel: d.course.label,
      appVersion: APP_VERSION,
      ruleSets: RULE_SETS,
    },
    manifest: Object.entries(records).map(([record, v]) => ({
      record,
      count: Array.isArray(v) ? v.length : 1,
    })),
    records,
  }
}

/**
 * SHA-256 of the canonical bundle, hex. Web Crypto is available in every
 * browser this app supports and needs no dependency; on a context without it
 * (an insecure origin) this returns null rather than a fake digest, and the
 * packet says the fingerprint is unavailable instead of implying one.
 */
export async function bundleHash(bundle: EvidenceBundle): Promise<string | null> {
  // The hash covers the records, not the generation timestamp — otherwise two
  // exports of identical evidence would disagree and the value would prove
  // nothing about the evidence itself.
  const payload = canonical({ records: bundle.records, ruleSets: bundle.meta.ruleSets })
  if (!globalThis.crypto?.subtle) return null
  const bytes = new TextEncoder().encode(payload)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Grouped for the eye — full hex is unreadable and mistranscribed. */
export function formatHash(hex: string | null): string {
  if (!hex) return 'unavailable (no Web Crypto in this context)'
  return hex.toUpperCase().match(/.{1,8}/g)!.join(' ')
}

export function downloadJSON(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.json') ? filename : `${filename}.json`
  // Attached and revoked on a later tick: a detached anchor and a synchronous
  // revoke race the download in Firefox and Safari, and this is the half of the
  // packet the fingerprint is checked against.
  a.style.display = 'none'
  document.body.append(a)
  a.click()
  setTimeout(() => {
    URL.revokeObjectURL(url)
    a.remove()
  }, 0)
}
