import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { resourceFor, resourceUrl } from '../../data/fieldGuide'

// In-app viewer for a Courses-tab resource. Wraps the course page in an
// iframe under an app-level back bar so every course — ours or the external
// Field Guide ones — has a consistent way back. The "Open in new tab" link is
// a fallback for any page that refuses to be framed.
export default function CourseViewer() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [loaded, setLoaded] = useState(false)

  const ref = params.get('ref') || ''
  const r = resourceFor(ref)
  const url = resourceUrl(ref)

  if (!r || !url) {
    return (
      <div>
        <div className="backbar-course">
          <button className="btn ghost" onClick={() => navigate('/courses')}>‹ Courses</button>
        </div>
        <div className="banner warn" style={{ marginTop: 12 }}>
          That course couldn’t be found. Head back to the Courses list and try again.
        </div>
      </div>
    )
  }

  return (
    <div className="course-viewer">
      <div className="backbar-course">
        <button className="btn ghost" onClick={() => navigate('/courses')} aria-label="Back to Courses">
          ‹ Courses
        </button>
        <span className="cv-title" title={r.label}>{r.label}</span>
        <a className="btn ghost cv-ext" href={url} target="_blank" rel="noreferrer">
          Open in new tab ↗
        </a>
      </div>

      <div className="cv-frame-wrap">
        {!loaded && <div className="cv-loading subtle">Loading course…</div>}
        <iframe
          title={r.label}
          src={url}
          className="cv-frame"
          onLoad={() => setLoaded(true)}
          allow="fullscreen"
        />
      </div>

      <div className="subtle cv-hint">
        Trouble viewing? Use <strong>Open in new tab ↗</strong> above.
      </div>
    </div>
  )
}
