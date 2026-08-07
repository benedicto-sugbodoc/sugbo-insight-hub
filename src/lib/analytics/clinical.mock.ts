/**
 * Mock data for the Clinical Analytics dashboard (Type A — Level 3 Hospital).
 * Shapes are FHIR R4 flavored (Condition, Procedure, Encounter, EpisodeOfCare,
 * ServiceRequest referrals) flattened for chart consumption.
 */

export const PALETTE_DEPTS = [
  "Internal Medicine",
  "Surgery",
  "Obstetrics",
  "Pediatrics",
  "Orthopedics",
  "Cardiology",
  "Emergency Medicine",
] as const;

export type Department = (typeof PALETTE_DEPTS)[number];

export interface IcdCode {
  code: string;
  description: string;
}

export const ICD_CODES: IcdCode[] = [
  { code: "J44.9", description: "COPD, unspecified" },
  { code: "I10", description: "Essential hypertension" },
  { code: "E11.9", description: "Type 2 diabetes mellitus" },
  { code: "A09", description: "Gastroenteritis and colitis" },
  { code: "N39.0", description: "Urinary tract infection" },
  { code: "J18.9", description: "Pneumonia, unspecified" },
  { code: "S52.5", description: "Fracture of lower forearm" },
  { code: "K29.7", description: "Gastritis" },
  { code: "O80", description: "Single spontaneous delivery" },
  { code: "M25.5", description: "Joint pain" },
  { code: "I21.9", description: "Acute myocardial infarction" },
  { code: "A41.9", description: "Sepsis, unspecified organism" },
];

export interface HeatmapCell {
  department: Department;
  month: string;
  count: number;
}

export interface HeatmapDrillCase {
  encounterId: string;
  patient: string;
  physician: string;
  icd10: string;
  outcome: string;
}

export interface DiseaseTrendSeries {
  code: string;
  description: string;
  color: string;
  points: { month: string; count: number; ratePer1000: number }[];
}

export interface ComorbidityBubble {
  id: string;
  primaryDx: string;
  comorbidDx: string;
  department: Department;
  frequency: number;
  avgLos: number;
  mortalityRate: number;
  color: string;
}

export interface ProcedureNode {
  name: string;
  category: string;
  volume: number;
  revenue: number;
  avgRevenuePerCase: number;
}

export interface SurgeonRow {
  name: string;
  department: Department;
  cases: number;
  avgLos: number;
  complicationRate: number;
  mortalityRate: number;
  avgOrTimeMin: number;
  revenue: number;
  trend: number[];
}

export interface OrBlock {
  room: string;
  procedure: string;
  surgeon: string;
  startHour: number;
  durationHours: number;
}

export interface DischargeMonth {
  month: string;
  Recovered: number;
  Improved: number;
  Transferred: number;
  HAMA: number;
  Expired: number;
}

export interface ReadmissionPoint {
  month: string;
  rate: number;
}

export interface ReadmissionCase {
  patient: string;
  originalDx: string;
  department: Department;
  physician: string;
  daysToReadmit: number;
}

export interface HamaDept {
  department: Department;
  rate: number;
}

export interface SankeyLink {
  source: string;
  target: string;
  volume: number;
  kind: "internal" | "external" | "emergency";
}

export interface ReferralCase {
  patient: string;
  status: "Accepted" | "Pending" | "Declined" | "Completed";
  date: string;
}

export interface SpecialtyAcceptance {
  specialty: string;
  acceptanceRate: number;
  avgResponseHours: number;
}

export interface ClinicalData {
  tenant: string;
  period: string;
  heatmap: HeatmapCell[];
  heatmapMonths: string[];
  heatmapDrill: Record<string, HeatmapDrillCase[]>;
  diseaseTrends: DiseaseTrendSeries[];
  comorbidity: ComorbidityBubble[];
  procedures: { category: string; children: ProcedureNode[] }[];
  surgeons: SurgeonRow[];
  orRooms: { room: string; blocks: OrBlock[]; utilizationPct: number }[];
  discharge: DischargeMonth[];
  readmission: ReadmissionPoint[];
  readmissionCases: ReadmissionCase[];
  hamaByDept: HamaDept[];
  referralFlow: SankeyLink[];
  referralCases: Record<string, ReferralCase[]>;
  specialtyAcceptance: SpecialtyAcceptance[];
}

