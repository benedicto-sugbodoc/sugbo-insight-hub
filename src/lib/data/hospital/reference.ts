/**
 * Calibration tables for the shared synthetic hospital dataset.
 *
 * Everything here is a *documented assumption* rather than observed data. Each
 * table is mirrored in the "Data Generation Assumptions" section of `schema.md`;
 * if you change a number here, change it there too.
 */

import type { PhDepartment } from "@/lib/analytics/ph-constants";
import type {
  AppealStatus,
  DepartmentCategory,
  Disposition,
  EncounterType,
  FeedbackCategory,
  PayerType,
  PhilHealthCategory,
  ServiceCategory,
} from "./entities";

/* ------------------------------------------------------------------------- */
/* Global tuning constants                                                    */
/* ------------------------------------------------------------------------- */

/**
 * Fixed "today" for the dataset. Deliberately a constant rather than
 * `new Date()`: the dataset is built during SSR and rebuilt during hydration,
 * so a wall-clock anchor could straddle midnight and desync the two renders.
 */
export const DATASET_ANCHOR_DATE = "2026-08-11";

/** Number of monthly buckets in the reporting window (the last is month-to-date). */
export const DATASET_MONTHS = 12;

export const TARGET_PATIENT_COUNT = 800;
export const TARGET_ENCOUNTER_COUNT = 1800;
export const TARGET_DOCTOR_COUNT = 20;

/** Share of patients flagged as persons with disability. */
export const PWD_PATIENT_RATE = 0.06;
/** Share of patients with no PhilHealth membership at all. */
export const NON_MEMBER_RATE = 0.12;
/** Share of 60+ patients classified under the Senior Citizen program. */
export const SENIOR_CITIZEN_ASSIGNMENT_RATE = 0.55;
/** Share of encounters left with a null `diagnosisCode` (incomplete coding). */
export const DIAGNOSIS_MISSING_RATE = 0.03;
/** Share of inpatient encounters given a genuine long-stay outlier LOS. */
export const LOS_OUTLIER_RATE = 0.02;
/** Baseline share of discharged encounters that produce a survey response. */
export const FEEDBACK_RESPONSE_RATE = 0.35;
/** Share of feedback rows left without free-text. */
export const FEEDBACK_COMMENT_MISSING_RATE = 0.55;
/** Share of part-paid bills whose `paymentDate` was never captured. */
export const PAYMENT_DATE_MISSING_RATE = 0.04;
/** Statutory PWD discount rate (RA 10754). */
export const PWD_DISCOUNT_RATE = 0.2;
/** Philippine VAT rate, used to back out the VAT-exempt component. */
export const VAT_RATE = 0.12;
/** Share of the PhilHealth case rate booked as CR1 (facility) vs CR2 (professional fee). */
export const CASE_RATE_CR1_SHARE = 0.7;
/** Share of denied claims that get appealed. */
export const CLAIM_APPEAL_RATE = 0.55;

/* ------------------------------------------------------------------------- */
/* Departments                                                                */
/* ------------------------------------------------------------------------- */

export interface DepartmentProfile {
  category: DepartmentCategory;
  bedCapacity: number;
  baseVolumeWeight: number;
  baseRevenueIndex: number;
  /** Mean inpatient length of stay in days. */
  baseLosDays: number;
  /** Mean NPS (0–10) baseline before per-encounter adjustments. */
  npsBaseline: number;
}

