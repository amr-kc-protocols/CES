// ---------------------------------------------------------------------------
// NEOP selection exam — the question bank.
//
// THIS FILE IS NOT IN src/, AND MUST NOT BE. It carries the answer key. The
// whole design of the exam is that the bank and the key live in the database
// and are never sent to a candidate's browser; a bank imported from src/ would
// be bundled into the app and shipped to every candidate as part of the page
// that asks them the questions. Anything in here reaches the browser only via
// exam_start, which strips the answers.
//
// scripts/gen-neop-exam.mjs turns this into supabase/neop_exam_questions_seed.sql.
// scripts/check-neop-exam.mjs checks it against the briefing and the interview
// instrument. Run `npm run check:neop` after any edit.
//
// THE THREE SECTIONS ARE DIFFERENT KINDS OF QUESTION — see the reasoning in
// src/data/neopSelection.ts.
//
//   clinical    EMT scope on purpose. EMT and paramedic applicants sit the
//               same section, and a paramedic-only item would mark an EMT down
//               for the certification they hold rather than the work they'd do.
//
//   operations  Every item names the briefing section it comes from. That
//               `ref` is enforced: an operations item whose answer is not in
//               the briefing tests whether somebody already works here.
//
//   fit         NO ANSWER KEY, and none is possible. `answer: null` is what
//               makes the item unscored all the way down — the column is
//               nullable, `scored` is generated from it in the database, and
//               exam_submit skips it. There is no arrangement of edits to this
//               file that quietly turns a preference item into a graded one.
//
// House rules for items, learned from the AEMT bank's reviewer pass:
//   - Exactly four options. One defensible answer, three plainly wrong ones.
//   - No "all of the above", no negatives ("which is NOT"), no trick stems.
//   - Nothing whose correct answer depends on a protocol that can change.
//   - `code` is stable and unique. Corrections key on it; never reuse one.
// ---------------------------------------------------------------------------

