// ---------------------------------------------------------------------------
// What this role is — the candidate briefing.
//
// NAMING: this operation is "AMR KC" throughout, never "Kansas City", and the
// counties are named without their states. That is the operation's own house
// style for candidate-facing material and it is applied consistently — the
// exam items quote this document, so a rename here without a rename there
// produces a question whose answer is not quite in the reading.
//
// THE TEXT BELOW IS THE OPERATION'S OWN. It was written by the people who run
// KC, and it replaced an earlier draft assembled here from what this
// repository could establish. Edit it with that in mind: the wording is theirs,
// not this file's, and rewriting a sentence to read better is not a
// housekeeping change — it changes what an applicant was told and, for eight of
// the nine sections, what a scored exam item is asking about.
//
// It exists because of a pattern the oral interviews keep finding: applicants
// who want a 911 or fire career apply here, take a seat, and leave for a scene
// service as soon as one opens. That is not dishonesty on their part. Most have
// never been told what an interfacility operation does all day, so "ambulance"
// means what they have seen on a scene, and they find out what this job is
// after they are hired. Saying it plainly, before they apply their time to us
// and before we apply ours to them, is the cheapest fix available — and some
// applicants will read it and withdraw, which is the point rather than a cost.
//
// IT IS ALSO THE SYLLABUS. Every scored operations item in the selection exam
// keys to a section here by `ref`, and scripts/gen-neop-exam.mjs refuses to
// build the bank if an item references a section that does not exist. An
// operations question whose answer is not in this document is not a test of
// whether a candidate read it; it is a test of whether they already worked
// here, which is the opposite of what this instrument is for.
//
// SO WHEN A SECTION CHANGES, CHECK THE ITEMS THAT KEY TO IT. That is not
// theoretical: this revision alone moved two answers. The briefing used to say
// an applicant who dislikes paperwork is looking at the wrong operation, and
// now says they do not have to enjoy it but must take it seriously — a
// candidate who read carefully would have been marked wrong by the old item.
// docs/neop-comprehension-exam.md lists which items key to which section.
// ---------------------------------------------------------------------------

export interface BriefingSection {
  /** Stable — exam items key to it. Never renumber or reuse. */
  ref: string
  title: string
  /** Paragraphs, and bullet lists where a list reads better than prose. */
  blocks: (string | { list: string[] })[]
}

export const KC_BRIEFING_TITLE = 'What This Role Is and What It Requires'

export const KC_BRIEFING_INTRO = [
  'Please read this before continuing. Several questions in the selection process come directly from it, and these are the same expectations we will use during your interview.',
  'This is not a general description of ambulance work. It is an honest description of this operation and what we ask of the people selected to join it.',
  'The work is often quiet, sometimes highly complex, and always dependent on consistency. We do not expect this role to appeal to everyone. We are looking for people who understand its value and want to become genuinely good at it.',
]

