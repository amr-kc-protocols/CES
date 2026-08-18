# Cloud sync setup (Supabase)

The app is **offline-first**: your device's local data stays the working copy,
and a background sync engine shares changes through a Supabase project so
every signed-in device (you, FTOs) converges on the same data.

One-time setup, ~10 minutes:

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → **Start your project** (free tier is fine).
2. Create a project, e.g. `amr-kc-academy`. Pick a region near Kansas City (`us-east-1` works).
3. Wait for it to provision (~2 min).

## 2. Run the schema

1. In the project dashboard: **SQL Editor → New query**.
2. Paste the entire contents of [`schema.sql`](./schema.sql) and click **Run**.
3. You should see "Success. No rows returned".

## 3. Configure auth

1. **Authentication → URL Configuration**: set **Site URL** to the deployed app URL
   (e.g. `https://your-app.vercel.app`). Magic-link emails redirect here.
2. Email sign-in (magic links) is on by default — nothing else to enable.

## 4. Connect the app

1. In the dashboard: **Settings → API Keys**. Copy the **Publishable key**
   (`sb_publishable_…`; on older projects this is the `anon` `public` JWT —
   either works). It's safe to be public — row-level security does the real
   gatekeeping. The **Project URL** is `https://<project-ref>.supabase.co`
   (shown under Settings → Data API).
2. In the app: **Settings → Cloud sync** → paste both → **Save & sign in**
   with your email → click the magic link the email contains.
3. First sign-in creates your profile with the `newhire` role. Promote
   yourself: dashboard → **Table Editor → profiles** → set your row's `role`
   to `admin`.
4. Back in the app: **Push local data to cloud** seeds the project with
   everything on your device (your existing cohort included).

## 5. Add FTOs / other devices

The project URL + publishable key are baked into the app
(`src/config/cloud.ts`), so nobody else touches keys:

- New person/device: open the app → **Settings → Cloud sync** → enter email →
  tap the magic link. Done.
- Then set their `role` in **Table Editor → profiles** (one time per person).

### Adding an administrator

`admin` is the widest role there is — everything in the market, in both
directions — so it is granted by a named file rather than by a dropdown nobody
remembers changing. Copy `add_admin_mary_glover.sql`, change the three
constants at the top (`v_email`, `v_name`, `v_market`) and run it in the SQL
Editor. It promotes an existing account, or creates one when you supply the
person's employee number as their starting password, and it is safe to re-run.

Each such file is left in the repo after it is run: together they are the
record of who was given administrator access and when.

### Roles

Row-level security scopes **both reads and writes**. Reads matter as much as
writes here: the sync engine pulls everything a user is allowed to read down
onto their device, so a role that can read a collection has a full local copy
of it regardless of what the app's UI shows.

| Role | Reads | Writes |
|---|---|---|
| `admin` | Everything | Everything |
| `fto` | Cohorts, trainees, schedule, attendance, rides, evals, skill sign-offs | Trainees, attendance, rides, evals, skills, surveys |
| `newhire` | The schedule, and their own exit survey | Their own exit survey |

Deliberately **not** readable by `fto`:

- **`surveys`** — new-hire exit surveys carry unredacted feedback about FTOs.
  The History screen is admin-only in the app for that reason, and the database
  now agrees with it.
- **The AEMT program** — Kansas certification records, student certificate
  numbers, and cohort-selection data about staff who are the FTOs' own peers.
  Admin-only in both directions.

New-hire survey reads are scoped by `updated_by = auth.uid()`, which the
`records_stamp` trigger sets server-side and a client cannot spoof.

## Applying migrations

`schema.sql` is the full current schema for a fresh project. For an existing
one, run the files in [`migrations/`](./migrations) in **filename order**
through the SQL Editor. They are written to be safe to re-run, and each
carries its own revert at the bottom.

Filename order is what matters, not the date alone: two migrations can share a
date, and where one depends on the other the filenames carry a sequence
number (`2026-08-08-1-…` before `2026-08-08-2-…`). Applying that pair the
other way round leaves two `exam_start` overloads, and every attempt to start
the exam then fails with *"function exam_start(unknown, unknown) is not
unique"*.

The two are kept in step: applying `schema.sql` to an empty project and
applying the old baseline plus every migration produce an identical set of
columns, policies, functions and indexes. If you change one, change the other,
and diff the two end states before trusting it.

