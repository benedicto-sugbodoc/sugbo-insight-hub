/**
 * Shared synthetic hospital dataset — public entry point.
 *
 * ```ts
 * import { getHospitalDataset, revenueByDepartment } from "@/lib/data/hospital";
 *
 * const dataset = getHospitalDataset();
 * const rows = revenueByDepartment(dataset, { from: "2026-01-01" });
 * ```
 *
 * `getHospitalDataset()` builds the dataset the first time it is called and
 * memoizes it in a module-level singleton, mirroring the `getXData()`
 * convention already used by `src/lib/analytics/executive.mock.ts` and friends
 * (with the addition of caching, because this dataset is shared by every page
 * rather than owned by one dashboard).
 */

import type { HospitalDataset } from "./entities";
import { generateHospitalDataset } from "./generate";

let cached: HospitalDataset | null = null;

/** The shared dataset. Built once per module instance, then reused. */
export function getHospitalDataset(): HospitalDataset {
  if (cached === null) {
    cached = generateHospitalDataset();
  }
  return cached;
}

/** Promise-returning variant, matching the `fetchXData()` convention. */
export function fetchHospitalDataset(): Promise<HospitalDataset> {
  return Promise.resolve(getHospitalDataset());
}

/** Test/debug hook — forces the next `getHospitalDataset()` call to regenerate. */
export function resetHospitalDataset(): void {
  cached = null;
}

export { generateHospitalDataset } from "./generate";

export type {
  AdmissionType,
  AppealStatus,
  Billing,
  ClaimCaseType,
  ClaimStatus,
  Department,
  DepartmentCategory,
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
  PaymentStatus,
  PWDDiscount,
  PhilHealthCategory,
  PhilHealthClaim,
  PhilHealthMemberCategory,
  ServiceCatalogItem,
  ServiceCategory,
} from "./entities";

export {
  CLAIM_DENIAL_REASONS,
  DATASET_ANCHOR_DATE,
  DATASET_MONTHS,
  DEPARTMENT_PROFILES,
  DIAGNOSIS_MISSING_RATE,
  FEEDBACK_RESPONSE_RATE,
  LOS_OUTLIER_RATE,
  PHILHEALTH_BEARING_PAYERS,
  PWD_DISCOUNT_RATE,
  PWD_PATIENT_RATE,
  PWD_QUALIFYING_CATEGORIES,
  PAYER_TYPES,
  TARGET_ENCOUNTER_COUNT,
  TARGET_PATIENT_COUNT,
} from "./reference";

export {
  MS_DAY,
  MS_HOUR,
  ageBand,
  ageOn,
  daysBetween,
  monthKeyOf,
  monthLabel,
  parseDate,
  toDate,
  toDateTime,
  toMs,
} from "./time";

export { clamp, round2, seeded, seededRange } from "./random";

export {
  arAgingByPayer,
  claimDenialReasons,
  claimTurnaroundByDepartment,
  claimsByStatus,
  datasetSummary,
  doctorProductivity,
  feedbackByCategory,
  filterEncounters,
  losStatsByDepartment,
  npsByDepartment,
  patientAgeMix,
  payerMix,
  paymentStatusBreakdown,
  pwdDiscountByDepartment,
  readmissionRateByPayerAndDepartment,
  revenueByDepartment,
  revenueByMonth,
  serviceUtilization,
  topDiagnoses,
  volumeByDepartment,
  volumeByDepartmentAndMonth,
  volumeByEncounterType,
  volumeByWeekdayHour,
} from "./derive";

export type {
  AgeMixRow,
  ArAgingRow,
  ClaimStatusRow,
  ClaimTurnaroundRow,
  DatasetSummary,
  DenialReasonRow,
  DepartmentRevenueRow,
  DepartmentVolumeRow,
  DiagnosisRow,
  DoctorProductivityRow,
  EncounterFilter,
  EncounterTypeRow,
  FeedbackCategoryRow,
  LosStatsRow,
  MonthlyDepartmentVolumeRow,
  MonthlyRevenueRow,
  NpsRow,
  PayerMixRow,
  PaymentStatusRow,
  PwdDiscountRow,
  ReadmissionRow,
  ServiceUtilizationRow,
  WeekdayHourCell,
} from "./derive";
