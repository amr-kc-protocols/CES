// Build the curriculum map and lesson plans as a .docx.
//
// The document is src/data/programDocs/curriculum.ts — the coverage map a KBEMS
// reviewer checks and the per-session plans an instructor reads at 0855. It
// lives in src/ because the app builds and retains the same document, and this
// script renders that tree to the file.
//
// Run: npm run doc:curriculum  [-- <output path>]
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { Document, Packer } from 'docx'
import { loadCourse, ROOT } from './lib/doc-kit.mjs'
import { footer, NUMBERING, PAGE, renderBlocks } from './lib/doc-render.mjs'

const outPath = resolve(process.argv[2] ?? join(ROOT, 'build', 'AEMT-Curriculum-and-Lesson-Plans-Oct2026.docx'))
const m = await loadCourse()
const blocks = m.DOCS.curriculumBlocks()

const doc = new Document({
  creator: 'AMR Kansas City — Clinical Education',
  title: m.DOCS.CURRICULUM_TITLE,
  description: 'Kansas AEMT Education Standards coverage map and per-session lesson plans',
  numbering: NUMBERING,
  sections: [
    {
      properties: { page: PAGE },
      footers: { default: footer('AEMT Curriculum and Lesson Plans — October 2026 cohort') },
      children: renderBlocks(blocks),
    },
  ],
})

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, await Packer.toBuffer(doc))
const sessions = m.KC_SCHEDULE.filter((r) => r.delivery === 'f2f' || r.delivery === 'aha')
console.log(`Wrote ${outPath}`)
console.log(
  `  ${blocks.length} blocks · ${m.STD.STANDARDS.length} standards mapped · ${sessions.length} lesson plans · ` +
    `${sessions.filter((r) => (r.sheetIds ?? []).length).length} with check-offs`,
)
