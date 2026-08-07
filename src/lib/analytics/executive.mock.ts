/**
 * Mock data for the Executive Analytics dashboard (Type A — Level 3 Hospital).
 * Shapes mirror FHIR R4 resources (Encounter, Condition, Claim,
 * PaymentReconciliation, Observation) flattened for chart consumption.
 */

export interface AdmissionRow {
  encounterId: string;
  patient: string;
  patientId: string;
  age: number;
  gender: "male" | "female";
  diagnosis: string;
  icd10: string;
  physician: string;
  department: string;
  los: number;
  disposition: "Recovered" | "Improved" | "Transferred" | "HAMA" | "Expired";
  admittedOn: string;
}

export interface VolumePoint {
  month: string;
  inpatient: number;
  opd: number;
  emergency: number;
  daySurgery: number;
  priorInpatient: number;
}

export interface PayerSlice {
  payer: string;
  amount: number;
  color: string;
}

export interface PayerTrendPoint {
  month: string;
  philhealth: number;
  hmo: number;
  privatePay: number;
  scpwd: number;
  gsis: number;
  writeoff: number;
}

export interface DiagnosisRow {
  code: string;
  description: string;
  count: number;
  caseRate: number;
  avgLos: number;
  trend: number[];
}

export interface ClaimStatusSlice {
  status: string;
  count: number;
  value: number;
  color: string;
}

export interface DenialReason {
  code: string;
  reason: string;
  count: number;
  valueAtRisk: number;
  action: string;
}

export interface LabTatCategory {
  category: string;
  compliance: number;
  target: number;
  median: number;
}

export interface ActionAlert {
  id: string;
  title: string;
  detail: string;
  count: number;
  severity: "danger" | "warning" | "neutral";
  actionLabel: string;
  module: string;
}

export interface ExecutiveData {
  tenant: string;
  period: string;
  priorPeriod: string;
  admissions: {
    total: number;
    deltaMonth: number;
    deltaYear: number;
    rows: AdmissionRow[];
  };
  alos: {
    value: number;
    delta: number;
    byDepartment: { name: string; value: number }[];
    byChapter: { name: string; value: number }[];
    byAdmissionType: { name: string; value: number }[];
  };
  bor: {
    value: number;
    delta: number;
    byWard: { name: string; value: number }[];
    trend: { month: string; value: number }[];
  };
  revenue: {
    total: number;
    delta: number;
    byDepartment: { name: string; value: number }[];
    byServiceType: { name: string; value: number }[];
    byPayer: PayerSlice[];
    payerTrend: PayerTrendPoint[];
  };
  remittance: {
    received: number;
    expected: number;
    delta: number;
    batches: { batch: string; caseType: string; claims: number; amount: number; status: string }[];
  };
  approvalRate: {
    value: number;
    delta: number;
    byDepartment: { name: string; value: number }[];
  };
  mortality: {
    value: number;
    delta: number;
    byDepartment: { name: string; value: number }[];
    byDiagnosis: { name: string; value: number }[];
  };
  satisfaction: {
    value: number;
    delta: number;
    byDepartment: { name: string; value: number }[];
  };
  volume: VolumePoint[];
  topDiagnoses: DiagnosisRow[];
  claims: {
    statuses: ClaimStatusSlice[];
    denialReasons: DenialReason[];
  };
  lab: {
    compliance: number;
    target: number;
    byCategory: LabTatCategory[];
    trend: { day: string; value: number }[];
  };
  alerts: ActionAlert[];
}

const PH = "#1A5CA8";
const HMO = "#6B4C9A";
const PRIVATE = "#4454C3";
const SCPWD = "#8B0000";
const GSIS = "#0E6655";
const WRITEOFF = "#999999";

