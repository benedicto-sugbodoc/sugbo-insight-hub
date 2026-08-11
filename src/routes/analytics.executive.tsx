/**
 * Executive Overview — Tier 1 of the hospital analytics hierarchy
 * (Overview -> Comparison -> Investigation -> Drill-down -> Detail).
 *
 * This is the first screen a hospital decision-maker sees. It answers four
 * questions and deliberately stops there, linking out to the deeper pages
 * rather than duplicating them:
 *
 *   1. What is happening?          -> KPI strip (period totals)
 *   2. What has changed?           -> every KPI carries a period-over-period
 *                                     delta computed against the immediately
 *                                     preceding window of equal length
 *   3. Where are the differences?  -> volume/revenue trend by department and
 *                                     the department positioning chart
 *   4. What needs attention?       -> the "Needs attention" panel, whose items
 *                                     are computed outliers/threshold crossings,
 *                                     never hand-authored copy
 *
 * Every number on this page derives from the shared synthetic dataset
 * (`src/lib/data/hospital`) through the `derive.ts` query layer, so figures
 * reconcile with Performance, Financial, Claims and Patient Experience. The old
 * `src/lib/analytics/executive.mock.ts` is no longer read here.
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Area,
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CircleDollarSign,
  Coins,
  Receipt,
  Smile,
  Timer,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  KpiStrip,
  LegendDot,
  MetricCard,
  PALETTE,
  PanelCard,
  SectionTitle,
  StatRow,
  StatusBadge,
  brandRamp,
  num,
  pct,
  php,
  type MetricStatus,
} from "@/components/analytics/shared";
import {
  ChartDrillDrawer,
  InteractiveChartCard,
  RichTooltip,
  type RichTooltipPayloadEntry,
} from "@/components/analytics/interactive";
import {
  GlobalHospitalFilterBar,
  useHospitalFilters,
} from "@/components/analytics/hospital-filter-context";
import {
  MS_DAY,
  arAgingByPayer,
  claimDenialReasons,
  claimTurnaroundByDepartment,
  claimsByStatus,
  doctorProductivity,
  fetchHospitalDataset,
  filterEncounters,
  losStatsByDepartment,
  npsByDepartment,
  parseDate,
  paymentStatusBreakdown,
  payerMix,
  readmissionRateByPayerAndDepartment,
  revenueByDepartment,
  revenueByMonth,
  toDate,
  topDiagnoses,
  volumeByDepartmentAndMonth,
  volumeByEncounterType,
} from "@/lib/data/hospital";
import type {
  ClaimStatus,
  Encounter,
  EncounterFilter,
  HospitalDataset,
  PayerType,
} from "@/lib/data/hospital";
import type { ReportColumn } from "@/components/reports/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/analytics/executive")({
  head: () => ({
    meta: [
      { title: "Executive Overview — SugboDoc" },
      {
        name: "description",
        content:
          "Hospital executive overview: encounter volume, revenue, claims health, patient satisfaction and the departments that need attention this period.",
      },
      { property: "og:title", content: "Executive Overview — SugboDoc" },
      {
        property: "og:description",
        content:
          "Level 3 hospital overview — what is happening, what changed, and what needs attention.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExecutivePage,
});

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const PAYER_META: Record<PayerType, { label: string; color: string }> = {
  philhealth: { label: "PhilHealth", color: PALETTE.philhealth },
  hmo: { label: "HMO", color: PALETTE.hmo },
  privatePay: { label: "Private Pay", color: PALETTE.brand },
  scpwd: { label: "SC / PWD", color: PALETTE.scpwd },
  gsis: { label: "GSIS / Other", color: PALETTE.gsis },
  writeoff: { label: "Write-off", color: PALETTE.writeoff },
};

/** Claim statuses in true pipeline order, with a ramp that reads as progress. */
const CLAIM_PIPELINE: { status: ClaimStatus; color: string }[] = [
  { status: "Drafted", color: PALETTE.neutral },
  { status: "Submitted", color: PALETTE.brandLighter },
  { status: "Under Review", color: PALETTE.brandLight },
  { status: "Approved", color: PALETTE.brand },
  { status: "Remitted", color: PALETTE.success },
  { status: "Denied", color: PALETTE.danger },
];

/** The Tier-2 pages this overview hands off to. */
type DeepLink =
  | "/analytics/performance"
  | "/analytics/revenue"
  | "/analytics/claims"
  | "/analytics/patient-experience";

/** Minimum window, in days, used to scan for outliers. */
const REVIEW_MIN_DAYS = 90;

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function sum<T>(rows: readonly T[], get: (row: T) => number): number {
  return rows.reduce((total, row) => total + get(row), 0);
}

/** Relative change, in percent, guarding the zero-prior case. */
function deltaPct(current: number, prior: number): number {
  if (prior === 0) return current === 0 ? 0 : 100;
  return ((current - prior) / Math.abs(prior)) * 100;
}

function shiftDays(date: string, days: number): string {
  return toDate(parseDate(date) + days * MS_DAY);
}

function spanDays(from: string, to: string): number {
  return Math.max(1, Math.round((parseDate(to) - parseDate(from)) / MS_DAY) + 1);
}

function fmtDay(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-PH", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ratePct(value: number, digits = 1): string {
  return pct(value * 100, digits);
}

/** Status tone from a delta where "up is good" (or the inverse). */
function toneFromDelta(delta: number, invert = false): MetricStatus {
  const good = invert ? delta < -1 : delta > 1;
  const bad = invert ? delta > 5 : delta < -5;
  if (bad) return "danger";
  if (good) return "good";
  return "neutral";
}

/* ------------------------------------------------------------------ */
/* Period snapshot — every scalar the KPI strip needs                  */
/* ------------------------------------------------------------------ */

interface Snapshot {
  encounters: number;
  gross: number;
  net: number;
  paid: number;
  balance: number;
  collectionRate: number;
  revenuePerEncounter: number;
  discharges: number;
  alos: number;
  claims: number;
  decidedClaims: number;
  approvalRate: number;
  npsResponses: number;
  nps: number;
  readmitEligible: number;
  readmissions: number;
  readmissionRate: number;
}

function snapshot(dataset: HospitalDataset, filter: EncounterFilter): Snapshot {
  const encounters = filterEncounters(dataset, filter);
  const revenue = revenueByDepartment(dataset, filter);
  const gross = sum(revenue, (r) => r.grossCharges);
  const net = sum(revenue, (r) => r.netPayable);
  const paid = sum(revenue, (r) => r.amountPaid);
  const balance = sum(revenue, (r) => r.balance);

  const claimRows = claimsByStatus(dataset, filter);
  const claimCount = (status: ClaimStatus) =>
    claimRows.find((r) => r.status === status)?.claims ?? 0;
  const approved = claimCount("Approved") + claimCount("Remitted");
  const denied = claimCount("Denied");
  const decided = approved + denied;

  const npsRows = npsByDepartment(dataset, filter);
  const responses = sum(npsRows, (r) => r.responses);
  const promoters = sum(npsRows, (r) => r.promoters);
  const detractors = sum(npsRows, (r) => r.detractors);

  const readmitRows = readmissionRateByPayerAndDepartment(dataset, filter);
  const eligible = sum(readmitRows, (r) => r.eligibleEncounters);
  const readmissions = sum(readmitRows, (r) => r.readmissions);

  const discharged = encounters.filter(
    (e) => e.encounterType === "Inpatient" && e.dischargeDateTime !== null,
  );

  return {
    encounters: encounters.length,
    gross,
    net,
    paid,
    balance,
    collectionRate: net > 0 ? paid / net : 0,
    revenuePerEncounter: encounters.length > 0 ? gross / encounters.length : 0,
    discharges: discharged.length,
    alos: discharged.length > 0 ? sum(discharged, (e) => e.losDays) / discharged.length : 0,
    claims: sum(claimRows, (r) => r.claims),
    decidedClaims: decided,
    approvalRate: decided > 0 ? approved / decided : 0,
    npsResponses: responses,
    nps: responses > 0 ? ((promoters - detractors) / responses) * 100 : 0,
    readmitEligible: eligible,
    readmissions,
    readmissionRate: eligible > 0 ? readmissions / eligible : 0,
  };
}

/* ------------------------------------------------------------------ */
/* Needs attention — computed signals, never hand-authored             */
/* ------------------------------------------------------------------ */

interface AttentionItem {
  id: string;
  severity: "danger" | "warning";
  category: string;
  title: string;
  value: string;
  detail: string;
  benchmark: string;
  href: DeepLink;
  hrefLabel: string;
  rows: { label: string; value: string }[];
  /** Ranking score: how far past its threshold the signal sits. */
  score: number;
}

/**
 * Scans the dataset for genuine outliers and threshold crossings.
 *
 * Rules are deliberately paired with minimum sample sizes so a department with
 * three encounters cannot out-shout one with three hundred; anything that fails
 * its minimum-n test is simply not reported rather than reported weakly.
 */
