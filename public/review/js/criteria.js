/* ============================================================================
 * criteria.js — deterministic criteria engine
 * ----------------------------------------------------------------------------
 * DESIGN CONTRACT
 *
 * This file assigns NO clinical judgement score. It answers only the question
 * "which explicitly-defined thresholds does this record cross, and where in the
 * record is the evidence?" A human assigns the 1-5 justification score.
 *
 * Every criterion below therefore carries:
 *   - a stated threshold, in the same units as the chart
 *   - the value(s) that tripped it
 *   - a `cite` string pointing at the field or timestamp it came from
 *
 * That traceability is the whole point: a flag a reviewer cannot check is a
 * flag they cannot defend. Thresholds are ADULT defaults and are overridable
 * at runtime (see DEFAULT_THRESHOLDS / applyThresholds) because they belong to
 * the medical director, not to this file.
 * ==========================================================================*/

export const DEFAULT_THRESHOLDS = {
  spo2Low: 90,          // %  — hypoxia
  spo2Critical: 85,     // %
  sbpLow: 90,           // mmHg
  mapLow: 65,           // mmHg — perfusion floor
  hrHigh: 120,          // bpm
  hrLow: 50,            // bpm
  rrHigh: 24,           // /min
  rrLow: 10,            // /min
  gcsLow: 13,           // <= is abnormal
  gcsCritical: 8,       // <= is airway-threatening
  sbpSevereHtn: 180,    // mmHg
  dbpSevereHtn: 110,    // mmHg
  glucoseHigh: 400,     // mg/dL
  glucoseLow: 60,       // mg/dL
  tempHigh: 38.0,       // C
  tempLow: 36.0,        // C
  minVitalSets: 3,      // expected sets for a transport of any length
  pedsAgeMax: 17,       // years
};

/* ---------------------------------------------------------------------------
 * Keyword vocabularies
 * -------------------------------------------------------------------------*/

const RX = {
  timeCritical: [
    [/\bSTEMI\b|ST[- ]elevation/i, 'STEMI'],
    [/subarachnoid|intracranial h|\bICH\b|intracerebral/i, 'Intracranial hemorrhage'],
    [/\bCVA\b|\bstroke\b|cerebrovascular/i, 'Stroke'],
    [/\bsepsis\b|septic/i, 'Sepsis'],
    [/\bDKA\b|ketoacidosis/i, 'DKA'],
    [/aortic (dissection|aneurysm)|\bAAA\b/i, 'Aortic emergency'],
    [/\bG\.?I\.? bleed|gastrointestinal (bleed|hemorrhage)|hematemesis|melena|coffee[- ]ground/i, 'Active GI hemorrhage'],
    [/anaphyla/i, 'Anaphylaxis'],
    [/status epilepticus/i, 'Status epilepticus'],
    [/\bcardiac arrest\b|\bROSC\b/i, 'Cardiac arrest / ROSC'],
    [/ectopic/i, 'Suspected ectopic pregnancy'],
    [/aneurysm/i, 'Aneurysm'],
  ],
  airway: [
    [/\bintubat|\bETT\b|endotracheal/i, 'Intubated'],
    [/ventilator|mechanically ventilat/i, 'Ventilator-dependent'],
    [/\bBVM\b|bag valve|bagging/i, 'Bag-valve ventilation'],
    [/\bBiPAP\b|\bCPAP\b|non-?invasive ventilat/i, 'Non-invasive ventilation'],
    [/\bapnei|not breathing|respiratory arrest/i, 'Apnea / respiratory arrest'],
    [/\bOPA\b|\bNPA\b|oropharyngeal airway|nasopharyngeal airway/i, 'Basic airway adjunct'],
  ],
  highRiskTherapy: [
    [/amiodarone|lidocaine drip|antiarrhythmic/i, 'Antiarrhythmic infusion'],
    [/norepinephrine|levophed|epinephrine drip|dopamine|vasopressor|pressor/i, 'Vasopressor infusion'],
    [/\bdrip\b|infusion pump|titrat/i, 'Active infusion'],
    [/defibrillat|shocked|cardiovert/i, 'Defibrillation / cardioversion'],
    [/blood product|\bPRBC\b|transfus/i, 'Blood products'],
    [/heparin|plavix|eliquis|apixaban|warfarin|anticoagulat/i, 'Anticoagulated'],
  ],
  endOrgan: [
    [/visual (disturb|loss|change)|blurred vision/i, 'Visual symptoms'],
    [/chest pain/i, 'Chest pain'],
    [/altered mental|confusion|\bAMS\b/i, 'Altered mental status'],
    [/headache/i, 'Headache'],
    [/short(ness)? of breath|dyspnea|\bSOB\b/i, 'Dyspnea'],
    [/seizure/i, 'Seizure'],
  ],
  oxygenGiven: /oxygen|\bO2\b|nasal cannula|non-?rebreather|\bNRB\b|BVM|BiPAP|CPAP|ventilat/i,
  normalAssertion: /within (normal|expected|acceptable) (parameters|limits|range)|vitals? (are|were) (normal|stable)|no changes? in (patient )?(condition|health status)|without incident|remained stable/i,
};

