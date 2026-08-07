/**
 * Mock data for the Laboratory Analytics dashboard.
 * Shapes mirror FHIR R4 resources (Observation, DiagnosticReport,
 * ServiceRequest) flattened for chart consumption.
 */

export type LabCategory =
  | "Hematology"
  | "Chemistry"
  | "Urinalysis"
  | "Microbiology"
  | "Immunology"
  | "Serology"
  | "Other";

export interface VolumeTrendPoint {
  month: string;
  Hematology: number;
  Chemistry: number;
  Urinalysis: number;
  Microbiology: number;
  Immunology: number;
  Serology: number;
  Other: number;
}

export interface TatOutlier {
  id: string;
  category: LabCategory;
  patient: string;
  patientId: string;
  test: string;
  orderedAt: string;
  releasedAt: string;
  tatMinutes: number;
  delayReason: string;
}

export interface TatBoxStat {
  category: LabCategory;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  targetTat: number;
  outliers: TatOutlier[];
}

export interface CriticalResponseBar {
  category: LabCategory;
  department: string;
  withinTargetPct: number;
  target: number;
  sampleSize: number;
}

export interface CriticalNotification {
  id: string;
  category: LabCategory;
  department: string;
  test: string;
  patient: string;
  minutesToNotify: number;
  outlier: boolean;
}

export interface AbnormalTestRow {
  test: string;
  category: LabCategory;
  totalResults: number;
  abnormalPct: number;
}

export interface UnmappedTest {
  test: string;
  category: LabCategory;
  monthlyVolume: number;
  priority: "High" | "Medium" | "Low";
}

export interface LaboratoryData {
  tenant: string;
  period: string;
  kpis: {
    totalTestsMtd: number;
    totalTestsDelta: number;
    tatCompliancePct: number;
    criticalResponseCompliancePct: number;
    abnormalRatePct: number;
    loincMappedPct: number;
  };
  volumeTrend: VolumeTrendPoint[];
  tatBox: TatBoxStat[];
  criticalBars: CriticalResponseBar[];
  criticalNotifications: CriticalNotification[];
  abnormalTests: AbnormalTestRow[];
  loinc: {
    mappedCount: number;
    totalCount: number;
    unmapped: UnmappedTest[];
  };
}

const categories: LabCategory[] = [
  "Hematology",
  "Chemistry",
  "Urinalysis",
  "Microbiology",
  "Immunology",
  "Serology",
  "Other",
];

const months = [
  "Sep 25",
  "Oct 25",
  "Nov 25",
  "Dec 25",
  "Jan 26",
  "Feb 26",
  "Mar 26",
  "Apr 26",
  "May 26",
  "Jun 26",
  "Jul 26",
  "Aug 26",
];

const volumeTrend: VolumeTrendPoint[] = months.map((month, i) => ({
  month,
  Hematology: 1180 + Math.round(Math.sin(i / 2) * 90) + i * 14,
  Chemistry: 1620 + Math.round(Math.cos(i / 3) * 130) + i * 20,
  Urinalysis: 860 + Math.round(Math.sin(i / 1.6) * 60) + i * 8,
  Microbiology: 340 + Math.round(Math.cos(i / 2.4) * 40) + i * 5,
  Immunology: 260 + Math.round(Math.sin(i / 2.1) * 30) + i * 3,
  Serology: 210 + Math.round(Math.cos(i / 1.9) * 24) + i * 2,
  Other: 130 + Math.round(Math.sin(i / 2.7) * 18) + i,
}));

const surnames = ["Reyes", "Dela Cruz", "Garcia", "Lim", "Bautista", "Tan", "Santos", "Pascual", "Fernandez", "Ramos"];
const firstNames = ["Maria", "Juan", "Ana", "Paolo", "Liza", "Carlo", "Grace", "Noel"];

function patientName(i: number) {
  return `${surnames[i % surnames.length]}, ${firstNames[i % firstNames.length]} ${String.fromCharCode(65 + (i % 26))}.`;
}

const delayReasons = [
  "Specimen recollection required (hemolyzed)",
  "Analyzer downtime — backup unit engaged",
  "Reagent stockout, awaiting delivery",
  "Send-out test, courier delay",
  "STAT queue backlog during shift change",
  "Manual differential review required",
];

function buildOutliers(category: LabCategory, count: number, base: number, seedOffset: number): TatOutlier[] {
  return Array.from({ length: count }, (_, i) => {
    const seed = seedOffset + i;
    const tat = Math.round(base * (2.2 + (seed % 5) * 0.6));
    const orderedHour = 6 + (seed % 12);
    return {
      id: `TAT-${category.slice(0, 3).toUpperCase()}-${1000 + seed}`,
      category,
      patient: patientName(seed),
      patientId: `PT-2026-00${(320 + seed * 9).toString()}`,
      test: `${category} panel`,
      orderedAt: `2026-08-${String(1 + (seed % 27)).padStart(2, "0")} ${String(orderedHour).padStart(2, "0")}:${String((seed * 7) % 60).padStart(2, "0")}`,
      releasedAt: `2026-08-${String(1 + (seed % 27)).padStart(2, "0")} ${String((orderedHour + Math.round(tat / 60)) % 24).padStart(2, "0")}:${String((seed * 11) % 60).padStart(2, "0")}`,
      tatMinutes: tat,
      delayReason: delayReasons[seed % delayReasons.length]!,
    };
  });
}

