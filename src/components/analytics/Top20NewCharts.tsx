/* ==========================================================================
 * Top20NewCharts — STANDALONE, UNWIRED PREVIEW COMPONENT
 * ==========================================================================
 *
 * This file implements the 20 approved new analytics charts described in
 * `top20-charts.md` (repo root), sourced strictly from the fields inventoried
 * in `schema.md` (repo root). It is a *preview* file only:
 *
 *   - It is NOT registered in any route.
 *   - It is NOT linked from any nav bar (`src/routes/analytics.tsx`,
 *     `src/routes/lgu.analytics.tsx`) or any existing dashboard page.
 *   - Nothing else in the app imports it.
 *
 * HOW TO VIEW IT LOCALLY
 * ----------------------
 * Either (a) create a temporary route file, e.g.
 *
 *     // src/routes/analytics.preview-top20.tsx
 *     import { createFileRoute } from "@tanstack/react-router";
 *     import Top20NewCharts from "@/components/analytics/Top20NewCharts";
 *     export const Route = createFileRoute("/analytics/preview-top20")({
 *       component: Top20NewCharts,
 *     });
 *
 * or (b) drop `<Top20NewCharts />` into any existing page during local dev.
 *
 * Neither was done here, per explicit instruction — integration is left to
 * the reader.
 *
 * DATA SOURCING NOTES
 * -------------------
 * Charts 1/2/6 read pre-aggregated arrays off `ExecutiveData`. Charts 3-5 and
 * 7-11 read hospital report rows via `getHospitalReport(id).getRows()`, and
 * charts 13-14 and 16-20 read LGU report rows via `getLguReport(id).getRows()`.
 * The row-shape interfaces inside `src/lib/reports/*.mock.tsx` are file-local
 * (non-exported), so this file declares minimal local mirrors of them — every
 * field below was copied verbatim from `schema.md` and cross-checked against
 * the source interfaces. No aggregation logic was added to the mock files;
 * all group-by/derivation happens here.
 *
 * Chart 13 is the only chart in the set that uses D3 (`d3-sankey`), per the
 * spec's "genuine multi-tier flow network" justification. Every other chart
 * uses Recharts or a hand-rolled SVG/grid component in the style already
 * established by `shared.tsx` / `lgu-shared.tsx`.
 *
 * CROSS-CHART FILTERING
 * ---------------------
 * The default export mounts its own `<Top20FilterProvider>` (see
 * `top20-filter-context.tsx`) and a sticky `<Top20FloatingFilterHeader />`.
 * Two dimensions are shared across enough of the 20 charts to be real:
 *
 *   Department -> charts 3, 5, 7, 9, 12 (rows carry `.department`)
 *   Barangay   -> charts 14, 15, 18, 19 directly (`.barangay` / `.name`)
 *              -> charts 13, 17 via the barangay -> BHC join, since those rows
 *                 are keyed by `.bhc`
 *   Geographic Overview panel (below) is the map-shaped entry point into the
 *   barangay dimension.
 *
 * Charts 1, 2, 6, 8, 10, 11, 16 and 20 carry NEITHER field in their source
 * rows (see `schema.md`), so they are deliberately left un-filtered rather than
 * given a fabricated dimension. They keep their existing local click-to-drill.
 * Chart 4 is keyed by `ward`, a hospital axis with no cross-chart counterpart,
 * so it likewise stays local-only.
 *
 * Where a chart draws a *benchmark* reference line ("cohort median",
 * "citywide"), that benchmark is intentionally computed over the UNFILTERED
 * population while the plotted rows are filtered — a median of one barangay
 * would be the point itself and would tell the reader nothing. Captions say so
 * explicitly whenever a filter is active.
 * ========================================================================== */

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { sankey as d3Sankey, sankeyLinkHorizontal, type SankeyGraph } from "d3-sankey";
import { Eye, EyeOff } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LegendDot,
  PALETTE,
  PanelCard,
  SectionTitle,
  StatRow,
  StatusBadge,
  num,
  pct,
  php,
} from "@/components/analytics/shared";
import {
  BarangayChoropleth,
  LGU_COLORS,
  StageFlow,
  choroplethColor,
  type BarangayDatum,
  type FlowStage,
} from "@/components/analytics/lgu-shared";
import {
  Top20FilterProvider,
  Top20FloatingFilterHeader,
  useTop20Filters,
} from "@/components/analytics/top20-filter-context";
import { PH_DEPARTMENT_COLORS } from "@/lib/analytics/ph-constants";
import { getExecutiveData } from "@/lib/analytics/executive.mock";
import { cohortPatients } from "@/lib/analytics/cohort.mock";
import { getNcdData } from "@/lib/analytics/lgu/ncd.mock";
import { getHospitalReport } from "@/lib/reports/hospital.mock";
import { getLguReport } from "@/lib/reports/lgu.mock";
import { cn } from "@/lib/utils";

/* ==========================================================================
 * Local mirrors of the file-local report-row interfaces
 * (field lists taken verbatim from schema.md Part 4 / Part 6)
 * ========================================================================== */

interface CensusRow {
  date: string;
  ward: string;
  capacity: number;
  occupied: number;
  admissionsToday: number;
  dischargesToday: number;
  pendingDischarges: number;
}

interface ClaimRow {
  claimId: string;
  patient: string;
  dateSubmitted: string;
  caseType: string;
  grossCharges: number;
  cr1: number;
  cr2: number;
  patientShare: number;
  status: string;
  department: string;
  physician: string;
}

interface DenialRow {
  claimId: string;
  patient: string;
  denialDate: string;
  denialCode: string;
  denialReason: string;
  appealFiledDate: string | null;
  appealStatus: string;
  rthStatus: string;
  resolutionDate: string | null;
  amountRecovered: number;
  physician: string;
}

interface RevenueRow {
  month: string;
  isoDate: string;
  department: string;
  grossCharges: number;
  outstandingAr: number;
}

interface PhysicianActivityRow {
  physician: string;
  pan: string;
  specialty: string;
  department: string;
  isoDate: string;
  cases: number;
  avgLos: number;
  procedures: number;
  pfRevenue: number;
  philhealthPfClaims: number;
  approvalRate: number;
}

interface LabWorkloadRow {
  isoDate: string;
  test: string;
  loinc: string;
  category: string;
  ordersReceived: number;
  ordersCompleted: number;
  avgTat: number;
  criticalResults: number;
}

interface FormularyRow {
  generic: string;
  brandOrdered: string;
  orders: number;
  percentGeneric: number;
  inNf: boolean;
  physician: string;
  department: string;
}

interface DischargeAuditRow {
  patient: string;
  caseNo: string;
  dischargeDate: string;
  stepsIncomplete: number;
  missingDocuments: string;
  claimStatus: string;
  daysSinceDischarge: number;
  csfCollected: boolean;
}

interface FhsisRow {
  section: string;
  indicator: string;
  month: string;
  isoDate: string;
  count: number;
  target: number;
}

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

interface ReferralRow {
  bhc: string;
  date: string;
  referralReason: string;
  receivingFacility: string;
  outcomeDocumented: boolean;
  outcome: string;
  feedbackReceived: boolean;
}

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

/* ==========================================================================
 * Row accessors + tiny aggregation helpers
 * ========================================================================== */

function hospitalRows<T>(reportId: string): T[] {
  const report = getHospitalReport(reportId);
  return (report ? (report.getRows() as T[]) : []) ?? [];
}

function lguRows<T>(reportId: string): T[] {
  const report = getLguReport(reportId);
  return (report ? (report.getRows() as T[]) : []) ?? [];
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const bucket = map.get(k);
    if (bucket) bucket.push(row);
    else map.set(k, [row]);
  }
  return map;
}

function sumBy<T>(rows: T[], value: (row: T) => number): number {
  return rows.reduce((acc, row) => acc + value(row), 0);
}

function meanBy<T>(rows: T[], value: (row: T) => number): number {
  return rows.length === 0 ? 0 : sumBy(rows, value) / rows.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values));
}

function safeRate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : (numerator / denominator) * 100;
}

/** PH_DEPARTMENT_COLORS is a closed Record — this widens it for free strings. */
const DEPT_COLORS = PH_DEPARTMENT_COLORS as Record<string, string>;

function deptColor(department: string): string {
  return DEPT_COLORS[department] ?? PALETTE.brand;
}

/** Categorical ramp reused across the stacked/segmented charts in this file. */
const SEGMENT_COLORS = [
  PALETTE.brand,
  PALETTE.philhealth,
  PALETTE.hmo,
  PALETTE.success,
  PALETTE.warning,
  PALETTE.danger,
  PALETTE.gold,
  PALETTE.gsis,
] as const;

function segmentColor(index: number): string {
  return SEGMENT_COLORS[index % SEGMENT_COLORS.length] ?? PALETTE.brand;
}

const AXIS_TICK = { fontSize: 11 } as const;
const TOOLTIP_STYLE = { fontSize: 12, borderRadius: 8 } as const;

/* ==========================================================================
 * Small shared UI primitives (local to this preview file)
 * ========================================================================== */

/** Inline detail panel shown after a click-to-select interaction. */
function DetailPanel({
  title,
  onClear,
  children,
}: {
  title: string;
  onClear: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-text-primary">{title}</span>
        <button
          type="button"
          onClick={onClear}
          className="text-[11px] font-medium text-text-muted underline-offset-2 hover:text-text-primary hover:underline"
        >
          Clear selection
        </button>
      </div>
      {children}
    </div>
  );
}

/* --------------------------------------------------------------------------
 * Global-filter affordances
 *
 * A panel that is currently constrained by the dashboard-wide filter must look
 * different from a panel the user merely clicked inside of. `GlobalFilterNote`
 * is the caption; `globalFilterRing` is the panel outline. Both use the brand
 * token so they read as "this is the global selection", while the existing
 * `DetailPanel` (muted) stays the local-selection language.
 * ------------------------------------------------------------------------ */

/** Ring applied to a `PanelCard` whose data is currently globally filtered. */
const globalFilterRing = "ring-1 ring-brand/40";

function GlobalFilterNote({
  dimension,
  value,
  detail,
  onClear,
}: {
  dimension: string;
  value: string;
  detail?: string;
  onClear: () => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-brand/30 bg-brand/5 px-2.5 py-1.5 text-[11px]">
      <span className="size-2 shrink-0 rounded-full bg-brand" />
      <span className="font-medium text-brand">
        Filtered to {dimension}: {value}
      </span>
      {detail ? <span className="text-text-muted">· {detail}</span> : null}
      <button
        type="button"
        onClick={onClear}
        className="ml-auto font-medium text-text-muted underline-offset-2 hover:text-text-primary hover:underline"
      >
        Clear
      </button>
    </div>
  );
}

/**
 * Honest empty state. The mock dataset is sparse enough that a real
 * department/barangay selection can legitimately match zero rows, and silently
 * falling back to the unfiltered data would misreport the answer.
 */
function NoDataForSelection({ what }: { what: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-10 text-center">
      <p className="text-xs font-medium text-text-secondary">No data for this selection</p>
      <p className="mt-1 text-[11px] text-text-muted">{what}</p>
    </div>
  );
}

/** Compact KPI chip strip used by the "chart + KPI card" specs (8, 11, 18, 20). */
function KpiChip({
  label,
  value,
  note,
  tone = "neutral",
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "neutral" | "good" | "warning" | "danger";
}) {
  const toneText: Record<string, string> = {
    neutral: "text-brand",
    good: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  };
  return (
    <div className="min-w-[9rem] flex-1 rounded-lg border border-border bg-card p-3">
      <div className="text-[11px] font-medium text-text-secondary">{label}</div>
      <div className={cn("text-xl font-semibold tracking-tight", toneText[tone])}>{value}</div>
      {note ? <div className="mt-0.5 text-[11px] text-text-muted">{note}</div> : null}
    </div>
  );
}

/**
 * Continuous-value heat grid.
 *
 * `ComplianceHeatmap` in `lgu-shared.tsx` is a three-state (ok/missed/na)
 * grid, so it cannot express a continuous rate ramp. This component keeps the
 * exact same layout/markup/Tailwind conventions as `ComplianceHeatmap` but
 * colors cells with `choroplethColor()` over a numeric domain. Used by charts
 * 4, 12 and 14.
 */
interface HeatCell {
  /** Numeric value driving the color ramp; null renders a "no data" cell. */
  value: number | null;
  /** Tooltip text for the cell. */
  title: string;
  /** Optional short overlay label (e.g. pending-discharge count). */
  badge?: string;
  /** Renders a dashed outline to flag low-confidence cells. */
  lowConfidence?: boolean;
}

