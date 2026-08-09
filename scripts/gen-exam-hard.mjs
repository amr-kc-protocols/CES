import { writeFileSync } from 'fs'
// [domain, stem, [A,B,C,D], correctIndex]
// Harder tier: application, calculation and discrimination rather than recall.
// Options kept parallel in length and plausibility so the key isn't guessable.
const Q = [
// ---------- Airway, Respiration & Ventilation ----------
['Airway','A capnography waveform with a rising, sloped ("shark-fin") plateau most suggests:',['bronchospasm','hyperventilation','an esophageal tube','a leaking cuff'],0],
['Airway','In an intubated patient, end-tidal CO₂ suddenly drops to near zero. Your first action is to:',['increase the rate','confirm tube placement','suction the airway','add supplemental oxygen'],1],
['Airway','During CPR, end-tidal CO₂ abruptly rises from 12 to 40 mmHg. This most likely indicates:',['worsening acidosis','return of spontaneous circulation','a dislodged tube','rescuer fatigue'],1],
['Airway','Ventilating an arrest patient too rapidly primarily harms them by:',['raising blood oxygen','raising intrathoracic pressure and cutting venous return','cooling the airway','diluting circulating drugs'],1],
['Airway','CPAP would be contraindicated in a patient who:',['is anxious and short of breath','is hypotensive with a decreased level of consciousness','has audible wheezing','has a history of COPD'],1],
['Airway','A fire victim has a pulse oximetry reading of 99% but is confused and headachy. The reading is unreliable because:',['soot blocks the sensor','the oximeter reads carboxyhemoglobin as oxygenated','peripheral perfusion is high','the probe is on the wrong finger'],1],
['Airway','To improve bag-mask ventilation in a markedly obese patient, position them:',['flat and supine','ramped, with ear level to sternal notch','head-down on the left side','prone with the head turned'],1],
['Airway','Bag-mask ventilation becomes progressively harder and the abdomen is distended. The most likely cause is:',['a kinked oxygen line','gastric insufflation reducing lung compliance','an oversized mask','excess oxygen flow'],1],
// ---------- Assessment ----------
['Assessment','A head-injured patient has BP 190/80, pulse 48, and irregular respirations. This triad indicates:',['hypovolemic shock','rising intracranial pressure','a spinal cord injury','an opioid overdose'],1],
['Assessment','A narrowing pulse pressure in a bleeding trauma patient most reflects:',['improving perfusion','vasoconstriction as compensation for volume loss','an anxiety response','a widening cardiac output'],1],
['Assessment','A patient has a heart rate of 130 and a systolic BP of 90. Their shock index suggests:',['normal perfusion','significant circulatory compromise','a vasovagal event','isolated pain response'],1],
['Assessment','A patient opens their eyes to voice, is confused, and localizes pain. Their Glasgow Coma Score is:',['9','11','13','15'],2],
['Assessment','Hypotension in an injured child is concerning primarily because it:',['appears very early','appears late, after major compensation has failed','is unrelated to blood loss','is common and benign'],1],
['Assessment','Which pair of findings best distinguishes cardiogenic from hypovolemic shock?',['cool skin and tachycardia','distended neck veins with crackles','a fast, thready pulse','anxiety and pallor'],1],
['Assessment','A patient is tachypneic and tachycardic with warm, flushed skin and a fever. This picture most suggests:',['hypovolemic shock','early septic shock','cardiogenic shock','neurogenic shock'],1],
// ---------- Anatomy & Physiology ----------
['Anatomy','Preload is best described as the:',['resistance the ventricle pumps against','volume returning to fill the ventricle','rate the ventricle contracts','thickness of the ventricular wall'],1],
['Anatomy','A drug that stimulates alpha-1 receptors will primarily cause:',['bronchial dilation','vascular constriction','a slower heart rate','increased secretions'],1],
['Anatomy','Beta-2 stimulation is used therapeutically in asthma because it:',['slows the heart','relaxes bronchial smooth muscle','constricts blood vessels','thins secretions'],1],
['Anatomy','When perfusion fails, cells switch to anaerobic metabolism, which produces:',['additional oxygen','lactic acid and metabolic acidosis','excess glucose','carbon monoxide'],1],
['Anatomy','Increasing preload increases the force of contraction. This relationship is described by:',['Boyle\'s law','the Frank-Starling mechanism','Henry\'s law','the Bohr effect'],1],
['Anatomy','Cardiac output is the product of:',['blood pressure and resistance','heart rate and stroke volume','preload and afterload','tidal volume and rate'],1],
// ---------- Cardiology ----------
['Cardiology','A patient with an inferior STEMI becomes hypotensive after nitroglycerin. The most likely explanation is:',['an allergic reaction','right ventricular involvement making them preload dependent','the dose was too low','a coincidental arrhythmia'],1],
['Cardiology','To identify right ventricular infarction, you would obtain:',['posterior leads V7-V9','a right-sided lead V4R','a rhythm strip in lead II','limb leads only'],1],
['Cardiology','ST elevation in II, III and aVF localises the infarct to the:',['anterior wall','inferior wall','lateral wall','septal wall'],1],
['Cardiology','Beck\'s triad — hypotension, distended neck veins, muffled heart tones — indicates:',['tension pneumothorax','cardiac tamponade','pulmonary embolism','cardiogenic shock'],1],
['Cardiology','A pulseless patient shows an organized rhythm on the monitor. Management centres on:',['immediate defibrillation','CPR while treating reversible causes','synchronized cardioversion','withholding compressions'],1],
['Cardiology','A patient in narrow-complex tachycardia at 190 is hypotensive and confused. The indicated treatment is:',['a fluid challenge alone','synchronized cardioversion','oral aspirin','watchful waiting'],1],
['Cardiology','Reciprocal ST depression on a 12-lead is significant because it:',['rules out infarction','supports a true STEMI rather than a mimic','indicates pericarditis','reflects lead placement error'],1],
['Cardiology','A patient in cardiogenic shock is hypotensive with crackles throughout. Large fluid boluses are hazardous because they:',['lower the heart rate','worsen pulmonary edema without improving output','cause hyperglycemia','constrict the coronary arteries'],1],
['Cardiology','The chewable aspirin dose in suspected acute coronary syndrome is:',['81 mg','162 to 324 mg','650 mg','1,000 mg'],1],
// ---------- Medical ----------
['Medical','The first priority in managing diabetic ketoacidosis in the prehospital setting is:',['rapid insulin administration','isotonic fluid resuscitation','oral glucose','bicarbonate infusion'],1],
['Medical','Tall, peaked T waves with a widening QRS in a dialysis patient suggest:',['hypokalemia','hyperkalemia','hypocalcemia','hypernatremia'],1],
['Medical','The adult intramuscular epinephrine dose for anaphylaxis is:',['0.1 mg of 1:10,000','0.3 mg of 1:1,000','1 mg of 1:10,000','0.5 mg of 1:100,000'],1],
['Medical','For stroke thrombolytic eligibility, the critical time is:',['when EMS arrived','when the patient was last known well','when symptoms were first reported','when the first vital signs were taken'],1],
['Medical','Hypoglycemia caused by a sulfonylurea is dangerous because the patient:',['cannot swallow glucose','may become hypoglycemic again after initial correction','develops ketoacidosis','is resistant to dextrose'],1],
['Medical','Naloxone in a suspected opioid overdose should be titrated to:',['full alertness','adequate respirations','a normal heart rate','pupil dilation'],1],
['Medical','A wide QRS with hypotension after an intentional overdose most suggests:',['acetaminophen','a tricyclic antidepressant','an opioid','a benzodiazepine'],1],
['Medical','Glucagon is used in beta-blocker overdose because it:',['blocks the same receptors','increases cardiac contractility by an alternate pathway','raises blood glucose only','reverses the drug directly'],1],
['Medical','A patient with a GI bleed is pale, tachycardic and hypotensive. The immediate priority is:',['obtaining a full history','oxygen, IV access and fluid resuscitation with rapid transport','oral fluids','positioning them upright'],1],
['Medical','Sudden severe dyspnea with clear lungs and hypoxia after a long flight most suggests:',['pneumonia','pulmonary embolism','asthma','pneumothorax'],1],
// ---------- Trauma & Shock ----------
['Trauma','Permissive hypotension in uncontrolled hemorrhage aims to:',['raise pressure to normal quickly','maintain perfusion without dislodging formed clot','avoid all fluid administration','reduce the heart rate'],1],
['Trauma','An adult with a heart rate of 130, respirations of 32, and confusion has lost approximately:',['under 15% of blood volume','30 to 40% of blood volume','5% of blood volume','no measurable volume'],1],
['Trauma','Blood loss in a pregnant trauma patient is dangerous because:',['pregnancy prevents shock','increased blood volume masks signs until loss is severe','the fetus absorbs the loss','blood pressure rises early'],1],
['Trauma','After prolonged entrapment, releasing a crushed limb risks sudden:',['hypoglycemia','hyperkalemia and dysrhythmia','hypothermia only','respiratory alkalosis'],1],
['Trauma','The greatest threat in flail chest is:',['the paradoxical movement itself','the underlying pulmonary contusion','rib pain','skin bruising'],1],
['Trauma','Routine hyperventilation of a head-injured patient is avoided because it:',['raises intracranial pressure','causes cerebral vasoconstriction and reduces brain perfusion','increases oxygen demand','has no measurable effect'],1],
['Trauma','Neurogenic shock is distinguished from hypovolemic shock chiefly by:',['cool, clammy skin','warm skin with a normal or slow heart rate','a rapid, thready pulse','narrow pulse pressure'],1],
['Trauma','Needle decompression for tension pneumothorax is performed at the:',['2nd intercostal space, midclavicular line','5th intercostal space, posterior line','4th intercostal space, midspinal line','7th intercostal space, midaxillary line'],0],
['Trauma','A child in compensated shock most reliably shows:',['low blood pressure','tachycardia with delayed capillary refill','bradycardia','warm, dry skin'],1],
['Trauma','Hypothermia worsens outcome in major trauma primarily because it:',['increases oxygen demand','impairs clotting and worsens bleeding','causes hyperglycemia','dilates blood vessels'],1],
// ---------- Pharmacology & calculation ----------
['Pharmacology','A 1:10,000 epinephrine concentration contains:',['1 mg in 1 mL','1 mg in 10 mL','10 mg in 1 mL','1 mg in 100 mL'],1],
['Pharmacology','Order: 20 mL/kg fluid bolus for a 15 kg child. You give:',['150 mL','300 mL','450 mL','600 mL'],1],
['Pharmacology','Infuse 500 mL over 30 minutes with a 60 gtt/mL set. The drip rate is:',['500 gtt/min','1,000 gtt/min','250 gtt/min','60 gtt/min'],1],
['Pharmacology','Order: 0.01 mg/kg epinephrine for a 22 lb child. The dose is:',['0.05 mg','0.1 mg','0.22 mg','1 mg'],1],
['Pharmacology','A patient weighs 198 lb. Their weight in kilograms is approximately:',['80 kg','90 kg','100 kg','110 kg'],1],
['Pharmacology','Convert 0.25 mg to micrograms:',['25 mcg','250 mcg','2,500 mcg','25,000 mcg'],1],
['Pharmacology','You have 100 mg in 5 mL and must give 40 mg. You draw:',['1 mL','2 mL','4 mL','8 mL'],1],
['Pharmacology','Dextrose 10% delivers how many grams of glucose in 250 mL?',['10 g','25 g','50 g','100 g'],1],
['Pharmacology','1,000 mL is running at 125 mL/hr. It will finish in:',['4 hours','8 hours','12 hours','16 hours'],1],
['Pharmacology','A drug with a short half-life will generally require:',['a single large dose','more frequent redosing','no redosing','a slower onset'],1],
// ---------- OB / Peds ----------
['OB/Peds','A newborn has a heart rate of 50 after 30 seconds of effective ventilation. You should:',['continue ventilation alone','begin chest compressions','give oral glucose','stimulate and reassess in 5 minutes'],1],
['OB/Peds','A third-trimester patient becomes hypotensive when laid flat. The correct action is:',['raise the legs only','tilt her onto her left side','sit her fully upright','place her prone'],1],
['OB/Peds','Compared with adults, children compensate for blood loss by:',['dropping blood pressure early','increasing heart rate and vascular tone until sudden collapse','slowing the heart rate','showing no vital sign changes'],1],
]
/**
 * Spread the key evenly across the four slots before insert.
 *
 * The display order is shuffled per attempt, so this is not what a candidate
 * sees — but the bank review screen shows stored order, and a key sitting on
 * one letter 60 times out of 63 looks wrong and reads as careless. Safe to do
 * here precisely because these rows are new: nothing in exam_attempts
 * references them yet, unlike the existing bank, where permuting options would
 * misalign responses already recorded against the old indices.
 *
 * Rotation keeps each option's neighbours intact; only the offset changes.
 */