const LOW_ACUITY = new Set(['Non-Acute', 'Lower Acuity (Green)']);

/* ---------------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------------*/

const defined = (v) => v !== null && v !== undefined && v !== '';
const hay = (rec) =>
  [rec.narrative, rec.impression, rec.complaints, rec.dispatchNature,
   (rec.medications || []).map((m) => m.text).join(' ')].join(' \n ');

function worst(vitals, key, cmp) {
  let best = null;
  for (const v of vitals || []) {
    if (!defined(v[key])) continue;
    if (best === null || cmp(v[key], best.val)) best = { val: v[key], at: `${v.date} ${v.time}`.trim(), v };
  }
  return best;
}

function matchAll(text, pairs) {
  const out = [];
  for (const [re, label] of pairs) {
    const m = text.match(re);
    if (m) out.push({ label, evidence: excerpt(text, m.index, m[0].length) });
  }
  return out;
}

function excerpt(text, idx, len, pad = 70) {
  const a = Math.max(0, idx - pad);
  const b = Math.min(text.length, idx + len + pad);
  return (a > 0 ? '…' : '') + text.slice(a, b).replace(/\s+/g, ' ').trim() + (b < text.length ? '…' : '');
}

/* ---------------------------------------------------------------------------
 * Criterion catalogue
 *
 * Each entry returns null (not met) or a finding object. `severity` drives the
 * review-priority ranking only — it is not a clinical score.
 * -------------------------------------------------------------------------*/

