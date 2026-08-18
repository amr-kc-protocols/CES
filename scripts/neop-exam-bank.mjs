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
//   clinical    NEWLY-QUALIFIED EMT scope, and nothing above it or beside it:
//               no paramedic content, and nothing specific to interfacility
//               work. It is a floor, not a ranking.
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
// House rules for SCORED items, learned from the AEMT bank's reviewer pass:
//   - Exactly four options. One defensible answer, three plainly wrong ones.
//   - No "all of the above", no negatives ("which is NOT"), no trick stems.
//   - Nothing whose correct answer depends on a protocol that can change.
//   - `code` is stable and unique. Corrections key on it; never reuse one.
//
// AND THE RULE THAT IS EASY TO GET WRONG: reword a stem or an option freely
// under the same code — that is what the upsert is for, and it corrects the
// item in place without orphaning an attempt that served it. But if you REORDER
// the options, or change what an option MEANS, give the item a NEW code.
// exam_attempts.responses stores the option INDEX, and the preference signals
// are positional: the same stored 0 would quietly become a different answer,
// and an interviewer would read a candidate's file wrong with nothing to see.
// fit-paperwork became fit-charts for exactly this reason.
//
// The preference items invert the first rule on purpose — FOUR defensible
// answers and no key at all. Their rules are in the block above them.
// ---------------------------------------------------------------------------

/**
 * Patient care at NEWLY-QUALIFIED EMT level, and nothing beyond it.
 *
 * Two constraints, and they are both narrower than they look.
 *
 * NOT ABOVE EMT SCHOOL. Every item here is something a candidate was taught
 * and tested on to get the card in their wallet. No paramedic content, no
 * 12-leads, no drips, no ventilators — an applicant may hold either
 * certification and both sit the same section, so paramedic material would
 * mark an EMT down for the certificate they hold rather than the person they
 * are. It would also measure the wrong thing: this section is a floor, not a
 * ranking. We are asking whether somebody who just qualified still knows what
 * they were taught, because that is what we can fairly expect of an applicant
 * and everything else is what orientation and field training are for.
 *
 * NOTHING SPECIFIC TO OUR OPERATION. Interfacility content is out — no lines
 * and drains to check before a move, no report taken from an ICU nurse, no
 * oxygen planned for a two-hour leg. Those were unfair in a way that was easy
 * to miss: they look clinical, so a candidate who missed them reads as weak on
 * patient care when what they actually lacked was a job they have not been
 * given yet. What we want to know about our operation, we ask in the
 * operations section, from a briefing we handed them first.
 *
 * Draw: 12.
 */