const DEPT_COLORS: Record<Department, string> = {
  "Internal Medicine": "#4454C3",
  Surgery: "#1A5CA8",
  Obstetrics: "#6B4C9A",
  Pediatrics: "#1A7A3C",
  Orthopedics: "#E67E22",
  Cardiology: "#C0392B",
  "Emergency Medicine": "#8B0000",
};

const months12 = [
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

function seededRand(seed: number) {
  const x = Math.sin(seed * 999.7) * 10000;
  return x - Math.floor(x);
}

function buildHeatmap(): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  PALETTE_DEPTS.forEach((department, di) => {
    months12.forEach((month, mi) => {
      const base = 18 + di * 4;
      const count = Math.round(base + seededRand(di * 31 + mi) * 40 + Math.sin(mi / 2 + di) * 10);
      cells.push({ department, month, count: Math.max(2, count) });
    });
  });
  return cells;
}

function buildHeatmapDrill(): Record<string, HeatmapDrillCase[]> {
  const drill: Record<string, HeatmapDrillCase[]> = {};
  const physicians = ["Dr. A. Villanueva", "Dr. M. Sarmiento", "Dr. J. Uy", "Dr. L. Cabrera", "Dr. R. Ocampo"];
  const surnames = ["Reyes", "Dela Cruz", "Garcia", "Lim", "Bautista", "Tan", "Santos"];
  const outcomes = ["Recovered", "Improved", "Transferred", "HAMA", "Expired"];
  PALETTE_DEPTS.forEach((department, di) => {
    months12.forEach((month, mi) => {
      const key = `${department}__${month}`;
      const n = 3 + ((di + mi) % 4);
      drill[key] = Array.from({ length: n }, (_, i) => ({
        encounterId: `ENC-2026-${1000 + di * 100 + mi * 10 + i}`,
        patient: `${surnames[(di + i) % surnames.length]}, ${["Maria", "Juan", "Ana", "Paolo"][i % 4]}`,
        physician: physicians[(di + i) % physicians.length]!,
        icd10: ICD_CODES[(di + mi + i) % ICD_CODES.length]!.code,
        outcome: outcomes[(di + i) % outcomes.length]!,
      }));
    });
  });
  return drill;
}

const trendColors = ["#4454C3", "#C0392B", "#1A7A3C", "#E67E22", "#6B4C9A"];

function buildDiseaseTrends(): DiseaseTrendSeries[] {
  return ICD_CODES.slice(0, 6).map((dx, i) => ({
    code: dx.code,
    description: dx.description,
    color: trendColors[i % trendColors.length]!,
    points: months12.map((month, mi) => {
      const count = Math.round(40 + i * 6 + Math.sin(mi / 2 + i) * 14 + seededRand(i * 17 + mi) * 8);
      return { month, count, ratePer1000: Number((count / 10.5).toFixed(2)) };
    }),
  }));
}

function buildComorbidity(): ComorbidityBubble[] {
  const pairs: [string, string][] = [
    ["E11.9", "I10"],
    ["J44.9", "J18.9"],
    ["I10", "I21.9"],
    ["A41.9", "N39.0"],
    ["K29.7", "E11.9"],
    ["S52.5", "M25.5"],
    ["O80", "N39.0"],
    ["I21.9", "A41.9"],
  ];
  return pairs.map(([p, c], i) => {
    const department = PALETTE_DEPTS[i % PALETTE_DEPTS.length]!;
    return {
      id: `COM-${i}`,
      primaryDx: p,
      comorbidDx: c,
      department,
      frequency: 30 + i * 9 + Math.round(seededRand(i) * 20),
      avgLos: Number((3 + i * 0.6 + seededRand(i * 5) * 2).toFixed(1)),
      mortalityRate: Number((1 + i * 0.8 + seededRand(i * 9) * 3).toFixed(1)),
      color: DEPT_COLORS[department],
    };
  });
}

