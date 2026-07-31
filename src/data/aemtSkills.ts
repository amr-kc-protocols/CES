// ---------------------------------------------------------------------------
// AEMT psychomotor skill check-off sheets.
//
// Transcribed from the AMR clinical skills competency workbook (the same
// packet Wichita runs on paper). Each sheet keeps its own scope marking from
// the source: sheets marked Paramedic do not appear for AEMT students.
//
// Structure mirrors the paper form — grouped performance criteria, plus the
// separate Critical Failure Criteria list where a sheet carries one. Only the
// IV and LUCAS sheets define critical failures in the source workbook; the
// rest are graded on their criteria alone.
// ---------------------------------------------------------------------------

export type SkillLevel = 'emt' | 'aemt' | 'paramedic'

/**
 * What a sheet is FOR, which is a different question from who may perform it.
 *
 *   'bls'       Skills an EMT already performs. An incoming AEMT student is
 *               credentialed and proficient in these, so re-checking them is
 *               not what the AEMT course is for.
 *   'advanced'  The skills the AEMT credential actually adds — what the course
 *               teaches and what its psychomotor record has to show.
 *   'paramedic' Above AEMT scope.
 *
 * The AEMT Skills tab shows 'advanced' only. This table is the single place
 * that judgement lives, so any one sheet can be reclassified on its own.
 */
export type SkillScope = 'bls' | 'advanced' | 'paramedic'

export const SKILL_SCOPE: Record<string, SkillScope> = {
  // ----- the AEMT credential's own skills ----------------------------------
  'iv-start': 'advanced',            // K.A.R. 109-11-8: 20 venipunctures
  'ez-io': 'advanced',               // K.A.R. 109-11-8: 5 IO infusions
  'ekg-acquisition': 'advanced',     // K.A.R. 109-11-8: 8 ECG applications
  'supraglottic-airways-igel': 'advanced', // advanced airway, AEMT scope
  'cpap-bipap-mask-flow-safe-ii': 'advanced',
  'glucometer': 'advanced',
  'im-subq-injection': 'advanced',    // K.A.R. 109-11-8: 10 IM/SubQ injections
  'nebulized-treatment': 'advanced',  // K.A.R. 109-11-8: 1 nebulized treatment
  'lifepak-15': 'advanced',           // monitor — AMR KC
          // glucometry, listed under AEMT monitoring (PA5)

  // ----- EMT-level; the student arrives already proficient ------------------
  'pcr-documentation': 'bls',
  'radios-and-communications': 'bls',
  'stair-chair-stryker': 'bls',
  'stretcher-stryker-power-pro': 'bls',
  'portable-suction': 'bls',
  'hemorrhage-control-tournquet': 'bls',
  'junctional-tourniquet-inguinal': 'bls',
  'junctional-tourniquet-axilla': 'bls',
  'pelvic-binder': 'bls',
  'autopulse-check-off': 'bls',
  'lucas': 'bls',
  'zoll-x-series': 'advanced',       // monitor — Wichita / EagleMed

  // ----- above AEMT scope ---------------------------------------------------
  'ventilator-equipment': 'paramedic',
  'intubation-equipment': 'paramedic',
  'ng-tube-insertion': 'paramedic',
  'needle-pleural-decompression': 'paramedic',
  'i-view': 'paramedic',             // video laryngoscopy — intubation adjunct
  'quick-trach': 'paramedic',        // surgical airway
  'narcotic-access-procedures': 'paramedic', // controlled substances
}

export interface SkillCriterion {
  id: string
  label: string
}

export interface SkillSection {
  title: string
  criteria: SkillCriterion[]
}

export interface AemtSkillSheet {
  id: string
  title: string
  /** Scope marking as printed on the source sheet, e.g. 'AEMT & Paramedic'. */
  levelLabel: string
  levels: SkillLevel[]
  sections: SkillSection[]
  /** Any one of these fails the whole skill regardless of criteria scores. */
  criticalFailures: string[]
  /**
   * Equipment-specific sheets where a course uses exactly one of the set —
   * the cardiac monitor differs by operation. Selected per course.
   */
  equipmentGroup?: 'monitor'
  /**
   * Authored here rather than transcribed from the AMR workbook, because no
   * sheet existed. Needs Program Manager / Medical Director review before it
   * is used as a competency record.
   */
  draft?: boolean
}