/** EMT-scope patient care. Draw: 12. */
export const CLINICAL = [
  {
    code: 'clin-deteriorates',
    domain: 'Transport care',
    stem: 'Twenty minutes into a transport your patient becomes unresponsive. Your first action is to:',
    options: [
      'call the receiving facility for instructions',
      'check the airway and breathing',
      'note the time in your report',
      'ask your partner to drive faster',
    ],
    answer: 1,
  },
  {
    code: 'clin-trend',
    domain: 'Assessment',
    stem: "Over three sets of vitals your patient's systolic blood pressure has fallen from 130 to 118 to 104, and the pulse has risen each time. The right reading of this is:",
    options: [
      'nothing to act on until a reading is actually abnormal',
      'a trend that matters now, and is worth acting on and reporting early',
      'a normal response to the movement of the vehicle',
      'evidence that the cuff size is wrong',
    ],
    answer: 1,
  },
  {
    code: 'clin-unstable-reassess',
    domain: 'Assessment',
    stem: 'An unstable patient should be reassessed at least every:',
    options: ['5 minutes', '15 minutes', '30 minutes', 'once on arrival'],
    answer: 0,
  },
  {
    code: 'clin-avpu',
    domain: 'Assessment',
    stem: 'AVPU is used to assess:',
    options: [
      'pupil size and reaction',
      'level of consciousness',
      'skin color and temperature',
      'the severity of pain',
    ],
    answer: 1,
  },
  {
    code: 'clin-early-shock',
    domain: 'Assessment',
    stem: 'Early (compensated) shock in an adult typically presents as:',
    options: [
      'a low blood pressure with a slow pulse',
      'a fast pulse and pale, cool skin with a blood pressure still in range',
      'warm, flushed skin with a slow pulse',
      'no change at all until the patient collapses',
    ],
    answer: 1,
  },
  {
    code: 'clin-position-resp',
    domain: 'Airway',
    stem: 'A conscious patient in respiratory distress, with no trauma, is best transported:',
    options: ['flat on their back', 'head-down', 'sitting upright', 'face-down'],
    answer: 2,
  },
  {
    code: 'clin-hypoxia',
    domain: 'Airway',
    stem: 'Hypoxia is best defined as:',
    options: [
      'too much carbon dioxide in the blood',
      'inadequate oxygen at the tissue level',
      'a raised respiratory rate',
      'a low circulating blood volume',
    ],
    answer: 1,
  },
  {
    code: 'clin-nrb-flow',
    domain: 'Airway',
    stem: 'A non-rebreather mask should be run at a flow rate of:',
    options: ['2 L/min', '4 to 6 L/min', '12 to 15 L/min', '25 L/min'],
    answer: 2,
  },
  {
    code: 'clin-pulseox-co',
    domain: 'Airway',
    stem: 'A pulse oximeter can read falsely high in a patient who has:',
    options: [
      'a fever',
      'been exposed to carbon monoxide',
      'received supplemental oxygen',
      'a fast heart rate',
    ],
    answer: 1,
  },
  {
    code: 'clin-copd-oxygen',
    domain: 'Airway',
    stem: 'A patient with a long history of COPD is clearly hypoxic. You should:',
    options: [
      'withhold oxygen because of the COPD history',
      'give oxygen and titrate it to their oxygen saturation',
      'give oxygen only if they ask for it',
      'wait until arrival and let the receiving facility decide',
    ],
    answer: 1,
  },
  {
    code: 'clin-suction',
    domain: 'Airway',
    stem: 'A patient on your cot vomits and is unable to clear it. Your first action is to:',
    options: [
      'raise the head of the cot and continue',
      'clear the airway with suction and position the patient to protect it',
      'give oxygen by non-rebreather',
      'document the time and notify the receiving nurse',
    ],
    answer: 1,
  },
  {
    code: 'clin-glucose',
    domain: 'Medical',
    stem: 'A patient becomes confused and sweaty during a transport. The most rapidly correctable cause to check for is:',
    options: ['a stroke', 'a low blood glucose', 'a brain tumour', 'a migraine'],
    answer: 1,
  },
  {
    code: 'clin-anaphylaxis',
    domain: 'Medical',
    stem: 'Hives, wheezing and a falling blood pressure shortly after a medication is given indicate:',
    options: [
      'an anxiety attack',
      'anaphylaxis',
      'a fainting episode',
      'a normal reaction to a first dose',
    ],
    answer: 1,
  },
  {
    code: 'clin-stroke-lkw',
    domain: 'Medical',
    stem: 'For a stroke patient being transferred for treatment, the single time the receiving team most needs from you is:',
    options: [
      'when the transfer was requested',
      'when the patient was last known well',
      'when you arrived at the sending facility',
      'when the vital signs were last taken',
    ],
    answer: 1,
  },
  {
    code: 'clin-lines-before-move',
    domain: 'Moving patients',
    stem: 'Before moving a patient from a hospital bed onto your cot, you should:',
    options: [
      'disconnect every line so nothing can catch',
      'check that every line, tube and drain is free and long enough for the move',
      'move first and sort the lines out once the patient is across',
      'ask the patient to hold their own lines',
    ],
    answer: 1,
  },
  {
    code: 'clin-heavy-lift',
    domain: 'Moving patients',
    stem: 'A patient is heavier than the two of you can move safely. The right thing to do is:',
    options: [
      'move quickly with the two of you to limit the strain',
      'get more hands and the right transfer equipment, even though it delays departure',
      'ask the patient to take their own weight',
      'drag the patient across on the bed sheet',
    ],
    answer: 1,
  },
  {
    code: 'clin-straps',
    domain: 'Moving patients',
    stem: 'A patient is being transported on the cot. The cot straps should be:',
    options: [
      'all fastened, including the shoulder straps, for the whole transport',
      'fastened only across the waist so the patient can sit up',
      'left loose for a short trip',
      'fastened only if the patient is unresponsive',
    ],
    answer: 0,
  },
  {
    code: 'clin-confused-cot',
    domain: 'Moving patients',
    stem: 'You are moving a confused patient from a nursing facility. The most important safety measure is:',
    options: [
      'to keep the patient restrained at the wrists',
      'to keep the rails up, the straps secured, and the patient never left unattended',
      'to transport with a family member at the head of the cot',
      'to sedate the patient before departure',
    ],
    answer: 1,
  },
  {
    code: 'clin-precautions',
    domain: 'Infection control',
    stem: 'A patient is on contact precautions at the sending facility. During and after the transport you should:',
    options: [
      'use the same precautions the facility uses, and disinfect the cot and equipment afterwards',
      'treat the transport normally, since precautions apply only in the building',
      'use a mask alone',
      'ask the facility to send the patient without any precautions',
    ],
    answer: 0,
  },
  {
    code: 'clin-report-received',
    domain: 'Handover',
    stem: 'You are taking report from the sending nurse on an ICU patient. The most useful question you can add is:',
    options: [
      'how long the patient has been in the hospital',
      'what has changed in the last hour, and what they are worried about',
      'who the admitting physician was',
      'whether the family has been notified',
    ],
    answer: 1,
  },
  {
    code: 'clin-handover-give',
    domain: 'Handover',
    stem: 'At the receiving facility, your verbal handover should always include:',
    options: [
      'only what has changed since the sending facility called',
      'the patient, why they were transferred, and anything that changed during the transport',
      'the route you took and the transport time',
      'nothing — the written report covers it',
    ],
    answer: 1,
  },
  {
    code: 'clin-dnr-paperwork',
    domain: 'Documentation',
    stem: 'A patient with a valid do-not-resuscitate order is being transferred. Before leaving the sending facility you should make sure that:',
    options: [
      'the order is left at the sending facility',
      'the original order travels with the patient',
      'the order is void once the patient is in your care',
      'the family carries the order separately',
    ],
    answer: 1,
  },
  {
    code: 'clin-chart-timing',
    domain: 'Documentation',
    stem: 'The best time to write your patient care report is:',
    options: [
      'at the end of the shift, when all the calls can be written together',
      'as soon as practical after the transport, while the detail is accurate',
      'only if something went wrong',
      'before the transport, so it is ready',
    ],
    answer: 1,
  },
  {
    code: 'clin-chart-honest',
    domain: 'Documentation',
    stem: 'You realize on arrival that you missed a set of vital signs during a long transport. Your report should:',
    options: [
      'record what was actually done, including the gap',
      'estimate the missing set from the readings either side',
      'leave the section blank with no comment',
      'record the set taken on arrival at the earlier time',
    ],
    answer: 0,
  },
  {
    code: 'clin-oxygen-supply',
    domain: 'Equipment',
    stem: 'Before setting off on a two-hour transport with a patient on oxygen, you should confirm that:',
    options: [
      'the cylinder is above half full',
      'there is enough oxygen for the expected journey plus a reserve for delays',
      'a spare mask is on board',
      'the receiving facility has oxygen available',
    ],
    answer: 1,
  },
  {
    code: 'clin-equipment-check',
    domain: 'Equipment',
    stem: 'Equipment on the truck should be checked:',
    options: [
      'at the start of every shift, before it is needed',
      'when a call comes in for a patient who needs it',
      'weekly, by the crew assigned to the truck',
      'only after it has been used',
    ],
    answer: 0,
  },
]

