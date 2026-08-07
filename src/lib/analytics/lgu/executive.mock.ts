/**
 * Mock data for the LGU / City Health Center Executive (CHO) Dashboard
 * (Type B — Dashboard 7). FHIR shapes mirror Type A conventions:
 * Encounter (Konsulta), Claim/eKAS, Condition (ICD-10 A15-A19 TB, I10 HTN,
 * E11 DM), Observation (vital-signs, LOINC 4548-4 HbA1c).
 */
import {
  BARANGAYS,
  BHC_LIST,
  months12,
  epiWeeks,
  seeded,
  seededRange,
  TOTAL_POPULATION,
} from "./shared.mock";
import { KONSULTA_EKAS_RATE } from "../ph-constants";

export interface BarangayMetricSet {
  id: string;
  name: string;
  population: number;
  bhc: string;
  phn: string;
  visitDensity: number; // per 1000 population
  immunizationCoverage: number; // %
  tbCases: number;
  hypertensionPrevalence: number; // %
  maternalCoverage: number; // %
  dengueCases: number;
  registeredPatients: number;
  visitsByType: { type: string; count: number }[];
  topDiagnoses: { code: string; description: string; count: number }[];
  immunizationByAntigen: { antigen: string; coverage: number }[];
  maternalRiskCount: { risk: string; count: number }[];
  tbOnTreatment: number;
  activeReferrals: number;
}

export const CHOROPLETH_METRICS = [
  { key: "visitDensity", label: "Konsulta visit density (per 1,000 pop.)", unit: "" },
  { key: "immunizationCoverage", label: "Immunization coverage rate", unit: "%" },
  { key: "tbCases", label: "TB case count", unit: "" },
  { key: "hypertensionPrevalence", label: "Hypertension prevalence", unit: "%" },
  { key: "maternalCoverage", label: "Maternal care coverage", unit: "%" },
  { key: "dengueCases", label: "Dengue case count", unit: "" },
] as const;

export type ChoroplethMetricKey = (typeof CHOROPLETH_METRICS)[number]["key"];

const antigens = ["BCG", "HepB", "Penta", "OPV", "PCV", "MMR", "Rota"];

function buildBarangayData(): BarangayMetricSet[] {
  return BARANGAYS.map((b, i) => ({
    id: b.id,
    name: b.name,
    population: b.population,
    bhc: b.bhc,
    phn: b.phn,
    visitDensity: Math.round(seededRange(i, 18, 62, 1) * 10) / 10,
    immunizationCoverage: Math.round(seededRange(i, 74, 98, 2) * 10) / 10,
    tbCases: Math.round(seededRange(i, 2, 26, 3)),
    hypertensionPrevalence: Math.round(seededRange(i, 12, 34, 4) * 10) / 10,
    maternalCoverage: Math.round(seededRange(i, 52, 92, 5) * 10) / 10,
    dengueCases: Math.round(seededRange(i, 0, 14, 6)),
    registeredPatients: Math.round(b.population * seededRange(i, 0.55, 0.82, 7)),
    visitsByType: [
      { type: "Konsulta OPD", count: Math.round(seededRange(i, 320, 980, 8)) },
      { type: "Immunization", count: Math.round(seededRange(i, 80, 260, 9)) },
      { type: "ANC", count: Math.round(seededRange(i, 40, 140, 10)) },
      { type: "TB-DOTS", count: Math.round(seededRange(i, 8, 40, 11)) },
      { type: "NCD follow-up", count: Math.round(seededRange(i, 60, 210, 12)) },
    ],
    topDiagnoses: [
      {
        code: "J00",
        description: "Acute nasopharyngitis (common cold)",
        count: Math.round(seededRange(i, 60, 180, 13)),
      },
      {
        code: "I10",
        description: "Essential hypertension",
        count: Math.round(seededRange(i, 50, 160, 14)),
      },
      {
        code: "E11.9",
        description: "Type 2 diabetes mellitus",
        count: Math.round(seededRange(i, 30, 110, 15)),
      },
      {
        code: "A09",
        description: "Diarrhea and gastroenteritis",
        count: Math.round(seededRange(i, 20, 90, 16)),
      },
      { code: "A90", description: "Dengue fever", count: Math.round(seededRange(i, 2, 30, 17)) },
    ],
    immunizationByAntigen: antigens.map((antigen, k) => ({
      antigen,
      coverage: Math.round(seededRange(i * 7 + k, 70, 99, 18)),
    })),
    maternalRiskCount: [
      { risk: "Low risk", count: Math.round(seededRange(i, 40, 120, 19)) },
      { risk: "High risk", count: Math.round(seededRange(i, 6, 28, 20)) },
      { risk: "Very high risk", count: Math.round(seededRange(i, 0, 6, 21)) },
    ],
    tbOnTreatment: Math.round(seededRange(i, 4, 22, 22)),
    activeReferrals: Math.round(seededRange(i, 2, 18, 23)),
  }));
}

