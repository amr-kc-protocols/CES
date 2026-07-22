import { COURSE_BLOCKS, PRACTICE_ITEMS, KIND_META, type LearningItem } from '../../data/learningBlocks'
import { resourceFor, resourceUrl } from '../../data/fieldGuide'

// Self-study course library: online modules that back up the hands-on academy
// days. Everything links out to the Field Guide; nothing to sign in for.

function ItemLink({ item }: { item: LearningItem }) {
  const r = resourceFor(item.ref)
  const url = resourceUrl(item.ref)
  if (!r || !url) return null
  const meta = KIND_META[item.kind]
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="row"
      style={{ color: 'inherit', textDecoration: 'none', alignItems: 'center', gap: 10 }}
    >
      <span style={{ fontSize: 18 }}>{meta.icon}</span>
      <span className="grow">{r.label}</span>
      <span className="pill muted">{meta.label}</span>
      <span className="subtle" aria-hidden>↗</span>
    </a>
  )
}

export default function LearningView() {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Courses</h1>
          <div className="subtle">Online modules that back up the hands-on academy days</div>
        </div>
      </div>

      <div className="banner info">
        Full self-study courses for the days that have one. Work through the modules before the
        day to come in ready, or after to fill any gaps. Links open in a new tab — no sign-in
        needed.
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