/** Comprehension of the briefing in src/data/kcOperation.ts. Draw: 16. */
export const OPERATIONS = [
  {
    code: 'ops-primary-work',
    ref: 'what-we-do',
    stem: "AMR Kansas City's primary work is:",
    options: [
      'responding to 911 calls across the metro',
      'moving patients between healthcare facilities',
      'standby cover at public events',
      'air ambulance and flight transport',
    ],
    answer: 1,
  },
  {
    code: 'ops-transport-kinds',
    ref: 'what-we-do',
    stem: 'Alongside hospital-to-hospital work, this operation is also called on for:',
    options: [
      'search and rescue',
      'bariatric transports and long-distance moves well outside the metro',
      'air ambulance transfers',
      'home health visits',
    ],
    answer: 1,
  },
  {
    code: 'ops-normal-call',
    ref: 'what-we-do',
    stem: 'Which of these is a normal call for this operation?',
    options: [
      'a multi-vehicle collision on the highway',
      'an ICU patient moving to a hospital that can do something the sending one cannot',
      'a cardiac arrest called in from a private residence',
      'a stabbing outside a bar at closing time',
    ],
    answer: 1,
  },
  {
    code: 'ops-geography',
    ref: 'what-we-do',
    stem: 'The Kansas City operation works:',
    options: [
      'in Missouri only',
      'in Kansas only',
      'on both sides of the state line, in Missouri and Kansas',
      'anywhere in the two states, dispatched from a single hospital',
    ],
    answer: 2,
  },
  {
    code: 'ops-volume',
    ref: 'what-we-do',
    stem: 'The operation runs roughly how many transports a month?',
    options: ['about a hundred', 'about a thousand', 'about ten thousand', 'it varies too much to say'],
    answer: 1,
  },
  {
    code: 'ops-already-a-patient',
    ref: 'what-we-do',
    stem: 'When you arrive at the sending facility, the patient has usually already been:',
    options: [
      'assessed and diagnosed, and started on a plan by a physician you will not meet',
      'discharged from the care of the sending facility',
      'assessed by the crew who transported them in',
      'left for you to work up from the beginning',
    ],
    answer: 0,
  },
  {
    code: 'ops-scene-calls',
    ref: 'not-911',
    stem: 'Day to day, 911 scene calls on this operation are:',
    options: [
      'the majority of the work',
      'a few every shift, mixed in among the transfers',
      'not what the job is made of — the exceptions are event standby and mutual aid when a neighboring 911 system asks',
      'given to crews once they have been released from field training',
    ],
    answer: 2,
  },
  {
    // Added after the operation's public service list turned up standby and
    // mutual-aid work. The briefing used to claim no scene response at all,
    // which would have marked a candidate who had read our own web page wrong
    // — and told them, on the way in, that we do not know our own operation.
    code: 'ops-standby-aid',
    ref: 'not-911',
    stem:
      'Standby coverage at the Kansas Speedway, and responding on mutual aid when a neighboring 911 system asks for help:',
    options: [
      'are the main work of this operation',
      'both happen, and both are the exception rather than what a shift is made of',
      'are handled by a different company',
      'are how crews transfer onto a 911 operation',
    ],
    answer: 1,
  },
  {
    code: 'ops-lights-sirens',
    ref: 'not-911',
    stem: 'Emergency lights and sirens on this operation are:',
    options: [
      'used on most transports',
      'the exception — most transports are made at ordinary road speed',
      'used whenever the patient is on a ventilator',
      'not carried on the trucks',
    ],
    answer: 1,
  },
  {
    code: 'ops-known-before',
    ref: 'not-911',
    stem: 'Before you touch the truck, you will usually know:',
    options: [
      'nothing beyond an address',
      'the diagnosis, what is infusing or attached, and where the patient is going',
      'the patient name only',
      'whichever details the family has given dispatch',
    ],
    answer: 1,
  },
  {
    code: 'ops-the-risk',
    ref: 'not-911',
    stem: 'The briefing describes the main risk of this job as:',
    options: [
      'not knowing what you will find when you arrive',
      'being solely responsible for an already-sick, complicated patient in a moving truck, with no help arriving',
      'the number of miles driven each shift',
      'exposure to violence at the roadside',
    ],
    answer: 1,
  },
  {
    code: 'ops-patient-types',
    ref: 'patients',
    stem: 'Which describes the patients this operation routinely moves?',
    options: [
      'mostly walking patients going to appointments',
      'patients on ventilators, sedation and infusions, alongside stable patients going home',
      'trauma patients straight from the roadside',
      'newborns only',
    ],
    answer: 1,
  },
  {
    code: 'ops-mcs-teams',
    ref: 'patients',
    stem: 'Patients on mechanical circulatory support — a balloon pump, Impella or ECMO:',
    options: [
      'are managed by our crew alone once the doors close',
      'are familiar to our crews and travel with their own specialist teams',
      'are never moved by ground ambulance',
      'are the most common patient we transport',
    ],
    answer: 1,
  },
  {
    code: 'ops-stable-majority',
    ref: 'patients',
    stem: 'Stable patients — the ones who need a safe ride and decent manners and nothing else — are:',
    options: [
      'a small share of the work',
      'most of the work',
      'handled by a separate wheelchair service',
      'transported only on weekends',
    ],
    answer: 1,
  },
  {
    code: 'ops-vent-expectation',
    ref: 'skills',
    stem: 'A Kansas City paramedic is expected to:',
    options: [
      'manage the transport ventilator, not simply watch it',
      'leave ventilator settings to the sending respiratory therapist',
      'transport vented patients only with a nurse on board',
      'switch every vented patient to a bag-valve mask for the trip',
    ],
    answer: 0,
  },
  {
    code: 'ops-injury-source',
    ref: 'skills',
    stem: 'According to the briefing, injuries in this job come most often from:',
    options: ['violent patients', 'lifting and moving patients', 'road collisions', 'needlesticks'],
    answer: 1,
  },
  {
    code: 'ops-report-skill',
    ref: 'skills',
    stem: 'Taking report from an ICU nurse well means:',
    options: [
      'writing down what you are given and leaving promptly',
      'getting the report and asking the questions it did not answer',
      'asking the nurse to repeat it so it can be recorded word for word',
      'waiting for the physician to give it instead',
    ],
    answer: 1,
  },
  {
    code: 'ops-chart-justifies',
    ref: 'skills',
    stem: 'An interfacility patient care report has to establish:',
    options: [
      'how long the transport took',
      'why this patient needed an ambulance and this level of care',
      'which crew members were on the truck',
      'the route driven between the two facilities',
    ],
    answer: 1,
  },
  {
    code: 'ops-qa-sampling',
    ref: 'skills',
    stem: 'Our charts are reviewed:',
    options: [
      'only when a complaint is made',
      'about a fifth of them, every month, against a written rubric',
      'once a year at appraisal',
      'by the receiving facility rather than by us',
    ],
    answer: 1,
  },
  {
    code: 'ops-paperwork-warning',
    ref: 'skills',
    stem: 'The briefing says that an applicant who dislikes paperwork:',
    options: [
      'will get used to it within a few months',
      'is looking at the wrong operation, because here documentation is part of the clinical work',
      'can have charts written by their partner',
      'should apply as an EMT rather than a paramedic',
    ],
    answer: 1,
  },
  {
    code: 'ops-waiting',
    ref: 'shift',
    stem: 'Waiting — at a bedside for a nurse, or at the receiving end for a bed assignment — is:',
    options: [
      'rare, and a sign something has gone wrong',
      'a normal part of the shift',
      'billed to the sending facility and therefore avoided',
      'grounds for leaving without the patient',
    ],
    answer: 1,
  },
  {
    code: 'ops-long-transports',
    ref: 'shift',
    stem: 'Transport distances on this operation:',
    options: [
      'are all short trips across the metro',
      'range from twenty minutes across town to journeys of hours each way',
      'are capped at one hour by policy',
      'are always within a single county',
    ],
    answer: 1,
  },
  {
    code: 'ops-quiet-shift',
    ref: 'shift',
    stem: 'You finish a shift having moved several patients well and having used none of your emergency skills. The briefing describes that as:',
    options: [
      'a slow day that should be reported to a supervisor',
      'a normal day, and a genuinely useful one',
      'a sign you were assigned the wrong truck',
      'unusual on this operation',
    ],
    answer: 1,
  },
  {
    code: 'ops-guest',
    ref: 'facilities',
    stem: 'On most calls in this operation, in someone else’s ICU or nursing facility, you are:',
    options: [
      'in charge of the scene, as on a 911 call',
      'a guest in their building',
      'responsible for the unit until you leave',
      'there only to collect paperwork',
    ],
    answer: 1,
  },
  {
    code: 'ops-reputation',
    ref: 'facilities',
    stem: 'How a crew behaves in a facility hallway matters because:',
    options: [
      'the facilities score every crew formally each quarter',
      'you will see the same staff every week, and it is most of our reputation',
      'the hallways are monitored by hospital security',
      'it affects the billing for the transport',
    ],
    answer: 1,
  },
  {
    code: 'ops-hallway-sjt',
    ref: 'facilities',
    stem: 'An ICU nurse keeps you waiting forty minutes and is short with you when she finally gives report. The response that fits this operation is to:',
    options: [
      'match her tone so it does not happen again',
      'stay courteous, get the report you need for the patient, and raise any real problem afterwards through your supervisor',
      'say nothing at the time and leave the incident out of the record',
      'call dispatch from the hallway to have the transport reassigned',
    ],
    answer: 1,
  },
  {
    code: 'ops-career-direction',
    ref: 'growth',
    stem: 'The career path the briefing describes runs toward:',
    options: [
      'scene response and rescue work',
      'critical care, field training, education and quality review',
      'dispatch and communications',
      'hospital employment',
    ],
    answer: 1,
  },
  {
    code: 'ops-linn-cass',
    ref: 'growth',
    stem: 'The 911 work this company does in the region is:',
    options: [
      'run out of the Kansas City interfacility trucks',
      'in Linn County, Kansas — a rural 911 operation with two round-the-clock trucks — and Cass County, Missouri, which runs a transport truck of its own',
      'contracted out to another provider',
      'available to Kansas City crews as overtime shifts',
    ],
    answer: 1,
  },
  {
    code: 'ops-not-a-queue',
    ref: 'growth',
    stem: 'Taking a seat here in order to move across to a 911 operation later is:',
    options: [
      'the usual route people take, and it works',
      'not how it works — those are separate operations with their own postings, and nobody moves across by waiting',
      'possible after twelve months of service',
      'decided by seniority each January',
    ],
    answer: 1,
  },
  {
    code: 'ops-say-so',
    ref: 'growth',
    stem: 'If 911 response is the career an applicant actually wants, the briefing asks them to:',
    options: [
      'keep it to themselves until after the probation period',
      'say so — it is a respectable answer, and we would rather hear it now',
      'apply anyway and decide later',
      'withdraw their application',
    ],
    answer: 1,
  },
  {
    code: 'ops-ask-dont-guess',
    ref: 'expect',
    stem: 'On this operation, when you do not know something:',
    options: [
      'asking is the professional behavior and guessing is the dangerous one',
      'you are expected to work it out yourself before asking',
      'you should ask the facility staff rather than your own people',
      'it is best raised after the transport, in the report',
    ],
    answer: 0,
  },
  {
    code: 'ops-honest-chart',
    ref: 'expect',
    stem: 'The standard the briefing sets for your documentation is that it is:',
    options: [
      'complete enough to satisfy billing',
      'honest, including the parts that do not flatter you',
      'brief, so the crew stays available',
      'written to match what the sending facility recorded',
    ],
    answer: 1,
  },
  {
    code: 'ops-neop-length',
    ref: 'onboarding',
    stem: 'The New Employee Orientation Program classroom runs:',
    options: [
      'two days, on your first weekend',
      'roughly a week and a half, and is held every other month',
      'six weeks, full time',
      'entirely online, at your own pace',
    ],
    answer: 1,
  },
  {
    code: 'ops-medic-block',
    ref: 'onboarding',
    stem: 'Paramedics coming into Kansas City add which block to the standard orientation?',
    options: [
      'rescue and extrication',
      'ventilator management, and vasopressor and sedative infusions',
      'dispatch and radio operations',
      'community paramedicine',
    ],
    answer: 1,
  },
  {
    code: 'ops-release',
    ref: 'onboarding',
    stem: 'You are released to work as a crew member:',
    options: [
      'on a fixed date at the end of orientation',
      'after roughly twenty to thirty patient contacts, when your field training officer signs you off',
      'once you have completed ninety days',
      'as soon as the classroom week finishes',
    ],
    answer: 1,
  },
]

