/**
 * Synthetic community-patient dataset for the LGU Cohort Builder
 * (`/lgu/analytics/cohorts`). Mirrors FHIR Patient (address.district ->
 * barangay) + Condition + Immunization + Encounter resources, flattened
 * for query-building across the 15-barangay catchment.
 */
import { BARANGAYS, patientId, personName, seeded, seededRange } from "./shared.mock";

export interface CommunityPatient {
  patientId: string;
  name: string;
  age: number;
  gender: "male" | "female";
  barangayId: string;
  barangayName: string;
  diagnosisCode: string;
  diagnosisDesc: string;
  pregnant: boolean;
  fullyImmunized: boolean;
  hypertensive: boolean;
  diabetic: boolean;
  tbCase: boolean;
  dengueCase: boolean;
  lastVisitDate: string;
}

const diagnoses: [string, string][] = [
  ["J00", "Acute nasopharyngitis (common cold)"],
  ["I10", "Essential hypertension"],
  ["E11.9", "Type 2 diabetes mellitus"],
  ["A09", "Diarrhea and gastroenteritis"],
  ["A90", "Dengue fever"],
  ["A15.0", "Pulmonary tuberculosis"],
  ["Z34.9", "Normal pregnancy supervision"],
  ["M79.1", "Myalgia"],
];

function buildCommunityPatients(count: number): CommunityPatient[] {
  return Array.from({ length: count }, (_, i) => {
    const dx = diagnoses[i % diagnoses.length]!;
    const brgy = BARANGAYS[i % BARANGAYS.length]!;
    const gender: CommunityPatient["gender"] = i % 2 === 0 ? "female" : "male";
    const age = Math.round(seededRange(i, 0, 84, 60));
    const day = Math.round(seededRange(i, 0, 210, 61));
    const date = new Date(2026, 0, 1);
    date.setDate(date.getDate() + day);
    return {
      patientId: patientId(i + 500),
      name: personName(i + 5),
      age,
      gender,
      barangayId: brgy.id,
      barangayName: brgy.name,
      diagnosisCode: dx[0],
      diagnosisDesc: dx[1],
      pregnant: gender === "female" && age >= 15 && age <= 45 && seeded(i, 62) > 0.86,
      fullyImmunized: age < 5 ? seeded(i, 63) > 0.22 : seeded(i, 63) > 0.08,
      hypertensive: age >= 30 && seeded(i, 64) > 0.68,
      diabetic: age >= 30 && seeded(i, 65) > 0.78,
      tbCase: seeded(i, 66) > 0.92,
      dengueCase: dx[0] === "A90" || seeded(i, 67) > 0.94,
      lastVisitDate: date.toISOString().slice(0, 10),
    };
  });
}

export const communityPatients: CommunityPatient[] = buildCommunityPatients(320);

export function fetchCommunityPatients(): Promise<CommunityPatient[]> {
  return new Promise((resolve) => setTimeout(() => resolve(communityPatients), 400));
}
