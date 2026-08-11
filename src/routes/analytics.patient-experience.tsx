/**
 * Patient / Experience Analysis — tier 3 of the hospital analytics hierarchy
 * (Overview -> Comparison -> **Patient/Experience investigation** -> Drill-down).
 *
 * Everything on this page is derived from the shared synthetic dataset
 * (`src/lib/data/hospital/**`) through its derive layer, so the numbers
 * reconcile with every other shared-dataset page. Nothing is authored copy:
 * the correlation callout at the bottom recomputes its claim from the data on
 * every filter change rather than asserting a fixed sentence.
 *
 * The page-local helpers below (feedback record enrichment, age-band cross-tab,
 * driver correlations, Pearson r) deliberately live here rather than in
 * `derive.ts`: they are page-specific cross-tabs over tables the derive layer
 * already exposes, and three other dashboards are being rebuilt against
 * `derive.ts` concurrently.
 */
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MessageSquareQuote, Smile, ThumbsDown, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
  type MetricStatus,
} from "@/components/analytics/shared";
import type { ReportColumn } from "@/components/reports/types";
import {
  ageBand,
  ageOn,
  feedbackByCategory,
  filterEncounters,
  getHospitalDataset,
  losStatsByDepartment,
  npsByDepartment,
  parseDate,
  patientAgeMix,
  readmissionRateByPayerAndDepartment,
  volumeByDepartment,
  type EncounterFilter,
  type FeedbackCategory,
  type HospitalDataset,
} from "@/lib/data/hospital";

export const Route = createFileRoute("/analytics/patient-experience")({
  head: () => ({
    meta: [
      { title: "Patient / Experience Analysis — SugboDoc Analytics" },
      {
        name: "description",
        content: "Patient demographics, NPS, CSAT and feedback by department and service.",
      },
    ],
  }),
  component: PatientExperiencePage,
});

/* ------------------------------------------------------------------ */
/* Page-local types                                                    */
/* ------------------------------------------------------------------ */

const AGE_BAND_ORDER = ["<1", "1-4", "5-17", "18-39", "40-59", "60-74", "75+"] as const;

/** Operational conditions cross-referenced against survey scores. */
type DriverKey = "adverse" | "readmit" | "longStay" | "billing" | "denied";

interface DriverDefinition {
  key: DriverKey;
  label: string;
  /** Exactly how the flag is computed, shown in the UI so the claim is auditable. */
  rule: string;
}

const DRIVER_DEFINITIONS: readonly DriverDefinition[] = [
  {
    key: "adverse",
    label: "Adverse discharge outcome",
    rule: "Encounter disposition is Expired, HAMA or Transferred",
  },
  {
    key: "readmit",
    label: "Readmitted within 30 days",
    rule: "Encounter.readmitted30d is true",
  },
  {
    key: "longStay",
    label: "Long stay (above department P90 LOS)",
    rule: "Inpatient stay longer than the department's 90th-percentile length of stay",
  },
  {
    key: "billing",
    label: "Overdue or written-off bill",
    rule: "Billing.paymentStatus is Overdue or Write-off",
  },
  {
    key: "denied",
    label: "Denied PhilHealth claim",
    rule: "PhilHealthClaim.status is Denied",
  },
] as const;

/** One survey response, joined to its encounter / patient / billing / claim context. */
interface FeedbackRecord {
  id: string;
  encounterId: string;
  submittedDate: string;
  departmentId: string;
  department: string;
  color: string;
  category: FeedbackCategory;
  npsScore: number;
  csatScore: number;
  comment: string | null;
  patientName: string;
  gender: "male" | "female";
  band: string;
  encounterType: string;
  disposition: string;
  losDays: number;
  paymentStatus: string;
  claimStatus: string;
  drivers: DriverKey[];
}

interface DeptExperienceRow {
  departmentId: string;
  department: string;
  color: string;
  responses: number;
  nps: number;
  avgNpsScore: number;
  avgCsat: number;
  promoters: number;
  passives: number;
  detractors: number;
  detractorShare: number;
  encounters: number;
  meanLosDays: number;
  readmissionRate: number;
  responsesPer100: number;
}

interface AgeExperienceRow {
  band: string;
  responses: number;
  avgNpsScore: number;
  avgCsat: number;
  nps: number;
  male: number;
  female: number;
}

interface DriverRow extends DriverDefinition {
  withN: number;
  withAvgNps: number;
  withNpsIndex: number;
  withoutN: number;
  withoutAvgNps: number;
  withoutNpsIndex: number;
  /** Positive = flagged encounters score LOWER on the 0-10 NPS question. */
  gapPoints: number;
  /** Positive = flagged encounters have a LOWER NPS index. */
  gapIndex: number;
}

type ExperienceMetric = "nps" | "avgCsat";
type OverlayMetric = "encounters" | "meanLosDays" | "readmissionRate";
type DeptSortKey =
  "experience-desc" | "experience-asc" | "overlay-desc" | "overlay-asc" | "responses-desc" | "name";
type CategorySortKey = "responses-desc" | "csat-asc" | "csat-desc" | "comments-desc" | "name";
type DemographicSortKey = "band" | "total-desc" | "total-asc";
type AgeSortKey = "band" | "nps-asc" | "nps-desc" | "responses-desc";
type DriverSortKey = "gap-desc" | "gap-asc" | "sample-desc";

type Drill =
  | { kind: "department"; departmentId: string }
  | { kind: "category"; category: FeedbackCategory; departmentId?: string }
  | { kind: "driver"; key: DriverKey }
  | { kind: "ageBand"; band: string }
  | null;

/* ------------------------------------------------------------------ */
/* Pure helpers                                                        */
/* ------------------------------------------------------------------ */

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Classic NPS index (-100..100) from a list of 0-10 scores. */
function npsIndex(scores: number[]): number {
  if (scores.length === 0) return 0;
  let promoters = 0;
  let detractors = 0;
  for (const score of scores) {
    if (score >= 9) promoters += 1;
    else if (score < 7) detractors += 1;
  }
  return Math.round(((promoters - detractors) / scores.length) * 100);
}

/** Pearson correlation coefficient; `null` when undefined (n < 3 or zero variance). */
function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = (xs[i] ?? 0) - mx;
    const dy = (ys[i] ?? 0) - my;
    cov += dx * dy;
    vx += dx * dx;
    vy += dy * dy;
  }
  if (vx === 0 || vy === 0) return null;
  return cov / Math.sqrt(vx * vy);
}

function correlationStrength(r: number): string {
  const a = Math.abs(r);
  if (a >= 0.7) return "strong";
  if (a >= 0.4) return "moderate";
  if (a >= 0.2) return "weak";
  return "negligible";
}

function npsTone(value: number): MetricStatus {
  if (value >= 30) return "good";
  if (value >= 0) return "warning";
  return "danger";
}

function csatTone(value: number): MetricStatus {
  if (value >= 4.2) return "good";
  if (value >= 3.6) return "warning";
  return "danger";
}

function scoreColor(row: { nps: number }): string {
  if (row.nps >= 30) return PALETTE.success;
  if (row.nps >= 0) return PALETTE.warning;
  return PALETTE.danger;
}

const EXPERIENCE_LABEL: Record<ExperienceMetric, string> = {
  nps: "NPS index",
  avgCsat: "Avg CSAT",
};

const EXPERIENCE_UNIT: Record<ExperienceMetric, string> = {
  nps: " pts (-100 to +100)",
  avgCsat: " / 5",
};

const OVERLAY_LABEL: Record<OverlayMetric, string> = {
  encounters: "Encounter volume",
  meanLosDays: "Mean length of stay",
  readmissionRate: "30-day readmission rate",
};

