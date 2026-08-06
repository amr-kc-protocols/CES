/* ============================================================================
 * necessity.js — the medical-necessity documentation rubric
 * ----------------------------------------------------------------------------
 * THIS IS THE FILE TO READ. Everything the tool concludes comes from here, and
 * it is written to be read by a biller or an educator, not only by a
 * programmer. Phrase banks are named constants at the top; each element states
 * its own rule and returns its own citation.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS SCORES, AND WHAT IT DOES NOT
 * ---------------------------------------------------------------------------
 * It scores THE RECORD. Not the transport, not the crew, not the patient.
 *
 * The tool never concludes that a transport was or was not medically
 * necessary. It has no way to know: it cannot see the patient, and the whole
 * problem it exists to solve is that the chart does not say. What it reports is
 * narrower and answerable — whether a claim reviewer reading this chart could
 * reach that conclusion, and if not, which question stopped them.
 *
 * "Not established" therefore means the documentation does not establish it.
 * A perfectly necessary ambulance transport can score badly here, and that is
 * the finding: the trip was justified and the record does not show it. That is
 * a coaching problem, which is what this tool is for.
 *
 * The rubric is the AMR Kansas City IFT Field Handbook's own, made mechanical:
 *
 *   "Why this patient needed an ambulance to get to this specific facility.
 *    Functional status: can the patient ambulate? Transfer? Sit upright?
 *    'Patient unable to...' is gold.
 *    Objective findings: vital signs, GCS, exam. Numbers beat adjectives.
 *    A claim reviewer with no medical training should understand from your
 *    narrative why a car wasn't enough."
 *
 * Those four sentences are ELEMENTS 1–4 below, in that order, and they carry
 * most of the weight. Elements 5–7 are supporting.
 *
 * ---------------------------------------------------------------------------
 * SCOPE: non-emergency interfacility transports.
 * ---------------------------------------------------------------------------
 * Emergency responses are graded far more leniently — the emergent-transport
 * review tool is where those belong, and a 911 chart run through this rubric
 * would be judged against questions nobody asks of it. See `inScope()`.
 * ==========================================================================*/

/* ---------------------------------------------------------------- phrasing */
/* Matching is on the narrative and on the structured fields, case-insensitive,
 * word-boundary anchored. Keyword matching reads what was WRITTEN — an unstated
 * fact is not detected, by design. That is the point of the tool. */

/** Functional status: the patient cannot do something. The handbook's "gold". */
const FUNCTIONAL_LIMITATION = [
  'unable to ambulate', 'unable to walk', 'cannot ambulate', 'cannot walk', 'does not ambulate',
  'non-ambulatory', 'nonambulatory', 'not ambulatory',
  'bed bound', 'bedbound', 'bed-bound', 'bedfast', 'bed confined', 'bed-confined',
  'unable to stand', 'cannot stand', 'unable to bear weight', 'non-weight bearing',
  'non weight bearing', 'nonweightbearing',
  'unable to sit', 'cannot sit', 'unable to sit upright', 'unable to tolerate sitting',
  'unable to maintain a seated', 'unable to maintain seated',
  'unable to transfer', 'cannot transfer', 'unable to self-transfer',
  'total assist', 'maximum assist', 'max assist', 'moderate assist', 'requires total lift',
  'assist x2', 'assist x 2', 'two person assist', '2 person assist', 'two-person assist',
  'assist x1', 'assist x 1', 'one person assist',
  'paralysis', 'paraplegic', 'quadriplegic', 'tetraplegic', 'hemiplegic', 'hemiparesis',
  'contracture', 'amputee', 'above knee amputation', 'below knee amputation',
];

/** How the patient was physically moved — corroborates the claim above. */
const TRANSFER_METHOD = [
  'draw sheet', 'drawsheet', 'draw-sheet',
  'slide board', 'sliding board', 'slideboard', 'transfer board',
  'hoyer', 'mechanical lift', 'patient lift', 'total lift',
  'pivot transfer', 'stand pivot', 'squat pivot',
  'two person lift', '2 person lift', 'two-person lift', 'four person lift', '4 person lift',
  'scoop stretcher', 'scoop', 'stair chair', 'reeves', 'carried', 'lifted to',
  'rolled to', 'log roll', 'logroll',
];

/**
 * Why a car, a wheelchair van, or a family member was not enough.
 *
 * This is the element most often missing entirely, and the one a claim
 * reviewer is most direct about. Grouped so the finding can name the reason
 * rather than just asserting one exists.
 */
