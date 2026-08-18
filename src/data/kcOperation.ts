// ---------------------------------------------------------------------------
// What Kansas City interfacility actually is — the candidate briefing.
//
// This is a realistic job preview, and it exists because of a pattern the oral
// interviews keep finding: applicants who want a 911 career apply here, take a
// seat, and leave for a scene service as soon as one opens. That is not
// dishonesty on their part. Most of them have never been told what an
// interfacility operation does all day, so "ambulance" means what they have
// seen on a scene, and they find out what this job is after they are hired.
//
// The fix is to say it plainly, before they apply their time to us and before
// we apply ours to them. Everything below is written to be read by somebody
// with no AMR history, and it is deliberately unflattering in places — a
// preview that only sells is not a preview.
//
// IT IS ALSO THE SYLLABUS. Every scored operations item in the selection exam
// keys to a section here by `ref`, and scripts/gen-neop-exam.mjs refuses to
// build the bank if an item references a section that does not exist. An
// operations question whose answer is not in this document is not a test of
// whether a candidate read it; it is a test of whether they already worked
// here, which is the opposite of what this instrument is for.
//
// SOURCES. The operational facts are drawn from what this repository already
// states about the operations: src/data/operations.ts (Kansas City is the
// interfacility critical-care operation at roughly a thousand transports a
// month; Linn County is rural 911 with two 24/7 trucks; Cass County runs a
// single transport truck), src/data/academy.ts (the NEOP curriculum, and the
// ventilator and infusion blocks Kansas City paramedics add), the Field Guide
// registry (LTV 1200 ventilator, hemodynamics, Impella/ECMO and organ
// transport familiarization) and the CQMP measures Kansas City reports.
//
// NEEDS_CONFIRMATION below names the handful of statements that are NOT
// sourced from this repository and that somebody who runs the operation should
// confirm or correct before this goes to an applicant. They are written
// qualitatively on purpose — a number a candidate is given in writing is a
// number they will hold us to.
// ---------------------------------------------------------------------------

export interface BriefingSection {
  /** Stable — exam items key to it. Never renumber or reuse. */
  ref: string
  title: string
  /** Paragraphs, and bullet lists where a list reads better than prose. */
  blocks: (string | { list: string[] })[]
}

export const KC_BRIEFING_TITLE = 'What this job actually is'

export const KC_BRIEFING_INTRO =
  'Read this before you start. The questions about our operation come from it, and it is the same description we will hold ourselves to in your interview. It is honest rather than flattering, because the point is that you can decide whether you want this job before either of us spends any more time on it.'

