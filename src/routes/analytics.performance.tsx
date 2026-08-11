/**
 * Performance Analysis — tier 2 of the hospital analytics hierarchy
 * (Overview -> **Comparison** -> Financial/Claims -> Patient/Experience -> Detail).
 *
 * This page exists to close the two biggest cross-cutting gaps named in
 * `chart-audit.md`: "doctor-level comparison is the weakest axis on the site"
 * and "sorting is effectively absent — 0 of 87 charts have a sort control".
 * Accordingly every panel here is a *comparison* of like against like, and every
 * panel carries an explicit sort-by control plus an ascending/descending toggle
 * on the ranked metric. The one place sorting is deliberately not offered is a
 * chronological axis, where re-ordering time would be meaningless.
 *
 * All numbers come from the shared synthetic dataset (`src/lib/data/hospital/**`)
 * through its derive layer — `volumeByDepartment`, `revenueByDepartment`,
 * `losStatsByDepartment`, `npsByDepartment`,
 * `readmissionRateByPayerAndDepartment`, `serviceUtilization`,
 * `doctorProductivity` and `filterEncounters` — so they reconcile with the
 * Overview and Patient/Experience pages.
 *
 * The page-local aggregations below (per-doctor coding completeness, claim
 * denial rate and readmission rate; the department join; the two-period
 * cross-tab) intentionally live in this file rather than in `derive.ts`: they
 * are page-specific cross-tabs over tables the derive layer already exposes,
 * and other dashboards are being migrated against `derive.ts` concurrently.
 */
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
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
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Building2,
  CalendarRange,
  Layers,
  Stethoscope,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  GlobalHospitalFilterBar,
  useHospitalFilters,
} from "@/components/analytics/hospital-filter-context";
import {
  ChartDrillDrawer,
  InteractiveChartCard,
  RichTooltip,
  type RichTooltipPayloadEntry,
} from "@/components/analytics/interactive";
import {
  KpiStrip,
  LegendDot,
  MetricCard,
  PALETTE,
  PanelCard,
  SectionTitle,
  StatRow,
  StatusBadge,
  num,
  pct,
  php,
  statusHex,
  type MetricStatus,
} from "@/components/analytics/shared";
import type { ReportColumn } from "@/components/reports/types";
import {
  MS_DAY,
  doctorProductivity,
  filterEncounters,
  getHospitalDataset,
  losStatsByDepartment,
  npsByDepartment,
  parseDate,
  readmissionRateByPayerAndDepartment,
  revenueByDepartment,
  serviceUtilization,
  toDate,
  volumeByDepartment,
  type Encounter,
  type EncounterFilter,
  type HospitalDataset,
  type ServiceUtilizationRow,
} from "@/lib/data/hospital";

export const Route = createFileRoute("/analytics/performance")({
  head: () => ({
    meta: [
      { title: "Performance Analysis — SugboDoc Analytics" },
      {
        name: "description",
        content: "Compare departments, services and doctors on volume, revenue and satisfaction.",
      },
    ],
  }),
  component: PerformancePage,
});

const ALL = "all";

/* ------------------------------------------------------------------ */
/* Small numeric helpers                                               */
/* ------------------------------------------------------------------ */

function sum<T>(rows: readonly T[], get: (row: T) => number): number {
  return rows.reduce((total, row) => total + get(row), 0);
}

/** Relative change in percent, guarding the zero-prior case. */
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

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/** `pct()` expects an already-scaled percentage; these rates are 0–1. */
function ratePct(value: number, digits = 1): string {
  return pct(value * 100, digits);
}

function signed(value: number, digits = 1): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

/**
 * Tertile banding of one metric across the compared rows. This is what lets a
 * bar chart carry a *third* variable in its fill without the colour merely
 * restating the bar length.
 */
function bandRows<T>(
  rows: readonly T[],
  get: (row: T) => number,
  higherIsBetter: boolean,
  keyOf: (row: T) => string,
): Map<string, MetricStatus> {
  const bands = new Map<string, MetricStatus>();
  const values = rows.map(get).sort((a, b) => a - b);
  if (values.length === 0) return bands;
  const low = values[Math.floor((values.length - 1) * 0.33)] ?? 0;
  const high = values[Math.floor((values.length - 1) * 0.67)] ?? 0;
  for (const row of rows) {
    if (low === high) {
      bands.set(keyOf(row), "neutral");
      continue;
    }
    const value = get(row);
    const top = value >= high;
    const bottom = value <= low;
    let tone: MetricStatus = "warning";
    if (top) tone = higherIsBetter ? "good" : "danger";
    else if (bottom) tone = higherIsBetter ? "danger" : "good";
    bands.set(keyOf(row), tone);
  }
  return bands;
}

type SortDir = "asc" | "desc";

function bySort<T>(rows: readonly T[], get: (row: T) => number, dir: SortDir): T[] {
  return [...rows].sort((a, b) => (dir === "asc" ? get(a) - get(b) : get(b) - get(a)));
}

function byName<T>(rows: readonly T[], get: (row: T) => string, dir: SortDir): T[] {
  return [...rows].sort((a, b) =>
    dir === "asc" ? get(a).localeCompare(get(b)) : get(b).localeCompare(get(a)),
  );
}

/* ------------------------------------------------------------------ */
/* Metric catalogue                                                    */
/* ------------------------------------------------------------------ */

interface MetricDef<K extends string> {
  key: K;
  label: string;
  /** Axis title including the unit — every chart axis on this page is labelled. */
  axis: string;
  higherIsBetter: boolean;
  format: (value: number) => string;
  tick: (value: number) => string;
}

type DeptMetricKey =
  | "encounters"
  | "inpatient"
  | "grossCharges"
  | "amountPaid"
  | "revenuePerEncounter"
  | "collectionRate"
  | "meanLosDays"
  | "nps"
  | "readmissionRate"
  | "avgDailyCensus";

const DEPT_METRICS: readonly MetricDef<DeptMetricKey>[] = [
  {
    key: "encounters",
    label: "Encounters",
    axis: "Encounters (count)",
    higherIsBetter: true,
    format: (v) => `${num(v)} encounters`,
    tick: (v) => num(Math.round(v)),
  },
  {
    key: "inpatient",
    label: "Inpatient admissions",
    axis: "Inpatient admissions (count)",
    higherIsBetter: true,
    format: (v) => `${num(v)} admissions`,
    tick: (v) => num(Math.round(v)),
  },
  {
    key: "grossCharges",
    label: "Gross revenue",
    axis: "Gross revenue (PHP)",
    higherIsBetter: true,
    format: (v) => php(v, { compact: true }),
    tick: (v) => `${(v / 1_000_000).toFixed(1)}M`,
  },
  {
    key: "amountPaid",
    label: "Cash collected",
    axis: "Cash collected (PHP)",
    higherIsBetter: true,
    format: (v) => php(v, { compact: true }),
    tick: (v) => `${(v / 1_000_000).toFixed(1)}M`,
  },
  {
    key: "revenuePerEncounter",
    label: "Revenue per encounter",
    axis: "Revenue per encounter (PHP)",
    higherIsBetter: true,
    format: (v) => php(v, { compact: true }),
    tick: (v) => `${(v / 1_000).toFixed(0)}K`,
  },
  {
    key: "collectionRate",
    label: "Collection rate",
    axis: "Collected / net payable (%)",
    higherIsBetter: true,
    format: (v) => ratePct(v),
    tick: (v) => `${Math.round(v * 100)}%`,
  },
  {
    key: "meanLosDays",
    label: "Mean length of stay",
    axis: "Mean length of stay (days)",
    higherIsBetter: false,
    format: (v) => `${v.toFixed(1)} days`,
    tick: (v) => v.toFixed(1),
  },
  {
    key: "nps",
    label: "NPS index",
    axis: "NPS index (−100…+100)",
    higherIsBetter: true,
    format: (v) => `${v > 0 ? "+" : ""}${Math.round(v)} NPS`,
    tick: (v) => `${Math.round(v)}`,
  },
  {
    key: "readmissionRate",
    label: "30-day readmission rate",
    axis: "30-day readmission rate (%)",
    higherIsBetter: false,
    format: (v) => ratePct(v),
    tick: (v) => `${Math.round(v * 100)}%`,
  },
  {
    key: "avgDailyCensus",
    label: "Average daily census",
    axis: "Average daily census (beds occupied)",
    higherIsBetter: true,
    format: (v) => `${v.toFixed(1)} beds/day`,
    tick: (v) => v.toFixed(1),
  },
] as const;

function deptMetric(key: DeptMetricKey): MetricDef<DeptMetricKey> {
  return DEPT_METRICS.find((m) => m.key === key) ?? (DEPT_METRICS[0] as MetricDef<DeptMetricKey>);
}

type ServiceMetricKey = "revenue" | "units" | "encounters" | "revenuePerEncounter" | "share";

const SERVICE_METRICS: readonly MetricDef<ServiceMetricKey>[] = [
  {
    key: "revenue",
    label: "Revenue booked",
    axis: "Charge-line revenue (PHP)",
    higherIsBetter: true,
    format: (v) => php(v, { compact: true }),
    tick: (v) => `${(v / 1_000_000).toFixed(1)}M`,
  },
  {
    key: "units",
    label: "Units delivered",
    axis: "Units delivered (charge-line quantity)",
    higherIsBetter: true,
    format: (v) => `${num(v)} units`,
    tick: (v) => num(Math.round(v)),
  },
  {
    key: "encounters",
    label: "Encounters using it",
    axis: "Encounters carrying this service (count)",
    higherIsBetter: true,
    format: (v) => `${num(v)} encounters`,
    tick: (v) => num(Math.round(v)),
  },
  {
    key: "revenuePerEncounter",
    label: "Revenue per encounter",
    axis: "Revenue per encounter (PHP)",
    higherIsBetter: true,
    format: (v) => php(v, { compact: true }),
    tick: (v) => `${(v / 1_000).toFixed(0)}K`,
  },
  {
    key: "share",
    label: "Share of charge revenue",
    axis: "Share of the window's charge-line revenue (%)",
    higherIsBetter: true,
    format: (v) => ratePct(v, 2),
    tick: (v) => `${(v * 100).toFixed(1)}%`,
  },
] as const;

function serviceMetric(key: ServiceMetricKey): MetricDef<ServiceMetricKey> {
  return (
    SERVICE_METRICS.find((m) => m.key === key) ??
    (SERVICE_METRICS[0] as MetricDef<ServiceMetricKey>)
  );
}

type DoctorMetricKey =
  | "encounters"
  | "inpatient"
  | "grossCharges"
  | "revenuePerCase"
  | "capacityUtilization"
  | "avgLosDays"
  | "codedShare"
  | "denialRate"
  | "readmissionRate";

