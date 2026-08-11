/**
 * Entity (table) definitions for the shared synthetic hospital dataset.
 *
 * This is the single relational model that hospital-side dashboards should
 * derive from, replacing the per-chart independent mock files that produced
 * numbers which did not reconcile across pages. Reference/dimension data that
 * already exists canonically (departments, physician roster, ICD-10 list, case
 * rates, payer mix, membership distribution, name generator, colours) is
 * imported from `src/lib/analytics/ph-constants.ts` rather than redeclared —
 * this dataset is the evolution of that file, not a competitor to it.
 *
 * Date conventions:
 *  - `*Date` fields are calendar dates, `"YYYY-MM-DD"`.
 *  - `*DateTime` fields are full ISO-8601 UTC timestamps, `"YYYY-MM-DDTHH:mm:ss.sssZ"`.
 *  - All arithmetic is done in UTC so results are timezone-independent (SSR safety).
 */

import type { PhDepartment } from "@/lib/analytics/ph-constants";
import { PH_MEMBERSHIP_DISTRIBUTION, PH_PAYER_MIX } from "@/lib/analytics/ph-constants";

/* ------------------------------------------------------------------------- */
/* Shared enumerations                                                        */
/* ------------------------------------------------------------------------- */

export type DepartmentCategory = "Medical" | "Surgical" | "Diagnostic" | "Emergency";

export type ServiceCategory =
  | "Consultation"
  | "Laboratory"
  | "Imaging"
  | "Surgery"
  | "Room & Board"
  | "Pharmacy"
  | "Emergency Care";

/** The six canonical payer buckets, taken straight from `PH_PAYER_MIX`. */
export type PayerType = keyof typeof PH_PAYER_MIX;

/** The six covered-member categories declared in `PH_MEMBERSHIP_DISTRIBUTION`. */
export type PhilHealthMemberCategory = (typeof PH_MEMBERSHIP_DISTRIBUTION)[number]["category"];

/**
 * Patient-level PhilHealth classification. The six member categories are used
 * verbatim from `PH_MEMBERSHIP_DISTRIBUTION` (that file's actual names, not the
 * differently-worded set in the original brief); two extra buckets are added
 * because `PH_MEMBERSHIP_DISTRIBUTION` only describes *enrolled* members and
 * therefore has no way to express "senior citizen" or "not a member at all".
 */
export type PhilHealthCategory =
  PhilHealthMemberCategory | "Senior Citizen" | "Non-Member/Self-Pay";

export type EncounterType = "Inpatient" | "Outpatient" | "Emergency" | "Day Surgery";

export type AdmissionType = "Emergency" | "Elective" | "Transfer-in" | "Newborn";

export type Disposition = "Recovered" | "Improved" | "Transferred" | "HAMA" | "Expired";

export type PaymentStatus = "Paid" | "Partial" | "Pending" | "Overdue" | "Write-off";

export type ClaimCaseType =
  | "Medical Case"
  | "Surgical Case"
  | "Maternity Package"
  | "Konsulta Package"
  | "Catastrophic (Z-Benefit)";

export type ClaimStatus =
  "Drafted" | "Submitted" | "Under Review" | "Approved" | "Denied" | "Remitted";

export type AppealStatus = "Filed" | "Under Appeal" | "Won" | "Lost";

export type FeedbackCategory =
  | "Wait Time"
  | "Staff Attitude"
  | "Cleanliness"
  | "Billing Clarity"
  | "Communication"
  | "Facilities"
  | "Other";

/* ------------------------------------------------------------------------- */
/* Dimensions                                                                 */
/* ------------------------------------------------------------------------- */

/** One clinical department. Exactly 8 rows — one per `PH_DEPARTMENTS` entry. */
export interface Department {
  id: string;
  name: PhDepartment;
  category: DepartmentCategory;
  /** Staffed inpatient beds. */
  bedCapacity: number;
  /** Relative encounter-volume multiplier used to allocate monthly volume. */
  baseVolumeWeight: number;
  /** Relative revenue-per-case multiplier applied to service unit prices. */
  baseRevenueIndex: number;
}

/** One attending physician. */
export interface Doctor {
  id: string;
  name: string;
  primaryDepartmentId: string;
  yearsExperience: number;
  /** Soft capacity used by productivity/utilization derivations. */
  monthlyCaseCapacity: number;
}

/** One billable service line in the chargemaster. */
export interface ServiceCatalogItem {
  id: string;
  name: string;
  category: ServiceCategory;
  /** Owning cost-centre department. Ancillary categories share one owner — see schema.md. */
  departmentId: string;
  basePriceMin: number;
  basePriceMax: number;
  philhealthCaseRateEligible: boolean;
}

/** One registered patient. */
export interface Patient {
  id: string;
  name: string;
  gender: "male" | "female";
  /** `"YYYY-MM-DD"`. */
  birthDate: string;
  isPWD: boolean;
  philhealthCategory: PhilHealthCategory;
  /** `"YYYY-MM-DD"`. Always on or before the patient's earliest encounter. */
  registrationDate: string;
}

/* ------------------------------------------------------------------------- */
/* Facts                                                                      */
/* ------------------------------------------------------------------------- */

/** One patient visit/admission. The grain of the entire fact model. */
export interface Encounter {
  id: string;
  patientId: string;
  departmentId: string;
  primaryDoctorId: string;
  encounterType: EncounterType;
  /** Only populated for `encounterType === "Inpatient"`; `null` otherwise. */
  admissionType: AdmissionType | null;
  /** Full ISO-8601 UTC timestamp. */
  admitDateTime: string;
  /** `null` while the patient is still admitted as of the dataset anchor date. */
  dischargeDateTime: string | null;
  /** Whole days between admit and discharge; running LOS when still admitted. */
  losDays: number;
  /** FK into `PH_TOP_DIAGNOSES[].code`; `null` simulates incomplete coding. */
  diagnosisCode: string | null;
  disposition: Disposition;
  /** Derived from the patient's real prior encounter history — never rolled. */
  readmitted30d: boolean;
  payerType: PayerType;
}