export const AEMT_SKILL_SHEETS: AemtSkillSheet[] = [
  // ----- authored here; no sheet existed in the AMR workbook -----------
  {
    id: 'im-subq-injection',
    title: 'IM / SubQ Injection',
    levelLabel: 'AEMT & Paramedic',
    levels: ['aemt', 'paramedic'],
    draft: true,
    sections: [
      {
        title: 'Assembles Equipment',
        criteria: [
          { id: 'im-subq-injection-0-0', label: 'Takes or verbalizes appropriate PPE precautions' },
          { id: 'im-subq-injection-0-1', label: 'Selects syringe of appropriate volume' },
          { id: 'im-subq-injection-0-2', label: 'Selects needle of appropriate gauge and length for the route and site' },
          { id: 'im-subq-injection-0-3', label: 'Obtains antiseptic swabs, gauze, and adhesive bandage' },
          { id: 'im-subq-injection-0-4', label: 'Positions a sharps container within immediate reach' },
        ],
      },
      {
        title: 'Preparation of Medication',
        criteria: [
          { id: 'im-subq-injection-1-0', label: 'Confirms the indication and rules out contraindications and known allergies' },
          { id: 'im-subq-injection-1-1', label: 'Verifies the right patient, medication, dose, route, and time' },
          { id: 'im-subq-injection-1-2', label: 'Checks the medication expiration date' },
          { id: 'im-subq-injection-1-3', label: 'Inspects the medication for clarity and particulate matter' },
          { id: 'im-subq-injection-1-4', label: 'Cleanses the vial stopper or snaps the ampule using appropriate technique' },
          { id: 'im-subq-injection-1-5', label: 'Draws up the correct volume while maintaining sterility' },
          { id: 'im-subq-injection-1-6', label: 'Expels air from the syringe and reconfirms the dose' },
        ],
      },
      {
        title: 'Administration',
        criteria: [
          { id: 'im-subq-injection-2-0', label: 'Identifies an appropriate site for the route (IM: deltoid, vastus lateralis, ventrogluteal; SubQ: upper arm, abdomen, anterior thigh)' },
          { id: 'im-subq-injection-2-1', label: 'Exposes and inspects the site, avoiding areas of injury, scarring, or poor perfusion' },
          { id: 'im-subq-injection-2-2', label: 'Cleanses the site from the center outward in a circular motion' },
          { id: 'im-subq-injection-2-3', label: 'Warns the patient to expect the needle stick' },
          { id: 'im-subq-injection-2-4', label: 'Inserts the needle at the correct angle for the route (IM 90 degrees, SubQ 45 degrees)' },
          { id: 'im-subq-injection-2-5', label: 'Injects the medication at an appropriate rate' },
          { id: 'im-subq-injection-2-6', label: 'Withdraws the needle and applies pressure to the site' },
          { id: 'im-subq-injection-2-7', label: 'Disposes of the needle immediately in the sharps container at the point of use' },
          { id: 'im-subq-injection-2-8', label: 'Applies a bandage to the site' },
        ],
      },
      {
        title: 'Reassessment and Documentation',
        criteria: [
          { id: 'im-subq-injection-3-0', label: 'Reassesses the patient for therapeutic response' },
          { id: 'im-subq-injection-3-1', label: 'Monitors for adverse reaction, including signs of anaphylaxis' },
          { id: 'im-subq-injection-3-2', label: 'Documents medication, dose, route, site, time, and patient response' },
        ],
      },
    ],
    criticalFailures: [
      'Failure to take or verbalize appropriate PPE precautions',
      'Failure to dispose of blood-contaminated sharps immediately at the point of use',
      'Administers an incorrect medication, dose, or route',
      'Failure to verify allergies before administration',
      'Contaminates equipment or site without appropriately correcting the situation',
      'Failure to reassess the patient for adverse reaction after administration',
      'Uses or orders a dangerous or inappropriate intervention',
    ],
  },
  {
    id: 'nebulized-treatment',
    title: 'Nebulized Breathing Treatment',
    levelLabel: 'AEMT & Paramedic',
    levels: ['aemt', 'paramedic'],
    draft: true,
    sections: [
      {
        title: 'Assembles Equipment',
        criteria: [
          { id: 'nebulized-treatment-0-0', label: 'Takes or verbalizes appropriate PPE precautions' },
          { id: 'nebulized-treatment-0-1', label: 'Obtains nebulizer chamber, mouthpiece or mask, and tubing' },
          { id: 'nebulized-treatment-0-2', label: 'Obtains an oxygen source and confirms adequate cylinder pressure' },
        ],
      },
      {
        title: 'Preparation of Medication',
        criteria: [
          { id: 'nebulized-treatment-1-0', label: 'Confirms the indication and rules out contraindications and known allergies' },
          { id: 'nebulized-treatment-1-1', label: 'Verifies the right patient, medication, dose, route, and time' },
          { id: 'nebulized-treatment-1-2', label: 'Checks the medication expiration date and inspects for clarity' },
          { id: 'nebulized-treatment-1-3', label: 'Instills the correct medication and volume into the nebulizer chamber' },
          { id: 'nebulized-treatment-1-4', label: 'Assembles the chamber and connects tubing to the oxygen source' },
        ],
      },
      {
        title: 'Baseline Assessment',
        criteria: [
          { id: 'nebulized-treatment-2-0', label: 'Obtains baseline vital signs including SpO2' },
          { id: 'nebulized-treatment-2-1', label: 'Auscultates and documents baseline lung sounds in all fields' },
          { id: 'nebulized-treatment-2-2', label: 'Assesses work of breathing and ability to speak in full sentences' },
        ],
      },
      {
        title: 'Administration',
        criteria: [
          { id: 'nebulized-treatment-3-0', label: 'Sets oxygen flow to produce a steady visible mist (typically 6 to 8 L/min)' },
          { id: 'nebulized-treatment-3-1', label: 'Coaches the patient to breathe slowly and deeply through the mouthpiece or mask' },
          { id: 'nebulized-treatment-3-2', label: 'Positions the patient upright as tolerated' },
          { id: 'nebulized-treatment-3-3', label: 'Remains with the patient throughout administration' },
          { id: 'nebulized-treatment-3-4', label: 'Monitors continuously for deterioration or adverse reaction' },
        ],
      },
      {
        title: 'Reassessment and Documentation',
        criteria: [
          { id: 'nebulized-treatment-4-0', label: 'Reassesses lung sounds, vital signs, and SpO2 after the treatment' },
          { id: 'nebulized-treatment-4-1', label: 'Determines whether a repeat treatment is indicated' },
          { id: 'nebulized-treatment-4-2', label: 'Documents medication, dose, route, time, and patient response' },
        ],
      },
    ],
    criticalFailures: [
      'Failure to take or verbalize appropriate PPE precautions',
      'Administers an incorrect medication or dose',
      'Failure to obtain a baseline respiratory assessment before administration',
      'Failure to reassess the patient after the treatment',
      'Failure to recognize deterioration requiring a higher level of care',
    ],
  },
  {
    id: 'lifepak-15',
    title: 'LIFEPAK 15 Monitor',
    levelLabel: 'All Levels',
    levels: ['emt', 'aemt', 'paramedic'],
    equipmentGroup: 'monitor',
    draft: true,
    sections: [
      {
        title: 'Overview and Power-up',
        criteria: [
          { id: 'lifepak-15-0-0', label: 'Demonstrates how to power on the LIFEPAK 15' },
          { id: 'lifepak-15-0-1', label: 'Locates the quick access keys and states their purpose' },
          { id: 'lifepak-15-0-2', label: 'Locates the speed dial and demonstrates navigation' },
          { id: 'lifepak-15-0-3', label: 'Locates the patient mode (adult/pediatric) and demonstrates how to change it' },
          { id: 'lifepak-15-0-4', label: 'Demonstrates how to install and remove a battery, and how to use the AC/DC power adapter' },
          { id: 'lifepak-15-0-5', label: 'Demonstrates how to adjust screen brightness for daylight and low-light use' },
        ],
      },
      {
        title: 'General Patient Monitoring',
        criteria: [
          { id: 'lifepak-15-1-0', label: 'Locates the lead currently displayed and demonstrates how to change leads' },
          { id: 'lifepak-15-1-1', label: 'Demonstrates how to display multiple waveform channels' },
          { id: 'lifepak-15-1-2', label: 'Locates the heart rate alarms and demonstrates how to change them' },
          { id: 'lifepak-15-1-3', label: 'Demonstrates NIBP acquisition in manual mode' },
          { id: 'lifepak-15-1-4', label: 'Demonstrates how to set an automatic NIBP interval' },
          { id: 'lifepak-15-1-5', label: 'Locates the NIBP alarms and demonstrates how to change them' },
          { id: 'lifepak-15-1-6', label: 'Locates the SpO2 value and demonstrates how to change its alarms and settings' },
          { id: 'lifepak-15-1-7', label: 'Locates the ETCO2 value and waveform and demonstrates how to change its alarms and settings' },
          { id: 'lifepak-15-1-8', label: 'Locates the respiration settings and demonstrates how to change them' },
          { id: 'lifepak-15-1-9', label: 'Demonstrates the alarm silence and suspend functions' },
          { id: 'lifepak-15-1-10', label: 'Demonstrates how to enter patient data' },
          { id: 'lifepak-15-1-11', label: 'Demonstrates how to print a rhythm strip' },
          { id: 'lifepak-15-1-12', label: 'Demonstrates how to navigate to trends and return to the home screen' },
        ],
      },
      {
        title: '12-Lead Acquisition',
        criteria: [
          { id: 'lifepak-15-2-0', label: 'Prepares the patient skin appropriately for electrode placement' },
          { id: 'lifepak-15-2-1', label: 'Applies all ten electrodes in the correct anatomical positions' },
          { id: 'lifepak-15-2-2', label: 'Demonstrates how to acquire a 12-lead' },
          { id: 'lifepak-15-2-3', label: 'Demonstrates how to enter patient name and identifiers' },
          { id: 'lifepak-15-2-4', label: 'Demonstrates how to transmit a 12-lead' },
          { id: 'lifepak-15-2-5', label: 'Demonstrates how to review a previously acquired 12-lead' },
          { id: 'lifepak-15-2-6', label: 'Demonstrates how to print a 12-lead' },
          { id: 'lifepak-15-2-7', label: 'Recognizes and corrects artifact or lead misplacement before transmission' },
        ],
      },
    ],
    criticalFailures: [],
  },
  // ----- transcribed from the AMR workbook ------------------------------
  {
    id: 'pcr-documentation',
    title: 'PCR Documentation',
    levelLabel: 'All Levels',
    levels: ['emt', 'aemt', 'paramedic'],
    sections: [
      {
        title: 'Performance',
        criteria: [
          { id: 'pcr-documentation-10-0', label: 'Complete ePCR properly and without errors while demonstrating an appropriate narrative consistent with the DCHARTE format.' },
          { id: 'pcr-documentation-11-1', label: 'Ensure a minimum of two sets of vital signs for each patient contact.' },
          { id: 'pcr-documentation-12-2', label: 'Comply with HIPAA standards' },
          { id: 'pcr-documentation-13-3', label: 'Complete pt refusal and no transport documentation properly and without errors' },
          { id: 'pcr-documentation-14-4', label: 'Capture appropriate billing information' },
          { id: 'pcr-documentation-15-5', label: 'Capture all necessary signatures on all forms' },
          { id: 'pcr-documentation-16-6', label: 'Demonstrate how to scan Trailing Documentation' },
          { id: 'pcr-documentation-17-7', label: 'Define legal competency and consent' },
          { id: 'pcr-documentation-18-8', label: 'Define DNR orders, advanced directives and living wills and procedures for dealing with them' },
          { id: 'pcr-documentation-19-9', label: 'Describe purpose of PCS paperwork' },
          { id: 'pcr-documentation-20-10', label: 'Ensure all PCR\'s are transmitted by end of shift' },
        ],
      },
    ],
    criticalFailures: [],
  },
  {
    id: 'radios-and-communications',
    title: 'Radios and Communications',
    levelLabel: 'All Levels',
    levels: ['emt', 'aemt', 'paramedic'],
    sections: [
      {
        title: 'Performance',
        criteria: [
          { id: 'radios-and-communications-35-0', label: 'Understand each radio in the AMR vehicle and its use' },
        ],
      },
      {
        title: 'AMR Vehicle Mounted Radio',
        criteria: [
          { id: 'radios-and-communications-41-0', label: 'Turn radio on' },
          { id: 'radios-and-communications-42-1', label: 'Change the volume level' },
          { id: 'radios-and-communications-43-2', label: 'Change the channel' },
          { id: 'radios-and-communications-44-3', label: 'Change the zone' },
          { id: 'radios-and-communications-45-4', label: 'Transmit via the radio' },
          { id: 'radios-and-communications-46-5', label: 'Select/deselect scan mode' },
          { id: 'radios-and-communications-47-6', label: 'Identify frequently used channels and identify their zone' },
        ],
      },
      {
        title: 'AMR Portable Radio',
        criteria: [
          { id: 'radios-and-communications-53-0', label: 'Turn radio on' },
          { id: 'radios-and-communications-54-1', label: 'Change the volume level' },
          { id: 'radios-and-communications-55-2', label: 'Change the channel' },
          { id: 'radios-and-communications-56-3', label: 'Change the zone' },
          { id: 'radios-and-communications-57-4', label: 'Transmit via the radio' },
          { id: 'radios-and-communications-58-5', label: 'Select/deselect scan mode' },
          { id: 'radios-and-communications-59-6', label: 'Identify what each channel signifies' },
          { id: 'radios-and-communications-60-7', label: 'Explain the appropriateness of carrying portable radio depending on shift assignment' },
        ],
      },
    ],
    criticalFailures: [],
  },
  {
    id: 'stair-chair-stryker',
    title: 'Stair chair (Stryker)',
    levelLabel: 'All Levels',
    levels: ['emt', 'aemt', 'paramedic'],
    sections: [
      {
        title: 'Chair Features',
        criteria: [
          { id: 'stair-chair-stryker-75-0', label: 'Open and close the chair with the red handle.' },
          { id: 'stair-chair-stryker-76-1', label: 'Raise and lower the upper control handle' },
          { id: 'stair-chair-stryker-77-2', label: 'Lock and unlock the rear handles' },
          { id: 'stair-chair-stryker-78-3', label: 'Extend and retract the foot end lift handles' },
          { id: 'stair-chair-stryker-79-4', label: 'Activate and release the wheel locks' },
          { id: 'stair-chair-stryker-80-5', label: 'Open and close the track system' },
          { id: 'stair-chair-stryker-81-6', label: 'Confirm the maximum chair capacity is 500 pounds' },
        ],
      },
      {
        title: 'Safe Lifting Technique',
        criteria: [
          { id: 'stair-chair-stryker-87-0', label: 'Keep your hands close to your body' },
          { id: 'stair-chair-stryker-88-1', label: 'Keep your back straight' },
          { id: 'stair-chair-stryker-89-2', label: 'Verbally and visually coordinate with your partner' },
          { id: 'stair-chair-stryker-90-3', label: 'Lift with your legs' },
        ],
      },
      {
        title: 'Transporting Patient Up / Down Stairs',
        criteria: [
          { id: 'stair-chair-stryker-96-0', label: 'Ensure track is locked in position before transporting a patient down the stairs' },
          { id: 'stair-chair-stryker-97-1', label: 'Demonstrate proper ergonomic positions when transporting a patient down the stairs' },
          { id: 'stair-chair-stryker-98-2', label: 'Demonstrate leader forward positioning while carrying a patient up and down the stairs' },
          { id: 'stair-chair-stryker-99-3', label: 'Demonstrate the leader backward position while carrying a patient up and down the stairs' },
          { id: 'stair-chair-stryker-100-4', label: 'Approach the stairs and tilt the chair back to begin the transport' },
          { id: 'stair-chair-stryker-101-5', label: 'Transport a patient down the stairs using the track system' },
          { id: 'stair-chair-stryker-102-6', label: 'Make a smooth transition down the stairs with a patient on the chair' },
        ],
      },
      {
        title: 'Moving Chairs',
        criteria: [
          { id: 'stair-chair-stryker-108-0', label: 'Confirm all patient restraint straps are securely fastened before moving a loaded chair' },
          { id: 'stair-chair-stryker-109-1', label: 'Ensure track is closed when transporting patients on level surfaces for maximum clearance' },
          { id: 'stair-chair-stryker-110-2', label: 'Demonstrate wheelchair like mobility with a patient secured' },
          { id: 'stair-chair-stryker-111-3', label: 'Approach thresholds squarely and lift each set of wheels over the obstacle separately' },
          { id: 'stair-chair-stryker-112-4', label: 'Demonstrate how to properly carry an unoccupied chair' },
        ],
      },
      {
        title: 'Restraint System',
        criteria: [
          { id: 'stair-chair-stryker-118-0', label: 'Attach and secure a patient using the head restraint' },
          { id: 'stair-chair-stryker-119-1', label: 'Attach and secure a patient using the foot section restraint' },
          { id: 'stair-chair-stryker-120-2', label: 'Attach and secure a patient using the traditional restraint method' },
          { id: 'stair-chair-stryker-121-3', label: 'Attach and secure a patient using the crisscross restraint method' },
          { id: 'stair-chair-stryker-122-4', label: 'Loading and Unloading the Chair' },
          { id: 'stair-chair-stryker-123-5', label: 'Confirm that loading and unloading an occupied chair is a two-person operation' },
        ],
      },
    ],
    criticalFailures: [],
  },
  {
    id: 'stretcher-stryker-power-pro',
    title: 'Stretcher (Stryker Power Pro)',
    levelLabel: 'All Levels',
    levels: ['emt', 'aemt', 'paramedic'],
    sections: [
      {
        title: 'Stretcher Features',
        criteria: [
          { id: 'stretcher-stryker-power-pro-138-0', label: 'Squeeze the handle for pneumatic assist when raising and lowering back rest' },
          { id: 'stretcher-stryker-power-pro-139-1', label: 'Retract and extend the retractable head section' },
          { id: 'stretcher-stryker-power-pro-140-2', label: 'Lower and raise the side rails' },
          { id: 'stretcher-stryker-power-pro-141-3', label: 'Elevate and lower the footrest' },
          { id: 'stretcher-stryker-power-pro-142-4', label: 'Use the manual override release to raise and lower the stretcher' },
          { id: 'stretcher-stryker-power-pro-143-5', label: 'Activate and release the wheel locks' },
          { id: 'stretcher-stryker-power-pro-144-6', label: 'Confirm the lifting capacity of the Power Pro stretcher is 500 pounds' },
          { id: 'stretcher-stryker-power-pro-145-7', label: 'Confirm the weight capacity of the stretcher is 700 pounds' },
        ],
      },
      {
        title: 'Safe Lifting Technique',
        criteria: [
          { id: 'stretcher-stryker-power-pro-151-0', label: 'Keep your hands close to your body' },
          { id: 'stretcher-stryker-power-pro-152-1', label: 'Keep your back straight' },
          { id: 'stretcher-stryker-power-pro-153-2', label: 'Verbally and visually coordinate with your partner' },
          { id: 'stretcher-stryker-power-pro-154-3', label: 'Lift with your legs' },
        ],
      },
      {
        title: 'Battery Management',
        criteria: [
          { id: 'stretcher-stryker-power-pro-160-0', label: 'Show where the battery indicator light is located' },
          { id: 'stretcher-stryker-power-pro-161-1', label: 'Confirm that the green light shows the battery is adequately charged' },
          { id: 'stretcher-stryker-power-pro-162-2', label: 'Confirm a blinking red indicator light means the battery needs to be recharged' },
          { id: 'stretcher-stryker-power-pro-163-3', label: 'Confirm that a rapid red flashing light may mean the stretcher needs to be repaired' },
          { id: 'stretcher-stryker-power-pro-164-4', label: 'Remove, replace, and recharge the battery' },
          { id: 'stretcher-stryker-power-pro-165-5', label: 'Confirm that you only charge the battery when the indicator light is red.' },
          { id: 'stretcher-stryker-power-pro-166-6', label: 'Confirm that the SMRT Pak must remain in the SMRT charger until the battery LED is solid green' },
          { id: 'stretcher-stryker-power-pro-167-7', label: 'Confirm that the battery must remain on the charger for a full 8 hours' },
        ],
      },
      {
        title: 'Restraint System',
        criteria: [
          { id: 'stretcher-stryker-power-pro-173-0', label: 'Attach head section restraints (shoulder straps) to the stretcher' },
          { id: 'stretcher-stryker-power-pro-174-1', label: 'Attach foot section restraints to the stretcher' },
          { id: 'stretcher-stryker-power-pro-175-2', label: 'Secure a patient with the Head Section restraints (Shoulder Harness)' },
        ],
      },
      {
        title: 'Moving Stretchers',
        criteria: [
          { id: 'stretcher-stryker-power-pro-181-0', label: 'Confirm that all patient restraint straps must be securely fastened before moving a loaded stretcher' },
          { id: 'stretcher-stryker-power-pro-182-1', label: 'Confirm that the cot may be at any height for rolling' },
          { id: 'stretcher-stryker-power-pro-183-2', label: 'Retract the head section to provide 360-degree mobility when the stretcher is at the lowest position.' },
          { id: 'stretcher-stryker-power-pro-184-3', label: 'Confirm that two operators (one on each end) are required when rolling the loaded stretcher' },
          { id: 'stretcher-stryker-power-pro-185-4', label: 'Approach thresholds squarely and lift each set of wheels over the obstacle separately' },
        ],
      },
      {
        title: 'Electronic Loading / Unloading Safety Features',
        criteria: [
          { id: 'stretcher-stryker-power-pro-191-0', label: 'Confirm the Power Pro cot load height setting is adjustable to the ambulance deck height' },
          { id: 'stretcher-stryker-power-pro-192-1', label: 'Confirm the load height settings should be adjusted prior to switching stretcher between ambulances' },
          { id: 'stretcher-stryker-power-pro-193-2', label: 'Confirm how to jog the height if switching between ambulances becomes necessary' },
          { id: 'stretcher-stryker-power-pro-194-3', label: 'Confirm to never to jog the height when the safety bar is engaged with the safety hook' },
          { id: 'stretcher-stryker-power-pro-195-4', label: 'Confirm never to operate the + stretcher control when in the ambulance' },
          { id: 'stretcher-stryker-power-pro-196-5', label: 'Locate the trolley shut off module that is used to disable the stretchers electronic functions' },
          { id: 'stretcher-stryker-power-pro-197-6', label: 'Engage the engage the safety bar on the safety hook before raising the under carriage' },
          { id: 'stretcher-stryker-power-pro-198-7', label: 'Loading and Unloading the Stretcher' },
          { id: 'stretcher-stryker-power-pro-199-8', label: 'Confirm that loading and unloading an occupied stretcher is a two-person operation' },
          { id: 'stretcher-stryker-power-pro-200-9', label: 'Use the power method to load an occupied stretcher into the ambulance' },
          { id: 'stretcher-stryker-power-pro-201-10', label: 'Use the power method to unload an occupied stretcher from the ambulance' },
          { id: 'stretcher-stryker-power-pro-202-11', label: 'Use the manual override to load an occupied stretcher into the ambulance' },
          { id: 'stretcher-stryker-power-pro-203-12', label: 'Use the manual override to unload an occupied stretcher from the ambulance' },
        ],
      },
      {
        title: 'Cleaning',
        criteria: [
          { id: 'stretcher-stryker-power-pro-209-0', label: 'Confirm that the Power-Pro stretcher is sealed and fully washable' },
          { id: 'stretcher-stryker-power-pro-210-1', label: 'Confirm the SMRT Pak is sealed and fully washable' },
          { id: 'stretcher-stryker-power-pro-211-2', label: 'Confirm the battery pack is not sealed and not washable' },
          { id: 'stretcher-stryker-power-pro-212-3', label: 'Confirm that all battery packs must be removed from the stretcher or charger before cleaning / washing' },
          { id: 'stretcher-stryker-power-pro-213-4', label: 'Confirm that all chargers can only be cleaned with a dampened cloth (no direct spraying)' },
          { id: 'stretcher-stryker-power-pro-214-5', label: 'Confirm that all chargers must be unplugged before cleaning' },
        ],
      },
    ],
    criticalFailures: [],
  },
  {
    id: 'portable-suction',
    title: 'Portable Suction',
    levelLabel: 'All Levels',
    levels: ['emt', 'aemt', 'paramedic'],
    sections: [
      {
        title: 'Performance',
        criteria: [
          { id: 'portable-suction-229-0', label: 'Ensure portable suction unit is present, clean, plugged in and charging' },
          { id: 'portable-suction-230-1', label: 'Test unit to ensure proper function' },
          { id: 'portable-suction-231-2', label: 'Ensure lid is firmly attached to canister' },
          { id: 'portable-suction-232-3', label: 'Ensure suction tubing and Yankauer tip are attached to canister' },
          { id: 'portable-suction-233-4', label: 'Unplug unit, turn on suction unit and verify power' },
          { id: 'portable-suction-234-5', label: 'Verify suction force sustains 300mm Hg' },
          { id: 'portable-suction-235-6', label: 'Prior to suctioning patient, tests suction as above' },
          { id: 'portable-suction-236-7', label: 'Verbalize proper suctioning technique per protocol' },
          { id: 'portable-suction-237-8', label: 'Ensure appropriate suction setings for pediatric patients' },
        ],
      },
    ],
    criticalFailures: [],
  },
  {
    id: 'glucometer',
    title: 'Glucometer',
    levelLabel: 'All Levels',
    levels: ['emt', 'aemt', 'paramedic'],
    sections: [
      {
        title: 'Maintenance',
        criteria: [
          { id: 'glucometer-252-0', label: 'Verifies High/Low readings within range (If necessary)' },
          { id: 'glucometer-253-1', label: 'Ensures adequate supply of lancets, test strips, alcohol prep pads, 2x2\'s, and Band-Aids' },
        ],
      },
      {
        title: 'Use',
        criteria: [
          { id: 'glucometer-259-0', label: 'Power on and obtain test strip' },
          { id: 'glucometer-260-1', label: 'Select and clean location on finger' },
          { id: 'glucometer-261-2', label: 'Insert test strip properly at the appropriate time' },
          { id: 'glucometer-262-3', label: 'Puncture skin at location' },
          { id: 'glucometer-263-4', label: 'Express sufficient blood sample from finger stick' },
          { id: 'glucometer-264-5', label: 'Draw up adequate amount of blood into test strip' },
          { id: 'glucometer-265-6', label: 'Discuss alternate blood sampling sites' },
          { id: 'glucometer-266-7', label: 'Record value' },
          { id: 'glucometer-267-8', label: 'If error message, proceed accordingly' },
          { id: 'glucometer-268-9', label: 'Locate error message descriptions on users manual' },
        ],
      },
      {
        title: 'Cleaning',
        criteria: [
          { id: 'glucometer-274-0', label: 'Clean devise following manufacture\'s recommendations' },
        ],
      },
    ],
    criticalFailures: [],
  },
  {
    id: 'cpap-bipap-mask-flow-safe-ii',
    title: 'CPAP/ BiPAP mask Flow-Safe II',
    levelLabel: 'All Levels',
    levels: ['emt', 'aemt', 'paramedic'],
    sections: [
      {
        title: 'Performance',
        criteria: [
          { id: 'cpap-bipap-mask-flow-safe-ii-289-0', label: 'List two indications for CPAP' },
          { id: 'cpap-bipap-mask-flow-safe-ii-290-1', label: 'List two contraindications for CPAP' },
          { id: 'cpap-bipap-mask-flow-safe-ii-291-2', label: 'List two adverse effects of CPAP' },
          { id: 'cpap-bipap-mask-flow-safe-ii-292-3', label: 'Apply 100% oxygen with NRB' },
          { id: 'cpap-bipap-mask-flow-safe-ii-293-4', label: 'Use appropriate monitoring device' },
          { id: 'cpap-bipap-mask-flow-safe-ii-294-5', label: 'List medications that could be administered to this patient via protocols' },
          { id: 'cpap-bipap-mask-flow-safe-ii-295-6', label: 'Correctly assembled CPAP system' },
          { id: 'cpap-bipap-mask-flow-safe-ii-296-7', label: 'Apply facemask with positive pressure at appropriate level' },
          { id: 'cpap-bipap-mask-flow-safe-ii-297-8', label: 'Coach patient to hold mask to prevent anxiety' },
          { id: 'cpap-bipap-mask-flow-safe-ii-298-9', label: 'Adjust to PEEP to proper level' },
          { id: 'cpap-bipap-mask-flow-safe-ii-299-10', label: 'Reassess patient, titrating to a saturation of at least 92% or a decrease in dyspnea' },
          { id: 'cpap-bipap-mask-flow-safe-ii-300-11', label: 'State that if patient\'s condition deteriorated, they would consider advanced airway' },
        ],
      },
    ],
    criticalFailures: [],
  },
  {
    id: 'supraglottic-airways-igel',
    title: 'Supraglottic Airways- iGel',
    levelLabel: 'All Levels',
    levels: ['emt', 'aemt', 'paramedic'],
    sections: [
      {
        title: 'Performance',
        criteria: [
          { id: 'supraglottic-airways-igel-315-0', label: 'Ensure all equipment is present per daily truck checklist' },
        ],
      },
      {
        title: 'Sizing',
        criteria: [
          { id: 'supraglottic-airways-igel-321-0', label: 'Discuss sizing of iGel airways' },
        ],
      },
      {
        title: 'Prior to iGel placement',
        criteria: [
          { id: 'supraglottic-airways-igel-327-0', label: 'Select appropriate size iGel' },
          { id: 'supraglottic-airways-igel-328-1', label: 'Ensure you have all appropriate equipment' },
          { id: 'supraglottic-airways-igel-329-2', label: 'Establish back-up airway management plan' },
        ],
      },
      {
        title: 'Placement of iGel',
        criteria: [
          { id: 'supraglottic-airways-igel-335-0', label: 'Lube cuff' },
          { id: 'supraglottic-airways-igel-336-1', label: 'Place iGel with proper technique' },
          { id: 'supraglottic-airways-igel-337-2', label: 'Ventilate or use passive oxygenation' },
          { id: 'supraglottic-airways-igel-338-3', label: 'Secure iGel' },
          { id: 'supraglottic-airways-igel-339-4', label: 'Consider placing c-collar on patient to prevent iGel tube movement' },
          { id: 'supraglottic-airways-igel-340-5', label: 'Insert OG tube per protocol (Paramedics)' },
          { id: 'supraglottic-airways-igel-341-6', label: 'Know the DOPE acronym if patient deteriorates.' },
        ],
      },
    ],
    criticalFailures: [],
  },
  {
    id: 'ventilator-equipment',
    title: 'Ventilator Equipment',
    levelLabel: 'Paramedic',
    levels: ['paramedic'],
    sections: [
      {
        title: 'Performance',
        criteria: [
          { id: 'ventilator-equipment-356-0', label: 'Ensure all tubing present' },
          { id: 'ventilator-equipment-357-1', label: 'Ensure test lung intact' },
        ],
      },
      {
        title: 'Prior to Ventilator Placement',
        criteria: [
          { id: 'ventilator-equipment-363-0', label: 'Secure Tubing to ports' },
          { id: 'ventilator-equipment-364-1', label: 'Secure O2 Hose to Ventilator Port' },
          { id: 'ventilator-equipment-365-2', label: 'Test settings on test lung' },
          { id: 'ventilator-equipment-366-3', label: 'Place Vent on Standby' },
          { id: 'ventilator-equipment-367-4', label: 'Secure and Package Patient to Gurney' },
          { id: 'ventilator-equipment-368-5', label: 'Obtain set of Vitals' },
          { id: 'ventilator-equipment-369-6', label: 'ETCO2 Line Placed on Wye' },
          { id: 'ventilator-equipment-370-7', label: 'Attach Ventilator to ETT/Trach' },
          { id: 'ventilator-equipment-371-8', label: 'Secure' },
          { id: 'ventilator-equipment-372-9', label: 'Reassess and Ensure Stable Patient' },
          { id: 'ventilator-equipment-373-10', label: 'Know the signs of patient deterioration' },
        ],
      },
    ],
    criticalFailures: [],
  },
  {
    id: 'ekg-acquisition',
    title: 'EKG Acquisition',
    levelLabel: 'All Levels',
    levels: ['emt', 'aemt', 'paramedic'],
    sections: [
      {
        title: '4 Lead EKG Acquisition',
        criteria: [
          { id: 'ekg-acquisition-388-0', label: 'Power on Monitor' },
          { id: 'ekg-acquisition-389-1', label: 'Explain procedure to patient' },
          { id: 'ekg-acquisition-390-2', label: 'Properly position the patient (supine or semi-fowlers)' },
          { id: 'ekg-acquisition-391-3', label: 'Place the 4 limb leads' },
          { id: 'ekg-acquisition-392-4', label: 'White - Right upper' },
          { id: 'ekg-acquisition-393-5', label: 'Black - Left upper' },
          { id: 'ekg-acquisition-394-6', label: 'Red - Left lower' },
          { id: 'ekg-acquisition-395-7', label: 'Green - Right Lower' },
          { id: 'ekg-acquisition-396-8', label: 'Press button to acquire 4-lead EKG' },
        ],
      },
      {
        title: '12 Lead Acquisition',
        criteria: [
          { id: 'ekg-acquisition-402-0', label: 'Power on Monitor' },
          { id: 'ekg-acquisition-403-1', label: 'Explain procedure to patient' },
          { id: 'ekg-acquisition-404-2', label: 'Properly position the patient (supine or semi-fowlers)' },
          { id: 'ekg-acquisition-405-3', label: 'Place the 4 limb leads' },
          { id: 'ekg-acquisition-406-4', label: 'White - Right upper' },
          { id: 'ekg-acquisition-407-5', label: 'Black - Left upper' },
          { id: 'ekg-acquisition-408-6', label: 'Red - Left lower' },
          { id: 'ekg-acquisition-409-7', label: 'Green - Right Lower' },
          { id: 'ekg-acquisition-410-8', label: 'Properly locates the Angle of Louis' },
          { id: 'ekg-acquisition-411-9', label: 'Apply - V1 - 4th Intercostal space at the right sternal margin.​' },
          { id: 'ekg-acquisition-412-10', label: 'Apply - V2 - 4th Intercostal space at the left sternal margin.​' },
          { id: 'ekg-acquisition-413-11', label: 'Apply - V3 - Midway between V2 and V4 leads. ​' },
          { id: 'ekg-acquisition-414-12', label: 'Apply - V4 - 5th Intercostal space at the mid-clavicular line.​' },
          { id: 'ekg-acquisition-415-13', label: 'Apply - V5 - 5th Intercostal space at the left anterior-axillary line.​' },
          { id: 'ekg-acquisition-416-14', label: 'Apply - V6 - 5th Intercostal space at left mid-axillary line.​' },
          { id: 'ekg-acquisition-417-15', label: 'Connect precordial cable bundle to main cable' },
          { id: 'ekg-acquisition-418-16', label: 'Select 12-lead EKG function' },
          { id: 'ekg-acquisition-419-17', label: 'Enter patient\'s age and gender' },
          { id: 'ekg-acquisition-420-18', label: 'Press buttons to acquire 12-lead EKG' },
          { id: 'ekg-acquisition-421-19', label: 'Transmit 12-lead EKG (If necessary)' },
          { id: 'ekg-acquisition-422-20', label: 'Discuss who can acquire an EKG and who can interpret an EKG' },
        ],
      },
    ],
    criticalFailures: [],
  },
  {
    id: 'intubation-equipment',
    title: 'Intubation Equipment',
    levelLabel: 'Paramedic',
    levels: ['paramedic'],
    sections: [
      {
        title: 'Performance',
        criteria: [
          { id: 'intubation-equipment-437-0', label: 'Ensure intubation kit present' },
          { id: 'intubation-equipment-438-1', label: 'Ensure all equipment present per daily truck checklist' },
        ],
      },
      {
        title: 'Equipment Testing',
        criteria: [
          { id: 'intubation-equipment-444-0', label: 'Ensure non-flickering bright white light when blade attached to handle' },
          { id: 'intubation-equipment-445-1', label: 'Ensure blade latches securely in handle' },
        ],
      },
      {
        title: 'Prior to Endotracheal placement',
        criteria: [
          { id: 'intubation-equipment-451-0', label: 'Select appropriate size ET tube' },
          { id: 'intubation-equipment-452-1', label: 'Assemble and test King Vision' },
          { id: 'intubation-equipment-453-2', label: 'Select appropriate laryngoscope blade, attach to handle and test' },
          { id: 'intubation-equipment-454-3', label: 'Remove ET tube from package' },
          { id: 'intubation-equipment-455-4', label: 'Inflate cuff using 10cc syringe, ensure cuff remains inflated w/ no leak present' },
          { id: 'intubation-equipment-456-5', label: 'Place bougie or stylet into ET tube' },
          { id: 'intubation-equipment-457-6', label: 'Intubate patient per protocol' },
          { id: 'intubation-equipment-458-7', label: 'Begin ventilations and confirm placement per protocol (at least 3 confirmations)' },
          { id: 'intubation-equipment-459-8', label: 'Secure ET tube' },
          { id: 'intubation-equipment-460-9', label: 'Place end-tidal monitor' },
          { id: 'intubation-equipment-461-10', label: 'Ensure appropriate cuff pressure' },
          { id: 'intubation-equipment-462-11', label: 'Place c-collar on patient to prevent ET tube movement' },
          { id: 'intubation-equipment-463-12', label: 'Insert NG tube per protocol' },
          { id: 'intubation-equipment-464-13', label: 'Know the DOPE acronym if patient deteriorates' },
        ],
      },
    ],
    criticalFailures: [],
  },
  {
    id: 'ez-io',
    title: 'EZ- IO',
    levelLabel: 'AEMT & Paramedic',
    levels: ['aemt', 'paramedic'],
    sections: [
      {
        title: 'Performance',
        criteria: [
          { id: 'ez-io-479-0', label: 'List two indications for the EZ-IO' },
          { id: 'ez-io-480-1', label: 'List two contraindications for the EZ-IO' },
          { id: 'ez-io-481-2', label: 'Have BSI in place' },
        ],
      },
      {
        title: 'Locate appropriate site (Must identify all sites)',
        criteria: [
          { id: 'ez-io-487-0', label: 'Proximal Tibia - Pediatric' },
          { id: 'ez-io-488-1', label: 'Proximal Tibia - Adult' },
          { id: 'ez-io-489-2', label: 'Distal Tibia - Adult' },
          { id: 'ez-io-490-3', label: 'Humeral Head - Adult' },
        ],
      },
      {
        title: 'Usage',
        criteria: [
          { id: 'ez-io-496-0', label: 'Prepare insertion site using aseptic techniques' },
          { id: 'ez-io-497-1', label: 'Prepare the EZ-IO driver and appropriate needle set' },
          { id: 'ez-io-498-2', label: 'Stabilize the site and insert appropriate needle set' },
          { id: 'ez-io-499-3', label: 'Remove EZ-IO driver from needle set while stabilizing catheter hub' },
          { id: 'ez-io-500-4', label: 'Remove stylet from catheter, place stylet in shuttle or appropriate sharps container' },
          { id: 'ez-io-501-5', label: 'Confirm placement' },
          { id: 'ez-io-502-6', label: 'Connect primed EZ-Connect' },
          { id: 'ez-io-503-7', label: 'Syringe bolus (flush) the EZ-IO catheter with appropriate amount of normal saline' },
          { id: 'ez-io-504-8', label: 'Utilize pressure (syringe bolus, pressure bag, or infusion pump) for continuous infusions where applicable' },
          { id: 'ez-io-505-9', label: 'Begin infusion' },
          { id: 'ez-io-506-10', label: 'Dress site, secure tubing and apply wristband as directed' },
          { id: 'ez-io-507-11', label: 'Monitor EZ-IO site and patient condition' },
          { id: 'ez-io-508-12', label: 'Demonstrate how to remove EZ-IO' },
        ],
      },
    ],
    criticalFailures: [],
  },
  {
    id: 'narcotic-access-procedures',
    title: 'Narcotic Access Procedures',
    levelLabel: 'All Levels',
    levels: ['emt', 'aemt', 'paramedic'],
    sections: [
      {
        title: 'Performance',
        criteria: [
          { id: 'narcotic-access-procedures-523-0', label: 'Obtain narcotics from secured fridge' },
          { id: 'narcotic-access-procedures-524-1', label: 'Complete check out form in PSTrax' },
          { id: 'narcotic-access-procedures-525-2', label: 'Secure narcotics in sealed cabinet in ambulance' },
          { id: 'narcotic-access-procedures-526-3', label: 'Return narcotics to secured cabinet' },
          { id: 'narcotic-access-procedures-527-4', label: 'Ensure key for secure cabinet is secured in holder at the end of the shift' },
        ],
      },
      {
        title: 'Procedure for Narcotic Using',
        criteria: [
          { id: 'narcotic-access-procedures-533-0', label: 'Obtain narcotics and remove Tags' },
          { id: 'narcotic-access-procedures-534-1', label: 'Select appropriate medication, open the plastic box, complete PSTrax form, and administer' },
          { id: 'narcotic-access-procedures-535-2', label: 'Complete narcotic log on PSTrax' },
          { id: 'narcotic-access-procedures-536-3', label: 'Waste remaining volume with appropriate witness' },
          { id: 'narcotic-access-procedures-537-4', label: 'Discuss who are appropriate witnesses for waste' },
          { id: 'narcotic-access-procedures-538-5', label: 'Obtain signature of person witnessing wasting unused portion of medication administered' },
          { id: 'narcotic-access-procedures-539-6', label: 'Document narcotic usage in patient care report' },
        ],
      },
      {
        title: 'Explains procedure for securing and exchanging Narcotics',
        criteria: [
          { id: 'narcotic-access-procedures-545-0', label: 'Demonstrate knowledge that the narcotic box is never to be out of duty ALS providers sight when not in locked storage' },
          { id: 'narcotic-access-procedures-546-1', label: 'Demonstrate knowledge that any discrepancies with narcotic box found must be reported immediately to the shift supervisor' },
          { id: 'narcotic-access-procedures-547-2', label: 'Demonstrate knowledge Narcotic Boxes are not to be opened by field personnel until needed' },
        ],
      },
    ],
    criticalFailures: [],
  },
  {
    id: 'lucas',
    title: 'Lucas',
    levelLabel: 'All Levels',
    levels: ['emt', 'aemt', 'paramedic'],
    sections: [
      {
        title: 'Performance',
        criteria: [
          { id: 'lucas-562-0', label: 'Check Lucas location on ambulance.' },
          { id: 'lucas-563-1', label: 'Ensure Lucas is powered and all equipment is present at start of shift' },
        ],
      },
      {
        title: 'Procedure',
        criteria: [
          { id: 'lucas-569-0', label: 'Place stabilization board underneath patient\'s torso' },
          { id: 'lucas-570-1', label: 'Prepare Lucas for application during compression round (Ideally minutes 4-6)' },
          { id: 'lucas-571-2', label: 'Place Lucas on patient\'s torso and attach to stabilization board during rhythm check (< 10 sec)' },
          { id: 'lucas-572-3', label: 'Turn on Lucas' },
          { id: 'lucas-573-4', label: 'Press #1 and set plunger to starting height at patient\'s chest' },
          { id: 'lucas-574-5', label: 'Press #2 to lock plunger in place' },
          { id: 'lucas-575-6', label: 'Press # 3 to begin compressions' },
          { id: 'lucas-576-7', label: 'Dictate when 30:2 ratio or continuous compressions should be utilized' },
          { id: 'lucas-577-8', label: 'Dictate compression pause and resumption for rhythm checks' },
          { id: 'lucas-578-9', label: 'Secure patient to Lucas and mark plunger to watch for drift' },
          { id: 'lucas-579-10', label: 'Switch Batteries' },
        ],
      },
    ],
    criticalFailures: [
      'Failure to turn on the Lucas',
      'Performs any improper technique resulting in the Lucas device failure',
      'Exhibits unacceptable affect with patient or other personnel',
      'Uses or orders a dangerous or inappropriate intervention',
    ],
  },
  {
    id: 'i-view',
    title: 'Video Laryngoscope',
    levelLabel: 'All Levels',
    levels: ['emt', 'aemt', 'paramedic'],
    sections: [
      {
        title: 'Performance',
        criteria: [
          { id: 'i-view-599-0', label: 'Then Provider Verbalizes the indication and needs for the procedure' },
          { id: 'i-view-600-1', label: 'Selects, checks, and assemble equipment' },
          { id: 'i-view-601-2', label: 'The provider verbalizes pre-oxygenation' },
          { id: 'i-view-602-3', label: 'Positions head properly' },
          { id: 'i-view-603-4', label: 'Inserts video laryngoscope blade and displaces the tounge' },
          { id: 'i-view-604-5', label: 'Inserts ET tube and advances to the proper depth' },
          { id: 'i-view-605-6', label: 'Inflates cuff to proper presssure and immediately removes syringe' },
          { id: 'i-view-606-7', label: 'Select appropriate medication, open the plastic bag, store narcotic slip, and administer' },
          { id: 'i-view-607-8', label: 'Ventilates patient and confirms proper tube placement by auscultation bilaterally over lungs and over the epigastrium' },
          { id: 'i-view-608-9', label: 'Verifies proper tube placement by a secondary confirmation such as; Capnography, Capnometry, EDD, or Colormetric device (can verbalize)' },
          { id: 'i-view-609-10', label: 'Assesses for hypoxia during intubation attempt (can verbilize)' },
          { id: 'i-view-610-11', label: 'Secures ET tube' },
          { id: 'i-view-611-12', label: 'Verbalizes how and when to reassess the patient' },
        ],
      },
    ],
    criticalFailures: [],
  },
  {
    id: 'iv-start',
    title: '(IV) Venous Access Procedure',
    levelLabel: 'AEMT & Paramedic',
    levels: ['aemt', 'paramedic'],
    sections: [
      {
        title: 'Assembles Equipment',
        criteria: [
          { id: 'iv-start-626-0', label: 'IV solution' },
          { id: 'iv-start-627-1', label: 'Administration set' },
          { id: 'iv-start-628-2', label: 'IV Catheter of appropraite size' },
          { id: 'iv-start-629-3', label: 'Sharps container' },
          { id: 'iv-start-630-4', label: 'IV start kit' },
        ],
      },
      {
        title: 'Preparation of Fluids/Meds',
        criteria: [
        ],
      },
      {
        title: 'Checks solution for:',
        criteria: [
          { id: 'iv-start-641-0', label: 'Proper solution' },
          { id: 'iv-start-642-1', label: 'Clarity or particulate matter' },
          { id: 'iv-start-643-2', label: 'Expiration date' },
          { id: 'iv-start-644-3', label: 'Protective covers on tail ports' },
        ],
      },
      {
        title: 'Checks administration set for:',
        criteria: [
          { id: 'iv-start-650-0', label: 'Tangled tubing' },
          { id: 'iv-start-651-1', label: 'Protective covers on both ends' },
          { id: 'iv-start-652-2', label: 'Clamps in place and opperational' },
        ],
      },
      {
        title: 'Preparation of Fluids/Meds',
        criteria: [
          { id: 'iv-start-658-0', label: 'Removes protective cover on drip chamber while maintaining sterility' },
          { id: 'iv-start-659-1', label: 'Removes protective cover on IV bag tail port while maintaining sterility' },
          { id: 'iv-start-660-2', label: 'Inserts IV tubing spike into IV solution bag tail port by twisting and pushing until inner seal is punctured while maintaining sterility' },
          { id: 'iv-start-661-3', label: 'Turns IV bag upright' },
          { id: 'iv-start-662-4', label: 'Squeezes drip chamber to fill the chamber to desired amount' },
          { id: 'iv-start-663-5', label: 'Turns on flow and bleeds line of all air while maintaining sterility' },
          { id: 'iv-start-664-6', label: 'Shuts flow off after assuring that all large air bubbles have been purged' },
        ],
      },
      {
        title: 'Performs venipuncture',
        criteria: [
          { id: 'iv-start-670-0', label: 'Tears sufficient tape to secure IV' },
          { id: 'iv-start-671-1', label: 'Opens antiseptic swabs, gauze pads, occlusive dressing' },
          { id: 'iv-start-672-2', label: 'Takes appropriate PPE precautions' },
          { id: 'iv-start-673-3', label: 'Identifies appropriate potential site for cannulation' },
          { id: 'iv-start-674-4', label: 'Applies tourniquet properly' },
          { id: 'iv-start-675-5', label: 'Palpates and identifies suitable vein' },
          { id: 'iv-start-676-6', label: 'Cleanses site, starting from the center and moving outward in a circular motion' },
          { id: 'iv-start-677-7', label: 'Removes IV needle and catheter from package and while maintaining sterility' },
          { id: 'iv-start-678-8', label: 'Inspects for burrs' },
          { id: 'iv-start-679-9', label: 'Loosens catheter hub with twisting motion' },
          { id: 'iv-start-680-10', label: 'Stabilizes the vein and extremity by grasping and stretching skin while maintaining sterility' },
          { id: 'iv-start-681-11', label: 'Warns patient to expect to feel the needle stick' },
          { id: 'iv-start-682-12', label: 'Inserts stylette with bevel up at appropriate angle (35 – 45°) while maintaining sterility' },
          { id: 'iv-start-683-13', label: 'Feels "pop" as stylette enters vein and observes dark, red blood in flash chamber' },
          { id: 'iv-start-684-14', label: 'Lowers stylette and inserts an additional 1/8 – 1/4"' },
          { id: 'iv-start-685-15', label: 'Stabilizes stylette and slides catheter off of stylette until hub touches skin' },
          { id: 'iv-start-686-16', label: 'Palpates skin just distal to tip of catheter and applies pressure to occlude vein' },
          { id: 'iv-start-687-17', label: 'Removes stylette and immediately disposes in sharps container' },
          { id: 'iv-start-688-18', label: 'Attaches extension set and aspirates for blood' },
          { id: 'iv-start-689-19', label: 'Removes protective cap from IV tubing and attaches to hub of catheter while maintaining sterility' },
          { id: 'iv-start-690-20', label: 'Releases tourniquet' },
          { id: 'iv-start-691-21', label: 'Opens flow clamp and runs for a brief period to assure a patent line' },
          { id: 'iv-start-692-22', label: 'Secures catheter and IV tubing to patient' },
          { id: 'iv-start-693-23', label: 'Adjusts flow rate as appropriate' },
          { id: 'iv-start-694-24', label: 'Assesses site for signs of infiltration, irritation' },
          { id: 'iv-start-695-25', label: 'Assesses patient for therapeutic response or signs of untoward reactions' },
        ],
      },
    ],
    criticalFailures: [
      'Failure to take or verbalize appropriate PPE precautions',
      'Failure to dispose of blood-contaminated sharps immediately at the point of use',
      'Contaminates equipment or site without appropriately correcting situation',
      'Performs any improper technique resulting in the potential for uncontrolled hemorrhage, catheter shear or air embolism',
      'Exhibits unacceptable affect with patient or other personnel',
      'Uses or orders a dangerous or inappropriate intervention',
    ],
  },
  {
    id: 'ng-tube-insertion',
    title: 'Nasogastric Tube Placement',
    levelLabel: 'Paramedic',
    levels: ['paramedic'],
    sections: [
      {
        title: 'Assembles Equipment & Introduction',
        criteria: [
          { id: 'ng-tube-insertion-717-0', label: 'Proper PPE' },
          { id: 'ng-tube-insertion-718-1', label: 'Introduce yourself to the patient' },
          { id: 'ng-tube-insertion-719-2', label: 'Determine if the patient has allergies' },
          { id: 'ng-tube-insertion-720-3', label: 'Provide client education. Develop signals for client to communicate during procedure' },
        ],
      },
      {
        title: 'Preparation of the Equipment & Patient',
        criteria: [
          { id: 'ng-tube-insertion-726-0', label: 'Inspect client nares and check for patency' },
          { id: 'ng-tube-insertion-727-1', label: 'Assist client into high-Fowler\'s position or at a 45-degree angle' },
          { id: 'ng-tube-insertion-728-2', label: 'Place a towel over the client\'s chest' },
          { id: 'ng-tube-insertion-729-3', label: 'Measure the length of tubing required for the client, then mark it with an indelible marker' },
          { id: 'ng-tube-insertion-730-4', label: 'If using a stylet, ensure it is secure and inject 10 mL of water into the tube' },
          { id: 'ng-tube-insertion-731-5', label: 'Prepare tape or fixation device' },
          { id: 'ng-tube-insertion-732-6', label: 'Lubricate the tip of the tube and apply anesthetics if policy indicates' },
          { id: 'ng-tube-insertion-733-7', label: 'Give the client a cup of water with straw, and either have the client keep their neck in a neutral position or have them flex their head back on a pillow' },
        ],
      },
      {
        title: 'Insertion of the NG Tube',
        criteria: [
          { id: 'ng-tube-insertion-739-0', label: 'Insert tube following nasal passage. Rotate tube to help pass through the nasopharynx' },
          { id: 'ng-tube-insertion-740-1', label: 'Provide reassurance to client if gagging occurs when tube reaches pharynx. Ensure the tube is not coiled in the pharynx' },
          { id: 'ng-tube-insertion-741-2', label: 'Have the client flex their chin to their chest and encourage client to sip through a straw while tube advances' },
          { id: 'ng-tube-insertion-742-3', label: 'Continue advancing tubing until measured mark is reached. Secure tubing temporarily with tape' },
        ],
      },
      {
        title: 'Securing and Confirmation',
        criteria: [
          { id: 'ng-tube-insertion-748-0', label: 'Determine tube placement by checking aspirate pH or bilirubin or use a CO2 detector' },
          { id: 'ng-tube-insertion-749-1', label: 'Mark the tube at the client\'s nostril' },
          { id: 'ng-tube-insertion-750-2', label: 'Apply skin barrier to the nose and secure tube in place with tape or a fixation device' },
          { id: 'ng-tube-insertion-751-3', label: 'Secure tubing to the client\'s gown. If a double-lumen is used, ensure vent is above stomach level' },
          { id: 'ng-tube-insertion-752-4', label: 'Remove gloves and perform hand hygiene' },
          { id: 'ng-tube-insertion-753-5', label: 'Arrange for an x-ray to confirm placement' },
          { id: 'ng-tube-insertion-754-6', label: 'Apply clean gloves and provide oral hygiene' },
          { id: 'ng-tube-insertion-755-7', label: 'Discard supplies, remove gloves, and perform hand hygiene' },
          { id: 'ng-tube-insertion-756-8', label: 'Ensure that the client is in a safe position' },
          { id: 'ng-tube-insertion-757-9', label: 'Following x-ray confirmation, remove stylet' },
        ],
      },
      {
        title: 'Give examples for when to stop the proedure',
        criteria: [
          { id: 'ng-tube-insertion-763-0', label: 'The patient becomes cyanotic' },
          { id: 'ng-tube-insertion-764-1', label: 'The patient is unable to speak or hum' },
          { id: 'ng-tube-insertion-765-2', label: 'The patient has continuous coughing or gagging' },
          { id: 'ng-tube-insertion-766-3', label: 'If you are unable to advance the tube after rotating it' },
        ],
      },
    ],
    criticalFailures: [],
  },
  {
    id: 'needle-pleural-decompression',
    title: 'Needle Pleural Decompression',
    levelLabel: 'Paramedic',
    levels: ['paramedic'],
    sections: [
      {
        title: 'State indications for procedure/S&S of a tension pneumothorax',
        criteria: [
          { id: 'needle-pleural-decompression-781-0', label: 'Unilateral absence of breath sounds' },
          { id: 'needle-pleural-decompression-782-1', label: 'Severe dyspnea' },
          { id: 'needle-pleural-decompression-783-2', label: 'Asymmetric chest expansion' },
          { id: 'needle-pleural-decompression-784-3', label: 'Hyperresonance to percussion on affected side' },
          { id: 'needle-pleural-decompression-785-4', label: 'Systolic Blood Pressure < 90' },
          { id: 'needle-pleural-decompression-786-5', label: 'Jugular Vein Distension' },
          { id: 'needle-pleural-decompression-787-6', label: 'Pleuritic chest pain' },
        ],
      },
      {
        title: 'State contraindications for procedure',
        criteria: [
          { id: 'needle-pleural-decompression-793-0', label: 'Systolic Blood Pressure > 90' },
          { id: 'needle-pleural-decompression-794-1', label: 'Simple pneumothorax' },
        ],
      },
      {
        title: 'Prepare and assemble equipment',
        criteria: [
          { id: 'needle-pleural-decompression-800-0', label: '10 g; 3"-3.25" needle or Pneumofix' },
          { id: 'needle-pleural-decompression-801-1', label: '10 mL syringe' },
          { id: 'needle-pleural-decompression-802-2', label: 'CHG/IPA prep' },
          { id: 'needle-pleural-decompression-803-3', label: 'Attach 10 mL syringe to end of IV catheter' },
          { id: 'needle-pleural-decompression-804-4', label: 'Observe Universal precautions (gloves & face protection); maintain aseptic technique' },
        ],
      },
      {
        title: 'Prepare patient',
        criteria: [
          { id: 'needle-pleural-decompression-810-0', label: 'Explain procedure to patient if awake' },
        ],
      },
      {
        title: 'Perform procedure',
        criteria: [
          { id: 'needle-pleural-decompression-816-0', label: 'Identify landmarks: 2nd-3rd intercostal space in midclavicular line on affected side' },
          { id: 'needle-pleural-decompression-817-1', label: 'Cleanse skin with CHG/IPA prep' },
          { id: 'needle-pleural-decompression-818-2', label: 'Insert needle at a 90° angle to chest wall over superior border of 3rd or 4th rib' },
          { id: 'needle-pleural-decompression-819-3', label: 'Listen for "pop" as needle penetrates pleural space; observe plunger move in syringe or sudden movement of the green indicator toward pt if using Pneumofix. If aspirating with syringe, air or fluid may be withdrawn. Stop needle advancement' },
          { id: 'needle-pleural-decompression-820-4', label: 'Assess radial pulses and ventilatory status for improvement' },
          { id: 'needle-pleural-decompression-821-5', label: 'Holding needle in place, advance catheter into chest 2-3 cm or up to hub; remove needle – prevent catheter kinking; secure catheter to chest wall with ½" tape to prevent dislodgement. May place flutter valve over catheter hub by taping one finger cut from a disposable glove with small slit cut in the end' },
          { id: 'needle-pleural-decompression-822-6', label: 'Immediately place needle in a sharps container' },
          { id: 'needle-pleural-decompression-823-7', label: 'Reassess pt to determine need for a second needle placement' },
          { id: 'needle-pleural-decompression-824-8', label: 'Transport pt to a Level I trauma center if ground transport time ≤ 30 min' },
        ],
      },
      {
        title: 'Verbalizes at least 2 complications associated w/ this procedure',
        criteria: [
          { id: 'needle-pleural-decompression-830-0', label: 'Hemothorax: Inadvertent puncture of costal vessels' },
          { id: 'needle-pleural-decompression-831-1', label: 'Pneumothorax if not pre-existing' },
          { id: 'needle-pleural-decompression-832-2', label: 'Sub-q emphysema' },
          { id: 'needle-pleural-decompression-833-3', label: 'Prolonged pain from injury to intercostal nerves' },
        ],
      },
    ],
    criticalFailures: [],
  },
  {
    id: 'hemorrhage-control-tournquet',
    title: 'CAT Tourniquet',
    levelLabel: 'All Levels',
    levels: ['emt', 'aemt', 'paramedic'],
    sections: [
      {
        title: 'Performance',
        criteria: [
          { id: 'hemorrhage-control-tournquet-848-0', label: 'Apply PPE' },
        ],
      },
      {
        title: 'Assess for nature of bleeding',
        criteria: [
          { id: 'hemorrhage-control-tournquet-854-0', label: 'Type, Source, Amount, and Rate' },
          { id: 'hemorrhage-control-tournquet-855-1', label: 'Apply direct digital pressure using palm of hand over a single layer sterile dressing placed over wound unless contraindicated (deep open skull wound)' },
        ],
      },
      {
        title: 'Bleeding persists',
        criteria: [
          { id: 'hemorrhage-control-tournquet-861-0', label: 'Cover entire bleeding surface; including deep areas of wound with guaze as needed' },
          { id: 'hemorrhage-control-tournquet-862-1', label: 'Apply direct pressure over dressing' },
          { id: 'hemorrhage-control-tournquet-863-2', label: 'If blood soaks through 1st layer, apply a 2nd' },
          { id: 'hemorrhage-control-tournquet-864-3', label: 'Once bleeding stops, apply pressure bandage to hold dressing in place' },
          { id: 'hemorrhage-control-tournquet-865-4', label: 'Do not remove blood-soaked bandages from wound, may cause more bleeding' },
        ],
      },
      {
        title: 'Severe extremity bleeding Verbalize need for a tourniquet',
        criteria: [
          { id: 'hemorrhage-control-tournquet-871-0', label: 'Mangled extremity; amputation' },
          { id: 'hemorrhage-control-tournquet-872-1', label: 'Arterial bleed' },
          { id: 'hemorrhage-control-tournquet-873-2', label: 'Direct pressure ineffective or impractical; hemostatic dressing ineffective in hemostasis' },
        ],
      },
      {
        title: 'Procedure for CAT tourniquet',
        criteria: [
          { id: 'hemorrhage-control-tournquet-879-0', label: 'Prepare equipment and explain procedure to patient' },
          { id: 'hemorrhage-control-tournquet-880-1', label: 'Slide the wounded extremity through the loop of the Self-Adhering Band or wrap around extremity' },
          { id: 'hemorrhage-control-tournquet-881-2', label: 'Positioned the CAT above simulated wound site; left at least 2 - 3 inches of uninjured skin between the CAT and the wound site' },
          { id: 'hemorrhage-control-tournquet-882-3', label: 'Pull the band tight and securely fasten the band back on itself' },
          { id: 'hemorrhage-control-tournquet-883-4', label: 'Twisted the Windlass Rod until the distal pulse was no longer palpable' },
          { id: 'hemorrhage-control-tournquet-884-5', label: 'Locked the rod in place with the Windlass Clip' },
          { id: 'hemorrhage-control-tournquet-885-6', label: 'Grasped the Windlass Strap, pulled it tight and adhered it to the Velcro on the Windlass Clip' },
          { id: 'hemorrhage-control-tournquet-886-7', label: 'Record the date and time the CAT was applied on the Windlass Clip.' },
          { id: 'hemorrhage-control-tournquet-887-8', label: 'Reassess extremity; ensure bleeding has stopped. Tourniquet should be visible/well marked (time applied). Do NOT obscure with clothing or bandages. Continue reassessment enroute. Do NOT release tourniquet until patient reaches definitive care.' },
        ],
      },
      {
        title: 'Assess need for pain management',
        criteria: [
          { id: 'hemorrhage-control-tournquet-893-0', label: 'If hemodynamically stable – fentanyl per SOP' },
        ],
      },
      {
        title: 'Documentation (verbalize)',
        criteria: [
          { id: 'hemorrhage-control-tournquet-899-0', label: 'MOI: Blunt, penetrating' },
          { id: 'hemorrhage-control-tournquet-900-1', label: 'Measures used prior to tourniquet application' },
          { id: 'hemorrhage-control-tournquet-901-2', label: 'Who applied and/or removed tourniquet' },
          { id: 'hemorrhage-control-tournquet-902-3', label: 'Total tourniquet time in minutes' },
          { id: 'hemorrhage-control-tournquet-903-4', label: 'Site of tourniquet application: arm, leg; R or L' },
          { id: 'hemorrhage-control-tournquet-904-5', label: 'Time tourniquet applied' },
          { id: 'hemorrhage-control-tournquet-905-6', label: 'Success of hemorrhage control' },
          { id: 'hemorrhage-control-tournquet-906-7', label: 'Whether pt required pain meds d/t tourniquet pain' },
          { id: 'hemorrhage-control-tournquet-907-8', label: 'Tourniquet-related complications if known: ischemia damage, compartment syndrome' },
        ],
      },
    ],
    criticalFailures: [],
  },
  {
    id: 'autopulse-check-off',
    title: 'Auto Pulse',
    levelLabel: 'All Levels',
    levels: ['emt', 'aemt', 'paramedic'],
    sections: [
      {
        title: 'Describe the Appropriate Indications for Use',
        criteria: [
          { id: 'autopulse-check-off-922-0', label: 'Patients in cardiac arrest that need CPR' },
          { id: 'autopulse-check-off-923-1', label: 'Patients 18 years of age or older' },
          { id: 'autopulse-check-off-924-2', label: 'Not indicated for trauma patients' },
        ],
      },
      {
        title: 'Perform a Daily Check Out',
        criteria: [
          { id: 'autopulse-check-off-930-0', label: 'Remove AutoPulse from the case' },
          { id: 'autopulse-check-off-931-1', label: 'Rotate batteries' },
          { id: 'autopulse-check-off-932-2', label: 'Power on AutoPulse and check for green LED' },
        ],
      },
      {
        title: 'Apply and Operate the AutoPulse',
        criteria: [
          { id: 'autopulse-check-off-938-0', label: 'Describe purpose of yellow line indicator' },
          { id: 'autopulse-check-off-939-1', label: 'Align the mannequin on the board' },
          { id: 'autopulse-check-off-940-2', label: 'Apply LifeBand and fully extend it to "home" position' },
          { id: 'autopulse-check-off-941-3', label: 'Start the AutoPulse systems' },
          { id: 'autopulse-check-off-942-4', label: 'Attach Shoulder Restraints with the system operating' },
          { id: 'autopulse-check-off-943-5', label: 'Describe how to address User Alerts' },
          { id: 'autopulse-check-off-944-6', label: 'Fully extend LifeBand to "home" position and restart' },
          { id: 'autopulse-check-off-945-7', label: 'Stop AutoPulse and Power off' },
        ],
      },
      {
        title: 'Readying the AutoPulse for the Next Use',
        criteria: [
          { id: 'autopulse-check-off-951-0', label: 'Fully extend LifeBand' },
          { id: 'autopulse-check-off-952-1', label: 'Remove LifeBand and install a new one' },
          { id: 'autopulse-check-off-953-2', label: 'Replace the battery' },
          { id: 'autopulse-check-off-954-3', label: 'Remove and replace the battery' },
          { id: 'autopulse-check-off-955-4', label: 'Store the AutoPulse in the carry case' },
        ],
      },
    ],
    criticalFailures: [],
  },
  {
    id: 'junctional-tourniquet-inguinal',
    title: 'Junctional Tourniquet Inguinal Hemorrhage',
    levelLabel: 'All Levels',
    levels: ['emt', 'aemt', 'paramedic'],
    sections: [
      {
        title: 'Performance',
        criteria: [
          { id: 'junctional-tourniquet-inguinal-970-0', label: 'Apply PPE and obtain the device' },
        ],
      },
      {
        title: 'Apply the Device',
        criteria: [
          { id: 'junctional-tourniquet-inguinal-976-0', label: 'Slide the belt underneath the patient, positioning the Target Compression Device (TCD) over the area to be compressed.' },
          { id: 'junctional-tourniquet-inguinal-977-1', label: 'Use sterile gauze or hemostatic dressing if targeting directly over a wound.' },
          { id: 'junctional-tourniquet-inguinal-978-2', label: 'Hold the TCD in place and connect the belt using the buckle.' },
          { id: 'junctional-tourniquet-inguinal-979-3', label: 'Pull the BROWN HANDLES away from each other until the buckle secures. You will hear an audible click.' },
          { id: 'junctional-tourniquet-inguinal-980-4', label: 'Fasten excess belt in place by pressing it down on the Velcro. You may hear a second click once the belt is secure.' },
          { id: 'junctional-tourniquet-inguinal-981-5', label: 'Use the hand pump to inflate the TCD until hemorrhage stops.' },
          { id: 'junctional-tourniquet-inguinal-982-6', label: 'Monitor patient during transport for hemorrhage control and adjust the device if necessary.' },
        ],
      },
    ],
    criticalFailures: [],
  },
  {
    id: 'junctional-tourniquet-axilla',
    title: 'Junctional Tourniquet Axilla Hemorrhage',
    levelLabel: 'All Levels',
    levels: ['emt', 'aemt', 'paramedic'],
    sections: [
      {
        title: 'Performance',
        criteria: [
          { id: 'junctional-tourniquet-axilla-997-0', label: 'Apply PPE and obtain the device' },
        ],
      },
      {
        title: 'Apply the Device',
        criteria: [
          { id: 'junctional-tourniquet-axilla-1003-0', label: 'Apply the SJT to the patient under the arms, as high as possible. Place the D-ring on the injured side, aligning it with the side of the neck.' },
          { id: 'junctional-tourniquet-axilla-1004-1', label: 'Attach the Extender to the TCD prior to application and place on the strap on the brown Velcro.' },
          { id: 'junctional-tourniquet-axilla-1005-2', label: 'Connect the strap using the large clip to the D-ring on the front of the SJT.' },
          { id: 'junctional-tourniquet-axilla-1006-3', label: 'Connect the buckle and secure the belt in place by pulling the BROWN HANDLES apart until you hear it click.' },
          { id: 'junctional-tourniquet-axilla-1007-4', label: 'Tighten the strap as much as possible using the BROWN HANDLE. Use the pump to inflate the TCD until hemorrhage stops.' },
          { id: 'junctional-tourniquet-axilla-1008-5', label: 'Monitor patient during transport for hemorrhage control and adjust the device if necessary. TO REMOVE, unbuckle the belt.' },
        ],
      },
    ],
    criticalFailures: [],
  },
  {
    id: 'pelvic-binder',
    title: 'Pelvic Binder',
    levelLabel: 'All Levels',
    levels: ['emt', 'aemt', 'paramedic'],
    sections: [
      {
        title: 'Indications for use',
        criteria: [
          { id: 'pelvic-binder-1023-0', label: 'Splinting and control of unstable pelvic fractures with continuing hemorrhage and hypotension' },
        ],
      },
      {
        title: 'Contraindications',
        criteria: [
          { id: 'pelvic-binder-1029-0', label: 'Abdominal injury with protruding viscera' },
          { id: 'pelvic-binder-1030-1', label: 'Body size too large' },
          { id: 'pelvic-binder-1031-2', label: 'These patients should undergo thigh / toe taping to stabilize their fractures' },
        ],
      },
      {
        title: 'Additional Considerations',
        criteria: [
          { id: 'pelvic-binder-1037-0', label: 'The pelvic binder should not be an impediment to IV access and volume resuscitation' },
          { id: 'pelvic-binder-1038-1', label: 'The application of the binder takes one to two minutes' },
        ],
      },
      {
        title: 'Application of the pelvic binder',
        criteria: [
          { id: 'pelvic-binder-1044-0', label: 'Remove all clothing from lower body' },
          { id: 'pelvic-binder-1045-1', label: 'Unfold pelvic binder' },
          { id: 'pelvic-binder-1046-2', label: 'Maintaining immobility of the spine, logroll the patient' },
          { id: 'pelvic-binder-1047-3', label: 'Place the center of the binder under the patient' },
          { id: 'pelvic-binder-1048-4', label: 'Wrap around the pelvis, and fasten with Velcro strips' },
          { id: 'pelvic-binder-1049-5', label: 'Tighten the binder by pulling attached cords and secure with attached locking tabs' },
          { id: 'pelvic-binder-1050-6', label: 'Continue to monitor and record vital signs' },
        ],
      },
    ],
    criticalFailures: [],
  },
  {
    id: 'quick-trach',
    title: 'Quick Trach',
    levelLabel: 'All Levels',
    levels: ['emt', 'aemt', 'paramedic'],
    sections: [
      {
        title: 'Performance',
        criteria: [
          { id: 'quick-trach-1065-0', label: 'Apply PPE' },
        ],
      },
      {
        title: 'Verbalizes indications for needle cricothyrotomy',
        criteria: [
          { id: 'quick-trach-1071-0', label: 'Airway obstruction by uncontrolled bleeding into the oral cavity and/or vomiting' },
          { id: 'quick-trach-1072-1', label: 'Severe maxillofacial trauma – blunt, penetrating, or associated with mandibular fracture' },
          { id: 'quick-trach-1073-2', label: 'Laryngeal foreign body that cannot be removed expeditiously' },
          { id: 'quick-trach-1074-3', label: 'Swelling of upper airway structures' },
          { id: 'quick-trach-1075-4', label: 'Infection (e.g., epiglottitis, Ludwig\'s angina)' },
          { id: 'quick-trach-1076-5', label: 'Allergic reaction or hereditary angioedema' },
          { id: 'quick-trach-1077-6', label: 'Chemical or thermal burns to the epiglottis and upper airway' },
        ],
      },
      {
        title: 'Verbalizes contraindications for needle cricothyrotomy',
        criteria: [
          { id: 'quick-trach-1083-0', label: 'Age <3 years or estimated weight <15 kg' },
          { id: 'quick-trach-1084-1', label: 'Ability to maintain airway utilizing less invasive procedures' },
          { id: 'quick-trach-1085-2', label: 'Conscious patient' },
          { id: 'quick-trach-1086-3', label: 'Moving ambulance' },
          { id: 'quick-trach-1087-4', label: 'Midline neck hematoma or massive subcutaneous emphysema' },
        ],
      },
      {
        title: 'Select the appropriate size device for the patient size',
        criteria: [
          { id: 'quick-trach-1093-0', label: 'Uses Adult or Pediatric size devices respectively' },
        ],
      },
      {
        title: 'Placement of device',
        criteria: [
          { id: 'quick-trach-1099-0', label: 'Hyperextend the head and neck (placing a towel roll under the neck is acceptable)' },
          { id: 'quick-trach-1100-1', label: 'Stabilize and palpate the neck locating the cricothyroid membrane' },
          { id: 'quick-trach-1101-2', label: 'Clean the area in a circular motion' },
          { id: 'quick-trach-1102-3', label: 'Hold the device fimrly and punctures cricoid membrane at a 90° angle' },
          { id: 'quick-trach-1103-4', label: 'Once puncture is achieved change the angle to 60°' },
          { id: 'quick-trach-1104-5', label: 'Ensure the red stopper keeps the device from being placed too deep' },
          { id: 'quick-trach-1105-6', label: 'Aspirate air through the syringe to confirm placement' },
          { id: 'quick-trach-1106-7', label: 'Remove the red stopper, holding the syringe and needle firmly and slide only the catheter into the trachea until the flange rests on the neck' },
          { id: 'quick-trach-1107-8', label: 'Dispose of the needle into a sharps container' },
          { id: 'quick-trach-1108-9', label: 'Connect the tubing to the 15 millimeter adapter and a BVM' },
          { id: 'quick-trach-1109-10', label: 'Auscultate the chest to ensure placement' },
          { id: 'quick-trach-1110-11', label: 'Contine to ventilate while observing for possible complications' },
        ],
      },
      {
        title: 'Possible complications',
        criteria: [
          { id: 'quick-trach-1116-0', label: 'Subcutaneous Emphysema' },
          { id: 'quick-trach-1117-1', label: 'Hemorrhage' },
          { id: 'quick-trach-1118-2', label: 'Hypoventilation' },
          { id: 'quick-trach-1119-3', label: 'Equipment Failure' },
          { id: 'quick-trach-1120-4', label: 'Catheter Kink' },
          { id: 'quick-trach-1121-5', label: 'False Placement' },
        ],
      },
      {
        title: 'Secure the device',
        criteria: [
          { id: 'quick-trach-1127-0', label: 'Use the velcro strap provided' },
        ],
      },
    ],
    criticalFailures: [],
  },
  {
    id: 'zoll-x-series',
    title: 'X-Series (Zoll)',
    levelLabel: 'ALL',
    levels: ['emt', 'aemt', 'paramedic'],
    equipmentGroup: 'monitor',
    sections: [
      {
        title: 'Overview and Power-up',
        criteria: [
          { id: 'zoll-x-series-1142-0', label: 'Demonstrates how to power-on the Zoll X-Series' },
          { id: 'zoll-x-series-1143-1', label: 'Locate quick access buttons and state their purpose' },
          { id: 'zoll-x-series-1144-2', label: 'Locate Navigation keys and state their purpose' },
          { id: 'zoll-x-series-1145-3', label: 'Locate the patient type and demonstrate how to change' },
        ],
      },
      {
        title: 'General Patient Monitoring',
        criteria: [
          { id: 'zoll-x-series-1151-0', label: 'Locate the current lead displayed and demonstrate how to change leads on the screen' },
          { id: 'zoll-x-series-1152-1', label: 'Locate the heart rate alarms and demonstrate how to change them' },
          { id: 'zoll-x-series-1153-2', label: 'Locate the NIBP alarms and demonstrate how to change them' },
          { id: 'zoll-x-series-1154-3', label: 'Locate the NIBP mode (manual or automatic) and demonstrate how to change it' },
          { id: 'zoll-x-series-1155-4', label: 'Locate the SmartCuf mode and describe its function' },
          { id: 'zoll-x-series-1156-5', label: 'Locate what TurboCuf setting does' },
          { id: 'zoll-x-series-1157-6', label: 'Locate the resp alarms and settings and demonstrate how to change them' },
          { id: 'zoll-x-series-1158-7', label: 'Locate the SpO2/SpCO values and alarms/settings and demonstrate how to change them' },
          { id: 'zoll-x-series-1159-8', label: 'Locate the ETCO2 values and alarm/settings and demonstrate how to change them' },
          { id: 'zoll-x-series-1160-9', label: 'Locate the ETCO2 waveform' },
          { id: 'zoll-x-series-1161-10', label: 'Demonstrate how to add multiple tracings (up to 4) on the X-Series screen' },
          { id: 'zoll-x-series-1162-11', label: 'Demonstrate how to apply CPR stat-padz and utilize Real CPR-Help and See-Thru CPR' },
          { id: 'zoll-x-series-1163-12', label: 'Identify Zoll integrated communication solutions (WiFi, BT, and USB)' },
          { id: 'zoll-x-series-1164-13', label: 'Demonstrate how to install and remove a battery; Demonstrate how to use the AC adaptor' },
          { id: 'zoll-x-series-1165-14', label: 'Demonstrate how to change the contrast mode from normal, to bright light (daylight) to night vision (NVGs) and back to normal' },
          { id: 'zoll-x-series-1166-15', label: 'Demonstrate how to print a strip' },
          { id: 'zoll-x-series-1167-16', label: 'Demonstrate how to take a snapshot and how much it records (12 secs before and after)' },
          { id: 'zoll-x-series-1168-17', label: 'Demonstrate how to print a call log' },
          { id: 'zoll-x-series-1169-18', label: 'Demonstrate the alarm silence button' },
          { id: 'zoll-x-series-1170-19', label: 'Demonstrate how to get from the home screen, to the trend screen, to the large numeric display screen and back to the home screen' },
          { id: 'zoll-x-series-1171-20', label: 'Demonstrate how to navigate through the trends display' },
        ],
      },
      {
        title: '12-Lead Acquisition',
        criteria: [
          { id: 'zoll-x-series-1177-0', label: 'Demonstrate how to access the 12-lead menu and acquire a 12-lead' },
          { id: 'zoll-x-series-1178-1', label: 'Demonstrate how to enter patient name' },
          { id: 'zoll-x-series-1179-2', label: 'Demonstrate how to transmit a 12-lead' },
          { id: 'zoll-x-series-1180-3', label: 'Demonstrate how to review a previous 12-lead' },
          { id: 'zoll-x-series-1181-4', label: 'Demonstrate how to exit the 12-lead menu' },
        ],
      },
      {
        title: 'Defibrillation/Cardioversion',
        criteria: [
          { id: 'zoll-x-series-1187-0', label: 'Place hands-free pads on patient in proper position (anterior/posterior is preferred over anterior/anterior)' },
          { id: 'zoll-x-series-1188-1', label: 'Put monitor in defibrillate mode by selecting appropriate energy' },
          { id: 'zoll-x-series-1189-2', label: 'Demonstrate turning the sync on and off' },
          { id: 'zoll-x-series-1190-3', label: 'Demonstrate how you would defibrillate' },
          { id: 'zoll-x-series-1191-4', label: 'Discuss the reasoning behind the difference between the selected and delivered energy' },
          { id: 'zoll-x-series-1192-5', label: 'Demonstrate how to "dump" a charge' },
        ],
      },
      {
        title: 'Transcutaneous Pacing',
        criteria: [
          { id: 'zoll-x-series-1198-0', label: 'Place hands-free pads on patient in proper position (anterior/posterior is preferred over anterior/anterior)' },
          { id: 'zoll-x-series-1199-1', label: 'Put monitor in pacing mode' },
          { id: 'zoll-x-series-1200-2', label: 'Set the rate dial to an age appropriate rate' },
          { id: 'zoll-x-series-1201-3', label: 'Demonstrates how to change the energy setting' },
          { id: 'zoll-x-series-1202-4', label: 'State how to determine if the patient is successfully being paced' },
          { id: 'zoll-x-series-1203-5', label: 'Discuss the "pause" function' },
          { id: 'zoll-x-series-1204-6', label: 'Turn pacer function off' },
        ],
      },
    ],
    criticalFailures: [],
  },
]

