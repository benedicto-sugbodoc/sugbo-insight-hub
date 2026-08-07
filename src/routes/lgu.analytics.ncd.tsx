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
  DrillDrawer,
  PALETTE,
  PanelCard,
  SectionTitle,
  StatRow,
  StatusBadge,
  num,
  pct,
} from "@/components/analytics/shared";
import {
  BarangayChoropleth,
  BarangayDatum,
  ComplianceHeatmap,
  LGU_COLORS,
  StageFlow,
} from "@/components/analytics/lgu-shared";
import { fetchNcdData, NcdBarangay, NcdData } from "@/lib/analytics/lgu/ncd.mock";

export const Route = createFileRoute("/lgu/analytics/ncd")({
  head: () => ({
    meta: [
      { title: "NCD Management — SugboDoc LGU Analytics" },
      {
        name: "description",
        content:
          "Hypertension and diabetes cascade of care, NCD prevalence by barangay, medication compliance and risk factor prevalence.",
      },
    ],
  }),
  component: NcdPage,
});

type Drill =
  { kind: "barangay"; id: string } | { kind: "cascade"; which: "htn" | "dm"; id: string } | null;

function NcdPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["lgu-analytics", "ncd"],
    queryFn: fetchNcdData,
  });
  const [drill, setDrill] = React.useState<Drill>(null);

  if (isLoading || !data) return <NcdSkeleton />;

  const maxIndex = Math.max(...data.barangays.map((b) => b.ncdIndex), 1);
  const choroplethData: BarangayDatum[] = data.barangays.map((b) => ({
    id: b.id,
    name: b.name,
    value: b.ncdIndex,
    display: `${b.ncdIndex}`,
    alert: b.ncdIndex >= maxIndex * 0.85,
  }));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p
            className="text-xs font-medium uppercase tracking-wide"
            style={{ color: LGU_COLORS.ncd }}
          >
            {data.tenant} · PHN / MHO / Epidemiology Officer
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
            NCD Management
          </h1>
          <p className="text-sm text-text-muted">{data.period}</p>
        </div>
        <StatusBadge tone="warning">Hypertension · Diabetes · Risk factors</StatusBadge>
      </header>

      <section className="space-y-3">
        <SectionTitle
          title="NCD Prevalence by Barangay"
          description="Weighted composite index: HTN 45% + DM 35% + obesity 20%. Click a barangay for its NCD profile."
        />
        <PanelCard
          title="NCD Burden Index"
          description={`Range 0 – ${maxIndex.toFixed(1)} across 15 barangays`}
        >
          <BarangayChoropleth
            data={choroplethData}
            maxValue={maxIndex}
            onSelect={(d) => setDrill({ kind: "barangay", id: d.id })}
          />
        </PanelCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <PanelCard
          title="Hypertension Cascade of Care"
          description="WHO/DOH target ≥50% controlled among diagnosed"
        >
          <StageFlow
            stages={data.htnCascade}
            onStageClick={(s) => setDrill({ kind: "cascade", which: "htn", id: s.id })}
          />
        </PanelCard>
        <PanelCard
          title="Diabetes Cascade of Care"
          description="Target ≥50% controlled (HbA1c <7%) among diagnosed"
        >
          <StageFlow
            stages={data.dmCascade}
            onStageClick={(s) => setDrill({ kind: "cascade", which: "dm", id: s.id })}
          />
        </PanelCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <PanelCard
          title="NCD Medication Compliance"
          description="Green = consultation + refill that month · red = missed · triggers PHN home visit"
          contentClassName="overflow-x-auto"
        >
          <ComplianceHeatmap
            rowLabels={data.complianceRows}
            columns={data.complianceColumns}
            matrix={data.complianceMatrix}
          />
        </PanelCard>

        <PanelCard
          title="NCD Risk Factor Prevalence"
          description="Barangay vs city average vs national (DOH NDHS)"
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data.riskFactors} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                unit="%"
              />
              <YAxis
                type="category"
                dataKey="metric"
                width={130}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v: number) => [pct(v), ""]}
              />
              <Bar
                dataKey="barangay"
                name="Selected barangay"
                fill={LGU_COLORS.ncd}
                radius={[0, 4, 4, 0]}
              />
              <Bar dataKey="city" name="City average" fill={PALETTE.brand} radius={[0, 4, 4, 0]} />
              <Bar
                dataKey="national"
                name="National (DOH NDHS)"
                fill={PALETTE.neutral}
                radius={[0, 4, 4, 0]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </BarChart>
          </ResponsiveContainer>
        </PanelCard>
      </section>

      <NcdDrawer data={data} drill={drill} onClose={() => setDrill(null)} />
    </div>
  );
}

function NcdDrawer({ data, drill, onClose }: { data: NcdData; drill: Drill; onClose: () => void }) {
  const open = drill !== null;
  let title = "";
  let description = "";
  let body: React.ReactNode = null;

  if (drill?.kind === "barangay") {
    const b = data.barangays.find((x: NcdBarangay) => x.id === drill.id);
    if (b) {
      title = `${b.name} — NCD Profile`;
      description = `NCD index ${b.ncdIndex} · ${num(b.patientCount)} known NCD patients`;
      body = (
        <div className="space-y-1">
          <StatRow label="Hypertension prevalence" value={pct(b.htnPrevalence)} />
          <StatRow label="Diabetes prevalence" value={pct(b.dmPrevalence)} />
          <StatRow label="Obesity prevalence" value={pct(b.obesityPrevalence)} />
          <StatRow label="Control rate" value={pct(b.controlRate)} />
          <StatRow label="Active referrals" value={num(b.referralCount)} />
          <StatRow label="Medication compliance" value={pct(b.medicationCompliance)} />
        </div>
      );
    }
  } else if (drill?.kind === "cascade") {
    const stages = drill.which === "htn" ? data.htnCascade : data.dmCascade;
    const stage = stages.find((s) => s.id === drill.id);
    title = stage?.label ?? "";
    description = `${num(stage?.value ?? 0)} patients at this stage`;
    body = (
      <p className="text-sm text-text-secondary">
        Patient-level worklist for this stage will populate once the{" "}
        {drill.which === "htn" ? "hypertension" : "diabetes"} registry module is wired to live
        encounter data.
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

function NcdSkeleton() {
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