export const DEPARTMENT_PROFILES: Record<PhDepartment, DepartmentProfile> = {
  "Internal Medicine": {
    category: "Medical",
    bedCapacity: 90,
    baseVolumeWeight: 1.9,
    baseRevenueIndex: 0.85,
    baseLosDays: 4.2,
    npsBaseline: 7.5,
  },
  Surgery: {
    category: "Surgical",
    bedCapacity: 60,
    baseVolumeWeight: 1.0,
    baseRevenueIndex: 1.75,
    baseLosDays: 5.0,
    npsBaseline: 7.7,
  },
  Obstetrics: {
    category: "Surgical",
    bedCapacity: 45,
    baseVolumeWeight: 1.1,
    baseRevenueIndex: 1.0,
    baseLosDays: 2.6,
    npsBaseline: 8.1,
  },
  Pediatrics: {
    category: "Medical",
    bedCapacity: 50,
    baseVolumeWeight: 1.2,
    baseRevenueIndex: 0.75,
    baseLosDays: 3.4,
    npsBaseline: 8.4,
  },
  Orthopedics: {
    category: "Surgical",
    bedCapacity: 35,
    baseVolumeWeight: 0.8,
    baseRevenueIndex: 1.5,
    baseLosDays: 6.0,
    npsBaseline: 7.3,
  },
  Cardiology: {
    category: "Medical",
    bedCapacity: 30,
    baseVolumeWeight: 0.7,
    baseRevenueIndex: 1.9,
    baseLosDays: 5.2,
    npsBaseline: 8.0,
  },
  "Emergency Medicine": {
    category: "Emergency",
    bedCapacity: 25,
    baseVolumeWeight: 1.8,
    baseRevenueIndex: 0.6,
    baseLosDays: 2.5,
    npsBaseline: 6.4,
  },
  Oncology: {
    category: "Medical",
    bedCapacity: 25,
    baseVolumeWeight: 0.5,
    baseRevenueIndex: 2.2,
    baseLosDays: 6.5,
    npsBaseline: 8.6,
  },
};

/** Encounter-type mix per department: [Inpatient, Outpatient, Emergency, Day Surgery]. */
export const DEPARTMENT_ENCOUNTER_MIX: Record<PhDepartment, [number, number, number, number]> = {
  "Internal Medicine": [0.35, 0.55, 0.08, 0.02],
  Surgery: [0.4, 0.3, 0.05, 0.25],
  Obstetrics: [0.55, 0.35, 0.05, 0.05],
  Pediatrics: [0.25, 0.6, 0.13, 0.02],
  Orthopedics: [0.3, 0.4, 0.08, 0.22],
  Cardiology: [0.4, 0.48, 0.07, 0.05],
  "Emergency Medicine": [0.12, 0.05, 0.83, 0.0],
  Oncology: [0.35, 0.55, 0.03, 0.07],
};

export const ENCOUNTER_TYPES: readonly EncounterType[] = [
  "Inpatient",
  "Outpatient",
  "Emergency",
  "Day Surgery",
];

/**
 * Patient-eligibility rule per department, so a 6-year-old is never admitted to
 * Obstetrics and a male patient never appears in the maternity ward.
 */
export interface DepartmentPatientRule {
  minAge: number;
  maxAge: number;
  gender: "male" | "female" | null;
}

export const DEPARTMENT_PATIENT_RULES: Record<PhDepartment, DepartmentPatientRule> = {
  "Internal Medicine": { minAge: 13, maxAge: 120, gender: null },
  Surgery: { minAge: 12, maxAge: 120, gender: null },
  Obstetrics: { minAge: 15, maxAge: 49, gender: "female" },
  Pediatrics: { minAge: 0, maxAge: 17, gender: null },
  Orthopedics: { minAge: 10, maxAge: 120, gender: null },
  Cardiology: { minAge: 35, maxAge: 120, gender: null },
  "Emergency Medicine": { minAge: 0, maxAge: 120, gender: null },
  Oncology: { minAge: 30, maxAge: 120, gender: null },
};

/* ------------------------------------------------------------------------- */
/* Time-of-day / day-of-week shaping                                          */
/* ------------------------------------------------------------------------- */

/** Weekday weights, index 0 = Sunday. */
export const WEEKDAY_WEIGHTS: Record<
  EncounterType,
  [number, number, number, number, number, number, number]
> = {
  Outpatient: [0.05, 1.25, 1.2, 1.15, 1.15, 1.1, 0.45],
  "Day Surgery": [0.03, 1.3, 1.25, 1.2, 1.15, 1.0, 0.25],
  Emergency: [1.15, 1.0, 0.95, 0.95, 0.95, 1.05, 1.15],
  Inpatient: [0.6, 1.2, 1.15, 1.1, 1.1, 1.05, 0.75],
};