/**
 * Preference items. `answer: null` — unscored, permanently.
 *
 * Every candidate is served all of them (no draw), because an interviewer
 * comparing two candidates needs them to have been asked the same questions.
 * The interview probe and the reading of each option live in
 * src/data/neopSelection.ts, positionally by option order — if you reorder the
 * options here, reorder the signals there. check-neop-exam.mjs enforces the
 * count but cannot know your intent about the order.
 */
export const FIT = [
  {
    code: 'fit-future',
    stem: 'Three years from now, the job you would most want to be doing is:',
    options: [
      'interfacility and critical-care transport — the work described above',
      '911 scene response, at a fire department or a municipal EMS service',
      'a hospital, clinic or flight role, with EMS as the step toward it',
      'I do not know yet — I want to see more of the work first',
    ],
    answer: null,
  },
  {
    code: 'fit-draw',
    stem: 'What drew you to EMS in the first place?',
    options: [
      'emergencies — being the person who goes toward them',
      'looking after sick people, wherever they happen to be',
      'a stable job with a schedule and somewhere to go in it',
      'it is a step toward another healthcare career',
    ],
    answer: null,
  },
  {
    code: 'fit-shift',
    stem: 'Which shift would you rather work?',
    options: [
      'eleven quiet hours and one cardiac arrest',
      'five stable transfers with drips and a ventilator, and nothing that goes wrong',
      'whichever one pays the same — I have no preference',
      'back-to-back calls all shift, whatever they turn out to be',
    ],
    answer: null,
  },
  {
    code: 'fit-tradeoff',
    stem: 'If you had to give one of these up, which would you give up more easily?',
    options: [
      'running emergencies',
      'working with critically ill patients',
      'neither — I want both, and I know I cannot have both here',
      'either one, if the schedule and the pay are right',
    ],
    answer: null,
  },
  {
    code: 'fit-911-offer',
    stem: 'Six months in, a 911 position opens at another service at the same pay. You:',
    options: [
      'take it — 911 is the work I want',
      'stay — this is the work I want to be doing',
      'look at it, but expect to stay if things are going well here',
      'decide on the schedule and the money',
    ],
    answer: null,
  },
  {
    code: 'fit-honest',
    stem: 'Being honest: how much of your interest in this job is that it is the opening available right now?',
    options: [
      'none — this is the job I want',
      'some — but the work itself interests me',
      'a lot — I need a job, and this is the one that is open',
      'hard to say',
    ],
    answer: null,
  },
  {
    code: 'fit-least',
    stem: 'Which part of this job do you expect to like least?',
    options: [
      'the waiting — at bedsides, and for bed assignments',
      'the documentation',
      'not using emergency skills often',
      'the long transports',
    ],
    answer: null,
  },
  {
    code: 'fit-paperwork',
    stem: 'On documentation, the statement closest to you is:',
    options: [
      'it is the part of the job I would have to make myself do',
      'it is part of patient care, and I would rather be good at it',
      'I am quick at it and I keep it short',
      'I have not done much of it yet',
    ],
    answer: null,
  },
  {
    code: 'fit-alone',
    stem: 'Being alone in the back with a complicated but stable patient for forty-five minutes is:',
    options: [
      'the part I would find hardest',
      'the part I would find most rewarding',
      'neither — it does not concern me either way',
      'something I would want more training on before I was comfortable with it',
    ],
    answer: null,
  },
  {
    code: 'fit-experience',
    stem: 'Which best describes your EMS experience so far?',
    options: [
      'none yet — I am new to it',
      '911 or scene work only',
      'interfacility or transport work',
      'both scene and transport work',
    ],
    answer: null,
  },
  {
    code: 'fit-stay',
    stem: 'If you took this job and it went well, how long would you expect to be here?',
    options: [
      'under a year',
      'a year or two',
      'three years or more',
      'as long as it suits both of us',
    ],
    answer: null,
  },
]

export const SECTION_ITEMS = {
  clinical: CLINICAL,
  operations: OPERATIONS,
  fit: FIT,
}