The `2026-08-01` migration changes what non-admins can read. Run it when FTOs
are not mid-shift: their devices keep whatever they have already pulled, but
will stop receiving collections they no longer read. It is reversible in one
statement.

That migration also brings the AEMT program into sync for the first time. On
the admin's next push, the AEMT records currently sitting in one browser's
local storage upload to the project — which is the point, since those carry a
three-year retention obligation under K.A.R. 109-17-3 and had no backup at all.

## Loading the exam bank

There are two banks, one per program. They share the `exam_questions` table and
are fenced from each other by its `program` column.

### NEOP — the new-hire selection exam

**`neop_install.sql` is the one to paste** — both migrations and the bank, in
order, with a schema-cache reload at the end, safe to re-run. Everything below
describes what is inside it.

The bank itself is `neop_exam_questions_seed.sql`, which needs the
`2026-08-18-neop-selection-exam.sql` migration first. It is generated from
`scripts/neop-exam-bank.mjs` (`npm run gen:neop`) and, unlike the AEMT files
below, it **upserts on each item's `code` and never deletes**: a re-run
corrects the wording of an item in place, and an item dropped from the bank is
retired with `active = false` rather than removed. It is therefore safe to
re-run while candidates are sitting the exam. Every statement in it is fenced
to `program = 'neop'`, so it cannot touch the AEMT bank.

Its preference items carry `answer = null`, which is what makes them unscored:
`scored` is generated from the key's presence and `exam_submit` skips anything
without one. See `docs/neop-selection-exam.md`.

### AEMT — the cohort selection test

Run these three in order, and **treat the order as load-bearing**:

1. `exam_questions_seed.sql` — the 120-item recall tier. Re-runnable, but note
   it `truncate`s the table, so it takes the harder tier with it.
2. `exam_questions_hard.sql` — the 63-item application tier. Deletes and
   re-inserts only `difficulty = 'hard'`.
3. `exam_questions_fixes.sql` — the reviewer pass: 29 corrections and 22
   retirements. It fixes a wrong Glasgow Coma Score key and retires every item
   whose clinical content a candidate could argue.

**Step 3 is not optional, and re-running step 1 or 2 undoes it.** The first two
files are generated from scripts and carry the bank as originally written;
every correction and retirement lives in the third. Re-seed without it and the
wrong answers come back, along with 22 contestable items.

The bank runs 161 active against a 50-question draw. Retiring more than about
another 30 starts to make repeat sittings recognizable, so anything further
should come with replacements.

The fixes file is safe to run at any time and safe to run twice — it matches on
stem text rather than row id (ids are not stable; `exam_questions_hard.sql`
renumbers its tier on every re-run), reports anything it could not find instead
of guessing, and prints the bank's state at the end.

It is written for the **Supabase SQL Editor**, which does not hold a session
across statements. An earlier version used a temp table and failed there with
`relation "exam_fix" does not exist` — partway through, after the retirement
statements had already committed. It is now three self-contained statements
with no temp table and no explicit transaction, each safe to re-run on its own,
so a half-applied bank converges on a second attempt rather than needing
untangling.

Retired items are set `active = false`, never deleted. `exam_attempts.question_ids`
holds bare ids with no foreign key, so deleting a question silently orphans
every historical attempt that served it.

Stored answer positions are lopsided — 67% of the active bank keys to B — and
that is **not** a defect to fix in the data. `ExamPage` shuffles each question's
options per attempt, seeded on the attempt id, so no candidate sees the stored
order. Simulated over 20,000 attempts against the current bank, delivered
positions come out A 25.1% / B 25.0% / C 25.0% / D 25.0% across all 24
permutations. Rebalancing the stored rows would gain nothing and would
invalidate `exam_attempts.responses`, which records the original option index.

## How sync behaves

- Every change writes locally first (instant, works in dead zones), then
  queues for push. The outbox flushes when the network allows.
- Pulls happen on app start, when the app returns to the foreground, and
  every couple of minutes while open.
- Conflicts resolve **last-write-wins per record** — fine at this team's
  scale, since two people rarely edit the same trainee at the same moment.
- Deletions are tombstones, so offline devices learn about them on next pull.
