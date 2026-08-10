-- AEMT exam bank — HARD tier (63 items). Generated; do not hand-edit.
--
-- ADDITIVE. This file never truncates: exam_questions.id is referenced by
-- exam_attempts.question_ids, so recreating rows would orphan every attempt
-- already on record. Re-running is safe while these remain unused — it clears
-- and reloads only the rows it owns (difficulty = 'hard').
-- WARNING: re-running this file reverts the corrections in
-- exam_questions_fixes.sql (a wrong Glasgow Coma Score key, several
-- clinically outdated items). Run that file again afterwards.

alter table public.exam_questions
  add column if not exists difficulty text not null default 'standard';

alter table public.exam_questions drop constraint if exists exam_questions_difficulty_check;
alter table public.exam_questions add constraint exam_questions_difficulty_check
  check (difficulty in ('standard', 'hard'));

delete from public.exam_questions where difficulty = 'hard';

insert into public.exam_questions (domain, stem, options, answer, difficulty, active) values
('Airway', 'A capnography waveform with a rising, sloped ("shark-fin") plateau most suggests:', array['bronchospasm','hyperventilation','an esophageal tube','a leaking cuff'], 0, 'hard', true),
('Airway', 'In an intubated patient, end-tidal CO₂ suddenly drops to near zero. Your first action is to:', array['increase the rate','confirm tube placement','suction the airway','add supplemental oxygen'], 1, 'hard', true),
('Airway', 'During CPR, end-tidal CO₂ abruptly rises from 12 to 40 mmHg. This most likely indicates:', array['fatigue in the compressor','worsening metabolic acidosis','return of spontaneous circulation','a dislodged endotracheal tube'], 2, 'hard', true),
('Airway', 'Ventilating an arrest patient too rapidly primarily harms them by:', array['diluting drugs in the circulation','raising arterial oxygen too far','reducing venous return to the heart','cooling and drying the airway'], 2, 'hard', true),
('Airway', 'CPAP would be contraindicated in a patient who:', array['has wheezing in all fields','has a long history of COPD','is anxious with laboured breathing','is hypotensive and obtunded'], 3, 'hard', true),
('Airway', 'A fire victim has a pulse oximetry reading of 99% but is confused and headachy. The reading is unreliable because:', array['soot is blocking the sensor','carboxyhemoglobin reads as oxygen','peripheral perfusion is too high','the probe is on the wrong finger'], 1, 'hard', true),
('Airway', 'To improve bag-mask ventilation in a markedly obese patient, position them:', array['head-down and turned to the left','prone with the head turned aside','lying flat with the head neutral','ramped, ear level to the sternum'], 3, 'hard', true),
('Airway', 'Bag-mask ventilation becomes progressively harder and the abdomen is distended. The most likely cause is:', array['a mask that has stopped sealing properly','an oxygen flow rate that is set too high','a kink somewhere in the oxygen supply line','air in the stomach limiting compliance'], 3, 'hard', true),
('Assessment', 'A head-injured patient has BP 190/80, pulse 48, and irregular respirations. This triad indicates:', array['a significant opioid overdose','decompensated hypovolemic shock','rising intracranial pressure','an isolated spinal cord injury'], 2, 'hard', true),
('Assessment', 'A narrowing pulse pressure in a bleeding trauma patient most reflects:', array['perfusion that is steadily improving','vasoconstriction compensating for loss','an acute anxiety-driven response','a stroke volume that is rising'], 1, 'hard', true),
('Assessment', 'A patient has a heart rate of 130 and a systolic BP of 90. Their shock index suggests:', array['a response to pain alone','perfusion within normal limits','significant circulatory compromise','an uncomplicated vasovagal event'], 2, 'hard', true),
('Assessment', 'A patient opens their eyes to voice, is confused, and localizes pain. Their Glasgow Coma Score is:', array['13','15','9','11'], 0, 'hard', true),
('Assessment', 'Hypotension in an injured child is concerning primarily because it:', array['appears earlier than it does in adults','appears late, once compensation fails','bears no relation to the blood lost','is common and is usually benign'], 1, 'hard', true),
('Assessment', 'Which pair of findings best distinguishes cardiogenic from hypovolemic shock?', array['distended neck veins with crackles','a rapid and thready pulse','marked anxiety with pallor','cool skin with a fast heart rate'], 0, 'hard', true),
('Assessment', 'A patient is tachypneic and tachycardic with warm, flushed skin and a fever. This picture most suggests:', array['neurogenic shock','hypovolemic shock','early septic shock','cardiogenic shock'], 2, 'hard', true),
('Anatomy', 'Preload is best described as the:', array['volume returning to fill the ventricle','rate the ventricle contracts','thickness of the ventricular wall','resistance the ventricle pumps against'], 0, 'hard', true),
('Anatomy', 'A drug that stimulates alpha-1 receptors will primarily cause:', array['vascular constriction','a slower heart rate','increased secretions','bronchial dilation'], 0, 'hard', true),
('Anatomy', 'Beta-2 stimulation is used therapeutically in asthma because it:', array['constricts peripheral vessels','thins airway secretions','slows the resting heart rate','relaxes bronchial smooth muscle'], 3, 'hard', true),
('Anatomy', 'When perfusion fails, cells switch to anaerobic metabolism, which produces:', array['additional usable oxygen','lactic acid and acidosis','excess circulating glucose','carbon monoxide'], 1, 'hard', true),
('Anatomy', 'Increasing preload increases the force of contraction. This relationship is described by:', array['the Boyle pressure relationship','the Frank-Starling mechanism','the Henry solubility relationship','the Bohr dissociation effect'], 1, 'hard', true),
('Anatomy', 'Cardiac output is the product of:', array['heart rate and stroke volume','preload and afterload','tidal volume and rate','blood pressure and resistance'], 0, 'hard', true),
('Cardiology', 'A patient with an inferior STEMI becomes hypotensive after nitroglycerin. The most likely explanation is:', array['a coincidental new arrhythmia','an allergic reaction to the drug','right ventricular preload dependence','a dose that was set too low'], 2, 'hard', true),
('Cardiology', 'To identify right ventricular infarction, you would obtain:', array['a right-sided lead V4R','a rhythm strip in lead II','limb leads only','posterior leads V7-V9'], 0, 'hard', true),
('Cardiology', 'ST elevation in II, III and aVF localises the infarct to the:', array['anterior wall','inferior wall','lateral wall','septal wall'], 1, 'hard', true),
('Cardiology', 'Beck''s triad — hypotension, distended neck veins, muffled heart tones — indicates:', array['pulmonary embolism','cardiogenic shock','tension pneumothorax','cardiac tamponade'], 3, 'hard', true),
('Cardiology', 'A pulseless patient shows an organized rhythm on the monitor. Management centres on:', array['synchronized cardioversion','withholding further compressions','immediate defibrillation attempts','CPR and reversible-cause treatment'], 3, 'hard', true),
('Cardiology', 'A patient in narrow-complex tachycardia at 190 is hypotensive and confused. The indicated treatment is:', array['synchronized cardioversion','oral aspirin and observation','watchful waiting and reassessment','a fluid challenge on its own'], 0, 'hard', true),
('Cardiology', 'Reciprocal ST depression on a 12-lead is significant because it:', array['points to acute pericarditis','reflects a lead placement error','rules infarction out entirely','supports a true STEMI over a mimic'], 3, 'hard', true),
('Cardiology', 'A patient in cardiogenic shock is hypotensive with crackles throughout. Large fluid boluses are hazardous because they:', array['slow the heart rate down too far','worsen pulmonary edema without benefit','raise the blood glucose very sharply','constrict the coronary arteries further'], 1, 'hard', true),
('Cardiology', 'The chewable aspirin dose in suspected acute coronary syndrome is:', array['1,000 mg','81 mg','162 to 324 mg','650 mg'], 2, 'hard', true),
('Medical', 'The first priority in managing diabetic ketoacidosis in the prehospital setting is:', array['oral glucose','bicarbonate infusion','rapid insulin administration','isotonic fluid resuscitation'], 3, 'hard', true),
('Medical', 'Tall, peaked T waves with a widening QRS in a dialysis patient suggest:', array['hypokalemia','hyperkalemia','hypocalcemia','hypernatremia'], 1, 'hard', true),
('Medical', 'The adult intramuscular epinephrine dose for anaphylaxis is:', array['1 mg of 1:10,000','0.5 mg of 1:100,000','0.1 mg of 1:10,000','0.3 mg of 1:1,000'], 3, 'hard', true),
('Medical', 'For stroke thrombolytic eligibility, the critical time is:', array['when symptoms were first reported','when the first vital signs were taken','when EMS arrived','when the patient was last known well'], 3, 'hard', true),
('Medical', 'Hypoglycemia caused by a sulfonylurea is dangerous because the patient:', array['responds poorly to given dextrose','is unable to swallow glucose safely','can become hypoglycemic again later','goes on to develop ketoacidosis'], 2, 'hard', true),
('Medical', 'Naloxone in a suspected opioid overdose should be titrated to:', array['pupil dilation','full alertness','adequate respirations','a normal heart rate'], 2, 'hard', true),
('Medical', 'A wide QRS with hypotension after an intentional overdose most suggests:', array['a tricyclic antidepressant','a long-acting opioid','a benzodiazepine','an acetaminophen overdose'], 0, 'hard', true),
('Medical', 'Glucagon is used in beta-blocker overdose because it:', array['reverses the drug at its own receptor','blocks the very same receptors itself','raises contractility by another route','raises the blood glucose and nothing more'], 2, 'hard', true),
('Medical', 'A patient with a GI bleed is pale, tachycardic and hypotensive. The immediate priority is:', array['oral fluids to replace the losses','sitting them fully upright','taking a complete patient history','oxygen, IV access and rapid transport'], 3, 'hard', true),
('Medical', 'Sudden severe dyspnea with clear lungs and hypoxia after a long flight most suggests:', array['an acute asthma attack','a spontaneous pneumothorax','community-acquired pneumonia','a pulmonary embolism'], 3, 'hard', true),
('Trauma', 'Permissive hypotension in uncontrolled hemorrhage aims to:', array['perfuse without dislodging clot','withhold fluid altogether','bring the heart rate down','restore a normal pressure quickly'], 0, 'hard', true),
('Trauma', 'An adult with a heart rate of 130, respirations of 32, and confusion has lost approximately:', array['30 to 40% of blood volume','5% of blood volume','no measurable volume','under 15% of blood volume'], 0, 'hard', true),
('Trauma', 'Blood loss in a pregnant trauma patient is dangerous because:', array['the fetus absorbs much of the loss','the blood pressure rises early on','pregnancy itself prevents shock','a raised blood volume masks the signs'], 3, 'hard', true),
('Trauma', 'After prolonged entrapment, releasing a crushed limb risks sudden:', array['marked respiratory alkalosis','profound and sudden hypoglycemia','hyperkalemia and dysrhythmia','isolated core hypothermia'], 2, 'hard', true),
('Trauma', 'The greatest threat in flail chest is:', array['the bruising over the chest wall','the paradoxical movement itself','the underlying lung contusion','the pain of the fractured ribs'], 2, 'hard', true),
('Trauma', 'Routine hyperventilation of a head-injured patient is avoided because it:', array['raises the cerebral oxygen demand','produces no measurable change','drives the intracranial pressure up','constricts vessels and starves the brain'], 3, 'hard', true),
('Trauma', 'Neurogenic shock is distinguished from hypovolemic shock chiefly by:', array['cool and clammy peripheries','warm skin with an unraised pulse','a rapid and thready pulse','a narrowed pulse pressure'], 1, 'hard', true),
('Trauma', 'Needle decompression for tension pneumothorax is performed at the:', array['2nd intercostal space, midclavicular line','5th intercostal space, posterior line','4th intercostal space, midspinal line','7th intercostal space, midaxillary line'], 0, 'hard', true),
('Trauma', 'A child in compensated shock most reliably shows:', array['a falling blood pressure','tachycardia with delayed refill','an unexpectedly slow pulse','warm and dry peripheries'], 1, 'hard', true),
('Trauma', 'Hypothermia worsens outcome in major trauma primarily because it:', array['raises the oxygen demand sharply','impairs clotting and worsens bleeding','drives the blood glucose upward','dilates the peripheral vessels'], 1, 'hard', true),
('Pharmacology', 'A 1:10,000 epinephrine concentration contains:', array['1 mg in 1 mL','1 mg in 10 mL','10 mg in 1 mL','1 mg in 100 mL'], 1, 'hard', true),
('Pharmacology', 'Order: 20 mL/kg fluid bolus for a 15 kg child. You give:', array['600 mL','150 mL','300 mL','450 mL'], 2, 'hard', true),
('Pharmacology', 'Infuse 500 mL over 30 minutes with a 60 gtt/mL set. The drip rate is:', array['1,000 gtt/min','250 gtt/min','60 gtt/min','500 gtt/min'], 0, 'hard', true),
('Pharmacology', 'Order: 0.01 mg/kg epinephrine for a 22 lb child. The dose is:', array['0.05 mg','0.1 mg','0.22 mg','1 mg'], 1, 'hard', true),
('Pharmacology', 'A patient weighs 198 lb. Their weight in kilograms is approximately:', array['90 kg','100 kg','110 kg','80 kg'], 0, 'hard', true),
('Pharmacology', 'Convert 0.25 mg to micrograms:', array['25,000 mcg','25 mcg','250 mcg','2,500 mcg'], 2, 'hard', true),
('Pharmacology', 'You have 100 mg in 5 mL and must give 40 mg. You draw:', array['8 mL','1 mL','2 mL','4 mL'], 2, 'hard', true),
('Pharmacology', 'Dextrose 10% delivers how many grams of glucose in 250 mL?', array['25 g','50 g','100 g','10 g'], 0, 'hard', true),
('Pharmacology', '1,000 mL is running at 125 mL/hr. It will finish in:', array['4 hours','8 hours','12 hours','16 hours'], 1, 'hard', true),
('Pharmacology', 'A drug with a short half-life will generally require:', array['no redosing','a slower onset','a single large dose','more frequent redosing'], 3, 'hard', true),
('OB/Peds', 'A newborn has a heart rate of 50 after 30 seconds of effective ventilation. You should:', array['begin chest compressions','give oral glucose','stimulate and reassess in 5 minutes','continue ventilation alone'], 0, 'hard', true),
('OB/Peds', 'A third-trimester patient becomes hypotensive when laid flat. The correct action is:', array['raise both legs and reassess','tilt her onto her left side','sit her fully upright','turn her fully prone'], 1, 'hard', true),
('OB/Peds', 'Compared with adults, children compensate for blood loss by:', array['showing no change in vital signs','letting the blood pressure fall early','raising rate and tone, then collapsing','slowing the heart rate down'], 2, 'hard', true);

-- Check what the draw now sees.
select difficulty, count(*) from public.exam_questions where active group by difficulty;
