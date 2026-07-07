import { esc } from './docGen'
import { CREDENTIAL_LABELS } from '../../data/academy'
import { operationName } from '../../data/operations'
import type { Trainee } from '../../types'

// ---------------------------------------------------------------------------
// New-hire compliance & skills forms, transcribed from the AMR / GMR source
// documents. Each generator pre-fills the trainee's name, operation, and
// employee number where the form asks for them; medical/private fields (SSN,
// DOB) are always left blank for the hire to complete on paper. The EVOC and
// Safe Stretcher Handling forms pre-mark "new hire orientation program".
// ---------------------------------------------------------------------------

const line = (width = 220, value = '') =>
  `<span style="display:inline-block;border-bottom:1px solid #333;min-width:${width}px">&nbsp;${esc(value)}&nbsp;</span>`

const CHECKED = '☒'
const UNCHECKED = '☐'

const sigRow = (label: string) =>
  `<p class="sig">${esc(label)}: <span>&nbsp;</span> Date <span style="min-width:110px">&nbsp;</span></p>`

function positionOf(t: Trainee): string {
  return `${CREDENTIAL_LABELS[t.credential]}${t.employment ? ` — ${t.employment === 'ft' ? 'Full-Time' : 'Per Diem'}` : ''}`
}

// ----- Hepatitis B Registration / Refusal (Attachment A) --------------------

export function hepBStatementHTML(t: Trainee): string {
  const choices = [
    'I have not received the hepatitis B vaccination series prior to my AMR hire date and I would like to begin the series. (All expenses covered by AMR, do not sign declination)',
    'I have not received the hepatitis B vaccination series prior to my AMR hire date and I have made an informed choice to refuse the vaccination. *You must sign the refusal below.*',
    'I am currently in the process of completing the hepatitis B vaccination series from another provider [sign declination below].',
    'I have already completed the hepatitis B vaccination series [sign declination below].',
  ]
  return `
    <h1>Attachment A: Employee Hepatitis B Registration / Refusal Form</h1>
    <h2>Employee Information</h2>
    <table class="meta">
      <tr><td><strong>Employee Name</strong> ${line(240, t.name)}</td>
          <td><strong>Job Title</strong> ${line(180, positionOf(t))}</td></tr>
      <tr><td><strong>Primary County / Dept. of AMR Employment</strong> ${line(180, operationName(t.operation))}</td>
          <td><strong>Secondary County of AMR Employment (if any)</strong> ${line(140)}</td></tr>
      <tr><td><strong>SSN:</strong> ${line(60)} — ${line(40)} — ${line(60)}</td>
          <td><strong>Date of Birth:</strong> ${line(50)} / ${line(50)} / ${line(60)}</td></tr>
      <tr><td colspan="2"><strong>Contact Telephone #:</strong> ( ${line(50)} ) ${line(160)} &nbsp; home / work / cell / other</td></tr>
    </table>
    <div class="note">&gt;&gt; Please read the following statements carefully and place an X in the most appropriate box.</div>
    <table>${choices.map((c) => `<tr><td class="slot" style="font-size:16px">${UNCHECKED}</td><td>${esc(c)}</td></tr>`).join('')}</table>
    <h2>REFUSAL of AMR-Paid Hepatitis B Vaccination Series</h2>
    <p>I understand that due to my occupational exposure to blood or other potentially infectious materials I may be at risk of acquiring hepatitis B (HBV) infection. I have been given the opportunity to be vaccinated with hepatitis B vaccine, at no charge to myself. However, I decline hepatitis B vaccination at this time. I understand that by declining the vaccine, I continue to be at risk of acquiring hepatitis B, a serious disease. If in the future I continue to have occupational exposure to blood or other potentially infectious materials and I want to be vaccinated with hepatitis B vaccine, I can receive the vaccination series at no cost to me.</p>
    <p><strong>Signature indicating my refusal (if applicable):</strong></p>
    ${sigRow('Signature')}
    <p style="margin-top:16px">I hereby certify that AMR has explained the benefits of Hepatitis B vaccination and I understand that I can seek further information from my supervisor at any time.</p>
    ${sigRow('Signature')}
    <p class="sub">(Mandatory for all)</p>`
}

// ----- PPD / Mantoux Skin Test (SRM #1215) -----------------------------------