function buildAttention(
  dataset: HospitalDataset,
  review: EncounterFilter,
  reviewPrior: EncounterFilter,
  stock: EncounterFilter,
): AttentionItem[] {
  const items: AttentionItem[] = [];

  /* 1 — Departmental patient experience well below the hospital baseline. */
  const npsRows = npsByDepartment(dataset, review).filter((r) => r.responses >= 8);
  const npsResponses = sum(npsRows, (r) => r.responses);
  const hospitalNps =
    npsResponses > 0
      ? ((sum(npsRows, (r) => r.promoters) - sum(npsRows, (r) => r.detractors)) / npsResponses) *
        100
      : 0;
  for (const row of npsRows) {
    const gap = hospitalNps - row.nps;
    if (gap < 20 || row.nps >= 0) continue;
    items.push({
      id: `nps-${row.departmentId}`,
      severity: row.nps <= -30 ? "danger" : "warning",
      category: "Patient experience",
      title: `${row.department} NPS is ${Math.round(gap)} points below the hospital`,
      value: `${row.nps > 0 ? "+" : ""}${row.nps} NPS`,
      detail: `${num(row.detractors)} detractors of ${num(row.responses)} responses (CSAT ${row.avgCsat.toFixed(2)}/5).`,
      benchmark: `Hospital baseline ${hospitalNps > 0 ? "+" : ""}${Math.round(hospitalNps)} NPS`,
      href: "/analytics/patient-experience",
      hrefLabel: "Open patient experience",
      rows: [
        { label: "Responses", value: num(row.responses) },
        {
          label: "Promoters / passives / detractors",
          value: `${row.promoters} / ${row.passives} / ${row.detractors}`,
        },
        { label: "Mean NPS score", value: `${row.avgNpsScore.toFixed(1)} / 10` },
        { label: "Mean CSAT", value: `${row.avgCsat.toFixed(2)} / 5` },
        { label: "Hospital NPS", value: `${Math.round(hospitalNps)}` },
      ],
      score: gap,
    });
  }

  /* 2 — 30-day readmission concentrated in a department. */
  const readmitRows = readmissionRateByPayerAndDepartment(dataset, review);
  const byDept = new Map<string, { department: string; eligible: number; readmissions: number }>();
  for (const row of readmitRows) {
    const entry = byDept.get(row.departmentId) ?? {
      department: row.department,
      eligible: 0,
      readmissions: 0,
    };
    entry.eligible += row.eligibleEncounters;
    entry.readmissions += row.readmissions;
    byDept.set(row.departmentId, entry);
  }
  const totalEligible = sum([...byDept.values()], (r) => r.eligible);
  const totalReadmits = sum([...byDept.values()], (r) => r.readmissions);
  const hospitalReadmit = totalEligible > 0 ? totalReadmits / totalEligible : 0;
  for (const [departmentId, entry] of byDept) {
    if (entry.eligible < 25) continue;
    const rate = entry.readmissions / entry.eligible;
    if (rate < Math.max(hospitalReadmit * 1.4, hospitalReadmit + 0.04)) continue;
    items.push({
      id: `readmit-${departmentId}`,
      severity: rate >= hospitalReadmit * 1.8 ? "danger" : "warning",
      category: "Clinical outcome",
      title: `${entry.department} 30-day readmission is running hot`,
      value: ratePct(rate),
      detail: `${num(entry.readmissions)} readmissions across ${num(entry.eligible)} eligible inpatient/emergency encounters.`,
      benchmark: `Hospital rate ${ratePct(hospitalReadmit)}`,
      href: "/analytics/performance",
      hrefLabel: "Open performance analysis",
      rows: [
        { label: "Readmissions", value: num(entry.readmissions) },
        { label: "Eligible encounters", value: num(entry.eligible) },
        { label: "Department rate", value: ratePct(rate) },
        { label: "Hospital rate", value: ratePct(hospitalReadmit) },
      ],
      score: (rate - hospitalReadmit) * 100,
    });
  }

  /* 3 — Claim denial rate by department. */
  const turnaround = claimTurnaroundByDepartment(dataset, review);
  const totalClaims = sum(turnaround, (r) => r.claims);
  const totalDenied = sum(turnaround, (r) => r.claims * r.denialRate);
  const hospitalDenial = totalClaims > 0 ? totalDenied / totalClaims : 0;
  for (const row of turnaround) {
    if (row.claims < 12) continue;
    if (row.denialRate < Math.max(hospitalDenial * 1.5, hospitalDenial + 0.05)) continue;
    items.push({
      id: `denial-dept-${row.departmentId}`,
      severity: row.denialRate >= hospitalDenial * 2 ? "danger" : "warning",
      category: "Claims",
      title: `${row.department} denial rate is ${ratePct(row.denialRate - hospitalDenial)} above the hospital`,
      value: ratePct(row.denialRate),
      detail: `${Math.round(row.claims * row.denialRate)} denials of ${num(row.claims)} claims filed, ${php(row.caseRateValue, { compact: true })} of case-rate value in the department.`,
      benchmark: `Hospital denial rate ${ratePct(hospitalDenial)}`,
      href: "/analytics/claims",
      hrefLabel: "Open claims analysis",
      rows: [
        { label: "Claims filed", value: num(row.claims) },
        { label: "Denied", value: num(Math.round(row.claims * row.denialRate)) },
        { label: "Remitted", value: num(row.remitted) },
        { label: "Mean turnaround", value: `${row.avgTurnaroundDays.toFixed(1)} days` },
        { label: "Case-rate value", value: php(row.caseRateValue, { compact: true }) },
      ],
      score: (row.denialRate - hospitalDenial) * 100,
    });
  }

  /* 4 — One denial reason dominating the denial mix. */
  const denialReasons = claimDenialReasons(dataset, review);
  const denialTotal = sum(denialReasons, (r) => r.claims);
  const topReason = denialReasons[0];
  if (topReason && denialTotal >= 10 && topReason.claims / denialTotal >= 0.22) {
    const share = topReason.claims / denialTotal;
    items.push({
      id: `denial-reason-${topReason.denialCode}`,
      severity: share >= 0.3 ? "danger" : "warning",
      category: "Claims",
      title: `${topReason.denialCode} drives ${ratePct(share, 0)} of all denials`,
      value: php(topReason.valueAtRisk, { compact: true }),
      detail: `${topReason.reason} — ${num(topReason.claims)} of ${num(denialTotal)} denials, ${num(topReason.appealed)} appealed and ${num(topReason.recovered)} recovered.`,
      benchmark: `${num(denialTotal)} denials in the window`,
      href: "/analytics/claims",
      hrefLabel: "Open claims analysis",
      rows: denialReasons.slice(0, 6).map((r) => ({
        label: `${r.denialCode} · ${r.reason}`,
        value: `${num(r.claims)} · ${php(r.valueAtRisk, { compact: true })}`,
      })),
      score: share * 100,
    });
  }

  /* 5 — Remittance turnaround dragging in a department. */
  const remittedTotal = sum(turnaround, (r) => r.remitted);
  const hospitalTat =
    remittedTotal > 0
      ? sum(turnaround, (r) => r.avgTurnaroundDays * r.remitted) / remittedTotal
      : 0;
  for (const row of turnaround) {
    if (row.remitted < 8 || hospitalTat <= 0) continue;
    if (row.avgTurnaroundDays < hospitalTat * 1.25) continue;
    items.push({
      id: `tat-${row.departmentId}`,
      severity: row.avgTurnaroundDays >= hospitalTat * 1.5 ? "danger" : "warning",
      category: "Claims",
      title: `${row.department} waits ${(row.avgTurnaroundDays - hospitalTat).toFixed(0)} days longer for remittance`,
      value: `${row.avgTurnaroundDays.toFixed(1)} days`,
      detail: `${num(row.remitted)} remitted claims worth ${php(row.remittedValue, { compact: true })} settled at this pace.`,
      benchmark: `Hospital mean ${hospitalTat.toFixed(1)} days`,
      href: "/analytics/claims",
      hrefLabel: "Open claims analysis",
      rows: [
        { label: "Remitted claims", value: num(row.remitted) },
        { label: "Remitted value", value: php(row.remittedValue, { compact: true }) },
        { label: "Department turnaround", value: `${row.avgTurnaroundDays.toFixed(1)} days` },
        { label: "Hospital turnaround", value: `${hospitalTat.toFixed(1)} days` },
      ],
      score: row.avgTurnaroundDays - hospitalTat,
    });
  }

  /* 6 — Aged receivables. A stock, so it reads the whole open-bill window. */
  const aging = arAgingByPayer(dataset, stock);
  const arTotal = sum(aging, (r) => r.total);
  const over90Total = sum(aging, (r) => r.over90);
  for (const row of aging) {
    if (over90Total <= 0) break;
    const share = row.over90 / over90Total;
    if (row.over90 < 400_000 || share < 0.25) continue;
    items.push({
      id: `ar-${row.payerType}`,
      severity: share >= 0.4 ? "danger" : "warning",
      category: "Receivables",
      title: `${PAYER_META[row.payerType].label} holds ${ratePct(share, 0)} of all 90+ day receivables`,
      value: php(row.over90, { compact: true }),
      detail: `${php(row.total, { compact: true })} outstanding in total for this payer, of which ${ratePct(row.total > 0 ? row.over90 / row.total : 0, 0)} has aged past 90 days.`,
      benchmark: `${php(over90Total, { compact: true })} of ${php(arTotal, { compact: true })} hospital AR is 90+ days`,
      href: "/analytics/revenue",
      hrefLabel: "Open financial analysis",
      rows: [
        { label: "Current (0–30d)", value: php(row.current, { compact: true }) },
        { label: "31–60 days", value: php(row.d31to60, { compact: true }) },
        { label: "61–90 days", value: php(row.d61to90, { compact: true }) },
        { label: "Over 90 days", value: php(row.over90, { compact: true }) },
        { label: "Total outstanding", value: php(row.total, { compact: true }) },
      ],
      score: share * 100,
    });
  }

  /* 7 — Bills sitting in Overdue / Write-off. */
  const payment = paymentStatusBreakdown(dataset, stock);
  const atRisk = payment.filter(
    (r) => r.paymentStatus === "Overdue" || r.paymentStatus === "Write-off",
  );
  const atRiskBalance = sum(atRisk, (r) => r.balance);
  const totalBalance = sum(payment, (r) => r.balance);
  if (totalBalance > 0 && atRiskBalance / totalBalance >= 0.25) {
    const share = atRiskBalance / totalBalance;
    items.push({
      id: "payment-at-risk",
      severity: share >= 0.4 ? "danger" : "warning",
      category: "Receivables",
      title: `${ratePct(share, 0)} of the outstanding balance is overdue or written off`,
      value: php(atRiskBalance, { compact: true }),
      detail: `${num(sum(atRisk, (r) => r.bills))} bills carry this balance against ${php(totalBalance, { compact: true })} outstanding overall.`,
      benchmark: `${php(totalBalance, { compact: true })} total outstanding`,
      href: "/analytics/revenue",
      hrefLabel: "Open financial analysis",
      rows: payment.map((r) => ({
        label: `${r.paymentStatus} · ${num(r.bills)} bills`,
        value: php(r.balance, { compact: true }),
      })),
      score: share * 100,
    });
  }

  /* 8 — Departments trending down against the preceding window. */
  const nowRevenue = revenueByDepartment(dataset, review);
  const priorRevenue = revenueByDepartment(dataset, reviewPrior);
  const priorTotalEncounters = sum(priorRevenue, (r) => r.encounters);
  if (priorTotalEncounters >= 60) {
    for (const row of nowRevenue) {
      const prior = priorRevenue.find((r) => r.departmentId === row.departmentId);
      if (!prior || prior.encounters < 15) continue;
      const volumeChange = deltaPct(row.encounters, prior.encounters);
      const revenueChange = deltaPct(row.grossCharges, prior.grossCharges);
      if (volumeChange > -18 && revenueChange > -18) continue;
      items.push({
        id: `trend-${row.departmentId}`,
        severity: volumeChange <= -30 || revenueChange <= -30 ? "danger" : "warning",
        category: "Trend",
        title: `${row.department} is down ${Math.abs(Math.min(volumeChange, revenueChange)).toFixed(0)}% against the preceding window`,
        value: `${num(row.encounters)} encounters`,
        detail: `Volume ${volumeChange >= 0 ? "+" : ""}${volumeChange.toFixed(1)}%, gross revenue ${revenueChange >= 0 ? "+" : ""}${revenueChange.toFixed(1)}% versus the equal-length window immediately before.`,
        benchmark: `Prior window ${num(prior.encounters)} encounters · ${php(prior.grossCharges, { compact: true })}`,
        href: "/analytics/performance",
        hrefLabel: "Open performance analysis",
        rows: [
          {
            label: "Encounters (now / prior)",
            value: `${num(row.encounters)} / ${num(prior.encounters)}`,
          },
          {
            label: "Gross revenue (now / prior)",
            value: `${php(row.grossCharges, { compact: true })} / ${php(prior.grossCharges, { compact: true })}`,
          },
          {
            label: "Revenue per encounter",
            value: `${php(row.revenuePerEncounter, { compact: true })} / ${php(prior.revenuePerEncounter, { compact: true })}`,
          },
        ],
        score: Math.abs(Math.min(volumeChange, revenueChange)),
      });
    }
  }

  /* 9 — Long-stay tail. */
  for (const row of losStatsByDepartment(dataset, review)) {
    if (row.discharges < 15 || row.medianLosDays <= 0) continue;
    if (row.p90LosDays < row.medianLosDays * 2.5 || row.outliers < 2) continue;
    items.push({
      id: `los-${row.departmentId}`,
      severity: row.p90LosDays >= row.medianLosDays * 4 ? "danger" : "warning",
      category: "Throughput",
      title: `${row.department} carries a long-stay tail`,
      value: `p90 ${row.p90LosDays}d vs median ${row.medianLosDays}d`,
      detail: `${num(row.outliers)} stays ran past three times the department median (longest ${row.maxLosDays} days) across ${num(row.discharges)} discharges.`,
      benchmark: `Department mean ${row.meanLosDays.toFixed(1)} days`,
      href: "/analytics/performance",
      hrefLabel: "Open performance analysis",
      rows: [
        { label: "Discharges", value: num(row.discharges) },
        {
          label: "Mean / median LOS",
          value: `${row.meanLosDays.toFixed(1)}d / ${row.medianLosDays}d`,
        },
        { label: "p90 LOS", value: `${row.p90LosDays}d` },
        { label: "Longest stay", value: `${row.maxLosDays}d` },
        { label: "Still admitted", value: num(row.stillAdmitted) },
      ],
      score: (row.p90LosDays / row.medianLosDays) * 10,
    });
  }

  return items
    .sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "danger" ? -1 : 1;
      return b.score - a.score;
    })
    .slice(0, 6);
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function ExecutivePage() {
  const { data } = useQuery({
    queryKey: ["hospital", "dataset"],
    queryFn: fetchHospitalDataset,
  });
  if (!data) return <ExecutiveSkeleton />;
  return <ExecutiveOverview dataset={data} />;
}

