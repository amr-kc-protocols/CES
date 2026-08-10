// ---------------------------------------------------------------------------
// Generates supabase/exam_questions_fixes.sql from the reviewer's findings.
//
// Every fix is keyed on the CURRENT stem text, never on the row id. The bank's
// ids are not stable: exam_questions.id is an identity column, and
// exam_questions_hard.sql deletes and re-inserts its tier, which renumbers it.
// A stem-keyed update that finds nothing is a no-op the script reports, where
// an id-keyed one would silently rewrite the wrong question.
//
// Where the reviewer's suggested wording would have made the correct option the
// single longest by a wide margin, the distractors are lengthened to match
// rather than the correction dropped. Length is a tell — an earlier pass over
// this bank measured it — so the fix and the property have to hold together.
// Run with: node scripts/gen-exam-fixes.mjs
// ---------------------------------------------------------------------------

/**
 * match  — the stem as it stands in the bank today (the lookup key)
 * stem   — replacement stem, or null to leave it
 * options/answer — full replacement, so a re-read of this file shows the item
 *          as it will end up rather than as a diff against something else
 * why    — the reviewer's reason, carried into the SQL as a comment
 */
const FIXES = [
  // ----- substantive corrections -------------------------------------------
  {
    id: 123,
    match: 'For an adult in respiratory arrest with a pulse, deliver one breath every:',
    options: [
      '3 seconds (20 breaths/min)',
      '6 seconds (10 breaths/min)',
      '10 seconds (6 breaths/min)',
      '15 seconds (4 breaths/min)',
    ],
    answer: 1,
    why: 'Current AHA wording is one breath every 6 seconds.',
  },
  {
    id: 162,
    match: 'Adult compression depth is at least:',
    stem: 'Adult chest compression depth should be:',
    options: [
      '1 to 1.5 in (2.5 to 4 cm)',
      '1.5 to 2 in (4 to 5 cm)',
      '2 to 2.4 in (5 to 6 cm)',
      '2.5 to 3 in (6.5 to 7.5 cm)',
    ],
    answer: 2,
    why: 'Depth has an upper bound (2.4 in / 6 cm), which "at least 2 inches" omits. Ranges keep the bound without making the key the longest option.',
  },
  {
    id: 166,
    match:
      'Before assisting a patient with prescribed nitroglycerin, a key contraindication to check is:',
    options: [
      'a resting heart rate above 60 beats/min',
      'PDE-5 inhibitor use within its exclusion interval',
      'a documented history of chronic hypertension',
      'a prior myocardial infarction over a year ago',
    ],
    answer: 1,
    why: '"Recent erectile-dysfunction medication" is too vague — the exclusion interval differs by drug.',
  },
  {
    id: 173,
    match: 'In women, the elderly, and diabetics, an MI may present as:',
    stem: 'An MI may present without chest pain as:',
    options: [
      'crushing substernal pain in every case',
      'fatigue and dyspnea without chest pain',
      'leg pain as the only presenting symptom',
      'localized itching with a spreading rash',
    ],
    answer: 1,
    why: 'A completely silent MI is also possible, so the old distractor D was defensible. Replaced with something clearly unrelated.',
  },
  {
    id: 176,
    match: 'Treatment for a conscious hypoglycemic patient who can swallow is:',
    stem: 'Treatment for a conscious hypoglycemic patient who can swallow and has no IV access is:',
    options: [
      'intravenous dextrose',
      'oral glucose',
      'intramuscular glucagon',
      'withholding all sugar',
    ],
    answer: 1,
    why: 'As written, oral glucose and IV dextrose were both defensible for an AEMT.',
  },
  {
    id: 197,
    match: 'An open ("sucking") chest wound is initially covered with:',
    stem: 'If a dressing is placed on an open ("sucking") chest wound, you should:',
    options: [
      'seal it on four sides and leave it undisturbed',
      'use a vented chest seal and reassess breathing',
      'pack the wound with gauze and apply pressure',
      'cover it loosely and leave the site open to air',
    ],
    answer: 1,
    why: 'Three-sided improvised seals are no longer the preferred general answer (2024 AHA/Red Cross First Aid Guidelines).',
  },
  {
    id: 203,
    match: 'The most immediately life-threatening bleeding to control is:',
    options: [
      'slow oozing that stops with light pressure',
      'rapid bleeding that continues despite pressure',
      'a shallow surface scrape with minor seepage',
      'an older bruise that is still discolored',
    ],
    answer: 1,
    why: 'Dangerous bleeding must not be identified by color.',
  },
  {
    id: 204,
    match: 'A burn that is dry, white/leathery or charred, and painless is:',
    stem: 'A burn that is dry, white or leathery, and painless is classified as:',
    options: ['superficial', 'partial-thickness', 'full-thickness', 'chemical'],
    answer: 2,
    why: 'The keyed option merely repeated the stem.',
  },
  {
    id: 217,
    match: 'Order: give 1 mg. On hand: 1 mg in 10 mL (1:10,000). You administer:',
    stem: 'Order: 1 mg. On hand: epinephrine 0.1 mg/mL. How many mL do you give?',
    options: ['1 mL', '10 mL', '0.1 mL', '100 mL'],
    answer: 1,
    why: 'Ratio expressions are a recognized medication-error risk (ISMP). Metric concentration instead.',
  },
  {
    id: 228,
    match: 'Newborn resuscitation adds chest compressions if the heart rate is below:',
    stem: 'After at least 30 seconds of effective ventilation that produces chest movement, newborn chest compressions are started if the heart rate is below:',
    options: ['100 beats/min', '60 beats/min', '40 beats/min', '80 beats/min'],
    answer: 1,
    why: 'Without the ventilation qualifier the item implies immediate compressions for any newborn HR below 60. Also retired below as a duplicate of the scenario version.',
  },
  {
    id: 232,
    match: 'A competent adult refusing care must be informed of the risks and:',
    stem: 'A competent adult refusing care should be managed by:',
    options: [
      'transporting them against their clearly stated wishes',
      'assessing capacity, explaining risks, documenting refusal',
      'restraining them until a family member arrives',
      'leaving without a report once they decline care',
    ],
    answer: 1,
    why: 'A competent patient cannot be REQUIRED to sign. The old key made a signature the obligation.',
  },
  {
    id: 236,
    match: 'When lifting a heavy patient, you should:',
    options: [
      'bend at the waist and reach across to the patient',
      'use weight-rated equipment and enough trained help',
      'twist at the torso while lifting the load up',
      'hold the weight well away from your own body',
    ],
    answer: 1,
    why: 'Technique alone does not make a heavy dependent-patient lift safe (OSHA safe patient handling).',
  },
  {
    id: 242,
    match:
      'In an intubated patient, end-tidal CO₂ suddenly drops to near zero. Your first action is to:',
    options: [
      'increase the ventilation rate and continue on',
      'assess the patient and circuit, including the tube',
      'suction the airway and then continue ventilating',
      'add supplemental oxygen and recheck in a minute',
    ],
    answer: 1,
    why: 'A sudden near-zero value can also reflect disconnection or equipment failure, not only tube placement.',
  },
  {
    id: 247,
    match: 'To improve bag-mask ventilation in a markedly obese patient, position them:',
    options: [
      'head-down with the head turned to the left',
      'prone with the head turned toward one shoulder',
      'supine and flat with the head kept fully neutral',
      'ramped, ear canal level with the sternal notch',
    ],
    answer: 3,
    why: '"Ear level to the sternum" is anatomically imprecise.',
  },
  {
    id: 252,
    match:
      'A patient opens their eyes to voice, is confused, and localizes pain. Their Glasgow Coma Score is:',
    options: ['12', '15', '9', '11'],
    answer: 0,
    why: 'INCORRECT KEY. E3 + V4 + M5 = 12, not 13.',
  },
  {
    id: 262,
    match:
      'A patient with an inferior STEMI becomes hypotensive after nitroglycerin. The most likely explanation is:',
    stem: 'A patient with an inferior STEMI with right-ventricular involvement becomes hypotensive after nitroglycerin. The most likely explanation is:',
    options: [
      'a coincidental new arrhythmia',
      'an allergic reaction to the drug',
      'right ventricular preload dependence',
      'a dose that was set too low',
    ],
    answer: 2,
    why: 'Inferior location alone does not establish clinically important RV preload dependence.',
  },
  {
    id: 267,
    match:
      'A patient in narrow-complex tachycardia at 190 is hypotensive and confused. The indicated treatment is:',
    stem: 'A patient in narrow-complex tachycardia at 190 beats/min with a palpable pulse is hypotensive and confused. The indicated treatment is:',
    options: [
      'synchronized cardioversion',
      'oral aspirin and observation',
      'watchful waiting and reassessment',
      'a fluid challenge on its own',
    ],
    answer: 0,
    why: 'Without a pulse qualifier, an organized narrow rhythm is PEA, not a cardioversion indication.',
  },
  {
    id: 271,
    match: 'The first priority in managing diabetic ketoacidosis in the prehospital setting is:',
    stem: 'After immediate ABC threats are addressed, the principal AEMT treatment for a dehydrated DKA patient is:',
    options: [
      'oral glucose',
      'bicarbonate infusion',
      'rapid insulin administration',
      'isotonic fluid resuscitation',
    ],
    answer: 3,
    why: '"First priority" is airway/breathing/circulation, which made the keyed answer arguable.',
  },
  {
    id: 273,
    match: 'The adult intramuscular epinephrine dose for anaphylaxis is:',
    stem: 'Under this course protocol, the adult intramuscular epinephrine dose for anaphylaxis is:',
    options: [
      '1 mg of 0.1 mg/mL',
      '0.5 mg of 0.01 mg/mL',
      '0.1 mg of 0.1 mg/mL',
      '0.3 mg of 1 mg/mL',
    ],
    answer: 3,
    why: 'A universal 0.3 mg adult answer is not defensible across guidelines; ratio notation replaced with mg/mL.',
  },
  {
    id: 278,
    match: 'Glucagon is used in beta-blocker overdose because it:',
    stem: 'Under Kansas AEMT scope, glucagon is indicated for hypoglycemia when:',
    options: [
      'the patient is alert and able to drink safely',
      'the patient cannot swallow and has no IV access',
      'oral glucose has already corrected the reading',
      'the blood glucose is well above the normal range',
    ],
    answer: 1,
    why: 'Beta-blocker overdose treatment is high-dose IV therapy, outside AEMT scope. Kansas authorizes glucagon IM/IN for hypoglycemia.',
  },
  {
    id: 279,
    match:
      'A patient with a GI bleed is pale, tachycardic and hypotensive. The immediate priority is:',
    options: [
      'oral fluids to replace the volume lost',
      'sitting the patient fully upright throughout',
      'a complete history taken before treatment',
      'ABCs, warmth, IV access, oxygen if hypoxemic',
    ],
    answer: 3,
    why: 'Avoid implying routine oxygen regardless of saturation.',
  },
  {
    id: 281,
    match: 'Permissive hypotension in uncontrolled hemorrhage aims to:',
    stem: 'In an adult without suspected TBI, and where protocol allows it, permissive hypotension in uncontrolled hemorrhage aims to:',
    options: [
      'perfuse without dislodging clot',
      'withhold fluid altogether',
      'bring the heart rate down',
      'restore a normal pressure quickly',
    ],
    answer: 0,
    why: 'Permissive hypotension is not a universal hemorrhage target.',
  },
  {
    id: 282,
    match:
      'An adult with a heart rate of 130, respirations of 32, and confusion has lost approximately:',
    stem: 'Using the traditional hemorrhagic-shock classification, an adult with a heart rate of 130 beats/min, respirations of 32 breaths/min, and confusion has lost approximately:',
    options: [
      '30 to 40% of blood volume',
      '5% of blood volume',
      'no measurable volume',
      'under 15% of blood volume',
    ],
    answer: 0,
    why: 'Vital signs cannot reliably determine an individual patient’s exact percentage of blood loss.',
  },
  {
    id: 291,
    match: 'A 1:10,000 epinephrine concentration contains:',
    stem: 'Epinephrine 0.1 mg/mL contains:',
    options: ['1 mg in 1 mL', '1 mg in 10 mL', '10 mg in 1 mL', '1 mg in 100 mL'],
    answer: 1,
    why: 'Ratio expressions are a recognized medication-error risk (ISMP).',
  },
  {
    id: 293,
    match: 'Infuse 500 mL over 30 minutes with a 60 gtt/mL set. The drip rate is:',
    stem: 'Infuse 500 mL over 4 hours with a 60 gtt/mL set. The drip rate is:',
    options: ['125 gtt/min', '250 gtt/min', '60 gtt/min', '500 gtt/min'],
    answer: 0,
    why: 'The old arithmetic was right but 1,000 gtt/min is not a countable rate.',
  },

  // ----- wording improvements ----------------------------------------------
  {
    id: 126,
    match: 'A non-rebreather mask at 12–15 L/min delivers an approximate FiO₂ of:',
    stem: 'A non-rebreather mask at 12–15 L/min may deliver an approximate FiO₂ of:',
    options: ['about 24 to 28%', 'about 35 to 40%', 'about 44 to 60%', 'about 80 to 95%'],
    answer: 3,
    why: 'Actual FiO₂ depends on seal, reservoir inflation and minute ventilation.',
  },
  {
    id: 140,
    match: 'A normal adult blood pressure is approximately:',
    stem: 'A typical resting adult blood pressure is approximately:',
    options: ['about 90/60 mmHg', 'about 120/80 mmHg', 'about 160/100 mmHg', 'about 200/120 mmHg'],
    answer: 1,
    why: 'Avoid declaring 120/80 "normal"; units added.',
  },
  {
    id: 147,
    match: '"Distal" means:',
    options: [
      'nearer to the midline of the body',
      'farther from the point of attachment',
      'closer to the head than the trunk',
      'toward the front surface of the body',
    ],
    answer: 1,
    why: 'Distal is defined relative to the point of attachment, not to "the trunk".',
  },
  {
    id: 165,
    match: 'Classic acute coronary syndrome presents as:',
    stem: 'A common concerning presentation of acute coronary syndrome is:',
    options: [
      'sharp pain that eases with movement',
      'substernal pressure radiating to the arm',
      'pain only when the chest is pressed',
      'pain isolated to one leg',
    ],
    answer: 1,
    why: '"Classic" overstates how reliably ACS presents this way.',
  },
  {
    id: 180,
    match:
      'The best position for a conscious patient in severe respiratory distress (no trauma) is:',
    options: [
      'lying flat on the back throughout',
      'head-down (Trendelenburg) positioning',
      'a position of comfort, usually upright',
      'lying face-down (prone) for transport',
    ],
    answer: 2,
    why: 'Key on position of comfort rather than a mandated upright position.',
  },
  {
    id: 182,
    match: 'Outcome in an ischemic stroke depends most on:',
    options: [
      'high-flow oxygen given throughout transport',
      'recognition, prenotification, and rapid transport',
      'lowering the blood pressure before transport',
      'aspirin given before arrival at hospital',
    ],
    answer: 1,
    why: 'Prenotification and destination choice matter, not transport speed alone.',
  },
  {
    id: 185,
    match: 'Suspected opioid overdose presents with:',
    stem: 'Which combination is most consistent with opioid toxicity?',
    options: [
      'dilated pupils with rapid, deep breathing',
      'respiratory depression with small pupils',
      'hypertension with generalized seizure activity',
      'a sweet, fruity odor noted on the breath',
    ],
    answer: 1,
    why: 'Respiratory depression is the defining feature; pupils are supportive but not required.',
  },
  {
    id: 196,
    match: 'Tension pneumothorax signs include:',
    options: [
      'bradycardia with a rising blood pressure',
      'unilateral absent breath sounds with shock',
      'wheezing heard equally through both lungs',
      'relief that increases with every breath',
    ],
    answer: 1,
    why: 'Add the unilateral finding and signs of shock.',
  },
  {
    id: 198,
    match: 'The "Golden Hour/Period" concept emphasizes:',
    stem: 'The concept of time-sensitive trauma care emphasizes:',
    options: [
      'scene time can run as needed',
      'minimizing time to surgical care',
      'requiring 60 minutes on scene',
      'delaying transport for assessment',
    ],
    answer: 1,
    why: '"Golden Hour" is not a defensible term.',
  },
  {
    id: 202,
    match: 'An abdominal evisceration should be covered with:',
    options: [
      'dry gauze applied after replacing the organs',
      'a moist sterile dressing under an occlusive cover',
      'a tourniquet placed around the abdomen itself',
      'nothing at all until arrival at the hospital',
    ],
    answer: 1,
    why: 'Moist sterile dressing plus occlusive cover; organs are not replaced.',
  },
  {
    id: 234,
    match: '"Standard of care" is best defined as:',
    options: [
      'whatever the individual provider prefers',
      'what a similarly trained provider would do',
      'only what hospital policy happens to say',
      'only what the patient asks to have done',
    ],
    answer: 1,
    why: 'Standard of care turns on similar training AND similar circumstances.',
  },
  {
    id: 235,
    match: 'Abandonment occurs when a provider:',
    options: [
      'hands off to an equal level with a report',
      'stops care without a handoff that is accepted',
      'declines to enter a clearly unsafe scene',
      'completes thorough and accurate documentation',
    ],
    answer: 1,
    why: 'The receiving provider has to accept care for the handoff to end the duty.',
  },
  {
    id: 237,
    match: 'The most important reason for accurate documentation is that it:',
    stem: 'Accurate documentation matters chiefly because it:',
    options: [
      'helps to pass the time on a long shift',
      'creates the clinical and legal record of care',
      'is used only for billing and reimbursement',
      'makes a good impression on the supervisors',
    ],
    answer: 1,
    why: '"Most important" is not defensible; documentation is clinical as well as legal.',
  },
  {
    id: 239,
    match: 'Medical direction consisting of protocols and standing orders is called:',
    options: [
      'online (direct) medical direction',
      'offline (indirect) medical direction',
      'verbal orders given by radio',
      'concurrent medical direction',
    ],
    answer: 1,
    why: '"None of these" replaced with a plausible distractor.',
  },
  {
    id: 240,
    match:
      'At a multi-casualty incident, the primary purpose of the Incident Command System (ICS) is to:',
    options: [
      'assign blame after the incident ends',
      'coordinate resources and personnel',
      'replace the patient triage process',
      'speed up billing and reimbursement',
    ],
    answer: 1,
    why: 'Every option repeated the stem’s "to".',
  },
  {
    id: 249,
    match:
      'A head-injured patient has BP 190/80, pulse 48, and irregular respirations. This triad indicates:',
    stem: 'A head-injured patient has BP 190/80 mmHg, pulse 48 beats/min, and irregular respirations. This triad classically suggests:',
    options: [
      'a significant opioid overdose',
      'decompensated hypovolemic shock',
      'rising intracranial pressure',
      'an isolated spinal cord injury',
    ],
    answer: 2,
    why: '"Indicates" overstates; units added.',
  },
  {
    id: 256,
    match: 'Preload is best described as the:',
    options: [
      'ventricular filling and stretch at end-diastole',
      'rate at which the ventricle contracts each beat',
      'thickness of the ventricular muscle wall',
      'resistance the ventricle must pump against',
    ],
    answer: 0,
    why: 'Preload is filling/stretch at end-diastole, not returning volume alone.',
  },
  {
    id: 259,
    match: 'When perfusion fails, cells switch to anaerobic metabolism, which produces:',
    options: [
      'additional usable oxygen for the cells',
      'increased lactate and metabolic acidosis',
      'excess circulating glucose in the blood',
      'carbon monoxide as a waste by-product',
    ],
    answer: 1,
    why: 'Lactate accumulation with metabolic acidosis is the accurate description.',
  },
  {
    id: 265,
    match:
      "Beck's triad — hypotension, distended neck veins, muffled heart tones — indicates:",
    stem: "Beck's triad — hypotension, distended neck veins, muffled heart tones — classically suggests:",
    options: [
      'pulmonary embolism',
      'cardiogenic shock',
      'tension pneumothorax',
      'cardiac tamponade',
    ],
    answer: 3,
    why: '"Indicates" overstates a triad that is often incomplete.',
  },
  {
    id: 269,
    match:
      'A patient in cardiogenic shock is hypotensive with crackles throughout. Large fluid boluses are hazardous because they:',
    options: [
      'slow the heart rate down too far',
      'can worsen the pulmonary edema further',
      'raise the blood glucose very sharply',
      'constrict the coronary arteries further',
    ],
    answer: 1,
    why: '"Without benefit" is too absolute — a small trial may be reasonable in some presentations.',
  },
  {
    id: 287,
    match: 'Neurogenic shock is distinguished from hypovolemic shock chiefly by:',
    options: [
      'cool, clammy extremities with marked pallor',
      'warm skin without the expected tachycardia',
      'a rapid, thready pulse with cool extremities',
      'a narrowed pulse pressure and strong thirst',
    ],
    answer: 1,
    why: 'Absence of expected tachycardia is the discriminating feature; "peripheries" to "extremities".',
  },
  {
    id: 303,
    match: 'Compared with adults, children compensate for blood loss by:',
    options: [
      'showing no measurable change in vital signs',
      'letting the blood pressure fall very early',
      'raising rate and tone, with pressure falling late',
      'slowing the heart rate down instead of rising',
    ],
    answer: 2,
    why: 'Blood pressure is maintained until late decompensation.',
  },

  // ----- US spelling -------------------------------------------------------
  {
    id: 245,
    match: 'CPAP would be contraindicated in a patient who:',
    options: [
      'has wheezing in all fields',
      'has a long history of COPD',
      'is anxious with labored breathing',
      'is hypotensive and obtunded',
    ],
    answer: 3,
    why: 'US spelling: laboured.',
  },
  {
    id: 264,
    match: 'ST elevation in II, III and aVF localises the infarct to the:',
    stem: 'ST elevation in II, III and aVF localizes the infarct to the:',
    options: ['anterior wall', 'inferior wall', 'lateral wall', 'septal wall'],
    answer: 1,
    why: 'US spelling: localises.',
  },
  {
    id: 266,
    match: 'A pulseless patient shows an organized rhythm on the monitor. Management centres on:',
    stem: 'A pulseless patient shows an organized rhythm on the monitor. Management centers on:',
    options: [
      'synchronized cardioversion',
      'withholding further compressions',
      'immediate defibrillation attempts',
      'CPR and reversible-cause treatment',
    ],
    answer: 3,
    why: 'US spelling: centres.',
  },
]

