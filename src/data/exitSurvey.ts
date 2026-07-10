// ---------------------------------------------------------------------------
// New Hire Orientation (exit) Survey — ported from the Field Guide site's
// standalone survey page. Question keys MUST stay exactly as they are: the
// Google Apps Script endpoint maps them to sheet columns by name.
// ---------------------------------------------------------------------------

/** Google Apps Script web-app endpoint collecting responses into Sheets. */
export const SURVEY_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxAUtgOCaEXbh-Uq42FLWzbFZi_5fXYtVIK0q8sJpvZmd2360_ujeO52zVjSlE0VXIuyw/exec'

export type SurveyQuestion =
  | { kind: 'text'; name: string; label: string; placeholder?: string; required?: boolean }
  | { kind: 'date'; name: string; label: string; required?: boolean }
  | { kind: 'select'; name: string; label: string; options: string[]; required?: boolean }
  | {
      kind: 'radio'
      name: string
      label: string
      options: string[]
      /** Short display labels when options are long (same order). */
      short?: string[]
      required?: boolean
      /** Amber callout shown above the options. */
      note?: string
      /** Render only when another answer has this value. */
      showIf?: { name: string; value: string }
    }
  | { kind: 'scale'; name: string; label: string; low: string; high: string; required?: boolean }
  | {
      kind: 'textarea'
      name: string
      label: string
      maxLength: number
      placeholder?: string
      hint?: string
      required?: boolean
      showIf?: { name: string; value: string }
    }

export interface SurveySection {
  title: string
  sub: string
  questions: SurveyQuestion[]
}

const YN = ['Yes', 'No']

