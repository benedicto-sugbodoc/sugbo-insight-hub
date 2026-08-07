import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  Scatter,
  ScatterChart,
  ResponsiveContainer,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Banknote, ClipboardCheck, ClipboardX, FileWarning, Hourglass, Timer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
  num,
  pct,
  php,
} from "@/components/analytics/shared";
import {
  fetchClaimsData,
  type ClaimsData,
  type WorklistClaim,
} from "@/lib/analytics/claims.mock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/analytics/claims")({
  head: () => ({
    meta: [
      { title: "PhilHealth Claims Analytics — SugboDoc" },
      {
        name: "description",
        content:
          "PhilHealth claims submission pipeline, denial trends, case rate coverage and physician claims performance analytics.",
      },
      { property: "og:title", content: "PhilHealth Claims Analytics — SugboDoc" },
      {
        property: "og:description",
        content: "Claims submission funnel, denial reasons, case rate coverage and physician performance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClaimsPage,
});

type Drill =
  | { kind: "kpi"; id: string }
  | { kind: "stage"; stage: string }
  | { kind: "denial"; code: string }
  | { kind: "caseType"; name: string }
  | { kind: "physician"; name: string }
  | null;

function denialRateStatus(v: number): MetricStatus {
  if (v > 10) return "danger";
  if (v < 5) return "good";
  return "warning";
}

function ClaimsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["analytics", "claims"], queryFn: fetchClaimsData });
  const [drill, setDrill] = React.useState<Drill>(null);

  if (isLoading || !data) return <ClaimsSkeleton />;

  const denialTotal = data.denialReasons.reduce((s, d) => s + d.count, 0);
  const maxTreemapValue = Math.max(...data.caseTypeTreemap.map((c) => c.avgValue));
  const maxCoverage = Math.max(...data.coverageDiagnoses.map((d) => Math.max(d.actualCost, d.caseRateTarget)));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-brand">{data.tenant} · Claims Cycle</p>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
            PhilHealth Claims Analytics
          </h1>
          <p className="text-sm text-text-muted">
            {data.period} · compared with {data.priorPeriod}
          </p>
        </div>
        <StatusBadge tone="neutral">Claims Officer / Billing Manager view</StatusBadge>
      </header>

      {/* SECTION A — Claims Submission Performance */}
      <section className="space-y-3">
        <SectionTitle
          title="Claims submission performance"
          description="Submission cycle KPIs, month to date. Drill any card for detail."
        />
        <KpiStrip>
          <MetricCard
            label="Claims Submitted (MTD)"
            value={num(data.kpis.submittedMtd.count)}
            delta={data.kpis.submittedMtd.delta}
            secondary={php(data.kpis.submittedMtd.amount, { compact: true })}
            icon={ClipboardCheck}
            status="neutral"
            onClick={() => setDrill({ kind: "kpi", id: "submitted" })}
          />
          <MetricCard
            label="Claims Pending RTN"
            value={num(data.kpis.pendingRtn.count)}
            delta={data.kpis.pendingRtn.delta}
            invertDelta
            secondary={`Oldest pending ${data.kpis.pendingRtn.oldestDays} days`}
            icon={Hourglass}
            status={data.kpis.pendingRtn.oldestDays > 45 ? "danger" : "warning"}
            onClick={() => setDrill({ kind: "kpi", id: "pendingRtn" })}
          />
          <MetricCard
            label="Claims Approved"
            value={num(data.kpis.approved.count)}
            delta={data.kpis.approved.delta}
            secondary={`${php(data.kpis.approved.amount, { compact: true })} · ${pct(data.kpis.approved.rate)} approval rate`}
            icon={ClipboardCheck}
            status="good"
            onClick={() => setDrill({ kind: "kpi", id: "approved" })}
          />
          <MetricCard
            label="Claims Denied"
            value={num(data.kpis.denied.count)}
            delta={data.kpis.denied.delta}
            invertDelta
            secondary={`${php(data.kpis.denied.amount, { compact: true })} · ${pct(data.kpis.denied.rate)} denial rate`}
            icon={ClipboardX}
            status={denialRateStatus(data.kpis.denied.rate)}
            onClick={() => setDrill({ kind: "kpi", id: "denied" })}
          />
          <MetricCard
            label="Average Days to RTN"
            value={`${data.kpis.avgDaysToRtn.value} days`}
            delta={data.kpis.avgDaysToRtn.delta}
            invertDelta
            secondary={`Target < ${data.kpis.avgDaysToRtn.target} days`}
            icon={Timer}
            status={data.kpis.avgDaysToRtn.value < data.kpis.avgDaysToRtn.target ? "good" : "warning"}
            onClick={() => setDrill({ kind: "kpi", id: "avgDays" })}
          />
          <MetricCard
            label="Expected Remittance (this month)"
            value={php(data.kpis.expectedRemittance.amount, { compact: true })}
            delta={data.kpis.expectedRemittance.delta}
            icon={Banknote}
            status="neutral"
            onClick={() => setDrill({ kind: "kpi", id: "expected" })}
          />
        </KpiStrip>
      </section>

      {/* Chart 20 — pipeline funnel */}
      <section className="space-y-3">
        <SectionTitle title="Claims pipeline" description="Click a stage to open its worklist." />
        <PanelCard title="Drafted → Remittance funnel" description="Claim count, value, and drop-off between stages">
          <div className="space-y-2">
            {data.pipeline.map((s, i) => {
              const prev = data.pipeline[i - 1];
              const dropoff = prev ? prev.count - s.count : 0;
              const width = (s.count / (data.pipeline[0]?.count ?? 1)) * 100;
              return (
                <button
                  key={s.stage}
                  onClick={() => setDrill({ kind: "stage", stage: s.stage })}
                  className="block w-full text-left"
                >
                  <div className="mb-0.5 flex items-center justify-between text-xs">
                    <span className="font-medium text-text-primary">{s.stage}</span>
                    <span className="text-text-secondary">
                      {num(s.count)} claims · {php(s.value, { compact: true })}
                      {i > 0 ? <span className="ml-2 text-danger">−{num(dropoff)}</span> : null}
                    </span>
                  </div>
                  <div className="h-6 w-full rounded-md bg-muted">
                    <div
                      className="h-6 rounded-md transition-all hover:opacity-80"
                      style={{ width: `${width}%`, backgroundColor: PALETTE.brand, opacity: 0.4 + (i / data.pipeline.length) * 0.6 }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </PanelCard>
      </section>

      {/* Chart 21 + 22 */}
      <section className="grid gap-4 xl:grid-cols-2">
        <PanelCard
          title="Denial rate trend"
          description="12-month overall vs case type · PhilHealth benchmark 5%"
        >
          <div className="mb-2 flex flex-wrap gap-3">
            <LegendDot color={PALETTE.brand} label="Overall" />
            <LegendDot color={PALETTE.philhealth} label="Ordinary" />
            <LegendDot color={PALETTE.danger} label="Catastrophic" />
            <LegendDot color={PALETTE.hmo} label="Z-Benefit" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.denialTrend} margin={{ left: -12, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} unit="%" />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v: number, n: string) => [pct(v), n]}
                labelFormatter={(label, payload) => {
                  const p = payload?.[0]?.payload as { policyChange?: string } | undefined;
                  return p?.policyChange ? `${label} — ${p.policyChange}` : label;
                }}
              />
              <ReferenceLine y={5} stroke={PALETTE.gold} strokeDasharray="4 4" label={{ value: "5% benchmark", fontSize: 10, position: "insideTopRight" }} />
              {data.denialTrend.map((pt) =>
                pt.policyChange ? (
                  <ReferenceLine key={pt.month} x={pt.month} stroke={PALETTE.neutral} strokeDasharray="2 2" />
                ) : null,
              )}
              <Line type="monotone" dataKey="overall" name="Overall" stroke={PALETTE.brand} strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="ordinary" name="Ordinary" stroke={PALETTE.philhealth} strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="catastrophic" name="Catastrophic" stroke={PALETTE.danger} strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="zBenefit" name="Z-Benefit" stroke={PALETTE.hmo} strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-2 text-[11px] text-text-muted">
            Dashed vertical markers indicate months with major PhilHealth policy changes.
          </p>
        </PanelCard>

        <PanelCard title="Top 10 denial reasons" description="By frequency · click a bar for denied claims">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.denialReasons} layout="vertical" margin={{ left: 10, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="code" width={64} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v: number, _n, item) => {
                  const p = item?.payload as DenialReasonRowLike | undefined;
                  return [`${num(v)} (${pct(p?.pctOfTotal ?? 0)}) · ${php(p?.valueAtRisk ?? 0, { compact: true })}`, p?.reason ?? ""];
                }}
              />
              <Bar
                dataKey="count"
                radius={[0, 4, 4, 0]}
                onClick={(entry) => setDrill({ kind: "denial", code: (entry as unknown as { code: string }).code })}
              >
                {data.denialReasons.map((r) => (
                  <Cell
                    key={r.code}
                    fill={r.trend === "worse" ? PALETTE.danger : r.trend === "better" ? PALETTE.success : PALETTE.brand}
                    className="cursor-pointer"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </PanelCard>
      </section>

      <section className="space-y-3">
        <PanelCard title="Denial reasons detail" description="Recommended actions and appeal routing">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Code</TableHead>
                <TableHead className="text-xs">Description</TableHead>
                <TableHead className="text-right text-xs">Count</TableHead>
                <TableHead className="text-right text-xs">% of denials</TableHead>
                <TableHead className="text-right text-xs">PHP at risk</TableHead>
                <TableHead className="text-xs">Trend</TableHead>
                <TableHead className="text-xs">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.denialReasons.map((r) => (
                <TableRow key={r.code}>
                  <TableCell className="text-xs font-medium">{r.code}</TableCell>
                  <TableCell className="text-xs">
                    <div className="font-medium text-text-primary">{r.reason}</div>
                    <div className="text-text-muted">{r.description}</div>
                  </TableCell>
                  <TableCell className="text-right text-xs">{r.count}</TableCell>
                  <TableCell className="text-right text-xs">{pct(r.pctOfTotal)}</TableCell>
                  <TableCell className="text-right text-xs">{php(r.valueAtRisk, { compact: true })}</TableCell>
                  <TableCell className="text-xs">
                    <StatusBadge tone={r.trend === "worse" ? "danger" : r.trend === "better" ? "good" : "neutral"}>
                      {r.trend}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-xs">
                    <Button size="sm" variant="outline" onClick={() => setDrill({ kind: "denial", code: r.code })}>
                      RTH / CAB Appeal
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </PanelCard>
      </section>

      {/* Chart 23 + 24 */}
      <section className="grid gap-4 xl:grid-cols-2">
        <PanelCard title="Claim value by case type" description="Size = claim count · color intensity = avg claim value">
          <ResponsiveContainer width="100%" height={320}>
            <Treemap
              data={data.caseTypeTreemap}
              dataKey="size"
              nameKey="name"
              stroke="#fff"
              onClick={(entry) => setDrill({ kind: "caseType", name: (entry as unknown as { name: string }).name })}
              content={React.createElement(TreemapCell, { maxValue: maxTreemapValue })}
            >
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v: number, _n, item) => {
                  const p = item?.payload as { avgValue: number } | undefined;
                  return [`${num(v)} claims · avg ${php(p?.avgValue ?? 0, { compact: true })}`, "Volume"];
                }}
              />
            </Treemap>
          </ResponsiveContainer>
        </PanelCard>

        <PanelCard
          title="Physician claims performance"
          description="Admin and Claims Officer only"
          action={<StatusBadge tone="warning">Restricted</StatusBadge>}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Physician</TableHead>
                <TableHead className="text-right text-xs">Submitted</TableHead>
                <TableHead className="text-right text-xs">Approval</TableHead>
                <TableHead className="text-right text-xs">Denial</TableHead>
                <TableHead className="text-xs">Common denial reason</TableHead>
                <TableHead className="text-right text-xs">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.physicians.map((p) => (
                <TableRow
                  key={p.physician}
                  className="cursor-pointer"
                  onClick={() => setDrill({ kind: "physician", name: p.physician })}
                >
                  <TableCell className="text-xs font-medium">{p.physician}</TableCell>
                  <TableCell className="text-right text-xs">{p.submitted}</TableCell>
                  <TableCell className="text-right text-xs">{pct(p.approvalRate)}</TableCell>
                  <TableCell
                    className={cn(
                      "text-right text-xs font-medium",
                      p.denialRate > 10 ? "bg-danger/15 text-danger" : p.denialRate < 5 ? "bg-success/15 text-success" : "text-warning",
                    )}
                  >
                    {pct(p.denialRate)}
                  </TableCell>
                  <TableCell className="text-xs text-text-muted">{p.commonDenialReason}</TableCell>
                  <TableCell className="text-right text-xs">{php(p.revenue, { compact: true })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </PanelCard>
      </section>

      {/* SECTION B — Case Rate Analysis */}
      <section className="space-y-3">
        <SectionTitle
          title="Case rate analysis"
          description="PhilHealth case rate coverage relative to actual charges."
        />
        <div className="grid gap-4 xl:grid-cols-2">
          <PanelCard
            title="Case rate vs actual gross charges"
            description="Diagonal = break-even · points above line indicate cost overrun"
          >
            <ResponsiveContainer width="100%" height={340}>
              <ScatterChart margin={{ left: 10, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  type="number"
                  dataKey="caseRate"
                  name="Case rate"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`}
                  label={{ value: "PhilHealth case rate (PHP)", fontSize: 11, position: "insideBottom", offset: -4 }}
                />
                <YAxis
                  type="number"
                  dataKey="actualCharge"
                  name="Actual charge"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`}
                  width={48}
                  label={{ value: "Actual gross charge (PHP)", fontSize: 11, angle: -90, position: "insideLeft" }}
                />
                <ZAxis type="number" dataKey="patientCount" range={[60, 400]} name="Patients" />
                <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 70000, y: 70000 }]} stroke={PALETTE.neutral} strokeDasharray="4 4" />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v: number, n: string) => [n === "Patients" ? num(v) : php(v, { compact: true }), n]}
                  labelFormatter={() => ""}
                  content={<ScatterTooltip />}
                />
                <Scatter data={data.caseRateScatter} fill={PALETTE.brand}>
                  {data.caseRateScatter.map((p, i) => (
                    <Cell key={i} fill={p.color} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            <p className="mt-2 rounded-md bg-warning/10 p-2 text-[11px] text-warning">
              Diagnoses above the break-even line (e.g. AMI I21.9, ESRD N18.6) show actual charges exceeding the
              PhilHealth case rate — flag for costing review.
            </p>
          </PanelCard>

          <PanelCard
            title="Case rate coverage ratio — top 20 diagnoses"
            description="Actual cost vs case rate target · sorted by worst coverage gap"
            contentClassName="max-h-[380px] overflow-y-auto"
          >
            <div className="space-y-3">
              {data.coverageDiagnoses.map((d) => (
                <BulletRow
                  key={d.code}
                  label={`${d.code} · ${d.description}`}
                  value={d.actualCost}
                  target={d.caseRateTarget}
                  max={maxCoverage}
                  suffix=""
                  good={d.actualCost <= d.caseRateTarget}
                />
              ))}
            </div>
          </PanelCard>
        </div>
      </section>

      <ClaimsDrawer data={data} drill={drill} onClose={() => setDrill(null)} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface DenialReasonRowLike {
  reason: string;
  pctOfTotal: number;
  valueAtRisk: number;
}

function TreemapCell(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  size?: number;
  avgValue?: number;
  maxValue: number;
}) {
  const p = { x: 0, y: 0, width: 0, height: 0, ...props };
  if (p.width <= 0 || p.height <= 0) return null;
  const intensity = Math.min(1, (p.avgValue ?? 0) / (p.maxValue || 1));
  const from = [174, 182, 235];
  const to = [46, 58, 150];
  const rgb = from.map((c, i) => Math.round(c + ((to[i] ?? c) - c) * intensity));
  const fill = `rgb(${rgb.join(",")})`;
  return (
    <g>
      <rect x={p.x} y={p.y} width={p.width} height={p.height} style={{ fill, stroke: "#fff", cursor: "pointer" }} />
      {p.width > 60 && p.height > 30 ? (
        <text x={p.x + 8} y={p.y + 18} fontSize={11} fill="#fff" fontWeight={600}>
          {p.name}
        </text>
      ) : null}
      {p.width > 60 && p.height > 44 ? (
        <text x={p.x + 8} y={p.y + 34} fontSize={10} fill="#fff">
          {num(p.size ?? 0)} claims
        </text>
      ) : null}
    </g>
  );
}

function ScatterTooltip(props: unknown) {
  const p = props as { active?: boolean; payload?: { payload: import("@/lib/analytics/claims.mock").CaseRateScatterPoint }[] };
  if (!p.active || !p.payload?.length) return null;
  const d = p.payload[0]?.payload;
  if (!d) return null;
  const margin = d.actualCharge - d.caseRate;
  return (
    <div className="rounded-lg border border-border bg-card p-2 text-xs shadow-md">
      <div className="font-medium text-text-primary">{d.icd10} · {d.description}</div>
      <div className="text-text-muted">{d.caseType}</div>
      <div className="mt-1 space-y-0.5">
        <div>Avg case rate: {php(d.caseRate, { compact: true })}</div>
        <div>Avg actual charge: {php(d.actualCharge, { compact: true })}</div>
        <div className={margin > 0 ? "text-danger" : "text-success"}>
          Margin: {margin > 0 ? "-" : "+"}{php(Math.abs(margin), { compact: true })}
        </div>
        <div>Patients: {num(d.patientCount)}</div>
      </div>
    </div>
  );
}

function ClaimsDrawer({ data, drill, onClose }: { data: ClaimsData; drill: Drill; onClose: () => void }) {
  const open = drill !== null;
  let title = "";
  let description = "";
  let body: React.ReactNode = null;

  if (drill?.kind === "kpi") {
    switch (drill.id) {
      case "submitted":
        title = "Claims Submitted (MTD)";
        description = `${num(data.kpis.submittedMtd.count)} claims · ${php(data.kpis.submittedMtd.amount, { compact: true })}`;
        body = <WorklistTable rows={data.pipelineWorklists["Submitted"] ?? []} />;
        break;
      case "pendingRtn":
        title = "Claims Pending RTN";
        description = `${num(data.kpis.pendingRtn.count)} claims · oldest ${data.kpis.pendingRtn.oldestDays} days`;
        body = <WorklistTable rows={data.pipelineWorklists["RTN Received"] ?? []} />;
        break;
      case "approved":
        title = "Claims Approved";
        description = `${num(data.kpis.approved.count)} claims · ${php(data.kpis.approved.amount, { compact: true })} · ${pct(data.kpis.approved.rate)} approval rate`;
        body = <WorklistTable rows={data.pipelineWorklists["Approved"] ?? []} />;
        break;
      case "denied":
        title = "Claims Denied";
        description = `${num(data.kpis.denied.count)} claims · ${php(data.kpis.denied.amount, { compact: true })} · ${pct(data.kpis.denied.rate)} denial rate`;
        body = (
          <div className="space-y-1">
            {data.denialReasons.map((r) => (
              <StatRow key={r.code} label={`${r.code} · ${r.reason}`} value={`${r.count} claims`} />
            ))}
          </div>
        );
        break;
      case "avgDays":
        title = "Average Days to RTN";
        description = `${data.kpis.avgDaysToRtn.value} days · target under ${data.kpis.avgDaysToRtn.target} days`;
        body = <WorklistTable rows={data.pipelineWorklists["Validated"] ?? []} />;
        break;
      case "expected":
        title = "Expected Remittance this Month";
        description = php(data.kpis.expectedRemittance.amount);
        body = <WorklistTable rows={data.pipelineWorklists["Remittance Received"] ?? []} />;
        break;
    }
  } else if (drill?.kind === "stage") {
    const stage = data.pipeline.find((s) => s.stage === drill.stage);
    title = `${drill.stage} claims`;
    description = stage ? `${num(stage.count)} claims · ${php(stage.value, { compact: true })}` : "";
    body = <WorklistTable rows={data.pipelineWorklists[drill.stage] ?? []} />;
  } else if (drill?.kind === "denial") {
    const r = data.denialReasons.find((x) => x.code === drill.code);
    title = `${r?.code} · ${r?.reason}`;
    description = `${r?.count} claims · ${php(r?.valueAtRisk ?? 0, { compact: true })} at risk`;
    body = (
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">{r?.description}</p>
        <StatRow label="Recommended action" value={r?.action ?? ""} />
        <StatRow label="Trend vs prior period" value={r?.trend ?? ""} />
        <Button className="w-full justify-between bg-brand text-brand-foreground hover:bg-brand/90">
          File RTH / CAB Appeal
          <ArrowRight className="size-4" />
        </Button>
        <WorklistTable rows={data.pipelineWorklists["RTN Received"]?.slice(0, 8) ?? []} />
      </div>
    );
  } else if (drill?.kind === "caseType") {
    const detail = data.caseTypeDetail[drill.name];
    const t = data.caseTypeTreemap.find((c) => c.name === drill.name);
    title = `${drill.name} claims`;
    description = t ? `${num(t.size)} claims · avg value ${php(t.avgValue, { compact: true })}` : "";
    body = detail ? (
      <div className="space-y-4">
        <StatRow label="Average case rate" value={php(detail.avgCaseRate, { compact: true })} />
        <StatRow label="Approval rate" value={pct(detail.approvalRate)} />
        <div>
          <p className="mb-1 text-xs font-medium text-text-secondary">Top diagnoses</p>
          {detail.topDiagnoses.map((d) => (
            <StatRow key={d.code} label={`${d.code} · ${d.description}`} value={`${d.count} claims`} />
          ))}
        </div>
      </div>
    ) : (
      <p className="text-sm text-text-muted">No diagnoses recorded for this case type in the sample.</p>
    );
  } else if (drill?.kind === "physician") {
    const p = data.physicians.find((x) => x.physician === drill.name);
    title = drill.name;
    description = "Admin and Claims Officer only";
    body = p ? (
      <div className="space-y-3">
        <StatRow label="Claims submitted" value={num(p.submitted)} />
        <StatRow label="Approval rate" value={pct(p.approvalRate)} />
        <StatRow label="Denial rate" value={pct(p.denialRate)} />
        <StatRow label="Most common denial reason" value={p.commonDenialReason} />
        <StatRow label="Revenue generated" value={php(p.revenue, { compact: true })} />
      </div>
    ) : null;
  }

  return (
    <DrillDrawer open={open} onOpenChange={(v) => (v ? null : onClose())} title={title} description={description}>
      {body}
    </DrillDrawer>
  );
}

function WorklistTable({ rows }: { rows: WorklistClaim[] }) {
  if (!rows.length) return <p className="text-sm text-text-muted">No claims in this worklist.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">Claim</TableHead>
          <TableHead className="text-xs">Patient</TableHead>
          <TableHead className="text-xs">Case type</TableHead>
          <TableHead className="text-right text-xs">Amount</TableHead>
          <TableHead className="text-right text-xs">Days in stage</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.claimId}>
            <TableCell className="text-xs font-medium">{r.claimId}</TableCell>
            <TableCell className="text-xs">
              <div>{r.patient}</div>
              <div className="text-text-muted">{r.icd10}</div>
            </TableCell>
            <TableCell className="text-xs">{r.caseType}</TableCell>
            <TableCell className="text-right text-xs">{php(r.amount, { compact: true })}</TableCell>
            <TableCell className="text-right text-xs">{r.daysInStage}d</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ClaimsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 w-80" />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-80 w-full rounded-lg" />
        <Skeleton className="h-80 w-full rounded-lg" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-80 w-full rounded-lg" />
        <Skeleton className="h-80 w-full rounded-lg" />
      </div>
    </div>
  );
}
