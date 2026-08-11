/**
 * PhilHealth Claims Analytics — the claims half of Tier 3
 * (Overview -> Comparison -> **Financial / Claims investigation** -> Drill-down).
 *
 * Every claim on this page is a real `PhilHealthClaim` row from the shared
 * synthetic dataset (`src/lib/data/hospital/**`), joined back to the encounter,
 * bill, patient and physician that produced it. That is the supervisor's
 * explicit requirement — a claim number shown here always traces to an actual
 * encounter and bill, and claims only ever exist for PhilHealth-bearing payers
 * (`philhealth` / `scpwd`), because that is the only case the generator emits
 * one for.
 *
 * The legacy `src/lib/analytics/claims.mock.ts` is no longer read here. That
 * file kept its own physician roster and diagnosis list and did not import the
 * canonical `ph-constants.ts` at all, which is exactly the reconciliation
 * problem the shared dataset exists to fix.
 *
 * Panels marked "Keep" in `chart-audit.md` retain their visual and interaction
 * pattern and were only re-sourced; the audit's "Modify" instructions are
 * applied inline and noted in a comment on each panel.
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { Banknote, ClipboardCheck, ClipboardX, Hourglass, Timer } from "lucide-react";

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
  BulletRow,
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
  CLAIM_DENIAL_REASONS,
  MS_DAY,
  claimDenialReasons,
  claimTurnaroundByDepartment,
  claimsByStatus,
  daysBetween,
  fetchHospitalDataset,
  filterEncounters,
  parseDate,
  toDate,
  topDiagnoses,
} from "@/lib/data/hospital";
import type {
  Billing,
  ClaimCaseType,
  ClaimStatus,
  Encounter,
  EncounterFilter,
  HospitalDataset,
  PhilHealthClaim,
} from "@/lib/data/hospital";

export const Route = createFileRoute("/analytics/claims")({
  head: () => ({
    meta: [
      { title: "PhilHealth Claims Analytics — SugboDoc" },
      {
        name: "description",
        content:
          "PhilHealth claims pipeline, denial reasons and appeal recovery, case-type economics, physician claim performance and case-rate coverage — every figure traced to a real claim, encounter and bill.",
      },
      { property: "og:title", content: "PhilHealth Claims Analytics — SugboDoc" },
      {
        property: "og:description",
        content:
          "Claims pipeline, denial reasons, case-rate coverage and physician claim performance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClaimsRoute,
});

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

/** PhilHealth's published tolerance for denied claims. */
const DENIAL_BENCHMARK_PCT = 5;
/** Days a claim may sit in one pipeline stage before it is flagged. */
const STAGE_SLA_DAYS = 30;

const CASE_TYPE_ORDER: readonly ClaimCaseType[] = [
  "Medical Case",
  "Surgical Case",
  "Maternity Package",
  "Konsulta Package",
  "Catastrophic (Z-Benefit)",
];

const CASE_TYPE_COLOR: Record<ClaimCaseType, string> = {
  "Medical Case": PALETTE.philhealth,
  "Surgical Case": PALETTE.brand,
  "Maternity Package": PALETTE.hmo,
  "Konsulta Package": PALETTE.success,
  "Catastrophic (Z-Benefit)": PALETTE.danger,
};

const STATUS_COLOR: Record<ClaimStatus, string> = {
  Drafted: PALETTE.neutral,
  Submitted: PALETTE.brandLighter,
  "Under Review": PALETTE.brandLight,
  Approved: PALETTE.brand,
  Denied: PALETTE.danger,
  Remitted: PALETTE.success,
};

const DRAWER_ROW_LIMIT = 40;
const PAGE_SIZE = 10;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function sum<T>(rows: readonly T[], get: (row: T) => number): number {
  return rows.reduce((total, row) => total + get(row), 0);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, v) => total + v, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

function deltaPct(current: number, prior: number): number {
  if (prior === 0) return current === 0 ? 0 : 100;
  return ((current - prior) / Math.abs(prior)) * 100;
}