const CRITERIA = [
  // ----- Airway / ventilation ------------------------------------------------
  {
    id: 'airway',
    domain: 'Airway / ventilation',
    severity: 5,
    test: (rec, T) => {
      const hits = matchAll(hay(rec), RX.airway);
      const vitalSupport = (rec.vitals || []).some((v) => /Mechanically Assisted|BVM|CPAP|Ventilat/i.test(v.raw || ''));
      if (!hits.length && !vitalSupport) return null;
      const labels = hits.map((h) => h.label);
      if (vitalSupport && !labels.includes('Bag-valve ventilation')) labels.push('Assisted ventilation documented in vitals');
      return {
        threshold: 'Any documented airway compromise or ventilatory support',
        detail: labels.join('; '),
        cite: hits[0] ? hits[0].evidence : 'Vitals: respiratory effort recorded as mechanically assisted',
      };
    },
  },

  // ----- Oxygenation ---------------------------------------------------------
  {
    id: 'hypoxia',
    domain: 'Oxygenation',
    severity: 4,
    test: (rec, T) => {
      const lo = worst(rec.vitals, 'spo2', (a, b) => a < b);
      if (!lo || lo.val >= T.spo2Low) return null;
      const all = (rec.vitals || []).filter((v) => defined(v.spo2));
      const below = all.filter((v) => v.spo2 < T.spo2Low);
      const onRoomAir = below.some((v) => v.roomAir);
      return {
        threshold: `SpO2 < ${T.spo2Low}%`,
        detail: `Nadir ${lo.val}%${onRoomAir ? ' on room air' : ''} — ${below.length} of ${all.length} readings below threshold`,
        cite: `Vitals ${lo.at}: SpO2 ${lo.val}${lo.v.roomAir ? ' (Room Air)' : ''}`,
        critical: lo.val < T.spo2Critical,
      };
    },
  },

  // ----- Circulation ---------------------------------------------------------
  {
    id: 'hypotension',
    domain: 'Circulation / perfusion',
    severity: 5,
    test: (rec, T) => {
      const sbp = worst(rec.vitals, 'sbp', (a, b) => a < b);
      const map = worst(rec.vitals, 'map', (a, b) => a < b);
      const sbpHit = sbp && sbp.val < T.sbpLow;
      const mapHit = map && map.val < T.mapLow;
      if (!sbpHit && !mapHit) return null;
      const parts = [];
      if (sbpHit) parts.push(`SBP nadir ${sbp.val} mmHg`);
      if (mapHit) parts.push(`MAP nadir ${map.val} mmHg`);
      const n = (rec.vitals || []).filter((v) => (defined(v.sbp) && v.sbp < T.sbpLow) || (defined(v.map) && v.map < T.mapLow)).length;
      return {
        threshold: `SBP < ${T.sbpLow} mmHg or MAP < ${T.mapLow} mmHg`,
        detail: `${parts.join('; ')} — ${n} reading(s) below threshold`,
        cite: `Vitals ${(sbpHit ? sbp : map).at}: ${(sbpHit ? sbp.v : map.v).raw}`,
        critical: true,
      };
    },
  },
  {
    id: 'tachycardia',
    domain: 'Circulation / perfusion',
    severity: 3,
    test: (rec, T) => {
      const hi = worst(rec.vitals, 'hr', (a, b) => a > b);
      if (!hi || hi.val <= T.hrHigh) return null;
      return {
        threshold: `HR > ${T.hrHigh} bpm`,
        detail: `Peak HR ${hi.val} bpm`,
        cite: `Vitals ${hi.at}: ${hi.v.raw}`,
      };
    },
  },
  {
    id: 'bradycardia',
    domain: 'Circulation / perfusion',
    severity: 3,
    test: (rec, T) => {
      const lo = worst(rec.vitals, 'hr', (a, b) => a < b);
      if (!lo || lo.val >= T.hrLow) return null;
      return {
        threshold: `HR < ${T.hrLow} bpm`,
        detail: `Nadir HR ${lo.val} bpm`,
        cite: `Vitals ${lo.at}: ${lo.v.raw}`,
      };
    },
  },
  {
    id: 'severeHtn',
    domain: 'Severe hypertension',
    severity: 3,
    test: (rec, T) => {
      const sbp = worst(rec.vitals, 'sbp', (a, b) => a > b);
      const dbp = worst(rec.vitals, 'dbp', (a, b) => a > b);
      const hit = (sbp && sbp.val >= T.sbpSevereHtn) || (dbp && dbp.val >= T.dbpSevereHtn);
      if (!hit) return null;
      const organ = matchAll(hay(rec), RX.endOrgan);
      return {
        threshold: `SBP >= ${T.sbpSevereHtn} or DBP >= ${T.dbpSevereHtn} mmHg`,
        detail:
          `Peak ${sbp ? sbp.val : '?'}/${dbp ? dbp.val : '?'} mmHg. ` +
          (organ.length
            ? `End-organ symptoms present (${organ.map((o) => o.label).join(', ')}) — meets hypertensive EMERGENCY pattern.`
            : 'No end-organ symptoms identified in text — hypertensive urgency pattern.'),
        cite: `Vitals ${(sbp || dbp).at}: ${(sbp || dbp).v.raw}`,
        critical: organ.length > 0,
      };
    },
  },

  // ----- Neurologic ----------------------------------------------------------
  {
    id: 'gcs',
    domain: 'Neurologic',
    severity: 5,
    test: (rec, T) => {
      const vals = (rec.gcs || []).filter((g) => defined(g.gcs));
      if (!vals.length) return null;
      const lo = vals.reduce((a, b) => (b.gcs < a.gcs ? b : a));
      if (lo.gcs > T.gcsLow) return null;
      // A GCS recorded on a sedated or paralysed patient reflects the drugs,
      // not the injury. Report it, but say so plainly rather than treating it
      // as spontaneous obtundation.
      const conf = lo.confounded;
      return {
        threshold: `GCS <= ${T.gcsLow}`,
        detail:
          `Lowest GCS ${lo.gcs}${lo.avpu ? ` (AVPU ${lo.avpu})` : ''}` +
          (conf
            ? ` — CONFOUNDED: recorded with qualifier "${lo.qualifier}". Pharmacologically suppressed; not interpretable as spontaneous neurologic status.`
            : ''),
        cite: `Mental status ${lo.date} ${lo.time}: GCS ${lo.gcs}${lo.avpu ? `, ${lo.avpu}` : ''}${lo.qualifier ? ` | Qualifier: ${lo.qualifier}` : ''}`,
        critical: lo.gcs <= T.gcsCritical && !conf,
        confounded: conf,
      };
    },
  },
  {
    id: 'alteredMentation',
    domain: 'Neurologic',
    severity: 3,
    test: (rec) => {
      const hits = matchAll(hay(rec), [
        [/acute confusion|altered mental status|\bAMS\b|disoriented/i, 'Altered mental status'],
        [/unrespons/i, 'Unresponsive'],
        [/seizure/i, 'Seizure'],
      ]);
      if (!hits.length) return null;
      return {
        threshold: 'Documented acute neurologic change',
        detail: hits.map((h) => h.label).join('; '),
        cite: hits[0].evidence,
      };
    },
  },

  // ----- Respiratory rate ----------------------------------------------------
  {
    id: 'respiratoryRate',
    domain: 'Respiratory',
    severity: 3,
    test: (rec, T) => {
      const hi = worst(rec.vitals, 'rr', (a, b) => a > b);
      const lo = worst(rec.vitals, 'rr', (a, b) => a < b);
      const hiHit = hi && hi.val > T.rrHigh;
      const loHit = lo && lo.val < T.rrLow;
      if (!hiHit && !loHit) return null;
      return {
        threshold: `RR > ${T.rrHigh} or < ${T.rrLow} /min`,
        detail: hiHit ? `Peak RR ${hi.val}/min` : `Nadir RR ${lo.val}/min`,
        cite: `Vitals ${(hiHit ? hi : lo).at}: ${(hiHit ? hi : lo).v.raw}`,
      };
    },
  },

  // ----- Metabolic -----------------------------------------------------------
  {
    id: 'glucose',
    domain: 'Metabolic',
    severity: 4,
    test: (rec, T) => {
      const vals = rec.glucose || [];
      const unmeasurable = vals.find((v) => v === 'HI' || v === 'LO');
      const high = vals.filter((v) => typeof v === 'number' && v > T.glucoseHigh);
      const low = vals.filter((v) => typeof v === 'number' && v < T.glucoseLow);
      if (!unmeasurable && !high.length && !low.length) return null;
      return {
        threshold: `Glucose > ${T.glucoseHigh} or < ${T.glucoseLow} mg/dL, or above/below meter range`,
        detail: unmeasurable
          ? `Reads "${unmeasurable}" — outside measurable range, no numeric value recorded`
          : high.length
          ? `Peak ${Math.max(...high)} mg/dL`
          : `Nadir ${Math.min(...low)} mg/dL`,
        cite: `Blood glucose: ${vals.join(', ')}`,
      };
    },
  },

  // ----- Time-critical diagnosis --------------------------------------------
  {
    id: 'timeCritical',
    domain: 'Time-critical diagnosis',
    severity: 5,
    test: (rec) => {
      const hits = matchAll(hay(rec), RX.timeCritical);
      if (!hits.length) return null;
      return {
        threshold: 'Diagnosis with time-dependent intervention',
        detail: [...new Set(hits.map((h) => h.label))].join('; '),
        cite: hits[0].evidence,
        critical: true,
      };
    },
  },

  // ----- High-risk therapy in transit ---------------------------------------
  {
    id: 'highRiskTherapy',
    domain: 'High-risk therapy in transit',
    severity: 4,
    test: (rec) => {
      const hits = matchAll(hay(rec), RX.highRiskTherapy);
      if (!hits.length) return null;
      return {
        threshold: 'Active infusion, recent defibrillation, blood products, or anticoagulation',
        detail: [...new Set(hits.map((h) => h.label))].join('; '),
        cite: hits[0].evidence,
      };
    },
  },
];