/**
 * Items retired rather than corrected. `active = false`, never DELETE:
 * exam_attempts.question_ids holds bare ids with no foreign key, so deleting a
 * row silently orphans every historical attempt that served it. Deactivating
 * removes it from future draws (exam_start selects `where active`) and leaves
 * the record intact.
 */
const RETIRE = [
  {
    id: 288,
    match: 'Needle decompression for tension pneumothorax is performed at the:',
    why: 'Needle decompression is not a Kansas AEMT-authorized activity (K.S.A. 65-6120), and item 196 already tests recognition of tension pneumothorax.',
  },
  {
    id: 228,
    match:
      'After at least 30 seconds of effective ventilation that produces chest movement, newborn chest compressions are started if the heart rate is below:',
    why: 'Corrected above, then retired: with the qualifier added it duplicates the scenario version of the same fact, which is the better-constructed item.',
  },
]

// ----- length-tell measurement ----------------------------------------------
// The bank's stated property is that the correct option is not identifiable by
// being longer. Measured here so a correction cannot quietly reintroduce the
// tell that an earlier pass removed.
function measure(fixes) {
  let longestBy6 = 0
  let sumDelta = 0
  const offenders = []
  for (const f of fixes) {
    const lens = f.options.map((o) => o.length)
    const key = lens[f.answer]
    const others = lens.filter((_, i) => i !== f.answer)
    const maxOther = Math.max(...others)
    const meanOther = others.reduce((a, b) => a + b, 0) / others.length
    sumDelta += key - meanOther
    if (key - maxOther >= 6) {
      longestBy6++
      offenders.push(`${f.id} (+${key - maxOther})`)
    }
  }
  return {
    n: fixes.length,
    meanDelta: (sumDelta / fixes.length).toFixed(1),
    longestBy6,
    offenders,
  }
}