export const KC_BRIEFING: BriefingSection[] = [
  {
    ref: 'what-we-do',
    title: 'What we do',
    blocks: [
      'AMR Kansas City is an interfacility operation. Our work is moving patients between healthcare facilities — hospital to hospital, hospital to a skilled nursing or rehabilitation facility, hospital to home, and back again. The operation runs on the order of a thousand transports a month across the Kansas City metro, on both sides of the state line, in Missouri and in Kansas.',
      'A normal day is some mix of:',
      {
        list: [
          'ICU to ICU — a critically ill patient moving to a facility that can do something the sending one cannot.',
          'Emergency department to a specialty center — the STEMI, the stroke, the trauma, the patient who needs a service the sending hospital does not have.',
          'Discharges — a patient going home, or to a nursing facility, rehabilitation, long-term acute care or hospice.',
          'Scheduled and recurring transports — dialysis, treatment appointments, procedures.',
          'Behavioral health transfers, and patients under a hold.',
        ],
      },
      'The patient is already someone else’s patient when you arrive. They have been assessed, diagnosed, and started on a plan by a physician you will probably never meet. Your job is to carry that plan intact — and the patient with it — from one bed to another.',
    ],
  },
  {
    ref: 'not-911',
    title: 'What it is not',
    blocks: [
      'We are not a 911 service. Kansas City does not respond to scenes. You will not be dispatched to a wreck, a shooting, or a house where nobody has told you what is waiting inside.',
      'Almost every time, you know exactly what you are getting before you touch the truck: a name, a diagnosis, what is infusing, what is attached, and where it is going. The uncertainty that defines scene work is mostly absent here, and so is the adrenaline that comes with it.',
      'Lights and sirens are the exception, not the rhythm of the job. Most transports are made at ordinary road speed, because the patient is stable and the aim is to keep them that way.',
      'The risk in this job is different rather than smaller. It is not "what will I find." It is "I have a complicated, already-sick patient, alone in the back of a moving truck, for the next forty-five minutes, with the equipment I chose to bring." Nobody is going to arrive to help you at minute twenty.',
    ],
  },
  {
    ref: 'patients',
    title: 'Who your patients are',
    blocks: [
      'Sicker, on average, than the patients a scene truck moves — and sick in a way that is already understood.',
      {
        list: [
          'Patients on a ventilator, sedated, sometimes paralyzed.',
          'Patients on vasopressors, sedatives and other infusions, often several at once.',
          'Post-arrest, post-cardiac-catheterization and fresh post-operative patients.',
          'Patients on mechanical circulatory support — devices such as intra-aortic balloon pumps, Impella and ECMO — which our crews are familiarized with and which travel with their own specialist teams.',
          'Sepsis, GI bleeds, respiratory failure, and the ordinary medical patient having a bad week.',
          'And, in the same shift, a stable patient going home who needs nothing from you but a safe ride and decent manners.',
        ],
      },
      'You will see the whole range on the same day, and the stable ones are not the easy part of the job. They are most of the job.',
    ],
  },
  {
    ref: 'skills',
    title: 'What you have to be good at',
    blocks: [
      'The clinical skills that matter most here are the ones that keep an already-managed patient stable in a moving vehicle, not the ones that resuscitate an unknown patient on a floor.',
      {
        list: [
          'Ventilator management. Kansas City paramedics train on the transport ventilator and are expected to manage it, not to watch it.',
          'Infusions — vasopressors, sedatives and the pumps that deliver them.',
          'Monitoring, hemodynamics, and knowing early when a stable patient has stopped being stable.',
          'Taking a real report from an ICU nurse, and asking the questions that report did not answer.',
          'Moving a human being safely — bed to cot, cot to bed, through elevators, doorways and hallways, with lines, tubes and drains attached. Injuries in this job come from lifting far more often than from patients.',
        ],
      },
      'And documentation, which candidates consistently underrate. An interfacility transport has to be justified as well as performed: the chart has to establish why this patient needed an ambulance and this level of care, and it has to stand up months later when someone reads it who was not there. We review a fifth of our charts every month against a written rubric. If you dislike paperwork, this is the wrong operation, because here the paperwork is part of the clinical work rather than an afterthought to it.',
    ],
  },
  {
    ref: 'shift',
    title: 'What a shift feels like',
    blocks: [
      'Long stretches of ordinary. Waiting at a bedside for a nurse who is in the middle of something else. Waiting on a bed assignment at the receiving end. Paperwork between calls. A meal in the truck.',
      'Some transports are twenty minutes across town. Others are long — hours each way, a lot of it on a highway with a patient who needs nothing from you except that you notice immediately if that changes.',
      'You will finish shifts having moved several patients well, having used none of your emergency skills, and having been genuinely useful all day. If a day like that feels like a day wasted, this job will wear on you, and that is worth knowing about yourself now rather than in your fourth month.',
    ],
  },
  {
    ref: 'facilities',
    title: 'You work inside other people’s buildings',
    blocks: [
      'On a scene call you are in charge. Here you are, most of the time, a guest — in an ICU, on a med-surg floor, in a nursing facility, standing in a hallway waiting on a nurse who has four other patients.',
      'You will see the same staff at the same facilities every week. How you behave in those hallways is not a small thing: it is most of our reputation, it decides how much cooperation you get on the day something is genuinely wrong with your patient, and it is visible to us because people tell us.',
      'Patience with facility staff, and courtesy that does not depend on how your day is going, are job requirements here in a way they are not everywhere.',
    ],
  },
  {
    ref: 'growth',
    title: 'Where this goes',
    blocks: [
      'The career here runs toward critical care rather than toward scene work. Crews build up ventilator and hemodynamics training, work with the sickest transported patients in the region, and move on into field training officer and preceptor roles, continuing-education instruction, quality review, or the Kansas AEMT course we sponsor for our own EMTs.',
      'We will also be straight with you about the other direction. This company does run 911 in this region — Linn County, Kansas is a rural 911 operation with two round-the-clock trucks, and Cass County, Missouri runs a transport truck of its own. Those are separate operations with their own postings, their own schedules and their own hiring. Working here is not a queue you stand in until a 911 seat opens, and nobody moves across because they waited long enough.',
      'If 911 response is the career you want, say so. It is a completely respectable answer, we would rather hear it now, and in some cases we can point you at where to apply. What does not work for either of us is taking this seat as a place to wait.',
    ],
  },
  {
    ref: 'expect',
    title: 'What we expect',
    blocks: [
      {
        list: [
          'You show up, on time, for the shift you agreed to.',
          'You know your equipment before the patient is on it.',
          'You own your documentation, and it is honest — including the parts that do not flatter you.',
          'You treat facility staff, patients and families decently on the worst day of your week.',
          'You ask when you do not know. On this operation, asking is the professional behavior and guessing is the dangerous one.',
        ],
      },
      'We are hiring for interfacility care. We are looking for people who want to be good at this job, not people willing to tolerate it until something else opens up.',
    ],
  },
  {
    ref: 'onboarding',
    title: 'How you start',
    blocks: [
      'New hires go through our New Employee Orientation Program: roughly a week and a half of classroom, run every other month. It covers safe stretcher operation, emergency vehicle operations, our documentation system, HR and OSHA requirements and the corporate learning modules. Paramedics coming into Kansas City add the critical-care block — ventilator management, and vasopressor and sedative infusions.',
      'After the classroom you ride with a field training officer. You are released to work as a crew member once you have had roughly twenty to thirty patient contacts and your FTO signs you off — not on a fixed date, and not before.',
    ],
  },
]

