/**
 * Mock data for the NCD (Non-Communicable Disease) Management Dashboard
 * (Type B — Dashboard 9). FHIR alignment: Condition (I10 hypertension,
 * E10/E11 diabetes), Observation (vital-signs BP, LOINC 2345-7 FBS,
 * LOINC 4548-4 HbA1c), MedicationRequest (antihypertensive/antidiabetic).
 */
import { BARANGAYS, months12, seededRange, personName } from "./shared.mock";
import { ComplianceCell } from "@/components/analytics/lgu-shared";

export interface NcdBarangay {
  id: string;
  name: string;
  htnPrevalence: number;
  dmPrevalence: number;
  obesityPrevalence: number;
  ncdIndex: number;
  patientCount: number;
  controlRate: number;
  referralCount: number;
  medicationCompliance: number;
}

export interface CascadeStage {
  id: string;
  label: string;
  value: number;
}

export interface NcdData {
  tenant: string;
  period: string;
  barangays: NcdBarangay[];
  htnCascade: CascadeStage[];
  dmCascade: CascadeStage[];
  complianceRows: string[];
  complianceColumns: string[];
  complianceMatrix: ComplianceCell[][];
  riskFactors: { metric: string; barangay: number; city: number; national: number }[];
}

function buildBarangays(): NcdBarangay[] {
  return BARANGAYS.map((b, i) => {
    const htn = Math.round(seededRange(i, 14, 32, 80) * 10) / 10;
    const dm = Math.round(seededRange(i, 8, 22, 81) * 10) / 10;
    const obesity = Math.round(seededRange(i, 10, 26, 82) * 10) / 10;
    return {
      id: b.id,
      name: b.name,
      htnPrevalence: htn,
      dmPrevalence: dm,
      obesityPrevalence: obesity,
      ncdIndex: Math.round((htn * 0.45 + dm * 0.35 + obesity * 0.2) * 10) / 10,
      patientCount: Math.round(seededRange(i, 180, 640, 83)),
      controlRate: Math.round(seededRange(i, 28, 58, 84)),
      referralCount: Math.round(seededRange(i, 4, 26, 85)),
      medicationCompliance: Math.round(seededRange(i, 48, 88, 86)),
    };
  });
}

function buildComplianceMatrix(): { rows: string[]; matrix: ComplianceCell[][] } {
  const rows = Array.from({ length: 10 }, (_, i) => personName(i + 100));
  const matrix: ComplianceCell[][] = rows.map((_, r) =>
    Array.from({ length: 12 }, (_, c) => {
      const s = seededRange(r * 12 + c, 0, 1, 87);
      if (r === 3 && c > 7) return "na";
      return s > 0.28 ? "ok" : "missed";
    }),
  );
  return { rows, matrix };
}

export function getNcdData(): NcdData {
  const barangays = buildBarangays();
  const { rows, matrix } = buildComplianceMatrix();
  return {
    tenant: "Cebu City Health Office",
    period: "August 2026 (MTD)",
    barangays,
    htnCascade: [
      { id: "estimated", label: "Estimated HTN in population", value: 62_400 },
      { id: "screened", label: "Screened for BP this year", value: 41_200 },
      { id: "diagnosed", label: "Diagnosed hypertensive", value: 28_600 },
      { id: "enrolled", label: "Enrolled in HTN monitoring", value: 19_800 },
      { id: "medicated", label: "On antihypertensive medication", value: 16_400 },
      { id: "controlled", label: "BP controlled (<140/90)", value: 8_820 },
    ],
    dmCascade: [
      { id: "estimated", label: "Estimated DM in population", value: 34_100 },
      { id: "screened", label: "Screened (FBS or OGTT)", value: 22_600 },
      { id: "diagnosed", label: "Diagnosed DM", value: 14_800 },
      { id: "enrolled", label: "Enrolled in DM management", value: 10_900 },
      { id: "medicated", label: "On antidiabetic medication", value: 9_200 },
      { id: "controlled", label: "HbA1c <7% (controlled)", value: 4_180 },
    ],
    complianceRows: rows,
    complianceColumns: months12.map((m) => m.split(" ")[0] ?? m),
    complianceMatrix: matrix,
    riskFactors: [
      { metric: "Smoking prevalence", barangay: 22.4, city: 19.8, national: 21.6 },
      { metric: "Alcohol use", barangay: 18.6, city: 20.2, national: 22.1 },
      { metric: "Physical inactivity", barangay: 36.2, city: 33.4, national: 39.5 },
      { metric: "Obesity (BMI ≥30)", barangay: 16.8, city: 15.2, national: 14.1 },
      { metric: "Hypercholesterolemia", barangay: 24.6, city: 22.9, national: 23.4 },
    ],
  };
}

export function fetchNcdData(): Promise<NcdData> {
  return new Promise((resolve) => setTimeout(() => resolve(getNcdData()), 500));
}