export const KC_BRIEFING: BriefingSection[] = [
  {
    ref: 'what-we-do',
    title: 'What we do',
    blocks: [
      'AMR KC is an interfacility operation that handles everything from routine discharges to complex critical-care transfers. We move patients between hospitals, specialty centers, rehabilitation facilities, skilled nursing facilities, long-term acute care hospitals, hospice, and home.',
      'Our crews complete roughly 1,000 transports each month across the KC metro, on both sides of the state line.',
      'A typical shift may include:',
      {
        list: [
          'An ICU patient moving to another ICU because the receiving hospital can provide care the sending facility cannot.',
          'A patient leaving an emergency department for a STEMI, stroke, trauma, or other specialty center.',
          'A patient being discharged home or going to a skilled nursing facility, rehabilitation center, long-term acute care hospital, or hospice.',
          'Scheduled and recurring transports for dialysis, treatments, and procedures.',
          'Behavioral health transfers, including patients being transported under a hold.',
          'Bariatric and long-distance transports, sometimes well outside the metro.',
        ],
      },
      'Most patients have already been assessed, diagnosed, and started on a treatment plan before we arrive. Our responsibility is to understand that plan, continue it safely, recognize when something changes, and deliver both the patient and an accurate handoff to the next care team.',
      'For the time that patient is with us, their care is in our hands. That responsibility is easy to underestimate. We do not underestimate it.',
    ],
  },
  {
    ref: 'not-911',
    title: 'What this job is not',
    blocks: [
      'This is not a traditional 911 assignment. You will not spend most of your shift responding to crashes, shootings, or homes where nobody knows what is waiting inside.',
      'We do provide planned medical coverage at major events, including races at the Speedway and other regional gatherings. We also respond through mutual aid when a neighboring 911 system needs assistance. Those calls are real, but they are not what defines this position and they are not a side door into a 911 role.',
      'On most calls, you will know the patient’s name, diagnosis, medications, medical devices, and destination before the ambulance begins moving. There is less uncertainty than on a scene call, but that does not lower the standard. It changes where the responsibility lies.',
      'The question is usually not, “What am I walking into?” It is, “What could change during this trip, and am I prepared for it?”',
      'Lights and sirens are the exception. Most transports happen at normal road speed because the patient is stable and our job is to keep them that way.',
      'Once the doors close, the clinician in the back may be responsible for a medically complex patient for 45 minutes or longer. Additional help may not be immediately available. The equipment you checked, the questions you asked, and the decisions you made before leaving the facility matter.',
    ],
  },
  {
    ref: 'patients',
    title: 'Who your patients are',
    blocks: [
      'Our patients range from stable to critically ill, sometimes within the same shift. You may care for:',
      {
        list: [
          'Patients on a ventilator who are sedated and sometimes paralyzed.',
          'Patients receiving vasopressors, sedatives, or several infusions at once.',
          'Post-cardiac-arrest, post-cardiac-catheterization, and fresh postoperative patients.',
          'Patients receiving mechanical circulatory support through devices such as an intra-aortic balloon pump, Impella, or ECMO.',
          'Patients with sepsis, gastrointestinal bleeding, respiratory failure, and other acute medical conditions.',
          'A stable patient going home who needs no intervention, but still needs safe movement, appropriate monitoring, and to be treated with dignity.',
        ],
      },
      'The range is part of what defines this operation. The stable transports are not filler between the important calls. They are a major part of the job, and they matter to the person on the stretcher.',
      'We expect the routine patient to receive the same attention and professionalism as the critical one.',
    ],
  },
  {
    ref: 'skills',
    title: 'What you need to be good at',
    blocks: [
      'Strong interfacility clinicians are prepared, observant, and consistent. They understand the treatment plan they are continuing, recognize when it is no longer working, and know what they can manage independently.',
      'The clinical skills that matter most here include:',
      {
        list: [
          'Managing a transport ventilator. KC paramedics train on the ventilator and are expected to manage it, not simply watch it.',
          'Managing vasopressors, sedatives, other infusions, and the pumps that deliver them.',
          'Understanding monitoring and hemodynamics, and recognizing early when a stable patient is no longer stable.',
          'Receiving a thorough report and asking the questions that have not yet been answered.',
          'Moving patients safely from bed to cot, cot to bed, and through elevators, doorways, and hallways while protecting every line, tube, drain, and device.',
        ],
      },
      'The physical side of the job also matters. Our injuries come from lifting and moving patients far more often than from dramatic patient-care events.',
      'Documentation is another part of the standard. A good chart must explain what you did, why the patient needed an ambulance, and why that level of care was appropriate. It may be reviewed months later by someone who was not present.',
      'We review approximately one in every five charts each month against a written rubric. You do not have to enjoy paperwork, but you must take it seriously. Here, documentation is part of the clinical work and the continuity of care.',
      'We can train people on our equipment and processes. What we need them to bring is reliability, sound judgment, intellectual honesty, and a willingness to ask when they do not know.',
    ],
  },
  {
    ref: 'shift',
    title: 'What a shift feels like',
    blocks: [
      'Some parts of a shift are ordinary. You may wait at a bedside while a nurse finishes another task, wait for a room assignment at the receiving facility, complete documentation between calls, or eat a meal in the ambulance.',
      'Some transports take 20 minutes. Others take several hours each way, much of it on the highway with a patient who needs little from you except careful observation and an immediate response if that changes.',
      'On many shifts, doing the job well means nothing dramatic happened. You moved several people safely, kept their medications and equipment working, noticed what needed to be noticed, documented the care, and handed each patient over properly.',
      'That kind of work does not always produce a good story at the end of the day. It does require discipline and sustained attention. Those qualities are less visible than a dramatic intervention, but they are what keep patients safe.',
      'If a shift only feels worthwhile when you use emergency procedures, this role will probably not be a good fit. If you can take pride in doing routine things exceptionally well while remaining ready for the moment they stop being routine, you may belong here.',
    ],
  },
  {
    ref: 'facilities',
    title: 'You work inside other people’s buildings',
    blocks: [
      'On a scene call, the EMS crew often controls the environment. In this role, you are usually working as a guest in someone else’s workplace. You may be in an ICU, on a medical-surgical floor, or in a nursing facility hallway waiting for a nurse who is responsible for several other patients.',
      'You will see many of the same people at the same facilities each week. Our reputation is built through those everyday interactions. It also affects the cooperation we receive when something is genuinely wrong with a patient.',
      'Most of the time, no supervisor will be standing beside you. We need to be able to trust how you will treat patients, families, and facility staff when no one from AMR is in the room.',
      'Courtesy is not simply about appearances. It supports patient care and is part of the job.',
    ],
  },
  {
    ref: 'growth',
    title: 'Where this can lead',
    blocks: [
      'This operation has a deliberate clinical direction. Professional development here generally leads toward critical-care transport rather than scene response.',
      'Crews build their ventilator and hemodynamic skills, work with some of the region’s most medically complex transport patients, and may move into roles such as field training officer, preceptor, continuing-education instructor, or quality reviewer. We also sponsor a state-approved AEMT course for our EMTs.',
      'Those opportunities are earned through clinical performance, dependable work, strong documentation, and the trust of the people working beside you. They are not based only on time in the position.',
      'The company also operates 911 services elsewhere in the region. Linn County is a rural 911 operation with two around-the-clock ambulances, and Cass County operates its own transport unit. Those are separate operations with their own positions, schedules, and hiring processes.',
      'If 911 response is your career goal, tell us. That is a completely respectable answer, and we may be able to direct you toward the appropriate place to apply. This position, however, is not a waiting list for a future 911 opening.',
      'Interfacility care is not a lesser version of EMS. It is a different kind of practice, and this role should be chosen for what it is.',
    ],
  },
  {
    ref: 'expect',
    title: 'What we expect',
    blocks: [
      {
        list: [
          'You arrive on time and prepared for the shift you accepted.',
          'You know your equipment before a patient depends on it.',
          'You take responsibility for accurate and honest documentation, including mistakes.',
          'You treat patients, families, partners, and facility staff with respect, even on a difficult day.',
          'You ask questions when you do not know something. Asking is professional; guessing can be dangerous.',
          'You accept feedback, correct errors, and continue developing.',
          'You bring the same level of attention to a routine transport that you bring to a critical one.',
        ],
      },
      'These expectations are straightforward, but meeting them consistently is what separates a dependable clinician from someone who simply occupies a seat.',
      'We are deliberate about whom we place in this role because the trust and independence are real.',
    ],
  },
  {
    ref: 'onboarding',
    title: 'How you start',
    blocks: [
      'New employees begin with our New Employee Orientation Program. It lasts approximately a week and a half and is offered every other month. Training includes safe stretcher operation, emergency vehicle operations, our documentation system, HR and OSHA requirements, and required corporate learning modules.',
      'Paramedics joining the KC operation also complete a critical-care block covering transport ventilator management and vasopressor and sedative infusions.',
      'After the classroom portion, you will work alongside a field training officer. Most new employees complete approximately 20 to 30 patient contacts before being considered for release as an independent crew member.',
      'Release is not automatic and does not happen simply because a fixed date has arrived. It is earned when you have demonstrated that you can perform the work safely, consistently, and with the judgment the role requires.',
      'We invest in the people we select, and we expect them to take that investment seriously.',
    ],
  },
]

