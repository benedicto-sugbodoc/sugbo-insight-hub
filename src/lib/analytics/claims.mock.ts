/**
 * Mock data for the PhilHealth Claims Analytics dashboard.
 * Shapes mirror FHIR R4 resources (Claim, ClaimResponse, PaymentReconciliation)
 * flattened for chart consumption.
 */

export interface ClaimsKpis {
  submittedMtd: { count: number; amount: number; delta: number };
  pendingRtn: { count: number; oldestDays: number; delta: number };
  approved: { count: number; amount: number; rate: number; delta: number };
  denied: { count: number; amount: number; rate: number; delta: number };
  avgDaysToRtn: { value: number; target: number; delta: number };
  expectedRemittance: { amount: number; delta: number };
}

export interface PipelineStage {
  stage: string;
  count: number;
  value: number;
}

export interface DenialTrendPoint {
  month: string;
  overall: number;
  ordinary: number;
  catastrophic: number;
  zBenefit: number;
  policyChange?: string;
}

export interface DenialReasonRow {
  code: string;
  reason: string;
  description: string;
  count: number;
  pctOfTotal: number;
  valueAtRisk: number;
  trend: "better" | "worse" | "flat";
  action: string;
}

export interface CaseTypeTreemapRow {
  name: string;
  size: number;
  avgValue: number;
}

export interface PhysicianClaimRow {
  physician: string;
  submitted: number;
  approvalRate: number;
  denialRate: number;
  commonDenialReason: string;
  revenue: number;
}

export interface CaseRateScatterPoint {
  icd10: string;
  description: string;
  caseType: string;
  caseRate: number;
  actualCharge: number;
  patientCount: number;
  color: string;
}

export interface CoverageDiagnosisRow {
  code: string;
  description: string;
  actualCost: number;
  caseRateTarget: number;
}

export interface WorklistClaim {
  claimId: string;
  patient: string;
  caseType: string;
  icd10: string;
  amount: number;
  daysInStage: number;
}

export interface ClaimsData {
  tenant: string;
  period: string;
  priorPeriod: string;
  kpis: ClaimsKpis;
  pipeline: PipelineStage[];
  pipelineWorklists: Record<string, WorklistClaim[]>;
  denialTrend: DenialTrendPoint[];
  denialReasons: DenialReasonRow[];
  caseTypeTreemap: CaseTypeTreemapRow[];
  caseTypeDetail: Record<
    string,
    { topDiagnoses: { code: string; description: string; count: number }[]; avgCaseRate: number; approvalRate: number }
  >;
  physicians: PhysicianClaimRow[];
  caseRateScatter: CaseRateScatterPoint[];
  coverageDiagnoses: CoverageDiagnosisRow[];
}

const CASE_TYPES = [
  "Ordinary",
  "Catastrophic",
  "Z-Benefit",
  "Day Surgery",
  "NCP",
  "Konsulta",
  "NHSSS",
  "Other",
];

const CASE_TYPE_COLORS: Record<string, string> = {
  Ordinary: "#4454C3",
  Catastrophic: "#C0392B",
  "Z-Benefit": "#6B4C9A",
  "Day Surgery": "#1A7A3C",
  NCP: "#E67E22",
  Konsulta: "#1A5CA8",
  NHSSS: "#0E6655",
  Other: "#8A8F98",
};

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

const physicians = [
  "Dr. A. Villanueva",
  "Dr. M. Sarmiento",
  "Dr. J. Uy",
  "Dr. L. Cabrera",
  "Dr. R. Ocampo",
  "Dr. K. Mendoza",
  "Dr. F. Aguilar",
  "Dr. C. Ramos",
];

const surnames = ["Reyes", "Dela Cruz", "Garcia", "Lim", "Bautista", "Tan", "Santos", "Pascual", "Fernandez", "Ramos"];

const diagnoses: [string, string, string][] = [
  ["I21.9", "Acute myocardial infarction", "Catastrophic"],
  ["N18.6", "End stage renal disease", "Catastrophic"],
  ["O80", "Single spontaneous delivery", "Ordinary"],
  ["K35.8", "Acute appendicitis", "Day Surgery"],
  ["J18.9", "Pneumonia, unspecified", "Ordinary"],
  ["C50.9", "Malignant neoplasm of breast", "Z-Benefit"],
  ["I63.9", "Cerebral infarction", "Catastrophic"],
  ["E11.9", "Type 2 diabetes mellitus", "Ordinary"],
  ["S72.0", "Fracture of neck of femur", "NCP"],
  ["A09", "Gastroenteritis and colitis", "Konsulta"],
  ["N39.0", "Urinary tract infection", "Ordinary"],
  ["J44.9", "COPD, unspecified", "Ordinary"],
  ["I10", "Essential hypertension", "Konsulta"],
  ["K80.2", "Gallstones without cholecystitis", "Day Surgery"],
  ["M17.9", "Osteoarthritis of knee", "NCP"],
  ["P07.3", "Preterm newborn", "NHSSS"],
  ["B20", "HIV disease", "Z-Benefit"],
  ["Z00.0", "General medical examination", "Other"],
  ["K29.7", "Gastritis, unspecified", "Konsulta"],
  ["S06.0", "Concussion", "Other"],
];

