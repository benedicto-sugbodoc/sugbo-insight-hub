import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Bed,
  BedDouble,
  CalendarClock,
  CircleDollarSign,
  ClipboardCheck,
  HeartPulse,
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
import {
  BulletRow,
  Gauge,
  KpiStrip,
  LegendDot,
  MetricCard,
  MetricStatus,
  PALETTE,
  PanelCard,
  SectionTitle,
  Sparkline,
  StatRow,
  StatusBadge,
  brandRamp,
  num,
  pct,
  php,
} from "@/components/analytics/shared";
import { fetchExecutiveData, type ExecutiveData } from "@/lib/analytics/executive.mock";
import { cn } from "@/lib/utils";
import type { ReportColumn } from "@/components/reports/types";
import {
  AddAnnotationButton,
  AnnotationList,
  ChainLinkBadge,
  ChartDrillDrawer,
  CompareToggle,
  GlobalFilterBar,
  InteractiveChartCard,
  RichTooltip,
  RoleSwitcher,
  ZoomControls,
  useAnnotations,
  useMockRole,
  useUrlSyncedFilters,
  type RichTooltipPayloadEntry,
  type ZoomPreset,
} from "@/components/analytics/interactive";

export const Route = createFileRoute("/analytics/executive")({
  head: () => ({
    meta: [
      { title: "Executive Analytics — SugboDoc" },
      {
        name: "description",
        content:
          "Hospital executive dashboard: admissions, ALOS, bed occupancy, revenue, PhilHealth remittance, claims and quality KPIs.",
      },
      { property: "og:title", content: "Executive Analytics — SugboDoc" },
      {
        property: "og:description",
        content: "Level 3 hospital executive KPIs, volume trends and revenue breakdown.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExecutivePage,
});

type Drill =
  | { kind: "kpi"; id: string }
  | { kind: "payer"; payer: string }
  | { kind: "diagnosis"; code: string }
  | { kind: "claims"; status: string }
  | { kind: "alert"; id: string }
  | null;

function borStatus(v: number): MetricStatus {
  if (v > 95) return "danger";
  if (v >= 75 && v <= 85) return "good";
  if (v < 60 || v > 90) return "warning";
  return "neutral";
}

function alosStatus(v: number): MetricStatus {
  if (v <= 4.5) return "good";
  if (v <= 6) return "warning";
  return "danger";
}

const zoomWindowSize: Record<ZoomPreset, number> = { "1M": 1, "3M": 3, "6M": 6, "1Y": 12, All: 12 };

function reportHrefForModule(mod: string): string | undefined {
  switch (mod) {
    case "Claims":
    case "Billing":
      return "/reports/philhealth-claims-register";
    case "Laboratory":
      return "/reports/laboratory-workload";
    case "Inpatient":
      return "/reports/discharge-clearance-audit";
    case "Census":
      return "/reports/daily-census";
    default:
      return undefined;
  }
}

function ExecutivePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "executive"],
    queryFn: fetchExecutiveData,
  });
  const [drill, setDrill] = React.useState<Drill>(null);
  const [visibleSeries, setVisibleSeries] = React.useState<Record<string, boolean>>({
    inpatient: true,
    opd: true,
    emergency: true,
    daySurgery: true,
  });
  const [role, setRole] = useMockRole();
  const {
    values: filterValues,
    setValues: setFilterValues,
    dateRange,
    setDateRange,
  } = useUrlSyncedFilters(["department", "physician"]);
  const [zoomPreset, setZoomPreset] = React.useState<ZoomPreset>("1Y");
  const [zoomOffset, setZoomOffset] = React.useState(0);
  const [compareKey, setCompareKey] = React.useState<string | null>(null);
  const [payerChain, setPayerChain] = React.useState<string | null>(null);
  const { annotations, addAnnotation, removeAnnotation } = useAnnotations(
    "hospital-executive-volume",
  );

  if (isLoading || !data) return <ExecutiveSkeleton />;

  const departmentOptions = Array.from(new Set(data.admissions.rows.map((r) => r.department))).map(
    (d) => ({
      label: d,
      value: d,
    }),
  );
  const physicianOptions = Array.from(new Set(data.admissions.rows.map((r) => r.physician))).map(
    (p) => ({
      label: p,
      value: p,
    }),
  );
  const activeDept =
    filterValues["department"] && filterValues["department"] !== "all"
      ? filterValues["department"]
      : null;
  const activePhysician =
    filterValues["physician"] && filterValues["physician"] !== "all"
      ? filterValues["physician"]
      : null;
  const filteredAdmissions = data.admissions.rows.filter(
    (r) =>
      (!activeDept || r.department === activeDept) &&
      (!activePhysician || r.physician === activePhysician),
  );
  const sampleFiltered = Boolean(activeDept || activePhysician);
  const filteredTopDiagnoses = sampleFiltered
    ? data.topDiagnoses
        .map((dx) => ({
          ...dx,
          count: filteredAdmissions.filter((r) => r.icd10 === dx.code).length,
        }))
        .filter((dx) => dx.count > 0)
        .sort((a, b) => b.count - a.count)
    : data.topDiagnoses;

  const avgInpatient = data.volume.reduce((s, v) => s + v.inpatient, 0) / data.volume.length;
  const budgetTarget = Math.round(avgInpatient * 1.08);
  const enrichedVolume = data.volume.map((v, i, arr) => ({
    ...v,
    comparePriorPeriod: i > 0 ? arr[i - 1]!.inpatient : v.inpatient,
    compareBudget: budgetTarget,
  }));
  const windowSize = Math.min(zoomWindowSize[zoomPreset], enrichedVolume.length);
  const maxOffset = enrichedVolume.length - windowSize;
  const clampedOffset = Math.min(Math.max(zoomOffset, 0), maxOffset);
  const volume = enrichedVolume.slice(
    enrichedVolume.length - windowSize - clampedOffset,
    enrichedVolume.length - clampedOffset,
  );
  const isZoomed = windowSize < enrichedVolume.length || clampedOffset > 0;
  const compareOptions = [
    { key: "priorPeriod", label: "Prior Period" },
    { key: "priorYear", label: "Same Period Last Year" },
    { key: "budget", label: "Budget" },
  ];
  const volumeTableColumns: ReportColumn<(typeof volume)[number]>[] = [
    { key: "month", header: "Month" },
    { key: "inpatient", header: "Inpatient", align: "right" },
    { key: "opd", header: "OPD", align: "right" },
    { key: "emergency", header: "Emergency", align: "right" },
    { key: "daySurgery", header: "Day Surgery", align: "right" },
  ];
  const diagnosisTableColumns: ReportColumn<ExecutiveData["topDiagnoses"][number]>[] = [
    { key: "code", header: "ICD-10" },
    { key: "description", header: "Diagnosis" },
    { key: "count", header: "Patients", align: "right" },
    {
      key: "caseRate",
      header: "Case Rate",
      align: "right",
      render: (r) => php(r.caseRate, { compact: true }),
    },
    { key: "avgLos", header: "Avg LOS", align: "right", render: (r) => `${r.avgLos.toFixed(1)}d` },
  ];
  const claimsTableColumns: ReportColumn<ExecutiveData["claims"]["statuses"][number]>[] = [
    { key: "status", header: "Status" },
    { key: "count", header: "Claims", align: "right" },
    {
      key: "value",
      header: "Value",
      align: "right",
      render: (r) => php(r.value, { compact: true }),
    },
  ];
  const labTableColumns: ReportColumn<ExecutiveData["lab"]["byCategory"][number]>[] = [
    { key: "category", header: "Category" },
    { key: "compliance", header: "Compliance", align: "right", render: (r) => pct(r.compliance) },
    { key: "target", header: "Target", align: "right", render: (r) => pct(r.target) },
    { key: "median", header: "Median TAT", align: "right", render: (r) => `${r.median}h` },
  ];
  const totalRevenue = data.revenue.byPayer.reduce((s, p) => s + p.amount, 0);
  const claimTotal = data.claims.statuses.reduce((s, c) => s + c.count, 0);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-brand">
            {data.tenant} · Level 3 Hospital
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
            Executive Dashboard
          </h1>
          <p className="text-sm text-text-muted">
            {data.period} · compared with {data.priorPeriod}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RoleSwitcher role={role} onChange={setRole} />
          <StatusBadge tone="neutral">Hospital Administrator / Medical Director view</StatusBadge>
        </div>
      </header>

      <GlobalFilterBar
        filters={[
          { key: "department", label: "Department", options: departmentOptions },
          { key: "physician", label: "Physician", options: physicianOptions },
        ]}
        values={filterValues}
        onChange={(key, value) => setFilterValues((v) => ({ ...v, [key]: value }))}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      {/* ZONE A — KPI strip */}
      <section className="space-y-3">
        <SectionTitle
          title="Key performance indicators"
          description="Month to date, drill any card for detail."
        />
        <KpiStrip>
          <MetricCard
            label="Total Admissions (MTD)"
            value={num(data.admissions.total)}
            delta={data.admissions.deltaMonth}
            secondary={`${data.admissions.deltaYear > 0 ? "+" : ""}${data.admissions.deltaYear}% vs same month last year`}
            status="neutral"
            icon={Users}
            onClick={() => setDrill({ kind: "kpi", id: "admissions" })}
          />
          <MetricCard
            label="Average Length of Stay"
            value={`${data.alos.value} days`}
            delta={data.alos.delta}
            invertDelta
            secondary="National average 4.5 days"
            status={alosStatus(data.alos.value)}
            icon={Timer}
            onClick={() => setDrill({ kind: "kpi", id: "alos" })}
          />
          <MetricCard
            label="Bed Occupancy Rate"
            value={pct(data.bor.value)}
            delta={data.bor.delta}
            secondary="Optimal band 75–85%"
            status={borStatus(data.bor.value)}
            icon={BedDouble}
            onClick={() => setDrill({ kind: "kpi", id: "bor" })}
          />
          <MetricCard
            label="Total Revenue (MTD)"
            value={php(data.revenue.total)}
            delta={data.revenue.delta}
            status="neutral"
            icon={CircleDollarSign}
            onClick={() => setDrill({ kind: "kpi", id: "revenue" })}
          />
          <MetricCard
            label="PhilHealth Remittance (MTD)"
            value={php(data.remittance.received, { compact: true })}
            delta={data.remittance.delta}
            secondary={`Expected ${php(data.remittance.expected, { compact: true })}`}
            status={data.remittance.received >= data.remittance.expected ? "good" : "warning"}
            icon={ClipboardCheck}
            onClick={() => setDrill({ kind: "kpi", id: "remittance" })}
          />
          <MetricCard
            label="Claim Approval Rate"
            value={pct(data.approvalRate.value)}
            delta={data.approvalRate.delta}
            status={
              data.approvalRate.value >= 90
                ? "good"
                : data.approvalRate.value >= 80
                  ? "warning"
                  : "danger"
            }
            icon={ClipboardCheck}
            onClick={() => setDrill({ kind: "kpi", id: "approval" })}
          />
          <MetricCard
            label="Mortality Rate (MTD)"
            value={pct(data.mortality.value)}
            delta={data.mortality.delta}
            invertDelta
            status={
              data.mortality.value <= 2 ? "good" : data.mortality.value <= 4 ? "warning" : "danger"
            }
            icon={HeartPulse}
            onClick={() => setDrill({ kind: "kpi", id: "mortality" })}
          />
          <MetricCard
            label="Patient Satisfaction"
            value={`${data.satisfaction.value} NPS`}
            delta={data.satisfaction.delta}
            status="neutral"
            icon={Smile}
            note="Connect patient feedback module to populate"
            onClick={() => setDrill({ kind: "kpi", id: "satisfaction" })}
          />
        </KpiStrip>
      </section>

      {/* ZONE B — volume + financial */}
      <section className="grid gap-4 xl:grid-cols-2">
        <InteractiveChartCard
          title="Admission Volume Trend"
          description="Encounter counts by class · drag the brush below the chart to zoom"
          table={{ columns: volumeTableColumns, rows: volume }}
          action={
            <div className="flex flex-wrap items-center gap-1.5">
              <ZoomControls
                preset={zoomPreset}
                onPresetChange={(p) => {
                  setZoomPreset(p);
                  setZoomOffset(0);
                }}
                onShift={(dir) => setZoomOffset((o) => o + dir)}
                zoomed={isZoomed}
                onReset={() => {
                  setZoomPreset("1Y");
                  setZoomOffset(0);
                }}
              />
              <CompareToggle options={compareOptions} value={compareKey} onChange={setCompareKey} />
              <AddAnnotationButton
                role={role}
                xOptions={volume.map((v) => v.month)}
                onAdd={(x, note) => addAnnotation(x, note, "You (Admin)")}
              />
            </div>
          }
        >
          <div className="mb-2 flex flex-wrap gap-3">
            {(
              [
                ["inpatient", "Inpatient", PALETTE.brand],
                ["opd", "OPD", PALETTE.philhealth],
                ["emergency", "Emergency", PALETTE.danger],
                ["daySurgery", "Day Surgery", PALETTE.success],
              ] as const
            ).map(([key, label, color]) => (
              <button
                key={key}
                onClick={() => setVisibleSeries((s) => ({ ...s, [key]: !s[key] }))}
                className={cn(
                  "transition-opacity",
                  visibleSeries[key] ? "opacity-100" : "opacity-35",
                )}
              >
                <LegendDot color={color} label={label} />
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={volume} margin={{ left: -12, right: 8, top: 8 }}>
              <defs>
                {(
                  [
                    ["inpatient", PALETTE.brand],
                    ["opd", PALETTE.philhealth],
                    ["emergency", PALETTE.danger],
                    ["daySurgery", PALETTE.success],
                  ] as const
                ).map(([key, color]) => (
                  <linearGradient id={`g-${key}`} key={key} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={54} />
              <Tooltip
                content={
                  <RichTooltip
                    valueFormatter={num}
                    clickHint={false}
                    getPriorChangePct={(row) => {
                      const r = row as { inpatient?: number; priorInpatient?: number } | undefined;
                      if (!r?.priorInpatient) return undefined;
                      return (
                        ((Number(r.inpatient ?? 0) - r.priorInpatient) / r.priorInpatient) * 100
                      );
                    }}
                  />
                }
              />
              {visibleSeries["inpatient"] ? (
                <Area
                  type="monotone"
                  dataKey="inpatient"
                  name="Inpatient"
                  stroke={PALETTE.brand}
                  fill="url(#g-inpatient)"
                  strokeWidth={2}
                />
              ) : null}
              {visibleSeries["opd"] ? (
                <Area
                  type="monotone"
                  dataKey="opd"
                  name="OPD"
                  stroke={PALETTE.philhealth}
                  fill="url(#g-opd)"
                  strokeWidth={2}
                />
              ) : null}
              {visibleSeries["emergency"] ? (
                <Area
                  type="monotone"
                  dataKey="emergency"
                  name="Emergency"
                  stroke={PALETTE.danger}
                  fill="url(#g-emergency)"
                  strokeWidth={2}
                />
              ) : null}
              {visibleSeries["daySurgery"] ? (
                <Area
                  type="monotone"
                  dataKey="daySurgery"
                  name="Day Surgery"
                  stroke={PALETTE.success}
                  fill="url(#g-daySurgery)"
                  strokeWidth={2}
                />
              ) : null}
              {compareKey === "priorPeriod" ? (
                <Line
                  type="monotone"
                  dataKey="comparePriorPeriod"
                  name="Prior Period"
                  stroke="#8A8F98"
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  dot={false}
                />
              ) : null}
              {compareKey === "priorYear" ? (
                <Line
                  type="monotone"
                  dataKey="priorInpatient"
                  name="Same Period Last Year"
                  stroke="#8A8F98"
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  dot={false}
                />
              ) : null}
              {compareKey === "budget" ? (
                <Line
                  type="monotone"
                  dataKey="compareBudget"
                  name="Budget Target"
                  stroke="#E67E22"
                  strokeDasharray="2 2"
                  strokeWidth={1.5}
                  dot={false}
                />
              ) : null}
              <Brush
                dataKey="month"
                height={18}
                travellerWidth={8}
                stroke={PALETTE.brand}
                className="text-[10px]"
              />
            </ComposedChart>
          </ResponsiveContainer>
          <AnnotationList
            annotations={annotations}
            {...(role === "Admin" ? { onRemove: removeAnnotation } : {})}
          />
        </InteractiveChartCard>

        <PanelCard
          title="Revenue Breakdown"
          description={`${data.period} · click a segment to drill down`}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="relative">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={data.revenue.byPayer}
                    dataKey="amount"
                    nameKey="payer"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    onClick={(entry) => {
                      const payer = (entry as unknown as { payer: string }).payer;
                      setDrill({ kind: "payer", payer });
                      setPayerChain(payer);
                    }}
                  >
                    {data.revenue.byPayer.map((slice) => (
                      <Cell key={slice.payer} fill={slice.color} className="cursor-pointer" />
                    ))}
                  </Pie>
                  <Tooltip
                    content={<RichTooltip valueFormatter={(v) => php(v, { compact: true })} />}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-x-0 top-[42%] text-center">
                <div className="text-xs text-text-muted">Total</div>
                <div className="text-sm font-semibold text-text-primary">
                  {php(totalRevenue, { compact: true })}
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-center gap-1.5">
              {data.revenue.byPayer.map((slice) => (
                <button
                  key={slice.payer}
                  onClick={() => {
                    setDrill({ kind: "payer", payer: slice.payer });
                    setPayerChain(slice.payer);
                  }}
                  className="flex items-center justify-between gap-2 rounded px-1 py-0.5 text-left hover:bg-muted"
                >
                  <LegendDot color={slice.color} label={slice.payer} />
                  <span className="text-xs font-medium text-text-primary">
                    {php(slice.amount, { compact: true })}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 border-t border-border pt-3">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
              <p className="text-xs text-text-muted">Payer mix trended over 6 months</p>
              {payerChain ? (
                <ChainLinkBadge label={payerChain} onClear={() => setPayerChain(null)} />
              ) : null}
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={data.revenue.payerTrend} margin={{ left: -18, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={60}
                  tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(0)}M`}
                />
                <Tooltip
                  content={
                    <RichTooltip
                      valueFormatter={(v) => php(v, { compact: true })}
                      clickHint={false}
                    />
                  }
                />
                {(
                  [
                    ["philhealth", "PhilHealth", PALETTE.philhealth],
                    ["hmo", "HMO", PALETTE.hmo],
                    ["privatePay", "Private Pay", PALETTE.brand],
                    ["scpwd", "SC/PWD Discount", PALETTE.scpwd],
                    ["gsis", "GSIS/Other", PALETTE.gsis],
                    ["writeoff", "Write-offs", PALETTE.writeoff],
                  ] as const
                ).map(([key, label, color]) => (
                  <Bar
                    key={key}
                    stackId="a"
                    dataKey={key}
                    name={label}
                    fill={color}
                    fillOpacity={!payerChain || payerChain === label ? 1 : 0.25}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PanelCard>
      </section>

      {/* ZONE C — three panels */}
      <section className="grid gap-4 xl:grid-cols-3">
        <InteractiveChartCard
          title="Top 10 Diagnoses (ICD-10)"
          description={
            sampleFiltered
              ? "Condition counts · filtered sample (24 admission records)"
              : "Condition counts this month"
          }
          table={{ columns: diagnosisTableColumns, rows: filteredTopDiagnoses }}
          onRowClickInTable={(row) => setDrill({ kind: "diagnosis", code: row.code })}
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={filteredTopDiagnoses}
              layout="vertical"
              margin={{ left: 10, right: 16 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="code"
                width={62}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<DiagnosisTooltip />} />
              <Bar
                dataKey="count"
                radius={[0, 4, 4, 0]}
                onClick={(entry) =>
                  setDrill({ kind: "diagnosis", code: (entry as unknown as { code: string }).code })
                }
              >
                {brandRamp(filteredTopDiagnoses.length).map((color, i) => (
                  <Cell key={i} fill={color} className="cursor-pointer" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </InteractiveChartCard>

        <InteractiveChartCard
          title="Claims Health Snapshot"
          description={`${num(claimTotal)} claims in cycle`}
          table={{ columns: claimsTableColumns, rows: data.claims.statuses }}
          onRowClickInTable={(row) => setDrill({ kind: "claims", status: row.status })}
        >
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={data.claims.statuses}
                dataKey="count"
                nameKey="status"
                innerRadius={48}
                outerRadius={74}
                paddingAngle={2}
                onClick={(entry) =>
                  setDrill({
                    kind: "claims",
                    status: (entry as unknown as { status: string }).status,
                  })
                }
              >
                {data.claims.statuses.map((s) => (
                  <Cell key={s.status} fill={s.color} className="cursor-pointer" />
                ))}
              </Pie>
              <Tooltip content={<RichTooltip valueFormatter={(v) => `${num(v)} claims`} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mb-2 flex flex-wrap gap-2">
            {data.claims.statuses.map((s) => (
              <LegendDot key={s.status} color={s.color} label={`${s.status} (${s.count})`} />
            ))}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Top denial reason</TableHead>
                <TableHead className="text-right text-xs">n</TableHead>
                <TableHead className="text-right text-xs">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.claims.denialReasons.slice(0, 5).map((r) => {
                const totalDenials = data.claims.denialReasons.reduce((s, x) => s + x.count, 0);
                return (
                  <TableRow
                    key={r.code}
                    className="cursor-pointer"
                    onClick={() => setDrill({ kind: "claims", status: "Denied" })}
                  >
                    <TableCell className="text-xs">{r.reason}</TableCell>
                    <TableCell className="text-right text-xs">{r.count}</TableCell>
                    <TableCell className="text-right text-xs">
                      {pct((r.count / totalDenials) * 100, 0)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </InteractiveChartCard>

        <InteractiveChartCard
          title="Laboratory TAT Performance"
          description="Results released within target TAT"
          table={{ columns: labTableColumns, rows: data.lab.byCategory }}
        >
          <Gauge value={data.lab.compliance} label={`Target ${pct(data.lab.target, 0)}`} />
          <div className="mt-2 space-y-2">
            {data.lab.byCategory.map((c) => (
              <BulletRow
                key={c.category}
                label={`${c.category} · median ${c.median}h`}
                value={c.compliance}
                target={c.target}
                max={100}
                suffix="%"
                good={c.compliance >= c.target}
              />
            ))}
          </div>
          <div className="mt-3 border-t border-border pt-3">
            <p className="mb-1 text-xs text-text-muted">TAT compliance, last 30 days</p>
            <ResponsiveContainer width="100%" height={70}>
              <LineChart data={data.lab.trend}>
                <Tooltip
                  content={<RichTooltip valueFormatter={(v) => pct(v)} clickHint={false} />}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  name="Compliance"
                  stroke={PALETTE.brand}
                  strokeWidth={1.75}
                  dot={false}
                />
                <YAxis hide domain={[60, 100]} />
                <XAxis dataKey="day" hide />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </InteractiveChartCard>
      </section>

      {/* ZONE D — alerts */}
      <section className="space-y-3">
        <SectionTitle
          title="Alerts & pending actions"
          description="Items requiring executive attention today."
        />
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
          {data.alerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                "flex min-w-[17rem] flex-col justify-between gap-3 rounded-lg border border-l-4 bg-card p-4 shadow-sm",
                alert.severity === "danger" ? "border-l-danger" : "border-l-warning",
              )}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <AlertTriangle
                    className={cn(
                      "size-4",
                      alert.severity === "danger" ? "text-danger" : "text-warning",
                    )}
                  />
                  <span className="text-2xl font-semibold text-text-primary">{alert.count}</span>
                </div>
                <p className="text-sm font-medium text-text-primary">{alert.title}</p>
                <p className="text-xs text-text-muted">{alert.detail}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="justify-between"
                onClick={() => setDrill({ kind: "alert", id: alert.id })}
              >
                {alert.actionLabel}
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      <ExecutiveDrawer data={data} drill={drill} onClose={() => setDrill(null)} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function DiagnosisTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: RichTooltipPayloadEntry[];
}) {
  const first = payload?.[0];
  const desc = (first?.payload as { description?: string } | undefined)?.description;
  return (
    <RichTooltip
      {...(active !== undefined ? { active } : {})}
      {...(payload !== undefined ? { payload } : {})}
      {...(desc !== undefined ? { label: desc } : {})}
      valueFormatter={(v) => `${num(v)} patients`}
    />
  );
}

function MiniBar({
  rows,
  suffix = "",
}: {
  rows: { name: string; value: number }[];
  suffix?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, rows.length * 30)}>
      <BarChart data={rows} layout="vertical" margin={{ left: 10, right: 24 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={130}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v: number) => [`${v}${suffix}`, ""]}
        />
        <Bar dataKey="value" fill={PALETTE.brand} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ExecutiveDrawer({
  data,
  drill,
  onClose,
}: {
  data: ExecutiveData;
  drill: Drill;
  onClose: () => void;
}) {
  const open = drill !== null;
  let title = "";
  let description = "";
  let body: React.ReactNode = null;
  let fullReportHref: string | undefined;
  let exportRows: unknown[] | undefined;
  let exportColumns: { header: string; get: (row: unknown) => string }[] | undefined;

  if (drill?.kind === "kpi") {
    switch (drill.id) {
      case "admissions":
        title = "Total Admissions (MTD)";
        description = `${num(data.admissions.total)} inpatient encounters · ${data.admissions.deltaMonth}% vs ${data.priorPeriod}, ${data.admissions.deltaYear}% vs last year`;
        fullReportHref = "/reports/admission-discharge-logbook";
        exportRows = data.admissions.rows;
        exportColumns = [
          { header: "Patient", get: (r) => (r as (typeof data.admissions.rows)[number]).patient },
          {
            header: "Diagnosis",
            get: (r) => (r as (typeof data.admissions.rows)[number]).diagnosis,
          },
          {
            header: "Physician",
            get: (r) => (r as (typeof data.admissions.rows)[number]).physician,
          },
          { header: "LOS", get: (r) => String((r as (typeof data.admissions.rows)[number]).los) },
          {
            header: "Disposition",
            get: (r) => (r as (typeof data.admissions.rows)[number]).disposition,
          },
        ];
        body = (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Patient</TableHead>
                <TableHead className="text-xs">Diagnosis</TableHead>
                <TableHead className="text-xs">Physician</TableHead>
                <TableHead className="text-right text-xs">LOS</TableHead>
                <TableHead className="text-xs">Discharge</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.admissions.rows.map((r) => (
                <TableRow key={r.encounterId}>
                  <TableCell className="text-xs">
                    <div className="font-medium">{r.patient}</div>
                    <div className="text-text-muted">{r.patientId}</div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.icd10} · {r.diagnosis}
                  </TableCell>
                  <TableCell className="text-xs">{r.physician}</TableCell>
                  <TableCell className="text-right text-xs">{r.los}d</TableCell>
                  <TableCell className="text-xs">{r.disposition}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );
        break;
      case "alos":
        title = "Average Length of Stay";
        description = `${data.alos.value} days · national average 4.5 days`;
        body = (
          <div className="space-y-5">
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">By department</p>
              <MiniBar rows={data.alos.byDepartment} suffix="d" />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">By ICD-10 chapter</p>
              <MiniBar rows={data.alos.byChapter} suffix="d" />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">By admission type</p>
              <MiniBar rows={data.alos.byAdmissionType} suffix="d" />
            </div>
          </div>
        );
        break;
      case "bor":
        title = "Bed Occupancy Rate";
        description = `${pct(data.bor.value)} of ${320} beds · optimal band 75–85%`;
        body = (
          <div className="space-y-5">
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">By ward / department</p>
              <MiniBar rows={data.bor.byWard} suffix="%" />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">Trend, last 12 months</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={data.bor.trend} margin={{ left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    domain={[50, 100]}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v: number) => [pct(v), "BOR"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={PALETTE.brand}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
        break;
      case "revenue":
        title = "Total Revenue (MTD)";
        description = php(data.revenue.total);
        fullReportHref = "/reports/revenue-collection";
        body = (
          <div className="space-y-5">
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">By department</p>
              {data.revenue.byDepartment.map((d) => (
                <StatRow key={d.name} label={d.name} value={php(d.value, { compact: true })} />
              ))}
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">By service type</p>
              {data.revenue.byServiceType.map((d) => (
                <StatRow key={d.name} label={d.name} value={php(d.value, { compact: true })} />
              ))}
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">By payer</p>
              {data.revenue.byPayer.map((d) => (
                <StatRow key={d.payer} label={d.payer} value={php(d.amount, { compact: true })} />
              ))}
            </div>
          </div>
        );
        break;
      case "remittance":
        title = "PhilHealth Remittance (MTD)";
        description = `${php(data.remittance.received)} received of ${php(data.remittance.expected)} expected`;
        fullReportHref = "/reports/philhealth-claims-register";
        body = (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Batch</TableHead>
                <TableHead className="text-xs">Case type</TableHead>
                <TableHead className="text-right text-xs">Claims</TableHead>
                <TableHead className="text-right text-xs">Amount</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.remittance.batches.map((b) => (
                <TableRow key={b.batch}>
                  <TableCell className="text-xs">{b.batch}</TableCell>
                  <TableCell className="text-xs">{b.caseType}</TableCell>
                  <TableCell className="text-right text-xs">{b.claims}</TableCell>
                  <TableCell className="text-right text-xs">
                    {php(b.amount, { compact: true })}
                  </TableCell>
                  <TableCell className="text-xs">
                    <StatusBadge tone={b.status === "Received" ? "good" : "warning"}>
                      {b.status}
                    </StatusBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );
        break;
      case "approval":
        title = "Claim Approval Rate";
        description = `${pct(data.approvalRate.value)} approved · denied claims by reason below`;
        fullReportHref = "/reports/denial-appeal-tracker";
        body = (
          <div className="space-y-5">
            <MiniBar rows={data.approvalRate.byDepartment} suffix="%" />
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">Denials by reason code</p>
              {data.claims.denialReasons.map((r) => (
                <StatRow key={r.code} label={`${r.code} · ${r.reason}`} value={`${r.count}`} />
              ))}
            </div>
          </div>
        );
        break;
      case "mortality":
        title = "Inpatient Mortality Rate";
        description = `${pct(data.mortality.value)} of discharges`;
        body = (
          <div className="space-y-5">
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">By department</p>
              <MiniBar rows={data.mortality.byDepartment} suffix="%" />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">By diagnosis (deaths)</p>
              <MiniBar rows={data.mortality.byDiagnosis} />
            </div>
          </div>
        );
        break;
      case "satisfaction":
        title = "Patient Satisfaction Score";
        description = "Mock NPS-style score — connect patient feedback module to populate";
        body = <MiniBar rows={data.satisfaction.byDepartment} />;
        break;
    }
  } else if (drill?.kind === "payer") {
    const slice = data.revenue.byPayer.find((p) => p.payer === drill.payer);
    title = `${drill.payer} revenue`;
    description = slice ? php(slice.amount) : "";
    fullReportHref = "/reports/revenue-collection";
    body = (
      <div className="space-y-1">
        {data.revenue.byDepartment.map((d, i) => (
          <StatRow
            key={d.name}
            label={d.name}
            value={php((slice?.amount ?? 0) * (0.24 - i * 0.02), { compact: true })}
          />
        ))}
      </div>
    );
  } else if (drill?.kind === "diagnosis") {
    const dx = data.topDiagnoses.find((d) => d.code === drill.code);
    title = `${dx?.code} · ${dx?.description}`;
    description = `${dx?.count} patients this month`;
    fullReportHref = "/reports/morbidity-summary";
    body = dx ? (
      <div className="space-y-4">
        <StatRow label="PhilHealth case rate" value={php(dx.caseRate)} />
        <StatRow label="Average length of stay" value={`${dx.avgLos.toFixed(1)} days`} />
        <div>
          <p className="mb-1 text-xs font-medium text-text-secondary">6-month trend</p>
          <Sparkline data={dx.trend} width={280} height={48} />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-text-secondary">Patients</p>
          {data.admissions.rows
            .filter((r) => r.icd10 === dx.code)
            .map((r) => (
              <StatRow
                key={r.encounterId}
                label={`${r.patient} · ${r.department}`}
                value={`${r.los}d`}
              />
            ))}
        </div>
      </div>
    ) : null;
  } else if (drill?.kind === "claims") {
    const status = data.claims.statuses.find((s) => s.status === drill.status);
    title = `Claims — ${drill.status}`;
    description = status
      ? `${num(status.count)} claims · ${php(status.value, { compact: true })}`
      : "";
    fullReportHref =
      drill.status === "Denied"
        ? "/reports/denial-appeal-tracker"
        : "/reports/philhealth-claims-register";
    body = (
      <div className="space-y-4">
        <div>
          <p className="mb-1 text-xs font-medium text-text-secondary">
            Denial reasons & recommended actions
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Code</TableHead>
                <TableHead className="text-xs">Reason</TableHead>
                <TableHead className="text-right text-xs">At risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.claims.denialReasons.map((r) => (
                <TableRow key={r.code}>
                  <TableCell className="text-xs">{r.code}</TableCell>
                  <TableCell className="text-xs">
                    <div>{r.reason}</div>
                    <div className="text-text-muted">{r.action}</div>
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {php(r.valueAtRisk, { compact: true })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  } else if (drill?.kind === "alert") {
    const alert = data.alerts.find((a) => a.id === drill.id);
    title = alert?.title ?? "";
    description = `${alert?.count} items · ${alert?.module} module`;
    fullReportHref = alert ? reportHrefForModule(alert.module) : undefined;
    body = (
      <div className="space-y-3">
        <p className="text-sm text-text-secondary">{alert?.detail}</p>
        <Button className="w-full justify-between bg-brand text-brand-foreground hover:bg-brand/90">
          {alert?.actionLabel}
          <ArrowRight className="size-4" />
        </Button>
        <p className="text-xs text-text-muted">
          Worklist rows appear here once the {alert?.module} module is wired to live data.
        </p>
      </div>
    );
  }

  return (
    <ChartDrillDrawer
      open={open}
      onOpenChange={(v) => (v ? null : onClose())}
      metricName={title}
      value={description}
      {...(exportRows ? { exportRows } : {})}
      {...(exportColumns ? { exportColumns } : {})}
      {...(fullReportHref ? { fullReportHref } : {})}
    >
      {body}
    </ChartDrillDrawer>
  );
}

function ExecutiveSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 w-80" />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
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