const physicians = [
  "Dr. A. Villanueva",
  "Dr. M. Sarmiento",
  "Dr. J. Uy",
  "Dr. L. Cabrera",
  "Dr. R. Ocampo",
  "Dr. K. Mendoza",
];
const departments = [
  "Internal Medicine",
  "Surgery",
  "Obstetrics",
  "Pediatrics",
  "Orthopedics",
  "Cardiology",
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
];
const dispositions: AdmissionRow["disposition"][] = [
  "Recovered",
  "Improved",
  "Improved",
  "Recovered",
  "Transferred",
  "HAMA",
  "Recovered",
  "Expired",
];

function buildAdmissions(count: number): AdmissionRow[] {
  return Array.from({ length: count }, (_, i) => {
    const dx = diagnoses[i % diagnoses.length]!;
    return {
      encounterId: `ENC-2026-${(4200 + i).toString()}`,
      patient: `${surnames[i % surnames.length]}, ${["Maria", "Juan", "Ana", "Paolo", "Liza", "Carlo"][i % 6]} ${String.fromCharCode(65 + (i % 26))}.`,
      patientId: `PT-2026-00${(300 + i * 7).toString()}`,
      age: 21 + ((i * 13) % 60),
      gender: i % 2 === 0 ? "female" : "male",
      diagnosis: dx[1],
      icd10: dx[0],
      physician: physicians[i % physicians.length]!,
      department: departments[i % departments.length]!,
      los: 1 + ((i * 3) % 11),
      disposition: dispositions[i % dispositions.length]!,
      admittedOn: `2026-08-${String(1 + (i % 28)).padStart(2, "0")}`,
    };
  });
}

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

const volume: VolumePoint[] = months.map((month, i) => ({
  month,
  inpatient: 940 + Math.round(Math.sin(i / 2) * 90) + i * 12,
  opd: 3200 + Math.round(Math.cos(i / 3) * 240) + i * 40,
  emergency: 1180 + Math.round(Math.sin(i / 1.7) * 140) + i * 9,
  daySurgery: 260 + Math.round(Math.cos(i / 2.4) * 40) + i * 4,
  priorInpatient: 880 + Math.round(Math.sin(i / 2.2) * 70) + i * 8,
}));