function ValueHeatGrid({
  rowLabels,
  columns,
  matrix,
  domain,
  invertRamp = false,
  rowLabelWidth = "9rem",
  minCellWidth = "1.75rem",
  minGridWidth = 480,
  onCellClick,
  selected,
  legend,
}: {
  rowLabels: string[];
  columns: string[];
  matrix: HeatCell[][];
  domain: [number, number];
  /** When true, low values are "hot" (dark) — used for coverage/rate gaps. */
  invertRamp?: boolean;
  rowLabelWidth?: string;
  minCellWidth?: string;
  minGridWidth?: number;
  onCellClick?: (rowIndex: number, colIndex: number) => void;
  selected?: { row: number; col: number } | null;
  legend?: React.ReactNode;
}) {
  const [lo, hi] = domain;
  const span = hi - lo || 1;
  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: minGridWidth }}>
        <div
          className="grid gap-1"
          style={{
            gridTemplateColumns: `${rowLabelWidth} repeat(${columns.length}, minmax(${minCellWidth}, 1fr))`,
          }}
        >
          <div />
          {columns.map((c) => (
            <div key={c} className="text-center text-[10px] text-text-muted">
              {c}
            </div>
          ))}
          {rowLabels.map((label, r) => (
            <React.Fragment key={label}>
              <div className="truncate pr-2 text-[11px] text-text-secondary" title={label}>
                {label}
              </div>
              {(matrix[r] ?? []).map((cell, c) => {
                const raw = cell.value;
                const t = raw === null ? 0 : (raw - lo) / span;
                const ramp = invertRamp ? 1 - t : t;
                const isSelected = selected?.row === r && selected?.col === c;
                return (
                  <button
                    key={`${label}-${columns[c] ?? c}`}
                    type="button"
                    onClick={() => onCellClick?.(r, c)}
                    title={cell.title}
                    className={cn(
                      "relative aspect-square rounded-sm text-[9px] font-semibold transition-transform hover:scale-110",
                      cell.lowConfidence && "outline-dashed outline-1 outline-offset-[-2px]",
                      isSelected && "ring-2 ring-offset-1",
                    )}
                    style={{
                      backgroundColor:
                        raw === null
                          ? "var(--color-muted)"
                          : choroplethColor(Math.max(0, Math.min(1, ramp))),
                      color: ramp > 0.55 ? "#fff" : "var(--color-text-primary, #111)",
                    }}
                  >
                    {cell.badge ?? ""}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
      {legend ? <div className="mt-2 text-[11px] text-text-muted">{legend}</div> : null}
    </div>
  );
}

/** Shared color-ramp legend strip for the heat grids. */
function RampLegend({ from, to, note }: { from: string; to: string; note?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>{from}</span>
      <span className="inline-flex">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="size-3" style={{ backgroundColor: choroplethColor(i / 7) }} />
        ))}
      </span>
      <span>{to}</span>
      {note ? <span className="text-text-muted">· {note}</span> : null}
    </div>
  );
}

/* ==========================================================================
 * SECTION 1 — HOSPITAL ANALYTICS (charts 1-12)
 * ========================================================================== */

/* -------------------------------------------------------------------------
 * 1. Mortality Rate by Diagnosis
 * Source: ExecutiveData.mortality.byDiagnosis (pre-aggregated {name, value}[])
 * ----------------------------------------------------------------------- */
function MortalityByDiagnosisChart() {
  const [selected, setSelected] = React.useState<string | null>(null);

  const { rows, total, kpi } = React.useMemo(() => {
    const exec = getExecutiveData();
    const sorted = [...exec.mortality.byDiagnosis].sort((a, b) => b.value - a.value);
    const totalDeaths = sumBy(sorted, (d) => d.value);
    return {
      rows: sorted.map((d) => ({
        name: d.name,
        value: d.value,
        share: safeRate(d.value, totalDeaths),
      })),
      total: totalDeaths,
      kpi: exec.mortality.value,
    };
  }, []);

  const active = rows.find((r) => r.name === selected) ?? null;

  return (
    <PanelCard
      title="1. Mortality Rate by Diagnosis"
      description="Which diagnoses carry the highest mortality burden, and is it concentrated in a few conditions?"
      action={<StatusBadge tone="danger">Hospital-wide mortality {pct(kpi)}</StatusBadge>}
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
          <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: "var(--color-muted)", fillOpacity: 0.4 }}
            formatter={(value: number, _name, item) => {
              const share = (item as { payload?: { share?: number } }).payload?.share ?? 0;
              return [`${num(value)} deaths · ${pct(share, 0)} of charted deaths`, "Mortality"];
            }}
          />
          <Bar
            dataKey="value"
            radius={[0, 4, 4, 0]}
            cursor="pointer"
            onClick={(entry) =>
              setSelected((prev) => {
                const name = (entry as unknown as { name?: string }).name ?? null;
                return prev === name ? null : name;
              })
            }
          >
            {rows.map((r) => (
              <Cell
                key={r.name}
                fill={PALETTE.danger}
                fillOpacity={selected && selected !== r.name ? 0.35 : 0.9}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {active ? (
        <DetailPanel title={active.name} onClear={() => setSelected(null)}>
          <StatRow label="Deaths attributed" value={num(active.value)} />
          <StatRow label="Share of charted deaths" value={pct(active.share)} />
          <StatRow label="Charted deaths (all diagnoses)" value={num(total)} />
          <StatRow label="Hospital-wide mortality KPI" value={pct(kpi)} />
        </DetailPanel>
      ) : (
        <p className="mt-2 text-[11px] text-text-muted">
          Click a bar for its share of the charted mortality burden.
        </p>
      )}
    </PanelCard>
  );
}

/* -------------------------------------------------------------------------
 * 2. ALOS by Admission Type
 * Source: ExecutiveData.alos.byAdmissionType + ExecutiveData.alos.value
 * ----------------------------------------------------------------------- */
function AlosByAdmissionTypeChart() {
  const { rows, overall } = React.useMemo(() => {
    const exec = getExecutiveData();
    return {
      overall: exec.alos.value,
      rows: exec.alos.byAdmissionType.map((d) => ({
        name: d.name,
        value: d.value,
        delta: d.value - exec.alos.value,
      })),
    };
  }, []);

  return (
    <PanelCard
      title="2. ALOS by Admission Type"
      description="Do emergency, elective, transfer-in and newborn admissions differ meaningfully in length of stay?"
      action={<StatusBadge>Overall ALOS {overall.toFixed(1)} d</StatusBadge>}
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={rows} margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
          <XAxis dataKey="name" tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <YAxis
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={40}
            label={{ value: "Days", angle: -90, fontSize: 11 }}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: "var(--color-muted)", fillOpacity: 0.4 }}
            formatter={(value: number, _name, item) => {
              const delta = (item as { payload?: { delta?: number } }).payload?.delta ?? 0;
              return [
                `${value.toFixed(1)} days (${delta >= 0 ? "+" : ""}${delta.toFixed(1)} vs overall)`,
                "ALOS",
              ];
            }}
          />
          <ReferenceLine
            y={overall}
            stroke={PALETTE.neutral}
            strokeDasharray="4 4"
            label={{
              value: `Overall ${overall.toFixed(1)} d`,
              fontSize: 11,
              position: "insideTopRight",
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {rows.map((r) => (
              <Cell
                key={r.name}
                fill={r.value > overall ? PALETTE.warning : PALETTE.success}
                fillOpacity={0.9}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-[11px] text-text-muted">
        Bars above the dashed line stay longer than the hospital-wide average — a patient-flow /
        boarding-pressure signal.
      </p>
    </PanelCard>
  );
}

/* -------------------------------------------------------------------------
 * 3. Physician Productivity Quadrant
 * Source: PhysicianActivityRow (R-07 `physician-activity`)
 * ----------------------------------------------------------------------- */
function PhysicianProductivityQuadrantChart() {
  const [selected, setSelected] = React.useState<string | null>(null);
  const { department, setDepartment, clearDepartment } = useTop20Filters();

  const { points, medianCases, medianRevenue, rowsByPhysician, xDomain, yDomain } =
    React.useMemo(() => {
      const all = hospitalRows<PhysicianActivityRow>("physician-activity");

      // Global department filter is applied to the raw rows BEFORE aggregation,
      // so the bubbles and the drill-down table are the same filtered cohort.
      const rows = department ? all.filter((r) => r.department === department) : all;

      const byPhysician = groupBy(rows, (r) => r.physician);

      const aggregated = Array.from(byPhysician.entries()).map(([physician, physicianRows]) => {
        const ordered = [...physicianRows].sort((a, b) => a.isoDate.localeCompare(b.isoDate));

        const latest = ordered[ordered.length - 1];

        return {
          physician,
          specialty: latest?.specialty ?? "—",
          department: latest?.department ?? "—",
          cases: sumBy(physicianRows, (r) => r.cases),
          pfRevenue: sumBy(physicianRows, (r) => r.pfRevenue),

          // Bubble size = approval rate for the physician's MOST RECENT month.
          approvalRate: latest?.approvalRate ?? 0,

          procedures: sumBy(physicianRows, (r) => r.procedures),
          philhealthPfClaims: sumBy(physicianRows, (r) => r.philhealthPfClaims),
          avgLos: meanBy(physicianRows, (r) => r.avgLos),
        };
      });

      // Benchmark lines stay on the FULL roster.
      // This prevents a small department from having meaningless medians.
      const benchmarkByPhysician = groupBy(all, (r) => r.physician);

      const benchmark = Array.from(benchmarkByPhysician.values()).map((physicianRows) => ({
        cases: sumBy(physicianRows, (r) => r.cases),
        pfRevenue: sumBy(physicianRows, (r) => r.pfRevenue),
      }));

      /*
       * Calculate chart domains from the ACTUAL displayed data.
       *
       * Instead of:
       *   X = 0 → max
       *   Y = 0 → max
       *
       * we zoom into the range where physicians actually exist.
       *
       * 10% padding keeps bubbles away from the edges.
       */
      const getPaddedDomain = (values: number[], padding = 0.1): [number, number] => {
        if (values.length === 0) {
          return [0, 1];
        }

        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min;

        // If every value is identical, create a small artificial range.
        if (range === 0) {
          const buffer = Math.max(Math.abs(max) * 0.1, 1);

          return [Math.max(0, min - buffer), max + buffer];
        }

        return [Math.max(0, min - range * padding), max + range * padding];
      };

      const xDomain = getPaddedDomain(
        aggregated.map((p) => p.cases),
        0.1,
      );

      const yDomain = getPaddedDomain(
        aggregated.map((p) => p.pfRevenue),
        0.1,
      );

      return {
        points: aggregated,
        medianCases: median(benchmark.map((p) => p.cases)),
        medianRevenue: median(benchmark.map((p) => p.pfRevenue)),
        rowsByPhysician: byPhysician,
        xDomain,
        yDomain,
      };
    }, [department]);

  const activePoint = points.find((p) => p.physician === selected) ?? null;

  const activeRows = activePoint
    ? [...(rowsByPhysician.get(activePoint.physician) ?? [])].sort((a, b) =>
        a.isoDate.localeCompare(b.isoDate),
      )
    : [];

  return (
    <PanelCard
      title="3. Physician Productivity Quadrant"
      description="Who is high-volume but low-revenue (undercoding), and who is high-revenue with a low PhilHealth approval rate?"
      className={department ? globalFilterRing : ""}
    >
      {department ? (
        <GlobalFilterNote
          dimension="department"
          value={department}
          detail={`${num(points.length)} physician(s) in scope`}
          onClear={clearDepartment}
        />
      ) : null}

      {points.length === 0 ? (
        <NoDataForSelection
          what={`No physician-activity rows are recorded for ${department ?? "this selection"}.`}
        />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart
              margin={{
                left: 8,
                right: 20,
                top: 8,
                bottom: 16,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />

              <XAxis
                type="number"
                dataKey="cases"
                name="Cases"
                domain={xDomain}
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                label={{
                  value: "Cases (12-mo sum)",
                  fontSize: 11,
                  position: "insideBottom",
                  offset: -8,
                }}
              />

              <YAxis
                type="number"
                dataKey="pfRevenue"
                name="PF revenue"
                domain={yDomain}
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                width={62}
                tickFormatter={(v: number) => php(v, { compact: true }).replace("PHP ", "")}
                label={{
                  value: "PF revenue",
                  angle: -90,
                  fontSize: 11,
                }}
              />

              <ZAxis type="number" dataKey="approvalRate" range={[60, 460]} name="Approval rate" />

              {/* Benchmark lines remain based on the full physician roster */}
              <ReferenceLine x={medianCases} stroke={PALETTE.neutral} strokeDasharray="4 4" />

              <ReferenceLine y={medianRevenue} stroke={PALETTE.neutral} strokeDasharray="4 4" />

              <Tooltip
                cursor={{
                  strokeDasharray: "3 3",
                }}
                contentStyle={TOOLTIP_STYLE}
                formatter={(value: number, name: string) => {
                  if (name === "PF revenue") {
                    return [php(value, { compact: true }), name];
                  }

                  if (name === "Approval rate") {
                    return [pct(value), name];
                  }

                  return [num(value), name];
                }}
                labelFormatter={() => ""}
              />

              <Scatter
                data={points}
                cursor="pointer"
                onClick={(entry) => {
                  const point = entry as unknown as {
                    physician?: string;
                    department?: string;
                  };

                  const name = point.physician ?? null;

                  // Physician stays a chart-local drill.
                  setSelected((prev) => (prev === name ? null : name));

                  // Department propagates to the dashboard-wide filter.
                  if (point.department) {
                    setDepartment(point.department);
                  }
                }}
              >
                {points.map((p) => (
                  <Cell
                    key={p.physician}
                    fill={deptColor(p.department)}
                    fillOpacity={selected && selected !== p.physician ? 0.25 : 0.75}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>

          <p className="mt-1 text-[11px] text-text-muted">
            Quadrant lines = {department ? "all-department" : "cohort"} median cases / median PF
            revenue
            {department ? " (benchmark held at the full roster)" : ""}. Bubble size =
            most-recent-month approval rate. Bottom-right = high volume, low revenue (possible
            undercoding). Clicking a bubble also filters the dashboard to that physician&apos;s
            department.
          </p>

          {activePoint ? (
            <DetailPanel
              title={`${activePoint.physician} · ${activePoint.specialty}`}
              onClear={() => setSelected(null)}
            >
              <div className="mb-2 grid grid-cols-2 gap-x-4 sm:grid-cols-4">
                <StatRow label="Cases" value={num(activePoint.cases)} />

                <StatRow
                  label="PF revenue"
                  value={php(activePoint.pfRevenue, {
                    compact: true,
                  })}
                />

                <StatRow label="Approval rate" value={pct(activePoint.approvalRate)} />

                <StatRow label="Procedures" value={num(activePoint.procedures)} />
              </div>

              <div className="max-h-52 overflow-y-auto">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-muted/60">
                    <tr className="text-left text-text-secondary">
                      <th className="py-1 pr-2 font-medium">Month</th>

                      <th className="py-1 pr-2 text-right font-medium">Cases</th>

                      <th className="py-1 pr-2 text-right font-medium">Procedures</th>

                      <th className="py-1 pr-2 text-right font-medium">PF revenue</th>

                      <th className="py-1 text-right font-medium">Approval</th>
                    </tr>
                  </thead>

                  <tbody>
                    {activeRows.map((r) => (
                      <tr key={r.isoDate} className="border-t border-border/60">
                        <td className="py-1 pr-2">{r.isoDate.slice(0, 7)}</td>

                        <td className="py-1 pr-2 text-right">{num(r.cases)}</td>

                        <td className="py-1 pr-2 text-right">{num(r.procedures)}</td>

                        <td className="py-1 pr-2 text-right">
                          {php(r.pfRevenue, {
                            compact: true,
                          })}
                        </td>

                        <td className="py-1 text-right">{pct(r.approvalRate, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DetailPanel>
          ) : null}
        </>
      )}
    </PanelCard>
  );
}

/* -------------------------------------------------------------------------
 * 4. Ward Occupancy & Discharge Readiness Heatmap
 * Source: CensusRow (R-01 `daily-census`)
 * ----------------------------------------------------------------------- */
type WardSortMode = "name-asc" | "occupancy-desc" | "occupancy-asc" | "pending-desc";

const WARD_SORT_OPTIONS: { value: WardSortMode; label: string }[] = [
  { value: "name-asc", label: "Ward name (A–Z)" },
  { value: "occupancy-desc", label: "Occupancy (highest first)" },
  { value: "occupancy-asc", label: "Occupancy (lowest first)" },
  { value: "pending-desc", label: "Pending discharges (highest first)" },
];

function WardOccupancyHeatmap() {
  const [selected, setSelected] = React.useState<{ row: number; col: number } | null>(null);
  const [sortMode, setSortMode] = React.useState<WardSortMode>("name-asc");

  const { wardStats, dates, lookup } = React.useMemo(() => {
    const rows = hospitalRows<CensusRow>("daily-census");
    const wardList = uniq(rows.map((r) => r.ward));
    const dateList = uniq(rows.map((r) => r.date)).sort();
    const index = new Map<string, CensusRow>();
    for (const r of rows) index.set(`${r.ward}|${r.date}`, r);

    const stats = wardList.map((ward) => {
      const wardRows = rows.filter((r) => r.ward === ward);
      return {
        ward,
        avgOccupancy: meanBy(wardRows, (r) => safeRate(r.occupied, r.capacity)),
        totalPending: sumBy(wardRows, (r) => r.pendingDischarges),
      };
    });

    return { wardStats: stats, dates: dateList, lookup: index };
  }, []);

  const { wards, matrix } = React.useMemo(() => {
    const sorted = [...wardStats].sort((a, b) => {
      switch (sortMode) {
        case "occupancy-desc":
          return b.avgOccupancy - a.avgOccupancy;
        case "occupancy-asc":
          return a.avgOccupancy - b.avgOccupancy;
        case "pending-desc":
          return b.totalPending - a.totalPending;
        case "name-asc":
        default:
          return a.ward.localeCompare(b.ward);
      }
    });
    const wardList = sorted.map((s) => s.ward);

    const grid: HeatCell[][] = wardList.map((ward) =>
      dates.map((date) => {
        const row = lookup.get(`${ward}|${date}`);
        if (!row) return { value: null, title: `${ward} · ${date}: no data` };
        const occupancy = safeRate(row.occupied, row.capacity);
        return {
          value: occupancy,
          badge: row.pendingDischarges > 0 ? String(row.pendingDischarges) : "",
          title: `${ward} · ${date}\nOccupancy ${pct(occupancy, 0)} (${row.occupied}/${row.capacity})\nAvailable ${row.capacity - row.occupied} · Pending discharges ${row.pendingDischarges}`,
        };
      }),
    );

    return { wards: wardList, matrix: grid };
  }, [wardStats, dates, lookup, sortMode]);

  React.useEffect(() => {
    setSelected(null);
  }, [sortMode]);

  const activeWard = selected ? (wards[selected.row] ?? null) : null;
  const activeDate = selected ? (dates[selected.col] ?? null) : null;
  const activeRow =
    activeWard && activeDate ? (lookup.get(`${activeWard}|${activeDate}`) ?? null) : null;

  return (
    <PanelCard
      title="4. Ward Occupancy & Discharge Readiness Heatmap"
      description="Which wards are gridlocked today — full beds plus a backlog of patients clinically ready to leave?"
      action={
        <Select value={sortMode} onValueChange={(v) => setSortMode(v as WardSortMode)}>
          <SelectTrigger className="h-7 w-[13rem] text-xs">
            <SelectValue placeholder="Sort wards" />
          </SelectTrigger>
          <SelectContent>
            {WARD_SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <ValueHeatGrid
        rowLabels={wards}
        columns={dates.map((d) => d.slice(8))}
        matrix={matrix}
        domain={[50, 100]}
        rowLabelWidth="8.5rem"
        minCellWidth="1.4rem"
        minGridWidth={640}
        onCellClick={(row, col) =>
          setSelected((prev) => (prev?.row === row && prev?.col === col ? null : { row, col }))
        }
        selected={selected}
        legend={
          <RampLegend
            from="50% occupied"
            to="100%+"
            note="cell number = pending discharges that day"
          />
        }
      />

      {activeRow ? (
        <DetailPanel
          title={`${activeRow.ward} · ${activeRow.date}`}
          onClear={() => setSelected(null)}
        >
          <StatRow label="Capacity" value={num(activeRow.capacity)} />
          <StatRow label="Occupied" value={num(activeRow.occupied)} />
          <StatRow label="Available" value={num(activeRow.capacity - activeRow.occupied)} />
          <StatRow
            label="Occupancy rate"
            value={pct(safeRate(activeRow.occupied, activeRow.capacity))}
          />
          <StatRow label="Admissions today" value={num(activeRow.admissionsToday)} />
          <StatRow label="Discharges today" value={num(activeRow.dischargesToday)} />
          <StatRow label="Pending discharges" value={num(activeRow.pendingDischarges)} />
        </DetailPanel>
      ) : (
        <p className="mt-2 text-[11px] text-text-muted">
          Click a cell for that ward/day&apos;s capacity, admissions, discharges and
          pending-clearance count.
        </p>
      )}
    </PanelCard>
  );
}

/* -------------------------------------------------------------------------
 * 5. Departmental AR Trend (outstanding % over time)
 * Source: RevenueRow (R-06 `revenue-collection`)
 * ----------------------------------------------------------------------- */
const AR_HOSPITAL_KEY = "Hospital";
const AR_HOSPITAL_LABEL = "Hospital (total)";

type ArViewMode =
  | "all"
  | "worsening"
  | "improving"
  | "top3-worsening"
  | "top3-improving"
  | "hospital-selected"
  | "custom";

const AR_VIEW_OPTIONS: { value: ArViewMode; label: string }[] = [
  { value: "all", label: "All Departments" },
  { value: "worsening", label: "Worsening Only" },
  { value: "improving", label: "Improving Only" },
  { value: "top3-worsening", label: "Top 3 Worsening" },
  { value: "top3-improving", label: "Top 3 Improving" },
  { value: "hospital-selected", label: "Hospital Total + Selected" },
  { value: "custom", label: "Custom Selection" },
];

type ArPeriod = "3" | "6" | "12" | "all";

const AR_PERIOD_OPTIONS: { value: ArPeriod; label: string }[] = [
  { value: "3", label: "3 Months" },
  { value: "6", label: "6 Months" },
  { value: "12", label: "12 Months" },
  { value: "all", label: "All Available" },
];

const AR_PERIOD_TITLE: Record<ArPeriod, string> = {
  "3": "3-month",
  "6": "6-month",
  "12": "12-month",
  all: "full-history",
};

/** Last N points of a period-sliceable series (or all of them for "all"). */
function sliceByPeriod<T>(rows: T[], period: ArPeriod): T[] {
  if (period === "all") return rows;
  const n = Number(period);
  return rows.slice(Math.max(0, rows.length - n));
}

/** One legend chip for a single department: eye-toggle (compare) + name (drill-down). */
function ArDeptChip({
  dept,
  color,
  visible,
  isIsolated,
  isHighlighted,
  onToggleVisible,
  onIsolate,
  onHoverEnter,
  onHoverLeave,
}: {
  dept: string;
  color: string;
  visible: boolean;
  isIsolated: boolean;
  isHighlighted: boolean;
  onToggleVisible: () => void;
  onIsolate: () => void;
  onHoverEnter: () => void;
  onHoverLeave: () => void;
}) {
  return (
    <span
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] transition-colors",
        isIsolated
          ? "border-brand/50 bg-brand/10 text-brand"
          : isHighlighted
            ? "border-border bg-muted text-text-primary"
            : visible
              ? "border-border bg-card text-text-secondary"
              : "border-border/60 bg-muted/20 text-text-muted",
      )}
    >
      <button
        type="button"
        onClick={onToggleVisible}
        aria-label={visible ? `Hide ${dept} from chart` : `Show ${dept} on chart`}
        title={visible ? `Hide ${dept} from chart` : `Show ${dept} on chart`}
        className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-full hover:bg-muted"
      >
        {visible ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
      </button>
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ background: color, opacity: visible ? 1 : 0.35 }}
      />
      <button
        type="button"
        onClick={onIsolate}
        className={cn("font-medium hover:underline", !visible && "text-text-muted line-through")}
      >
        {dept}
      </button>
    </span>
  );
}

/** Custom tooltip: department/month/AR%/MoM change for every line currently drawn. */
function ArTooltip({
  active,
  payload,
  label,
  periodSeries,
}: {
  active?: boolean;
  payload?: { dataKey?: string; value?: number; color?: string }[];
  label?: string;
  periodSeries: Record<string, string | number>[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const idx = periodSeries.findIndex((p) => p["month"] === label);
  const rows = [...payload].sort((a, b) =>
    a.dataKey === AR_HOSPITAL_KEY ? -1 : b.dataKey === AR_HOSPITAL_KEY ? 1 : 0,
  );

  return (
    <div
      className="rounded-lg border border-border bg-card px-2.5 py-2 shadow-md"
      style={{ fontSize: 12 }}
    >
      <p className="mb-1.5 text-[11px] font-semibold text-text-primary">{label}</p>
      <div className="space-y-1">
        {rows.map((entry) => {
          const key = entry.dataKey ?? "";
          const value = typeof entry.value === "number" ? entry.value : null;
          const prevRaw = idx > 0 ? periodSeries[idx - 1]?.[key] : undefined;
          const prev = typeof prevRaw === "number" ? prevRaw : null;
          const mom = value !== null && prev !== null ? Math.round((value - prev) * 10) / 10 : null;
          const isHospital = key === AR_HOSPITAL_KEY;
          return (
            <div key={key} className="flex items-center gap-1.5 text-[11px]">
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ background: entry.color }}
              />
              <span
                className={isHospital ? "font-semibold text-text-primary" : "text-text-secondary"}
              >
                {isHospital ? AR_HOSPITAL_LABEL : key}
              </span>
              <span className="ml-auto font-medium text-text-primary">
                {value !== null ? pct(value) : "—"}
              </span>
              {mom !== null ? (
                <span
                  className={cn(
                    "font-medium",
                    mom > 0 ? "text-danger" : mom < 0 ? "text-success" : "text-text-muted",
                  )}
                >
                  {mom > 0 ? "+" : ""}
                  {mom.toFixed(1)} pp
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DepartmentalArTrendChart() {
  // This chart's pre-existing "isolate one department" state IS the department
  // dimension, so it was promoted to the global filter rather than duplicated:
  // clicking a department NAME here drives every other department-keyed panel
  // on the page. This is the only interaction that drills down (per spec:
  // visibility toggles use a separate eye-icon control, see `ArDeptChip`).
  const { department, setDepartment, clearDepartment } = useTop20Filters();
  const isolated = department;

  // Hover is purely visual (highlights a line in the chart) and never touches
  // the global filter or the drill-down panel — only a name click does that.
  const [hovered, setHovered] = React.useState<string | null>(null);
  const activeLine = hovered ?? isolated;

  const [viewMode, setViewMode] = React.useState<ArViewMode>("all");
  const [period, setPeriod] = React.useState<ArPeriod>("12");
  // Manually eye-toggled department set — only consulted by the "Custom
  // Selection" / "Hospital Total + Selected" view modes.
  const [manualVisible, setManualVisible] = React.useState<Set<string> | null>(null);

  // Changing the underlying drill-down resets the comparison state — a
  // manually-built set built against 8 departments doesn't mean much once
  // the data collapses to a single isolated department (or expands again).
  React.useEffect(() => {
    setManualVisible(null);
    setViewMode("all");
  }, [department]);

  const { series, departments, byDepartment } = React.useMemo(() => {
    const all = hospitalRows<RevenueRow>("revenue-collection");
    const rows = department ? all.filter((r) => r.department === department) : all;
    const depts = uniq(rows.map((r) => r.department));
    const isoDates = uniq(rows.map((r) => r.isoDate)).sort();
    const labelFor = new Map<string, string>();
    for (const r of rows) labelFor.set(r.isoDate, r.month);

    // Hospital-wide total is a weighted rate over ALL departments' raw
    // outstanding AR / gross charges — never over the (possibly
    // department-filtered) `rows` — so it stays a meaningful benchmark line
    // even while a single department is isolated.
    const hospitalTotals = new Map<string, { ar: number; gross: number }>();
    for (const r of all) {
      const acc = hospitalTotals.get(r.isoDate) ?? { ar: 0, gross: 0 };
      acc.ar += r.outstandingAr;
      acc.gross += r.grossCharges;
      hospitalTotals.set(r.isoDate, acc);
    }

    const chartRows = isoDates.map((iso) => {
      const point: Record<string, string | number> = { month: labelFor.get(iso) ?? iso };
      for (const dept of depts) {
        const match = rows.find((r) => r.isoDate === iso && r.department === dept);
        if (match)
          point[dept] = Math.round(safeRate(match.outstandingAr, match.grossCharges) * 10) / 10;
      }
      const totals = hospitalTotals.get(iso);
      if (totals) point[AR_HOSPITAL_KEY] = Math.round(safeRate(totals.ar, totals.gross) * 10) / 10;
      return point;
    });

    return {
      series: chartRows,
      departments: depts,
      byDepartment: groupBy(rows, (r) => r.department),
    };
  }, [department]);

  // The period control slices the plotted months (and, below, the ranking
  // math) while leaving the global department filter and every other chart
  // untouched — it only ever narrows what THIS chart shows.
  const periodSeries = React.useMemo(() => sliceByPeriod(series, period), [series, period]);

  // Month-over-month change in outstanding AR%, per department + Hospital,
  // computed from the last two points actually on screen (respects `period`).
  // This is the single source of truth for every "worsening/improving" mode
  // below — nothing here is hardcoded.
  const momByKey = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const key of [...departments, AR_HOSPITAL_KEY]) {
      const points = periodSeries
        .map((p) => p[key])
        .filter((v): v is number => typeof v === "number");
      if (points.length >= 2) {
        const change = points[points.length - 1]! - points[points.length - 2]!;
        map.set(key, Math.round(change * 10) / 10);
      }
    }
    return map;
  }, [periodSeries, departments]);

  const rankedByMom = React.useMemo(
    () =>
      [...departments]
        .filter((d) => momByKey.has(d))
        .sort((a, b) => (momByKey.get(b) ?? 0) - (momByKey.get(a) ?? 0)),
    [departments, momByKey],
  );

  const visibleDepts = React.useMemo(() => {
    switch (viewMode) {
      case "worsening":
        return new Set(rankedByMom.filter((d) => (momByKey.get(d) ?? 0) > 0));
      case "improving":
        return new Set(rankedByMom.filter((d) => (momByKey.get(d) ?? 0) < 0));
      case "top3-worsening":
        return new Set(rankedByMom.filter((d) => (momByKey.get(d) ?? 0) > 0).slice(0, 3));
      case "top3-improving":
        return new Set(
          [...rankedByMom]
            .reverse()
            .filter((d) => (momByKey.get(d) ?? 0) < 0)
            .slice(0, 3),
        );
      case "hospital-selected":
        return manualVisible ?? new Set<string>();
      case "custom":
        return manualVisible ?? new Set(departments);
      case "all":
      default:
        return new Set(departments);
    }
  }, [viewMode, rankedByMom, momByKey, manualVisible, departments]);

  const toggleDeptVisible = (dept: string) => {
    setManualVisible((prev) => {
      const base = prev ?? new Set(visibleDepts);
      const next = new Set(base);
      if (next.has(dept)) next.delete(dept);
      else next.add(dept);
      return next;
    });
    setViewMode((prev) => (prev === "hospital-selected" ? prev : "custom"));
  };

  const renderedDepts = departments.filter((d) => visibleDepts.has(d));

  // Trend summary — always computed over every currently-loaded department
  // (i.e. respecting the global department filter, but independent of the
  // View dropdown's visible subset) so it reads as an honest headline rather
  // than an artifact of whichever comparison the user happens to be viewing.
  const worseningDepts = departments.filter((d) => (momByKey.get(d) ?? 0) > 0);
  const worstDept =
    rankedByMom[0] && (momByKey.get(rankedByMom[0]) ?? 0) > 0 ? rankedByMom[0] : null;
  const worstMom = worstDept ? (momByKey.get(worstDept) ?? 0) : null;

  const isolatedRows = isolated
    ? sliceByPeriod(
        [...(byDepartment.get(isolated) ?? [])].sort((a, b) => a.isoDate.localeCompare(b.isoDate)),
        period,
      )
    : [];

  return (
    <PanelCard
      title="5. Departmental AR Trend"
      description="Which departments' uncollected receivables are trending worse month over month?"
      className={department ? globalFilterRing : ""}
      action={
        isolated ? (
          <button
            type="button"
            onClick={clearDepartment}
            className="text-[11px] font-medium text-brand underline-offset-2 hover:underline"
          >
            Show all departments
          </button>
        ) : null
      }
    >
      {department ? (
        <GlobalFilterNote
          dimension="department"
          value={department}
          detail={`${num(isolatedRows.length)} month(s) of revenue rows`}
          onClear={clearDepartment}
        />
      ) : null}

      {departments.length === 0 ? (
        <NoDataForSelection
          what={`No revenue-collection rows are recorded for ${department ?? "this selection"}.`}
        />
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="text-[11px] font-medium text-text-muted">View</span>
              <Select value={viewMode} onValueChange={(v) => setViewMode(v as ArViewMode)}>
                <SelectTrigger className="h-7 w-[12rem] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AR_VIEW_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="text-[11px] font-medium text-text-muted">Period</span>
              <Select value={period} onValueChange={(v) => setPeriod(v as ArPeriod)}>
                <SelectTrigger className="h-7 w-[7.5rem] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AR_PERIOD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
            <span className="font-medium text-text-primary">
              {worseningDepts.length} department{worseningDepts.length === 1 ? "" : "s"} worsening
              MoM
            </span>
            {worstDept && worstMom !== null ? (
              <span className="text-text-muted">
                · Worst deterioration:{" "}
                <span className="font-medium text-danger">
                  {worstDept} +{worstMom.toFixed(1)} pp
                </span>
              </span>
            ) : null}
          </div>

          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={periodSeries} margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={AXIS_TICK} tickLine={false} axisLine={false} />
              <YAxis
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                width={44}
                tickFormatter={(v: number) => `${v}%`}
                label={{ value: "Outstanding AR %", angle: -90, fontSize: 11 }}
              />
              <Tooltip content={<ArTooltip periodSeries={periodSeries} />} />
              {renderedDepts.map((dept) => (
                <Line
                  key={dept}
                  type="monotone"
                  dataKey={dept}
                  stroke={deptColor(dept)}
                  strokeWidth={activeLine === dept ? 2.25 : 1.25}
                  strokeOpacity={activeLine && activeLine !== dept ? 0.18 : 0.85}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
              <Line
                type="monotone"
                dataKey={AR_HOSPITAL_KEY}
                name={AR_HOSPITAL_LABEL}
                stroke={PALETTE.brand}
                strokeWidth={activeLine === AR_HOSPITAL_KEY || !activeLine ? 3.5 : 3}
                strokeOpacity={activeLine && activeLine !== AR_HOSPITAL_KEY ? 0.3 : 1}
                dot={false}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onMouseEnter={() => setHovered(AR_HOSPITAL_KEY)}
              onMouseLeave={() => setHovered(null)}
              onClick={clearDepartment}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors",
                !isolated
                  ? "border-brand bg-brand text-brand-foreground"
                  : "border-brand/40 bg-brand/10 text-brand",
              )}
            >
              <span className="size-2 rounded-full bg-current" />
              {AR_HOSPITAL_LABEL}
            </button>
            {departments.map((dept) => (
              <ArDeptChip
                key={dept}
                dept={dept}
                color={deptColor(dept)}
                visible={visibleDepts.has(dept)}
                isIsolated={isolated === dept}
                isHighlighted={hovered === dept}
                onToggleVisible={() => toggleDeptVisible(dept)}
                onIsolate={() => setDepartment(dept === department ? null : dept)}
                onHoverEnter={() => setHovered(dept)}
                onHoverLeave={() => setHovered(null)}
              />
            ))}
          </div>
          <p className="mt-1 text-[10px] text-text-muted">
            Click departments to compare · Hover to highlight
          </p>

          {isolated ? (
            <DetailPanel
              title={`${isolated} · ${AR_PERIOD_TITLE[period]} AR detail`}
              onClear={clearDepartment}
            >
              <div className="max-h-52 overflow-y-auto">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-muted/60">
                    <tr className="text-left text-text-secondary">
                      <th className="py-1 pr-2 font-medium">Month</th>
                      <th className="py-1 pr-2 text-right font-medium">Gross charges</th>
                      <th className="py-1 pr-2 text-right font-medium">Outstanding AR</th>
                      <th className="py-1 text-right font-medium">AR %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isolatedRows.map((r) => (
                      <tr key={r.isoDate} className="border-t border-border/60">
                        <td className="py-1 pr-2">{r.month}</td>
                        <td className="py-1 pr-2 text-right">
                          {php(r.grossCharges, { compact: true })}
                        </td>
                        <td className="py-1 pr-2 text-right">
                          {php(r.outstandingAr, { compact: true })}
                        </td>
                        <td className="py-1 text-right">
                          {pct(safeRate(r.outstandingAr, r.grossCharges))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DetailPanel>
          ) : null}
        </>
      )}
    </PanelCard>
  );
}

/* -------------------------------------------------------------------------
 * 6. PhilHealth Remittance Batch Status & Value Tracker
 * Source: ExecutiveData.remittance.batches
 * ----------------------------------------------------------------------- */
interface RemittanceBatch {
  batch: string;
  caseType: string;
  claims: number;
  amount: number;
  status: string;
}

function RemittanceBatchTrackerChart() {
  const [selected, setSelected] = React.useState<{ status: string; caseType: string } | null>(null);

  const { chartRows, caseTypes, batches, received, expected } = React.useMemo(() => {
    const exec = getExecutiveData();
    const all: RemittanceBatch[] = exec.remittance.batches;
    const statuses = uniq(all.map((b) => b.status));
    const types = uniq(all.map((b) => b.caseType));
    const rows = statuses.map((status) => {
      const point: Record<string, string | number> = {
        status,
        statusTotal: sumBy(
          all.filter((b) => b.status === status),
          (b) => b.amount,
        ),
        statusClaims: sumBy(
          all.filter((b) => b.status === status),
          (b) => b.claims,
        ),
      };
      for (const type of types) {
        point[type] = sumBy(
          all.filter((b) => b.status === status && b.caseType === type),
          (b) => b.amount,
        );
      }
      return point;
    });
    return {
      chartRows: rows,
      caseTypes: types,
      batches: all,
      received: exec.remittance.received,
      expected: exec.remittance.expected,
    };
  }, []);

  const activeBatches = selected
    ? batches.filter((b) => b.status === selected.status && b.caseType === selected.caseType)
    : [];

  return (
    <PanelCard
      title="6. PhilHealth Remittance Batch Status & Value Tracker"
      description="How much expected remittance is stuck in un-received batches, and which case types drive the delay?"
      action={
        <StatusBadge tone={received >= expected ? "good" : "warning"}>
          {php(received, { compact: true })} of {php(expected, { compact: true })} received
        </StatusBadge>
      }
    >
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={chartRows}
          layout="vertical"
          margin={{ left: 8, right: 24, top: 8, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
          <XAxis
            type="number"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => php(v, { compact: true }).replace("PHP ", "")}
          />
          <YAxis
            type="category"
            dataKey="status"
            width={90}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: "var(--color-muted)", fillOpacity: 0.4 }}
            formatter={(value: number, name: string) => [php(value, { compact: true }), name]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine
            x={expected}
            stroke={PALETTE.neutral}
            strokeDasharray="4 4"
            label={{ value: "Expected total", fontSize: 11, position: "top" }}
          />
          {caseTypes.map((type, i) => (
            <Bar
              key={type}
              dataKey={type}
              stackId="remittance"
              fill={segmentColor(i)}
              cursor="pointer"
              onClick={(entry) => {
                const status = (entry as unknown as { status?: string }).status ?? "";
                setSelected((prev) =>
                  prev && prev.status === status && prev.caseType === type
                    ? null
                    : { status, caseType: type },
                );
              }}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {selected && activeBatches.length > 0 ? (
        <DetailPanel
          title={`${selected.status} · ${selected.caseType}`}
          onClear={() => setSelected(null)}
        >
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-text-secondary">
                <th className="py-1 pr-2 font-medium">Batch</th>
                <th className="py-1 pr-2 text-right font-medium">Claims</th>
                <th className="py-1 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {activeBatches.map((b) => (
                <tr key={b.batch} className="border-t border-border/60">
                  <td className="py-1 pr-2">{b.batch}</td>
                  <td className="py-1 pr-2 text-right">{num(b.claims)}</td>
                  <td className="py-1 text-right">{php(b.amount, { compact: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DetailPanel>
      ) : (
        <p className="mt-2 text-[11px] text-text-muted">
          Click a stacked segment to list the underlying batches for that status and case type.
        </p>
      )}
    </PanelCard>
  );
}

/* -------------------------------------------------------------------------
 * 7. Claims Reimbursement Structure by Case Type (CR1 / CR2 / Patient Share)
 * Source: ClaimRow (R-04 `philhealth-claims-register`)
 * ----------------------------------------------------------------------- */
function ClaimsReimbursementStructureChart() {
  const [selected, setSelected] = React.useState<string | null>(null);
  const { department, clearDepartment } = useTop20Filters();

  const rows = React.useMemo(() => {
    const all = hospitalRows<ClaimRow>("philhealth-claims-register");
    // `ClaimRow.department` exists, so the CR1/CR2/patient-share split is
    // recomputed from the department's own claims — not just recoloured.
    const claims = department ? all.filter((r) => r.department === department) : all;
    return Array.from(groupBy(claims, (r) => r.caseType).entries()).map(([caseType, group]) => {
      const cr1 = sumBy(group, (r) => r.cr1);
      const cr2 = sumBy(group, (r) => r.cr2);
      const patientShare = sumBy(group, (r) => r.patientShare);
      const total = cr1 + cr2 + patientShare;
      return {
        caseType,
        cr1,
        cr2,
        patientShare,
        total,
        claims: group.length,
        grossCharges: sumBy(group, (r) => r.grossCharges),
        patientSharePct: safeRate(patientShare, total),
      };
    });
  }, [department]);

  const active = rows.find((r) => r.caseType === selected) ?? null;

  return (
    <PanelCard
      title="7. Claims Reimbursement Structure by Case Type"
      description="How much of each case type's charge is covered by CR1 + CR2 versus left as patient out-of-pocket?"
      className={department ? globalFilterRing : ""}
    >
      {department ? (
        <GlobalFilterNote
          dimension="department"
          value={department}
          detail={`${num(sumBy(rows, (r) => r.claims))} claim(s) in scope`}
          onClear={clearDepartment}
        />
      ) : null}

      {rows.length === 0 ? (
        <NoDataForSelection
          what={`No PhilHealth claims are registered for ${department ?? "this selection"}.`}
        />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={rows}
              layout="vertical"
              stackOffset="expand"
              margin={{ left: 8, right: 24, top: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
              <XAxis
                type="number"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
              />
              <YAxis
                type="category"
                dataKey="caseType"
                width={100}
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ fill: "var(--color-muted)", fillOpacity: 0.4 }}
                formatter={(value: number, name: string) => [php(value, { compact: true }), name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {(
                [
                  ["cr1", "CR1", PALETTE.philhealth],
                  ["cr2", "CR2", PALETTE.brandLight],
                  ["patientShare", "Patient share", PALETTE.warning],
                ] as const
              ).map(([key, label, color]) => (
                <Bar
                  key={key}
                  dataKey={key}
                  name={label}
                  stackId="structure"
                  fill={color}
                  cursor="pointer"
                  onClick={(entry) => {
                    const caseType = (entry as unknown as { caseType?: string }).caseType ?? null;
                    setSelected((prev) => (prev === caseType ? null : caseType));
                  }}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>

          {active ? (
            <DetailPanel
              title={`${active.caseType} · ${num(active.claims)} claims`}
              onClear={() => setSelected(null)}
            >
              <StatRow label="Gross charges" value={php(active.grossCharges, { compact: true })} />
              <StatRow
                label="CR1"
                value={`${php(active.cr1, { compact: true })} · ${pct(safeRate(active.cr1, active.total))}`}
              />
              <StatRow
                label="CR2"
                value={`${php(active.cr2, { compact: true })} · ${pct(safeRate(active.cr2, active.total))}`}
              />
              <StatRow
                label="Patient share"
                value={`${php(active.patientShare, { compact: true })} · ${pct(active.patientSharePct)}`}
              />
            </DetailPanel>
          ) : (
            <p className="mt-2 text-[11px] text-text-muted">
              Click a segment for exact PHP amounts and out-of-pocket exposure for that case type.
              Case type is not a cross-chart dimension, so this click stays local — the panel
              follows the global Department filter instead.
            </p>
          )}
        </>
      )}
    </PanelCard>
  );
}

/* -------------------------------------------------------------------------
 * 8. Appeal Recovery Funnel & Amount Recovered
 * Source: DenialRow (R-05 `denial-appeal-tracker`) — reuses <StageFlow />
 * ----------------------------------------------------------------------- */
function AppealRecoveryFunnelChart() {
  const [selectedStage, setSelectedStage] = React.useState<string | null>(null);

  const { stages, statusCounts, totalRecovered, appealRate, denied, rowsForStage } =
    React.useMemo(() => {
      const rows = hospitalRows<DenialRow>("denial-appeal-tracker");
      const filed = rows.filter((r) => r.appealFiledDate !== null);
      const reviewedOrBeyond = rows.filter((r) =>
        ["Under Review", "Approved", "Rejected"].includes(r.appealStatus),
      );
      const approved = rows.filter((r) => r.appealStatus === "Approved");

      const flow: FlowStage[] = [
        { id: "denied", label: "Denied claims", value: rows.length },
        { id: "filed", label: "Appeal filed", value: filed.length },
        { id: "review", label: "Under review or resolved", value: reviewedOrBeyond.length },
        { id: "approved", label: "Appeal approved", value: approved.length },
      ];

      const buckets = Array.from(groupBy(rows, (r) => r.appealStatus).entries()).map(
        ([status, group]) => ({
          status,
          count: group.length,
          recovered: sumBy(group, (r) => r.amountRecovered),
        }),
      );

      const stageRows: Record<string, DenialRow[]> = {
        denied: rows,
        filed,
        review: reviewedOrBeyond,
        approved,
      };

      return {
        stages: flow,
        statusCounts: buckets,
        totalRecovered: sumBy(approved, (r) => r.amountRecovered),
        appealRate: safeRate(filed.length, rows.length),
        denied: rows.length,
        rowsForStage: stageRows,
      };
    }, []);

  const activeRows = selectedStage ? (rowsForStage[selectedStage] ?? []) : [];
  const activeLabel = stages.find((s) => s.id === selectedStage)?.label ?? "";

  return (
    <PanelCard
      title="8. Appeal Recovery Funnel & Amount Recovered"
      description="Of the claims that get denied, how many are appealed — and how much PHP is actually recovered?"
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <KpiChip label="Denied claims" value={num(denied)} />
        <KpiChip
          label="Appeal rate"
          value={pct(appealRate)}
          note="appealFiledDate not null"
          tone={appealRate >= 60 ? "good" : "warning"}
        />
        <KpiChip
          label="PHP recovered"
          value={php(totalRecovered, { compact: true })}
          note="appealStatus = Approved"
          tone="good"
        />
      </div>

      <StageFlow
        stages={stages}
        onStageClick={(stage) => setSelectedStage((prev) => (prev === stage.id ? null : stage.id))}
      />

      <div className="mt-3 grid gap-1 sm:grid-cols-2">
        {statusCounts.map((b) => (
          <div key={b.status} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-text-secondary">{b.status}</span>
            <span className="font-medium text-text-primary">
              {num(b.count)} claims
              {b.recovered > 0 ? ` · ${php(b.recovered, { compact: true })} recovered` : ""}
            </span>
          </div>
        ))}
      </div>

      {selectedStage ? (
        <DetailPanel
          title={`${activeLabel} · ${num(activeRows.length)} claims`}
          onClear={() => setSelectedStage(null)}
        >
          <div className="max-h-52 overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-muted/60">
                <tr className="text-left text-text-secondary">
                  <th className="py-1 pr-2 font-medium">Claim</th>
                  <th className="py-1 pr-2 font-medium">Denial code</th>
                  <th className="py-1 pr-2 font-medium">Appeal status</th>
                  <th className="py-1 text-right font-medium">Recovered</th>
                </tr>
              </thead>
              <tbody>
                {activeRows.map((r) => (
                  <tr key={r.claimId} className="border-t border-border/60">
                    <td className="py-1 pr-2">{r.claimId}</td>
                    <td className="py-1 pr-2">{r.denialCode}</td>
                    <td className="py-1 pr-2">{r.appealStatus}</td>
                    <td className="py-1 text-right">
                      {r.amountRecovered > 0 ? php(r.amountRecovered, { compact: true }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DetailPanel>
      ) : (
        <p className="mt-2 text-[11px] text-text-muted">
          Click a funnel stage to list the underlying claims. Note: `DenialRow` carries no
          denied-amount field, so recovery cannot be expressed as a % of value-at-risk.
        </p>
      )}
    </PanelCard>
  );
}

/* -------------------------------------------------------------------------
 * 9. Formulary Generic-Substitution Rate by Drug
 * Source: FormularyRow (R-09 `formulary-compliance`)
 * ----------------------------------------------------------------------- */
const GENERIC_SUBSTITUTION_TARGET = 80; // judgment call — no target field exists on FormularyRow

function FormularySubstitutionChart() {
  const [selected, setSelected] = React.useState<string | null>(null);
  const { department, setDepartment, clearDepartment } = useTop20Filters();

  const { drugs, byDrug } = React.useMemo(() => {
    const all = hospitalRows<FormularyRow>("formulary-compliance");
    const rows = department ? all.filter((r) => r.department === department) : all;
    const grouped = groupBy(rows, (r) => r.generic);
    const aggregated = Array.from(grouped.entries())
      .map(([generic, group]) => {
        const orders = sumBy(group, (r) => r.orders);
        // Volume-weighted mean, so a high-volume drug dominates its own score.
        const weighted =
          orders === 0 ? 0 : sumBy(group, (r) => r.orders * r.percentGeneric) / orders;
        return {
          generic,
          orders,
          percentGeneric: Math.round(weighted * 10) / 10,
          inNf: group.some((r) => r.inNf),
          brands: uniq(group.map((r) => r.brandOrdered)).join(", "),
        };
      })
      .sort((a, b) => a.percentGeneric - b.percentGeneric);
    return { drugs: aggregated, byDrug: grouped };
  }, [department]);

  const activeRows = selected
    ? [...(byDrug.get(selected) ?? [])].sort((a, b) => a.percentGeneric - b.percentGeneric)
    : [];

  return (
    <PanelCard
      title="9. Formulary Generic-Substitution Rate by Drug"
      description="Which drugs have the worst generic-substitution compliance, so P&T knows where to enforce the formulary?"
      className={department ? globalFilterRing : ""}
      action={<StatusBadge tone="warning">Target {GENERIC_SUBSTITUTION_TARGET}%</StatusBadge>}
    >
      {department ? (
        <GlobalFilterNote
          dimension="department"
          value={department}
          detail={`${num(drugs.length)} generic(s) prescribed`}
          onClear={clearDepartment}
        />
      ) : null}

      {drugs.length === 0 ? (
        <NoDataForSelection
          what={`No formulary-compliance rows are recorded for ${department ?? "this selection"}.`}
        />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={drugs}
              layout="vertical"
              margin={{ left: 8, right: 24, top: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v}%`}
              />
              <YAxis
                type="category"
                dataKey="generic"
                width={110}
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ fill: "var(--color-muted)", fillOpacity: 0.4 }}
                formatter={(value: number, _name, item) => {
                  const payload = (
                    item as { payload?: { orders?: number; inNf?: boolean; brands?: string } }
                  ).payload;
                  return [
                    `${pct(value)} generic · ${num(payload?.orders ?? 0)} orders · ${
                      payload?.inNf ? "in National Formulary" : "not in NF"
                    } · brands: ${payload?.brands ?? "—"}`,
                    "Generic rate",
                  ];
                }}
              />
              <ReferenceLine
                x={GENERIC_SUBSTITUTION_TARGET}
                stroke={PALETTE.neutral}
                strokeDasharray="4 4"
                label={{ value: "Target", fontSize: 11, position: "top" }}
              />
              <Bar
                dataKey="percentGeneric"
                radius={[0, 4, 4, 0]}
                cursor="pointer"
                onClick={(entry) => {
                  const generic = (entry as unknown as { generic?: string }).generic ?? null;
                  setSelected((prev) => (prev === generic ? null : generic));
                }}
              >
                {drugs.map((d) => (
                  <Cell
                    key={d.generic}
                    fill={
                      d.percentGeneric < GENERIC_SUBSTITUTION_TARGET
                        ? PALETTE.danger
                        : PALETTE.success
                    }
                    fillOpacity={selected && selected !== d.generic ? 0.3 : 0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {selected ? (
            <DetailPanel
              title={`${selected} · physician breakdown`}
              onClear={() => setSelected(null)}
            >
              <div className="max-h-52 overflow-y-auto">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-muted/60">
                    <tr className="text-left text-text-secondary">
                      <th className="py-1 pr-2 font-medium">Physician</th>
                      <th className="py-1 pr-2 font-medium">Department</th>
                      <th className="py-1 pr-2 font-medium">Brand ordered</th>
                      <th className="py-1 pr-2 text-right font-medium">Orders</th>
                      <th className="py-1 text-right font-medium">% generic</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRows.map((r) => (
                      <tr key={`${r.generic}-${r.physician}`} className="border-t border-border/60">
                        <td className="py-1 pr-2">{r.physician}</td>
                        <td className="py-1 pr-2">
                          {/* The one genuinely department-shaped element in this chart. */}
                          <button
                            type="button"
                            onClick={() =>
                              setDepartment(r.department === department ? null : r.department)
                            }
                            className={cn(
                              "underline-offset-2 hover:underline",
                              r.department === department
                                ? "font-medium text-brand"
                                : "text-inherit",
                            )}
                            title={`Filter the dashboard to ${r.department}`}
                          >
                            {r.department}
                          </button>
                        </td>
                        <td className="py-1 pr-2">{r.brandOrdered}</td>
                        <td className="py-1 pr-2 text-right">{num(r.orders)}</td>
                        <td className="py-1 text-right">{pct(r.percentGeneric, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DetailPanel>
          ) : (
            <p className="mt-2 text-[11px] text-text-muted">
              Sorted worst-compliance first; volume-weighted across all prescribing physicians.
              Click a bar for the physician-level breakdown, then a department name in that table to
              filter the whole dashboard.
            </p>
          )}
        </>
      )}
    </PanelCard>
  );
}

/* -------------------------------------------------------------------------
 * 10. Lab Test Efficiency: Order Volume vs. Average TAT
 * Source: LabWorkloadRow (R-08 `laboratory-workload`)
 * ----------------------------------------------------------------------- */
function LabTestEfficiencyChart() {
  const [selected, setSelected] = React.useState<string | null>(null);

  const { points, medianOrders, medianTat, byTest, xDomain, yDomain } = React.useMemo(() => {
    const rows = hospitalRows<LabWorkloadRow>("laboratory-workload");

    const grouped = groupBy(rows, (r) => r.test);

    const aggregated = Array.from(grouped.entries()).map(([test, group]) => ({
      test,
      category: group[0]?.category ?? "—",
      loinc: group[0]?.loinc ?? "—",

      ordersReceived: sumBy(group, (r) => r.ordersReceived),

      // Mean of a field that is itself a monthly average
      // (average-of-averages, per spec).
      avgTat: Math.round(meanBy(group, (r) => r.avgTat) * 100) / 100,

      criticalResults: sumBy(group, (r) => r.criticalResults),
    }));

    /*
     * Dynamically calculate the visible chart range from
     * the actual lab test values.
     *
     * This prevents the chart from wasting large amounts
     * of space below/above the actual data points.
     */
    const getPaddedDomain = (values: number[], padding = 0.1): [number, number] => {
      if (values.length === 0) {
        return [0, 1];
      }

      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min;

      // If every value is identical, create a small
      // artificial range so the chart can still render.
      if (range === 0) {
        const buffer = Math.max(Math.abs(max) * 0.1, 1);

        return [Math.max(0, min - buffer), max + buffer];
      }

      return [Math.max(0, min - range * padding), max + range * padding];
    };

    const xDomain = getPaddedDomain(
      aggregated.map((p) => p.ordersReceived),
      0.1,
    );

    const yDomain = getPaddedDomain(
      aggregated.map((p) => p.avgTat),
      0.1,
    );

    return {
      points: aggregated,

      medianOrders: median(aggregated.map((p) => p.ordersReceived)),

      medianTat: median(aggregated.map((p) => p.avgTat)),

      byTest: grouped,

      xDomain,
      yDomain,
    };
  }, []);

  const activeRows = selected
    ? [...(byTest.get(selected) ?? [])].sort((a, b) => a.isoDate.localeCompare(b.isoDate))
    : [];

  return (
    <PanelCard
      title="10. Lab Test Efficiency: Volume vs. TAT"
      description="Which lab tests combine high order volume with slow turnaround — the biggest throughput wins?"
    >
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart
          margin={{
            left: 8,
            right: 20,
            top: 8,
            bottom: 16,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />

          <XAxis
            type="number"
            dataKey="ordersReceived"
            name="Orders received"
            domain={xDomain}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            label={{
              value: "Orders (12-mo sum)",
              fontSize: 11,
              position: "insideBottom",
              offset: -8,
            }}
          />

          <YAxis
            type="number"
            dataKey="avgTat"
            name="Avg TAT (h)"
            domain={yDomain}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={48}
            label={{
              value: "Avg TAT (hours)",
              angle: -90,
              fontSize: 11,
            }}
          />

          <ZAxis
            type="number"
            dataKey="criticalResults"
            range={[70, 460]}
            name="Critical results"
          />

          <ReferenceLine x={medianOrders} stroke={PALETTE.neutral} strokeDasharray="4 4" />

          <ReferenceLine y={medianTat} stroke={PALETTE.neutral} strokeDasharray="4 4" />

          <Tooltip
            cursor={{
              strokeDasharray: "3 3",
            }}
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number, name: string, item) => {
              const payload = (
                item as {
                  payload?: {
                    test?: string;
                    category?: string;
                  };
                }
              ).payload;

              if (name === "Orders received") {
                return [
                  `${num(value)} (${payload?.test ?? ""} · ${payload?.category ?? ""})`,
                  name,
                ];
              }

              if (name === "Avg TAT (h)") {
                return [`${value.toFixed(2)} h`, name];
              }

              return [num(value), name];
            }}
            labelFormatter={() => ""}
          />

          <Scatter
            data={points}
            cursor="pointer"
            onClick={(entry) => {
              const test =
                (
                  entry as unknown as {
                    test?: string;
                  }
                ).test ?? null;

              setSelected((prev) => (prev === test ? null : test));
            }}
          >
            {points.map((p, i) => (
              <Cell
                key={p.test}
                fill={segmentColor(i)}
                fillOpacity={selected && selected !== p.test ? 0.25 : 0.75}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      <p className="mt-1 text-[11px] text-text-muted">
        Quadrant lines = median volume / median TAT. Bubble size = critical results. Top-right =
        high-volume, slow tests (fix these first).
      </p>

      {selected ? (
        <DetailPanel title={`${selected} · 12-month history`} onClear={() => setSelected(null)}>
          <div className="max-h-52 overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-muted/60">
                <tr className="text-left text-text-secondary">
                  <th className="py-1 pr-2 font-medium">Month</th>

                  <th className="py-1 pr-2 text-right font-medium">Received</th>

                  <th className="py-1 pr-2 text-right font-medium">Completed</th>

                  <th className="py-1 pr-2 text-right font-medium">Avg TAT</th>

                  <th className="py-1 text-right font-medium">Critical</th>
                </tr>
              </thead>

              <tbody>
                {activeRows.map((r) => (
                  <tr key={r.isoDate} className="border-t border-border/60">
                    <td className="py-1 pr-2">{r.isoDate.slice(0, 7)}</td>

                    <td className="py-1 pr-2 text-right">{num(r.ordersReceived)}</td>

                    <td className="py-1 pr-2 text-right">{num(r.ordersCompleted)}</td>

                    <td className="py-1 pr-2 text-right">{r.avgTat.toFixed(1)} h</td>

                    <td className="py-1 text-right">{num(r.criticalResults)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DetailPanel>
      ) : null}
    </PanelCard>
  );
}
/* -------------------------------------------------------------------------
 * 11. Discharge Readiness Blockers
 * Source: DischargeAuditRow (R-10 `discharge-clearance-audit`)
 * ----------------------------------------------------------------------- */
function DischargeBlockersChart() {
  const [selected, setSelected] = React.useState<string | null>(null);

  const { blockers, csfRate, avgSteps, avgDays, byBlocker, total } = React.useMemo(() => {
    const rows = hospitalRows<DischargeAuditRow>("discharge-clearance-audit");
    const grouped = groupBy(rows, (r) => r.missingDocuments);
    const counts = Array.from(grouped.entries())
      .map(([blocker, group]) => ({
        blocker,
        count: group.length,
        avgDays: Math.round(meanBy(group, (r) => r.daysSinceDischarge) * 10) / 10,
      }))
      .sort((a, b) => b.count - a.count);
    return {
      blockers: counts,
      csfRate: safeRate(rows.filter((r) => r.csfCollected).length, rows.length),
      avgSteps: Math.round(meanBy(rows, (r) => r.stepsIncomplete) * 100) / 100,
      avgDays: Math.round(meanBy(rows, (r) => r.daysSinceDischarge) * 10) / 10,
      byBlocker: grouped,
      total: rows.length,
    };
  }, []);

  const activeRows = selected
    ? [...(byBlocker.get(selected) ?? [])].sort(
        (a, b) => b.daysSinceDischarge - a.daysSinceDischarge,
      )
    : [];

  return (
    <PanelCard
      title="11. Discharge Readiness Blockers"
      description="What is the single most common blocker keeping patients from a clean discharge?"
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <KpiChip
          label="CSF collection rate"
          value={pct(csfRate)}
          note={`${num(total)} audited discharges`}
          tone={csfRate >= 80 ? "good" : "warning"}
        />
        <KpiChip label="Avg incomplete steps" value={avgSteps.toFixed(2)} note="per audited case" />
        <KpiChip
          label="Avg days since discharge"
          value={`${avgDays.toFixed(1)} d`}
          note="with open items"
          tone={avgDays > 10 ? "danger" : "neutral"}
        />
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={blockers}
          layout="vertical"
          margin={{ left: 8, right: 24, top: 8, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
          <XAxis
            type="number"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="blocker"
            width={120}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: "var(--color-muted)", fillOpacity: 0.4 }}
            formatter={(value: number, _name, item) => {
              const days = (item as { payload?: { avgDays?: number } }).payload?.avgDays ?? 0;
              return [`${num(value)} cases · avg ${days.toFixed(1)} days open`, "Blocker"];
            }}
          />
          <Bar
            dataKey="count"
            radius={[0, 4, 4, 0]}
            cursor="pointer"
            onClick={(entry) => {
              const blocker = (entry as unknown as { blocker?: string }).blocker ?? null;
              setSelected((prev) => (prev === blocker ? null : blocker));
            }}
          >
            {blockers.map((b) => (
              <Cell
                key={b.blocker}
                fill={b.blocker === "None" ? PALETTE.success : PALETTE.warning}
                fillOpacity={selected && selected !== b.blocker ? 0.3 : 0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {selected ? (
        <DetailPanel
          title={`Missing: ${selected} · oldest first`}
          onClear={() => setSelected(null)}
        >
          <div className="max-h-52 overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-muted/60">
                <tr className="text-left text-text-secondary">
                  <th className="py-1 pr-2 font-medium">Patient</th>
                  <th className="py-1 pr-2 font-medium">Case no.</th>
                  <th className="py-1 pr-2 font-medium">Claim status</th>
                  <th className="py-1 pr-2 text-right font-medium">Steps left</th>
                  <th className="py-1 pr-2 text-right font-medium">Days open</th>
                  <th className="py-1 text-right font-medium">CSF</th>
                </tr>
              </thead>
              <tbody>
                {activeRows.map((r) => (
                  <tr key={r.caseNo} className="border-t border-border/60">
                    <td className="py-1 pr-2">{r.patient}</td>
                    <td className="py-1 pr-2">{r.caseNo}</td>
                    <td className="py-1 pr-2">{r.claimStatus}</td>
                    <td className="py-1 pr-2 text-right">{r.stepsIncomplete}</td>
                    <td className="py-1 pr-2 text-right">{r.daysSinceDischarge}</td>
                    <td className="py-1 text-right">{r.csfCollected ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DetailPanel>
      ) : (
        <p className="mt-2 text-[11px] text-text-muted">
          Click a blocker to list its open cases, sorted by days since discharge.
        </p>
      )}
    </PanelCard>
  );
}

/* -------------------------------------------------------------------------
 * 12. Readmission Rate Matrix: Payer × Department
 * Source: CohortPatient (src/lib/analytics/cohort.mock.ts)
 * ----------------------------------------------------------------------- */
const LOW_CONFIDENCE_N = 8; // judgment call — cells below this N are flagged

function ReadmissionMatrixChart() {
  const [selected, setSelected] = React.useState<{ row: number; col: number } | null>(null);
  const { department, setDepartment, clearDepartment } = useTop20Filters();

  const { payers, departments, matrix, cells, patients } = React.useMemo(() => {
    // CohortPatient carries `.department`, so the whole matrix (rates, sample
    // sizes, low-confidence flags) is recomputed on the filtered cohort.
    const cohort = department
      ? cohortPatients.filter((p) => p.department === department)
      : cohortPatients;
    const payerList = uniq(cohort.map((p) => p.payer)).sort();
    const deptList = uniq(cohort.map((p) => p.department)).sort();
    const stats = new Map<string, { n: number; readmitted: number }>();
    for (const p of cohort) {
      const key = `${p.payer}|${p.department}`;
      const current = stats.get(key) ?? { n: 0, readmitted: 0 };
      current.n += 1;
      if (p.readmitted30d) current.readmitted += 1;
      stats.set(key, current);
    }

    const grid: HeatCell[][] = payerList.map((payer) =>
      deptList.map((dept) => {
        const s = stats.get(`${payer}|${dept}`);
        if (!s || s.n === 0)
          return { value: null, title: `${payer} · ${dept}: no patients in cohort` };
        const rate = safeRate(s.readmitted, s.n);
        return {
          value: rate,
          badge: `${Math.round(rate)}`,
          lowConfidence: s.n < LOW_CONFIDENCE_N,
          title: `${payer} · ${dept}\n30-day readmission ${pct(rate)} (${s.readmitted}/${s.n})${
            s.n < LOW_CONFIDENCE_N ? "\nLow confidence: small sample" : ""
          }`,
        };
      }),
    );

    return {
      payers: payerList,
      departments: deptList,
      matrix: grid,
      cells: stats,
      patients: cohort,
    };
  }, [department]);

  const activePayer = selected ? (payers[selected.row] ?? null) : null;
  const activeDept = selected ? (departments[selected.col] ?? null) : null;
  const activeStat =
    activePayer && activeDept ? (cells.get(`${activePayer}|${activeDept}`) ?? null) : null;
  const activePatients =
    activePayer && activeDept
      ? patients.filter((p) => p.payer === activePayer && p.department === activeDept)
      : [];

  return (
    <PanelCard
      title="12. Readmission Rate Matrix: Payer × Department"
      description="Are 30-day readmissions concentrated in specific payer-and-department combinations?"
      className={department ? globalFilterRing : ""}
    >
      {department ? (
        <GlobalFilterNote
          dimension="department"
          value={department}
          detail={`${num(patients.length)} cohort patient(s)`}
          onClear={clearDepartment}
        />
      ) : null}

      {payers.length === 0 || departments.length === 0 ? (
        <NoDataForSelection
          what={`No cohort patients are recorded for ${department ?? "this selection"}.`}
        />
      ) : (
        <>
          <ValueHeatGrid
            rowLabels={payers}
            columns={departments}
            matrix={matrix}
            domain={[0, 40]}
            rowLabelWidth="10rem"
            minCellWidth="2.4rem"
            minGridWidth={620}
            onCellClick={(row, col) => {
              setSelected((prev) => (prev?.row === row && prev?.col === col ? null : { row, col }));
              // Columns ARE departments — clicking a cell promotes that column
              // to the dashboard-wide filter.
              const dept = departments[col];
              if (dept) setDepartment(dept);
            }}
            selected={selected}
            legend={
              <RampLegend
                from="0% readmitted"
                to="40%+"
                note={`dashed outline = fewer than ${LOW_CONFIDENCE_N} patients (low confidence)`}
              />
            }
          />

          {activeStat && activePayer && activeDept ? (
            <DetailPanel title={`${activePayer} · ${activeDept}`} onClear={() => setSelected(null)}>
              <StatRow label="Patients in cohort" value={num(activeStat.n)} />
              <StatRow label="Readmitted within 30 days" value={num(activeStat.readmitted)} />
              <StatRow
                label="Readmission rate"
                value={pct(safeRate(activeStat.readmitted, activeStat.n))}
              />
              <div className="mt-2 max-h-44 overflow-y-auto">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-muted/60">
                    <tr className="text-left text-text-secondary">
                      <th className="py-1 pr-2 font-medium">Patient</th>
                      <th className="py-1 pr-2 font-medium">Diagnosis</th>
                      <th className="py-1 pr-2 font-medium">Admission type</th>
                      <th className="py-1 text-right font-medium">Readmitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activePatients.slice(0, 40).map((p) => (
                      <tr key={p.patientId} className="border-t border-border/60">
                        <td className="py-1 pr-2">{p.name}</td>
                        <td className="py-1 pr-2">{p.diagnosisDesc}</td>
                        <td className="py-1 pr-2">{p.admissionType}</td>
                        <td className="py-1 text-right">{p.readmitted30d ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DetailPanel>
          ) : (
            <p className="mt-2 text-[11px] text-text-muted">
              Cell number = readmission rate (%). Click a cell for its sample size and patient list
              — and to filter the dashboard to that cell&apos;s department.
            </p>
          )}
        </>
      )}
    </PanelCard>
  );
}

/* ==========================================================================
 * SECTION 2 — LGU / PUBLIC HEALTH ANALYTICS (charts 13-20)
 * ========================================================================== */

/* -------------------------------------------------------------------------
 * G. Geographic Overview — Barangay Risk & Burden
 *
 * The "geographic map" requirement, solved the way the rest of this codebase
 * already solves it. There is no GeoJSON, boundary file or lat/long anywhere in
 * the project (`schema.md`'s Barangay table has no geometry columns) and
 * external map APIs are out of scope, so this reuses `BarangayChoropleth` from
 * `lgu-shared.tsx` — the stylized tile grid the LGU dashboards already ship —
 * rather than inventing a second, inconsistent geographic component.
 *
 * The tile value is chart 19's household vulnerability composite, verbatim:
 * (diabetes + hypertension + TB + dependents) as a % of barangay members. It
 * was picked over chart 15's NCD index because it is already a single 0-100
 * number per barangay — exactly `BarangayDatum.value`'s shape — so the panel
 * adds no new blended index of its own, and because it covers all 15 barangays.
 * ----------------------------------------------------------------------- */
function GeographicOverviewPanel() {
  const { barangay, setBarangay, clearBarangay, bhcForBarangay } = useTop20Filters();

  const { tiles, profiles, alertThreshold } = React.useMemo(() => {
    const raw = lguRows<HouseholdProfileRow>("community-household-health-profile");
    const scored = raw.map((r) => {
      const dmRate = safeRate(r.withDm, r.members);
      const htnRate = safeRate(r.withHtn, r.members);
      const tbRate = safeRate(r.withTb, r.members);
      const dependentRate = safeRate(r.pregnant + r.childrenUnder5 + r.elderly, r.members);
      return {
        row: r,
        burden: Math.round((dmRate + htnRate + tbRate + dependentRate) * 100) / 100,
      };
    });

    // Top-quartile burden gets the choropleth's critical flag (red outline).
    const ranked = [...scored].sort((a, b) => b.burden - a.burden);
    const cutIndex = Math.max(0, Math.ceil(ranked.length / 4) - 1);
    const threshold = ranked[cutIndex]?.burden ?? Number.POSITIVE_INFINITY;

    const data: BarangayDatum[] = scored.map((s) => ({
      id: `brgy-tile-${s.row.barangay.toLowerCase().replace(/\s+/g, "-")}`,
      name: s.row.barangay,
      value: s.burden,
      display: pct(s.burden, 1),
      alert: s.burden >= threshold,
    }));

    const index = new Map<string, HouseholdProfileRow>();
    for (const s of scored) index.set(s.row.barangay, s.row);

    return { tiles: data, profiles: index, alertThreshold: threshold };
  }, []);

  const selectedProfile = barangay ? (profiles.get(barangay) ?? null) : null;
  const selectedTile = barangay ? (tiles.find((t) => t.name === barangay) ?? null) : null;
  const selectedBhc = bhcForBarangay(barangay);

  return (
    <PanelCard
      title="Geographic Overview — Barangay Risk & Burden"
      description="Where in the city does household health vulnerability concentrate — and which BHC catchment owns it?"
      className={barangay ? globalFilterRing : ""}
      action={
        barangay ? (
          <StatusBadge tone="warning">Selected: {barangay}</StatusBadge>
        ) : (
          <StatusBadge>15 barangays · 5 BHC catchments</StatusBadge>
        )
      }
    >
      {barangay ? (
        <GlobalFilterNote
          dimension="barangay"
          value={barangay}
          {...(selectedBhc ? { detail: `served by ${selectedBhc}` } : {})}
          onClear={clearBarangay}
        />
      ) : null}

      <BarangayChoropleth data={tiles} onSelect={(d) => setBarangay(d.name)} />

      <p className="mt-2 text-[11px] text-text-muted">
        Tile shade = household vulnerability index (diabetes + hypertension + TB + dependents, as a
        share of barangay members — the same composite as chart 19). Red-outlined tiles are the
        top-quartile burden ({pct(alertThreshold, 1)} and above). Click a tile to filter every
        barangay- and BHC-keyed panel below. Tile positions are a stylized grid, not real geography
        — this project ships no boundary/geometry data and uses no external map service.
      </p>

      {selectedProfile && selectedTile ? (
        <DetailPanel
          title={`${selectedProfile.barangay} · household profile`}
          onClear={clearBarangay}
        >
          <div className="grid gap-x-6 sm:grid-cols-2">
            <StatRow label="Vulnerability index" value={pct(selectedTile.value, 2)} />
            <StatRow label="BHC catchment" value={selectedBhc ?? "—"} />
            <StatRow label="Households" value={num(selectedProfile.households)} />
            <StatRow label="Members" value={num(selectedProfile.members)} />
            <StatRow label="PhilHealth coverage" value={pct(selectedProfile.philhealthCoverage)} />
            <StatRow label="4Ps enrollment" value={pct(selectedProfile.fourPsPct)} />
          </div>
        </DetailPanel>
      ) : null}
    </PanelCard>
  );
}

/* -------------------------------------------------------------------------
 * 13. BHC-to-Hospital Referral Network — D3 Sankey (the one D3 chart)
 * Source: ReferralRow (LGU R-16 `referral-network-analysis`)
 * ----------------------------------------------------------------------- */
type SankeyNodeDatum = {
  id: string;
  name: string;
  tier: number;
};

type SankeyLinkDatum = {
  source: string;
  target: string;
  value: number;
  feedback: number;
};

const SANKEY_WIDTH = 900;
const SANKEY_HEIGHT = 520;
const TIER_COLORS = [PALETTE.brand, PALETTE.hmo, PALETTE.philhealth, PALETTE.success] as const;

function ReferralNetworkSankey() {
  const [colorByFeedback, setColorByFeedback] = React.useState(false);
  const [selectedNode, setSelectedNode] = React.useState<string | null>(null);
  // `ReferralRow` is keyed by BHC, not barangay, so the global barangay filter
  // is resolved through the barangay -> BHC catchment join before it is applied.
  const { barangay, selectedBhc, clearBarangay } = useTop20Filters();

  const { graph, rows, closureRate, documented } = React.useMemo(() => {
    const all = lguRows<ReferralRow>("referral-network-analysis");
    const referrals = selectedBhc ? all.filter((r) => r.bhc === selectedBhc) : all;

    const nodeIndex = new Map<string, SankeyNodeDatum>();
    const addNode = (tier: number, name: string) => {
      const id = `t${tier}:${name}`;
      if (!nodeIndex.has(id)) nodeIndex.set(id, { id, name, tier });
      return id;
    };

    const linkIndex = new Map<string, SankeyLinkDatum>();
    const addLink = (source: string, target: string, feedback: boolean) => {
      const key = `${source}->${target}`;
      const existing = linkIndex.get(key);
      if (existing) {
        existing.value += 1;
        existing.feedback += feedback ? 1 : 0;
      } else {
        linkIndex.set(key, { source, target, value: 1, feedback: feedback ? 1 : 0 });
      }
    };

    for (const r of referrals) {
      const bhc = addNode(0, r.bhc);
      const reason = addNode(1, r.referralReason);
      const facility = addNode(2, r.receivingFacility);
      const outcome = addNode(3, r.outcome);
      addLink(bhc, reason, r.feedbackReceived);
      addLink(reason, facility, r.feedbackReceived);
      addLink(facility, outcome, r.feedbackReceived);
    }

    const documentedRows = referrals.filter((r) => r.outcomeDocumented);
    const withFeedback = referrals.filter((r) => r.feedbackReceived);

    const layout = d3Sankey<SankeyNodeDatum, SankeyLinkDatum>()
      .nodeId((d) => d.id)
      .nodeWidth(14)
      .nodePadding(14)
      .nodeSort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name))
      .extent([
        [1, 8],
        [SANKEY_WIDTH - 1, SANKEY_HEIGHT - 8],
      ]);

    // d3-sankey is not defined on an empty graph, so an empty selection short-
    // circuits to a zero-node layout instead of being fed to the solver.
    const emptyGraph: SankeyGraph<SankeyNodeDatum, SankeyLinkDatum> = { nodes: [], links: [] };
    const computed =
      nodeIndex.size === 0
        ? emptyGraph
        : layout({
            nodes: Array.from(nodeIndex.values()).map((n) => ({ ...n })),
            links: Array.from(linkIndex.values()).map((l) => ({ ...l })),
          });

    return {
      graph: computed,
      rows: referrals,
      closureRate: safeRate(withFeedback.length, documentedRows.length),
      documented: documentedRows.length,
    };
  }, [selectedBhc]);

  const pathGenerator = React.useMemo(
    () => sankeyLinkHorizontal<SankeyNodeDatum, SankeyLinkDatum>(),
    [],
  );

  const selectedName = selectedNode ? (selectedNode.split(":")[1] ?? null) : null;
  const detailRows = selectedName
    ? rows.filter(
        (r) =>
          r.bhc === selectedName ||
          r.referralReason === selectedName ||
          r.receivingFacility === selectedName ||
          r.outcome === selectedName,
      )
    : [];

  const linkTouchesSelection = (link: (typeof graph.links)[number]) => {
    if (!selectedNode) return true;
    const source = link.source as SankeyNodeDatum;
    const target = link.target as SankeyNodeDatum;
    return source.id === selectedNode || target.id === selectedNode;
  };

  return (
    <PanelCard
      title="13. BHC-to-Hospital Referral Network"
      description="Which BHCs refer to which hospitals, for what reason, with what outcome — and where does the feedback loop break?"
      className={selectedBhc ? globalFilterRing : ""}
      action={
        <button
          type="button"
          onClick={() => setColorByFeedback((v) => !v)}
          className={cn(
            "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
            colorByFeedback
              ? "border-brand bg-brand/10 text-brand"
              : "border-border text-text-secondary hover:bg-muted",
          )}
        >
          {colorByFeedback ? "Coloring by feedback" : "Color links by feedback"}
        </button>
      }
    >
      {barangay && selectedBhc ? (
        <GlobalFilterNote
          dimension="barangay"
          value={barangay}
          detail={`resolved to its BHC catchment · ${selectedBhc}`}
          onClear={clearBarangay}
        />
      ) : null}

      {rows.length === 0 ? (
        <NoDataForSelection
          what={`No referrals are recorded for ${selectedBhc ?? "this selection"}.`}
        />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <KpiChip label="Referrals" value={num(rows.length)} note="ReferralRow, R-16" />
            <KpiChip label="Outcome documented" value={num(documented)} />
            <KpiChip
              label="Feedback-loop closure"
              value={pct(closureRate)}
              note="feedbackReceived / outcomeDocumented"
              tone={closureRate >= 70 ? "good" : "warning"}
            />
          </div>

          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${SANKEY_WIDTH} ${SANKEY_HEIGHT}`}
              width="100%"
              height={SANKEY_HEIGHT}
              role="img"
              aria-label="Sankey diagram of BHC referrals through reason, receiving facility and outcome"
            >
              <g fill="none">
                {graph.links.map((link, i) => {
                  const d = pathGenerator(link);
                  if (!d) return null;
                  const source = link.source as SankeyNodeDatum;
                  const target = link.target as SankeyNodeDatum;
                  const feedbackShare = link.value ? (link.feedback ?? 0) / link.value : 0;
                  const stroke = colorByFeedback
                    ? feedbackShare >= 0.5
                      ? LGU_COLORS.vaccination
                      : LGU_COLORS.critical
                    : TIER_COLORS[source.tier % TIER_COLORS.length];
                  const dim = !linkTouchesSelection(link);
                  return (
                    <path
                      key={`${source.id}->${target.id}-${i}`}
                      d={d}
                      stroke={stroke}
                      strokeOpacity={dim ? 0.06 : 0.32}
                      strokeWidth={Math.max(1, link.width ?? 1)}
                    >
                      <title>
                        {`${source.name} → ${target.name}: ${link.value} referrals · feedback received on ${link.feedback ?? 0}`}
                      </title>
                    </path>
                  );
                })}
              </g>
              <g>
                {graph.nodes.map((node) => {
                  const x0 = node.x0 ?? 0;
                  const x1 = node.x1 ?? 0;
                  const y0 = node.y0 ?? 0;
                  const y1 = node.y1 ?? 0;
                  const isSelected = selectedNode === node.id;
                  const labelOnLeft = node.tier === 3;
                  return (
                    <g key={node.id}>
                      <rect
                        x={x0}
                        y={y0}
                        width={Math.max(1, x1 - x0)}
                        height={Math.max(1, y1 - y0)}
                        fill={TIER_COLORS[node.tier % TIER_COLORS.length]}
                        fillOpacity={selectedNode && !isSelected ? 0.3 : 0.95}
                        className="cursor-pointer"
                        onClick={() =>
                          setSelectedNode((prev) => (prev === node.id ? null : node.id))
                        }
                      >
                        <title>{`${node.name}: ${node.value ?? 0} referrals`}</title>
                      </rect>
                      <text
                        x={labelOnLeft ? x0 - 6 : x1 + 6}
                        y={(y0 + y1) / 2}
                        dy="0.35em"
                        textAnchor={labelOnLeft ? "end" : "start"}
                        fontSize={11}
                        fill="currentColor"
                        className="pointer-events-none fill-current text-text-secondary"
                      >
                        {node.name}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>

          <div className="mt-2 flex flex-wrap gap-3">
            <LegendDot color={TIER_COLORS[0]} label="Tier 1 · BHC" />
            <LegendDot color={TIER_COLORS[1]} label="Tier 2 · Referral reason" />
            <LegendDot color={TIER_COLORS[2]} label="Tier 3 · Receiving facility" />
            <LegendDot color={TIER_COLORS[3]} label="Tier 4 · Outcome" />
          </div>

          {selectedName ? (
            <DetailPanel
              title={`${selectedName} · ${num(detailRows.length)} referrals`}
              onClear={() => setSelectedNode(null)}
            >
              <div className="max-h-52 overflow-y-auto">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-muted/60">
                    <tr className="text-left text-text-secondary">
                      <th className="py-1 pr-2 font-medium">Date</th>
                      <th className="py-1 pr-2 font-medium">BHC</th>
                      <th className="py-1 pr-2 font-medium">Reason</th>
                      <th className="py-1 pr-2 font-medium">Receiving facility</th>
                      <th className="py-1 pr-2 font-medium">Outcome</th>
                      <th className="py-1 text-right font-medium">Feedback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailRows.map((r, i) => (
                      <tr key={`${r.bhc}-${r.date}-${i}`} className="border-t border-border/60">
                        <td className="py-1 pr-2">{r.date}</td>
                        <td className="py-1 pr-2">{r.bhc}</td>
                        <td className="py-1 pr-2">{r.referralReason}</td>
                        <td className="py-1 pr-2">{r.receivingFacility}</td>
                        <td className="py-1 pr-2">{r.outcome}</td>
                        <td className="py-1 text-right">{r.feedbackReceived ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DetailPanel>
          ) : (
            <p className="mt-2 text-[11px] text-text-muted">
              Hover a ribbon for its case count; click a node to highlight every flow through it and
              open the referral detail table. Nodes are BHCs, reasons, facilities and outcomes —
              none is a barangay, so node clicks stay local; use the Geographic Overview tiles above
              to filter this panel by catchment.
            </p>
          )}
        </>
      )}
    </PanelCard>
  );
}

/* -------------------------------------------------------------------------
 * 14. Immunization Coverage Matrix (Barangay × Antigen)
 * Source: ImmunizationCoverageRow (LGU R-12)
 * ----------------------------------------------------------------------- */
const ANTIGENS = [
  ["bcg", "BCG"],
  ["hepB", "HepB"],
  ["penta", "Penta"],
  ["opv", "OPV"],
  ["pcv", "PCV"],
  ["mmr", "MMR"],
] as const;

type ImmunizationSortMode =
  "weakest-asc" | "average-asc" | "average-desc" | "population-desc" | "barangay-asc";

const IMMUNIZATION_SORT_OPTIONS: { value: ImmunizationSortMode; label: string }[] = [
  { value: "weakest-asc", label: "Weakest antigen (most at-risk first)" },
  { value: "average-asc", label: "Average coverage (lowest first)" },
  { value: "average-desc", label: "Average coverage (highest first)" },
  { value: "population-desc", label: "Target population (highest first)" },
  { value: "barangay-asc", label: "Barangay name (A–Z)" },
];

const IMMUNIZATION_SORT_NOTE: Record<ImmunizationSortMode, string> = {
  "weakest-asc": "rows sorted by weakest antigen (fully-immunized-child proxy)",
  "average-asc": "rows sorted by average coverage, lowest first",
  "average-desc": "rows sorted by average coverage, highest first",
  "population-desc": "rows sorted by target population, highest first",
  "barangay-asc": "rows sorted alphabetically by barangay",
};

function ImmunizationCoverageMatrix() {
  const [selected, setSelected] = React.useState<{ row: number; col: number } | null>(null);
  const [sortMode, setSortMode] = React.useState<ImmunizationSortMode>("weakest-asc");
  const { barangay, setBarangay, clearBarangay } = useTop20Filters();

  const { barangays, matrix, rowsByBarangay } = React.useMemo(() => {
    const all = lguRows<ImmunizationCoverageRow>("immunization-coverage-antigen-barangay");
    const rows = barangay ? all.filter((r) => r.barangay === barangay) : all;
    const weakest = (r: ImmunizationCoverageRow) => Math.min(...ANTIGENS.map(([key]) => r[key]));
    const average = (r: ImmunizationCoverageRow) =>
      ANTIGENS.reduce((sum, [key]) => sum + r[key], 0) / ANTIGENS.length;

    const sorted = [...rows].sort((a, b) => {
      switch (sortMode) {
        case "average-asc":
          return average(a) - average(b);
        case "average-desc":
          return average(b) - average(a);
        case "population-desc":
          return b.targetPopulation - a.targetPopulation;
        case "barangay-asc":
          return a.barangay.localeCompare(b.barangay);
        case "weakest-asc":
        default:
          // Sorted by the derived "fully-immunized-child proxy" (weakest antigen) — most at-risk first.
          return weakest(a) - weakest(b);
      }
    });

    const grid: HeatCell[][] = sorted.map((r) =>
      ANTIGENS.map(([key, label]) => ({
        value: r[key],
        badge: String(Math.round(r[key])),
        title: `${r.barangay} · ${label}\nCoverage ${pct(r[key])}\nWeakest antigen for this barangay: ${pct(weakest(r))}`,
      })),
    );
    return {
      barangays: sorted.map((r) => `${r.barangay} (min ${Math.round(weakest(r))}%)`),
      matrix: grid,
      rowsByBarangay: sorted,
    };
  }, [barangay, sortMode]);

  React.useEffect(() => {
    setSelected(null);
  }, [sortMode]);

  const activeRow = selected ? (rowsByBarangay[selected.row] ?? null) : null;
  const activeAntigen = selected ? (ANTIGENS[selected.col] ?? null) : null;

  return (
    <PanelCard
      title="14. Immunization Coverage Matrix (Barangay × Antigen)"
      description="Which barangay is missing which specific vaccine — where does a targeted catch-up campaign go?"
      className={barangay ? globalFilterRing : ""}
      action={
        <Select value={sortMode} onValueChange={(v) => setSortMode(v as ImmunizationSortMode)}>
          <SelectTrigger className="h-7 w-[14rem] text-xs">
            <SelectValue placeholder="Sort barangays" />
          </SelectTrigger>
          <SelectContent>
            {IMMUNIZATION_SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      {barangay ? (
        <GlobalFilterNote dimension="barangay" value={barangay} onClear={clearBarangay} />
      ) : null}

      {rowsByBarangay.length === 0 ? (
        <NoDataForSelection
          what={`No immunization-coverage row is recorded for ${barangay ?? "this selection"}.`}
        />
      ) : (
        <>
          <ValueHeatGrid
            rowLabels={barangays}
            columns={ANTIGENS.map(([, label]) => label)}
            matrix={matrix}
            domain={[60, 100]}
            invertRamp
            rowLabelWidth="12rem"
            minCellWidth="2.6rem"
            minGridWidth={520}
            onCellClick={(row, col) => {
              setSelected((prev) => (prev?.row === row && prev?.col === col ? null : { row, col }));
              // Matrix rows ARE barangays — promote the clicked row globally.
              const clicked = rowsByBarangay[row];
              if (clicked) setBarangay(clicked.barangay);
            }}
            selected={selected}
            legend={
              <RampLegend
                from="100% covered"
                to="60% or below"
                note={IMMUNIZATION_SORT_NOTE[sortMode]}
              />
            }
          />

          {activeRow && activeAntigen ? (
            <DetailPanel
              title={`${activeRow.barangay} · ${activeAntigen[1]}`}
              onClear={() => setSelected(null)}
            >
              <StatRow
                label="Target population (0–11 mo)"
                value={num(activeRow.targetPopulation)}
              />
              {ANTIGENS.map(([key, label]) => (
                <StatRow
                  key={key}
                  label={label}
                  value={
                    <span className={key === activeAntigen[0] ? "text-brand" : undefined}>
                      {pct(activeRow[key])}
                    </span>
                  }
                />
              ))}
            </DetailPanel>
          ) : (
            <p className="mt-2 text-[11px] text-text-muted">
              Cell number = coverage %. Darker = worse. Click a cell for the barangay&apos;s full
              six-antigen profile — and to filter the dashboard to that barangay.
            </p>
          )}
        </>
      )}
    </PanelCard>
  );
}

/* -------------------------------------------------------------------------
 * 15. NCD Burden vs. Control Bubble Chart
 * Source: NcdBarangay (src/lib/analytics/lgu/ncd.mock.ts)
 * ----------------------------------------------------------------------- */
function NcdBurdenControlChart() {
  const [selected, setSelected] = React.useState<string | null>(null);
  const { barangay, setBarangay, clearBarangay } = useTop20Filters();

  const { barangays, medianIndex, medianControl, xDomain, yDomain } = React.useMemo(() => {
    const all = getNcdData().barangays;

    // `NcdBarangay.name` IS the barangay key for this chart.
    const data = barangay ? all.filter((b) => b.name === barangay) : all;

    /*
     * Dynamically calculate the visible chart range from
     * the actual displayed barangay values.
     *
     * 10% padding keeps the bubbles away from the edges
     * while removing unnecessary blank space.
     */
    const getPaddedDomain = (values: number[], padding = 0.1): [number, number] => {
      if (values.length === 0) {
        return [0, 1];
      }

      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min;

      // If only one barangay is displayed, or all values
      // are identical, create a small visible range.
      if (range === 0) {
        const buffer = Math.max(Math.abs(max) * 0.1, 1);

        return [Math.max(0, min - buffer), max + buffer];
      }

      return [Math.max(0, min - range * padding), max + range * padding];
    };

    const xDomain = getPaddedDomain(
      data.map((b) => b.ncdIndex),
      0.1,
    );

    const yDomain = getPaddedDomain(
      data.map((b) => b.controlRate),
      0.1,
    );

    return {
      barangays: data,

      // Quadrant lines are the citywide benchmark,
      // so they stay on all 15 barangays.
      medianIndex: median(all.map((b) => b.ncdIndex)),

      medianControl: median(all.map((b) => b.controlRate)),

      xDomain,
      yDomain,
    };
  }, [barangay]);

  const active = barangays.find((b) => b.name === selected) ?? null;

  return (
    <PanelCard
      title="15. NCD Burden vs. Control Bubble Chart"
      description="Which barangays combine a high NCD burden with poor treatment control — where does outreach go next?"
      className={barangay ? globalFilterRing : ""}
    >
      {barangay ? (
        <GlobalFilterNote
          dimension="barangay"
          value={barangay}
          detail="quadrant lines held at the citywide median"
          onClear={clearBarangay}
        />
      ) : null}

      {barangays.length === 0 ? (
        <NoDataForSelection
          what={`No NCD registry data is recorded for ${barangay ?? "this selection"}.`}
        />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart
              margin={{
                left: 8,
                right: 20,
                top: 8,
                bottom: 16,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />

              <XAxis
                type="number"
                dataKey="ncdIndex"
                name="NCD index"
                domain={xDomain}
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                label={{
                  value: "NCD burden index",
                  fontSize: 11,
                  position: "insideBottom",
                  offset: -8,
                }}
              />

              <YAxis
                type="number"
                dataKey="controlRate"
                name="Control rate"
                domain={yDomain}
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(v: number) => `${v}%`}
                label={{
                  value: "Control rate",
                  angle: -90,
                  fontSize: 11,
                }}
              />

              <ZAxis type="number" dataKey="patientCount" range={[70, 460]} name="Patients" />

              <ReferenceLine x={medianIndex} stroke={PALETTE.neutral} strokeDasharray="4 4" />

              <ReferenceLine y={medianControl} stroke={PALETTE.neutral} strokeDasharray="4 4" />

              <Tooltip
                cursor={{
                  strokeDasharray: "3 3",
                }}
                contentStyle={TOOLTIP_STYLE}
                formatter={(value: number, name: string, item) => {
                  const payload = (
                    item as {
                      payload?: {
                        name?: string;
                      };
                    }
                  ).payload;

                  if (name === "NCD index") {
                    return [`${value.toFixed(1)} (${payload?.name ?? ""})`, name];
                  }

                  if (name === "Control rate") {
                    return [pct(value), name];
                  }

                  return [num(value), name];
                }}
                labelFormatter={() => ""}
              />

              <Scatter
                data={barangays}
                cursor="pointer"
                onClick={(entry) => {
                  const name =
                    (
                      entry as unknown as {
                        name?: string;
                      }
                    ).name ?? null;

                  setSelected((prev) => (prev === name ? null : name));

                  // Every point IS a barangay —
                  // promote it to the global filter.
                  if (name) {
                    setBarangay(name);
                  }
                }}
              >
                {barangays.map((b) => (
                  <Cell
                    key={b.id}
                    fill={
                      b.ncdIndex >= medianIndex && b.controlRate < medianControl
                        ? LGU_COLORS.critical
                        : LGU_COLORS.ncd
                    }
                    fillOpacity={selected && selected !== b.name ? 0.25 : 0.75}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>

          <div className="mt-1 flex flex-wrap gap-3">
            <LegendDot color={LGU_COLORS.critical} label="High burden + poor control (priority)" />

            <LegendDot color={LGU_COLORS.ncd} label="All other barangays" />
          </div>

          {active ? (
            <DetailPanel title={active.name} onClear={() => setSelected(null)}>
              <StatRow label="NCD burden index" value={active.ncdIndex.toFixed(1)} />

              <StatRow label="Hypertension prevalence" value={pct(active.htnPrevalence)} />

              <StatRow label="Diabetes prevalence" value={pct(active.dmPrevalence)} />

              <StatRow label="Obesity prevalence" value={pct(active.obesityPrevalence)} />

              <StatRow label="Patients enrolled" value={num(active.patientCount)} />

              <StatRow label="Control rate" value={pct(active.controlRate)} />

              <StatRow label="Medication compliance" value={pct(active.medicationCompliance)} />

              <StatRow label="Referrals" value={num(active.referralCount)} />
            </DetailPanel>
          ) : (
            <p className="mt-2 text-[11px] text-text-muted">
              Quadrant lines = city median burden index / median control rate. Bubble size =
              enrolled patient count. Clicking a bubble filters the whole dashboard to that
              barangay.
            </p>
          )}
        </>
      )}
    </PanelCard>
  );
}

/* -------------------------------------------------------------------------
 * 16. FHSIS Program Section Achievement Rollup — Recharts RadialBarChart
 * Source: FhsisRow (LGU R-11 `fhsis-monthly`)
 * ----------------------------------------------------------------------- */
function FhsisSectionRollupChart() {
  const [selected, setSelected] = React.useState<string | null>(null);

  const { sections, indicatorsBySection } = React.useMemo(() => {
    const rows = lguRows<FhsisRow>("fhsis-monthly");
    const grouped = groupBy(rows, (r) => r.section);
    const rollup = Array.from(grouped.entries())
      .map(([section, group], i) => {
        const count = sumBy(group, (r) => r.count);
        const target = sumBy(group, (r) => r.target);
        return {
          section,
          count,
          target,
          achievement: Math.round(safeRate(count, target) * 10) / 10,
          fill: segmentColor(i),
        };
      })
      .sort((a, b) => a.achievement - b.achievement);
    return { sections: rollup, indicatorsBySection: grouped };
  }, []);

  const activeIndicators = selected
    ? Array.from(groupBy(indicatorsBySection.get(selected) ?? [], (r) => r.indicator).entries())
        .map(([indicator, group]) => {
          const count = sumBy(group, (r) => r.count);
          const target = sumBy(group, (r) => r.target);
          return { indicator, count, target, achievement: safeRate(count, target) };
        })
        .sort((a, b) => a.achievement - b.achievement)
    : [];

  return (
    <PanelCard
      title="16. FHSIS Program Section Achievement Rollup"
      description="Across the six FHSIS sections, which one is furthest behind its target this reporting period?"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ResponsiveContainer width="100%" height={300}>
          <RadialBarChart
            data={sections}
            innerRadius="22%"
            outerRadius="96%"
            startAngle={90}
            endAngle={-270}
            barSize={14}
          >
            <PolarAngleAxis type="number" domain={[0, 120]} angleAxisId={0} tick={false} />
            <RadialBar
              dataKey="achievement"
              background
              cornerRadius={6}
              cursor="pointer"
              onClick={(entry) => {
                const section = (entry as unknown as { section?: string }).section ?? null;
                setSelected((prev) => (prev === section ? null : section));
              }}
            >
              {sections.map((s) => (
                <Cell
                  key={s.section}
                  fill={s.fill}
                  fillOpacity={selected && selected !== s.section ? 0.3 : 1}
                />
              ))}
            </RadialBar>
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: number, _name, item) => {
                const payload = (
                  item as { payload?: { section?: string; count?: number; target?: number } }
                ).payload;
                return [
                  `${pct(value)} of target · ${num(payload?.count ?? 0)} / ${num(payload?.target ?? 0)}`,
                  payload?.section ?? "Section",
                ];
              }}
            />
          </RadialBarChart>
        </ResponsiveContainer>

        <div className="space-y-1.5 self-center">
          {sections.map((s) => (
            <button
              key={s.section}
              type="button"
              onClick={() => setSelected((prev) => (prev === s.section ? null : s.section))}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted",
                selected === s.section && "bg-muted",
              )}
            >
              <span className="inline-flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: s.fill }} />
                <span className="text-text-primary">{s.section}</span>
              </span>
              <span
                className={cn(
                  "font-semibold",
                  s.achievement >= 100
                    ? "text-success"
                    : s.achievement >= 90
                      ? "text-warning"
                      : "text-danger",
                )}
              >
                {pct(s.achievement)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {selected ? (
        <DetailPanel title={`${selected} · indicator detail`} onClear={() => setSelected(null)}>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-text-secondary">
                <th className="py-1 pr-2 font-medium">Indicator</th>
                <th className="py-1 pr-2 text-right font-medium">Count</th>
                <th className="py-1 pr-2 text-right font-medium">Target</th>
                <th className="py-1 text-right font-medium">Achievement</th>
              </tr>
            </thead>
            <tbody>
              {activeIndicators.map((r) => (
                <tr key={r.indicator} className="border-t border-border/60">
                  <td className="py-1 pr-2">{r.indicator}</td>
                  <td className="py-1 pr-2 text-right">{num(r.count)}</td>
                  <td className="py-1 pr-2 text-right">{num(r.target)}</td>
                  <td className="py-1 text-right">{pct(r.achievement)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DetailPanel>
      ) : (
        <p className="mt-2 text-[11px] text-text-muted">
          Click a section (ring or legend row) to drill into its constituent FHSIS indicators.
        </p>
      )}
    </PanelCard>
  );
}

/* -------------------------------------------------------------------------
 * 17. Konsulta Utilization Rate by Membership Type
 * Source: KonsultaUtilRow (LGU R-15 `konsulta-enrollment-utilization`)
 * ----------------------------------------------------------------------- */
function KonsultaUtilizationChart() {
  const [selected, setSelected] = React.useState<string | null>(null);
  // `KonsultaUtilRow` is keyed by BHC, so the barangay filter is resolved
  // through the barangay -> BHC catchment join, same as chart 13.
  const { barangay, selectedBhc, clearBarangay } = useTop20Filters();

  const { segments, citywide, rowsByType } = React.useMemo(() => {
    const all = lguRows<KonsultaUtilRow>("konsulta-enrollment-utilization");
    const rows = selectedBhc ? all.filter((r) => r.bhc === selectedBhc) : all;
    const grouped = groupBy(rows, (r) => r.membershipType);
    const aggregated = Array.from(grouped.entries()).map(([membershipType, group]) => {
      const enrolled = sumBy(group, (r) => r.enrolledMembers);
      const active = sumBy(group, (r) => r.activeVisitors);
      return {
        membershipType,
        enrolledMembers: enrolled,
        activeVisitors: active,
        utilization: Math.round(safeRate(active, enrolled) * 10) / 10,
      };
    });
    // "Citywide" is a benchmark, so it stays on every BHC's rows even when the
    // bars are filtered to one catchment.
    const totalEnrolled = sumBy(all, (r) => r.enrolledMembers);
    const totalActive = sumBy(all, (r) => r.activeVisitors);
    return {
      segments: aggregated,
      citywide: Math.round(safeRate(totalActive, totalEnrolled) * 10) / 10,
      rowsByType: grouped,
    };
  }, [selectedBhc]);

  const activeBhcRows = selected
    ? Array.from(groupBy(rowsByType.get(selected) ?? [], (r) => r.bhc).entries()).map(
        ([bhc, group]) => {
          const enrolled = sumBy(group, (r) => r.enrolledMembers);
          const active = sumBy(group, (r) => r.activeVisitors);
          return { bhc, enrolled, active, utilization: safeRate(active, enrolled) };
        },
      )
    : [];

  return (
    <PanelCard
      title="17. Konsulta Utilization Rate by Membership Type"
      description="Which PhilHealth Konsulta membership segment is under-utilizing the benefit they are enrolled in?"
      className={selectedBhc ? globalFilterRing : ""}
      action={<StatusBadge>Citywide {pct(citywide)}</StatusBadge>}
    >
      {barangay && selectedBhc ? (
        <GlobalFilterNote
          dimension="barangay"
          value={barangay}
          detail={`resolved to its BHC catchment · ${selectedBhc}`}
          onClear={clearBarangay}
        />
      ) : null}

      {segments.length === 0 ? (
        <NoDataForSelection
          what={`No Konsulta enrolment rows are recorded for ${selectedBhc ?? "this selection"}.`}
        />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={segments} margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="membershipType" tick={AXIS_TICK} tickLine={false} axisLine={false} />
              <YAxis
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                width={44}
                tickFormatter={(v: number) => `${v}%`}
                label={{ value: "Utilization", angle: -90, fontSize: 11 }}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ fill: "var(--color-muted)", fillOpacity: 0.4 }}
                formatter={(value: number, _name, item) => {
                  const payload = (
                    item as { payload?: { enrolledMembers?: number; activeVisitors?: number } }
                  ).payload;
                  return [
                    `${pct(value)} · ${num(payload?.activeVisitors ?? 0)} active of ${num(payload?.enrolledMembers ?? 0)} enrolled`,
                    "Utilization",
                  ];
                }}
              />
              <ReferenceLine
                y={citywide}
                stroke={PALETTE.neutral}
                strokeDasharray="4 4"
                label={{
                  value: `Citywide ${pct(citywide, 0)}`,
                  fontSize: 11,
                  position: "insideTopRight",
                }}
              />
              <Bar
                dataKey="utilization"
                radius={[4, 4, 0, 0]}
                cursor="pointer"
                onClick={(entry) => {
                  const type =
                    (entry as unknown as { membershipType?: string }).membershipType ?? null;
                  setSelected((prev) => (prev === type ? null : type));
                }}
              >
                {segments.map((s) => (
                  <Cell
                    key={s.membershipType}
                    fill={s.utilization < citywide ? PALETTE.danger : PALETTE.success}
                    fillOpacity={selected && selected !== s.membershipType ? 0.3 : 0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {selected ? (
            <DetailPanel title={`${selected} · BHC breakdown`} onClear={() => setSelected(null)}>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-left text-text-secondary">
                    <th className="py-1 pr-2 font-medium">BHC</th>
                    <th className="py-1 pr-2 text-right font-medium">Enrolled</th>
                    <th className="py-1 pr-2 text-right font-medium">Active visitors</th>
                    <th className="py-1 text-right font-medium">Utilization</th>
                  </tr>
                </thead>
                <tbody>
                  {activeBhcRows.map((r) => (
                    <tr key={r.bhc} className="border-t border-border/60">
                      <td className="py-1 pr-2">{r.bhc}</td>
                      <td className="py-1 pr-2 text-right">{num(r.enrolled)}</td>
                      <td className="py-1 pr-2 text-right">{num(r.active)}</td>
                      <td className="py-1 text-right">{pct(r.utilization)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DetailPanel>
          ) : (
            <p className="mt-2 text-[11px] text-text-muted">
              Click a membership-type bar for its BHC-level enrollment and utilization breakdown.
              Membership type is not a cross-chart dimension, so that click stays local; the panel
              follows the global Barangay filter via its BHC catchment.
            </p>
          )}
        </>
      )}
    </PanelCard>
  );
}

/* -------------------------------------------------------------------------
 * 18. Dengue Case Severity & Outcome Breakdown
 * Source: DengueRow (LGU R-18 `dengue-surveillance-pidsr`)
 * ----------------------------------------------------------------------- */
function DengueSeverityOutcomeChart() {
  const [selected, setSelected] = React.useState<string | null>(null);
  const { barangay, setBarangay, clearBarangay } = useTop20Filters();

  const { tiers, outcomes, overallHospitalization, totalCases, rowsByType } = React.useMemo(() => {
    const all = lguRows<DengueRow>("dengue-surveillance-pidsr");
    const rows = barangay ? all.filter((r) => r.barangay === barangay) : all;
    const grouped = groupBy(rows, (r) => r.dengueType);
    const outcomeList = uniq(rows.map((r) => r.outcome));
    // Severity order is clinical, not alphabetical.
    const severityOrder = ["Dengue", "Dengue with Warning Signs", "Severe Dengue"];
    const tierRows = Array.from(grouped.entries())
      .sort((a, b) => severityOrder.indexOf(a[0]) - severityOrder.indexOf(b[0]))
      .map(([dengueType, group]) => {
        const point: Record<string, string | number> = {
          dengueType,
          cases: group.length,
          hospitalizationRate:
            Math.round(safeRate(group.filter((r) => r.hospitalized).length, group.length) * 10) /
            10,
        };
        for (const outcome of outcomeList) {
          point[outcome] = group.filter((r) => r.outcome === outcome).length;
        }
        return point;
      });

    return {
      tiers: tierRows,
      outcomes: outcomeList,
      overallHospitalization: safeRate(rows.filter((r) => r.hospitalized).length, rows.length),
      totalCases: rows.length,
      rowsByType: grouped,
    };
  }, [barangay]);

  const activeCases = selected
    ? [...(rowsByType.get(selected) ?? [])].sort((a, b) =>
        b.dateOfOnset.localeCompare(a.dateOfOnset),
      )
    : [];

  const outcomeColor = (outcome: string): string => {
    if (outcome === "Died") return LGU_COLORS.critical;
    if (outcome === "Referred") return PALETTE.warning;
    if (outcome === "Recovering") return PALETTE.brandLight;
    return LGU_COLORS.vaccination;
  };

  return (
    <PanelCard
      title="18. Dengue Case Severity & Outcome Breakdown"
      description="Given the active outbreak, how severe are the cases — and is the hospitalization burden rising?"
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <KpiChip label="Reported cases" value={num(totalCases)} note="DengueRow, PIDSR CIF" />
        <KpiChip
          label="Hospitalization rate"
          value={pct(overallHospitalization)}
          note="all severity tiers"
          tone={overallHospitalization > 50 ? "danger" : "warning"}
        />
        {tiers.map((t) => (
          <KpiChip
            key={String(t["dengueType"])}
            label={String(t["dengueType"])}
            value={`${num(Number(t["cases"] ?? 0))} cases`}
            note={`${pct(Number(t["hospitalizationRate"] ?? 0), 0)} hospitalized`}
            tone={t["dengueType"] === "Severe Dengue" ? "danger" : "neutral"}
          />
        ))}
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={tiers} margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
          <XAxis dataKey="dengueType" tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <YAxis
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={40}
            allowDecimals={false}
            label={{ value: "Cases", angle: -90, fontSize: 11 }}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: "var(--color-muted)", fillOpacity: 0.4 }}
            formatter={(value: number, name: string) => [`${num(value)} cases`, name]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {outcomes.map((outcome) => (
            <Bar
              key={outcome}
              dataKey={outcome}
              stackId="dengue"
              fill={outcomeColor(outcome)}
              cursor="pointer"
              onClick={(entry) => {
                const type = (entry as unknown as { dengueType?: string }).dengueType ?? null;
                setSelected((prev) => (prev === type ? null : type));
              }}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {selected ? (
        <DetailPanel title={`${selected} · case list`} onClear={() => setSelected(null)}>
          <div className="max-h-52 overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-muted/60">
                <tr className="text-left text-text-secondary">
                  <th className="py-1 pr-2 font-medium">Case no.</th>
                  <th className="py-1 pr-2 font-medium">Barangay</th>
                  <th className="py-1 pr-2 font-medium">Onset</th>
                  <th className="py-1 pr-2 font-medium">Outcome</th>
                  <th className="py-1 text-right font-medium">Hospitalized</th>
                </tr>
              </thead>
              <tbody>
                {activeCases.map((r) => (
                  <tr key={r.caseNo} className="border-t border-border/60">
                    <td className="py-1 pr-2">{r.caseNo}</td>
                    <td className="py-1 pr-2">{r.barangay}</td>
                    <td className="py-1 pr-2">{r.dateOfOnset}</td>
                    <td className="py-1 pr-2">{r.outcome}</td>
                    <td className="py-1 text-right">{r.hospitalized ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DetailPanel>
      ) : (
        <p className="mt-2 text-[11px] text-text-muted">
          Click a severity tier to list its cases (barangay, onset date). Designed to sit beside the
          existing Epidemic Curve panel.
        </p>
      )}
    </PanelCard>
  );
}

/* -------------------------------------------------------------------------
 * 19. Household Vulnerability Index by Barangay
 * Source: HouseholdProfileRow (LGU R-17 `community-household-health-profile`)
 * ----------------------------------------------------------------------- */
function HouseholdVulnerabilityChart() {
  const [selected, setSelected] = React.useState<string | null>(null);
  const { barangay, setBarangay, clearBarangay } = useTop20Filters();

  const { rows, lookup } = React.useMemo(() => {
    const all = lguRows<HouseholdProfileRow>("community-household-health-profile");
    const raw = barangay ? all.filter((r) => r.barangay === barangay) : all;
    const derived = raw
      .map((r) => {
        const dmRate = safeRate(r.withDm, r.members);
        const htnRate = safeRate(r.withHtn, r.members);
        const tbRate = safeRate(r.withTb, r.members);
        const dependentRate = safeRate(r.pregnant + r.childrenUnder5 + r.elderly, r.members);
        return {
          barangay: r.barangay,
          dmRate: Math.round(dmRate * 100) / 100,
          htnRate: Math.round(htnRate * 100) / 100,
          tbRate: Math.round(tbRate * 100) / 100,
          dependentRate: Math.round(dependentRate * 100) / 100,
          burden: Math.round((dmRate + htnRate + tbRate + dependentRate) * 100) / 100,
          philhealthCoverage: r.philhealthCoverage,
          fourPsPct: r.fourPsPct,
        };
      })
      .sort((a, b) => b.burden - a.burden);
    const index = new Map<string, HouseholdProfileRow>();
    for (const r of raw) index.set(r.barangay, r);
    return { rows: derived, lookup: index };
  }, [barangay]);

  const activeProfile = selected ? (lookup.get(selected) ?? null) : null;

  const burdenSeries = [
    ["htnRate", "Hypertension", PALETTE.danger],
    ["dmRate", "Diabetes", PALETTE.warning],
    ["tbRate", "TB", PALETTE.scpwd],
    ["dependentRate", "Dependents (pregnant + <5 + elderly)", PALETTE.brandLight],
  ] as const;

  const handleClick = (entry: unknown) => {
    const clicked = (entry as { barangay?: string }).barangay ?? null;
    setSelected((prev) => (prev === clicked ? null : clicked));
    // Every bar IS a barangay — promote it to the global filter too.
    if (clicked) setBarangay(clicked);
  };

  return (
    <PanelCard
      title="19. Household Vulnerability Index by Barangay"
      description="Which barangays combine the highest household disease/dependency burden with the weakest safety-net coverage?"
      className={barangay ? globalFilterRing : ""}
    >
      {barangay ? (
        <GlobalFilterNote dimension="barangay" value={barangay} onClear={clearBarangay} />
      ) : null}

      {rows.length === 0 ? (
        <NoDataForSelection
          what={`No household profile is recorded for ${barangay ?? "this selection"}.`}
        />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-1 text-[11px] font-medium text-text-secondary">
                Per-capita burden (% of barangay members), sorted by total burden
              </p>
              <ResponsiveContainer width="100%" height={380}>
                <BarChart
                  data={rows}
                  layout="vertical"
                  margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="barangay"
                    width={92}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    cursor={{ fill: "var(--color-muted)", fillOpacity: 0.4 }}
                    formatter={(value: number, name: string) => [pct(value, 2), name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {burdenSeries.map(([key, label, color]) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      name={label}
                      stackId="burden"
                      fill={color}
                      cursor="pointer"
                      onClick={handleClick}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div>
              <p className="mb-1 text-[11px] font-medium text-text-secondary">
                Social safety-net coverage (same barangay order)
              </p>
              <ResponsiveContainer width="100%" height={380}>
                <BarChart
                  data={rows}
                  layout="vertical"
                  margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="barangay"
                    width={92}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    cursor={{ fill: "var(--color-muted)", fillOpacity: 0.4 }}
                    formatter={(value: number, name: string) => [pct(value), name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar
                    dataKey="philhealthCoverage"
                    name="PhilHealth coverage"
                    fill={PALETTE.philhealth}
                    cursor="pointer"
                    onClick={handleClick}
                  />
                  <Bar
                    dataKey="fourPsPct"
                    name="4Ps enrollment"
                    fill={PALETTE.success}
                    cursor="pointer"
                    onClick={handleClick}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {activeProfile ? (
            <DetailPanel
              title={`${activeProfile.barangay} · household profile`}
              onClear={() => setSelected(null)}
            >
              <div className="grid gap-x-6 sm:grid-cols-2">
                <StatRow label="Households" value={num(activeProfile.households)} />
                <StatRow label="Members" value={num(activeProfile.members)} />
                <StatRow
                  label="PhilHealth coverage"
                  value={pct(activeProfile.philhealthCoverage)}
                />
                <StatRow label="4Ps enrollment" value={pct(activeProfile.fourPsPct)} />
                <StatRow label="With diabetes" value={num(activeProfile.withDm)} />
                <StatRow label="With hypertension" value={num(activeProfile.withHtn)} />
                <StatRow label="With TB" value={num(activeProfile.withTb)} />
                <StatRow label="Pregnant" value={num(activeProfile.pregnant)} />
                <StatRow label="Children under 5" value={num(activeProfile.childrenUnder5)} />
                <StatRow label="Elderly (60+)" value={num(activeProfile.elderly)} />
              </div>
            </DetailPanel>
          ) : (
            <p className="mt-2 text-[11px] text-text-muted">
              Click any bar to open that barangay&apos;s full household profile — or to filter the
              whole dashboard to it.
            </p>
          )}
        </>
      )}
    </PanelCard>
  );
}

/* -------------------------------------------------------------------------
 * 20. Maternal Death Audit: Avoidability & Cause-of-Death Summary
 * Source: MaternalDeathRow (LGU R-13 `maternal-death-audit`) — restricted report
 * ----------------------------------------------------------------------- */
const AVOIDABILITY_COLORS: Record<string, string> = {
  Yes: LGU_COLORS.critical,
  No: LGU_COLORS.vaccination,
  "Under review": PALETTE.warning,
};

function MaternalDeathAuditChart() {
  const [selectedCause, setSelectedCause] = React.useState<string | null>(null);

  const { avoidability, causes, meanAncAvoidable, meanAncAll, totalCases, byCause, roleNote } =
    React.useMemo(() => {
      const report = getLguReport("maternal-death-audit");
      const rows = lguRows<MaternalDeathRow>("maternal-death-audit");
      const avoidableRows = rows.filter((r) => r.avoidable === "Yes");
      const causeGroups = groupBy(rows, (r) => r.causeOfDeath);
      return {
        avoidability: Array.from(groupBy(rows, (r) => r.avoidable).entries()).map(
          ([label, group]) => ({ label, value: group.length }),
        ),
        causes: Array.from(causeGroups.entries())
          .map(([causeOfDeath, group]) => ({
            causeOfDeath,
            count: group.length,
            causeCode: group[0]?.causeCode ?? "—",
          }))
          .sort((a, b) => b.count - a.count),
        meanAncAvoidable: meanBy(avoidableRows, (r) => r.ancVisits),
        meanAncAll: meanBy(rows, (r) => r.ancVisits),
        totalCases: rows.length,
        byCause: causeGroups,
        roleNote: report?.roleNote ?? "Restricted report",
      };
    }, []);

  const activeCases = selectedCause ? (byCause.get(selectedCause) ?? []) : [];

  return (
    <PanelCard
      title="20. Maternal Death Audit: Avoidability & Cause of Death"
      description="Of the maternal deaths reviewed, how many were avoidable — and what causes keep recurring?"
      action={<StatusBadge tone="danger">{roleNote}</StatusBadge>}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <KpiChip label="Cases reviewed" value={num(totalCases)} note="small-N restricted audit" />
        <KpiChip
          label="Mean ANC visits — avoidable"
          value={meanAncAvoidable.toFixed(1)}
          note={`vs ${meanAncAll.toFixed(1)} across all cases`}
          tone={meanAncAvoidable < meanAncAll ? "danger" : "neutral"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-1 text-[11px] font-medium text-text-secondary">
            Avoidability assessment
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={avoidability}
                dataKey="value"
                nameKey="label"
                innerRadius={52}
                outerRadius={88}
                paddingAngle={2}
              >
                {avoidability.map((a) => (
                  <Cell key={a.label} fill={AVOIDABILITY_COLORS[a.label] ?? PALETTE.neutral} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value: number, name: string) => [`${num(value)} cases`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div>
          <p className="mb-1 text-[11px] font-medium text-text-secondary">
            Cause of death frequency
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={causes}
              layout="vertical"
              margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="causeOfDeath"
                width={140}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ fill: "var(--color-muted)", fillOpacity: 0.4 }}
                formatter={(value: number, _name, item) => {
                  const code =
                    (item as { payload?: { causeCode?: string } }).payload?.causeCode ?? "";
                  return [`${num(value)} case(s) · ${code}`, "Cause of death"];
                }}
              />
              <Bar
                dataKey="count"
                radius={[0, 4, 4, 0]}
                cursor="pointer"
                onClick={(entry) => {
                  const cause =
                    (entry as unknown as { causeOfDeath?: string }).causeOfDeath ?? null;
                  setSelectedCause((prev) => (prev === cause ? null : cause));
                }}
              >
                {causes.map((c) => (
                  <Cell
                    key={c.causeOfDeath}
                    fill={LGU_COLORS.maternal}
                    fillOpacity={selectedCause && selectedCause !== c.causeOfDeath ? 0.3 : 0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {selectedCause ? (
        <DetailPanel
          title={`${selectedCause} · de-identified cases`}
          onClear={() => setSelectedCause(null)}
        >
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-text-secondary">
                <th className="py-1 pr-2 font-medium">Case</th>
                <th className="py-1 pr-2 font-medium">Gravida/Para</th>
                <th className="py-1 pr-2 text-right font-medium">ANC visits</th>
                <th className="py-1 pr-2 font-medium">Avoidable</th>
                <th className="py-1 font-medium">Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {activeCases.map((r) => (
                <tr key={r.caseLabel} className="border-t border-border/60">
                  <td className="py-1 pr-2">{r.caseLabel}</td>
                  <td className="py-1 pr-2">{r.gravidaPara}</td>
                  <td className="py-1 pr-2 text-right">{r.ancVisits}</td>
                  <td className="py-1 pr-2">{r.avoidable}</td>
                  <td className="py-1">{r.recommendations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DetailPanel>
      ) : (
        <p className="mt-2 text-[11px] text-text-muted">
          Click a cause-of-death bar for the de-identified case list. This view carries the same
          MHO/CHO-only restriction as the underlying report.
        </p>
      )}
    </PanelCard>
  );
}

/* ==========================================================================
 * Default export — renders all 20 charts in spec order
 * ========================================================================== */

export default function Top20NewCharts() {
  return (
    <Top20FilterProvider>
      <div className="space-y-8 p-4 md:p-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-text-primary">
            Top 20 New Analytics Charts — Preview
          </h1>
          <p className="mt-1 text-xs text-text-muted">
            Standalone, unwired preview of the 20 charts specified in <code>top20-charts.md</code>,
            bound to real mock data per <code>schema.md</code>. Not registered in any route or nav.
            Department and barangay selections made in any chart below apply to every other chart
            that shares that dimension — see the filter bar.
          </p>
        </div>

        <Top20FloatingFilterHeader />

        <section className="space-y-4">
          <SectionTitle
            title="Hospital Analytics — New Charts (1–12)"
            description="Executive KPI extensions, previously chart-less report data, and the claims-lifecycle chain."
          />
          <MortalityByDiagnosisChart />
          <AlosByAdmissionTypeChart />
          <PhysicianProductivityQuadrantChart />
          <WardOccupancyHeatmap />
          <DepartmentalArTrendChart />
          <RemittanceBatchTrackerChart />
          <ClaimsReimbursementStructureChart />
          <AppealRecoveryFunnelChart />
          <FormularySubstitutionChart />
          <LabTestEfficiencyChart />
          <DischargeBlockersChart />
          <ReadmissionMatrixChart />
        </section>

        <section className="space-y-4">
          <SectionTitle
            title="LGU / Public Health Analytics — New Charts (13–20)"
            description="Referral network, coverage gaps, program rollups and outbreak severity for the City Health Office."
          />
          <GeographicOverviewPanel />
          <ReferralNetworkSankey />
          <ImmunizationCoverageMatrix />
          <NcdBurdenControlChart />
          <FhsisSectionRollupChart />
          <KonsultaUtilizationChart />
          <DengueSeverityOutcomeChart />
          <HouseholdVulnerabilityChart />
          <MaternalDeathAuditChart />
        </section>
      </div>
    </Top20FilterProvider>
  );
}