export function ppdFormHTML(t: Trainee): string {
  return `
    <h1>AMR TB Exposure Prevention &amp; Skin Testing Policy</h1>
    <p class="sub">Mantoux Skin Test — Intermediate Tuberculin Purified Protein Derivative (PPD) · SRM #1215</p>
    <p><strong>Print Name</strong> ${line(320, t.name)}</p>
    <p><strong>Social Security #</strong> ${line(300)}<br/><em>OSHA requires social security numbers on this medical record.</em></p>
    <p>Tuberculosis (TB) poses an occupational health threat. While TB is usually treatable, some forms are multi-drug resistant (MDR-TB). This disease is an airborne pathogen and is spread from one person to another through the air.</p>
    <p>To protect yourself, use an N-95 respirator that you were fit tested for. Also, get a Mantoux skin test for early detection of the disease. Paramedics, EMTs and Transportation Service Personnel should receive a Mantoux test every year.</p>
    <p>According to OSHA's Standard Interpretation Letter dated September 23, 1997, "OSHA does not require that employees participate in TB skin testing". If you decline the offer, you must sign the declination statement below.</p>
    <h2>Acceptance Statement</h2>
    <p>I accept the offer for free Mantoux Skin Test. The Mantoux is administered using intermediate tuberculin purified protein derivative (PPD). I understand that the test occurs in two visits. During the first visit, a small injection is made in the arm. A second visit is scheduled for 48 to 72 hours later. During the second visit, the PPD plant is examined and interpreted, and the results are documented.</p>
    <p>I consent to having the PPD planted during the first visit. I agree that I'm responsible for attending the second visit, as scheduled. I recognize that failure to attend the second visit precludes the opportunity to document test results.</p>
    ${sigRow('Employee Signature')}
    <h2>Administration Record</h2>
    <p><strong>PPD Manufacturer</strong> ${line(160)} <strong>Lot Number</strong> ${line(140)}</p>
    <p><strong>1st Visit — DATE Planted:</strong> ${line(110)} <strong>Site:</strong> ${line(160)}</p>
    <p><strong>Planted by:</strong> ${line(340)}</p>
    <p><strong>2nd Visit — DATE Examined and Interpreted:</strong> ${line(140)}</p>
    <p><strong>Results:</strong> ${line(380)}</p>
    <p><strong>Interpreted by:</strong> ${line(330)}</p>
    <h2>Declination Statement</h2>
    <p>Thank you for offering me a free Mantoux Skin (PPD) test. However, I decline the offer at this time. I will notify a supervisor if I decide to change my mind at a later date.</p>
    ${sigRow('Employee Signature')}`
}

// ----- Mask Fit Test Report ---------------------------------------------------

export function fitTestHTML(t: Trainee): string {
  const cb = (label: string) => `${UNCHECKED} ${esc(label)}`
  return `
    <h1>Mask Fit Test Report</h1>
    <p><strong>Employee Name</strong> ${line(260, t.name)} <strong>Kronos #</strong> ${line(120, t.employeeNumber ?? '')}</p>
    <p><strong>Fit Tester (print name)</strong> ${line(240)} <strong>Date</strong> ${line(110)}</p>
    <p><strong>Respirator Manufacturer and Model</strong> — NIOSH N95 — NIOSH N-95 approval # TC-21A0008A</p>
    <h2>Employee acknowledgement of familiarity with user instructions and certain limitations</h2>
    <p>I have read and understood the user instructions of the respirator, and will follow said user instructions every time I use the respirator. I acknowledge that this respirator protective device will not provide adequate protection when used under conditions other than specified or when user instructions are not followed.</p>
    ${sigRow('Employee Signature')}
    <h2>Fit Test</h2>
    <p><strong>Conditions which may affect respirator fit</strong> <em>(completed by conductor)</em></p>
    <p>${cb('Clean Shaven')} &nbsp; ${cb('1–2 day facial hair growth')} &nbsp; ${cb('2+ day facial hair growth')}<br/>
       ${cb('Moustache')} &nbsp; ${cb('Facial Scar')} &nbsp; ${cb('Dentures Absent')} &nbsp; ${cb('Glasses')} &nbsp; ${cb('None')}<br/>
       ${cb('Other')} ${line(260)}</p>
    <p><strong>Mask Size</strong> &nbsp; ${cb('Small')} &nbsp; ${cb('Regular')} &nbsp; ${cb('Other')} ${line(140)}</p>
    <p><strong>Fit Checks</strong><br/>
       Negative Pressure &nbsp; ${cb('Pass')} ${cb('Fail')} &nbsp;&nbsp; Positive Pressure &nbsp; ${cb('Pass')} ${cb('Fail')}</p>
    <p><strong>Fit Testing</strong> &nbsp; ${cb('Bitrex Solution Qualitative')} &nbsp; ${cb('Sweet Solution')}</p>
    <h2>Fit Test Result</h2>
    <p>The fit test procedure was conducted in fulfillment of OSHA's fit testing requirement of employees wearing half mask respirators (Code of Federal Regulations 29CFR1910.134 (e)(5)) and in accordance with American National Standard Institute practices for respirator protection, ANSI Z88.2-1992.</p>
    <p><strong>Pass</strong> ${line(90)} <strong>Fail</strong> ${line(90)}</p>
    <h2>Employee Acknowledgement of Test Result</h2>
    ${sigRow('Employee Signature')}
    ${sigRow('Test Conductor Signature')}`
}