const BY_ID = new Map(AEMT_SKILL_SHEETS.map((s) => [s.id, s]))

export function skillSheet(id: string): AemtSkillSheet | undefined {
  return BY_ID.get(id)
}

/**
 * Sheets an AEMT student is checked off on: the advanced skills the credential
 * adds. Excludes both the EMT-level skills the student already holds and
 * anything above AEMT scope.
 */
export function sheetsForAemt(): AemtSkillSheet[] {
  return AEMT_SKILL_SHEETS.filter((s) => SKILL_SCOPE[s.id] === 'advanced')
}

export function sheetsByScope(scope: SkillScope): AemtSkillSheet[] {
  return AEMT_SKILL_SHEETS.filter((s) => SKILL_SCOPE[s.id] === scope)
}

/** Every monitor sheet, for the course setup picker. */
export const MONITOR_SHEETS = AEMT_SKILL_SHEETS.filter((s) => s.equipmentGroup === 'monitor')

/**
 * The advanced sheets for one course: the common set, plus only the monitor
 * that operation actually runs. A course with no monitor selected shows none,
 * rather than checking a student off on hardware they will never touch.
 */
export function sheetsForCourse(monitorSheetId: string | undefined): AemtSkillSheet[] {
  return sheetsForAemt().filter(
    (s) => s.equipmentGroup !== 'monitor' || s.id === monitorSheetId,
  )
}

/** Total gradeable criteria on a sheet. */
export function criterionCount(sheet: AemtSkillSheet): number {
  return sheet.sections.reduce((n, sec) => n + sec.criteria.length, 0)
}