function buildProcedures(): { category: string; children: ProcedureNode[] }[] {
  const cats: { category: string; procs: [string, number, number][] }[] = [
    {
      category: "General Surgery",
      procs: [
        ["Appendectomy", 84, 4_200],
        ["Cholecystectomy", 56, 6_800],
        ["Hernia Repair", 62, 3_900],
      ],
    },
    {
      category: "Orthopedics",
      procs: [
        ["ORIF Fracture", 48, 9_400],
        ["Total Knee Replacement", 18, 22_000],
        ["Arthroscopy", 26, 7_600],
      ],
    },
    {
      category: "Obstetrics",
      procs: [
        ["Cesarean Section", 132, 5_200],
        ["Normal Spontaneous Delivery", 214, 2_100],
      ],
    },
    {
      category: "Cardiology",
      procs: [
        ["Coronary Angiography", 40, 18_500],
        ["Pacemaker Insertion", 9, 32_000],
      ],
    },
    {
      category: "ENT / Ophtha",
      procs: [
        ["Cataract Extraction", 58, 8_100],
        ["Tonsillectomy", 22, 3_600],
      ],
    },
  ];
  return cats.map((c) => ({
    category: c.category,
    children: c.procs.map(([name, volume, avgRevenuePerCase]) => ({
      name,
      category: c.category,
      volume,
      avgRevenuePerCase,
      revenue: volume * avgRevenuePerCase,
    })),
  }));
}

const surgeonNames = [
  "Dr. E. Villaraza",
  "Dr. F. Nazareno",
  "Dr. G. Suarez",
  "Dr. H. Tolentino",
  "Dr. I. Aquino",
  "Dr. J. Villamor",
];

function buildSurgeons(): SurgeonRow[] {
  return surgeonNames.map((name, i) => ({
    name,
    department: PALETTE_DEPTS[i % PALETTE_DEPTS.length]!,
    cases: 60 + i * 14,
    avgLos: Number((3.2 + i * 0.4).toFixed(1)),
    complicationRate: Number((2.1 + i * 0.6).toFixed(1)),
    mortalityRate: Number((0.4 + i * 0.3).toFixed(1)),
    avgOrTimeMin: 75 + i * 12,
    revenue: 1_200_000 + i * 340_000,
    trend: Array.from({ length: 8 }, (_, k) => 40 + ((i * 7 + k * 5) % 40)),
  }));
}

function buildOrRooms() {
  const rooms = ["OR-1", "OR-2", "OR-3", "OR-4"];
  const procs = ["Appendectomy", "Cholecystectomy", "Cesarean Section", "ORIF Fracture", "Cataract Extraction", "Hernia Repair"];
  return rooms.map((room, ri) => {
    const blocks: OrBlock[] = [];
    let cursor = 7 + (ri % 2);
    for (let i = 0; i < 4 + (ri % 2); i++) {
      const duration = 1 + ((ri + i) % 3) * 0.75;
      blocks.push({
        room,
        procedure: procs[(ri + i) % procs.length]!,
        surgeon: surgeonNames[(ri + i) % surgeonNames.length]!,
        startHour: cursor,
        durationHours: duration,
      });
      cursor += duration + 0.5;
    }
    const busy = blocks.reduce((s, b) => s + b.durationHours, 0);
    return { room, blocks, utilizationPct: Number(Math.min(96, (busy / 10) * 100).toFixed(1)) };
  });
}

function buildDischarge(): DischargeMonth[] {
  return months12.map((month, i) => {
    const expired = 2 + (i % 3);
    const hama = 4 + (i % 4);
    const transferred = 6 + (i % 3);
    const improved = 60 + ((i * 3) % 20);
    const recovered = 260 + ((i * 5) % 40);
    return { month, Recovered: recovered, Improved: improved, Transferred: transferred, HAMA: hama, Expired: expired };
  });
}

function buildReadmission(): ReadmissionPoint[] {
  return months12.map((month, i) => ({ month, rate: Number((4 + Math.sin(i / 2) * 4 + (i % 4)).toFixed(1)) }));
}

