import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
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
  DrillDrawer,
  LegendDot,
  PALETTE,
  PanelCard,
  SectionTitle,
  StatRow,
  StatusBadge,
  num,
  pct,
} from "@/components/analytics/shared";
import { BarangayChoropleth, BarangayDatum, StageFlow } from "@/components/analytics/lgu-shared";
import { DrTbCase, fetchTbData, TbData } from "@/lib/analytics/lgu/tb.mock";

export const Route = createFileRoute("/lgu/analytics/tb")({
  head: () => ({
    meta: [
      { title: "TB-DOTS Program — SugboDoc LGU Analytics" },
      {
        name: "description",
        content:
          "TB case detection rate, treatment cascade, treatment outcomes and drug-resistant TB tracker.",
      },
    ],
  }),
  component: TbPage,
});

type Drill =
  | { kind: "cascade"; id: string }
  | { kind: "outcome"; outcome: string }
  | { kind: "drtb"; id: string }
  | null;

const statusTone: Record<DrTbCase["status"], "good" | "warning" | "danger"> = {
  "On track": "good",
  Delayed: "warning",
  Interrupted: "danger",
};

function TbPage() {
  const { data, isLoading } = useQuery({ queryKey: ["lgu-analytics", "tb"], queryFn: fetchTbData });
  const [drill, setDrill] = React.useState<Drill>(null);

  if (isLoading || !data) return <TbSkeleton />;

  const totalOutcomes = data.outcomes.reduce((s, o) => s + o.count, 0);
  const successCount = data.outcomes
    .filter((o) => o.outcome === "Cured" || o.outcome === "Treatment Completed")
    .reduce((s, o) => s + o.count, 0);
  const successRate = (successCount / totalOutcomes) * 100;

  const maxDrTb = Math.max(...data.drTbByBarangay.map((b) => b.count), 1);
  const drTbChoropleth: BarangayDatum[] = data.drTbByBarangay.map((b) => ({
    id: b.id,
    name: b.name,
    value: b.count,
    display: `${b.count}`,
    alert: b.count >= 3,
  }));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-brand">
            {data.tenant} · TB Coordinator / MHO
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
            TB-DOTS Program
          </h1>
          <p className="text-sm text-text-muted">{data.period}</p>
        </div>
        <StatusBadge tone={successRate >= data.whoTargetSuccess ? "good" : "warning"}>
          {pct(successRate, 1)} treatment success · WHO target {data.whoTargetSuccess}%
        </StatusBadge>
      </header>

      <section className="space-y-3">
        <SectionTitle
          title="TB Case Detection Rate"
          description="Notified cases per 100,000 population · bacteriologically confirmed vs clinically diagnosed · 24-month trend"
        />
        <PanelCard title="Case Detection Rate" description="">
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={data.trend} margin={{ left: -12, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                interval={1}
              />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <ReferenceLine
                yAxisId="right"
                y={data.nationalTarget}
                stroke={PALETTE.warning}
                strokeDasharray="4 4"
                label={{ value: "DOH target", fontSize: 10 }}
              />
              <Bar
                yAxisId="left"
                dataKey="bacConfirmed"
                name="Bacteriologically confirmed"
                stackId="a"
                fill={PALETTE.brand}
              />
              <Bar
                yAxisId="left"
                dataKey="clinicallyDiagnosed"
                name="Clinically diagnosed"
                stackId="a"
                fill={PALETTE.philhealth}
                radius={[3, 3, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="rate"
                name="Rate per 100k"
                stroke={PALETTE.danger}
                strokeWidth={2}
                dot={false}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </PanelCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <PanelCard
          title="TB Treatment Cascade"
          description="WHO target: ≥90% treatment success rate"
        >
          <StageFlow
            stages={data.cascade}
            onStageClick={(s) => setDrill({ kind: "cascade", id: s.id })}
          />
        </PanelCard>

        <PanelCard
          title="TB Treatment Outcomes"
          description="12-month treatment cohort analysis · WHO definitions"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data.outcomes}
                  dataKey="count"
                  nameKey="outcome"
                  innerRadius={52}
                  outerRadius={82}
                  paddingAngle={2}
                  onClick={(entry) =>
                    setDrill({
                      kind: "outcome",
                      outcome: (entry as unknown as { outcome: string }).outcome,
                    })
                  }
                >
                  {data.outcomes.map((o) => (
                    <Cell key={o.outcome} fill={o.color} className="cursor-pointer" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v: number, n: string) => [num(v), n]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col justify-center gap-1.5">
              {data.outcomes.map((o) => (
                <button
                  key={o.outcome}
                  onClick={() => setDrill({ kind: "outcome", outcome: o.outcome })}
                  className="flex items-center justify-between gap-2 rounded px-1 py-0.5 text-left hover:bg-muted"
                >
                  <LegendDot color={o.color} label={o.outcome} />
                  <span className="text-xs font-medium text-text-primary">{num(o.count)}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 border-t border-border pt-3">
            <p className="mb-1 text-xs text-text-muted">
              Treatment success rate trend, 12-month cohorts
            </p>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={data.cohortTrend}>
                <XAxis dataKey="month" hide />
                <YAxis hide domain={[70, 100]} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v: number) => [pct(v), "Success rate"]}
                />
                <ReferenceLine
                  y={data.whoTargetSuccess}
                  stroke={PALETTE.warning}
                  strokeDasharray="4 4"
                />
                <Line
                  type="monotone"
                  dataKey="successRate"
                  stroke={PALETTE.brand}
                  strokeWidth={1.75}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </PanelCard>
      </section>

      <section className="space-y-3">
        <SectionTitle
          title="Drug-Resistant TB (DR-TB) Tracker"
          description="Barangay-level DR-TB case density and active case list"
        />
        <div className="grid gap-4 xl:grid-cols-2">
          <PanelCard title="DR-TB Case Density by Barangay" description="">
            <BarangayChoropleth data={drTbChoropleth} maxValue={maxDrTb} />
          </PanelCard>
          <PanelCard
            title="Active DR-TB Cases"
            description={`${data.drTbCases.length} cases tracked`}
            contentClassName="overflow-x-auto"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Patient ID</TableHead>
                  <TableHead className="text-xs">Barangay</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Phase</TableHead>
                  <TableHead className="text-xs">Next review</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.drTbCases.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => setDrill({ kind: "drtb", id: c.id })}
                  >
                    <TableCell className="text-xs font-medium">{c.id}</TableCell>
                    <TableCell className="text-xs">{c.barangay}</TableCell>
                    <TableCell className="text-xs">{c.type}</TableCell>
                    <TableCell className="text-xs">{c.phase}</TableCell>
                    <TableCell className="text-xs">{c.nextReview}</TableCell>
                    <TableCell className="text-xs">
                      <span
                        className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium ${
                          statusTone[c.status] === "good"
                            ? "bg-success/10 text-success"
                            : statusTone[c.status] === "warning"
                              ? "bg-warning/10 text-warning"
                              : "bg-danger/10 text-danger"
                        }`}
                      >
                        {c.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </PanelCard>
        </div>
      </section>

      <TbDrawer data={data} drill={drill} onClose={() => setDrill(null)} />
    </div>
  );
}

function TbDrawer({ data, drill, onClose }: { data: TbData; drill: Drill; onClose: () => void }) {
  const open = drill !== null;
  let title = "";
  let description = "";
  let body: React.ReactNode = null;

  if (drill?.kind === "cascade") {
    const stage = data.cascade.find((s) => s.id === drill.id);
    title = stage?.label ?? "";
    description = `${num(stage?.value ?? 0)} at this stage`;
    body = (
      <p className="text-sm text-text-secondary">
        Patient worklist populates once the TB registry module syncs with encounter data.
      </p>
    );
  } else if (drill?.kind === "outcome") {
    const o = data.outcomes.find((x) => x.outcome === drill.outcome);
    title = drill.outcome;
    description = `${num(o?.count ?? 0)} patients this cohort`;
    body = (
      <p className="text-sm text-text-secondary">
        WHO outcome definition applied per DOH ITIS reporting standard.
      </p>
    );
  } else if (drill?.kind === "drtb") {
    const c = data.drTbCases.find((x) => x.id === drill.id);
    title = c?.id ?? "";
    description = `${c?.barangay} · ${c?.type}`;
    body = c ? (
      <div className="space-y-1">
        <StatRow label="Treatment start" value={c.startDate} />
        <StatRow label="Current phase" value={c.phase} />
        <StatRow label="Next review" value={c.nextReview} />
        <StatRow label="Status" value={c.status} />
      </div>
    ) : null;
  }

  return (
    <DrillDrawer
      open={open}
      onOpenChange={(v) => (v ? null : onClose())}
      title={title}
      description={description}
    >
      {body}
    </DrillDrawer>
  );
}

function TbSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 w-80" />
      <Skeleton className="h-80 w-full rounded-lg" />
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-72 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
