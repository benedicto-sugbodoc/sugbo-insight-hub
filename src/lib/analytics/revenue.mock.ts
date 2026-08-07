/**
 * Mock data for the Revenue Cycle & Billing Analytics dashboard.
 * Shapes mirror FHIR R4 resources (ChargeItem, Claim, PaymentReconciliation,
 * Account, Coverage) flattened for chart consumption.
 */

export const REV = {
  brand: "#4454C3",
  deduction: "#C0392B",
  net: "#1A7A3C",
  philhealth: "#1A5CA8",
  hmo: "#6B4C9A",
  scpwd: "#8B0000",
  gsis: "#0E6655",
  privatePay: "#7C89DC",
  writeoff: "#999999",
  current: "#1A7A3C",
  b31: "#E67E22",
  b61: "#D35400",
  b90: "#C0392B",
} as const;

export interface WaterfallStep {
  key: string;
  label: string;
  base: number;
  value: number;
  kind: "start" | "deduction" | "end";
  detail: { item: string; amount: number }[];
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

export interface DeptRevenueRow {
  department: string;
  philhealth: number;
  hmo: number;
  privatePay: number;
  scpwd: number;
  gsis: number;
  total: number;
  topProcedures: { name: string; amount: number }[];
  topDiagnoses: { name: string; amount: number }[];
}

export interface ARAgingRow {
  payer: string;
  current: number;
  d31: number;
  d61: number;
  d90: number;
}

export interface ARPatientRow {
  patient: string;
  patientId: string;
  payer: string;
  daysOutstanding: number;
  amount: number;
  lastBillingAction: string;
}

export interface CollectionPoint {
  period: string;
  target: number;
  philhealth: number;
  hmo: number;
  privatePay: number;
  scpwd: number;
  emergency: number;
  surgery: number;
  internalMed: number;
  agentA: number;
  agentB: number;
  agentC: number;
}

export interface FunnelStage {
  stage: string;
  count: number;
  encounters: { encounterId: string; patient: string; amount: number; daysStuck: number }[];
}

export interface CoverageSlice {
  category: string;
  count: number;
  color: string;
}

export interface ScPwdPoint {
  month: string;
  patients: number;
  discountAmount: number;
}

export interface RevenueData {
  tenant: string;
  period: string;
  priorPeriod: string;
  kpis: {
    grossRevenue: { value: number; budget: number; delta: number };
    netRevenue: { value: number; delta: number };
    collectionRate: { value: number; delta: number };
    daysInAR: { value: number; delta: number; benchmark: number };
    writeOffRate: { value: number; delta: number };
  };
  waterfall: WaterfallStep[];
  payerMix: PayerSlice[];
  payerTrend: PayerTrendPoint[];
  departmentRevenue: DeptRevenueRow[];
  arAging: ARAgingRow[];
  arOver90: ARPatientRow[];
  collectionTrend: CollectionPoint[];
  funnel: FunnelStage[];
  philhealthCoverage: CoverageSlice[];
  scPwdTrend: ScPwdPoint[];
}

const months = ["Mar 26", "Apr 26", "May 26", "Jun 26", "Jul 26", "Aug 26"];

const surnames = ["Reyes", "Dela Cruz", "Garcia", "Lim", "Bautista", "Tan", "Santos", "Pascual", "Fernandez", "Ramos"];
const firstNames = ["Maria", "Juan", "Ana", "Paolo", "Liza", "Carlo", "Grace", "Noel"];

function buildPatientRows(count: number, payers: string[]): ARPatientRow[] {
  const actions = [
    "Statement sent",
    "Follow-up call logged",
    "Awaiting PhilHealth adjudication",
    "Escalated to collections",
    "Payment plan proposed",
    "Awaiting HMO LOA extension",
  ];
  return Array.from({ length: count }, (_, i) => ({
    patient: `${surnames[i % surnames.length]}, ${firstNames[i % firstNames.length]} ${String.fromCharCode(65 + (i % 26))}.`,
    patientId: `PT-2026-01${(200 + i * 3).toString()}`,
    payer: payers[i % payers.length]!,
    daysOutstanding: 91 + ((i * 11) % 95),
    amount: 8_500 + ((i * 3700) % 62_000),
    lastBillingAction: actions[i % actions.length]!,
  }));
}

function buildEncounters(count: number, stage: string, base: number): FunnelStage["encounters"] {
  return Array.from({ length: count }, (_, i) => ({
    encounterId: `ENC-2026-${(5100 + base + i).toString()}`,
    patient: `${surnames[i % surnames.length]}, ${firstNames[(i + 2) % firstNames.length]} ${String.fromCharCode(66 + (i % 24))}.`,
    amount: 6_200 + ((i * 2100) % 48_000),
    daysStuck: 1 + ((i * 3 + base) % 14),
  }));
}

export function getRevenueData(): RevenueData {
  const grossCharges = 22_640_000;
  const scpwdDiscount = 1_640_000;
  const gsisAssist = 480_000;
  const hmoAdj = 620_000;
  const cr1 = 3_120_000;
  const cr2 = 1_980_000;
  const patientCollections = grossCharges - scpwdDiscount - gsisAssist - hmoAdj - cr1 - cr2;

  const waterfallRaw: { key: string; label: string; value: number; kind: WaterfallStep["kind"]; detail: { item: string; amount: number }[] }[] = [
    {
      key: "gross",
      label: "Gross Charges",
      value: grossCharges,
      kind: "start",
      detail: [
        { item: "Room & Board", amount: 5_120_000 },
        { item: "Professional Fees", amount: 4_880_000 },
        { item: "Drugs & Medicines", amount: 4_260_000 },
        { item: "Laboratory & Imaging", amount: 4_580_000 },
        { item: "OR / Procedures", amount: 3_800_000 },
      ],
    },
    {
      key: "scpwd",
      label: "SC/PWD Discount",
      value: -scpwdDiscount,
      kind: "deduction",
      detail: [
        { item: "Senior Citizen mandatory 20%", amount: -1_020_000 },
        { item: "PWD mandatory 20%", amount: -620_000 },
      ],
    },
    {
      key: "gsis",
      label: "GSIS/SSS Assistance",
      value: -gsisAssist,
      kind: "deduction",
      detail: [
        { item: "GSIS medical assistance", amount: -280_000 },
        { item: "SSS sickness/medical benefit", amount: -200_000 },
      ],
    },
    {
      key: "hmo",
      label: "HMO Adjustments",
      value: -hmoAdj,
      kind: "deduction",
      detail: [
        { item: "Contracted rate adjustment", amount: -420_000 },
        { item: "Non-covered service write-down", amount: -200_000 },
      ],
    },
    {
      key: "cr1",
      label: "PhilHealth Benefit CR1",
      value: -cr1,
      kind: "deduction",
      detail: [
        { item: "Ordinary case rate", amount: -2_040_000 },
        { item: "Konsulta package", amount: -1_080_000 },
      ],
    },
    {
      key: "cr2",
      label: "PhilHealth Benefit CR2",
      value: -cr2,
      kind: "deduction",
      detail: [
        { item: "Catastrophic case rate", amount: -1_240_000 },
        { item: "Z-Benefit package", amount: -740_000 },
      ],
    },
    {
      key: "net",
      label: "Patient Collections",
      value: patientCollections,
      kind: "end",
      detail: [
        { item: "Cash & card at counter", amount: patientCollections * 0.58 },
        { item: "Installment/payment plan", amount: patientCollections * 0.27 },
        { item: "Corporate billing", amount: patientCollections * 0.15 },
      ],
    },
  ];

  let running = 0;
  const waterfall: WaterfallStep[] = waterfallRaw.map((s) => {
    if (s.kind === "start") {
      running = s.value;
      return { key: s.key, label: s.label, base: 0, value: s.value, kind: s.kind, detail: s.detail };
    }
    if (s.kind === "deduction") {
      const newRunning = running + s.value;
      const step: WaterfallStep = {
        key: s.key,
        label: s.label,
        base: newRunning,
        value: -s.value,
        kind: s.kind,
        detail: s.detail,
      };
      running = newRunning;
      return step;
    }
    return { key: s.key, label: s.label, base: 0, value: s.value, kind: s.kind, detail: s.detail };
  });

  const departments = [
    "Internal Medicine",
    "Surgery",
    "Obstetrics",
    "Orthopedics",
    "Pediatrics",
    "Cardiology",
    "Emergency",
  ];
  const procPool = ["Hemodialysis session", "Cesarean section", "Appendectomy", "Cataract surgery", "ORIF fixation", "Chest X-ray series", "2D Echo", "CBC panel"];
  const dxPool = ["Type 2 diabetes (E11.9)", "Essential hypertension (I10)", "Pneumonia (J18.9)", "Fracture forearm (S52.5)", "UTI (N39.0)", "Single delivery (O80)"];

  const departmentRevenue: DeptRevenueRow[] = departments
    .map((department, i) => {
      const philhealth = 1_260_000 - i * 90_000;
      const hmo = 620_000 - i * 40_000;
      const privatePay = 840_000 - i * 55_000;
      const scpwd = 320_000 - i * 22_000;
      const gsis = 140_000 - i * 9_000;
      const total = philhealth + hmo + privatePay + scpwd + gsis;
      return {
        department,
        philhealth,
        hmo,
        privatePay,
        scpwd,
        gsis,
        total,
        topProcedures: [0, 1, 2].map((k) => ({
          name: procPool[(i + k) % procPool.length]!,
          amount: total * (0.22 - k * 0.05),
        })),
        topDiagnoses: [0, 1, 2].map((k) => ({
          name: dxPool[(i + k) % dxPool.length]!,
          amount: total * (0.18 - k * 0.04),
        })),
      };
    })
    .sort((a, b) => b.total - a.total);

  const payers = ["PhilHealth", "HMO", "Private Pay", "SC/PWD", "GSIS/Other"];
  const arAging: ARAgingRow[] = [
    { payer: "PhilHealth", current: 1_840_000, d31: 920_000, d61: 540_000, d90: 680_000 },
    { payer: "HMO", current: 980_000, d31: 460_000, d61: 210_000, d90: 260_000 },
    { payer: "Private Pay", current: 1_240_000, d31: 380_000, d61: 190_000, d90: 340_000 },
    { payer: "SC/PWD", current: 320_000, d31: 140_000, d61: 90_000, d90: 120_000 },
    { payer: "GSIS/Other", current: 210_000, d31: 90_000, d61: 60_000, d90: 80_000 },
  ];

  const collectionTrend: CollectionPoint[] = months.map((period, i) => ({
    period,
    target: 6_200_000,
    philhealth: 2_600_000 + i * 90_000 + (i % 2 === 0 ? -120_000 : 60_000),
    hmo: 1_320_000 + i * 40_000,
    privatePay: 1_780_000 + i * 55_000,
    scpwd: 520_000 + i * 12_000,
    emergency: 980_000 + i * 30_000,
    surgery: 2_100_000 + i * 60_000,
    internalMed: 1_640_000 + i * 42_000,
    agentA: 1_480_000 + i * 24_000,
    agentB: 1_260_000 + i * 20_000,
    agentC: 1_040_000 + i * 18_000,
  }));

  const discharged = 1_240;
  const billed = 1_120;
  const submitted = 986;
  const paid = 872;

  const funnel: FunnelStage[] = [
    { stage: "Discharged", count: discharged, encounters: buildEncounters(0, "Discharged", 0) },
    { stage: "Bill Generated", count: billed, encounters: buildEncounters(14, "Bill Generated", 100) },
    { stage: "Claim Submitted", count: submitted, encounters: buildEncounters(10, "Claim Submitted", 200) },
    { stage: "Paid", count: paid, encounters: buildEncounters(6, "Paid", 300) },
  ];

  const philhealthCoverage: CoverageSlice[] = [
    { category: "Employed", count: 3_420, color: "#1A5CA8" },
    { category: "Self-Earning", count: 1_180, color: "#4454C3" },
    { category: "Indigent", count: 2_640, color: "#1A7A3C" },
    { category: "Sponsored", count: 1_960, color: "#E67E22" },
    { category: "Lifetime", count: 840, color: "#B7950B" },
    { category: "OFW", count: 620, color: "#6B4C9A" },
    { category: "Non-member", count: 340, color: "#999999" },
  ];

  const scPwdTrend: ScPwdPoint[] = months.map((month, i) => ({
    month,
    patients: 210 + i * 14 + (i % 2 === 0 ? 8 : -4),
    discountAmount: 1_240_000 + i * 68_000,
  }));

  return {
    tenant: "Cebu City Medical Center",
    period: "August 2026 (MTD)",
    priorPeriod: "July 2026",
    kpis: {
      grossRevenue: { value: grossCharges, budget: 21_800_000, delta: 6.2 },
      netRevenue: { value: patientCollections + cr1 + cr2, delta: 4.8 },
      collectionRate: { value: 91.4, delta: 1.6 },
      daysInAR: { value: 34.2, delta: -2.1, benchmark: 30 },
      writeOffRate: { value: 1.78, delta: -0.3 },
    },
    waterfall,
    payerMix: [
      { payer: "PhilHealth", amount: 8_720_000, color: REV.philhealth },
      { payer: "HMO", amount: 3_960_000, color: REV.hmo },
      { payer: "Private Pay", amount: 5_240_000, color: REV.privatePay },
      { payer: "SC/PWD Discount", amount: 1_640_000, color: REV.scpwd },
      { payer: "GSIS/Other", amount: 980_000, color: REV.gsis },
      { payer: "Write-offs", amount: 402_540, color: REV.writeoff },
    ],
    payerTrend: months.map((month, i) => ({
      month,
      philhealth: 6_800_000 + i * 240_000,
      hmo: 3_100_000 + i * 90_000,
      privatePay: 4_600_000 + i * 70_000,
      scpwd: 1_400_000 + i * 45_000,
      gsis: 720_000 + i * 18_000,
      writeoff: 360_000 + i * 8_000,
    })),
    departmentRevenue,
    arAging,
    arOver90: buildPatientRows(18, payers),
    collectionTrend,
    funnel,
    philhealthCoverage,
    scPwdTrend,
  };
}

export function fetchRevenueData(): Promise<RevenueData> {
  return new Promise((resolve) => setTimeout(() => resolve(getRevenueData()), 500));
}
