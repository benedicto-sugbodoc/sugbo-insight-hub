import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  Scatter,
  ScatterChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Droplets,
  Pill,
  ShieldAlert,
  Syringe,
} from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DrillDrawer,
  Gauge,
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
} from "@/components/analytics/shared";
import { fetchQualityData, type QualityData } from "@/lib/analytics/quality.mock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/analytics/quality")({
  head: () => ({
    meta: [
      { title: "Quality & Patient Safety Analytics — SugboDoc" },
      {
        name: "description",
        content:
          "Hospital-acquired conditions, medication errors, hand hygiene, SSI surveillance and prescription appropriateness.",
      },
      { property: "og:title", content: "Quality & Patient Safety Analytics — SugboDoc" },
      {
        property: "og:description",
        content: "Quality Officer and Medical Director patient safety dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QualityPage,
});

type Drill =
  | { kind: "kpi"; id: string }
  | { kind: "hac"; period: string }
  | { kind: "surgeon"; surgeon: string }
  | { kind: "unit"; unit: string }
  | { kind: "department"; department: string }
  | null;

function hacStatus(v: number, ucl: number, lcl: number): MetricStatus {
  if (v > ucl || v < lcl) return "danger";
  return "good";
}

function hygieneStatus(v: number): MetricStatus {
  if (v >= 80) return "good";
  if (v >= 65) return "warning";
  return "danger";
}

function QualityPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "quality"],
    queryFn: fetchQualityData,
  });
  const [drill, setDrill] = React.useState<Drill>(null);
  const [hacCategory, setHacCategory] = React.useState<string>("all");

  if (isLoading || !data) return <QualitySkeleton />;

  const hacFiltered =
    hacCategory === "all" ? data.hac : data.hac.filter((h) => h.category === hacCategory);
  const specialCauses = data.hac.filter((h) => h.specialCause);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-brand">
            {data.tenant} · Level 3 Hospital
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
            Quality &amp; Patient Safety
          </h1>
          <p className="text-sm text-text-muted">
            {data.period} · compared with {data.priorPeriod}
          </p>
        </div>
        <StatusBadge tone="neutral">Quality Officer / Medical Director view</StatusBadge>
      </header>

      {/* KPI strip */}
      <section className="space-y-3">
        <SectionTitle title="Safety posture" description="Month to date, drill any card for detail." />
        <KpiStrip>
          <MetricCard
            label="HAC Rate (per 1000 patient-days)"
            value={data.kpi.hacRate.value.toFixed(1)}
            delta={data.kpi.hacRate.delta}
            invertDelta
            secondary="Control limit 0.7–4.1"
            status={hacStatus(data.kpi.hacRate.value, 4.1, 0.7)}
            icon={ShieldAlert}
            onClick={() => setDrill({ kind: "kpi", id: "hac" })}
          />
          <MetricCard
            label="Medication Errors (MTD)"
            value={num(data.kpi.medErrorsMtd.value)}
            delta={data.kpi.medErrorsMtd.delta}
            invertDelta
            status={data.kpi.medErrorsMtd.delta <= 0 ? "good" : "warning"}
            icon={Pill}
            onClick={() => setDrill({ kind: "kpi", id: "medErrors" })}
          />
          <MetricCard
            label="Hand Hygiene Compliance"
            value={pct(data.kpi.handHygiene.value)}
            delta={data.kpi.handHygiene.delta}
            secondary="WHO target ≥80%"
            status={hygieneStatus(data.kpi.handHygiene.value)}
            icon={Droplets}
            onClick={() => setDrill({ kind: "kpi", id: "handHygiene" })}
          />
          <MetricCard
            label="SSI Rate"
            value={pct(data.kpi.ssiRate.value, 2)}
            delta={data.kpi.ssiRate.delta}
            invertDelta
            secondary={`Expected ${data.ssi.overallExpectedRate}%`}
            status={data.kpi.ssiRate.value <= data.ssi.overallExpectedRate ? "good" : "warning"}
            icon={Syringe}
            onClick={() => setDrill({ kind: "kpi", id: "ssi" })}
          />
          <MetricCard
            label="Generic Prescribing Rate"
            value={pct(data.kpi.genericPrescribing.value)}
            delta={data.kpi.genericPrescribing.delta}
            secondary={`DOH target ${data.prescriptions.targets.genericRate}%`}
            status={
              data.kpi.genericPrescribing.value >= data.prescriptions.targets.genericRate
                ? "good"
                : "warning"
            }
            icon={AlertTriangle}
            onClick={() => setDrill({ kind: "kpi", id: "prescriptions" })}
          />
        </KpiStrip>
      </section>

      {/* Chart 27 — HAC control chart */}
      <section>
        <PanelCard
          title="Hospital-Acquired Condition (HAC) Rate — Control Chart"
          description="Run chart with mean, UCL and LCL; points outside limits flagged as special-cause variation."
          action={
            <Tabs value={hacCategory} onValueChange={setHacCategory}>
              <TabsList className="h-7 flex-wrap">
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                {data.hacCategories.map((c) => (
                  <TabsTrigger key={c} value={c} className="text-xs">{c}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          }
        >
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={hacFiltered} margin={{ left: -12, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v: number, n: string) => [v.toFixed(2), n]}
              />
              <ReferenceLine y={data.hac[0]?.mean ?? 0} stroke={PALETTE.brand} strokeDasharray="4 4" label={{ value: "Mean", fontSize: 10, position: "insideTopLeft" }} />
              <ReferenceLine y={data.hac[0]?.ucl ?? 0} stroke={PALETTE.danger} strokeDasharray="4 4" label={{ value: "UCL", fontSize: 10, position: "insideTopLeft" }} />
              <ReferenceLine y={data.hac[0]?.lcl ?? 0} stroke={PALETTE.warning} strokeDasharray="4 4" label={{ value: "LCL", fontSize: 10, position: "insideBottomLeft" }} />
              <Line
                type="monotone"
                dataKey="rate"
                name="HAC rate"
                stroke={PALETTE.brand}
                strokeWidth={2}
                dot={(props: { cx?: number; cy?: number; payload?: { specialCause: boolean }; index?: number }) => {
                  const { cx, cy, payload, index } = props;
                  if (cx == null || cy == null) return <React.Fragment key={index} />;
                  const flagged = !!payload?.specialCause;
                  return (
                    <circle
                      key={index}
                      cx={cx}
                      cy={cy}
                      r={flagged ? 6 : 3}
                      fill={flagged ? PALETTE.danger : PALETTE.brand}
                      stroke={flagged ? PALETTE.danger : "none"}
                      strokeWidth={flagged ? 2 : 0}
                      className="cursor-pointer"
                      onClick={() => setDrill({ kind: "hac", period: String(payload && "period" in payload ? "" : "") })}
                    />
                  );
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
          {specialCauses.length ? (
            <div className="mt-3 rounded-lg border border-l-4 border-l-danger bg-danger/5 p-3">
              <p className="mb-1 text-xs font-semibold text-danger">Special-cause variation detected</p>
              <ul className="space-y-1 text-xs text-text-secondary">
                {specialCauses.map((h) => (
                  <li key={h.period}>
                    <button
                      className="underline decoration-dotted hover:text-danger"
                      onClick={() => setDrill({ kind: "hac", period: h.period })}
                    >
                      {h.period}
                    </button>
                    {" — "}
                    {h.category} rate {h.rate.toFixed(1)} (limits {h.lcl}–{h.ucl})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </PanelCard>
      </section>

      {/* Chart 28 — medication errors */}
      <section>
        <PanelCard
          title="Medication Error Reporting"
          description="By error type with overlaid monthly trend · source: Incident Report Module (placeholder integration)"
        >
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data.medErrors} margin={{ left: -12, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar stackId="err" dataKey="wrongDrug" name="Wrong drug" fill={PALETTE.danger} />
              <Bar stackId="err" dataKey="wrongDose" name="Wrong dose" fill={PALETTE.warning} />
              <Bar stackId="err" dataKey="wrongRoute" name="Wrong route" fill={PALETTE.hmo} />
              <Bar stackId="err" dataKey="wrongPatient" name="Wrong patient" fill={PALETTE.scpwd} />
              <Bar stackId="err" dataKey="omission" name="Omission" fill={PALETTE.neutral} />
              <Line type="monotone" dataKey="total" name="Total (trend)" stroke={PALETTE.brand} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="mt-2 text-[11px] italic text-text-muted">
            Connect the Incident Report Module to populate real-time medication error events.
          </p>
        </PanelCard>
      </section>

      {/* Chart 29 — hand hygiene */}
      <section className="grid gap-4 xl:grid-cols-3">
        <PanelCard title="Hand Hygiene Compliance" description="Overall vs WHO target">
          <div className="flex items-center justify-center py-2">
            <Gauge value={data.handHygiene.overall} label={`Target ≥ ${data.handHygiene.target}%`} />
          </div>
        </PanelCard>
        <PanelCard title="Monthly Trend" description="Facility-wide compliance rate">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.handHygiene.trend} margin={{ left: -12, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={36} domain={[0, 100]} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => [pct(v), "Compliance"]} />
              <ReferenceLine y={data.handHygiene.target} stroke={PALETTE.success} strokeDasharray="4 4" label={{ value: "WHO target", fontSize: 10 }} />
              <Line type="monotone" dataKey="value" name="Compliance" stroke={PALETTE.brand} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </PanelCard>
        <PanelCard title="By Unit / Ward" description="Click a ward for detail">
          <div className="space-y-2">
            {data.handHygiene.byUnit.map((u) => (
              <button
                key={u.unit}
                onClick={() => setDrill({ kind: "unit", unit: u.unit })}
                className="flex w-full items-center justify-between gap-2 rounded px-1 py-1 text-left hover:bg-muted"
              >
                <LegendDot color={u.compliance >= u.target ? PALETTE.success : PALETTE.warning} label={u.unit} />
                <span className={cn("text-xs font-medium", u.compliance >= u.target ? "text-success" : "text-warning")}>
                  {pct(u.compliance)}
                </span>
              </button>
            ))}
          </div>
        </PanelCard>
      </section>

      {/* Chart 30 — SSI funnel plot */}
      <section>
        <PanelCard
          title="Surgical Site Infection (SSI) Rate — Funnel Plot by Surgeon"
          description="Observed rate vs case volume with expected rate; outliers flagged for QA review. Click a point to drill."
        >
          <ResponsiveContainer width="100%" height={340}>
            <ScatterChart margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                type="number"
                dataKey="caseVolume"
                name="Case volume"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                label={{ value: "Case volume", fontSize: 11, position: "insideBottom", offset: -4 }}
              />
              <YAxis
                type="number"
                dataKey="observedRate"
                name="SSI rate"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={40}
                label={{ value: "SSI rate (%)", fontSize: 11, angle: -90, position: "insideLeft" }}
              />
              <ZAxis range={[80, 80]} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v: number, n: string) => [n === "observedRate" ? `${v}%` : num(v), n === "observedRate" ? "SSI rate" : "Case volume"]}
                labelFormatter={() => ""}
              />
              <ReferenceLine y={data.ssi.overallExpectedRate} stroke={PALETTE.brand} strokeDasharray="4 4" label={{ value: "Expected rate", fontSize: 10 }} />
              <Scatter
                data={data.ssi.surgeons}
                onClick={(entry) => setDrill({ kind: "surgeon", surgeon: (entry as unknown as { surgeon: string }).surgeon })}
              >
                {data.ssi.surgeons.map((s) => (
                  <Cell key={s.surgeon} fill={s.outlier ? PALETTE.danger : PALETTE.brand} className="cursor-pointer" />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap gap-3">
            <LegendDot color={PALETTE.brand} label="Within control limits" />
            <LegendDot color={PALETTE.danger} label="Outlier — QA review" />
          </div>
        </PanelCard>
      </section>

      {/* Chart 31 — prescription appropriateness */}
      <section>
        <PanelCard
          title="Prescription Appropriateness by Department"
          description="Generic prescribing, antibiotic prescribing and polypharmacy (>5 drugs) vs DOH National Formulary targets"
        >
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={data.prescriptions.departments} margin={{ left: -12, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="department" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number, n: string) => [`${v}%`, n]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="genericRate" name="Generic prescribing" fill={PALETTE.success} radius={[3, 3, 0, 0]} onClick={(e) => setDrill({ kind: "department", department: (e as unknown as { department: string }).department })} />
              <Bar dataKey="antibioticRate" name="Antibiotic prescribing" fill={PALETTE.warning} radius={[3, 3, 0, 0]} onClick={(e) => setDrill({ kind: "department", department: (e as unknown as { department: string }).department })} />
              <Bar dataKey="polypharmacyRate" name="Polypharmacy (>5 drugs)" fill={PALETTE.scpwd} radius={[3, 3, 0, 0]} onClick={(e) => setDrill({ kind: "department", department: (e as unknown as { department: string }).department })} />
              <ReferenceLine y={data.prescriptions.targets.genericRate} stroke={PALETTE.success} strokeDasharray="4 4" label={{ value: "Generic target", fontSize: 9 }} />
              <ReferenceLine y={data.prescriptions.targets.antibioticRate} stroke={PALETTE.warning} strokeDasharray="4 4" label={{ value: "Antibiotic target", fontSize: 9 }} />
              <ReferenceLine y={data.prescriptions.targets.polypharmacyRate} stroke={PALETTE.scpwd} strokeDasharray="4 4" label={{ value: "Polypharmacy target", fontSize: 9 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </PanelCard>
      </section>

      <QualityDrillDrawer drill={drill} onOpenChange={(open) => !open && setDrill(null)} data={data} />
    </div>
  );
}

function QualityDrillDrawer({
  drill,
  onOpenChange,
  data,
}: {
  drill: Drill;
  onOpenChange: (open: boolean) => void;
  data: QualityData;
}) {
  if (!drill) {
    return <DrillDrawer open={false} onOpenChange={onOpenChange} title="" children={null} />;
  }

  if (drill.kind === "kpi") {
    const titles: Record<string, string> = {
      hac: "HAC Rate detail",
      medErrors: "Medication errors detail",
      handHygiene: "Hand hygiene detail",
      ssi: "SSI rate detail",
      prescriptions: "Prescription appropriateness detail",
    };
    return (
      <DrillDrawer
        open
        onOpenChange={onOpenChange}
        title={titles[drill.id] ?? "Detail"}
        description={`${data.period} snapshot`}
      >
        {drill.id === "hac" ? (
          <div className="space-y-1">
            {data.hac.map((h) => (
              <StatRow key={h.period} label={`${h.period} · ${h.category}`} value={`${h.rate.toFixed(1)} / 1000 pd`} />
            ))}
          </div>
        ) : null}
        {drill.id === "medErrors" ? (
          <div className="space-y-1">
            {data.medErrors.map((m) => (
              <StatRow key={m.month} label={m.month} value={`${m.total} errors`} />
            ))}
          </div>
        ) : null}
        {drill.id === "handHygiene" ? (
          <div className="space-y-1">
            {data.handHygiene.byUnit.map((u) => (
              <StatRow key={u.unit} label={u.unit} value={pct(u.compliance)} />
            ))}
          </div>
        ) : null}
        {drill.id === "ssi" ? (
          <div className="space-y-1">
            {data.ssi.surgeons.map((s) => (
              <StatRow key={s.surgeon} label={s.surgeon} value={`${s.observedRate}% (n=${s.caseVolume})`} />
            ))}
          </div>
        ) : null}
        {drill.id === "prescriptions" ? (
          <div className="space-y-1">
            {data.prescriptions.departments.map((d) => (
              <StatRow key={d.department} label={d.department} value={`${d.genericRate}% generic`} />
            ))}
          </div>
        ) : null}
      </DrillDrawer>
    );
  }

  if (drill.kind === "hac") {
    const point = data.hac.find((h) => h.period === drill.period);
    return (
      <DrillDrawer open onOpenChange={onOpenChange} title={`HAC event — ${drill.period}`} description="Control chart point detail">
        {point ? (
          <div className="space-y-1">
            <StatRow label="Category" value={point.category} />
            <StatRow label="Rate" value={`${point.rate.toFixed(2)} per 1000 patient-days`} />
            <StatRow label="Mean" value={point.mean} />
            <StatRow label="UCL" value={point.ucl} />
            <StatRow label="LCL" value={point.lcl} />
            <StatRow label="Special-cause variation" value={point.specialCause ? "Yes — investigate" : "No"} />
          </div>
        ) : null}
      </DrillDrawer>
    );
  }

  if (drill.kind === "surgeon") {
    const s = data.ssi.surgeons.find((x) => x.surgeon === drill.surgeon);
    return (
      <DrillDrawer open onOpenChange={onOpenChange} title={drill.surgeon} description="Surgical site infection surveillance">
        {s ? (
          <div className="space-y-1">
            <StatRow label="Department" value={s.department} />
            <StatRow label="Case volume" value={num(s.caseVolume)} />
            <StatRow label="Observed SSI rate" value={`${s.observedRate}%`} />
            <StatRow label="Expected rate" value={`${s.expectedRate}%`} />
            <StatRow label="Funnel status" value={s.outlier ? "Outlier — QA review required" : "Within control limits"} />
          </div>
        ) : null}
      </DrillDrawer>
    );
  }

  if (drill.kind === "unit") {
    const u = data.handHygiene.byUnit.find((x) => x.unit === drill.unit);
    return (
      <DrillDrawer open onOpenChange={onOpenChange} title={drill.unit} description="Hand hygiene compliance detail">
        {u ? (
          <div className="space-y-1">
            <StatRow label="Compliance" value={pct(u.compliance)} />
            <StatRow label="WHO target" value={pct(u.target)} />
            <StatRow label="Observations" value={num(u.observations)} />
          </div>
        ) : null}
      </DrillDrawer>
    );
  }

  if (drill.kind === "department") {
    const d = data.prescriptions.departments.find((x) => x.department === drill.department);
    return (
      <DrillDrawer open onOpenChange={onOpenChange} title={drill.department} description="Prescription appropriateness detail">
        {d ? (
          <div className="space-y-1">
            <StatRow label="Generic prescribing" value={pct(d.genericRate)} />
            <StatRow label="Antibiotic prescribing" value={pct(d.antibioticRate)} />
            <StatRow label="Polypharmacy (>5 drugs)" value={pct(d.polypharmacyRate)} />
          </div>
        ) : null}
      </DrillDrawer>
    );
  }

  return null;
}

function QualitySkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-16 w-full" />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-80 w-full" />
      <Skeleton className="h-80 w-full" />
      <Skeleton className="h-80 w-full" />
    </div>
  );
}
