// Emit the baseline diagnostic bank as a Supabase seed.
//
// ONE SOURCE, TWO RENDERINGS — the same architecture as the program documents.
// src/data/aemtBaseline.ts is the readable copy a subject-matter reviewer marks
// up; this file turns it into rows. Hand-editing the SQL would put the bank a
// student sits out of step with the bank anyone reviews, and nothing would say
// so.
//
// ADDITIVE. exam_questions.id is referenced by exam_attempts.question_ids, so
// this never truncates the table. It clears and reloads only the rows it owns
// (program = 'aemt-baseline'), which is safe while no attempt has been sat and
// must not be re-run afterwards without retiring the old rows instead.

import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..')
const SRC = join(ROOT, 'src')
const OUT = join(tmpdir(), `ces-baseline-sql-${process.pid}.mjs`)

await build({
  stdin: {
    contents: `export * from ${JSON.stringify(join(SRC, 'data/aemtBaseline'))}\n`,
    resolveDir: SRC,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: OUT,
})
const { BASELINE_ITEMS } = await import(pathToFileURL(OUT).href)

const q = (s) => `'${String(s).replace(/'/g, "''")}'`
const arr = (xs) => `array[${xs.map(q).join(',')}]`

const lines = BASELINE_ITEMS.map(
  (i) =>
    `(${q('aemt-baseline')}, ${q(i.code)}, ${q(i.domain)}, ${q(i.stem)}, ${arr(i.options)}, ${i.answer}, true)`,
)

const sql = `-- AEMT day-one baseline diagnostic — ${BASELINE_ITEMS.length} items.
--
-- GENERATED from src/data/aemtBaseline.ts by scripts/build-baseline-sql.mjs.
-- Do not hand-edit: the rationales, the blueprint mix and the item-writing
-- checks all live with the source, and a change made here alone is a change
-- nothing reviews and nothing verifies.
--
-- Requires migration 2026-09-02-aemt-baseline-diagnostic.sql, which admits
-- 'aemt-baseline' as a program.
--
-- ADDITIVE. Clears and reloads only its own rows. Safe while unused; once a
-- student has sat it, retire items instead (see maintenance/retire-items.sql)
-- so the attempts on record keep pointing at what was actually asked.

delete from public.exam_questions where program = 'aemt-baseline';

insert into public.exam_questions (program, code, domain, stem, options, answer, active) values
${lines.join(',\n')};

-- Every item scored, keyed, and inside the blueprint bands its source asserts.
do $$
declare n int;
begin
  select count(*) into n from public.exam_questions where program = 'aemt-baseline';
  if n <> ${BASELINE_ITEMS.length} then
    raise exception 'baseline bank loaded % rows, expected ${BASELINE_ITEMS.length}', n;
  end if;
  select count(*) into n from public.exam_questions
    where program = 'aemt-baseline' and (answer is null or array_length(options, 1) <> 4);
  if n <> 0 then
    raise exception 'baseline bank has % unkeyed or malformed items', n;
  end if;
end $$;
`

const out = resolve(process.argv[2] ?? join(ROOT, 'supabase', 'aemt_baseline_diagnostic_seed.sql'))
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, sql)

const byDomain = new Map()
for (const i of BASELINE_ITEMS) byDomain.set(i.domain, (byDomain.get(i.domain) ?? 0) + 1)
console.log(`Wrote ${out}`)
console.log(`  ${BASELINE_ITEMS.length} items · ${[...byDomain].map(([d, n]) => `${d} ${n}`).join(' · ')}`)