const CONTRAINDICATION = {
  'explicit statement': [
    'would endanger', 'endanger the patient', 'contraindicated', 'medically contraindicated',
    'unsafe to transport by', 'unable to travel by car', 'unable to travel by private',
    'could not be transported by', 'requires stretcher', 'stretcher required',
    'stretcher is required', 'requires ambulance transport', 'wheelchair van not appropriate',
    'unable to be transported by wheelchair',
  ],
  'monitoring in transit': [
    'cardiac monitor', 'continuous monitoring', 'telemetry', 'continuous pulse ox',
    'continuous cardiac', 'requires monitoring', 'monitored en route', 'monitored during transport',
  ],
  'oxygen or airway': [
    'oxygen', 'o2 at', 'nasal cannula', 'non-rebreather', 'nonrebreather', 'nrb',
    'bipap', 'cpap', 'ventilator', 'vent-dependent', 'tracheostomy', 'trach',
    'advanced airway', 'intubated', 'airway management', 'suction', 'suctioning',
  ],
  'infusion or line in transit': [
    'iv infusion', 'iv running', 'iv fluids running', 'infusion pump', 'pca pump',
    'heparin drip', 'insulin drip', 'iv medication en route', 'blood transfusion',
    'transfusing', 'tpn', 'picc', 'central line',
  ],
  'behavioral or safety risk': [
    'restraints', 'restrained', 'combative', 'agitated', 'altered mental status',
    'requires 1:1', 'one to one', 'sitter', 'elopement risk', 'flight risk',
    'confused', 'disoriented', 'unable to follow commands',
  ],
  'fall or instability risk': [
    'fall risk', 'high fall risk', 'unsteady', 'unstable gait', 'syncope', 'syncopal',
    'seizure precautions', 'frequent falls',
  ],
  'isolation precautions': [
    'isolation', 'contact precautions', 'droplet precautions', 'airborne precautions',
    'mrsa', 'c. diff', 'c diff', 'cdiff', 'vre', 'covid positive',
  ],
  'required positioning': [
    'must remain flat', 'must remain supine', 'supine only', 'trendelenburg',
    'spinal precautions', 'spinal immobilization', 'traction', 'cannot sit upright',
    'head of bed', 'elevated 30', 'elevated at 30', 'prone positioning',
  ],
  'pain on movement': [
    'pain with movement', 'pain on movement', 'severe pain with', 'pain on transfer',
    'unable to tolerate movement', 'guarding with movement',
  ],
  'device or wound management': [
    'wound vac', 'wound v.a.c', 'chest tube', 'jackson-pratt', 'jp drain', 'drain in place',
    'ostomy', 'colostomy', 'peg tube', 'g-tube', 'foley', 'external fixator',
    'halo', 'open fracture', 'unstable fracture',
  ],
};

/**
 * Adjectives that assert a conclusion without a number behind it.
 *
 * The handbook's "numbers beat adjectives", made checkable. These are not
 * wrong to write — they are wrong to write ALONE. The finding fires only when
 * the chart carries no supporting objective data at all, never merely because
 * one of these words appears.
 */
const UNSUPPORTED_ADJECTIVE = [
  'stable', 'unremarkable', 'tolerated well', 'tolerated the transport well',
  'no acute distress', 'nad', 'wnl', 'within normal limits', 'uneventful',
  'no complaints', 'no changes', 'unchanged', 'no distress', 'resting comfortably',
  'in no apparent distress',
];

/** Why THIS facility. Specialty services a receiving site uniquely provides. */
const DESTINATION_REASON = {
  'specialty service': [
    'dialysis', 'hemodialysis', 'wound care', 'hyperbaric', 'cath lab',
    'cardiac catheterization', 'oncology', 'chemotherapy', 'radiation', 'infusion center',
    'psychiatric', 'behavioral health', 'inpatient rehab', 'ltac',
    'long term acute care', 'burn center', 'trauma center', 'stroke center',
    'interventional', 'endoscopy', 'surgery center', 'specialist',
  ],
  'level of care': [
    'higher level of care', 'lower level of care', 'not available at', 'unavailable at',
    'no beds at', 'unable to provide at', 'exceeds capability', 'step down',
  ],
  'continuity of care': [
    'continuity of care', 'primary physician', 'attending physician', 'physician request',
    'md request', 'doctor request', 'follows with', 'established care', 'prior admission',
    'returning to', 'return to facility', 'return to residence', 'discharge to',
  ],
  'nearest appropriate': ['nearest appropriate', 'closest appropriate', 'nearest facility able'],
  'scheduled treatment': [
    'scheduled appointment', 'scheduled treatment', 'standing order', 'recurring',
    'series of treatments', 'appointment at',
  ],
};

/**
 * Reasons that are administrative rather than clinical.
 *
 * Not automatically improper — a facility genuinely can request a transfer.
 * But standing ALONE, with no clinical reason recorded beside it, this is the
 * pattern that reads worst under review, so it is flagged rather than scored.
 */
const LOGISTICAL_ONLY = [
  'facility requested', 'per facility', 'facility request', 'bed available',
  'family request', 'family requested', 'patient request', 'patient requested',
  'per insurance', 'insurance', 'no other transport', 'wheelchair van unavailable',
  'van not available', 'convenience', 'per protocol', 'as requested',
];