/** Admission-hour weights, index = UTC hour 0–23. */
export const HOUR_WEIGHTS: Record<EncounterType, number[]> = {
  Outpatient: [
    0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.05, 0.6, 1.6, 2.2, 2.0, 1.4, 0.5, 1.5, 1.7, 1.3, 0.8, 0.3,
    0.1, 0.03, 0.03, 0.03, 0.03, 0.03,
  ],
  "Day Surgery": [
    0.02, 0.02, 0.02, 0.02, 0.02, 0.05, 0.5, 2.0, 2.4, 2.0, 1.6, 1.2, 0.6, 0.8, 0.5, 0.3, 0.1, 0.05,
    0.02, 0.02, 0.02, 0.02, 0.02, 0.02,
  ],
  Emergency: [
    0.7, 0.6, 0.5, 0.4, 0.4, 0.5, 0.7, 0.9, 1.1, 1.2, 1.2, 1.2, 1.1, 1.1, 1.1, 1.2, 1.3, 1.4, 1.5,
    1.5, 1.4, 1.3, 1.1, 0.9,
  ],
  Inpatient: [
    0.3, 0.25, 0.2, 0.2, 0.2, 0.3, 0.5, 0.8, 1.4, 1.8, 2.0, 1.8, 1.3, 1.5, 1.7, 1.6, 1.3, 1.0, 0.8,
    0.7, 0.6, 0.5, 0.4, 0.35,
  ],
};

/**
 * Multiplicative month-of-year seasonality, index 0 = January. Respiratory and
 * gastro admissions peak in the cool/wet months; April–May are quiet.
 */
export const MONTH_SEASONALITY = [
  1.1, 1.08, 1.0, 0.9, 0.88, 0.95, 1.05, 1.08, 1.04, 1.0, 1.02, 1.12,
];

/** Year-over-year growth applied linearly across the 12-month window. */
export const ANNUAL_GROWTH = 0.14;

/* ------------------------------------------------------------------------- */
/* Diagnosis affinity                                                         */
/* ------------------------------------------------------------------------- */

/** Weight applied to an ICD-10 code that a department has no listed affinity for. */
export const DIAGNOSIS_RESIDUAL_WEIGHT = 0.15;

export const DEPARTMENT_DIAGNOSIS_WEIGHTS: Record<PhDepartment, Record<string, number>> = {
  "Internal Medicine": {
    "J18.9": 3.0,
    I10: 3.0,
    "E11.9": 3.0,
    A09: 1.5,
    "K29.7": 2.0,
    "N39.0": 2.0,
    "A15.0": 2.0,
    "J06.9": 1.2,
    J00: 0.6,
    "M54.5": 0.5,
    "C50.9": 0.2,
    O80: 0.01,
  },
  Surgery: {
    "K29.7": 2.5,
    "N39.0": 1.5,
    "M54.5": 1.0,
    A09: 1.2,
    "C50.9": 1.2,
    "J18.9": 0.6,
    I10: 0.6,
    "E11.9": 0.6,
    O80: 0.01,
  },
  Obstetrics: {
    O80: 12.0,
    "N39.0": 1.5,
    I10: 0.8,
    "E11.9": 0.6,
    A09: 0.3,
    "C50.9": 0.05,
    "M54.5": 0.05,
  },
  Pediatrics: {
    A09: 4.0,
    J00: 3.5,
    "J06.9": 3.5,
    "J18.9": 3.0,
    "N39.0": 1.0,
    "A15.0": 0.8,
    "K29.7": 0.5,
    "E11.9": 0.2,
    "M54.5": 0.1,
    I10: 0.05,
    "C50.9": 0.01,
    O80: 0.01,
  },
  Orthopedics: {
    "M54.5": 6.0,
    "N39.0": 0.4,
    I10: 0.4,
    "E11.9": 0.4,
    "C50.9": 0.1,
    O80: 0.01,
  },
  Cardiology: {
    I10: 6.0,
    "E11.9": 2.0,
    "J18.9": 1.0,
    "N39.0": 0.4,
    "M54.5": 0.3,
    "C50.9": 0.1,
    O80: 0.01,
  },
  "Emergency Medicine": {
    A09: 2.5,
    "J18.9": 2.5,
    "J06.9": 2.0,
    "N39.0": 1.5,
    "K29.7": 1.5,
    I10: 1.5,
    "E11.9": 1.0,
    "M54.5": 1.0,
    J00: 1.0,
    "A15.0": 0.5,
    O80: 0.3,
    "C50.9": 0.1,
  },
  Oncology: {
    "C50.9": 8.0,
    "J18.9": 1.0,
    "A15.0": 0.6,
    I10: 0.4,
    "E11.9": 0.4,
    "M54.5": 0.3,
    O80: 0.01,
  },
};

