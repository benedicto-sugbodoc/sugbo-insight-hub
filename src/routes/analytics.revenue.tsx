/**
 * Financial Analysis — Revenue Cycle & Billing.
 *
 * Tier 3 of the hospital analytics hierarchy
 * (Overview -> Comparison -> **Financial investigation** -> Drill-down -> Detail).
 *
 * Every number on this page is derived from the shared synthetic dataset
 * (`src/lib/data/hospital/**`) through its `derive.ts` query layer, so figures
 * reconcile with Executive Overview, Performance, Claims and Patient
 * Experience. The legacy `src/lib/analytics/revenue.mock.ts` is no longer read
 * here (the file still exists; it is simply no longer a data source).
 *
 * Two invariants the supervisor called out are enforced structurally rather
 * than by convention:
 *
 *  - **PWD discounts only ever appear where the transaction actually
 *    qualifies.** Both PWD panels read `pwdDiscountByDepartment()` / the
 *    `PWDDiscount` table, which the generator only emits for
 *    `Patient.isPWD === true` bills with a qualifying amount. No rate is ever
 *    applied by this page; the statutory 20% is displayed from
 *    `PWD_DISCOUNT_RATE`, not multiplied into anything.
 *  - **Every peso shown traces back to a real `Billing` row.** The gross ->
 *    net bridge, payer mix, department split, AR aging and collection trend
 *    all sum the same `Billing` columns, so the waterfall closes exactly.
 *
 * Panels marked "Keep" in `chart-audit.md` retain their visual and interaction
 * pattern and were only re-sourced; the audit's specific "Modify" instructions
 * are applied inline and noted in comments on each panel.
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarClock, CircleDollarSign, PiggyBank, Receipt, TrendingDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  KpiStrip,
  LegendDot,
  PALETTE,
  PanelCard,
  SectionTitle,
  Sparkline,
  StatRow,
  StatusBadge,
  Trend,
  num,
  pct,
  php,
  statusBorder,
  statusText,
  type MetricStatus,
} from "@/components/analytics/shared";
import { ChartDrillDrawer, InteractiveChartCard } from "@/components/analytics/interactive";
import {
  GlobalHospitalFilterBar,
  useHospitalFilters,
} from "@/components/analytics/hospital-filter-context";
import type { ReportColumn } from "@/components/reports/types";
import {
  MS_DAY,
  PWD_DISCOUNT_RATE,
  arAgingByPayer,
  daysBetween,
  fetchHospitalDataset,
  filterEncounters,
  parseDate,
  payerMix,
  paymentStatusBreakdown,
  pwdDiscountByDepartment,
  revenueByDepartment,
  revenueByMonth,
  serviceUtilization,
  toDate,
} from "@/lib/data/hospital";
import type {
  EncounterFilter,
  HospitalDataset,
  PayerType,
  PhilHealthCategory,
} from "@/lib/data/hospital";

export const Route = createFileRoute("/analytics/revenue")({
  head: () => ({
    meta: [
      { title: "Financial Analysis — Revenue Cycle & Billing — SugboDoc" },
      {
        name: "description",
        content:
          "Revenue cycle and billing analytics: gross-to-net waterfall, payer mix, revenue by department, accounts receivable aging, collections, and PWD mandatory-discount impact — all derived from the shared hospital dataset.",
      },
      {
        property: "og:title",
        content: "Financial Analysis — Revenue Cycle & Billing — SugboDoc",
      },
      {
        property: "og:description",
        content:
          "Billing manager view of hospital revenue, AR aging, collections and mandatory-discount exposure.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RevenueRoute,
});

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const PAYER_ORDER: readonly PayerType[] = [
  "philhealth",
  "hmo",
  "privatePay",
  "scpwd",
  "gsis",
  "writeoff",
];

const PAYER_META: Record<PayerType, { label: string; color: string }> = {
  philhealth: { label: "PhilHealth", color: PALETTE.philhealth },
  hmo: { label: "HMO", color: PALETTE.hmo },
  privatePay: { label: "Private Pay", color: PALETTE.brand },
  scpwd: { label: "SC / PWD", color: PALETTE.scpwd },
  gsis: { label: "GSIS / Other", color: PALETTE.gsis },
  writeoff: { label: "Write-off", color: PALETTE.writeoff },
};

const AGING_BUCKETS = [
  { key: "current", label: "Current 0–30", color: PALETTE.success },
  { key: "d31to60", label: "31–60", color: PALETTE.brandLight },
  { key: "d61to90", label: "61–90", color: PALETTE.warning },
  { key: "over90", label: "> 90 days", color: PALETTE.danger },
] as const;

type AgingBucketKey = (typeof AGING_BUCKETS)[number]["key"];

/** Rows shown before the "show more" affordance in long detail tables. */
const PAGE_SIZE = 10;
const DRAWER_ROW_LIMIT = 40;

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function sum<T>(rows: readonly T[], get: (row: T) => number): number {
  return rows.reduce((total, row) => total + get(row), 0);
}

function deltaPct(current: number, prior: number): number {
  if (prior === 0) return current === 0 ? 0 : 100;
  return ((current - prior) / Math.abs(prior)) * 100;
}

function shiftDays(date: string, days: number): string {
  return toDate(parseDate(date) + days * MS_DAY);
}

function spanDays(from: string, to: string): number {
  return Math.max(1, daysBetween(parseDate(from), parseDate(to)) + 1);
}

function safeShare(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

function collectionStatus(value: number): MetricStatus {
  if (value >= 90) return "good";
  if (value >= 80) return "warning";
  return "danger";
}

function daysInArStatus(value: number, benchmark: number): MetricStatus {
  if (value <= benchmark) return "good";
  if (value <= benchmark * 1.25) return "warning";
  return "danger";
}

function writeOffStatus(value: number, benchmark: number): MetricStatus {
  if (value <= benchmark) return "good";
  if (value <= benchmark * 1.5) return "warning";
  return "danger";
}

/* ------------------------------------------------------------------ */
/* Page-local chrome                                                   */
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

function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="flex h-56 items-center justify-center rounded-md border border-dashed border-border text-xs text-text-muted">
      {label}
    </div>
  );
}

/**
 * KPI tile with the two things the audit asked for on this strip: a trailing
 * 12-month sparkline, and the benchmark drawn as a visible bar rather than
 * being buried in secondary text. Every benchmark here is computed from the
 * dataset (trailing 12-month behaviour), never hard-coded, so the status tone
 * is auditable.
 */
