import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, AlertTriangle } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DrillDrawer,
  PALETTE,
  PanelCard,
  SectionTitle,
  StatRow,
  StatusBadge,
  Trend,
  num,
  pct,
} from "@/components/analytics/shared";
import { LGU_COLORS, PopulationPyramid } from "@/components/analytics/lgu-shared";
import { fetchPopulationData, PopulationData } from "@/lib/analytics/lgu/population.mock";

export const Route = createFileRoute("/lgu/analytics/population")({
  head: () => ({
    meta: [
      { title: "Population Health & Epidemiology — SugboDoc LGU Analytics" },
      {
        name: "description",
        content:
          "Age-sex population pyramid, disease burden by age group, service utilization, SDOH panel and communicable disease surveillance.",
      },
    ],
  }),
  component: PopulationPage,
});

type Drill = { kind: "band"; band: string } | { kind: "sdoh"; label: string } | null;

const diseases: {
  key: keyof PopulationData["communicable"][number];
  label: string;
  color: string;
}[] = [
  { key: "dengue", label: "Dengue", color: LGU_COLORS.outbreak },
  { key: "ili", label: "Influenza-like Illness (ILI)", color: PALETTE.brand },
  { key: "typhoid", label: "Typhoid", color: PALETTE.warning },
  { key: "cholera", label: "Cholera", color: PALETTE.danger },
  { key: "measles", label: "Measles", color: LGU_COLORS.maternal },
  { key: "covid", label: "COVID-19", color: PALETTE.philhealth },
  { key: "lepto", label: "Leptospirosis", color: PALETTE.gold },
  { key: "rabies", label: "Rabies exposures", color: PALETTE.neutral },
  { key: "abd", label: "Acute Bloody Diarrhea", color: PALETTE.success },
  { key: "hfmd", label: "HFMD", color: "#D35400" },
];

function PopulationPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["lgu-analytics", "population"],
    queryFn: fetchPopulationData,
  });
  const [drill, setDrill] = React.useState<Drill>(null);
  const [pyramidTab, setPyramidTab] = React.useState<"registered" | "active" | "philhealth">(
    "registered",
  );
  const [focusDisease, setFocusDisease] = React.useState<string>("dengue");

  if (isLoading || !data) return <PopulationSkeleton />;

  const pyramidData =
    pyramidTab === "registered"
      ? data.pyramidRegistered
      : pyramidTab === "active"
        ? data.pyramidActive
        : data.pyramidPhilhealth;

  const latestWeek = data.communicable[data.communicable.length - 1];
  const outbreakDiseases = diseases.filter(
    (d) => (latestWeek?.[d.key] as number) >= data.outbreakThreshold,
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-brand">
            {data.tenant} · Epidemiology Officer / CHO / MHO
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
            Population Health &amp; Epidemiology
          </h1>
          <p className="text-sm text-text-muted">{data.period}</p>
        </div>
        <StatusBadge tone="neutral">City-wide surveillance</StatusBadge>
      </header>

      <section className="space-y-3">
        <SectionTitle
          title="Age-Sex Population Pyramid"
          description="Registered patients vs estimated catchment population. Click an age band for its disease burden."
          action={
            <Tabs value={pyramidTab} onValueChange={(v) => setPyramidTab(v as typeof pyramidTab)}>
              <TabsList className="h-7">
                <TabsTrigger value="registered" className="text-xs">
                  All registered
                </TabsTrigger>
                <TabsTrigger value="active" className="text-xs">
                  Active (visit this year)
                </TabsTrigger>
                <TabsTrigger value="philhealth" className="text-xs">
                  PhilHealth enrolled
                </TabsTrigger>
              </TabsList>
            </Tabs>
          }
        />
        <PanelCard title="Population Pyramid" description="">
          <PopulationPyramid
            data={pyramidData}
            onBandClick={(band) => setDrill({ kind: "band", band })}
          />
        </PanelCard>
      </section>

      <section className="space-y-3">
        <SectionTitle
          title="Disease Burden by Age Group"
          description="ICD-10 chapter mix per life stage — respiratory infections peak in <5, NCDs dominate 50+."
        />
        <PanelCard title="Disease Burden" description="">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data.diseaseBurden} margin={{ left: -12, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="ageGroup" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} unit="%" />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v: number) => [pct(v), ""]}
              />
              <Area
                type="monotone"
                dataKey="infection"
                name="Infection"
                stackId="1"
                stroke={PALETTE.philhealth}
                fill={PALETTE.philhealth}
                fillOpacity={0.7}
              />
              <Area
                type="monotone"
                dataKey="ncd"
                name="NCD"
                stackId="1"
                stroke={LGU_COLORS.ncd}
                fill={LGU_COLORS.ncd}
                fillOpacity={0.7}
              />
              <Area
                type="monotone"
                dataKey="maternal"
                name="Maternal"
                stackId="1"
                stroke={LGU_COLORS.maternal}
                fill={LGU_COLORS.maternal}
                fillOpacity={0.7}
              />
              <Area
                type="monotone"
                dataKey="injury"
                name="Injury"
                stackId="1"
                stroke={PALETTE.danger}
                fill={PALETTE.danger}
                fillOpacity={0.7}
              />
              <Area
                type="monotone"
                dataKey="other"
                name="Other"
                stackId="1"
                stroke={PALETTE.neutral}
                fill={PALETTE.neutral}
                fillOpacity={0.7}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </AreaChart>
          </ResponsiveContainer>
        </PanelCard>
      </section>

      <section className="space-y-3">
        <SectionTitle
          title="Health Service Utilization Rate"
          description="Monthly utilization trend per service · dashed line = DOH benchmark"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.utilization.map((u) => (
            <PanelCard key={u.service} title={u.service} description={`Benchmark ${u.benchmark}%`}>
              <ResponsiveContainer width="100%" height={100}>
                <LineChart data={u.trend}>
                  <XAxis dataKey="month" hide />
                  <YAxis hide domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    formatter={(v: number) => [pct(v, 0), u.service]}
                  />
                  <ReferenceLine y={u.benchmark} stroke={PALETTE.neutral} strokeDasharray="4 4" />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={PALETTE.brand}
                    strokeWidth={1.75}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </PanelCard>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle
          title="Social Determinants of Health (SDOH)"
          description="High SDOH burden signals a need for outreach, not just clinical care."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.sdoh.map((m) => (
            <div
              key={m.label}
              className="flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-sm"
            >
              <span className="text-xs font-medium text-text-secondary">{m.label}</span>
              <span className="text-2xl font-semibold text-text-primary">{pct(m.value)}</span>
              <Trend delta={m.delta} />
              <Button
                size="sm"
                variant="outline"
                className="mt-1 justify-between"
                onClick={() => setDrill({ kind: "sdoh", label: m.label })}
              >
                {m.actionLabel}
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle
          title="Communicable Disease Trend"
          description="Cases per epidemiologic week · CESU report format"
          action={
            <Select value={focusDisease} onValueChange={setFocusDisease}>
              <SelectTrigger className="h-8 w-56 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {diseases.map((d) => (
                  <SelectItem key={d.key} value={d.key} className="text-xs">
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
        {outbreakDiseases.length > 0 ? (
          <div
            className="flex items-center gap-2 rounded-md border-2 p-2.5 text-xs font-medium"
            style={{
              borderColor: LGU_COLORS.outbreak,
              color: LGU_COLORS.outbreak,
              backgroundColor: `${LGU_COLORS.outbreak}14`,
            }}
          >
            <AlertTriangle className="size-4" />
            ALERT: {outbreakDiseases.map((d) => d.label).join(", ")} above outbreak threshold (
            {data.outbreakThreshold} cases/week) in the latest epi week.
          </div>
        ) : null}
        <PanelCard
          title="Multi-disease surveillance"
          description={`Highlighted: ${diseases.find((d) => d.key === focusDisease)?.label}`}
        >
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={data.communicable} margin={{ left: -12, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <ReferenceLine
                y={data.outbreakThreshold}
                stroke={LGU_COLORS.outbreak}
                strokeDasharray="4 4"
                label={{ value: "Outbreak threshold", fontSize: 10 }}
              />
              {diseases.map((d) => (
                <Line
                  key={d.key}
                  type="monotone"
                  dataKey={d.key}
                  name={d.label}
                  stroke={d.color}
                  strokeWidth={d.key === focusDisease ? 3 : 1}
                  strokeOpacity={d.key === focusDisease ? 1 : 0.35}
                  dot={false}
                />
              ))}
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-2 flex justify-end">
            <Button size="sm" variant="outline">
              Download CESU report format
            </Button>
          </div>
        </PanelCard>
      </section>

      <PopulationDrawer data={data} drill={drill} onClose={() => setDrill(null)} />
    </div>
  );
}

function PopulationDrawer({
  data,
  drill,
  onClose,
}: {
  data: PopulationData;
  drill: Drill;
  onClose: () => void;
}) {
  const open = drill !== null;
  let title = "";
  let description = "";
  let body: React.ReactNode = null;

  if (drill?.kind === "band") {
    title = `Age band ${drill.band}`;
    description = "Disease burden and cohort detail for this age band";
    body = (
      <p className="text-sm text-text-secondary">
        Cohort-level worklist populates once wired to live Patient/Condition data.
      </p>
    );
  } else if (drill?.kind === "sdoh") {
    const m = data.sdoh.find((x) => x.label === drill.label);
    title = drill.label;
    description = m ? `${pct(m.value)} of registered patients` : "";
    body = (
      <div className="space-y-1">
        <StatRow label="Current value" value={m ? pct(m.value) : "—"} />
        <StatRow label="Trend" value={m ? `${m.delta > 0 ? "+" : ""}${m.delta}%` : "—"} />
        <p className="pt-2 text-sm text-text-secondary">
          {m?.actionLabel} — worklist populates once wired to live registration data.
        </p>
      </div>
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

function PopulationSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 w-80" />
      <Skeleton className="h-96 w-full rounded-lg" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
