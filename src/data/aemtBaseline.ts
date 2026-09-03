// ---------------------------------------------------------------------------
// The day-one baseline diagnostic. 50 items, ungraded.
//
// CONTENT LEVEL: EMT prerequisite knowledge.
// REPORTING FRAMEWORK: current NREMT AEMT examination domains.
// PURPOSE: this ungraded diagnostic identifies prerequisite strengths and gaps
// and establishes a reference point for later measurements. It is not used for
// selection, ranking or progression decisions.
//
// Those three lines are the subject-matter reviewer's wording and they settle a
// real ambiguity: the domain mix is the AEMT blueprint, but the CONTENT is what
// a student should already hold as an EMT. The EMT blueprint changed in April
// 2025 and is not the one being sampled here — an AEMT-entry diagnostic should
// report against the exam the cohort is heading for, which is why prerequisite
// knowledge is mapped onto AEMT domains rather than EMT ones.
//
// A diagnostic that counted would teach students to protect a score instead of
// showing what they do not know, which is the opposite of what it is for.
//
// WHY IT EXISTS AS CODE. The plan called for a 50-item baseline for weeks and
// no such form was ever in anyone's hands. Navigate ships chapter quizzes and
// TestPrep banks, not a pre-course diagnostic, so the choice was to build one
// or to drop the measurement. This is the built one.
//
// SCOPE IS EMT, NOT AEMT. Every item is answerable by a currently certified
// EMT on the day they walk in. An item that needs the course to answer measures
// nothing on day one and tells the instructor nothing about where to start.
//
// HOW THE ITEMS ARE WRITTEN. One best answer, four options, against the
// conventions the National Registry writes to and the item-writing literature
// behind them:
//
//   - Each distractor is plausible. A distractor nobody picks is a wasted
//     option and pushes the item toward a three-choice guess.
//   - The key is the MOST correct option, not the only defensible one. Items
//     where three options are obviously absurd measure reading speed.
//   - The stem is answerable with the options covered, and carries no detail
//     the question does not need.
//   - Options are homogeneous — same kind of thing, same grammatical form,
//     similar length. The key is never the longest or the most qualified.
//   - No "all of the above", "none of the above", "both A and B", no absolute
//     terms in the options, no word from the stem echoed only in the key.
//
// scripts/check-baseline.mjs enforces every one of those that a machine can
// see, and fails the build when an item drifts. What it cannot see is whether
// the medicine is right; that is a subject-matter review and it is the reason
// this file is readable rather than a table of encoded rows.
//
// IT HAS BEEN REVIEWED ONCE, and the review changed nine items materially. The
// keyed maneuver in BD-01 was wrong without suspected trauma. BD-07 and BD-32
// asked questions above EMT scope or turned on an absolute that is not true.
// BD-42 tested recall of a mnemonic — the four-percent-per-liter cannula rule —
// rather than whether a candidate can tell inadequate oxygenation from
// inadequate ventilation. BD-50 asked which cause of ambulance collisions is
// most common, which is folklore rather than a decision anyone makes. Those
// are the errors a subject-matter reviewer finds and a script never will.
//
// TWO REVIEWER SUGGESTIONS WERE CONSIDERED AND DECLINED for this cohort, so
// that neither reads later as an unfinished job:
//
//   A STANDING YEARLY RE-REVIEW. Not set up. This is the first cohort to sit
//   the instrument and there is nothing yet to review against. Worth revisiting
//   once it has been given and the item statistics exist — compression depth,
//   choking management and cannula behaviour have all moved before, and a bank
//   goes quietly out of date rather than breaking. The trigger for that is a
//   guideline change or a second cohort, not the calendar.
//
//   LINKED SCENARIO ITEMS, where several questions progress through one
//   patient. Better measurement of clinical judgment, and the certification
//   exam uses them. Declined here because independent items are the right
//   shape for a DIAGNOSTIC: a candidate who misreads the opening of a linked
//   scenario loses every item hanging off it, which confounds the one thing
//   this instrument is for — locating gaps by domain. It would also need work
//   in the exam engine, which serves independent items today.
// ---------------------------------------------------------------------------

import { BLUEPRINT_DOMAIN_IDS } from './aemtAssessments'

export type BaselineDomain = (typeof BLUEPRINT_DOMAIN_IDS)[number]

export interface BaselineItem {
  /** Stable identifier. Printed on the answer key and never reused. */
  code: string
  domain: BaselineDomain
  stem: string
  /** Exactly four. Stored in authored order; the exam shuffles what it shows. */
  options: [string, string, string, string]
  /** Index into `options`. */
  answer: 0 | 1 | 2 | 3
  /**
   * Why the key is right and, where it matters, why the closest distractor is
   * wrong. Read at the debrief — the item is worth more as a teaching moment
   * than as a mark.
   */
  rationale: string
}

