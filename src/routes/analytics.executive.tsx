import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BulletRow,
  DrillDrawer,
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
  const [range, setRange] = React.useState("12");

  if (isLoading || !data) return <ExecutiveSkeleton />;

  const volume = data.volume.slice(-Number(range));
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
        <StatusBadge tone="neutral">Hospital Administrator / Medical Director view</StatusBadge>
      </header>

      {/* ZONE A — KPI strip */}
      <section className="space-y-3">
        <SectionTitle title="Key performance indicators" description="Month to date, drill any card for detail." />
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
              data.approvalRate.value >= 90 ? "good" : data.approvalRate.value >= 80 ? "warning" : "danger"
            }
            icon={ClipboardCheck}
            onClick={() => setDrill({ kind: "kpi", id: "approval" })}
          />
          <MetricCard
            label="Mortality Rate (MTD)"
            value={pct(data.mortality.value)}
            delta={data.mortality.delta}
            invertDelta
            status={data.mortality.value <= 2 ? "good" : data.mortality.value <= 4 ? "warning" : "danger"}
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
        <PanelCard
          title="Admission Volume Trend"
          description="Encounter counts by class"
          action={
            <Tabs value={range} onValueChange={setRange}>
              <TabsList className="h-7">
                <TabsTrigger value="3" className="text-xs">3M</TabsTrigger>
                <TabsTrigger value="6" className="text-xs">6M</TabsTrigger>
                <TabsTrigger value="12" className="text-xs">12M</TabsTrigger>
              </TabsList>
            </Tabs>
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
                className={cn("transition-opacity", visibleSeries[key] ? "opacity-100" : "opacity-35")}
              >
                <LegendDot color={color} label={label} />
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={volume} margin={{ left: -12, right: 8, top: 8 }}>
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
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(value: number, name: string, item) => {
                  const prior = (item?.payload as { priorInpatient: number } | undefined)?.priorInpatient ?? 0;
                  const change = name === "Inpatient" && prior ? ` (${(((value - prior) / prior) * 100).toFixed(1)}% vs LY)` : "";
                  return [`${num(value)}${change}`, name];
                }}
              />
              {visibleSeries["inpatient"] ? (
                <Area type="monotone" dataKey="inpatient" name="Inpatient" stroke={PALETTE.brand} fill="url(#g-inpatient)" strokeWidth={2} />
              ) : null}
              {visibleSeries["opd"] ? (
                <Area type="monotone" dataKey="opd" name="OPD" stroke={PALETTE.philhealth} fill="url(#g-opd)" strokeWidth={2} />
              ) : null}
              {visibleSeries["emergency"] ? (
                <Area type="monotone" dataKey="emergency" name="Emergency" stroke={PALETTE.danger} fill="url(#g-emergency)" strokeWidth={2} />
              ) : null}
              {visibleSeries["daySurgery"] ? (
                <Area type="monotone" dataKey="daySurgery" name="Day Surgery" stroke={PALETTE.success} fill="url(#g-daySurgery)" strokeWidth={2} />
              ) : null}
            </AreaChart>
          </ResponsiveContainer>
        </PanelCard>

        <PanelCard title="Revenue Breakdown" description={`${data.period} · click a segment to drill down`}>
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
                    onClick={(entry) =>
                      setDrill({ kind: "payer", payer: (entry as unknown as { payer: string }).payer })
                    }
                  >
                    {data.revenue.byPayer.map((slice) => (
                      <Cell key={slice.payer} fill={slice.color} className="cursor-pointer" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(value: number, name: string) => [php(value, { compact: true }), name]}
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
                  onClick={() => setDrill({ kind: "payer", payer: slice.payer })}
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
            <p className="mb-1 text-xs text-text-muted">Payer mix trended over 6 months</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={data.revenue.payerTrend} margin={{ left: -18, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={60} tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(0)}M`} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number, n: string) => [php(v, { compact: true }), n]} />
                <Bar stackId="a" dataKey="philhealth" name="PhilHealth" fill={PALETTE.philhealth} />
                <Bar stackId="a" dataKey="hmo" name="HMO" fill={PALETTE.hmo} />
                <Bar stackId="a" dataKey="privatePay" name="Private" fill={PALETTE.brand} />
                <Bar stackId="a" dataKey="scpwd" name="SC/PWD" fill={PALETTE.scpwd} />
                <Bar stackId="a" dataKey="gsis" name="GSIS/Other" fill={PALETTE.gsis} />
                <Bar stackId="a" dataKey="writeoff" name="Write-off" fill={PALETTE.writeoff} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PanelCard>
      </section>

      {/* ZONE C — three panels */}
      <section className="grid gap-4 xl:grid-cols-3">
        <PanelCard title="Top 10 Diagnoses (ICD-10)" description="Condition counts this month">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data.topDiagnoses} layout="vertical" margin={{ left: 10, right: 16 }}>
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
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v: number, _n, item) => [
                  `${num(v)} patients`,
                  (item?.payload as { description: string } | undefined)?.description ?? "",
                ]}
              />
              <Bar
                dataKey="count"
                radius={[0, 4, 4, 0]}
                onClick={(entry) => setDrill({ kind: "diagnosis", code: (entry as unknown as { code: string }).code })}
              >
                {brandRamp(data.topDiagnoses.length).map((color, i) => (
                  <Cell key={i} fill={color} className="cursor-pointer" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </PanelCard>

        <PanelCard title="Claims Health Snapshot" description={`${num(claimTotal)} claims in cycle`}>
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
                  setDrill({ kind: "claims", status: (entry as unknown as { status: string }).status })
                }
              >
                {data.claims.statuses.map((s) => (
                  <Cell key={s.status} fill={s.color} className="cursor-pointer" />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number, n: string) => [`${num(v)} claims`, n]} />
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
                  <TableRow key={r.code} className="cursor-pointer" onClick={() => setDrill({ kind: "claims", status: "Denied" })}>
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
        </PanelCard>

        <PanelCard title="Laboratory TAT Performance" description="Results released within target TAT">
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
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => [pct(v), "Compliance"]} />
                <Line type="monotone" dataKey="value" stroke={PALETTE.brand} strokeWidth={1.75} dot={false} />
                <YAxis hide domain={[60, 100]} />
                <XAxis dataKey="day" hide />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </PanelCard>
      </section>

      {/* ZONE D — alerts */}
      <section className="space-y-3">
        <SectionTitle title="Alerts & pending actions" description="Items requiring executive attention today." />
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
                    className={cn("size-4", alert.severity === "danger" ? "text-danger" : "text-warning")}
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

function MiniBar({ rows, suffix = "" }: { rows: { name: string; value: number }[]; suffix?: string }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, rows.length * 30)}>
      <BarChart data={rows} layout="vertical" margin={{ left: 10, right: 24 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => [`${v}${suffix}`, ""]} />
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

  if (drill?.kind === "kpi") {
    switch (drill.id) {
      case "admissions":
        title = "Total Admissions (MTD)";
        description = `${num(data.admissions.total)} inpatient encounters · ${data.admissions.deltaMonth}% vs ${data.priorPeriod}, ${data.admissions.deltaYear}% vs last year`;
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
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} domain={[50, 100]} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => [pct(v), "BOR"]} />
                  <Line type="monotone" dataKey="value" stroke={PALETTE.brand} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
        break;
      case "revenue":
        title = "Total Revenue (MTD)";
        description = php(data.revenue.total);
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
                  <TableCell className="text-right text-xs">{php(b.amount, { compact: true })}</TableCell>
                  <TableCell className="text-xs">
                    <StatusBadge tone={b.status === "Received" ? "good" : "warning"}>{b.status}</StatusBadge>
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
              <StatRow key={r.encounterId} label={`${r.patient} · ${r.department}`} value={`${r.los}d`} />
            ))}
        </div>
      </div>
    ) : null;
  } else if (drill?.kind === "claims") {
    const status = data.claims.statuses.find((s) => s.status === drill.status);
    title = `Claims — ${drill.status}`;
    description = status ? `${num(status.count)} claims · ${php(status.value, { compact: true })}` : "";
    body = (
      <div className="space-y-4">
        <div>
          <p className="mb-1 text-xs font-medium text-text-secondary">Denial reasons & recommended actions</p>
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
                  <TableCell className="text-right text-xs">{php(r.valueAtRisk, { compact: true })}</TableCell>
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
    <DrillDrawer open={open} onOpenChange={(v) => (v ? null : onClose())} title={title} description={description}>
      {body}
    </DrillDrawer>
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
