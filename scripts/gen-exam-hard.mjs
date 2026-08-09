import { writeFileSync } from 'fs'
// [domain, stem, [A,B,C,D], correctIndex]
// Harder tier: application, calculation and discrimination rather than recall.
// Options kept parallel in length and plausibility so the key isn't guessable.
const Q = [
// ---------- Airway, Respiration & Ventilation ----------
['Airway','A capnography waveform with a rising, sloped ("shark-fin") plateau most suggests:',['bronchospasm','hyperventilation','an esophageal tube','a leaking cuff'],0],
['Airway','In an intubated patient, end-tidal CO₂ suddenly drops to near zero. Your first action is to:',['increase the rate','confirm tube placement','suction the airway','add supplemental oxygen'],1],
['Airway','During CPR, end-tidal CO₂ abruptly rises from 12 to 40 mmHg. This most likely indicates:',['worsening metabolic acidosis','return of spontaneous circulation','a dislodged endotracheal tube','fatigue in the compressor'],1],
['Airway','Ventilating an arrest patient too rapidly primarily harms them by:',['raising arterial oxygen too far','reducing venous return to the heart','cooling and drying the airway','diluting drugs in the circulation'],1],
['Airway','CPAP would be contraindicated in a patient who:',['is anxious with laboured breathing','is hypotensive and obtunded','has wheezing in all fields','has a long history of COPD'],1],
['Airway','A fire victim has a pulse oximetry reading of 99% but is confused and headachy. The reading is unreliable because:',['soot is blocking the sensor','carboxyhemoglobin reads as oxygen','peripheral perfusion is too high','the probe is on the wrong finger'],1],
['Airway','To improve bag-mask ventilation in a markedly obese patient, position them:',['lying flat with the head neutral','ramped, ear level to the sternum','head-down and turned to the left','prone with the head turned aside'],1],
['Airway','Bag-mask ventilation becomes progressively harder and the abdomen is distended. The most likely cause is:',['a kink somewhere in the oxygen supply line','air in the stomach limiting compliance','a mask that has stopped sealing properly','an oxygen flow rate that is set too high'],1],
// ---------- Assessment ----------
['Assessment','A head-injured patient has BP 190/80, pulse 48, and irregular respirations. This triad indicates:',['decompensated hypovolemic shock','rising intracranial pressure','an isolated spinal cord injury','a significant opioid overdose'],1],
['Assessment','A narrowing pulse pressure in a bleeding trauma patient most reflects:',['perfusion that is steadily improving','vasoconstriction compensating for loss','an acute anxiety-driven response','a stroke volume that is rising'],1],
['Assessment','A patient has a heart rate of 130 and a systolic BP of 90. Their shock index suggests:',['perfusion within normal limits','significant circulatory compromise','an uncomplicated vasovagal event','a response to pain alone'],1],
['Assessment','A patient opens their eyes to voice, is confused, and localizes pain. Their Glasgow Coma Score is:',['9','11','13','15'],2],
['Assessment','Hypotension in an injured child is concerning primarily because it:',['appears earlier than it does in adults','appears late, once compensation fails','bears no relation to the blood lost','is common and is usually benign'],1],
['Assessment','Which pair of findings best distinguishes cardiogenic from hypovolemic shock?',['cool skin with a fast heart rate','distended neck veins with crackles','a rapid and thready pulse','marked anxiety with pallor'],1],
['Assessment','A patient is tachypneic and tachycardic with warm, flushed skin and a fever. This picture most suggests:',['hypovolemic shock','early septic shock','cardiogenic shock','neurogenic shock'],1],
// ---------- Anatomy & Physiology ----------
['Anatomy','Preload is best described as the:',['resistance the ventricle pumps against','volume returning to fill the ventricle','rate the ventricle contracts','thickness of the ventricular wall'],1],
['Anatomy','A drug that stimulates alpha-1 receptors will primarily cause:',['bronchial dilation','vascular constriction','a slower heart rate','increased secretions'],1],
['Anatomy','Beta-2 stimulation is used therapeutically in asthma because it:',['slows the resting heart rate','relaxes bronchial smooth muscle','constricts peripheral vessels','thins airway secretions'],1],
['Anatomy','When perfusion fails, cells switch to anaerobic metabolism, which produces:',['additional usable oxygen','lactic acid and acidosis','excess circulating glucose','carbon monoxide'],1],
['Anatomy','Increasing preload increases the force of contraction. This relationship is described by:',['the Boyle pressure relationship','the Frank-Starling mechanism','the Henry solubility relationship','the Bohr dissociation effect'],1],
['Anatomy','Cardiac output is the product of:',['blood pressure and resistance','heart rate and stroke volume','preload and afterload','tidal volume and rate'],1],
// ---------- Cardiology ----------
['Cardiology','A patient with an inferior STEMI becomes hypotensive after nitroglycerin. The most likely explanation is:',['an allergic reaction to the drug','right ventricular preload dependence','a dose that was set too low','a coincidental new arrhythmia'],1],
['Cardiology','To identify right ventricular infarction, you would obtain:',['posterior leads V7-V9','a right-sided lead V4R','a rhythm strip in lead II','limb leads only'],1],
['Cardiology','ST elevation in II, III and aVF localises the infarct to the:',['anterior wall','inferior wall','lateral wall','septal wall'],1],
['Cardiology','Beck\'s triad — hypotension, distended neck veins, muffled heart tones — indicates:',['tension pneumothorax','cardiac tamponade','pulmonary embolism','cardiogenic shock'],1],
['Cardiology','A pulseless patient shows an organized rhythm on the monitor. Management centres on:',['immediate defibrillation attempts','CPR and reversible-cause treatment','synchronized cardioversion','withholding further compressions'],1],
['Cardiology','A patient in narrow-complex tachycardia at 190 is hypotensive and confused. The indicated treatment is:',['a fluid challenge on its own','synchronized cardioversion','oral aspirin and observation','watchful waiting and reassessment'],1],
['Cardiology','Reciprocal ST depression on a 12-lead is significant because it:',['rules infarction out entirely','supports a true STEMI over a mimic','points to acute pericarditis','reflects a lead placement error'],1],
['Cardiology','A patient in cardiogenic shock is hypotensive with crackles throughout. Large fluid boluses are hazardous because they:',['slow the heart rate down too far','worsen pulmonary edema without benefit','raise the blood glucose very sharply','constrict the coronary arteries further'],1],
['Cardiology','The chewable aspirin dose in suspected acute coronary syndrome is:',['81 mg','162 to 324 mg','650 mg','1,000 mg'],1],
// ---------- Medical ----------
['Medical','The first priority in managing diabetic ketoacidosis in the prehospital setting is:',['rapid insulin administration','isotonic fluid resuscitation','oral glucose','bicarbonate infusion'],1],
['Medical','Tall, peaked T waves with a widening QRS in a dialysis patient suggest:',['hypokalemia','hyperkalemia','hypocalcemia','hypernatremia'],1],
['Medical','The adult intramuscular epinephrine dose for anaphylaxis is:',['0.1 mg of 1:10,000','0.3 mg of 1:1,000','1 mg of 1:10,000','0.5 mg of 1:100,000'],1],
['Medical','For stroke thrombolytic eligibility, the critical time is:',['when EMS arrived','when the patient was last known well','when symptoms were first reported','when the first vital signs were taken'],1],
['Medical','Hypoglycemia caused by a sulfonylurea is dangerous because the patient:',['is unable to swallow glucose safely','can become hypoglycemic again later','goes on to develop ketoacidosis','responds poorly to given dextrose'],1],
['Medical','Naloxone in a suspected opioid overdose should be titrated to:',['full alertness','adequate respirations','a normal heart rate','pupil dilation'],1],
['Medical','A wide QRS with hypotension after an intentional overdose most suggests:',['an acetaminophen overdose','a tricyclic antidepressant','a long-acting opioid','a benzodiazepine'],1],
['Medical','Glucagon is used in beta-blocker overdose because it:',['blocks the very same receptors itself','raises contractility by another route','raises the blood glucose and nothing more','reverses the drug at its own receptor'],1],
['Medical','A patient with a GI bleed is pale, tachycardic and hypotensive. The immediate priority is:',['taking a complete patient history','oxygen, IV access and rapid transport','oral fluids to replace the losses','sitting them fully upright'],1],
['Medical','Sudden severe dyspnea with clear lungs and hypoxia after a long flight most suggests:',['community-acquired pneumonia','a pulmonary embolism','an acute asthma attack','a spontaneous pneumothorax'],1],
// ---------- Trauma & Shock ----------
['Trauma','Permissive hypotension in uncontrolled hemorrhage aims to:',['restore a normal pressure quickly','perfuse without dislodging clot','withhold fluid altogether','bring the heart rate down'],1],
['Trauma','An adult with a heart rate of 130, respirations of 32, and confusion has lost approximately:',['under 15% of blood volume','30 to 40% of blood volume','5% of blood volume','no measurable volume'],1],
['Trauma','Blood loss in a pregnant trauma patient is dangerous because:',['pregnancy itself prevents shock','a raised blood volume masks the signs','the fetus absorbs much of the loss','the blood pressure rises early on'],1],
['Trauma','After prolonged entrapment, releasing a crushed limb risks sudden:',['profound and sudden hypoglycemia','hyperkalemia and dysrhythmia','isolated core hypothermia','marked respiratory alkalosis'],1],
['Trauma','The greatest threat in flail chest is:',['the paradoxical movement itself','the underlying lung contusion','the pain of the fractured ribs','the bruising over the chest wall'],1],
['Trauma','Routine hyperventilation of a head-injured patient is avoided because it:',['drives the intracranial pressure up','constricts vessels and starves the brain','raises the cerebral oxygen demand','produces no measurable change'],1],
['Trauma','Neurogenic shock is distinguished from hypovolemic shock chiefly by:',['cool and clammy peripheries','warm skin with an unraised pulse','a rapid and thready pulse','a narrowed pulse pressure'],1],
['Trauma','Needle decompression for tension pneumothorax is performed at the:',['2nd intercostal space, midclavicular line','5th intercostal space, posterior line','4th intercostal space, midspinal line','7th intercostal space, midaxillary line'],0],
['Trauma','A child in compensated shock most reliably shows:',['a falling blood pressure','tachycardia with delayed refill','an unexpectedly slow pulse','warm and dry peripheries'],1],
['Trauma','Hypothermia worsens outcome in major trauma primarily because it:',['raises the oxygen demand sharply','impairs clotting and worsens bleeding','drives the blood glucose upward','dilates the peripheral vessels'],1],
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
['OB/Peds','A third-trimester patient becomes hypotensive when laid flat. The correct action is:',['raise both legs and reassess','tilt her onto her left side','sit her fully upright','turn her fully prone'],1],
['OB/Peds','Compared with adults, children compensate for blood loss by:',['letting the blood pressure fall early','raising rate and tone, then collapsing','slowing the heart rate down','showing no change in vital signs'],1],
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