export const SURVEY_SECTIONS: SurveySection[] = [
  {
    title: 'Orientation Details',
    sub: 'Basic information about you and your orientation period',
    questions: [
      { kind: 'text', name: 'fullName', label: 'Full Name', placeholder: 'First Last', required: true },
      { kind: 'text', name: 'employeeNumber', label: 'Employee Number', placeholder: 'e.g. 12345', required: true },
      { kind: 'select', name: 'certLevel', label: 'Certification Level', options: ['EMT', 'AEMT', 'Paramedic'], required: true },
      { kind: 'text', name: 'station', label: 'Unit Call Sign', placeholder: 'e.g. KC210, AD101, ME305' },
      { kind: 'date', name: 'orientationEndDate', label: 'Date of Most Recent Shift with FTO', required: true },
      {
        kind: 'radio',
        name: 'orientationLength',
        label: 'Number of Shifts with an FTO',
        options: ['1–3 shifts', '4–6 shifts', '7–10 shifts', '11–14 shifts', '15+ shifts'],
        short: ['1–3', '4–6', '7–10', '11–14', '15+'],
        required: true,
      },
    ],
  },
  {
    title: 'Orientation Program Experience',
    sub: 'Your overall experience and feedback on the program itself',
    questions: [
      { kind: 'scale', name: 'overallRating', label: 'Overall orientation experience rating', low: 'Poor', high: 'Excellent', required: true },
      {
        kind: 'textarea',
        name: 'overallExperience',
        label: 'How would you describe your overall experience in the orientation program?',
        placeholder: 'Describe your orientation experience...',
        maxLength: 1000,
        required: true,
      },
      {
        kind: 'textarea',
        name: 'growthAreas',
        label: 'In which areas do you feel you would like more opportunities for growth or challenge?',
        placeholder: 'e.g. airway management, cardiac calls, documentation...',
        maxLength: 800,
      },
      {
        kind: 'textarea',
        name: 'programImprovements',
        label: 'What could be improved about the orientation program?',
        placeholder: 'Any suggestions for making orientation better...',
        maxLength: 800,
      },
      {
        kind: 'radio',
        name: 'readinessLevel',
        label: 'Do you feel prepared to work independently after completing orientation?',
        options: ['Yes, fully prepared', 'Mostly prepared', 'Somewhat prepared', 'Not prepared'],
        required: true,
      },
      {
        kind: 'textarea',
        name: 'nextHireAdvice',
        label: 'What advice or comments would you like to share with the next person going through orientation?',
        placeholder: 'Any tips or advice for an incoming new hire...',
        maxLength: 800,
      },
    ],
  },
  {
    title: 'FTO Evaluation',
    sub: 'Feedback on your Field Training Officers',
    questions: [
      {
        kind: 'textarea',
        name: 'ftoList',
        label: 'Please list the FTOs you worked with during orientation',
        placeholder: "List each FTO's name, one per line...",
        maxLength: 400,
        required: true,
      },
      { kind: 'scale', name: 'ftoRating', label: 'Overall, how would you rate your FTOs’ preparedness and professionalism?', low: 'Poor', high: 'Excellent' },
      {
        kind: 'textarea',
        name: 'ftoStandout',
        label: 'Did any FTO stand out to you? If so, please explain why.',
        placeholder: 'Name and reason...',
        maxLength: 800,
      },
      {
        kind: 'textarea',
        name: 'ftoConstructiveFeedback',
        label: 'Share one piece of constructive feedback for an FTO you worked with.',
        hint: 'Please note which FTO the feedback is directed toward.',
        placeholder: 'FTO name and feedback...',
        maxLength: 800,
      },
      {
        kind: 'textarea',
        name: 'ftoOutstandingQualities',
        label: 'What qualities do you believe make an outstanding FTO?',
        placeholder: 'Describe the qualities...',
        maxLength: 800,
      },
    ],
  },
  {
    title: 'Operations & Policy',
    sub: 'Confirming what you were instructed on during orientation',
    questions: [
      { kind: 'radio', name: 'missingPcrComm', label: 'Do you understand how a missing PCR will be communicated to you?', options: YN, required: true },
      {
        kind: 'radio',
        name: 'pcrTransmission24hr',
        label: 'Are you aware that all PCRs must be transmitted within 24 hours of completing a call, as required by state law?',
        options: YN,
        required: true,
      },
      { kind: 'radio', name: 'pcrFinalizeVsPost', label: 'Do you know how to Finalize a PCR versus just Posting a PCR?', options: YN, required: true },
      { kind: 'radio', name: 'ePCROrientation', label: 'Were you oriented to the ePCR documentation system?', options: YN, required: true },
      {
        kind: 'radio',
        name: 'paperSignatures',
        label: 'Do you understand that if there is a computer issue, you are expected to collect paper signatures?',
        options: YN,
        required: true,
      },
      {
        kind: 'text',
        name: 'unitResponsibility',
        label: 'After orientation, who is ultimately responsible for ensuring the ambulance is prepared and ready to respond?',
        placeholder: 'Your answer...',
        required: true,
      },
      { kind: 'radio', name: 'cleanUnit', label: 'Were you instructed to wash and clean your assigned ambulance after every shift?', options: YN, required: true },
      {
        kind: 'radio',
        name: 'assignedEquipmentOnly',
        label: 'Were you instructed to only use equipment assigned to your shift unless directed otherwise by a supervisor?',
        options: YN,
        required: true,
      },
      {
        kind: 'radio',
        name: 'fluidChecks',
        label: 'Were you shown which fluids need to be checked on your unit and where to obtain more if needed?',
        options: YN,
        required: true,
      },
      { kind: 'radio', name: 'cotSwapping', label: 'Were you trained on cot swapping and using secure units?', options: YN, required: true },
      { kind: 'radio', name: 'truckSuppliesLocations', label: 'Were you shown the location of all required truck supplies and equipment?', options: YN, required: true },
      {
        kind: 'radio',
        name: 'ptoCallOff',
        label: 'Were you informed during orientation about how to request PTO or call off for an assigned shift?',
        options: YN,
        required: true,
      },
      { kind: 'radio', name: 'uniformConcerns', label: 'Do you have any questions or concerns about the uniform policy?', options: YN },
      {
        kind: 'textarea',
        name: 'uniformConcernDetail',
        label: 'Please describe your question or concern:',
        placeholder: 'Uniform policy question or concern...',
        maxLength: 400,
        showIf: { name: 'uniformConcerns', value: 'Yes' },
      },
      { kind: 'radio', name: 'fuelPin', label: 'Have you claimed your fuel pin number?', options: YN, required: true },
      { kind: 'radio', name: 'metSupervisor', label: 'Were you introduced to your operations supervisor or manager?', options: YN, required: true },
      {
        kind: 'radio',
        name: 'hrPortalAccess',
        label: 'Do you know how to access AMR employee resources (benefits portal, pay stubs, HR contact)?',
        options: YN,
        required: true,
      },
      { kind: 'radio', name: 'incidentReporting', label: 'Do you know the procedure for a reportable incident or on-duty injury?', options: YN, required: true },
    ],
  },
  {
    title: 'Knowledge Verification',
    sub: 'Confirming key operational knowledge from orientation',
    questions: [
      {
        kind: 'radio',
        name: 'blsNarcoticCheck',
        label: 'If you are assigned to a BLS truck with two EMTs, are you required to check and log narcotics?',
        note: '⚠️ Think carefully — this is a verification question.',
        options: YN,
        required: true,
      },
      {
        kind: 'textarea',
        name: 'ventOnBlsResponse',
        label: 'If you are on a BLS truck with two EMTs and there is a ventilator on the truck, what steps should you take?',
        placeholder: 'Describe what you would do...',
        maxLength: 600,
        required: true,
      },
      {
        kind: 'textarea',
        name: 'additionalQuestions',
        label:
          'Do you have any remaining questions or concerns about your role, responsibilities, or policies that were not addressed during orientation?',
        placeholder: 'Any outstanding questions or concerns...',
        maxLength: 800,
      },
    ],
  },
]

/** Flat list of every question, for validation and payload assembly. */
export function allQuestions(): SurveyQuestion[] {
  return SURVEY_SECTIONS.flatMap((s) => s.questions)
}