export const CLINICAL = [
  {
    code: 'clin-scene-safety',
    domain: 'Assessment',
    stem: 'You arrive to find a scene that may not be safe. Your first priority is:',
    options: [
      'reaching the patient quickly',
      'your own safety and your partner’s',
      'a set of vital signs',
      'a report to dispatch',
    ],
    answer: 1,
  },
  {
    code: 'clin-bsi',
    domain: 'Assessment',
    stem: 'Standard precautions — gloves and other personal protective equipment — are used:',
    options: [
      'on every patient contact',
      'only where an infection is known about',
      'only where there is visible blood',
      'at the crew member’s discretion',
    ],
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
    code: 'clin-adult-hr',
    domain: 'Assessment',
    stem: 'A normal resting heart rate for an adult is:',
    options: ['40 to 60', '60 to 100', '100 to 120', '120 to 140'],
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
    code: 'clin-trend',
    domain: 'Assessment',
    stem: 'Across three sets of vitals your patient’s systolic blood pressure has fallen from 130 to 118 to 104, and the pulse has risen each time. This is:',
    options: [
      'nothing to act on until a reading is actually abnormal',
      'a trend worth acting on and reporting now',
      'an expected response to being moved',
      'a sign the cuff is the wrong size',
    ],
    answer: 1,
  },
  {
    code: 'clin-early-shock',
    domain: 'Bleeding & shock',
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
    code: 'clin-bleeding-first',
    domain: 'Bleeding & shock',
    stem: 'The first action for severe bleeding from an arm or a leg is:',
    options: [
      'elevate the limb',
      'firm direct pressure on the wound',
      'a pressure point above the wound',
      'a cold pack over the dressing',
    ],
    answer: 1,
  },
  {
    code: 'clin-tourniquet',
    domain: 'Bleeding & shock',
    stem: 'A tourniquet on a limb is indicated when:',
    options: [
      'any bleeding is seen',
      'direct pressure has failed to control the bleeding',
      'thirty minutes of pressure have passed',
      'the patient is on a blood thinner',
    ],
    answer: 1,
  },
  {
    code: 'clin-airway-first',
    domain: 'Airway & breathing',
    stem: 'Your patient becomes unresponsive. Your first action is to:',
    options: [
      'call for orders',
      'check the airway and breathing',
      'note the time',
      'get a blood pressure',
    ],
    answer: 1,
  },
  {
    code: 'clin-opa-gag',
    domain: 'Airway & breathing',
    stem: 'An oropharyngeal airway (OPA) should not be used in a patient who:',
    options: [
      'is apneic',
      'still has a gag reflex',
      'is deeply unresponsive',
      'has an oxygen saturation below 90%',
    ],
    answer: 1,
  },
  {
    code: 'clin-npa-size',
    domain: 'Airway & breathing',
    stem: 'A nasopharyngeal airway is sized by measuring from the:',
    options: [
      'corner of the mouth to the earlobe',
      'nostril to the earlobe',
      'nose to the sternal notch',
      'lips to the chin',
    ],
    answer: 1,
  },
  {
    code: 'clin-vent-rate',
    domain: 'Airway & breathing',
    stem: 'An adult who is not breathing but has a pulse should be ventilated at about one breath every:',
    options: ['3 seconds', '5 to 6 seconds', '10 seconds', '15 seconds'],
    answer: 1,
  },
  {
    code: 'clin-chest-rise',
    domain: 'Airway & breathing',
    stem: 'The best sign that your ventilations are adequate is:',
    options: [
      'air escaping around the mask',
      'visible chest rise with each breath',
      'the stomach rising with each breath',
      'increasing resistance to each breath',
    ],
    answer: 1,
  },
  {
    code: 'clin-nrb-flow',
    domain: 'Airway & breathing',
    stem: 'A non-rebreather mask should be run at a flow rate of:',
    options: ['2 L/min', '4 to 6 L/min', '12 to 15 L/min', '25 L/min'],
    answer: 2,
  },
  {
    code: 'clin-hypoxia',
    domain: 'Airway & breathing',
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
    code: 'clin-copd-oxygen',
    domain: 'Airway & breathing',
    stem: 'A patient with a long history of COPD is clearly hypoxic. You should:',
    options: [
      'withhold oxygen because of the COPD',
      'give oxygen and titrate it to their saturation',
      'give oxygen only if they ask for it',
      'leave the decision to the hospital',
    ],
    answer: 1,
  },
  {
    code: 'clin-pulseox-co',
    domain: 'Airway & breathing',
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
    code: 'clin-position-resp',
    domain: 'Airway & breathing',
    stem: 'A conscious patient in respiratory distress, with no trauma, is best positioned:',
    options: ['flat on their back', 'head down', 'sitting upright', 'face down'],
    answer: 2,
  },
  {
    code: 'clin-suction',
    domain: 'Airway & breathing',
    stem: 'A patient vomits and cannot clear it themselves. Your first action is to:',
    options: [
      'raise the head of the cot and carry on',
      'clear the airway with suction and position the patient to protect it',
      'apply a non-rebreather mask',
      'note the time and tell the receiving nurse',
    ],
    answer: 1,
  },
  {
    code: 'clin-recovery-position',
    domain: 'Airway & breathing',
    stem: 'An unresponsive adult is breathing adequately and has no sign of injury. They are best placed:',
    options: [
      'flat on their back',
      'on their side, in the recovery position',
      'sitting fully upright',
      'face down',
    ],
    answer: 1,
  },
  {
    code: 'clin-peds-airway',
    domain: 'Airway & breathing',
    stem: 'Compared with an adult, a small child’s airway has:',
    options: [
      'a smaller tongue and a wider airway',
      'a larger tongue and a narrower airway',
      'a stiffer epiglottis',
      'a longer, more rigid trachea',
    ],
    answer: 1,
  },
  {
    code: 'clin-cpr-rate',
    domain: 'Cardiac arrest',
    stem: 'Adult chest compressions are delivered at a rate of:',
    options: [
      '60 to 80 per minute',
      '80 to 100 per minute',
      '100 to 120 per minute',
      '140 to 160 per minute',
    ],
    answer: 2,
  },
  {
    code: 'clin-cpr-depth',
    domain: 'Cardiac arrest',
    stem: 'Adult chest compressions should be at least:',
    options: ['1 inch deep', '1.5 inches deep', '2 inches deep', '3 inches deep'],
    answer: 2,
  },
  {
    code: 'clin-aed',
    domain: 'Cardiac arrest',
    stem: 'An AED should be applied to a patient who is:',
    options: [
      'unresponsive with no pulse',
      'unresponsive with a pulse',
      'responsive with chest pain',
      'having a seizure',
    ],
    answer: 0,
  },
  {
    code: 'clin-cpr-quality',
    domain: 'Cardiac arrest',
    stem: 'High-quality CPR depends most on:',
    options: [
      'frequent pauses to check for a pulse',
      'full chest recoil and few interruptions',
      'shallow, very fast compressions',
      'breaths given before compressions',
    ],
    answer: 1,
  },
  {
    code: 'clin-glucose-check',
    domain: 'Medical',
    stem: 'A patient becomes confused and sweaty. The most rapidly correctable cause to check for is:',
    options: ['a stroke', 'a low blood glucose', 'a brain tumor', 'a migraine'],
    answer: 1,
  },
  {
    code: 'clin-oral-glucose',
    domain: 'Medical',
    stem: 'A hypoglycemic patient is awake and able to swallow. The appropriate treatment is:',
    options: [
      'nothing by mouth',
      'oral glucose',
      'a large drink of water',
      'waiting for the hospital',
    ],
    answer: 1,
  },
  {
    code: 'clin-anaphylaxis',
    domain: 'Medical',
    stem: 'Hives, wheezing and a falling blood pressure shortly after a bee sting indicate:',
    options: ['an anxiety attack', 'anaphylaxis', 'a fainting episode', 'a local reaction'],
    answer: 1,
  },
  {
    code: 'clin-stroke-lkw',
    domain: 'Medical',
    stem: 'For a patient with stroke signs, the single most important time to establish is:',
    options: [
      'when the family called',
      'when the patient was last known well',
      'when you arrived',
      'when the vital signs were taken',
    ],
    answer: 1,
  },
  {
    code: 'clin-seizure-status',
    domain: 'Medical',
    stem: 'A seizure lasting more than five minutes, or repeated seizures without recovery in between, is:',
    options: [
      'a normal febrile seizure',
      'status epilepticus, and an emergency',
      'a fainting episode',
      'expected in anybody with epilepsy',
    ],
    answer: 1,
  },
  {
    code: 'clin-aspirin-why',
    domain: 'Medical',
    stem: 'Aspirin is given in suspected cardiac chest pain in order to:',
    options: [
      'relieve the pain',
      'reduce clumping of platelets',
      'slow the heart rate',
      'raise the blood pressure',
    ],
    answer: 1,
  },
  {
    code: 'clin-nitro-check',
    domain: 'Medical',
    stem: 'Before assisting a patient with their own prescribed nitroglycerin, an important thing to ask about is:',
    options: [
      'any recent erectile-dysfunction medication',
      'whether they have eaten today',
      'their family history',
      'their tetanus status',
    ],
    answer: 0,
  },
  {
    code: 'clin-spine',
    domain: 'Trauma',
    stem: 'A patient has fallen and reports neck pain. While you assess them you should:',
    options: [
      'have them turn their head to test the movement',
      'limit movement of the head and neck',
      'sit them straight up',
      'walk them to the cot',
    ],
    answer: 1,
  },
  {
    code: 'clin-refusal',
    domain: 'Patient care',
    stem: 'An alert, oriented adult refuses transport. You should:',
    options: [
      'transport them anyway, for their own good',
      'explain the risks, document the refusal, and respect their decision',
      'leave without saying anything further',
      'have a family member sign for them',
    ],
    answer: 1,
  },
  {
    code: 'clin-heavy-lift',
    domain: 'Lifting & moving',
    stem: 'A patient is heavier than the two of you can move safely. You should:',
    options: [
      'move fast, to keep the strain brief',
      'get more hands and the right equipment, even though it takes longer',
      'have the patient take their own weight',
      'drag them across on the bed sheet',
    ],
    answer: 1,
  },
  {
    code: 'clin-straps',
    domain: 'Lifting & moving',
    stem: 'A patient is on the cot for transport. The straps should be:',
    options: [
      'all fastened, including the shoulder straps',
      'across the waist only, so they can sit up',
      'left loose on a short trip',
      'fastened only if the patient is unresponsive',
    ],
    answer: 0,
  },
  {
    code: 'clin-confused-safety',
    domain: 'Lifting & moving',
    stem: 'You are moving a confused patient. The most important safety measure is:',
    options: [
      'restraining their wrists',
      'rails up, straps secured, and never leaving them unattended',
      'a family member at the head of the cot',
      'sedation before you move',
    ],
    answer: 1,
  },
  {
    code: 'clin-handover',
    domain: 'Patient care',
    stem: 'Your verbal report at the hospital should always include:',
    options: [
      'the route you took',
      'the patient, the problem, and anything that changed while they were with you',
      'only what the family told you',
      'nothing — the written report covers it',
    ],
    answer: 1,
  },
  {
    code: 'clin-chart-timing',
    domain: 'Documentation',
    stem: 'The best time to write your patient care report is:',
    options: [
      'at the end of the shift, all together',
      'as soon as practical, while the detail is accurate',
      'only if something went wrong',
      'before the call, so it is ready',
    ],
    answer: 1,
  },
  {
    code: 'clin-chart-honest',
    domain: 'Documentation',
    stem: 'You realize you missed a set of vital signs. Your report should:',
    options: [
      'record what was actually done, including the gap',
      'estimate the missing set from the readings either side',
      'leave the section blank with no comment',
      'record the later set at the earlier time',
    ],
    answer: 0,
  },
  {
    code: 'clin-equipment-check',
    domain: 'Equipment',
    stem: 'Equipment on the truck should be checked:',
    options: [
      'at the start of every shift, before it is needed',
      'when a call comes in for a patient who needs it',
      'weekly',
      'after it has been used',
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
    stem: 'The operation completes roughly how many transports each month?',
    options: ['about 100', 'about 1,000', 'about 10,000', 'it varies too much to say'],
    answer: 1,
  },
  {
    code: 'ops-already-a-patient',
    ref: 'what-we-do',
    stem: 'When you arrive at the sending facility, the patient has usually already been:',
    options: [
      'assessed, diagnosed, and started on a treatment plan',
      'discharged from the care of the sending facility',
      'assessed by the crew who transported them in',
      'left for you to work up from the beginning',
    ],
    answer: 0,
  },
  {
    code: 'ops-our-responsibility',
    ref: 'what-we-do',
    stem: 'The briefing describes our responsibility for a patient already on a treatment plan as:',
    options: [
      'driving them safely to the address on the paperwork',
      'to understand that plan, continue it safely, recognize when something changes, and hand the patient over accurately',
      'starting our own treatment plan once the doors close',
      'waiting for the receiving facility to tell us what to do',
    ],
    answer: 1,
  },
  {
    code: 'ops-what-could-change',
    ref: 'not-911',
    // Typographic quotes, not ASCII ones. They read better, and they keep the
    // generated installer free of double-quote characters entirely — which
    // matters because a stray " in a script is what turns a confusing paste
    // into a Postgres error naming a word out of our own prose as a missing
    // table. See the check in scripts/check-neop-exam.mjs.
    stem: 'The briefing says the question on this job is usually not “What am I walking into?” but:',
    options: [
      '“How quickly can we clear?”',
      '“What could change during this trip, and am I prepared for it?”',
      '“Who is going to write this chart?”',
      '“Is this transport really necessary?”',
    ],
    answer: 1,
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
      'their name, diagnosis, medications, medical devices and destination',
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
      'being responsible for a medically complex patient for 45 minutes or longer, with more help not immediately available',
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
    // Was ops-mcs-teams, which keyed to the claim that these patients travel
    // with their own specialist teams. The operation's own briefing does not
    // say that, so the item asks what the briefing does say. New code, because
    // the meaning of the keyed option changed — see the house rule above.
    code: 'ops-mcs-patients',
    ref: 'patients',
    stem: 'Patients receiving mechanical circulatory support — an intra-aortic balloon pump, Impella or ECMO — are:',
    options: [
      'never moved by ground ambulance',
      'among the patients this operation may transport',
      'the most common patient we transport',
      'transported only by a different company',
    ],
    answer: 1,
  },
  {
    code: 'ops-stable-majority',
    ref: 'patients',
    stem: 'The briefing describes the stable transports — the patient who needs no intervention — as:',
    options: [
      'filler between the calls that matter',
      'a major part of the job, and something that matters to the person on the stretcher',
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
    code: 'ops-bring-not-train',
    ref: 'skills',
    stem: 'The briefing says we can train people on our equipment and processes. What it asks them to bring is:',
    options: [
      'previous critical-care transport experience',
      'reliability, sound judgment, intellectual honesty, and a willingness to ask when they do not know',
      'a paramedic certification',
      'a fixed number of years in EMS',
    ],
    answer: 1,
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
    // Was ops-paperwork-warning, keyed to "you are looking at the wrong
    // operation". The operation's own wording is narrower and better, and a
    // candidate who read it carefully would have been marked wrong by the old
    // item. New code: the keyed option no longer means what it meant.
    code: 'ops-paperwork-serious',
    ref: 'skills',
    stem: 'On documentation, the briefing asks that:',
    options: [
      'you enjoy paperwork',
      'you take it seriously, whether or not you enjoy it, because here it is part of the clinical work',
      'you keep it brief so the crew stays available',
      'you leave it to whichever partner is faster at it',
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
      'some take 20 minutes, others several hours each way',
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
      'doing the job well — and something that takes discipline and sustained attention',
      'a sign you were assigned the wrong truck',
      'unusual on this operation',
    ],
    answer: 1,
  },
  {
    code: 'ops-only-emergencies',
    ref: 'shift',
    stem: 'On somebody for whom a shift only feels worthwhile when they use emergency procedures, the briefing says:',
    options: [
      'they will adjust within a few months',
      'this role will probably not be a good fit',
      'they should apply as a paramedic rather than an EMT',
      'they will be given the busier trucks',
    ],
    answer: 1,
  },
  {
    code: 'ops-guest',
    ref: 'facilities',
    stem: 'On most calls in this operation, in someone else’s ICU or nursing facility, you are:',
    options: [
      'in charge of the scene, as on a 911 call',
      'a guest in someone else’s workplace',
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
    code: 'ops-no-supervisor',
    ref: 'facilities',
    stem: 'Most of the time on this operation, no supervisor is standing beside you. The briefing says what follows from that is:',
    options: [
      'crews are checked on by radio instead',
      'we have to be able to trust how you treat patients, families and facility staff when nobody from AMR is in the room',
      'decisions can wait until a supervisor is reached',
      'new employees are paired with a supervisor for their first year',
    ],
    answer: 1,
  },
  {
    code: 'ops-hallway-sjt',
    ref: 'facilities',
    stem: 'An ICU nurse keeps you waiting forty minutes and is short with you when she finally gives report. The response that fits this operation is to:',
    options: [
      'match her tone so it does not happen again',
      'stay courteous and get the report the patient needs — courtesy here supports patient care and is part of the job',
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
    code: 'ops-advancement',
    ref: 'growth',
    stem: 'Field training officer, preceptor, instructor and quality-review roles here are earned through:',
    options: [
      'time in the position',
      'clinical performance, dependable work, strong documentation, and the trust of the people working beside you',
      'a written examination',
      'seniority within the company',
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
      'not how it works — those are separate operations with their own positions and hiring, and this job is not a waiting list for a 911 opening',
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
    code: 'ops-routine-attention',
    ref: 'expect',
    stem: 'The attention this operation expects on a routine transport is:',
    options: [
      'proportionate — less than on a critical one',
      'the same level you bring to a critical one',
      'whatever the schedule allows that day',
      'set by the sending facility',
    ],
    answer: 1,
  },
  {
    code: 'ops-honest-chart',
    ref: 'expect',
    stem: 'The standard the briefing sets for your documentation is that it is:',
    options: [
      'complete enough to satisfy billing',
      'accurate and honest, including your own mistakes',
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
      'after roughly 20 to 30 patient contacts, and only once you have shown you can do the work safely and consistently',
      'once you have completed ninety days',
      'as soon as the classroom week finishes',
    ],
    answer: 1,
  },
]

/**
 * Preference items. `answer: null` — unscored, permanently.
 *
 * WHAT THESE ARE FOR, precisely: whether the applicant is heading for a 911 or
 * a fire operation and using this seat to wait. Not "are they enthusiastic",
 * not "will they be nice about it" — that one thing.
 *
 * AND THE ANSWERS MUST NOT GIVE THE GAME AWAY. The first version of this
 * section asked things like "six months in, a 911 position opens at the same
 * pay — you take it or stay?" Every option was labelled with its own verdict.
 * That is not a question, it is a prompt sheet: it tells a candidate exactly
 * what we are afraid of and exactly which box to tick, and the ones most
 * willing to tell us what we want to hear tick it fastest. It selected for
 * compliance and against candor, which is the opposite of the intent.
 *
 * So these are built to four rules:
 *
 *   1. EVERY OPTION IS A VIABLE ANSWER — and the test is sharper than it
 *      sounds: would a candidate say this one out loud, to your face, without
 *      embarrassment? An option that reads as an admission ("nothing, I never
 *      bothered") is not a fourth answer, it is a decoy; and a candidate who
 *      can see it is a decoy can see the shape of the whole item, which is the
 *      thing this section is built to avoid. Six options failed that test on
 *      the first pass and were rewritten to say the same thing without the
 *      flinch. If an option is weak, rewrite the option — never the key.
 *   2. EVIDENCE BEATS INTENTION. What somebody has already spent their own
 *      weekends and their own money on is a fact about them; what they intend
 *      is a fact about this conversation. Several items ask what they have
 *      DONE.
 *   3. FORCED CHOICE BETWEEN TWO GOODS. The signal is what they are willing to
 *      give up, which is much harder to fake than what they claim to want.
 *   4. NO ITEM DECIDES ANYTHING. One answer is noise. The interviewer is shown
 *      a tally across the whole section and told to treat it as a pattern, not
 *      a finding.
 *
 * THE ONE THING THAT STILL TELLS THEM: the briefing. It says plainly that this
 * is not 911 work and that nobody moves onto a scene operation by waiting, so
 * an applicant reads that before answering any of this. That is a deliberate
 * trade and not an oversight — the briefing's job is to let people withdraw
 * before we both spend the day, which is worth more than a clean measurement.
 * It is also exactly why these items lean on what a candidate has already
 * done: that half cannot be re-decided after reading a web page.
 *
 * Every candidate is served all of them (no draw), because an interviewer
 * comparing two candidates needs them to have answered the same questions.
 * Option display order is shuffled per attempt by ExamPage, so position carries
 * nothing either way.
 *
 * The probe and the reading of each option live in src/data/neopSelection.ts,
 * positionally by option order — if you reorder the options here, reorder the
 * signals there. check-neop-exam.mjs enforces the count, not your intent.
 */
export const FIT = [
  {
    code: 'fit-own-time',
    stem: 'Which of these have you done in the last two years, on your own time or at your own expense?',
    options: [
      'A course on the sicker end of patient care — critical care, ventilators, cardiac',
      'A fire academy course, or a department’s entrance or physical ability test',
      'A CPR, instructor or teaching certification',
      'None of these — the training I have done has come through work',
    ],
    answer: null,
  },
  {
    code: 'fit-paid-class',
    stem: 'We will pay for one course of your choosing and give you the days off for it. You pick:',
    options: [
      'Vehicle extrication and rescue',
      'Field training officer and preceptor school',
      'Ventilators, pumps and critical care transport',
      'Advanced cardiac life support',
    ],
    answer: null,
  },
  {
    code: 'fit-compliment',
    stem: 'At the end of a shift, which would you rather have said about you?',
    options: [
      'They kept their head when it all went bad.',
      'The new people ask for them.',
      'That patient got there in the same shape they left in.',
      'Nothing in particular — I would rather the work spoke for itself.',
    ],
    answer: null,
  },
  {
    code: 'fit-story',
    stem: 'A friend asks what your last job was really like. The first thing you find yourself telling them about is:',
    options: [
      'The people you worked with',
      'The worst call you ran',
      'A patient you got right when it would have been easy to get wrong',
      'What it paid, and how the schedule worked',
    ],
    answer: null,
  },
  {
    code: 'fit-wear-down',
    stem: 'Which of these would wear you down faster?',
    options: [
      'A shift where nothing happened',
      'A shift where you never got a minute to yourself',
      'Being blamed for something that was not your fault',
      'Working alongside somebody you did not respect',
    ],
    answer: null,
  },
  {
    code: 'fit-five-years',
    stem: 'Five years from now, which of these would you be happiest to have become?',
    options: [
      'The one who teaches the new people',
      'The one on a busy truck, first out the door',
      'The one in an office role, with regular hours and a say in how things run',
      'The one they send with the sickest patients',
    ],
    answer: null,
  },
  {
    code: 'fit-pitch',
    stem: 'Somebody asks you to help talk a friend into applying where you work. The line you would use is:',
    options: [
      'You will see things most people never see.',
      'You will get properly good at looking after sick people.',
      'It is steady, and they treat you like an adult.',
      'It is a good place to start.',
    ],
    answer: null,
  },
  {
    code: 'fit-applications',
    stem: 'How many other places have you applied to in the last three months?',
    options: [
      'This is the only one',
      'Two or three, all much the same kind of work',
      'Several, including fire departments or 911 services',
      'A lot — I am looking broadly at the moment',
    ],
    answer: null,
  },
  {
    code: 'fit-swap',
    stem: 'A partner offers to swap shifts with you. You would most want the one that:',
    options: [
      'Puts you with the partner you would learn the most from',
      'Runs the busiest trucks',
      'Gets you home on time',
      'Takes the most complicated patients',
    ],
    answer: null,
  },
  {
    code: 'fit-leave',
    stem: 'Suppose you take this job. What would be most likely to start you looking somewhere else?',
    options: [
      'A schedule that stopped working for your life',
      'Pay that stopped keeping up',
      'An opening somewhere you had been waiting on',
      'Feeling like you had stopped learning anything',
    ],
    answer: null,
  },
  {
    code: 'fit-least',
    stem: 'Which part of this job do you expect to like least?',
    options: [
      'The waiting — at bedsides, and for beds',
      'The documentation',
      'How seldom the emergency skills get used',
      'The long transports',
    ],
    answer: null,
  },
  {
    code: 'fit-charts',
    stem: 'On paperwork, which is closest to you?',
    options: [
      'I would rather be the one whose charts nobody has to come back and ask about',
      'I get it done and I keep it short',
      'It is the part I have to be disciplined about',
      'I have not written many yet',
    ],
    answer: null,
  },
  {
    code: 'fit-experience',
    stem: 'Which best describes the EMS work you have done so far?',
    options: [
      'None yet — I am new to it',
      '911 or scene work',
      'Transport or interfacility work',
      'Both scene and transport work',
    ],
    answer: null,
  },
]

export const SECTION_ITEMS = {
  clinical: CLINICAL,
  operations: OPERATIONS,
  fit: FIT,
}
