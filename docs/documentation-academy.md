# Ambulance Documentation & Review Academy

An original internal course on writing and reviewing ambulance records, built
from the build brief (Draft v1.0, 2026-10-25). It lives at `/doc-academy`
(Training → Documentation). Completion reads **"Internal training completed"**.
It is not CADS certification, it is not endorsed by NAAC, and it is not CE
unless someone separately authorizes it.

| Where | What |
| --- | --- |
| `src/data/docAcademy/sources.ts` | Resource register R01–R23, plus LP01–LP08 for the local policies the course needs and does not yet have |
| `src/data/docAcademy/lessons.ts` | C00–C09 (360 min), L01–L04 (120 min), the four 2-hour sessions, the rubric and the critical errors |
| `src/data/docAcademy/questions.ts` | Ungraded baseline (10 items) and exam Form A (30 items, built to the blueprint) |
| `src/data/docAcademy/cases.ts` | K01–K16. The six priority cases are fully authored; the other ten are seeds |
| `src/modules/docacademy/` | Course home, lesson player, chart lab, exam, reviewer scoring, completion record |
| `scripts/check-doc-academy.mjs` | The brief's acceptance criteria as assertions (`npm run check:docacademy`) |

## What the 2026-10-26 verification pass found

The build environment could not reach eCFR, cms.gov or the state sites
directly. Claims were therefore checked against CMS, MAC and state material
found through search. **Before release, the course owner must re-read the
primary text.** No source was upgraded to "reviewed" on the strength of this
pass alone.

**Confirmed, and consistent with the brief**

- **PCS timing.** For repetitive scheduled nonemergency transports, the PCS is
  obtained before service and dated no more than 60 days earlier. For
  unscheduled or nonrepetitive transports of facility residents, it is due
  within 48 hours after the transport. Two fallbacks exist: a non-physician
  signer, and the 21-day documented-attempt pathway. Sources: CMS compliance
  tips (R04) and Palmetto/CGS.
- **Paragraph letters.** CMS's current material cites the PCS rules at
  410.40(e)(2) and (e)(3). That supports the brief's "(a), (e), (f)". Older MAC
  articles still cite (d), so learners will see both.
- **Signature exception.** 424.36(b)(6) is the ambulance exception. It
  requires a contemporaneous crew statement, the transport date and time, the
  receiving facility, and a facility statement or a secondary facility record.
  Records are kept for 4 years. The source stays "located, needs review" until
  the branch is built from the reg text.
- **J5 MAC.** WPS holds contract 75FCMC19C0043, awarded 2019-09-20, with an
  anticipated end in August 2026. **That date has passed.** Confirm the
  operating contractor before citing anything from WPS (R20). R19's next review
  is set to 2026-11-30.
- **RSNAT prior authorization.** It reached independent suppliers garaged in
  Kansas and Missouri no earlier than 2022-04-01. It applies beyond the third
  round trip in 30 days, and institution-based (837I) providers are excluded.
  This was added to R13 and C06.
- **K.A.R. 109-2-5** (text published through 2024) requires:
  - documentation for every request and every patient assessed or transported
  - emergency documentation to the receiving facility within 24 hours
  - retention for at least 3 years
- **19 CSR 30-40.375** is titled "Uniform Data Collection System and Ambulance
  Reporting Requirements". Section-level review is still pending.
- **NAAC CADS** has been a one-day course of about 6 hours plus an exam since
  2017, and self-paced online since 2020. The brief's R01 link points at NAAC's
  own site.

**Needs a closer look**

- **Hospice §40.1.9.** Secondary sources describe the exception as a transport
  on the day care begins, *before the initial assessment*. The brief's "transport
  home on the effective election date" may be too loose. C06 now says to quote
  the exact wording rather than paraphrase it.
- **BPM ch. 10, §20.1.2.** I could not confirm this is still the section the
  lessons mean.
- **MO HealthNet ambulance manual.** The landing page and the linked file carry
  different dates (05/06/2026 and 09/01/2026), as the brief already noted.

**Arithmetic in the brief: all correct.** The core is 360 minutes, leadership
is 120, and each of the four sessions is exactly 120 with the C03 and C06 splits
as written. The blueprint sums to 30. 14/16 is 87.5%, which passes the 85% bar;
13/16 does not.

