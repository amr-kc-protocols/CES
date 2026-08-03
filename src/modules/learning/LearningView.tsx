import { useState } from 'react'
import { Link } from 'react-router-dom'
import { COURSE_BLOCKS, PRACTICE_ITEMS, KIND_META, type LearningItem } from '../../data/learningBlocks'
import { HOW_TO_GUIDES, type HowToGuide } from '../../data/howTo'
import { resourceFor, resourceUrl } from '../../data/fieldGuide'

// Self-study course library: online modules that back up the hands-on academy
// days. Courses open in the in-app viewer (with a back bar) rather than a raw
// new tab, so there's always a way back. Nothing to sign in for.

// Files the browser can't render inside an iframe (Office docs, PDFs) must
// open directly instead of going through the in-app viewer.
const DOWNLOADABLE = /\.(pptx?|pdf|xlsx?|docx?|csv)$/i

function ItemLink({ item }: { item: LearningItem }) {
  const r = resourceFor(item.ref)
  const url = resourceUrl(item.ref)
  if (!r || !url) return null
  const meta = KIND_META[item.kind]
  const rowStyle = { color: 'inherit', textDecoration: 'none', alignItems: 'center', gap: 10 } as const

  if (DOWNLOADABLE.test(url)) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="row" style={rowStyle}>
        <span style={{ fontSize: 18 }}>{meta.icon}</span>
        <span className="grow">{r.label}</span>
        <span className="pill muted">{meta.label}</span>
        <span className="subtle" aria-hidden>↓</span>
      </a>
    )
  }

  return (
    <Link
      to={`/courses/view?ref=${encodeURIComponent(item.ref)}`}
      className="row"
      style={rowStyle}
    >
      <span style={{ fontSize: 18 }}>{meta.icon}</span>
      <span className="grow">{r.label}</span>
      <span className="pill muted">{meta.label}</span>
      <span className="subtle" aria-hidden>›</span>
    </Link>
  )
}

/**
 * One how-to, collapsed by default. Someone opens this page knowing which
 * thing they are stuck on, so showing every step of every guide at once buries
 * the one they came for.
 */
function Guide({ guide }: { guide: HowToGuide }) {
  const [open, setOpen] = useState(false)
  const panelId = `howto-${guide.id}`

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          width: '100%',
          padding: 14,
          background: 'none',
          border: 0,
          textAlign: 'left',
          font: 'inherit',
        }}
      >
        <span style={{ fontSize: 22, lineHeight: 1 }}>{guide.icon}</span>
        <span className="grow">
          <span style={{ display: 'block', fontWeight: 700, fontSize: 16 }}>{guide.title}</span>
          <span className="subtle" style={{ display: 'block', fontSize: 13, lineHeight: 1.5 }}>
            {guide.summary}
          </span>
        </span>
        <span className="subtle" aria-hidden style={{ fontSize: 18 }}>
          {open ? '−' : '+'}
        </span>
      </button>

      {open && (
        <div id={panelId} style={{ padding: '0 14px 14px' }}>
          {guide.before && (
            <div className="list" style={{ marginBottom: 10 }}>
              {guide.before.map((b) => (
                <div key={b.label} className="row">
                  <div className="grow">
                    <div className="meta">{b.label}</div>
                    <div className="title" style={{ fontSize: 14, wordBreak: 'break-word' }}>
                      {b.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <ol style={{ paddingLeft: 20, margin: 0, lineHeight: 1.55 }}>
            {guide.steps.map((step) => (
              <li key={step.title} style={{ marginBottom: 10 }}>
                <strong>{step.title}</strong>
                <ul style={{ paddingLeft: 18, margin: '4px 0 0' }}>
                  {step.detail.map((d) => (
                    <li key={d} className="subtle" style={{ fontSize: 13 }}>
                      {d}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>

          {guide.quickPath && (
            <div className="banner info" style={{ marginTop: 10 }}>
              <strong>Quick path.</strong> {guide.quickPath}
            </div>
          )}

          {guide.gotchas && (
            <>
              <div className="section-title">If it does not work</div>
              <ul style={{ paddingLeft: 20, margin: 0, lineHeight: 1.55 }}>
                {guide.gotchas.map((g) => (
                  <li key={g} className="subtle" style={{ fontSize: 13, marginBottom: 6 }}>
                    {g}
                  </li>
                ))}
              </ul>
            </>
          )}

          {guide.caution && (
            <div className="banner warn" style={{ marginTop: 10 }}>
              {guide.caution}
            </div>
          )}

          {guide.escalation && (
            <div className="help-text">Still stuck? {guide.escalation}</div>
          )}
        </div>
      )}
    </div>
  )
}

export default function LearningView() {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Resources</h1>
          <div className="subtle">How-to guides, and the self-study courses behind the class days</div>
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 6 }}>
        How-to guides
      </div>
      <div className="help-text" style={{ marginTop: 0 }}>
        The systems everyone has to use and nobody uses often. Tap one to open the steps.
      </div>
      <div className="list" style={{ gap: 10 }}>
        {HOW_TO_GUIDES.map((g) => (
          <Guide key={g.id} guide={g} />
        ))}
      </div>

      <div className="section-title">Self-study courses</div>
      <div className="banner info">
        Full courses for the class days that have one. Work through the modules before the day to
        come in ready, or after to fill any gaps. Links open in a new tab — no sign-in needed.
      </div>

      <div className="list" style={{ gap: 12, marginTop: 12 }}>
        {COURSE_BLOCKS.map((block) => (
          <div key={block.id} className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 22 }}>{block.icon}</span>
              <h2 style={{ margin: 0, fontSize: 17 }}>{block.title}</h2>
            </div>
            <div className="subtle" style={{ fontSize: 12, fontWeight: 700, margin: '4px 0 8px' }}>
              Supports: {block.supports}
            </div>
            <p className="subtle" style={{ margin: '0 0 10px', lineHeight: 1.5 }}>{block.summary}</p>
            <div className="list" style={{ gap: 6 }}>
              {block.items.map((item) => (
                <ItemLink key={item.ref} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="section-title">Practice &amp; self-study</div>
      <div className="card" style={{ padding: 14 }}>
        <p className="subtle" style={{ marginTop: 0, marginBottom: 10 }}>
          Not tied to a day — drill these any time to stay sharp.
        </p>
        <div className="list" style={{ gap: 6 }}>
          {PRACTICE_ITEMS.map((item) => (
            <ItemLink key={item.ref} item={item} />
          ))}
        </div>
      </div>
    </div>
  )
}