/* ------------------------------------------------------------------------- */
/* Payer correlation                                                          */
/* ------------------------------------------------------------------------- */

export const PAYER_TYPES: readonly PayerType[] = [
  "philhealth",
  "hmo",
  "privatePay",
  "scpwd",
  "gsis",
  "writeoff",
];

/** Payer types that carry a PhilHealth benefit and therefore generate a claim. */
export const PHILHEALTH_BEARING_PAYERS: readonly PayerType[] = ["philhealth", "scpwd"];

/**
 * Multipliers applied to `PH_PAYER_MIX` based on the patient's PhilHealth
 * classification, so (for example) a self-pay patient never lands on a
 * PhilHealth-funded bill.
 */
export const PAYER_CATEGORY_MULTIPLIER: Record<PhilHealthCategory, Record<PayerType, number>> = {
  Employed: { philhealth: 1.15, hmo: 1.6, privatePay: 0.7, scpwd: 0.2, gsis: 1.2, writeoff: 0.3 },
  "Indigent/4Ps": {
    philhealth: 1.8,
    hmo: 0.05,
    privatePay: 0.25,
    scpwd: 0.5,
    gsis: 0.1,
    writeoff: 2.5,
  },
  "Self-Earning": {
    philhealth: 1.0,
    hmo: 0.6,
    privatePay: 1.5,
    scpwd: 0.3,
    gsis: 0.3,
    writeoff: 1.2,
  },
  Sponsored: { philhealth: 1.7, hmo: 0.1, privatePay: 0.3, scpwd: 0.6, gsis: 0.1, writeoff: 1.8 },
  Lifetime: { philhealth: 1.3, hmo: 0.3, privatePay: 0.5, scpwd: 2.5, gsis: 0.6, writeoff: 0.6 },
  "OFW/Other": { philhealth: 1.2, hmo: 0.8, privatePay: 1.2, scpwd: 0.2, gsis: 0.2, writeoff: 0.6 },
  "Senior Citizen": {
    philhealth: 0.9,
    hmo: 0.35,
    privatePay: 0.5,
    scpwd: 6.0,
    gsis: 0.8,
    writeoff: 0.7,
  },
  "Non-Member/Self-Pay": {
    philhealth: 0,
    hmo: 1.2,
    privatePay: 4.0,
    scpwd: 0,
    gsis: 0,
    writeoff: 2.0,
  },
};

/** Probability a bill is fully settled once it has fully aged, by payer. */
export const PAYER_PAYMENT_PROPENSITY: Record<PayerType, number> = {
  philhealth: 0.93,
  hmo: 0.88,
  privatePay: 0.72,
  scpwd: 0.9,
  gsis: 0.85,
  writeoff: 0.05,
};

/* ------------------------------------------------------------------------- */
/* Dispositions                                                               */
/* ------------------------------------------------------------------------- */

export const DISPOSITIONS: readonly Disposition[] = [
  "Recovered",
  "Improved",
  "Transferred",
  "HAMA",
  "Expired",
];

export const BASE_DISPOSITION_WEIGHTS: Record<Disposition, number> = {
  Recovered: 0.6,
  Improved: 0.28,
  Transferred: 0.05,
  HAMA: 0.04,
  Expired: 0.03,
};

/* ------------------------------------------------------------------------- */
/* Service catalogue                                                          */
/* ------------------------------------------------------------------------- */

export const SERVICE_PRICE_RANGES: Record<ServiceCategory, [number, number]> = {
  Consultation: [350, 900],
  Laboratory: [250, 2_500],
  Imaging: [900, 12_000],
  Surgery: [18_000, 160_000],
  "Room & Board": [1_200, 6_500],
  Pharmacy: [120, 4_500],
  "Emergency Care": [900, 8_000],
};

/**
 * Service categories that qualify for the PWD discount. Room & Board
 * (accommodation) is deliberately excluded — a documented simplification of the
 * real RA 10754 rules.
 */
export const PWD_QUALIFYING_CATEGORIES: readonly ServiceCategory[] = [
  "Consultation",
  "Laboratory",
  "Imaging",
  "Surgery",
  "Pharmacy",
  "Emergency Care",
];

export interface ServiceSeed {
  name: string;
  category: ServiceCategory;
  /** Owning department name, or `null` for hospital-wide ancillary services. */
  department: PhDepartment | null;
}

