/**
 * Mock data for the Maternal & Child Health Dashboard (Type B — Dashboard 8).
 * FHIR alignment: Patient (pregnancy episode), Encounter (ANC visit,
 * delivery), Observation (newborn screening, growth/anthropometry),
 * Condition (maternal risk factors), Immunization (antigen doses).
 */
import { BARANGAYS, months12, seeded, seededRange, personName, patientId } from "./shared.mock";

export interface AncFunnelStage {
  id: string;
  label: string;
  value: number;
}

export interface RiskPatient {
  id: string;
  name: string;
  barangay: string;
  risk: "Low Risk" | "High Risk" | "Very High Risk";
  gestWeeks: number;
  contact: string;
  flags: string[];
}

export interface MaternalData {
  tenant: string;
  period: string;
  ancFunnel: AncFunnelStage[];
  funnelByBarangay: Record<string, AncFunnelStage[]>;
  ancCoverageByBarangay: { name: string; coverage: number }[];
  riskStrat: { risk: string; count: number; color: string }[];
  riskPatients: RiskPatient[];
  gestAgeHistogram: { bucket: string; count: number; band: "early" | "mid" | "late" }[];
  deliveryOutcome: { month: string; facility: number; hospital: number; home: number }[];
  complications: {
    month: string;
    pph: number;
    preeclampsia: number;
    obstructedLabor: number;
    sepsis: number;
    ucl: number;
  }[];
  newbornScreening: {
    label: string;
    completion: number;
    incomplete: { name: string; barangay: string }[];
  }[];
  immunizationRadar: { label: string; value: number }[];
  immunizationByBarangay: { name: string; coverage: number }[];
  nutrition: { ageGroup: string; stunted: number; wasted: number; underweight: number }[];
  growthMonitoring: { month: string; coverage: number }[];
  growthByBarangay: { name: string; trend: number[] }[];
}

const ancStages: AncFunnelStage[] = [
  { id: "registered", label: "Registered pregnant women", value: 1420 },
  { id: "first-visit", label: "Had 1st ANC visit (1st trimester)", value: 1180 },
  { id: "four-plus", label: "Had 4+ ANC visits (complete)", value: 940 },
  { id: "delivered", label: "Delivered at facility", value: 860 },
  { id: "postpartum", label: "48h postpartum check completed", value: 742 },
];

function buildRiskPatients(): RiskPatient[] {
  const risks: RiskPatient["risk"][] = [
    "Low Risk",
    "Low Risk",
    "Low Risk",
    "High Risk",
    "High Risk",
    "Very High Risk",
  ];
  const flagSets = [
    ["Routine"],
    ["Routine"],
    ["First pregnancy"],
    ["Gestational hypertension"],
    ["Previous C-section"],
    ["Pre-eclampsia risk", "HIV screening pending"],
  ];
  return Array.from({ length: 18 }, (_, i) => {
    const b = BARANGAYS[i % BARANGAYS.length]!;
    const risk = risks[i % risks.length]!;
    return {
      id: `MAT-${1000 + i}`,
      name: personName(i),
      barangay: b.name,
      risk,
      gestWeeks: Math.round(seededRange(i, 8, 38, 51)),
      contact: `09${String(150000000 + i * 7654321).slice(0, 9)}`,
      flags: flagSets[i % flagSets.length]!,
    };
  });
}

function buildGestAge() {
  const buckets = [
    "0-4",
    "5-8",
    "9-12",
    "13-16",
    "17-20",
    "21-24",
    "25-28",
    "29-32",
    "33-36",
    "37-40",
  ];
  return buckets.map((bucket, i) => {
    const upper = Number(bucket.split("-")[1]);
    const band: "early" | "mid" | "late" = upper <= 12 ? "early" : upper <= 20 ? "mid" : "late";
    const base =
      upper <= 12
        ? seededRange(i, 140, 260, 52)
        : upper <= 20
          ? seededRange(i, 60, 160, 52)
          : seededRange(i, 10, 70, 52);
    return { bucket, count: Math.round(base), band };
  });
}