/** One charge line on an encounter. */
export interface EncounterService {
  id: string;
  encounterId: string;
  serviceId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

/** One bill. Exactly 1:1 with `Encounter`. */
export interface Billing {
  id: string;
  encounterId: string;
  /** Sum of this encounter's `EncounterService.lineTotal`. */
  grossCharges: number;
  philhealthDeduction: number;
  /** Always 0 unless the encounter's patient has `isPWD === true`. */
  pwdDiscountAmount: number;
  netPayable: number;
  amountPaid: number;
  balance: number;
  paymentStatus: PaymentStatus;
  /** `"YYYY-MM-DD"`; `null` when nothing has been collected (or data is missing). */
  paymentDate: string | null;
  /** Mirrors `Encounter.payerType`. */
  payerType: PayerType;
}

/** One PhilHealth claim. Only exists for PhilHealth-bearing encounters. */
export interface PhilHealthClaim {
  id: string;
  encounterId: string;
  billingId: string;
  caseType: ClaimCaseType;
  /** From `PH_DIAGNOSIS_CASE_RATES` (or `KONSULTA_EKAS_RATE` for OPD packages). */
  caseRateAmount: number;
  /** Facility/hospital component of the case rate. */
  cr1Amount: number;
  /** Professional-fee component of the case rate. */
  cr2Amount: number;
  /** What the patient still owes after the case-rate deduction. */
  patientShare: number;
  /** `"YYYY-MM-DD"`. For `Drafted` claims this is the preparation date. */
  submissionDate: string;
  status: ClaimStatus;
  /** Only non-null when `status === "Denied"`. */
  denialCode: string | null;
  /** Only non-null when `status === "Remitted"`. */
  remittanceDate: string | null;
  /** Only non-null when `status === "Remitted"`. */
  remittanceAmount: number | null;
  /** Only non-null for appealed denials. */
  appealFiledDate: string | null;
  /** Only non-null for appealed denials. */
  appealStatus: AppealStatus | null;
  /** Only non-null when `appealStatus === "Won"`. */
  amountRecovered: number | null;
}

/** One applied PWD discount. Only exists for `Patient.isPWD === true`. */
export interface PWDDiscount {
  id: string;
  encounterId: string;
  billingId: string;
  /** Portion of `grossCharges` sitting on discount-qualifying service categories. */
  qualifyingAmount: number;
  /** Statutory 0.20 under RA 10754. */
  discountRate: number;
  discountAmount: number;
  /** VAT component removed from the qualifying amount (12% VAT-inclusive back-out). */
  vatExemptAmount: number;
}

/** One post-discharge experience survey response. */
export interface Feedback {
  id: string;
  encounterId: string;
  patientId: string;
  departmentId: string;
  /** 0–10 Net Promoter question. */
  npsScore: number;
  /** 1–5 satisfaction question. */
  csatScore: number;
  category: FeedbackCategory;
  /** `null` for the majority of responses (score-only submissions). */
  comment: string | null;
  /** `"YYYY-MM-DD"`. */
  submittedDate: string;
}

/* ------------------------------------------------------------------------- */
/* Dataset container                                                          */
/* ------------------------------------------------------------------------- */

/** One month in the dataset's reporting window. */
export interface MonthMeta {
  /** Sort-safe key, `"YYYY-MM"`. */
  key: string;
  /** Chart label, e.g. `"Mar 26"`. */
  label: string;
  /** `"YYYY-MM-DD"` first day of the month. */
  startDate: string;
  /** `"YYYY-MM-DD"` last *observed* day (the anchor date for the final month). */
  endDate: string;
  daysInMonth: number;
  daysObserved: number;
  /** `true` only for the final, month-to-date bucket. */
  isPartial: boolean;
}

/** Lookup maps built once alongside the dataset. Not a table — a convenience index. */
export interface HospitalDatasetIndex {
  departmentById: ReadonlyMap<string, Department>;
  doctorById: ReadonlyMap<string, Doctor>;
  serviceById: ReadonlyMap<string, ServiceCatalogItem>;
  patientById: ReadonlyMap<string, Patient>;
  encounterById: ReadonlyMap<string, Encounter>;
  billingByEncounterId: ReadonlyMap<string, Billing>;
  servicesByEncounterId: ReadonlyMap<string, EncounterService[]>;
  claimByEncounterId: ReadonlyMap<string, PhilHealthClaim>;
  pwdDiscountByEncounterId: ReadonlyMap<string, PWDDiscount>;
  feedbackByEncounterId: ReadonlyMap<string, Feedback>;
  encountersByPatientId: ReadonlyMap<string, Encounter[]>;
}

/** The whole relational dataset every hospital chart should derive from. */
export interface HospitalDataset {
  /** `"YYYY-MM-DD"` — the fixed "today" the dataset is built around. */
  anchorDate: string;
  /** 12 buckets, oldest first; the last one is month-to-date. */
  months: MonthMeta[];
  departments: Department[];
  doctors: Doctor[];
  services: ServiceCatalogItem[];
  patients: Patient[];
  encounters: Encounter[];
  encounterServices: EncounterService[];
  billings: Billing[];
  claims: PhilHealthClaim[];
  pwdDiscounts: PWDDiscount[];
  feedback: Feedback[];
  index: HospitalDatasetIndex;
}
