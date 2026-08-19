import { HubHead, HubLocked, HubRow, itemAt } from './SectionHub'
import { useSection } from '../../lib/nav'
import { activeMarket, marketName } from '../../lib/market'
import { COURSE_BLOCKS, PRACTICE_ITEMS } from '../../data/learningBlocks'
import { HOW_TO_GUIDES } from '../../data/howTo'
import { REF_DOCS, defaultView } from '../../data/emsReference'

// Both destinations are static catalogues, so there is no activity to report —
// what changes for the reader is how much is in each, and which state's rules
// the regulations screen opens on. That last one is a live fact about this
// device and the reason a Kansas medic and a Missouri medic see different
// pages behind the same tap.

const VIEW_LABEL = { ks: 'Kansas first', mo: 'Missouri first', both: 'both states' } as const

export default function ReferenceHub() {
  const section = useSection('/reference')
  const market = activeMarket()

  const courses = itemAt(section, '/courses')
  const regs = itemAt(section, '/ems')
  const modules = COURSE_BLOCKS.reduce((n, b) => n + b.items.length, 0) + PRACTICE_ITEMS.length

  if (!section) return <HubLocked title="Nothing here" why="Reference material is not available to this account." />

  return (
    <div>
      <HubHead section={section} />
      <div className="list">
        {courses && (
          <HubRow
            item={courses}
            meta={`${modules} modules across ${COURSE_BLOCKS.length} blocks · ${HOW_TO_GUIDES.length} how-tos`}
          />
        )}
        {regs && (
          <HubRow
            item={regs}
            meta={`${REF_DOCS.length} source documents · opens on ${VIEW_LABEL[defaultView(market)]} for ${marketName(market)}`}
          />
        )}
      </div>
    </div>
  )
}