export function getMaternalData(): MaternalData {
  const funnelByBarangay: Record<string, AncFunnelStage[]> = {};
  BARANGAYS.forEach((b, i) => {
    const scale = seededRange(i, 0.03, 0.09, 60);
    funnelByBarangay[b.name] = ancStages.map((s, k) => ({
      ...s,
      value: Math.round(s.value * scale * (1 - k * 0.02)),
    }));
  });

  return {
    tenant: "Cebu City Health Office",
    period: "August 2026 (MTD)",
    ancFunnel: ancStages,
    funnelByBarangay,
    ancCoverageByBarangay: BARANGAYS.map((b, i) => ({
      name: b.name,
      coverage: Math.round(seededRange(i, 52, 94, 61) * 10) / 10,
    })).sort((a, b) => a.coverage - b.coverage),
    riskStrat: [
      { risk: "Low Risk", count: 940, color: "#1A7A3C" },
      { risk: "High Risk", count: 186, color: "#E67E22" },
      { risk: "Very High Risk", count: 34, color: "#8B0000" },
    ],
    riskPatients: buildRiskPatients(),
    gestAgeHistogram: buildGestAge(),
    deliveryOutcome: months12.map((month, i) => ({
      month,
      facility: 620 + Math.round(seededRange(i, -20, 40, 62)),
      hospital: 140 + Math.round(seededRange(i, -10, 20, 63)),
      home: Math.max(8, 60 - i * 3 + Math.round(seededRange(i, -6, 6, 64))),
    })),
    complications: months12.map((month, i) => ({
      month,
      pph: Math.round(seededRange(i, 4, 14, 65) * 10) / 10,
      preeclampsia: Math.round(seededRange(i, 6, 18, 66) * 10) / 10,
      obstructedLabor: Math.round(seededRange(i, 2, 8, 67) * 10) / 10,
      sepsis: Math.round(seededRange(i, 0, 4, 68) * 10) / 10,
      ucl: 20,
    })),
    newbornScreening: [
      {
        label: "Newborn Screening (blood)",
        completion: 94.2,
        incomplete: Array.from({ length: 6 }, (_, i) => ({
          name: personName(i + 40),
          barangay: BARANGAYS[i % BARANGAYS.length]!.name,
        })),
      },
      {
        label: "Hearing Screening",
        completion: 88.6,
        incomplete: Array.from({ length: 9 }, (_, i) => ({
          name: personName(i + 50),
          barangay: BARANGAYS[i % BARANGAYS.length]!.name,
        })),
      },
      {
        label: "EINC / Unang Yakap",
        completion: 97.8,
        incomplete: Array.from({ length: 3 }, (_, i) => ({
          name: personName(i + 60),
          barangay: BARANGAYS[i % BARANGAYS.length]!.name,
        })),
      },
      {
        label: "BCG at birth",
        completion: 91.4,
        incomplete: Array.from({ length: 7 }, (_, i) => ({
          name: personName(i + 70),
          barangay: BARANGAYS[i % BARANGAYS.length]!.name,
        })),
      },
    ],
    immunizationRadar: [
      { label: "BCG", value: 96 },
      { label: "HepB", value: 94 },
      { label: "Penta", value: 89 },
      { label: "OPV", value: 91 },
      { label: "PCV", value: 86 },
      { label: "MMR", value: 82 },
      { label: "Rota", value: 79 },
      { label: "Influenza", value: 68 },
      { label: "COVID", value: 74 },
    ],
    immunizationByBarangay: BARANGAYS.map((b, i) => ({
      name: b.name,
      coverage: Math.round(seededRange(i, 74, 98, 70)),
    })),
    nutrition: [
      { ageGroup: "0–6m", stunted: 4.2, wasted: 2.1, underweight: 3.4 },
      { ageGroup: "6–12m", stunted: 8.6, wasted: 4.8, underweight: 6.9 },
      { ageGroup: "1–2y", stunted: 14.2, wasted: 6.4, underweight: 10.8 },
      { ageGroup: "2–5y", stunted: 18.6, wasted: 5.2, underweight: 12.4 },
    ],
    growthMonitoring: months12.map((month, i) => ({
      month,
      coverage: Math.round(seededRange(i, 62, 86, 71)),
    })),
    growthByBarangay: BARANGAYS.map((b, i) => ({
      name: b.name,
      trend: Array.from({ length: 6 }, (_, k) => Math.round(seededRange(i * 6 + k, 55, 90, 72))),
    })),
  };
}

export function fetchMaternalData(): Promise<MaternalData> {
  return new Promise((resolve) => setTimeout(() => resolve(getMaternalData()), 500));
}