type Drill =
  | { kind: "kpi"; id: string }
  | { kind: "month"; month: string }
  | { kind: "department"; departmentId: string }
  | { kind: "payer"; payer: PayerType }
  | { kind: "claimStatus"; status: ClaimStatus }
  | { kind: "denial"; code: string }
  | { kind: "diagnosis"; code: string }
  | { kind: "attention"; id: string }
  | null;

interface TrendRow {
  month: string;
  label: string;
  isPartial: boolean;
  total: number;
  gross: number;
  [department: string]: string | number | boolean;
}

function ExecutiveOverview({ dataset }: { dataset: HospitalDataset }) {
  const { filters, encounterFilter, isFiltered, resetFilters } = useHospitalFilters();
  const [drill, setDrill] = React.useState<Drill>(null);
  const [trendMode, setTrendMode] = React.useState<"volume" | "share">("volume");
  const [hiddenDepartments, setHiddenDepartments] = React.useState<Record<string, boolean>>({});
  const [payerView, setPayerView] = React.useState<"donut" | "ranked">("donut");

  /* ---------------- window arithmetic ---------------- */

  const windows = React.useMemo(() => {
    const firstMonth = dataset.months[0];
    const from = encounterFilter.from ?? firstMonth?.startDate ?? dataset.anchorDate;
    const to = encounterFilter.to ?? dataset.anchorDate;
    const days = spanDays(from, to);

    const priorTo = shiftDays(from, -1);
    const priorFrom = shiftDays(from, -days);

    // Outlier scanning needs a window wide enough to be worth trusting; a
    // one-week filter cannot tell a real signal from a rounding artefact.
    const reviewFrom = days >= REVIEW_MIN_DAYS ? from : shiftDays(to, -(REVIEW_MIN_DAYS - 1));
    const reviewDays = spanDays(reviewFrom, to);
    const reviewPriorTo = shiftDays(reviewFrom, -1);
    const reviewPriorFrom = shiftDays(reviewFrom, -reviewDays);

    const dimensionOnly: EncounterFilter = { ...encounterFilter };
    delete dimensionOnly.from;
    delete dimensionOnly.to;

    return {
      from,
      to,
      days,
      period: encounterFilter,
      prior: { ...encounterFilter, from: priorFrom, to: priorTo } satisfies EncounterFilter,
      priorFrom,
      priorTo,
      review: { ...encounterFilter, from: reviewFrom, to } satisfies EncounterFilter,
      reviewPrior: {
        ...encounterFilter,
        from: reviewPriorFrom,
        to: reviewPriorTo,
      } satisfies EncounterFilter,
      reviewFrom,
      reviewDays,
      /** Dimension filters only — the trailing 12 months and open-bill stock. */
      dimensionOnly,
    };
  }, [dataset, encounterFilter]);

  /* ---------------- aggregates ---------------- */

  const current = React.useMemo(() => snapshot(dataset, windows.period), [dataset, windows]);
  const prior = React.useMemo(() => snapshot(dataset, windows.prior), [dataset, windows]);

  const attention = React.useMemo(
    () => buildAttention(dataset, windows.review, windows.reviewPrior, windows.dimensionOnly),
    [dataset, windows],
  );

  const departmentNames = React.useMemo(
    () => dataset.departments.map((d) => d.name as string),
    [dataset],
  );

  const trend = React.useMemo<{ rows: TrendRow[]; shareRows: TrendRow[] }>(() => {
    const volume = volumeByDepartmentAndMonth(dataset, windows.dimensionOnly);
    const revenue = revenueByMonth(dataset, windows.dimensionOnly);
    const rows = volume.map((v) => {
      const money = revenue.find((r) => r.month === v.month);
      const row: TrendRow = {
        month: v.month,
        label: v.monthLabel,
        isPartial: v.isPartial,
        total: v.total,
        gross: money?.grossCharges ?? 0,
      };
      for (const name of departmentNames) row[name] = v.byDepartment[name] ?? 0;
      return row;
    });
    const shareRows = rows.map((row) => {
      const next: TrendRow = { ...row };
      for (const name of departmentNames) {
        const value = Number(row[name] ?? 0);
        next[name] = row.total > 0 ? (value / row.total) * 100 : 0;
      }
      return next;
    });
    return { rows, shareRows };
  }, [dataset, windows, departmentNames]);

  const departmentRows = React.useMemo(() => {
    const revenue = revenueByDepartment(dataset, windows.review);
    const npsRows = npsByDepartment(dataset, windows.review);
    const readmitRows = readmissionRateByPayerAndDepartment(dataset, windows.review);
    return revenue
      .filter((r) => r.encounters > 0)
      .map((r) => {
        const nps = npsRows.find((n) => n.departmentId === r.departmentId);
        const eligible = sum(
          readmitRows.filter((x) => x.departmentId === r.departmentId),
          (x) => x.eligibleEncounters,
        );
        const readmissions = sum(
          readmitRows.filter((x) => x.departmentId === r.departmentId),
          (x) => x.readmissions,
        );
        return {
          departmentId: r.departmentId,
          department: r.department,
          color: r.color,
          encounters: r.encounters,
          grossCharges: r.grossCharges,
          revenuePerEncounter: r.revenuePerEncounter,
          balance: r.balance,
          nps: nps?.nps ?? 0,
          npsResponses: nps?.responses ?? 0,
          readmissionRate: eligible > 0 ? readmissions / eligible : 0,
        };
      })
      .sort((a, b) => b.grossCharges - a.grossCharges);
  }, [dataset, windows]);

  const medians = React.useMemo(() => {
    const byVolume = departmentRows.map((r) => r.encounters).sort((a, b) => a - b);
    const byYield = departmentRows.map((r) => r.revenuePerEncounter).sort((a, b) => a - b);
    const mid = (values: number[]) =>
      values.length === 0 ? 0 : (values[Math.floor(values.length / 2)] ?? 0);
    return { volume: mid(byVolume), yield: mid(byYield) };
  }, [departmentRows]);

  const payerRows = React.useMemo(() => {
    const rows = payerMix(dataset, windows.period);
    const total = sum(rows, (r) => r.grossCharges);
    return rows.map((r) => ({
      ...r,
      label: PAYER_META[r.payerType].label,
      color: PAYER_META[r.payerType].color,
      shareOfTotal: total > 0 ? r.grossCharges / total : 0,
    }));
  }, [dataset, windows]);

  const claimRows = React.useMemo(() => {
    const rows = claimsByStatus(dataset, windows.period);
    return CLAIM_PIPELINE.map((stage) => {
      const row = rows.find((r) => r.status === stage.status);
      return {
        status: stage.status,
        color: stage.color,
        claims: row?.claims ?? 0,
        caseRateValue: row?.caseRateValue ?? 0,
        share: row?.share ?? 0,
      };
    });
  }, [dataset, windows]);

  const denialRows = React.useMemo(
    () => claimDenialReasons(dataset, windows.period).slice(0, 5),
    [dataset, windows],
  );

  const diagnosisRows = React.useMemo(
    () => topDiagnoses(dataset, 10, windows.period),
    [dataset, windows],
  );

  const encounterTypeRows = React.useMemo(
    () => volumeByEncounterType(dataset, windows.period),
    [dataset, windows],
  );

  /* ---------------- derived display values ---------------- */

  const claimsTotal = sum(claimRows, (r) => r.claims);
  const denialTotal = sum(denialRows, (r) => r.claims);
  const maxDiagnosisLos = Math.max(1, ...diagnosisRows.map((d) => d.avgLosDays));
  const partialMonth = dataset.months[dataset.months.length - 1];
  const periodLabel = `${fmtDay(windows.from)} – ${fmtDay(windows.to)}`;
  const priorLabel = `${fmtDay(windows.priorFrom)} – ${fmtDay(windows.priorTo)}`;
  const reviewLabel =
    windows.days >= REVIEW_MIN_DAYS
      ? periodLabel
      : `${windows.reviewDays}-day review window to ${fmtDay(windows.to)}`;
  const visibleDepartments = departmentNames.filter((name) => !hiddenDepartments[name]);

  const smallSample = (n: number, threshold: number): { note: string } | Record<string, never> =>
    n < threshold ? { note: `Small sample — n=${num(n)}` } : {};

  const trendRows = trendMode === "share" ? trend.shareRows : trend.rows;

  const departmentTableColumns: ReportColumn<(typeof departmentRows)[number]>[] = [
    { key: "department", header: "Department" },
    { key: "encounters", header: "Encounters", align: "right" },
    {
      key: "grossCharges",
      header: "Gross revenue",
      align: "right",
      render: (r) => php(r.grossCharges, { compact: true }),
    },
    {
      key: "revenuePerEncounter",
      header: "PHP / encounter",
      align: "right",
      render: (r) => php(r.revenuePerEncounter, { compact: true }),
    },
    {
      key: "balance",
      header: "Outstanding",
      align: "right",
      render: (r) => php(r.balance, { compact: true }),
    },
    {
      key: "nps",
      header: "NPS",
      align: "right",
      render: (r) => (r.npsResponses > 0 ? `${r.nps > 0 ? "+" : ""}${r.nps}` : "—"),
    },
    {
      key: "readmissionRate",
      header: "Readmit",
      align: "right",
      render: (r) => ratePct(r.readmissionRate),
    },
  ];

  const diagnosisTableColumns: ReportColumn<(typeof diagnosisRows)[number]>[] = [
    { key: "code", header: "ICD-10" },
    { key: "commonName", header: "Condition" },
    { key: "encounters", header: "Encounters", align: "right" },
    {
      key: "avgLosDays",
      header: "Avg LOS",
      align: "right",
      render: (r) => `${r.avgLosDays.toFixed(1)}d`,
    },
    {
      key: "caseRate",
      header: "Case rate",
      align: "right",
      render: (r) => php(r.caseRate, { compact: true }),
    },
    {
      key: "grossCharges",
      header: "Gross charges",
      align: "right",
      render: (r) => php(r.grossCharges, { compact: true }),
    },
    {
      key: "readmissionRate",
      header: "Readmit",
      align: "right",
      render: (r) => ratePct(r.readmissionRate),
    },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-brand">
            Cebu Doctors&apos; Regional Hospital · Level 3
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
            Executive Overview
          </h1>
          <p className="text-sm text-text-muted">
            {filters.dateRange.label} · {periodLabel} — compared with {priorLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone="neutral">Tier 1 · Overview</StatusBadge>
          {isFiltered ? (
            <button
              onClick={resetFilters}
              className="text-[11px] text-brand hover:underline"
              type="button"
            >
              Reset all filters
            </button>
          ) : null}
        </div>
      </header>

      <GlobalHospitalFilterBar />

      {current.encounters === 0 ? (
        <PanelCard
          title="No encounters match the current filters"
          description="Widen the date range or clear a dimension filter to bring data back."
        >
          <Button variant="outline" size="sm" onClick={resetFilters}>
            Reset filters
          </Button>
        </PanelCard>
      ) : null}

      {/* ---------- Zone A · what is happening, what changed ---------- */}
      <section className="space-y-3">
        <SectionTitle
          title="What is happening"
          description={`Every card compares ${periodLabel} with the equal-length window before it. Click a card for the breakdown.`}
        />
        <KpiStrip>
          <MetricCard
            label="Encounters"
            value={num(current.encounters)}
            delta={deltaPct(current.encounters, prior.encounters)}
            secondary={`Prior period ${num(prior.encounters)} · ${(current.encounters / windows.days).toFixed(1)}/day`}
            status={toneFromDelta(deltaPct(current.encounters, prior.encounters))}
            icon={Users}
            onClick={() => setDrill({ kind: "kpi", id: "encounters" })}
          />
          <MetricCard
            label="Gross Revenue"
            value={php(current.gross, { compact: true })}
            delta={deltaPct(current.gross, prior.gross)}
            secondary={`Prior period ${php(prior.gross, { compact: true })}`}
            status={toneFromDelta(deltaPct(current.gross, prior.gross))}
            icon={CircleDollarSign}
            onClick={() => setDrill({ kind: "kpi", id: "revenue" })}
          />
          <MetricCard
            label="Revenue per Encounter"
            value={php(current.revenuePerEncounter, { compact: true })}
            delta={deltaPct(current.revenuePerEncounter, prior.revenuePerEncounter)}
            secondary={`Prior period ${php(prior.revenuePerEncounter, { compact: true })}`}
            status="neutral"
            icon={Receipt}
            onClick={() => setDrill({ kind: "kpi", id: "yield" })}
          />
          <MetricCard
            label="Collected"
            value={php(current.paid, { compact: true })}
            delta={deltaPct(current.paid, prior.paid)}
            secondary={`${ratePct(current.collectionRate)} of ${php(current.net, { compact: true })} net payable · prior ${ratePct(prior.collectionRate)}`}
            status={current.collectionRate >= prior.collectionRate ? "good" : "warning"}
            icon={Coins}
            onClick={() => setDrill({ kind: "kpi", id: "collection" })}
          />
          <MetricCard
            label="Claim Approval Rate"
            value={current.decidedClaims > 0 ? ratePct(current.approvalRate) : "—"}
            delta={deltaPct(current.approvalRate, prior.approvalRate)}
            secondary={`${num(current.decidedClaims)} decided of ${num(current.claims)} claims · prior ${ratePct(prior.approvalRate)}`}
            status={
              current.decidedClaims === 0
                ? "neutral"
                : current.approvalRate >= 0.9
                  ? "good"
                  : current.approvalRate >= 0.8
                    ? "warning"
                    : "danger"
            }
            icon={BadgeCheck}
            onClick={() => setDrill({ kind: "kpi", id: "claims" })}
            {...smallSample(current.decidedClaims, 20)}
          />
          <MetricCard
            label="Patient Satisfaction"
            value={
              current.npsResponses > 0
                ? `${current.nps > 0 ? "+" : ""}${Math.round(current.nps)} NPS`
                : "—"
            }
            delta={deltaPct(current.nps, prior.nps)}
            secondary={`${num(current.npsResponses)} responses · prior ${Math.round(prior.nps)} NPS`}
            status={current.nps >= 20 ? "good" : current.nps >= 0 ? "warning" : "danger"}
            icon={Smile}
            onClick={() => setDrill({ kind: "kpi", id: "nps" })}
            {...smallSample(current.npsResponses, 20)}
          />
          <MetricCard
            label="30-Day Readmission"
            value={current.readmitEligible > 0 ? ratePct(current.readmissionRate) : "—"}
            delta={deltaPct(current.readmissionRate, prior.readmissionRate)}
            invertDelta
            secondary={`${num(current.readmissions)} of ${num(current.readmitEligible)} eligible · prior ${ratePct(prior.readmissionRate)}`}
            status={
              current.readmissionRate <= 0.08
                ? "good"
                : current.readmissionRate <= 0.12
                  ? "warning"
                  : "danger"
            }
            icon={Activity}
            onClick={() => setDrill({ kind: "kpi", id: "readmission" })}
            {...smallSample(current.readmitEligible, 30)}
          />
          <MetricCard
            label="Average Length of Stay"
            value={current.discharges > 0 ? `${current.alos.toFixed(1)} days` : "—"}
            delta={deltaPct(current.alos, prior.alos)}
            invertDelta
            secondary={`${num(current.discharges)} inpatient discharges · prior ${prior.alos.toFixed(1)}d`}
            status={current.alos <= 4.5 ? "good" : current.alos <= 6 ? "warning" : "danger"}
            icon={Timer}
            onClick={() => setDrill({ kind: "kpi", id: "alos" })}
            {...smallSample(current.discharges, 20)}
          />
        </KpiStrip>
      </section>

      {/* ---------- Zone B · what needs attention ---------- */}
      <section className="space-y-3">
        <SectionTitle
          title="Needs attention"
          description={`Outliers and threshold crossings computed from the data over the ${reviewLabel}. Departments below the minimum sample size are not reported.`}
        />
        {attention.length === 0 ? (
          <PanelCard
            title="Nothing crossed a threshold in this window"
            description="No department breached its readmission, denial, turnaround, receivable, length-of-stay or experience threshold with a large enough sample to be worth flagging."
          >
            <p className="text-xs text-text-muted">
              Thresholds are relative to the hospital baseline for the same window, so this reads as
              &ldquo;no department is an outlier&rdquo;, not &ldquo;every metric is healthy&rdquo;.
            </p>
          </PanelCard>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {attention.map((item) => (
              <AttentionCard
                key={item.id}
                item={item}
                onDrill={() => setDrill({ kind: "attention", id: item.id })}
              />
            ))}
          </div>
        )}
      </section>

      {/* ---------- Zone C · hero comparison charts ---------- */}
      <section className="grid gap-4 xl:grid-cols-2">
        <InteractiveChartCard
          title="Volume & revenue trend by department"
          description="Trailing 12 months · department mix with gross revenue overlaid · click a month to drill"
          table={{
            columns: [
              { key: "label", header: "Month" },
              { key: "total", header: "Encounters", align: "right" },
              {
                key: "gross",
                header: "Gross revenue",
                align: "right",
                render: (r: TrendRow) => php(Number(r.gross), { compact: true }),
              },
              {
                key: "isPartial",
                header: "Complete",
                render: (r: TrendRow) => (r.isPartial ? "Month to date" : "Full month"),
              },
            ] as ReportColumn<TrendRow>[],
            rows: trend.rows,
          }}
          onRowClickInTable={(row) => setDrill({ kind: "month", month: row.month })}
          action={
            <Tabs value={trendMode} onValueChange={(v) => setTrendMode(v as "volume" | "share")}>
              <TabsList className="h-6">
                <TabsTrigger value="volume" className="px-2 text-[10px]">
                  Stacked
                </TabsTrigger>
                <TabsTrigger value="share" className="px-2 text-[10px]">
                  100% share
                </TabsTrigger>
              </TabsList>
            </Tabs>
          }
        >
          <div className="mb-2 flex flex-wrap gap-2">
            {dataset.departments.map((dept) => (
              <button
                key={dept.id}
                type="button"
                onClick={() =>
                  setHiddenDepartments((prev) => ({ ...prev, [dept.name]: !prev[dept.name] }))
                }
                className={cn(
                  "transition-opacity",
                  hiddenDepartments[dept.name] ? "opacity-35" : "opacity-100",
                )}
              >
                <LegendDot color={departmentColorOf(dataset, dept.id)} label={dept.name} />
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart
              data={trendRows}
              margin={{ left: -8, right: 4, top: 8 }}
              onClick={(state) => {
                const label = (state as { activeLabel?: string } | null)?.activeLabel;
                const row = trend.rows.find((r) => r.label === label);
                if (row) setDrill({ kind: "month", month: row.month });
              }}
            >
              <defs>
                {dataset.departments.map((dept) => (
                  <linearGradient
                    key={dept.id}
                    id={`exec-grad-${dept.id}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={departmentColorOf(dataset, dept.id)}
                      stopOpacity={0.7}
                    />
                    <stop
                      offset="100%"
                      stopColor={departmentColorOf(dataset, dept.id)}
                      stopOpacity={0.25}
                    />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={46}
                {...(trendMode === "share" ? { domain: [0, 100] as [number, number] } : {})}
              />
              {trendMode === "volume" ? (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(1)}M`}
                />
              ) : null}
              <Tooltip content={<TrendTooltip mode={trendMode} />} />
              {dataset.departments
                .filter((dept) => !hiddenDepartments[dept.name])
                .map((dept) => (
                  <Area
                    key={dept.id}
                    yAxisId="left"
                    type="monotone"
                    stackId="volume"
                    dataKey={dept.name}
                    name={dept.name}
                    stroke={departmentColorOf(dataset, dept.id)}
                    fill={`url(#exec-grad-${dept.id})`}
                    strokeWidth={1.25}
                  />
                ))}
              {trendMode === "volume" ? (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="gross"
                  name="Gross revenue"
                  stroke={PALETTE.gold}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              ) : null}
              <Brush
                dataKey="label"
                height={18}
                travellerWidth={8}
                stroke={PALETTE.brand}
                className="text-[10px]"
              />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="mt-1 text-[11px] text-text-muted">
            {partialMonth?.isPartial
              ? `${partialMonth.label} is month to date (${partialMonth.daysObserved} of ${partialMonth.daysInMonth} days) — read its dip as incomplete, not as a decline.`
              : "All 12 buckets are complete months."}{" "}
            Dimension filters apply to this chart; the date filter does not, so the 12-month shape
            stays readable.
          </p>
        </InteractiveChartCard>

        <InteractiveChartCard
          title="Where the departments differ"
          description={`Volume against revenue per encounter, bubble area = gross revenue · ${reviewLabel}`}
          table={{ columns: departmentTableColumns, rows: departmentRows }}
          onRowClickInTable={(row) =>
            setDrill({ kind: "department", departmentId: row.departmentId })
          }
          action={
            <Link
              to="/analytics/performance"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-brand hover:underline"
            >
              View department comparison
              <ArrowRight className="size-3" />
            </Link>
          }
        >
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ left: 4, right: 24, top: 16, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                type="number"
                dataKey="encounters"
                name="Encounters"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                label={{ value: "Encounters", position: "insideBottom", offset: -6, fontSize: 10 }}
              />
              <YAxis
                type="number"
                dataKey="revenuePerEncounter"
                name="PHP per encounter"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={62}
                tickFormatter={(v: number) => `${(v / 1_000).toFixed(0)}K`}
              />
              <ZAxis type="number" dataKey="grossCharges" range={[120, 900]} name="Gross revenue" />
              <ReferenceLine
                x={medians.volume}
                stroke={PALETTE.neutral}
                strokeDasharray="4 3"
                label={{ value: "median volume", fontSize: 9, position: "top" }}
              />
              <ReferenceLine
                y={medians.yield}
                stroke={PALETTE.neutral}
                strokeDasharray="4 3"
                label={{ value: "median yield", fontSize: 9, position: "right" }}
              />
              <Tooltip content={<DepartmentTooltip />} cursor={{ strokeDasharray: "3 3" }} />
              <Scatter
                data={departmentRows}
                onClick={(entry) => {
                  const id = (entry as unknown as { departmentId?: string }).departmentId;
                  if (id) setDrill({ kind: "department", departmentId: id });
                }}
              >
                {departmentRows.map((row) => (
                  <Cell key={row.departmentId} fill={row.color} className="cursor-pointer" />
                ))}
                <LabelList
                  dataKey="department"
                  position="top"
                  style={{ fontSize: 9, fill: "currentColor" }}
                />
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <p className="mt-1 text-[11px] text-text-muted">
            Top-right is high volume and high yield; bottom-right is the volume that costs the most
            to serve. Bubble size is total gross revenue, so a small bubble far right is a niche,
            high-margin service line.
          </p>
        </InteractiveChartCard>
      </section>

      {/* ---------- Zone D · money, claims, casemix snapshots ---------- */}
      <section className="grid gap-4 xl:grid-cols-3">
        <PanelCard
          title="Payer mix"
          description={`Share of gross charges · ${periodLabel}`}
          action={
            <Tabs value={payerView} onValueChange={(v) => setPayerView(v as "donut" | "ranked")}>
              <TabsList className="h-6">
                <TabsTrigger value="donut" className="px-2 text-[10px]">
                  Donut
                </TabsTrigger>
                <TabsTrigger value="ranked" className="px-2 text-[10px]">
                  Ranked
                </TabsTrigger>
              </TabsList>
            </Tabs>
          }
        >
          {payerView === "donut" ? (
            <div className="relative">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={payerRows}
                    dataKey="grossCharges"
                    nameKey="label"
                    innerRadius={54}
                    outerRadius={82}
                    paddingAngle={2}
                    onClick={(entry) => {
                      const payer = (entry as unknown as { payerType?: PayerType }).payerType;
                      if (payer) setDrill({ kind: "payer", payer });
                    }}
                  >
                    {payerRows.map((row) => (
                      <Cell key={row.payerType} fill={row.color} className="cursor-pointer" />
                    ))}
                  </Pie>
                  <Tooltip
                    content={<RichTooltip valueFormatter={(v) => php(v, { compact: true })} />}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-x-0 top-[40%] text-center">
                <div className="text-[11px] text-text-muted">Gross</div>
                <div className="text-sm font-semibold text-text-primary">
                  {php(current.gross, { compact: true })}
                </div>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={payerRows} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(1)}M`}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={86}
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={<RichTooltip valueFormatter={(v) => php(v, { compact: true })} />}
                />
                <Bar
                  dataKey="grossCharges"
                  name="Gross charges"
                  radius={[0, 4, 4, 0]}
                  onClick={(entry) => {
                    const payer = (entry as unknown as { payerType?: PayerType }).payerType;
                    if (payer) setDrill({ kind: "payer", payer });
                  }}
                >
                  {payerRows.map((row) => (
                    <Cell key={row.payerType} fill={row.color} className="cursor-pointer" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="mt-2 space-y-1">
            {payerRows.map((row) => (
              <button
                key={row.payerType}
                type="button"
                onClick={() => setDrill({ kind: "payer", payer: row.payerType })}
                className="flex w-full items-center justify-between gap-2 rounded px-1 py-0.5 text-left hover:bg-muted"
              >
                <LegendDot color={row.color} label={row.label} />
                <span className="text-xs text-text-muted">
                  {ratePct(row.shareOfTotal, 0)}
                  <span className="ml-2 font-medium text-text-primary">
                    {php(row.grossCharges, { compact: true })}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <div className="mt-3 border-t border-border pt-2">
            <Link
              to="/analytics/revenue"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-brand hover:underline"
            >
              Payer mix trend, AR aging and the gross-to-net bridge
              <ArrowRight className="size-3" />
            </Link>
          </div>
        </PanelCard>

        <PanelCard
          title="Claims pipeline"
          description={`${num(claimsTotal)} PhilHealth claims raised on ${periodLabel} encounters`}
        >
          {claimsTotal === 0 ? (
            <p className="py-6 text-center text-xs text-text-muted">
              No PhilHealth claims were raised on encounters in this window.
            </p>
          ) : (
            <>
              <div className="flex h-9 w-full overflow-hidden rounded-md border border-border">
                {claimRows
                  .filter((row) => row.claims > 0)
                  .map((row) => {
                    const width = (row.claims / claimsTotal) * 100;
                    return (
                      <button
                        key={row.status}
                        type="button"
                        onClick={() => setDrill({ kind: "claimStatus", status: row.status })}
                        title={`${row.status}: ${num(row.claims)} claims · ${php(row.caseRateValue, { compact: true })}`}
                        style={{ width: `${width}%`, backgroundColor: row.color }}
                        className="flex items-center justify-center text-[10px] font-semibold text-white transition-opacity hover:opacity-85"
                      >
                        {width >= 9 ? num(row.claims) : ""}
                      </button>
                    );
                  })}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                {claimRows.map((row) => (
                  <button
                    key={row.status}
                    type="button"
                    onClick={() => setDrill({ kind: "claimStatus", status: row.status })}
                    className="flex items-center justify-between gap-2 rounded px-1 py-0.5 text-left hover:bg-muted"
                    disabled={row.claims === 0}
                  >
                    <LegendDot color={row.color} label={row.status} />
                    <span className="text-[11px] text-text-muted">
                      {num(row.claims)}
                      <span className="ml-1.5 font-medium text-text-primary">
                        {php(row.caseRateValue, { compact: true })}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 rounded-md bg-muted/50 p-2 text-center">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-text-muted">
                    Approved
                  </div>
                  <div className="text-sm font-semibold text-text-primary">
                    {current.decidedClaims > 0 ? ratePct(current.approvalRate) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-text-muted">
                    Awaiting
                  </div>
                  <div className="text-sm font-semibold text-text-primary">
                    {num(claimsTotal - current.decidedClaims)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-text-muted">At risk</div>
                  <div className="text-sm font-semibold text-danger">
                    {php(
                      sum(denialRows, (r) => r.valueAtRisk),
                      { compact: true },
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
          {denialRows.length > 0 ? (
            <div className="mt-3 border-t border-border pt-2">
              <p className="mb-1 text-[11px] font-medium text-text-secondary">
                Denial reasons · Pareto
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px]">Reason</TableHead>
                    <TableHead className="text-right text-[11px]">n</TableHead>
                    <TableHead className="text-right text-[11px]">Cum.</TableHead>
                    <TableHead className="text-right text-[11px]">At risk</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {denialRows.map((row, i) => {
                    const cumulative =
                      denialTotal > 0
                        ? sum(denialRows.slice(0, i + 1), (r) => r.claims) / denialTotal
                        : 0;
                    return (
                      <TableRow
                        key={row.denialCode}
                        className="cursor-pointer"
                        onClick={() => setDrill({ kind: "denial", code: row.denialCode })}
                      >
                        <TableCell className="text-[11px]">
                          <div className="font-medium">{row.denialCode}</div>
                          <div className="text-text-muted">{row.reason}</div>
                        </TableCell>
                        <TableCell className="text-right text-[11px]">{num(row.claims)}</TableCell>
                        <TableCell className="text-right text-[11px]">
                          {ratePct(cumulative, 0)}
                        </TableCell>
                        <TableCell className="text-right text-[11px]">
                          {php(row.valueAtRisk, { compact: true })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : null}
          <div className="mt-3 border-t border-border pt-2">
            <Link
              to="/analytics/claims"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-brand hover:underline"
            >
              Denials, appeals and turnaround by department
              <ArrowRight className="size-3" />
            </Link>
          </div>
        </PanelCard>

        <InteractiveChartCard
          title="Top diagnoses"
          description={`Encounter count, shaded by average inpatient length of stay · ${periodLabel}`}
          table={{ columns: diagnosisTableColumns, rows: diagnosisRows }}
          onRowClickInTable={(row) => setDrill({ kind: "diagnosis", code: row.code })}
        >
          {diagnosisRows.length === 0 || diagnosisRows[0]?.encounters === 0 ? (
            <p className="py-10 text-center text-xs text-text-muted">
              No coded diagnoses in this window.
            </p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={diagnosisRows} layout="vertical" margin={{ left: 6, right: 18 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                    horizontal={false}
                  />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="commonName"
                    width={118}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<DiagnosisTooltip />} />
                  <Bar
                    dataKey="encounters"
                    name="Encounters"
                    radius={[0, 4, 4, 0]}
                    onClick={(entry) => {
                      const code = (entry as unknown as { code?: string }).code;
                      if (code) setDrill({ kind: "diagnosis", code });
                    }}
                  >
                    {diagnosisRows.map((row) => (
                      <Cell
                        key={row.code}
                        fill={losColor(row.avgLosDays, maxDiagnosisLos)}
                        className="cursor-pointer"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-text-muted">
                <span>Avg LOS</span>
                <span className="h-2 w-24 rounded-full bg-gradient-to-r from-[#AEB6EB] to-[#2E3A96]" />
                <span>{maxDiagnosisLos.toFixed(1)}d</span>
              </div>
            </>
          )}
          <div className="mt-3 border-t border-border pt-2">
            <Link
              to="/analytics/performance"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-brand hover:underline"
            >
              Case mix, length of stay and physician productivity
              <ArrowRight className="size-3" />
            </Link>
          </div>
        </InteractiveChartCard>
      </section>

      {/* ---------- Zone E · handoff ---------- */}
      <section className="space-y-3">
        <SectionTitle
          title="Go deeper"
          description="This overview stops at the comparison tier. Investigation and record-level detail live on the pages below, and they read the same filters you set here."
        />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <HandoffCard
            to="/analytics/performance"
            title="Performance analysis"
            body="Department and physician comparison, length of stay distribution, case mix and throughput."
          />
          <HandoffCard
            to="/analytics/revenue"
            title="Financial analysis"
            body="Gross-to-net bridge, collection trend, AR aging by payer and the SC/PWD discount load."
          />
          <HandoffCard
            to="/analytics/claims"
            title="Claims analysis"
            body="Pipeline by status, denial reasons and appeals, turnaround by department and case type."
          />
          <HandoffCard
            to="/analytics/patient-experience"
            title="Patient experience"
            body="NPS and CSAT by department, feedback themes and the operational drivers behind them."
          />
        </div>
      </section>

      <ExecutiveDrawer
        dataset={dataset}
        drill={drill}
        onClose={() => setDrill(null)}
        windows={windows}
        current={current}
        prior={prior}
        attention={attention}
        periodLabel={periodLabel}
        reviewLabel={reviewLabel}
        encounterTypeRows={encounterTypeRows}
        departmentRows={departmentRows}
        payerRows={payerRows}
        claimRows={claimRows}
        diagnosisRows={diagnosisRows}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Presentational helpers                                              */
/* ------------------------------------------------------------------ */

function departmentColorOf(dataset: HospitalDataset, departmentId: string): string {
  const row = revenueColorCache.get(departmentId);
  if (row) return row;
  const color =
    revenueByDepartment(dataset, { departmentIds: [departmentId] })[0]?.color ?? PALETTE.brand;
  revenueColorCache.set(departmentId, color);
  return color;
}
const revenueColorCache = new Map<string, string>();

function losColor(value: number, max: number): string {
  const ramp = brandRamp(6);
  const index = Math.min(ramp.length - 1, Math.round((value / (max || 1)) * (ramp.length - 1)));
  return ramp[index] ?? PALETTE.brand;
}

function TrendTooltip({
  active,
  payload,
  label,
  mode,
}: {
  active?: boolean;
  payload?: RichTooltipPayloadEntry[];
  label?: string | number;
  mode: "volume" | "share";
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as TrendRow | undefined;
  const entries = payload.filter((p) => p.dataKey !== "gross" && Number(p.value ?? 0) > 0);
  return (
    <div
      style={{
        background: "#111111",
        color: "#ffffff",
        borderRadius: 6,
        padding: "8px 10px",
        fontSize: 11,
        maxWidth: 240,
        boxShadow: "0 6px 16px rgba(0,0,0,0.28)",
        lineHeight: 1.5,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 2 }}>
        {label}
        {row?.isPartial ? " · month to date" : ""}
      </div>
      {entries.map((entry, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span style={{ opacity: 0.82 }}>{entry.name ?? entry.dataKey}</span>
          <span style={{ fontWeight: 600 }}>
            {mode === "share"
              ? `${Number(entry.value ?? 0).toFixed(1)}%`
              : num(Number(entry.value ?? 0))}
          </span>
        </div>
      ))}
      {row ? (
        <div style={{ marginTop: 4, opacity: 0.8, fontSize: 10 }}>
          {num(row.total)} encounters · {php(row.gross, { compact: true })} gross
        </div>
      ) : null}
      <div style={{ marginTop: 4, opacity: 0.68, fontSize: 10, fontStyle: "italic" }}>
        Click to drill down →
      </div>
    </div>
  );
}

function DepartmentTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: RichTooltipPayloadEntry[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as
    | {
        department?: string;
        encounters?: number;
        grossCharges?: number;
        revenuePerEncounter?: number;
        balance?: number;
        nps?: number;
        npsResponses?: number;
        readmissionRate?: number;
      }
    | undefined;
  if (!row) return null;
  return (
    <div
      style={{
        background: "#111111",
        color: "#ffffff",
        borderRadius: 6,
        padding: "8px 10px",
        fontSize: 11,
        maxWidth: 240,
        boxShadow: "0 6px 16px rgba(0,0,0,0.28)",
        lineHeight: 1.5,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 12 }}>{row.department}</div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <span style={{ opacity: 0.82 }}>Encounters</span>
        <span style={{ fontWeight: 600 }}>{num(row.encounters ?? 0)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <span style={{ opacity: 0.82 }}>Gross revenue</span>
        <span style={{ fontWeight: 600 }}>{php(row.grossCharges ?? 0, { compact: true })}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <span style={{ opacity: 0.82 }}>Per encounter</span>
        <span style={{ fontWeight: 600 }}>
          {php(row.revenuePerEncounter ?? 0, { compact: true })}
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <span style={{ opacity: 0.82 }}>Outstanding</span>
        <span style={{ fontWeight: 600 }}>{php(row.balance ?? 0, { compact: true })}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <span style={{ opacity: 0.82 }}>NPS · readmission</span>
        <span style={{ fontWeight: 600 }}>
          {(row.npsResponses ?? 0) > 0 ? `${row.nps}` : "n/a"} · {ratePct(row.readmissionRate ?? 0)}
        </span>
      </div>
      <div style={{ marginTop: 4, opacity: 0.68, fontSize: 10, fontStyle: "italic" }}>
        Click to drill down →
      </div>
    </div>
  );
}

function DiagnosisTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: RichTooltipPayloadEntry[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as
    | {
        code?: string;
        description?: string;
        encounters?: number;
        avgLosDays?: number;
        grossCharges?: number;
        caseRate?: number;
      }
    | undefined;
  if (!row) return null;
  return (
    <div
      style={{
        background: "#111111",
        color: "#ffffff",
        borderRadius: 6,
        padding: "8px 10px",
        fontSize: 11,
        maxWidth: 240,
        boxShadow: "0 6px 16px rgba(0,0,0,0.28)",
        lineHeight: 1.5,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 12 }}>
        {row.code} · {row.description}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <span style={{ opacity: 0.82 }}>Encounters</span>
        <span style={{ fontWeight: 600 }}>{num(row.encounters ?? 0)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <span style={{ opacity: 0.82 }}>Avg inpatient LOS</span>
        <span style={{ fontWeight: 600 }}>{(row.avgLosDays ?? 0).toFixed(1)} days</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <span style={{ opacity: 0.82 }}>Gross charges</span>
        <span style={{ fontWeight: 600 }}>{php(row.grossCharges ?? 0, { compact: true })}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <span style={{ opacity: 0.82 }}>PhilHealth case rate</span>
        <span style={{ fontWeight: 600 }}>{php(row.caseRate ?? 0, { compact: true })}</span>
      </div>
      <div style={{ marginTop: 4, opacity: 0.68, fontSize: 10, fontStyle: "italic" }}>
        Click to drill down →
      </div>
    </div>
  );
}

function AttentionCard({ item, onDrill }: { item: AttentionItem; onDrill: () => void }) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-3 rounded-lg border border-l-4 bg-card p-4 shadow-sm",
        item.severity === "danger" ? "border-l-danger" : "border-l-warning",
      )}
    >
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">
            <AlertTriangle
              className={cn(
                "size-3.5",
                item.severity === "danger" ? "text-danger" : "text-warning",
              )}
            />
            {item.category}
          </span>
          <StatusBadge tone={item.severity === "danger" ? "danger" : "warning"}>
            {item.severity === "danger" ? "Act now" : "Watch"}
          </StatusBadge>
        </div>
        <p className="text-sm font-medium leading-snug text-text-primary">{item.title}</p>
        <p className="text-xl font-semibold tracking-tight text-text-primary">{item.value}</p>
        <p className="text-xs text-text-muted">{item.detail}</p>
        <p className="text-[11px] italic text-text-muted">{item.benchmark}</p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={onDrill}>
          Evidence
        </Button>
        <Link
          to={item.href}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-brand hover:underline"
        >
          {item.hrefLabel}
          <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}

function HandoffCard({ to, title, body }: { to: DeepLink; title: string; body: string }) {
  return (
    <Link
      to={to}
      className="group flex flex-col gap-1 rounded-lg border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className="flex items-center justify-between text-sm font-semibold text-text-primary">
        {title}
        <ArrowRight className="size-4 text-brand transition-transform group-hover:translate-x-0.5" />
      </span>
      <span className="text-xs text-text-muted">{body}</span>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Drill-down                                                          */
/* ------------------------------------------------------------------ */

const ENCOUNTER_ROW_LIMIT = 40;

function EncounterTable({
  dataset,
  encounters,
}: {
  dataset: HospitalDataset;
  encounters: Encounter[];
}) {
  const shown = encounters.slice(0, ENCOUNTER_ROW_LIMIT);
  if (shown.length === 0) {
    return <p className="text-xs text-text-muted">No encounter records match this selection.</p>;
  }
  return (
    <div className="space-y-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-[11px]">Patient</TableHead>
            <TableHead className="text-[11px]">Department</TableHead>
            <TableHead className="text-[11px]">Admitted</TableHead>
            <TableHead className="text-right text-[11px]">Charges</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((enc) => {
            const patient = dataset.index.patientById.get(enc.patientId);
            const department = dataset.index.departmentById.get(enc.departmentId);
            const doctor = dataset.index.doctorById.get(enc.primaryDoctorId);
            const bill = dataset.index.billingByEncounterId.get(enc.id);
            return (
              <TableRow key={enc.id}>
                <TableCell className="text-[11px]">
                  <div className="font-medium">{patient?.name ?? enc.patientId}</div>
                  <div className="text-text-muted">
                    {enc.id} · {enc.diagnosisCode ?? "uncoded"}
                  </div>
                </TableCell>
                <TableCell className="text-[11px]">
                  <div>{department?.name ?? enc.departmentId}</div>
                  <div className="text-text-muted">{doctor?.name ?? enc.primaryDoctorId}</div>
                </TableCell>
                <TableCell className="text-[11px]">
                  <div>{enc.admitDateTime.slice(0, 10)}</div>
                  <div className="text-text-muted">
                    {enc.encounterType}
                    {enc.encounterType === "Inpatient" ? ` · ${enc.losDays}d` : ""}
                  </div>
                </TableCell>
                <TableCell className="text-right text-[11px]">
                  <div>{php(bill?.grossCharges ?? 0, { compact: true })}</div>
                  <div className="text-text-muted">{bill?.paymentStatus ?? "—"}</div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {encounters.length > shown.length ? (
        <p className="text-[11px] text-text-muted">
          Showing the first {num(shown.length)} of {num(encounters.length)} encounters — export for
          the full list.
        </p>
      ) : null}
    </div>
  );
}

function encounterExportColumns(dataset: HospitalDataset) {
  const enc = (row: unknown) => row as Encounter;
  return [
    { header: "Encounter", get: (row: unknown) => enc(row).id },
    {
      header: "Patient",
      get: (row: unknown) => dataset.index.patientById.get(enc(row).patientId)?.name ?? "",
    },
    {
      header: "Department",
      get: (row: unknown) => dataset.index.departmentById.get(enc(row).departmentId)?.name ?? "",
    },
    {
      header: "Doctor",
      get: (row: unknown) => dataset.index.doctorById.get(enc(row).primaryDoctorId)?.name ?? "",
    },
    { header: "Type", get: (row: unknown) => enc(row).encounterType },
    { header: "Admitted", get: (row: unknown) => enc(row).admitDateTime.slice(0, 10) },
    { header: "LOS days", get: (row: unknown) => String(enc(row).losDays) },
    { header: "Diagnosis", get: (row: unknown) => enc(row).diagnosisCode ?? "" },
    { header: "Payer", get: (row: unknown) => enc(row).payerType },
    {
      header: "Gross charges",
      get: (row: unknown) =>
        String(dataset.index.billingByEncounterId.get(enc(row).id)?.grossCharges ?? 0),
    },
  ];
}

interface DrawerWindows {
  from: string;
  to: string;
  days: number;
  period: EncounterFilter;
  prior: EncounterFilter;
  priorFrom: string;
  priorTo: string;
  review: EncounterFilter;
  reviewPrior: EncounterFilter;
  reviewFrom: string;
  reviewDays: number;
  dimensionOnly: EncounterFilter;
}

function ExecutiveDrawer({
  dataset,
  drill,
  onClose,
  windows,
  current,
  prior,
  attention,
  periodLabel,
  reviewLabel,
  encounterTypeRows,
  departmentRows,
  payerRows,
  claimRows,
  diagnosisRows,
}: {
  dataset: HospitalDataset;
  drill: Drill;
  onClose: () => void;
  windows: DrawerWindows;
  current: Snapshot;
  prior: Snapshot;
  attention: AttentionItem[];
  periodLabel: string;
  reviewLabel: string;
  encounterTypeRows: ReturnType<typeof volumeByEncounterType>;
  departmentRows: {
    departmentId: string;
    department: string;
    encounters: number;
    grossCharges: number;
    revenuePerEncounter: number;
    balance: number;
    nps: number;
    npsResponses: number;
    readmissionRate: number;
  }[];
  payerRows: { payerType: PayerType; label: string; grossCharges: number; balance: number }[];
  claimRows: { status: ClaimStatus; claims: number; caseRateValue: number }[];
  diagnosisRows: ReturnType<typeof topDiagnoses>;
}) {
  const open = drill !== null;
  let title = "";
  let value = "";
  let body: React.ReactNode = null;
  let fullReportHref: string | undefined;
  let exportRows: unknown[] | undefined;
  let exportColumns: { header: string; get: (row: unknown) => string }[] | undefined;
  let rangeLabel = periodLabel;

  const attachEncounters = (encounters: Encounter[]) => {
    exportRows = encounters;
    exportColumns = encounterExportColumns(dataset);
    return <EncounterTable dataset={dataset} encounters={encounters} />;
  };

  if (drill?.kind === "kpi") {
    switch (drill.id) {
      case "encounters": {
        title = "Encounters";
        value = `${num(current.encounters)} · ${deltaPct(current.encounters, prior.encounters).toFixed(1)}% vs prior period`;
        fullReportHref = "/reports/admission-discharge-logbook";
        body = (
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">By encounter type</p>
              {encounterTypeRows.map((row) => (
                <StatRow
                  key={row.encounterType}
                  label={row.encounterType}
                  value={`${num(row.encounters)} · ${ratePct(row.share, 0)}`}
                />
              ))}
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">By department</p>
              {departmentRows.map((row) => (
                <StatRow
                  key={row.departmentId}
                  label={row.department}
                  value={num(row.encounters)}
                />
              ))}
              <p className="mt-1 text-[11px] italic text-text-muted">
                Department split uses the {reviewLabel}.
              </p>
            </div>
          </div>
        );
        break;
      }
      case "revenue": {
        title = "Gross revenue";
        value = `${php(current.gross)} · ${deltaPct(current.gross, prior.gross).toFixed(1)}% vs prior period`;
        fullReportHref = "/reports/revenue-collection";
        body = (
          <div className="space-y-4">
            <div>
              <StatRow label="Gross charges" value={php(current.gross)} />
              <StatRow label="Net payable" value={php(current.net)} />
              <StatRow label="Collected" value={php(current.paid)} />
              <StatRow label="Outstanding balance" value={php(current.balance)} />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">
                Gross by payer, this period
              </p>
              {payerRows.map((row) => (
                <StatRow
                  key={row.payerType}
                  label={row.label}
                  value={php(row.grossCharges, { compact: true })}
                />
              ))}
            </div>
          </div>
        );
        break;
      }
      case "yield": {
        title = "Revenue per encounter";
        value = `${php(current.revenuePerEncounter)} · prior ${php(prior.revenuePerEncounter)}`;
        body = (
          <div className="space-y-1">
            <p className="mb-1 text-xs font-medium text-text-secondary">
              By department ({reviewLabel})
            </p>
            {[...departmentRows]
              .sort((a, b) => b.revenuePerEncounter - a.revenuePerEncounter)
              .map((row) => (
                <StatRow
                  key={row.departmentId}
                  label={`${row.department} · ${num(row.encounters)} enc`}
                  value={php(row.revenuePerEncounter, { compact: true })}
                />
              ))}
          </div>
        );
        break;
      }
      case "collection": {
        title = "Collections";
        value = `${php(current.paid)} of ${php(current.net)} net payable`;
        fullReportHref = "/reports/revenue-collection";
        body = (
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">
                Bills raised in this period, by status
              </p>
              {paymentStatusBreakdown(dataset, windows.period).map((row) => (
                <StatRow
                  key={row.paymentStatus}
                  label={`${row.paymentStatus} · ${num(row.bills)} bills`}
                  value={php(row.balance, { compact: true })}
                />
              ))}
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">
                Aged receivables across all open bills
              </p>
              {arAgingByPayer(dataset, windows.dimensionOnly).map((row) => (
                <StatRow
                  key={row.payerType}
                  label={`${PAYER_META[row.payerType].label} · 90+ ${php(row.over90, { compact: true })}`}
                  value={php(row.total, { compact: true })}
                />
              ))}
              <p className="mt-1 text-[11px] italic text-text-muted">
                Aging is a stock, so it is measured across every open bill in the 12-month window
                rather than only encounters admitted in this period.
              </p>
            </div>
          </div>
        );
        break;
      }
      case "claims": {
        title = "PhilHealth claims";
        value = `${num(current.decidedClaims)} decided of ${num(current.claims)} claims`;
        fullReportHref = "/reports/philhealth-claims-register";
        body = (
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">Pipeline</p>
              {claimRows.map((row) => (
                <StatRow
                  key={row.status}
                  label={`${row.status} · ${num(row.claims)}`}
                  value={php(row.caseRateValue, { compact: true })}
                />
              ))}
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">
                Denial reasons this period
              </p>
              {claimDenialReasons(dataset, windows.period).map((row) => (
                <StatRow
                  key={row.denialCode}
                  label={`${row.denialCode} · ${row.reason}`}
                  value={`${num(row.claims)} · ${php(row.valueAtRisk, { compact: true })}`}
                />
              ))}
            </div>
          </div>
        );
        break;
      }
      case "nps": {
        title = "Patient satisfaction";
        value = `${Math.round(current.nps)} NPS from ${num(current.npsResponses)} responses`;
        body = (
          <div className="space-y-1">
            <p className="mb-1 text-xs font-medium text-text-secondary">
              By department, this period
            </p>
            {npsByDepartment(dataset, windows.period)
              .filter((row) => row.responses > 0)
              .sort((a, b) => a.nps - b.nps)
              .map((row) => (
                <StatRow
                  key={row.departmentId}
                  label={`${row.department} · ${num(row.responses)} responses`}
                  value={`${row.nps > 0 ? "+" : ""}${row.nps} NPS · CSAT ${row.avgCsat.toFixed(2)}`}
                />
              ))}
          </div>
        );
        break;
      }
      case "readmission": {
        title = "30-day readmission";
        value = `${ratePct(current.readmissionRate)} · ${num(current.readmissions)} of ${num(current.readmitEligible)} eligible`;
        body = (
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">
                By payer x department, this period
              </p>
              {readmissionRateByPayerAndDepartment(dataset, windows.period)
                .filter((row) => row.readmissions > 0)
                .sort((a, b) => b.rate - a.rate)
                .map((row) => (
                  <StatRow
                    key={`${row.departmentId}-${row.payerType}`}
                    label={`${row.department} · ${PAYER_META[row.payerType].label}`}
                    value={`${ratePct(row.rate)} (${row.readmissions}/${row.eligibleEncounters})`}
                  />
                ))}
            </div>
            {attachEncounters(
              filterEncounters(dataset, windows.period).filter((e) => e.readmitted30d),
            )}
          </div>
        );
        break;
      }
      case "alos": {
        title = "Average length of stay";
        value = `${current.alos.toFixed(1)} days across ${num(current.discharges)} discharges`;
        body = (
          <div className="space-y-1">
            <p className="mb-1 text-xs font-medium text-text-secondary">
              Distribution by department ({reviewLabel})
            </p>
            {losStatsByDepartment(dataset, windows.review)
              .filter((row) => row.discharges > 0)
              .sort((a, b) => b.meanLosDays - a.meanLosDays)
              .map((row) => (
                <StatRow
                  key={row.departmentId}
                  label={`${row.department} · ${num(row.discharges)} discharges`}
                  value={`mean ${row.meanLosDays.toFixed(1)}d · median ${row.medianLosDays}d · p90 ${row.p90LosDays}d`}
                />
              ))}
          </div>
        );
        break;
      }
      default:
        title = "Metric";
        break;
    }
  } else if (drill?.kind === "month") {
    const month = dataset.months.find((m) => m.key === drill.month);
    const monthFilter: EncounterFilter = {
      ...windows.dimensionOnly,
      from: month?.startDate ?? drill.month,
      to: month?.endDate ?? drill.month,
    };
    const encounters = filterEncounters(dataset, monthFilter);
    const revenue = revenueByDepartment(dataset, monthFilter).filter((r) => r.encounters > 0);
    title = `${month?.label ?? drill.month} detail`;
    rangeLabel = month ? `${fmtDay(month.startDate)} – ${fmtDay(month.endDate)}` : drill.month;
    value = `${num(encounters.length)} encounters · ${php(
      sum(revenue, (r) => r.grossCharges),
      { compact: true },
    )} gross`;
    fullReportHref = "/reports/daily-census";
    body = (
      <div className="space-y-4">
        {month?.isPartial ? (
          <p className="rounded-md bg-warning/10 p-2 text-[11px] text-warning">
            Month to date — {month.daysObserved} of {month.daysInMonth} days observed.
          </p>
        ) : null}
        <div>
          <p className="mb-1 text-xs font-medium text-text-secondary">By department</p>
          {[...revenue]
            .sort((a, b) => b.encounters - a.encounters)
            .map((row) => (
              <StatRow
                key={row.departmentId}
                label={`${row.department} · ${num(row.encounters)} enc`}
                value={php(row.grossCharges, { compact: true })}
              />
            ))}
        </div>
        {attachEncounters(encounters)}
      </div>
    );
  } else if (drill?.kind === "department") {
    const deptFilter: EncounterFilter = { ...windows.review, departmentIds: [drill.departmentId] };
    const row = departmentRows.find((r) => r.departmentId === drill.departmentId);
    const encounters = filterEncounters(dataset, deptFilter);
    const doctors = doctorProductivity(dataset, deptFilter).filter((d) => d.encounters > 0);
    const diagnoses = topDiagnoses(dataset, 5, deptFilter).filter((d) => d.encounters > 0);
    title = row?.department ?? drill.departmentId;
    rangeLabel = reviewLabel;
    value = `${num(row?.encounters ?? 0)} encounters · ${php(row?.grossCharges ?? 0, { compact: true })} gross`;
    fullReportHref = "/reports/physician-activity";
    body = (
      <div className="space-y-4">
        <div>
          <StatRow
            label="Revenue per encounter"
            value={php(row?.revenuePerEncounter ?? 0, { compact: true })}
          />
          <StatRow label="Outstanding balance" value={php(row?.balance ?? 0, { compact: true })} />
          <StatRow
            label="NPS"
            value={
              (row?.npsResponses ?? 0) > 0
                ? `${row?.nps} from ${num(row?.npsResponses ?? 0)} responses`
                : "No responses"
            }
          />
          <StatRow label="30-day readmission" value={ratePct(row?.readmissionRate ?? 0)} />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-text-secondary">Physicians</p>
          {doctors.map((doc) => (
            <StatRow
              key={doc.doctorId}
              label={`${doc.doctor} · ${num(doc.encounters)} enc`}
              value={php(doc.grossCharges, { compact: true })}
            />
          ))}
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-text-secondary">Leading diagnoses</p>
          {diagnoses.map((dx) => (
            <StatRow
              key={dx.code}
              label={`${dx.code} · ${dx.commonName}`}
              value={`${num(dx.encounters)} · ${dx.avgLosDays.toFixed(1)}d`}
            />
          ))}
        </div>
        {attachEncounters(encounters)}
      </div>
    );
  } else if (drill?.kind === "payer") {
    const payerFilter: EncounterFilter = { ...windows.period, payerTypes: [drill.payer] };
    const revenue = revenueByDepartment(dataset, payerFilter).filter((r) => r.encounters > 0);
    const meta = PAYER_META[drill.payer];
    const row = payerRows.find((p) => p.payerType === drill.payer);
    title = `${meta.label} revenue`;
    value = `${php(row?.grossCharges ?? 0)} gross`;
    fullReportHref = "/reports/revenue-collection";
    body = (
      <div className="space-y-4">
        <div>
          <p className="mb-1 text-xs font-medium text-text-secondary">
            By department — real payer x department split, not an allocation
          </p>
          {[...revenue]
            .sort((a, b) => b.grossCharges - a.grossCharges)
            .map((dept) => (
              <StatRow
                key={dept.departmentId}
                label={`${dept.department} · ${num(dept.encounters)} enc`}
                value={php(dept.grossCharges, { compact: true })}
              />
            ))}
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-text-secondary">Collection position</p>
          <StatRow
            label="Net payable"
            value={php(
              sum(revenue, (r) => r.netPayable),
              { compact: true },
            )}
          />
          <StatRow
            label="Collected"
            value={php(
              sum(revenue, (r) => r.amountPaid),
              { compact: true },
            )}
          />
          <StatRow
            label="Outstanding"
            value={php(
              sum(revenue, (r) => r.balance),
              { compact: true },
            )}
          />
        </div>
        {attachEncounters(filterEncounters(dataset, payerFilter))}
      </div>
    );
  } else if (drill?.kind === "claimStatus") {
    const row = claimRows.find((r) => r.status === drill.status);
    const claims = dataset.claims.filter((claim) => claim.status === drill.status);
    const periodIds = new Set(filterEncounters(dataset, windows.period).map((e) => e.id));
    const scoped = claims.filter((claim) => periodIds.has(claim.encounterId));
    title = `Claims — ${drill.status}`;
    value = `${num(row?.claims ?? 0)} claims · ${php(row?.caseRateValue ?? 0, { compact: true })} case-rate value`;
    fullReportHref =
      drill.status === "Denied"
        ? "/reports/denial-appeal-tracker"
        : "/reports/philhealth-claims-register";
    exportRows = scoped;
    exportColumns = [
      { header: "Claim", get: (r) => (r as (typeof scoped)[number]).id },
      { header: "Encounter", get: (r) => (r as (typeof scoped)[number]).encounterId },
      { header: "Case type", get: (r) => (r as (typeof scoped)[number]).caseType },
      { header: "Case rate", get: (r) => String((r as (typeof scoped)[number]).caseRateAmount) },
      { header: "Submitted", get: (r) => (r as (typeof scoped)[number]).submissionDate },
      { header: "Status", get: (r) => (r as (typeof scoped)[number]).status },
      { header: "Denial code", get: (r) => (r as (typeof scoped)[number]).denialCode ?? "" },
    ];
    body = (
      <div className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[11px]">Claim</TableHead>
              <TableHead className="text-[11px]">Case type</TableHead>
              <TableHead className="text-[11px]">Submitted</TableHead>
              <TableHead className="text-right text-[11px]">Case rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scoped.slice(0, ENCOUNTER_ROW_LIMIT).map((claim) => {
              const enc = dataset.index.encounterById.get(claim.encounterId);
              const dept = enc ? dataset.index.departmentById.get(enc.departmentId) : undefined;
              return (
                <TableRow key={claim.id}>
                  <TableCell className="text-[11px]">
                    <div className="font-medium">{claim.id}</div>
                    <div className="text-text-muted">{dept?.name ?? ""}</div>
                  </TableCell>
                  <TableCell className="text-[11px]">
                    <div>{claim.caseType}</div>
                    {claim.denialCode ? (
                      <div className="text-danger">{claim.denialCode}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-[11px]">{claim.submissionDate}</TableCell>
                  <TableCell className="text-right text-[11px]">
                    {php(claim.caseRateAmount, { compact: true })}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {scoped.length > ENCOUNTER_ROW_LIMIT ? (
          <p className="text-[11px] text-text-muted">
            Showing the first {ENCOUNTER_ROW_LIMIT} of {num(scoped.length)} claims.
          </p>
        ) : null}
      </div>
    );
  } else if (drill?.kind === "denial") {
    const periodIds = new Set(filterEncounters(dataset, windows.period).map((e) => e.id));
    const claims = dataset.claims.filter(
      (claim) => claim.denialCode === drill.code && periodIds.has(claim.encounterId),
    );
    const reason = claimDenialReasons(dataset, windows.period).find(
      (r) => r.denialCode === drill.code,
    );
    title = `${drill.code} · ${reason?.reason ?? "Denial reason"}`;
    value = `${num(reason?.claims ?? claims.length)} denials · ${php(reason?.valueAtRisk ?? 0, { compact: true })} at risk`;
    fullReportHref = "/reports/denial-appeal-tracker";
    body = (
      <div className="space-y-4">
        <div>
          <StatRow label="Appeals filed" value={num(reason?.appealed ?? 0)} />
          <StatRow label="Appeals won" value={num(reason?.recovered ?? 0)} />
          <StatRow
            label="Amount recovered"
            value={php(reason?.amountRecovered ?? 0, { compact: true })}
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-text-secondary">Denied claims</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[11px]">Claim</TableHead>
                <TableHead className="text-[11px]">Department</TableHead>
                <TableHead className="text-[11px]">Appeal</TableHead>
                <TableHead className="text-right text-[11px]">Case rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims.slice(0, ENCOUNTER_ROW_LIMIT).map((claim) => {
                const enc = dataset.index.encounterById.get(claim.encounterId);
                const dept = enc ? dataset.index.departmentById.get(enc.departmentId) : undefined;
                const doctor = enc ? dataset.index.doctorById.get(enc.primaryDoctorId) : undefined;
                return (
                  <TableRow key={claim.id}>
                    <TableCell className="text-[11px]">
                      <div className="font-medium">{claim.id}</div>
                      <div className="text-text-muted">{claim.submissionDate}</div>
                    </TableCell>
                    <TableCell className="text-[11px]">
                      <div>{dept?.name ?? ""}</div>
                      <div className="text-text-muted">{doctor?.name ?? ""}</div>
                    </TableCell>
                    <TableCell className="text-[11px]">
                      {claim.appealStatus ?? "Not filed"}
                    </TableCell>
                    <TableCell className="text-right text-[11px]">
                      {php(claim.caseRateAmount, { compact: true })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  } else if (drill?.kind === "diagnosis") {
    const dx = diagnosisRows.find((d) => d.code === drill.code);
    const encounters = filterEncounters(dataset, windows.period).filter(
      (e) => e.diagnosisCode === drill.code,
    );
    title = `${dx?.code ?? drill.code} · ${dx?.description ?? ""}`;
    value = `${num(dx?.encounters ?? encounters.length)} encounters this period`;
    fullReportHref = "/reports/morbidity-summary";
    body = (
      <div className="space-y-4">
        <div>
          <StatRow label="PhilHealth case rate" value={php(dx?.caseRate ?? 0)} />
          <StatRow
            label="Average inpatient LOS"
            value={`${(dx?.avgLosDays ?? 0).toFixed(1)} days`}
          />
          <StatRow label="Gross charges" value={php(dx?.grossCharges ?? 0, { compact: true })} />
          <StatRow label="30-day readmission" value={ratePct(dx?.readmissionRate ?? 0)} />
        </div>
        {attachEncounters(encounters)}
      </div>
    );
  } else if (drill?.kind === "attention") {
    const item = attention.find((a) => a.id === drill.id);
    title = item?.title ?? "Signal";
    value = item?.value ?? "";
    rangeLabel = reviewLabel;
    body = item ? (
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">{item.detail}</p>
        <p className="text-xs italic text-text-muted">{item.benchmark}</p>
        <div>
          <p className="mb-1 text-xs font-medium text-text-secondary">Supporting figures</p>
          {item.rows.map((row) => (
            <StatRow key={row.label} label={row.label} value={row.value} />
          ))}
        </div>
        <Link
          to={item.href}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
        >
          {item.hrefLabel}
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    ) : null;
  }

  return (
    <ChartDrillDrawer
      open={open}
      onOpenChange={(next) => (next ? null : onClose())}
      metricName={title}
      value={value}
      dateRangeLabel={rangeLabel}
      {...(exportRows ? { exportRows } : {})}
      {...(exportColumns ? { exportColumns } : {})}
      {...(fullReportHref ? { fullReportHref } : {})}
    >
      {body}
    </ChartDrillDrawer>
  );
}

/* ------------------------------------------------------------------ */

function ExecutiveSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 w-80" />
      <Skeleton className="h-12 w-full rounded-lg" />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-80 w-full rounded-lg" />
        <Skeleton className="h-80 w-full rounded-lg" />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-80 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