## What was decided while building

- **Records sync through Supabase.** These collections go through the same
  shared `records` table and sync engine as everything else in CES:
  `docLearners` (a learner's track, lessons and case work), `docAttempts`
  (exam attempts, one row each) and `docReviews` (practical score, sign-offs
  and completion, written by administrators only).
- **The migration has to be run before non-admins can save progress.** Until
  `supabase/migrations/2026-10-26-1-documentation-academy.sql` is applied, new
  collections are admin-only by default, so an FTO's or new hire's progress
  would be refused on push and discarded. The migration lets them read and
  write their own rows, keyed on `data.userId` rather than `updated_by`.
  `updated_by` is restamped on every write, so keying on it would hide a
  learner's record from them the first time an educator scored it. The
  migration also refuses a non-admin edit to an attempt already submitted.
- **Policies are tested against real Postgres.** `npm run check:rls` builds a
  throwaway database from `schema.sql` plus every migration, then acts as an
  admin, two FTOs and a new hire using the same upsert the sync engine sends.
  It needs local Postgres 16 and skips without it, so it is not part of
  `npm run check`.
- **The answer key ships in the client bundle,** and attempts are scored on the
  device. That is acceptable for a pilot, but not where assessment integrity
  matters (brief §7). The next step is an RPC like the selection exams use.
- **Answer positions.** As authored, the correct answers sat at b or c in 29 of
  30 items. Display order is now dealt round-robin, and the check fails if any
  screen position holds more than 40% of the key.
- **No scored item may cite a `local_pending` source.** Cases that depend on
  one end in "billing/compliance clarification needed" (K02, K07, K08).
- **Reviewer actions require `manageAcademy`.** That covers practical scoring
  and the two leadership sign-offs. The course itself is open to every account,
  because it uses synthetic charts only.
- **Every lesson is `draft`.** Each lists the reviewers who must sign it off,
  and the player shows a draft banner until they do.

## Still to do (owners)

1. Re-read R02, R07, R09 and R12 in the primary text and update `verification`
   (billing/compliance).
2. Supply LP01–LP08 (§9 of the brief), then remove the "pending" endings they
   unlock.
3. Write exam Form B, the different equivalent retest. Until it exists, a
   same-form retest is labeled as such.
4. Write vignettes for K04–K06, K09–K11 and K13–K16.
5. Have the clinical educator, billing and the medical director review the
   lesson text, and move each lesson past `draft`.
6. Run `supabase/migrations/2026-10-26-1-documentation-academy.sql`, then
   `2026-10-26-2-fto-survey-push.sql`, in the SQL Editor. Run each file's
   verification queries afterwards.
7. Move exam scoring server-side before results count for anything formal.

## FTO exit surveys (fixed alongside)

**The bug.** Every exit survey pushed from an FTO's signed-in device was
refused. Trainees often fill the survey in on the FTO's device, so FTOs may
write `surveys`; but FTOs may not read surveys, because the feedback is about
them. The sync engine pushes with an upsert, and Postgres refuses an upsert
whose row the writer cannot see. The app treated the refusal as permanent:
the survey left the push queue, stayed on that one device, and the FTO saw
"needed permissions this account doesn't have". New hires filing on their own
phones were unaffected.

**The fix** has two parts:

1. `supabase/migrations/2026-10-26-2-fto-survey-push.sql` lets an FTO read the
   survey rows their own account wrote, which is content already on their
   device. Surveys a trainee filed on their own phone stay invisible to every
   FTO. So does any survey an administrator has since edited or removed, and
   an FTO's device can no longer overwrite or resurrect one.
2. `requeueStrandedSurveys` in `lib/sync.ts` re-sends, once, the surveys
   earlier refusals stranded on FTO devices.
   - It counts as done only once the server accepts a survey; having nothing to
     send does not count.
   - If the app update reaches a phone before the migration has been run, it
     tries again at the next sign-in.
   - A network failure does not use up an attempt.
   - It stops after 10 refusals.

`check:rls` asserts the boundaries against real Postgres, and
`check:requeue` drives the re-send through each of those cases.