const q = (s) => `'${s.replace(/'/g, "''")}'`
const arr = (opts) => `array[${opts.map(q).join(',')}]`

const stats = measure(FIXES)
console.error(
  `${stats.n} corrections · mean key-vs-distractor length ${stats.meanDelta > 0 ? '+' : ''}${stats.meanDelta} chars · ${stats.longestBy6} longest by >=6 chars${stats.offenders.length ? ` (${stats.offenders.join(', ')})` : ''}`,
)

const out = []
out.push(`-- ---------------------------------------------------------------------------
-- Exam bank corrections, from the ${new Date().toISOString().slice(0, 10)} reviewer report.
--
-- GENERATED by scripts/gen-exam-fixes.mjs — edit that, not this.
--
-- Keyed on stem text, NOT on row id. exam_questions.id is an identity column
-- and exam_questions_hard.sql renumbers its tier on every re-run, so an
-- id-keyed update would eventually rewrite the wrong question. A stem that no
-- longer matches produces no update and is reported by the pre-flight below.
--
-- Safe to re-run. Applying twice is a no-op: the second pass finds the new stem
-- rather than the old one and matches nothing.
--
-- The reviewer's numbering is carried in comments for traceability only. It was
-- verified against this bank (seed row n = id n+120, hard row n = id n+240) but
-- nothing in this file depends on it.
-- ---------------------------------------------------------------------------

begin;

create temp table exam_fix (
  ref        int,
  old_stem   text primary key,
  new_stem   text,
  new_options text[],
  new_answer int
) on commit drop;

insert into exam_fix (ref, old_stem, new_stem, new_options, new_answer) values`)

