// ---------------------------------------------------------------------------
// AEMT program evaluation forms (proposal §6).
//
// The four student-tracking instruments the program has to maintain besides
// the patient encounter log:
//   clinical-daily   preceptor evaluates the student, per clinical/field shift
//   preceptor-eval   student evaluates the preceptor, per shift
//   affective        professional behaviours, ongoing per student
//   instructor-eval  student evaluates an instructor, end of course
//   course-eval      student evaluates the course, end of course
//
// Defined as data so criteria can be edited without touching the renderer.
// The affective form follows the eleven professional behaviours in the
// National EMS Education Standards affective domain, which is what the
// CoAEMSP instrument is built on. AEMT courses are state-approved by KBEMS
// rather than CoAEMSP-accredited, so these are adopted for quality, not
// because an accreditor mandates this exact wording — edit freely.
// ---------------------------------------------------------------------------

export type FieldKind = 'scale' | 'yesno' | 'text' | 'longtext' | 'number'

export interface FormField {
  id: string
  label: string
  kind: FieldKind
  help?: string
  scale?: { min: number; max: number; minLabel: string; maxLabel: string }
}

export interface FormSection {
  title: string
  help?: string
  fields: FormField[]
}

export interface AemtFormDef {
  id: string
  title: string
  subtitle: string
  /** Who fills it in — shown on the form so the right person completes it. */
  completedBy: string
  /** 'shift' forms are logged repeatedly; 'course' forms once per student. */
  cadence: 'shift' | 'ongoing' | 'course'
  sections: FormSection[]
  /**
   * Drafted from the program's own description of the instrument, and not yet
   * signed off. Every one of the five started here, and the flag prints
   * "DRAFT INSTRUMENT" on the blank form and warns on the screen that fills it
   * in — which is right, and was also inescapable: `passthrough` carries the
   * flag through the template editor untouched, so a Program Manager who read
   * every line and published a version still got a draft. The review below is
   * how it comes off.
   */
  draft?: boolean
  /**
   * Who signed the instrument off, and when.
   *
   * The program's own note on these says they are adopted for quality rather
   * than mandated in this wording, so the sign-off is a real decision somebody
   * makes rather than a formality — and K.A.R. 109-17-3 retains what comes back
   * on them for three years, which is a long time to collect evidence on a form
   * nobody approved. Recorded on the instrument so it travels with the version
   * a record was assessed under.
   */
  reviewedBy?: string
  reviewedOn?: string
}

const S5 = { min: 1, max: 5, minLabel: 'needs work', maxLabel: 'excellent' }
const S3 = { min: 1, max: 3, minLabel: 'not yet', maxLabel: 'consistently' }

const scale = (id: string, label: string, s = S5): FormField => ({
  id,
  label,
  kind: 'scale',
  scale: s,
})

