// ---------------------------------------------------------------------------
// Clinical skill sheet definitions, transcribed from the Microsoft Forms
// versions. KC and Cass share the BLS clinical skills assessment; Linn County
// paramedics use their own step-by-step sheet. Keep the two consistent with
// their operations — do not merge them.
// ---------------------------------------------------------------------------

export interface SkillDef {
  id: string
  label: string
  /** Linn sheet only: the observable steps the FTO checks off. */
  steps?: string[]
}

/** BLS Clinical Skills Assessment — every KC / Cass hire. */
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
    "id": "truck_equipment_location_check",
    "label": "Truck Equipment Location Check"
  },
  {
    "id": "truck_fluid_check",
    "label": "Truck Fluid Check"
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

/** Linn County paramedic skill sheet — step-by-step sign-off. */
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
    "id": "rapid_sequence_intubation_rsi",
    "label": "Rapid Sequence Intubation (RSI)",
    "steps": [
      "Pre-oxygenate the patient",
      "Give fentanyl (pain), midazolam (sedation), and vecuronium (paralysis)",
      "Intubate as above"
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