export const SERVICE_SEEDS: ServiceSeed[] = [
  // Consultation — one per department.
  {
    name: "Internal Medicine Consultation",
    category: "Consultation",
    department: "Internal Medicine",
  },
  { name: "Surgical Consultation", category: "Consultation", department: "Surgery" },
  { name: "Obstetric Consultation", category: "Consultation", department: "Obstetrics" },
  { name: "Pediatric Consultation", category: "Consultation", department: "Pediatrics" },
  { name: "Orthopedic Consultation", category: "Consultation", department: "Orthopedics" },
  { name: "Cardiology Consultation", category: "Consultation", department: "Cardiology" },
  {
    name: "Emergency Physician Assessment",
    category: "Consultation",
    department: "Emergency Medicine",
  },
  { name: "Oncology Consultation", category: "Consultation", department: "Oncology" },
  // Laboratory.
  { name: "Complete Blood Count", category: "Laboratory", department: null },
  { name: "Urinalysis", category: "Laboratory", department: null },
  { name: "Fecalysis", category: "Laboratory", department: null },
  { name: "Fasting Blood Sugar", category: "Laboratory", department: null },
  { name: "Lipid Profile", category: "Laboratory", department: null },
  { name: "Serum Creatinine", category: "Laboratory", department: null },
  { name: "Liver Function Panel", category: "Laboratory", department: null },
  { name: "HbA1c", category: "Laboratory", department: null },
  { name: "Serum Electrolytes", category: "Laboratory", department: null },
  { name: "Blood Culture & Sensitivity", category: "Laboratory", department: null },
  { name: "Sputum GeneXpert (TB)", category: "Laboratory", department: null },
  { name: "C-Reactive Protein", category: "Laboratory", department: null },
  // Imaging.
  { name: "Chest X-Ray", category: "Imaging", department: null },
  { name: "Abdominal Ultrasound", category: "Imaging", department: null },
  { name: "2D Echocardiogram", category: "Imaging", department: null },
  { name: "CT Scan - Cranial", category: "Imaging", department: null },
  { name: "CT Scan - Abdomen", category: "Imaging", department: null },
  { name: "MRI - Lumbar Spine", category: "Imaging", department: null },
  { name: "Mammography", category: "Imaging", department: null },
  // Surgery.
  { name: "Appendectomy", category: "Surgery", department: "Surgery" },
  { name: "Cholecystectomy", category: "Surgery", department: "Surgery" },
  { name: "Herniorrhaphy", category: "Surgery", department: "Surgery" },
  { name: "Exploratory Laparotomy", category: "Surgery", department: "Surgery" },
  { name: "Cesarean Section", category: "Surgery", department: "Obstetrics" },
  { name: "Dilatation & Curettage", category: "Surgery", department: "Obstetrics" },
  { name: "ORIF - Long Bone Fracture", category: "Surgery", department: "Orthopedics" },
  { name: "Total Knee Replacement", category: "Surgery", department: "Orthopedics" },
  { name: "Modified Radical Mastectomy", category: "Surgery", department: "Oncology" },
  { name: "Chemotherapy Port Insertion", category: "Surgery", department: "Oncology" },
  { name: "Coronary Angioplasty (PCI)", category: "Surgery", department: "Cardiology" },
  { name: "Pediatric Minor Surgery", category: "Surgery", department: "Pediatrics" },
  // Room & Board.
  { name: "Ward Bed (per day)", category: "Room & Board", department: null },
  { name: "Semi-Private Room (per day)", category: "Room & Board", department: null },
  { name: "Private Room (per day)", category: "Room & Board", department: null },
  { name: "Suite Room (per day)", category: "Room & Board", department: null },
  { name: "ICU Bed (per day)", category: "Room & Board", department: null },
  { name: "NICU Bed (per day)", category: "Room & Board", department: null },
  // Pharmacy.
  { name: "IV Fluids & Consumables", category: "Pharmacy", department: null },
  { name: "Antibiotic Course", category: "Pharmacy", department: null },
  { name: "Analgesic Pack", category: "Pharmacy", department: null },
  { name: "Antihypertensive Pack", category: "Pharmacy", department: null },
  { name: "Insulin Pack", category: "Pharmacy", department: null },
  { name: "Chemotherapy Drug Cycle", category: "Pharmacy", department: null },
  { name: "Anesthesia Drugs", category: "Pharmacy", department: null },
  { name: "Nebulization Medicines", category: "Pharmacy", department: null },
  // Emergency Care.
  {
    name: "ER Triage & Stabilization",
    category: "Emergency Care",
    department: "Emergency Medicine",
  },
  {
    name: "ER Observation (per hour)",
    category: "Emergency Care",
    department: "Emergency Medicine",
  },
  { name: "Wound Suturing", category: "Emergency Care", department: "Emergency Medicine" },
  { name: "ER Nebulization", category: "Emergency Care", department: "Emergency Medicine" },
  { name: "Cardiac Monitoring", category: "Emergency Care", department: "Emergency Medicine" },
];