function TrendKpiCard({
  label,
  value,
  delta,
  invertDelta,
  status,
  icon: Icon,
  trend,
  actual,
  benchmark,
  benchmarkLabel,
  scaleMax,
  note,
  onClick,
}: {
  label: string;
  value: string;
  delta: number;
  invertDelta?: boolean;
  status: MetricStatus;
  icon: React.ElementType;
  trend: number[];
  actual: number;
  benchmark: number;
  benchmarkLabel: string;
  scaleMax: number;
  note: string;
  onClick: () => void;
}) {
  const max = Math.max(scaleMax, actual, benchmark, 1);
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex min-w-[13rem] flex-col gap-1 rounded-lg border border-l-4 bg-card p-4 text-left shadow-sm transition-all",
        statusBorder[status],
        "cursor-pointer hover:-translate-y-0.5 hover:shadow-md",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-text-secondary">{label}</span>
        <Icon className={cn("size-4", statusText[status])} />
      </div>
      <span className="text-2xl font-semibold tracking-tight text-text-primary">{value}</span>
      <Trend delta={delta} invert={!!invertDelta} />
      <div className="mt-1 space-y-1">
        <div className="relative h-2 w-full rounded-full bg-muted">
          <div
            className="h-2 rounded-full"
            style={{
              width: `${Math.min(100, (actual / max) * 100)}%`,
              backgroundColor: PALETTE.brand,
            }}
          />
          <div
            className="absolute top-[-3px] h-3.5 w-0.5 bg-foreground"
            style={{ left: `${Math.min(100, (benchmark / max) * 100)}%` }}
          />
        </div>
        <span className="block text-[10px] text-text-muted">{benchmarkLabel}</span>
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <Sparkline data={trend} color={PALETTE.brand} width={104} height={22} />
        <span className="text-[10px] text-text-muted">12-mo</span>
      </div>
      <span className="mt-1 text-[11px] italic text-text-muted">{note}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Derivation types                                                    */
/* ------------------------------------------------------------------ */

interface Totals {
  encounters: number;
  gross: number;
  philhealthDeduction: number;
  pwdDiscount: number;
  net: number;
  collected: number;
  balance: number;
}

type StepKind = "start" | "deduction" | "subtotal" | "end";

interface WaterfallStep {
  key: string;
  label: string;
  kind: StepKind;
  base: number;
  value: number;
  priorBase: number;
  priorValue: number;
  /** Running total after this step. */
  cumulative: number;
  /** `cumulative / gross`, in percent — the "% of gross retained" label. */
  retainedPct: number;
  /** Change in this step's magnitude vs the prior period, in percent. */
  deltaPct: number;
}

interface PayerRow {
  payerType: PayerType;
  label: string;
  color: string;
  encounters: number;
  grossCharges: number;
  netPayable: number;
  amountPaid: number;
  balance: number;
  sharePct: number;
  collectionPct: number;
}

interface DeptPayerRow {
  departmentId: string;
  department: string;
  color: string;
  encounters: number;
  total: number;
  netPayable: number;
  amountPaid: number;
  balance: number;
  philhealth: number;
  hmo: number;
  privatePay: number;
  scpwd: number;
  gsis: number;
  writeoff: number;
  philhealthSharePct: number;
  privateSharePct: number;
  collectionPct: number;
}

interface ArRow {
  payerType: PayerType;
  label: string;
  color: string;
  current: number;
  d31to60: number;
  d61to90: number;
  over90: number;
  total: number;
  over90Pct: number;
}

interface ArAccountRow {
  encounterId: string;
  billingId: string;
  patientId: string;
  patient: string;
  payerType: PayerType;
  payerLabel: string;
  department: string;
  daysOutstanding: number;
  amount: number;
  netPayable: number;
  paymentStatus: string;
  lastAction: string;
}

interface FunnelStage {
  key: string;
  label: string;
  count: number;
  value: number;
  stuckCount: number;
  stuckValue: number;
  avgAgeDays: number;
  dropOffCount: number;
  dropOffPct: number;
  encounterIds: string[];
}

interface CoverageRow {
  category: PhilHealthCategory;
  patients: number;
  encounters: number;
  grossCharges: number;
  amountPaid: number;
  netPayable: number;
  collectionPct: number;
  patientSharePct: number;
}

interface PwdMonthRow {
  month: string;
  label: string;
  isPartial: boolean;
  discountedEncounters: number;
  patients: number;
  qualifyingAmount: number;
  discountAmount: number;
  vatExemptAmount: number;
  discountPerEncounter: number;
}

interface MonthlyPayerRow {
  month: string;
  label: string;
  isPartial: boolean;
  total: number;
  philhealth: number;
  hmo: number;
  privatePay: number;
  scpwd: number;
  gsis: number;
  writeoff: number;
}

type CollectionDimension = "payer" | "department" | "encounterType";

interface CollectionRow {
  month: string;
  label: string;
  isPartial: boolean;
  /** Net payable billed in the month — the data-driven, per-period target. */
  target: number;
  total: number;
  [series: string]: string | number | boolean;
}

/* ------------------------------------------------------------------ */
/* Derivation                                                          */
/* ------------------------------------------------------------------ */

function totalsOf(dataset: HospitalDataset, filter: EncounterFilter): Totals {
  const rows = revenueByDepartment(dataset, filter);
  return {
    encounters: sum(rows, (r) => r.encounters),
    gross: sum(rows, (r) => r.grossCharges),
    philhealthDeduction: sum(rows, (r) => r.philhealthDeduction),
    pwdDiscount: sum(rows, (r) => r.pwdDiscountAmount),
    net: sum(rows, (r) => r.netPayable),
    collected: sum(rows, (r) => r.amountPaid),
    balance: sum(rows, (r) => r.balance),
  };
}

function buildWaterfall(current: Totals, prior: Totals): WaterfallStep[] {
  const chain = (t: Totals) => {
    const afterPhilhealth = t.gross - t.philhealthDeduction;
    return {
      gross: { base: 0, value: t.gross, cumulative: t.gross },
      philhealth: {
        base: afterPhilhealth,
        value: t.philhealthDeduction,
        cumulative: afterPhilhealth,
      },
      pwd: { base: t.net, value: t.pwdDiscount, cumulative: t.net },
      net: { base: 0, value: t.net, cumulative: t.net },
      balance: { base: t.collected, value: t.balance, cumulative: t.collected },
      collected: { base: 0, value: t.collected, cumulative: t.collected },
    };
  };
  const now = chain(current);
  const before = chain(prior);
  const defs: { key: keyof ReturnType<typeof chain>; label: string; kind: StepKind }[] = [
    { key: "gross", label: "Gross charges", kind: "start" },
    { key: "philhealth", label: "PhilHealth benefit", kind: "deduction" },
    { key: "pwd", label: "PWD discount (RA 10754)", kind: "deduction" },
    { key: "net", label: "Net payable", kind: "subtotal" },
    { key: "balance", label: "Outstanding balance", kind: "deduction" },
    { key: "collected", label: "Collected", kind: "end" },
  ];
  return defs.map((def) => {
    const cur = now[def.key];
    const prev = before[def.key];
    return {
      key: def.key,
      label: def.label,
      kind: def.kind,
      base: cur.base,
      value: cur.value,
      priorBase: prev.base,
      priorValue: prev.value,
      cumulative: cur.cumulative,
      retainedPct: safeShare(cur.cumulative, current.gross),
      deltaPct: deltaPct(cur.value, prev.value),
    };
  });
}

function buildPayerRows(dataset: HospitalDataset, filter: EncounterFilter): PayerRow[] {
  const rows = payerMix(dataset, filter);
  const total = sum(rows, (r) => r.grossCharges);
  return rows.map((row) => ({
    payerType: row.payerType,
    label: PAYER_META[row.payerType].label,
    color: PAYER_META[row.payerType].color,
    encounters: row.encounters,
    grossCharges: row.grossCharges,
    netPayable: row.netPayable,
    amountPaid: row.amountPaid,
    balance: row.balance,
    sharePct: safeShare(row.grossCharges, total),
    collectionPct: safeShare(row.amountPaid, row.netPayable),
  }));
}

function buildDeptPayerRows(dataset: HospitalDataset, filter: EncounterFilter): DeptPayerRow[] {
  const base = revenueByDepartment(dataset, filter);
  const perPayer = PAYER_ORDER.map((payer) => ({
    payer,
    rows: revenueByDepartment(dataset, { ...filter, payerTypes: [payer] }),
  }));
  return base
    .map((row) => {
      const pick = (payer: PayerType) =>
        perPayer
          .find((p) => p.payer === payer)
          ?.rows.find((r) => r.departmentId === row.departmentId)?.grossCharges ?? 0;
      const philhealth = pick("philhealth");
      const privatePay = pick("privatePay");
      return {
        departmentId: row.departmentId,
        department: row.department,
        color: row.color,
        encounters: row.encounters,
        total: row.grossCharges,
        netPayable: row.netPayable,
        amountPaid: row.amountPaid,
        balance: row.balance,
        philhealth,
        hmo: pick("hmo"),
        privatePay,
        scpwd: pick("scpwd"),
        gsis: pick("gsis"),
        writeoff: pick("writeoff"),
        philhealthSharePct: safeShare(philhealth, row.grossCharges),
        privateSharePct: safeShare(privatePay, row.grossCharges),
        collectionPct: safeShare(row.amountPaid, row.netPayable),
      };
    })
    .filter((row) => row.encounters > 0);
}

function buildArRows(dataset: HospitalDataset, filter: EncounterFilter): ArRow[] {
  return arAgingByPayer(dataset, filter).map((row) => ({
    payerType: row.payerType,
    label: PAYER_META[row.payerType].label,
    color: PAYER_META[row.payerType].color,
    current: row.current,
    d31to60: row.d31to60,
    d61to90: row.d61to90,
    over90: row.over90,
    total: row.total,
    over90Pct: safeShare(row.over90, row.total),
  }));
}

/**
 * Patient-level open accounts. `bucket` narrows to one aging band; the >90 band
 * is what the panel under the AR chart shows, and the drawer reuses the same
 * builder for any band so the two can never disagree.
 */
function buildArAccounts(
  dataset: HospitalDataset,
  filter: EncounterFilter,
  options: { minDays?: number; maxDays?: number; payerType?: PayerType } = {},
): ArAccountRow[] {
  const anchorMs = parseDate(dataset.anchorDate);
  const rows: ArAccountRow[] = [];
  for (const enc of filterEncounters(dataset, filter)) {
    const bill = dataset.index.billingByEncounterId.get(enc.id);
    if (!bill || bill.balance <= 0) continue;
    if (options.payerType !== undefined && enc.payerType !== options.payerType) continue;
    const referenceMs = Date.parse(enc.dischargeDateTime ?? enc.admitDateTime);
    const age = daysBetween(referenceMs, anchorMs);
    if (options.minDays !== undefined && age < options.minDays) continue;
    if (options.maxDays !== undefined && age > options.maxDays) continue;
    const patient = dataset.index.patientById.get(enc.patientId);
    rows.push({
      encounterId: enc.id,
      billingId: bill.id,
      patientId: enc.patientId,
      patient: patient?.name ?? enc.patientId,
      payerType: enc.payerType,
      payerLabel: PAYER_META[enc.payerType].label,
      department: dataset.index.departmentById.get(enc.departmentId)?.name ?? enc.departmentId,
      daysOutstanding: age,
      amount: Math.round(bill.balance),
      netPayable: Math.round(bill.netPayable),
      paymentStatus: bill.paymentStatus,
      lastAction:
        bill.paymentDate !== null
          ? `Partial payment posted ${bill.paymentDate}`
          : bill.paymentStatus === "Write-off"
            ? "Written off — no collection posted"
            : "Statement issued, no payment posted",
    });
  }
  return rows.sort((a, b) => b.daysOutstanding - a.daysOutstanding);
}

function buildFunnel(dataset: HospitalDataset, filter: EncounterFilter): FunnelStage[] {
  const anchorMs = parseDate(dataset.anchorDate);
  const encounters = filterEncounters(dataset, filter);

  const stageSets: { key: string; label: string; ids: string[]; value: number }[] = [
    { key: "encounter", label: "Encounter opened", ids: [], value: 0 },
    { key: "discharged", label: "Discharged / closed", ids: [], value: 0 },
    { key: "billed", label: "Bill payable raised", ids: [], value: 0 },
    { key: "collecting", label: "Payment received", ids: [], value: 0 },
    { key: "settled", label: "Fully settled", ids: [], value: 0 },
  ];

  const ageOf = (encounterId: string): number => {
    const enc = dataset.index.encounterById.get(encounterId);
    if (!enc) return 0;
    return daysBetween(Date.parse(enc.dischargeDateTime ?? enc.admitDateTime), anchorMs);
  };

  for (const enc of encounters) {
    const bill = dataset.index.billingByEncounterId.get(enc.id);
    if (!bill) continue;
    const reached: number[] = [0];
    if (enc.dischargeDateTime !== null) reached.push(1);
    if (enc.dischargeDateTime !== null && bill.netPayable > 0) reached.push(2);
    if (reached.includes(2) && bill.amountPaid > 0) reached.push(3);
    if (reached.includes(3) && bill.balance <= 0) reached.push(4);
    for (const index of reached) {
      const stage = stageSets[index];
      if (!stage) continue;
      stage.ids.push(enc.id);
      stage.value += bill.netPayable;
    }
  }

  return stageSets.map((stage, i) => {
    const next = stageSets[i + 1];
    const nextIds = new Set(next?.ids ?? []);
    const stuck = i === stageSets.length - 1 ? [] : stage.ids.filter((id) => !nextIds.has(id));
    const stuckValue = sum(stuck, (id) => dataset.index.billingByEncounterId.get(id)?.balance ?? 0);
    const prev = stageSets[i - 1];
    const dropOffCount = prev ? prev.ids.length - stage.ids.length : 0;
    return {
      key: stage.key,
      label: stage.label,
      count: stage.ids.length,
      value: Math.round(stage.value),
      stuckCount: stuck.length,
      stuckValue: Math.round(stuckValue),
      avgAgeDays: stuck.length > 0 ? Math.round((sum(stuck, ageOf) / stuck.length) * 10) / 10 : 0,
      dropOffCount,
      dropOffPct: prev && prev.ids.length > 0 ? (dropOffCount / prev.ids.length) * 100 : 0,
      encounterIds: stuck,
    };
  });
}

function buildCoverageRows(dataset: HospitalDataset, filter: EncounterFilter): CoverageRow[] {
  const map = new Map<
    PhilHealthCategory,
    {
      category: PhilHealthCategory;
      patients: Set<string>;
      encounters: number;
      grossCharges: number;
      amountPaid: number;
      netPayable: number;
    }
  >();
  for (const enc of filterEncounters(dataset, filter)) {
    const patient = dataset.index.patientById.get(enc.patientId);
    const bill = dataset.index.billingByEncounterId.get(enc.id);
    if (!patient || !bill) continue;
    const row = map.get(patient.philhealthCategory) ?? {
      category: patient.philhealthCategory,
      patients: new Set<string>(),
      encounters: 0,
      grossCharges: 0,
      amountPaid: 0,
      netPayable: 0,
    };
    row.patients.add(patient.id);
    row.encounters += 1;
    row.grossCharges += bill.grossCharges;
    row.amountPaid += bill.amountPaid;
    row.netPayable += bill.netPayable;
    map.set(patient.philhealthCategory, row);
  }
  const totalPatients = sum([...map.values()], (r) => r.patients.size);
  return [...map.values()]
    .map((row) => ({
      category: row.category,
      patients: row.patients.size,
      encounters: row.encounters,
      grossCharges: Math.round(row.grossCharges),
      amountPaid: Math.round(row.amountPaid),
      netPayable: Math.round(row.netPayable),
      collectionPct: safeShare(row.amountPaid, row.netPayable),
      patientSharePct: safeShare(row.patients.size, totalPatients),
    }))
    .sort((a, b) => b.patients - a.patients);
}

/**
 * PWD discount by month, straight off the `PWDDiscount` table. Because the
 * generator only ever emits a row here for a PWD patient's qualifying bill,
 * this chart structurally cannot show a discount on a non-qualifying
 * transaction — there is no rate applied anywhere in this function.
 */
function buildPwdMonths(dataset: HospitalDataset, filter: EncounterFilter): PwdMonthRow[] {
  const ids = new Set(filterEncounters(dataset, filter).map((e) => e.id));
  const rows = new Map<string, PwdMonthRow & { patientIds: Set<string> }>();
  for (const month of dataset.months) {
    rows.set(month.key, {
      month: month.key,
      label: month.label,
      isPartial: month.isPartial,
      discountedEncounters: 0,
      patients: 0,
      qualifyingAmount: 0,
      discountAmount: 0,
      vatExemptAmount: 0,
      discountPerEncounter: 0,
      patientIds: new Set<string>(),
    });
  }
  for (const discount of dataset.pwdDiscounts) {
    if (!ids.has(discount.encounterId)) continue;
    const enc = dataset.index.encounterById.get(discount.encounterId);
    if (!enc) continue;
    const row = rows.get(enc.admitDateTime.slice(0, 7));
    if (!row) continue;
    row.discountedEncounters += 1;
    row.patientIds.add(enc.patientId);
    row.qualifyingAmount += discount.qualifyingAmount;
    row.discountAmount += discount.discountAmount;
    row.vatExemptAmount += discount.vatExemptAmount;
  }
  return [...rows.values()].map(({ patientIds, ...row }) => ({
    ...row,
    patients: patientIds.size,
    qualifyingAmount: Math.round(row.qualifyingAmount),
    discountAmount: Math.round(row.discountAmount),
    vatExemptAmount: Math.round(row.vatExemptAmount),
    discountPerEncounter:
      row.discountedEncounters > 0 ? Math.round(row.discountAmount / row.discountedEncounters) : 0,
  }));
}

function buildPayerTrend(dataset: HospitalDataset, filter: EncounterFilter): MonthlyPayerRow[] {
  const base = revenueByMonth(dataset, filter);
  const perPayer = PAYER_ORDER.map((payer) => ({
    payer,
    rows: revenueByMonth(dataset, { ...filter, payerTypes: [payer] }),
  }));
  return base.map((row, i) => {
    const pick = (payer: PayerType) =>
      perPayer.find((p) => p.payer === payer)?.rows[i]?.grossCharges ?? 0;
    return {
      month: row.month,
      label: row.monthLabel,
      isPartial: row.isPartial,
      total: row.grossCharges,
      philhealth: pick("philhealth"),
      hmo: pick("hmo"),
      privatePay: pick("privatePay"),
      scpwd: pick("scpwd"),
      gsis: pick("gsis"),
      writeoff: pick("writeoff"),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Tooltips                                                            */
/* ------------------------------------------------------------------ */

interface TooltipProps {
  active?: boolean;
  payload?: { payload?: unknown }[];
  label?: string | number;
}

/**
 * Audit fix: the old tooltip had to suppress the transparent `base` series
 * awkwardly. This one reads the step row directly, so it can show the step
 * delta, the running total, and the share of gross retained.
 */
function WaterfallTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const step = payload[0]?.payload as WaterfallStep | undefined;
  if (!step) return null;
  const signed =
    step.kind === "deduction"
      ? `−${php(step.value, { compact: true })}`
      : php(step.value, { compact: true });
  return (
    <div className="max-w-[16rem] rounded-md bg-[#111] px-2.5 py-2 text-[11px] leading-relaxed text-white shadow-lg">
      <div className="text-xs font-bold">{step.label}</div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Step</span>
        <span className="font-semibold">{signed}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Running total</span>
        <span className="font-semibold">{php(step.cumulative, { compact: true })}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Of gross retained</span>
        <span className="font-semibold">{pct(step.retainedPct)}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Step vs prior period</span>
        <span className="font-semibold">
          {step.deltaPct >= 0 ? "+" : ""}
          {step.deltaPct.toFixed(1)}%
        </span>
      </div>
      <div className="mt-1 text-[10px] italic opacity-70">Click to itemise this step →</div>
    </div>
  );
}

function PayerTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as PayerRow | undefined;
  if (!row) return null;
  return (
    <div className="max-w-[15rem] rounded-md bg-[#111] px-2.5 py-2 text-[11px] leading-relaxed text-white shadow-lg">
      <div className="text-xs font-bold">{row.label}</div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Gross charges</span>
        <span className="font-semibold">{php(row.grossCharges, { compact: true })}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Share of gross</span>
        <span className="font-semibold">{pct(row.sharePct)}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Collected</span>
        <span className="font-semibold">
          {php(row.amountPaid, { compact: true })} ({pct(row.collectionPct)})
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Encounters</span>
        <span className="font-semibold">{num(row.encounters)}</span>
      </div>
      <div className="mt-1 text-[10px] italic opacity-70">Click to drill down →</div>
    </div>
  );
}

function ArTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as ArRow | undefined;
  if (!row) return null;
  return (
    <div className="max-w-[15rem] rounded-md bg-[#111] px-2.5 py-2 text-[11px] leading-relaxed text-white shadow-lg">
      <div className="text-xs font-bold">{row.label}</div>
      {AGING_BUCKETS.map((bucket) => (
        <div key={bucket.key} className="flex justify-between gap-3">
          <span className="opacity-80">{bucket.label}</span>
          <span className="font-semibold">{php(row[bucket.key], { compact: true })}</span>
        </div>
      ))}
      <div className="mt-1 flex justify-between gap-3 border-t border-white/20 pt-1">
        <span className="opacity-80">Total AR</span>
        <span className="font-semibold">{php(row.total, { compact: true })}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">&gt; 90-day exposure</span>
        <span className="font-semibold">{pct(row.over90Pct)}</span>
      </div>
      <div className="mt-1 text-[10px] italic opacity-70">Click a bar for the accounts →</div>
    </div>
  );
}

function DeptRevenueTooltip({
  active,
  payload,
  hundredPct,
}: TooltipProps & { hundredPct: boolean }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as DeptPayerRow | undefined;
  if (!row) return null;
  return (
    <div className="max-w-[16rem] rounded-md bg-[#111] px-2.5 py-2 text-[11px] leading-relaxed text-white shadow-lg">
      <div className="text-xs font-bold">{row.department}</div>
      {PAYER_ORDER.map((payer) => {
        const value = row[payer];
        return (
          <div key={payer} className="flex justify-between gap-3">
            <span className="opacity-80">{PAYER_META[payer].label}</span>
            <span className="font-semibold">
              {hundredPct ? pct(safeShare(value, row.total)) : php(value, { compact: true })}
            </span>
          </div>
        );
      })}
      <div className="mt-1 flex justify-between gap-3 border-t border-white/20 pt-1">
        <span className="opacity-80">Gross charges</span>
        <span className="font-semibold">{php(row.total, { compact: true })}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Collected of net</span>
        <span className="font-semibold">{pct(row.collectionPct)}</span>
      </div>
      <div className="mt-1 text-[10px] italic opacity-70">Click to drill down →</div>
    </div>
  );
}

function PwdTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as
    | {
        department?: string;
        discountedEncounters: number;
        qualifyingAmount: number;
        discountAmount: number;
        vatExemptAmount: number;
      }
    | undefined;
  if (!row) return null;
  return (
    <div className="max-w-[16rem] rounded-md bg-[#111] px-2.5 py-2 text-[11px] leading-relaxed text-white shadow-lg">
      <div className="text-xs font-bold">{row.department ?? "PWD discounts"}</div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Discounted bills</span>
        <span className="font-semibold">{num(row.discountedEncounters)}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Qualifying amount</span>
        <span className="font-semibold">{php(row.qualifyingAmount, { compact: true })}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Discount absorbed</span>
        <span className="font-semibold">{php(row.discountAmount, { compact: true })}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">VAT-exempt component</span>
        <span className="font-semibold">{php(row.vatExemptAmount, { compact: true })}</span>
      </div>
      <div className="mt-1 text-[10px] italic opacity-70">
        PWD-flagged patients only · click to drill down →
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Route shell                                                         */
/* ------------------------------------------------------------------ */

function RevenueRoute() {
  const { data } = useQuery({ queryKey: ["hospital", "dataset"], queryFn: fetchHospitalDataset });
  if (!data) return <RevenueSkeleton />;
  return <RevenuePage dataset={data} />;
}

type Drill =
  | { kind: "kpi"; id: "gross" | "net" | "collection" | "ar" | "writeoff" }
  | { kind: "waterfall"; step: string }
  | { kind: "payer"; payer: PayerType }
  | { kind: "department"; departmentId: string }
  | { kind: "arBucket"; payer: PayerType; bucket: AgingBucketKey }
  | { kind: "account"; encounterId: string }
  | { kind: "funnel"; stage: string }
  | { kind: "coverage"; category: PhilHealthCategory }
  | { kind: "pwdDepartment"; departmentId: string }
  | { kind: "pwdMonth"; month: string }
  | null;

type DeptSortKey =
  "total-desc" | "total-asc" | "philhealth-desc" | "private-desc" | "collection-asc" | "name";
type ArSortKey = "total-desc" | "over90-desc" | "over90pct-desc" | "name";
type AccountSortKey = "days-desc" | "amount-desc" | "payer" | "patient";
type CoverageSortKey = "patients-desc" | "revenue-desc" | "collection-asc" | "name";
type PwdSortKey = "discount-desc" | "qualifying-desc" | "encounters-desc" | "name";

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function RevenuePage({ dataset }: { dataset: HospitalDataset }) {
  const { filters, encounterFilter, isFiltered } = useHospitalFilters();
  const [drill, setDrill] = React.useState<Drill>(null);

  /* ---------------- window arithmetic (same convention as Executive) -------- */

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
      period: encounterFilter,
      prior: { ...encounterFilter, from: priorFrom, to: priorTo } satisfies EncounterFilter,
      priorFrom,
      priorTo,
      /** Dimension filters only — used by every 12-month trend on this page. */
      dimensionOnly,
    };
  }, [dataset, encounterFilter]);

  /* ---------------- aggregates ---------------- */

  const current = React.useMemo(() => totalsOf(dataset, windows.period), [dataset, windows]);
  const prior = React.useMemo(() => totalsOf(dataset, windows.prior), [dataset, windows]);

  const monthlyAll = React.useMemo(
    () => revenueByMonth(dataset, windows.dimensionOnly),
    [dataset, windows],
  );

  const waterfall = React.useMemo(() => buildWaterfall(current, prior), [current, prior]);
  const payerRows = React.useMemo(
    () => buildPayerRows(dataset, windows.period),
    [dataset, windows],
  );
  const deptRows = React.useMemo(
    () => buildDeptPayerRows(dataset, windows.period),
    [dataset, windows],
  );
  const arRows = React.useMemo(() => buildArRows(dataset, windows.period), [dataset, windows]);
  const statusRows = React.useMemo(
    () => paymentStatusBreakdown(dataset, windows.period),
    [dataset, windows],
  );
  const priorStatusRows = React.useMemo(
    () => paymentStatusBreakdown(dataset, windows.prior),
    [dataset, windows],
  );
  const funnel = React.useMemo(() => buildFunnel(dataset, windows.period), [dataset, windows]);
  const coverageRows = React.useMemo(
    () => buildCoverageRows(dataset, windows.period),
    [dataset, windows],
  );
  const pwdDeptRows = React.useMemo(
    () =>
      pwdDiscountByDepartment(dataset, windows.period).filter((r) => r.discountedEncounters > 0),
    [dataset, windows],
  );
  const pwdMonths = React.useMemo(
    () => buildPwdMonths(dataset, windows.dimensionOnly),
    [dataset, windows],
  );
  const payerTrend = React.useMemo(
    () => buildPayerTrend(dataset, windows.dimensionOnly),
    [dataset, windows],
  );
  const over90Accounts = React.useMemo(
    () => buildArAccounts(dataset, windows.period, { minDays: 91 }),
    [dataset, windows],
  );

  /* ---------------- KPI numbers ---------------- */

  const writeOffNow = React.useMemo(
    () => statusRows.find((r) => r.paymentStatus === "Write-off")?.netPayable ?? 0,
    [statusRows],
  );
  const writeOffPrior = React.useMemo(
    () => priorStatusRows.find((r) => r.paymentStatus === "Write-off")?.netPayable ?? 0,
    [priorStatusRows],
  );

  const kpis = React.useMemo(() => {
    const collectionRate = safeShare(current.collected, current.net);
    const priorCollectionRate = safeShare(prior.collected, prior.net);
    const dailyNet = current.net / windows.days;
    const daysInAr = dailyNet > 0 ? current.balance / dailyNet : 0;
    const priorDailyNet = prior.net / Math.max(1, spanDays(windows.priorFrom, windows.priorTo));
    const priorDaysInAr = priorDailyNet > 0 ? prior.balance / priorDailyNet : 0;
    const writeOffRate = safeShare(writeOffNow, current.net);
    const priorWriteOffRate = safeShare(writeOffPrior, prior.net);

    /* Benchmarks are the trailing-12-month behaviour of the same measure —
       computed, never hard-coded, so the status tone can be audited. */
    const twelveGross = sum(monthlyAll, (m) => m.grossCharges);
    const twelveNet = sum(monthlyAll, (m) => m.netPayable);
    const twelveCollected = sum(monthlyAll, (m) => m.amountPaid);
    const twelveBalance = sum(monthlyAll, (m) => m.balance);
    const observedDays = sum(dataset.months, (m) => m.daysObserved) || 1;
    const grossBudget = (twelveGross / observedDays) * windows.days;
    const netBudget = (twelveNet / observedDays) * windows.days;
    const collectionBenchmark = safeShare(twelveCollected, twelveNet);
    const arBenchmark = twelveNet > 0 ? twelveBalance / (twelveNet / observedDays) : 0;
    const writeOffBenchmark = safeShare(
      sum(
        dataset.billings.filter((b) => b.paymentStatus === "Write-off"),
        (b) => b.netPayable,
      ),
      sum(dataset.billings, (b) => b.netPayable),
    );

    return {
      collectionRate,
      priorCollectionRate,
      daysInAr,
      priorDaysInAr,
      writeOffRate,
      priorWriteOffRate,
      grossBudget,
      netBudget,
      collectionBenchmark,
      arBenchmark,
      writeOffBenchmark,
    };
  }, [current, prior, windows, monthlyAll, dataset, writeOffNow, writeOffPrior]);

  const sparks = React.useMemo(
    () => ({
      gross: monthlyAll.map((m) => m.grossCharges),
      net: monthlyAll.map((m) => m.netPayable),
      collection: monthlyAll.map((m) => safeShare(m.amountPaid, m.netPayable)),
      balance: monthlyAll.map((m) => m.balance),
    }),
    [monthlyAll],
  );

  /* ---------------- chart controls ---------------- */

  const [showGhost, setShowGhost] = React.useState(true);
  const [payerView, setPayerView] = React.useState<"donut" | "ranked">("donut");
  const [payerSort, setPayerSort] = React.useState<"amount-desc" | "amount-asc" | "name">(
    "amount-desc",
  );
  const [payerTrendMode, setPayerTrendMode] = React.useState<"absolute" | "share">("absolute");
  const [deptSort, setDeptSort] = React.useState<DeptSortKey>("total-desc");
  const [deptMode, setDeptMode] = React.useState<"absolute" | "share">("absolute");
  const [arSort, setArSort] = React.useState<ArSortKey>("total-desc");
  const [arStacked, setArStacked] = React.useState(false);
  const [accountSort, setAccountSort] = React.useState<AccountSortKey>("days-desc");
  const [accountLimit, setAccountLimit] = React.useState(PAGE_SIZE);
  const [collectionDim, setCollectionDim] = React.useState<CollectionDimension>("payer");
  const [collectionMode, setCollectionMode] = React.useState<"line" | "stacked">("line");
  const [coverageSort, setCoverageSort] = React.useState<CoverageSortKey>("patients-desc");
  const [pwdSort, setPwdSort] = React.useState<PwdSortKey>("discount-desc");

  const sortedPayerRows = React.useMemo(() => {
    const rows = [...payerRows];
    switch (payerSort) {
      case "amount-asc":
        return rows.sort((a, b) => a.grossCharges - b.grossCharges);
      case "name":
        return rows.sort((a, b) => a.label.localeCompare(b.label));
      case "amount-desc":
      default:
        return rows.sort((a, b) => b.grossCharges - a.grossCharges);
    }
  }, [payerRows, payerSort]);

  const sortedDeptRows = React.useMemo(() => {
    const rows = [...deptRows];
    switch (deptSort) {
      case "total-asc":
        return rows.sort((a, b) => a.total - b.total);
      case "philhealth-desc":
        return rows.sort((a, b) => b.philhealthSharePct - a.philhealthSharePct);
      case "private-desc":
        return rows.sort((a, b) => b.privateSharePct - a.privateSharePct);
      case "collection-asc":
        return rows.sort((a, b) => a.collectionPct - b.collectionPct);
      case "name":
        return rows.sort((a, b) => a.department.localeCompare(b.department));
      case "total-desc":
      default:
        return rows.sort((a, b) => b.total - a.total);
    }
  }, [deptRows, deptSort]);

  const deptChartRows = React.useMemo(() => {
    if (deptMode === "absolute") return sortedDeptRows;
    return sortedDeptRows.map((row) => {
      const next: DeptPayerRow = { ...row };
      for (const payer of PAYER_ORDER) next[payer] = safeShare(row[payer], row.total);
      return next;
    });
  }, [sortedDeptRows, deptMode]);

  const sortedArRows = React.useMemo(() => {
    const rows = [...arRows];
    switch (arSort) {
      case "over90-desc":
        return rows.sort((a, b) => b.over90 - a.over90);
      case "over90pct-desc":
        return rows.sort((a, b) => b.over90Pct - a.over90Pct);
      case "name":
        return rows.sort((a, b) => a.label.localeCompare(b.label));
      case "total-desc":
      default:
        return rows.sort((a, b) => b.total - a.total);
    }
  }, [arRows, arSort]);

  const sortedAccounts = React.useMemo(() => {
    const rows = [...over90Accounts];
    switch (accountSort) {
      case "amount-desc":
        return rows.sort((a, b) => b.amount - a.amount);
      case "payer":
        return rows.sort((a, b) => a.payerLabel.localeCompare(b.payerLabel));
      case "patient":
        return rows.sort((a, b) => a.patient.localeCompare(b.patient));
      case "days-desc":
      default:
        return rows.sort((a, b) => b.daysOutstanding - a.daysOutstanding);
    }
  }, [over90Accounts, accountSort]);

  const sortedCoverageRows = React.useMemo(() => {
    const rows = [...coverageRows];
    switch (coverageSort) {
      case "revenue-desc":
        return rows.sort((a, b) => b.amountPaid - a.amountPaid);
      case "collection-asc":
        return rows.sort((a, b) => a.collectionPct - b.collectionPct);
      case "name":
        return rows.sort((a, b) => a.category.localeCompare(b.category));
      case "patients-desc":
      default:
        return rows.sort((a, b) => b.patients - a.patients);
    }
  }, [coverageRows, coverageSort]);

  const sortedPwdRows = React.useMemo(() => {
    const rows = [...pwdDeptRows];
    switch (pwdSort) {
      case "qualifying-desc":
        return rows.sort((a, b) => b.qualifyingAmount - a.qualifyingAmount);
      case "encounters-desc":
        return rows.sort((a, b) => b.discountedEncounters - a.discountedEncounters);
      case "name":
        return rows.sort((a, b) => a.department.localeCompare(b.department));
      case "discount-desc":
      default:
        return rows.sort((a, b) => b.discountAmount - a.discountAmount);
    }
  }, [pwdDeptRows, pwdSort]);

  /* ---------------- collection trend ---------------- */

  const collectionSeries = React.useMemo<{ key: string; label: string; color: string }[]>(() => {
    if (collectionDim === "payer") {
      return PAYER_ORDER.map((payer) => ({
        key: payer,
        label: PAYER_META[payer].label,
        color: PAYER_META[payer].color,
      }));
    }
    if (collectionDim === "department") {
      return dataset.departments.map((dept, i) => ({
        key: dept.id,
        label: dept.name,
        color:
          deptRows.find((r) => r.departmentId === dept.id)?.color ??
          [PALETTE.brand, PALETTE.philhealth, PALETTE.hmo, PALETTE.success, PALETTE.warning][
            i % 5
          ] ??
          PALETTE.brand,
      }));
    }
    return [
      { key: "Inpatient", label: "Inpatient", color: PALETTE.brand },
      { key: "Outpatient", label: "Outpatient", color: PALETTE.philhealth },
      { key: "Emergency", label: "Emergency", color: PALETTE.danger },
      { key: "Day Surgery", label: "Day Surgery", color: PALETTE.success },
    ];
  }, [collectionDim, dataset, deptRows]);

  const collectionRows = React.useMemo<CollectionRow[]>(() => {
    const base = revenueByMonth(dataset, windows.dimensionOnly);
    const series = collectionSeries.map((s) => {
      const filter: EncounterFilter = { ...windows.dimensionOnly };
      if (collectionDim === "payer") filter.payerTypes = [s.key as PayerType];
      else if (collectionDim === "department") filter.departmentIds = [s.key];
      else filter.encounterTypes = [s.key as "Inpatient"];
      return { key: s.key, rows: revenueByMonth(dataset, filter) };
    });
    return base.map((row, i) => {
      const point: CollectionRow = {
        month: row.month,
        label: row.monthLabel,
        isPartial: row.isPartial,
        target: row.netPayable,
        total: row.amountPaid,
      };
      for (const s of series) point[s.key] = s.rows[i]?.amountPaid ?? 0;
      return point;
    });
  }, [dataset, windows, collectionSeries, collectionDim]);

  /* ---------------- narrative callouts (computed, never authored) ----------- */

  const philhealthShift = React.useMemo(() => {
    const active = payerTrend.filter((m) => m.total > 0);
    const first = active[0];
    const last = active[active.length - 1];
    return {
      from: first ? safeShare(first.philhealth, first.total) : 0,
      to: last ? safeShare(last.philhealth, last.total) : 0,
      fromLabel: first?.label ?? "",
      toLabel: last?.label ?? "",
    };
  }, [payerTrend]);

  const indigentSponsoredPct = React.useMemo(() => {
    const total = sum(coverageRows, (r) => r.patients);
    const target = sum(
      coverageRows.filter((r) => r.category === "Indigent/4Ps" || r.category === "Sponsored"),
      (r) => r.patients,
    );
    return safeShare(target, total);
  }, [coverageRows]);

  const pwdTotals = React.useMemo(() => {
    const discounted = sum(pwdDeptRows, (r) => r.discountedEncounters);
    const qualifying = sum(pwdDeptRows, (r) => r.qualifyingAmount);
    const discount = sum(pwdDeptRows, (r) => r.discountAmount);
    const pwdPatients = new Set<string>();
    for (const enc of filterEncounters(dataset, windows.period)) {
      const patient = dataset.index.patientById.get(enc.patientId);
      if (patient?.isPWD) pwdPatients.add(patient.id);
    }
    return {
      discounted,
      qualifying,
      discount,
      vatExempt: sum(pwdDeptRows, (r) => r.vatExemptAmount),
      pwdPatients: pwdPatients.size,
      shareOfGross: safeShare(discount, current.gross),
    };
  }, [pwdDeptRows, dataset, windows, current.gross]);

  /* ---------------- table configs ---------------- */

  const deptTableColumns: ReportColumn<DeptPayerRow>[] = [
    { key: "department", header: "Department", sortable: true },
    {
      key: "total",
      header: "Gross charges",
      align: "right",
      sortable: true,
      render: (r) => php(r.total, { compact: true }),
    },
    {
      key: "encounters",
      header: "Encounters",
      align: "right",
      sortable: true,
      render: (r) => num(r.encounters),
    },
    {
      key: "philhealthSharePct",
      header: "PhilHealth share",
      align: "right",
      sortable: true,
      render: (r) => pct(r.philhealthSharePct),
    },
    {
      key: "privateSharePct",
      header: "Private-pay share",
      align: "right",
      sortable: true,
      render: (r) => pct(r.privateSharePct),
    },
    {
      key: "netPayable",
      header: "Net payable",
      align: "right",
      sortable: true,
      render: (r) => php(r.netPayable, { compact: true }),
    },
    {
      key: "amountPaid",
      header: "Collected",
      align: "right",
      sortable: true,
      render: (r) => php(r.amountPaid, { compact: true }),
    },
    {
      key: "collectionPct",
      header: "Collection %",
      align: "right",
      sortable: true,
      render: (r) => pct(r.collectionPct),
    },
  ];

  const payerTableColumns: ReportColumn<PayerRow>[] = [
    { key: "label", header: "Payer", sortable: true },
    {
      key: "grossCharges",
      header: "Gross charges",
      align: "right",
      sortable: true,
      render: (r) => php(r.grossCharges, { compact: true }),
    },
    {
      key: "sharePct",
      header: "% of gross",
      align: "right",
      sortable: true,
      render: (r) => pct(r.sharePct),
    },
    {
      key: "encounters",
      header: "Encounters",
      align: "right",
      sortable: true,
      render: (r) => num(r.encounters),
    },
    {
      key: "amountPaid",
      header: "Collected",
      align: "right",
      sortable: true,
      render: (r) => php(r.amountPaid, { compact: true }),
    },
    {
      key: "collectionPct",
      header: "Collection %",
      align: "right",
      sortable: true,
      render: (r) => pct(r.collectionPct),
    },
    {
      key: "balance",
      header: "Outstanding",
      align: "right",
      sortable: true,
      render: (r) => php(r.balance, { compact: true }),
    },
  ];

  const pwdTableColumns: ReportColumn<(typeof sortedPwdRows)[number]>[] = [
    { key: "department", header: "Department", sortable: true },
    {
      key: "discountedEncounters",
      header: "Discounted bills",
      align: "right",
      sortable: true,
      render: (r) => num(r.discountedEncounters),
    },
    {
      key: "qualifyingAmount",
      header: "Qualifying amount",
      align: "right",
      sortable: true,
      render: (r) => php(r.qualifyingAmount, { compact: true }),
    },
    {
      key: "discountAmount",
      header: "Discount absorbed",
      align: "right",
      sortable: true,
      render: (r) => php(r.discountAmount, { compact: true }),
    },
    {
      key: "vatExemptAmount",
      header: "VAT-exempt",
      align: "right",
      sortable: true,
      render: (r) => php(r.vatExemptAmount, { compact: true }),
    },
  ];

  const scopeLabel = `${windows.from} – ${windows.to} (${num(windows.days)} days)`;

  /* ---------------- render ---------------- */

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Financial Analysis — Revenue Cycle & Billing"
        description="Where charges become cash, where they leak, and which payers, departments and mandatory discounts drive the gap."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {isFiltered ? <StatusBadge tone="neutral">Global filters active</StatusBadge> : null}
            <StatusBadge tone="neutral">Billing Manager / Administrator view</StatusBadge>
          </div>
        }
      />

      <GlobalHospitalFilterBar />

      <p className="text-[11px] text-text-muted">
        Scope: <span className="font-medium text-text-secondary">{filters.dateRange.label}</span> ·{" "}
        {scopeLabel} · {num(current.encounters)} encounters, {php(current.gross, { compact: true })}{" "}
        gross charges. Deltas compare against the immediately preceding window of equal length (
        {windows.priorFrom} – {windows.priorTo}); 12-month trends and sparklines ignore the date
        filter but keep every other filter applied.
      </p>

      {/* ---------------------------------------------------------------- */}
      {/* KPI strip — audit: Modify (sparklines + visible benchmark bar)    */}
      {/* ---------------------------------------------------------------- */}
      <KpiStrip>
        <TrendKpiCard
          label="Gross Revenue"
          value={php(current.gross, { compact: true })}
          delta={deltaPct(current.gross, prior.gross)}
          status={current.gross >= kpis.grossBudget ? "good" : "warning"}
          icon={CircleDollarSign}
          trend={sparks.gross}
          actual={current.gross}
          benchmark={kpis.grossBudget}
          benchmarkLabel={`Run-rate benchmark ${php(kpis.grossBudget, { compact: true })}`}
          scaleMax={Math.max(current.gross, kpis.grossBudget)}
          note="Benchmark = trailing 12-month gross per observed day × this window"
          onClick={() => setDrill({ kind: "kpi", id: "gross" })}
        />
        <TrendKpiCard
          label="Net Revenue (after deductions)"
          value={php(current.net, { compact: true })}
          delta={deltaPct(current.net, prior.net)}
          status={current.net >= kpis.netBudget ? "good" : "warning"}
          icon={PiggyBank}
          trend={sparks.net}
          actual={current.net}
          benchmark={kpis.netBudget}
          benchmarkLabel={`Run-rate benchmark ${php(kpis.netBudget, { compact: true })}`}
          scaleMax={Math.max(current.net, kpis.netBudget)}
          note={`After ${php(current.philhealthDeduction, { compact: true })} PhilHealth benefit and ${php(current.pwdDiscount, { compact: true })} PWD discount`}
          onClick={() => setDrill({ kind: "kpi", id: "net" })}
        />
        <TrendKpiCard
          label="Collection Rate"
          value={pct(kpis.collectionRate)}
          delta={kpis.collectionRate - kpis.priorCollectionRate}
          status={collectionStatus(kpis.collectionRate)}
          icon={Receipt}
          trend={sparks.collection}
          actual={kpis.collectionRate}
          benchmark={kpis.collectionBenchmark}
          benchmarkLabel={`12-month hospital rate ${pct(kpis.collectionBenchmark)}`}
          scaleMax={100}
          note="Amount paid divided by net payable on bills raised in this window"
          onClick={() => setDrill({ kind: "kpi", id: "collection" })}
        />
        <TrendKpiCard
          label="Days in AR"
          value={`${kpis.daysInAr.toFixed(1)}d`}
          delta={deltaPct(kpis.daysInAr, kpis.priorDaysInAr)}
          invertDelta
          status={daysInArStatus(kpis.daysInAr, kpis.arBenchmark)}
          icon={CalendarClock}
          trend={sparks.balance}
          actual={kpis.daysInAr}
          benchmark={kpis.arBenchmark}
          benchmarkLabel={`12-month hospital level ${kpis.arBenchmark.toFixed(1)}d`}
          scaleMax={Math.max(kpis.daysInAr, kpis.arBenchmark)}
          note="Outstanding balance divided by average daily net payable"
          onClick={() => setDrill({ kind: "kpi", id: "ar" })}
        />
        <TrendKpiCard
          label="Write-off Rate"
          value={pct(kpis.writeOffRate)}
          delta={kpis.writeOffRate - kpis.priorWriteOffRate}
          invertDelta
          status={writeOffStatus(kpis.writeOffRate, kpis.writeOffBenchmark)}
          icon={TrendingDown}
          trend={sparks.balance}
          actual={kpis.writeOffRate}
          benchmark={kpis.writeOffBenchmark}
          benchmarkLabel={`12-month hospital rate ${pct(kpis.writeOffBenchmark)}`}
          scaleMax={Math.max(kpis.writeOffRate, kpis.writeOffBenchmark, 1)}
          note="Net payable on Write-off bills as a share of all net payable"
          onClick={() => setDrill({ kind: "kpi", id: "writeoff" })}
        />
      </KpiStrip>

      {/* ---------------------------------------------------------------- */}
      {/* Gross-to-net bridge — audit: Keep (+ % retained, ghost, tooltip)  */}
      {/* ---------------------------------------------------------------- */}
      <PanelCard
        title="Gross-to-Net Revenue Bridge"
        description="Charges through mandatory deductions to cash collected. Every bar sums the same Billing columns, so the bridge closes exactly. Click a bar to itemise it."
        action={
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[10px]"
            onClick={() => setShowGhost((v) => !v)}
          >
            {showGhost ? "Hide prior period" : "Show prior period"}
          </Button>
        }
      >
        {current.gross === 0 ? (
          <EmptyPanel label="No billed encounters match the current filters." />
        ) : (
          <>
            <div className="h-[22rem]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={waterfall} margin={{ left: 4, right: 16, top: 12, bottom: 56 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.35} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    interval={0}
                    angle={-18}
                    textAnchor="end"
                    height={64}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    width={58}
                    tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(1)}M`}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(68,84,195,0.06)" }}
                    content={<WaterfallTooltip />}
                  />
                  {showGhost ? (
                    <>
                      <Bar
                        dataKey="priorBase"
                        stackId="prior"
                        fill="transparent"
                        isAnimationActive={false}
                      />
                      <Bar
                        dataKey="priorValue"
                        stackId="prior"
                        name="Prior period"
                        fill={PALETTE.neutral}
                        fillOpacity={0.35}
                        radius={[3, 3, 0, 0]}
                        isAnimationActive={false}
                      />
                    </>
                  ) : null}
                  <Bar dataKey="base" stackId="cur" fill="transparent" isAnimationActive={false} />
                  <Bar
                    dataKey="value"
                    stackId="cur"
                    name="This period"
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    onClick={(entry: unknown) => {
                      const row = entry as { payload?: WaterfallStep } & WaterfallStep;
                      const key = row.payload?.key ?? row.key;
                      if (key) setDrill({ kind: "waterfall", step: key });
                    }}
                  >
                    {waterfall.map((step) => (
                      <Cell
                        key={step.key}
                        fill={
                          step.kind === "deduction"
                            ? PALETTE.danger
                            : step.kind === "end"
                              ? PALETTE.success
                              : step.kind === "subtotal"
                                ? PALETTE.brandLight
                                : PALETTE.brand
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 grid gap-1 sm:grid-cols-3 lg:grid-cols-6">
              {waterfall.map((step) => (
                <div key={step.key} className="rounded-md border border-border px-2 py-1.5">
                  <div className="text-[10px] text-text-muted">{step.label}</div>
                  <div className="text-xs font-semibold text-text-primary">
                    {step.kind === "deduction" ? "−" : ""}
                    {php(step.value, { compact: true })}
                  </div>
                  <div className="text-[10px] text-text-muted">
                    {pct(step.retainedPct)} of gross retained
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <LegendDot color={PALETTE.brand} label="Gross charges" />
              <LegendDot color={PALETTE.danger} label="Deductions / leakage" />
              <LegendDot color={PALETTE.brandLight} label="Net payable" />
              <LegendDot color={PALETTE.success} label="Cash collected" />
              {showGhost ? (
                <LegendDot color={PALETTE.neutral} label="Prior period (ghost)" />
              ) : null}
            </div>
          </>
        )}
      </PanelCard>

      {/* ---------------------------------------------------------------- */}
      {/* Payer mix — audit: Modify (drill-down parity, % of total, sort,   */}
      {/* ranked-bar alternate view). Payer trend sub-panel — audit: Keep   */}
      {/* (+ 100%-stacked toggle, narrative callout preserved).             */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid gap-4 xl:grid-cols-2">
        <InteractiveChartCard<PayerRow>
          title="Payer Mix"
          description="Share of gross charges by payer, from the canonical payerMix() aggregation the Executive page also reads. Click any slice, legend row or bar to drill through to departments and bills."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <ControlSelect
                label="View"
                value={payerView}
                onChange={setPayerView}
                width="w-[8.5rem]"
                options={[
                  { value: "donut", label: "Donut" },
                  { value: "ranked", label: "Ranked bar" },
                ]}
              />
              <ControlSelect
                label="Sort"
                value={payerSort}
                onChange={setPayerSort}
                width="w-[10.5rem]"
                options={[
                  { value: "amount-desc", label: "Largest first" },
                  { value: "amount-asc", label: "Smallest first" },
                  { value: "name", label: "Payer A–Z" },
                ]}
              />
            </div>
          }
          table={{ columns: payerTableColumns, rows: sortedPayerRows }}
          onRowClickInTable={(row) => setDrill({ kind: "payer", payer: row.payerType })}
        >
          {sortedPayerRows.length === 0 ? (
            <EmptyPanel label="No billed encounters match the current filters." />
          ) : (
            <>
              {payerView === "donut" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="relative h-[14rem]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sortedPayerRows}
                          dataKey="grossCharges"
                          nameKey="label"
                          innerRadius={58}
                          outerRadius={88}
                          paddingAngle={2}
                          cursor="pointer"
                          onClick={(entry: unknown) => {
                            const row = entry as { payload?: PayerRow } & PayerRow;
                            const payer = row.payload?.payerType ?? row.payerType;
                            if (payer) setDrill({ kind: "payer", payer });
                          }}
                        >
                          {sortedPayerRows.map((row) => (
                            <Cell key={row.payerType} fill={row.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<PayerTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-x-0 top-[42%] text-center">
                      <div className="text-xs text-text-muted">Gross</div>
                      <div className="text-sm font-semibold text-text-primary">
                        {php(current.gross, { compact: true })}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col justify-center gap-1">
                    {sortedPayerRows.map((row) => (
                      <button
                        key={row.payerType}
                        onClick={() => setDrill({ kind: "payer", payer: row.payerType })}
                        className="flex items-center justify-between gap-2 rounded px-1 py-0.5 text-left hover:bg-muted"
                      >
                        <LegendDot color={row.color} label={row.label} />
                        <span className="text-xs font-medium text-text-primary">
                          {php(row.grossCharges, { compact: true })}
                          <span className="ml-1 font-normal text-text-muted">
                            ({pct(row.sharePct)})
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[14rem]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={sortedPayerRows}
                      layout="vertical"
                      margin={{ top: 4, right: 24, bottom: 8, left: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.35} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(1)}M`}
                      />
                      <YAxis type="category" dataKey="label" width={92} tick={{ fontSize: 10 }} />
                      <Tooltip
                        cursor={{ fill: "rgba(68,84,195,0.06)" }}
                        content={<PayerTooltip />}
                      />
                      <Bar
                        dataKey="grossCharges"
                        radius={[0, 4, 4, 0]}
                        cursor="pointer"
                        onClick={(entry: unknown) => {
                          const row = entry as { payload?: PayerRow } & PayerRow;
                          const payer = row.payload?.payerType ?? row.payerType;
                          if (payer) setDrill({ kind: "payer", payer });
                        }}
                      >
                        {sortedPayerRows.map((row) => (
                          <Cell key={row.payerType} fill={row.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="mt-3 space-y-2 border-t border-border pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-text-muted">
                    Payer mix over the full 12-month window (date filter not applied)
                  </p>
                  <ControlSelect
                    label="Scale"
                    value={payerTrendMode}
                    onChange={setPayerTrendMode}
                    width="w-[10rem]"
                    options={[
                      { value: "absolute", label: "Absolute PHP" },
                      { value: "share", label: "100% stacked" },
                    ]}
                  />
                </div>
                <div className="h-[10rem]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={
                        payerTrendMode === "absolute"
                          ? payerTrend
                          : payerTrend.map((row) => {
                              const next: MonthlyPayerRow = { ...row };
                              for (const payer of PAYER_ORDER)
                                next[payer] = safeShare(row[payer], row.total);
                              return next;
                            })
                      }
                      margin={{ left: -8, right: 8, top: 4, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.35} />
                      <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={0} />
                      <YAxis
                        tick={{ fontSize: 9 }}
                        width={48}
                        tickFormatter={(v: number) =>
                          payerTrendMode === "absolute"
                            ? `${(v / 1_000_000).toFixed(0)}M`
                            : `${v.toFixed(0)}%`
                        }
                      />
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8 }}
                        formatter={(v: number, n: string) => [
                          payerTrendMode === "absolute" ? php(v, { compact: true }) : pct(v),
                          n,
                        ]}
                      />
                      {PAYER_ORDER.map((payer) => (
                        <Bar
                          key={payer}
                          stackId="payer"
                          dataKey={payer}
                          name={PAYER_META[payer].label}
                          fill={PAYER_META[payer].color}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="rounded-md border border-brand/30 bg-brand/5 p-2 text-xs text-text-secondary">
                  PhilHealth share of gross charges moved from{" "}
                  <span className="font-semibold text-brand">{pct(philhealthShift.from)}</span> (
                  {philhealthShift.fromLabel}) to{" "}
                  <span className="font-semibold text-brand">{pct(philhealthShift.to)}</span> (
                  {philhealthShift.toLabel}). Recomputed from the data on every filter change.
                </div>
              </div>
            </>
          )}
        </InteractiveChartCard>

        {/* -------------------------------------------------------------- */}
        {/* Revenue by department — audit: Keep (+ user sort, 100% toggle,  */}
        {/* collection overlay so size and profitability separate)          */}
        {/* -------------------------------------------------------------- */}
        <InteractiveChartCard<DeptPayerRow>
          title="Revenue by Department / Service Line"
          description="Department × payer gross charges. Switch to 100% stacked to compare payer mix independently of department size; the sort is a control now, not a hard-coded order."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <ControlSelect
                label="Scale"
                value={deptMode}
                onChange={setDeptMode}
                width="w-[10rem]"
                options={[
                  { value: "absolute", label: "Absolute PHP" },
                  { value: "share", label: "100% stacked" },
                ]}
              />
              <ControlSelect
                label="Sort"
                value={deptSort}
                onChange={setDeptSort}
                width="w-[13.5rem]"
                options={[
                  { value: "total-desc", label: "Highest revenue" },
                  { value: "total-asc", label: "Lowest revenue" },
                  { value: "philhealth-desc", label: "Most PhilHealth-dependent" },
                  { value: "private-desc", label: "Most private-pay" },
                  { value: "collection-asc", label: "Worst collection rate" },
                  { value: "name", label: "Department A–Z" },
                ]}
              />
            </div>
          }
          table={{ columns: deptTableColumns, rows: sortedDeptRows }}
          onRowClickInTable={(row) =>
            setDrill({ kind: "department", departmentId: row.departmentId })
          }
        >
          {deptChartRows.length === 0 ? (
            <EmptyPanel label="No departments match the current filters." />
          ) : (
            <>
              <div className="h-[24rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={deptChartRows}
                    layout="vertical"
                    margin={{ top: 4, right: 20, bottom: 8, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.35} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v: number) =>
                        deptMode === "absolute"
                          ? `${(v / 1_000_000).toFixed(1)}M`
                          : `${v.toFixed(0)}%`
                      }
                      {...(deptMode === "share" ? { domain: [0, 100] as [number, number] } : {})}
                    />
                    <YAxis
                      type="category"
                      dataKey="department"
                      width={116}
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(68,84,195,0.06)" }}
                      content={<DeptRevenueTooltip hundredPct={deptMode === "share"} />}
                    />
                    {PAYER_ORDER.map((payer, i) => (
                      <Bar
                        key={payer}
                        stackId="dept"
                        dataKey={payer}
                        name={PAYER_META[payer].label}
                        fill={PAYER_META[payer].color}
                        cursor="pointer"
                        {...(i === PAYER_ORDER.length - 1
                          ? { radius: [0, 4, 4, 0] as [number, number, number, number] }
                          : {})}
                        onClick={(entry: unknown) => {
                          const row = entry as { payload?: DeptPayerRow } & DeptPayerRow;
                          const departmentId = row.payload?.departmentId ?? row.departmentId;
                          if (departmentId) setDrill({ kind: "department", departmentId });
                        }}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {PAYER_ORDER.map((payer) => (
                  <LegendDot
                    key={payer}
                    color={PAYER_META[payer].color}
                    label={PAYER_META[payer].label}
                  />
                ))}
              </div>
            </>
          )}
        </InteractiveChartCard>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Accounts receivable                                              */}
      {/* ---------------------------------------------------------------- */}
      <SectionTitle
        title="Accounts receivable"
        description="Aging exposure, the accounts behind it, and whether collections are keeping pace with what we bill."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {/* AR aging — audit: Keep (+ stacked/grouped toggle, >90 share
            label, sorting, and the drill-down the panel never had). */}
        <PanelCard
          title="AR Aging by Payer"
          description="Outstanding balance by bill age. The >90-day share is labelled per payer because that is the collection-risk number leadership asks for. Click any segment for the accounts behind it."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <ControlSelect
                label="Bars"
                value={arStacked ? "stacked" : "grouped"}
                onChange={(v) => setArStacked(v === "stacked")}
                width="w-[9.5rem]"
                options={[
                  { value: "grouped", label: "Grouped" },
                  { value: "stacked", label: "Stacked (total)" },
                ]}
              />
              <ControlSelect
                label="Sort"
                value={arSort}
                onChange={setArSort}
                width="w-[12.5rem]"
                options={[
                  { value: "total-desc", label: "Largest total AR" },
                  { value: "over90-desc", label: "Largest >90 exposure" },
                  { value: "over90pct-desc", label: "Worst >90 share" },
                  { value: "name", label: "Payer A–Z" },
                ]}
              />
            </div>
          }
        >
          {sortedArRows.length === 0 ? (
            <EmptyPanel label="No open balances match the current filters." />
          ) : (
            <>
              <div className="h-[17rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sortedArRows} margin={{ left: -8, right: 8, top: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.35} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      width={54}
                      tickFormatter={(v: number) => `${(v / 1_000).toFixed(0)}K`}
                    />
                    <Tooltip cursor={{ fill: "rgba(68,84,195,0.06)" }} content={<ArTooltip />} />
                    {AGING_BUCKETS.map((bucket) => (
                      <Bar
                        key={bucket.key}
                        dataKey={bucket.key}
                        name={bucket.label}
                        fill={bucket.color}
                        radius={[3, 3, 0, 0]}
                        cursor="pointer"
                        {...(arStacked ? { stackId: "ar" } : {})}
                        onClick={(entry: unknown) => {
                          const row = entry as { payload?: ArRow } & ArRow;
                          const payer = row.payload?.payerType ?? row.payerType;
                          if (payer) setDrill({ kind: "arBucket", payer, bucket: bucket.key });
                        }}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap gap-3">
                {AGING_BUCKETS.map((bucket) => (
                  <LegendDot key={bucket.key} color={bucket.color} label={bucket.label} />
                ))}
              </div>
              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                {sortedArRows.map((row) => (
                  <div
                    key={row.payerType}
                    className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1 text-[11px]"
                  >
                    <span className="text-text-secondary">{row.label}</span>
                    <span className="text-text-muted">
                      total {php(row.total, { compact: true })} ·{" "}
                      <span
                        className={cn(
                          "font-semibold",
                          row.over90Pct >= 40 ? "text-danger" : "text-text-primary",
                        )}
                      >
                        {pct(row.over90Pct)} over 90d
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </PanelCard>

        {/* Collection trend — audit: Keep (+ per-period targets, stacked
            mode; the "staff/agent" dimension is dropped because the shared
            dataset has no collection-agent entity to attribute it to). */}
        <PanelCard
          title="Collection Trend"
          description="Cash collected each month against that month's own billed net payable — a per-period target read from the data, not a flat line."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <ControlSelect
                label="Break down by"
                value={collectionDim}
                onChange={setCollectionDim}
                width="w-[11rem]"
                options={[
                  { value: "payer", label: "Payer" },
                  { value: "department", label: "Department" },
                  { value: "encounterType", label: "Encounter type" },
                ]}
              />
              <ControlSelect
                label="Mode"
                value={collectionMode}
                onChange={setCollectionMode}
                width="w-[10rem]"
                options={[
                  { value: "line", label: "Lines" },
                  { value: "stacked", label: "Stacked area" },
                ]}
              />
            </div>
          }
        >
          <div className="h-[19rem]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={collectionRows}
                margin={{ left: -8, right: 12, top: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.35} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} />
                <YAxis
                  tick={{ fontSize: 10 }}
                  width={54}
                  tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(1)}M`}
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(v: number, n: string) => [php(v, { compact: true }), n]}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line
                  type="monotone"
                  dataKey="target"
                  name="Billed net payable (target)"
                  stroke={PALETTE.neutral}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                />
                {collectionMode === "stacked"
                  ? collectionSeries.map((s) => (
                      <Area
                        key={s.key}
                        type="monotone"
                        stackId="collect"
                        dataKey={s.key}
                        name={s.label}
                        stroke={s.color}
                        fill={s.color}
                        fillOpacity={0.45}
                      />
                    ))
                  : collectionSeries.map((s) => (
                      <Line
                        key={s.key}
                        type="monotone"
                        dataKey={s.key}
                        name={s.label}
                        stroke={s.color}
                        strokeWidth={1.75}
                        dot={false}
                      />
                    ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] text-text-muted">
            Trailing 12 months, date filter not applied. The target line is that month&apos;s billed
            net payable, so the gap between the dashed line and the stack is unrecovered revenue for
            bills raised in the same month.
          </p>
        </PanelCard>
      </div>

      {/* AR >90 detail — audit: Modify (sorting, paging, the action column
          that was fetched but never rendered, and an aging colour band). */}
      <PanelCard
        title="Open accounts over 90 days"
        description={`${num(over90Accounts.length)} accounts · ${php(
          sum(over90Accounts, (r) => r.amount),
          { compact: true },
        )} outstanding. Sortable, pageable, and every row opens the bill behind it.`}
        action={
          <ControlSelect
            label="Sort"
            value={accountSort}
            onChange={setAccountSort}
            width="w-[12.5rem]"
            options={[
              { value: "days-desc", label: "Oldest first" },
              { value: "amount-desc", label: "Largest balance first" },
              { value: "payer", label: "Payer A–Z" },
              { value: "patient", label: "Patient A–Z" },
            ]}
          />
        }
      >
        {sortedAccounts.length === 0 ? (
          <EmptyPanel label="No account is more than 90 days outstanding in this window." />
        ) : (
          <>
            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px]">Patient</TableHead>
                    <TableHead className="text-[11px]">Department</TableHead>
                    <TableHead className="text-[11px]">Payer</TableHead>
                    <TableHead className="text-right text-[11px]">Days</TableHead>
                    <TableHead className="text-right text-[11px]">Balance</TableHead>
                    <TableHead className="text-[11px]">Last billing action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedAccounts.slice(0, accountLimit).map((row) => (
                    <TableRow
                      key={row.encounterId}
                      className="cursor-pointer hover:bg-muted/60"
                      onClick={() => setDrill({ kind: "account", encounterId: row.encounterId })}
                    >
                      <TableCell className="text-xs">
                        <div className="font-medium text-text-primary">{row.patient}</div>
                        <div className="text-[10px] text-text-muted">
                          {row.encounterId} · bill {row.billingId}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-text-secondary">
                        {row.department}
                      </TableCell>
                      <TableCell className="text-xs text-text-secondary">
                        {row.payerLabel}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 font-semibold",
                            row.daysOutstanding > 180
                              ? "bg-danger/15 text-danger"
                              : row.daysOutstanding > 120
                                ? "bg-warning/15 text-warning"
                                : "bg-muted text-text-secondary",
                          )}
                        >
                          {num(row.daysOutstanding)}d
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs font-medium">
                        {php(row.amount, { compact: true })}
                      </TableCell>
                      <TableCell className="text-[11px] text-text-muted">
                        {row.lastAction}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {accountLimit < sortedAccounts.length ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-2 h-7 text-[11px]"
                onClick={() => setAccountLimit((v) => v + PAGE_SIZE)}
              >
                Show {Math.min(PAGE_SIZE, sortedAccounts.length - accountLimit)} more of{" "}
                {num(sortedAccounts.length)}
              </Button>
            ) : null}
          </>
        )}
      </PanelCard>

      {/* Unbilled/uncollected funnel — audit: Keep (+ PHP value per stage,
          average age of the encounters sitting there, drop-off colour). */}
      <PanelCard
        title="Revenue Cycle Funnel"
        description="Where encounters stop converting into cash. The bar width is encounter count; the right-hand figures are the money and the average age of what is stuck at that stage. Click a stage for the worklist."
      >
        {funnel[0] && funnel[0].count > 0 ? (
          <div className="space-y-2">
            {funnel.map((stage, i) => {
              const width = Math.max(8, safeShare(stage.count, funnel[0]?.count ?? 1));
              return (
                <button
                  key={stage.key}
                  onClick={() => setDrill({ kind: "funnel", stage: stage.key })}
                  className="block w-full rounded-md p-1 text-left hover:bg-muted"
                >
                  <div className="mb-0.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-text-primary">{stage.label}</span>
                    <span className="text-text-secondary">
                      {num(stage.count)} encounters · {php(stage.value, { compact: true })} net
                      {i > 0 ? (
                        <span
                          className={cn(
                            "ml-2 font-semibold",
                            stage.dropOffPct > 15 ? "text-danger" : "text-text-muted",
                          )}
                        >
                          −{num(stage.dropOffCount)} ({pct(stage.dropOffPct)})
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="h-6 w-full rounded-md bg-muted">
                    <div
                      className="h-6 rounded-md transition-all hover:opacity-80"
                      style={{
                        width: `${width}%`,
                        backgroundColor: PALETTE.brand,
                        opacity: 0.4 + (i / Math.max(1, funnel.length)) * 0.6,
                      }}
                    />
                  </div>
                  {stage.stuckCount > 0 ? (
                    <div className="mt-0.5 text-[10px] text-text-muted">
                      {num(stage.stuckCount)} sitting here ·{" "}
                      {php(stage.stuckValue, { compact: true })} unrecovered · average{" "}
                      <span
                        className={cn(
                          "font-semibold",
                          stage.avgAgeDays > 90 ? "text-danger" : "text-text-secondary",
                        )}
                      >
                        {stage.avgAgeDays.toFixed(1)} days
                      </span>{" "}
                      old
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyPanel label="No encounters match the current filters." />
        )}
      </PanelCard>

      {/* ---------------------------------------------------------------- */}
      {/* Patient financial profile                                        */}
      {/* ---------------------------------------------------------------- */}
      <SectionTitle
        title="Patient financial profile"
        description="Who we serve, what we actually collect from them, and the mandatory discounts we absorb."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Coverage — audit: Modify (headcount and collected PHP shown
            together as a paired bar; the Indigent/Sponsored callout kept). */}
        <PanelCard
          title="PhilHealth Coverage Distribution"
          description="Membership category of billed patients (bars, left axis) against what was actually collected from them (line, right axis) — so 'who we serve' and 'what we collect' read in one view."
          action={
            <ControlSelect
              label="Sort"
              value={coverageSort}
              onChange={setCoverageSort}
              width="w-[13rem]"
              options={[
                { value: "patients-desc", label: "Most patients" },
                { value: "revenue-desc", label: "Most collected" },
                { value: "collection-asc", label: "Worst collection rate" },
                { value: "name", label: "Category A–Z" },
              ]}
            />
          }
        >
          {sortedCoverageRows.length === 0 ? (
            <EmptyPanel label="No billed patients match the current filters." />
          ) : (
            <>
              <div className="h-[19rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={sortedCoverageRows}
                    margin={{ left: -8, right: 8, top: 8, bottom: 56 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.35} />
                    <XAxis
                      dataKey="category"
                      tick={{ fontSize: 9 }}
                      interval={0}
                      angle={-28}
                      textAnchor="end"
                      height={64}
                    />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} width={40} />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 10 }}
                      width={52}
                      tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(1)}M`}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(68,84,195,0.06)" }}
                      contentStyle={{ fontSize: 11, borderRadius: 8 }}
                      formatter={(v: number, n: string) => [
                        n === "Patients" ? num(v) : php(v, { compact: true }),
                        n,
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar
                      yAxisId="left"
                      dataKey="patients"
                      name="Patients"
                      fill={PALETTE.brandLight}
                      radius={[3, 3, 0, 0]}
                      cursor="pointer"
                      onClick={(entry: unknown) => {
                        const row = entry as { payload?: CoverageRow } & CoverageRow;
                        const category = row.payload?.category ?? row.category;
                        if (category) setDrill({ kind: "coverage", category });
                      }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="amountPaid"
                      name="Collected"
                      stroke={PALETTE.success}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 rounded-md border border-brand/30 bg-brand/5 p-2 text-xs text-text-secondary">
                <span className="font-semibold text-brand">{pct(indigentSponsoredPct)}</span> of
                billed patients in this window are Indigent/4Ps or Sponsored members — prioritise
                social-welfare referral and financial counselling for this segment to protect the
                collection rate.
              </div>
            </>
          )}
        </PanelCard>

        {/* PWD by department — the supervisor's explicit ask. Sourced from
            pwdDiscountByDepartment(), i.e. the PWDDiscount table, which only
            exists for Patient.isPWD === true bills. No rate is applied here. */}
        <InteractiveChartCard<(typeof sortedPwdRows)[number]>
          title="PWD Mandatory Discount by Department"
          description="Statutory RA 10754 discount actually applied, per department. Sourced row-by-row from the PWDDiscount table — a department only appears here if a PWD-flagged patient had a qualifying bill in it."
          action={
            <ControlSelect
              label="Sort"
              value={pwdSort}
              onChange={setPwdSort}
              width="w-[13rem]"
              options={[
                { value: "discount-desc", label: "Largest discount absorbed" },
                { value: "qualifying-desc", label: "Largest qualifying amount" },
                { value: "encounters-desc", label: "Most discounted bills" },
                { value: "name", label: "Department A–Z" },
              ]}
            />
          }
          table={{ columns: pwdTableColumns, rows: sortedPwdRows }}
          onRowClickInTable={(row) =>
            setDrill({ kind: "pwdDepartment", departmentId: row.departmentId })
          }
        >
          {sortedPwdRows.length === 0 ? (
            <EmptyPanel label="No PWD-qualifying bills in this window — nothing to show, and nothing is inferred." />
          ) : (
            <>
              <div className="h-[17rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={sortedPwdRows}
                    layout="vertical"
                    margin={{ top: 4, right: 24, bottom: 8, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.35} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v: number) => `${(v / 1_000).toFixed(0)}K`}
                    />
                    <YAxis
                      type="category"
                      dataKey="department"
                      width={116}
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip cursor={{ fill: "rgba(68,84,195,0.06)" }} content={<PwdTooltip />} />
                    <Bar
                      dataKey="qualifyingAmount"
                      name="Qualifying amount"
                      fill={PALETTE.brandLighter}
                      radius={[0, 3, 3, 0]}
                      cursor="pointer"
                      onClick={(entry: unknown) => {
                        const row = entry as { payload?: { departmentId: string } };
                        const id = row.payload?.departmentId;
                        if (id) setDrill({ kind: "pwdDepartment", departmentId: id });
                      }}
                    />
                    <Bar
                      dataKey="discountAmount"
                      name="Discount absorbed"
                      fill={PALETTE.scpwd}
                      radius={[0, 3, 3, 0]}
                      cursor="pointer"
                      onClick={(entry: unknown) => {
                        const row = entry as { payload?: { departmentId: string } };
                        const id = row.payload?.departmentId;
                        if (id) setDrill({ kind: "pwdDepartment", departmentId: id });
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <LegendDot color={PALETTE.brandLighter} label="Qualifying amount" />
                <LegendDot color={PALETTE.scpwd} label="Discount absorbed" />
              </div>
              <div className="mt-2 rounded-md border border-brand/30 bg-brand/5 p-2 text-[11px] text-text-secondary">
                {num(pwdTotals.discounted)} bills across {num(pwdTotals.pwdPatients)} PWD-flagged
                patients carried a discount, on {php(pwdTotals.qualifying, { compact: true })} of
                qualifying charges — {php(pwdTotals.discount, { compact: true })} absorbed, which is{" "}
                {pct(pwdTotals.shareOfGross)} of gross charges. Room &amp; Board is excluded from
                qualifying categories, which is why the qualifying amount is well below gross.
              </div>
            </>
          )}
        </InteractiveChartCard>
      </div>

      {/* PWD monthly impact — audit: Keep (+ derived discount-per-bill
          series and the statutory 20% rate shown from PWD_DISCOUNT_RATE). */}
      <PanelCard
        title="PWD Discount Volume & Impact"
        description="Discounted bills per month (bars, left axis) against the discount absorbed and the derived discount per bill (lines, right axis) — so a rise driven by more PWD patients is distinguishable from a rise in average discount."
        action={
          <StatusBadge tone="neutral">
            Statutory rate {(PWD_DISCOUNT_RATE * 100).toFixed(0)}% (RA 10754)
          </StatusBadge>
        }
      >
        <div className="h-[19rem]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={pwdMonths} margin={{ left: -8, right: 12, top: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.35} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} width={40} />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10 }}
                width={54}
                tickFormatter={(v: number) => `${(v / 1_000).toFixed(0)}K`}
              />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8 }}
                formatter={(v: number, n: string) => [
                  n === "Discounted bills" || n === "PWD patients"
                    ? num(v)
                    : php(v, { compact: true }),
                  n,
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar
                yAxisId="left"
                dataKey="discountedEncounters"
                name="Discounted bills"
                fill={PALETTE.scpwd}
                radius={[3, 3, 0, 0]}
                cursor="pointer"
                onClick={(entry: unknown) => {
                  const row = entry as { payload?: PwdMonthRow };
                  const month = row.payload?.month;
                  if (month) setDrill({ kind: "pwdMonth", month });
                }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="discountAmount"
                name="Discount absorbed"
                stroke={PALETTE.brand}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="discountPerEncounter"
                name="Discount per bill"
                stroke={PALETTE.warning}
                strokeWidth={1.75}
                strokeDasharray="4 3"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[11px] text-text-muted">
          Trailing 12 months, date filter not applied. Every point counts `PWDDiscount` rows, so a
          month with no PWD-qualifying bill reads as zero rather than as an estimated rate. The
          SC/PWD <em>payer</em> bucket in the payer-mix charts is a broader population (senior
          citizens included) and is deliberately not mixed into this panel.
        </p>
      </PanelCard>

      <RevenueDrawer
        dataset={dataset}
        drill={drill}
        onClose={() => setDrill(null)}
        period={windows.period}
        scopeLabel={scopeLabel}
        filterLabel={isFiltered ? "Global filters applied" : "All departments"}
        totals={current}
        waterfall={waterfall}
        payerRows={payerRows}
        deptRows={deptRows}
        arRows={arRows}
        statusRows={statusRows}
        funnel={funnel}
        coverageRows={coverageRows}
        pwdDeptRows={pwdDeptRows}
        pwdMonths={pwdMonths}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Drill-down drawer                                                   */
/* ------------------------------------------------------------------ */

const ACCOUNT_EXPORT_COLUMNS = [
  { header: "Encounter", get: (row: unknown) => (row as ArAccountRow).encounterId },
  { header: "Bill", get: (row: unknown) => (row as ArAccountRow).billingId },
  { header: "Patient", get: (row: unknown) => (row as ArAccountRow).patient },
  { header: "Department", get: (row: unknown) => (row as ArAccountRow).department },
  { header: "Payer", get: (row: unknown) => (row as ArAccountRow).payerLabel },
  {
    header: "Days outstanding",
    get: (row: unknown) => String((row as ArAccountRow).daysOutstanding),
  },
  { header: "Balance", get: (row: unknown) => String((row as ArAccountRow).amount) },
  { header: "Payment status", get: (row: unknown) => (row as ArAccountRow).paymentStatus },
];

function AccountTable({ rows }: { rows: ArAccountRow[] }) {
  if (rows.length === 0)
    return <p className="text-xs text-text-muted">No accounts in this slice.</p>;
  const shown = rows.slice(0, DRAWER_ROW_LIMIT);
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-text-muted">
        Showing {num(shown.length)} of {num(rows.length)} accounts, oldest first.
      </p>
      <div className="max-h-[24rem] overflow-y-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[11px]">Patient</TableHead>
              <TableHead className="text-[11px]">Payer</TableHead>
              <TableHead className="text-right text-[11px]">Days</TableHead>
              <TableHead className="text-right text-[11px]">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((row) => (
              <TableRow key={row.encounterId}>
                <TableCell className="text-[11px]">
                  <div className="font-medium text-text-primary">{row.patient}</div>
                  <div className="text-[10px] text-text-muted">
                    {row.encounterId} · {row.department} · {row.paymentStatus}
                  </div>
                </TableCell>
                <TableCell className="text-[11px] text-text-secondary">{row.payerLabel}</TableCell>
                <TableCell className="text-right text-[11px]">
                  {num(row.daysOutstanding)}d
                </TableCell>
                <TableCell className="text-right text-[11px]">
                  {php(row.amount, { compact: true })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function RevenueDrawer({
  dataset,
  drill,
  onClose,
  period,
  scopeLabel,
  filterLabel,
  totals,
  waterfall,
  payerRows,
  deptRows,
  arRows,
  statusRows,
  funnel,
  coverageRows,
  pwdDeptRows,
  pwdMonths,
}: {
  dataset: HospitalDataset;
  drill: Drill;
  onClose: () => void;
  period: EncounterFilter;
  scopeLabel: string;
  filterLabel: string;
  totals: Totals;
  waterfall: WaterfallStep[];
  payerRows: PayerRow[];
  deptRows: DeptPayerRow[];
  arRows: ArRow[];
  statusRows: ReturnType<typeof paymentStatusBreakdown>;
  funnel: FunnelStage[];
  coverageRows: CoverageRow[];
  pwdDeptRows: ReturnType<typeof pwdDiscountByDepartment>;
  pwdMonths: PwdMonthRow[];
}) {
  let title = "Revenue cycle";
  let value = "";
  let body: React.ReactNode = null;
  let exportRows: unknown[] = [];
  let exportColumns: { header: string; get: (row: unknown) => string }[] = [];
  let fullReportHref: string | undefined;

  const deptList = (get: (row: DeptPayerRow) => number) => (
    <div className="space-y-1">
      {[...deptRows]
        .sort((a, b) => get(b) - get(a))
        .map((row) => (
          <StatRow
            key={row.departmentId}
            label={row.department}
            value={php(get(row), { compact: true })}
          />
        ))}
    </div>
  );

  if (drill?.kind === "kpi") {
    fullReportHref = "/reports/revenue-collection";
    switch (drill.id) {
      case "gross":
        title = "Gross Revenue";
        value = php(totals.gross, { compact: true });
        body = deptList((r) => r.total);
        break;
      case "net":
        title = "Net Revenue (after deductions)";
        value = php(totals.net, { compact: true });
        body = (
          <div className="space-y-1">
            <StatRow label="Gross charges" value={php(totals.gross, { compact: true })} />
            <StatRow
              label="PhilHealth benefit applied"
              value={`− ${php(totals.philhealthDeduction, { compact: true })}`}
            />
            <StatRow
              label="PWD discount (RA 10754)"
              value={`− ${php(totals.pwdDiscount, { compact: true })}`}
            />
            <StatRow label="Net payable" value={php(totals.net, { compact: true })} />
          </div>
        );
        break;
      case "collection":
        title = "Collection Rate";
        value = pct(safeShare(totals.collected, totals.net));
        body = (
          <div className="space-y-1">
            {payerRows.map((row) => (
              <StatRow
                key={row.payerType}
                label={`${row.label} · ${php(row.amountPaid, { compact: true })} of ${php(row.netPayable, { compact: true })}`}
                value={pct(row.collectionPct)}
              />
            ))}
          </div>
        );
        break;
      case "ar":
        title = "Days in Accounts Receivable";
        value = php(totals.balance, { compact: true });
        exportRows = buildArAccounts(dataset, period);
        exportColumns = ACCOUNT_EXPORT_COLUMNS;
        body = (
          <div className="space-y-4">
            <div className="space-y-1">
              {arRows.map((row) => (
                <StatRow
                  key={row.payerType}
                  label={`${row.label} · ${pct(row.over90Pct)} over 90d`}
                  value={php(row.total, { compact: true })}
                />
              ))}
            </div>
            <AccountTable rows={exportRows as ArAccountRow[]} />
          </div>
        );
        break;
      case "writeoff":
        title = "Write-off Rate";
        value = pct(
          safeShare(
            statusRows.find((r) => r.paymentStatus === "Write-off")?.netPayable ?? 0,
            totals.net,
          ),
        );
        body = (
          <div className="space-y-1">
            {statusRows.map((row) => (
              <StatRow
                key={row.paymentStatus}
                label={`${row.paymentStatus} · ${num(row.bills)} bills`}
                value={php(row.netPayable, { compact: true })}
              />
            ))}
          </div>
        );
        break;
    }
  } else if (drill?.kind === "waterfall") {
    const step = waterfall.find((s) => s.key === drill.step);
    title = step?.label ?? "Bridge step";
    value = step ? php(step.value, { compact: true }) : "";
    if (drill.step === "pwd") {
      body = (
        <div className="space-y-1">
          <p className="text-[11px] text-text-muted">
            Itemised from the PWDDiscount table — only PWD-flagged patients' qualifying bills
            appear.
          </p>
          {pwdDeptRows.map((row) => (
            <StatRow
              key={row.departmentId}
              label={`${row.department} · ${num(row.discountedEncounters)} bills`}
              value={php(row.discountAmount, { compact: true })}
            />
          ))}
        </div>
      );
    } else if (drill.step === "balance") {
      body = (
        <div className="space-y-1">
          {arRows.map((row) => (
            <StatRow
              key={row.payerType}
              label={row.label}
              value={php(row.total, { compact: true })}
            />
          ))}
        </div>
      );
    } else if (drill.step === "philhealth") {
      body = deptList((r) => {
        const source = revenueByDepartment(dataset, period).find(
          (x) => x.departmentId === r.departmentId,
        );
        return source?.philhealthDeduction ?? 0;
      });
    } else if (drill.step === "collected") {
      body = deptList((r) => r.amountPaid);
    } else if (drill.step === "net") {
      body = deptList((r) => r.netPayable);
    } else {
      body = deptList((r) => r.total);
    }
  } else if (drill?.kind === "payer") {
    const row = payerRows.find((r) => r.payerType === drill.payer);
    const scoped: EncounterFilter = { ...period, payerTypes: [drill.payer] };
    const byDept = revenueByDepartment(dataset, scoped).filter((r) => r.encounters > 0);
    const accounts = buildArAccounts(dataset, period, { payerType: drill.payer });
    title = `Payer — ${row?.label ?? drill.payer}`;
    value = row
      ? `${php(row.grossCharges, { compact: true })} gross · ${pct(row.sharePct)} of mix`
      : "";
    exportRows = accounts;
    exportColumns = ACCOUNT_EXPORT_COLUMNS;
    fullReportHref = "/reports/revenue-collection";
    body = (
      <div className="space-y-4">
        <div className="space-y-1">
          <StatRow label="Encounters" value={num(row?.encounters ?? 0)} />
          <StatRow label="Net payable" value={php(row?.netPayable ?? 0, { compact: true })} />
          <StatRow
            label="Collected"
            value={`${php(row?.amountPaid ?? 0, { compact: true })} (${pct(row?.collectionPct ?? 0)})`}
          />
          <StatRow label="Outstanding" value={php(row?.balance ?? 0, { compact: true })} />
        </div>
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">
            By department
          </p>
          {byDept
            .slice()
            .sort((a, b) => b.grossCharges - a.grossCharges)
            .map((d) => (
              <StatRow
                key={d.departmentId}
                label={`${d.department} · ${num(d.encounters)} enc.`}
                value={php(d.grossCharges, { compact: true })}
              />
            ))}
        </div>
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">
            Open accounts on this payer
          </p>
          <AccountTable rows={accounts} />
        </div>
      </div>
    );
  } else if (drill?.kind === "department") {
    const row = deptRows.find((r) => r.departmentId === drill.departmentId);
    const scoped: EncounterFilter = { ...period, departmentIds: [drill.departmentId] };
    const services = serviceUtilization(dataset, scoped).slice(0, 8);
    const accounts = buildArAccounts(dataset, scoped);
    title = row?.department ?? "Department";
    value = row
      ? `${php(row.total, { compact: true })} gross · ${num(row.encounters)} encounters`
      : "";
    exportRows = accounts;
    exportColumns = ACCOUNT_EXPORT_COLUMNS;
    fullReportHref = "/reports/revenue-collection";
    body = (
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
            By payer
          </p>
          {PAYER_ORDER.map((payer) => (
            <StatRow
              key={payer}
              label={PAYER_META[payer].label}
              value={php(row?.[payer] ?? 0, { compact: true })}
            />
          ))}
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
            Top services by charge revenue
          </p>
          {services.map((s) => (
            <StatRow
              key={s.serviceId}
              label={`${s.service} · ${num(s.encounters)} enc.`}
              value={php(s.revenue, { compact: true })}
            />
          ))}
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
            Collection position
          </p>
          <StatRow label="Net payable" value={php(row?.netPayable ?? 0, { compact: true })} />
          <StatRow
            label="Collected"
            value={`${php(row?.amountPaid ?? 0, { compact: true })} (${pct(row?.collectionPct ?? 0)})`}
          />
          <StatRow label="Outstanding" value={php(row?.balance ?? 0, { compact: true })} />
        </div>
        <AccountTable rows={accounts} />
      </div>
    );
  } else if (drill?.kind === "arBucket") {
    const bucket = AGING_BUCKETS.find((b) => b.key === drill.bucket);
    const bounds: Record<AgingBucketKey, { minDays?: number; maxDays?: number }> = {
      current: { maxDays: 30 },
      d31to60: { minDays: 31, maxDays: 60 },
      d61to90: { minDays: 61, maxDays: 90 },
      over90: { minDays: 91 },
    };
    const accounts = buildArAccounts(dataset, period, {
      ...bounds[drill.bucket],
      payerType: drill.payer,
    });
    const row = arRows.find((r) => r.payerType === drill.payer);
    title = `${PAYER_META[drill.payer].label} — ${bucket?.label ?? drill.bucket}`;
    value = `${php(row?.[drill.bucket] ?? 0, { compact: true })} across ${num(accounts.length)} accounts`;
    exportRows = accounts;
    exportColumns = ACCOUNT_EXPORT_COLUMNS;
    fullReportHref = "/reports/revenue-collection";
    body = <AccountTable rows={accounts} />;
  } else if (drill?.kind === "account") {
    const enc = dataset.index.encounterById.get(drill.encounterId);
    const bill = dataset.index.billingByEncounterId.get(drill.encounterId);
    const patient = enc ? dataset.index.patientById.get(enc.patientId) : undefined;
    const claim = dataset.index.claimByEncounterId.get(drill.encounterId);
    const pwd = dataset.index.pwdDiscountByEncounterId.get(drill.encounterId);
    const lines = dataset.index.servicesByEncounterId.get(drill.encounterId) ?? [];
    title = patient?.name ?? drill.encounterId;
    value = bill ? `${php(bill.balance, { compact: true })} outstanding` : "";
    body = (
      <div className="space-y-4">
        <div className="space-y-1">
          <StatRow label="Encounter" value={drill.encounterId} />
          <StatRow label="Bill" value={bill?.id ?? "—"} />
          <StatRow
            label="Department"
            value={enc ? (dataset.index.departmentById.get(enc.departmentId)?.name ?? "—") : "—"}
          />
          <StatRow label="Encounter type" value={enc?.encounterType ?? "—"} />
          <StatRow label="Payer" value={enc ? PAYER_META[enc.payerType].label : "—"} />
          <StatRow label="Payment status" value={bill?.paymentStatus ?? "—"} />
          <StatRow label="Payment date" value={bill?.paymentDate ?? "Not posted"} />
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">Bill</p>
          <StatRow label="Gross charges" value={php(bill?.grossCharges ?? 0, { compact: true })} />
          <StatRow
            label="PhilHealth benefit"
            value={`− ${php(bill?.philhealthDeduction ?? 0, { compact: true })}`}
          />
          <StatRow
            label="PWD discount"
            value={
              pwd
                ? `− ${php(pwd.discountAmount, { compact: true })} on ${php(pwd.qualifyingAmount, { compact: true })} qualifying`
                : "Not applicable (patient is not PWD-flagged)"
            }
          />
          <StatRow label="Net payable" value={php(bill?.netPayable ?? 0, { compact: true })} />
          <StatRow label="Amount paid" value={php(bill?.amountPaid ?? 0, { compact: true })} />
        </div>
        {claim ? (
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
              PhilHealth claim
            </p>
            <StatRow label="Claim" value={claim.id} />
            <StatRow label="Case type" value={claim.caseType} />
            <StatRow label="Status" value={claim.status} />
            <StatRow label="Case rate" value={php(claim.caseRateAmount, { compact: true })} />
          </div>
        ) : null}
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
            Charge lines
          </p>
          {lines.map((line) => (
            <StatRow
              key={line.id}
              label={`${dataset.index.serviceById.get(line.serviceId)?.name ?? line.serviceId} × ${num(line.quantity)}`}
              value={php(line.lineTotal, { compact: true })}
            />
          ))}
        </div>
      </div>
    );
  } else if (drill?.kind === "funnel") {
    const stage = funnel.find((s) => s.key === drill.stage);
    const accounts = (stage?.encounterIds ?? [])
      .map((id): ArAccountRow | null => {
        const enc = dataset.index.encounterById.get(id);
        const bill = dataset.index.billingByEncounterId.get(id);
        const patient = enc ? dataset.index.patientById.get(enc.patientId) : undefined;
        if (!enc || !bill) return null;
        return {
          encounterId: id,
          billingId: bill.id,
          patientId: enc.patientId,
          patient: patient?.name ?? enc.patientId,
          payerType: enc.payerType,
          payerLabel: PAYER_META[enc.payerType].label,
          department: dataset.index.departmentById.get(enc.departmentId)?.name ?? enc.departmentId,
          daysOutstanding: daysBetween(
            Date.parse(enc.dischargeDateTime ?? enc.admitDateTime),
            parseDate(dataset.anchorDate),
          ),
          amount: Math.round(bill.balance),
          netPayable: Math.round(bill.netPayable),
          paymentStatus: bill.paymentStatus,
          lastAction: bill.paymentDate !== null ? `Paid ${bill.paymentDate}` : "No payment posted",
        };
      })
      .filter((r): r is ArAccountRow => r !== null)
      .sort((a, b) => b.daysOutstanding - a.daysOutstanding);
    title = `Stuck at: ${stage?.label ?? drill.stage}`;
    value = stage
      ? `${num(stage.stuckCount)} encounters · ${php(stage.stuckValue, { compact: true })} unrecovered`
      : "";
    exportRows = accounts;
    exportColumns = ACCOUNT_EXPORT_COLUMNS;
    body = (
      <div className="space-y-4">
        <div className="space-y-1">
          <StatRow label="Reached this stage" value={num(stage?.count ?? 0)} />
          <StatRow
            label="Net payable at this stage"
            value={php(stage?.value ?? 0, { compact: true })}
          />
          <StatRow
            label="Average age of stuck encounters"
            value={`${(stage?.avgAgeDays ?? 0).toFixed(1)} days`}
          />
        </div>
        <AccountTable rows={accounts} />
      </div>
    );
  } else if (drill?.kind === "coverage") {
    const row = coverageRows.find((r) => r.category === drill.category);
    const scoped: EncounterFilter = { ...period, patientCategories: [drill.category] };
    const byDept = revenueByDepartment(dataset, scoped).filter((r) => r.encounters > 0);
    title = `Membership category — ${drill.category}`;
    value = row ? `${num(row.patients)} patients · ${num(row.encounters)} encounters` : "";
    body = (
      <div className="space-y-4">
        <div className="space-y-1">
          <StatRow label="Gross charges" value={php(row?.grossCharges ?? 0, { compact: true })} />
          <StatRow label="Net payable" value={php(row?.netPayable ?? 0, { compact: true })} />
          <StatRow
            label="Collected"
            value={`${php(row?.amountPaid ?? 0, { compact: true })} (${pct(row?.collectionPct ?? 0)})`}
          />
          <StatRow label="Share of billed patients" value={pct(row?.patientSharePct ?? 0)} />
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
            By department
          </p>
          {byDept
            .slice()
            .sort((a, b) => b.grossCharges - a.grossCharges)
            .map((d) => (
              <StatRow
                key={d.departmentId}
                label={`${d.department} · ${num(d.encounters)} enc.`}
                value={php(d.grossCharges, { compact: true })}
              />
            ))}
        </div>
      </div>
    );
  } else if (drill?.kind === "pwdDepartment") {
    const row = pwdDeptRows.find((r) => r.departmentId === drill.departmentId);
    const ids = new Set(
      filterEncounters(dataset, { ...period, departmentIds: [drill.departmentId] }).map(
        (e) => e.id,
      ),
    );
    const discounts = dataset.pwdDiscounts
      .filter((d) => ids.has(d.encounterId))
      .sort((a, b) => b.discountAmount - a.discountAmount);
    title = `PWD discounts — ${row?.department ?? drill.departmentId}`;
    value = row
      ? `${php(row.discountAmount, { compact: true })} on ${num(row.discountedEncounters)} bills`
      : "";
    exportRows = discounts;
    exportColumns = [
      { header: "Discount ID", get: (r: unknown) => (r as { id: string }).id },
      { header: "Encounter", get: (r: unknown) => (r as { encounterId: string }).encounterId },
      { header: "Bill", get: (r: unknown) => (r as { billingId: string }).billingId },
      {
        header: "Qualifying amount",
        get: (r: unknown) => String((r as { qualifyingAmount: number }).qualifyingAmount),
      },
      { header: "Rate", get: (r: unknown) => String((r as { discountRate: number }).discountRate) },
      {
        header: "Discount",
        get: (r: unknown) => String((r as { discountAmount: number }).discountAmount),
      },
    ];
    body = (
      <div className="space-y-3">
        <div className="space-y-1">
          <StatRow
            label="Qualifying amount"
            value={php(row?.qualifyingAmount ?? 0, { compact: true })}
          />
          <StatRow
            label="Discount absorbed"
            value={php(row?.discountAmount ?? 0, { compact: true })}
          />
          <StatRow
            label="VAT-exempt component"
            value={php(row?.vatExemptAmount ?? 0, { compact: true })}
          />
        </div>
        <p className="text-[11px] text-text-muted">
          Each row below is a `PWDDiscount` record joined to its bill — the patient on every one of
          them carries `isPWD === true`, which is the only way a row can exist.
        </p>
        <div className="max-h-[22rem] overflow-y-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[11px]">Patient</TableHead>
                <TableHead className="text-right text-[11px]">Qualifying</TableHead>
                <TableHead className="text-right text-[11px]">Rate</TableHead>
                <TableHead className="text-right text-[11px]">Discount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {discounts.slice(0, DRAWER_ROW_LIMIT).map((d) => {
                const enc = dataset.index.encounterById.get(d.encounterId);
                const patient = enc ? dataset.index.patientById.get(enc.patientId) : undefined;
                return (
                  <TableRow key={d.id}>
                    <TableCell className="text-[11px]">
                      <div className="font-medium text-text-primary">{patient?.name ?? "—"}</div>
                      <div className="text-[10px] text-text-muted">
                        {d.encounterId} · {enc?.encounterType ?? ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-[11px]">
                      {php(d.qualifyingAmount, { compact: true })}
                    </TableCell>
                    <TableCell className="text-right text-[11px]">
                      {(d.discountRate * 100).toFixed(0)}%
                    </TableCell>
                    <TableCell className="text-right text-[11px] font-medium">
                      {php(d.discountAmount, { compact: true })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  } else if (drill?.kind === "pwdMonth") {
    const row = pwdMonths.find((m) => m.month === drill.month);
    title = `PWD discounts — ${row?.label ?? drill.month}`;
    value = row
      ? `${php(row.discountAmount, { compact: true })} on ${num(row.discountedEncounters)} bills`
      : "";
    body = (
      <div className="space-y-1">
        <StatRow label="Discounted bills" value={num(row?.discountedEncounters ?? 0)} />
        <StatRow label="Distinct PWD patients" value={num(row?.patients ?? 0)} />
        <StatRow
          label="Qualifying amount"
          value={php(row?.qualifyingAmount ?? 0, { compact: true })}
        />
        <StatRow
          label="Discount absorbed"
          value={php(row?.discountAmount ?? 0, { compact: true })}
        />
        <StatRow
          label="Discount per bill"
          value={php(row?.discountPerEncounter ?? 0, { compact: true })}
        />
        <StatRow
          label="VAT-exempt component"
          value={php(row?.vatExemptAmount ?? 0, { compact: true })}
        />
      </div>
    );
  }

  return (
    <ChartDrillDrawer
      open={drill !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      metricName={title}
      value={value}
      dateRangeLabel={scopeLabel}
      filterLabel={filterLabel}
      exportRows={exportRows}
      exportColumns={exportColumns}
      {...(fullReportHref !== undefined ? { fullReportHref } : {})}
    >
      {body}
    </ChartDrillDrawer>
  );
}

/* ------------------------------------------------------------------ */

function RevenueSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 w-80" />
      <Skeleton className="h-12 w-full rounded-lg" />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-96 w-full rounded-lg" />
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-[30rem] w-full rounded-lg" />
        <Skeleton className="h-[30rem] w-full rounded-lg" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-80 w-full rounded-lg" />
        <Skeleton className="h-80 w-full rounded-lg" />
      </div>
    </div>
  );
}