function buildReadmissionCases(): ReadmissionCase[] {
  const physicians = ["Dr. A. Villanueva", "Dr. M. Sarmiento", "Dr. J. Uy", "Dr. L. Cabrera"];
  const surnames = ["Reyes", "Dela Cruz", "Garcia", "Lim", "Bautista"];
  return Array.from({ length: 14 }, (_, i) => ({
    patient: `${surnames[i % surnames.length]}, ${["Maria", "Juan", "Ana", "Paolo"][i % 4]}`,
    originalDx: ICD_CODES[i % ICD_CODES.length]!.description,
    department: PALETTE_DEPTS[i % PALETTE_DEPTS.length]!,
    physician: physicians[i % physicians.length]!,
    daysToReadmit: 3 + (i % 27),
  }));
}

function buildHamaByDept(): HamaDept[] {
  return PALETTE_DEPTS.map((department, i) => ({
    department,
    rate: Number((2.5 + i * 1.1 + seededRand(i * 3) * 2).toFixed(1)),
  }));
}

function buildReferralFlow(): SankeyLink[] {
  return [
    { source: "OPD / ER Intake", target: "Internal Medicine", volume: 220, kind: "internal" },
    { source: "OPD / ER Intake", target: "Surgery", volume: 140, kind: "internal" },
    { source: "OPD / ER Intake", target: "Obstetrics", volume: 110, kind: "internal" },
    { source: "OPD / ER Intake", target: "Cardiology (Tertiary)", volume: 46, kind: "external" },
    { source: "Internal Medicine", target: "ICU", volume: 38, kind: "emergency" },
    { source: "Barangay Health Center", target: "OPD / ER Intake", volume: 96, kind: "external" },
    { source: "Rural Health Unit", target: "Obstetrics", volume: 64, kind: "external" },
    { source: "Surgery", target: "Orthopedics Specialist Center", volume: 22, kind: "external" },
  ];
}

function buildReferralCases(): Record<string, ReferralCase[]> {
  const links = buildReferralFlow();
  const out: Record<string, ReferralCase[]> = {};
  const statuses: ReferralCase["status"][] = ["Accepted", "Pending", "Declined", "Completed"];
  links.forEach((l) => {
    const key = `${l.source}__${l.target}`;
    out[key] = Array.from({ length: 5 }, (_, i) => ({
      patient: `Patient ${i + 1}`,
      status: statuses[i % statuses.length]!,
      date: `2026-08-${String(1 + i * 4).padStart(2, "0")}`,
    }));
  });
  return out;
}

function buildSpecialtyAcceptance(): SpecialtyAcceptance[] {
  const specialties = ["Cardiology", "Nephrology", "Neurology", "Oncology", "Pediatric Surgery", "Endocrinology"];
  return specialties.map((specialty, i) => ({
    specialty,
    acceptanceRate: Number((60 + i * 6 + seededRand(i * 2) * 10).toFixed(1)),
    avgResponseHours: Number((1.5 + i * 1.1).toFixed(1)),
  }));
}

export function getClinicalData(): ClinicalData {
  return {
    tenant: "Cebu City Medical Center",
    period: "August 2026 (MTD)",
    heatmap: buildHeatmap(),
    heatmapMonths: months12,
    heatmapDrill: buildHeatmapDrill(),
    diseaseTrends: buildDiseaseTrends(),
    comorbidity: buildComorbidity(),
    procedures: buildProcedures(),
    surgeons: buildSurgeons(),
    orRooms: buildOrRooms(),
    discharge: buildDischarge(),
    readmission: buildReadmission(),
    readmissionCases: buildReadmissionCases(),
    hamaByDept: buildHamaByDept(),
    referralFlow: buildReferralFlow(),
    referralCases: buildReferralCases(),
    specialtyAcceptance: buildSpecialtyAcceptance(),
  };
}

export function fetchClinicalData(): Promise<ClinicalData> {
  return new Promise((resolve) => setTimeout(() => resolve(getClinicalData()), 500));
}

export const DEPT_COLOR_MAP = DEPT_COLORS;