/**
 * Statements awaiting confirmation from the operation. Now empty, and that is
 * a real outcome rather than a tidy-up.
 *
 * This list existed because the first draft of the briefing was assembled here
 * from what the repository could establish, and five of its claims could not be
 * sourced — including one that was simply wrong, that this operation responds
 * to no scenes at all. The text above is now the operation's own, written by
 * the people who run it, so there is nothing left for them to confirm.
 *
 * The mechanism stays. If a future edit adds a claim that nobody here can
 * stand behind, put it in this list rather than in the briefing quietly, and
 * check-neop-exam.mjs will keep reporting it until somebody settles it.
 */
export const NEEDS_CONFIRMATION: { ref: string; claim: string }[] = []

export function briefingSection(ref: string): BriefingSection | undefined {
  return KC_BRIEFING.find((s) => s.ref === ref)
}

/** Plain text of the whole briefing — for the printable candidate handout. */
export function briefingText(): string {
  const out: string[] = [KC_BRIEFING_TITLE, '', ...KC_BRIEFING_INTRO.flatMap((p) => [p, ''])]
  for (const s of KC_BRIEFING) {
    out.push(s.title.toUpperCase(), '')
    for (const b of s.blocks) {
      if (typeof b === 'string') out.push(b, '')
      else {
        for (const li of b.list) out.push(`  • ${li}`)
        out.push('')
      }
    }
  }
  return out.join('\n')
}
