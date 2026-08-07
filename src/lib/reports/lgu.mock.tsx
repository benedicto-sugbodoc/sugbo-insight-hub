/**
 * Report configs + deterministic mock data for the LGU Reports module
 * (Type B). Same ReportConfig<T> contract as hospital.mock.tsx, consumed
 * by the shared <ReportShell />. Reuses the barangay/BHC roster from the
 * LGU analytics module (Block 2) for cross-module consistency.
 */
import type { ReactNode } from "react";
import type { ReportConfig, ReportDrawerData } from "@/components/reports/types";
import { REPORT_TODAY } from "@/components/reports/export-utils";
import { BARANGAYS, BHC_LIST } from "@/lib/analytics/lgu/shared.mock";

// Type-erased registry: each report below is authored against its own concrete row type
// and only erased at this boundary so heterogeneous reports can share one array.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyReportConfig = ReportConfig<any>;

function seeded(i: number, salt = 1): number {
  const x = Math.sin(i * 12.9898 * salt + 78.233) * 43758.5453;
  return x - Math.floor(x);
}
function seededRange(i: number, min: number, max: number, salt = 1): number {
  return min + seeded(i, salt) * (max - min);
}
function isoDaysAgo(days: number): string {
  const d = new Date(REPORT_TODAY);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function StatusChip({
  tone,
  children,
}: {
  tone: "good" | "warning" | "danger" | "neutral";
  children: ReactNode;
}) {
  const map: Record<string, string> = {
    good: "bg-success/10 text-success border-success/30",
    warning: "bg-warning/10 text-warning border-warning/30",
    danger: "bg-danger/10 text-danger border-danger/30",
    neutral: "bg-brand/10 text-brand border-brand/30",
  };
  return (
    <span
      className={`inline-flex rounded border px-1.5 py-0.5 text-[11px] font-medium ${map[tone]}`}
    >
      {children}
    </span>
  );
}

const months6 = ["Mar 26", "Apr 26", "May 26", "Jun 26", "Jul 26", "Aug 26"];
const monthIso6 = [
  "2026-03-01",
  "2026-04-01",
  "2026-05-01",
  "2026-06-01",
  "2026-07-01",
  "2026-08-01",
];

/* ------------------------------------------------------------------ */
/* R-11 Monthly FHSIS (M1/M2 equivalent)                               */
/* ------------------------------------------------------------------ */

interface FhsisRow {
  section: string;
  indicator: string;
  month: string;
  isoDate: string;
  count: number;
  target: number;
}

const fhsisIndicators: [string, string, number][] = [
  ["Family Planning", "New acceptors — Pills", 420],
  ["Family Planning", "New acceptors — Condom", 180],
  ["Family Planning", "New acceptors — IUD", 90],
  ["Family Planning", "New acceptors — Injectable", 260],
  ["Family Planning", "New acceptors — Implant", 70],
  ["Family Planning", "New acceptors — LAM", 40],
  ["Family Planning", "New acceptors — BTL/NSV", 20],
  ["Maternal Care", "ANC 1st visit", 420],
  ["Maternal Care", "ANC 4th visit", 340],
  ["Maternal Care", "TT1", 380],
  ["Maternal Care", "TT2", 320],
  ["Maternal Care", "Facility-based delivery", 300],
  ["Maternal Care", "Postpartum visit", 280],
  ["Child Care", "OPV3", 460],
  ["Child Care", "DPT3 (Penta3)", 460],
  ["Child Care", "BCG", 480],
  ["Child Care", "HepB (birth dose)", 470],
  ["Child Care", "Measles (MCV1)", 450],
  ["Child Care", "Fully Immunized Child (FIC)", 440],
  ["Nutrition", "Weight monitoring this month", 3200],
  ["Nutrition", "Malnourished identified", 240],
  ["Nutrition", "Given supplementation", 210],
  ["NCD", "Hypertensive adults screened", 1400],
  ["NCD", "Diabetic adults screened", 900],
  ["NCD", "Enrolled in NCD program", 620],
  ["TB", "Presumptive TB examined", 260],
  ["TB", "New bacteriologically-confirmed PTB", 42],
  ["TB", "Currently on treatment", 216],
];

function buildFhsis(): FhsisRow[] {
  const rows: FhsisRow[] = [];
  fhsisIndicators.forEach(([section, indicator, target], ii) => {
    months6.forEach((month, mi) => {
      rows.push({
        section,
        indicator,
        month,
        isoDate: monthIso6[mi]!,
        count: Math.round(target * seededRange(ii * 6 + mi, 0.72, 1.08, 30)),
        target,
      });
    });
  });
  return rows;
}

const fhsisSections = Array.from(new Set(fhsisIndicators.map((i) => i[0])));

const r11: ReportConfig<FhsisRow> = {
  id: "fhsis-monthly",
  code: "R-11",
  title: "Monthly Field Health Service Information System (FHSIS)",
  purpose:
    "DOH FHSIS M1/M2 equivalent — monthly summary of Family Planning, Maternal Care, Child Care, Nutrition, NCD and TB services.",
  jurisdiction: "lgu",
  formatNote: "DOH standard FHSIS layout — Export PDF matches the official FHSIS submission form.",
  dateField: "isoDate",
  searchFields: ["indicator", "section"],
  filters: [
    {
      key: "section",
      label: "Section",
      type: "select",
      options: fhsisSections.map((s) => ({ label: s, value: s })),
    },
  ],
  columns: [
    { key: "section", header: "Section", sortable: true },
    { key: "indicator", header: "Indicator", sortable: true },
    { key: "month", header: "Month", sortable: true },
    { key: "count", header: "Count", align: "right", sortable: true },
    { key: "target", header: "Target", align: "right" },
    {
      key: "coverage",
      header: "Coverage%",
      align: "right",
      sortValue: (r) => (r.count / r.target) * 100,
      render: (r) => {
        const cov = (r.count / r.target) * 100;
        return (
          <StatusChip tone={cov >= 95 ? "good" : cov >= 80 ? "warning" : "danger"}>
            {cov.toFixed(0)}%
          </StatusChip>
        );
      },
    },
  ],
  getRows: buildFhsis,
  getDrawer: (r): ReportDrawerData => ({
    heading: r.indicator,
    subheading: `${r.section} · ${r.month}`,
    detail: [
      { label: "Count", value: r.count },
      { label: "Target", value: r.target },
      { label: "Coverage", value: `${((r.count / r.target) * 100).toFixed(1)}%` },
    ],
  }),
};

/* ------------------------------------------------------------------ */
/* R-12 Immunization Coverage by Antigen × Barangay                    */
/* ------------------------------------------------------------------ */

interface ImmunizationCoverageRow {
  barangay: string;
  targetPopulation: number;
  bcg: number;
  hepB: number;
  penta: number;
  opv: number;
  pcv: number;
  mmr: number;
}

function buildImmunizationCoverage(): ImmunizationCoverageRow[] {
  return BARANGAYS.map((b, i) => {
    const targetPopulation = Math.round(b.population * 0.018); // POPCOM-based est. 0-11mo cohort
    return {
      barangay: b.name,
      targetPopulation,
      bcg: Math.round(seededRange(i, 82, 99, 31)),
      hepB: Math.round(seededRange(i, 80, 98, 32)),
      penta: Math.round(seededRange(i, 74, 97, 33)),
      opv: Math.round(seededRange(i, 76, 97, 34)),
      pcv: Math.round(seededRange(i, 70, 95, 35)),
      mmr: Math.round(seededRange(i, 68, 94, 36)),
    };
  });
}

function coverageCell(v: number) {
  return <StatusChip tone={v >= 95 ? "good" : v >= 80 ? "warning" : "danger"}>{v}%</StatusChip>;
}

const r12: ReportConfig<ImmunizationCoverageRow> = {
  id: "immunization-coverage-antigen-barangay",
  code: "R-12",
  title: "Immunization Coverage Report by Antigen × Barangay",
  purpose:
    "EPI (Expanded Program on Immunization) tracking — doses given vs POPCOM-based target population.",
  jurisdiction: "lgu",
  searchFields: ["barangay"],
  defaultSort: { key: "barangay", dir: "asc" },
  filters: [],
  columns: [
    { key: "barangay", header: "Barangay", sortable: true },
    { key: "targetPopulation", header: "Target Population", align: "right", sortable: true },
    {
      key: "bcg",
      header: "BCG",
      align: "right",
      sortable: true,
      render: (r) => coverageCell(r.bcg),
    },
    {
      key: "hepB",
      header: "HepB",
      align: "right",
      sortable: true,
      render: (r) => coverageCell(r.hepB),
    },
    {
      key: "penta",
      header: "Penta",
      align: "right",
      sortable: true,
      render: (r) => coverageCell(r.penta),
    },
    {
      key: "opv",
      header: "OPV",
      align: "right",
      sortable: true,
      render: (r) => coverageCell(r.opv),
    },
    {
      key: "pcv",
      header: "PCV",
      align: "right",
      sortable: true,
      render: (r) => coverageCell(r.pcv),
    },
    {
      key: "mmr",
      header: "MMR",
      align: "right",
      sortable: true,
      render: (r) => coverageCell(r.mmr),
    },
  ],
  getRows: buildImmunizationCoverage,
  summaryRow: (rows) => {
    const avg = (key: keyof ImmunizationCoverageRow) =>
      rows.length ? Math.round(rows.reduce((s, r) => s + (r[key] as number), 0) / rows.length) : 0;
    return {
      barangay: "City/municipal average",
      targetPopulation: rows.reduce((s, r) => s + r.targetPopulation, 0).toLocaleString("en-PH"),
      bcg: coverageCell(avg("bcg")),
      hepB: coverageCell(avg("hepB")),
      penta: coverageCell(avg("penta")),
      opv: coverageCell(avg("opv")),
      pcv: coverageCell(avg("pcv")),
      mmr: coverageCell(avg("mmr")),
    };
  },
  getDrawer: (r): ReportDrawerData => ({
    heading: r.barangay,
    subheading: `Target population (0–11mo est.): ${r.targetPopulation}`,
    detail: [
      { label: "BCG", value: `${r.bcg}%` },
      { label: "HepB", value: `${r.hepB}%` },
      { label: "Penta", value: `${r.penta}%` },
      { label: "OPV", value: `${r.opv}%` },
      { label: "PCV", value: `${r.pcv}%` },
      { label: "MMR", value: `${r.mmr}%` },
    ],
    related: [
      { label: "Full barangay health profile", value: "See LGU Analytics → Executive map" },
    ],
  }),
};

/* ------------------------------------------------------------------ */
/* R-13 Maternal Death Audit Report — restricted                       */
/* ------------------------------------------------------------------ */

interface MaternalDeathRow {
  date: string;
  caseLabel: string;
  age: number;
  gravidaPara: string;
  ancVisits: number;
  causeCode: string;
  causeOfDeath: string;
  placeOfDeath: string;
  avoidable: "Yes" | "No" | "Under review";
  recommendations: string;
}

function buildMaternalDeaths(): MaternalDeathRow[] {
  const causes: [string, string][] = [
    ["O72.1", "Postpartum hemorrhage"],
    ["O15.0", "Eclampsia in pregnancy"],
    ["O88.1", "Amniotic fluid embolism"],
    ["O75.1", "Shock during labor and delivery"],
    ["O98.1", "Sepsis complicating pregnancy"],
  ];
  return Array.from({ length: 5 }, (_, i) => {
    const cause = causes[i % causes.length]!;
    const avoidable = (["Yes", "No", "Under review"] as const)[i % 3]!;
    return {
      date: isoDaysAgo(30 + i * 40),
      caseLabel: `Case #${i + 1}`,
      age: 22 + ((i * 6) % 20),
      gravidaPara: `G${2 + (i % 4)}P${1 + (i % 3)}`,
      ancVisits: Math.round(seededRange(i, 0, 4, 40)),
      causeCode: cause[0],
      causeOfDeath: cause[1],
      placeOfDeath: i % 2 === 0 ? "Referral hospital" : "En route to facility",
      avoidable,
      recommendations:
        avoidable === "Yes"
          ? "Strengthen early referral protocol and PHN home-visit follow-up for high-risk pregnancies."
          : avoidable === "No"
            ? "No systems gap identified; case reviewed and closed."
            : "Pending maternal death review committee findings.",
    };
  });
}

const r13: ReportConfig<MaternalDeathRow> = {
  id: "maternal-death-audit",
  code: "R-13",
  title: "Maternal Death Audit Report",
  purpose:
    "Maternal death review for quality improvement. Triggered by any encounter with a maternal ICD-10 code and discharge disposition = expired.",
  jurisdiction: "lgu",
  roleNote: "MHO and CHO only — restricted",
  dateField: "date",
  searchFields: ["caseLabel", "causeOfDeath"],
  defaultSort: { key: "date", dir: "desc" },
  filters: [
    {
      key: "avoidable",
      label: "Avoidable?",
      type: "select",
      options: [
        { label: "Yes", value: "Yes" },
        { label: "No", value: "No" },
        { label: "Under review", value: "Under review" },
      ],
    },
  ],
  rowAlert: (r) => r.avoidable === "Yes",
  columns: [
    { key: "date", header: "Date", sortable: true },
    { key: "caseLabel", header: "Patient (de-identified)" },
    { key: "age", header: "Age", align: "right" },
    { key: "gravidaPara", header: "Gravida/Para" },
    { key: "ancVisits", header: "ANC Visits", align: "right" },
    {
      key: "causeCode",
      header: "Cause of Death (ICD-10)",
      render: (r) => `${r.causeCode} · ${r.causeOfDeath}`,
    },
    { key: "placeOfDeath", header: "Place of Death" },
    {
      key: "avoidable",
      header: "Avoidable?",
      render: (r) => (
        <StatusChip
          tone={r.avoidable === "Yes" ? "danger" : r.avoidable === "No" ? "good" : "warning"}
        >
          {r.avoidable}
        </StatusChip>
      ),
    },
  ],
  getRows: buildMaternalDeaths,
  getDrawer: (r): ReportDrawerData => ({
    heading: r.caseLabel,
    subheading: `${r.date} · restricted record`,
    alert:
      "Access restricted to MHO and CHO. Do not export outside the maternal death review committee.",
    detail: [
      { label: "Age", value: r.age },
      { label: "Gravida/Para", value: r.gravidaPara },
      { label: "ANC visits", value: r.ancVisits },
      { label: "Cause of death", value: `${r.causeCode} · ${r.causeOfDeath}` },
      { label: "Place of death", value: r.placeOfDeath },
      { label: "Avoidable?", value: r.avoidable },
    ],
    related: [{ label: "Recommendations", value: r.recommendations }],
    actions: [{ label: "Open maternal death review minutes", variant: "outline" }],
  }),
};

/* ------------------------------------------------------------------ */
/* R-14 TB Program Quarterly Report — NTP Form 6 equivalent            */
/* ------------------------------------------------------------------ */

interface TbQuarterlyRow {
  section: string;
  indicator: string;
  quarter: string;
  isoDate: string;
  value: number;
}
const quarters = ["Q3 2025", "Q4 2025", "Q1 2026", "Q2 2026"];
const quarterIso = ["2025-07-01", "2025-10-01", "2026-01-01", "2026-04-01"];
const ntpIndicators: [string, string][] = [
  ["Case Notification", "Bacteriologically confirmed, new"],
  ["Case Notification", "Clinically diagnosed, new"],
  ["Case Notification", "Relapse"],
  ["Treatment Enrollment", "Enrolled — Category I"],
  ["Treatment Enrollment", "Enrolled — Category II (retreatment)"],
  ["Treatment Enrollment", "Enrolled — Drug-resistant regimen"],
  ["Treatment Outcomes", "Cured"],
  ["Treatment Outcomes", "Treatment completed"],
  ["Treatment Outcomes", "Failed"],
  ["Treatment Outcomes", "Lost to follow-up"],
  ["Treatment Outcomes", "Died"],
];

function buildTbQuarterly(): TbQuarterlyRow[] {
  const rows: TbQuarterlyRow[] = [];
  ntpIndicators.forEach(([section, indicator], ii) => {
    quarters.forEach((quarter, qi) => {
      rows.push({
        section,
        indicator,
        quarter,
        isoDate: quarterIso[qi]!,
        value: Math.round(seededRange(ii * 4 + qi, 6, 220, 41)),
      });
    });
  });
  return rows;
}
const ntpSections = Array.from(new Set(ntpIndicators.map((i) => i[0])));

const r14: ReportConfig<TbQuarterlyRow> = {
  id: "tb-quarterly-ntp",
  code: "R-14",
  title: "TB Program Quarterly Report (NTP format)",
  purpose:
    "National TB Program quarterly submission to DOH — case notification, treatment enrollment and treatment outcomes.",
  jurisdiction: "lgu",
  formatNote: "NTP Case Finding (Form 6) equivalent — Export PDF matches the NTP standard format.",
  dateField: "isoDate",
  searchFields: ["indicator", "section"],
  filters: [
    {
      key: "section",
      label: "Section",
      type: "select",
      options: ntpSections.map((s) => ({ label: s, value: s })),
    },
  ],
  columns: [
    { key: "section", header: "Section", sortable: true },
    { key: "indicator", header: "Indicator", sortable: true },
    { key: "quarter", header: "Quarter", sortable: true },
    { key: "value", header: "Count", align: "right", sortable: true },
  ],
  getRows: buildTbQuarterly,
  getDrawer: (r): ReportDrawerData => ({
    heading: r.indicator,
    subheading: `${r.section} · ${r.quarter}`,
    detail: [{ label: "Count", value: r.value }],
  }),
};

/* ------------------------------------------------------------------ */
/* R-15 Konsulta Enrollment & Utilization Report                       */
/* ------------------------------------------------------------------ */

interface KonsultaUtilRow {
  bhc: string;
  month: string;
  isoDate: string;
  membershipType: string;
  enrolledMembers: number;
  activeVisitors: number;
  ekasSubmitted: number;
  ekasValue: number;
  approvalRate: number;
  denialRate: number;
}
const membershipTypes = ["Formal Economy", "Informal Economy", "Indigent (NHTS)", "Senior Citizen"];

function buildKonsultaUtil(): KonsultaUtilRow[] {
  const rows: KonsultaUtilRow[] = [];
  BHC_LIST.forEach((bhc, bi) => {
    months6.forEach((month, mi) => {
      const membershipType = membershipTypes[bi % membershipTypes.length]!;
      const enrolled = Math.round(seededRange(bi * 6 + mi, 4200, 12800, 42));
      const active = Math.round(enrolled * seededRange(bi * 6 + mi, 0.28, 0.62, 43));
      const approvalRate = Math.round(seededRange(bi * 6 + mi, 78, 97, 44));
      rows.push({
        bhc,
        month,
        isoDate: monthIso6[mi]!,
        membershipType,
        enrolledMembers: enrolled,
        activeVisitors: active,
        ekasSubmitted: Math.round(active * seededRange(bi * 6 + mi, 0.7, 0.95, 45)),
        ekasValue: Math.round(active * seededRange(bi * 6 + mi, 380, 620, 46)),
        approvalRate,
        denialRate: 100 - approvalRate,
      });
    });
  });
  return rows;
}

const r15: ReportConfig<KonsultaUtilRow> = {
  id: "konsulta-enrollment-utilization",
  code: "R-15",
  title: "Konsulta Enrollment & Utilization Report",
  purpose: "PhilHealth Konsulta Package (KP) performance monitoring across the BHC network.",
  jurisdiction: "lgu",
  dateField: "isoDate",
  searchFields: ["bhc"],
  defaultSort: { key: "enrolledMembers", dir: "desc" },
  filters: [
    {
      key: "bhc",
      label: "BHC",
      type: "select",
      options: BHC_LIST.map((b) => ({ label: b, value: b })),
    },
    {
      key: "membershipType",
      label: "Membership type",
      type: "select",
      options: membershipTypes.map((m) => ({ label: m, value: m })),
    },
  ],
  columns: [
    { key: "bhc", header: "BHC", sortable: true },
    { key: "month", header: "Month", sortable: true },
    { key: "enrolledMembers", header: "Enrolled Members", align: "right", sortable: true },
    { key: "activeVisitors", header: "Active Visitors (MTD)", align: "right", sortable: true },
    {
      key: "utilizationRate",
      header: "Utilization Rate%",
      align: "right",
      sortValue: (r) => (r.activeVisitors / r.enrolledMembers) * 100,
      render: (r) => `${((r.activeVisitors / r.enrolledMembers) * 100).toFixed(1)}%`,
    },
    { key: "ekasSubmitted", header: "eKAS Submitted", align: "right", sortable: true },
    {
      key: "ekasValue",
      header: "eKAS Value",
      align: "right",
      render: (r) => `PHP ${r.ekasValue.toLocaleString("en-PH")}`,
    },
    {
      key: "approvalRate",
      header: "Approval Rate",
      align: "right",
      sortable: true,
      render: (r) => (
        <StatusChip
          tone={r.approvalRate >= 90 ? "good" : r.approvalRate >= 80 ? "warning" : "danger"}
        >
          {r.approvalRate}%
        </StatusChip>
      ),
    },
    { key: "denialRate", header: "Denial Rate", align: "right", render: (r) => `${r.denialRate}%` },
  ],
  getRows: buildKonsultaUtil,
  getDrawer: (r): ReportDrawerData => ({
    heading: r.bhc,
    subheading: `${r.month} · ${r.membershipType}`,
    detail: [
      { label: "Enrolled members", value: r.enrolledMembers },
      { label: "Active visitors (MTD)", value: r.activeVisitors },
      {
        label: "Utilization rate",
        value: `${((r.activeVisitors / r.enrolledMembers) * 100).toFixed(1)}%`,
      },
      { label: "eKAS submitted", value: r.ekasSubmitted },
      { label: "eKAS value", value: `PHP ${r.ekasValue.toLocaleString("en-PH")}` },
      { label: "Approval rate", value: `${r.approvalRate}%` },
      { label: "Denial rate", value: `${r.denialRate}%` },
    ],
    related: [{ label: "Konsulta dashboard", value: "See LGU Analytics → Konsulta" }],
  }),
};

/* ------------------------------------------------------------------ */
/* R-16 Referral Network Analysis Report                               */
/* ------------------------------------------------------------------ */

interface ReferralRow {
  bhc: string;
  date: string;
  referralReason: string;
  receivingFacility: string;
  outcomeDocumented: boolean;
  outcome: string;
  feedbackReceived: boolean;
}
const referralReasons = [
  "Suspected TB",
  "High-risk pregnancy",
  "Uncontrolled hypertension",
  "Suspected dengue",
  "Trauma/injury",
  "Suspected malignancy",
];
const receivingFacilities = [
  "Cebu City Medical Center",
  "Vicente Sotto Memorial",
  "Cebu South Med Center",
  "Private partner hospital",
];
const referralOutcomes = ["Admitted", "OPD", "Returned"];

function buildReferrals(): ReferralRow[] {
  const rows: ReferralRow[] = Array.from({ length: 60 }, (_, i) => {
    const bhc = BHC_LIST[i % BHC_LIST.length]!;
    const documented = seeded(i, 47) > 0.22;
    return {
      bhc,
      date: isoDaysAgo(2 + (i % 55)),
      referralReason: referralReasons[i % referralReasons.length]!,
      receivingFacility: receivingFacilities[i % receivingFacilities.length]!,
      outcomeDocumented: documented,
      outcome: documented ? referralOutcomes[i % referralOutcomes.length]! : "Pending",
      feedbackReceived: documented && seeded(i, 48) > 0.3,
    };
  });
  return rows;
}
const referralRowsCache = buildReferrals();
function totalReferralsFor(bhc: string) {
  return referralRowsCache.filter((r) => r.bhc === bhc).length;
}

const r16: ReportConfig<ReferralRow> = {
  id: "referral-network-analysis",
  code: "R-16",
  title: "Referral Network Analysis Report",
  purpose:
    "Track referral flow from BHC to hospital, and completion rate by BHC and receiving facility.",
  jurisdiction: "lgu",
  dateField: "date",
  searchFields: ["bhc", "referralReason", "receivingFacility"],
  defaultSort: { key: "date", dir: "desc" },
  filters: [
    {
      key: "bhc",
      label: "BHC",
      type: "select",
      options: BHC_LIST.map((b) => ({ label: b, value: b })),
    },
    {
      key: "receivingFacility",
      label: "Receiving facility",
      type: "select",
      options: receivingFacilities.map((f) => ({ label: f, value: f })),
    },
  ],
  rowAlert: (r) => !r.outcomeDocumented,
  columns: [
    { key: "bhc", header: "BHC", sortable: true },
    {
      key: "totalReferrals",
      header: "Total Referrals",
      align: "right",
      render: (r) => String(totalReferralsFor(r.bhc)),
    },
    { key: "referralReason", header: "Referral Reason", sortable: true },
    { key: "receivingFacility", header: "Receiving Facility", sortable: true },
    {
      key: "outcomeDocumented",
      header: "Outcome Documented",
      render: (r) => (
        <StatusChip tone={r.outcomeDocumented ? "good" : "danger"}>
          {r.outcomeDocumented ? "Yes" : "No"}
        </StatusChip>
      ),
    },
    { key: "outcome", header: "Outcome", sortable: true },
    {
      key: "feedbackReceived",
      header: "Feedback Received",
      render: (r) => (
        <StatusChip tone={r.feedbackReceived ? "good" : "warning"}>
          {r.feedbackReceived ? "Yes" : "No"}
        </StatusChip>
      ),
    },
  ],
  getRows: () => referralRowsCache,
  getDrawer: (r): ReportDrawerData => ({
    heading: `${r.bhc} → ${r.receivingFacility}`,
    subheading: r.date,
    ...(!r.outcomeDocumented
      ? { alert: "Outcome not yet documented — follow up with receiving facility." }
      : {}),
    detail: [
      { label: "Referral reason", value: r.referralReason },
      { label: "Receiving facility", value: r.receivingFacility },
      { label: "Outcome documented", value: r.outcomeDocumented ? "Yes" : "No" },
      { label: "Outcome", value: r.outcome },
      { label: "Feedback received", value: r.feedbackReceived ? "Yes" : "No" },
    ],
    actions: [{ label: "Send follow-up request to receiving facility", variant: "default" }],
  }),
};

/* ------------------------------------------------------------------ */
/* R-17 Community Household Health Profile                             */
/* ------------------------------------------------------------------ */

interface HouseholdProfileRow {
  barangay: string;
  households: number;
  members: number;
  philhealthCoverage: number;
  fourPsPct: number;
  withDm: number;
  withHtn: number;
  withTb: number;
  pregnant: number;
  childrenUnder5: number;
  elderly: number;
}

function buildHouseholdProfile(): HouseholdProfileRow[] {
  return BARANGAYS.map((b, i) => {
    const households = Math.round(b.population / 4.3);
    return {
      barangay: b.name,
      households,
      members: b.population,
      philhealthCoverage: Math.round(seededRange(i, 58, 92, 50)),
      fourPsPct: Math.round(seededRange(i, 12, 42, 51)),
      withDm: Math.round(b.population * seededRange(i, 0.02, 0.05, 52)),
      withHtn: Math.round(b.population * seededRange(i, 0.05, 0.11, 53)),
      withTb: Math.round(seededRange(i, 4, 26, 54)),
      pregnant: Math.round(b.population * seededRange(i, 0.008, 0.015, 55)),
      childrenUnder5: Math.round(b.population * seededRange(i, 0.07, 0.11, 56)),
      elderly: Math.round(b.population * seededRange(i, 0.06, 0.1, 57)),
    };
  });
}

const r17: ReportConfig<HouseholdProfileRow> = {
  id: "community-household-health-profile",
  code: "R-17",
  title: "Community Household Health Profile",
  purpose:
    "Aggregate health profile of registered households by barangay — for barangay health profiling and CBHIS.",
  jurisdiction: "lgu",
  searchFields: ["barangay"],
  defaultSort: { key: "households", dir: "desc" },
  filters: [],
  columns: [
    { key: "barangay", header: "Barangay", sortable: true },
    { key: "households", header: "Households Registered", align: "right", sortable: true },
    { key: "members", header: "Members", align: "right", sortable: true },
    {
      key: "philhealthCoverage",
      header: "PhilHealth Coverage%",
      align: "right",
      sortable: true,
      render: (r) => `${r.philhealthCoverage}%`,
    },
    { key: "fourPsPct", header: "4Ps%", align: "right", render: (r) => `${r.fourPsPct}%` },
    { key: "withDm", header: "With DM", align: "right" },
    { key: "withHtn", header: "With HTN", align: "right" },
    { key: "withTb", header: "With TB", align: "right" },
    { key: "pregnant", header: "Pregnant", align: "right" },
    { key: "childrenUnder5", header: "Children <5", align: "right" },
    { key: "elderly", header: "Elderly (60+)", align: "right" },
  ],
  getRows: buildHouseholdProfile,
  getDrawer: (r): ReportDrawerData => ({
    heading: r.barangay,
    subheading: `${r.households.toLocaleString("en-PH")} households · ${r.members.toLocaleString("en-PH")} members`,
    detail: [
      { label: "PhilHealth coverage", value: `${r.philhealthCoverage}%` },
      { label: "4Ps enrollment", value: `${r.fourPsPct}%` },
      { label: "With DM", value: r.withDm },
      { label: "With HTN", value: r.withHtn },
      { label: "With TB", value: r.withTb },
      { label: "Pregnant", value: r.pregnant },
      { label: "Children <5", value: r.childrenUnder5 },
      { label: "Elderly (60+)", value: r.elderly },
    ],
    related: [{ label: "Barangay health map", value: "See LGU Analytics → Executive" }],
  }),
};

/* ------------------------------------------------------------------ */
/* R-18 Dengue Surveillance Report (PIDSR format)                      */
/* ------------------------------------------------------------------ */

interface DengueRow {
  caseNo: string;
  dateOfOnset: string;
  barangay: string;
  age: number;
  sex: "M" | "F";
  dengueType: string;
  outcome: string;
  hospitalized: boolean;
  dateNotifiedCesu: string;
}
const dengueTypes = ["Dengue", "Dengue with Warning Signs", "Severe Dengue"];
const dengueOutcomes = ["Recovered", "Recovering", "Referred", "Died"];

function buildDengueCases(): DengueRow[] {
  return Array.from({ length: 34 }, (_, i) => {
    const barangay = BARANGAYS[i % BARANGAYS.length]!.name;
    const type = dengueTypes[i % dengueTypes.length]!;
    const onset = isoDaysAgo(1 + (i % 21));
    return {
      caseNo: `DGE-2026-${(600 + i).toString()}`,
      dateOfOnset: onset,
      barangay,
      age: 2 + ((i * 7) % 68),
      sex: i % 2 === 0 ? "F" : "M",
      dengueType: type,
      outcome:
        type === "Severe Dengue"
          ? seeded(i, 58) > 0.7
            ? "Died"
            : "Referred"
          : dengueOutcomes[i % 3]!,
      hospitalized: type !== "Dengue" || seeded(i, 59) > 0.5,
      dateNotifiedCesu: isoDaysAgo(Math.max(0, (i % 21) - 1)),
    };
  });
}

const r18: ReportConfig<DengueRow> = {
  id: "dengue-surveillance-pidsr",
  code: "R-18",
  title: "Dengue Surveillance Report (PIDSR format)",
  purpose:
    "Philippine Integrated Disease Surveillance & Response — Case Investigation Form (CIF) summary for CESU submission.",
  jurisdiction: "lgu",
  formatNote: "PIDSR Case Investigation Form (CIF) — Export PDF matches CESU submission format.",
  automationNote:
    "Auto-triggers an outbreak alert when weekly case count exceeds the epidemic threshold (see LGU Analytics → Executive).",
  dateField: "dateOfOnset",
  searchFields: ["caseNo", "barangay"],
  defaultSort: { key: "dateOfOnset", dir: "desc" },
  filters: [
    {
      key: "barangay",
      label: "Barangay",
      type: "select",
      options: BARANGAYS.map((b) => ({ label: b.name, value: b.name })),
    },
    {
      key: "dengueType",
      label: "Dengue type",
      type: "select",
      options: dengueTypes.map((t) => ({ label: t, value: t })),
    },
  ],
  rowAlert: (r) => r.dengueType === "Severe Dengue",
  columns: [
    { key: "caseNo", header: "Case #", sortable: true },
    { key: "dateOfOnset", header: "Date of Onset", sortable: true },
    { key: "barangay", header: "Barangay", sortable: true },
    { key: "age", header: "Age", align: "right" },
    { key: "sex", header: "Sex" },
    {
      key: "dengueType",
      header: "Dengue Type",
      sortable: true,
      render: (r) => (
        <StatusChip
          tone={
            r.dengueType === "Severe Dengue"
              ? "danger"
              : r.dengueType === "Dengue with Warning Signs"
                ? "warning"
                : "neutral"
          }
        >
          {r.dengueType}
        </StatusChip>
      ),
    },
    { key: "outcome", header: "Outcome" },
    {
      key: "hospitalized",
      header: "Hospitalized?",
      render: (r) => (r.hospitalized ? "Yes" : "No"),
    },
    { key: "dateNotifiedCesu", header: "Date Notified to CESU", sortable: true },
  ],
  getRows: buildDengueCases,
  getDrawer: (r): ReportDrawerData => ({
    heading: r.caseNo,
    subheading: `${r.barangay} · onset ${r.dateOfOnset}`,
    ...(r.dengueType === "Severe Dengue"
      ? { alert: "Severe Dengue — verify hospitalization and CESU notification status." }
      : {}),
    detail: [
      { label: "Age / Sex", value: `${r.age} / ${r.sex}` },
      { label: "Dengue type", value: r.dengueType },
      { label: "Outcome", value: r.outcome },
      { label: "Hospitalized", value: r.hospitalized ? "Yes" : "No" },
      { label: "Date notified to CESU", value: r.dateNotifiedCesu },
    ],
    documents: [{ name: "Case Investigation Form (CIF).pdf", type: "Surveillance" }],
    related: [{ label: "Epidemic curve", value: "See LGU Analytics → Executive" }],
  }),
};

export const lguReports: AnyReportConfig[] = [
  r11,
  r12,
  r13,
  r14,
  r15,
  r16,
  r17,
  r18,
] as AnyReportConfig[];

export function getLguReport(id: string): AnyReportConfig | undefined {
  return lguReports.find((r) => r.id === id);
}