/** ALS assessment or intervention — supports an ALS level of service. */
const ALS_CONTENT = [
  'cardiac monitor', '12 lead', '12-lead', 'ekg', 'ecg', 'iv established', 'iv started',
  'iv access', 'saline lock', 'medication administered', 'administered', 'advanced airway',
  'intubat', 'capnography', 'etco2', 'end tidal', 'als assessment', 'cardiac rhythm',
  'defibrillat', 'pacing', 'nebulizer', 'im injection', 'push',
];

/** Scheduled/recurring transports, where a PCS is normally expected. */
const SCHEDULED_MARKERS = [
  'dialysis', 'hemodialysis', 'scheduled', 'recurring', 'standing order',
  'series of treatments', 'appointment', 'routine transport', 'wound care',
  'chemotherapy', 'radiation',
];

/* ------------------------------------------------------------------ helpers */

const norm = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ');

/**
 * Join several possibly-absent fields for matching.
 *
 * Not cosmetic. `${rec.levelOfService}` on an absent field yields the literal
 * string "undefined", which is truthy — so an empty level of service read as
 * "recorded, and not ALS", and every ALS chart with no ALS content passed the
 * check it exists to fail.
 */
const join = (...parts) => parts.map((v) => String(v ?? '').trim()).filter(Boolean).join(' ');

/* --------------------------------------------------------------- negation */

/**
 * Words that negate what comes after them.
 *
 * Without this the tool read "no oxygen required and no cardiac monitor was
 * applied" as two documented reasons an ambulance was needed, and "patient is
 * not bed bound and is able to ambulate independently" as a documented
 * functional limitation. A chart that ruled out every necessity factor in
 * plain English — the clearest possible NOT-necessary record — scored 78 and
 * was told its documentation was good.
 *
 * This is a cut-down NegEx: look back from the match, inside its own clause,
 * for a trigger. Deliberately conservative, because the two errors are not
 * equal. Missing a negation credits a crew for something they ruled out, which
 * is how the tool told people the opposite of the truth. Over-negating costs a
 * "not documented" finding on something that was — recoverable, and visible to
 * the reviewer reading the citation.
 */
const NEGATION_TRIGGERS = [
  'no', 'not', 'non', 'without', 'denies', 'denied', 'denying', 'negative for',
  'free of', 'absent', 'absence of', 'never', 'none', 'nil', 'no evidence of',
  'no sign of', 'no signs of', 'no longer', 'ruled out', 'rules out', 'resolved',
  'does not', "doesn't", 'did not', "didn't", 'was not', "wasn't", 'is not',
  "isn't", 'are not', "aren't", 'were not', "weren't", 'will not', "won't",
  'unremarkable for', 'cleared of', 'declined', 'refused',
];

/**
 * Words that close a negation's scope before it reaches the phrase.
 *
 * "No history of falls BUT is currently a high fall risk" negates the first
 * half only. Without these, one early "no" would suppress everything after it
 * in a long sentence.
 */
const SCOPE_BREAKERS = ['but', 'however', 'although', 'though', 'except', 'other than', 'aside from', 'apart from', 'yet', 'still'];

/** How many words back a trigger can reach. Beyond this it is another thought. */
const NEGATION_WINDOW = 6;

/**
 * Values that mean "this did not apply", written after a label.
 *
 * ePCR exports are full of `label: value` pairs, and they reach the phrase
 * banks through the structured fields. Looking only backwards credited
 * "Oxygen: None" and "Restraints: N/A" as documented reasons an ambulance was
 * needed — the same error as the narrative case, arriving from the other side.
 */
const NEGATIVE_VALUE = /^[\s:;,\-–—]*(none|no|n\/a|na|not applicable|negative|denied|nil|absent|0)\s*[.;,)]?\s*$/;

