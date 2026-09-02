// ---------------------------------------------------------------------------
// The day-one baseline diagnostic. 50 items, ungraded.
//
// WHAT IT IS FOR. It measures what a student ARRIVES with, on the first
// morning, so every later measurement has a zero point to move against. It is
// not a hurdle and it is not graded — a diagnostic that counts teaches students
// to protect a score instead of showing you what they do not know.
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

export const BASELINE_ITEMS: BaselineItem[] = [
  // ----- Clinical Judgment (17 of 50 = 34%) --------------------------------
  //
  // The largest domain on the certification exam and the one the prior course
  // gave no dedicated instruction. These items ask what a provider DOES with
  // findings, not what the findings are called.
  {
    code: 'BD-01',
    domain: 'clinical-judgment',
    stem: 'You arrive to find a 60-year-old man slumped at a table, breathing noisily and not responding to your voice. Your first action is to:',
    options: [
      'obtain a set of baseline vital signs',
      'open the airway with a jaw thrust',
      'apply oxygen by nonrebreathing mask',
      'ask bystanders when he was last normal',
    ],
    answer: 1,
    rationale:
      'Noisy breathing in an unresponsive patient is an obstructed airway until proven otherwise, and it is the first thing that will kill him. Oxygen through an obstructed airway does not reach the lungs; vitals and history matter and can wait a few seconds.',
  },
  {
    code: 'BD-02',
    domain: 'clinical-judgment',
    stem: 'A patient who fell is alert and answering questions, but repeats the same question to you three times in four minutes. This finding is best described as:',
    options: [
      'an expected response to the stress of injury',
      'evidence of a preexisting dementia',
      'a normal variant in older patients',
      'a change in mental status needing transport',
    ],
    answer: 3,
    rationale:
      'Repetitive questioning after a head strike is short-term memory loss and a genuine change in mental status. It is a common early sign of intracranial injury and is often dismissed because the patient is otherwise alert and conversational.',
  },
  {
    code: 'BD-03',
    domain: 'clinical-judgment',
    stem: 'You have applied oxygen to a patient in respiratory distress. Which finding best tells you the intervention is working?',
    options: [
      'the pulse oximeter now reads 96%',
      'the patient says the mask feels better',
      'the respiratory rate has fallen to 12',
      'the patient is speaking in longer sentences',
    ],
    answer: 3,
    rationale:
      'Sentence length reflects work of breathing, which is what you treated. A saturation can improve while the patient tires; a rate that falls can mean exhaustion rather than relief; comfort is subjective. This is the re-evaluate step of the judgment cycle.',
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
      'A patient who can scream has a patent airway and is moving air. Quiet and rapidly breathing is the one whose airway or perfusion is failing. The loudest patient is rarely the sickest, and this is the cue-recognition error that costs the most.',
  },
  {
    code: 'BD-05',
    domain: 'clinical-judgment',
    stem: 'A diabetic patient is confused and sweaty. A family member says she took her insulin but skipped lunch. Your working hypothesis is:',
    options: [
      'an insulin dose that was set too low',
      'blood glucose that has fallen too far',
      'an early infection driving the confusion',
      'blood glucose that has risen too high',
    ],
    answer: 1,
    rationale:
      'Insulin taken without food drives glucose down, and sweating with confusion is the classic picture. Hyperglycaemia is the tempting distractor because the patient is diabetic, but it comes on over hours to days and presents dry, not diaphoretic.',
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
      'A change in condition sends you back to the beginning, not forward. The judgment cycle closes by evaluating outcomes and re-entering at cue recognition; carrying on with a plan built on findings that have since changed is the error the loop exists to prevent.',
  },
  {
    code: 'BD-07',
    domain: 'clinical-judgment',
    stem: 'A patient with chest pain has a blood pressure of 88/60 and cool, moist skin. Which finding would most change your management?',
    options: [
      'a reported pain score of nine out of ten',
      'a history of high blood pressure',
      'the pain having started while at rest',
      'jugular veins that are visibly distended',
    ],
    answer: 3,
    rationale:
      'Distended neck veins with hypotension point to a pump or obstructive problem rather than volume loss, and that changes whether fluid helps or harms. Pain severity, history and onset all inform the picture but none of them redirects treatment the way that finding does.',
  },
  {
    code: 'BD-08',
    domain: 'clinical-judgment',
    stem: 'Your partner tells you the patient "looks fine" while the patient tells you they feel a sense of impending doom. You should:',
    options: [
      'treat the feeling as a significant finding',
      'reassure the patient and continue as planned',
      'attribute the feeling to situational anxiety',
      'defer to your partner as the senior provider',
    ],
    answer: 0,
    rationale:
      'A sense of impending doom is a recognised early finding in acute coronary syndrome, anaphylaxis and internal bleeding, and it commonly precedes any change in vital signs. Discounting a subjective cue because the objective picture is still normal is a classic analysis failure.',
  },
  {
    code: 'BD-09',
    domain: 'clinical-judgment',
    stem: 'An elderly patient on a beta blocker has lost a significant volume of blood. Compared with a healthy adult, you should expect their heart rate to:',
    options: [
      'rise far higher than you would expect',
      'stay lower than the blood loss suggests',
      'fall steadily as the bleeding continues',
      'track the blood loss in the usual way',
    ],
    answer: 1,
    rationale:
      'Beta blockade blunts the tachycardic response, so a heart rate that looks reassuring can sit on top of serious hypovolaemia. Judging blood loss by pulse alone in this patient is how a compensating bleed gets missed.',
  },
  {
    code: 'BD-10',
    domain: 'clinical-judgment',
    stem: 'You are handing a patient over at the emergency department. The most important element of your report is:',
    options: [
      'a full recitation of the medical history',
      'the exact times each vital sign was taken',
      'why you believe the patient is sick',
      'the route and traffic conditions en route',
    ],
    answer: 2,
    rationale:
      'Handover transfers your reasoning, not just your data. The receiving team can read numbers off the chart; what they cannot recover is what you saw at the scene and what it made you think. The judgment domain covers communication for exactly this reason.',
  },
  {
    code: 'BD-11',
    domain: 'clinical-judgment',
    stem: 'A patient refuses transport after a low-speed collision. Before accepting the refusal you must first establish that they:',
    options: [
      'have someone available to drive them',
      'have no visible injuries at all',
      'have signed the refusal paperwork',
      'can understand the risks of refusing',
    ],
    answer: 3,
    rationale:
      'A refusal is only valid if the patient has decision-making capacity, and capacity is judged by whether they can understand and repeat back the risks. A signature from a patient who cannot do that documents nothing; the other options are useful but none of them makes the refusal lawful.',
  },
  {
    code: 'BD-12',
    domain: 'clinical-judgment',
    stem: 'Your patient has a respiratory rate of 30 and a pulse oximetry reading of 99%. This combination should prompt you to:',
    options: [
      'accept that oxygenation is adequate',
      'reduce the oxygen you are delivering',
      'recheck the probe on the other hand',
      'look for a cause of the rapid breathing',
    ],
    answer: 3,
    rationale:
      'A normal saturation says oxygen is bound to haemoglobin; it says nothing about why the patient is working so hard. Rapid breathing with good saturation points at acidosis, pain, anxiety or carbon monoxide — a normal number is a reason to look further, not to stop.',
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
      'Pallor, diaphoresis and tachycardia with back pain in an older patient raise abdominal aortic aneurysm and other catastrophic causes. The dispatch complaint anchors you low; the physical findings should override it, and failing to let them is an anchoring error.',
  },
  {
    code: 'BD-14',
    domain: 'clinical-judgment',
    stem: 'Which set of findings would most concern you in a two-year-old?',
    options: [
      'crying loudly and reaching for the parent',
      'flushed cheeks and a temperature of 38.5°C',
      'lying quietly and not tracking your movement',
      'refusing to answer any of your questions',
    ],
    answer: 2,
    rationale:
      'A well toddler resists strangers and seeks a parent. Quiet, uninterested and not tracking is decompensation. Crying vigorously is reassuring, fever is common and refusing to talk to a stranger is developmentally normal — the frightening child is the one who has stopped objecting.',
  },
  {
    code: 'BD-15',
    domain: 'clinical-judgment',
    stem: 'Halfway to hospital your patient’s condition changes markedly. You should reassess:',
    options: [
      'the specific system you have been treating',
      'the primary survey from the beginning',
      'the vital signs and nothing further',
      'the history for anything you missed',
    ],
    answer: 1,
    rationale:
      'Any significant change returns you to the primary survey, because the new problem need not be in the system you were treating. Rechecking only what you were already watching is how a developing airway problem is missed in a patient being treated for something else.',
  },
  {
    code: 'BD-16',
    domain: 'clinical-judgment',
    stem: 'You disagree with your partner about whether a patient needs immediate transport. The most appropriate first step is to:',
    options: [
      'state the findings that concern you',
      'defer, since the crew must agree',
      'transport quietly and discuss it later',
      'ask the patient which they would prefer',
    ],
    answer: 0,
    rationale:
      'Naming the specific findings moves the conversation from opinion to evidence, and it is what closed-loop crew communication asks for. Deferring or staying silent to avoid friction is the failure mode the leadership half of this domain was added to test.',
  },
  {
    code: 'BD-17',
    domain: 'clinical-judgment',
    stem: 'A patient’s skin is warm and dry, but their radial pulse is weak and their capillary refill is four seconds. These findings together suggest:',
    options: [
      'perfusion that is adequate for now',
      'a reading affected by a cold environment',
      'a normal variant in a well-conditioned adult',
      'perfusion that is failing despite the skin',
    ],
    answer: 3,
    rationale:
      'A weak pulse with delayed refill is poor perfusion whatever the skin feels like. Warm dry skin is the reason distributive shock gets missed early — the finding people are taught to look for is absent, and the two that matter are present.',
  },

  // ----- Medical / OB / GYN (13 of 50 = 26%) -------------------------------
  {
    code: 'BD-18',
    domain: 'medical-ob-gyn',
    stem: 'The most reliable way to distinguish a stroke from hypoglycaemia in a patient with one-sided weakness is to:',
    options: [
      'check the blood glucose level',
      'ask when the symptoms began',
      'test the grip strength in both hands',
      'look for a facial droop on one side',
    ],
    answer: 0,
    rationale:
      'Hypoglycaemia mimics stroke closely and can produce genuine one-sided weakness. Only a glucose reading separates them, which is why it is part of the stroke assessment rather than an optional extra. The other three are all positive in both conditions.',
  },
  {
    code: 'BD-19',
    domain: 'medical-ob-gyn',
    stem: 'A patient is having a generalised seizure when you arrive. Your priority is to:',
    options: [
      'restrain the limbs to prevent injury',
      'place a bite block between the teeth',
      'protect the head and clear the space',
      'move the patient to the stretcher',
    ],
    answer: 2,
    rationale:
      'You cannot stop the seizure, so you prevent it from causing harm. Restraint causes fractures, forcing anything between the teeth breaks them, and moving a convulsing patient risks both of you. Protection and timing are the whole of the intervention.',
  },
  {
    code: 'BD-20',
    domain: 'medical-ob-gyn',
    stem: 'A patient with a known peanut allergy has hives and is now wheezing after eating. This progression indicates:',
    options: [
      'a local reaction confined to the skin',
      'a mild reaction that will settle on its own',
      'an anxiety response to the exposure',
      'a systemic reaction involving the airway',
    ],
    answer: 3,
    rationale:
      'Once a reaction crosses from skin to airway it is systemic and it is anaphylaxis, whatever the blood pressure is doing. Waiting for hypotension before naming it is the delay that kills; wheezing after a known exposure is the point of no return.',
  },
  {
    code: 'BD-21',
    domain: 'medical-ob-gyn',
    stem: 'An unresponsive patient has slow, shallow breathing and pinpoint pupils. The most likely cause is:',
    options: [
      'a narcotic overdose',
      'a stimulant overdose',
      'a diabetic emergency',
      'a head injury',
    ],
    answer: 0,
    rationale:
      'Respiratory depression with constricted pupils is the opioid picture. Stimulants dilate pupils and speed breathing; a diabetic emergency does not constrict pupils; head injury more often gives unequal pupils and an irregular pattern rather than a symmetrically slow one.',
  },
  {
    code: 'BD-22',
    domain: 'medical-ob-gyn',
    stem: 'A woman who is 34 weeks pregnant becomes lightheaded and pale while lying flat on the stretcher. You should:',
    options: [
      'raise the legs above the heart',
      'sit her fully upright on the stretcher',
      'tilt her onto her left side',
      'lower the head below the body',
    ],
    answer: 2,
    rationale:
      'The uterus compresses the vena cava when she lies flat, and the fix is to move it off — a left lateral tilt. Raising the legs adds volume to a vein that is still compressed, and sitting up does not relieve the obstruction.',
  },
  {
    code: 'BD-23',
    domain: 'medical-ob-gyn',
    stem: 'Which finding in a patient complaining of abdominal pain is most concerning?',
    options: [
      'pain that worsens when the abdomen is pressed',
      'a rigid abdomen with a rapid weak pulse',
      'nausea with two episodes of vomiting',
      'pain that came on gradually over a day',
    ],
    answer: 1,
    rationale:
      'Rigidity with signs of poor perfusion suggests peritoneal irritation and bleeding or perforation. Tenderness on palpation is present in almost every abdominal complaint, and nausea and gradual onset are far too common to sort the sick from the well.',
  },
  {
    code: 'BD-24',
    domain: 'medical-ob-gyn',
    stem: 'A dialysis patient has missed their last two sessions. They are most at risk of:',
    options: [
      'a dangerously low blood sugar',
      'a serious infection at the access site',
      'a sudden drop in blood pressure',
      'fluid overload and high potassium',
    ],
    answer: 3,
    rationale:
      'Missed dialysis means fluid and potassium accumulate, giving pulmonary oedema and rhythm disturbance. Access infection and hypotension are real dialysis complications but they relate to the treatment happening, not to it being skipped.',
  },
  {
    code: 'BD-25',
    domain: 'medical-ob-gyn',
    stem: 'A patient reports the worst headache of their life, beginning suddenly a few minutes ago. This history most suggests:',
    options: [
      'a migraine with visual symptoms',
      'a tension headache from stress',
      'a sinus infection behind the eyes',
      'bleeding inside the skull',
    ],
    answer: 3,
    rationale:
      'Sudden onset at maximum intensity is the described pattern of subarachnoid haemorrhage. Migraine, tension and sinus headaches all build over time; the word doing the work in the stem is not "worst" but "suddenly".',
  },
  {
    code: 'BD-26',
    domain: 'medical-ob-gyn',
    stem: 'During delivery the umbilical cord appears at the vaginal opening before the baby. You should:',
    options: [
      'push the cord gently back inside',
      'relieve pressure on the cord and transport',
      'clamp and cut the cord immediately',
      'hold the delivery until hospital arrival',
    ],
    answer: 1,
    rationale:
      'A prolapsed cord is compressed by the presenting part and the baby loses its blood supply. You relieve that pressure with a gloved hand and move. Replacing the cord causes spasm, cutting it ends oxygen delivery, and delivery cannot be held back by instruction.',
  },
  {
    code: 'BD-27',
    domain: 'medical-ob-gyn',
    stem: 'An asthmatic patient who was wheezing loudly now has a quiet chest and is difficult to rouse. This change means:',
    options: [
      'the attack is resolving well',
      'the wheezing was misheard earlier',
      'air movement has become inadequate',
      'a sedative has taken effect',
    ],
    answer: 2,
    rationale:
      'Wheezing requires air moving past a narrowed airway. A silent chest in a deteriorating asthmatic means too little air is moving to make the sound — it is the most ominous finding in asthma and it is routinely mistaken for improvement.',
  },
  {
    code: 'BD-28',
    domain: 'medical-ob-gyn',
    stem: 'Which patient with a fever should be transported most urgently?',
    options: [
      'an adult with a cough and a temperature of 39°C',
      'a child with a rash that does not blanch',
      'a teenager with a sore throat and fever',
      'an adult with fever and body aches',
    ],
    answer: 1,
    rationale:
      'A non-blanching rash with fever suggests meningococcal disease, which kills in hours. The others describe common infections; the discriminator here is not how high the fever is but what the skin is doing.',
  },
  {
    code: 'BD-29',
    domain: 'medical-ob-gyn',
    stem: 'A patient found in a hot apartment has hot, dry skin and is confused. You should immediately:',
    options: [
      'begin active cooling and move them',
      'give oral fluids to replace losses',
      'wrap them to prevent further shivering',
      'wait for a temperature reading first',
    ],
    answer: 0,
    rationale:
      'Hot dry skin with altered mental status is heat stroke, and time at temperature determines the damage. Oral fluids are unsafe in a confused patient, warming is the opposite of what is needed, and cooling starts before any measurement.',
  },
  {
    code: 'BD-30',
    domain: 'medical-ob-gyn',
    stem: 'A patient took an intentional overdose two hours ago and now appears well. You should:',
    options: [
      'accept a refusal if they seem lucid',
      'transport, since effects may be delayed',
      'wait on scene for symptoms to appear',
      'contact the pharmacy for advice first',
    ],
    answer: 1,
    rationale:
      'Many overdoses have a latent period, and looking well two hours in predicts nothing. Some of the most lethal ingestions are asymptomatic for many hours, so the well-appearing patient after a deliberate overdose is a transport, not a refusal.',
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
      'Compressions come first in adult arrest. The blood is still oxygenated at the moment of collapse; what has stopped is circulation. Every second spent on airway before compressions is perfusion the brain does not get.',
  },
  {
    code: 'BD-32',
    domain: 'cardiology',
    stem: 'The single factor that most improves survival in witnessed cardiac arrest is:',
    options: [
      'early defibrillation with minimal interruption',
      'early placement of an advanced airway',
      'rapid transport to the nearest hospital',
      'early administration of oxygen',
    ],
    answer: 0,
    rationale:
      'Compressions and early defibrillation are the only two interventions with a consistent survival benefit in shockable arrest. Airway, oxygen and transport all matter but none of them changes outcome the way a shock delivered early does.',
  },
  {
    code: 'BD-33',
    domain: 'cardiology',
    stem: 'Chest compressions on an adult should be delivered to a depth of at least:',
    options: [
      'one inch',
      'two inches',
      'four inches',
      'three inches',
    ],
    answer: 1,
    rationale:
      'At least two inches, and not beyond about two and a half. Shallow compressions do not generate perfusion pressure; the common error in practice is not going deep enough rather than too deep.',
  },
  {
    code: 'BD-34',
    domain: 'cardiology',
    stem: 'A patient describes pressure in the chest that spreads to the jaw. They are most likely experiencing:',
    options: [
      'a muscular strain in the chest wall',
      'inflammation of the airway lining',
      'reduced blood flow to the heart',
      'a spasm of the oesophagus',
    ],
    answer: 2,
    rationale:
      'Pressure radiating to the jaw, neck or arm is the referred pattern of cardiac ischaemia. Oesophageal spasm is the strongest distractor because it genuinely mimics it, but the referral pattern and the character point at the heart first.',
  },
  {
    code: 'BD-35',
    domain: 'cardiology',
    stem: 'The AED advises "no shock" in a pulseless patient. You should:',
    options: [
      'resume compressions immediately',
      'check the pads and reanalyse',
      'wait for the next analysis cycle',
      'begin ventilations only',
    ],
    answer: 0,
    rationale:
      'No shock advised does not mean no arrest — the rhythm is non-shockable and compressions are the treatment. The dangerous reading is that the machine has cleared the patient, and the pause while people reanalyse costs perfusion.',
  },
  {
    code: 'BD-36',
    domain: 'cardiology',
    stem: 'Which chest pain patient is most likely to present without pain at all?',
    options: [
      'a young adult who is physically fit',
      'a middle-aged man who smokes',
      'an older woman with diabetes',
      'an adult with a family history of heart disease',
    ],
    answer: 2,
    rationale:
      'Women, older patients and diabetics present atypically, and this patient is all three. Diabetic neuropathy blunts the pain, so the presentation is weakness, breathlessness or nausea — the group most likely to be missed is the group at highest risk.',
  },
  {
    code: 'BD-37',
    domain: 'cardiology',
    stem: 'A patient in cardiac arrest has a defibrillator implanted under the skin. You should:',
    options: [
      'avoid defibrillating this patient',
      'place the pads clear of the device',
      'deactivate the device before shocking',
      'place a pad directly over the device',
    ],
    answer: 1,
    rationale:
      'An implanted device does not stop external defibrillation; you simply site the pads a short distance away so the energy is not shunted through it. Withholding the shock, or delaying to deactivate anything, is the error worth guarding against.',
  },

  // ----- Airway, Respiration and Ventilation (5 of 50 = 10%) ---------------
  {
    code: 'BD-38',
    domain: 'airway',
    stem: 'An oropharyngeal airway should be withheld in a patient who:',
    options: [
      'has noisy, snoring respirations',
      'is unresponsive to painful stimulus',
      'has a gag reflex still present',
      'has secretions pooling in the mouth',
    ],
    answer: 2,
    rationale:
      'An intact gag reflex means the device will be rejected and may cause vomiting and aspiration. The other three findings are reasons to place one, not reasons to hold off.',
  },
  {
    code: 'BD-39',
    domain: 'airway',
    stem: 'The most common cause of airway obstruction in an unresponsive patient is:',
    options: [
      'swelling of the airway tissues',
      'the tongue falling against the pharynx',
      'a foreign body lodged in the throat',
      'secretions collecting in the airway',
    ],
    answer: 1,
    rationale:
      'Loss of muscle tone lets the tongue fall back, and it is why a simple position change opens most obstructed airways. The other three occur but none is as common, and none is corrected as easily.',
  },
  {
    code: 'BD-40',
    domain: 'airway',
    stem: 'You are ventilating an adult with a bag-mask. Squeezing the bag too fast and too hard mainly risks:',
    options: [
      'forcing air into the stomach',
      'rupturing the alveoli in the lungs',
      'delivering too much oxygen',
      'cooling the airway too quickly',
    ],
    answer: 0,
    rationale:
      'Excess pressure opens the oesophagus and inflates the stomach, which splints the diaphragm and invites vomiting and aspiration. Gastric distension is the everyday consequence of over-enthusiastic ventilation, and it is preventable by slowing down.',
  },
  {
    code: 'BD-41',
    domain: 'airway',
    stem: 'A conscious adult is choking but can cough forcefully. You should:',
    options: [
      'deliver abdominal thrusts at once',
      'encourage them to keep coughing',
      'perform a finger sweep of the mouth',
      'lay them down and start back blows',
    ],
    answer: 1,
    rationale:
      'A forceful cough moves more air than any manoeuvre you can perform, so the obstruction is partial and the patient is managing it. Intervening converts a partial obstruction into a complete one, which is the harm the guidance is written to prevent.',
  },
  {
    code: 'BD-42',
    domain: 'airway',
    stem: 'A nasal cannula running at six litres per minute delivers approximately:',
    options: [
      'ninety percent oxygen',
      'seventy percent oxygen',
      'forty-four percent oxygen',
      'twenty-one percent oxygen',
    ],
    answer: 2,
    rationale:
      'A cannula adds roughly four percent per litre above room air, so six litres gives about forty-four percent. Higher figures require a mask with a reservoir; the practical point is that a cannula cannot deliver high-concentration oxygen however far you open it.',
  },

  // ----- Trauma (4 of 50 = 8%) ---------------------------------------------
  {
    code: 'BD-43',
    domain: 'trauma',
    stem: 'Bright red blood is spurting from a wound on the forearm. Your first action is to:',
    options: [
      'apply a tourniquet above the wound',
      'elevate the limb above the heart',
      'apply direct pressure to the wound',
      'pack the wound with gauze',
    ],
    answer: 2,
    rationale:
      'Direct pressure controls most external bleeding and is always the first step. A tourniquet is the right escalation when pressure fails, and reaching for it first is as much an error as never reaching for it at all.',
  },
  {
    code: 'BD-44',
    domain: 'trauma',
    stem: 'A patient is impaled by a metal rod through the thigh. You should:',
    options: [
      'stabilise the object where it lies',
      'remove it and control the bleeding',
      'shorten it for ease of transport',
      'rotate it to relieve the pressure',
    ],
    answer: 0,
    rationale:
      'The object may be tamponading a vessel, and removing it releases that pressure with no way to control what follows. It is stabilised in place; shortening is done only when its length genuinely prevents transport, and never by rotating it.',
  },
  {
    code: 'BD-45',
    domain: 'trauma',
    stem: 'Which finding is the earliest reliable sign of shock in a healthy young adult?',
    options: [
      'a falling systolic blood pressure',
      'a rising heart rate with cool skin',
      'a loss of consciousness',
      'an absent radial pulse',
    ],
    answer: 1,
    rationale:
      'Compensation raises the heart rate and shuts down the periphery long before pressure falls. A young adult holds their blood pressure until roughly a third of volume is gone, so waiting for hypotension is waiting until compensation has already failed.',
  },
  {
    code: 'BD-46',
    domain: 'trauma',
    stem: 'A patient struck by a car has an obviously deformed femur and is breathing rapidly and shallowly. You should address:',
    options: [
      'the breathing before the femur',
      'the femur before the breathing',
      'both at once with a second crew',
      'whichever the patient complains of',
    ],
    answer: 0,
    rationale:
      'Airway and breathing precede circulation and everything else, however dramatic the limb looks. A visible deformity draws attention away from the finding that is more likely to kill, and that pull is the reason the survey has a fixed order.',
  },

  // ----- EMS Operations (4 of 50 = 8%) -------------------------------------
  {
    code: 'BD-47',
    domain: 'ems-operations',
    stem: 'You arrive at a collision and see a downed power line across the vehicle. You should:',
    options: [
      'approach and check on the occupants',
      'move the line aside with a dry tool',
      'stay clear and request the utility',
      'tell the occupants to climb out',
    ],
    answer: 2,
    rationale:
      'A downed line is energised until the utility says otherwise, and there is no safe way to move one with equipment carried on an ambulance. Telling occupants to climb out puts them in the path of the current as they contact the ground.',
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
      'Walking establishes airway, breathing and enough perfusion to move, so the first sort is by ambulation. The tag is an initial sort and not a diagnosis — walking patients are reassessed, because an occasional serious injury walks.',
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
      'Position dictates everything that follows, and it is chosen before the material is identified. Placards are read from a distance with binoculars; decontamination and rescue are for trained teams in the right protection, not the first arriving crew.',
  },
  {
    code: 'BD-50',
    domain: 'ems-operations',
    stem: 'Most ambulance collisions at intersections occur because the driver:',
    options: [
      'was travelling above the speed limit',
      'assumed other drivers had yielded',
      'had failed to use the siren at all',
      'was unfamiliar with the local area',
    ],
    answer: 1,
    rationale:
      'Lights and siren request the right of way, they do not confer it, and the collision happens in the moment the driver assumes the request was received. Speed contributes but the proximate failure is the assumption, which is why clearing each lane individually is taught.',
  },
]
