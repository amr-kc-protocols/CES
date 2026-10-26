// Row-level security check: the Documentation Academy collections, and FTO
// exit-survey pushes.
//
// Unlike every other check here this one needs a real Postgres, because the
// thing under test is the database's own policy evaluation — a mock would
// only check that the mock agrees with itself. It builds a throwaway cluster,
// stubs the parts of Supabase the schema leans on (auth.uid(), auth.users, the
// authenticated role), applies supabase/schema.sql and every migration in
// order, then acts as an admin, two FTOs and a new hire, sending the same
// upsert the sync engine sends (lib/sync.ts).
//
// The upsert matters. INSERT … ON CONFLICT DO UPDATE requires the written row
// to be visible to the writer, so a role that cannot read its own rows has its
// pushes refused. That is how every FTO exit survey was being discarded until
// 2026-10-26-2-fto-survey-push.sql.
//
// Needs the Postgres 16 server binaries (initdb, pg_ctl) and psql. Without
// them it SKIPS, loudly. Not in `npm run check` for that reason.
//
// Run: node scripts/check-rls.mjs  (or `npm run check:rls`)
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync, chmodSync, chownSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { skip } from './lib/check-kit.mjs'

const SCRIPT = 'check-rls'
const here = dirname(fileURLToPath(import.meta.url))
const SUPA = join(here, '..', 'supabase')

const BIN = ['/usr/lib/postgresql/16/bin', '/usr/local/pgsql/bin', '/opt/homebrew/bin', '/usr/local/bin'].find((d) =>
  existsSync(join(d, 'initdb')),
)
const hasPsql = spawnSync('psql', ['--version']).status === 0
if (!BIN || !hasPsql) skip(SCRIPT, 'no local Postgres server binaries (initdb, pg_ctl) or psql', 'install postgresql-16')

// initdb refuses to run as root, so a root shell hands the cluster to `postgres`.
const asRoot = process.getuid?.() === 0
const dir = mkdtempSync(join(tmpdir(), 'ces-rls-'))
chmodSync(dir, 0o755)
const PORT = String(55000 + (process.pid % 1000))

function sh(cmd, args) {
  if (asRoot) return execFileSync('su', ['postgres', '-c', [cmd, ...args].map((a) => `'${a}'`).join(' ')], { stdio: 'pipe' })
  return execFileSync(cmd, args, { stdio: 'pipe' })
}

if (asRoot) chownSync(dir, Number(execFileSync('id', ['-u', 'postgres']).toString().trim()), 0)
sh(join(BIN, 'initdb'), ['-D', dir, '-A', 'trust', '-U', 'postgres'])
sh(join(BIN, 'pg_ctl'), ['-D', dir, '-o', `-p ${PORT} -k ${dir} -c listen_addresses=`, '-l', join(dir, 'log'), '-w', 'start'])

