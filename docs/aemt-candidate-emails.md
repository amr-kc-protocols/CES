# AEMT Candidate Emails

**AMR Kansas City — earn-while-you-learn AEMT cohort**
Draft 1 · requires Program Manager and HR review before use

Templates for every message a candidate receives between submitting the intake
form and starting class. The pipeline stages in `src/lib/intake.ts`
(`INTAKE_STATUSES`) are the spine: **New → Shortlisted → Contacted → Accepted /
Declined**, and there is one email per transition.

Every figure below is transcribed from the program data, not invented — see
"Where each number comes from" at the end. If a number changes in
`src/data/aemt.ts` or `src/data/aemtSelection.ts`, it changes here too.

---

## Before you send anything

### Fill these in

Two kinds of blank appear in the templates.

`{{merge_field}}` — per candidate, from the intake row.

`[[ SET BEFORE SENDING ]]` — **not held anywhere in CES**, and not something
this document can supply. Each one is a real decision or a real document:

| Placeholder | Why it isn't filled in here |
|---|---|
| `[[ SERVICE COMMITMENT TERM ]]` | The length of the post-certification commitment. A contractual term — HR owns the number, and a wrong one in a candidate's inbox is a dispute later. |
| `[[ SERVICE COMMITMENT CONSEQUENCE ]]` | What happens if someone leaves inside the term (repayment, prorated or not, or nothing at all). Same reason. |
| `[[ WAGE TREATMENT ]]` | Whether class and clinical time is paid, at what rate, and what the wage is on certification. |
| `[[ COST TREATMENT ]]` | Who pays tuition, textbooks, NREMT fees and state application fees. |
| `[[ CLASS TIMES ]]` | The seeder assumes 09:00–13:00 Tue/Thu from the proposal; the session form defaults to 18:00–22:00. Those disagree, so confirm which is real before telling candidates. |
| `[[ COURSE START ]]` / `[[ COURSE END ]]` | From the course record once the KBEMS application is approved. |
| `[[ PROGRAM MANAGER ]]` / `[[ CONTACT ]]` | Signature block. |

### Two rules that are not optional

**Never ask, and never invite, a candidate to explain their availability.**
Availability is a fact you may ask for. The *reasons* behind it are on the
prohibited list in `src/data/aemtSelection.ts` — childcare, dependants,
pregnancy, health, second jobs, religion, marital status, age. That list binds
email as much as it binds the interview room, and email is worse: it's written
down, it's discoverable, and a candidate volunteering an answer in a reply
creates a record you then have to be careful not to act on. The templates below
ask "what are your plans for the pressure points", never "what's stopping you".

**Don't imply a seat exists before one does.** Every message before the offer
says the same thing in the same words: a score above threshold is not a seat,
and seats are few. Candidates who read otherwise, and then don't get one, are
right to feel misled.

---

## 1 · Intake received — next steps

**Send when:** an intake row lands. Status `New`.
**Purpose:** the main one. Confirms receipt, names every step ahead, describes
the program honestly, and states the commitment before anyone invests time.

> **Subject:** Your AEMT application — the selection exam is your next step

Hi {{first_name}},

Thanks for putting your name in for the AMR Kansas City AEMT cohort. This email
covers everything: what happens next, what the program actually involves, and
what we'd be asking of you afterwards. It's long on purpose — we'd rather you
decide now, with the real picture, than in week eleven.

### Your next step: the selection exam

**Take it here:** [[ EXAM LINK ]]
**Closes:** {{exam_deadline}}

- 50 multiple-choice questions, EMT level — material you already work with.
  Nothing from the AEMT curriculum; you haven't been taught it yet, and testing
  it would just measure who happened to work alongside a medic who explained IV
  therapy.
- **25 minutes**, timed from the moment you start.
- **One sitting.** Your questions are drawn once, against your email address.
  If the clock runs out, that attempt is spent — so start it when you have a
  clear 25 minutes, not between calls.
- Closed book. You'll be asked to agree to that before you begin, and we take
  it at face value.

Use the same email address you put on your application — that's the only thing
that links your result to your file. If you'd rather we use a different one,
reply and tell us before you sit it.

### How the selection process works

Four things are scored. Two are already in your record; you don't do anything
for them.

| | Weight | Where it comes from |
|---|---|---|
| Selection exam | 40% | The exam above |
| Structured interview | 30% | If you're shortlisted |
| QA chart review | 20% | Your last 12 months, from the QA system |
| Attendance | 10% | Your last 12 months, from HR |

Up to 5 points on top for current FTO service in good standing, or 3 for
preceptor, CE instructor, peer mentor or FTO work in the last two years. It's
deliberately small — it settles a near-tie, and it can't lift a weak score over
the line.