export const AEMT_FORMS: AemtFormDef[] = [
  // ----- 1. clinical / field daily evaluation --------------------------------
  {
    id: 'clinical-daily',
    title: 'Clinical / Field Daily Evaluation',
    subtitle: 'One per clinical or field internship shift',
    completedBy: 'Preceptor',
    cadence: 'shift',
    draft: true,
    sections: [
      {
        title: 'Shift',
        fields: [
          { id: 'site', label: 'Site / unit', kind: 'text' },
          { id: 'hours', label: 'Shift hours', kind: 'number' },
        ],
      },
      {
        title: 'Procedures',
        help: 'Attempts and successes this shift. The detail goes on the patient encounter log; this is the summary the Program Manager reviews.',
        fields: [
          { id: 'attempted', label: 'Procedures attempted', kind: 'number' },
          { id: 'successful', label: 'Procedures successful', kind: 'number' },
          {
            id: 'procedureNotes',
            label: 'Which procedures, and how they went',
            kind: 'longtext',
          },
        ],
      },
      {
        title: 'Performance',
        help: 'Rate what you observed. Skip anything the shift did not show.',
        fields: [
          scale('assessment', 'Patient assessment'),
          scale('skills', 'Psychomotor skill proficiency'),
          scale('patientComm', 'Communication with patients'),
          scale('teamComm', 'Communication with the team'),
          scale('documentation', 'Documentation'),
          scale('professionalism', 'Professionalism'),
          scale('safety', 'Scene and personal safety'),
        ],
      },
      {
        title: 'Overall',
        fields: [
          {
            id: 'satisfactory',
            label: 'Overall performance satisfactory for this stage of training?',
            kind: 'yesno',
          },
          { id: 'strengths', label: 'Strengths observed', kind: 'longtext' },
          { id: 'improve', label: 'Areas for improvement', kind: 'longtext' },
          {
            id: 'remedial',
            label: 'Remedial education indicated?',
            kind: 'yesno',
            help: 'Flags this shift for Program Manager follow-up.',
          },
          { id: 'preceptor', label: 'Preceptor name', kind: 'text' },
        ],
      },
    ],
  },

  // ----- 2. student's evaluation of the preceptor ----------------------------
  {
    id: 'preceptor-eval',
    title: 'Preceptor Evaluation',
    subtitle: 'Completed by the student about the preceptor, per shift',
    completedBy: 'Student',
    cadence: 'shift',
    draft: true,
    sections: [
      {
        title: 'Preceptor',
        fields: [
          { id: 'preceptor', label: 'Preceptor name', kind: 'text' },
          { id: 'site', label: 'Site / unit', kind: 'text' },
        ],
      },
      {
        title: 'This shift',
        fields: [
          scale('welcoming', 'Made me feel part of the crew'),
          scale('teaching', 'Explained reasoning, not just tasks'),
          scale('opportunity', 'Gave me appropriate hands-on opportunity'),
          scale('feedback', 'Gave useful feedback during the shift'),
          scale('supervision', 'Supervised safely and appropriately'),
        ],
      },
      {
        title: 'Comments',
        fields: [
          { id: 'bestPart', label: 'Most useful part of the shift', kind: 'longtext' },
          { id: 'concerns', label: 'Anything the program should know', kind: 'longtext' },
        ],
      },
    ],
  },

  // ----- 3. affective behaviours --------------------------------------------
  {
    id: 'affective',
    title: 'Affective Behavior Evaluation',
    subtitle: 'Professional behaviours — ongoing, at least once per student',
    completedBy: 'Instructor or preceptor',
    cadence: 'ongoing',
    draft: true,
    sections: [
      {
        title: 'Professional behaviours',
        help: '1 = not yet demonstrating · 2 = inconsistent · 3 = consistently demonstrates. These are the eleven behaviours in the National EMS Education Standards affective domain.',
        fields: [
          scale('integrity', 'Integrity — honest, complete and accurate documentation and report', S3),
          scale('empathy', 'Empathy — shows concern, responds appropriately to the emotions of others', S3),
          scale('motivation', 'Self-motivation — takes initiative, seeks improvement without prompting', S3),
          scale('appearance', 'Appearance and personal hygiene — professional dress and grooming', S3),
          scale('confidence', 'Self-confidence — knows and works within personal limitations', S3),
          scale('communications', 'Communications — speaks and writes clearly, listens actively', S3),
          scale('timeManagement', 'Time management — punctual, prepared, completes tasks on time', S3),
          scale('teamwork', 'Teamwork and diplomacy — supports the crew, handles conflict professionally', S3),
          scale('respect', 'Respect — polite and non-judgemental toward patients and colleagues', S3),
          scale('advocacy', 'Patient advocacy — places patient needs above personal or crew convenience', S3),
          scale('delivery', 'Careful delivery of service — thorough, follows procedure, corrects errors', S3),
        ],
      },
      {
        title: 'Summary',
        fields: [
          {
            id: 'concernRaised',
            label: 'Any behaviour requiring a documented conference?',
            kind: 'yesno',
            help: 'A score of 1 on any behaviour normally warrants one.',
          },
          { id: 'comments', label: 'Comments and examples', kind: 'longtext' },
          { id: 'evaluator', label: 'Evaluator name', kind: 'text' },
        ],
      },
    ],
  },

  // ----- 4. instructor evaluation -------------------------------------------
  {
    id: 'instructor-eval',
    title: 'Instructor Evaluation',
    subtitle: 'Completed by the student at the end of the course, one per instructor',
    completedBy: 'Student',
    cadence: 'course',
    draft: true,
    sections: [
      {
        title: 'Instructor',
        fields: [{ id: 'instructor', label: 'Instructor name', kind: 'text' }],
      },
      {
        title: 'Instruction',
        fields: [
          scale('knowledge', 'Knowledge of the subject matter'),
          scale('preparation', 'Preparation and organization'),
          scale('clarity', 'Explained material clearly'),
          scale('questions', 'Responsive to questions'),
          scale('available', 'Available outside class when needed'),
          scale('fairness', 'Evaluated students fairly'),
          scale('professionalism', 'Professionalism and respect toward students'),
        ],
      },
      {
        title: 'Comments',
        fields: [
          { id: 'worked', label: 'What worked well', kind: 'longtext' },
          { id: 'improve', label: 'What could be improved', kind: 'longtext' },
        ],
      },
    ],
  },

  // ----- 5. final course evaluation -----------------------------------------
  {
    id: 'course-eval',
    title: 'Final Course Evaluation',
    subtitle: 'Completed by the student at the end of the course',
    completedBy: 'Student',
    cadence: 'course',
    draft: true,
    sections: [
      {
        title: 'The course',
        fields: [
          scale('objectives', 'The course met its stated objectives'),
          scale('sequence', 'Content was sequenced in a way that made sense'),
          scale('materials', 'Textbook and online materials were useful'),
          scale('pace', 'Pace was appropriate alongside full-time work'),
        ],
      },
      {
        title: 'Lab, clinical and field',
        fields: [
          scale('labTime', 'Enough hands-on lab time to become competent'),
          scale('equipment', 'Equipment was adequate and in working order'),
          scale('clinical', 'Hospital clinical rotations were valuable'),
          scale('field', 'Field internship shifts were valuable'),
          scale('preceptors', 'Preceptors were prepared to teach'),
          {
            id: 'minimumsAchievable',
            label: 'Were the required clinical minimums achievable in the shifts scheduled?',
            kind: 'yesno',
          },
        ],
      },
      {
        title: 'Outcome',
        fields: [
          scale('prepared', 'I feel prepared for the National Registry exam'),
          scale('practice', 'I feel prepared to practise as an AEMT'),
          {
            id: 'recommend',
            label: 'Would you recommend this course to another EMT?',
            kind: 'yesno',
          },
          { id: 'best', label: 'Most valuable part of the course', kind: 'longtext' },
          { id: 'change', label: 'One thing you would change', kind: 'longtext' },
        ],
      },
    ],
  },
]

const BY_ID = new Map(AEMT_FORMS.map((f) => [f.id, f]))

export function aemtForm(id: string): AemtFormDef | undefined {
  return BY_ID.get(id)
}

export function formFields(def: AemtFormDef): FormField[] {
  return def.sections.flatMap((s) => s.fields)
}