const OVERLAY_UNIT: Record<OverlayMetric, string> = {
  encounters: " encounters",
  meanLosDays: " days",
  readmissionRate: "%",
};

function formatExperience(metric: ExperienceMetric, value: number): string {
  return metric === "nps" ? `${value > 0 ? "+" : ""}${value}` : value.toFixed(2);
}

function formatOverlay(metric: OverlayMetric, value: number): string {
  if (metric === "encounters") return num(value);
  if (metric === "meanLosDays") return value.toFixed(1);
  return value.toFixed(1);
}

/* ------------------------------------------------------------------ */
/* Derivation (page-local cross-tabs over the shared dataset)          */
/* ------------------------------------------------------------------ */

function buildFeedbackRecords(
  dataset: HospitalDataset,
  filter: EncounterFilter,
  p90ByDepartment: ReadonlyMap<string, number>,
): FeedbackRecord[] {
  const encounterIds = new Set(filterEncounters(dataset, filter).map((e) => e.id));
  const anchorMs = parseDate(dataset.anchorDate);
  const records: FeedbackRecord[] = [];

  for (const fb of dataset.feedback) {
    if (!encounterIds.has(fb.encounterId)) continue;
    const encounter = dataset.index.encounterById.get(fb.encounterId);
    const patient = dataset.index.patientById.get(fb.patientId);
    const billing = dataset.index.billingByEncounterId.get(fb.encounterId);
    const claim = dataset.index.claimByEncounterId.get(fb.encounterId);
    const department = dataset.index.departmentById.get(fb.departmentId);
    if (!encounter || !patient) continue;

    const p90 = p90ByDepartment.get(fb.departmentId) ?? 0;
    const drivers: DriverKey[] = [];
    if (
      encounter.disposition === "Expired" ||
      encounter.disposition === "HAMA" ||
      encounter.disposition === "Transferred"
    ) {
      drivers.push("adverse");
    }
    if (encounter.readmitted30d) drivers.push("readmit");
    if (encounter.encounterType === "Inpatient" && p90 > 0 && encounter.losDays > p90) {
      drivers.push("longStay");
    }
    if (billing && (billing.paymentStatus === "Overdue" || billing.paymentStatus === "Write-off")) {
      drivers.push("billing");
    }
    if (claim && claim.status === "Denied") drivers.push("denied");

    records.push({
      id: fb.id,
      encounterId: fb.encounterId,
      submittedDate: fb.submittedDate,
      departmentId: fb.departmentId,
      department: department?.name ?? fb.departmentId,
      color: department ? (PALETTE.brand as string) : PALETTE.neutral,
      category: fb.category,
      npsScore: fb.npsScore,
      csatScore: fb.csatScore,
      comment: fb.comment,
      patientName: patient.name,
      gender: patient.gender,
      band: ageBand(ageOn(patient.birthDate, anchorMs)),
      encounterType: encounter.encounterType,
      disposition: encounter.disposition,
      losDays: encounter.losDays,
      paymentStatus: billing?.paymentStatus ?? "—",
      claimStatus: claim?.status ?? "No claim",
      drivers,
    });
  }
  return records;
}

function buildDriverRows(records: FeedbackRecord[]): DriverRow[] {
  return DRIVER_DEFINITIONS.map((def) => {
    const withScores: number[] = [];
    const withoutScores: number[] = [];
    for (const record of records) {
      if (record.drivers.includes(def.key)) withScores.push(record.npsScore);
      else withoutScores.push(record.npsScore);
    }
    const withAvg = mean(withScores);
    const withoutAvg = mean(withoutScores);
    const withIdx = npsIndex(withScores);
    const withoutIdx = npsIndex(withoutScores);
    return {
      ...def,
      withN: withScores.length,
      withAvgNps: Math.round(withAvg * 100) / 100,
      withNpsIndex: withIdx,
      withoutN: withoutScores.length,
      withoutAvgNps: Math.round(withoutAvg * 100) / 100,
      withoutNpsIndex: withoutIdx,
      gapPoints:
        withScores.length > 0 && withoutScores.length > 0
          ? Math.round((withoutAvg - withAvg) * 100) / 100
          : 0,
      gapIndex: withScores.length > 0 && withoutScores.length > 0 ? withoutIdx - withIdx : 0,
    };
  });
}

