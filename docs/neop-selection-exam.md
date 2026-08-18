# NEOP Selection Exam — Kansas City Interfacility

**AMR Kansas City — new-hire selection, interfacility operation**
Draft 2 · requires HR review before use

Sat by external applicants at **`/neop-exam`**. One attempt per email, no
sign-in, rolling — there is no closing date.

---

## The problem this instrument was built for

The oral interviews keep discovering, well into the conversation, that the
applicant wants a 911 or fire career and sees interfacility as the way in. Two
things follow, and they cost differently:

- Our time and theirs goes into finding it out one candidate at a time, in the
  room, at the slowest possible point in the process.
- Candidates who do want this work compete for seats against people who are
  passing through, and some of them lose.

None of that is dishonesty on the applicants' part. Most have never been told
what an interfacility operation does all day. "Ambulance" means what they have
seen on a scene, and they learn what this job actually is after they are hired.

So the instrument does two things a knowledge test alone would not:

1. **It tells them what the job is, in writing, before they answer anything.**
   The reading (`src/data/kcOperation.ts`) is on the same page as the Start
   button, and reading it is untimed — the clock does not begin until they
   press Start. **The text is the operation's own**, written by the people who
   run Kansas City.
2. **It asks them what they want** — in a way that does not tell them which
   answer we are hoping for, and does not score the answer either way.

---

## What it is made of

| Section | Items served | Scored | What it measures |
|---|---|---|---|
| Patient care | 12 of 42 | Yes | Whether somebody who just qualified still knows what they were taught. |
| What you want | all 13 | **No** | Whether they are heading for a 911 or fire role and using this seat to wait. |
| Our operation | 16 of 42 | Yes | Did they read, and understand, the reading. Every item keys to a section of it. |

41 items served, 28 scored, 35 minutes.

**The order is deliberate.** Patient care is a neutral warm-up that gives
nothing away. The preference items come **before** the operations section, not
after it: those sixteen questions have correct answers that describe, at
length, exactly what this operation values and is wary of. Ask them first and
the candidate answers the preference items having just been coached — with a
score attached — on what we would like to hear.

### Patient care is at newly-qualified EMT level, and nothing else

No paramedic content: EMT and paramedic applicants sit the same section, so
paramedic material would mark an EMT down for the certificate they hold rather
than the person they are.

And nothing specific to interfacility work — no lines and drains to check
before a move, no report taken from an ICU nurse, no oxygen planned for a
two-hour leg. Those items were unfair in a way that was easy to miss: they look
clinical, so a candidate who missed them reads as weak on patient care when
what they actually lacked was a job they have not been given yet.

This section is a **floor, not a ranking**. What we want to know about our own
operation we ask in the operations section, from a reading we handed them first.

### Marks

| | Floor |
|---|---|
| Overall, of the scored items | 70% |
| Patient care | 70% |
| **Our operation** | **75%** |

The operations floor is the point of the instrument. A candidate can be a
perfectly good clinician and have understood nothing about the job they just
read several pages about — that combination is precisely the hire who leaves in
four months, and an overall percentage lets it through by averaging.

These are decision aids, not automatic rejections. Nobody is hired or declined
by arithmetic. The exam informs an interview; the interview decides.

---

## The preference section

### Why it is not scored

Score *"would you take a 911 job if one opened"* and within one hiring round
every applicant answers no, because the desirable answer is written on the face
of the question. A self-report item cannot measure sincerity.

What it can do is put specific, on-the-record answers in front of the
interviewer, so the conversation starts somewhere concrete instead of at "so,
tell us why you want to work here." That is why each item carries an **interview
probe** rather than a key.

### Why none of them announces what it is for

Unscored is not enough on its own. The first version of this section asked
things like *"six months in, a 911 position opens at the same pay — do you take
it or stay?"* Every option was labelled with its own verdict. That is not a
question, it is a prompt sheet: it tells the candidate exactly what we are
afraid of and exactly which box to tick, and the applicants most willing to say
what we want to hear tick it fastest. It selected for compliance and against
candor.

The items are now built to four rules, written out above them in
`scripts/neop-exam-bank.mjs`:

1. **Every option is a defensible, likeable answer.** If one option is
   obviously the wanted one, the item measures nothing but obedience.
2. **Evidence beats intention.** What somebody has already spent their own
   weekends and money on is a fact about them; what they intend is a fact about
   this conversation. Several items ask what they have *done* — a fire academy
   course, a department's entrance test, where else they have applied.