/* ---------------------------------------------------------------------------
 * Data-integrity / documentation checks
 *
 * These are NOT clinical criteria. They describe the record, not the patient,
 * and are what surfaced the systemic mode-coding problem in the seed review.
 * -------------------------------------------------------------------------*/

const INTEGRITY = [
  {
    id: 'modeAcuityMismatch',
    label: 'Transport mode / acuity mismatch',
    severity: 4,
    test: (rec) => {
      if (rec.transportMode !== 'Emergent' || !LOW_ACUITY.has(rec.acuity)) return null;
      return {
        detail: `Transport Mode "Emergent" recorded against crew acuity "${rec.acuity}" on the same chart.`,
        cite: `Transport Mode: ${rec.transportMode} | Initial Patient Acuity: ${rec.acuity}`,
      };
    },
  },
  {
    id: 'modePracticeDivergence',
    label: 'Emergent mode without lights & sirens',
    severity: 2,
    test: (rec) => {
      if (rec.transportMode !== 'Emergent' || rec.lightsSirens !== 'No') return null;
      return {
        detail: 'Mode field says Emergent while the descriptor records no lights or sirens — the field may be defaulting rather than being chosen.',
        cite: `Transport Mode: Emergent | Descriptors: ${rec.transportDescriptors}`,
      };
    },
  },
  {
    id: 'acuityUndercode',
    label: 'Low acuity coded on a time-critical or airway patient',
    severity: 5,
    test: (rec) => {
      if (!LOW_ACUITY.has(rec.acuity)) return null;
      const tc = matchAll(hay(rec), RX.timeCritical);
      const aw = matchAll(hay(rec), RX.airway);
      if (!tc.length && !aw.length) return null;
      return {
        detail: `Acuity coded "${rec.acuity}" despite ${[...tc, ...aw].map((h) => h.label).join(', ')}.`,
        cite: (tc[0] || aw[0]).evidence,
      };
    },
  },
  {
    id: 'noVitals',
    label: 'No vital signs recorded',
    severity: 5,
    test: (rec) => (rec.vitals && rec.vitals.length ? null : { detail: 'No vital sign rows parsed from this record.', cite: 'Vital Signs section empty or unparsed' }),
  },
  {
    id: 'sparseVitals',
    label: 'Sparse vitals for acuity',
    severity: 3,
    test: (rec, T) => {
      const n = (rec.vitals || []).length;
      if (!n || n >= T.minVitalSets) return null;
      const critical = (rec.gcs || []).some((g) => defined(g.gcs) && g.gcs <= T.gcsCritical) ||
        rec.acuity === 'Critical (Red)';
      if (!critical && n >= 2) return null;
      return {
        detail: `Only ${n} set(s) of vitals recorded${critical ? ' on a patient coded Critical or with GCS <= 8' : ''}.`,
        cite: `${n} vital sign row(s) in record`,
      };
    },
  },
  {
    id: 'noMentalStatus',
    label: 'No mental status assessment',
    severity: 3,
    test: (rec) =>
      rec.gcs && rec.gcs.length
        ? null
        : { detail: 'No GCS or AVPU recorded anywhere in the record.', cite: 'Mental Status Assessment section empty or unparsed' },
  },
  {
    id: 'hypoxiaUntreated',
    label: 'Hypoxia documented without oxygen therapy',
    severity: 5,
    test: (rec, T) => {
      const below = (rec.vitals || []).filter((v) => defined(v.spo2) && v.spo2 < T.spo2Low);
      if (!below.length) return null;
      const o2Anywhere =
        RX.oxygenGiven.test(hay(rec)) || (rec.vitals || []).some((v) => v.supplementalO2);
      if (o2Anywhere) return null;
      return {
        detail: `${below.length} reading(s) below ${T.spo2Low}% with no oxygen administration found in interventions or narrative.`,
        cite: below.map((v) => `${v.time}: SpO2 ${v.spo2}${v.roomAir ? ' RA' : ''}`).join(' | '),
      };
    },
  },
  {
    id: 'narrativeContradiction',
    label: 'Narrative asserts stability against abnormal findings',
    severity: 4,
    test: (rec) => {
      if (!rec.narrative || !RX.normalAssertion.test(rec.narrative)) return null;

      // "Within normal parameters" is a claim about NORMAL range, not about
      // the emergent-transport thresholds. A HR of 109 does not cross the
      // tachycardia criterion but does contradict a claim of normality, so
      // this check uses ordinary reference ranges deliberately.
      const NORMAL = { hr: [60, 100], sbp: [90, 140], spo2: [94, 100], rr: [12, 20] };
      const abn = [];
      for (const v of rec.vitals || []) {
        for (const [key, [lo, hi]] of Object.entries(NORMAL)) {
          if (defined(v[key]) && (v[key] < lo || v[key] > hi)) {
            abn.push(`${key.toUpperCase()} ${v[key]}${v.time ? ` @ ${v.time}` : ''}`);
          }
        }
      }

      // Self-contradiction inside the narrative itself: an explicit
      // abnormality word alongside the assertion of normality.
      const selfContra = rec.narrative.match(
        /\b(rapid|elevated|tachycardic|bradycardic|hypertensive|hypotensive|hypoxic|diaphoretic|profoundly|distress)\b/i
      );

      if (!abn.length && !selfContra) return null;
      const m = rec.narrative.match(RX.normalAssertion);
      const bits = [];
      if (abn.length) {
        const uniq = [...new Set(abn)];
        bits.push(
          `${uniq.length} value(s) outside ordinary reference range: ${uniq.slice(0, 4).join(', ')}${uniq.length > 4 ? '…' : ''}`
        );
      }
      if (selfContra) bits.push(`narrative separately describes the patient as "${selfContra[1]}"`);
      return {
        detail: `Narrative asserts stability while ${bits.join('; and ')}.`,
        cite:
          excerpt(rec.narrative, m.index, m[0].length) +
          (selfContra ? ` || ${excerpt(rec.narrative, selfContra.index, selfContra[0].length, 55)}` : ''),
      };
    },
  },
  {
    id: 'noPreAlert',
    label: 'No pre-arrival notification on a time-critical patient',
    severity: 4,
    test: (rec) => {
      const tc = matchAll(hay(rec), RX.timeCritical);
      if (!tc.length) return null;
      if (!/^no$/i.test((rec.preArrivalAlert || '').trim())) return null;
      return {
        detail: `Pre-arrival alert recorded as "No" with ${tc.map((h) => h.label).join(', ')} documented.`,
        cite: `Destination Team Pre-Arrival Alert or Activation: ${rec.preArrivalAlert}`,
      };
    },
  },
  {
    id: 'noAls',
    label: 'No ALS provider on scene',
    severity: 4,
    test: (rec) => {
      if (!/^no\b/i.test((rec.alsOnScene || '').trim())) return null;
      const escalators = matchAll(hay(rec), [...RX.timeCritical, ...RX.airway]);
      return {
        detail: `Chart records no ALS provider on scene${escalators.length ? ` despite ${escalators.map((e) => e.label).join(', ')}` : ''}.`,
        cite: `Was there an ALS provider on scene: ${rec.alsOnScene}`,
        severityBump: escalators.length ? 1 : -1,
      };
    },
  },
  {
    id: 'pediatric',
    label: 'Pediatric patient',
    severity: 1,
    test: (rec, T) => {
      if (!defined(rec.ageYears) || rec.ageYears > T.pedsAgeMax) return null;
      return {
        detail: `Age ${rec.ageYears} — adult physiologic thresholds applied; review against pediatric ranges.`,
        cite: `Age: ${rec.age}`,
      };
    },
  },
  {
    id: 'parseIncomplete',
    label: 'Incomplete extraction',
    severity: 3,
    test: (rec) => {
      if (rec.completeness.score >= 0.75) return null;
      const missing = Object.entries(rec.completeness.checks)
        .filter(([, ok]) => !ok)
        .map(([k]) => k);
      return {
        detail: `Only ${Math.round(rec.completeness.score * 100)}% of expected fields parsed. Missing: ${missing.join(', ')}. Verify against the source chart before relying on flags.`,
        cite: 'Parser completeness check',
      };
    },
  },
];

