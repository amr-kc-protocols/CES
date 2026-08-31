// Build the course syllabus as a .docx.
//
// The syllabus itself — every heading, every sentence, the schedule table — is
// src/data/programDocs/syllabus.ts, because the app builds and retains the same
// document and there must be exactly one of it. This script is the .docx half:
// load the block tree the app loads, render it, write the file.
//
// Run: npm run doc:syllabus  [-- <output path>]
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { Document, Packer } from 'docx'
import { loadCourse, ROOT } from './lib/doc-kit.mjs'
import { footer, NUMBERING, PAGE, renderBlocks } from './lib/doc-render.mjs'

const outPath = resolve(process.argv[2] ?? join(ROOT, 'build', 'AEMT-Syllabus-Oct2026.docx'))
const m = await loadCourse()
const blocks = m.DOCS.syllabusBlocks()

const doc = new Document({
  creator: 'AMR Kansas City — Clinical Education',
  title: m.DOCS.SYLLABUS_TITLE,
  description: 'Course syllabus for the joint AMR Kansas City / AMR Wichita Advanced EMT cohort',
  numbering: NUMBERING,
  sections: [
    {
      properties: { page: PAGE },
      footers: { default: footer('AEMT Course Syllabus — October 2026 cohort') },
      children: renderBlocks(blocks),
    },
  ],
})

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, await Packer.toBuffer(doc))
console.log(`Wrote ${outPath}`)
console.log(
  `  ${blocks.length} blocks · ${m.KC_SCHEDULE.length} schedule rows · ${m.GRADING_MODEL.length} graded components · ` +
    `${m.CLINICAL_REQUIREMENTS.length} clinical minimums · ${m.COURSE_STAFF.length} instructors`,
)