/**
 * Statements above that this repository cannot source, listed so they are
 * checked by somebody who runs the operation rather than quietly published.
 *
 * They are in the briefing because leaving them out would make it less honest,
 * not more. Correct them here and in the section they appear in; if one turns
 * out to be wrong, check whether an exam item keys to it — see
 * docs/neop-selection-exam.md.
 */
export const NEEDS_CONFIRMATION: { ref: string; claim: string }[] = [
  {
    ref: 'what-we-do',
    claim:
      'The call mix — that discharges, dialysis and behavioral-health transfers all feature alongside ICU and emergency-department transfers.',
  },
  {
    ref: 'not-911',
    claim: 'That Kansas City takes no scene calls at all, rather than very few.',
  },
  {
    ref: 'patients',
    claim:
      'That balloon-pump, Impella and ECMO patients travel with their own specialist teams rather than being managed by our crew alone.',
  },
  {
    ref: 'shift',
    claim:
      'That long-distance transfers of a few hours each way are a normal part of the schedule rather than a rarity.',
  },
  {
    ref: 'growth',
    claim:
      'That there is no internal transfer path from Kansas City into the Linn County or Cass County operations short of applying to a posting.',
  },
]

export function briefingSection(ref: string): BriefingSection | undefined {
  return KC_BRIEFING.find((s) => s.ref === ref)
}

/** Plain text of the whole briefing — for the printable candidate handout. */
export function briefingText(): string {
  const out: string[] = [KC_BRIEFING_TITLE, '', KC_BRIEFING_INTRO, '']
  for (const s of KC_BRIEFING) {
    out.push(s.title.toUpperCase(), '')
    for (const b of s.blocks) {
      if (typeof b === 'string') out.push(b, '')
      else for (const li of b.list) out.push(`  • ${li}`)
      if (typeof b !== 'string') out.push('')
    }
  }
  return out.join('\n')
}