/* ---------------------------------------------------------------------------
 * Evaluation
 * -------------------------------------------------------------------------*/

export function evaluate(rec, thresholds = DEFAULT_THRESHOLDS) {
  const T = { ...DEFAULT_THRESHOLDS, ...thresholds };

  const criteria = [];
  for (const c of CRITERIA) {
    let r = null;
    try { r = c.test(rec, T); } catch (e) { r = null; }
    if (r) criteria.push({ id: c.id, domain: c.domain, severity: r.critical ? c.severity + 1 : c.severity, ...r });
  }

  const integrity = [];
  for (const c of INTEGRITY) {
    let r = null;
    try { r = c.test(rec, T); } catch (e) { r = null; }
    if (r) integrity.push({ id: c.id, label: c.label, severity: Math.max(1, c.severity + (r.severityBump || 0)), ...r });
  }

  // Review priority: clinical criteria establish that the chart matters;
  // integrity findings establish that the chart needs a human. Both count,
  // integrity slightly higher because those are the ones that go unnoticed.
  const clinical = criteria.reduce((s, c) => s + c.severity, 0);
  const integ = integrity.reduce((s, c) => s + c.severity * 1.2, 0);
  const priority = Math.round(clinical + integ);

  const criticalCount = criteria.filter((c) => c.critical).length +
    integrity.filter((c) => c.severity >= 5).length;

  return {
    criteria,
    integrity,
    priority,
    criticalCount,
    domains: [...new Set(criteria.map((c) => c.domain))],
    /** Convenience: does ANY physiologic criterion support urgency? */
    anyPhysiologic: criteria.some((c) => c.domain !== 'High-risk therapy in transit') ,
    summary: buildSummary(rec, criteria, integrity),
  };
}

