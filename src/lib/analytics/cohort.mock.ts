/**
 * Synthetic patient-level dataset for the Hospital Cohort Builder
 * (`/analytics/cohorts`). Mirrors FHIR Patient + Condition + Encounter +
 * Coverage resources flattened for query-building. This is a separate,
 * wider sample than the 24-row `admissions.rows` used on the Executive
 * dashboard, since a cohort tool needs enough rows for filters to behave
 * meaningfully.
 */

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

const departments = [
  "Internal Medicine",
  "Surgery",
  "Obstetrics",
  "Pediatrics",
  "Orthopedics",
  "Cardiology",
];
const payers = ["PhilHealth", "HMO", "Private Pay", "SC/PWD Discount", "GSIS/Other"];
const admissionTypes: CohortPatient["admissionType"][] = [
  "Emergency",
  "Elective",
  "Transfer-in",
  "Newborn",
];
const diagnoses: [string, string][] = [
  ["J44.9", "COPD, unspecified"],
  ["I10", "Essential hypertension"],
  ["E11.9", "Type 2 diabetes mellitus"],
  ["A09", "Gastroenteritis and colitis"],
  ["N39.0", "Urinary tract infection"],
  ["J18.9", "Pneumonia, unspecified"],
  ["S52.5", "Fracture of lower forearm"],
  ["K29.7", "Gastritis"],
  ["O80", "Single spontaneous delivery"],
  ["M25.5", "Joint pain"],
  ["I21.9", "Acute myocardial infarction"],
  ["A41.9", "Sepsis, unspecified organism"],
];
const surnames = [
  "Reyes",
  "Dela Cruz",
  "Garcia",
  "Lim",
  "Bautista",
  "Tan",
  "Santos",
  "Pascual",
  "Fernandez",
  "Ramos",
  "Abella",
  "Yap",
  "Cordova",
  "Villanueva",
  "Mercado",
];
const givenNames = ["Maria", "Juan", "Ana", "Paolo", "Liza", "Carlo", "Grace", "Noel"];

function buildCohortPatients(count: number): CohortPatient[] {
  return Array.from({ length: count }, (_, i) => {
    const dx = diagnoses[i % diagnoses.length]!;
    const day = 1 + Math.round(seededRange(i, 0, 210, 40));
    const date = new Date(2026, 0, 1);
    date.setDate(date.getDate() + day);
    return {
      patientId: `PT-2026-${(1000 + i * 3).toString()}`,
      name: `${surnames[i % surnames.length]}, ${givenNames[i % givenNames.length]} ${String.fromCharCode(65 + (i % 26))}.`,
      age: Math.round(seededRange(i, 1, 88, 1)),
      gender: i % 2 === 0 ? "female" : "male",
      department: departments[i % departments.length]!,
      diagnosisCode: dx[0],
      diagnosisDesc: dx[1],
      payer: payers[i % payers.length]!,
      admissionType: admissionTypes[i % admissionTypes.length]!,
      lastEncounterDate: date.toISOString().slice(0, 10),
      readmitted30d: seeded(i, 50) > 0.82,
      labAbnormalFlag: seeded(i, 51) > 0.7,
    };
  });
}

export const cohortPatients: CohortPatient[] = buildCohortPatients(240);
export const cohortDepartments = departments;
export const cohortPayers = payers;
export const cohortAdmissionTypes = admissionTypes;
export const cohortDiagnoses = diagnoses;

export function fetchCohortPatients(): Promise<CohortPatient[]> {
  return new Promise((resolve) => setTimeout(() => resolve(cohortPatients), 400));
}
