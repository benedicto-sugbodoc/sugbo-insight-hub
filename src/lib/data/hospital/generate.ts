/**
 * Generator for the shared synthetic hospital dataset.
 *
 * One relational dataset, generated once, that every hospital chart derives
 * from. All randomness is seeded (`./random`), all date maths is UTC
 * (`./time`), and all calibration lives in `./reference` so the assumptions can
 * be audited in one place and mirrored into `schema.md`.
 *
 * Generation order matters — later stages read earlier ones so that
 * relationships are *derived*, not independently rolled:
 *   departments -> doctors -> services -> patients -> encounters
 *   -> readmission flags -> encounter services -> billing (+ PWD discounts)
 *   -> PhilHealth claims -> feedback -> registration-date reconciliation.
 */

import {
  KONSULTA_EKAS_RATE,
  PH_DEPARTMENTS,
  PH_DIAGNOSIS_CASE_RATES,
  PH_MEMBERSHIP_DISTRIBUTION,
  PH_PAYER_MIX,
  PH_PHYSICIANS,
  PH_SURNAMES,
  PH_TOP_DIAGNOSES,
  phPatientName,
} from "@/lib/analytics/ph-constants";
import type { PhDepartment } from "@/lib/analytics/ph-constants";

import type {
  AdmissionType,
  Billing,
  Department,
  Disposition,
  Doctor,
  Encounter,
  EncounterService,
  EncounterType,
  Feedback,
  FeedbackCategory,
  HospitalDataset,
  HospitalDatasetIndex,
  MonthMeta,
  Patient,
  PayerType,
  PWDDiscount,
  PaymentStatus,
  PhilHealthCategory,
  PhilHealthClaim,
  ClaimCaseType,
  ClaimStatus,
  ServiceCatalogItem,
} from "./entities";
import {
  ANNUAL_GROWTH,
  APPEAL_STATUSES,
  APPEAL_STATUS_WEIGHTS,
  BASE_DISPOSITION_WEIGHTS,
  CASE_RATE_CR1_SHARE,
  CLAIM_APPEAL_RATE,
  CLAIM_DENIAL_CODES,
  CLAIM_DENIAL_RATE,
  CLAIM_DENIAL_WEIGHTS,
  DATASET_ANCHOR_DATE,
  DATASET_MONTHS,
  DEPARTMENT_DIAGNOSIS_WEIGHTS,
  DEPARTMENT_ENCOUNTER_MIX,
  DEPARTMENT_PATIENT_RULES,
  DEPARTMENT_PROFILES,
  DIAGNOSIS_MISSING_RATE,
  DIAGNOSIS_RESIDUAL_WEIGHT,
  DISPOSITIONS,
  ENCOUNTER_TYPES,
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_WEIGHTS_HIGH,
  FEEDBACK_CATEGORY_WEIGHTS_LOW,
  FEEDBACK_COMMENTS_NEGATIVE,
  FEEDBACK_COMMENTS_POSITIVE,
  FEEDBACK_COMMENT_MISSING_RATE,
  FEEDBACK_RESPONSE_RATE,
  HOUR_WEIGHTS,
  LOS_OUTLIER_RATE,
  MONTH_SEASONALITY,
  NON_MEMBER_RATE,
  PAYER_CATEGORY_MULTIPLIER,
  PAYER_PAYMENT_PROPENSITY,
  PAYER_TYPES,
  PAYMENT_DATE_MISSING_RATE,
  PHILHEALTH_BEARING_PAYERS,
  PWD_DISCOUNT_RATE,
  PWD_PATIENT_RATE,
  PWD_QUALIFYING_CATEGORIES,
  ROOM_WEIGHTS,
  SENIOR_CITIZEN_ASSIGNMENT_RATE,
  SERVICE_PRICE_RANGES,
  SERVICE_SEEDS,
  TARGET_DOCTOR_COUNT,
  TARGET_ENCOUNTER_COUNT,
  TARGET_PATIENT_COUNT,
  VAT_RATE,
  WEEKDAY_WEIGHTS,
} from "./reference";
import {
  clamp,
  cumulativeIndex,
  round2,
  seeded,
  seededInt,
  seededNormal,
  seededRange,
  weightedIndex,
} from "./random";
import {
  MS_DAY,
  MS_HOUR,
  ageOn,
  daysBetween,
  daysInMonth,
  monthLabel,
  parseDate,
  toDate,
  toDateTime,
} from "./time";

/* ------------------------------------------------------------------------- */
/* Salts — one independent pseudo-random stream per decision                  */
/* ------------------------------------------------------------------------- */

const SALT = {
  doctorExperience: 101,
  doctorCapacity: 103,
  serviceEligible: 109,
  patientGender: 127,
  patientAgeBand: 131,
  patientAge: 137,
  patientBirthJitter: 139,
  patientPwd: 149,
  patientNonMember: 151,
  patientSenior: 157,
  patientMember: 163,
  patientRegistration: 167,
  patientPropensity: 173,
  monthNoise: 179,
  encounterType: 181,
  encounterDay: 191,
  encounterHour: 193,
  encounterMinute: 197,
  encounterDoctor: 199,
  encounterPatient: 211,
  encounterAdmissionType: 223,
  encounterLos: 227,
  encounterLosOutlier: 229,
  encounterLosShape: 233,
  encounterDischargeHour: 239,
  encounterDiagnosisNull: 241,
  encounterDiagnosis: 251,
  encounterPayer: 257,
  encounterDisposition: 263,
  serviceCount: 269,
  servicePickLab: 271,
  servicePickImaging: 277,
  servicePickPharmacy: 281,
  servicePickRoom: 283,
  servicePickSurgery: 293,
  servicePickEmergency: 307,
  serviceHasSurgery: 311,
  servicePrice: 313,
  serviceVariance: 317,
  serviceQuantity: 331,
  billSettled: 337,
  billPartialSplit: 347,
  billWriteOff: 349,
  billPaymentLag: 353,
  billDateMissing: 359,
  claimSubmissionLag: 367,
  claimOutcome: 373,
  claimBacklog: 379,
  claimDenialCode: 383,
  claimRemitLag: 389,
  claimRemitAmount: 397,
  claimAppeal: 401,
  claimAppealStatus: 409,
  claimRecovery: 419,
  feedbackHas: 421,
  feedbackNoise: 431,
  feedbackCsat: 433,
  feedbackCategory: 439,
  feedbackComment: 443,
  feedbackDate: 449,
} as const;

/* ------------------------------------------------------------------------- */
/* Dimensions                                                                 */
/* ------------------------------------------------------------------------- */

function buildDepartments(): Department[] {
  return PH_DEPARTMENTS.map((name, i) => {
    const profile = DEPARTMENT_PROFILES[name];
    return {
      id: `DEP-${String(i + 1).padStart(2, "0")}`,
      name,
      category: profile.category,
      bedCapacity: profile.bedCapacity,
      baseVolumeWeight: profile.baseVolumeWeight,
      baseRevenueIndex: profile.baseRevenueIndex,
    };
  });
}

/**
 * Extends the canonical 15-name `PH_PHYSICIANS` roster up to
 * `TARGET_DOCTOR_COUNT` using surnames from `PH_SURNAMES` that the roster does
 * not already use, so per-doctor volumes stay realistic without inventing a
 * competing name pool.
 */