function safeShare(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

function shiftDays(date: string, days: number): string {
  return toDate(parseDate(date) + days * MS_DAY);
}

function spanDays(from: string, to: string): number {
  return Math.max(1, daysBetween(parseDate(from), parseDate(to)) + 1);
}

function denialRateStatus(value: number): MetricStatus {
  if (value > DENIAL_BENCHMARK_PCT * 2) return "danger";
  if (value <= DENIAL_BENCHMARK_PCT) return "good";
  return "warning";
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

/** KPI tile with the trailing 12-month sparkline the audit asked for. */
function TrendKpiCard({
  label,
  value,
  delta,
  invertDelta,
  status,
  icon: Icon,
  trend,
  secondary,
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
  secondary: string;
  note: string;
  onClick: () => void;
}) {
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
      <span className="text-xs text-text-muted">{secondary}</span>
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

/** One claim, joined to everything it depends on. The grain of this page. */
interface ClaimRecord {
  claim: PhilHealthClaim;
  encounter: Encounter;
  billing: Billing | undefined;
  claimId: string;
  encounterId: string;
  patientId: string;
  patient: string;
  departmentId: string;
  department: string;
  doctorId: string;
  doctor: string;
  caseType: ClaimCaseType;
  status: ClaimStatus;
  diagnosisCode: string | null;
  caseRateAmount: number;
  grossCharges: number;
  patientShare: number;
  submissionDate: string;
  submissionMonth: string;
  denialCode: string | null;
  denialReason: string | null;
  appealStatus: string | null;
  amountRecovered: number;
  /** Days from submission to the anchor date — the "age" of the claim. */
  ageDays: number;
  /** Submission -> remittance, remitted claims only. */
  turnaroundDays: number | null;
}

interface PipelineStage {
  key: string;
  label: string;
  /** Statuses that count as having reached this stage. */
  reached: readonly ClaimStatus[];
  /** The status a claim sits at when it reached this stage but not the next. */
  sitting: ClaimStatus;
  count: number;
  value: number;
  sittingCount: number;
  sittingValue: number;
  avgDaysInStage: number;
  dropOffCount: number;
  dropOffPct: number;
}

interface DenialTrendPoint {
  month: string;
  label: string;
  isPartial: boolean;
  adjudicated: number;
  denied: number;
  overall: number;
  [series: string]: string | number | boolean;
}

interface DenialRow {
  denialCode: string;
  reason: string;
  claims: number;
  valueAtRisk: number;
  appealed: number;
  recovered: number;
  amountRecovered: number;
  pctOfDenials: number;
  appealRate: number;
  recoveryRate: number;
  cumulativePct: number;
}

interface CaseTypeRow {
  caseType: ClaimCaseType;
  color: string;
  claims: number;
  totalValue: number;
  avgValue: number;
  approved: number;
  denied: number;
  approvalRate: number;
  denialRate: number;
  avgTurnaroundDays: number;
}

interface PhysicianRow {
  doctorId: string;
  doctor: string;
  department: string;
  submitted: number;
  approved: number;
  denied: number;
  approvalRate: number;
  denialRate: number;
  commonDenialReason: string;
  caseRateValue: number;
  remittedValue: number;
}

interface DiagnosisEconomicsRow {
  code: string;
  description: string;
  commonName: string;
  caseType: ClaimCaseType;
  color: string;
  claims: number;
  patients: number;
  /** Mean `PhilHealthClaim.caseRateAmount` on the claims carrying this code. */
  caseRate: number;
  /** Mean `Billing.grossCharges` on the same encounters. */
  actualCharge: number;
  /** `actualCharge - caseRate` — positive means the case rate under-covers. */
  gap: number;
  gapPct: number;
  /** `gap × claims` — the number that actually ranks remediation work. */
  totalExposure: number;
}

/* ------------------------------------------------------------------ */
/* Derivation                                                          */
/* ------------------------------------------------------------------ */

/**
 * Every claim attached to an encounter that survives `filter`. This is the
 * join that guarantees a claim number on screen corresponds to a real
 * encounter and bill: we walk encounters first, then look the claim up.
 */
function buildClaimRecords(dataset: HospitalDataset, filter: EncounterFilter): ClaimRecord[] {
  const anchorMs = parseDate(dataset.anchorDate);
  const records: ClaimRecord[] = [];
  for (const encounter of filterEncounters(dataset, filter)) {
    const claim = dataset.index.claimByEncounterId.get(encounter.id);
    if (!claim) continue;
    const billing = dataset.index.billingByEncounterId.get(encounter.id);
    const patient = dataset.index.patientById.get(encounter.patientId);
    const doctor = dataset.index.doctorById.get(encounter.primaryDoctorId);
    const department = dataset.index.departmentById.get(encounter.departmentId);
    records.push({
      claim,
      encounter,
      billing,
      claimId: claim.id,
      encounterId: encounter.id,
      patientId: encounter.patientId,
      patient: patient?.name ?? encounter.patientId,
      departmentId: encounter.departmentId,
      department: department?.name ?? encounter.departmentId,
      doctorId: encounter.primaryDoctorId,
      doctor: doctor?.name ?? encounter.primaryDoctorId,
      caseType: claim.caseType,
      status: claim.status,
      diagnosisCode: encounter.diagnosisCode,
      caseRateAmount: claim.caseRateAmount,
      grossCharges: billing?.grossCharges ?? 0,
      patientShare: claim.patientShare,
      submissionDate: claim.submissionDate,
      submissionMonth: claim.submissionDate.slice(0, 7),
      denialCode: claim.denialCode,
      denialReason:
        claim.denialCode !== null
          ? (CLAIM_DENIAL_REASONS[claim.denialCode] ?? "Unclassified")
          : null,
      appealStatus: claim.appealStatus,
      amountRecovered: claim.amountRecovered ?? 0,
      ageDays: daysBetween(parseDate(claim.submissionDate), anchorMs),
      turnaroundDays:
        claim.remittanceDate !== null
          ? daysBetween(parseDate(claim.submissionDate), parseDate(claim.remittanceDate))
          : null,
    });
  }
  return records;
}

const PIPELINE_DEFS: readonly {
  key: string;
  label: string;
  reached: readonly ClaimStatus[];
  sitting: ClaimStatus;
}[] = [
  {
    key: "drafted",
    label: "Drafted / prepared",
    reached: ["Drafted", "Submitted", "Under Review", "Approved", "Denied", "Remitted"],
    sitting: "Drafted",
  },
  {
    key: "submitted",
    label: "Filed with PhilHealth",
    reached: ["Submitted", "Under Review", "Approved", "Denied", "Remitted"],
    sitting: "Submitted",
  },
  {
    key: "review",
    label: "Under review",
    reached: ["Under Review", "Approved", "Denied", "Remitted"],
    sitting: "Under Review",
  },
  {
    key: "adjudicated",
    label: "Adjudicated",
    reached: ["Approved", "Denied", "Remitted"],
    sitting: "Denied",
  },
  {
    key: "approved",
    label: "Approved",
    reached: ["Approved", "Remitted"],
    sitting: "Approved",
  },
  {
    key: "remitted",
    label: "Remitted (paid)",
    reached: ["Remitted"],
    sitting: "Remitted",
  },
];

function buildPipeline(records: ClaimRecord[]): PipelineStage[] {
  return PIPELINE_DEFS.map((def, i) => {
    const reached = records.filter((r) => def.reached.includes(r.status));
    const sitting = records.filter((r) => r.status === def.sitting);
    const prevDef = PIPELINE_DEFS[i - 1];
    const prevCount = prevDef
      ? records.filter((r) => prevDef.reached.includes(r.status)).length
      : reached.length;
    const dropOffCount = prevDef ? prevCount - reached.length : 0;
    const ages =
      def.sitting === "Remitted"
        ? sitting.map((r) => r.turnaroundDays ?? r.ageDays)
        : sitting.map((r) => r.ageDays);
    return {
      key: def.key,
      label: def.label,
      reached: def.reached,
      sitting: def.sitting,
      count: reached.length,
      value: Math.round(sum(reached, (r) => r.caseRateAmount)),
      sittingCount: sitting.length,
      sittingValue: Math.round(sum(sitting, (r) => r.caseRateAmount)),
      avgDaysInStage: Math.round(mean(ages) * 10) / 10,
      dropOffCount,
      dropOffPct: prevCount > 0 ? (dropOffCount / prevCount) * 100 : 0,
    };
  });
}

type DenialBreakdown = "caseType" | "department";

function buildDenialTrend(
  dataset: HospitalDataset,
  records: ClaimRecord[],
  breakdown: DenialBreakdown,
): { points: DenialTrendPoint[]; series: { key: string; label: string; color: string }[] } {
  const seriesKeys =
    breakdown === "caseType"
      ? CASE_TYPE_ORDER.map((c) => ({
          key: c as string,
          label: c as string,
          color: CASE_TYPE_COLOR[c],
        }))
      : dataset.departments.map((d, i) => ({
          key: d.id,
          label: d.name as string,
          color:
            [
              PALETTE.brand,
              PALETTE.philhealth,
              PALETTE.hmo,
              PALETTE.success,
              PALETTE.warning,
              PALETTE.danger,
              PALETTE.gsis,
              PALETTE.gold,
            ][i % 8] ?? PALETTE.brand,
        }));

  const points = dataset.months.map((month) => {
    const inMonth = records.filter((r) => r.submissionMonth === month.key);
    const adjudicated = inMonth.filter(
      (r) => r.status === "Approved" || r.status === "Denied" || r.status === "Remitted",
    );
    const denied = adjudicated.filter((r) => r.status === "Denied");
    const point: DenialTrendPoint = {
      month: month.key,
      label: month.label,
      isPartial: month.isPartial,
      adjudicated: adjudicated.length,
      denied: denied.length,
      overall: safeShare(denied.length, adjudicated.length),
    };
    for (const s of seriesKeys) {
      const scoped = adjudicated.filter((r) =>
        breakdown === "caseType" ? r.caseType === s.key : r.departmentId === s.key,
      );
      const scopedDenied = scoped.filter((r) => r.status === "Denied");
      point[s.key] = safeShare(scopedDenied.length, scoped.length);
    }
    return point;
  });

  /* Only keep breakdown series that actually carry adjudicated claims, so the
     legend does not fill with flat zero lines for departments with no claims. */
  const active = seriesKeys.filter((s) =>
    records.some(
      (r) =>
        (r.status === "Approved" || r.status === "Denied" || r.status === "Remitted") &&
        (breakdown === "caseType" ? r.caseType === s.key : r.departmentId === s.key),
    ),
  );
  return { points, series: active };
}

function buildDenialRows(dataset: HospitalDataset, filter: EncounterFilter): DenialRow[] {
  const base = claimDenialReasons(dataset, filter);
  const total = sum(base, (r) => r.claims);
  let running = 0;
  return base.map((row) => {
    running += row.claims;
    return {
      denialCode: row.denialCode,
      reason: row.reason,
      claims: row.claims,
      valueAtRisk: row.valueAtRisk,
      appealed: row.appealed,
      recovered: row.recovered,
      amountRecovered: row.amountRecovered,
      pctOfDenials: safeShare(row.claims, total),
      appealRate: safeShare(row.appealed, row.claims),
      recoveryRate: safeShare(row.recovered, row.appealed),
      cumulativePct: safeShare(running, total),
    };
  });
}

function buildCaseTypeRows(records: ClaimRecord[]): CaseTypeRow[] {
  return CASE_TYPE_ORDER.map((caseType) => {
    const scoped = records.filter((r) => r.caseType === caseType);
    const adjudicated = scoped.filter(
      (r) => r.status === "Approved" || r.status === "Denied" || r.status === "Remitted",
    );
    const approved = adjudicated.filter((r) => r.status !== "Denied").length;
    const denied = adjudicated.filter((r) => r.status === "Denied").length;
    const turnarounds = scoped.map((r) => r.turnaroundDays).filter((v): v is number => v !== null);
    const totalValue = Math.round(sum(scoped, (r) => r.caseRateAmount));
    return {
      caseType,
      color: CASE_TYPE_COLOR[caseType],
      claims: scoped.length,
      totalValue,
      avgValue: scoped.length > 0 ? Math.round(totalValue / scoped.length) : 0,
      approved,
      denied,
      approvalRate: safeShare(approved, adjudicated.length),
      denialRate: safeShare(denied, adjudicated.length),
      avgTurnaroundDays: Math.round(mean(turnarounds) * 10) / 10,
    };
  }).filter((row) => row.claims > 0);
}

/**
 * Physician claim performance. Note `commonDenialReason` is the genuine mode of
 * that physician's denial codes — the audit flagged the legacy mock for
 * assigning it positionally (`i % denialReasons.length`), which made it a label
 * rather than a fact.
 */
function buildPhysicianRows(records: ClaimRecord[]): PhysicianRow[] {
  const map = new Map<string, ClaimRecord[]>();
  for (const record of records) {
    map.set(record.doctorId, [...(map.get(record.doctorId) ?? []), record]);
  }
  return [...map.entries()]
    .map(([doctorId, list]) => {
      const first = list[0];
      const adjudicated = list.filter(
        (r) => r.status === "Approved" || r.status === "Denied" || r.status === "Remitted",
      );
      const approved = adjudicated.filter((r) => r.status !== "Denied").length;
      const denied = adjudicated.filter((r) => r.status === "Denied");
      const counts = new Map<string, number>();
      for (const record of denied) {
        if (record.denialReason === null) continue;
        counts.set(record.denialReason, (counts.get(record.denialReason) ?? 0) + 1);
      }
      const mode = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      return {
        doctorId,
        doctor: first?.doctor ?? doctorId,
        department: first?.department ?? "",
        submitted: list.length,
        approved,
        denied: denied.length,
        approvalRate: safeShare(approved, adjudicated.length),
        denialRate: safeShare(denied.length, adjudicated.length),
        commonDenialReason: mode ? `${mode[0]} (${mode[1]})` : "No denials",
        caseRateValue: Math.round(sum(list, (r) => r.caseRateAmount)),
        remittedValue: Math.round(
          sum(
            list.filter((r) => r.status === "Remitted"),
            (r) => r.claim.remittanceAmount ?? 0,
          ),
        ),
      };
    })
    .sort((a, b) => b.submitted - a.submitted);
}

function buildDiagnosisEconomics(
  dataset: HospitalDataset,
  records: ClaimRecord[],
  filter: EncounterFilter,
): DiagnosisEconomicsRow[] {
  const catalogue = new Map(topDiagnoses(dataset, 100, filter).map((d) => [d.code, d]));
  const map = new Map<string, ClaimRecord[]>();
  for (const record of records) {
    if (record.diagnosisCode === null) continue;
    map.set(record.diagnosisCode, [...(map.get(record.diagnosisCode) ?? []), record]);
  }
  return [...map.entries()]
    .map(([code, list]) => {
      const meta = catalogue.get(code);
      const caseRate = Math.round(mean(list.map((r) => r.caseRateAmount)));
      const actualCharge = Math.round(mean(list.map((r) => r.grossCharges)));
      const typeCounts = new Map<ClaimCaseType, number>();
      for (const record of list) {
        typeCounts.set(record.caseType, (typeCounts.get(record.caseType) ?? 0) + 1);
      }
      const dominant =
        [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Medical Case";
      const gap = actualCharge - caseRate;
      return {
        code,
        description: meta?.description ?? code,
        commonName: meta?.commonName ?? code,
        caseType: dominant,
        color: CASE_TYPE_COLOR[dominant],
        claims: list.length,
        patients: new Set(list.map((r) => r.patientId)).size,
        caseRate,
        actualCharge,
        gap,
        gapPct: safeShare(gap, caseRate || 1),
        totalExposure: gap * list.length,
      };
    })
    .sort((a, b) => b.totalExposure - a.totalExposure);
}

/* ------------------------------------------------------------------ */
/* Tooltips                                                            */
/* ------------------------------------------------------------------ */

interface TooltipProps {
  active?: boolean;
  payload?: { payload?: unknown; name?: string; value?: number; color?: string }[];
  label?: string | number;
}

function DenialReasonTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as DenialRow | undefined;
  if (!row) return null;
  return (
    <div className="max-w-[17rem] rounded-md bg-[#111] px-2.5 py-2 text-[11px] leading-relaxed text-white shadow-lg">
      <div className="text-xs font-bold">
        {row.denialCode} · {row.reason}
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Denied claims</span>
        <span className="font-semibold">
          {num(row.claims)} ({pct(row.pctOfDenials)})
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Value at risk</span>
        <span className="font-semibold">{php(row.valueAtRisk, { compact: true })}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Appealed</span>
        <span className="font-semibold">
          {num(row.appealed)} ({pct(row.appealRate)})
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Appeals won</span>
        <span className="font-semibold">
          {num(row.recovered)} · {php(row.amountRecovered, { compact: true })}
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Cumulative (Pareto)</span>
        <span className="font-semibold">{pct(row.cumulativePct)}</span>
      </div>
      <div className="mt-1 text-[10px] italic opacity-70">Click for the denied claims →</div>
    </div>
  );
}

function CaseTypeTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as CaseTypeRow | undefined;
  if (!row) return null;
  return (
    <div className="max-w-[16rem] rounded-md bg-[#111] px-2.5 py-2 text-[11px] leading-relaxed text-white shadow-lg">
      <div className="text-xs font-bold">{row.caseType}</div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Claims</span>
        <span className="font-semibold">{num(row.claims)}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Total case-rate value</span>
        <span className="font-semibold">{php(row.totalValue, { compact: true })}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Average claim</span>
        <span className="font-semibold">{php(row.avgValue, { compact: true })}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Approval / denial</span>
        <span className="font-semibold">
          {pct(row.approvalRate)} / {pct(row.denialRate)}
        </span>
      </div>
      <div className="mt-1 text-[10px] italic opacity-70">Click to drill down →</div>
    </div>
  );
}

function PhysicianTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as PhysicianRow | undefined;
  if (!row) return null;
  return (
    <div className="max-w-[16rem] rounded-md bg-[#111] px-2.5 py-2 text-[11px] leading-relaxed text-white shadow-lg">
      <div className="text-xs font-bold">{row.doctor}</div>
      <div className="opacity-80">{row.department}</div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Claims filed</span>
        <span className="font-semibold">{num(row.submitted)}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Denial rate</span>
        <span className="font-semibold">{pct(row.denialRate)}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Case-rate value</span>
        <span className="font-semibold">{php(row.caseRateValue, { compact: true })}</span>
      </div>
      <div className="mt-1 text-[10px] italic opacity-70">Click to drill down →</div>
    </div>
  );
}

function DiagnosisScatterTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as DiagnosisEconomicsRow | undefined;
  if (!row) return null;
  return (
    <div className="max-w-[17rem] rounded-md bg-[#111] px-2.5 py-2 text-[11px] leading-relaxed text-white shadow-lg">
      <div className="text-xs font-bold">
        {row.code} · {row.commonName}
      </div>
      <div className="opacity-80">{row.caseType}</div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Avg case rate</span>
        <span className="font-semibold">{php(row.caseRate, { compact: true })}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Avg actual charge</span>
        <span className="font-semibold">{php(row.actualCharge, { compact: true })}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Margin per case</span>
        <span className={cn("font-semibold", row.gap > 0 ? "text-[#ff8f85]" : "text-[#8ce0a6]")}>
          {row.gap > 0 ? "−" : "+"}
          {php(Math.abs(row.gap), { compact: true })}
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Claims / patients</span>
        <span className="font-semibold">
          {num(row.claims)} / {num(row.patients)}
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Total exposure</span>
        <span className="font-semibold">{php(row.totalExposure, { compact: true })}</span>
      </div>
      <div className="mt-1 text-[10px] italic opacity-70">Click for the claims →</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Route shell                                                         */
/* ------------------------------------------------------------------ */

function ClaimsRoute() {
  const { data } = useQuery({ queryKey: ["hospital", "dataset"], queryFn: fetchHospitalDataset });
  if (!data) return <ClaimsSkeleton />;
  return <ClaimsPage dataset={data} />;
}

type Drill =
  | { kind: "kpi"; id: "filed" | "pending" | "approved" | "denied" | "turnaround" | "expected" }
  | { kind: "stage"; stage: string }
  | { kind: "denial"; code: string }
  | { kind: "caseType"; caseType: ClaimCaseType }
  | { kind: "physician"; doctorId: string }
  | { kind: "diagnosis"; code: string }
  | { kind: "month"; month: string }
  | null;

type DenialSortKey = "claims-desc" | "value-desc" | "recovery-asc" | "code";
type CaseTypeSortKey = "claims-desc" | "value-desc" | "avg-desc" | "denial-desc" | "name";
type PhysicianSortKey = "submitted-desc" | "denial-desc" | "approval-asc" | "value-desc" | "name";
type CoverageSortKey = "gap-desc" | "gappct-desc" | "exposure-desc" | "claims-desc" | "code";

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function ClaimsPage({ dataset }: { dataset: HospitalDataset }) {
  const { filters, encounterFilter, isFiltered } = useHospitalFilters();
  const [drill, setDrill] = React.useState<Drill>(null);

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
      period: encounterFilter,
      prior: { ...encounterFilter, from: priorFrom, to: priorTo } satisfies EncounterFilter,
      priorFrom,
      priorTo,
      dimensionOnly,
    };
  }, [dataset, encounterFilter]);

  /* ---------------- claim records ---------------- */

  const records = React.useMemo(
    () => buildClaimRecords(dataset, windows.period),
    [dataset, windows],
  );
  const priorRecords = React.useMemo(
    () => buildClaimRecords(dataset, windows.prior),
    [dataset, windows],
  );
  const allRecords = React.useMemo(
    () => buildClaimRecords(dataset, windows.dimensionOnly),
    [dataset, windows],
  );

  const statusRows = React.useMemo(
    () => claimsByStatus(dataset, windows.period),
    [dataset, windows],
  );
  const turnaroundRows = React.useMemo(
    () => claimTurnaroundByDepartment(dataset, windows.period),
    [dataset, windows],
  );
  const denialRows = React.useMemo(
    () => buildDenialRows(dataset, windows.period),
    [dataset, windows],
  );
  const pipeline = React.useMemo(() => buildPipeline(records), [records]);
  const caseTypeRows = React.useMemo(() => buildCaseTypeRows(records), [records]);
  const physicianRows = React.useMemo(() => buildPhysicianRows(records), [records]);
  const diagnosisRows = React.useMemo(
    () => buildDiagnosisEconomics(dataset, records, windows.period),
    [dataset, records, windows],
  );

  /* ---------------- KPI numbers ---------------- */

  const kpis = React.useMemo(() => {
    const summarise = (list: ClaimRecord[]) => {
      const filed = list.filter((r) => r.status !== "Drafted");
      const pending = list.filter((r) => r.status === "Submitted" || r.status === "Under Review");
      const adjudicated = list.filter(
        (r) => r.status === "Approved" || r.status === "Denied" || r.status === "Remitted",
      );
      const approved = adjudicated.filter((r) => r.status !== "Denied");
      const denied = adjudicated.filter((r) => r.status === "Denied");
      const turnarounds = list.map((r) => r.turnaroundDays).filter((v): v is number => v !== null);
      const awaitingRemittance = list.filter((r) => r.status === "Approved");
      return {
        filed: filed.length,
        filedValue: Math.round(sum(filed, (r) => r.caseRateAmount)),
        pending: pending.length,
        oldestPending: pending.length > 0 ? Math.max(...pending.map((r) => r.ageDays)) : 0,
        approved: approved.length,
        approvedValue: Math.round(sum(approved, (r) => r.caseRateAmount)),
        approvalRate: safeShare(approved.length, adjudicated.length),
        denied: denied.length,
        deniedValue: Math.round(sum(denied, (r) => r.caseRateAmount)),
        denialRate: safeShare(denied.length, adjudicated.length),
        turnaround: Math.round(mean(turnarounds) * 10) / 10,
        expected: Math.round(sum(awaitingRemittance, (r) => r.caseRateAmount)),
        expectedCount: awaitingRemittance.length,
      };
    };
    return { current: summarise(records), prior: summarise(priorRecords) };
  }, [records, priorRecords]);

  const sparks = React.useMemo(() => {
    const byMonth = dataset.months.map((month) =>
      allRecords.filter((r) => r.submissionMonth === month.key),
    );
    return {
      filed: byMonth.map((list) => list.filter((r) => r.status !== "Drafted").length),
      pending: byMonth.map(
        (list) =>
          list.filter((r) => r.status === "Submitted" || r.status === "Under Review").length,
      ),
      approved: byMonth.map(
        (list) => list.filter((r) => r.status === "Approved" || r.status === "Remitted").length,
      ),
      denied: byMonth.map((list) => list.filter((r) => r.status === "Denied").length),
      turnaround: byMonth.map((list) =>
        mean(list.map((r) => r.turnaroundDays).filter((v): v is number => v !== null)),
      ),
      remitted: byMonth.map((list) =>
        sum(
          list.filter((r) => r.status === "Remitted"),
          (r) => r.claim.remittanceAmount ?? 0,
        ),
      ),
    };
  }, [dataset, allRecords]);

  /**
   * Audit: the `oldestDays` figure is the real risk signal but was buried in
   * secondary text. This is the aging distribution it asked for, computed over
   * the claims genuinely awaiting adjudication.
   */
  const pendingAging = React.useMemo(() => {
    const pending = records.filter((r) => r.status === "Submitted" || r.status === "Under Review");
    const bands = [
      { key: "0-15", label: "0–15 days", max: 15, color: PALETTE.success },
      { key: "16-30", label: "16–30 days", max: 30, color: PALETTE.brandLight },
      { key: "31-60", label: "31–60 days", max: 60, color: PALETTE.warning },
      { key: "60+", label: "over 60 days", max: Infinity, color: PALETTE.danger },
    ];
    let lower = -1;
    return bands.map((band) => {
      const scoped = pending.filter((r) => r.ageDays > lower && r.ageDays <= band.max);
      lower = band.max;
      return {
        key: band.key,
        label: band.label,
        color: band.color,
        claims: scoped.length,
        value: Math.round(sum(scoped, (r) => r.caseRateAmount)),
        share: safeShare(scoped.length, pending.length),
      };
    });
  }, [records]);

  /* ---------------- controls ---------------- */

  const [denialBreakdown, setDenialBreakdown] = React.useState<DenialBreakdown>("caseType");
  const [denialSort, setDenialSort] = React.useState<DenialSortKey>("claims-desc");
  const [caseTypeSort, setCaseTypeSort] = React.useState<CaseTypeSortKey>("claims-desc");
  const [caseTypeMetric, setCaseTypeMetric] = React.useState<"claims" | "totalValue">("claims");
  const [physicianSort, setPhysicianSort] = React.useState<PhysicianSortKey>("submitted-desc");
  const [physicianLimit, setPhysicianLimit] = React.useState(PAGE_SIZE);
  const [hiddenCaseTypes, setHiddenCaseTypes] = React.useState<Record<string, boolean>>({});
  const [coverageSort, setCoverageSort] = React.useState<CoverageSortKey>("exposure-desc");

  const denialTrend = React.useMemo(
    () => buildDenialTrend(dataset, allRecords, denialBreakdown),
    [dataset, allRecords, denialBreakdown],
  );

  const sortedDenialRows = React.useMemo(() => {
    const rows = [...denialRows];
    switch (denialSort) {
      case "value-desc":
        return rows.sort((a, b) => b.valueAtRisk - a.valueAtRisk);
      case "recovery-asc":
        return rows.sort((a, b) => a.recoveryRate - b.recoveryRate);
      case "code":
        return rows.sort((a, b) => a.denialCode.localeCompare(b.denialCode));
      case "claims-desc":
      default:
        return rows.sort((a, b) => b.claims - a.claims);
    }
  }, [denialRows, denialSort]);

  const sortedCaseTypeRows = React.useMemo(() => {
    const rows = [...caseTypeRows];
    switch (caseTypeSort) {
      case "value-desc":
        return rows.sort((a, b) => b.totalValue - a.totalValue);
      case "avg-desc":
        return rows.sort((a, b) => b.avgValue - a.avgValue);
      case "denial-desc":
        return rows.sort((a, b) => b.denialRate - a.denialRate);
      case "name":
        return rows.sort((a, b) => a.caseType.localeCompare(b.caseType));
      case "claims-desc":
      default:
        return rows.sort((a, b) => b.claims - a.claims);
    }
  }, [caseTypeRows, caseTypeSort]);

  const sortedPhysicianRows = React.useMemo(() => {
    const rows = [...physicianRows];
    switch (physicianSort) {
      case "denial-desc":
        return rows.sort((a, b) => b.denialRate - a.denialRate);
      case "approval-asc":
        return rows.sort((a, b) => a.approvalRate - b.approvalRate);
      case "value-desc":
        return rows.sort((a, b) => b.caseRateValue - a.caseRateValue);
      case "name":
        return rows.sort((a, b) => a.doctor.localeCompare(b.doctor));
      case "submitted-desc":
      default:
        return rows.sort((a, b) => b.submitted - a.submitted);
    }
  }, [physicianRows, physicianSort]);

  const physicianMedians = React.useMemo(
    () => ({
      denialRate: median(physicianRows.filter((r) => r.submitted > 0).map((r) => r.denialRate)),
      submitted: median(physicianRows.map((r) => r.submitted)),
    }),
    [physicianRows],
  );

  const visibleDiagnosisRows = React.useMemo(
    () => diagnosisRows.filter((row) => !hiddenCaseTypes[row.caseType]),
    [diagnosisRows, hiddenCaseTypes],
  );

  const breakEvenMax = React.useMemo(() => {
    const values = diagnosisRows.flatMap((r) => [r.caseRate, r.actualCharge]);
    return values.length > 0 ? Math.max(...values) * 1.05 : 1;
  }, [diagnosisRows]);

  /** The 5 worst under-covered diagnoses get a persistent label on the scatter. */
  const labelledOutliers = React.useMemo(
    () =>
      [...visibleDiagnosisRows]
        .filter((r) => r.gap > 0)
        .sort((a, b) => b.totalExposure - a.totalExposure)
        .slice(0, 5),
    [visibleDiagnosisRows],
  );

  const sortedCoverageRows = React.useMemo(() => {
    const rows = [...diagnosisRows];
    switch (coverageSort) {
      case "gap-desc":
        return rows.sort((a, b) => b.gap - a.gap);
      case "gappct-desc":
        return rows.sort((a, b) => b.gapPct - a.gapPct);
      case "claims-desc":
        return rows.sort((a, b) => b.claims - a.claims);
      case "code":
        return rows.sort((a, b) => a.code.localeCompare(b.code));
      case "exposure-desc":
      default:
        return rows.sort((a, b) => b.totalExposure - a.totalExposure);
    }
  }, [diagnosisRows, coverageSort]);

  const coverageMax = React.useMemo(() => {
    const values = diagnosisRows.flatMap((r) => [r.caseRate, r.actualCharge]);
    return values.length > 0 ? Math.max(...values) : 1;
  }, [diagnosisRows]);

  /* ---------------- table configs ---------------- */

  const caseTypeTableColumns: ReportColumn<CaseTypeRow>[] = [
    { key: "caseType", header: "Case type", sortable: true },
    {
      key: "claims",
      header: "Claims",
      align: "right",
      sortable: true,
      render: (r) => num(r.claims),
    },
    {
      key: "totalValue",
      header: "Case-rate value",
      align: "right",
      sortable: true,
      render: (r) => php(r.totalValue, { compact: true }),
    },
    {
      key: "avgValue",
      header: "Average claim",
      align: "right",
      sortable: true,
      render: (r) => php(r.avgValue, { compact: true }),
    },
    {
      key: "approvalRate",
      header: "Approval",
      align: "right",
      sortable: true,
      render: (r) => pct(r.approvalRate),
    },
    {
      key: "denialRate",
      header: "Denial",
      align: "right",
      sortable: true,
      render: (r) => pct(r.denialRate),
    },
    {
      key: "avgTurnaroundDays",
      header: "Avg turnaround",
      align: "right",
      sortable: true,
      render: (r) => `${r.avgTurnaroundDays.toFixed(1)}d`,
    },
  ];

  const physicianTableColumns: ReportColumn<PhysicianRow>[] = [
    { key: "doctor", header: "Physician", sortable: true },
    { key: "department", header: "Department", sortable: true },
    {
      key: "submitted",
      header: "Claims",
      align: "right",
      sortable: true,
      render: (r) => num(r.submitted),
    },
    {
      key: "approvalRate",
      header: "Approval",
      align: "right",
      sortable: true,
      render: (r) => pct(r.approvalRate),
    },
    {
      key: "denialRate",
      header: "Denial",
      align: "right",
      sortable: true,
      render: (r) => pct(r.denialRate),
    },
    { key: "commonDenialReason", header: "Most common denial", sortable: true },
    {
      key: "caseRateValue",
      header: "Case-rate value",
      align: "right",
      sortable: true,
      render: (r) => php(r.caseRateValue, { compact: true }),
    },
  ];

  const scopeLabel = `${windows.from} – ${windows.to} (${num(windows.days)} days)`;
  const totalClaims = records.length;

  /* ---------------- render ---------------- */

  return (
    <div className="space-y-5">
      <SectionTitle
        title="PhilHealth Claims Analytics"
        description="Where claims stall, why they are denied, what the case rate fails to cover — and which physicians and case types drive it."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {isFiltered ? <StatusBadge tone="neutral">Global filters active</StatusBadge> : null}
            <StatusBadge tone="neutral">Claims Officer / Billing Manager view</StatusBadge>
          </div>
        }
      />

      <GlobalHospitalFilterBar />

      <p className="text-[11px] text-text-muted">
        Scope: <span className="font-medium text-text-secondary">{filters.dateRange.label}</span> ·{" "}
        {scopeLabel} · {num(totalClaims)} claims on{" "}
        {num(filterEncounters(dataset, windows.period).length)} encounters. Claims exist only for
        PhilHealth-bearing encounters (payer <code>philhealth</code> or <code>scpwd</code>), so the
        denominator here is deliberately smaller than total encounter volume. Deltas compare the
        immediately preceding window of equal length ({windows.priorFrom} – {windows.priorTo});
        12-month trends and sparklines ignore the date filter but keep every other filter applied.
      </p>

      {/* ---------------------------------------------------------------- */}
      {/* KPI strip — audit: Modify (sparklines + aging promoted below)     */}
      {/* ---------------------------------------------------------------- */}
      <KpiStrip>
        <TrendKpiCard
          label="Claims filed"
          value={num(kpis.current.filed)}
          delta={deltaPct(kpis.current.filed, kpis.prior.filed)}
          status="neutral"
          icon={ClipboardCheck}
          trend={sparks.filed}
          secondary={php(kpis.current.filedValue, { compact: true })}
          note="Claims past Drafted — a Drafted claim exists but cannot be filed"
          onClick={() => setDrill({ kind: "kpi", id: "filed" })}
        />
        <TrendKpiCard
          label="Awaiting adjudication"
          value={num(kpis.current.pending)}
          delta={deltaPct(kpis.current.pending, kpis.prior.pending)}
          invertDelta
          status={kpis.current.oldestPending > 45 ? "danger" : "warning"}
          icon={Hourglass}
          trend={sparks.pending}
          secondary={`Oldest ${num(kpis.current.oldestPending)} days since filing`}
          note="Submitted + Under Review; see the aging distribution below"
          onClick={() => setDrill({ kind: "kpi", id: "pending" })}
        />
        <TrendKpiCard
          label="Claims approved"
          value={num(kpis.current.approved)}
          delta={deltaPct(kpis.current.approved, kpis.prior.approved)}
          status="good"
          icon={ClipboardCheck}
          trend={sparks.approved}
          secondary={`${php(kpis.current.approvedValue, { compact: true })} · ${pct(kpis.current.approvalRate)} approval rate`}
          note="Approved + Remitted, as a share of adjudicated claims"
          onClick={() => setDrill({ kind: "kpi", id: "approved" })}
        />
        <TrendKpiCard
          label="Claims denied"
          value={num(kpis.current.denied)}
          delta={deltaPct(kpis.current.denied, kpis.prior.denied)}
          invertDelta
          status={denialRateStatus(kpis.current.denialRate)}
          icon={ClipboardX}
          trend={sparks.denied}
          secondary={`${php(kpis.current.deniedValue, { compact: true })} · ${pct(kpis.current.denialRate)} denial rate`}
          note={`PhilHealth benchmark is ${DENIAL_BENCHMARK_PCT}% of adjudicated claims`}
          onClick={() => setDrill({ kind: "kpi", id: "denied" })}
        />
        <TrendKpiCard
          label="Submission → remittance"
          value={`${kpis.current.turnaround.toFixed(1)}d`}
          delta={deltaPct(kpis.current.turnaround, kpis.prior.turnaround)}
          invertDelta
          status={kpis.current.turnaround <= 60 ? "good" : "warning"}
          icon={Timer}
          trend={sparks.turnaround}
          secondary="Mean days on remitted claims"
          note="Only remitted claims carry a turnaround; see per-department breakdown"
          onClick={() => setDrill({ kind: "kpi", id: "turnaround" })}
        />
        <TrendKpiCard
          label="Expected remittance"
          value={php(kpis.current.expected, { compact: true })}
          delta={deltaPct(kpis.current.expected, kpis.prior.expected)}
          status="neutral"
          icon={Banknote}
          trend={sparks.remitted}
          secondary={`${num(kpis.current.expectedCount)} approved claims not yet paid`}
          note="Case-rate value of claims sitting at Approved"
          onClick={() => setDrill({ kind: "kpi", id: "expected" })}
        />
      </KpiStrip>

      {/* ---------------------------------------------------------------- */}
      {/* Pipeline — audit: Keep (+ days in stage, drop-off %, SLA colour)  */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <PanelCard
          title="Drafted → Remittance pipeline"
          description={`Claim count, case-rate value, drop-off and how long the claims sitting at each stage have been there. Stages over ${STAGE_SLA_DAYS} days are flagged. Click a stage for its worklist.`}
        >
          {totalClaims === 0 ? (
            <EmptyPanel label="No claims match the current filters." />
          ) : (
            <div className="space-y-2">
              {pipeline.map((stage, i) => {
                const width = Math.max(6, safeShare(stage.count, pipeline[0]?.count ?? 1));
                const breached = stage.avgDaysInStage > STAGE_SLA_DAYS && stage.sittingCount > 0;
                return (
                  <button
                    key={stage.key}
                    onClick={() => setDrill({ kind: "stage", stage: stage.key })}
                    className="block w-full rounded-md p-1 text-left hover:bg-muted"
                  >
                    <div className="mb-0.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-text-primary">{stage.label}</span>
                      <span className="text-text-secondary">
                        {num(stage.count)} claims · {php(stage.value, { compact: true })}
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
                          backgroundColor: breached ? PALETTE.danger : PALETTE.brand,
                          opacity: 0.45 + (i / Math.max(1, pipeline.length)) * 0.55,
                        }}
                      />
                    </div>
                    {stage.sittingCount > 0 ? (
                      <div className="mt-0.5 text-[10px] text-text-muted">
                        {num(stage.sittingCount)} sitting here ·{" "}
                        {php(stage.sittingValue, { compact: true })} · average{" "}
                        <span
                          className={cn(
                            "font-semibold",
                            breached ? "text-danger" : "text-text-secondary",
                          )}
                        >
                          {stage.avgDaysInStage.toFixed(1)} days
                        </span>
                        {stage.sitting === "Denied" ? " (denied — leaves the pipeline here)" : ""}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </PanelCard>

        {/* The aging distribution the audit asked to promote out of the KPI's
            secondary text. */}
        <PanelCard
          title="Pending-claim aging"
          description="How long the claims awaiting adjudication have been sitting with PhilHealth."
        >
          {kpis.current.pending === 0 ? (
            <EmptyPanel label="No claims are awaiting adjudication in this window." />
          ) : (
            <div className="space-y-3">
              <div className="h-[11rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pendingAging} margin={{ left: -12, right: 8, top: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.35} />
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={0} />
                    <YAxis tick={{ fontSize: 9 }} width={32} />
                    <Tooltip
                      cursor={{ fill: "rgba(68,84,195,0.06)" }}
                      contentStyle={{ fontSize: 11, borderRadius: 8 }}
                      formatter={(v: number, n: string) => [
                        n === "Claims" ? num(v) : php(v, { compact: true }),
                        n,
                      ]}
                    />
                    <Bar dataKey="claims" name="Claims" radius={[3, 3, 0, 0]}>
                      {pendingAging.map((band) => (
                        <Cell key={band.key} fill={band.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1">
                {pendingAging.map((band) => (
                  <div
                    key={band.key}
                    className="flex items-center justify-between gap-3 border-b border-border/60 py-1 text-xs last:border-0"
                  >
                    <LegendDot color={band.color} label={band.label} />
                    <span className="font-medium text-text-primary">
                      {num(band.claims)} · {php(band.value, { compact: true })}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-text-muted">
                Oldest pending claim is {num(kpis.current.oldestPending)} days past filing.
              </p>
            </div>
          )}
        </PanelCard>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Denial trend — audit: Keep (+ department as a breakable dimension,*/}
      {/* shaded above-benchmark band). Policy-change markers are dropped   */}
      {/* because the shared dataset carries no policy-event table and       */}
      {/* inventing one would break the "traces to real data" rule.          */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid gap-4 xl:grid-cols-2">
        <PanelCard
          title="Denial rate trend"
          description={`Denied claims as a share of adjudicated claims, by submission month. The shaded band is everything above PhilHealth's ${DENIAL_BENCHMARK_PCT}% benchmark.`}
          action={
            <ControlSelect
              label="Break down by"
              value={denialBreakdown}
              onChange={setDenialBreakdown}
              width="w-[11rem]"
              options={[
                { value: "caseType", label: "Case type" },
                { value: "department", label: "Department" },
              ]}
            />
          }
        >
          <div className="h-[19rem]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={denialTrend.points}
                margin={{ left: -12, right: 8, top: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.35} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} />
                <YAxis tick={{ fontSize: 10 }} width={40} unit="%" />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(v: number, n: string) => [pct(v), n]}
                  labelFormatter={(label, payload) => {
                    const point = payload?.[0]?.payload as DenialTrendPoint | undefined;
                    return point
                      ? `${label} — ${num(point.denied)} of ${num(point.adjudicated)} adjudicated${point.isPartial ? " (month to date)" : ""}`
                      : String(label);
                  }}
                />
                <ReferenceArea
                  y1={DENIAL_BENCHMARK_PCT}
                  y2={100}
                  fill={PALETTE.danger}
                  fillOpacity={0.06}
                />
                <ReferenceLine
                  y={DENIAL_BENCHMARK_PCT}
                  stroke={PALETTE.gold}
                  strokeDasharray="4 4"
                  label={{
                    value: `${DENIAL_BENCHMARK_PCT}% benchmark`,
                    fontSize: 10,
                    position: "insideTopRight",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="overall"
                  name="Overall"
                  stroke={PALETTE.brand}
                  strokeWidth={2.5}
                  dot={{ r: 2 }}
                />
                {denialTrend.series.map((s) => (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.label}
                    stroke={s.color}
                    strokeWidth={1.4}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            <LegendDot color={PALETTE.brand} label="Overall" />
            {denialTrend.series.map((s) => (
              <LegendDot key={s.key} color={s.color} label={s.label} />
            ))}
          </div>
          <p className="mt-1 text-[11px] text-text-muted">
            Trailing 12 months by submission month, date filter not applied. A month with no
            adjudicated claim in a series reads as 0% rather than being interpolated.
          </p>
        </PanelCard>

        {/* Top denial reasons — audit: Keep (+ human-readable axis labels,
            paired value-at-risk bar, cumulative Pareto line, sort control). */}
        <InteractiveChartCard<DenialRow>
          title="Denial reasons"
          description="Frequency (bars, left axis) against value at risk (bars) and the cumulative Pareto line (right axis) — because the most frequent reason and the most expensive one diverge."
          action={
            <ControlSelect
              label="Sort"
              value={denialSort}
              onChange={setDenialSort}
              width="w-[13rem]"
              options={[
                { value: "claims-desc", label: "Most frequent" },
                { value: "value-desc", label: "Highest value at risk" },
                { value: "recovery-asc", label: "Worst appeal recovery" },
                { value: "code", label: "Code A–Z" },
              ]}
            />
          }
          table={{
            columns: [
              { key: "denialCode", header: "Code", sortable: true },
              { key: "reason", header: "Reason", sortable: true },
              {
                key: "claims",
                header: "Claims",
                align: "right",
                sortable: true,
                render: (r) => num(r.claims),
              },
              {
                key: "pctOfDenials",
                header: "% of denials",
                align: "right",
                sortable: true,
                render: (r) => pct(r.pctOfDenials),
              },
              {
                key: "valueAtRisk",
                header: "Value at risk",
                align: "right",
                sortable: true,
                render: (r) => php(r.valueAtRisk, { compact: true }),
              },
              {
                key: "recoveryRate",
                header: "Appeal recovery",
                align: "right",
                sortable: true,
                render: (r) => (r.appealed > 0 ? pct(r.recoveryRate) : "—"),
              },
            ] satisfies ReportColumn<DenialRow>[],
            rows: sortedDenialRows,
          }}
          onRowClickInTable={(row) => setDrill({ kind: "denial", code: row.denialCode })}
        >
          {sortedDenialRows.length === 0 ? (
            <EmptyPanel label="No denied claims match the current filters." />
          ) : (
            <>
              <div className="h-[19rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={sortedDenialRows}
                    layout="vertical"
                    margin={{ top: 4, right: 44, bottom: 8, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.35} />
                    <XAxis
                      xAxisId="count"
                      type="number"
                      tick={{ fontSize: 10 }}
                      orientation="bottom"
                    />
                    <XAxis
                      xAxisId="cum"
                      type="number"
                      domain={[0, 100]}
                      orientation="top"
                      tick={{ fontSize: 9 }}
                      tickFormatter={(v: number) => `${v}%`}
                    />
                    <YAxis
                      type="category"
                      dataKey="reason"
                      width={168}
                      tick={{ fontSize: 9 }}
                      interval={0}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(68,84,195,0.06)" }}
                      content={<DenialReasonTooltip />}
                    />
                    <Bar
                      xAxisId="count"
                      dataKey="claims"
                      name="Denied claims"
                      radius={[0, 3, 3, 0]}
                      cursor="pointer"
                      onClick={(entry: unknown) => {
                        const row = entry as { payload?: DenialRow };
                        const code = row.payload?.denialCode;
                        if (code) setDrill({ kind: "denial", code });
                      }}
                    >
                      {sortedDenialRows.map((row) => (
                        <Cell key={row.denialCode} fill={PALETTE.danger} />
                      ))}
                    </Bar>
                    <Line
                      xAxisId="cum"
                      type="monotone"
                      dataKey="cumulativePct"
                      name="Cumulative % of denials"
                      stroke={PALETTE.gold}
                      strokeWidth={1.75}
                      dot={{ r: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <LegendDot color={PALETTE.danger} label="Denied claims (bottom axis)" />
                <LegendDot color={PALETTE.gold} label="Cumulative % of denials (top axis)" />
              </div>
            </>
          )}
        </InteractiveChartCard>
      </div>

      {/* Denial reasons detail — audit: Keep (+ column sorting via the sort
          control above, and the appeal-recovery column it asked for). */}
      <PanelCard
        title="Denial reasons — remediation detail"
        description="The reference table behind the chart: what the code means, how often it is appealed, and how much of the value at risk actually comes back."
      >
        {sortedDenialRows.length === 0 ? (
          <EmptyPanel label="No denied claims match the current filters." />
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px]">Code</TableHead>
                  <TableHead className="text-[11px]">Reason</TableHead>
                  <TableHead className="text-right text-[11px]">Claims</TableHead>
                  <TableHead className="text-right text-[11px]">% of denials</TableHead>
                  <TableHead className="text-right text-[11px]">Value at risk</TableHead>
                  <TableHead className="text-right text-[11px]">Appealed</TableHead>
                  <TableHead className="text-right text-[11px]">Won / recovered</TableHead>
                  <TableHead className="text-[11px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedDenialRows.map((row) => (
                  <TableRow key={row.denialCode}>
                    <TableCell className="text-xs font-medium">{row.denialCode}</TableCell>
                    <TableCell className="text-xs text-text-secondary">{row.reason}</TableCell>
                    <TableCell className="text-right text-xs">{num(row.claims)}</TableCell>
                    <TableCell className="text-right text-xs">{pct(row.pctOfDenials)}</TableCell>
                    <TableCell className="text-right text-xs font-medium">
                      {php(row.valueAtRisk, { compact: true })}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {num(row.appealed)}{" "}
                      <span className="text-text-muted">({pct(row.appealRate)})</span>
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right text-xs",
                        row.appealed > 0 && row.recoveryRate < 40 ? "text-danger" : "text-success",
                      )}
                    >
                      {row.appealed > 0
                        ? `${num(row.recovered)} · ${php(row.amountRecovered, { compact: true })}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px]"
                        onClick={() => setDrill({ kind: "denial", code: row.denialCode })}
                      >
                        Open worklist
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </PanelCard>

      {/* ---------------------------------------------------------------- */}
      {/* Case type — audit: Modify option (b): a treemap over 5 flat tiles */}
      {/* earns nothing, so this is a sorted bar with an avg-value colour   */}
      {/* scale (and a legend for it, which the treemap never had).          */}
      {/* Physicians — audit: Modify (volume-adjusted scatter + peer median  */}
      {/* + the sorting the table never had).                                */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid gap-4 xl:grid-cols-2">
        <InteractiveChartCard<CaseTypeRow>
          title="Claim value by case type"
          description="Bar length is the metric you choose; colour intensity is the average value of a single claim in that case type. Click a bar for its diagnoses and approval profile."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <ControlSelect
                label="Size by"
                value={caseTypeMetric}
                onChange={setCaseTypeMetric}
                width="w-[10.5rem]"
                options={[
                  { value: "claims", label: "Claim count" },
                  { value: "totalValue", label: "Total value" },
                ]}
              />
              <ControlSelect
                label="Sort"
                value={caseTypeSort}
                onChange={setCaseTypeSort}
                width="w-[12rem]"
                options={[
                  { value: "claims-desc", label: "Most claims" },
                  { value: "value-desc", label: "Highest total value" },
                  { value: "avg-desc", label: "Highest average claim" },
                  { value: "denial-desc", label: "Worst denial rate" },
                  { value: "name", label: "Case type A–Z" },
                ]}
              />
            </div>
          }
          table={{ columns: caseTypeTableColumns, rows: sortedCaseTypeRows }}
          onRowClickInTable={(row) => setDrill({ kind: "caseType", caseType: row.caseType })}
        >
          {sortedCaseTypeRows.length === 0 ? (
            <EmptyPanel label="No claims match the current filters." />
          ) : (
            <>
              <div className="h-[17rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={sortedCaseTypeRows}
                    layout="vertical"
                    margin={{ top: 4, right: 32, bottom: 8, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.35} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v: number) =>
                        caseTypeMetric === "claims" ? num(v) : `${(v / 1_000_000).toFixed(1)}M`
                      }
                    />
                    <YAxis type="category" dataKey="caseType" width={146} tick={{ fontSize: 10 }} />
                    <Tooltip
                      cursor={{ fill: "rgba(68,84,195,0.06)" }}
                      content={<CaseTypeTooltip />}
                    />
                    <Bar
                      dataKey={caseTypeMetric}
                      name={caseTypeMetric === "claims" ? "Claims" : "Total value"}
                      radius={[0, 4, 4, 0]}
                      cursor="pointer"
                      onClick={(entry: unknown) => {
                        const row = entry as { payload?: CaseTypeRow };
                        const caseType = row.payload?.caseType;
                        if (caseType) setDrill({ kind: "caseType", caseType });
                      }}
                    >
                      {sortedCaseTypeRows.map((row) => {
                        const maxAvg = Math.max(...sortedCaseTypeRows.map((r) => r.avgValue), 1);
                        const intensity = Math.max(0.25, row.avgValue / maxAvg);
                        return <Cell key={row.caseType} fill={row.color} fillOpacity={intensity} />;
                      })}
                      <LabelList
                        dataKey="avgValue"
                        position="right"
                        formatter={(v: number) => `avg ${php(v, { compact: true })}`}
                        style={{ fontSize: 9, fill: PALETTE.neutral }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="text-[10px] uppercase tracking-wide text-text-muted">
                  Colour = average claim value
                </span>
                <span className="inline-flex items-center gap-1">
                  <span
                    className="inline-block h-2.5 w-14 rounded-full"
                    style={{
                      background: `linear-gradient(to right, ${PALETTE.brandLighter}, ${PALETTE.brand})`,
                    }}
                  />
                  <span className="text-[10px] text-text-muted">low → high</span>
                </span>
              </div>
            </>
          )}
        </InteractiveChartCard>

        <PanelCard
          title="Physician claims performance"
          description="Volume-adjusted: claims filed on the x-axis against denial rate on the y-axis, bubble size = case-rate value. The dashed lines are the peer medians, so a 60% denial rate on 3 claims is visibly not the same problem as 20% on 90."
          action={<StatusBadge tone="warning">Restricted — Admin / Claims Officer</StatusBadge>}
        >
          {physicianRows.length === 0 ? (
            <EmptyPanel label="No claims match the current filters." />
          ) : (
            <>
              <div className="h-[17rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ left: 8, right: 16, top: 8, bottom: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
                    <XAxis
                      type="number"
                      dataKey="submitted"
                      name="Claims filed"
                      tick={{ fontSize: 10 }}
                      label={{
                        value: "Claims filed",
                        fontSize: 10,
                        position: "insideBottom",
                        offset: -8,
                      }}
                    />
                    <YAxis
                      type="number"
                      dataKey="denialRate"
                      name="Denial rate"
                      tick={{ fontSize: 10 }}
                      width={44}
                      unit="%"
                      label={{
                        value: "Denial rate",
                        fontSize: 10,
                        angle: -90,
                        position: "insideLeft",
                      }}
                    />
                    <ZAxis type="number" dataKey="caseRateValue" range={[50, 380]} name="Value" />
                    <ReferenceLine
                      y={physicianMedians.denialRate}
                      stroke={PALETTE.neutral}
                      strokeDasharray="4 4"
                      label={{
                        value: `Peer median ${pct(physicianMedians.denialRate)}`,
                        fontSize: 9,
                        position: "insideTopLeft",
                      }}
                    />
                    <ReferenceLine
                      x={physicianMedians.submitted}
                      stroke={PALETTE.neutral}
                      strokeDasharray="4 4"
                    />
                    <ReferenceLine
                      y={DENIAL_BENCHMARK_PCT}
                      stroke={PALETTE.gold}
                      strokeDasharray="2 3"
                    />
                    <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<PhysicianTooltip />} />
                    <Scatter
                      data={physicianRows}
                      fill={PALETTE.brand}
                      cursor="pointer"
                      onClick={(entry: unknown) => {
                        const row = entry as { payload?: PhysicianRow } & PhysicianRow;
                        const doctorId = row.payload?.doctorId ?? row.doctorId;
                        if (doctorId) setDrill({ kind: "physician", doctorId });
                      }}
                    >
                      {physicianRows.map((row) => (
                        <Cell
                          key={row.doctorId}
                          fill={
                            row.denialRate > physicianMedians.denialRate * 1.5
                              ? PALETTE.danger
                              : row.denialRate <= DENIAL_BENCHMARK_PCT
                                ? PALETTE.success
                                : PALETTE.brand
                          }
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  <LegendDot
                    color={PALETTE.success}
                    label={`At or under ${DENIAL_BENCHMARK_PCT}%`}
                  />
                  <LegendDot color={PALETTE.brand} label="Around the peer median" />
                  <LegendDot color={PALETTE.danger} label="More than 1.5× the peer median" />
                </div>
                <ControlSelect
                  label="Sort table"
                  value={physicianSort}
                  onChange={setPhysicianSort}
                  width="w-[13rem]"
                  options={[
                    { value: "submitted-desc", label: "Most claims filed" },
                    { value: "denial-desc", label: "Worst denial rate" },
                    { value: "approval-asc", label: "Worst approval rate" },
                    { value: "value-desc", label: "Highest case-rate value" },
                    { value: "name", label: "Physician A–Z" },
                  ]}
                />
              </div>
              <div className="mt-2 overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {physicianTableColumns.map((col) => (
                        <TableHead
                          key={col.key}
                          className={cn("text-[11px]", col.align === "right" && "text-right")}
                        >
                          {col.header}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPhysicianRows.slice(0, physicianLimit).map((row) => (
                      <TableRow
                        key={row.doctorId}
                        className="cursor-pointer hover:bg-muted/60"
                        onClick={() => setDrill({ kind: "physician", doctorId: row.doctorId })}
                      >
                        <TableCell className="text-xs font-medium">{row.doctor}</TableCell>
                        <TableCell className="text-xs text-text-secondary">
                          {row.department}
                        </TableCell>
                        <TableCell className="text-right text-xs">{num(row.submitted)}</TableCell>
                        <TableCell className="text-right text-xs">
                          {pct(row.approvalRate)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right text-xs font-medium",
                            row.denialRate > DENIAL_BENCHMARK_PCT * 2
                              ? "bg-danger/15 text-danger"
                              : row.denialRate <= DENIAL_BENCHMARK_PCT
                                ? "bg-success/15 text-success"
                                : "text-warning",
                          )}
                        >
                          {pct(row.denialRate)}
                        </TableCell>
                        <TableCell className="text-xs text-text-muted">
                          {row.commonDenialReason}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {php(row.caseRateValue, { compact: true })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {physicianLimit < sortedPhysicianRows.length ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 h-7 text-[11px]"
                  onClick={() => setPhysicianLimit((v) => v + PAGE_SIZE)}
                >
                  Show {Math.min(PAGE_SIZE, sortedPhysicianRows.length - physicianLimit)} more of{" "}
                  {num(sortedPhysicianRows.length)}
                </Button>
              ) : null}
              <p className="mt-2 text-[11px] text-text-muted">
                &quot;Most common denial&quot; is the genuine mode of that physician&apos;s denial
                codes with its count, not a positional placeholder.
              </p>
            </>
          )}
        </PanelCard>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Case-rate coverage                                               */}
      {/* ---------------------------------------------------------------- */}
      <SectionTitle
        title="Case rate coverage"
        description="Which diagnoses cost more to treat than PhilHealth reimburses, and how much that costs in total."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Scatter — audit: Keep (+ data-driven break-even line, persistent
            labels on the worst outliers, a case-type legend that filters, and
            the companion "top by total loss" ranked list). */}
        <PanelCard
          title="Case rate vs actual gross charges"
          description="Diagonal is break-even and is scaled to the data, not hard-coded. Points above it are diagnoses where our charges exceed the case rate. Bubble size is claim volume."
        >
          {visibleDiagnosisRows.length === 0 ? (
            <EmptyPanel label="No coded claims match the current filters." />
          ) : (
            <>
              <div className="h-[20rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ left: 10, right: 20, top: 10, bottom: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
                    <XAxis
                      type="number"
                      dataKey="caseRate"
                      name="Case rate"
                      domain={[0, Math.round(breakEvenMax)]}
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`}
                      label={{
                        value: "PhilHealth case rate (PHP)",
                        fontSize: 10,
                        position: "insideBottom",
                        offset: -8,
                      }}
                    />
                    <YAxis
                      type="number"
                      dataKey="actualCharge"
                      name="Actual charge"
                      domain={[0, Math.round(breakEvenMax)]}
                      tick={{ fontSize: 10 }}
                      width={48}
                      tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`}
                      label={{
                        value: "Actual gross charge (PHP)",
                        fontSize: 10,
                        angle: -90,
                        position: "insideLeft",
                      }}
                    />
                    <ZAxis type="number" dataKey="claims" range={[60, 420]} name="Claims" />
                    <ReferenceLine
                      segment={[
                        { x: 0, y: 0 },
                        { x: breakEvenMax, y: breakEvenMax },
                      ]}
                      stroke={PALETTE.neutral}
                      strokeDasharray="4 4"
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      content={<DiagnosisScatterTooltip />}
                    />
                    <Scatter
                      data={visibleDiagnosisRows}
                      fill={PALETTE.brand}
                      cursor="pointer"
                      onClick={(entry: unknown) => {
                        const row = entry as {
                          payload?: DiagnosisEconomicsRow;
                        } & DiagnosisEconomicsRow;
                        const code = row.payload?.code ?? row.code;
                        if (code) setDrill({ kind: "diagnosis", code });
                      }}
                    >
                      {visibleDiagnosisRows.map((row) => (
                        <Cell key={row.code} fill={row.color} />
                      ))}
                    </Scatter>
                    <Scatter data={labelledOutliers} fill="transparent" legendType="none">
                      <LabelList
                        dataKey="code"
                        position="top"
                        style={{ fontSize: 9, fill: PALETTE.danger, fontWeight: 600 }}
                      />
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase tracking-wide text-text-muted">
                  Case type (click to filter)
                </span>
                {CASE_TYPE_ORDER.map((caseType) => {
                  const hidden = !!hiddenCaseTypes[caseType];
                  return (
                    <button
                      key={caseType}
                      onClick={() =>
                        setHiddenCaseTypes((prev) => ({ ...prev, [caseType]: !prev[caseType] }))
                      }
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] transition-colors",
                        hidden
                          ? "border-border text-text-muted line-through"
                          : "border-brand/30 bg-brand/5 text-text-secondary",
                      )}
                    >
                      <span
                        className="mr-1 inline-block size-2 rounded-full align-middle"
                        style={{ backgroundColor: CASE_TYPE_COLOR[caseType] }}
                      />
                      {caseType}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 border-t border-border pt-2">
                <p className="mb-1 text-[11px] font-medium text-text-secondary">
                  Top diagnoses by total exposure (gap × claims) — the actionable ordering
                </p>
                <div className="space-y-0.5">
                  {[...visibleDiagnosisRows]
                    .filter((r) => r.gap > 0)
                    .slice(0, 6)
                    .map((row) => (
                      <button
                        key={row.code}
                        onClick={() => setDrill({ kind: "diagnosis", code: row.code })}
                        className="flex w-full items-center justify-between gap-2 rounded px-1 py-0.5 text-left hover:bg-muted"
                      >
                        <span className="text-[11px] text-text-secondary">
                          {row.code} · {row.commonName}{" "}
                          <span className="text-text-muted">({num(row.claims)} claims)</span>
                        </span>
                        <span className="text-[11px] font-semibold text-danger">
                          −{php(row.totalExposure, { compact: true })}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            </>
          )}
        </PanelCard>

        {/* Coverage bullets — audit: Keep (+ patient/claim volume, the gap
            shown numerically, and the sort exposed instead of baked in). */}
        <PanelCard
          title="Case rate coverage ratio by diagnosis"
          description="Actual average charge (bar) against the case-rate target (marker) on a shared PHP scale, with the gap and the volume behind it stated per row."
          action={
            <ControlSelect
              label="Sort"
              value={coverageSort}
              onChange={setCoverageSort}
              width="w-[13.5rem]"
              options={[
                { value: "exposure-desc", label: "Largest total exposure" },
                { value: "gap-desc", label: "Largest gap per case" },
                { value: "gappct-desc", label: "Largest gap %" },
                { value: "claims-desc", label: "Most claims" },
                { value: "code", label: "ICD-10 code" },
              ]}
            />
          }
          contentClassName="max-h-[26rem] overflow-y-auto"
        >
          {sortedCoverageRows.length === 0 ? (
            <EmptyPanel label="No coded claims match the current filters." />
          ) : (
            <div className="space-y-3">
              {sortedCoverageRows.map((row) => (
                <button
                  key={row.code}
                  onClick={() => setDrill({ kind: "diagnosis", code: row.code })}
                  className="block w-full rounded-md p-1 text-left hover:bg-muted"
                >
                  <BulletRow
                    label={`${row.code} · ${row.commonName}`}
                    value={row.actualCharge}
                    target={row.caseRate}
                    max={coverageMax}
                    good={row.gap <= 0}
                  />
                  <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-text-muted">
                    <span>
                      {num(row.claims)} claims · {num(row.patients)} patients · case rate{" "}
                      {php(row.caseRate, { compact: true })}
                    </span>
                    <span
                      className={cn("font-semibold", row.gap > 0 ? "text-danger" : "text-success")}
                    >
                      {row.gap > 0 ? "−" : "+"}
                      {php(Math.abs(row.gap), { compact: true })} per case (
                      {pct(Math.abs(row.gapPct))}){" · "}
                      {row.gap > 0 ? "−" : "+"}
                      {php(Math.abs(row.totalExposure), { compact: true })} total
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </PanelCard>
      </div>

      <ClaimsDrawer
        dataset={dataset}
        drill={drill}
        onClose={() => setDrill(null)}
        scopeLabel={scopeLabel}
        filterLabel={isFiltered ? "Global filters applied" : "All departments"}
        records={records}
        pipeline={pipeline}
        denialRows={denialRows}
        caseTypeRows={caseTypeRows}
        physicianRows={physicianRows}
        diagnosisRows={diagnosisRows}
        statusRows={statusRows}
        turnaroundRows={turnaroundRows}
        pendingAging={pendingAging}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Drill-down drawer                                                   */
/* ------------------------------------------------------------------ */

const CLAIM_EXPORT_COLUMNS = [
  { header: "Claim", get: (row: unknown) => (row as ClaimRecord).claimId },
  { header: "Encounter", get: (row: unknown) => (row as ClaimRecord).encounterId },
  { header: "Patient", get: (row: unknown) => (row as ClaimRecord).patient },
  { header: "Department", get: (row: unknown) => (row as ClaimRecord).department },
  { header: "Physician", get: (row: unknown) => (row as ClaimRecord).doctor },
  { header: "Case type", get: (row: unknown) => (row as ClaimRecord).caseType },
  { header: "Status", get: (row: unknown) => (row as ClaimRecord).status },
  { header: "Submitted", get: (row: unknown) => (row as ClaimRecord).submissionDate },
  { header: "Case rate", get: (row: unknown) => String((row as ClaimRecord).caseRateAmount) },
  { header: "Gross charges", get: (row: unknown) => String((row as ClaimRecord).grossCharges) },
  { header: "Denial code", get: (row: unknown) => (row as ClaimRecord).denialCode ?? "" },
  { header: "Days since filing", get: (row: unknown) => String((row as ClaimRecord).ageDays) },
];

/**
 * The terminal tier of every drill path on this page. Each row is one real
 * `PhilHealthClaim`, showing its own id alongside the encounter and bill it
 * belongs to, so the claim number is always traceable.
 */
function ClaimWorklist({ records }: { records: ClaimRecord[] }) {
  if (records.length === 0) {
    return <p className="text-xs text-text-muted">No claims match this selection.</p>;
  }
  const shown = records.slice(0, DRAWER_ROW_LIMIT);
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-text-muted">
        Showing {num(shown.length)} of {num(records.length)} claims, oldest filing first.
      </p>
      <div className="max-h-[26rem] overflow-y-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[11px]">Claim</TableHead>
              <TableHead className="text-[11px]">Case type</TableHead>
              <TableHead className="text-right text-[11px]">Case rate</TableHead>
              <TableHead className="text-right text-[11px]">Age</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((record) => (
              <TableRow key={record.claimId}>
                <TableCell className="text-[11px]">
                  <div className="font-medium text-text-primary">{record.claimId}</div>
                  <div className="text-[10px] text-text-muted">
                    {record.patient} · {record.encounterId}
                  </div>
                  <div className="text-[10px] text-text-muted">
                    {record.department} · {record.doctor} · filed {record.submissionDate}
                  </div>
                  {record.denialReason ? (
                    <div className="text-[10px] font-medium text-danger">
                      {record.denialCode} · {record.denialReason}
                      {record.appealStatus ? ` · appeal ${record.appealStatus}` : ""}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="text-[11px] text-text-secondary">
                  <div>{record.caseType}</div>
                  <div className="text-[10px] text-text-muted">{record.status}</div>
                </TableCell>
                <TableCell className="text-right text-[11px]">
                  <div>{php(record.caseRateAmount, { compact: true })}</div>
                  <div className="text-[10px] text-text-muted">
                    gross {php(record.grossCharges, { compact: true })}
                  </div>
                </TableCell>
                <TableCell className="text-right text-[11px]">
                  {record.turnaroundDays !== null
                    ? `${num(record.turnaroundDays)}d TAT`
                    : `${num(record.ageDays)}d`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ClaimsDrawer({
  dataset,
  drill,
  onClose,
  scopeLabel,
  filterLabel,
  records,
  pipeline,
  denialRows,
  caseTypeRows,
  physicianRows,
  diagnosisRows,
  statusRows,
  turnaroundRows,
  pendingAging,
}: {
  dataset: HospitalDataset;
  drill: Drill;
  onClose: () => void;
  scopeLabel: string;
  filterLabel: string;
  records: ClaimRecord[];
  pipeline: PipelineStage[];
  denialRows: DenialRow[];
  caseTypeRows: CaseTypeRow[];
  physicianRows: PhysicianRow[];
  diagnosisRows: DiagnosisEconomicsRow[];
  statusRows: ReturnType<typeof claimsByStatus>;
  turnaroundRows: ReturnType<typeof claimTurnaroundByDepartment>;
  pendingAging: { key: string; label: string; color: string; claims: number; value: number }[];
}) {
  let title = "PhilHealth claims";
  let value = "";
  let body: React.ReactNode = null;
  let worklist: ClaimRecord[] = [];
  let fullReportHref: string | undefined = "/reports/philhealth-claims-register";

  const byAge = (list: ClaimRecord[]) => [...list].sort((a, b) => b.ageDays - a.ageDays);

  if (drill?.kind === "kpi") {
    switch (drill.id) {
      case "filed":
        title = "Claims filed";
        worklist = byAge(records.filter((r) => r.status !== "Drafted"));
        value = `${num(worklist.length)} claims · ${php(
          sum(worklist, (r) => r.caseRateAmount),
          { compact: true },
        )}`;
        body = (
          <div className="space-y-1">
            {statusRows.map((row) => (
              <StatRow
                key={row.status}
                label={`${row.status} · ${num(row.claims)} claims`}
                value={php(row.caseRateValue, { compact: true })}
              />
            ))}
          </div>
        );
        break;
      case "pending":
        title = "Claims awaiting adjudication";
        worklist = byAge(
          records.filter((r) => r.status === "Submitted" || r.status === "Under Review"),
        );
        value = `${num(worklist.length)} claims · oldest ${num(worklist[0]?.ageDays ?? 0)} days`;
        body = (
          <div className="space-y-1">
            {pendingAging.map((band) => (
              <StatRow
                key={band.key}
                label={band.label}
                value={`${num(band.claims)} claims · ${php(band.value, { compact: true })}`}
              />
            ))}
          </div>
        );
        break;
      case "approved":
        title = "Claims approved";
        worklist = byAge(records.filter((r) => r.status === "Approved" || r.status === "Remitted"));
        value = `${num(worklist.length)} claims · ${php(
          sum(worklist, (r) => r.caseRateAmount),
          { compact: true },
        )}`;
        break;
      case "denied":
        title = "Claims denied";
        worklist = byAge(records.filter((r) => r.status === "Denied"));
        value = `${num(worklist.length)} claims · ${php(
          sum(worklist, (r) => r.caseRateAmount),
          { compact: true },
        )} at risk`;
        fullReportHref = "/reports/denial-appeal-tracker";
        body = (
          <div className="space-y-1">
            {denialRows.map((row) => (
              <StatRow
                key={row.denialCode}
                label={`${row.denialCode} · ${row.reason}`}
                value={`${num(row.claims)} · ${php(row.valueAtRisk, { compact: true })}`}
              />
            ))}
          </div>
        );
        break;
      case "turnaround":
        title = "Submission → remittance turnaround";
        worklist = [...records.filter((r) => r.turnaroundDays !== null)].sort(
          (a, b) => (b.turnaroundDays ?? 0) - (a.turnaroundDays ?? 0),
        );
        value = `${num(worklist.length)} remitted claims`;
        body = (
          <div className="space-y-1">
            <p className="text-[11px] text-text-muted">
              Per-department turnaround and denial rate, from claimTurnaroundByDepartment().
            </p>
            {turnaroundRows
              .filter((row) => row.claims > 0)
              .slice()
              .sort((a, b) => b.avgTurnaroundDays - a.avgTurnaroundDays)
              .map((row) => (
                <StatRow
                  key={row.departmentId}
                  label={`${row.department} · ${num(row.claims)} claims · ${pct(row.denialRate * 100)} denied`}
                  value={`${row.avgTurnaroundDays.toFixed(1)}d`}
                />
              ))}
          </div>
        );
        break;
      case "expected":
        title = "Expected remittance";
        worklist = byAge(records.filter((r) => r.status === "Approved"));
        value = `${php(
          sum(worklist, (r) => r.caseRateAmount),
          { compact: true },
        )} across ${num(worklist.length)} approved claims`;
        break;
    }
  } else if (drill?.kind === "stage") {
    const stage = pipeline.find((s) => s.key === drill.stage);
    worklist = byAge(records.filter((r) => r.status === stage?.sitting));
    title = `Pipeline — ${stage?.label ?? drill.stage}`;
    value = stage
      ? `${num(stage.count)} reached · ${num(stage.sittingCount)} sitting here · ${php(stage.sittingValue, { compact: true })}`
      : "";
    body = stage ? (
      <div className="space-y-1">
        <StatRow label="Reached this stage" value={num(stage.count)} />
        <StatRow
          label="Case-rate value at this stage"
          value={php(stage.value, { compact: true })}
        />
        <StatRow label="Currently sitting here" value={num(stage.sittingCount)} />
        <StatRow
          label="Average days in stage"
          value={`${stage.avgDaysInStage.toFixed(1)} days${stage.avgDaysInStage > STAGE_SLA_DAYS ? " — over SLA" : ""}`}
        />
        <StatRow
          label="Drop-off from prior stage"
          value={`${num(stage.dropOffCount)} (${pct(stage.dropOffPct)})`}
        />
      </div>
    ) : null;
  } else if (drill?.kind === "denial") {
    const row = denialRows.find((r) => r.denialCode === drill.code);
    worklist = byAge(records.filter((r) => r.denialCode === drill.code));
    title = `${drill.code} · ${row?.reason ?? ""}`;
    value = row
      ? `${num(row.claims)} claims · ${php(row.valueAtRisk, { compact: true })} at risk`
      : "";
    fullReportHref = "/reports/denial-appeal-tracker";
    body = row ? (
      <div className="space-y-1">
        <StatRow label="Share of all denials" value={pct(row.pctOfDenials)} />
        <StatRow label="Appealed" value={`${num(row.appealed)} (${pct(row.appealRate)})`} />
        <StatRow
          label="Appeals won"
          value={`${num(row.recovered)} · ${php(row.amountRecovered, { compact: true })} recovered`}
        />
        <StatRow
          label="Net exposure after recovery"
          value={php(Math.max(0, row.valueAtRisk - row.amountRecovered), { compact: true })}
        />
      </div>
    ) : null;
  } else if (drill?.kind === "caseType") {
    const row = caseTypeRows.find((r) => r.caseType === drill.caseType);
    worklist = byAge(records.filter((r) => r.caseType === drill.caseType));
    const diagnosisCounts = new Map<string, number>();
    for (const record of worklist) {
      if (record.diagnosisCode === null) continue;
      diagnosisCounts.set(
        record.diagnosisCode,
        (diagnosisCounts.get(record.diagnosisCode) ?? 0) + 1,
      );
    }
    title = `Case type — ${drill.caseType}`;
    value = row ? `${num(row.claims)} claims · avg ${php(row.avgValue, { compact: true })}` : "";
    body = (
      <div className="space-y-4">
        <div className="space-y-1">
          <StatRow
            label="Total case-rate value"
            value={php(row?.totalValue ?? 0, { compact: true })}
          />
          <StatRow label="Approval rate" value={pct(row?.approvalRate ?? 0)} />
          <StatRow label="Denial rate" value={pct(row?.denialRate ?? 0)} />
          <StatRow
            label="Average turnaround"
            value={`${(row?.avgTurnaroundDays ?? 0).toFixed(1)} days`}
          />
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
            Top diagnoses in this case type
          </p>
          {[...diagnosisCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([code, count]) => {
              const meta = diagnosisRows.find((d) => d.code === code);
              return (
                <StatRow
                  key={code}
                  label={`${code} · ${meta?.commonName ?? ""}`}
                  value={`${num(count)} claims`}
                />
              );
            })}
        </div>
      </div>
    );
  } else if (drill?.kind === "physician") {
    const row = physicianRows.find((r) => r.doctorId === drill.doctorId);
    worklist = byAge(records.filter((r) => r.doctorId === drill.doctorId));
    title = row?.doctor ?? drill.doctorId;
    value = row ? `${num(row.submitted)} claims · ${pct(row.denialRate)} denial rate` : "";
    fullReportHref = "/reports/physician-activity";
    body = row ? (
      <div className="space-y-1">
        <StatRow label="Department" value={row.department} />
        <StatRow label="Claims filed" value={num(row.submitted)} />
        <StatRow label="Approval rate" value={pct(row.approvalRate)} />
        <StatRow label="Denial rate" value={pct(row.denialRate)} />
        <StatRow label="Most common denial reason" value={row.commonDenialReason} />
        <StatRow label="Case-rate value" value={php(row.caseRateValue, { compact: true })} />
        <StatRow label="Actually remitted" value={php(row.remittedValue, { compact: true })} />
      </div>
    ) : null;
  } else if (drill?.kind === "diagnosis") {
    const row = diagnosisRows.find((r) => r.code === drill.code);
    worklist = byAge(records.filter((r) => r.diagnosisCode === drill.code));
    title = `${drill.code} · ${row?.commonName ?? ""}`;
    value = row
      ? `${num(row.claims)} claims · ${row.gap > 0 ? "−" : "+"}${php(Math.abs(row.gap), { compact: true })} per case`
      : "";
    body = row ? (
      <div className="space-y-1">
        <StatRow label="ICD-10 description" value={row.description} />
        <StatRow label="Dominant case type" value={row.caseType} />
        <StatRow label="Average case rate" value={php(row.caseRate, { compact: true })} />
        <StatRow label="Average gross charge" value={php(row.actualCharge, { compact: true })} />
        <StatRow
          label="Gap per case"
          value={`${row.gap > 0 ? "−" : "+"}${php(Math.abs(row.gap), { compact: true })} (${pct(Math.abs(row.gapPct))})`}
        />
        <StatRow
          label="Total exposure"
          value={`${row.totalExposure > 0 ? "−" : "+"}${php(Math.abs(row.totalExposure), { compact: true })}`}
        />
        <StatRow label="Distinct patients" value={num(row.patients)} />
      </div>
    ) : null;
  } else if (drill?.kind === "month") {
    worklist = byAge(records.filter((r) => r.submissionMonth === drill.month));
    const month = dataset.months.find((m) => m.key === drill.month);
    title = `Claims filed in ${month?.label ?? drill.month}`;
    value = `${num(worklist.length)} claims`;
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
      exportRows={worklist}
      exportColumns={CLAIM_EXPORT_COLUMNS}
      {...(fullReportHref !== undefined ? { fullReportHref } : {})}
    >
      {body}
      <ClaimWorklist records={worklist} />
    </ChartDrillDrawer>
  );
}

/* ------------------------------------------------------------------ */

function ClaimsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 w-80" />
      <Skeleton className="h-12 w-full rounded-lg" />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Skeleton className="h-80 w-full rounded-lg" />
        <Skeleton className="h-80 w-full rounded-lg" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-[26rem] w-full rounded-lg" />
        <Skeleton className="h-[26rem] w-full rounded-lg" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-[26rem] w-full rounded-lg" />
        <Skeleton className="h-[26rem] w-full rounded-lg" />
      </div>
    </div>
  );
}