const DOCTOR_METRICS: readonly MetricDef<DoctorMetricKey>[] = [
  {
    key: "encounters",
    label: "Case volume",
    axis: "Cases handled (count)",
    higherIsBetter: true,
    format: (v) => `${num(v)} cases`,
    tick: (v) => num(Math.round(v)),
  },
  {
    key: "inpatient",
    label: "Inpatient cases",
    axis: "Inpatient cases (count)",
    higherIsBetter: true,
    format: (v) => `${num(v)} admissions`,
    tick: (v) => num(Math.round(v)),
  },
  {
    key: "grossCharges",
    label: "Gross revenue",
    axis: "Gross revenue attributed (PHP)",
    higherIsBetter: true,
    format: (v) => php(v, { compact: true }),
    tick: (v) => `${(v / 1_000_000).toFixed(2)}M`,
  },
  {
    key: "revenuePerCase",
    label: "Revenue per case",
    axis: "Revenue per case (PHP)",
    higherIsBetter: true,
    format: (v) => php(v, { compact: true }),
    tick: (v) => `${(v / 1_000).toFixed(0)}K`,
  },
  {
    key: "capacityUtilization",
    label: "Capacity utilisation",
    axis: "Cases / month vs rostered capacity (%)",
    higherIsBetter: true,
    format: (v) => ratePct(v),
    tick: (v) => `${Math.round(v * 100)}%`,
  },
  {
    key: "avgLosDays",
    label: "Mean length of stay",
    axis: "Mean inpatient length of stay (days)",
    higherIsBetter: false,
    format: (v) => `${v.toFixed(1)} days`,
    tick: (v) => v.toFixed(1),
  },
  {
    key: "codedShare",
    label: "Diagnosis-coding completeness",
    axis: "Encounters carrying an ICD-10 code (%)",
    higherIsBetter: true,
    format: (v) => ratePct(v),
    tick: (v) => `${Math.round(v * 100)}%`,
  },
  {
    key: "denialRate",
    label: "PhilHealth denial rate",
    axis: "Denied / decided claims (%)",
    higherIsBetter: false,
    format: (v) => ratePct(v),
    tick: (v) => `${Math.round(v * 100)}%`,
  },
  {
    key: "readmissionRate",
    label: "30-day readmission rate",
    axis: "30-day readmission rate (%)",
    higherIsBetter: false,
    format: (v) => ratePct(v),
    tick: (v) => `${Math.round(v * 100)}%`,
  },
] as const;

function doctorMetric(key: DoctorMetricKey): MetricDef<DoctorMetricKey> {
  return (
    DOCTOR_METRICS.find((m) => m.key === key) ?? (DOCTOR_METRICS[0] as MetricDef<DoctorMetricKey>)
  );
}

type PeriodMetricKey = "encounters" | "grossCharges" | "amountPaid" | "revenuePerEncounter";

const PERIOD_METRICS: readonly MetricDef<PeriodMetricKey>[] = [
  {
    key: "encounters",
    label: "Encounters",
    axis: "Encounters (count)",
    higherIsBetter: true,
    format: (v) => `${num(v)} encounters`,
    tick: (v) => num(Math.round(v)),
  },
  {
    key: "grossCharges",
    label: "Gross revenue",
    axis: "Gross revenue (PHP)",
    higherIsBetter: true,
    format: (v) => php(v, { compact: true }),
    tick: (v) => `${(v / 1_000_000).toFixed(1)}M`,
  },
  {
    key: "amountPaid",
    label: "Cash collected",
    axis: "Cash collected (PHP)",
    higherIsBetter: true,
    format: (v) => php(v, { compact: true }),
    tick: (v) => `${(v / 1_000_000).toFixed(1)}M`,
  },
  {
    key: "revenuePerEncounter",
    label: "Revenue per encounter",
    axis: "Revenue per encounter (PHP)",
    higherIsBetter: true,
    format: (v) => php(v, { compact: true }),
    tick: (v) => `${(v / 1_000).toFixed(0)}K`,
  },
] as const;

function periodMetric(key: PeriodMetricKey): MetricDef<PeriodMetricKey> {
  return (
    PERIOD_METRICS.find((m) => m.key === key) ?? (PERIOD_METRICS[0] as MetricDef<PeriodMetricKey>)
  );
}

/* ------------------------------------------------------------------ */
/* Page-local row shapes                                               */
/* ------------------------------------------------------------------ */

/** One department, joined across five derive-layer aggregations. */
interface DeptRow {
  departmentId: string;
  department: string;
  color: string;
  encounters: number;
  inpatient: number;
  bedDaysUsed: number;
  avgDailyCensus: number;
  grossCharges: number;
  netPayable: number;
  amountPaid: number;
  balance: number;
  revenuePerEncounter: number;
  collectionRate: number;
  discharges: number;
  meanLosDays: number;
  medianLosDays: number;
  nps: number;
  npsResponses: number;
  avgCsat: number;
  readmitEligible: number;
  readmissions: number;
  readmissionRate: number;
  volumeShare: number;
  revenueShare: number;
}

/** One physician: `doctorProductivity()` plus page-local quality/compliance. */
interface DoctorRow {
  doctorId: string;
  doctor: string;
  departmentId: string;
  department: string;
  color: string;
  yearsExperience: number;
  monthlyCaseCapacity: number;
  encounters: number;
  inpatient: number;
  grossCharges: number;
  revenuePerCase: number;
  avgLosDays: number;
  capacityUtilization: number;
  codedEncounters: number;
  codedShare: number;
  claims: number;
  decidedClaims: number;
  deniedClaims: number;
  denialRate: number;
  readmitEligible: number;
  readmissions: number;
  readmissionRate: number;
}

/** One department under two different time windows. */
interface PeriodRow {
  departmentId: string;
  department: string;
  color: string;
  a: number;
  b: number;
  deltaAbs: number;
  deltaPct: number;
}

/** Terminal drill tier: one encounter, joined to patient / billing / claim. */
interface EncounterRecord {
  id: string;
  admitDate: string;
  patient: string;
  patientId: string;
  department: string;
  doctor: string;
  encounterType: string;
  diagnosisCode: string;
  losDays: number;
  disposition: string;
  payerType: string;
  grossCharges: number;
  balance: number;
  paymentStatus: string;
  claimStatus: string;
  /** Charge-line total for the drilled service; `null` outside a service drill. */
  serviceAmount: number | null;
}

type Drill =
  | { kind: "department"; departmentId: string }
  | { kind: "service"; serviceId: string }
  | { kind: "doctor"; doctorId: string }
  | { kind: "period"; departmentId: string }
  | null;

/* ------------------------------------------------------------------ */
/* Page-local derivations                                              */
/* ------------------------------------------------------------------ */

function buildDeptRows(dataset: HospitalDataset, filter: EncounterFilter): DeptRow[] {
  const volume = volumeByDepartment(dataset, filter);
  const revenue = revenueByDepartment(dataset, filter);
  const los = losStatsByDepartment(dataset, filter);
  const nps = npsByDepartment(dataset, filter);
  const readmit = readmissionRateByPayerAndDepartment(dataset, filter);

  const revenueById = new Map(revenue.map((r) => [r.departmentId, r]));
  const losById = new Map(los.map((r) => [r.departmentId, r]));
  const npsById = new Map(nps.map((r) => [r.departmentId, r]));

  const readmitById = new Map<string, { eligible: number; readmissions: number }>();
  for (const row of readmit) {
    const bucket = readmitById.get(row.departmentId) ?? { eligible: 0, readmissions: 0 };
    bucket.eligible += row.eligibleEncounters;
    bucket.readmissions += row.readmissions;
    readmitById.set(row.departmentId, bucket);
  }

  const totalEncounters = sum(volume, (r) => r.encounters) || 1;
  const totalGross = sum(revenue, (r) => r.grossCharges) || 1;

  return volume
    .filter((row) => row.encounters > 0)
    .map((row) => {
      const rev = revenueById.get(row.departmentId);
      const stay = losById.get(row.departmentId);
      const score = npsById.get(row.departmentId);
      const re = readmitById.get(row.departmentId);
      const grossCharges = rev?.grossCharges ?? 0;
      const netPayable = rev?.netPayable ?? 0;
      const amountPaid = rev?.amountPaid ?? 0;
      return {
        departmentId: row.departmentId,
        department: row.department,
        color: row.color,
        encounters: row.encounters,
        inpatient: row.inpatient,
        bedDaysUsed: row.bedDaysUsed,
        avgDailyCensus: row.avgDailyCensus,
        grossCharges,
        netPayable,
        amountPaid,
        balance: rev?.balance ?? 0,
        revenuePerEncounter: rev?.revenuePerEncounter ?? 0,
        collectionRate: netPayable > 0 ? amountPaid / netPayable : 0,
        discharges: stay?.discharges ?? 0,
        meanLosDays: stay?.meanLosDays ?? 0,
        medianLosDays: stay?.medianLosDays ?? 0,
        nps: score?.nps ?? 0,
        npsResponses: score?.responses ?? 0,
        avgCsat: score?.avgCsat ?? 0,
        readmitEligible: re?.eligible ?? 0,
        readmissions: re?.readmissions ?? 0,
        readmissionRate: re && re.eligible > 0 ? re.readmissions / re.eligible : 0,
        volumeShare: row.encounters / totalEncounters,
        revenueShare: grossCharges / totalGross,
      } satisfies DeptRow;
    });
}

/**
 * `doctorProductivity()` gives volume, revenue, mean LOS and capacity
 * utilisation. It does not expose a quality/compliance signal, so the three
 * added here — ICD-10 coding completeness, PhilHealth denial rate and 30-day
 * readmission rate — are computed in one pass over the same filtered encounter
 * cohort, using the dataset index maps.
 */
function buildDoctorRows(
  dataset: HospitalDataset,
  filter: EncounterFilter,
  colorByDepartment: ReadonlyMap<string, string>,
): DoctorRow[] {
  const productivity = doctorProductivity(dataset, filter);
  const encounters = filterEncounters(dataset, filter);

  interface Extra {
    coded: number;
    claims: number;
    decided: number;
    denied: number;
    readmitEligible: number;
    readmissions: number;
  }
  const extras = new Map<string, Extra>();
  for (const enc of encounters) {
    const extra = extras.get(enc.primaryDoctorId) ?? {
      coded: 0,
      claims: 0,
      decided: 0,
      denied: 0,
      readmitEligible: 0,
      readmissions: 0,
    };
    if (enc.diagnosisCode !== null) extra.coded += 1;
    const claim = dataset.index.claimByEncounterId.get(enc.id);
    if (claim) {
      extra.claims += 1;
      if (claim.status === "Approved" || claim.status === "Denied" || claim.status === "Remitted") {
        extra.decided += 1;
        if (claim.status === "Denied") extra.denied += 1;
      }
    }
    if (enc.encounterType === "Inpatient" || enc.encounterType === "Emergency") {
      extra.readmitEligible += 1;
      if (enc.readmitted30d) extra.readmissions += 1;
    }
    extras.set(enc.primaryDoctorId, extra);
  }

  return productivity
    .filter((row) => row.encounters > 0)
    .map((row) => {
      const doc = dataset.index.doctorById.get(row.doctorId);
      const extra = extras.get(row.doctorId);
      const decided = extra?.decided ?? 0;
      const eligible = extra?.readmitEligible ?? 0;
      return {
        doctorId: row.doctorId,
        doctor: row.doctor,
        departmentId: row.departmentId,
        department: row.department,
        color: colorByDepartment.get(row.departmentId) ?? PALETTE.neutral,
        yearsExperience: doc?.yearsExperience ?? 0,
        monthlyCaseCapacity: doc?.monthlyCaseCapacity ?? 0,
        encounters: row.encounters,
        inpatient: row.inpatient,
        grossCharges: row.grossCharges,
        revenuePerCase: row.encounters > 0 ? Math.round(row.grossCharges / row.encounters) : 0,
        avgLosDays: row.avgLosDays,
        capacityUtilization: row.capacityUtilization,
        codedEncounters: extra?.coded ?? 0,
        codedShare: row.encounters > 0 ? (extra?.coded ?? 0) / row.encounters : 0,
        claims: extra?.claims ?? 0,
        decidedClaims: decided,
        deniedClaims: extra?.denied ?? 0,
        denialRate: decided > 0 ? (extra?.denied ?? 0) / decided : 0,
        readmitEligible: eligible,
        readmissions: extra?.readmissions ?? 0,
        readmissionRate: eligible > 0 ? (extra?.readmissions ?? 0) / eligible : 0,
      } satisfies DoctorRow;
    });
}