function isNegated(hay, at, len) {
  // Back to the start of this clause — a negation never crosses a full stop.
  let start = at;
  while (start > 0 && !'.!?;\n'.includes(hay[start - 1])) start--;
  let clause = hay.slice(start, at);

  // A scope breaker cancels anything negated before it.
  for (const b of SCOPE_BREAKERS) {
    const i = clause.lastIndexOf(` ${b} `);
    if (i >= 0) clause = clause.slice(i + b.length + 2);
  }

  const words = clause.split(/[^a-z0-9']+/).filter(Boolean).slice(-NEGATION_WINDOW);
  const window = ` ${words.join(' ')} `;
  if (NEGATION_TRIGGERS.some((t) => window.includes(` ${t} `))) return true;

  // Then forwards, for the `label: value` case. Only the tail after the last
  // colon in this clause counts, so "Isolation precautions: none" is negated
  // while "Isolation precautions: contact (MRSA)" is not.
  let end = at + len;
  while (end < hay.length && !'.!?;\n'.includes(hay[end])) end++;
  const rest = hay.slice(at + len, end);
  const colon = rest.lastIndexOf(':');
  if (colon >= 0 && NEGATIVE_VALUE.test(rest.slice(colon + 1))) return true;
  return NEGATIVE_VALUE.test(rest);
}

/**
 * Index of the first affirmative, word-boundary-aligned occurrence, or -1.
 *
 * Scans every occurrence rather than only the first: "no cardiac monitor on
 * arrival. Cardiac monitor applied prior to departure." is a real chart, and
 * stopping at the first match would throw the second one away.
 */
function findPhrase(haystack, phrase) {
  const h = norm(haystack);
  const p = norm(phrase);
  if (!p) return -1;
  let i = h.indexOf(p);
  while (i >= 0) {
    const before = i === 0 ? ' ' : h[i - 1];
    const after = i + p.length >= h.length ? ' ' : h[i + p.length];
    const aligned = !/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after);
    if (aligned && !isNegated(h, i, p.length)) return i;
    i = h.indexOf(p, i + 1);
  }
  return -1;
}

/** Word-boundary-aware contains, ignoring anything the chart negates. */
function has(haystack, phrase) {
  return findPhrase(haystack, phrase) >= 0;
}

function hits(haystack, phrases) {
  return phrases.filter((p) => has(haystack, p));
}

/** The sentence a phrase appeared in — so every finding can show its evidence. */
function quote(text, phrase) {
  const t = String(text ?? '');
  // The affirmative occurrence, so the citation shows the sentence the finding
  // actually fired on rather than a negated mention earlier in the chart.
  const i = findPhrase(t, phrase);
  if (i < 0) return '';
  let start = i;
  while (start > 0 && !'.!?\n'.includes(t[start - 1])) start--;
  let end = i + phrase.length;
  while (end < t.length && !'.!?\n'.includes(t[end])) end++;
  const s = t.slice(start, Math.min(end + 1, t.length)).trim();
  return s.length > 260 ? s.slice(0, 257) + '…' : s;
}

/** Does the chart carry objective numbers at all? Backs the adjective rule. */
function hasObjectiveData(rec) {
  const vitals = (rec.vitals || []).filter(
    (v) => v.hr != null || v.sbp != null || v.rr != null || v.spo2 != null,
  );
  return { vitalSets: vitals.length, gcs: (rec.gcs || []).length, any: vitals.length > 0 };
}

/* ------------------------------------------------------------------- scope */

/**
 * Is this a non-emergency interfacility transport?
 *
 * Out-of-scope charts are still shown and still parsed — they are simply not
 * scored, because grading a 911 cardiac arrest against "did you record why a
 * car was not enough" produces a number that means nothing and would drag a
 * crew's average down for doing their job correctly.
 */
export function inScope(rec) {
  const mode = norm(rec.transportMode);
  // "Non-Emergent" contains "Emergent". Test for the negative first, or every
  // non-emergency transport — the entire population this tool exists for —
  // gets excluded as emergent.
  const emergent = /emergent/.test(mode) && !/non-?\s?emergent/.test(mode);

  // Facility first. "Nursing Home" contains "home", so a scene test that runs
  // ahead of the facility test throws out most of the sending facilities in a
  // typical IFT batch.
  const origin = norm(join(rec.originType, rec.originName));
  const facility =
    /facility|nursing|snf|hospital|clinic|dialysis|rehab|hospice|medical center|care center|assisted living|memory care|ltac/.test(origin);
  const scene = /scene|street|highway|roadway|public|residence|private home/.test(origin);

  if (emergent) return { inScope: false, why: 'Emergent transport — use the emergent review tool.' };
  if (!facility && scene) return { inScope: false, why: 'Scene response, not interfacility.' };
  return { inScope: true, why: '' };
}

/* ---------------------------------------------------------------- elements */

/**
 * The seven elements, in handbook order, with their weights.
 *
 * Weights are deliberate and total 100. Functional status and the
 * contraindication carry 45 between them because those two are what a denial
 * actually turns on; everything else is supporting detail that rarely stands
 * alone as a reason for refusal.
 */
export const ELEMENTS = [
  { id: 'functional', label: 'Functional status', weight: 25 },
  { id: 'contraindication', label: 'Why other transport was not an option', weight: 20 },
  { id: 'objective', label: 'Objective findings', weight: 15 },
  { id: 'destination', label: 'Why this facility', weight: 15 },
  { id: 'reason', label: 'Reason for transport', weight: 10 },
  { id: 'level', label: 'Level of service support', weight: 10 },
  { id: 'narrative', label: 'Narrative substance', weight: 5 },
];

const FULL = 'full';
const PARTIAL = 'partial';
const ABSENT = 'absent';
const CREDIT = { [FULL]: 1, [PARTIAL]: 0.5, [ABSENT]: 0 };

/* --- 1. functional status ------------------------------------------------ */
function elFunctional(rec, hay) {
  const limits = hits(hay, FUNCTIONAL_LIMITATION);
  const transfers = hits(hay, TRANSFER_METHOD);
  const moved = norm(join(rec.movedToAmbulance, rec.movedByMethod, rec.position));
  const structured = /stretcher|cot|carried|lifted|wheelchair|stair chair|scoop/.test(moved);
  const ambulatoryOnly = /ambulatory|walked|self/.test(moved) && !limits.length;

  if (limits.length) {
    return {
      status: FULL,
      detail: `The chart states what the patient could not do: ${limits.slice(0, 3).join(', ')}.`,
      cite: quote(hay, limits[0]),
      good: true,
    };
  }
  if (transfers.length || structured) {
    return {
      status: PARTIAL,
      detail:
        'How the patient was moved is recorded, but not what they were unable to do. A reviewer ' +
        'infers the limitation rather than reading it.',
      cite: transfers.length ? quote(hay, transfers[0]) : `Patient moved: ${join(rec.movedToAmbulance, rec.movedByMethod)}`,
      ask: 'Could this patient walk, transfer, or sit upright? Say so directly.',
    };
  }
  if (ambulatoryOnly) {
    return {
      status: ABSENT,
      detail:
        'The only movement recorded is ambulatory or self-transfer, with no limitation described. ' +
        'On its face this chart describes a patient who could have travelled another way.',
      cite: `Patient moved: ${join(rec.movedToAmbulance, rec.movedByMethod) || '(ambulatory)'}`,
      ask: 'If the patient was genuinely unable to travel otherwise, what stopped them?',
    };
  }
  return {
    status: ABSENT,
    detail: 'No functional status recorded anywhere in this chart.',
    cite: '',
    ask: 'Can the patient ambulate? Transfer? Sit upright? "Patient unable to…" is what a reviewer looks for.',
  };
}

/* --- 2. why other transport was not an option ---------------------------- */
function elContraindication(rec, hay) {
  const found = [];
  for (const [group, phrases] of Object.entries(CONTRAINDICATION)) {
    const h = hits(hay, phrases);
    if (h.length) found.push({ group, phrase: h[0], count: h.length });
  }
  const explicit = found.find((f) => f.group === 'explicit statement');

  if (explicit) {
    return {
      status: FULL,
      detail: `Stated directly, plus ${found.length - 1} supporting reason(s).`,
      cite: quote(hay, explicit.phrase),
      good: true,
    };
  }
  if (found.length >= 2) {
    return {
      status: FULL,
      detail: `Established by ${found.length} documented needs: ${found.map((f) => f.group).join(', ')}.`,
      cite: quote(hay, found[0].phrase),
      good: true,
    };
  }
  if (found.length === 1) {
    return {
      status: PARTIAL,
      detail: `One reason documented (${found[0].group}), never tied back to why a car or wheelchair van would not do.`,
      cite: quote(hay, found[0].phrase),
      ask: 'Connect it: what would have happened to this patient in a private vehicle?',
    };
  }
  return {
    status: ABSENT,
    detail:
      'Nothing in this chart distinguishes this transport from a wheelchair van or a family car.',
    cite: '',
    ask: 'A claim reviewer with no medical training should be able to tell from the narrative why a car was not enough.',
  };
}

/* --- 3. objective findings ----------------------------------------------- */
function elObjective(rec, hay) {
  const obj = hasObjectiveData(rec);
  const adjectives = hits(hay, UNSUPPORTED_ADJECTIVE);

  if (obj.vitalSets >= 2 && obj.gcs > 0) {
    return {
      status: FULL,
      detail: `${obj.vitalSets} sets of vitals and a documented mental status.`,
      cite: '',
      good: true,
    };
  }
  if (obj.vitalSets >= 1) {
    return {
      status: PARTIAL,
      detail:
        obj.gcs === 0
          ? `${obj.vitalSets} set(s) of vitals, but no mental status assessment recorded.`
          : `Only ${obj.vitalSets} set of vitals for a transport.`,
      cite: '',
      ask: 'A second set of vitals and a mental status show the patient was assessed, not just moved.',
    };
  }
  return {
    status: ABSENT,
    detail: adjectives.length
      ? `No objective data at all — the patient's condition rests on the word "${adjectives[0]}".`
      : 'No vital signs and no mental status recorded.',
    cite: adjectives.length ? quote(hay, adjectives[0]) : '',
    ask: 'Numbers beat adjectives. "Stable" is a conclusion; a blood pressure is evidence.',
  };
}

/* --- 4. why this facility ------------------------------------------------ */
function elDestination(rec, hay) {
  const stated = String(rec.destinationReason || '').trim();
  const found = [];
  for (const [group, phrases] of Object.entries(DESTINATION_REASON)) {
    if (hits(`${hay} ${stated}`, phrases).length) found.push(group);
  }

  if (!rec.destination) {
    return {
      status: ABSENT,
      detail: 'No destination recorded.',
      cite: '',
      ask: 'Where did this patient go, and why there?',
    };
  }
  if (found.length) {
    return {
      status: FULL,
      detail: `Destination and a reason for it: ${found.join(', ')}.`,
      cite: stated ? `Destination reason: ${stated}` : quote(hay, ''),
      good: true,
    };
  }
  if (stated) {
    return {
      status: PARTIAL,
      detail: `A destination reason is coded ("${stated}") but the narrative does not say what this facility provides that the sending one did not.`,
      cite: `Destination reason: ${stated}`,
      ask: 'What can they do there that could not be done where the patient was?',
    };
  }
  return {
    status: ABSENT,
    detail: `Destination recorded (${rec.destination}) with no reason for choosing it.`,
    cite: '',
    ask: 'Why this specific facility? Specialty service, continuity of care, or nearest appropriate — say which.',
  };
}

/* --- 5. reason for transport --------------------------------------------- */
function elReason(rec, hay) {
  const clinical = [];
  for (const [group, phrases] of Object.entries(DESTINATION_REASON)) {
    if (group === 'nearest appropriate') continue;
    if (hits(hay, phrases).length) clinical.push(group);
  }
  const logistical = hits(hay, LOGISTICAL_ONLY);
  const impression = String(rec.impression || '').trim();

  if (clinical.length && impression) {
    return { status: FULL, detail: `Clinical reason recorded (${impression}).`, cite: '', good: true };
  }
  if (impression || clinical.length) {
    return {
      status: PARTIAL,
      detail: impression
        ? `An impression is recorded (${impression}) but the narrative does not say what the transfer is meant to accomplish.`
        : 'A reason is implied but no primary impression is recorded.',
      cite: '',
      ask: 'What is this transfer for — a procedure, an admission, a return home?',
    };
  }
  if (logistical.length) {
    return {
      status: ABSENT,
      detail: `The only reason given is administrative: "${logistical[0]}".`,
      cite: quote(hay, logistical[0]),
      ask: 'A facility asking is not a clinical reason. What was wrong with the patient?',
    };
  }
  return {
    status: ABSENT,
    detail: 'No reason for the transport recorded.',
    cite: '',
    ask: 'Why is this patient being moved at all?',
  };
}

/* --- 6. level of service support ----------------------------------------- */
function elLevel(rec, hay) {
  const los = norm(join(rec.levelOfService, rec.serviceRequested));
  const alsBilled = /als|advanced|paramedic|specialty care|sct/.test(los) || /yes/i.test(rec.alsOnScene || '');
  const alsFound = hits(hay, ALS_CONTENT);

  if (!los) {
    return {
      status: PARTIAL,
      detail: 'Level of service not recorded, so it cannot be checked against what was done.',
      cite: '',
      ask: 'Record the level of service requested.',
    };
  }
  if (!alsBilled) {
    return { status: FULL, detail: `BLS level recorded (${join(rec.levelOfService, rec.serviceRequested)}).`, cite: '', good: true };
  }
  if (alsFound.length) {
    return {
      status: FULL,
      detail: `ALS level supported by documented assessment or intervention: ${alsFound.slice(0, 3).join(', ')}.`,
      cite: quote(hay, alsFound[0]),
      good: true,
    };
  }
  return {
    status: ABSENT,
    detail: 'ALS level of service with no ALS assessment or intervention documented anywhere in the chart.',
    cite: '',
    ask: 'What made this an ALS transport? A monitor, an IV, a 12-lead, a medication — record it.',
  };
}

/* --- 7. narrative substance ---------------------------------------------- */
function elNarrative(rec) {
  const n = String(rec.narrative || '').trim();
  const words = n ? n.split(/\s+/).length : 0;
  const dispatch = norm(rec.dispatchNature || '');
  const restatement = dispatch && words < 60 && norm(n).includes(dispatch);

  if (!n) {
    return { status: ABSENT, detail: 'No narrative.', cite: '', ask: 'The narrative is the only place the necessity argument can be made.' };
  }
  if (restatement) {
    return {
      status: ABSENT,
      detail: `The narrative largely restates the dispatch reason (${words} words).`,
      cite: n.slice(0, 200),
      ask: 'Say what you found and what you did, not what you were told before you arrived.',
    };
  }
  if (words < 60) {
    return {
      status: PARTIAL,
      detail: `Short narrative (${words} words) — usually too little to carry the necessity argument.`,
      cite: n.slice(0, 200),
      ask: 'Add functional status and why other transport was not an option.',
    };
  }
  return { status: FULL, detail: `${words}-word narrative.`, cite: '', good: true };
}

/* ------------------------------------------------------------- integrity */

/**
 * Findings about the RECORD rather than the necessity argument.
 *
 * These are not scored. They are the things that read worst under audit and
 * that a score would bury — a contradiction inside a chart is worse than a
 * gap, because a gap is an omission and a contradiction invites a question
 * about everything else in the record.
 */
function integrityFindings(rec, hay, allRows) {
  const out = [];
  const n = String(rec.narrative || '');

  // Narrative says ambulatory; the movement field says stretcher (or vice versa).
  const saysAmbulatory = hits(hay, ['ambulatory', 'ambulated', 'walked to', 'self-transferred']).length > 0;
  const saysLimited = hits(hay, FUNCTIONAL_LIMITATION).length > 0;
  const movedByStretcher = /stretcher|cot|carried|lifted|scoop|stair chair/i.test(
    join(rec.movedToAmbulance, rec.movedByMethod),
  );
  if (saysAmbulatory && movedByStretcher && !saysLimited) {
    out.push({
      id: 'ambulatory-vs-stretcher',
      label: 'Narrative says ambulatory, movement says stretcher',
      severity: 3,
      detail:
        'The chart describes an ambulatory patient and a stretcher transport with no limitation ' +
        'recorded between them. Whichever is right, the record contradicts itself.',
      cite: quote(n, 'ambulatory') || `Patient moved: ${join(rec.movedToAmbulance, rec.movedByMethod)}`,
    });
  }

  // "Stable" asserted with nothing objective anywhere in the chart.
  const adjectives = hits(hay, UNSUPPORTED_ADJECTIVE);
  const obj = hasObjectiveData(rec);
  if (adjectives.length && !obj.any && obj.gcs === 0) {
    out.push({
      id: 'adjective-only',
      label: 'Conclusion asserted with no objective data',
      severity: 2,
      detail: `"${adjectives[0]}" is the only description of the patient's condition, and there are no vitals or mental status to support it.`,
      cite: quote(n, adjectives[0]),
    });
  }

  // Administrative reason standing alone.
  const logistical = hits(hay, LOGISTICAL_ONLY);
  const anyClinical = Object.values(DESTINATION_REASON).some((p) => hits(hay, p).length);
  if (logistical.length && !anyClinical && !hits(hay, FUNCTIONAL_LIMITATION).length) {
    out.push({
      id: 'logistical-only',
      label: 'Administrative reason with no clinical reason beside it',
      severity: 3,
      detail: `The record gives "${logistical[0]}" and nothing clinical. This is the pattern that reads worst on review.`,
      cite: quote(n, logistical[0]),
    });
  }

  // ALS level with an empty ALS chart.
  const los = norm(join(rec.levelOfService, rec.serviceRequested));
  if (/als|advanced|paramedic|sct|specialty care/.test(los) && !hits(hay, ALS_CONTENT).length) {
    out.push({
      id: 'als-unsupported',
      label: 'ALS level with no ALS content',
      severity: 3,
      detail: 'An ALS level of service is recorded and nothing in the chart shows an ALS assessment or intervention.',
      cite: `Level of service: ${join(rec.levelOfService, rec.serviceRequested)}`,
    });
  }

  // Scheduled/recurring transport with no PCS reference.
  if (hits(hay, SCHEDULED_MARKERS).length && !rec.pcs) {
    out.push({
      id: 'pcs-missing',
      label: 'Scheduled transport with no PCS referenced',
      severity: 2,
      detail:
        'This reads as a scheduled or recurring transport and the chart does not reference a Physician Certification Statement. ' +
        'The PCS is a billing document rather than a crew one — this flag is a prompt to check that it exists, not a fault in the chart.',
      cite: '',
    });
  }

  // Copy-forward: near-identical narrative to another chart in this batch.
  if (allRows && n.length > 80) {
    const fingerprint = (s) => norm(s).replace(/[^a-z ]/g, '').split(' ').filter((w) => w.length > 3);
    const mine = new Set(fingerprint(n));
    for (const other of allRows) {
      if (!other || other.key === rec.__key || !other.record || other.record.incident === rec.incident) continue;
      const theirs = fingerprint(other.record.narrative || '');
      if (theirs.length < 15 || mine.size < 15) continue;
      const shared = theirs.filter((w) => mine.has(w)).length;
      const overlap = shared / Math.max(theirs.length, mine.size);
      if (overlap > 0.85) {
        out.push({
          id: 'copy-forward',
          label: 'Narrative nearly identical to another chart',
          severity: 3,
          detail: `${Math.round(overlap * 100)}% word overlap with incident ${other.record.incident || '(unknown)'}. Templated narratives are a standard audit trigger, because they cannot all be describing the same patient.`,
          cite: n.slice(0, 200),
        });
        break;
      }
    }
  }

  // Extraction failure — say so rather than scoring a chart we did not read.
  if (rec.completeness && rec.completeness.score < 0.75) {
    out.push({
      id: 'low-parse',
      label: 'Incomplete extraction',
      severity: 1,
      detail: `Only ${Math.round(rec.completeness.score * 100)}% of expected fields parsed. Verify against the source chart before acting on this score.`,
      cite: '',
    });
  }

  return out.sort((a, b) => b.severity - a.severity);
}

/* -------------------------------------------------------------- the bands */

export const BANDS = [
  { min: 85, id: 'defensible', label: 'Defensible', hint: 'A reviewer could follow the argument.' },
  { min: 70, id: 'thin', label: 'Thin', hint: 'Supports the claim but leaves questions open.' },
  { min: 50, id: 'at-risk', label: 'At risk', hint: 'Key elements missing.' },
  { min: 0, id: 'not-established', label: 'Not established', hint: 'The record does not show why an ambulance was required.' },
];

export function bandFor(score) {
  return BANDS.find((b) => score >= b.min) || BANDS[BANDS.length - 1];
}

/* -------------------------------------------------------------- evaluate */

const EVALUATORS = {
  functional: elFunctional,
  contraindication: elContraindication,
  objective: elObjective,
  destination: elDestination,
  reason: elReason,
  level: elLevel,
  narrative: (rec) => elNarrative(rec),
};

/**
 * Grade one chart's documentation.
 *
 * `allRows` is optional and used only for cross-chart checks (copy-forward).
 * Passing it is what turns a per-chart tool into an audit one.
 */
export function evaluate(rec, allRows = null) {
  const scope = inScope(rec);

  // Everything the phrase banks read. Structured fields are included so a crew
  // who records functional status in the right ImageTrend field rather than in
  // prose still gets credit for it.
  const hay = [
    rec.narrative, rec.impression, rec.destinationReason, rec.complaints,
    rec.dispatchNature, rec.movedToAmbulance, rec.movedByMethod, rec.position,
    rec.mobility, rec.levelOfService, rec.serviceRequested,
    (rec.medications || []).map((m) => m.text).join(' '),
  ].filter(Boolean).join('  \n  ');

  const elements = ELEMENTS.map((def) => {
    const result = EVALUATORS[def.id](rec, hay);
    return { ...def, ...result, earned: CREDIT[result.status] * def.weight };
  });

  const integrity = integrityFindings({ ...rec, __key: rec.__key }, hay, allRows);
  const score = scope.inScope
    ? Math.round(elements.reduce((sum, e) => sum + e.earned, 0))
    : null;

  // What a claim reviewer would ask, in the order the questions would land.
  const questions = elements
    .filter((e) => e.status !== FULL && e.ask)
    .sort((a, b) => b.weight - a.weight)
    .map((e) => ({ element: e.label, ask: e.ask, weight: e.weight, status: e.status }));

  return {
    scope,
    score,
    band: score == null ? null : bandFor(score),
    elements,
    integrity,
    questions,
    missing: elements.filter((e) => e.status === ABSENT).length,
    partial: elements.filter((e) => e.status === PARTIAL).length,
    strengths: elements.filter((e) => e.good).map((e) => e.label),
  };
}

/* --------------------------------------------------------------- trends */

/**
 * Aggregate by crew member, for coaching rather than for ranking.
 *
 * This is employment data about identifiable staff, and the ordering reflects
 * that: results are sorted by the element most often missed, not by a league
 * table of who scores worst. The useful output of this screen is "three people
 * never record functional status" — a class to teach — and not "here is your
 * bottom performer".
 */
export function crewTrends(rows) {
  const by = new Map();
  for (const row of rows) {
    if (!row.evaluation || row.evaluation.score == null) continue;
    const names = String(row.record.crew || '').split(/;|,/).map((s) => s.trim()).filter(Boolean);
    for (const name of names.length ? names : ['(crew not recorded)']) {
      if (!by.has(name)) by.set(name, { name, charts: 0, total: 0, missed: {} });
      const e = by.get(name);
      e.charts++;
      e.total += row.evaluation.score;
      for (const el of row.evaluation.elements) {
        if (el.status === ABSENT) e.missed[el.id] = (e.missed[el.id] || 0) + 1;
      }
    }
  }
  return [...by.values()]
    .map((e) => ({
      ...e,
      mean: Math.round(e.total / e.charts),
      worst: Object.entries(e.missed).sort((a, b) => b[1] - a[1])[0] || null,
    }))
    .sort((a, b) => b.charts - a.charts);
}

/** Which elements the whole sample misses most — the teaching list. */
export function elementGaps(rows) {
  const scored = rows.filter((r) => r.evaluation && r.evaluation.score != null);
  return ELEMENTS.map((def) => {
    const absent = scored.filter(
      (r) => (r.evaluation.elements.find((e) => e.id === def.id) || {}).status === ABSENT,
    ).length;
    const partial = scored.filter(
      (r) => (r.evaluation.elements.find((e) => e.id === def.id) || {}).status === PARTIAL,
    ).length;
    return { ...def, absent, partial, scored: scored.length, rate: scored.length ? absent / scored.length : 0 };
  }).sort((a, b) => b.rate - a.rate);
}

export const STATUS = { FULL, PARTIAL, ABSENT };
