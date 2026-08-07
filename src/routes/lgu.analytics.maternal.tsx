import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  ReferenceLine,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Phone } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DrillDrawer,
  Gauge,
  LegendDot,
  PALETTE,
  PanelCard,
  SectionTitle,
  StatRow,
  StatusBadge,
  num,
  pct,
} from "@/components/analytics/shared";
import { CoverageRadar, LGU_COLORS, StageFlow } from "@/components/analytics/lgu-shared";
import { fetchMaternalData, MaternalData, RiskPatient } from "@/lib/analytics/lgu/maternal.mock";

export const Route = createFileRoute("/lgu/analytics/maternal")({
  head: () => ({
    meta: [
      { title: "Maternal & Child Health — SugboDoc LGU Analytics" },
      {
        name: "description",
        content:
          "ANC coverage, maternal risk stratification, delivery outcomes, newborn screening, immunization and child nutrition.",
      },
    ],
  }),
  component: MaternalPage,
});

type Drill =
  | { kind: "risk"; risk: string }
  | { kind: "screening"; label: string }
  | { kind: "barangayFunnel"; name: string }
  | null;

function MaternalPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["lgu-analytics", "maternal"],
    queryFn: fetchMaternalData,
  });
  const [drill, setDrill] = React.useState<Drill>(null);
  const [barangayFilter, setBarangayFilter] = React.useState<string>("__city__");
  const [immTab, setImmTab] = React.useState("radar");

  if (isLoading || !data) return <MaternalSkeleton />;

  const funnelStages =
    barangayFilter === "__city__"
      ? data.ancFunnel
      : (data.funnelByBarangay[barangayFilter] ?? data.ancFunnel);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p
            className="text-xs font-medium uppercase tracking-wide"
            style={{ color: LGU_COLORS.maternal }}
          >
            {data.tenant} · Maternal Health Coordinator / PHN / MHO
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
            Maternal &amp; Child Health
          </h1>
          <p className="text-sm text-text-muted">{data.period}</p>
        </div>
        <StatusBadge tone="neutral">Antenatal · Delivery · Child health</StatusBadge>
      </header>

      {/* SECTION A — ANC */}
      <section className="space-y-3">
        <SectionTitle
          title="Antenatal care (ANC)"
          description="Drop-off between stages = missed opportunities for outreach."
        />
        <div className="grid gap-4 xl:grid-cols-2">
          <PanelCard
            title="ANC Visit Funnel by Trimester"
            description="Click a stage for the barangay breakdown"
            action={
              <Select value={barangayFilter} onValueChange={setBarangayFilter}>
                <SelectTrigger className="h-8 w-48 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__city__" className="text-xs">
                    All barangays (city)
                  </SelectItem>
                  {Object.keys(data.funnelByBarangay).map((name) => (
                    <SelectItem key={name} value={name} className="text-xs">
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          >
            <StageFlow
              stages={funnelStages}
              onStageClick={() =>
                setDrill({
                  kind: "barangayFunnel",
                  name: barangayFilter === "__city__" ? "All barangays" : barangayFilter,
                })
              }
            />
          </PanelCard>

          <PanelCard
            title="ANC Coverage by Barangay"
            description="Denominator = registered pregnancies · DOH target 80%"
          >
            <ResponsiveContainer width="100%" height={360}>
              <BarChart
                data={data.ancCoverageByBarangay}
                layout="vertical"
                margin={{ left: 8, right: 24 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  unit="%"
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={92}
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v: number) => [pct(v), "ANC coverage"]}
                />
                <ReferenceLine
                  x={80}
                  stroke={PALETTE.neutral}
                  strokeDasharray="4 4"
                  label={{ value: "Target 80%", fontSize: 10, position: "insideTopRight" }}
                />
                <Bar dataKey="coverage" radius={[0, 4, 4, 0]}>
                  {data.ancCoverageByBarangay.map((d, i) => (
                    <Cell key={i} fill={d.coverage >= 80 ? PALETTE.success : PALETTE.danger} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </PanelCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <PanelCard
            title="Maternal Risk Stratification"
            description="Click a segment for the patient list"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={data.riskStrat}
                    dataKey="count"
                    nameKey="risk"
                    innerRadius={56}
                    outerRadius={88}
                    paddingAngle={2}
                    onClick={(entry) =>
                      setDrill({ kind: "risk", risk: (entry as unknown as { risk: string }).risk })
                    }
                  >
                    {data.riskStrat.map((s) => (
                      <Cell key={s.risk} fill={s.color} className="cursor-pointer" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v: number, n: string) => [num(v), n]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col justify-center gap-2">
                {data.riskStrat.map((s) => (
                  <button
                    key={s.risk}
                    onClick={() => setDrill({ kind: "risk", risk: s.risk })}
                    className="flex items-center justify-between gap-2 rounded px-1 py-1 text-left hover:bg-muted"
                  >
                    <LegendDot color={s.color} label={s.risk} />
                    <span className="text-xs font-medium text-text-primary">{num(s.count)}</span>
                  </button>
                ))}
              </div>
            </div>
          </PanelCard>

          <PanelCard
            title="Gestational Age at First ANC Visit"
            description="Target: first visit ≤12 weeks"
          >
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.gestAgeHistogram} margin={{ left: -12, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="bucket" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v: number) => [num(v), "Women"]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {data.gestAgeHistogram.map((d, i) => (
                    <Cell
                      key={i}
                      fill={
                        d.band === "early"
                          ? PALETTE.success
                          : d.band === "mid"
                            ? PALETTE.warning
                            : PALETTE.danger
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-1 text-[11px] text-text-muted">
              Late initiation (&gt;20 weeks) means missed early risk detection.
            </p>
          </PanelCard>
        </div>
      </section>

      {/* SECTION B — Delivery & Postpartum */}
      <section className="space-y-3">
        <SectionTitle
          title="Delivery &amp; postpartum"
          description="DOH target: 90% facility-based delivery."
        />
        <div className="grid gap-4 xl:grid-cols-2">
          <PanelCard
            title="Delivery Outcome by Facility Type"
            description="Non-facility deliveries indicate referral failure or access barriers"
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.deliveryOutcome} margin={{ left: -12, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar
                  dataKey="facility"
                  name="Facility (LGU clinic)"
                  stackId="a"
                  fill={PALETTE.success}
                />
                <Bar dataKey="hospital" name="Hospital" stackId="a" fill={PALETTE.philhealth} />
                <Bar
                  dataKey="home"
                  name="Home (non-facility)"
                  stackId="a"
                  fill={PALETTE.danger}
                  radius={[4, 4, 0, 0]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </PanelCard>

          <PanelCard
            title="Maternal Complications Rate"
            description="Per 1,000 deliveries, monthly trend · spikes above UCL are flagged"
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.complications} margin={{ left: -12, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <ReferenceLine
                  y={20}
                  stroke={LGU_COLORS.outbreak}
                  strokeDasharray="4 4"
                  label={{ value: "UCL", fontSize: 10 }}
                />
                <Line
                  type="monotone"
                  dataKey="pph"
                  name="PPH rate"
                  stroke={PALETTE.danger}
                  strokeWidth={1.75}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="preeclampsia"
                  name="Pre-eclampsia rate"
                  stroke={LGU_COLORS.maternal}
                  strokeWidth={1.75}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="obstructedLabor"
                  name="Obstructed labor"
                  stroke={PALETTE.warning}
                  strokeWidth={1.75}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="sepsis"
                  name="Sepsis rate"
                  stroke={LGU_COLORS.outbreak}
                  strokeWidth={1.75}
                  dot={false}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </PanelCard>
        </div>

        <PanelCard
          title="Newborn Screening Completion Rate"
          description="Target 100% for all live births · click a gauge for incomplete cases"
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {data.newbornScreening.map((s) => (
              <button
                key={s.label}
                onClick={() => setDrill({ kind: "screening", label: s.label })}
                className="flex flex-col items-center rounded-lg p-2 hover:bg-muted"
              >
                <Gauge value={s.completion} label={s.label} size={140} />
                <span className="mt-1 text-[11px] text-text-muted">
                  {s.incomplete.length} incomplete
                </span>
              </button>
            ))}
          </div>
        </PanelCard>
      </section>

      {/* SECTION C — Child health & nutrition */}
      <section className="space-y-3">
        <SectionTitle
          title="Child health &amp; nutrition"
          description="WHO / DOST-FNRI Philippine reference standards."
        />
        <div className="grid gap-4 xl:grid-cols-2">
          <PanelCard
            title="Immunization Coverage by Antigen"
            description="Target ring 95% (herd immunity)"
            action={
              <Tabs value={immTab} onValueChange={setImmTab}>
                <TabsList className="h-7">
                  <TabsTrigger value="radar" className="text-xs">
                    Radar
                  </TabsTrigger>
                  <TabsTrigger value="barangay" className="text-xs">
                    By barangay
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            }
          >
            {immTab === "radar" ? (
              <CoverageRadar data={data.immunizationRadar} />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={data.immunizationByBarangay}
                  layout="vertical"
                  margin={{ left: 8, right: 16 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    unit="%"
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={92}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v: number) => [pct(v, 0), "Coverage"]}
                  />
                  <Bar dataKey="coverage" radius={[0, 4, 4, 0]}>
                    {data.immunizationByBarangay.map((d, i) => (
                      <Cell
                        key={i}
                        fill={d.coverage >= 95 ? LGU_COLORS.vaccination : PALETTE.danger}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </PanelCard>

          <PanelCard
            title="Child Nutrition Status"
            description="Stunting (HAZ<-2) · Wasting (WHZ<-2) · Underweight (WAZ<-2)"
          >
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={data.nutrition} margin={{ left: -12, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis
                  dataKey="ageGroup"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit="%" />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v: number) => [pct(v), ""]}
                />
                <Bar dataKey="stunted" name="Stunted" fill={PALETTE.danger} radius={[4, 4, 0, 0]} />
                <Bar dataKey="wasted" name="Wasted" fill={PALETTE.warning} radius={[4, 4, 0, 0]} />
                <Bar
                  dataKey="underweight"
                  name="Underweight"
                  fill={LGU_COLORS.maternal}
                  radius={[4, 4, 0, 0]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </PanelCard>
        </div>

        <PanelCard
          title="Growth Monitoring Coverage"
          description="% of children 0–5y with weight measurement this month · target 80%"
        >
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.growthMonitoring} margin={{ left: -12, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit="%" />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v: number) => [pct(v), "Coverage"]}
              />
              <ReferenceLine y={80} stroke={PALETTE.neutral} strokeDasharray="4 4" />
              <Bar dataKey="coverage" radius={[4, 4, 0, 0]}>
                {data.growthMonitoring.map((d, i) => (
                  <Cell key={i} fill={d.coverage >= 80 ? PALETTE.success : PALETTE.warning} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {data.growthByBarangay.slice(0, 10).map((b) => (
              <div key={b.name} className="rounded-md border border-border p-2">
                <p className="truncate text-[10px] text-text-muted">{b.name}</p>
                <ResponsiveContainer width="100%" height={40}>
                  <BarChart data={b.trend.map((v, i) => ({ i, v }))}>
                    <Bar dataKey="v" fill={PALETTE.brand} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        </PanelCard>
      </section>

      <MaternalDrawer data={data} drill={drill} onClose={() => setDrill(null)} />
    </div>
  );
}

function MaternalDrawer({
  data,
  drill,
  onClose,
}: {
  data: MaternalData;
  drill: Drill;
  onClose: () => void;
}) {
  const open = drill !== null;
  let title = "";
  let description = "";
  let body: React.ReactNode = null;

  if (drill?.kind === "risk") {
    const patients = data.riskPatients.filter((p: RiskPatient) => p.risk === drill.risk);
    title = drill.risk;
    description = `${patients.length} patients · contact list for PHN home-visit scheduling`;
    body = (
      <div className="space-y-2">
        {patients.map((p) => (
          <div key={p.id} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-primary">{p.name}</span>
              <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                <Phone className="size-3" /> {p.contact}
              </span>
            </div>
            <p className="text-xs text-text-muted">
              {p.barangay} · {p.gestWeeks} weeks AOG
            </p>
            <p className="mt-1 text-xs text-text-secondary">{p.flags.join(", ")}</p>
          </div>
        ))}
      </div>
    );
  } else if (drill?.kind === "screening") {
    const s = data.newbornScreening.find((x) => x.label === drill.label);
    title = drill.label;
    description = s ? `${pct(s.completion)} completed · ${s.incomplete.length} pending` : "";
    body = (
      <div className="space-y-1">
        {s?.incomplete.map((i, idx) => (
          <StatRow key={idx} label={i.name} value={i.barangay} />
        ))}
      </div>
    );
  } else if (drill?.kind === "barangayFunnel") {
    title = `ANC funnel — ${drill.name}`;
    description = "Stage-by-stage counts";
    const stages =
      drill.name === "All barangays"
        ? data.ancFunnel
        : (data.funnelByBarangay[drill.name] ?? data.ancFunnel);
    body = (
      <div className="space-y-1">
        {stages.map((s) => (
          <StatRow key={s.id} label={s.label} value={num(s.value)} />
        ))}
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

function MaternalSkeleton() {
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