To advance you need **70 overall**, at least **70% on the exam**, and at least
**18 out of 30** at interview.

Being above those numbers is not the same as being offered a seat. There are
only a handful, and if fewer people clear the bar than we have chairs, we run a
smaller cohort rather than fill a seat below it. That isn't a negotiating
position — a student who doesn't finish costs the program, and costs that person
more.

### What happens after the exam

1. **Exam closes**, results are matched to applications automatically.
2. **Shortlist.** If you're through, we'll email you to arrange an interview.
   If you're not, we'll email you too — you won't be left wondering.
3. **Interview.** About 45 minutes with two interviewers who score
   independently, then confer. Six questions, all about how you've handled real
   situations: learning something on your own, juggling competing demands,
   recovering from a setback, taking correction, and how you'd plan for a
   demanding few months. There's nothing to revise for.
4. **Offer.** Successful candidates get a written offer and the service
   commitment agreement to sign.
5. **Class starts** [[ COURSE START ]].

### What the program actually is

A Kansas-approved Advanced EMT course, run by AMR Kansas City, leading to the
NREMT cognitive examination and Kansas AEMT certification.

**Roughly 376 hours across 16 weeks:**

| | Hours |
|---|---|
| Classroom | 110 |
| Skills lab | 50 |
| Hospital clinical — AdventHealth Kansas City | 72 |
| Field internship — AMR interfacility and Independence 911 | 144 |

Class runs **Tuesdays and Thursdays**, [[ CLASS TIMES ]]. Clinical and field
shifts are scheduled around that, and they are 12-hour shifts — six at the
hospital, roughly twelve in the field. AHA **PALS** is week 5 and **ACLS** is
week 7, both included.

You'll be doing real procedures on real patients under a preceptor. Kansas sets
minimum numbers you have to document to finish:

- 20 venipunctures, 10 of them starting an IV infusion
- 10 IM or SubQ injections
- 5 IO infusions
- 8 ECGs applied and interpreted
- 15 complete patient assessments, at least 10 in the field
- 10 supervised ambulance calls
- 10 patient care reports

These aren't targets to aim at. They're the floor, and the course doesn't end
until you've hit every one of them.

[[ WAGE TREATMENT ]]
[[ COST TREATMENT ]]

### What we'd expect from you

**While you're in the course:**

- **Attendance.** You may miss at most **8 hours** of scheduled class time.
  Beyond that you fail the course under the attendance policy — there's no
  discretion in it, and it's roughly two class days. Clinical and field shifts
  are rescheduled rather than counted against that, but they still have to be
  completed.
- **80% to pass.** Grades are 60% exams, 40% quizzes and homework, all through
  the online system. Lab skills and clinical are satisfactory / unsatisfactory
  and have to be signed off by an instructor.
- **Study time outside class.** This is the part people underestimate. Two class
  days a week does not make it a two-day-a-week course.
- **Keep your Kansas EMT certification current** through the whole program, and
  stay in good standing at work — no active corrective action.

**After you certify:**

Signing on means committing to stay with AMR Kansas City as an AEMT for
**[[ SERVICE COMMITMENT TERM ]]** after you certify.
[[ SERVICE COMMITMENT CONSEQUENCE ]]

You'll get the full agreement to read before you sign anything, and nobody is
asked to sign until they've been offered a seat. We're telling you now because
it should factor into whether you apply at all, not come as a surprise at the
end.

### Questions

Reply to this email and it comes straight to me.

One thing worth saying plainly: if there's something in your next few months
that makes this hard, you don't need to explain it to us, and we won't ask. What
we do care about is whether you've thought about it and have a plan. That comes
up at interview, and a candidate who names a real pressure point and how they'd
handle it does better than one who says it'll be fine.

Good luck with the exam.

[[ PROGRAM MANAGER ]]
AMR Kansas City — Clinical Education
[[ CONTACT ]]

---

## 2 · Shortlisted — interview invitation

**Send when:** the candidate clears the exam threshold and is moving to
interview. Status `Shortlisted` → `Contacted`.

> **Subject:** AEMT selection — interview invitation

Hi {{first_name}},

You cleared the selection exam and we'd like to interview you for the AEMT
cohort.

**When:** {{interview_datetime}}
**Where:** {{interview_location}}
**How long:** about 45 minutes

Two interviewers, six questions, scored independently and then discussed. Every
question asks about something you've actually done — learning something nobody
made you learn, handling several things landing at once, recovering from a
setback, taking correction on a call or a report, and how you'd plan for a
demanding few months.

There is nothing to revise. Bring specific examples rather than general answers;
"here's what I did and here's what changed" scores better than "I'm a hard
worker", and that's not a trick — it's the whole scoring rubric.