function buildAgeExperienceRows(records: FeedbackRecord[]): AgeExperienceRow[] {
  const buckets = new Map<string, number[]>();
  const csat = new Map<string, number[]>();
  const male = new Map<string, number>();
  const female = new Map<string, number>();
  for (const record of records) {
    buckets.set(record.band, [...(buckets.get(record.band) ?? []), record.npsScore]);
    csat.set(record.band, [...(csat.get(record.band) ?? []), record.csatScore]);
    if (record.gender === "male") male.set(record.band, (male.get(record.band) ?? 0) + 1);
    else female.set(record.band, (female.get(record.band) ?? 0) + 1);
  }
  return AGE_BAND_ORDER.map((band) => {
    const scores = buckets.get(band) ?? [];
    const csatScores = csat.get(band) ?? [];
    return {
      band,
      responses: scores.length,
      avgNpsScore: Math.round(mean(scores) * 100) / 100,
      avgCsat: Math.round(mean(csatScores) * 100) / 100,
      nps: npsIndex(scores),
      male: male.get(band) ?? 0,
      female: female.get(band) ?? 0,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Small shared bits of chrome                                         */
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

function ScoreChip({ nps }: { nps: number }) {
  return (
    <StatusBadge tone={npsTone(nps)}>
      {nps > 0 ? "+" : ""}
      {nps} NPS
    </StatusBadge>
  );
}

/** Sample of raw survey rows — the terminal tier of every drill path here. */
function FeedbackSampleTable({
  records,
  limit = 40,
}: {
  records: FeedbackRecord[];
  limit?: number;
}) {
  if (records.length === 0) {
    return <p className="text-xs text-text-muted">No survey responses match this selection.</p>;
  }
  const shown = records.slice(0, limit);
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-text-muted">
        Showing {num(shown.length)} of {num(records.length)} responses, worst score first.
      </p>
      <div className="max-h-[26rem] overflow-y-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[11px]">Patient</TableHead>
              <TableHead className="text-[11px]">Department</TableHead>
              <TableHead className="text-[11px]">Theme</TableHead>
              <TableHead className="text-right text-[11px]">NPS</TableHead>
              <TableHead className="text-right text-[11px]">CSAT</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="text-xs">
                  <div className="font-medium text-text-primary">{record.patientName}</div>
                  <div className="text-[10px] text-text-muted">
                    {record.submittedDate} · {record.encounterType} · {record.disposition}
                    {record.losDays > 0 ? ` · LOS ${record.losDays}d` : ""}
                  </div>
                  {record.comment ? (
                    <div className="mt-0.5 text-[10px] italic text-text-secondary">
                      “{record.comment}”
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="text-xs text-text-secondary">{record.department}</TableCell>
                <TableCell className="text-xs text-text-secondary">{record.category}</TableCell>
                <TableCell
                  className={cn(
                    "text-right text-xs font-semibold",
                    record.npsScore >= 9
                      ? "text-success"
                      : record.npsScore >= 7
                        ? "text-warning"
                        : "text-danger",
                  )}
                >
                  {record.npsScore}/10
                </TableCell>
                <TableCell className="text-right text-xs text-text-secondary">
                  {record.csatScore}/5
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

const FEEDBACK_EXPORT_COLUMNS = [
  { header: "Feedback ID", get: (row: unknown) => (row as FeedbackRecord).id },
  { header: "Date", get: (row: unknown) => (row as FeedbackRecord).submittedDate },
  { header: "Patient", get: (row: unknown) => (row as FeedbackRecord).patientName },
  { header: "Department", get: (row: unknown) => (row as FeedbackRecord).department },
  { header: "Theme", get: (row: unknown) => (row as FeedbackRecord).category },
  { header: "NPS (0-10)", get: (row: unknown) => String((row as FeedbackRecord).npsScore) },
  { header: "CSAT (1-5)", get: (row: unknown) => String((row as FeedbackRecord).csatScore) },
  { header: "Encounter type", get: (row: unknown) => (row as FeedbackRecord).encounterType },
  { header: "Disposition", get: (row: unknown) => (row as FeedbackRecord).disposition },
  { header: "LOS days", get: (row: unknown) => String((row as FeedbackRecord).losDays) },
  { header: "Payment status", get: (row: unknown) => (row as FeedbackRecord).paymentStatus },
  { header: "Claim status", get: (row: unknown) => (row as FeedbackRecord).claimStatus },
  { header: "Comment", get: (row: unknown) => (row as FeedbackRecord).comment ?? "" },
];

/* ------------------------------------------------------------------ */
/* Tooltips                                                            */
/* ------------------------------------------------------------------ */

function DepartmentTooltip({
  active,
  payload,
  experienceMetric,
  overlayMetric,
}: {
  active?: boolean;
  payload?: RichTooltipPayloadEntry[];
  experienceMetric: ExperienceMetric;
  overlayMetric: OverlayMetric;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as unknown as DeptExperienceRow | undefined;
  if (!row) return null;
  return (
    <div className="max-w-[15rem] rounded-md bg-[#111] px-2.5 py-2 text-[11px] leading-relaxed text-white shadow-lg">
      <div className="text-xs font-bold">{row.department}</div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">{EXPERIENCE_LABEL[experienceMetric]}</span>
        <span className="font-semibold">
          {formatExperience(experienceMetric, row[experienceMetric])}
          {EXPERIENCE_UNIT[experienceMetric]}
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">{OVERLAY_LABEL[overlayMetric]}</span>
        <span className="font-semibold">
          {formatOverlay(overlayMetric, row[overlayMetric])}
          {OVERLAY_UNIT[overlayMetric]}
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Survey responses</span>
        <span className="font-semibold">{num(row.responses)}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Detractors</span>
        <span className="font-semibold">
          {num(row.detractors)} ({pct(row.detractorShare)})
        </span>
      </div>
      <div className="mt-1 text-[10px] italic opacity-70">Click the bar to drill down →</div>
    </div>
  );
}

function CategoryTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: RichTooltipPayloadEntry[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as unknown as
    | {
        category: string;
        responses: number;
        avgCsat: number;
        avgNpsScore: number;
        share: number;
        withComment: number;
      }
    | undefined;
  if (!row) return null;
  return (
    <div className="max-w-[15rem] rounded-md bg-[#111] px-2.5 py-2 text-[11px] leading-relaxed text-white shadow-lg">
      <div className="text-xs font-bold">{row.category}</div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Responses</span>
        <span className="font-semibold">
          {num(row.responses)} ({pct(row.share * 100)} of all)
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Avg CSAT</span>
        <span className="font-semibold">{row.avgCsat.toFixed(2)} / 5</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Avg NPS answer</span>
        <span className="font-semibold">{row.avgNpsScore.toFixed(1)} / 10</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">With written comment</span>
        <span className="font-semibold">{num(row.withComment)}</span>
      </div>
      <div className="mt-1 text-[10px] italic opacity-70">Click the bar to read comments →</div>
    </div>
  );
}

function AgeExperienceTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: RichTooltipPayloadEntry[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as unknown as AgeExperienceRow | undefined;
  if (!row) return null;
  return (
    <div className="max-w-[15rem] rounded-md bg-[#111] px-2.5 py-2 text-[11px] leading-relaxed text-white shadow-lg">
      <div className="text-xs font-bold">Age {row.band}</div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">NPS index</span>
        <span className="font-semibold">
          {row.nps > 0 ? "+" : ""}
          {row.nps}
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Avg CSAT</span>
        <span className="font-semibold">{row.avgCsat.toFixed(2)} / 5</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="opacity-80">Responses</span>
        <span className="font-semibold">
          {num(row.responses)} ({num(row.male)} M / {num(row.female)} F)
        </span>
      </div>
      <div className="mt-1 text-[10px] italic opacity-70">Click to drill down →</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function PatientExperiencePage() {
  const dataset = React.useMemo(() => getHospitalDataset(), []);
  const { filters, encounterFilter, isFiltered } = useHospitalFilters();

  /**
   * Survey volume is inherently low (35% response rate on discharged encounters
   * only — 634 responses across the whole 12-month window), so the shared
   * filter's default "This Month" range leaves ~12 responses hospital-wide,
   * which is far too thin to rank 8 departments on. The scope switch keeps every
   * other global filter dimension (department, encounter type, payer, PhilHealth
   * status, PWD, patient category) applied while letting the reader widen the
   * survey window; it defaults to the full window and says so on screen.
   */
  const [scope, setScope] = React.useState<"full" | "global">("full");

  const surveyFilter = React.useMemo<EncounterFilter>(() => {
    if (scope === "global") return encounterFilter;
    const first = dataset.months[0];
    const last = dataset.months[dataset.months.length - 1];
    return {
      ...encounterFilter,
      from: first?.startDate ?? dataset.anchorDate,
      to: last?.endDate ?? dataset.anchorDate,
    };
  }, [scope, encounterFilter, dataset]);

  const scopeLabel =
    scope === "full"
      ? `Full survey window (${dataset.months[0]?.label ?? ""} – ${
          dataset.months[dataset.months.length - 1]?.label ?? ""
        })`
      : filters.dateRange.label;

  /* ---------------- derive layer ---------------- */

  const npsRows = React.useMemo(
    () => npsByDepartment(dataset, surveyFilter),
    [dataset, surveyFilter],
  );
  const volumeRows = React.useMemo(
    () => volumeByDepartment(dataset, surveyFilter),
    [dataset, surveyFilter],
  );
  const losRows = React.useMemo(
    () => losStatsByDepartment(dataset, surveyFilter),
    [dataset, surveyFilter],
  );
  const readmissionRows = React.useMemo(
    () => readmissionRateByPayerAndDepartment(dataset, surveyFilter),
    [dataset, surveyFilter],
  );
  const categoryRows = React.useMemo(
    () => feedbackByCategory(dataset, surveyFilter),
    [dataset, surveyFilter],
  );
  const ageMixRows = React.useMemo(() => patientAgeMix(dataset), [dataset]);

  const p90ByDepartment = React.useMemo(
    () => new Map(losRows.map((r) => [r.departmentId, r.p90LosDays])),
    [losRows],
  );

  const records = React.useMemo(
    () => buildFeedbackRecords(dataset, surveyFilter, p90ByDepartment),
    [dataset, surveyFilter, p90ByDepartment],
  );

  const dischargedInScope = React.useMemo(
    () =>
      filterEncounters(dataset, surveyFilter).filter((e) => e.dischargeDateTime !== null).length,
    [dataset, surveyFilter],
  );

  /* ---------------- combined department rows (experience + operations) ------- */

  const deptRows = React.useMemo<DeptExperienceRow[]>(() => {
    const volumeById = new Map(volumeRows.map((r) => [r.departmentId, r]));
    const losById = new Map(losRows.map((r) => [r.departmentId, r]));
    const readmitById = new Map<string, { eligible: number; readmissions: number }>();
    for (const row of readmissionRows) {
      const current = readmitById.get(row.departmentId) ?? { eligible: 0, readmissions: 0 };
      current.eligible += row.eligibleEncounters;
      current.readmissions += row.readmissions;
      readmitById.set(row.departmentId, current);
    }
    return npsRows
      .map((row) => {
        const volume = volumeById.get(row.departmentId);
        const los = losById.get(row.departmentId);
        const readmit = readmitById.get(row.departmentId);
        const encounters = volume?.encounters ?? 0;
        return {
          departmentId: row.departmentId,
          department: row.department,
          color: row.color,
          responses: row.responses,
          nps: row.nps,
          avgNpsScore: row.avgNpsScore,
          avgCsat: row.avgCsat,
          promoters: row.promoters,
          passives: row.passives,
          detractors: row.detractors,
          detractorShare: row.responses > 0 ? (row.detractors / row.responses) * 100 : 0,
          encounters,
          meanLosDays: los?.meanLosDays ?? 0,
          readmissionRate:
            readmit && readmit.eligible > 0 ? (readmit.readmissions / readmit.eligible) * 100 : 0,
          responsesPer100: encounters > 0 ? (row.responses / encounters) * 100 : 0,
        };
      })
      .filter((row) => row.responses > 0 || row.encounters > 0);
  }, [npsRows, volumeRows, losRows, readmissionRows]);

  const driverRows = React.useMemo(() => buildDriverRows(records), [records]);
  const ageExperienceRows = React.useMemo(() => buildAgeExperienceRows(records), [records]);

  /* ---------------- chart controls ---------------- */

  const [experienceMetric, setExperienceMetric] = React.useState<ExperienceMetric>("nps");
  const [overlayMetric, setOverlayMetric] = React.useState<OverlayMetric>("encounters");
  const [deptSort, setDeptSort] = React.useState<DeptSortKey>("experience-asc");
  const [categorySort, setCategorySort] = React.useState<CategorySortKey>("responses-desc");
  const [demographicSort, setDemographicSort] = React.useState<DemographicSortKey>("band");
  const [ageSort, setAgeSort] = React.useState<AgeSortKey>("band");
  const [driverSort, setDriverSort] = React.useState<DriverSortKey>("gap-desc");
  const [drill, setDrill] = React.useState<Drill>(null);

  const sortedDeptRows = React.useMemo(() => {
    const rows = [...deptRows];
    switch (deptSort) {
      case "experience-desc":
        return rows.sort((a, b) => b[experienceMetric] - a[experienceMetric]);
      case "experience-asc":
        return rows.sort((a, b) => a[experienceMetric] - b[experienceMetric]);
      case "overlay-desc":
        return rows.sort((a, b) => b[overlayMetric] - a[overlayMetric]);
      case "overlay-asc":
        return rows.sort((a, b) => a[overlayMetric] - b[overlayMetric]);
      case "responses-desc":
        return rows.sort((a, b) => b.responses - a.responses);
      case "name":
      default:
        return rows.sort((a, b) => a.department.localeCompare(b.department));
    }
  }, [deptRows, deptSort, experienceMetric, overlayMetric]);

  const sortedCategoryRows = React.useMemo(() => {
    const rows = [...categoryRows];
    switch (categorySort) {
      case "csat-asc":
        return rows.sort((a, b) => a.avgCsat - b.avgCsat);
      case "csat-desc":
        return rows.sort((a, b) => b.avgCsat - a.avgCsat);
      case "comments-desc":
        return rows.sort((a, b) => b.withComment - a.withComment);
      case "name":
        return rows.sort((a, b) => a.category.localeCompare(b.category));
      case "responses-desc":
      default:
        return rows.sort((a, b) => b.responses - a.responses);
    }
  }, [categoryRows, categorySort]);

  const sortedDemographicRows = React.useMemo(() => {
    const rows = ageMixRows.map((row) => ({ ...row, maleNeg: -row.male }));
    switch (demographicSort) {
      case "total-desc":
        return rows.sort((a, b) => b.total - a.total);
      case "total-asc":
        return rows.sort((a, b) => a.total - b.total);
      case "band":
      default:
        return rows;
    }
  }, [ageMixRows, demographicSort]);

  const sortedAgeRows = React.useMemo(() => {
    const rows = [...ageExperienceRows];
    switch (ageSort) {
      case "nps-asc":
        return rows.sort((a, b) => a.nps - b.nps);
      case "nps-desc":
        return rows.sort((a, b) => b.nps - a.nps);
      case "responses-desc":
        return rows.sort((a, b) => b.responses - a.responses);
      case "band":
      default:
        return rows;
    }
  }, [ageExperienceRows, ageSort]);

  const sortedDriverRows = React.useMemo(() => {
    const rows = [...driverRows];
    switch (driverSort) {
      case "gap-asc":
        return rows.sort((a, b) => a.gapPoints - b.gapPoints);
      case "sample-desc":
        return rows.sort((a, b) => b.withN - a.withN);
      case "gap-desc":
      default:
        return rows.sort((a, b) => b.gapPoints - a.gapPoints);
    }
  }, [driverRows, driverSort]);

  /* ---------------- headline numbers ---------------- */

  const totals = React.useMemo(() => {
    const scores = records.map((r) => r.npsScore);
    const csat = records.map((r) => r.csatScore);
    const detractors = scores.filter((s) => s < 7).length;
    const promoters = scores.filter((s) => s >= 9).length;
    return {
      responses: scores.length,
      nps: npsIndex(scores),
      avgCsat: Math.round(mean(csat) * 100) / 100,
      detractorShare: scores.length > 0 ? (detractors / scores.length) * 100 : 0,
      promoterShare: scores.length > 0 ? (promoters / scores.length) * 100 : 0,
      commented: records.filter((r) => r.comment !== null).length,
    };
  }, [records]);

  /** Live correlation between the plotted experience metric and the operational overlay. */
  const correlation = React.useMemo(() => {
    const usable = deptRows.filter((r) => r.responses > 0);
    return {
      r: pearson(
        usable.map((r) => r[overlayMetric]),
        usable.map((r) => r[experienceMetric]),
      ),
      n: usable.length,
    };
  }, [deptRows, experienceMetric, overlayMetric]);

  /**
   * The single sentence the callout panel leads with. Chosen from the computed
   * driver table (largest score gap among adequately-sampled cohorts), never
   * authored.
   */
  const headlineDriver = React.useMemo(() => {
    const wellSampled = driverRows.filter((d) => d.withN >= 20 && d.withoutN >= 20);
    const pool = wellSampled.length > 0 ? wellSampled : driverRows.filter((d) => d.withN > 0);
    return pool.reduce<DriverRow | null>(
      (best, row) => (best === null || row.gapPoints > best.gapPoints ? row : best),
      null,
    );
  }, [driverRows]);

  const worstDept = React.useMemo(
    () =>
      deptRows
        .filter((r) => r.responses >= 5)
        .reduce<DeptExperienceRow | null>(
          (worst, row) => (worst === null || row.nps < worst.nps ? row : worst),
          null,
        ),
    [deptRows],
  );

  /* ---------------- drill data ---------------- */

  const drillPayload = React.useMemo(() => {
    if (!drill) return null;
    const sortWorstFirst = (list: FeedbackRecord[]) =>
      [...list].sort((a, b) => a.npsScore - b.npsScore);

    if (drill.kind === "department") {
      const row = deptRows.find((r) => r.departmentId === drill.departmentId);
      const list = sortWorstFirst(records.filter((r) => r.departmentId === drill.departmentId));
      return {
        title: `${row?.department ?? "Department"} — patient experience`,
        value: row
          ? `${row.nps > 0 ? "+" : ""}${row.nps} NPS · ${row.avgCsat.toFixed(2)}/5 CSAT`
          : "",
        rows: list,
        row,
      };
    }
    if (drill.kind === "category") {
      const list = sortWorstFirst(
        records.filter(
          (r) =>
            r.category === drill.category &&
            (drill.departmentId === undefined || r.departmentId === drill.departmentId),
        ),
      );
      const suffix =
        drill.departmentId !== undefined
          ? ` · ${deptRows.find((d) => d.departmentId === drill.departmentId)?.department ?? ""}`
          : "";
      return {
        title: `Feedback theme: ${drill.category}${suffix}`,
        value: `${num(list.length)} responses · avg CSAT ${
          list.length > 0 ? mean(list.map((r) => r.csatScore)).toFixed(2) : "0.00"
        }/5`,
        rows: list,
        row: undefined,
      };
    }
    if (drill.kind === "driver") {
      const def = driverRows.find((d) => d.key === drill.key);
      const list = sortWorstFirst(records.filter((r) => r.drivers.includes(drill.key)));
      return {
        title: `Driver: ${def?.label ?? drill.key}`,
        value: def
          ? `avg ${def.withAvgNps.toFixed(2)}/10 vs ${def.withoutAvgNps.toFixed(2)}/10 for everyone else`
          : "",
        rows: list,
        row: undefined,
      };
    }
    const list = sortWorstFirst(records.filter((r) => r.band === drill.band));
    return {
      title: `Age band ${drill.band} — patient experience`,
      value: `${num(list.length)} responses · NPS ${npsIndex(list.map((r) => r.npsScore))}`,
      rows: list,
      row: undefined,
    };
  }, [drill, records, deptRows, driverRows]);

  /** Per-department split of the category currently open in the drawer (second drill tier). */
  const categoryByDepartment = React.useMemo(() => {
    if (!drill || drill.kind !== "category") return [];
    const map = new Map<string, { departmentId: string; department: string; scores: number[] }>();
    for (const record of records) {
      if (record.category !== drill.category) continue;
      const entry = map.get(record.departmentId) ?? {
        departmentId: record.departmentId,
        department: record.department,
        scores: [],
      };
      entry.scores.push(record.npsScore);
      map.set(record.departmentId, entry);
    }
    return [...map.values()]
      .map((e) => ({
        departmentId: e.departmentId,
        department: e.department,
        responses: e.scores.length,
        avgNps: Math.round(mean(e.scores) * 10) / 10,
      }))
      .sort((a, b) => b.responses - a.responses);
  }, [drill, records]);

  /* ---------------- table configs (InteractiveChartCard "View as table") ----- */

  const deptTableColumns: ReportColumn<DeptExperienceRow>[] = [
    { key: "department", header: "Department", sortable: true },
    {
      key: "responses",
      header: "Responses",
      align: "right",
      sortable: true,
      render: (r) => num(r.responses),
    },
    {
      key: "nps",
      header: "NPS index",
      align: "right",
      sortable: true,
      render: (r) => `${r.nps > 0 ? "+" : ""}${r.nps}`,
    },
    {
      key: "avgNpsScore",
      header: "Avg NPS (0–10)",
      align: "right",
      sortable: true,
      render: (r) => r.avgNpsScore.toFixed(1),
    },
    {
      key: "avgCsat",
      header: "Avg CSAT (1–5)",
      align: "right",
      sortable: true,
      render: (r) => r.avgCsat.toFixed(2),
    },
    {
      key: "detractorShare",
      header: "Detractors",
      align: "right",
      sortable: true,
      render: (r) => pct(r.detractorShare),
    },
    {
      key: "encounters",
      header: "Encounters",
      align: "right",
      sortable: true,
      render: (r) => num(r.encounters),
    },
    {
      key: "meanLosDays",
      header: "Mean LOS (days)",
      align: "right",
      sortable: true,
      render: (r) => r.meanLosDays.toFixed(1),
    },
    {
      key: "readmissionRate",
      header: "Readmit 30d",
      align: "right",
      sortable: true,
      render: (r) => pct(r.readmissionRate),
    },
    {
      key: "responsesPer100",
      header: "Responses / 100 enc.",
      align: "right",
      sortable: true,
      render: (r) => r.responsesPer100.toFixed(1),
    },
  ];

  const categoryTableColumns: ReportColumn<(typeof sortedCategoryRows)[number]>[] = [
    { key: "category", header: "Theme", sortable: true },
    {
      key: "responses",
      header: "Responses",
      align: "right",
      sortable: true,
      render: (r) => num(r.responses),
    },
    {
      key: "share",
      header: "Share",
      align: "right",
      sortable: true,
      render: (r) => pct(r.share * 100),
    },
    {
      key: "avgCsat",
      header: "Avg CSAT (1–5)",
      align: "right",
      sortable: true,
      render: (r) => r.avgCsat.toFixed(2),
    },
    {
      key: "avgNpsScore",
      header: "Avg NPS (0–10)",
      align: "right",
      sortable: true,
      render: (r) => r.avgNpsScore.toFixed(1),
    },
    {
      key: "withComment",
      header: "With comment",
      align: "right",
      sortable: true,
      render: (r) => num(r.withComment),
    },
  ];

  const ageTableColumns: ReportColumn<AgeExperienceRow>[] = [
    { key: "band", header: "Age band", sortable: true },
    {
      key: "responses",
      header: "Responses",
      align: "right",
      sortable: true,
      render: (r) => num(r.responses),
    },
    {
      key: "nps",
      header: "NPS index",
      align: "right",
      sortable: true,
      render: (r) => `${r.nps > 0 ? "+" : ""}${r.nps}`,
    },
    {
      key: "avgCsat",
      header: "Avg CSAT (1–5)",
      align: "right",
      sortable: true,
      render: (r) => r.avgCsat.toFixed(2),
    },
    { key: "male", header: "Male", align: "right", sortable: true, render: (r) => num(r.male) },
    {
      key: "female",
      header: "Female",
      align: "right",
      sortable: true,
      render: (r) => num(r.female),
    },
  ];

  const demographicTableColumns: ReportColumn<(typeof sortedDemographicRows)[number]>[] = [
    { key: "band", header: "Age band", sortable: true },
    { key: "male", header: "Male", align: "right", sortable: true, render: (r) => num(r.male) },
    {
      key: "female",
      header: "Female",
      align: "right",
      sortable: true,
      render: (r) => num(r.female),
    },
    { key: "total", header: "Total", align: "right", sortable: true, render: (r) => num(r.total) },
  ];

  const hospitalAverage = experienceMetric === "nps" ? totals.nps : totals.avgCsat;

  /* ---------------- render ---------------- */

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Patient / Experience Analysis"
        description="Who our patients are, what they score us, what they tell us — and which operational conditions move those scores."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ControlSelect
              label="Survey window"
              value={scope}
              onChange={setScope}
              width="w-[15rem]"
              options={[
                { value: "full", label: "Full 12-month survey window" },
                { value: "global", label: `Global date filter (${filters.dateRange.label})` },
              ]}
            />
            {isFiltered ? <StatusBadge tone="neutral">Global filters active</StatusBadge> : null}
          </div>
        }
      />

      <GlobalHospitalFilterBar />

      <p className="text-[11px] text-text-muted">
        Scope: <span className="font-medium text-text-secondary">{scopeLabel}</span> ·{" "}
        {num(totals.responses)} survey responses from {num(dischargedInScope)} discharged encounters
        ({pct(dischargedInScope > 0 ? (totals.responses / dischargedInScope) * 100 : 0)} response
        rate). Every non-date global filter above is applied in both scopes; the survey-window
        switch only widens the date range, because post-discharge surveys are low-volume and a
        one-week slice cannot rank eight departments.
      </p>

      <KpiStrip>
        <MetricCard
          label="Net Promoter Score"
          value={`${totals.nps > 0 ? "+" : ""}${totals.nps}`}
          secondary={`${pct(totals.promoterShare)} promoters · ${pct(totals.detractorShare)} detractors`}
          status={npsTone(totals.nps)}
          icon={Smile}
          note="Promoters (9–10) minus detractors (0–6), as % of responses"
        />
        <MetricCard
          label="Average CSAT"
          value={`${totals.avgCsat.toFixed(2)} / 5`}
          secondary={`Across ${num(totals.responses)} responses`}
          status={csatTone(totals.avgCsat)}
          icon={ThumbsDown}
          note="1–5 satisfaction question, derived from the same survey"
        />
        <MetricCard
          label="Survey responses"
          value={num(totals.responses)}
          secondary={`${num(totals.commented)} carry a written comment`}
          status="neutral"
          icon={MessageSquareQuote}
          note={`${pct(dischargedInScope > 0 ? (totals.responses / dischargedInScope) * 100 : 0)} of discharged encounters in scope`}
        />
        <MetricCard
          label="Weakest department"
          value={worstDept ? `${worstDept.nps > 0 ? "+" : ""}${worstDept.nps}` : "n/a"}
          secondary={
            worstDept
              ? `${worstDept.department} · ${num(worstDept.responses)} responses`
              : "No department has ≥5 responses in scope"
          }
          status={worstDept ? npsTone(worstDept.nps) : "neutral"}
          icon={Users}
          {...(worstDept
            ? {
                onClick: () =>
                  setDrill({ kind: "department", departmentId: worstDept.departmentId }),
              }
            : {})}
          note="Lowest NPS index among departments with ≥5 responses"
        />
      </KpiStrip>

      {/* ---------------------------------------------------------------- */}
      {/* 1. Experience + operational load, one view                       */}
      {/* ---------------------------------------------------------------- */}
      <InteractiveChartCard<DeptExperienceRow>
        title="Experience vs operational load, by department"
        description={
          correlation.r === null
            ? `${EXPERIENCE_LABEL[experienceMetric]} (bars) against ${OVERLAY_LABEL[
                overlayMetric
              ].toLowerCase()} (line). Not enough departments with responses to compute a correlation.`
            : `${EXPERIENCE_LABEL[experienceMetric]} (bars, left axis) against ${OVERLAY_LABEL[
                overlayMetric
              ].toLowerCase()} (line, right axis). Pearson r = ${correlation.r.toFixed(2)} across ${
                correlation.n
              } departments — a ${correlationStrength(correlation.r)} ${
                correlation.r < 0 ? "negative" : "positive"
              } relationship.`
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ControlSelect
              label="Score"
              value={experienceMetric}
              onChange={setExperienceMetric}
              width="w-[9rem]"
              options={[
                { value: "nps", label: "NPS index" },
                { value: "avgCsat", label: "Avg CSAT (1–5)" },
              ]}
            />
            <ControlSelect
              label="Overlay"
              value={overlayMetric}
              onChange={setOverlayMetric}
              width="w-[12rem]"
              options={[
                { value: "encounters", label: "Encounter volume" },
                { value: "meanLosDays", label: "Mean LOS (days)" },
                { value: "readmissionRate", label: "30-day readmission %" },
              ]}
            />
            <ControlSelect
              label="Sort"
              value={deptSort}
              onChange={setDeptSort}
              width="w-[13rem]"
              options={[
                { value: "experience-asc", label: "Worst score first" },
                { value: "experience-desc", label: "Best score first" },
                { value: "overlay-desc", label: "Highest operational load" },
                { value: "overlay-asc", label: "Lowest operational load" },
                { value: "responses-desc", label: "Most responses" },
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
        {sortedDeptRows.length === 0 ? (
          <EmptyPanel label="No departments match the current filters." />
        ) : (
          <>
            <div className="h-[22rem]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={sortedDeptRows}
                  margin={{ top: 8, right: 16, bottom: 56, left: 0 }}
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
                    yAxisId="score"
                    tick={{ fontSize: 10 }}
                    domain={experienceMetric === "nps" ? [-100, 100] : [1, 5]}
                    label={{
                      value:
                        experienceMetric === "nps" ? "NPS index (−100…+100)" : "Avg CSAT (1–5)",
                      angle: -90,
                      position: "insideLeft",
                      style: { fontSize: 10 },
                    }}
                  />
                  <YAxis
                    yAxisId="ops"
                    orientation="right"
                    tick={{ fontSize: 10 }}
                    label={{
                      value: `${OVERLAY_LABEL[overlayMetric]}${OVERLAY_UNIT[overlayMetric]}`,
                      angle: 90,
                      position: "insideRight",
                      style: { fontSize: 10 },
                    }}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(68,84,195,0.06)" }}
                    content={
                      <DepartmentTooltip
                        experienceMetric={experienceMetric}
                        overlayMetric={overlayMetric}
                      />
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine
                    yAxisId="score"
                    y={hospitalAverage}
                    stroke={PALETTE.neutral}
                    strokeDasharray="4 4"
                    label={{
                      value: `Hospital ${formatExperience(experienceMetric, hospitalAverage)}`,
                      position: "insideBottomLeft",
                      style: { fontSize: 9, fill: PALETTE.neutral },
                    }}
                  />
                  <Bar
                    yAxisId="score"
                    dataKey={experienceMetric}
                    name={EXPERIENCE_LABEL[experienceMetric]}
                    radius={[3, 3, 0, 0]}
                    cursor="pointer"
                    onClick={(entry: unknown) => {
                      const row = entry as { payload?: DeptExperienceRow } & DeptExperienceRow;
                      const departmentId = row.payload?.departmentId ?? row.departmentId;
                      if (departmentId) setDrill({ kind: "department", departmentId });
                    }}
                  >
                    {sortedDeptRows.map((row) => (
                      <Cell key={row.departmentId} fill={scoreColor(row)} />
                    ))}
                  </Bar>
                  <Line
                    yAxisId="ops"
                    type="monotone"
                    dataKey={overlayMetric}
                    name={OVERLAY_LABEL[overlayMetric]}
                    stroke={PALETTE.brand}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <LegendDot color={PALETTE.success} label="NPS ≥ +30" />
              <LegendDot color={PALETTE.warning} label="NPS 0 to +29" />
              <LegendDot color={PALETTE.danger} label="NPS below 0" />
              <span className="text-[11px] text-text-muted">
                Bar colour restates the NPS band; the line is the operational variable. Click any
                bar to drill into that department&apos;s responses.
              </span>
            </div>
          </>
        )}
      </InteractiveChartCard>

      {/* ---------------------------------------------------------------- */}
      {/* 2. Feedback themes                                               */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid gap-4 xl:grid-cols-2">
        <InteractiveChartCard<(typeof sortedCategoryRows)[number]>
          title="What patients actually talk about"
          description="Survey theme by response volume, with the average CSAT attached to each theme. A high-volume theme with a low CSAT is where the complaints are."
          action={
            <ControlSelect
              label="Sort"
              value={categorySort}
              onChange={setCategorySort}
              width="w-[13rem]"
              options={[
                { value: "responses-desc", label: "Most responses" },
                { value: "csat-asc", label: "Lowest CSAT first" },
                { value: "csat-desc", label: "Highest CSAT first" },
                { value: "comments-desc", label: "Most written comments" },
                { value: "name", label: "Theme A–Z" },
              ]}
            />
          }
          table={{ columns: categoryTableColumns, rows: sortedCategoryRows }}
          onRowClickInTable={(row) => setDrill({ kind: "category", category: row.category })}
        >
          {sortedCategoryRows.length === 0 ? (
            <EmptyPanel label="No survey responses match the current filters." />
          ) : (
            <>
              <div className="h-[20rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={sortedCategoryRows}
                    layout="vertical"
                    margin={{ top: 4, right: 24, bottom: 20, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.35} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10 }}
                      label={{
                        value: "Survey responses",
                        position: "insideBottom",
                        offset: -12,
                        style: { fontSize: 10 },
                      }}
                    />
                    <YAxis type="category" dataKey="category" width={110} tick={{ fontSize: 10 }} />
                    <Tooltip
                      cursor={{ fill: "rgba(68,84,195,0.06)" }}
                      content={<CategoryTooltip />}
                    />
                    <Bar
                      dataKey="responses"
                      name="Responses"
                      radius={[0, 3, 3, 0]}
                      cursor="pointer"
                      onClick={(entry: unknown) => {
                        const row = entry as {
                          payload?: { category: FeedbackCategory };
                          category?: FeedbackCategory;
                        };
                        const category = row.payload?.category ?? row.category;
                        if (category) setDrill({ kind: "category", category });
                      }}
                    >
                      {sortedCategoryRows.map((row) => (
                        <Cell
                          key={row.category}
                          fill={
                            row.avgCsat < 3.7
                              ? PALETTE.danger
                              : row.avgCsat < 4.05
                                ? PALETTE.warning
                                : PALETTE.success
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <LegendDot color={PALETTE.danger} label="Avg CSAT < 3.70" />
                <LegendDot color={PALETTE.warning} label="3.70 – 4.04" />
                <LegendDot color={PALETTE.success} label="≥ 4.05" />
              </div>
            </>
          )}
        </InteractiveChartCard>

        {/* -------------------------------------------------------------- */}
        {/* 3. Demographics                                                */}
        {/* -------------------------------------------------------------- */}
        <InteractiveChartCard<(typeof sortedDemographicRows)[number]>
          title="Patient demographics — age band × gender"
          description={`Registered patient panel (${num(
            ageMixRows.reduce((s, r) => s + r.total, 0),
          )} patients). This is a panel-level population pyramid and is not narrowed by the encounter filters above.`}
          action={
            <ControlSelect
              label="Sort"
              value={demographicSort}
              onChange={setDemographicSort}
              width="w-[12rem]"
              options={[
                { value: "band", label: "Age band (natural)" },
                { value: "total-desc", label: "Largest band first" },
                { value: "total-asc", label: "Smallest band first" },
              ]}
            />
          }
          table={{ columns: demographicTableColumns, rows: sortedDemographicRows }}
        >
          <div className="h-[20rem]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sortedDemographicRows}
                layout="vertical"
                stackOffset="sign"
                margin={{ top: 4, right: 16, bottom: 20, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.35} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v: number) => num(Math.abs(v))}
                  label={{
                    value: "Registered patients (male ← | → female)",
                    position: "insideBottom",
                    offset: -12,
                    style: { fontSize: 10 },
                  }}
                />
                <YAxis type="category" dataKey="band" width={54} tick={{ fontSize: 10 }} />
                <Tooltip
                  cursor={{ fill: "rgba(68,84,195,0.06)" }}
                  content={
                    <RichTooltip
                      valueFormatter={(v) => `${num(Math.abs(v))} patients`}
                      clickHint={false}
                    />
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine x={0} stroke={PALETTE.neutral} />
                <Bar
                  dataKey="maleNeg"
                  name="Male"
                  stackId="pyramid"
                  fill={PALETTE.brand}
                  radius={[3, 0, 0, 3]}
                />
                <Bar
                  dataKey="female"
                  name="Female"
                  stackId="pyramid"
                  fill={PALETTE.gold}
                  radius={[0, 3, 3, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </InteractiveChartCard>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* 4. Experience across the demographic split                       */}
      {/* ---------------------------------------------------------------- */}
      <InteractiveChartCard<AgeExperienceRow>
        title="Experience across the demographic split"
        description="NPS index (bars) and response count (line) per patient age band, computed from the same filtered survey responses. Answers whether a demographic — not just a department — is having a worse experience."
        action={
          <ControlSelect
            label="Sort"
            value={ageSort}
            onChange={setAgeSort}
            width="w-[13rem]"
            options={[
              { value: "band", label: "Age band (natural)" },
              { value: "nps-asc", label: "Worst NPS first" },
              { value: "nps-desc", label: "Best NPS first" },
              { value: "responses-desc", label: "Most responses" },
            ]}
          />
        }
        table={{ columns: ageTableColumns, rows: sortedAgeRows }}
        onRowClickInTable={(row) => setDrill({ kind: "ageBand", band: row.band })}
      >
        {totals.responses === 0 ? (
          <EmptyPanel label="No survey responses match the current filters." />
        ) : (
          <div className="h-[18rem]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={sortedAgeRows}
                margin={{ top: 8, right: 16, bottom: 24, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.35} />
                <XAxis
                  dataKey="band"
                  tick={{ fontSize: 10 }}
                  label={{
                    value: "Patient age band (years)",
                    position: "insideBottom",
                    offset: -14,
                    style: { fontSize: 10 },
                  }}
                />
                <YAxis
                  yAxisId="score"
                  tick={{ fontSize: 10 }}
                  domain={[-100, 100]}
                  label={{
                    value: "NPS index (−100…+100)",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 10 },
                  }}
                />
                <YAxis
                  yAxisId="count"
                  orientation="right"
                  tick={{ fontSize: 10 }}
                  label={{
                    value: "Responses",
                    angle: 90,
                    position: "insideRight",
                    style: { fontSize: 10 },
                  }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(68,84,195,0.06)" }}
                  content={<AgeExperienceTooltip />}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine
                  yAxisId="score"
                  y={totals.nps}
                  stroke={PALETTE.neutral}
                  strokeDasharray="4 4"
                />
                <Bar
                  yAxisId="score"
                  dataKey="nps"
                  name="NPS index"
                  radius={[3, 3, 0, 0]}
                  cursor="pointer"
                  onClick={(entry: unknown) => {
                    const row = entry as { payload?: AgeExperienceRow; band?: string };
                    const band = row.payload?.band ?? row.band;
                    if (band) setDrill({ kind: "ageBand", band });
                  }}
                >
                  {sortedAgeRows.map((row) => (
                    <Cell key={row.band} fill={scoreColor(row)} />
                  ))}
                </Bar>
                <Line
                  yAxisId="count"
                  type="monotone"
                  dataKey="responses"
                  name="Responses"
                  stroke={PALETTE.brand}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </InteractiveChartCard>

      {/* ---------------------------------------------------------------- */}
      {/* 5. Correlation callout                                           */}
      {/* ---------------------------------------------------------------- */}
      <PanelCard
        title="What actually moves the score"
        description="Each row cross-references survey responses against the encounter, billing and claim records behind them. Every number is recomputed from the data under the current filters."
        action={
          <ControlSelect
            label="Sort"
            value={driverSort}
            onChange={setDriverSort}
            width="w-[12rem]"
            options={[
              { value: "gap-desc", label: "Biggest score gap" },
              { value: "gap-asc", label: "Smallest score gap" },
              { value: "sample-desc", label: "Largest cohort" },
            ]}
          />
        }
      >
        {headlineDriver && headlineDriver.withN > 0 ? (
          <div className="mb-3 rounded-md border border-brand/30 bg-brand/5 p-3">
            <p className="text-sm text-text-primary">
              Encounters flagged{" "}
              <span className="font-semibold">{headlineDriver.label.toLowerCase()}</span> score{" "}
              <span className="font-semibold text-danger">
                {headlineDriver.gapPoints.toFixed(2)} points lower
              </span>{" "}
              on the 0–10 NPS question than every other surveyed encounter —{" "}
              {headlineDriver.withAvgNps.toFixed(2)} vs {headlineDriver.withoutAvgNps.toFixed(2)}{" "}
              across {num(headlineDriver.withN)} and {num(headlineDriver.withoutN)} responses. On
              the NPS index that is a{" "}
              <span className="font-semibold text-danger">
                {num(Math.abs(headlineDriver.gapIndex))}-point
              </span>{" "}
              swing ({headlineDriver.withNpsIndex > 0 ? "+" : ""}
              {headlineDriver.withNpsIndex} vs {headlineDriver.withoutNpsIndex > 0 ? "+" : ""}
              {headlineDriver.withoutNpsIndex}).
            </p>
            <p className="mt-1 text-[11px] text-text-muted">
              Rule applied: {headlineDriver.rule}. Selected automatically as the largest gap among
              cohorts with at least 20 responses on both sides.
            </p>
          </div>
        ) : (
          <p className="mb-3 text-xs text-text-muted">
            Not enough survey responses in scope to compute driver correlations.
          </p>
        )}

        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[11px]">Operational condition</TableHead>
                <TableHead className="text-right text-[11px]">Responses</TableHead>
                <TableHead className="text-right text-[11px]">Avg NPS answer</TableHead>
                <TableHead className="text-right text-[11px]">Everyone else</TableHead>
                <TableHead className="text-right text-[11px]">Gap (0–10 pts)</TableHead>
                <TableHead className="text-right text-[11px]">NPS index swing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedDriverRows.map((row) => (
                <TableRow
                  key={row.key}
                  className={cn(row.withN > 0 && "cursor-pointer hover:bg-muted/60")}
                  onClick={() => {
                    if (row.withN > 0) setDrill({ kind: "driver", key: row.key });
                  }}
                >
                  <TableCell className="text-xs">
                    <div className="font-medium text-text-primary">{row.label}</div>
                    <div className="text-[10px] text-text-muted">{row.rule}</div>
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {num(row.withN)}
                    {row.withN > 0 && row.withN < 20 ? (
                      <Badge
                        variant="outline"
                        className="ml-1 border-warning/40 bg-warning/10 text-[9px] text-warning"
                      >
                        small n
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right text-xs font-semibold text-text-primary">
                    {row.withN > 0 ? `${row.withAvgNps.toFixed(2)}/10` : "—"}
                  </TableCell>
                  <TableCell className="text-right text-xs text-text-secondary">
                    {row.withoutN > 0 ? `${row.withoutAvgNps.toFixed(2)}/10` : "—"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right text-xs font-semibold",
                      row.gapPoints > 0 ? "text-danger" : "text-text-muted",
                    )}
                  >
                    {row.withN > 0
                      ? `${row.gapPoints > 0 ? "−" : "+"}${Math.abs(row.gapPoints).toFixed(2)}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right text-xs text-text-secondary">
                    {row.withN > 0 ? (
                      <span>
                        {row.withNpsIndex > 0 ? "+" : ""}
                        {row.withNpsIndex} vs {row.withoutNpsIndex > 0 ? "+" : ""}
                        {row.withoutNpsIndex}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="mt-2 text-[11px] text-text-muted">
          Gap is the average of the 0–10 NPS question for flagged encounters minus everyone else; a
          negative sign means flagged encounters score lower. Click a row to read the underlying
          responses.
        </p>
      </PanelCard>

      {/* ---------------------------------------------------------------- */}
      {/* Drill-down drawer                                                */}
      {/* ---------------------------------------------------------------- */}
      <ChartDrillDrawer
        open={drill !== null}
        onOpenChange={(open) => {
          if (!open) setDrill(null);
        }}
        metricName={drillPayload?.title ?? "Patient experience"}
        value={drillPayload?.value ?? ""}
        dateRangeLabel={scopeLabel}
        filterLabel={isFiltered ? "Global filters applied" : "All departments"}
        exportRows={drillPayload?.rows ?? []}
        exportColumns={FEEDBACK_EXPORT_COLUMNS}
      >
        {drill?.kind === "department" && drillPayload?.row ? (
          <div className="space-y-1">
            <StatRow label="Survey responses" value={num(drillPayload.row.responses)} />
            <StatRow
              label="Promoters / passives / detractors"
              value={`${num(drillPayload.row.promoters)} / ${num(drillPayload.row.passives)} / ${num(
                drillPayload.row.detractors,
              )}`}
            />
            <StatRow label="Avg CSAT" value={`${drillPayload.row.avgCsat.toFixed(2)} / 5`} />
            <StatRow label="Encounters in scope" value={num(drillPayload.row.encounters)} />
            <StatRow label="Mean LOS" value={`${drillPayload.row.meanLosDays.toFixed(1)} days`} />
            <StatRow
              label="30-day readmission rate"
              value={pct(drillPayload.row.readmissionRate)}
            />
            <StatRow
              label="Response coverage"
              value={`${drillPayload.row.responsesPer100.toFixed(1)} per 100 encounters`}
            />
          </div>
        ) : null}

        {drill?.kind === "category" ? (
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
              Where this theme comes from — click to narrow
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Button
                size="sm"
                variant={drill.departmentId === undefined ? "default" : "outline"}
                className="h-6 px-2 text-[10px]"
                onClick={() => setDrill({ kind: "category", category: drill.category })}
              >
                All departments
              </Button>
              {categoryByDepartment.map((row) => (
                <Button
                  key={row.departmentId}
                  size="sm"
                  variant={drill.departmentId === row.departmentId ? "default" : "outline"}
                  className="h-6 px-2 text-[10px]"
                  onClick={() =>
                    setDrill({
                      kind: "category",
                      category: drill.category,
                      departmentId: row.departmentId,
                    })
                  }
                >
                  {row.department} · {num(row.responses)} · {row.avgNps.toFixed(1)}/10
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {drill?.kind === "driver" ? (
          <div className="space-y-1">
            {(() => {
              const row = driverRows.find((d) => d.key === drill.key);
              if (!row) return null;
              return (
                <>
                  <StatRow label="Rule" value={<span className="text-xs">{row.rule}</span>} />
                  <StatRow
                    label="Flagged responses"
                    value={`${num(row.withN)} · avg ${row.withAvgNps.toFixed(2)}/10`}
                  />
                  <StatRow
                    label="All other responses"
                    value={`${num(row.withoutN)} · avg ${row.withoutAvgNps.toFixed(2)}/10`}
                  />
                  <StatRow
                    label="NPS index"
                    value={
                      <span className="flex items-center gap-1.5">
                        <ScoreChip nps={row.withNpsIndex} />
                        <span className="text-text-muted">vs</span>
                        <ScoreChip nps={row.withoutNpsIndex} />
                      </span>
                    }
                  />
                </>
              );
            })()}
          </div>
        ) : null}

        {drill?.kind === "ageBand" ? (
          <div className="space-y-1">
            {(() => {
              const row = ageExperienceRows.find((r) => r.band === drill.band);
              if (!row) return null;
              return (
                <>
                  <StatRow label="Responses" value={num(row.responses)} />
                  <StatRow label="Male / female" value={`${num(row.male)} / ${num(row.female)}`} />
                  <StatRow label="Avg NPS answer" value={`${row.avgNpsScore.toFixed(2)} / 10`} />
                  <StatRow label="Avg CSAT" value={`${row.avgCsat.toFixed(2)} / 5`} />
                  <StatRow label="NPS index" value={<ScoreChip nps={row.nps} />} />
                </>
              );
            })()}
          </div>
        ) : null}

        <FeedbackSampleTable records={drillPayload?.rows ?? []} />
      </ChartDrillDrawer>
    </div>
  );
}
