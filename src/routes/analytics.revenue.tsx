import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarClock,
  CircleDollarSign,
  PiggyBank,
  Receipt,
  TrendingDown,
} from "lucide-react";

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
  php,
} from "@/components/analytics/shared";
import {
  fetchRevenueData,
  REV,
  type ARPatientRow,
  type DeptRevenueRow,
  type FunnelStage,
  type PayerSlice,
  type RevenueData,
  type WaterfallStep,
} from "@/lib/analytics/revenue.mock";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/analytics/revenue")({
  head: () => ({
    meta: [
      { title: "Revenue Cycle & Billing — SugboDoc" },
      {
        name: "description",
        content:
          "Revenue cycle and billing analytics: gross-to-net waterfall, payer mix, accounts receivable aging, collections, and PhilHealth/SC-PWD patient financial profile.",
      },
      { property: "og:title", content: "Revenue Cycle & Billing — SugboDoc" },
      {
        property: "og:description",
        content: "Billing manager view of hospital revenue, AR aging, collections and patient financial profile.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RevenuePage,
});

type Drill =
  | { kind: "kpi"; id: string }
  | { kind: "waterfall"; key: string }
  | { kind: "department"; name: string }
  | { kind: "funnel"; stage: string }
  | null;

function daysInArStatus(v: number): MetricStatus {
  if (v <= 30) return "good";
  if (v <= 40) return "warning";
  return "danger";
}

function collectionStatus(v: number): MetricStatus {
  if (v >= 90) return "good";
  if (v >= 80) return "warning";
  return "danger";
}

function writeOffStatus(v: number): MetricStatus {
  if (v <= 1.5) return "good";
  if (v <= 3) return "warning";
  return "danger";
}

function RevenuePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "revenue"],
    queryFn: fetchRevenueData,
  });
  const [drill, setDrill] = React.useState<Drill>(null);
  const [collectionView, setCollectionView] = React.useState<"payer" | "department" | "staff">("payer");

  if (isLoading || !data) return <RevenueSkeleton />;

  const totalPayerMix = data.payerMix.reduce((s, p) => s + p.amount, 0);
  const philhealthShare = (data.payerMix.find((p) => p.payer === "PhilHealth")?.amount ?? 0) / totalPayerMix * 100;
  const firstTrend = data.payerTrend[0];
  const lastTrend = data.payerTrend[data.payerTrend.length - 1];
  const philhealthStart = firstTrend
    ? (firstTrend.philhealth / (firstTrend.philhealth + firstTrend.hmo + firstTrend.privatePay + firstTrend.scpwd + firstTrend.gsis + firstTrend.writeoff)) * 100
    : philhealthShare;
  const philhealthEnd = lastTrend
    ? (lastTrend.philhealth / (lastTrend.philhealth + lastTrend.hmo + lastTrend.privatePay + lastTrend.scpwd + lastTrend.gsis + lastTrend.writeoff)) * 100
    : philhealthShare;

  const totalPhilhealthMembers = data.philhealthCoverage.reduce((s, c) => s + c.count, 0);
  const indigentSponsored =
    (data.philhealthCoverage.find((c) => c.category === "Indigent")?.count ?? 0) +
    (data.philhealthCoverage.find((c) => c.category === "Sponsored")?.count ?? 0);
  const indigentSponsoredPct = (indigentSponsored / totalPhilhealthMembers) * 100;

  const funnelMax = data.funnel[0]?.count ?? 1;

  const collectionSeries: { key: string; label: string; color: string }[] =
    collectionView === "payer"
      ? [
          { key: "philhealth", label: "PhilHealth", color: REV.philhealth },
          { key: "hmo", label: "HMO", color: REV.hmo },
          { key: "privatePay", label: "Private Pay", color: REV.privatePay },
          { key: "scpwd", label: "SC/PWD", color: REV.scpwd },
        ]
      : collectionView === "department"
        ? [
            { key: "emergency", label: "Emergency", color: PALETTE.danger },
            { key: "surgery", label: "Surgery", color: PALETTE.brand },
            { key: "internalMed", label: "Internal Medicine", color: PALETTE.philhealth },
          ]
        : [
            { key: "agentA", label: "Agent A - Reyes", color: PALETTE.brand },
            { key: "agentB", label: "Agent B - Cruz", color: PALETTE.success },
            { key: "agentC", label: "Agent C - Tan", color: PALETTE.warning },
          ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-brand">
            {data.tenant} · Revenue Cycle
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
            Revenue Cycle &amp; Billing
          </h1>
          <p className="text-sm text-text-muted">
            {data.period} · compared with {data.priorPeriod}
          </p>
        </div>
        <StatusBadge tone="neutral">Billing Manager / Administrator view</StatusBadge>
      </header>

      {/* SECTION A — Revenue Overview */}
      <section className="space-y-3">
        <SectionTitle title="Revenue overview" description="Month to date, drill any card for detail." />
        <KpiStrip>
          <MetricCard
            label="Gross Revenue (MTD)"
            value={php(data.kpis.grossRevenue.value, { compact: true })}
            delta={data.kpis.grossRevenue.delta}
            secondary={`Budget ${php(data.kpis.grossRevenue.budget, { compact: true })}`}
            status={data.kpis.grossRevenue.value >= data.kpis.grossRevenue.budget ? "good" : "warning"}
            icon={CircleDollarSign}
            onClick={() => setDrill({ kind: "kpi", id: "gross" })}
          />
          <MetricCard
            label="Net Revenue (after deductions)"
            value={php(data.kpis.netRevenue.value, { compact: true })}
            delta={data.kpis.netRevenue.delta}
            secondary="After PhilHealth benefit & mandatory discounts"
            status="neutral"
            icon={PiggyBank}
            onClick={() => setDrill({ kind: "kpi", id: "net" })}
          />
          <MetricCard
            label="Collection Rate"
            value={pct(data.kpis.collectionRate.value)}
            delta={data.kpis.collectionRate.delta}
            status={collectionStatus(data.kpis.collectionRate.value)}
            icon={Receipt}
            onClick={() => setDrill({ kind: "kpi", id: "collection" })}
          />
          <MetricCard
            label="Days in AR"
            value={`${data.kpis.daysInAR.value.toFixed(1)}d`}
            delta={data.kpis.daysInAR.delta}
            invertDelta
            secondary={`Benchmark < ${data.kpis.daysInAR.benchmark}d`}
            status={daysInArStatus(data.kpis.daysInAR.value)}
            icon={CalendarClock}
            onClick={() => setDrill({ kind: "kpi", id: "ar" })}
          />
          <MetricCard
            label="Write-off Rate"
            value={pct(data.kpis.writeOffRate.value)}
            delta={data.kpis.writeOffRate.delta}
            invertDelta
            status={writeOffStatus(data.kpis.writeOffRate.value)}
            icon={TrendingDown}
            onClick={() => setDrill({ kind: "kpi", id: "writeoff" })}
          />
        </KpiStrip>
      </section>

      <section>
        <PanelCard
          title="Gross-to-Net Revenue Bridge"
          description="Charges through mandatory deductions to patient collections · click a bar for itemized breakdown"
        >
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={data.waterfall} margin={{ left: -4, right: 16, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={0} angle={-12} textAnchor="end" height={70} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={60} tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(0)}M`} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(value: number, name: string) => {
                  if (name === "base") return [null, null];
                  return [php(Math.abs(value), { compact: true }), "Amount"];
                }}
              />
              <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
              <Bar
                dataKey="value"
                stackId="w"
                radius={[4, 4, 0, 0]}
                onClick={(entry) => setDrill({ kind: "waterfall", key: (entry as unknown as { key: string }).key })}
              >
                {data.waterfall.map((step) => (
                  <Cell
                    key={step.key}
                    fill={step.kind === "deduction" ? REV.deduction : step.kind === "end" ? REV.net : REV.brand}
                    className="cursor-pointer"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap gap-3">
            <LegendDot color={REV.brand} label="Gross charges" />
            <LegendDot color={REV.deduction} label="Deductions" />
            <LegendDot color={REV.net} label="Net collections" />
          </div>
        </PanelCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <PanelCard title="Payer Mix" description={`${data.period} · click a segment to drill down`}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="relative">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={data.payerMix}
                    dataKey="amount"
                    nameKey="payer"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {data.payerMix.map((slice) => (
                      <Cell key={slice.payer} fill={slice.color} />
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
                  {php(totalPayerMix, { compact: true })}
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-center gap-1.5">
              {data.payerMix.map((slice) => (
                <div key={slice.payer} className="flex items-center justify-between gap-2 rounded px-1 py-0.5">
                  <LegendDot color={slice.color} label={slice.payer} />
                  <span className="text-xs font-medium text-text-primary">
                    {php(slice.amount, { compact: true })}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 space-y-2 border-t border-border pt-3">
            <p className="text-xs text-text-muted">Payer mix trended over 6 months</p>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={data.payerTrend} margin={{ left: -18, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={60} tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(0)}M`} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number, n: string) => [php(v, { compact: true }), n]} />
                <Bar stackId="a" dataKey="philhealth" name="PhilHealth" fill={REV.philhealth} />
                <Bar stackId="a" dataKey="hmo" name="HMO" fill={REV.hmo} />
                <Bar stackId="a" dataKey="privatePay" name="Private" fill={REV.privatePay} />
                <Bar stackId="a" dataKey="scpwd" name="SC/PWD" fill={REV.scpwd} />
                <Bar stackId="a" dataKey="gsis" name="GSIS/Other" fill={REV.gsis} />
                <Bar stackId="a" dataKey="writeoff" name="Write-off" fill={REV.writeoff} />
              </BarChart>
            </ResponsiveContainer>
            <div className="rounded-md border border-brand/30 bg-brand/5 p-2 text-xs text-text-secondary">
              PhilHealth share increased from <span className="font-semibold text-brand">{pct(philhealthStart, 1)}</span> to{" "}
              <span className="font-semibold text-brand">{pct(philhealthEnd, 1)}</span> of collections this period.
            </div>
          </div>
        </PanelCard>

        <PanelCard
          title="Revenue by Department / Service Line"
          description="Sorted by total revenue · split by payer type · click a bar for detail"
        >
          <ResponsiveContainer width="100%" height={380}>
            <BarChart
              data={data.departmentRevenue}
              layout="vertical"
              margin={{ left: 8, right: 16 }}
              onClick={(state) => {
                const label = state?.activeLabel as string | undefined;
                if (label) setDrill({ kind: "department", name: label });
              }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(1)}M`} />
              <YAxis type="category" dataKey="department" width={112} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number, n: string) => [php(v, { compact: true }), n]} />
              <Bar stackId="d" dataKey="philhealth" name="PhilHealth" fill={REV.philhealth} className="cursor-pointer" />
              <Bar stackId="d" dataKey="hmo" name="HMO" fill={REV.hmo} className="cursor-pointer" />
              <Bar stackId="d" dataKey="privatePay" name="Private Pay" fill={REV.privatePay} className="cursor-pointer" />
              <Bar stackId="d" dataKey="scpwd" name="SC/PWD" fill={REV.scpwd} className="cursor-pointer" />
              <Bar stackId="d" dataKey="gsis" name="GSIS/Other" fill={REV.gsis} radius={[0, 4, 4, 0]} className="cursor-pointer" />
            </BarChart>
          </ResponsiveContainer>
        </PanelCard>
      </section>

      {/* SECTION B — Accounts Receivable */}
      <section className="space-y-3">
        <SectionTitle title="Accounts receivable" description="Aging exposure and collection performance." />
        <div className="grid gap-4 xl:grid-cols-2">
          <PanelCard title="AR Aging by Payer" description="Days outstanding buckets">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.arAging} margin={{ left: -12, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="payer" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => `${(v / 1_000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number, n: string) => [php(v, { compact: true }), n]} />
                <Bar dataKey="current" name="Current 0-30" fill={REV.current} radius={[3, 3, 0, 0]} />
                <Bar dataKey="d31" name="31-60" fill={REV.b31} radius={[3, 3, 0, 0]} />
                <Bar dataKey="d61" name="61-90" fill={REV.b61} radius={[3, 3, 0, 0]} />
                <Bar dataKey="d90" name=">90" fill={REV.b90} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap gap-3">
              <LegendDot color={REV.current} label="Current 0-30" />
              <LegendDot color={REV.b31} label="31-60" />
              <LegendDot color={REV.b61} label="61-90" />
              <LegendDot color={REV.b90} label=">90 days" />
            </div>
            <div className="mt-3 border-t border-border pt-3">
              <p className="mb-1 text-xs font-medium text-text-secondary">
                Patient-level detail — accounts &gt;90 days
              </p>
              <div className="max-h-56 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Patient</TableHead>
                      <TableHead className="text-xs">Payer</TableHead>
                      <TableHead className="text-right text-xs">Days</TableHead>
                      <TableHead className="text-right text-xs">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.arOver90.slice(0, 8).map((r) => (
                      <TableRow key={r.patientId}>
                        <TableCell className="text-xs">{r.patient}</TableCell>
                        <TableCell className="text-xs">{r.payer}</TableCell>
                        <TableCell className="text-right text-xs">{r.daysOutstanding}d</TableCell>
                        <TableCell className="text-right text-xs">{php(r.amount, { compact: true })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </PanelCard>

          <PanelCard
            title="Collection Trend"
            description="Actual collections vs monthly target"
            action={
              <Tabs value={collectionView} onValueChange={(v) => setCollectionView(v as typeof collectionView)}>
                <TabsList className="h-7">
                  <TabsTrigger value="payer" className="text-xs">By payer</TabsTrigger>
                  <TabsTrigger value="department" className="text-xs">By dept</TabsTrigger>
                  <TabsTrigger value="staff" className="text-xs">By staff</TabsTrigger>
                </TabsList>
              </Tabs>
            }
          >
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.collectionTrend} margin={{ left: -12, right: 12, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(1)}M`} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number, n: string) => [php(v, { compact: true }), n]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={data.collectionTrend[0]?.target ?? 0} stroke={PALETTE.neutral} strokeDasharray="4 4" label={{ value: "Target", fontSize: 10, fill: "#8A8F98" }} />
                {collectionSeries.map((s) => (
                  <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </PanelCard>
        </div>

        <PanelCard
          title="Unbilled Encounters Funnel"
          description="Discharged → Bill Generated → Claim Submitted → Paid · click a stage for stuck encounters"
        >
          <div className="space-y-2">
            {data.funnel.map((stage, i) => {
              const prev = data.funnel[i - 1];
              const dropOff = prev ? ((prev.count - stage.count) / prev.count) * 100 : 0;
              const widthPct = Math.max(12, (stage.count / funnelMax) * 100);
              return (
                <button
                  key={stage.stage}
                  onClick={() => setDrill({ kind: "funnel", stage: stage.stage })}
                  className="flex w-full items-center gap-3 rounded-md p-1 text-left hover:bg-muted"
                >
                  <div className="w-32 shrink-0 text-xs font-medium text-text-secondary">{stage.stage}</div>
                  <div className="flex-1">
                    <div
                      className="flex h-9 items-center justify-end rounded-md px-3 text-xs font-semibold text-white"
                      style={{ width: `${widthPct}%`, backgroundColor: brandRamp(4)[i] ?? PALETTE.brand }}
                    >
                      {num(stage.count)}
                    </div>
                  </div>
                  {i > 0 ? (
                    <div className={cn("w-20 shrink-0 text-right text-xs font-medium", dropOff > 12 ? "text-danger" : "text-text-muted")}>
                      -{dropOff.toFixed(1)}%
                    </div>
                  ) : (
                    <div className="w-20 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </PanelCard>
      </section>

      {/* SECTION C — Patient Financial Profile */}
      <section className="space-y-3">
        <SectionTitle title="Patient financial profile" description="Coverage distribution and mandatory-discount impact." />
        <div className="grid gap-4 xl:grid-cols-2">
          <PanelCard title="PhilHealth Coverage Distribution" description="Membership category of billed patients">
            <div className="grid gap-4 md:grid-cols-2">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={data.philhealthCoverage}
                    dataKey="count"
                    nameKey="category"
                    innerRadius={0}
                    outerRadius={90}
                    paddingAngle={1}
                  >
                    {data.philhealthCoverage.map((slice) => (
                      <Cell key={slice.category} fill={slice.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number, n: string) => [`${num(v)} patients`, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col justify-center gap-1.5">
                {data.philhealthCoverage.map((slice) => (
                  <LegendDot key={slice.category} color={slice.color} label={`${slice.category} (${num(slice.count)})`} />
                ))}
              </div>
            </div>
            <div className="mt-2 rounded-md border border-brand/30 bg-brand/5 p-2 text-xs text-text-secondary">
              <span className="font-semibold text-brand">{pct(indigentSponsoredPct, 1)}</span> of covered patients are
              Indigent or Sponsored members — prioritize social welfare referrals and financial counseling for this
              segment to protect collection rates.
            </div>
          </PanelCard>

          <PanelCard title="SC/PWD Volume &amp; Discount Impact" description="Monthly patient count vs total mandatory discount">
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={data.scPwdTrend} margin={{ left: -12, right: 12, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(1)}M`} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v: number, n: string) => [n === "Discount amount" ? php(v, { compact: true }) : num(v), n]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="patients" name="SC/PWD patients" fill={REV.scpwd} radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="discountAmount" name="Discount amount" stroke={PALETTE.brand} strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </PanelCard>
        </div>
      </section>

      <RevenueDrawer data={data} drill={drill} onClose={() => setDrill(null)} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function RevenueDrawer({
  data,
  drill,
  onClose,
}: {
  data: RevenueData;
  drill: Drill;
  onClose: () => void;
}) {
  const open = drill !== null;
  let title = "";
  let description = "";
  let body: React.ReactNode = null;

  if (drill?.kind === "kpi") {
    switch (drill.id) {
      case "gross":
        title = "Gross Revenue (MTD)";
        description = `${php(data.kpis.grossRevenue.value)} vs budget ${php(data.kpis.grossRevenue.budget)}`;
        body = (
          <div className="space-y-1">
            {data.departmentRevenue.map((d) => (
              <StatRow key={d.department} label={d.department} value={php(d.total, { compact: true })} />
            ))}
          </div>
        );
        break;
      case "net":
        title = "Net Revenue (after deductions)";
        description = php(data.kpis.netRevenue.value);
        body = (
          <div className="space-y-1">
            {data.waterfall
              .filter((w) => w.kind === "deduction")
              .map((w) => (
                <StatRow key={w.key} label={w.label} value={php(w.value, { compact: true })} />
              ))}
          </div>
        );
        break;
      case "collection":
        title = "Collection Rate";
        description = `${pct(data.kpis.collectionRate.value)} of billed amount collected`;
        body = (
          <div className="space-y-1">
            {data.arAging.map((r) => (
              <StatRow
                key={r.payer}
                label={r.payer}
                value={pct((r.current / (r.current + r.d31 + r.d61 + r.d90)) * 100, 1)}
              />
            ))}
          </div>
        );
        break;
      case "ar":
        title = "Days in Accounts Receivable";
        description = `${data.kpis.daysInAR.value.toFixed(1)} days · benchmark < ${data.kpis.daysInAR.benchmark} days`;
        body = (
          <div className="space-y-1">
            {data.arAging.map((r) => (
              <StatRow key={r.payer} label={r.payer} value={php(r.current + r.d31 + r.d61 + r.d90, { compact: true })} />
            ))}
          </div>
        );
        break;
      case "writeoff":
        title = "Write-off Rate";
        description = `${pct(data.kpis.writeOffRate.value)} of gross charges`;
        body = (
          <StatRow
            label="Write-offs"
            value={php(data.payerMix.find((p) => p.payer === "Write-offs")?.amount ?? 0, { compact: true })}
          />
        );
        break;
    }
  } else if (drill?.kind === "waterfall") {
    const step = data.waterfall.find((w) => w.key === drill.key);
    title = step?.label ?? "";
    description = step ? php(Math.abs(step.value), { compact: true }) : "";
    body = step ? (
      <div className="space-y-1">
        {step.detail.map((d) => (
          <StatRow key={d.item} label={d.item} value={php(d.amount, { compact: true })} />
        ))}
      </div>
    ) : null;
  } else if (drill?.kind === "department") {
    const dept = data.departmentRevenue.find((d) => d.department === drill.name);
    title = dept?.department ?? "";
    description = dept ? `Total revenue ${php(dept.total, { compact: true })}` : "";
    body = dept ? (
      <div className="space-y-5">
        <div>
          <p className="mb-1 text-xs font-medium text-text-secondary">Top procedures by revenue</p>
          {dept.topProcedures.map((p) => (
            <StatRow key={p.name} label={p.name} value={php(p.amount, { compact: true })} />
          ))}
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-text-secondary">Top diagnoses by revenue</p>
          {dept.topDiagnoses.map((d) => (
            <StatRow key={d.name} label={d.name} value={php(d.amount, { compact: true })} />
          ))}
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-text-secondary">By payer</p>
          <StatRow label="PhilHealth" value={php(dept.philhealth, { compact: true })} />
          <StatRow label="HMO" value={php(dept.hmo, { compact: true })} />
          <StatRow label="Private Pay" value={php(dept.privatePay, { compact: true })} />
          <StatRow label="SC/PWD" value={php(dept.scpwd, { compact: true })} />
          <StatRow label="GSIS/Other" value={php(dept.gsis, { compact: true })} />
        </div>
      </div>
    ) : null;
  } else if (drill?.kind === "funnel") {
    const stage = data.funnel.find((s) => s.stage === drill.stage);
    title = `Stuck at: ${drill.stage}`;
    description = stage ? `${num(stage.count)} encounters currently at this stage` : "";
    body = stage ? (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Encounter</TableHead>
            <TableHead className="text-xs">Patient</TableHead>
            <TableHead className="text-right text-xs">Amount</TableHead>
            <TableHead className="text-right text-xs">Days stuck</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stage.encounters.map((e) => (
            <TableRow key={e.encounterId}>
              <TableCell className="text-xs">{e.encounterId}</TableCell>
              <TableCell className="text-xs">{e.patient}</TableCell>
              <TableCell className="text-right text-xs">{php(e.amount, { compact: true })}</TableCell>
              <TableCell className="text-right text-xs">{e.daysStuck}d</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    ) : null;
  }

  return (
    <DrillDrawer open={open} onOpenChange={(v) => (v ? null : onClose())} title={title} description={description}>
      {body}
    </DrillDrawer>
  );
}

function RevenueSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 w-80" />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-80 w-full rounded-lg" />
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-96 w-full rounded-lg" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-80 w-full rounded-lg" />
        <Skeleton className="h-80 w-full rounded-lg" />
      </div>
    </div>
  );
}