export interface DiseaseCurvePoint {
  period: string;
  dengue: number;
  measles: number;
  diarrhea: number;
  ari: number;
  dengueBaseline: number;
  measlesBaseline: number;
  diarrheaBaseline: number;
  ariBaseline: number;
}

function buildEpiCurve(): DiseaseCurvePoint[] {
  return epiWeeks.map((period, i) => {
    const dengueBaseline = 14 + Math.round(Math.sin(i / 2) * 3);
    const dengue =
      i >= 8
        ? Math.round(dengueBaseline * seededRange(i, 2.1, 3.4, 30))
        : Math.round(dengueBaseline * seededRange(i, 0.8, 1.3, 30));
    return {
      period,
      dengue,
      measles: Math.round(seededRange(i, 1, 6, 31)),
      diarrhea: Math.round(seededRange(i, 8, 22, 32)),
      ari: Math.round(seededRange(i, 20, 48, 33)),
      dengueBaseline,
      measlesBaseline: 4,
      diarrheaBaseline: 14,
      ariBaseline: 32,
    };
  });
}

export interface MorbidityRow {
  code: string;
  description: string;
  current: number;
  priorMonth: number;
  priorYear: number;
}

const morbidityAllAges: MorbidityRow[] = [
  {
    code: "J00",
    description: "Acute nasopharyngitis (common cold)",
    current: 1840,
    priorMonth: 1720,
    priorYear: 1590,
  },
  {
    code: "I10",
    description: "Essential hypertension",
    current: 1620,
    priorMonth: 1580,
    priorYear: 1440,
  },
  {
    code: "E11.9",
    description: "Type 2 diabetes mellitus",
    current: 1120,
    priorMonth: 1080,
    priorYear: 960,
  },
  {
    code: "A09",
    description: "Diarrhea and gastroenteritis",
    current: 940,
    priorMonth: 860,
    priorYear: 1010,
  },
  {
    code: "J06.9",
    description: "Upper respiratory tract infection",
    current: 880,
    priorMonth: 920,
    priorYear: 840,
  },
  { code: "M79.1", description: "Myalgia", current: 640, priorMonth: 600, priorYear: 580 },
  {
    code: "L23.9",
    description: "Allergic contact dermatitis",
    current: 560,
    priorMonth: 540,
    priorYear: 510,
  },
  {
    code: "N39.0",
    description: "Urinary tract infection",
    current: 520,
    priorMonth: 480,
    priorYear: 470,
  },
  { code: "A90", description: "Dengue fever", current: 480, priorMonth: 210, priorYear: 260 },
  {
    code: "K29.7",
    description: "Gastritis, unspecified",
    current: 410,
    priorMonth: 400,
    priorYear: 380,
  },
];

const morbidityUnder5: MorbidityRow[] = [
  {
    code: "J00",
    description: "Acute nasopharyngitis (common cold)",
    current: 620,
    priorMonth: 560,
    priorYear: 540,
  },
  {
    code: "A09",
    description: "Diarrhea and gastroenteritis",
    current: 480,
    priorMonth: 420,
    priorYear: 510,
  },
  {
    code: "J06.9",
    description: "Upper respiratory tract infection",
    current: 410,
    priorMonth: 390,
    priorYear: 360,
  },
  {
    code: "B01.9",
    description: "Varicella (chickenpox)",
    current: 180,
    priorMonth: 140,
    priorYear: 120,
  },
  {
    code: "E44",
    description: "Protein-energy malnutrition, moderate",
    current: 160,
    priorMonth: 158,
    priorYear: 172,
  },
  {
    code: "L23.9",
    description: "Allergic contact dermatitis",
    current: 140,
    priorMonth: 132,
    priorYear: 128,
  },
  {
    code: "J18.9",
    description: "Pneumonia, unspecified",
    current: 120,
    priorMonth: 108,
    priorYear: 130,
  },
  { code: "P59.9", description: "Neonatal jaundice", current: 90, priorMonth: 84, priorYear: 88 },
  { code: "A90", description: "Dengue fever", current: 80, priorMonth: 30, priorYear: 44 },
  {
    code: "B82.9",
    description: "Intestinal parasitism",
    current: 74,
    priorMonth: 70,
    priorYear: 82,
  },
];

export interface LguExecutiveData {
  tenant: string;
  jurisdiction: string;
  period: string;
  priorPeriod: string;
  role: string;
  totalPopulation: number;
  konsultaVisits: {
    total: number;
    deltaMonth: number;
    deltaYear: number;
    byWeekday: { day: string; visits: number }[];
    byBhc: { name: string; value: number }[];
  };
  ekas: {
    submitted: number;
    value: number;
    delta: number;
    byStatus: { status: string; count: number; color: string }[];
    byBhc: { name: string; value: number }[];
    daysToCutoff: number;
    unsettledCount: number;
  };
  tbDots: {
    activeCases: number;
    delta: number;
    byBarangay: { name: string; value: number }[];
    byPhase: { phase: string; count: number }[];
    treatmentSuccessRate: number;
  };
  immunization: {
    coverage: number;
    delta: number;
    byAntigen: { antigen: string; coverage: number }[];
    byAgeGroup: { group: string; coverage: number }[];
  };
  maternalCoverage: {
    value: number;
    delta: number;
    byTrimester: { trimester: string; count: number }[];
    byRisk: { risk: string; count: number }[];
  };
  htnControl: { value: number; delta: number };
  dmControl: { value: number; delta: number };
  referralCompletion: {
    value: number;
    delta: number;
    byDestination: { name: string; value: number }[];
    byOutcome: { outcome: string; count: number; color: string }[];
  };
  barangays: BarangayMetricSet[];
  epiCurve: DiseaseCurvePoint[];
  morbidity: { allAges: MorbidityRow[]; under5: MorbidityRow[] };
  outbreaks: { name: string; ratio: number; weeks: number }[];
}

