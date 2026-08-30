import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Empty } from '../../components/ui'
import Icon from '../../components/Icon'
import type { NavItem, NavSection } from '../../lib/nav'

// ---------------------------------------------------------------------------
// Shared furniture for the four section landings.
//
// A section costs a tap that the old flat bar did not, so a landing has to be
// worth arriving at: each row carries the live state of what it leads to —
// how many cohorts are in session, when the last simulation ran — rather than
// repeating a label the tab already showed. Where a screen has no live state
// worth counting, its own blurb stands in; a fabricated number would be worse
// than a sentence.
// ---------------------------------------------------------------------------

export function HubHead({ section, children }: { section: NavSection; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{section.title}</h1>
        <div className="subtle">{section.blurb}</div>
      </div>
      {children ? <div className="btn-row">{children}</div> : null}
    </div>
  )
}

/**
 * One destination.
 *
 * `meta` is the live line; without one the item's own blurb is used, so a row
 * is never blank while a store is empty.
 */
export function HubRow({ item, meta, pill }: { item: NavItem; meta?: ReactNode; pill?: ReactNode }) {
  return (
    <Link to={item.to} className="row hub-row" style={{ color: 'inherit' }}>
      <span className="hub-icon">
        <Icon name={item.icon} size={1.25} />
      </span>
      <div className="grow">
        <div className="title">{item.label}</div>
        <div className="meta">{meta ?? item.blurb}</div>
      </div>
      {pill}
      <span className="hub-chevron" aria-hidden>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 5 7 7-7 7" />
        </svg>
      </span>
    </Link>
  )
}

/**
 * A section this account has nothing in.
 *
 * The tab is hidden in that case, so this is only reached by typing the URL or
 * following an old link — but it has to say something truthful when it is.
 */
export function HubLocked({ title, why }: { title: string; why: string }) {
  return (
    <div>
      <Empty icon="🔒" title={title}>
        {why}
      </Empty>
      <Link to="/" className="link-btn">
        ← Back to Home
      </Link>
    </div>
  )
}

/** Pulls one item out of a filtered section; undefined when it is gated off. */
export function itemAt(section: NavSection | undefined, to: string): NavItem | undefined {
  return section?.items.find((i) => i.to === to)
}
