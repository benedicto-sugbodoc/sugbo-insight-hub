import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { FlaskConical, Gauge as GaugeIcon, ListChecks, Settings2, Timer } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartSkeletonBlock,
  DrillDrawer,
  KpiStrip,
  LegendDot,
  MetricCard,
  MetricStatus,
  PALETTE,
  PanelCard,
  SectionTitle,
  StatRow,
  StatusBadge,
  brandRamp,
  num,
  pct,
} from "@/components/analytics/shared";
import {
  fetchLaboratoryData,
  type AbnormalTestRow,
  type LabCategory,
  type TatBoxStat,
  type TatOutlier,
  type UnmappedTest,
} from "@/lib/analytics/laboratory.mock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/analytics/laboratory")({
  head: () => ({
    meta: [
      { title: "Laboratory Analytics — SugboDoc" },
      {
        name: "description",
        content:
          "Laboratory analytics dashboard: test volume, turnaround time distribution, critical value response, abnormal result rates and LOINC mapping completeness.",
      },
      { property: "og:title", content: "Laboratory Analytics — SugboDoc" },
      {
        property: "og:description",
        content: "Lab Head / Medical Director view of test volumes, TAT and critical alert compliance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LaboratoryPage,
});

const CATEGORY_COLORS: Record<LabCategory, string> = {
  Hematology: PALETTE.brand,
  Chemistry: PALETTE.philhealth,
  Urinalysis: PALETTE.success,
  Microbiology: PALETTE.danger,
  Immunology: PALETTE.hmo,
  Serology: PALETTE.gold,
  Other: PALETTE.neutral,
};

type Drill =
  | { kind: "kpi"; id: string }
  | { kind: "outlier"; outlier: TatOutlier }
  | { kind: "abnormal"; row: AbnormalTestRow }
  | { kind: "unmapped"; test: UnmappedTest }
  | null;

function tatStatus(compliance: number): MetricStatus {
  if (compliance >= 90) return "good";
  if (compliance >= 75) return "warning";
  return "danger";
}

function LaboratoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "laboratory"],
    queryFn: fetchLaboratoryData,
  });
  const [drill, setDrill] = React.useState<Drill>(null);

  if (isLoading || !data) return <LaboratorySkeleton />;

  const scatterData = data.criticalNotifications.map((n, i) => ({
    x: i,
    y: n.minutesToNotify,
    z: n.outlier ? 60 : 30,
    ...n,
  }));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-brand">
            {data.tenant} · Laboratory Department
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
            Laboratory Analytics
          </h1>
          <p className="text-sm text-text-muted">{data.period}</p>
        </div>
        <StatusBadge tone="neutral">Lab Head / Medical Director view</StatusBadge>
      </header>

      {/* KPI strip */}
      <section className="space-y-3">
        <SectionTitle title="Key performance indicators" description="Month to date, drill any card for detail." />
        <KpiStrip>
          <MetricCard
            label="Total Tests (MTD)"
            value={num(data.kpis.totalTestsMtd)}
            delta={data.kpis.totalTestsDelta}
            status="neutral"
            icon={FlaskConical}
            onClick={() => setDrill({ kind: "kpi", id: "volume" })}
          />
          <MetricCard
            label="TAT Compliance"
            value={pct(data.kpis.tatCompliancePct)}
            secondary="Target ≥ 90%"
            status={tatStatus(data.kpis.tatCompliancePct)}
            icon={Timer}
            onClick={() => setDrill({ kind: "kpi", id: "tat" })}
          />
          <MetricCard
            label="Critical Value Response"
            value={pct(data.kpis.criticalResponseCompliancePct)}
            secondary="Notified within 30 min, target 100%"
            status={tatStatus(data.kpis.criticalResponseCompliancePct)}
            icon={GaugeIcon}
            onClick={() => setDrill({ kind: "kpi", id: "critical" })}
          />
          <MetricCard
            label="Abnormal Result Rate"
            value={pct(data.kpis.abnormalRatePct)}
            secondary="Share of results flagged H/L/HH/LL"
            status="neutral"
            icon={ListChecks}
            onClick={() => setDrill({ kind: "kpi", id: "abnormal" })}
          />
          <MetricCard
            label="LOINC Mapping"
            value={pct(data.kpis.loincMappedPct)}
            secondary={`${num(data.loinc.mappedCount)} of ${num(data.loinc.totalCount)} tests mapped`}
            status={data.kpis.loincMappedPct >= 95 ? "good" : data.kpis.loincMappedPct >= 85 ? "warning" : "danger"}
            icon={Settings2}
            onClick={() => setDrill({ kind: "kpi", id: "loinc" })}
          />
        </KpiStrip>
      </section>

      {/* Chart 32 — volume trend */}
      <section className="grid gap-4 xl:grid-cols-1">
        <PanelCard title="Test Volume Trend by Category" description="Monthly test counts, stacked by category">
          <div className="mb-2 flex flex-wrap gap-3">
            {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
              <LegendDot key={cat} color={color} label={cat} />
            ))}
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data.volumeTrend} margin={{ left: -12, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={54} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number, n: string) => [num(v), n]} />
              {(Object.keys(CATEGORY_COLORS) as LabCategory[]).map((cat) => (
                <Area
                  key={cat}
                  type="monotone"
                  dataKey={cat}
                  stackId="1"
                  name={cat}
                  stroke={CATEGORY_COLORS[cat]}
                  fill={CATEGORY_COLORS[cat]}
                  fillOpacity={0.55}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </PanelCard>
      </section>

      {/* Chart 33 — TAT box and whisker */}
      <section>
        <PanelCard
          title="TAT Distribution by Test Category"
          description="Median, IQR, whiskers and outliers (minutes) vs target TAT — click an outlier for detail"
        >
          <TatBoxWhisker data={data.tatBox} onOutlierClick={(outlier) => setDrill({ kind: "outlier", outlier })} />
        </PanelCard>
      </section>

      {/* Chart 34 — critical value response */}
      <section className="grid gap-4 xl:grid-cols-2">
        <PanelCard
          title="Critical Value Alert Response"
          description="% notified within 30 minutes by category & department (target 100%)"
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data.criticalBars} layout="vertical" margin={{ left: 10, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} unit="%" />
              <YAxis
                type="category"
                dataKey="department"
                width={90}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v: number, _n, item) => [
                  `${v.toFixed(1)}%`,
                  (item?.payload as { category: string } | undefined)?.category ?? "",
                ]}
              />
              <ReferenceLine x={100} stroke={PALETTE.gold} strokeDasharray="4 4" />
              <Bar dataKey="withinTargetPct" radius={[0, 4, 4, 0]}>
                {data.criticalBars.map((row, i) => (
                  <Cell key={i} fill={CATEGORY_COLORS[row.category]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap gap-3">
            {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
              <LegendDot key={cat} color={color} label={cat} />
            ))}
          </div>
        </PanelCard>

        <PanelCard
          title="Individual Notification Times"
          description="Minutes from result to clinician notification (outliers > 30 min highlighted)"
        >
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ left: -12, right: 16, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" dataKey="x" name="event" tick={false} axisLine={false} tickLine={false} />
              <YAxis
                type="number"
                dataKey="y"
                name="minutes"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={40}
                unit="m"
              />
              <ZAxis type="number" dataKey="z" range={[30, 120]} />
              <ReferenceLine y={30} stroke={PALETTE.danger} strokeDasharray="4 4" label={{ value: "30 min target", fontSize: 10, position: "insideTopRight" }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v: number, n: string, item) => {
                  const p = item?.payload as { test?: string; department?: string; patient?: string } | undefined;
                  if (n === "minutes") return [`${v} min`, `${p?.test ?? ""} · ${p?.department ?? ""} · ${p?.patient ?? ""}`];
                  return [v, n];
                }}
              />
              <Scatter data={scatterData}>
                {scatterData.map((d, i) => (
                  <Cell key={i} fill={d.outlier ? PALETTE.danger : PALETTE.brandLight} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </PanelCard>
      </section>

      {/* Chart 35 — abnormal result rate */}
      <section>
        <PanelCard
          title="Abnormal Result Rate by Test"
          description="Top 20 tests by share of results flagged H/L/HH/LL"
        >
          <ResponsiveContainer width="100%" height={480}>
            <BarChart data={data.abnormalTests} layout="vertical" margin={{ left: 10, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} unit="%" />
              <YAxis
                type="category"
                dataKey="test"
                width={160}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v: number, _n, item) => [
                  `${v.toFixed(1)}%`,
                  (item?.payload as { totalResults: number } | undefined)?.totalResults
                    ? `n=${(item?.payload as { totalResults: number }).totalResults}`
                    : "",
                ]}
              />
              <Bar
                dataKey="abnormalPct"
                radius={[0, 4, 4, 0]}
                onClick={(entry) => setDrill({ kind: "abnormal", row: entry as unknown as AbnormalTestRow })}
              >
                {data.abnormalTests.map((row, i) => (
                  <Cell key={i} fill={CATEGORY_COLORS[row.category]} className="cursor-pointer" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-2 text-[11px] italic text-text-muted">
            High abnormal rates can reflect true disease burden (e.g. endemic areas) or reagent/analyzer calibration
            drift. Cross-check with QC logs before adjusting reference ranges.
          </p>
        </PanelCard>
      </section>

      {/* Chart 36 — LOINC mapping */}
      <section>
        <PanelCard
          title="LOINC Mapping Completeness"
          description={`${num(data.loinc.mappedCount)} of ${num(data.loinc.totalCount)} tests mapped to LOINC codes`}
          action={<Button size="sm" variant="outline" onClick={() => setDrill({ kind: "kpi", id: "loinc" })}>Open Lab Setup</Button>}
        >
          <div className="grid gap-6 md:grid-cols-[auto_1fr]">
            <LoincRing mapped={data.loinc.mappedCount} total={data.loinc.totalCount} />
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Unmapped test</TableHead>
                    <TableHead className="text-xs">Category</TableHead>
                    <TableHead className="text-right text-xs">Monthly volume</TableHead>
                    <TableHead className="text-xs">Priority</TableHead>
                    <TableHead className="text-right text-xs">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...data.loinc.unmapped]
                    .sort((a, b) => b.monthlyVolume - a.monthlyVolume)
                    .map((row) => (
                      <TableRow key={row.test}>
                        <TableCell className="text-sm font-medium">{row.test}</TableCell>
                        <TableCell className="text-sm text-text-secondary">{row.category}</TableCell>
                        <TableCell className="text-right text-sm">{num(row.monthlyVolume)}</TableCell>
                        <TableCell>
                          <StatusBadge tone={row.priority === "High" ? "danger" : row.priority === "Medium" ? "warning" : "neutral"}>
                            {row.priority}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => setDrill({ kind: "unmapped", test: row })}>
                            Open Lab Setup
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </PanelCard>
      </section>

      <DrillContent drill={drill} onOpenChange={(open) => !open && setDrill(null)} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hand-rolled box-and-whisker chart                                   */
/* ------------------------------------------------------------------ */

function TatBoxWhisker({
  data,
  onOutlierClick,
}: {
  data: TatBoxStat[];
  onOutlierClick: (outlier: TatOutlier) => void;
}) {
  const width = 900;
  const height = 320;
  const padding = { top: 16, right: 24, bottom: 32, left: 48 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const maxVal = Math.max(...data.flatMap((d) => [d.max, d.targetTat, ...d.outliers.map((o) => o.tatMinutes)])) * 1.08;
  const bandW = plotW / data.length;
  const boxW = bandW * 0.42;

  const yScale = (v: number) => padding.top + plotH - (v / maxVal) * plotH;

  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height} className="min-w-[720px]">
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + plotH} className="stroke-border" />
        <line x1={padding.left} y1={padding.top + plotH} x2={width - padding.right} y2={padding.top + plotH} className="stroke-border" />
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const v = Math.round(maxVal * t);
          const y = yScale(v);
          return (
            <g key={t}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} className="stroke-border" strokeDasharray="2 3" />
              <text x={padding.left - 8} y={y + 3} textAnchor="end" className="fill-text-muted" fontSize={10}>
                {v}
              </text>
            </g>
          );
        })}
        {data.map((cat, i) => {
          const cx = padding.left + bandW * i + bandW / 2;
          const color = CATEGORY_COLORS[cat.category];
          return (
            <g key={cat.category}>
              {/* target reference line, per-category tick */}
              <line
                x1={cx - bandW / 2 + 4}
                x2={cx + bandW / 2 - 4}
                y1={yScale(cat.targetTat)}
                y2={yScale(cat.targetTat)}
                stroke={PALETTE.gold}
                strokeDasharray="4 3"
                strokeWidth={1.5}
              />
              {/* whiskers */}
              <line x1={cx} x2={cx} y1={yScale(cat.max)} y2={yScale(cat.q3)} stroke={color} strokeWidth={1.5} />
              <line x1={cx} x2={cx} y1={yScale(cat.q1)} y2={yScale(cat.min)} stroke={color} strokeWidth={1.5} />
              <line x1={cx - boxW / 4} x2={cx + boxW / 4} y1={yScale(cat.max)} y2={yScale(cat.max)} stroke={color} strokeWidth={1.5} />
              <line x1={cx - boxW / 4} x2={cx + boxW / 4} y1={yScale(cat.min)} y2={yScale(cat.min)} stroke={color} strokeWidth={1.5} />
              {/* box */}
              <rect
                x={cx - boxW / 2}
                y={yScale(cat.q3)}
                width={boxW}
                height={Math.max(1, yScale(cat.q1) - yScale(cat.q3))}
                fill={color}
                fillOpacity={0.25}
                stroke={color}
                strokeWidth={1.5}
              />
              {/* median */}
              <line x1={cx - boxW / 2} x2={cx + boxW / 2} y1={yScale(cat.median)} y2={yScale(cat.median)} stroke={color} strokeWidth={2.5} />
              {/* outliers */}
              {cat.outliers.map((o) => (
                <circle
                  key={o.id}
                  cx={cx + (Math.random() - 0.5) * boxW * 0.5}
                  cy={yScale(o.tatMinutes)}
                  r={4}
                  fill={PALETTE.danger}
                  className="cursor-pointer"
                  onClick={() => onOutlierClick(o)}
                >
                  <title>{`${o.patient} · ${o.tatMinutes} min · ${o.delayReason}`}</title>
                </circle>
              ))}
              <text x={cx} y={height - 10} textAnchor="middle" className="fill-text-secondary" fontSize={11}>
                {cat.category}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-[11px] text-text-muted">
        Gold dashed line = target TAT per category. Red dots = outlier results (click for detail).
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hand-rolled progress ring                                           */
/* ------------------------------------------------------------------ */

function LoincRing({ mapped, total }: { mapped: number; total: number }) {
  const size = 160;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const ratio = total > 0 ? mapped / total : 0;
  const dash = ratio * circumference;
  const color = ratio >= 0.95 ? PALETTE.success : ratio >= 0.85 ? PALETTE.warning : PALETTE.danger;
  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-muted" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="46%" textAnchor="middle" className="fill-text-primary" fontSize={22} fontWeight={600}>
          {(ratio * 100).toFixed(0)}%
        </text>
        <text x="50%" y="62%" textAnchor="middle" className="fill-text-muted" fontSize={11}>
          {mapped} of {total}
        </text>
      </svg>
      <span className="text-xs text-text-muted">Tests mapped to LOINC</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Drawer                                                              */
/* ------------------------------------------------------------------ */

function DrillContent({
  drill,
  onOpenChange,
}: {
  drill: Drill;
  onOpenChange: (open: boolean) => void;
}) {
  if (!drill) {
    return <DrillDrawer open={false} onOpenChange={onOpenChange} title="" children={null} />;
  }

  if (drill.kind === "outlier") {
    const o = drill.outlier;
    return (
      <DrillDrawer
        open
        onOpenChange={onOpenChange}
        title={`TAT outlier — ${o.test}`}
        description={`${o.category} · Result ID ${o.id}`}
      >
        <StatRow label="Patient" value={`${o.patient} (${o.patientId})`} />
        <StatRow label="Test" value={o.test} />
        <StatRow label="Ordered at" value={o.orderedAt} />
        <StatRow label="Released at" value={o.releasedAt} />
        <StatRow label="Turnaround time" value={`${o.tatMinutes} min`} />
        <StatRow label="Delay reason" value={o.delayReason} />
      </DrillDrawer>
    );
  }

  if (drill.kind === "abnormal") {
    const r = drill.row;
    return (
      <DrillDrawer open onOpenChange={onOpenChange} title={r.test} description={`${r.category} · abnormal result rate`}>
        <StatRow label="Total results (MTD)" value={num(r.totalResults)} />
        <StatRow label="Abnormal rate" value={pct(r.abnormalPct)} />
        <StatRow label="Category" value={r.category} />
        <p className="text-xs italic text-text-muted">
          Review recent QC logs and reagent lot changes if the abnormal rate rose sharply month-over-month.
        </p>
      </DrillDrawer>
    );
  }

  if (drill.kind === "unmapped") {
    const t = drill.test;
    return (
      <DrillDrawer open onOpenChange={onOpenChange} title={t.test} description="LOINC mapping required">
        <StatRow label="Category" value={t.category} />
        <StatRow label="Monthly volume" value={num(t.monthlyVolume)} />
        <StatRow label="Priority" value={t.priority} />
        <Button size="sm" className="mt-2 w-full">
          Open Lab Setup
        </Button>
      </DrillDrawer>
    );
  }

  // kpi
  const titles: Record<string, string> = {
    volume: "Total tests — detail",
    tat: "TAT compliance — detail",
    critical: "Critical value response — detail",
    abnormal: "Abnormal result rate — detail",
    loinc: "LOINC mapping — Lab Setup",
  };
  return (
    <DrillDrawer open onOpenChange={onOpenChange} title={titles[drill.id] ?? "Detail"}>
      <p className="text-sm text-text-secondary">
        Connect the laboratory information system module to populate encounter-level detail for this metric.
      </p>
      {drill.id === "loinc" ? (
        <Button size="sm" className="mt-2 w-full">
          Open Lab Setup
        </Button>
      ) : null}
    </DrillDrawer>
  );
}

/* ------------------------------------------------------------------ */
/* Skeleton                                                            */
/* ------------------------------------------------------------------ */

function LaboratorySkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <div className="h-3 w-40 animate-pulse rounded bg-muted" />
          <div className="h-7 w-64 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <KpiStrip>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={cn("h-24 min-w-[13rem] animate-pulse rounded-lg bg-muted")} />
        ))}
      </KpiStrip>
      <ChartSkeletonBlock className="h-80" />
      <ChartSkeletonBlock className="h-80" />
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartSkeletonBlock />
        <ChartSkeletonBlock />
      </div>
      <ChartSkeletonBlock className="h-96" />
      <ChartSkeletonBlock className="h-72" />
    </div>
  );
}