3. **Forced choice between two goods.** What they are willing to give up is far
   harder to fake than what they claim to want.
4. **No item decides anything.** The interviewer is shown a tally across the
   whole section, not a verdict on any one answer.

**The one thing that still tells them is the reading itself**, which says
plainly that this is not 911 work and that this job is not a waiting list for a
911 opening. That is a deliberate trade: letting somebody withdraw before the
interview is worth more than a clean measurement. It is also exactly why these
items lean on what an applicant has already done — that half cannot be
re-decided after reading a web page.

### Using it in the interview

Open the candidate on **NEOP → Selection exam → Interview notes**. You get:

- a **tally** — how many answers lean toward this work, how many lean toward
  scene or fire work, how many are context;
- each answer, with the reading of that particular option;
- the **probe to ask next**, whatever they answered.

A lean is not a finding. Ask the probes; the answer is the opening, not the
conclusion. And wanting to run 911 or work for a fire department is a
legitimate thing to want — sometimes the right outcome of the conversation is
telling somebody where else to apply.

The same **prohibited topics** apply as in the AEMT interview, and for stronger
reasons — these are external applicants. They are listed once, in
`src/data/aemtSelection.ts`, and imported rather than retyped.

---

## Running it

1. **Paste `supabase/neop_install.sql` into the Supabase SQL Editor and run
   it.** That is the whole database side: both migrations and the question
   bank, in order, plus a schema-cache reload. Safe to run again at any time,
   including while candidates are sitting the exam — the bank upserts on each
   item's `code` and retires rather than deletes, so no attempt on record is
   orphaned. (It is generated from the three underlying files; edit those and
   run `npm run gen:neop`.)

   **Do this whenever the app is deployed to a new project, and after any
   change to the bank.** The app and the database deploy separately: on
   18 August the frontend went out without the SQL, and a candidate opened the
   exam to a PostgREST error printed under the AMR logo. The app now tells a
   candidate the exam is temporarily unavailable and tells an administrator
   which file to run, but nothing can run it for you.
3. Send applicants `https://<the app>/neop-exam`. The link is on
   **NEOP → Selection exam**, with a copy button.
4. Read results on the same screen. **⬇ CSV** exports the lot, one row per
   candidate, preference answers included.
5. **📋 Review the bank** shows every item as a candidate sees it, with the key
   on demand and each item's statistics beside it. It creates no attempt.

Everything on those screens is administrator-only, in the app and in the
database.

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

`npm run check:neop` fails on: an operations item whose `ref` names a reading
section that does not exist; a preference item with an answer key, or a scored
item without one; a signal map out of step with its options; a duplicate code;
a preference item with two "preferred" answers; fewer than eight preference
items carrying a lean; a preference option that quotes the job description back
at the candidate; or generated SQL that has drifted from the bank. It is part
of `npm run check`.

### The rule that is easy to get wrong

Reword a stem or an option freely under the same `code` — that is what the
upsert is for, and it corrects the item in place without orphaning an attempt
that served it.

But if you **reorder** the options, or change what an option **means**, give
the item a **new code**. `exam_attempts.responses` stores the option *index*,
and the preference signals are positional: the same stored `0` would quietly
become a different answer, and an interviewer would read a candidate's file
wrong with nothing to see. `fit-paperwork` became `fit-charts` for exactly this
reason, and `check:neop` warns when a reused code's options have been reordered
since the last commit.

---

## When the reading changes, re-check the items

Every scored operations item keys to a section of the reading. Change the
reading and some of those answers move with it — this is not theoretical, it
has happened twice:

- The reading used to say an applicant who dislikes paperwork **is looking at
  the wrong operation**. The operation's own text says they *do not have to
  enjoy it but must take it seriously*. A candidate who read carefully would
  have been marked **wrong** by the old item. It is now `ops-paperwork-serious`
  — a new code, because the keyed answer no longer means what it meant.
- The reading used to say balloon-pump, Impella and ECMO patients **travel with
  their own specialist teams**. The operation's text does not say that, so
  `ops-mcs-teams` was retired and `ops-mcs-patients` asks what the text does
  say.

Both old rows are retired rather than deleted, so any attempt that served them
still resolves to the question it actually asked.

After editing the reading, run `npm run check:neop` (which proves every `ref`
still resolves) and then read the operations items for the sections you
touched. The check can prove an item points at a section; only a person can
prove the section still contains the answer.
