import { KC_BRIEFING, KC_BRIEFING_INTRO, KC_BRIEFING_TITLE } from '../../data/kcOperation'

// The realistic job preview a NEOP candidate reads immediately before starting.
//
// It is on the same page as the Start button, and untimed — the clock does not
// start until they press it. That is deliberate: the operations section of the
// exam is comprehension of this document, so time spent reading it must not be
// time taken off the exam. A candidate who reads it twice should be at an
// advantage, because a candidate who reads it twice is telling us something.

export default function KcBriefing() {
  return (
    <div className="card brief">
      <h2 style={{ marginTop: 0 }}>{KC_BRIEFING_TITLE}</h2>
      <p className="brief-intro">{KC_BRIEFING_INTRO}</p>
      {KC_BRIEFING.map((s) => (
        <section key={s.ref} className="brief-section">
          <h3>{s.title}</h3>
          {s.blocks.map((b, i) =>
            typeof b === 'string' ? (
              <p key={i}>{b}</p>
            ) : (
              <ul key={i}>
                {b.list.map((li, j) => (
                  <li key={j}>{li}</li>
                ))}
              </ul>
            ),
          )}
        </section>
      ))}
    </div>
  )
}