/**
 * How many items a domain must carry before its percentage means anything.
 *
 * Trauma and EMS Operations carry four items each, because that is what the
 * blueprint bands allow in a 50-item paper. On four items one wrong answer
 * moves the reported score twenty-five points, which is noise presented as a
 * finding — an instructor who reads "Trauma 75%" and assigns remediation is
 * acting on a single item.
 *
 * So a domain below this floor reports as a raw count and is marked
 * provisional. It is still worth measuring; it is not worth a percentage.
 */
export const STABLE_DOMAIN_ITEMS = 8

export interface DomainScore {
  domain: BaselineDomain
  correct: number
  items: number
  /** Percent, or undefined where the domain is too small to express as one. */
  percent?: number
  provisional: boolean
}

/** Score one attempt by domain, refusing to report a percentage it cannot support. */
export function scoreByDomain(answers: Record<string, number>): DomainScore[] {
  const out = new Map<BaselineDomain, DomainScore>()
  for (const it of BASELINE_ITEMS) {
    const d =
      out.get(it.domain) ??
      { domain: it.domain, correct: 0, items: 0, provisional: false }
    d.items += 1
    if (answers[it.code] === it.answer) d.correct += 1
    out.set(it.domain, d)
  }
  return [...out.values()].map((d) => ({
    ...d,
    provisional: d.items < STABLE_DOMAIN_ITEMS,
    percent: d.items < STABLE_DOMAIN_ITEMS ? undefined : Math.round((d.correct / d.items) * 100),
  }))
}

