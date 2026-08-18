# NEOP Selection Exam — Kansas City Interfacility

**AMR Kansas City — new-hire selection, interfacility operation**
Draft 1 · requires HR review before use

Sat by external applicants at **`/neop-exam`**. One attempt per email, no
sign-in, rolling — there is no closing date.

---

## The problem this instrument was built for

The oral interviews keep discovering, well into the conversation, that the
applicant wants a 911 career and sees interfacility as the way in. Two things
follow from that, and they cost differently:

- The applicant's time and ours goes into finding it out one candidate at a
  time, in the room, at the slowest possible point in the process.
- Candidates who do want this work compete for seats against people who are
  passing through, and some of them lose.

None of that is dishonesty on the applicants' part. Most have never been told
what an interfacility operation does all day. "Ambulance" means what they have
seen on a scene, and they learn what this job actually is after they are hired.

So the instrument does two things a knowledge test alone would not:

1. **It tells them what the job is, in writing, before they answer anything.**
   The briefing (`src/data/kcOperation.ts`) is on the same page as the Start
   button, and reading it is untimed — the clock does not begin until they
   press Start. It is deliberately unflattering in places. A preview that only
   sells is not a preview.
2. **It asks them, on the record, what they want** — and does not score the
   answer.

---

## What it is made of

| Section | Items served | Scored | What it measures |
|---|---|---|---|
| Patient care | 12 of 26 | Yes | Can they look after a patient. **EMT scope on purpose** — EMT and paramedic applicants sit the same section, and paramedic-only content would mark an EMT down for the certification they hold rather than the work they would do. |
| Our operation | 16 of 33 | Yes | Did they read, and understand, the briefing. Every item keys to a section of it. |
| What you want | all 11 | **No** | What they are actually after. Recorded, surfaced to the interviewer, given no marks at all. |

28 scored items, 30 minutes, drawn per section so every candidate sits the same
shape of exam rather than whatever 39 random items came up.

The preference items are **not sampled**. Every candidate is served all eleven,
because an interviewer comparing two candidates needs them to have been asked
the same questions.

### Marks

| | Floor |
|---|---|
| Overall, of the scored items | 70% |
| Patient care | 70% |
| **Our operation** | **75%** |

The operations floor is the point of the instrument. A candidate can be a
perfectly good clinician and have understood nothing about the job they just
read three pages about — that combination is precisely the hire who leaves in
four months, and an overall percentage lets it through by averaging.

These are decision aids, not automatic rejections. Nobody is hired or declined
by arithmetic. The exam informs an interview; the interview decides.

---

## Why the preference section is not scored

Score *"would you take a 911 job if one opened"* and within one hiring round
every applicant answers no, because the desirable answer is written on the face
of the question. A self-report item cannot measure sincerity.

What it can do is put a specific, on-the-record answer in front of the
interviewer, so the conversation starts somewhere concrete instead of at "so,
tell us why you want to work here." That is what these items are for, and it is
why each one carries an **interview probe** rather than a key.

Each answer is flagged for the interviewer as one of:

- **Consistent with the work** — reads as somebody who wants this job.
- **Worth discussing** — have the conversation. **Not a mark against anyone.**
- **Context** — tells you about them without pointing either way.

A preference answer is never a reason to decline anybody on its own. "I want to
run 911 eventually" is a legitimate thing for a person to want. It is a
conversation, and sometimes it is a referral toward the Linn County operation,
which is the honest outcome for everybody.

### Using it in the interview

Open the candidate on **NEOP → Selection exam**, and ask the probe printed
beside each answer — whatever they answered. The answer is the opening, not the
finding. A candidate who wrote "911 is what I want" and then talks well about
why this work interests them has told you more than one who ticked the
agreeable box and cannot say anything about it.

The same **prohibited topics** apply here as in the AEMT interview, and for
stronger reasons — these are external applicants. They are listed once, in
`src/data/aemtSelection.ts`, and imported rather than retyped.

---

## What a candidate is asked to acknowledge

The integrity statement on the NEOP exam opens with the acknowledgement that
they read the briefing and understand **this job is not 911 scene response**.
It is stored with the attempt, with a hash of its own wording, so a later edit
to the statement cannot silently change what a past applicant is recorded as
having agreed to.

---

## Running it

1. Apply `supabase/migrations/2026-08-18-neop-selection-exam.sql`.
2. Load `supabase/neop_exam_questions_seed.sql`. It upserts on each item's
   `code` and retires by setting `active = false` — safe to re-run at any time,
   including while candidates are sitting the exam.
3. Send applicants `https://<the app>/neop-exam`. The link is on
   **NEOP → Selection exam**, with a copy button.
4. Read results on the same screen: overall, patient care and our operation as
   separate pills, and **Interview notes** for the preference answers and
   probes. **⬇ CSV** exports the lot, one row per candidate, preference answers
   included.
5. **📋 Review the bank** shows every item as a candidate sees it, with the key
   on demand and each item's statistics beside it. It creates no attempt.

Everything on those screens is administrator-only, in the app and in the
database. The rows are applicants' contact details and their own answers about
what they want from a career, and an applicant may be a current colleague of
the FTO who would otherwise be reading them.

---

## Editing the questions

The bank lives in **`scripts/neop-exam-bank.mjs`** — outside `src/`, and that
matters: a bank imported from `src/` would be bundled into the app and shipped
to every candidate as part of the page that asks them the questions.

```bash
# edit scripts/neop-exam-bank.mjs, then
npm run gen:neop     # rebuild supabase/neop_exam_questions_seed.sql
npm run check:neop   # and check it
```

`npm run check:neop` fails on:

- an operations item whose `ref` names a briefing section that does not exist
  — an operations question whose answer is not in the briefing tests whether
  the candidate already works here, which is the opposite of the point;
- a preference item with an answer key, or a scored item without one;
- a signal map out of step with its options, which would print the wrong flag
  beside a real person's answer;
- a duplicate item code, which the upsert would turn into one item quietly
  overwriting another;
- the generated SQL having drifted from the bank.

It is also part of `npm run check`.

---

## Before this goes to an applicant

The briefing states five things this repository cannot source. They are in it
because leaving them out would make it less honest, not more, and they are
listed in `NEEDS_CONFIRMATION` at the bottom of `src/data/kcOperation.ts` so
they get checked rather than quietly published:

1. **The call mix** — that discharges, dialysis and behavioral-health transfers
   all feature alongside ICU and emergency-department transfers.
2. **No scene calls at all**, rather than very few.
3. **Balloon pump / Impella / ECMO patients travel with their own specialist
   teams** rather than being managed by our crew alone.
4. **Long-distance transfers of a few hours each way** being normal rather than
   rare.
5. **No internal transfer path** from Kansas City into the Linn County or Cass
   County operations short of applying to a posting.

If one of them is wrong, correct the briefing and then check whether an exam
item keys to it: items 2, 3 and 5 are each asked directly
(`ops-scene-calls`, `ops-mcs-teams`, `ops-not-a-queue`), and item 4 is
(`ops-long-transports`).

Everything else in the briefing is drawn from what this repository already
records about the operations — `src/data/operations.ts`, `src/data/academy.ts`,
the Field Guide registry, and the CQMP measures Kansas City reports.