// ----- EVOC Training Certificate (Ninth Brain) --------------------------------

function selectOneRows(rows: { label: string; checked?: boolean; star?: boolean }[]): string {
  return `<table><tr><th>Question</th><th class="slot">Select One</th></tr>
    ${rows
      .map(
        (r) =>
          `<tr><td>${esc(r.label)}</td><td class="slot" style="font-size:16px">${r.checked ? CHECKED : UNCHECKED}${r.star ? ' *' : ''}</td></tr>`,
      )
      .join('')}
  </table>`
}

function trainingHeader(t: Trainee, locationLabel: string): string {
  return `
    <table class="meta">
      <tr><td><strong>Completion Date:</strong> ${line(50)} / ${line(50)} / ${line(60)}</td>
          <td><strong>${esc(locationLabel)}:</strong> ${line(180)}</td></tr>
      <tr><td><strong>Employee Name:</strong> ${line(220, t.name)}</td>
          <td><strong>Employee Number:</strong> ${line(150, t.employeeNumber ?? '')}</td></tr>
      <tr><td colspan="2"><strong>Employee's Operation:</strong> ${line(240, operationName(t.operation))}</td></tr>
    </table>`
}

const DUAL_SIGN = `
    <p><em>By signing below, we confirm the training was successfully completed:</em></p>
    <table class="meta">
      <tr><td><strong>Print Instructor's Name:</strong> ${line(200)}</td><td><strong>Print Student's Name:</strong> ${line(200)}</td></tr>
      <tr><td><strong>Instructor Signature:</strong> ${line(200)}</td><td><strong>Student's Signature:</strong> ${line(200)}</td></tr>
      <tr><td><strong>Date:</strong> ${line(60)} / ${line(60)} / ${line(60)}</td><td><strong>Date:</strong> ${line(60)} / ${line(60)} / ${line(60)}</td></tr>
    </table>`

export function evocCertHTML(t: Trainee): string {
  return `
    <div class="note" style="text-align:center;font-weight:700">THIS DOCUMENT MUST BE UPLOADED INTO NINTH BRAIN ALONG WITH THE EVOC TRACK SKILL SHEET</div>
    <h1>EVOC Training Certificate — Ninth Brain</h1>
    ${trainingHeader(t, 'Training Location')}
    ${selectOneRows([
      { label: "Is this EVOC training part of the employee's new hire orientation program?", checked: true },
      { label: "Is this EVOC training refresher training of GMR's program?" },
      { label: 'Is this EVOC training part of a post incident remedial action plan?', star: true },
    ])}
    <p>* Please list the specific components of the training if it was part of a post incident remedial action plan:</p>
    <p>${line(660)}<br/>${line(660)}</p>
    <h2>How to access Ninth Brain in OKTA to upload EVOC training documents</h2>
    <ol>
      <li>Select <strong>GMR – Ninth Brain Chicklet</strong></li>
      <li>Select <strong>Manage Credentials</strong></li>
      <li>Select <strong>+ Add New</strong></li>
      <li>Select "Other" from the Credential drop down menu — "Other Credential" will appear</li>
      <li>Select Drop Down Arrow and scroll to <strong>"EVOC Emergency Vehicle Operations Course Certificate"</strong></li>
      <li>Enter Activation Date (Course Completion Date) — <strong>do not enter expiration date</strong></li>
      <li>Select "Browse" and attach the course documents</li>
      <li>Select <strong>Save &amp; Add</strong></li>
    </ol>
    <p><em>By signing below, we confirm the entire classroom, track training, and LMS Cornerstone EVOC Exam were successfully completed:</em></p>
    ${DUAL_SIGN.replace('<p><em>By signing below, we confirm the training was successfully completed:</em></p>', '')}`
}