function balanceKey(list) {
  const targets = list.map((_, i) => i % 4)
  let h = 20260812                       // fixed seed: same output every run
  for (let i = targets.length - 1; i > 0; i--) {
    h = (Math.imul(h ^ (h >>> 15), 2246822507) ^ 61) >>> 0
    const j = h % (i + 1)
    ;[targets[i], targets[j]] = [targets[j], targets[i]]
  }
  return list.map(([d, stem, opts, ans], i) => {
    const target = targets[i]
    const shift = (target - ans + 4) % 4
    const rotated = opts.map((_, j) => opts[(j - shift + 4) % 4])
    if (rotated[target] !== opts[ans]) throw new Error('rotation lost the key: ' + stem)
    return [d, stem, rotated, target]
  })
}
const BAL = balanceKey(Q)

const esc = (s) => s.replace(/'/g, "''")
let out = `-- AEMT exam bank — HARD tier (${Q.length} items). Generated; do not hand-edit.
--
-- ADDITIVE. This file never truncates: exam_questions.id is referenced by
-- exam_attempts.question_ids, so recreating rows would orphan every attempt
-- already on record. Re-running is safe while these remain unused — it clears
-- and reloads only the rows it owns (difficulty = 'hard').

alter table public.exam_questions
  add column if not exists difficulty text not null default 'standard';

alter table public.exam_questions drop constraint if exists exam_questions_difficulty_check;
alter table public.exam_questions add constraint exam_questions_difficulty_check
  check (difficulty in ('standard', 'hard'));

delete from public.exam_questions where difficulty = 'hard';

insert into public.exam_questions (domain, stem, options, answer, difficulty, active) values
`
out += BAL.map(([d, stem, opts, ans]) =>
  `('${esc(d)}', '${esc(stem)}', array['${opts.map(esc).join("','")}'], ${ans}, 'hard', true)`,
).join(',\n') + ';\n'
out += `
-- Check what the draw now sees.
select difficulty, count(*) from public.exam_questions where active group by difficulty;
`
writeFileSync('supabase/exam_questions_hard.sql', out)

const dist = {}; BAL.forEach(q => dist[q[3]] = (dist[q[3]] || 0) + 1)
const doms = {}; Q.forEach(q => doms[q[0]] = (doms[q[0]] || 0) + 1)
let bad = 0
for (const [, stem, opts, ans] of BAL) {
  if (opts.length !== 4 || new Set(opts).size !== 4 || ans < 0 || ans > 3) { bad++; console.log('BAD:', stem) }
}
console.log('questions:', Q.length, '| malformed:', bad)
console.log('answer index spread:', dist)
console.log('domains:', doms)