function buildDoctorNames(): string[] {
  const roster: string[] = [...PH_PHYSICIANS];
  const rosterSurnames = new Set(roster.map((n) => n.replace(/^Dr\.\s+[A-Z]\.\s+/, "")));
  const spare = PH_SURNAMES.filter((s) => !rosterSurnames.has(s));
  const needed = Math.max(0, TARGET_DOCTOR_COUNT - roster.length);
  for (let i = 0; i < needed; i += 1) {
    const surname = spare[i % spare.length] ?? `Surname${i}`;
    roster.push(`Dr. ${String.fromCharCode(65 + ((i * 7 + 3) % 26))}. ${surname}`);
  }
  return roster.slice(0, TARGET_DOCTOR_COUNT);
}

/** Allocates doctors across departments: one floor each, remainder by volume weight. */
function allocateDoctorsPerDepartment(departments: Department[]): number[] {
  const totalWeight = departments.reduce((s, d) => s + d.baseVolumeWeight, 0);
  const remaining = Math.max(0, TARGET_DOCTOR_COUNT - departments.length);
  const exact = departments.map((d) => (remaining * d.baseVolumeWeight) / totalWeight);
  const counts = exact.map((e) => 1 + Math.floor(e));
  let assigned = counts.reduce((s, c) => s + c, 0);
  const remainders = exact
    .map((e, i) => ({ i, frac: e - Math.floor(e) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  let cursor = 0;
  while (assigned < TARGET_DOCTOR_COUNT && remainders.length > 0) {
    const slot = remainders[cursor % remainders.length]!;
    counts[slot.i] = (counts[slot.i] ?? 0) + 1;
    assigned += 1;
    cursor += 1;
  }
  return counts;
}

function buildDoctors(departments: Department[]): Doctor[] {
  const names = buildDoctorNames();
  const perDepartment = allocateDoctorsPerDepartment(departments);
  const doctors: Doctor[] = [];
  let n = 0;
  departments.forEach((dept, di) => {
    const count = perDepartment[di] ?? 1;
    for (let k = 0; k < count && n < names.length; k += 1) {
      const years = seededInt(n, 3, 34, SALT.doctorExperience);
      doctors.push({
        id: `DOC-${String(n + 1).padStart(2, "0")}`,
        name: names[n]!,
        primaryDepartmentId: dept.id,
        yearsExperience: years,
        // More senior clinicians carry a slightly larger panel.
        monthlyCaseCapacity: Math.round(
          seededRange(n, 22, 62, SALT.doctorCapacity) + Math.min(years, 25) * 0.9,
        ),
      });
      n += 1;
    }
  });
  return doctors;
}

function buildServices(departments: Department[]): ServiceCatalogItem[] {
  const byName = new Map(departments.map((d) => [d.name, d.id] as const));
  // Ancillary services (lab/imaging/pharmacy/room) have no single clinical owner;
  // they are parked on Internal Medicine as a shared cost centre. Revenue is
  // always attributed through `Encounter.departmentId`, never through this field.
  const sharedDepartmentId = byName.get("Internal Medicine") ?? departments[0]!.id;
  return SERVICE_SEEDS.map((seed, i) => {
    const [min, max] = SERVICE_PRICE_RANGES[seed.category];
    const eligible =
      seed.category === "Consultation"
        ? false
        : seed.category === "Pharmacy"
          ? seeded(i, SALT.serviceEligible) < 0.6
          : true;
    return {
      id: `SVC-${String(i + 1).padStart(3, "0")}`,
      name: seed.name,
      category: seed.category,
      departmentId: seed.department
        ? (byName.get(seed.department) ?? sharedDepartmentId)
        : sharedDepartmentId,
      basePriceMin: min,
      basePriceMax: max,
      philhealthCaseRateEligible: eligible,
    };
  });
}

/* ------------------------------------------------------------------------- */
/* Patients                                                                   */
/* ------------------------------------------------------------------------- */

/** Age bands and their share of the patient population (working-age heavy, real tails). */
const AGE_BANDS: { min: number; max: number; share: number }[] = [
  { min: 0, max: 4, share: 0.07 },
  { min: 5, max: 17, share: 0.1 },
  { min: 18, max: 39, share: 0.3 },
  { min: 40, max: 59, share: 0.28 },
  { min: 60, max: 74, share: 0.17 },
  { min: 75, max: 95, share: 0.08 },
];

const AGE_BAND_WEIGHTS = AGE_BANDS.map((b) => b.share);

const MEMBER_CATEGORIES = PH_MEMBERSHIP_DISTRIBUTION.map((m) => m.category);
const MEMBER_WEIGHTS = PH_MEMBERSHIP_DISTRIBUTION.map((m) => m.share);

function buildPatients(anchorMs: number): Patient[] {
  const patients: Patient[] = [];
  for (let i = 0; i < TARGET_PATIENT_COUNT; i += 1) {
    const gender: "male" | "female" = seeded(i, SALT.patientGender) < 0.52 ? "female" : "male";
    const band = AGE_BANDS[weightedIndex(AGE_BAND_WEIGHTS, seeded(i, SALT.patientAgeBand))]!;
    const targetAge = seededInt(i, band.min, band.max, SALT.patientAge);
    const jitterDays = seededInt(i, 0, 364, SALT.patientBirthJitter);
    const birthMs = anchorMs - Math.round(targetAge * 365.25 + jitterDays) * MS_DAY;
    const birthDate = toDate(birthMs);
    const age = ageOn(birthDate, anchorMs);

    const isPWD = seeded(i, SALT.patientPwd) < PWD_PATIENT_RATE;

    let philhealthCategory: PhilHealthCategory;
    if (seeded(i, SALT.patientNonMember) < NON_MEMBER_RATE) {
      philhealthCategory = "Non-Member/Self-Pay";
    } else if (age >= 60 && seeded(i, SALT.patientSenior) < SENIOR_CITIZEN_ASSIGNMENT_RATE) {
      // Senior Citizen is only ever assigned to patients who really are 60+.
      philhealthCategory = "Senior Citizen";
    } else {
      // "Lifetime" membership legally requires 60+; suppress it for younger patients.
      const weights = MEMBER_WEIGHTS.map((w, k) =>
        MEMBER_CATEGORIES[k] === "Lifetime" && age < 60 ? 0 : w,
      );
      philhealthCategory =
        MEMBER_CATEGORIES[weightedIndex(weights, seeded(i, SALT.patientMember))]!;
    }

    patients.push({
      id: `PT-${String(i + 1).padStart(4, "0")}`,
      name: phPatientName(i, gender),
      gender,
      birthDate,
      isPWD,
      philhealthCategory,
      // Provisional; reconciled downstream against the patient's first encounter.
      registrationDate: toDate(anchorMs - seededInt(i, 0, 2190, SALT.patientRegistration) * MS_DAY),
    });
  }
  return patients;
}

/* ------------------------------------------------------------------------- */
/* Reporting window                                                           */
/* ------------------------------------------------------------------------- */

function buildMonths(anchorMs: number): MonthMeta[] {
  const anchor = new Date(anchorMs);
  const anchorYear = anchor.getUTCFullYear();
  const anchorMonth = anchor.getUTCMonth();
  const anchorDay = anchor.getUTCDate();
  const months: MonthMeta[] = [];
  for (let k = DATASET_MONTHS - 1; k >= 0; k -= 1) {
    const d = new Date(Date.UTC(anchorYear, anchorMonth - k, 1));
    const year = d.getUTCFullYear();
    const monthIndex = d.getUTCMonth();
    const total = daysInMonth(year, monthIndex);
    const isPartial = k === 0;
    const observed = isPartial ? anchorDay : total;
    const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
    months.push({
      key,
      label: monthLabel(key),
      startDate: `${key}-01`,
      endDate: `${key}-${String(observed).padStart(2, "0")}`,
      daysInMonth: total,
      daysObserved: observed,
      isPartial,
    });
  }
  return months;
}

/* ------------------------------------------------------------------------- */
/* Encounters                                                                 */
/* ------------------------------------------------------------------------- */

interface DepartmentPool {
  indices: number[];
  cumulative: number[];
}

/**
 * Per-department pool of clinically plausible patients, weighted by a
 * long-tailed "visit propensity" so a minority of patients account for a
 * disproportionate share of encounters (which is what makes the derived
 * 30-day readmission rate land in a believable range).
 */
function buildDepartmentPools(departments: Department[], patients: Patient[], anchorMs: number) {
  const propensity = patients.map(
    (_, i) => 0.4 + Math.pow(seeded(i, SALT.patientPropensity), 3) * 6,
  );
  const pools = new Map<string, DepartmentPool>();
  for (const dept of departments) {
    const rule = DEPARTMENT_PATIENT_RULES[dept.name];
    const indices: number[] = [];
    const cumulative: number[] = [];
    let acc = 0;
    patients.forEach((p, i) => {
      const age = ageOn(p.birthDate, anchorMs);
      if (age < rule.minAge || age > rule.maxAge) return;
      if (rule.gender !== null && p.gender !== rule.gender) return;
      indices.push(i);
      acc += propensity[i] ?? 1;
      cumulative.push(acc);
    });
    pools.set(dept.id, { indices, cumulative });
  }
  return pools;
}

interface RawEncounter {
  patientIndex: number;
  departmentId: string;
  primaryDoctorId: string;
  encounterType: EncounterType;
  admissionType: AdmissionType | null;
  admitMs: number;
  dischargeMs: number | null;
  losDays: number;
  diagnosisCode: string | null;
  disposition: Disposition;
  payerType: PayerType;
}

const ADMISSION_TYPES: readonly AdmissionType[] = [
  "Emergency",
  "Elective",
  "Transfer-in",
  "Newborn",
];

function pickPayerType(patient: Patient, seq: number): PayerType {
  const multipliers = PAYER_CATEGORY_MULTIPLIER[patient.philhealthCategory];
  const weights = PAYER_TYPES.map((p) => PH_PAYER_MIX[p] * multipliers[p]);
  if (patient.isPWD) {
    // PWD status pushes the bill onto the SC/PWD ledger regardless of membership.
    const scpwdIndex = PAYER_TYPES.indexOf("scpwd");
    weights[scpwdIndex] = (weights[scpwdIndex] ?? 0) * 6 + 0.08;
  }
  return PAYER_TYPES[weightedIndex(weights, seeded(seq, SALT.encounterPayer))]!;
}

function pickDiagnosis(deptName: PhDepartment, seq: number): string | null {
  if (seeded(seq, SALT.encounterDiagnosisNull) < DIAGNOSIS_MISSING_RATE) return null;
  const affinity = DEPARTMENT_DIAGNOSIS_WEIGHTS[deptName];
  const weights = PH_TOP_DIAGNOSES.map((d) => affinity[d.code] ?? DIAGNOSIS_RESIDUAL_WEIGHT);
  return PH_TOP_DIAGNOSES[weightedIndex(weights, seeded(seq, SALT.encounterDiagnosis))]!.code;
}

function pickDisposition(
  deptName: PhDepartment,
  encounterType: EncounterType,
  losDays: number,
  payerType: PayerType,
  philhealthCategory: PhilHealthCategory,
  seq: number,
): Disposition {
  const weights = DISPOSITIONS.map((d) => BASE_DISPOSITION_WEIGHTS[d]);
  const set = (d: Disposition, factor: number) => {
    const i = DISPOSITIONS.indexOf(d);
    weights[i] = (weights[i] ?? 0) * factor;
  };
  if (deptName === "Oncology") {
    set("Expired", 4);
    set("Recovered", 0.6);
  }
  if (deptName === "Emergency Medicine") {
    set("Transferred", 3);
    set("Expired", 2);
    set("HAMA", 2);
  }
  if (deptName === "Internal Medicine") set("Expired", 1.6);
  if (deptName === "Pediatrics" || deptName === "Obstetrics") set("Expired", 0.3);
  if (payerType === "privatePay" || payerType === "writeoff") set("HAMA", 2.2);
  if (philhealthCategory === "Non-Member/Self-Pay") set("HAMA", 1.8);
  if (encounterType === "Outpatient") {
    set("Recovered", 2);
    set("Expired", 0.02);
    set("Transferred", 0.5);
    set("HAMA", 0.3);
  }
  if (losDays > 14) set("Expired", 2.5);
  return DISPOSITIONS[weightedIndex(weights, seeded(seq, SALT.encounterDisposition))]!;
}

function buildEncounters(
  departments: Department[],
  doctors: Doctor[],
  patients: Patient[],
  months: MonthMeta[],
  anchorMs: number,
): Encounter[] {
  const anchorEndMs = anchorMs + MS_DAY - 1;
  const pools = buildDepartmentPools(departments, patients, anchorMs);
  const doctorsByDepartment = new Map<string, Doctor[]>();
  for (const doc of doctors) {
    const list = doctorsByDepartment.get(doc.primaryDepartmentId) ?? [];
    list.push(doc);
    doctorsByDepartment.set(doc.primaryDepartmentId, list);
  }

  // Month shaping: mild linear growth + calendar seasonality + small noise, and
  // the final month is scaled down to the fraction of it actually observed.
  const monthFactors = months.map((m, k) => {
    const monthIndex = Number(m.key.slice(5, 7)) - 1;
    const growth = 1 + ANNUAL_GROWTH * ((k - (DATASET_MONTHS - 1) / 2) / DATASET_MONTHS);
    const season = MONTH_SEASONALITY[monthIndex] ?? 1;
    const noise = seededRange(k, 0.95, 1.05, SALT.monthNoise);
    return growth * season * noise * (m.daysObserved / m.daysInMonth);
  });
  const factorSum = monthFactors.reduce((s, f) => s + f, 0);
  const baseMonthly = TARGET_ENCOUNTER_COUNT / factorSum;
  const totalVolumeWeight = departments.reduce((s, d) => s + d.baseVolumeWeight, 0);

  const raw: RawEncounter[] = [];
  let seq = 0;

  months.forEach((month, mi) => {
    const monthTarget = baseMonthly * (monthFactors[mi] ?? 1);
    const year = Number(month.key.slice(0, 4));
    const monthIndex = Number(month.key.slice(5, 7)) - 1;
    const monthStartMs = Date.UTC(year, monthIndex, 1);

    for (const dept of departments) {
      const count = Math.round((monthTarget * dept.baseVolumeWeight) / totalVolumeWeight);
      const mix = DEPARTMENT_ENCOUNTER_MIX[dept.name];
      const pool = pools.get(dept.id);
      const deptDoctors = doctorsByDepartment.get(dept.id) ?? doctors;
      if (!pool || pool.indices.length === 0 || deptDoctors.length === 0) continue;

      for (let k = 0; k < count; k += 1) {
        seq += 1;
        const encounterType =
          ENCOUNTER_TYPES[weightedIndex([...mix], seeded(seq, SALT.encounterType))]!;

        // Day-of-month, weighted by day-of-week for this encounter type.
        const dayWeights: number[] = [];
        for (let day = 1; day <= month.daysObserved; day += 1) {
          const dow = new Date(Date.UTC(year, monthIndex, day)).getUTCDay();
          dayWeights.push(WEEKDAY_WEIGHTS[encounterType][dow] ?? 1);
        }
        const day = weightedIndex(dayWeights, seeded(seq, SALT.encounterDay)) + 1;
        const hour = weightedIndex(HOUR_WEIGHTS[encounterType], seeded(seq, SALT.encounterHour));
        const minute = seededInt(seq, 0, 59, SALT.encounterMinute);
        const admitMs = monthStartMs + (day - 1) * MS_DAY + hour * MS_HOUR + minute * 60_000;

        const patientIndex =
          pool.indices[cumulativeIndex(pool.cumulative, seeded(seq, SALT.encounterPatient))] ??
          pool.indices[0]!;
        const patient = patients[patientIndex]!;
        const doctor =
          deptDoctors[seededInt(seq, 0, deptDoctors.length - 1, SALT.encounterDoctor)]!;

        // Admission type only means anything for inpatients; newborns only in OB/Peds.
        let admissionType: AdmissionType | null = null;
        if (encounterType === "Inpatient") {
          const allowNewborn = dept.name === "Obstetrics" || dept.name === "Pediatrics";
          const weights = [0.45, 0.4, 0.08, allowNewborn ? 0.07 : 0];
          admissionType =
            ADMISSION_TYPES[weightedIndex(weights, seeded(seq, SALT.encounterAdmissionType))]!;
        }

        // Length of stay.
        let plannedLos = 0;
        let dischargeMs: number | null = null;
        if (encounterType === "Inpatient") {
          const base = DEPARTMENT_PROFILES[dept.name].baseLosDays;
          const shape = 0.45 + seeded(seq, SALT.encounterLosShape) * 1.4;
          plannedLos = Math.max(1, Math.round(base * shape));
          if (seeded(seq, SALT.encounterLosOutlier) < LOS_OUTLIER_RATE) {
            // Genuine long-stay outliers (sepsis, awaiting placement, social cases).
            plannedLos = Math.round(plannedLos * seededRange(seq, 3, 7, SALT.encounterLos));
          }
          const dischargeHour = seededInt(seq, 8, 18, SALT.encounterDischargeHour);
          const candidate =
            admitMs -
            (hour * MS_HOUR + minute * 60_000) +
            plannedLos * MS_DAY +
            dischargeHour * MS_HOUR;
          dischargeMs = candidate > anchorEndMs ? null : candidate;
        } else if (encounterType === "Day Surgery") {
          const overnight = seeded(seq, SALT.encounterLosShape) < 0.4;
          dischargeMs = admitMs + (overnight ? 20 : 6) * MS_HOUR;
        } else if (encounterType === "Emergency") {
          dischargeMs =
            admitMs + Math.round(seededRange(seq, 2, 11, SALT.encounterLosShape)) * MS_HOUR;
        } else {
          dischargeMs =
            admitMs + Math.round(seededRange(seq, 1, 4, SALT.encounterLosShape)) * MS_HOUR;
        }
        const losDays =
          dischargeMs === null
            ? daysBetween(admitMs, anchorEndMs)
            : daysBetween(admitMs, dischargeMs);

        const payerType = pickPayerType(patient, seq);
        const diagnosisCode = pickDiagnosis(dept.name, seq);
        const disposition = pickDisposition(
          dept.name,
          encounterType,
          losDays,
          payerType,
          patient.philhealthCategory,
          seq,
        );

        raw.push({
          patientIndex,
          departmentId: dept.id,
          primaryDoctorId: doctor.id,
          encounterType,
          admissionType,
          admitMs,
          dischargeMs,
          losDays,
          diagnosisCode,
          disposition,
          payerType,
        });
      }
    }
  });

  raw.sort((a, b) => a.admitMs - b.admitMs);

  const encounters: Encounter[] = raw.map((r, i) => ({
    id: `ENC-${String(i + 1).padStart(5, "0")}`,
    patientId: patients[r.patientIndex]!.id,
    departmentId: r.departmentId,
    primaryDoctorId: r.primaryDoctorId,
    encounterType: r.encounterType,
    admissionType: r.admissionType,
    admitDateTime: toDateTime(r.admitMs),
    dischargeDateTime: r.dischargeMs === null ? null : toDateTime(r.dischargeMs),
    losDays: r.losDays,
    diagnosisCode: r.diagnosisCode,
    disposition: r.disposition,
    readmitted30d: false,
    payerType: r.payerType,
  }));

  applyReadmissionFlags(encounters);
  return encounters;
}

/**
 * Derives `readmitted30d` from the patient's real encounter history: an
 * inpatient or emergency encounter is flagged when the same patient was
 * discharged from an *inpatient* stay within the preceding 30 days. Nothing is
 * rolled here, so the flag always reconciles with the encounter table.
 */
function applyReadmissionFlags(encounters: Encounter[]): void {
  const byPatient = new Map<string, Encounter[]>();
  for (const enc of encounters) {
    const list = byPatient.get(enc.patientId) ?? [];
    list.push(enc);
    byPatient.set(enc.patientId, list);
  }
  for (const list of byPatient.values()) {
    list.sort((a, b) => Date.parse(a.admitDateTime) - Date.parse(b.admitDateTime));
    for (let j = 1; j < list.length; j += 1) {
      const current = list[j]!;
      if (current.encounterType !== "Inpatient" && current.encounterType !== "Emergency") continue;
      const admitMs = Date.parse(current.admitDateTime);
      for (let i = j - 1; i >= 0; i -= 1) {
        const prior = list[i]!;
        if (prior.encounterType !== "Inpatient" || prior.dischargeDateTime === null) continue;
        const gap = admitMs - Date.parse(prior.dischargeDateTime);
        if (gap < 0) continue;
        if (gap <= 30 * MS_DAY) {
          current.readmitted30d = true;
        }
        break;
      }
    }
  }
}

/* ------------------------------------------------------------------------- */
/* Encounter services                                                         */
/* ------------------------------------------------------------------------- */

interface ServiceIndex {
  consultationByDepartment: Map<string, ServiceCatalogItem>;
  surgeryByDepartment: Map<string, ServiceCatalogItem[]>;
  allSurgery: ServiceCatalogItem[];
  laboratory: ServiceCatalogItem[];
  imaging: ServiceCatalogItem[];
  pharmacy: ServiceCatalogItem[];
  rooms: ServiceCatalogItem[];
  emergency: ServiceCatalogItem[];
}

function buildServiceIndex(services: ServiceCatalogItem[]): ServiceIndex {
  const idx: ServiceIndex = {
    consultationByDepartment: new Map(),
    surgeryByDepartment: new Map(),
    allSurgery: [],
    laboratory: [],
    imaging: [],
    pharmacy: [],
    rooms: [],
    emergency: [],
  };
  for (const s of services) {
    switch (s.category) {
      case "Consultation":
        idx.consultationByDepartment.set(s.departmentId, s);
        break;
      case "Surgery": {
        const list = idx.surgeryByDepartment.get(s.departmentId) ?? [];
        list.push(s);
        idx.surgeryByDepartment.set(s.departmentId, list);
        idx.allSurgery.push(s);
        break;
      }
      case "Laboratory":
        idx.laboratory.push(s);
        break;
      case "Imaging":
        idx.imaging.push(s);
        break;
      case "Pharmacy":
        idx.pharmacy.push(s);
        break;
      case "Room & Board":
        idx.rooms.push(s);
        break;
      case "Emergency Care":
        idx.emergency.push(s);
        break;
      default:
        break;
    }
  }
  return idx;
}

function labWeights(services: ServiceCatalogItem[], diagnosisCode: string | null): number[] {
  return services.map((s) => {
    if (s.name.includes("GeneXpert")) return diagnosisCode === "A15.0" ? 6 : 0.05;
    if (s.name.includes("HbA1c") || s.name.includes("Fasting Blood Sugar")) {
      return diagnosisCode === "E11.9" ? 5 : 0.6;
    }
    if (s.name.includes("Lipid")) return diagnosisCode === "I10" ? 3 : 0.6;
    if (s.name.includes("Fecalysis")) return diagnosisCode === "A09" ? 5 : 0.3;
    if (s.name.includes("Urinalysis")) return diagnosisCode === "N39.0" ? 5 : 1.2;
    if (s.name.includes("Blood Culture")) return diagnosisCode === "J18.9" ? 2.5 : 0.4;
    return 1;
  });
}

function imagingWeights(
  services: ServiceCatalogItem[],
  deptName: PhDepartment,
  diagnosisCode: string | null,
  gender: "male" | "female",
): number[] {
  return services.map((s) => {
    if (s.name.includes("Mammography")) {
      return gender === "female" && (diagnosisCode === "C50.9" || deptName === "Oncology")
        ? 6
        : 0.02;
    }
    if (s.name.includes("Echocardiogram")) return deptName === "Cardiology" ? 6 : 0.3;
    if (s.name.includes("MRI"))
      return deptName === "Orthopedics" || diagnosisCode === "M54.5" ? 4 : 0.2;
    if (s.name.includes("Cranial")) return deptName === "Emergency Medicine" ? 3 : 0.4;
    if (s.name.includes("Chest X-Ray")) {
      return diagnosisCode === "J18.9" || diagnosisCode === "A15.0" ? 5 : 1.5;
    }
    return 1;
  });
}

function pharmacyWeights(
  services: ServiceCatalogItem[],
  deptName: PhDepartment,
  diagnosisCode: string | null,
  hasSurgery: boolean,
): number[] {
  return services.map((s) => {
    if (s.name.includes("Chemotherapy")) return deptName === "Oncology" ? 6 : 0.01;
    if (s.name.includes("Anesthesia")) return hasSurgery ? 5 : 0.02;
    if (s.name.includes("Insulin")) return diagnosisCode === "E11.9" ? 5 : 0.2;
    if (s.name.includes("Antihypertensive")) return diagnosisCode === "I10" ? 5 : 0.3;
    if (s.name.includes("Nebulization")) {
      return diagnosisCode === "J18.9" || diagnosisCode === "J06.9" || diagnosisCode === "J00"
        ? 4
        : 0.3;
    }
    if (s.name.includes("Antibiotic")) return 2;
    return 1;
  });
}

/**
 * Unit price = a draw inside the service's catalogue range, biased upward by the
 * department's `baseRevenueIndex`, plus a small per-case variance so no two
 * bills for the same service are identical.
 */
function priceFor(service: ServiceCatalogItem, revenueIndex: number, seed: number): number {
  const bias = clamp((revenueIndex - 0.6) / 1.6, 0, 1) * 0.5;
  const u = clamp(seeded(seed, SALT.servicePrice) * 0.8 + bias, 0, 1);
  const base = service.basePriceMin + u * (service.basePriceMax - service.basePriceMin);
  const departmentFactor = 0.9 + 0.12 * revenueIndex;
  const variance = seededRange(seed, 0.94, 1.06, SALT.serviceVariance);
  return Math.max(1, Math.round(base * departmentFactor * variance));
}

interface LineSeed {
  service: ServiceCatalogItem;
  quantity: number;
}

function buildEncounterServices(
  encounters: Encounter[],
  departments: Department[],
  patients: Patient[],
  services: ServiceCatalogItem[],
): EncounterService[] {
  const idx = buildServiceIndex(services);
  const departmentById = new Map(departments.map((d) => [d.id, d] as const));
  const patientById = new Map(patients.map((p) => [p.id, p] as const));
  const rows: EncounterService[] = [];
  let lineNo = 0;

  encounters.forEach((enc, ei) => {
    const dept = departmentById.get(enc.departmentId)!;
    const patient = patientById.get(enc.patientId)!;
    const seed = ei + 1;
    const lines: LineSeed[] = [];

    const surgeryPool = idx.surgeryByDepartment.get(enc.departmentId) ?? [];
    const wantsSurgery =
      enc.encounterType === "Day Surgery" ||
      (enc.encounterType === "Inpatient" &&
        surgeryPool.length > 0 &&
        seeded(seed, SALT.serviceHasSurgery) <
          (dept.category === "Surgical" ? 0.62 : dept.name === "Cardiology" ? 0.35 : 0.12));

    const surgery =
      wantsSurgery && surgeryPool.length > 0
        ? surgeryPool[seededInt(seed, 0, surgeryPool.length - 1, SALT.servicePickSurgery)]!
        : null;

    if (enc.encounterType === "Inpatient") {
      // Room & board first — quantity is the actual length of stay.
      const roomWeights = ROOM_WEIGHTS.map((w, i) => {
        const room = idx.rooms[i];
        if (!room) return 0;
        if (room.name.startsWith("NICU")) {
          return enc.admissionType === "Newborn" || dept.name === "Pediatrics" ? w : 0;
        }
        if (room.name.startsWith("ICU")) return enc.losDays >= 3 ? w : w * 0.25;
        return w;
      });
      const room = idx.rooms[weightedIndex(roomWeights, seeded(seed, SALT.servicePickRoom))];
      if (room) lines.push({ service: room, quantity: Math.max(1, enc.losDays) });

      const consult = idx.consultationByDepartment.get(enc.departmentId);
      if (consult) {
        lines.push({ service: consult, quantity: clamp(Math.ceil(enc.losDays / 2), 1, 6) });
      }
      if (surgery) lines.push({ service: surgery, quantity: 1 });
    } else if (enc.encounterType === "Day Surgery") {
      const fallback =
        surgery ??
        (idx.allSurgery.length > 0
          ? idx.allSurgery[seededInt(seed, 0, idx.allSurgery.length - 1, SALT.servicePickSurgery)]!
          : null);
      if (fallback) lines.push({ service: fallback, quantity: 1 });
      const consult = idx.consultationByDepartment.get(enc.departmentId);
      if (consult) lines.push({ service: consult, quantity: 1 });
    } else if (enc.encounterType === "Emergency") {
      const er =
        idx.emergency[seededInt(seed, 0, idx.emergency.length - 1, SALT.servicePickEmergency)];
      if (er) {
        lines.push({
          service: er,
          quantity: er.name.includes("per hour")
            ? clamp(seededInt(seed, 1, 6, SALT.serviceQuantity), 1, 6)
            : 1,
        });
      }
    } else {
      // Outpatient: consultation only — never a Surgery-category line item.
      const consult = idx.consultationByDepartment.get(enc.departmentId);
      if (consult) lines.push({ service: consult, quantity: 1 });
    }

    // Ancillaries, sized by how intensive the encounter is.
    const ancillaryBudget =
      enc.encounterType === "Inpatient"
        ? seededInt(seed, 2, 3, SALT.serviceCount)
        : enc.encounterType === "Emergency"
          ? seededInt(seed, 1, 3, SALT.serviceCount)
          : seededInt(seed, 0, 3, SALT.serviceCount);

    if (ancillaryBudget >= 1 && idx.laboratory.length > 0) {
      const lab =
        idx.laboratory[
          weightedIndex(
            labWeights(idx.laboratory, enc.diagnosisCode),
            seeded(seed, SALT.servicePickLab),
          )
        ]!;
      lines.push({ service: lab, quantity: 1 });
    }
    if (ancillaryBudget >= 2 && idx.imaging.length > 0) {
      const img =
        idx.imaging[
          weightedIndex(
            imagingWeights(idx.imaging, dept.name, enc.diagnosisCode, patient.gender),
            seeded(seed, SALT.servicePickImaging),
          )
        ]!;
      lines.push({ service: img, quantity: 1 });
    }
    if (ancillaryBudget >= 3 && idx.pharmacy.length > 0) {
      const drug =
        idx.pharmacy[
          weightedIndex(
            pharmacyWeights(idx.pharmacy, dept.name, enc.diagnosisCode, surgery !== null),
            seeded(seed, SALT.servicePickPharmacy),
          )
        ]!;
      lines.push({
        service: drug,
        quantity: clamp(
          seededInt(seed, 1, enc.encounterType === "Inpatient" ? 4 : 2, SALT.serviceQuantity),
          1,
          4,
        ),
      });
    }

    // 1–6 line items per encounter.
    const capped = lines.slice(0, 6);
    capped.forEach((line, li) => {
      lineNo += 1;
      const unitPrice = priceFor(line.service, dept.baseRevenueIndex, seed * 7 + li);
      rows.push({
        id: `ES-${String(lineNo).padStart(6, "0")}`,
        encounterId: enc.id,
        serviceId: line.service.id,
        quantity: line.quantity,
        unitPrice,
        lineTotal: round2(unitPrice * line.quantity),
      });
    });
  });

  return rows;
}

/* ------------------------------------------------------------------------- */
/* Billing + PWD discounts                                                    */
/* ------------------------------------------------------------------------- */

interface BillingResult {
  billings: Billing[];
  pwdDiscounts: PWDDiscount[];
}

function philhealthDeductionFor(
  encounter: Encounter,
  grossCharges: number,
  involvesPhilHealth: boolean,
): number {
  if (!involvesPhilHealth || grossCharges <= 0) return 0;
  if (encounter.encounterType === "Outpatient") {
    return round2(Math.min(grossCharges * 0.9, KONSULTA_EKAS_RATE));
  }
  if (encounter.diagnosisCode === null) {
    // No ICD-10 code means no case rate can be claimed — a real consequence of
    // the 3% incomplete-coding rate rather than a separate random draw.
    return 0;
  }
  const caseRate = PH_DIAGNOSIS_CASE_RATES[encounter.diagnosisCode] ?? 0;
  const factor = encounter.encounterType === "Emergency" ? 0.6 : 1;
  return round2(Math.min(grossCharges * 0.9, caseRate * factor));
}

function buildBillings(
  encounters: Encounter[],
  patients: Patient[],
  services: ServiceCatalogItem[],
  encounterServices: EncounterService[],
  anchorMs: number,
): BillingResult {
  const patientById = new Map(patients.map((p) => [p.id, p] as const));
  const serviceById = new Map(services.map((s) => [s.id, s] as const));
  const linesByEncounter = new Map<string, EncounterService[]>();
  for (const line of encounterServices) {
    const list = linesByEncounter.get(line.encounterId) ?? [];
    list.push(line);
    linesByEncounter.set(line.encounterId, list);
  }

  const billings: Billing[] = [];
  const pwdDiscounts: PWDDiscount[] = [];
  let pwdNo = 0;

  encounters.forEach((enc, ei) => {
    const seed = ei + 1;
    const patient = patientById.get(enc.patientId)!;
    const lines = linesByEncounter.get(enc.id) ?? [];
    const grossCharges = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
    const involvesPhilHealth = PHILHEALTH_BEARING_PAYERS.includes(enc.payerType);
    const philhealthDeduction = philhealthDeductionFor(enc, grossCharges, involvesPhilHealth);

    // PWD discount: strictly zero unless the patient really is a PWD.
    let qualifyingAmount = 0;
    if (patient.isPWD) {
      for (const line of lines) {
        const service = serviceById.get(line.serviceId);
        if (service && PWD_QUALIFYING_CATEGORIES.includes(service.category)) {
          qualifyingAmount += line.lineTotal;
        }
      }
      qualifyingAmount = round2(qualifyingAmount);
    }
    const pwdDiscountAmount = patient.isPWD ? round2(qualifyingAmount * PWD_DISCOUNT_RATE) : 0;

    const netPayable = round2(Math.max(0, grossCharges - philhealthDeduction - pwdDiscountAmount));
    const referenceMs = Date.parse(enc.dischargeDateTime ?? enc.admitDateTime);
    const ageDays = daysBetween(referenceMs, anchorMs);

    const propensity = PAYER_PAYMENT_PROPENSITY[enc.payerType];
    const ageFactor = clamp(ageDays / 120, 0, 1);
    const settled = seeded(seed, SALT.billSettled) < propensity * (0.35 + 0.65 * ageFactor);

    let paymentStatus: PaymentStatus;
    let amountPaid: number;
    if (netPayable <= 0 || settled) {
      paymentStatus = "Paid";
      amountPaid = netPayable;
    } else if (
      enc.payerType === "writeoff" ||
      (ageDays > 240 &&
        (enc.payerType === "privatePay" || enc.payerType === "hmo") &&
        seeded(seed, SALT.billWriteOff) < 0.3)
    ) {
      paymentStatus = "Write-off";
      amountPaid = round2(netPayable * seededRange(seed, 0, 0.2, SALT.billPartialSplit));
    } else if (seeded(seed, SALT.billPartialSplit) < 0.45) {
      paymentStatus = "Partial";
      amountPaid = round2(netPayable * seededRange(seed, 0.2, 0.85, SALT.billPaymentLag));
    } else if (ageDays > 60) {
      paymentStatus = "Overdue";
      amountPaid = 0;
    } else {
      paymentStatus = "Pending";
      amountPaid = 0;
    }

    let paymentDate: string | null = null;
    if (amountPaid > 0) {
      const lag = seededInt(seed, 1, 55, SALT.billPaymentLag);
      const paidMs = Math.min(referenceMs + lag * MS_DAY, anchorMs);
      paymentDate = toDate(paidMs);
      // Realistic missingness: some collected payments never got a date captured.
      if (
        paymentStatus === "Partial" &&
        seeded(seed, SALT.billDateMissing) < PAYMENT_DATE_MISSING_RATE
      ) {
        paymentDate = null;
      }
    }

    const billingId = `BIL-${String(ei + 1).padStart(5, "0")}`;
    billings.push({
      id: billingId,
      encounterId: enc.id,
      grossCharges,
      philhealthDeduction,
      pwdDiscountAmount,
      netPayable,
      amountPaid,
      balance: round2(netPayable - amountPaid),
      paymentStatus,
      paymentDate,
      payerType: enc.payerType,
    });

    if (patient.isPWD && pwdDiscountAmount > 0) {
      pwdNo += 1;
      pwdDiscounts.push({
        id: `PWD-${String(pwdNo).padStart(4, "0")}`,
        encounterId: enc.id,
        billingId,
        qualifyingAmount,
        discountRate: PWD_DISCOUNT_RATE,
        discountAmount: pwdDiscountAmount,
        vatExemptAmount: round2((qualifyingAmount * VAT_RATE) / (1 + VAT_RATE)),
      });
    }
  });

  return { billings, pwdDiscounts };
}

/* ------------------------------------------------------------------------- */
/* PhilHealth claims                                                          */
/* ------------------------------------------------------------------------- */

function claimCaseTypeFor(
  encounter: Encounter,
  departmentName: PhDepartment,
  hasSurgeryLine: boolean,
): ClaimCaseType {
  if (encounter.encounterType === "Outpatient") return "Konsulta Package";
  if (departmentName === "Obstetrics" && encounter.diagnosisCode === "O80")
    return "Maternity Package";
  if (encounter.diagnosisCode === "C50.9") return "Catastrophic (Z-Benefit)";
  if (encounter.encounterType === "Day Surgery" || hasSurgeryLine) return "Surgical Case";
  return "Medical Case";
}

function buildClaims(
  encounters: Encounter[],
  departments: Department[],
  services: ServiceCatalogItem[],
  encounterServices: EncounterService[],
  billings: Billing[],
  anchorMs: number,
): PhilHealthClaim[] {
  const departmentById = new Map(departments.map((d) => [d.id, d] as const));
  const billingByEncounter = new Map(billings.map((b) => [b.encounterId, b] as const));
  const surgeryServiceIds = new Set(
    services.filter((s) => s.category === "Surgery").map((s) => s.id),
  );
  const hasSurgeryByEncounter = new Set(
    encounterServices.filter((l) => surgeryServiceIds.has(l.serviceId)).map((l) => l.encounterId),
  );

  const claims: PhilHealthClaim[] = [];
  let claimNo = 0;

  encounters.forEach((enc, ei) => {
    // A claim can only exist where the encounter genuinely carries a PhilHealth
    // benefit — never for a self-pay/HMO-only encounter.
    if (!PHILHEALTH_BEARING_PAYERS.includes(enc.payerType)) return;
    const billing = billingByEncounter.get(enc.id);
    const dept = departmentById.get(enc.departmentId);
    if (!billing || !dept) return;

    const seed = ei + 1;
    const caseType = claimCaseTypeFor(enc, dept.name, hasSurgeryByEncounter.has(enc.id));
    const caseRateAmount =
      caseType === "Konsulta Package"
        ? KONSULTA_EKAS_RATE
        : enc.diagnosisCode === null
          ? 0
          : (PH_DIAGNOSIS_CASE_RATES[enc.diagnosisCode] ?? 0);

    const referenceMs = Date.parse(enc.dischargeDateTime ?? enc.admitDateTime);
    const submissionMs = Math.min(
      referenceMs + seededInt(seed, 2, 25, SALT.claimSubmissionLag) * MS_DAY,
      anchorMs,
    );
    const daysSinceSubmission = daysBetween(submissionMs, anchorMs);

    let status: ClaimStatus;
    if (enc.diagnosisCode === null && caseType !== "Konsulta Package") {
      // Blocked on coding — cannot be filed at all.
      status = "Drafted";
    } else if (daysSinceSubmission < 7) {
      status = "Submitted";
    } else if (daysSinceSubmission < 25) {
      status = "Under Review";
    } else if (seeded(seed, SALT.claimBacklog) < 0.08) {
      // A real backlog tail: some old claims are still sitting in review.
      status = seeded(seed, SALT.claimOutcome) < 0.5 ? "Submitted" : "Under Review";
    } else if (seeded(seed, SALT.claimOutcome) < CLAIM_DENIAL_RATE) {
      status = "Denied";
    } else if (daysSinceSubmission > 45 && seeded(seed, SALT.claimRemitLag) < 0.75) {
      status = "Remitted";
    } else {
      status = "Approved";
    }

    let denialCode: string | null = null;
    let appealFiledDate: string | null = null;
    let appealStatus: PhilHealthClaim["appealStatus"] = null;
    let amountRecovered: number | null = null;
    if (status === "Denied") {
      denialCode =
        CLAIM_DENIAL_CODES[
          weightedIndex(CLAIM_DENIAL_WEIGHTS, seeded(seed, SALT.claimDenialCode))
        ] ?? CLAIM_DENIAL_CODES[0]!;
      if (seeded(seed, SALT.claimAppeal) < CLAIM_APPEAL_RATE) {
        const appealMs = Math.min(
          submissionMs + seededInt(seed, 20, 70, SALT.claimAppeal) * MS_DAY,
          anchorMs,
        );
        appealFiledDate = toDate(appealMs);
        appealStatus =
          APPEAL_STATUSES[
            weightedIndex([...APPEAL_STATUS_WEIGHTS], seeded(seed, SALT.claimAppealStatus))
          ]!;
        if (appealStatus === "Won") {
          amountRecovered = round2(caseRateAmount * seededRange(seed, 0.6, 1, SALT.claimRecovery));
        }
      }
    }

    let remittanceDate: string | null = null;
    let remittanceAmount: number | null = null;
    if (status === "Remitted") {
      const remitMs = Math.min(
        submissionMs + seededInt(seed, 30, 95, SALT.claimRemitLag) * MS_DAY,
        anchorMs,
      );
      remittanceDate = toDate(remitMs);
      remittanceAmount = round2(caseRateAmount * seededRange(seed, 0.85, 1, SALT.claimRemitAmount));
    }

    claimNo += 1;
    claims.push({
      id: `CLM-${String(claimNo).padStart(5, "0")}`,
      encounterId: enc.id,
      billingId: billing.id,
      caseType,
      caseRateAmount,
      cr1Amount: round2(caseRateAmount * CASE_RATE_CR1_SHARE),
      cr2Amount: round2(caseRateAmount - caseRateAmount * CASE_RATE_CR1_SHARE),
      patientShare: billing.netPayable,
      submissionDate: toDate(submissionMs),
      status,
      denialCode,
      remittanceDate,
      remittanceAmount,
      appealFiledDate,
      appealStatus,
      amountRecovered,
    });
  });

  return claims;
}

/* ------------------------------------------------------------------------- */
/* Feedback                                                                   */
/* ------------------------------------------------------------------------- */

function buildFeedback(
  encounters: Encounter[],
  departments: Department[],
  billings: Billing[],
  claims: PhilHealthClaim[],
  anchorMs: number,
): Feedback[] {
  const departmentById = new Map(departments.map((d) => [d.id, d] as const));
  const billingByEncounter = new Map(billings.map((b) => [b.encounterId, b] as const));
  const claimByEncounter = new Map(claims.map((c) => [c.encounterId, c] as const));
  const rows: Feedback[] = [];
  let feedbackNo = 0;

  encounters.forEach((enc, ei) => {
    // Only discharged encounters get a post-visit survey.
    if (enc.dischargeDateTime === null) return;
    const dept = departmentById.get(enc.departmentId);
    if (!dept) return;
    const seed = ei + 1;
    const profile = DEPARTMENT_PROFILES[dept.name];
    // Response rate varies a little by department (ER patients answer less often).
    const responseRate = clamp(
      FEEDBACK_RESPONSE_RATE + (profile.npsBaseline - 7.7) * 0.03,
      0.22,
      0.45,
    );
    if (seeded(seed, SALT.feedbackHas) >= responseRate) return;

    let score = profile.npsBaseline + seededNormal(seed, SALT.feedbackNoise) * 1.5;
    if (enc.disposition === "Expired") score -= 2.5;
    else if (enc.disposition === "HAMA") score -= 2.0;
    else if (enc.disposition === "Transferred") score -= 0.8;
    if (enc.losDays > profile.baseLosDays * 2) score -= 1.5;
    if (enc.readmitted30d) score -= 0.7;
    const billing = billingByEncounter.get(enc.id);
    if (billing && (billing.paymentStatus === "Overdue" || billing.paymentStatus === "Write-off")) {
      score -= 0.6;
    }
    const claim = claimByEncounter.get(enc.id);
    if (claim && claim.status === "Denied") score -= 0.7;

    const npsScore = Math.round(clamp(score, 0, 10));
    const csatScore = Math.round(
      clamp(1 + npsScore * 0.4 + seededNormal(seed, SALT.feedbackCsat) * 0.35, 1, 5),
    );

    const weights = npsScore <= 6 ? FEEDBACK_CATEGORY_WEIGHTS_LOW : FEEDBACK_CATEGORY_WEIGHTS_HIGH;
    const adjusted = weights.map((w, i) =>
      FEEDBACK_CATEGORIES[i] === "Wait Time" && dept.name === "Emergency Medicine" ? w * 2.2 : w,
    );
    const category: FeedbackCategory =
      FEEDBACK_CATEGORIES[weightedIndex(adjusted, seeded(seed, SALT.feedbackCategory))]!;

    const comment =
      seeded(seed, SALT.feedbackComment) < FEEDBACK_COMMENT_MISSING_RATE
        ? null
        : npsScore <= 6
          ? FEEDBACK_COMMENTS_NEGATIVE[category]
          : FEEDBACK_COMMENTS_POSITIVE[category];

    const submittedMs = Math.min(
      Date.parse(enc.dischargeDateTime) + seededInt(seed, 0, 14, SALT.feedbackDate) * MS_DAY,
      anchorMs,
    );

    feedbackNo += 1;
    rows.push({
      id: `FB-${String(feedbackNo).padStart(5, "0")}`,
      encounterId: enc.id,
      patientId: enc.patientId,
      departmentId: enc.departmentId,
      npsScore,
      csatScore,
      category,
      comment,
      submittedDate: toDate(submittedMs),
    });
  });

  return rows;
}

/* ------------------------------------------------------------------------- */
/* Assembly                                                                   */
/* ------------------------------------------------------------------------- */

/**
 * Pulls each patient's `registrationDate` back to their first encounter where
 * the provisional value would otherwise post-date it, so a patient is never
 * treated before being registered.
 */
function reconcileRegistrationDates(patients: Patient[], encounters: Encounter[]): void {
  const earliest = new Map<string, string>();
  for (const enc of encounters) {
    const date = enc.admitDateTime.slice(0, 10);
    const current = earliest.get(enc.patientId);
    if (current === undefined || date < current) earliest.set(enc.patientId, date);
  }
  for (const patient of patients) {
    const first = earliest.get(patient.id);
    if (first !== undefined && patient.registrationDate > first) {
      patient.registrationDate = first;
    }
  }
}

function buildIndex(
  departments: Department[],
  doctors: Doctor[],
  services: ServiceCatalogItem[],
  patients: Patient[],
  encounters: Encounter[],
  encounterServices: EncounterService[],
  billings: Billing[],
  claims: PhilHealthClaim[],
  pwdDiscounts: PWDDiscount[],
  feedback: Feedback[],
): HospitalDatasetIndex {
  const servicesByEncounterId = new Map<string, EncounterService[]>();
  for (const line of encounterServices) {
    const list = servicesByEncounterId.get(line.encounterId) ?? [];
    list.push(line);
    servicesByEncounterId.set(line.encounterId, list);
  }
  const encountersByPatientId = new Map<string, Encounter[]>();
  for (const enc of encounters) {
    const list = encountersByPatientId.get(enc.patientId) ?? [];
    list.push(enc);
    encountersByPatientId.set(enc.patientId, list);
  }
  return {
    departmentById: new Map(departments.map((d) => [d.id, d] as const)),
    doctorById: new Map(doctors.map((d) => [d.id, d] as const)),
    serviceById: new Map(services.map((s) => [s.id, s] as const)),
    patientById: new Map(patients.map((p) => [p.id, p] as const)),
    encounterById: new Map(encounters.map((e) => [e.id, e] as const)),
    billingByEncounterId: new Map(billings.map((b) => [b.encounterId, b] as const)),
    servicesByEncounterId,
    claimByEncounterId: new Map(claims.map((c) => [c.encounterId, c] as const)),
    pwdDiscountByEncounterId: new Map(pwdDiscounts.map((p) => [p.encounterId, p] as const)),
    feedbackByEncounterId: new Map(feedback.map((f) => [f.encounterId, f] as const)),
    encountersByPatientId,
  };
}

/** Builds the entire dataset from scratch. Deterministic — same output every call. */
export function generateHospitalDataset(): HospitalDataset {
  const anchorMs = parseDate(DATASET_ANCHOR_DATE);
  const departments = buildDepartments();
  const doctors = buildDoctors(departments);
  const services = buildServices(departments);
  const patients = buildPatients(anchorMs);
  const months = buildMonths(anchorMs);
  const encounters = buildEncounters(departments, doctors, patients, months, anchorMs);
  const encounterServices = buildEncounterServices(encounters, departments, patients, services);
  const { billings, pwdDiscounts } = buildBillings(
    encounters,
    patients,
    services,
    encounterServices,
    anchorMs,
  );
  const claims = buildClaims(
    encounters,
    departments,
    services,
    encounterServices,
    billings,
    anchorMs,
  );
  const feedback = buildFeedback(encounters, departments, billings, claims, anchorMs);
  reconcileRegistrationDates(patients, encounters);

  return {
    anchorDate: DATASET_ANCHOR_DATE,
    months,
    departments,
    doctors,
    services,
    patients,
    encounters,
    encounterServices,
    billings,
    claims,
    pwdDiscounts,
    feedback,
    index: buildIndex(
      departments,
      doctors,
      services,
      patients,
      encounters,
      encounterServices,
      billings,
      claims,
      pwdDiscounts,
      feedback,
    ),
  };
}