// ----- EVOC Track Skill Sheet ---------------------------------------------------

interface TrackStation {
  name: string
  items: string[]
  comment?: string
}

const TRACK_STATIONS: TrackStation[] = [
  {
    name: 'SIX POINT | INTERSECTION',
    items: ['Speed Control', 'Braking', 'Steering (Pivot/Reference Point)', 'Cone Avoidance', 'Right Turn Forward', 'Left Turn Forward', 'Right Turn Backward', 'Left Turn Backward'],
    comment: 'Reviewed emergent traversing of intersections',
  },
  {
    name: 'T-BOX',
    items: ['Alignment (Vehicle Position)', 'Steering (Stop and Steer)', 'Backing (Policy Compliant)', 'Cone Avoidance', 'Right Turn Backward', 'Good Communication With Spotter'],
  },
  { name: 'FORWARD SERPENTINE', items: ['Speed', 'Braking', 'Steering (Pivot/Reference Point)', 'Cone Avoidance'] },
  { name: 'REVERSE SERPENTINE', items: ['Speed', 'Braking', 'Steering (Pivot/Reference Point)', 'Cone Avoidance'] },
  { name: 'CONTROLLED BRAKING', items: ['Speed', 'Reaction Time', 'Braking', 'Lane Changes', 'Cone Avoidance'] },
  { name: 'SAFE RESPONSE TO DIRECTIONS', items: ['Speed', 'Reaction Time', 'Braking', 'Lane Changes', 'Cone Avoidance'] },
  { name: 'DRAGON', items: ['Speed', 'Steering (Pivot/Reference Point)', "Follows Spotters Directions", 'Cone Avoidance'] },
  { name: 'DIMINISHING LANE', items: ['Speed', 'Braking', 'Cone Avoidance'] },
]

export function evocTrackSheetHTML(t: Trainee): string {
  const suCells = Array.from({ length: 8 }, () => '<td class="slot" style="width:22px">&nbsp;</td>').join('')
  const stationHtml = TRACK_STATIONS.map(
    (s) => `
    <table style="margin:8px 0">
      <tr>
        <th style="background:#111;color:#fff">${esc(s.name)}</th>
        ${['S', 'U', 'S', 'U', 'S', 'U', 'S', 'U'].map((h, i) => `<th class="slot" style="width:22px;background:#111;color:#fff" title="Run ${Math.floor(i / 2) + 1}">${h}</th>`).join('')}
        <th style="width:200px;background:#111;color:#fff">COMMENTS</th>
      </tr>
      ${s.items
        .map(
          (item, i) =>
            `<tr><td>- ${esc(item)}</td>${suCells}<td>${i === 0 && s.comment ? `<em>${esc(s.comment)}</em>` : '&nbsp;'}</td></tr>`,
        )
        .join('')}
      <tr><td colspan="9" style="text-align:right;border:none">&nbsp;</td><td><strong>Inst. Signature:</strong></td></tr>
    </table>`,
  ).join('')

  return `
    <div class="note" style="text-align:center;font-weight:700">THIS DOCUMENT MUST BE UPLOADED INTO NINTH BRAIN ALONG WITH THE EVOC TRAINING CERTIFICATE</div>
    <h1>EVOC Track Skill Sheet</h1>
    <p><strong>STUDENT:</strong> ${line(260, t.name)} &nbsp;&nbsp; <strong>DATE:</strong> ${line(130)}</p>
    <p class="sub">Columns are S / U per run — Run #1 · Run #2 · Run #3 · Run #4</p>
    ${stationHtml}
    <p><em>All students are required to briefly demonstrate shuffle steering.</em></p>
    <p><strong>Student Signature:</strong> ${line(240)} &nbsp;&nbsp; <strong>Overall:</strong> &nbsp; PASS &nbsp; / &nbsp; FAIL</p>
    <p><strong>Range Master (Print):</strong> ${line(220)} &nbsp;&nbsp; <strong>Range Master Signature:</strong> ${line(220)}</p>`
}