export function getExecutiveData(): ExecutiveData {
  return {
    tenant: "Cebu City Medical Center",
    period: "August 2026 (MTD)",
    priorPeriod: "July 2026",
    admissions: {
      total: 1084,
      deltaMonth: 8.4,
      deltaYear: 14.2,
      rows: buildAdmissions(24),
    },
    alos: {
      value: 4.8,
      delta: -3.8,
      byDepartment: [
        { name: "Internal Medicine", value: 5.9 },
        { name: "Surgery", value: 5.1 },
        { name: "Pediatrics", value: 3.6 },
        { name: "Obstetrics", value: 2.4 },
        { name: "Orthopedics", value: 6.4 },
        { name: "Cardiology", value: 5.5 },
      ],
      byChapter: [
        { name: "Respiratory (J00–J99)", value: 5.8 },
        { name: "Circulatory (I00–I99)", value: 5.4 },
        { name: "Endocrine (E00–E89)", value: 4.9 },
        { name: "Digestive (K00–K95)", value: 4.1 },
        { name: "Injury (S00–T88)", value: 6.7 },
      ],
      byAdmissionType: [
        { name: "Emergency", value: 5.4 },
        { name: "Elective", value: 3.9 },
        { name: "Transfer-in", value: 6.8 },
        { name: "Newborn", value: 2.1 },
      ],
    },
    bor: {
      value: 82.4,
      delta: 4.2,
      byWard: [
        { name: "Medicine Ward", value: 91 },
        { name: "Surgery Ward", value: 84 },
        { name: "OB Ward", value: 78 },
        { name: "Pedia Ward", value: 69 },
        { name: "ICU", value: 96 },
        { name: "Isolation", value: 54 },
      ],
      trend: months.map((month, i) => ({ month, value: 74 + ((i * 5) % 13) })),
    },
    revenue: {
      total: 18_412_540.5,
      delta: 7.3,
      byDepartment: [
        { name: "Internal Medicine", value: 4_820_000 },
        { name: "Surgery", value: 4_120_000 },
        { name: "Obstetrics", value: 2_640_000 },
        { name: "Orthopedics", value: 2_310_000 },
        { name: "Pediatrics", value: 1_780_000 },
        { name: "Cardiology", value: 1_540_000 },
        { name: "Others", value: 1_202_540 },
      ],
      byServiceType: [
        { name: "Room & Board", value: 4_120_000 },
        { name: "Professional Fees", value: 3_880_000 },
        { name: "Drugs & Medicines", value: 3_460_000 },
        { name: "Laboratory", value: 2_540_000 },
        { name: "Imaging", value: 2_010_000 },
        { name: "OR / Procedures", value: 2_402_540 },
      ],
      byPayer: [
        { payer: "PhilHealth", amount: 7_120_000, color: PH },
        { payer: "HMO", amount: 3_480_000, color: HMO },
        { payer: "Private Pay", amount: 4_960_000, color: PRIVATE },
        { payer: "SC/PWD Discount", amount: 1_640_000, color: SCPWD },
        { payer: "GSIS/Other", amount: 810_000, color: GSIS },
        { payer: "Write-offs", amount: 402_540, color: WRITEOFF },
      ],
      payerTrend: months.slice(6).map((month, i) => ({
        month,
        philhealth: 6_200_000 + i * 180_000,
        hmo: 3_100_000 + i * 70_000,
        privatePay: 4_600_000 + i * 60_000,
        scpwd: 1_400_000 + i * 45_000,
        gsis: 720_000 + i * 18_000,
        writeoff: 360_000 + i * 8_000,
      })),
    },
    remittance: {
      received: 5_840_000,
      expected: 6_400_000,
      delta: -3.1,
      batches: [
        { batch: "BATCH-2026-08-01", caseType: "Ordinary", claims: 184, amount: 2_140_000, status: "Received" },
        { batch: "BATCH-2026-08-02", caseType: "Catastrophic", claims: 22, amount: 1_460_000, status: "Received" },
        { batch: "BATCH-2026-08-03", caseType: "Day Surgery", claims: 61, amount: 840_000, status: "Pending" },
        { batch: "BATCH-2026-08-04", caseType: "Z-Benefit", claims: 6, amount: 980_000, status: "Pending" },
        { batch: "BATCH-2026-08-05", caseType: "Konsulta", claims: 240, amount: 420_000, status: "Received" },
      ],
    },
    approvalRate: {
      value: 91.4,
      delta: 1.8,
      byDepartment: [
        { name: "Internal Medicine", value: 93 },
        { name: "Surgery", value: 88 },
        { name: "Obstetrics", value: 95 },
        { name: "Pediatrics", value: 92 },
        { name: "Orthopedics", value: 84 },
      ],
    },
    mortality: {
      value: 1.4,
      delta: -0.2,
      byDepartment: [
        { name: "ICU", value: 8.4 },
        { name: "Internal Medicine", value: 2.1 },
        { name: "Surgery", value: 1.2 },
        { name: "Cardiology", value: 1.9 },
        { name: "Pediatrics", value: 0.4 },
      ],
      byDiagnosis: [
        { name: "Sepsis (A41.9)", value: 12 },
        { name: "Stroke (I63.9)", value: 8 },
        { name: "AMI (I21.9)", value: 6 },
        { name: "Pneumonia (J18.9)", value: 5 },
        { name: "COPD (J44.9)", value: 3 },
      ],
    },
    satisfaction: {
      value: 78,
      delta: 2.4,
      byDepartment: [
        { name: "Internal Medicine", value: 80 },
        { name: "Surgery", value: 74 },
        { name: "Obstetrics", value: 84 },
        { name: "Pediatrics", value: 81 },
        { name: "Emergency", value: 66 },
        { name: "Laboratory", value: 77 },
      ],
    },
    volume,
    topDiagnoses: diagnoses.map(([code, description], i) => ({
      code,
      description,
      count: 94 - i * 6,
      caseRate: 12_000 + i * 1_400,
      avgLos: 3 + ((i * 7) % 5) * 0.6,
      trend: Array.from({ length: 6 }, (_, k) => 40 + ((i * 5 + k * 9) % 55)),
    })),
    claims: {
      statuses: [
        { status: "Submitted", count: 412, value: 6_240_000, color: "#8A8F98" },
        { status: "RTN Pending", count: 96, value: 1_480_000, color: "#E67E22" },
        { status: "Approved", count: 684, value: 9_820_000, color: "#1A7A3C" },
        { status: "Denied", count: 58, value: 720_000, color: "#C0392B" },
        { status: "Returned-to-Hospital", count: 34, value: 410_000, color: "#D35400" },
      ],
      denialReasons: [
        { code: "DR-101", reason: "Incomplete supporting documents", count: 18, valueAtRisk: 240_000, action: "Attach CSF/CF4 and refile via RTH" },
        { code: "DR-204", reason: "Case rate not applicable to diagnosis", count: 12, valueAtRisk: 186_000, action: "Recode ICD-10 and appeal via CAB" },
        { code: "DR-118", reason: "Late filing beyond 60 days", count: 9, valueAtRisk: 132_000, action: "Escalate to Claims Officer for waiver" },
        { code: "DR-330", reason: "Member eligibility not established", count: 11, valueAtRisk: 98_000, action: "Re-verify PhilHealth membership" },
        { code: "DR-402", reason: "Duplicate claim submission", count: 8, valueAtRisk: 64_000, action: "Void duplicate and retain original" },
      ],
    },
    lab: {
      compliance: 87.6,
      target: 90,
      byCategory: [
        { category: "Hematology", compliance: 93.2, target: 90, median: 1.2 },
        { category: "Chemistry", compliance: 88.4, target: 90, median: 2.1 },
        { category: "Urinalysis", compliance: 95.1, target: 90, median: 0.9 },
        { category: "Microbiology", compliance: 64.8, target: 80, median: 38.4 },
        { category: "Immunology", compliance: 81.6, target: 85, median: 5.4 },
        { category: "Serology", compliance: 89.3, target: 85, median: 3.8 },
      ],
      trend: Array.from({ length: 30 }, (_, i) => ({
        day: `D${i + 1}`,
        value: 80 + ((i * 7) % 17),
      })),
    },
    alerts: [
      { id: "AL-1", title: "Claims near submission deadline", detail: "Oldest claim filed 54 days ago", count: 23, severity: "danger", actionLabel: "Open claims worklist", module: "Claims" },
      { id: "AL-2", title: "Critical lab results unacknowledged", detail: "Longest pending: 3h 20m", count: 7, severity: "danger", actionLabel: "Open lab results", module: "Laboratory" },
      { id: "AL-3", title: "Discharge clearance pending", detail: "Blocking bed turnover in Medicine Ward", count: 14, severity: "warning", actionLabel: "Open discharge queue", module: "Inpatient" },
      { id: "AL-4", title: "CSF signatures not collected", detail: "Required before PhilHealth filing", count: 31, severity: "warning", actionLabel: "Open encounters", module: "Billing" },
      { id: "AL-5", title: "ICU occupancy above 90%", detail: "ICU at 96%, Medicine Ward at 91%", count: 2, severity: "danger", actionLabel: "Open bed management", module: "Census" },
      { id: "AL-6", title: "Practitioner PAN expiring", detail: "Within the next 30 days", count: 5, severity: "warning", actionLabel: "Open practitioner registry", module: "Settings" },
    ],
  };
}

export function fetchExecutiveData(): Promise<ExecutiveData> {
  return new Promise((resolve) => setTimeout(() => resolve(getExecutiveData()), 500));
}