Please reply to confirm, or tell us if that time doesn't work and we'll find
another. Moving it costs you nothing in the scoring.

As before: clearing the interview threshold isn't the same as a seat. We'll be
straight with you either way, and quickly.

[[ PROGRAM MANAGER ]]
[[ CONTACT ]]

---

## 3 · Offer

**Send when:** the candidate is selected. Status `Accepted`.

> **Subject:** You have a seat in the AEMT cohort

Hi {{first_name}},

You've been selected for the AMR Kansas City AEMT cohort. Congratulations —
this was a competitive field and you earned it.

**Class starts** [[ COURSE START ]] and runs to [[ COURSE END ]], Tuesdays and
Thursdays, [[ CLASS TIMES ]].

**To accept, by {{acceptance_deadline}}:**

1. Reply to confirm you're accepting the seat.
2. Sign the **service commitment agreement** attached. It commits you to
   [[ SERVICE COMMITMENT TERM ]] with AMR Kansas City as an AEMT after you
   certify. [[ SERVICE COMMITMENT CONSEQUENCE ]] Read it properly, and ask
   before you sign if anything is unclear — that's what the window is for.
3. Send us a copy of your **current Kansas EMT certification**.
4. Confirm you've read the attendance policy: **more than 8 hours of missed
   class time fails the course.**

If you've decided against it, tell us as soon as you can and there's no ill
feeling — the seat goes to someone on the list, and that's a better outcome than
an empty chair in week two.

We'll send the full schedule, the book list and your clinical rotation dates
once acceptances are in.

[[ PROGRAM MANAGER ]]
[[ CONTACT ]]

---

## 4 · Not selected

**Send when:** a candidate is not advancing, at any stage. Status `Declined`.

Send this one. A candidate who hears nothing assumes the worst about the process
and tells their crew. Send it promptly, and don't pad it.

> **Subject:** AEMT selection — outcome

Hi {{first_name}},

Thanks for applying for the AEMT cohort, and for the time you put into
{{stage_completed}}.

We're not able to offer you a seat this time. The field was strong and there are
only a handful of places.

This isn't a mark against your record and it doesn't affect your standing here
in any way. We run this cohort again, and applying once doesn't count against
you applying next time — several people get in on a second go.

If you'd like to know how you scored and what would strengthen a future
application, reply and I'll set up a conversation. That offer is genuine; take
it up if it'd be useful.

[[ PROGRAM MANAGER ]]
[[ CONTACT ]]

---

## Where each number comes from

Everything factual in these templates is transcribed from program data. If one
of these changes, this document is stale.

| Claim in the email | Source |
|---|---|
| 50 questions, 25 minutes, one sitting | `src/lib/exam.ts` — `EXAM_LIMIT_MINUTES`, and the bank/draw in the exam migration |
| Exam deadline | `src/lib/exam.ts` — `EXAM_DEADLINE.display` (weekday is derived, never typed) |
| 40 / 30 / 20 / 10 weighting | `src/data/aemtSelection.ts` — `SELECTION_WEIGHTS` |
| +5 FTO, +3 additional duty | `BONUS_TIERS` |
| 70 composite, 70% exam, 18/30 interview | `THRESHOLDS` |
| Six interview questions, two interviewers | `INTERVIEW_QUESTIONS`, `docs/aemt-selection-interview.md` |
| "Leave the seat empty" | `docs/aemt-selection-interview.md` |
| Kansas EMT current, good standing, availability | `ELIGIBILITY_GATES` |
| What we never ask | `PROHIBITED_TOPICS` |
| 110 / 50 / 72 / 144 hours, 376 total | `src/data/aemt.ts` — `KC_HOUR_TARGETS`, `KC_TOTAL_TARGET` |
| 16 weeks, Tue/Thu, PALS week 5, ACLS week 7 | `KC_BLOCK_PLAN` |
| 8-hour absence limit | `MAX_ABSENT_HOURS` |
| 80% to pass; 60% exams / 40% quizzes | `MIN_PASSING_PERCENT`, `GRADING` |
| Clinical minimums | `CLINICAL_REQUIREMENTS` — the seven with `basis: 'kar'` |
| Sites | `CLINICAL_REQUIREMENTS[].site` |

**One number to watch.** The email quotes **110 didactic hours**, which is what
the proposal's §2 summary commits to and what `KC_DEFAULT_TARGETS` files. The
proposal's own §3 content schedule only sums to **90**, so a schedule built from
the bundled 16-week plan lands 20 hours short of what this email promises. The
Sessions tab flags that gap. Close it before the first cohort reads this, or
change the number here.