export const BASELINE_ITEMS: BaselineItem[] = [
  // ----- Clinical Judgment (17 of 50 = 34%) --------------------------------
  {
    code: 'BD-01',
    domain: 'clinical-judgment',
    stem: 'You find a 60-year-old man slumped at a table, breathing noisily and not responding to your voice. There is no sign of injury. Your first action is to:',
    options: [
      'obtain a set of baseline vital signs',
      'open the airway with a head-tilt, chin-lift',
      'apply oxygen by nonrebreather mask',
      'ask bystanders when he was last normal',
    ],
    answer: 1,
    rationale:
      'Noisy breathing in an unresponsive patient is a partly obstructed airway, and it is the first thing that will kill him. With no suspected head or neck injury the head-tilt, chin-lift is the maneuver; a jaw thrust is reserved for suspected trauma. Oxygen through an obstructed airway does not reach the lungs.',
  },
  {
    code: 'BD-02',
    domain: 'clinical-judgment',
    stem: 'A patient who fell is alert and answering questions. Her daughter says she is normally sharp, but she has repeated the same question three times in four minutes. This is best described as:',
    options: [
      'an expected response to the stress of a fall',
      'a long-standing memory problem of her own',
      'a normal variant in patients of her age',
      'a change from her baseline mental status',
    ],
    answer: 3,
    rationale:
      'The finding matters because a person who knows her says it is new. Repetitive questioning that is new from baseline is short-term memory loss and is commonly dismissed because the patient is otherwise alert and conversational. Without the baseline you cannot call it a change at all.',
  },
  {
    code: 'BD-03',
    domain: 'clinical-judgment',
    stem: 'You are treating a patient for respiratory distress. Which finding best indicates that the distress is improving?',
    options: [
      'the pulse oximeter now reads 96 percent',
      'the patient says the mask feels better',
      'the respiratory rate has fallen to 12',
      'full sentences and less accessory muscle use',
    ],
    answer: 3,
    rationale:
      'Sentence length and accessory muscle use both measure work of breathing, which is what distress is. A saturation can improve while the patient tires, and a rate that falls can mean exhaustion rather than relief. This is the re-evaluate step of the judgment cycle.',
  },
  {
    code: 'BD-04',
    domain: 'clinical-judgment',
    stem: 'Two patients are down at a single-car crash. One is screaming and holding his leg; the other is quiet with shallow, rapid breathing. You should assess:',
    options: [
      'the silent patient, whose breathing is abnormal',
      'the screaming patient, whose breathing is noisy',
      'both together, dividing your attention evenly',
      'whichever patient is nearer the ambulance',
    ],
    answer: 0,
    rationale:
      'A patient who can scream has a patent airway and is moving air. Quiet with rapid shallow breathing is the one whose airway or perfusion is failing. The loudest patient is rarely the sickest, and that is the cue-recognition error that costs the most.',
  },
  {
    code: 'BD-05',
    domain: 'clinical-judgment',
    stem: 'A patient with diabetes is confused and sweaty. A family member says she took her insulin but skipped lunch. Your working hypothesis is:',
    options: [
      'an insulin dose that was set too low',
      'an early infection driving the confusion',
      'blood glucose that has fallen too far',
      'blood glucose that has risen too high',
    ],
    answer: 2,
    rationale:
      'Insulin taken without food drives glucose down, and sweating with confusion fits. Hyperglycemia is the tempting distractor because the patient has diabetes, but it comes on over hours to days and usually presents dry rather than diaphoretic. It remains a hypothesis until glucose is measured.',
  },
  {
    code: 'BD-06',
    domain: 'clinical-judgment',
    stem: 'You are treating a patient for a suspected allergic reaction when they suddenly become difficult to rouse. Your next step is to:',
    options: [
      'continue the treatment already in progress',
      'record the change and reassess in five minutes',
      'obtain a more detailed allergy history',
      'return to the primary survey and reassess',
    ],
    answer: 3,
    rationale:
      'A change in condition sends you back to the beginning, not forward. Carrying on with a plan built on findings that have since changed is the error the judgment cycle exists to prevent.',
  },
  {
    code: 'BD-07',
    domain: 'clinical-judgment',
    stem: 'A patient with chest pain has a blood pressure of 88/60 with cool, moist skin. As an EMT, your management centers on:',
    options: [
      'assisting the patient with their nitroglycerin',
      'supporting ABCs, requesting ALS, transporting',
      'completing a detailed history before moving',
      'sitting them fully upright to ease the work',
    ],
    answer: 1,
    rationale:
      'Hypotension with poor perfusion makes nitroglycerin unsafe, and the interventions that would treat the underlying problem are above EMT scope. What is left, and what matters, is airway and breathing support, early ALS, and not delaying transport for history taking.',
  },
  {
    code: 'BD-08',
    domain: 'clinical-judgment',
    stem: 'Your partner says the patient "looks fine" while the patient describes a sense of impending doom. You should:',
    options: [
      'treat it as a reason to reassess carefully',
      'reassure the patient and continue as planned',
      'attribute the feeling to situational anxiety',
      'defer to your partner as the senior provider',
    ],
    answer: 0,
    rationale:
      'A sense of impending doom is nonspecific — it does not name a diagnosis — but it is reported often enough before deterioration that it earns another look. Discounting a subjective cue because the objective picture is still normal is the analysis failure worth guarding against.',
  },
  {
    code: 'BD-09',
    domain: 'clinical-judgment',
    stem: 'An older patient taking a beta blocker has lost a significant volume of blood. Compared with a healthy adult, you should expect their heart rate to:',
    options: [
      'rise far higher than you would expect',
      'fall steadily as the bleeding continues',
      'stay lower than the blood loss suggests',
      'track the blood loss in the usual way',
    ],
    answer: 2,
    rationale:
      'Beta blockade blunts the tachycardic response, so a heart rate that looks reassuring can sit on top of serious hypovolemia. Judging blood loss by pulse alone in this patient is how a compensating bleed gets missed.',
  },
  {
    code: 'BD-10',
    domain: 'clinical-judgment',
    stem: 'Which handoff at the emergency department gives the receiving team what it needs?',
    options: [
      'age, complaint, and the treatment you gave',
      'complaint, findings, trend, treatment, response',
      'complaint, the full past history, and medications',
      'age, complaint, and the receiving preference',
    ],
    answer: 1,
    rationale:
      'A handoff has to carry what changed and what you did about it. Vital sign trends and the response to treatment are the parts the receiving team cannot reconstruct from a chart later, and they are the parts most often left out.',
  },
  {
    code: 'BD-11',
    domain: 'clinical-judgment',
    stem: 'A patient refuses transport after a low-speed collision. Accepting the refusal requires that they:',
    options: [
      'have someone available to drive them home',
      'have no visible injuries of any kind',
      'have signed the refusal paperwork',
      'can reason through it and state a choice',
    ],
    answer: 3,
    rationale:
      'Capacity is the requirement: the patient must understand and appreciate the situation and its consequences, reason through the options, and communicate a consistent choice. A signature from someone who cannot do that documents nothing.',
  },
  {
    code: 'BD-12',
    domain: 'clinical-judgment',
    stem: 'Your patient has a respiratory rate of 30 and a pulse oximetry reading of 99 percent. This should prompt you to:',
    options: [
      'accept that oxygenation is adequate',
      'reduce the oxygen you are delivering',
      'recheck the probe on the other hand',
      'look for a cause of the rapid breathing',
    ],
    answer: 3,
    rationale:
      'A normal saturation says oxygen is bound to hemoglobin; it says nothing about why the patient is working so hard. Rapid breathing with good saturation points at acidosis, pain, anxiety or carbon monoxide. A normal number is a reason to look further, not to stop.',
  },
  {
    code: 'BD-13',
    domain: 'clinical-judgment',
    stem: 'You are dispatched for "back pain" in a 70-year-old woman who is pale and clammy with a pulse of 118. You should treat this as:',
    options: [
      'a potentially life-threatening presentation',
      'a musculoskeletal complaint needing comfort',
      'an anxiety response to the pain itself',
      'a routine transfer to her own hospital',
    ],
    answer: 0,
    rationale:
      'Pallor, diaphoresis and tachycardia with back pain in an older patient raise abdominal aortic aneurysm among other catastrophic causes. The dispatch complaint anchors you low; the physical findings should override it.',
  },
  {
    code: 'BD-14',
    domain: 'clinical-judgment',
    stem: 'Which finding would most concern you in a two-year-old?',
    options: [
      'crying loudly and reaching for the parent',
      'flushed cheeks and a temperature of 101 F',
      'lying quietly and not tracking your movement',
      'refusing to answer any of your questions',
    ],
    answer: 2,
    rationale:
      'A well toddler resists strangers and seeks a parent. Quiet, uninterested and not tracking is decompensation. Crying vigorously is reassuring, fever is common, and refusing to talk to a stranger is developmentally normal.',
  },
  {
    code: 'BD-15',
    domain: 'clinical-judgment',
    stem: 'Halfway to the hospital your patient deteriorates markedly. You should reassess:',
    options: [
      'the specific system you have been treating',
      'the primary survey from the beginning',
      'the vital signs and nothing further',
      'the history for anything you missed',
    ],
    answer: 1,
    rationale:
      'A significant change returns you to the primary survey, because the new problem need not be in the system you were treating. Rechecking only what you were already watching is how a developing airway problem is missed.',
  },
  {
    code: 'BD-16',
    domain: 'clinical-judgment',
    stem: 'You disagree with your partner about whether a patient needs immediate transport. The most appropriate first step is to:',
    options: [
      'state the specific findings that concern you',
      'defer, since the crew needs to agree',
      'transport quietly and discuss it later',
      'ask the patient which they would prefer',
    ],
    answer: 0,
    rationale:
      'Naming the findings moves the conversation from opinion to evidence, which is what closed-loop crew communication asks for. Staying silent to avoid friction is the failure the leadership half of this domain was added to test.',
  },
  {
    code: 'BD-17',
    domain: 'clinical-judgment',
    stem: 'A patient has warm, dry skin, a weak radial pulse, and capillary refill of four seconds. Together these findings indicate:',
    options: [
      'perfusion that is adequate for now',
      'a reading affected by a cold environment',
      'impaired peripheral perfusion',
      'a normal variant in a well-conditioned adult',
    ],
    answer: 2,
    rationale:
      'A weak pulse with delayed refill is impaired peripheral perfusion whatever the skin feels like. Warm dry skin is why poor perfusion gets missed early: the finding people are taught to look for is absent while the two that matter are present. What is causing it is a separate question.',
  },

  // ----- Medical / OB / GYN (13 of 50 = 26%) -------------------------------
  {
    code: 'BD-18',
    domain: 'medical-ob-gyn',
    stem: 'A patient has sudden one-sided weakness. Checking the blood glucose is important because it:',
    options: [
      'identifies a treatable condition that mimics stroke',
      'confirms that the patient is having a stroke',
      'establishes how long the symptoms have lasted',
      'determines which hospital should receive them',
    ],
    answer: 0,
    rationale:
      'Hypoglycemia mimics stroke closely and can produce genuine one-sided weakness, and it is correctable in the field. A normal glucose does not confirm stroke; it removes one treatable cause from the list.',
  },
  {
    code: 'BD-19',
    domain: 'medical-ob-gyn',
    stem: 'A three-year-old has been seizing for about one minute when you arrive. Your priority is to:',
    options: [
      'hold the limbs still to prevent an injury',
      'cool the child rapidly with wet towels',
      'protect the head and position the airway',
      'move the child to the ambulance at once',
    ],
    answer: 2,
    rationale:
      'You cannot stop the seizure, so you prevent it from causing harm and keep the airway open. Restraint causes injury, aggressive cooling is not the immediate priority and can cause shivering, and moving a convulsing child risks both of you before the seizure ends.',
  },
  {
    code: 'BD-20',
    domain: 'medical-ob-gyn',
    stem: 'A patient with a known peanut allergy has hives and is now wheezing after eating. This presentation:',
    options: [
      'is a local reaction confined to the skin',
      'will settle without further treatment',
      'is anaphylaxis and indicates epinephrine',
      'reflects anxiety about the exposure',
    ],
    answer: 2,
    rationale:
      'A reaction involving two body systems — skin and airway — meets the definition of anaphylaxis, whatever the blood pressure is doing. Naming it matters because it is what indicates epinephrine; waiting for hypotension before naming it is the delay that causes harm.',
  },
  {
    code: 'BD-21',
    domain: 'medical-ob-gyn',
    stem: 'An unresponsive patient has slow, shallow breathing and pinpoint pupils. Your first priority is to:',
    options: [
      'assist ventilations with a bag-mask device',
      'administer naloxone by the approved route',
      'apply oxygen by nonrebreather mask',
      'check the blood glucose level',
    ],
    answer: 0,
    rationale:
      'The picture is opioid toxicity and what is killing the patient is inadequate ventilation. Naloxone is indicated and follows, but ventilation is what keeps them alive while it is drawn up and while it takes effect. Passive oxygen does not correct inadequate minute ventilation.',
  },
  {
    code: 'BD-22',
    domain: 'medical-ob-gyn',
    stem: 'A woman who is 34 weeks pregnant becomes lightheaded and pale while lying flat on the stretcher. You should:',
    options: [
      'raise the legs above the level of the heart',
      'sit her fully upright on the stretcher',
      'position her on her left side',
      'lower the head below the level of the body',
    ],
    answer: 2,
    rationale:
      'The uterus compresses the vena cava when she lies flat, and left lateral positioning moves it off. Raising the legs adds volume to a vein that is still compressed. Sitting up may help somewhat but does not relieve the obstruction as directly.',
  },
  {
    code: 'BD-23',
    domain: 'medical-ob-gyn',
    stem: 'Which finding in a patient with abdominal pain is most concerning?',
    options: [
      'pain that worsens when the abdomen is pressed',
      'a rigid abdomen with a rapid, weak pulse',
      'nausea with two episodes of vomiting',
      'pain that came on gradually over a day',
    ],
    answer: 1,
    rationale:
      'Rigidity together with signs of poor perfusion suggests peritoneal irritation with bleeding or perforation. Tenderness on palpation is present in almost every abdominal complaint, and nausea and gradual onset are too common to sort the sick from the well.',
  },
  {
    code: 'BD-24',
    domain: 'medical-ob-gyn',
    stem: 'A dialysis patient has missed their last two sessions. They are most at risk of:',
    options: [
      'a dangerously low blood sugar',
      'an infection at the vascular access site',
      'a sudden drop in blood pressure',
      'fluid overload and high potassium',
    ],
    answer: 3,
    rationale:
      'Missed dialysis means fluid and potassium accumulate, giving pulmonary edema and rhythm disturbance. Access infection and hypotension are genuine dialysis complications and can occur at any time, but neither follows from sessions being skipped the way volume and potassium do.',
  },
  {
    code: 'BD-25',
    domain: 'medical-ob-gyn',
    stem: 'A patient reports the worst headache of their life, at full intensity within seconds. This history is most concerning for:',
    options: [
      'a migraine with visual symptoms',
      'a tension headache from stress',
      'a sinus infection behind the eyes',
      'bleeding inside the skull',
    ],
    answer: 3,
    rationale:
      'Reaching maximum intensity within seconds — a thunderclap onset — is the pattern associated with subarachnoid hemorrhage and warrants urgent evaluation. Other headaches can occasionally begin abruptly, so this is a red flag rather than a diagnosis.',
  },
  {
    code: 'BD-26',
    domain: 'medical-ob-gyn',
    stem: 'During delivery a loop of umbilical cord appears at the vaginal opening ahead of the baby. You should:',
    options: [
      'check the cord for a pulse and reassess',
      'relieve pressure on the cord and transport',
      'position the mother flat and await delivery',
      'clamp the cord in two places and cut it',
    ],
    answer: 1,
    rationale:
      'A prolapsed cord is compressed by the presenting part and the baby loses its blood supply. A gloved hand lifts the presenting part off the cord while you move. Checking a pulse without relieving pressure wastes the time that matters, and lying flat worsens the compression.',
  },
  {
    code: 'BD-27',
    domain: 'medical-ob-gyn',
    stem: 'An asthmatic patient who was wheezing loudly now has a quiet chest and is difficult to rouse. This change means:',
    options: [
      'the attack is resolving well',
      'the wheezing was misheard earlier',
      'air movement has become inadequate',
      'the inhaler has taken full effect',
    ],
    answer: 2,
    rationale:
      'Wheezing requires air moving past a narrowed airway. A silent chest in a deteriorating asthmatic means too little air is moving to make the sound. It is among the most ominous findings in asthma and is routinely mistaken for improvement.',
  },
  {
    code: 'BD-28',
    domain: 'medical-ob-gyn',
    stem: 'Which patient with a fever should be transported most urgently?',
    options: [
      'an adult with a cough and a temperature of 102 F',
      'a child with a rash that does not blanch',
      'a teenager with a sore throat and fever',
      'an adult with fever and generalized body aches',
    ],
    answer: 1,
    rationale:
      'A non-blanching rash with fever raises meningococcal disease, which can progress within hours. The others describe common infections. The discriminator is not how high the fever is but what the skin is doing.',
  },
  {
    code: 'BD-29',
    domain: 'medical-ob-gyn',
    stem: 'A patient found in a hot apartment is confused and disoriented after prolonged heat exposure. You should immediately:',
    options: [
      'begin active cooling and move them',
      'give oral fluids to replace the losses',
      'wrap them to prevent further shivering',
      'wait for a core temperature reading',
    ],
    answer: 0,
    rationale:
      'Altered mental status after significant heat exposure is heat stroke until proven otherwise, and time at temperature determines the damage. Skin may be dry or still sweating, so the mental status is the discriminator. Oral fluids are unsafe in a confused patient.',
  },
  {
    code: 'BD-30',
    domain: 'medical-ob-gyn',
    stem: 'A patient took an intentional overdose two hours ago and currently appears well. You should:',
    options: [
      'wait on scene for symptoms to appear',
      'strongly encourage transport and contact medical control',
      'accept a refusal once they appear lucid',
      'call the pharmacy for advice before deciding',
    ],
    answer: 1,
    rationale:
      'Many ingestions have a latent period and looking well at two hours predicts little. An intentional overdose does not by itself remove decision-making capacity, so a refusal has to be worked through properly — which is why medical control and poison control are involved, and why local refusal procedure applies.',
  },

  // ----- Cardiology and Resuscitation (7 of 50 = 14%) ----------------------
  {
    code: 'BD-31',
    domain: 'cardiology',
    stem: 'You witness an adult collapse and find no pulse. Your first action is to:',
    options: [
      'deliver two rescue breaths',
      'check the rhythm on the monitor',
      'open the airway and look',
      'begin chest compressions',
    ],
    answer: 3,
    rationale:
      'Compressions come first in adult arrest. The blood is still oxygenated at the moment of collapse; what has stopped is circulation. Time spent on airway before compressions is perfusion the brain does not get.',
  },
  {
    code: 'BD-32',
    domain: 'cardiology',
    stem: 'An adult is in cardiac arrest, compressions are underway, and the AED identifies ventricular fibrillation. Alongside high-quality CPR, the most time-critical intervention is:',
    options: [
      'defibrillation without further delay',
      'placement of an advanced airway',
      'transport to the nearest hospital',
      'administration of high-flow oxygen',
    ],
    answer: 0,
    rationale:
      'For a shockable rhythm, survival falls with every minute defibrillation is delayed. Airway, oxygen and transport all matter, but none of them changes outcome in ventricular fibrillation the way an early shock does.',
  },
  {
    code: 'BD-33',
    domain: 'cardiology',
    stem: 'Chest compressions on an average adult should be delivered to a depth of at least:',
    options: [
      'one inch',
      'two inches',
      'four inches',
      'three inches',
    ],
    answer: 1,
    rationale:
      'At least two inches, or five centimeters, for an average adult, while avoiding depths beyond about 2.4 inches. Shallow compressions do not generate perfusion pressure, and not going deep enough is the more common error in practice.',
  },
  {
    code: 'BD-34',
    domain: 'cardiology',
    stem: 'A 58-year-old with chest pain is alert, has no aspirin allergy, has no bleeding, and has taken none today. Within EMT scope you should:',
    options: [
      'withhold aspirin until ALS is on scene',
      'withhold aspirin because of the pain severity',
      'give chewable aspirin per protocol',
      'give aspirin only if the pain is crushing',
    ],
    answer: 2,
    rationale:
      'Aspirin is an EMT-level medication in suspected acute coronary syndrome and its benefit depends on being given early. Chewed rather than swallowed whole, because absorption is faster. Nothing in the stem contraindicates it, and pain character does not decide it.',
  },
  {
    code: 'BD-35',
    domain: 'cardiology',
    stem: 'The AED advises "no shock" in a pulseless patient. You should:',
    options: [
      'resume compressions immediately',
      'check the pads and reanalyze',
      'wait for the next analysis cycle',
      'provide ventilations only',
    ],
    answer: 0,
    rationale:
      'No shock advised does not mean no arrest — the rhythm is not shockable, and compressions are the treatment. The dangerous reading is that the machine has cleared the patient, and the pause while people reanalyze costs perfusion.',
  },
  {
    code: 'BD-36',
    domain: 'cardiology',
    stem: 'Which patient carries the greatest risk of an atypical or painless presentation of a heart attack?',
    options: [
      'a young adult who is physically fit',
      'a middle-aged man who smokes heavily',
      'an 80-year-old woman with long-standing diabetes',
      'an adult with a family history of heart disease',
    ],
    answer: 2,
    rationale:
      'Advanced age, female sex and long-standing diabetes each raise the likelihood of an atypical presentation, and this patient carries all three. It is a matter of probability, not a rule: many women and many patients with diabetes do report typical chest pain.',
  },
  {
    code: 'BD-37',
    domain: 'cardiology',
    stem: 'A patient in cardiac arrest has a defibrillator implanted under the skin below the collarbone. You should:',
    options: [
      'avoid defibrillating this patient',
      'place the pads clear of the device',
      'deactivate the device before shocking',
      'place a pad directly over the device',
    ],
    answer: 1,
    rationale:
      'An implanted device does not prevent external defibrillation. Pads are simply sited a short distance away rather than directly over it. Withholding the shock, or delaying to deactivate anything, is the error worth guarding against.',
  },

  // ----- Airway, Respiration and Ventilation (5 of 50 = 10%) ---------------
  {
    code: 'BD-38',
    domain: 'airway',
    stem: 'Which finding is a contraindication to inserting an oropharyngeal airway?',
    options: [
      'snoring respirations in an unresponsive patient',
      'no response to a painful stimulus',
      'an intact gag reflex',
      'blood and secretions in the mouth',
    ],
    answer: 2,
    rationale:
      'An intact gag reflex means the device will be rejected and may provoke vomiting and aspiration. Secretions call for suctioning first and then an airway, so they delay the device rather than forbid it; the other two findings are reasons to place one.',
  },
  {
    code: 'BD-39',
    domain: 'airway',
    stem: 'You are opening the airway of an unresponsive infant with no suspected injury. The head should be placed:',
    options: [
      'extended as far back as it will go',
      'in a neutral, slightly extended position',
      'flexed forward toward the chest',
      'turned to one side to drain secretions',
    ],
    answer: 1,
    rationale:
      'An infant has a large occiput and a soft trachea, so hyperextension kinks the airway shut rather than opening it. A neutral, slightly extended position aligns it, and padding under the shoulders often helps hold that position.',
  },
  {
    code: 'BD-40',
    domain: 'airway',
    stem: 'You are ventilating a child with a bag-mask. Squeezing the bag too fast and too forcefully risks:',
    options: [
      'gastric distension and reduced venous return',
      'rupturing the alveoli in both lungs',
      'delivering an excessive oxygen concentration',
      'cooling and drying the airway too quickly',
    ],
    answer: 0,
    rationale:
      'Excess pressure opens the esophagus and inflates the stomach, which splints the diaphragm and invites vomiting. Raised intrathoracic pressure also reduces venous return and cardiac output, which is why over-ventilation is harmful in arrest as well as everyday care.',
  },
  {
    code: 'BD-41',
    domain: 'airway',
    stem: 'A conscious adult is choking but can cough forcefully. You should:',
    options: [
      'deliver abdominal thrusts without delay',
      'stay with them and monitor closely',
      'perform a finger sweep between coughs',
      'lay them down and begin back blows',
    ],
    answer: 1,
    rationale:
      'A forceful cough moves more air than any maneuver you can perform, so the obstruction is mild and the patient is managing it. You stay with them and act the moment the cough weakens, the patient cannot speak, or the obstruction becomes severe.',
  },
  {
    code: 'BD-42',
    domain: 'airway',
    stem: 'An adult has a strong pulse but is breathing six times per minute with shallow chest rise and increasing drowsiness. You should:',
    options: [
      'apply oxygen by nasal cannula',
      'apply a nonrebreather mask',
      'assist ventilations with a bag-mask and oxygen',
      'apply continuous positive airway pressure',
    ],
    answer: 2,
    rationale:
      'The patient is ventilating inadequately — the rate and the depth are both too low — and passive oxygen cannot correct inadequate minute ventilation however high the concentration. CPAP requires adequate spontaneous breathing, which this patient does not have.',
  },

  // ----- Trauma (4 of 50 = 8%) ---------------------------------------------
  {
    code: 'BD-43',
    domain: 'trauma',
    stem: 'Firm direct pressure has failed to control bright red bleeding spurting from a forearm wound. Your next intervention is:',
    options: [
      'elevating the limb above the heart',
      'pressing on a proximal pressure point',
      'a commercial tourniquet proximal to the injury',
      'a cold pack applied over the dressing',
    ],
    answer: 2,
    rationale:
      'When direct pressure fails to control life-threatening extremity bleeding, a commercial tourniquet placed proximal to the injury is the next step and should not be delayed. Elevation and pressure points are not reliable substitutes.',
  },
  {
    code: 'BD-44',
    domain: 'trauma',
    stem: 'A patient is impaled by a metal rod through the thigh. You should:',
    options: [
      'stabilize it in place and pad around it',
      'remove it and pack the wound firmly',
      'shorten it now to simplify the move',
      'loosen it slightly to reduce the pressure',
    ],
    answer: 0,
    rationale:
      'The object may be tamponading a vessel, and disturbing it releases that pressure with no way to control what follows. Shortening is done only when the length genuinely prevents transport, and it is a decision taken with medical direction rather than a routine step.',
  },
  {
    code: 'BD-45',
    domain: 'trauma',
    stem: 'Which findings in an injured eight-year-old are most consistent with compensated shock?',
    options: [
      'a falling blood pressure with a slow pulse',
      'warm pink hands with a strong radial pulse',
      'a normal heart rate with cool, dry skin',
      'a normal blood pressure with delayed refill',
    ],
    answer: 3,
    rationale:
      'Compensation holds the blood pressure up while the periphery shuts down, so normal pressure with delayed capillary refill and tachycardia is the picture. In children this compensation is particularly effective, and a falling pressure is a late finding rather than an early one.',
  },
  {
    code: 'BD-46',
    domain: 'trauma',
    stem: 'A patient struck by a car has an obviously deformed femur and is breathing rapidly and shallowly. During the primary assessment, priority goes to:',
    options: [
      'splinting the deformed femur',
      'supporting ventilation and oxygenation',
      'treating the pain the patient reports',
      'documenting the mechanism of injury',
    ],
    answer: 1,
    rationale:
      'Airway and breathing precede everything else in the primary assessment, however dramatic the limb looks. A visible deformity draws attention away from the finding more likely to kill, and that pull is why the survey has a fixed order.',
  },

  // ----- EMS Operations (4 of 50 = 8%) -------------------------------------
  {
    code: 'BD-47',
    domain: 'ems-operations',
    stem: 'You arrive at a collision and see a downed power line lying across the vehicle. You should:',
    options: [
      'approach the vehicle from the opposite side',
      'stay clear and have the utility respond',
      'move the line aside with a dry wooden tool',
      'tell the occupants to step out and away',
    ],
    answer: 1,
    rationale:
      'A downed line is energized until the utility confirms otherwise, and ground current makes the area around the vehicle hazardous from any direction. Occupants are safest staying inside; stepping out puts them in the path of the current as they contact the ground.',
  },
  {
    code: 'BD-48',
    domain: 'ems-operations',
    stem: 'In START triage at a multiple-casualty incident, a patient who can walk to a designated area is initially tagged:',
    options: [
      'immediate',
      'delayed',
      'minor',
      'expectant',
    ],
    answer: 2,
    rationale:
      'Walking establishes an airway, breathing and enough perfusion to move, so the first sort is by ambulation. It is an initial sort rather than a diagnosis: walking patients are reassessed, because an occasional serious injury walks.',
  },
  {
    code: 'BD-49',
    domain: 'ems-operations',
    stem: 'On arrival at an incident involving an unknown chemical, you should first:',
    options: [
      'position uphill and upwind of the scene',
      'approach to read the placard on the tank',
      'begin decontaminating anyone walking out',
      'enter to remove patients from the area',
    ],
    answer: 0,
    rationale:
      'Position dictates everything that follows and is chosen before the material is identified. Placards are read from a distance with binoculars; decontamination and rescue belong to trained teams in appropriate protection, not the first arriving crew.',
  },
  {
    code: 'BD-50',
    domain: 'ems-operations',
    stem: 'You are approaching a red light with lights and siren operating. You should:',
    options: [
      'proceed once you hear the siren acknowledged',
      'maintain speed while the way ahead looks clear',
      'sound the air horn and continue through',
      'slow or stop, then clear each lane visually',
    ],
    answer: 3,
    rationale:
      'Lights and siren request the right of way, they do not confer it. Slowing or stopping and clearing every lane individually is what makes the intersection safe, because a driver who has not seen or heard you is the one you collide with.',
  },
]