/** Room & Board selection weights, aligned to `SERVICE_SEEDS` room ordering. */
export const ROOM_WEIGHTS = [0.45, 0.25, 0.18, 0.03, 0.07, 0.02];

/* ------------------------------------------------------------------------- */
/* Claims                                                                     */
/* ------------------------------------------------------------------------- */

export const CLAIM_DENIAL_REASONS: Record<string, string> = {
  "DN-01": "Incomplete Claim Signature Form (CSF)",
  "DN-02": "Member eligibility / missing PhilHealth ID",
  "DN-03": "Late filing beyond the 60-day window",
  "DN-04": "Non-compensable condition for the case rate claimed",
  "DN-05": "Duplicate claim already on file",
  "DN-06": "Missing laboratory / imaging attachment",
  "DN-07": "Attending physician accreditation lapsed",
};

export const CLAIM_DENIAL_CODES: readonly string[] = Object.keys(CLAIM_DENIAL_REASONS);

/** Relative frequency of each denial code, parallel to `CLAIM_DENIAL_CODES`. */
export const CLAIM_DENIAL_WEIGHTS: readonly number[] = [0.26, 0.14, 0.18, 0.12, 0.08, 0.15, 0.07];

export const APPEAL_STATUSES: readonly AppealStatus[] = ["Filed", "Under Appeal", "Won", "Lost"];
export const APPEAL_STATUS_WEIGHTS: readonly number[] = [0.18, 0.22, 0.38, 0.22];

/** Baseline probability that an adjudicated claim is denied. */
export const CLAIM_DENIAL_RATE = 0.12;

/* ------------------------------------------------------------------------- */
/* Feedback                                                                   */
/* ------------------------------------------------------------------------- */

export const FEEDBACK_CATEGORIES: readonly FeedbackCategory[] = [
  "Wait Time",
  "Staff Attitude",
  "Cleanliness",
  "Billing Clarity",
  "Communication",
  "Facilities",
  "Other",
];

/** Category weights for a *detractor* (low NPS) response. */
export const FEEDBACK_CATEGORY_WEIGHTS_LOW: readonly number[] = [
  0.34, 0.14, 0.08, 0.2, 0.13, 0.07, 0.04,
];
/** Category weights for a *promoter* (high NPS) response. */
export const FEEDBACK_CATEGORY_WEIGHTS_HIGH: readonly number[] = [
  0.1, 0.28, 0.14, 0.06, 0.24, 0.13, 0.05,
];

export const FEEDBACK_COMMENTS_POSITIVE: Record<FeedbackCategory, string> = {
  "Wait Time": "Queue moved faster than I expected.",
  "Staff Attitude": "Nurses were patient and kind the whole stay.",
  Cleanliness: "Ward and comfort rooms were consistently clean.",
  "Billing Clarity": "Billing walked me through every line item.",
  Communication: "The doctor explained the plan in a way we understood.",
  Facilities: "Rooms are comfortable and the equipment looks well maintained.",
  Other: "Overall a good experience, thank you.",
};

export const FEEDBACK_COMMENTS_NEGATIVE: Record<FeedbackCategory, string> = {
  "Wait Time": "Waited over four hours before anyone attended to us.",
  "Staff Attitude": "Front desk staff were dismissive when we asked questions.",
  Cleanliness: "Comfort room was not cleaned during our entire stay.",
  "Billing Clarity": "The final bill had charges nobody could explain.",
  Communication: "Nobody updated the family for a whole day.",
  Facilities: "Aircon was broken and the bed was uncomfortable.",
  Other: "Several small problems added up to a frustrating visit.",
};
