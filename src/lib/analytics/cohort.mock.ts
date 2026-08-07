/**
 * Synthetic patient-level dataset for the Hospital Cohort Builder
 * (`/analytics/cohorts`). Mirrors FHIR Patient + Condition + Encounter +
 * Coverage resources flattened for query-building. This is a separate,
 * wider sample than the ~300/month admissions volume used on the
 * Executive dashboard, since a cohort tool needs enough rows for filters
 * to behave meaningfully.
 */
import { PH_DEPARTMENTS, PH_PAYER_MIX, PH_TOP_DIAGNOSES, phPatientName } from "./ph-constants";

function seeded(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function seededRange(i: number, min: number, max: number, salt: number): number {
  return min + seeded(i, salt) * (max - min);
}

export interface CohortPatient {
  patientId: string;
  name: string;
  age: number;
  gender: "male" | "female";
  department: string;
  diagnosisCode: string;
  diagnosisDesc: string;
  payer: string;
  admissionType: "Emergency" | "Elective" | "Transfer-in" | "Newborn";
  lastEncounterDate: string;
  readmitted30d: boolean;
  labAbnormalFlag: boolean;
}

const departments = PH_DEPARTMENTS;
const payers = ["PhilHealth", "HMO", "Private Pay", "SC/PWD Discount", "GSIS/Other"];
const payerWeights = [
  PH_PAYER_MIX.philhealth,
  PH_PAYER_MIX.hmo,
  PH_PAYER_MIX.privatePay,
  PH_PAYER_MIX.scpwd,
  PH_PAYER_MIX.gsis + PH_PAYER_MIX.writeoff,
];
function weightedPayer(i: number): string {
  const r = seeded(i, 70);
  let cursor = 0;
  for (let k = 0; k < payers.length; k++) {
    cursor += payerWeights[k]!;
    if (r <= cursor) return payers[k]!;
  }
  return payers[payers.length - 1]!;
}
const admissionTypes: CohortPatient["admissionType"][] = [
  "Emergency",
  "Elective",
  "Transfer-in",
  "Newborn",
];
const diagnoses: [string, string][] = PH_TOP_DIAGNOSES.map((d) => [d.code, d.description]);

function buildCohortPatients(count: number): CohortPatient[] {
  return Array.from({ length: count }, (_, i) => {
    const dx = diagnoses[i % diagnoses.length]!;
    const day = 1 + Math.round(seededRange(i, 0, 210, 40));
    const date = new Date(2026, 0, 1);
    date.setDate(date.getDate() + day);
    const gender: CohortPatient["gender"] = i % 2 === 0 ? "female" : "male";
    return {
      patientId: `PT-2026-${(1000 + i * 3).toString()}`,
      name: phPatientName(i, gender),
      age: Math.round(seededRange(i, 1, 88, 1)),
      gender,
      department: departments[i % departments.length]!,
      diagnosisCode: dx[0],
      diagnosisDesc: dx[1],
      payer: weightedPayer(i),
      admissionType: admissionTypes[i % admissionTypes.length]!,
      lastEncounterDate: date.toISOString().slice(0, 10),
      readmitted30d: seeded(i, 50) > 0.82,
      labAbnormalFlag: seeded(i, 51) > 0.7,
    };
  });
}

export const cohortPatients: CohortPatient[] = buildCohortPatients(300);
export const cohortDepartments = departments;
export const cohortPayers = payers;
export const cohortAdmissionTypes = admissionTypes;
export const cohortDiagnoses = diagnoses;

export function fetchCohortPatients(): Promise<CohortPatient[]> {
  return new Promise((resolve) => setTimeout(() => resolve(cohortPatients), 400));
}