const tatBox: TatBoxStat[] = [
  { category: "Hematology", min: 18, q1: 32, median: 45, q3: 62, max: 95, targetTat: 60, outliers: buildOutliers("Hematology", 3, 60, 11) },
  { category: "Chemistry", min: 25, q1: 48, median: 68, q3: 92, max: 140, targetTat: 90, outliers: buildOutliers("Chemistry", 4, 90, 23) },
  { category: "Urinalysis", min: 10, q1: 18, median: 26, q3: 34, max: 52, targetTat: 40, outliers: buildOutliers("Urinalysis", 2, 40, 37) },
  { category: "Microbiology", min: 480, q1: 1080, median: 1440, q3: 2160, max: 2880, targetTat: 2880, outliers: buildOutliers("Microbiology", 3, 2880, 51) },
  { category: "Immunology", min: 60, q1: 150, median: 210, q3: 300, max: 420, targetTat: 240, outliers: buildOutliers("Immunology", 2, 240, 66) },
  { category: "Serology", min: 45, q1: 90, median: 130, q3: 175, max: 260, targetTat: 180, outliers: buildOutliers("Serology", 3, 180, 79) },
  { category: "Other", min: 30, q1: 70, median: 100, q3: 145, max: 210, targetTat: 150, outliers: buildOutliers("Other", 1, 150, 93) },
];

const orderingDepartments = ["Emergency", "ICU", "Internal Medicine", "Surgery", "OB-Gyne", "Pediatrics"];

const criticalBars: CriticalResponseBar[] = [];
categories.slice(0, 6).forEach((category, ci) => {
  orderingDepartments.slice(0, 4).forEach((department, di) => {
    criticalBars.push({
      category,
      department,
      withinTargetPct: Math.max(48, 100 - ci * 6 - di * 4 - ((ci + di) % 3) * 5),
      target: 100,
      sampleSize: 12 + ((ci * 5 + di * 3) % 20),
    });
  });
});

const criticalNotifications: CriticalNotification[] = Array.from({ length: 42 }, (_, i) => {
  const category = categories[i % categories.length]!;
  const department = orderingDepartments[i % orderingDepartments.length]!;
  const minutes = 8 + ((i * 7) % 55);
  return {
    id: `CRIT-${2000 + i}`,
    category,
    department,
    test: `${category} critical value`,
    patient: patientName(i + 5),
    minutesToNotify: minutes,
    outlier: minutes > 30,
  };
});

const testCatalog: [string, LabCategory][] = [
  ["Potassium, Serum", "Chemistry"],
  ["Troponin I", "Chemistry"],
  ["Hemoglobin A1c", "Chemistry"],
  ["Complete Blood Count", "Hematology"],
  ["Prothrombin Time / INR", "Hematology"],
  ["ESR", "Hematology"],
  ["Urinalysis, Routine", "Urinalysis"],
  ["Urine Culture & Sensitivity", "Microbiology"],
  ["Blood Culture", "Microbiology"],
  ["Sputum AFB Smear", "Microbiology"],
  ["HBsAg", "Serology"],
  ["Anti-HCV", "Serology"],
  ["VDRL/RPR", "Serology"],
  ["TSH", "Immunology"],
  ["Free T4", "Immunology"],
  ["CRP, Quantitative", "Immunology"],
  ["Creatinine", "Chemistry"],
  ["Blood Urea Nitrogen", "Chemistry"],
  ["Lipid Profile", "Chemistry"],
  ["Liver Function Panel", "Chemistry"],
  ["D-dimer", "Hematology"],
  ["Fecalysis", "Other"],
  ["Pregnancy Test (Beta-hCG)", "Immunology"],
  ["Dengue NS1 Antigen", "Serology"],
];

const abnormalTests: AbnormalTestRow[] = testCatalog
  .map(([test, category], i) => ({
    test,
    category,
    totalResults: 180 + ((i * 37) % 900),
    abnormalPct: Math.max(4, 62 - i * 2.1 - ((i * 13) % 11)),
  }))
  .sort((a, b) => b.abnormalPct - a.abnormalPct)
  .slice(0, 20);

const unmappedTests: UnmappedTest[] = [
  { test: "Reticulocyte Count", category: "Hematology", monthlyVolume: 210, priority: "High" },
  { test: "Peripheral Blood Smear", category: "Hematology", monthlyVolume: 165, priority: "High" },
  { test: "Stool Occult Blood", category: "Other", monthlyVolume: 140, priority: "Medium" },
  { test: "Amylase, Serum", category: "Chemistry", monthlyVolume: 96, priority: "Medium" },
  { test: "Rheumatoid Factor", category: "Immunology", monthlyVolume: 58, priority: "Low" },
  { test: "Gram Stain, Direct", category: "Microbiology", monthlyVolume: 44, priority: "Low" },
];

export function getLaboratoryData(): LaboratoryData {
  const totalTestsMtd = volumeTrend[volumeTrend.length - 1]!
    ? categories.reduce((s, c) => s + volumeTrend[volumeTrend.length - 1]![c], 0)
    : 0;
  const totalMapped = 214;
  const totalCatalog = 214 + unmappedTests.length;
  return {
    tenant: "Cebu City Medical Center",
    period: "August 2026 (MTD)",
    kpis: {
      totalTestsMtd,
      totalTestsDelta: 6.8,
      tatCompliancePct: 84.3,
      criticalResponseCompliancePct: 71.2,
      abnormalRatePct: 27.6,
      loincMappedPct: (totalMapped / totalCatalog) * 100,
    },
    volumeTrend,
    tatBox,
    criticalBars,
    criticalNotifications,
    abnormalTests,
    loinc: {
      mappedCount: totalMapped,
      totalCount: totalCatalog,
      unmapped: unmappedTests,
    },
  };
}

export function fetchLaboratoryData(): Promise<LaboratoryData> {
  return new Promise((resolve) => setTimeout(() => resolve(getLaboratoryData()), 500));
}
