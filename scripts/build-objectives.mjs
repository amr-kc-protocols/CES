// Build the clinical and field training objectives as a .docx.
//
// The document is src/data/programDocs/objectives.ts — written there because
// the app builds and retains the same document for the preceptor, and a
// generator holding its own copy of the prose is the drift this set prevents.
// This script renders that tree to the file.
//
// Run: npm run doc:objectives  [-- <output path>]
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { Document, Packer } from 'docx'
import { loadCourse, ROOT } from './lib/doc-kit.mjs'
import { footer, NUMBERING, PAGE, renderBlocks } from './lib/doc-render.mjs'

const outPath = resolve(process.argv[2] ?? join(ROOT, 'build', 'AEMT-Clinical-and-Field-Objectives-Oct2026.docx'))
const m = await loadCourse()
const blocks = m.DOCS.objectivesBlocks()

const doc = new Document({
  creator: 'AMR Kansas City — Clinical Education',
  title: m.DOCS.OBJECTIVES_TITLE,
  description: 'Preceptor-facing objectives, scope of practice and documented minimums',
  numbering: NUMBERING,
  sections: [
    {
      properties: { page: PAGE },
      footers: { default: footer('AEMT Clinical and Field Training Objectives — October 2026 cohort') },
      children: renderBlocks(blocks),
    },
  ],
})

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, await Packer.toBuffer(doc))
const kar = m.CLINICAL_REQUIREMENTS.filter((r) => r.basis === 'kar')
console.log(`Wrote ${outPath}`)
console.log(
  `  ${blocks.length} blocks · ${m.P.seedPhases(m.KC_START_DATE).length} phases · ${kar.length} statutory minimums · ` +
    `${m.P.SKILL_CLEARANCES.length} dated clearances`,
)