let checks = 0
const fails = []
try {
  const psql = (sql, db = 't') =>
    spawnSync('psql', ['-h', dir, '-p', PORT, '-U', 'postgres', '-d', db, '-q', '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], {
      input: sql,
      encoding: 'utf8',
    })
  const must = (sql, what, db) => {
    const r = psql(sql, db)
    if (r.status !== 0) throw new Error(`${what} failed:\n${r.stderr}`)
    return r.stdout.trim()
  }

  must('create database t', 'create database', 'postgres')
  must(
    `create schema auth;
     create table auth.users (id uuid primary key, email text);
     create function auth.uid() returns uuid language sql stable
       as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
     create function auth.role() returns text language sql stable as $$ select 'authenticated' $$;
     do $$ begin
       if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
       if not exists (select from pg_roles where rolname = 'anon') then create role anon; end if;
       if not exists (select from pg_roles where rolname = 'service_role') then create role service_role; end if;
     end $$;
     grant usage on schema public, auth to authenticated, anon;`,
    'Supabase stub',
  )
  must(`\\i ${join(SUPA, 'schema.sql')}`, 'schema.sql')
  for (const f of readdirSync(join(SUPA, 'migrations')).filter((f) => f.endsWith('.sql')).sort()) {
    must(`\\i ${join(SUPA, 'migrations', f)}`, f)
  }

  const A = '00000000-0000-0000-0000-00000000000a'
  const F = '00000000-0000-0000-0000-00000000000f'
  const G = '00000000-0000-0000-0000-000000000002'
  const N = '00000000-0000-0000-0000-00000000000e'
  must(
    `grant select, insert, update on public.records to authenticated;
     grant select on public.profiles to authenticated;
     insert into auth.users values ('${A}','a@x'),('${F}','f@x'),('${G}','g@x'),('${N}','n@x');
     update public.profiles p set role = v.r, market = 'kc'
       from (values ('${A}'::uuid,'admin'),('${F}'::uuid,'fto'),('${G}'::uuid,'fto'),('${N}'::uuid,'newhire')) v(u, r)
      where p.user_id = v.u;`,
    'accounts',
  )

  const as = (uid, sql) => psql(`set role authenticated; set request.jwt.claim.sub = '${uid}';\n${sql}`)
  // Exactly what lib/sync.ts sends: an upsert keyed on (market, collection, id).
  const up = (uid, collection, id, data, { market = 'kc', deleted = false } = {}) =>
    as(
      uid,
      `insert into public.records (market, collection, id, data, deleted)
       values ('${market}', '${collection}', '${id}', '${JSON.stringify(data)}'::jsonb, ${deleted})
       on conflict (market, collection, id) do update set data = excluded.data, deleted = excluded.deleted;`,
    )
  const allowed = (name, r) => {
    checks++
    if (r.status !== 0) fails.push(`${name} — refused: ${r.stderr.trim()}`)
  }
  const refused = (name, r, because) => {
    checks++
    if (r.status === 0) fails.push(`${name} — was allowed`)
    else if (because && !r.stderr.includes(because)) fails.push(`${name} — refused for the wrong reason: ${r.stderr.trim()}`)
  }
  const count = (uid, collection) => Number(as(uid, `select count(*) from public.records where collection = '${collection}';`).stdout.trim())
  const eq = (name, got, want) => {
    checks++
    if (got !== want) fails.push(`${name} — expected ${want}, got ${got}`)
  }

  // A learner's own rows.
  allowed('FTO enrols themselves', up(F, 'docLearners', 'dl_f', { id: 'dl_f', userId: F, name: 'F' }))
  allowed('FTO updates their own learner row', up(F, 'docLearners', 'dl_f', { id: 'dl_f', userId: F, name: 'F2' }))
  allowed('FTO submits an attempt', up(F, 'docAttempts', 'da_1', { id: 'da_1', userId: F, pct: 70 }))
  allowed('re-sending an attempt unchanged is accepted', up(F, 'docAttempts', 'da_1', { id: 'da_1', userId: F, pct: 70 }))
  refused('FTO cannot change a submitted attempt', up(F, 'docAttempts', 'da_1', { id: 'da_1', userId: F, pct: 100 }), 'cannot be changed')
  refused('FTO cannot tombstone their own learner row', up(F, 'docLearners', 'dl_f', {}, { deleted: true }))

  // Anyone else's.
  refused('FTO cannot write a row claiming another account', up(F, 'docLearners', 'dl_x', { id: 'dl_x', userId: G }))
  refused('FTO cannot write an unowned row', up(F, 'docLearners', 'dl_y', { id: 'dl_y' }))
  refused('FTO cannot write a review, even about themselves', up(F, 'docReviews', 'dl_f', { id: 'dl_f', userId: F, completion: {} }))
  allowed('a second FTO enrols', up(G, 'docLearners', 'dl_g', { id: 'dl_g', userId: G }))
  refused("FTO cannot take over another FTO's row by rewriting userId", up(F, 'docLearners', 'dl_g', { id: 'dl_g', userId: F }))
  eq("the second FTO's row is still theirs", as(A, "select data->>'userId' from public.records where id = 'dl_g';").stdout.trim(), G)
  refused('FTO cannot write their own row into another market', up(F, 'docLearners', 'dl_w', { id: 'dl_w', userId: F }, { market: 'wichita' }))

  // The reviewer.
  allowed("admin scores an FTO's practical", up(A, 'docReviews', 'dl_f', { id: 'dl_f', learnerId: 'dl_f', userId: F, practical: {} }))
  allowed("admin edits an FTO's learner row", up(A, 'docLearners', 'dl_f', { id: 'dl_f', userId: F, name: 'edited' }))
  allowed('admin may correct an attempt', up(A, 'docAttempts', 'da_1', { id: 'da_1', userId: F, pct: 70 }))
  allowed('admin keeps an instructor-led learner with no account', up(A, 'docLearners', 'dl_class', { id: 'dl_class', name: 'Classroom' }))

  // Reads.
  eq('FTO still sees their learner row after an admin edited it', count(F, 'docLearners'), 1)
  eq('FTO sees their own review', count(F, 'docReviews'), 1)
  eq('FTO sees their own attempt', count(F, 'docAttempts'), 1)
  eq("second FTO sees only their own learner row", count(G, 'docLearners'), 1)
  eq('second FTO sees no reviews', count(G, 'docReviews'), 0)
  eq('admin sees every learner row', count(A, 'docLearners'), 3)
  allowed('new hire enrols themselves', up(N, 'docLearners', 'dl_n', { id: 'dl_n', userId: N }))
  eq('new hire sees only their own', count(N, 'docLearners'), 1)

  // Nothing else moved.
  refused('FTO still cannot write AEMT', up(F, 'aemtCourses', 'c1', { id: 'c1', userId: F }))
  refused('FTO still cannot write CQMP', up(F, 'cqmpReports', 'r1', { id: 'r1', userId: F }))

  // Exit surveys. A trainee often fills one in on the FTO's device, so the
  // FTO's account pushes it; the feedback is about the FTO, so they must still
  // see nothing they did not file themselves.
  allowed('FTO device pushes a survey filed on it', up(F, 'surveys', 's_f', { id: 's_f' }))
  allowed('re-sending that survey unchanged is accepted', up(F, 'surveys', 's_f', { id: 's_f' }))
  eq('FTO sees the survey their device filed', count(F, 'surveys'), 1)
  allowed("new hire files their own survey on their own phone", up(N, 'surveys', 's_n', { id: 's_n' }))
  eq("FTO cannot see a survey the trainee filed", count(F, 'surveys'), 1)
  eq("a second FTO cannot see the first FTO's survey", count(G, 'surveys'), 0)
  refused("FTO cannot overwrite the trainee's own survey", up(F, 'surveys', 's_n', { id: 's_n', tampered: true }))
  eq("the trainee's survey is untouched", as(A, "select data->>'tampered' from public.records where id = 's_n';").stdout.trim(), '')
  allowed('admin removes the FTO-filed survey', up(A, 'surveys', 's_f', {}, { deleted: true }))
  eq('FTO loses sight of it once an admin has acted on it', count(F, 'surveys'), 0)
  refused("FTO device cannot resurrect a survey an admin removed", up(F, 'surveys', 's_f', { id: 's_f' }))
  eq('it stays removed', as(A, "select deleted from public.records where id = 's_f';").stdout.trim(), 't')
  eq('admin sees every survey', count(A, 'surveys'), 2)
} finally {
  try {
    sh(join(BIN, 'pg_ctl'), ['-D', dir, '-m', 'immediate', 'stop'])
  } catch {
    // Already down.
  }
  rmSync(dir, { recursive: true, force: true })
}

if (fails.length) {
  console.error(`${SCRIPT}: ${fails.length} of ${checks} checks FAILED\n`)
  for (const f of fails) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log(`${SCRIPT}: ${checks} checks passed against Postgres with schema.sql and every migration applied`)
