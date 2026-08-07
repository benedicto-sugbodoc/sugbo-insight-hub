import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
  PALETTE,
  PanelCard,
  SectionTitle,
  StatRow,
  StatusBadge,
  num,
  php,
} from "@/components/analytics/shared";
import { CalendarHeatmap, StageFlow } from "@/components/analytics/lgu-shared";
import { BhcVolume, fetchKonsultaData, KonsultaData } from "@/lib/analytics/lgu/konsulta.mock";

export const Route = createFileRoute("/lgu/analytics/konsulta")({
  head: () => ({
    meta: [
      { title: "Konsulta / PhilHealth OPD Analytics — SugboDoc LGU Analytics" },
      {
        name: "description",
        content:
          "Konsulta visit volume by BHC, eKAS submission tracker, denial analysis, enrollment funnel and revenue per BHC.",
      },
    ],
  }),
  component: KonsultaPage,
});

type Drill =
  | { kind: "bhc"; bhc: string }
  | { kind: "denial"; code: string }
  | { kind: "day"; date: number }
  | null;

function KonsultaPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["lgu-analytics", "konsulta"],
    queryFn: fetchKonsultaData,
  });
  const [drill, setDrill] = React.useState<Drill>(null);

  if (isLoading || !data) return <KonsultaSkeleton />;

  const totalDenials = data.denialReasons.reduce((s, r) => s + r.count, 0);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-brand">
            {data.tenant} · Administrative Officer / MHO / Finance
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
            Konsulta / PhilHealth OPD Analytics
          </h1>
          <p className="text-sm text-text-muted">
            {data.period} · submission cutoff day {data.cutoffDay}
          </p>
        </div>
        <StatusBadge tone="neutral">PhilHealth Konsulta Package</StatusBadge>
      </header>

      <section className="grid gap-4 xl:grid-cols-2">
        <PanelCard
          title="Konsulta Visit Volume by BHC"
          description="This month vs prior month vs same month last year · sorted by volume"
        >
          <ResponsiveContainer width="100%" height={380}>
            <BarChart
              data={data.volumeByBhc}
              layout="vertical"
              margin={{ left: 8, right: 16 }}
              onClick={(e) => {
                const label = (e as unknown as { activeLabel?: string })?.activeLabel;
                if (label) setDrill({ kind: "bhc", bhc: label });
              }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="bhc"
                width={132}
                tick={{ fontSize: 9 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar
                dataKey="current"
                name="This month"
                fill={PALETTE.brand}
                radius={[0, 4, 4, 0]}
                cursor="pointer"
              />
              <Bar
                dataKey="priorMonth"
                name="Prior month"
                fill={PALETTE.brandLight}
                radius={[0, 4, 4, 0]}
                cursor="pointer"
              />
              <Bar
                dataKey="priorYear"
                name="Same month last year"
                fill={PALETTE.brandLighter}
                radius={[0, 4, 4, 0]}
                cursor="pointer"
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </BarChart>
          </ResponsiveContainer>
        </PanelCard>

        <PanelCard
          title="Konsulta Claims Submission Tracker"
          description="eKAS submitted per day this month · red cells signal cutoff risk"
        >
          <CalendarHeatmap
            days={data.calendarDays}
            onDayClick={(d) => setDrill({ kind: "day", date: d.date })}
          />
        </PanelCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <PanelCard
          title="eKAS Denial Analysis"
          description={`${num(totalDenials)} denied claims this cycle`}
        >
          <div className="space-y-2">
            {data.denialReasons.map((r) => (
              <button
                key={r.code}
                onClick={() => setDrill({ kind: "denial", code: r.code })}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-border p-2.5 text-left hover:bg-muted"
              >
                <div>
                  <p className="text-xs font-medium text-text-primary">{r.reason}</p>
                  <p className="text-[11px] text-text-muted">{r.code}</p>
                </div>
                <span className="text-sm font-semibold text-danger">{r.count}</span>
              </button>
            ))}
          </div>
        </PanelCard>

        <PanelCard
          title="Konsulta Patient Enrollment Status"
          description="Drop-off = unenrolled or inactive members = revenue opportunity"
        >
          <StageFlow stages={data.enrollmentFunnel} />
        </PanelCard>
      </section>

      <section className="space-y-3">
        <SectionTitle
          title="Konsulta Revenue per BHC"
          description="eKAS claim value vs out-of-pocket services"
        />
        <PanelCard title="Revenue Breakdown" description="">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.revenueByBhc} margin={{ left: -12, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis
                dataKey="bhc"
                tick={{ fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={70}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(1)}M`}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v: number, n: string) => [php(v, { compact: true }), n]}
              />
              <Bar dataKey="ekasValue" name="eKAS claim value" stackId="a" fill={PALETTE.brand} />
              <Bar
                dataKey="oopValue"
                name="Out-of-pocket"
                stackId="a"
                fill={PALETTE.warning}
                radius={[3, 3, 0, 0]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">BHC</TableHead>
                  <TableHead className="text-right text-xs">Visits</TableHead>
                  <TableHead className="text-right text-xs">eKAS submitted</TableHead>
                  <TableHead className="text-right text-xs">eKAS value</TableHead>
                  <TableHead className="text-right text-xs">Avg / visit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.revenueByBhc.map((r) => (
                  <TableRow key={r.bhc}>
                    <TableCell className="text-xs">{r.bhc}</TableCell>
                    <TableCell className="text-right text-xs">{num(r.visits)}</TableCell>
                    <TableCell className="text-right text-xs">{num(r.ekasSubmitted)}</TableCell>
                    <TableCell className="text-right text-xs">
                      {php(r.ekasValue, { compact: true })}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {php(r.ekasValue / Math.max(1, r.visits), { compact: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </PanelCard>
      </section>

      <KonsultaDrawer data={data} drill={drill} onClose={() => setDrill(null)} />
    </div>
  );
}

function KonsultaDrawer({
  data,
  drill,
  onClose,
}: {
  data: KonsultaData;
  drill: Drill;
  onClose: () => void;
}) {
  const open = drill !== null;
  let title = "";
  let description = "";
  let body: React.ReactNode = null;

  if (drill?.kind === "bhc") {
    const b = data.volumeByBhc.find((x: BhcVolume) => x.bhc === drill.bhc);
    title = drill.bhc;
    description =
      "Physician utilization, top diagnoses and peak-hour detail populate once wired to live encounter data.";
    body = b ? (
      <div className="space-y-1">
        <StatRow label="This month" value={num(b.current)} />
        <StatRow label="Prior month" value={num(b.priorMonth)} />
        <StatRow label="Same month last year" value={num(b.priorYear)} />
      </div>
    ) : null;
  } else if (drill?.kind === "denial") {
    const r = data.denialReasons.find((x) => x.code === drill.code);
    title = r?.reason ?? "";
    description = `${num(r?.count ?? 0)} claims denied · ${r?.code}`;
    body = <p className="text-sm text-text-secondary">{r?.action}</p>;
  } else if (drill?.kind === "day") {
    const d = data.calendarDays.find((x) => x.date === drill.date);
    title = `August ${drill.date}, 2026`;
    description = `${num(d?.submitted ?? 0)} eKAS submitted · ${num(d?.pending ?? 0)} pending`;
    body = (
      <p className="text-sm text-text-secondary">
        Encounter-level eKAS list populates once wired to live claims data.
      </p>
    );
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

function KonsultaSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 w-80" />
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-80 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