const rows = FIXES.map(
  (f) =>
    `  -- ${f.id}: ${f.why}\n  (${f.id}, ${q(f.match)}, ${q(f.stem ?? f.match)}, ${arr(f.options)}, ${f.answer})`,
)
out.push(rows.join(',\n') + ';')

out.push(`
-- Pre-flight. Anything listed here was NOT applied, and says which case it is:
-- 'already applied' is the expected result of a second run; 'NOT FOUND' means
-- the bank does not contain that stem and the correction needs a human.
select f.ref,
       case when exists (select 1 from public.exam_questions e where e.stem = f.new_stem)
            then 'already applied' else 'NOT FOUND - needs review' end as state,
       f.old_stem
from exam_fix f
where not exists (select 1 from public.exam_questions e where e.stem = f.old_stem)
order by f.ref;

-- Apply.
update public.exam_questions e
   set stem    = f.new_stem,
       options = f.new_options,
       answer  = f.new_answer
  from exam_fix f
 where e.stem = f.old_stem;

-- Retire, never delete: exam_attempts.question_ids holds bare ids with no
-- foreign key, so a delete silently orphans every historical attempt that
-- served the item. Deactivating drops it from future draws instead.`)

for (const r of RETIRE) {
  out.push(`-- ${r.id}: ${r.why}
update public.exam_questions set active = false where stem = ${q(r.match)};`)
}

out.push(`
-- ----- verification --------------------------------------------------------

-- 1. Every correction landed. Expect zero rows.
select f.ref, f.new_stem
from exam_fix f
where not exists (select 1 from public.exam_questions e where e.stem = f.new_stem);

-- 2. The two corrected keys the reviewer called out by value.
select id, stem, options[answer + 1] as keyed_answer
from public.exam_questions
where stem like 'A patient opens their eyes to voice%'      -- expect 12
   or stem like 'Infuse 500 mL over 4 hours%';              -- expect 125 gtt/min

-- 3. Bank size and the stored answer-position spread. The spread is reported
--    for information only: ExamPage shuffles option order per attempt, seeded
--    on the attempt id, so a candidate never sees the stored positions. It is
--    still worth watching in case that shuffle is ever removed.
select count(*) filter (where active) as active_items,
       count(*) filter (where not active) as retired_items
from public.exam_questions;

select answer, count(*) as items,
       round(100.0 * count(*) / sum(count(*)) over (), 1) as pct
from public.exam_questions
where active
group by answer
order by answer;

commit;`)

process.stdout.write(out.join('\n') + '\n')