/**
 * Both periods of the time-period comparison, per department, plus the
 * hospital-wide totals. Rate metrics are re-derived from their numerator and
 * denominator for the total row, because a per-encounter rate cannot be summed
 * across departments.
 */
function buildPeriodComparison(
  dataset: HospitalDataset,
  filterA: EncounterFilter,
  filterB: EncounterFilter,
  metric: PeriodMetricKey,
): { rows: PeriodRow[]; totalA: number; totalB: number } {
  const volumeA = volumeByDepartment(dataset, filterA);
  const volumeB = volumeByDepartment(dataset, filterB);
  const revenueA = revenueByDepartment(dataset, filterA);
  const revenueB = revenueByDepartment(dataset, filterB);
  const revenueAById = new Map(revenueA.map((r) => [r.departmentId, r]));
  const revenueBById = new Map(revenueB.map((r) => [r.departmentId, r]));
  const volumeBById = new Map(volumeB.map((r) => [r.departmentId, r]));

  const pick = (
    volumeRow: { encounters: number } | undefined,
    revenueRow:
      { grossCharges: number; amountPaid: number; revenuePerEncounter: number } | undefined,
  ): number => {
    if (metric === "encounters") return volumeRow?.encounters ?? 0;
    if (metric === "grossCharges") return revenueRow?.grossCharges ?? 0;
    if (metric === "amountPaid") return revenueRow?.amountPaid ?? 0;
    return revenueRow?.revenuePerEncounter ?? 0;
  };

  const totalFor = (
    volumeRows: readonly { encounters: number }[],
    revenueRows: readonly { grossCharges: number; amountPaid: number }[],
  ): number => {
    const encounters = sum(volumeRows, (r) => r.encounters);
    if (metric === "encounters") return encounters;
    if (metric === "grossCharges") return sum(revenueRows, (r) => r.grossCharges);
    if (metric === "amountPaid") return sum(revenueRows, (r) => r.amountPaid);
    const gross = sum(revenueRows, (r) => r.grossCharges);
    return encounters > 0 ? gross / encounters : 0;
  };

  const rows = volumeA
    .map((row) => {
      const a = pick(row, revenueAById.get(row.departmentId));
      const b = pick(volumeBById.get(row.departmentId), revenueBById.get(row.departmentId));
      return {
        departmentId: row.departmentId,
        department: row.department,
        color: row.color,
        a,
        b,
        deltaAbs: a - b,
        deltaPct: deltaPct(a, b),
      } satisfies PeriodRow;
    })
    .filter((row) => row.a > 0 || row.b > 0);

  return {
    rows,
    totalA: totalFor(volumeA, revenueA),
    totalB: totalFor(volumeB, revenueB),
  };
}

function toEncounterRecords(
  dataset: HospitalDataset,
  encounters: readonly Encounter[],
  focusServiceId: string | null,
): EncounterRecord[] {
  return encounters
    .map((enc) => {
      const patient = dataset.index.patientById.get(enc.patientId);
      const doctor = dataset.index.doctorById.get(enc.primaryDoctorId);
      const department = dataset.index.departmentById.get(enc.departmentId);
      const billing = dataset.index.billingByEncounterId.get(enc.id);
      const claim = dataset.index.claimByEncounterId.get(enc.id);
      let serviceAmount: number | null = null;
      if (focusServiceId !== null) {
        const lines = dataset.index.servicesByEncounterId.get(enc.id) ?? [];
        serviceAmount = Math.round(
          lines
            .filter((line) => line.serviceId === focusServiceId)
            .reduce((total, line) => total + line.lineTotal, 0),
        );
      }
      return {
        id: enc.id,
        admitDate: enc.admitDateTime.slice(0, 10),
        patient: patient?.name ?? enc.patientId,
        patientId: enc.patientId,
        department: department?.name ?? enc.departmentId,
        doctor: doctor?.name ?? enc.primaryDoctorId,
        encounterType: enc.encounterType,
        diagnosisCode: enc.diagnosisCode ?? "Uncoded",
        losDays: enc.losDays,
        disposition: enc.disposition,
        payerType: enc.payerType,
        grossCharges: Math.round(billing?.grossCharges ?? 0),
        balance: Math.round(billing?.balance ?? 0),
        paymentStatus: billing?.paymentStatus ?? "—",
        claimStatus: claim?.status ?? "No claim",
        serviceAmount,
      } satisfies EncounterRecord;
    })
    .sort((a, b) => b.grossCharges - a.grossCharges);
}

const ENCOUNTER_EXPORT_COLUMNS = [
  { header: "Encounter ID", get: (row: unknown) => (row as EncounterRecord).id },
  { header: "Admit date", get: (row: unknown) => (row as EncounterRecord).admitDate },
  { header: "Patient", get: (row: unknown) => (row as EncounterRecord).patient },
  { header: "Department", get: (row: unknown) => (row as EncounterRecord).department },
  { header: "Attending physician", get: (row: unknown) => (row as EncounterRecord).doctor },
  { header: "Encounter type", get: (row: unknown) => (row as EncounterRecord).encounterType },
  { header: "ICD-10", get: (row: unknown) => (row as EncounterRecord).diagnosisCode },
  { header: "LOS days", get: (row: unknown) => String((row as EncounterRecord).losDays) },
  { header: "Disposition", get: (row: unknown) => (row as EncounterRecord).disposition },
  { header: "Payer", get: (row: unknown) => (row as EncounterRecord).payerType },
  { header: "Gross charges", get: (row: unknown) => String((row as EncounterRecord).grossCharges) },
  { header: "Balance", get: (row: unknown) => String((row as EncounterRecord).balance) },
  { header: "Payment status", get: (row: unknown) => (row as EncounterRecord).paymentStatus },
  { header: "Claim status", get: (row: unknown) => (row as EncounterRecord).claimStatus },
  {
    header: "Service charge line",
    get: (row: unknown) => {
      const amount = (row as EncounterRecord).serviceAmount;
      return amount === null ? "" : String(amount);
    },
  },
];

/* ------------------------------------------------------------------ */
/* Chrome                                                              */
/* ------------------------------------------------------------------ */

function ControlSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  width = "w-[11.5rem]",
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  width?: string;
}) {
  return (
    <label className="inline-flex items-center gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
        {label}
      </span>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger className={cn("h-7 text-[11px]", width)} aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

/**
 * The sort affordance the audit found missing everywhere: a sort-by field plus
 * an explicit ascending/descending toggle, applied to the *chart*, not only to
 * the "view as table" mode.
 */
function SortControl<K extends string>({
  value,
  onChange,
  options,
  dir,
  onDirChange,
  width = "w-[13rem]",
}: {
  value: K;
  onChange: (value: K) => void;
  options: readonly { value: K; label: string }[];
  dir: SortDir;
  onDirChange: (dir: SortDir) => void;
  width?: string;
}) {
  return (
    <div className="inline-flex items-center gap-1">
      <ControlSelect
        label="Sort by"
        value={value}
        onChange={onChange}
        options={options}
        width={width}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1 px-2 text-[10px]"
        onClick={() => onDirChange(dir === "desc" ? "asc" : "desc")}
        aria-label={
          dir === "desc"
            ? "Sorted descending, switch to ascending"
            : "Sorted ascending, switch to descending"
        }
      >
        {dir === "desc" ? (
          <ArrowDownWideNarrow className="size-3" />
        ) : (
          <ArrowUpNarrowWide className="size-3" />
        )}
        {dir === "desc" ? "High → low" : "Low → high"}
      </Button>
    </div>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="flex h-56 items-center justify-center rounded-md border border-dashed border-border text-center text-xs text-text-muted">
      {label}
    </div>
  );
}

function BandLegend({
  metricLabel,
  higherIsBetter,
}: {
  metricLabel: string;
  higherIsBetter: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <LegendDot
        color={statusHex.good}
        label={higherIsBetter ? `Top third on ${metricLabel}` : `Best third on ${metricLabel}`}
      />
      <LegendDot color={statusHex.warning} label="Middle third" />
      <LegendDot
        color={statusHex.danger}
        label={higherIsBetter ? `Bottom third on ${metricLabel}` : `Worst third on ${metricLabel}`}
      />
    </div>
  );
}

/** Terminal drill tier shared by every drawer on this page. */
function EncounterSampleTable({
  records,
  serviceLabel,
  limit = 40,
}: {
  records: readonly EncounterRecord[];
  serviceLabel?: string;
  limit?: number;
}) {
  if (records.length === 0) {
    return <p className="text-xs text-text-muted">No encounters match this selection.</p>;
  }
  const shown = records.slice(0, limit);
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-text-muted">
        Showing {num(shown.length)} of {num(records.length)} encounters, largest bill first. Export
        CSV below returns all {num(records.length)}.
      </p>
      <div className="max-h-[24rem] overflow-y-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[11px]">Patient</TableHead>
              <TableHead className="text-[11px]">Attending</TableHead>
              <TableHead className="text-right text-[11px]">
                {serviceLabel ? "Service line" : "Gross"}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="text-xs">
                  <div className="font-medium text-text-primary">{record.patient}</div>
                  <div className="text-[10px] text-text-muted">
                    {record.admitDate} · {record.encounterType} · {record.diagnosisCode}
                    {record.losDays > 0 ? ` · LOS ${record.losDays}d` : ""} · {record.disposition}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-text-secondary">
                  <div>{record.doctor}</div>
                  <div className="text-[10px] text-text-muted">
                    {record.department} · {record.payerType} · {record.claimStatus}
                  </div>
                </TableCell>
                <TableCell className="text-right text-xs">
                  <div className="font-semibold text-text-primary">
                    {php(
                      serviceLabel && record.serviceAmount !== null
                        ? record.serviceAmount
                        : record.grossCharges,
                      { compact: true },
                    )}
                  </div>
                  <div className="text-[10px] text-text-muted">
                    {record.paymentStatus}
                    {record.balance > 0 ? ` · ${php(record.balance, { compact: true })} open` : ""}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tooltips                                                            */
/* ------------------------------------------------------------------ */

function DepartmentTooltip({
  active,
  payload,
  primary,
  secondary,
  colour,
}: {
  active?: boolean;
  payload?: RichTooltipPayloadEntry[];
  primary: MetricDef<DeptMetricKey>;
  secondary: MetricDef<DeptMetricKey>;
  colour: MetricDef<DeptMetricKey>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as unknown as DeptRow | undefined;
  if (!row) return null;
  return (
    <div className="max-w-[16rem] rounded-md bg-[#111] px-2.5 py-2 text-[11px] leading-relaxed text-white shadow-lg">
      <div className="text-xs font-bold">{row.department}</div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">{primary.label}</span>
        <span className="font-semibold">{primary.format(row[primary.key])}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">{secondary.label}</span>
        <span className="font-semibold">{secondary.format(row[secondary.key])}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">{colour.label} (bar colour)</span>
        <span className="font-semibold">{colour.format(row[colour.key])}</span>
      </div>
      <div className="mt-1 border-t border-white/15 pt-1 opacity-80">
        {ratePct(row.volumeShare)} of encounters · {ratePct(row.revenueShare)} of gross revenue
      </div>
      <div className="opacity-80">
        {num(row.npsResponses)} survey responses · {num(row.readmitEligible)} readmission-eligible
      </div>
      <div className="mt-1 text-[10px] italic opacity-70">Click the bar to drill down →</div>
    </div>
  );
}

function DoctorTooltip({
  active,
  payload,
  metric,
}: {
  active?: boolean;
  payload?: RichTooltipPayloadEntry[];
  metric: MetricDef<DoctorMetricKey>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as unknown as DoctorRow | undefined;
  if (!row) return null;
  return (
    <div className="max-w-[16rem] rounded-md bg-[#111] px-2.5 py-2 text-[11px] leading-relaxed text-white shadow-lg">
      <div className="text-xs font-bold">{row.doctor}</div>
      <div className="opacity-80">
        {row.department} · {num(row.yearsExperience)} yrs experience
      </div>
      <div className="mt-1 flex justify-between gap-3">
        <span className="opacity-80">{metric.label}</span>
        <span className="font-semibold">{metric.format(row[metric.key])}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Cases</span>
        <span className="font-semibold">
          {num(row.encounters)} ({num(row.inpatient)} inpatient)
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Gross revenue</span>
        <span className="font-semibold">{php(row.grossCharges, { compact: true })}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Revenue per case</span>
        <span className="font-semibold">{php(row.revenuePerCase, { compact: true })}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Capacity used</span>
        <span className="font-semibold">{ratePct(row.capacityUtilization)}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">ICD-10 coded</span>
        <span className="font-semibold">{ratePct(row.codedShare)}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Claim denials</span>
        <span className="font-semibold">
          {row.decidedClaims > 0
            ? `${ratePct(row.denialRate)} of ${num(row.decidedClaims)}`
            : "no decided claims"}
        </span>
      </div>
      <div className="mt-1 text-[10px] italic opacity-70">Click to drill down →</div>
    </div>
  );
}

function PeriodTooltip({
  active,
  payload,
  metric,
  labelA,
  labelB,
}: {
  active?: boolean;
  payload?: RichTooltipPayloadEntry[];
  metric: MetricDef<PeriodMetricKey>;
  labelA: string;
  labelB: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as unknown as PeriodRow | undefined;
  if (!row) return null;
  return (
    <div className="max-w-[16rem] rounded-md bg-[#111] px-2.5 py-2 text-[11px] leading-relaxed text-white shadow-lg">
      <div className="text-xs font-bold">{row.department}</div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">{labelA}</span>
        <span className="font-semibold">{metric.format(row.a)}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">{labelB}</span>
        <span className="font-semibold">{metric.format(row.b)}</span>
      </div>
      <div className="mt-1 border-t border-white/15 pt-1 flex justify-between gap-3">
        <span className="opacity-80">Change</span>
        <span className="font-semibold">{signed(row.deltaPct)}</span>
      </div>
      <div className="mt-1 text-[10px] italic opacity-70">Click to drill down →</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function PerformancePage() {
  const dataset = React.useMemo(() => getHospitalDataset(), []);
  const { filters, encounterFilter, isFiltered } = useHospitalFilters();

  const [drill, setDrill] = React.useState<Drill>(null);

  /* department comparison controls */
  const [deptPrimary, setDeptPrimary] = React.useState<DeptMetricKey>("encounters");
  const [deptSecondary, setDeptSecondary] = React.useState<DeptMetricKey>("grossCharges");
  const [deptColour, setDeptColour] = React.useState<DeptMetricKey>("nps");
  const [deptSortKey, setDeptSortKey] = React.useState<"primary" | "secondary" | "colour" | "name">(
    "primary",
  );
  const [deptSortDir, setDeptSortDir] = React.useState<SortDir>("desc");

  /* service controls */
  const [focusDepartment, setFocusDepartment] = React.useState<string>(ALL);
  const [serviceSortKey, setServiceSortKey] = React.useState<ServiceMetricKey | "name">("revenue");
  const [serviceSortDir, setServiceSortDir] = React.useState<SortDir>("desc");
  const [serviceTopN, setServiceTopN] = React.useState<"10" | "15" | "25" | "all">("15");

  /* doctor controls */
  const [doctorView, setDoctorView] = React.useState<"ranked" | "quadrant">("ranked");
  const [doctorMetricKey, setDoctorMetricKey] = React.useState<DoctorMetricKey>("encounters");
  const [doctorSortKey, setDoctorSortKey] = React.useState<DoctorMetricKey | "name">("encounters");
  const [doctorSortDir, setDoctorSortDir] = React.useState<SortDir>("desc");
  const [doctorMinCases, setDoctorMinCases] = React.useState<"0" | "5" | "10" | "20">("5");

  /* period controls */
  const [periodMetricKey, setPeriodMetricKey] = React.useState<PeriodMetricKey>("encounters");
  const [periodBasis, setPeriodBasis] = React.useState<"prior" | "months">("prior");
  const monthKeys = React.useMemo(() => dataset.months.map((m) => m.key), [dataset]);
  const [monthA, setMonthA] = React.useState<string>(() => monthKeys[monthKeys.length - 1] ?? "");
  const [monthB, setMonthB] = React.useState<string>(() => monthKeys[monthKeys.length - 2] ?? "");
  const [periodSortKey, setPeriodSortKey] = React.useState<
    "a" | "b" | "deltaAbs" | "deltaPct" | "name"
  >("deltaPct");
  const [periodSortDir, setPeriodSortDir] = React.useState<SortDir>("desc");

  /* ---------------- window arithmetic ---------------- */

  const windows = React.useMemo(() => {
    const firstMonth = dataset.months[0];
    const from = encounterFilter.from ?? firstMonth?.startDate ?? dataset.anchorDate;
    const to = encounterFilter.to ?? dataset.anchorDate;
    const days = spanDays(from, to);
    const priorTo = shiftDays(from, -1);
    const priorFrom = shiftDays(from, -days);
    const dimensionOnly: EncounterFilter = { ...encounterFilter };
    delete dimensionOnly.from;
    delete dimensionOnly.to;
    return {
      from,
      to,
      days,
      priorFrom,
      priorTo,
      period: encounterFilter,
      prior: { ...encounterFilter, from: priorFrom, to: priorTo } satisfies EncounterFilter,
      dimensionOnly,
    };
  }, [dataset, encounterFilter]);

  const periodLabel = `${fmtDay(windows.from)} – ${fmtDay(windows.to)}`;
  const priorLabel = `${fmtDay(windows.priorFrom)} – ${fmtDay(windows.priorTo)}`;

  /* ---------------- department comparison ---------------- */

  const deptRows = React.useMemo(
    () => buildDeptRows(dataset, encounterFilter),
    [dataset, encounterFilter],
  );
  const priorDeptRows = React.useMemo(
    () => buildDeptRows(dataset, windows.prior),
    [dataset, windows],
  );

  const primaryDef = deptMetric(deptPrimary);
  const secondaryDef = deptMetric(deptSecondary);
  const colourDef = deptMetric(deptColour);

  const deptBands = React.useMemo(
    () =>
      bandRows(
        deptRows,
        (r) => r[colourDef.key],
        colourDef.higherIsBetter,
        (r) => r.departmentId,
      ),
    [deptRows, colourDef],
  );

  const sortedDeptRows = React.useMemo(() => {
    if (deptSortKey === "name") return byName(deptRows, (r) => r.department, deptSortDir);
    const key =
      deptSortKey === "primary"
        ? primaryDef.key
        : deptSortKey === "secondary"
          ? secondaryDef.key
          : colourDef.key;
    return bySort(deptRows, (r) => r[key], deptSortDir);
  }, [deptRows, deptSortKey, deptSortDir, primaryDef, secondaryDef, colourDef]);

  const deptPrimaryMean =
    deptRows.length > 0 ? sum(deptRows, (r) => r[primaryDef.key]) / deptRows.length : 0;

  /**
   * Live-computed callout: which department's share of revenue diverges most
   * from its share of encounters. Recomputes on every filter change rather than
   * asserting a fixed sentence.
   */
  const divergence = React.useMemo(() => {
    if (deptRows.length < 2) return null;
    let worst = deptRows[0] as DeptRow;
    for (const row of deptRows) {
      if (
        Math.abs(row.revenueShare - row.volumeShare) >
        Math.abs(worst.revenueShare - worst.volumeShare)
      ) {
        worst = row;
      }
    }
    const gap = worst.revenueShare - worst.volumeShare;
    if (Math.abs(gap) < 0.01) return null;
    return { row: worst, gap };
  }, [deptRows]);

  /* ---------------- service utilization ---------------- */

  const serviceFilter = React.useMemo<EncounterFilter>(() => {
    if (focusDepartment === ALL) return encounterFilter;
    return { ...encounterFilter, departmentIds: [focusDepartment] };
  }, [encounterFilter, focusDepartment]);

  const serviceRows = React.useMemo(
    () => serviceUtilization(dataset, serviceFilter),
    [dataset, serviceFilter],
  );

  const serviceDef = serviceMetric(
    serviceSortKey === "name" ? "revenue" : (serviceSortKey as ServiceMetricKey),
  );

  const sortedServiceRows = React.useMemo(() => {
    const sorted =
      serviceSortKey === "name"
        ? byName(serviceRows, (r) => r.service, serviceSortDir)
        : bySort(serviceRows, (r) => r[serviceSortKey], serviceSortDir);
    if (serviceTopN === "all") return sorted;
    return sorted.slice(0, Number(serviceTopN));
  }, [serviceRows, serviceSortKey, serviceSortDir, serviceTopN]);

  const serviceBands = React.useMemo(
    () =>
      bandRows(
        sortedServiceRows,
        (r) => r.revenuePerEncounter,
        true,
        (r) => r.serviceId,
      ),
    [sortedServiceRows],
  );

  const serviceTotals = React.useMemo(
    () => ({
      services: serviceRows.length,
      revenue: sum(serviceRows, (r) => r.revenue),
      units: sum(serviceRows, (r) => r.units),
      shown: sum(sortedServiceRows, (r) => r.revenue),
    }),
    [serviceRows, sortedServiceRows],
  );

  /* ---------------- doctor comparison ---------------- */

  /** Department colours, resolved once — physicians borrow their department's. */
  const departmentColors = React.useMemo(
    () => new Map(volumeByDepartment(dataset).map((r) => [r.departmentId, r.color])),
    [dataset],
  );

  const allDoctorRows = React.useMemo(
    () => buildDoctorRows(dataset, encounterFilter, departmentColors),
    [dataset, encounterFilter, departmentColors],
  );

  const doctorRows = React.useMemo(
    () => allDoctorRows.filter((row) => row.encounters >= Number(doctorMinCases)),
    [allDoctorRows, doctorMinCases],
  );

  const doctorDef = doctorMetric(doctorMetricKey);

  const sortedDoctorRows = React.useMemo(() => {
    if (doctorSortKey === "name") return byName(doctorRows, (r) => r.doctor, doctorSortDir);
    return bySort(doctorRows, (r) => r[doctorSortKey], doctorSortDir);
  }, [doctorRows, doctorSortKey, doctorSortDir]);

  const doctorMedians = React.useMemo(
    () => ({
      cases: median(doctorRows.map((r) => r.encounters)),
      revenue: median(doctorRows.map((r) => r.grossCharges)),
    }),
    [doctorRows],
  );

  const doctorBands = React.useMemo(
    () =>
      bandRows(
        doctorRows,
        (r) => r[doctorDef.key],
        doctorDef.higherIsBetter,
        (r) => r.doctorId,
      ),
    [doctorRows, doctorDef],
  );

  /* ---------------- period comparison ---------------- */

  const monthById = React.useMemo(() => new Map(dataset.months.map((m) => [m.key, m])), [dataset]);

  const periodWindows = React.useMemo(() => {
    if (periodBasis === "prior") {
      return {
        a: windows.period,
        b: windows.prior,
        labelA: `Filtered range (${periodLabel})`,
        labelB: `Prior ${windows.days} days (${priorLabel})`,
        shortA: "Filtered range",
        shortB: "Prior period",
        partial: false,
      };
    }
    const metaA = monthById.get(monthA);
    const metaB = monthById.get(monthB);
    const a: EncounterFilter = {
      ...windows.dimensionOnly,
      from: metaA?.startDate ?? windows.from,
      to: metaA?.endDate ?? windows.to,
    };
    const b: EncounterFilter = {
      ...windows.dimensionOnly,
      from: metaB?.startDate ?? windows.from,
      to: metaB?.endDate ?? windows.to,
    };
    return {
      a,
      b,
      labelA: metaA?.label ?? monthA,
      labelB: metaB?.label ?? monthB,
      shortA: metaA?.label ?? monthA,
      shortB: metaB?.label ?? monthB,
      partial: Boolean(metaA?.isPartial || metaB?.isPartial),
    };
  }, [periodBasis, windows, periodLabel, priorLabel, monthById, monthA, monthB]);

  const periodDef = periodMetric(periodMetricKey);

  const periodComparison = React.useMemo(
    () => buildPeriodComparison(dataset, periodWindows.a, periodWindows.b, periodMetricKey),
    [dataset, periodWindows, periodMetricKey],
  );
  const periodRows = periodComparison.rows;

  const sortedPeriodRows = React.useMemo(() => {
    if (periodSortKey === "name") return byName(periodRows, (r) => r.department, periodSortDir);
    return bySort(periodRows, (r) => r[periodSortKey], periodSortDir);
  }, [periodRows, periodSortKey, periodSortDir]);

  const periodTotals = {
    a: periodComparison.totalA,
    b: periodComparison.totalB,
    deltaPct: deltaPct(periodComparison.totalA, periodComparison.totalB),
  };

  /* ---------------- KPI strip ---------------- */

  const totals = React.useMemo(() => {
    const encounters = sum(deptRows, (r) => r.encounters);
    const gross = sum(deptRows, (r) => r.grossCharges);
    const paid = sum(deptRows, (r) => r.amountPaid);
    const net = sum(deptRows, (r) => r.netPayable);
    const priorEncounters = sum(priorDeptRows, (r) => r.encounters);
    const priorGross = sum(priorDeptRows, (r) => r.grossCharges);
    const priorPerEncounter = priorEncounters > 0 ? priorGross / priorEncounters : 0;
    return {
      encounters,
      gross,
      paid,
      net,
      perEncounter: encounters > 0 ? gross / encounters : 0,
      collectionRate: net > 0 ? paid / net : 0,
      deltaEncounters: deltaPct(encounters, priorEncounters),
      deltaGross: deltaPct(gross, priorGross),
      deltaPerEncounter: deltaPct(encounters > 0 ? gross / encounters : 0, priorPerEncounter),
    };
  }, [deptRows, priorDeptRows]);

  const topDept = React.useMemo(
    () =>
      deptRows.length > 0
        ? [...deptRows].sort((a, b) => b.grossCharges - a.grossCharges)[0]
        : undefined,
    [deptRows],
  );

  const topDoctor = React.useMemo(
    () =>
      allDoctorRows.length > 0
        ? [...allDoctorRows].sort((a, b) => b.encounters - a.encounters)[0]
        : undefined,
    [allDoctorRows],
  );

  /* ---------------- drill payload ---------------- */

  const drillPayload = React.useMemo(() => {
    if (drill === null) return null;

    if (drill.kind === "department" || drill.kind === "period") {
      const row = deptRows.find((r) => r.departmentId === drill.departmentId);
      const baseFilter = drill.kind === "period" ? periodWindows.a : encounterFilter;
      const encounters = filterEncounters(dataset, {
        ...baseFilter,
        departmentIds: [drill.departmentId],
      });
      const name =
        row?.department ??
        dataset.index.departmentById.get(drill.departmentId)?.name ??
        drill.departmentId;
      return {
        title: `${name} — department detail`,
        value: `${num(encounters.length)} encounters`,
        rows: toEncounterRecords(dataset, encounters, null),
        deptRow: row,
      };
    }

    if (drill.kind === "service") {
      const row = serviceRows.find((r) => r.serviceId === drill.serviceId);
      const encounters = filterEncounters(dataset, {
        ...serviceFilter,
        serviceIds: [drill.serviceId],
      });
      const name =
        row?.service ?? dataset.index.serviceById.get(drill.serviceId)?.name ?? drill.serviceId;
      return {
        title: `${name} — service detail`,
        value: row ? php(row.revenue, { compact: true }) : `${num(encounters.length)} encounters`,
        rows: toEncounterRecords(dataset, encounters, drill.serviceId),
        serviceRow: row,
      };
    }

    const row = allDoctorRows.find((r) => r.doctorId === drill.doctorId);
    const encounters = filterEncounters(dataset, {
      ...encounterFilter,
      doctorIds: [drill.doctorId],
    });
    const name =
      row?.doctor ?? dataset.index.doctorById.get(drill.doctorId)?.name ?? drill.doctorId;
    return {
      title: `${name} — physician detail`,
      value: `${num(encounters.length)} cases`,
      rows: toEncounterRecords(dataset, encounters, null),
      doctorRow: row,
    };
  }, [
    drill,
    dataset,
    deptRows,
    serviceRows,
    allDoctorRows,
    encounterFilter,
    serviceFilter,
    periodWindows,
  ]);

  const drillPeriodRow =
    drill?.kind === "period"
      ? periodRows.find((r) => r.departmentId === drill.departmentId)
      : undefined;

  /* ---------------- table configs ---------------- */

  const deptTableColumns: ReportColumn<DeptRow>[] = [
    { key: "department", header: "Department", sortable: true },
    {
      key: "encounters",
      header: "Encounters",
      align: "right",
      sortable: true,
      render: (r) => num(r.encounters),
    },
    {
      key: "inpatient",
      header: "Inpatient",
      align: "right",
      sortable: true,
      render: (r) => num(r.inpatient),
    },
    {
      key: "grossCharges",
      header: "Gross revenue",
      align: "right",
      sortable: true,
      render: (r) => php(r.grossCharges, { compact: true }),
    },
    {
      key: "revenuePerEncounter",
      header: "PHP / encounter",
      align: "right",
      sortable: true,
      render: (r) => php(r.revenuePerEncounter, { compact: true }),
    },
    {
      key: "collectionRate",
      header: "Collected",
      align: "right",
      sortable: true,
      render: (r) => ratePct(r.collectionRate),
    },
    {
      key: "meanLosDays",
      header: "Mean LOS (d)",
      align: "right",
      sortable: true,
      render: (r) => r.meanLosDays.toFixed(1),
    },
    {
      key: "nps",
      header: "NPS",
      align: "right",
      sortable: true,
      render: (r) => (r.npsResponses > 0 ? `${r.nps > 0 ? "+" : ""}${r.nps}` : "—"),
    },
    {
      key: "readmissionRate",
      header: "Readmit %",
      align: "right",
      sortable: true,
      render: (r) => (r.readmitEligible > 0 ? ratePct(r.readmissionRate) : "—"),
    },
  ];

  const serviceTableColumns: ReportColumn<ServiceUtilizationRow>[] = [
    { key: "service", header: "Service", sortable: true },
    { key: "category", header: "Category", sortable: true },
    { key: "department", header: "Cost centre", sortable: true },
    {
      key: "encounters",
      header: "Encounters",
      align: "right",
      sortable: true,
      render: (r) => num(r.encounters),
    },
    { key: "units", header: "Units", align: "right", sortable: true, render: (r) => num(r.units) },
    {
      key: "revenue",
      header: "Revenue",
      align: "right",
      sortable: true,
      render: (r) => php(r.revenue, { compact: true }),
    },
    {
      key: "revenuePerEncounter",
      header: "PHP / encounter",
      align: "right",
      sortable: true,
      render: (r) => php(r.revenuePerEncounter, { compact: true }),
    },
    {
      key: "share",
      header: "Share",
      align: "right",
      sortable: true,
      render: (r) => ratePct(r.share, 2),
    },
  ];

  const doctorTableColumns: ReportColumn<DoctorRow>[] = [
    { key: "doctor", header: "Physician", sortable: true },
    { key: "department", header: "Department", sortable: true },
    {
      key: "encounters",
      header: "Cases",
      align: "right",
      sortable: true,
      render: (r) => num(r.encounters),
    },
    {
      key: "inpatient",
      header: "Inpatient",
      align: "right",
      sortable: true,
      render: (r) => num(r.inpatient),
    },
    {
      key: "grossCharges",
      header: "Gross revenue",
      align: "right",
      sortable: true,
      render: (r) => php(r.grossCharges, { compact: true }),
    },
    {
      key: "revenuePerCase",
      header: "PHP / case",
      align: "right",
      sortable: true,
      render: (r) => php(r.revenuePerCase, { compact: true }),
    },
    {
      key: "capacityUtilization",
      header: "Capacity",
      align: "right",
      sortable: true,
      render: (r) => ratePct(r.capacityUtilization),
    },
    {
      key: "avgLosDays",
      header: "Mean LOS (d)",
      align: "right",
      sortable: true,
      render: (r) => (r.inpatient > 0 ? r.avgLosDays.toFixed(1) : "—"),
    },
    {
      key: "codedShare",
      header: "ICD-10 coded",
      align: "right",
      sortable: true,
      render: (r) => ratePct(r.codedShare),
    },
    {
      key: "denialRate",
      header: "Denial rate",
      align: "right",
      sortable: true,
      render: (r) => (r.decidedClaims > 0 ? ratePct(r.denialRate) : "—"),
    },
    {
      key: "readmissionRate",
      header: "Readmit %",
      align: "right",
      sortable: true,
      render: (r) => (r.readmitEligible > 0 ? ratePct(r.readmissionRate) : "—"),
    },
  ];

  const periodTableColumns: ReportColumn<PeriodRow>[] = [
    { key: "department", header: "Department", sortable: true },
    {
      key: "a",
      header: periodWindows.shortA,
      align: "right",
      sortable: true,
      render: (r) => periodDef.format(r.a),
    },
    {
      key: "b",
      header: periodWindows.shortB,
      align: "right",
      sortable: true,
      render: (r) => periodDef.format(r.b),
    },
    {
      key: "deltaAbs",
      header: "Absolute change",
      align: "right",
      sortable: true,
      render: (r) => `${r.deltaAbs >= 0 ? "+" : ""}${periodDef.format(Math.abs(r.deltaAbs))}`,
    },
    {
      key: "deltaPct",
      header: "% change",
      align: "right",
      sortable: true,
      render: (r) => (
        <span className={cn(r.deltaPct >= 0 ? "text-success" : "text-danger")}>
          {signed(r.deltaPct)}
        </span>
      ),
    },
  ];

  const serviceChartHeight = Math.max(300, sortedServiceRows.length * 26 + 70);
  const doctorChartHeight = Math.max(320, sortedDoctorRows.length * 22 + 70);

  /* ---------------- render ---------------- */

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Performance Analysis"
        description="Tier 2 — comparison. Rank departments, services, physicians and time periods against each other; every panel sorts ascending or descending on the metric you pick."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {isFiltered ? <StatusBadge tone="neutral">Global filters active</StatusBadge> : null}
            <StatusBadge tone="gold">{num(totals.encounters)} encounters in scope</StatusBadge>
          </div>
        }
      />

      <GlobalHospitalFilterBar />

      <p className="text-[11px] text-text-muted">
        Scope: <span className="font-medium text-text-secondary">{filters.dateRange.label}</span> —{" "}
        {periodLabel} ({num(windows.days)} days) · compared against the immediately preceding{" "}
        {num(windows.days)} days ({priorLabel}) wherever a delta is shown. Every panel reads the
        shared hospital dataset through its derive layer, so these figures reconcile with the
        Overview, Financial and Patient/Experience pages.
      </p>

      <KpiStrip>
        <MetricCard
          label="Encounters"
          value={num(totals.encounters)}
          delta={totals.deltaEncounters}
          secondary={`${(totals.encounters / windows.days).toFixed(1)} per day · ${num(deptRows.length)} departments active`}
          icon={Building2}
          note="Volume across every department in scope"
        />
        <MetricCard
          label="Gross revenue"
          value={php(totals.gross, { compact: true })}
          delta={totals.deltaGross}
          secondary={`${ratePct(totals.collectionRate)} of ${php(totals.net, { compact: true })} net payable collected`}
          icon={Layers}
          note="Sum of billed charges on encounters in scope"
        />
        <MetricCard
          label="Revenue per encounter"
          value={php(totals.perEncounter, { compact: true })}
          delta={totals.deltaPerEncounter}
          secondary="Gross charges ÷ encounters — the comparison denominator"
          icon={CalendarRange}
          note="Use this, not gross revenue, to compare unequal-sized departments"
        />
        <MetricCard
          label="Busiest physician"
          value={topDoctor ? num(topDoctor.encounters) : "n/a"}
          secondary={
            topDoctor
              ? `${topDoctor.doctor} · ${topDoctor.department} · ${ratePct(topDoctor.capacityUtilization)} of capacity`
              : "No physician has cases in scope"
          }
          status={topDoctor && topDoctor.capacityUtilization > 1 ? "warning" : "neutral"}
          icon={Stethoscope}
          {...(topDoctor
            ? { onClick: () => setDrill({ kind: "doctor", doctorId: topDoctor.doctorId }) }
            : {})}
          note="Cases handled as attending physician"
        />
      </KpiStrip>

      {/* ---------------------------------------------------------------- */}
      {/* 1. Department comparison                                         */}
      {/* ---------------------------------------------------------------- */}
      <InteractiveChartCard<DeptRow>
        title="Department comparison — volume, revenue and a quality axis in one view"
        description={`Bars: ${primaryDef.label} (left axis). Line: ${secondaryDef.label} (right axis). Bar colour: ${colourDef.label} banded into thirds across the ${num(deptRows.length)} departments in scope. The dashed line is the mean ${primaryDef.label.toLowerCase()} across those departments.`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ControlSelect
              label="Bars"
              value={deptPrimary}
              onChange={setDeptPrimary}
              width="w-[12.5rem]"
              options={DEPT_METRICS.map((m) => ({ value: m.key, label: m.label }))}
            />
            <ControlSelect
              label="Line"
              value={deptSecondary}
              onChange={setDeptSecondary}
              width="w-[12.5rem]"
              options={DEPT_METRICS.map((m) => ({ value: m.key, label: m.label }))}
            />
            <ControlSelect
              label="Colour"
              value={deptColour}
              onChange={setDeptColour}
              width="w-[12.5rem]"
              options={DEPT_METRICS.map((m) => ({ value: m.key, label: m.label }))}
            />
            <SortControl
              value={deptSortKey}
              onChange={setDeptSortKey}
              dir={deptSortDir}
              onDirChange={setDeptSortDir}
              width="w-[12rem]"
              options={[
                { value: "primary", label: `Bar metric — ${primaryDef.label}` },
                { value: "secondary", label: `Line metric — ${secondaryDef.label}` },
                { value: "colour", label: `Colour metric — ${colourDef.label}` },
                { value: "name", label: "Department name" },
              ]}
            />
          </div>
        }
        table={{ columns: deptTableColumns, rows: sortedDeptRows }}
        onRowClickInTable={(row) =>
          setDrill({ kind: "department", departmentId: row.departmentId })
        }
      >
        {sortedDeptRows.length === 0 ? (
          <EmptyPanel label="No department has encounters in the current filter window." />
        ) : (
          <>
            <div className="h-[23rem]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={sortedDeptRows}
                  margin={{ top: 8, right: 20, bottom: 56, left: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.35} />
                  <XAxis
                    dataKey="department"
                    tick={{ fontSize: 10 }}
                    interval={0}
                    angle={-28}
                    textAnchor="end"
                    height={64}
                  />
                  <YAxis
                    yAxisId="primary"
                    tick={{ fontSize: 10 }}
                    tickFormatter={primaryDef.tick}
                    label={{
                      value: primaryDef.axis,
                      angle: -90,
                      position: "insideLeft",
                      style: { fontSize: 10 },
                    }}
                  />
                  <YAxis
                    yAxisId="secondary"
                    orientation="right"
                    tick={{ fontSize: 10 }}
                    tickFormatter={secondaryDef.tick}
                    label={{
                      value: secondaryDef.axis,
                      angle: 90,
                      position: "insideRight",
                      style: { fontSize: 10 },
                    }}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(68,84,195,0.06)" }}
                    content={
                      <DepartmentTooltip
                        primary={primaryDef}
                        secondary={secondaryDef}
                        colour={colourDef}
                      />
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine
                    yAxisId="primary"
                    y={deptPrimaryMean}
                    stroke={PALETTE.neutral}
                    strokeDasharray="4 4"
                    label={{
                      value: `Mean ${primaryDef.tick(deptPrimaryMean)}`,
                      position: "insideTopLeft",
                      style: { fontSize: 9, fill: PALETTE.neutral },
                    }}
                  />
                  <Bar
                    yAxisId="primary"
                    dataKey={primaryDef.key}
                    name={primaryDef.label}
                    radius={[3, 3, 0, 0]}
                    cursor="pointer"
                    onClick={(entry: unknown) => {
                      const row = entry as { payload?: DeptRow } & Partial<DeptRow>;
                      const departmentId = row.payload?.departmentId ?? row.departmentId;
                      if (departmentId) setDrill({ kind: "department", departmentId });
                    }}
                  >
                    {sortedDeptRows.map((row) => (
                      <Cell
                        key={row.departmentId}
                        fill={statusHex[deptBands.get(row.departmentId) ?? "neutral"]}
                      />
                    ))}
                  </Bar>
                  <Line
                    yAxisId="secondary"
                    type="monotone"
                    dataKey={secondaryDef.key}
                    name={secondaryDef.label}
                    stroke={PALETTE.brand}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1.5">
              <BandLegend metricLabel={colourDef.label} higherIsBetter={colourDef.higherIsBetter} />
              <p className="text-[11px] text-text-muted">
                Bar colour carries a third variable, not a restatement of bar height — a tall bar in
                red is a high-volume department performing badly on {colourDef.label.toLowerCase()}.
                Click any bar to open that department&apos;s encounters.
              </p>
              {divergence ? (
                <p className="rounded-md border border-brand/25 bg-brand/5 px-2.5 py-1.5 text-[11px] text-text-secondary">
                  <span className="font-semibold text-text-primary">
                    {divergence.row.department}
                  </span>{" "}
                  takes {ratePct(divergence.row.volumeShare)} of encounters but{" "}
                  {ratePct(divergence.row.revenueShare)} of gross revenue — a{" "}
                  {signed(divergence.gap * 100)} divergence, the widest in this window at{" "}
                  {php(divergence.row.revenuePerEncounter, { compact: true })} per encounter against
                  a hospital average of {php(totals.perEncounter, { compact: true })}.
                </p>
              ) : null}
            </div>
          </>
        )}
      </InteractiveChartCard>

      {/* ---------------------------------------------------------------- */}
      {/* 2. Service utilization within department                         */}
      {/* ---------------------------------------------------------------- */}
      <InteractiveChartCard<ServiceUtilizationRow>
        title="Service utilisation within department"
        description={`Chargemaster services consumed by the selected patient cohort, ranked on ${serviceSortKey === "name" ? "service name" : serviceDef.label.toLowerCase()}. Bar colour bands revenue per encounter, so a long bar in red is high total spend spread thinly. ${num(serviceTotals.services)} services in scope; the ${sortedServiceRows.length} shown carry ${ratePct(serviceTotals.revenue > 0 ? serviceTotals.shown / serviceTotals.revenue : 0)} of ${php(serviceTotals.revenue, { compact: true })} charge-line revenue.`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ControlSelect
              label="Department"
              value={focusDepartment}
              onChange={setFocusDepartment}
              width="w-[13rem]"
              options={[
                { value: ALL, label: "Follow global filter" },
                ...dataset.departments.map((d) => ({ value: d.id, label: d.name as string })),
              ]}
            />
            <ControlSelect
              label="Show"
              value={serviceTopN}
              onChange={setServiceTopN}
              width="w-[7.5rem]"
              options={[
                { value: "10", label: "Top 10" },
                { value: "15", label: "Top 15" },
                { value: "25", label: "Top 25" },
                { value: "all", label: "All services" },
              ]}
            />
            <SortControl
              value={serviceSortKey}
              onChange={setServiceSortKey}
              dir={serviceSortDir}
              onDirChange={setServiceSortDir}
              width="w-[13rem]"
              options={[
                ...SERVICE_METRICS.map((m) => ({
                  value: m.key as ServiceMetricKey | "name",
                  label: m.label,
                })),
                { value: "name" as const, label: "Service name" },
              ]}
            />
          </div>
        }
        table={{ columns: serviceTableColumns, rows: sortedServiceRows }}
        onRowClickInTable={(row) => setDrill({ kind: "service", serviceId: row.serviceId })}
      >
        {sortedServiceRows.length === 0 ? (
          <EmptyPanel label="No charge lines match the current filters." />
        ) : (
          <>
            <div style={{ height: serviceChartHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={sortedServiceRows}
                  margin={{ top: 8, right: 28, bottom: 32, left: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.35} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10 }}
                    tickFormatter={serviceDef.tick}
                    label={{
                      value: serviceDef.axis,
                      position: "insideBottom",
                      offset: -12,
                      style: { fontSize: 10 },
                    }}
                  />
                  <YAxis
                    type="category"
                    dataKey="service"
                    tick={{ fontSize: 10 }}
                    width={168}
                    interval={0}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(68,84,195,0.06)" }}
                    content={
                      <RichTooltip
                        valueFormatter={(v) => serviceDef.format(v)}
                        getTarget={(entry) => {
                          const row = entry as unknown as ServiceUtilizationRow | undefined;
                          return row ? row.revenuePerEncounter : undefined;
                        }}
                        targetLabel="PHP per encounter"
                      />
                    }
                  />
                  <Bar
                    dataKey={serviceSortKey === "name" ? "revenue" : serviceSortKey}
                    name={serviceDef.label}
                    radius={[0, 3, 3, 0]}
                    cursor="pointer"
                    onClick={(entry: unknown) => {
                      const row = entry as { payload?: ServiceUtilizationRow } & {
                        serviceId?: string;
                      };
                      const serviceId = row.payload?.serviceId ?? row.serviceId;
                      if (serviceId) setDrill({ kind: "service", serviceId });
                    }}
                  >
                    {sortedServiceRows.map((row) => (
                      <Cell
                        key={row.serviceId}
                        fill={statusHex[serviceBands.get(row.serviceId) ?? "neutral"]}
                      />
                    ))}
                    <LabelList
                      dataKey={serviceSortKey === "name" ? "revenue" : serviceSortKey}
                      position="right"
                      style={{ fontSize: 9, fill: "currentColor" }}
                      formatter={(value: number) => serviceDef.tick(value)}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1.5">
              <BandLegend metricLabel="revenue per encounter" higherIsBetter />
              <p className="text-[11px] text-text-muted">
                Cohort semantics: the department selector picks the *patients*, then every charge
                line on their encounters is counted — including ancillary lab and imaging owned by
                another cost centre. That is the department → service question, and it is why the
                &ldquo;Cost centre&rdquo; column in the table view can differ from the department
                you selected. Click a bar to list the encounters that carried the service.
              </p>
            </div>
          </>
        )}
      </InteractiveChartCard>

      {/* ---------------------------------------------------------------- */}
      {/* 3. Doctor comparison                                             */}
      {/* ---------------------------------------------------------------- */}
      <InteractiveChartCard<DoctorRow>
        title="Physician comparison — volume, revenue and compliance"
        description={
          doctorView === "ranked"
            ? `${num(sortedDoctorRows.length)} physicians with at least ${doctorMinCases} case(s) in scope, ranked on ${doctorSortKey === "name" ? "name" : doctorMetric(doctorSortKey).label.toLowerCase()}. Bar length is ${doctorDef.label.toLowerCase()}; colour bands the same metric into thirds.`
            : `Productivity quadrant: cases (x) against gross revenue (y), bubble size = capacity utilisation. Reference lines sit at the median of each axis, so the top-right quadrant is high-volume and high-revenue, and bottom-right is volume that is not converting into revenue.`
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-md border border-border p-0.5">
              {(["ranked", "quadrant"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setDoctorView(v)}
                  className={cn(
                    "rounded px-2 py-1 text-[10px] font-medium transition-colors",
                    doctorView === v
                      ? "bg-brand text-brand-foreground"
                      : "text-text-muted hover:text-text-primary",
                  )}
                >
                  {v === "ranked" ? "Ranked bars" : "Quadrant"}
                </button>
              ))}
            </div>
            <ControlSelect
              label="Min cases"
              value={doctorMinCases}
              onChange={setDoctorMinCases}
              width="w-[7rem]"
              options={[
                { value: "0", label: "No floor" },
                { value: "5", label: "≥ 5 cases" },
                { value: "10", label: "≥ 10 cases" },
                { value: "20", label: "≥ 20 cases" },
              ]}
            />
            {doctorView === "ranked" ? (
              <ControlSelect
                label="Bars"
                value={doctorMetricKey}
                onChange={setDoctorMetricKey}
                width="w-[14rem]"
                options={DOCTOR_METRICS.map((m) => ({ value: m.key, label: m.label }))}
              />
            ) : null}
            <SortControl
              value={doctorSortKey}
              onChange={setDoctorSortKey}
              dir={doctorSortDir}
              onDirChange={setDoctorSortDir}
              width="w-[14rem]"
              options={[
                ...DOCTOR_METRICS.map((m) => ({
                  value: m.key as DoctorMetricKey | "name",
                  label: m.label,
                })),
                { value: "name" as const, label: "Physician name" },
              ]}
            />
          </div>
        }
        table={{ columns: doctorTableColumns, rows: sortedDoctorRows }}
        onRowClickInTable={(row) => setDrill({ kind: "doctor", doctorId: row.doctorId })}
      >
        {sortedDoctorRows.length === 0 ? (
          <EmptyPanel label="No physician clears the minimum case floor in this window. Lower the floor or widen the date range." />
        ) : doctorView === "ranked" ? (
          <>
            <div style={{ height: doctorChartHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={sortedDoctorRows}
                  margin={{ top: 8, right: 24, bottom: 34, left: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.35} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10 }}
                    tickFormatter={doctorDef.tick}
                    label={{
                      value: doctorDef.axis,
                      position: "insideBottom",
                      offset: -12,
                      style: { fontSize: 10 },
                    }}
                  />
                  <YAxis
                    type="category"
                    dataKey="doctor"
                    tick={{ fontSize: 10 }}
                    width={150}
                    interval={0}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(68,84,195,0.06)" }}
                    content={<DoctorTooltip metric={doctorDef} />}
                  />
                  <ReferenceLine
                    x={median(sortedDoctorRows.map((r) => r[doctorDef.key]))}
                    stroke={PALETTE.neutral}
                    strokeDasharray="4 4"
                    label={{
                      value: `median ${doctorDef.tick(median(sortedDoctorRows.map((r) => r[doctorDef.key])))}`,
                      position: "top",
                      style: { fontSize: 9, fill: PALETTE.neutral },
                    }}
                  />
                  <Bar
                    dataKey={doctorDef.key}
                    name={doctorDef.label}
                    radius={[0, 3, 3, 0]}
                    cursor="pointer"
                    onClick={(entry: unknown) => {
                      const row = entry as { payload?: DoctorRow } & { doctorId?: string };
                      const doctorId = row.payload?.doctorId ?? row.doctorId;
                      if (doctorId) setDrill({ kind: "doctor", doctorId });
                    }}
                  >
                    {sortedDoctorRows.map((row) => (
                      <Cell
                        key={row.doctorId}
                        fill={statusHex[doctorBands.get(row.doctorId) ?? "neutral"]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1.5">
              <BandLegend metricLabel={doctorDef.label} higherIsBetter={doctorDef.higherIsBetter} />
              <p className="text-[11px] text-text-muted">
                Sorting and the bar metric are independent, so you can rank physicians by case
                volume while colouring and measuring them on denial rate. Capacity utilisation,
                ICD-10 coding completeness and PhilHealth denial rate are the compliance signals
                available for this cohort. Click a bar for the physician&apos;s case list.
              </p>
            </div>
          </>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={360}>
              <ScatterChart margin={{ left: 8, right: 28, top: 16, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
                <XAxis
                  type="number"
                  dataKey="encounters"
                  name="Cases"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  label={{
                    value: "Cases handled (count)",
                    position: "insideBottom",
                    offset: -10,
                    style: { fontSize: 10 },
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="grossCharges"
                  name="Gross revenue"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  width={64}
                  tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(1)}M`}
                  label={{
                    value: "Gross revenue (PHP)",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 10 },
                  }}
                />
                <ZAxis
                  type="number"
                  dataKey="capacityUtilization"
                  range={[60, 460]}
                  name="Capacity utilisation"
                />
                <ReferenceLine
                  x={doctorMedians.cases}
                  stroke={PALETTE.neutral}
                  strokeDasharray="4 3"
                  label={{ value: "median cases", style: { fontSize: 9 }, position: "top" }}
                />
                <ReferenceLine
                  y={doctorMedians.revenue}
                  stroke={PALETTE.neutral}
                  strokeDasharray="4 3"
                  label={{ value: "median revenue", style: { fontSize: 9 }, position: "right" }}
                />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={<DoctorTooltip metric={doctorDef} />}
                />
                <Scatter
                  data={sortedDoctorRows}
                  onClick={(entry: unknown) => {
                    const id = (entry as { doctorId?: string }).doctorId;
                    if (id) setDrill({ kind: "doctor", doctorId: id });
                  }}
                >
                  {sortedDoctorRows.map((row) => (
                    <Cell key={row.doctorId} fill={row.color} className="cursor-pointer" />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            <p className="mt-2 text-[11px] text-text-muted">
              Bubble colour is the physician&apos;s department; bubble size is capacity utilisation
              (cases per month against the rostered monthly capacity), so a large bubble bottom-left
              is a physician who is fully booked yet producing below-median revenue. Sorting still
              applies — it drives the table view and the ranked-bar view of the same cohort.
            </p>
          </>
        )}
      </InteractiveChartCard>

      {/* ---------------------------------------------------------------- */}
      {/* 4. Time-period comparison                                        */}
      {/* ---------------------------------------------------------------- */}
      <InteractiveChartCard<PeriodRow>
        title="Time-period comparison by department"
        description={`${periodDef.label} for ${periodWindows.labelA} against ${periodWindows.labelB}, per department. Hospital-wide: ${periodDef.format(periodTotals.a)} vs ${periodDef.format(periodTotals.b)} (${signed(periodTotals.deltaPct)}).`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ControlSelect
              label="Metric"
              value={periodMetricKey}
              onChange={setPeriodMetricKey}
              width="w-[12.5rem]"
              options={PERIOD_METRICS.map((m) => ({ value: m.key, label: m.label }))}
            />
            <ControlSelect
              label="Compare"
              value={periodBasis}
              onChange={setPeriodBasis}
              width="w-[14rem]"
              options={[
                { value: "prior", label: "Filtered range vs prior period" },
                { value: "months", label: "Two months I pick" },
              ]}
            />
            {periodBasis === "months" ? (
              <>
                <ControlSelect
                  label="Period A"
                  value={monthA}
                  onChange={setMonthA}
                  width="w-[9rem]"
                  options={dataset.months.map((m) => ({
                    value: m.key,
                    label: m.isPartial ? `${m.label} (partial)` : m.label,
                  }))}
                />
                <ControlSelect
                  label="Period B"
                  value={monthB}
                  onChange={setMonthB}
                  width="w-[9rem]"
                  options={dataset.months.map((m) => ({
                    value: m.key,
                    label: m.isPartial ? `${m.label} (partial)` : m.label,
                  }))}
                />
              </>
            ) : null}
            <SortControl
              value={periodSortKey}
              onChange={setPeriodSortKey}
              dir={periodSortDir}
              onDirChange={setPeriodSortDir}
              width="w-[12rem]"
              options={[
                { value: "deltaPct", label: "% change" },
                { value: "deltaAbs", label: "Absolute change" },
                { value: "a", label: periodWindows.shortA },
                { value: "b", label: periodWindows.shortB },
                { value: "name", label: "Department name" },
              ]}
            />
          </div>
        }
        table={{ columns: periodTableColumns, rows: sortedPeriodRows }}
        onRowClickInTable={(row) => setDrill({ kind: "period", departmentId: row.departmentId })}
      >
        {sortedPeriodRows.length === 0 ? (
          <EmptyPanel label="Neither period has activity under the current filters." />
        ) : (
          <>
            {periodWindows.partial ? (
              <p className="mb-2 rounded-md border border-warning/30 bg-warning/10 px-2.5 py-1.5 text-[11px] text-warning">
                One of the selected months is the dataset&apos;s month-to-date bucket, so it covers
                fewer days than the other. Read the % change as directional, not as a like-for-like
                monthly comparison.
              </p>
            ) : null}
            <div className="h-[23rem]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sortedPeriodRows}
                  margin={{ top: 8, right: 20, bottom: 56, left: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.35} />
                  <XAxis
                    dataKey="department"
                    tick={{ fontSize: 10 }}
                    interval={0}
                    angle={-28}
                    textAnchor="end"
                    height={64}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={periodDef.tick}
                    label={{
                      value: periodDef.axis,
                      angle: -90,
                      position: "insideLeft",
                      style: { fontSize: 10 },
                    }}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(68,84,195,0.06)" }}
                    content={
                      <PeriodTooltip
                        metric={periodDef}
                        labelA={periodWindows.shortA}
                        labelB={periodWindows.shortB}
                      />
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar
                    dataKey="a"
                    name={periodWindows.shortA}
                    fill={PALETTE.brand}
                    radius={[3, 3, 0, 0]}
                    cursor="pointer"
                    onClick={(entry: unknown) => {
                      const row = entry as { payload?: PeriodRow } & { departmentId?: string };
                      const departmentId = row.payload?.departmentId ?? row.departmentId;
                      if (departmentId) setDrill({ kind: "period", departmentId });
                    }}
                  />
                  <Bar
                    dataKey="b"
                    name={periodWindows.shortB}
                    fill={PALETTE.brandLighter}
                    radius={[3, 3, 0, 0]}
                    cursor="pointer"
                    onClick={(entry: unknown) => {
                      const row = entry as { payload?: PeriodRow } & { departmentId?: string };
                      const departmentId = row.payload?.departmentId ?? row.departmentId;
                      if (departmentId) setDrill({ kind: "period", departmentId });
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <LegendDot color={PALETTE.brand} label={periodWindows.labelA} />
              <LegendDot color={PALETTE.brandLighter} label={periodWindows.labelB} />
            </div>
            <p className="mt-1 text-[11px] text-text-muted">
              The bars are two time periods, so the ordering of the departments — not of time — is
              what the sort control changes. Sorting by % change puts the fastest movers first,
              which is the question this panel exists to answer. Click either bar to open period
              A&apos;s encounters for that department.
            </p>
          </>
        )}
      </InteractiveChartCard>

      {/* ---------------------------------------------------------------- */}
      {/* Movers table — the same two periods, read as a ranked list       */}
      {/* ---------------------------------------------------------------- */}
      <PanelCard
        title="Biggest movers between the two periods"
        description={`Departments ordered by ${periodSortKey === "name" ? "name" : "the sort control above"}, so this table and the chart above always agree.`}
      >
        {sortedPeriodRows.length === 0 ? (
          <EmptyPanel label="No department has activity in either period." />
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px]">Department</TableHead>
                  <TableHead className="text-right text-[11px]">{periodWindows.shortA}</TableHead>
                  <TableHead className="text-right text-[11px]">{periodWindows.shortB}</TableHead>
                  <TableHead className="text-right text-[11px]">Change</TableHead>
                  <TableHead className="text-right text-[11px]">% change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPeriodRows.map((row) => (
                  <TableRow
                    key={row.departmentId}
                    className="cursor-pointer"
                    onClick={() => setDrill({ kind: "period", departmentId: row.departmentId })}
                  >
                    <TableCell className="text-xs font-medium text-text-primary">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: row.color }}
                        />
                        {row.department}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-xs">{periodDef.format(row.a)}</TableCell>
                    <TableCell className="text-right text-xs text-text-secondary">
                      {periodDef.format(row.b)}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {row.deltaAbs >= 0 ? "+" : "−"}
                      {periodDef.format(Math.abs(row.deltaAbs))}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right text-xs font-semibold",
                        row.deltaPct >= 0 ? "text-success" : "text-danger",
                      )}
                    >
                      {signed(row.deltaPct)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </PanelCard>

      {/* ---------------------------------------------------------------- */}
      {/* Drill-down drawer                                                */}
      {/* ---------------------------------------------------------------- */}
      <ChartDrillDrawer
        open={drill !== null}
        onOpenChange={(open) => {
          if (!open) setDrill(null);
        }}
        metricName={drillPayload?.title ?? "Performance detail"}
        value={drillPayload?.value ?? ""}
        dateRangeLabel={drill?.kind === "period" ? periodWindows.labelA : periodLabel}
        filterLabel={isFiltered ? "Global filters applied" : "All departments"}
        exportRows={drillPayload?.rows ?? []}
        exportColumns={ENCOUNTER_EXPORT_COLUMNS}
      >
        {drillPayload && "deptRow" in drillPayload && drillPayload.deptRow ? (
          <div className="space-y-1">
            <StatRow label="Encounters" value={num(drillPayload.deptRow.encounters)} />
            <StatRow
              label="Inpatient / day-census"
              value={`${num(drillPayload.deptRow.inpatient)} admissions · ${drillPayload.deptRow.avgDailyCensus.toFixed(1)} beds/day`}
            />
            <StatRow
              label="Gross revenue"
              value={php(drillPayload.deptRow.grossCharges, { compact: true })}
            />
            <StatRow
              label="Revenue per encounter"
              value={php(drillPayload.deptRow.revenuePerEncounter, { compact: true })}
            />
            <StatRow
              label="Collected / net payable"
              value={`${php(drillPayload.deptRow.amountPaid, { compact: true })} of ${php(drillPayload.deptRow.netPayable, { compact: true })} (${ratePct(drillPayload.deptRow.collectionRate)})`}
            />
            <StatRow
              label="Mean / median LOS"
              value={`${drillPayload.deptRow.meanLosDays.toFixed(1)} / ${drillPayload.deptRow.medianLosDays.toFixed(1)} days over ${num(drillPayload.deptRow.discharges)} discharges`}
            />
            <StatRow
              label="NPS"
              value={
                drillPayload.deptRow.npsResponses > 0
                  ? `${drillPayload.deptRow.nps > 0 ? "+" : ""}${drillPayload.deptRow.nps} across ${num(drillPayload.deptRow.npsResponses)} responses`
                  : "No survey responses in scope"
              }
            />
            <StatRow
              label="30-day readmissions"
              value={
                drillPayload.deptRow.readmitEligible > 0
                  ? `${num(drillPayload.deptRow.readmissions)} of ${num(drillPayload.deptRow.readmitEligible)} eligible (${ratePct(drillPayload.deptRow.readmissionRate)})`
                  : "No eligible encounters"
              }
            />
            <StatRow
              label="Share of hospital"
              value={`${ratePct(drillPayload.deptRow.volumeShare)} of encounters · ${ratePct(drillPayload.deptRow.revenueShare)} of revenue`}
            />
          </div>
        ) : null}

        {drill?.kind === "period" && drillPeriodRow ? (
          <div className="space-y-1 rounded-md border border-border bg-muted/40 p-2">
            <StatRow label={periodWindows.labelA} value={periodDef.format(drillPeriodRow.a)} />
            <StatRow label={periodWindows.labelB} value={periodDef.format(drillPeriodRow.b)} />
            <StatRow
              label="Change"
              value={
                <span className={cn(drillPeriodRow.deltaPct >= 0 ? "text-success" : "text-danger")}>
                  {signed(drillPeriodRow.deltaPct)}
                </span>
              }
            />
            <p className="pt-1 text-[11px] text-text-muted">
              The encounter list below is period A ({periodWindows.labelA}).
            </p>
          </div>
        ) : null}

        {drillPayload && "serviceRow" in drillPayload && drillPayload.serviceRow ? (
          <div className="space-y-1">
            <StatRow label="Category" value={drillPayload.serviceRow.category} />
            <StatRow label="Owning cost centre" value={drillPayload.serviceRow.department} />
            <StatRow
              label="Encounters carrying it"
              value={num(drillPayload.serviceRow.encounters)}
            />
            <StatRow label="Units delivered" value={num(drillPayload.serviceRow.units)} />
            <StatRow
              label="Charge-line revenue"
              value={php(drillPayload.serviceRow.revenue, { compact: true })}
            />
            <StatRow
              label="Revenue per encounter"
              value={php(drillPayload.serviceRow.revenuePerEncounter, { compact: true })}
            />
            <StatRow
              label="Share of window revenue"
              value={ratePct(drillPayload.serviceRow.share, 2)}
            />
          </div>
        ) : null}

        {drillPayload && "doctorRow" in drillPayload && drillPayload.doctorRow ? (
          <div className="space-y-1">
            <StatRow label="Department" value={drillPayload.doctorRow.department} />
            <StatRow
              label="Experience / capacity"
              value={`${num(drillPayload.doctorRow.yearsExperience)} yrs · ${num(drillPayload.doctorRow.monthlyCaseCapacity)} cases/month rostered`}
            />
            <StatRow
              label="Cases"
              value={`${num(drillPayload.doctorRow.encounters)} (${num(drillPayload.doctorRow.inpatient)} inpatient)`}
            />
            <StatRow
              label="Capacity utilisation"
              value={
                <StatusBadge
                  tone={
                    drillPayload.doctorRow.capacityUtilization > 1
                      ? "warning"
                      : drillPayload.doctorRow.capacityUtilization > 0.6
                        ? "good"
                        : "neutral"
                  }
                >
                  {ratePct(drillPayload.doctorRow.capacityUtilization)}
                </StatusBadge>
              }
            />
            <StatRow
              label="Gross revenue"
              value={`${php(drillPayload.doctorRow.grossCharges, { compact: true })} · ${php(drillPayload.doctorRow.revenuePerCase, { compact: true })} per case`}
            />
            <StatRow
              label="Mean inpatient LOS"
              value={
                drillPayload.doctorRow.inpatient > 0
                  ? `${drillPayload.doctorRow.avgLosDays.toFixed(1)} days`
                  : "No inpatient cases"
              }
            />
            <StatRow
              label="ICD-10 coding completeness"
              value={`${num(drillPayload.doctorRow.codedEncounters)} of ${num(drillPayload.doctorRow.encounters)} coded (${ratePct(drillPayload.doctorRow.codedShare)})`}
            />
            <StatRow
              label="PhilHealth denials"
              value={
                drillPayload.doctorRow.decidedClaims > 0
                  ? `${num(drillPayload.doctorRow.deniedClaims)} of ${num(drillPayload.doctorRow.decidedClaims)} decided claims (${ratePct(drillPayload.doctorRow.denialRate)})`
                  : "No decided claims in scope"
              }
            />
            <StatRow
              label="30-day readmissions"
              value={
                drillPayload.doctorRow.readmitEligible > 0
                  ? `${num(drillPayload.doctorRow.readmissions)} of ${num(drillPayload.doctorRow.readmitEligible)} eligible (${ratePct(drillPayload.doctorRow.readmissionRate)})`
                  : "No eligible encounters"
              }
            />
          </div>
        ) : null}

        <EncounterSampleTable
          records={drillPayload?.rows ?? []}
          {...(drill?.kind === "service" ? { serviceLabel: drillPayload?.title ?? "" } : {})}
        />
      </ChartDrillDrawer>
    </div>
  );
}