// ----- Safe Stretcher Handling (GMR v3.2) ---------------------------------------

const SSH_LEFT: [string, string[]][] = [
  ['Unloading the Stretcher', ['Performance Load / Side Locking Bar – Antler', 'PowerLoad™']],
  ['Traversing Slopes', []],
  ['Managing Moveable Hazards', []],
  ['Traversing Immoveable Hazards', []],
  ['Traversing Broken / Uneven Surfaces', []],
  ['Traversing Flat / Smooth Surfaces', []],
  ['Navigating Tight Turns / Pivot', []],
]

const SSH_RIGHT: [string, string[]][] = [
  ['Using the Stair Chair', ['Up', 'Down', 'StairTread™']],
  ['Stretcher Tip Recovery', []],
  ['Rotating / Lateral Movement', []],
  ['Loading the Stretcher', ['Performance Load / Side Locking Bar – Antler', 'PowerLoad™']],
]

function sshRows(groups: [string, string[]][]): string {
  return groups
    .map(([group, items]) => {
      if (items.length === 0) {
        return `<tr><td>${esc(group)}</td><td class="slot">${UNCHECKED}</td><td class="slot">${UNCHECKED}</td></tr>`
      }
      return (
        `<tr><td colspan="3" style="background:#f1f5f9;font-weight:700">${esc(group)}</td></tr>` +
        items.map((i) => `<tr><td style="padding-left:18px">${esc(i)}</td><td class="slot">${UNCHECKED}</td><td class="slot">${UNCHECKED}</td></tr>`).join('')
      )
    })
    .join('')
}

export function sshSheetHTML(t: Trainee): string {
  return `
    <h1>Safe Stretcher Handling Training</h1>
    <p class="sub">GMR Safe Stretcher Handling for Ground Operations · Training version 3.2</p>
    ${trainingHeader(t, 'Training Location')}
    ${selectOneRows([
      { label: "Is this training part of the employee's new hire orientation program?", checked: true },
      { label: "Is this training refresher training of GMR's program?" },
      { label: 'Is this training part of a post incident remedial action plan?', star: true },
    ])}
    <p>* Please list the specific components of the training if it is part of a post incident remedial action plan:</p>
    <p>${line(660)}<br/>${line(660)}</p>
    <div class="note">By initialing the box under "Pass", you are attesting that the employee has successfully demonstrated competency as outlined in the GMR Safe Stretcher Handling for Ground Operations Facilitator's Guide.</div>
    <table style="width:49%;display:inline-table;vertical-align:top">
      <tr><th>Station</th><th class="slot">Pass</th><th class="slot">Fail</th></tr>
      ${sshRows(SSH_LEFT)}
    </table>
    <table style="width:49%;display:inline-table;vertical-align:top">
      <tr><th>Station</th><th class="slot">Pass</th><th class="slot">Fail</th></tr>
      ${sshRows(SSH_RIGHT)}
    </table>
    <p><em>By signing below, we confirm the entire classroom and obstacle course training were successfully completed:</em></p>
    ${DUAL_SIGN.replace('<p><em>By signing below, we confirm the training was successfully completed:</em></p>', '')}`
}

// ----- registry -----------------------------------------------------------------

export interface ComplianceDoc {
  id: string
  label: string
  html: (t: Trainee) => string
}

export const COMPLIANCE_DOCS: ComplianceDoc[] = [
  { id: 'hepb', label: 'Hepatitis B registration / refusal', html: hepBStatementHTML },
  { id: 'ppd', label: 'PPD (Mantoux) skin test form', html: ppdFormHTML },
  { id: 'fittest', label: 'Mask fit test report', html: fitTestHTML },
  { id: 'evoc_cert', label: 'EVOC training certificate', html: evocCertHTML },
  { id: 'evoc_track', label: 'EVOC track skill sheet', html: evocTrackSheetHTML },
  { id: 'ssh', label: 'Safe stretcher handling (v3.2)', html: sshSheetHTML },
]