function buildWorklist(stage: string, count: number): WorklistClaim[] {
  return Array.from({ length: count }, (_, i) => {
    const dx = diagnoses[(i + stage.length) % diagnoses.length]!;
    return {
      claimId: `CLM-2026-${(5100 + i * 3 + stage.length).toString()}`,
      patient: `${surnames[i % surnames.length]}, ${["Maria", "Juan", "Ana", "Paolo", "Liza", "Carlo"][i % 6]} ${String.fromCharCode(65 + (i % 26))}.`,
      caseType: dx[2],
      icd10: dx[0],
      amount: 18_000 + ((i * 3700) % 92_000),
      daysInStage: 1 + ((i * 5) % 40),
    };
  });
}

export function getClaimsData(): ClaimsData {
  const pipeline: PipelineStage[] = [
    { stage: "Drafted", count: 1240, value: 18_900_000 },
    { stage: "Validated", count: 1108, value: 16_820_000 },
    { stage: "Submitted", count: 984, value: 14_960_000 },
    { stage: "RTN Received", count: 902, value: 13_780_000 },
    { stage: "Approved", count: 742, value: 11_460_000 },
    { stage: "Remittance Received", count: 648, value: 9_920_000 },
  ];

  const pipelineWorklists: Record<string, WorklistClaim[]> = {};
  pipeline.forEach((s) => {
    pipelineWorklists[s.stage] = buildWorklist(s.stage, 14);
  });

  const denialTrend: DenialTrendPoint[] = months.map((month, i) => ({
    month,
    overall: 6.8 + Math.sin(i / 2.4) * 1.6 + (i > 7 ? -0.8 : 0),
    ordinary: 5.2 + Math.cos(i / 3) * 1.1,
    catastrophic: 9.4 + Math.sin(i / 1.9) * 2.1,
    zBenefit: 7.6 + Math.cos(i / 2.6) * 1.4,
    ...(i === 3 ? { policyChange: "PhilHealth Circular 2025-14 (case rate revision)" } : {}),
    ...(i === 8 ? { policyChange: "New RTH filing window (60→45 days)" } : {}),
  }));

  const denialReasons: DenialReasonRow[] = [
    { code: "DR-101", reason: "Incomplete supporting documents", description: "Missing CSF, CF4, or OR/anesthesia record at submission", count: 86, pctOfTotal: 21.4, valueAtRisk: 1_240_000, trend: "worse", action: "Attach CSF/CF4 and refile via RTH" },
    { code: "DR-204", reason: "Case rate not applicable to diagnosis", description: "Billed case rate package mismatched to confirmed ICD-10", count: 64, pctOfTotal: 15.9, valueAtRisk: 986_000, trend: "flat", action: "Recode ICD-10 and appeal via CAB" },
    { code: "DR-118", reason: "Late filing beyond deadline", description: "Claim filed beyond the 60/45-day filing window", count: 52, pctOfTotal: 12.9, valueAtRisk: 742_000, trend: "better", action: "Escalate to Claims Officer for waiver request" },
    { code: "DR-330", reason: "Member eligibility not established", description: "PhilHealth membership/contribution not verified at admission", count: 44, pctOfTotal: 11.0, valueAtRisk: 598_000, trend: "worse", action: "Re-verify PhilHealth membership before RTH refiling" },
    { code: "DR-402", reason: "Duplicate claim submission", description: "Same episode filed twice under different claim numbers", count: 38, pctOfTotal: 9.4, valueAtRisk: 412_000, trend: "flat", action: "Void duplicate and retain original claim" },
    { code: "DR-512", reason: "Diagnosis-procedure mismatch", description: "Procedure code not clinically consistent with primary diagnosis", count: 33, pctOfTotal: 8.2, valueAtRisk: 388_000, trend: "worse", action: "Clinical coding review, refile via CAB" },
    { code: "DR-215", reason: "No pre-authorization on file", description: "Case rate package requiring PA lacks approved authorization", count: 27, pctOfTotal: 6.7, valueAtRisk: 316_000, trend: "better", action: "Secure retroactive PA and resubmit" },
    { code: "DR-610", reason: "Confinement below minimum days", description: "Length of stay below package minimum confinement requirement", count: 22, pctOfTotal: 5.5, valueAtRisk: 248_000, trend: "flat", action: "Clinical justification letter, appeal via RTH" },
    { code: "DR-140", reason: "Incorrect facility accreditation level", description: "Procedure performed above facility's accredited service capability", count: 19, pctOfTotal: 4.7, valueAtRisk: 214_000, trend: "worse", action: "Verify accreditation, escalate to Admin" },
    { code: "DR-720", reason: "Signature/attestation missing", description: "Physician or patient attestation missing on claim form", count: 17, pctOfTotal: 4.2, valueAtRisk: 176_000, trend: "better", action: "Obtain signature and refile via RTH" },
  ];

  const caseTypeTreemap: CaseTypeTreemapRow[] = [
    { name: "Ordinary", size: 512, avgValue: 24_800 },
    { name: "Catastrophic", size: 84, avgValue: 148_600 },
    { name: "Z-Benefit", size: 46, avgValue: 96_400 },
    { name: "Day Surgery", size: 168, avgValue: 34_200 },
    { name: "NCP", size: 92, avgValue: 58_900 },
    { name: "Konsulta", size: 340, avgValue: 8_600 },
    { name: "NHSSS", size: 58, avgValue: 42_100 },
    { name: "Other", size: 64, avgValue: 16_300 },
  ];

  const caseTypeDetail: ClaimsData["caseTypeDetail"] = {};
  caseTypeTreemap.forEach((ct, i) => {
    caseTypeDetail[ct.name] = {
      topDiagnoses: diagnoses
        .filter((d) => d[2] === ct.name)
        .slice(0, 5)
        .map((d, k) => ({ code: d[0], description: d[1], count: 40 - k * 6 })),
      avgCaseRate: ct.avgValue * 0.92,
      approvalRate: 96 - i * 4.2,
    };
  });

  const physicians_data: PhysicianClaimRow[] = physicians.map((p, i) => {
    const denialRate = [3.2, 12.8, 6.4, 4.1, 14.6, 8.9, 5.5, 11.2][i]!;
    return {
      physician: p,
      submitted: 120 + i * 14,
      approvalRate: 100 - denialRate - 2.4,
      denialRate,
      commonDenialReason: denialReasons[i % denialReasons.length]!.reason,
      revenue: 1_240_000 + i * 186_000,
    };
  });

  const caseRateScatter: CaseRateScatterPoint[] = diagnoses.map((d, i) => {
    const caseRate = 8_000 + (i * 4700) % 62_000;
    const margin = i % 3 === 0 ? -0.18 : i % 4 === 0 ? -0.06 : 0.14;
    return {
      icd10: d[0],
      description: d[1],
      caseType: d[2],
      caseRate,
      actualCharge: Math.round(caseRate * (1 + margin)),
      patientCount: 8 + ((i * 9) % 60),
      color: CASE_TYPE_COLORS[d[2]] ?? "#8A8F98",
    };
  });

  const coverageDiagnoses: CoverageDiagnosisRow[] = diagnoses.slice(0, 20).map((d, i) => {
    const target = 8_000 + (i * 3900) % 58_000;
    const gap = i % 3 === 0 ? 1.32 : i % 4 === 0 ? 1.18 : 0.86;
    return {
      code: d[0],
      description: d[1],
      caseRateTarget: target,
      actualCost: Math.round(target * gap),
    };
  }).sort((a, b) => (b.actualCost - b.caseRateTarget) - (a.actualCost - a.caseRateTarget));

  return {
    tenant: "Cebu City Medical Center",
    period: "August 2026 (MTD)",
    priorPeriod: "July 2026",
    kpis: {
      submittedMtd: { count: 984, amount: 14_960_000, delta: 6.2 },
      pendingRtn: { count: 96, oldestDays: 54, delta: -3.4 },
      approved: { count: 742, amount: 11_460_000, rate: 82.4, delta: 1.6 },
      denied: { count: 402, amount: 4_824_000, rate: 9.6, delta: 0.8 },
      avgDaysToRtn: { value: 6.4, target: 5, delta: -4.2 },
      expectedRemittance: { amount: 10_640_000, delta: 5.1 },
    },
    pipeline,
    pipelineWorklists,
    denialTrend,
    denialReasons,
    caseTypeTreemap,
    caseTypeDetail,
    physicians: physicians_data,
    caseRateScatter,
    coverageDiagnoses,
  };
}

export function fetchClaimsData(): Promise<ClaimsData> {
  return new Promise((resolve) => setTimeout(() => resolve(getClaimsData()), 500));
}
