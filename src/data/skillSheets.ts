// ---------------------------------------------------------------------------
// Clinical skill sheet definitions, transcribed from the Microsoft Forms
// versions. The BLS assessment applies to EVERY hire regardless of operation
// or credential; the ALS paramedic sheet applies to every paramedic, with a
// per-operation difference: Linn County medics do RSI (KC/Cass do not), and
// KC/Cass medics do ventilator procedures (Linn does not) — the `ops` field
// scopes those skills.
// ---------------------------------------------------------------------------

import type { OperationId } from '../types'

export interface SkillDef {
  id: string
  label: string
  /** Step-style sheets: the observable steps the FTO checks off. */
  steps?: string[]
  /** Operations this skill applies to. Absent = every operation. */
  ops?: OperationId[]
}

/** BLS Clinical Skills Assessment — every hire, every operation. */
export const BLS_SKILLS: SkillDef[] = [
  {
    "id": "lifepak_15_vitals_monitoring",
    "label": "Lifepak 15 Vitals Monitoring"
  },
  {
    "id": "aed_use",
    "label": "AED Use"
  },
  {
    "id": "blood_glucose_assessment",
    "label": "Blood Glucose Assessment"
  },
  {
    "id": "i_gel_placement",
    "label": "I-Gel Placement"
  },
  {
    "id": "iv_tubing_setup",
    "label": "IV Tubing Setup"
  },
  {
    "id": "manual_blood_pressure",
    "label": "Manual Blood Pressure"
  },
  {
    "id": "lung_auscultation",
    "label": "Lung Auscultation"
  },
  {
    "id": "xd_cuff_restraints",
    "label": "XD Cuff Restraints"
  },
  {
    "id": "flow_safe_ii_disposable_bilevel_cpap",
    "label": "Flow Safe II Disposable Bilevel CPAP"
  },
  {
    "id": "oxygen_delivery_devices_nc_nrb_etc",
    "label": "Oxygen Delivery Devices (NC, NRB, etc.)"
  },
  {
    "id": "radio_biocom_to_emergency_department_pulsara_app",
    "label": "Radio Biocom to Emergency Department - Pulsara App"
  },
  {
    "id": "tourniquet_application",
    "label": "Tourniquet Application"
  },
  {
    "id": "ventilator_setup",
    "label": "Ventilator Setup"
  }
]

/** ALS paramedic skill sheet — step-by-step sign-off, every paramedic. */
export const LINN_MEDIC_SKILLS: SkillDef[] = [
  {
    "id": "lifepak_15_manual_defibrillation",
    "label": "LIFEPAK 15 - Manual Defibrillation",
    "steps": [
      "Turn on the device",
      "Apply gel or electrodes to the patient",
      "Confirm cardiac arrest",
      "Select energy level",
      "Charge the device",
      "Make sure everyone is clear",
      "Press both shock buttons to deliver the shock"
    ]
  },
  {
    "id": "lifepak_15_synchronized_cardioversion",
    "label": "LIFEPAK 15 - Synchronized Cardioversion",
    "steps": [
      "Turn on the device",
      "Attach ECG electrodes",
      "Press SYNC to activate sync mode",
      "Confirm sync markers on R-waves",
      "Select energy level",
      "Charge the device",
      "Make sure everyone is clear",
      "Press the shock button to deliver the synchronized shock"
    ]
  },
  {
    "id": "lifepak_15_noninvasive_pacing",
    "label": "LIFEPAK 15 - Noninvasive Pacing",
    "steps": [
      "Turn on the device",
      "Apply pacing electrodes",
      "Press PACER to start pacing mode",
      "Set heart rate and current",
      "Check patient response and adjust as needed"
    ]
  },
  {
    "id": "endotracheal_intubation",
    "label": "Endotracheal Intubation",
    "steps": [
      "Pre-oxygenate the patient",
      "Position the head ('sniffing' position)",
      "Insert laryngoscope and find vocal cords",
      "Insert the tube through the cords",
      "Confirm placement (capnography and listening)"
    ]
  },
  {
    "id": "analgesic_medication_administration",
    "label": "Analgesic Medication Administration",
    "steps": [
      "Confirm indication for analgesic administration",
      "Check for contraindications and allergies",
      "Select appropriate medication (narcotic or non-narcotic)",
      "Calculate and verify correct dosage",
      "Prepare medication and equipment",
      "Explain procedure and obtain consent",
      "Administer medication via correct route",
      "Monitor patient response and vital signs",
      "Document medication, dose, route, and patient response"
    ]
  },
  {
    "id": "i_gel_supraglottic_airway_placement_adult",
    "label": "i-gel Supraglottic Airway Placement (Adult)",
    "steps": [
      "Use if intubation isn’t possible",
      "Don’t use if gag reflex is present or there’s a blockage below the glottis",
      "Pick i-gel size by weight: Size 3: 30–60 kg, Size 4: 50–90 kg, Size 5: 90+ kg",
      "Lubricate the i-gel"
    ]
  },
  {
    "id": "i_gel_supraglottic_airway_placement_pediatric",
    "label": "i-gel Supraglottic Airway Placement (Pediatric)",
    "steps": [
      "Use if intubation isn’t possible",
      "Don’t use if gag reflex is present or there’s a blockage below the glottis",
      "Pick i-gel size by weight: Size 1: 2–5 kg, Size 1.5: 5–12 kg, Size 2: 10–25 kg, Size 2.5: 25–35 kg",
      "Lubricate the i-gel"
    ]
  }
]

// Time-intensive advanced-airway sheets, split out of the core ALS sheet so
// each can be run as its own dedicated station. RSI is Linn County only;
// Ventilator Management is KC/Cass only (kept as `ops` for defense — a wrong-
// operation medic reaching the sheet directly sees no applicable skills).

/** Rapid Sequence Intubation — Linn County paramedics. */
export const RSI_SKILLS: SkillDef[] = [
  {
    "id": "rapid_sequence_intubation_rsi",
    "label": "Rapid Sequence Intubation (RSI)",
    "ops": ["linn"],
    "steps": [
      "Pre-oxygenate the patient",
      "Give fentanyl (pain), midazolam (sedation), and vecuronium (paralysis)",
      "Intubate: position, laryngoscopy, tube through the cords",
      "Confirm placement (waveform capnography and auscultation)",
      "Secure the tube and set post-intubation sedation/analgesia"
    ]
  }
]

/** Ventilator Management (LTV 1200) — KC / Cass paramedics. */
export const VENT_SKILLS: SkillDef[] = [
  {
    "id": "ventilator_management",
    "label": "Ventilator Management (LTV 1200)",
    "ops": ["kc", "cass"],
    "steps": [
      "Confirm indication and settings order (mode, rate, tidal volume, FiO2, PEEP)",
      "Assemble and attach the circuit; run the device check",
      "Set mode and dial in ordered settings",
      "Verify chest rise, breath sounds, SpO2, and waveform capnography",
      "Respond to alarms using DOPE (Displacement, Obstruction, Pneumothorax, Equipment)",
      "Document settings and patient response"
    ]
  }
]