export function getLguExecutiveData(): LguExecutiveData {
  const barangays = buildBarangayData();
  return {
    tenant: "Cebu City Health Office",
    jurisdiction: "City Health Center → 15 Barangay Health Centers",
    period: "August 2026 (MTD)",
    priorPeriod: "July 2026",
    role: "City Health Officer / Municipal Health Officer",
    totalPopulation: TOTAL_POPULATION,
    konsultaVisits: {
      total: 18420,
      deltaMonth: 6.8,
      deltaYear: 12.4,
      byWeekday: [
        { day: "Mon", visits: 3620 },
        { day: "Tue", visits: 3310 },
        { day: "Wed", visits: 3180 },
        { day: "Thu", visits: 3040 },
        { day: "Fri", visits: 3480 },
        { day: "Sat", visits: 1580 },
        { day: "Sun", visits: 210 },
      ],
      byBhc: BHC_LIST.map((bhc) => ({
        name: bhc,
        value: barangays
          .filter((b) => b.bhc === bhc)
          .reduce((s, b) => s + (b.visitsByType[0]?.count ?? 0), 0),
      })),
    },
    ekas: {
      submitted: 14620,
      value: 14620 * KONSULTA_EKAS_RATE,
      delta: 4.2,
      byStatus: [
        { status: "Submitted", count: 5210, color: "#8A8F98" },
        { status: "Approved", count: 8480, color: "#1A7A3C" },
        { status: "Denied", count: 620, color: "#C0392B" },
        { status: "Pending CSF", count: 310, color: "#E67E22" },
      ],
      byBhc: BHC_LIST.map((bhc, i) => ({
        name: bhc,
        value: Math.round(seededRange(i, 480, 1600, 40) * 3),
      })),
      daysToCutoff: 4,
      unsettledCount: 186,
    },
    tbDots: {
      activeCases: barangays.reduce((s, b) => s + b.tbOnTreatment, 0),
      delta: -4.6,
      byBarangay: barangays.map((b) => ({ name: b.name, value: b.tbCases })),
      byPhase: [
        { phase: "Intensive phase", count: 84 },
        { phase: "Continuation phase", count: 132 },
        { phase: "Completed this month", count: 22 },
      ],
      treatmentSuccessRate: 88.4,
    },
    immunization: {
      coverage: 91.2,
      delta: 1.8,
      byAntigen: antigens.map((antigen, i) => ({
        antigen,
        coverage: Math.round(seededRange(i, 78, 98, 41)),
      })),
      byAgeGroup: [
        { group: "0–11 months", coverage: 93.4 },
        { group: "12–23 months", coverage: 89.6 },
        { group: "24–59 months", coverage: 86.2 },
      ],
    },
    maternalCoverage: {
      value: 76.8,
      delta: 3.1,
      byTrimester: [
        { trimester: "1st trimester", count: 420 },
        { trimester: "2nd trimester", count: 380 },
        { trimester: "3rd trimester", count: 340 },
      ],
      byRisk: [
        { risk: "Low risk", count: 940 },
        { risk: "High risk", count: 186 },
        { risk: "Very high risk", count: 34 },
      ],
    },
    htnControl: { value: 41.6, delta: 2.4 },
    dmControl: { value: 36.2, delta: 1.6 },
    referralCompletion: {
      value: 71.4,
      delta: -2.8,
      byDestination: [
        { name: "Cebu City Medical Center", value: 214 },
        { name: "Vicente Sotto Memorial", value: 96 },
        { name: "Cebu South Med Center", value: 58 },
        { name: "Private partner hospitals", value: 40 },
      ],
      byOutcome: [
        { outcome: "Completed & documented", count: 296, color: "#1A7A3C" },
        { outcome: "Referred, no feedback", count: 84, color: "#E67E22" },
        { outcome: "Not yet seen", count: 28, color: "#C0392B" },
      ],
    },
    barangays,
    epiCurve: buildEpiCurve(),
    morbidity: { allAges: morbidityAllAges, under5: morbidityUnder5 },
    outbreaks: [{ name: "Dengue", ratio: 2.6, weeks: 3 }],
  };
}

export function fetchLguExecutiveData(): Promise<LguExecutiveData> {
  return new Promise((resolve) => setTimeout(() => resolve(getLguExecutiveData()), 500));
}

export { months12 };