function buildSummary(rec, criteria, integrity) {
  if (!criteria.length && !integrity.length) {
    return 'No physiologic criteria crossed and no data-integrity findings. Nothing in the record supports an emergent designation; nothing in it contradicts one either.';
  }
  const parts = [];
  if (criteria.length) {
    parts.push(
      `Meets ${criteria.length} criteri${criteria.length === 1 ? 'on' : 'a'} across ${[...new Set(criteria.map((c) => c.domain))].length} domain(s): ${criteria.map((c) => c.domain).filter((v, i, a) => a.indexOf(v) === i).join(', ')}.`
    );
  } else {
    parts.push('No physiologic criteria crossed.');
  }
  if (integrity.length) {
    parts.push(`${integrity.length} data-integrity finding(s): ${integrity.map((i) => i.label).join('; ')}.`);
  }
  parts.push('Justification score is not computed — assign it after reviewing the citations.');
  return parts.join(' ');
}

export const CATALOGUE = {
  criteria: CRITERIA.map((c) => ({ id: c.id, domain: c.domain, severity: c.severity })),
  integrity: INTEGRITY.map((c) => ({ id: c.id, label: c.label, severity: c.severity })),
};

export const SCORE_LABELS = {
  5: 'Clearly justified',
  4: 'Probably justified',
  3: 'Equivocal',
  2: 'Probably not justified',
  1: 'Clearly not justified',
};
