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
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  Baby,
  CalendarClock,
  HeartPulse,
  Send,
  ShieldCheck,
  Stethoscope,
  Syringe,
  Users,
} from "lucide-react";

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
  KpiStrip,
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
  BarangayChoropleth,
  BarangayDatum,
  LGU_COLORS,
  OutbreakBanner,
} from "@/components/analytics/lgu-shared";
import {
  BarangayMetricSet,
  CHOROPLETH_METRICS,
  ChoroplethMetricKey,
  fetchLguExecutiveData,
  LguExecutiveData,
} from "@/lib/analytics/lgu/executive.mock";
import type { ReportColumn } from "@/components/reports/types";
import {
  AddAnnotationButton,
  AnnotationList,
  ChartDrillDrawer,
  GlobalFilterBar,
  InteractiveChartCard,
  RichTooltip,
  RoleSwitcher,
  ZoomControls,
  useAnnotations,
  useMockRole,
  useUrlSyncedFilters,
  type ZoomPreset,
} from "@/components/analytics/interactive";

export const Route = createFileRoute("/lgu/analytics/executive")({
  head: () => ({
    meta: [
      { title: "CHO Executive Dashboard — SugboDoc LGU Analytics" },
      {
        name: "description",
        content:
          "City Health Officer dashboard: Konsulta visits, eKAS claims, TB-DOTS, immunization, maternal coverage, NCD control and disease surveillance.",
      },
    ],
  }),
  component: LguExecutivePage,
});

type Drill =
  { kind: "kpi"; id: string } | { kind: "barangay"; id: string } | { kind: "morbidity" } | null;

function coverageStatus(v: number, good: number, warn: number): MetricStatus {
  if (v >= good) return "good";
  if (v >= warn) return "warning";
  return "danger";
}

const zoomWindowSize: Record<ZoomPreset, number> = {
  "1M": 4,
  "3M": 12,
  "6M": 24,
  "1Y": 48,
  All: 999,
};

function reportHrefForKpi(id: string): string | undefined {
  switch (id) {
    case "konsulta":
    case "ekas":
      return "/lgu/reports/konsulta-enrollment-utilization";
    case "tb":
      return "/lgu/reports/tb-quarterly-ntp";
    case "immunization":
      return "/lgu/reports/immunization-coverage-antigen-barangay";
    case "referral":
      return "/lgu/reports/referral-network-analysis";
    default:
      return undefined;
  }
}

function LguExecutivePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["lgu-analytics", "executive"],
    queryFn: fetchLguExecutiveData,
  });
  const [drill, setDrill] = React.useState<Drill>(null);
  const [metric, setMetric] = React.useState<ChoroplethMetricKey>("visitDensity");
  const [ageGroup, setAgeGroup] = React.useState<"all" | "under5">("all");
  const [epiGranularity, setEpiGranularity] = React.useState("week");
  const [role, setRole] = useMockRole();
  const {
    values: filterValues,
    setValues: setFilterValues,
    dateRange,
    setDateRange,
  } = useUrlSyncedFilters(["barangay"]);
  const [epiZoomPreset, setEpiZoomPreset] = React.useState<ZoomPreset>("All");
  const [epiZoomOffset, setEpiZoomOffset] = React.useState(0);
  const { annotations, addAnnotation, removeAnnotation } = useAnnotations("lgu-executive-epicurve");

  if (isLoading || !data) return <LguExecutiveSkeleton />;

  const barangayOptions = data.barangays.map((b) => ({ label: b.name, value: b.id }));
  const activeBarangayId =
    filterValues["barangay"] && filterValues["barangay"] !== "all"
      ? filterValues["barangay"]
      : null;
  const activeBarangay = activeBarangayId
    ? data.barangays.find((b) => b.id === activeBarangayId)
    : null;

  const epiWindowSize = Math.min(zoomWindowSize[epiZoomPreset], data.epiCurve.length);
  const epiMaxOffset = data.epiCurve.length - epiWindowSize;
  const epiClampedOffset = Math.min(Math.max(epiZoomOffset, 0), epiMaxOffset);
  const epiCurveWindow = data.epiCurve.slice(
    data.epiCurve.length - epiWindowSize - epiClampedOffset,
    data.epiCurve.length - epiClampedOffset,
  );
  const epiIsZoomed = epiWindowSize < data.epiCurve.length || epiClampedOffset > 0;
  const epiTableColumns: ReportColumn<(typeof epiCurveWindow)[number]>[] = [
    { key: "period", header: "Period" },
    { key: "dengue", header: "Dengue", align: "right" },
    { key: "ari", header: "ARI", align: "right" },
    { key: "diarrhea", header: "Diarrhea", align: "right" },
    { key: "measles", header: "Measles", align: "right" },
  ];
  const morbidityTableColumns: ReportColumn<{
    code: string;
    description: string;
    count: number;
  }>[] = [
    { key: "code", header: "ICD-10" },
    { key: "description", header: "Diagnosis" },
    { key: "count", header: "Cases", align: "right" },
  ];

  const metricDef = CHOROPLETH_METRICS.find((m) => m.key === metric)!;
  const values = data.barangays.map((b) => b[metric] as number);
  const maxValue = Math.max(...values, 1);
  const alertThresholds: Partial<Record<ChoroplethMetricKey, number>> = {
    dengueCases: 10,
    tbCases: 20,
  };
  const choroplethData: BarangayDatum[] = data.barangays.map((b) => {
    const v = b[metric] as number;
    const alertLimit = alertThresholds[metric];
    return {
      id: b.id,
      name: b.name,
      value: v,
      display: `${v}${metricDef.unit}`,
      alert: alertLimit !== undefined && v >= alertLimit,
    };
  });

  const morbidityRows = ageGroup === "all" ? data.morbidity.allAges : data.morbidity.under5;
  const morbiditySorted = [...morbidityRows].sort((a, b) => b.current - a.current);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-brand">
            {data.tenant} · {data.jurisdiction}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
            LGU Executive / CHO Dashboard
          </h1>
          <p className="text-sm text-text-muted">
            {data.period} · compared with {data.priorPeriod} · catchment population{" "}
            {num(data.totalPopulation)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RoleSwitcher role={role} onChange={setRole} />
          <StatusBadge tone="neutral">{data.role} view</StatusBadge>
        </div>
      </header>

      <GlobalFilterBar
        filters={[{ key: "barangay", label: "Barangay", options: barangayOptions }]}
        values={filterValues}
        onChange={(key, value) => setFilterValues((v) => ({ ...v, [key]: value }))}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      {data.outbreaks.length > 0 ? <OutbreakBanner diseases={data.outbreaks} /> : null}

      {/* ZONE A — LGU KPI strip (8 cards) */}
      <section className="space-y-3">
        <SectionTitle
          title="Key performance indicators"
          description="Month to date, drill any card for detail."
        />
        <KpiStrip>
          <MetricCard
            label="Total Konsulta Visits (MTD)"
            value={num(data.konsultaVisits.total)}
            delta={data.konsultaVisits.deltaMonth}
            secondary={`+${data.konsultaVisits.deltaYear}% vs same month last year`}
            status="neutral"
            icon={Stethoscope}
            onClick={() => setDrill({ kind: "kpi", id: "konsulta" })}
          />
          <MetricCard
            label="PhilHealth Konsulta Claims (eKAS)"
            value={num(data.ekas.submitted)}
            delta={data.ekas.delta}
            secondary={php(data.ekas.value, { compact: true })}
            status={
              data.ekas.daysToCutoff <= 5 && data.ekas.unsettledCount > 0 ? "danger" : "neutral"
            }
            icon={ShieldCheck}
            {...(data.ekas.daysToCutoff <= 5 && data.ekas.unsettledCount > 0
              ? {
                  note: `${data.ekas.unsettledCount} unsettled, ${data.ekas.daysToCutoff}d to cutoff`,
                }
              : {})}
            onClick={() => setDrill({ kind: "kpi", id: "ekas" })}
          />
          <MetricCard
            label="Active TB Cases (DOTS)"
            value={num(data.tbDots.activeCases)}
            delta={data.tbDots.delta}
            invertDelta
            secondary={`${pct(data.tbDots.treatmentSuccessRate)} treatment success`}
            status={data.tbDots.treatmentSuccessRate >= 90 ? "good" : "warning"}
            icon={Activity}
            onClick={() => setDrill({ kind: "kpi", id: "tb" })}
          />
          <MetricCard
            label="Immunization Coverage Rate"
            value={pct(data.immunization.coverage)}
            delta={data.immunization.delta}
            secondary="Herd immunity target ≥95%"
            status={coverageStatus(data.immunization.coverage, 95, 80)}
            icon={Syringe}
            onClick={() => setDrill({ kind: "kpi", id: "immunization" })}
          />
          <MetricCard
            label="Maternal Care Coverage"
            value={pct(data.maternalCoverage.value)}
            delta={data.maternalCoverage.delta}
            secondary="≥4 ANC visits, target ≥80%"
            status={coverageStatus(data.maternalCoverage.value, 80, 60)}
            icon={Baby}
            onClick={() => setDrill({ kind: "kpi", id: "maternal" })}
          />
          <MetricCard
            label="Hypertension Control Rate"
            value={pct(data.htnControl.value)}
            delta={data.htnControl.delta}
            secondary="BP <140/90, target ≥50%"
            status={coverageStatus(data.htnControl.value, 50, 30)}
            icon={HeartPulse}
            onClick={() => setDrill({ kind: "kpi", id: "htn" })}
          />
          <MetricCard
            label="Diabetes Control Rate"
            value={pct(data.dmControl.value)}
            delta={data.dmControl.delta}
            secondary="HbA1c <7%, target ≥50%"
            status={coverageStatus(data.dmControl.value, 50, 30)}
            icon={HeartPulse}
            onClick={() => setDrill({ kind: "kpi", id: "dm" })}
          />
          <MetricCard
            label="Referral Completion Rate"
            value={pct(data.referralCompletion.value)}
            delta={data.referralCompletion.delta}
            secondary="Outcome documented, target ≥80%"
            status={coverageStatus(data.referralCompletion.value, 80, 60)}
            icon={Send}
            onClick={() => setDrill({ kind: "kpi", id: "referral" })}
          />
        </KpiStrip>
      </section>

      {/* ZONE B — barangay choropleth */}
      <section className="space-y-3">
        <SectionTitle
          title="Barangay health map"
          description="Click a barangay for its full health profile."
          action={
            <Select value={metric} onValueChange={(v) => setMetric(v as ChoroplethMetricKey)}>
              <SelectTrigger className="h-8 w-64 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHOROPLETH_METRICS.map((m) => (
                  <SelectItem key={m.key} value={m.key} className="text-xs">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
        <PanelCard
          title={metricDef.label}
          description={`Range: 0 – ${maxValue}${metricDef.unit} across 15 barangays`}
        >
          <BarangayChoropleth
            data={choroplethData}
            maxValue={maxValue}
            onSelect={(d) => setDrill({ kind: "barangay", id: d.id })}
          />
        </PanelCard>
      </section>

      {/* ZONE C — disease surveillance */}
      <section className="grid gap-4 xl:grid-cols-3">
        <InteractiveChartCard
          title="Epidemic Curve"
          description={`New cases by ${epiGranularity} · dengue vs prior-year baseline`}
          className="xl:col-span-2"
          table={{ columns: epiTableColumns, rows: epiCurveWindow }}
          action={
            <div className="flex flex-wrap items-center gap-1.5">
              <Tabs value={epiGranularity} onValueChange={setEpiGranularity}>
                <TabsList className="h-7">
                  <TabsTrigger value="week" className="text-xs">
                    Weekly
                  </TabsTrigger>
                  <TabsTrigger value="day" className="text-xs">
                    Daily
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <ZoomControls
                preset={epiZoomPreset}
                onPresetChange={(p) => {
                  setEpiZoomPreset(p);
                  setEpiZoomOffset(0);
                }}
                onShift={(dir) => setEpiZoomOffset((o) => o + dir)}
                zoomed={epiIsZoomed}
                onReset={() => {
                  setEpiZoomPreset("All");
                  setEpiZoomOffset(0);
                }}
              />
              <AddAnnotationButton
                role={role}
                xOptions={epiCurveWindow.map((d) => d.period)}
                onAdd={(x, note) => addAnnotation(x, note, "You (Admin)")}
              />
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={epiCurveWindow} margin={{ left: -12, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
              <Tooltip content={<RichTooltip valueFormatter={num} clickHint={false} />} />
              <ReferenceLine
                y={epiCurveWindow[0]?.dengueBaseline ?? 0}
                stroke={PALETTE.neutral}
                strokeDasharray="4 4"
                label={{ value: "Baseline", fontSize: 10, position: "insideTopLeft" }}
              />
              <Bar dataKey="dengue" name="Dengue" radius={[3, 3, 0, 0]}>
                {epiCurveWindow.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.dengue >= d.dengueBaseline * 2 ? LGU_COLORS.outbreak : PALETTE.brand}
                  />
                ))}
              </Bar>
              <Line
                type="monotone"
                dataKey="ari"
                name="ARI"
                stroke={PALETTE.philhealth}
                strokeWidth={1.75}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="diarrhea"
                name="Diarrhea"
                stroke={PALETTE.warning}
                strokeWidth={1.75}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="measles"
                name="Measles"
                stroke={LGU_COLORS.outbreak}
                strokeWidth={1.75}
                dot={false}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="mt-1 text-[11px] text-text-muted">
            Bars turn dark red when a week exceeds 2× the prior-year baseline — the trigger for an
            outbreak investigation.
          </p>
          <AnnotationList
            annotations={annotations}
            {...(role === "Admin" ? { onRemove: removeAnnotation } : {})}
          />
        </InteractiveChartCard>

        <InteractiveChartCard
          title="Ten Leading Causes of Morbidity"
          description={
            activeBarangay
              ? `${activeBarangay.name} · top diagnoses this month`
              : "Current month vs prior periods"
          }
          table={{
            columns: morbidityTableColumns,
            rows: activeBarangay
              ? activeBarangay.topDiagnoses
              : morbiditySorted.map((m) => ({
                  code: m.code,
                  description: m.description,
                  count: m.current,
                })),
          }}
          action={
            !activeBarangay ? (
              <Tabs value={ageGroup} onValueChange={(v) => setAgeGroup(v as "all" | "under5")}>
                <TabsList className="h-7">
                  <TabsTrigger value="all" className="text-xs">
                    All ages
                  </TabsTrigger>
                  <TabsTrigger value="under5" className="text-xs">
                    &lt;5y
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            ) : undefined
          }
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={activeBarangay ? activeBarangay.topDiagnoses : morbiditySorted}
              layout="vertical"
              margin={{ left: 8, right: 16 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="description"
                width={130}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<MorbidityTooltip />} />
              <Bar
                dataKey={activeBarangay ? "count" : "current"}
                name="Current"
                fill={PALETTE.brand}
                radius={[0, 4, 4, 0]}
                onClick={() => setDrill({ kind: "morbidity" })}
                cursor="pointer"
              />
            </BarChart>
          </ResponsiveContainer>
        </InteractiveChartCard>
      </section>

      <section>
        <PanelCard
          title="Ten Leading Causes of Mortality"
          description="Civil registration data not yet connected"
        >
          <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-center text-xs text-text-muted">
            Connect civil registration data for comprehensive mortality data.
          </div>
        </PanelCard>
      </section>

      <BarangayDrawer data={data} drill={drill} onClose={() => setDrill(null)} />
    </div>
  );
}

interface MorbidityRowLike {
  description: string;
}

function MorbidityTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; payload?: Record<string, unknown> }[];
}) {
  const first = payload?.[0];
  const desc = (first?.payload as MorbidityRowLike | undefined)?.description;
  return (
    <RichTooltip
      {...(active !== undefined ? { active } : {})}
      {...(payload !== undefined ? { payload } : {})}
      {...(desc !== undefined ? { label: desc } : {})}
      valueFormatter={num}
    />
  );
}

/* ------------------------------------------------------------------ */

function BarangayDrawer({
  data,
  drill,
  onClose,
}: {
  data: LguExecutiveData;
  drill: Drill;
  onClose: () => void;
}) {
  const open = drill !== null;
  let title = "";
  let description = "";
  let body: React.ReactNode = null;
  let fullReportHref: string | undefined;

  if (drill?.kind === "barangay") {
    const b = data.barangays.find((x) => x.id === drill.id) as BarangayMetricSet | undefined;
    if (b) {
      title = `${b.name} Health Profile`;
      description = `${b.bhc} · PHN: ${b.phn}`;
      fullReportHref = "/lgu/reports/community-household-health-profile";
      body = (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Population served" value={num(b.population)} />
            <StatCard label="Registered patients" value={num(b.registeredPatients)} />
            <StatCard label="TB patients on treatment" value={num(b.tbOnTreatment)} />
            <StatCard label="Active referrals" value={num(b.activeReferrals)} />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-text-secondary">Visits by service type</p>
            {b.visitsByType.map((v) => (
              <StatRow key={v.type} label={v.type} value={num(v.count)} />
            ))}
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-text-secondary">Top 5 diagnoses</p>
            {b.topDiagnoses.map((d) => (
              <StatRow key={d.code} label={`${d.code} · ${d.description}`} value={num(d.count)} />
            ))}
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-text-secondary">
              Immunization coverage per antigen
            </p>
            {b.immunizationByAntigen.map((a) => (
              <StatRow key={a.antigen} label={a.antigen} value={pct(a.coverage, 0)} />
            ))}
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-text-secondary">Maternal risk count</p>
            {b.maternalRiskCount.map((r) => (
              <StatRow key={r.risk} label={r.risk} value={num(r.count)} />
            ))}
          </div>
        </div>
      );
    }
  } else if (drill?.kind === "kpi") {
    fullReportHref = reportHrefForKpi(drill.id);
    switch (drill.id) {
      case "konsulta":
        title = "Total Konsulta Visits (MTD)";
        description = `${num(data.konsultaVisits.total)} visits · +${data.konsultaVisits.deltaMonth}% vs prior month`;
        body = (
          <div className="space-y-5">
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">Visits by day of week</p>
              {data.konsultaVisits.byWeekday.map((d) => (
                <StatRow key={d.day} label={d.day} value={num(d.visits)} />
              ))}
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">
                By barangay health center
              </p>
              {data.konsultaVisits.byBhc.map((d) => (
                <StatRow key={d.name} label={d.name} value={num(d.value)} />
              ))}
            </div>
          </div>
        );
        break;
      case "ekas":
        title = "PhilHealth Konsulta Claims (eKAS)";
        description = `${num(data.ekas.submitted)} submitted · ${php(data.ekas.value, { compact: true })}`;
        body = (
          <div className="space-y-5">
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">Status breakdown</p>
              {data.ekas.byStatus.map((s) => (
                <StatRow key={s.status} label={s.status} value={num(s.count)} />
              ))}
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">
                By barangay health center
              </p>
              {data.ekas.byBhc.map((d) => (
                <StatRow key={d.name} label={d.name} value={num(d.value)} />
              ))}
            </div>
          </div>
        );
        break;
      case "tb":
        title = "Active TB Cases Under DOTS";
        description = `${num(data.tbDots.activeCases)} active cases · ${pct(data.tbDots.treatmentSuccessRate)} success rate`;
        body = (
          <div className="space-y-5">
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">By treatment phase</p>
              {data.tbDots.byPhase.map((p) => (
                <StatRow key={p.phase} label={p.phase} value={num(p.count)} />
              ))}
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">By barangay</p>
              {data.tbDots.byBarangay.map((p) => (
                <StatRow key={p.name} label={p.name} value={num(p.value)} />
              ))}
            </div>
          </div>
        );
        break;
      case "immunization":
        title = "Immunization Coverage Rate";
        description = `${pct(data.immunization.coverage)} of target population`;
        body = (
          <div className="space-y-5">
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">By antigen</p>
              {data.immunization.byAntigen.map((a) => (
                <StatRow key={a.antigen} label={a.antigen} value={pct(a.coverage, 0)} />
              ))}
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">By age group</p>
              {data.immunization.byAgeGroup.map((a) => (
                <StatRow key={a.group} label={a.group} value={pct(a.coverage, 0)} />
              ))}
            </div>
          </div>
        );
        break;
      case "maternal":
        title = "Maternal Care Coverage";
        description = `${pct(data.maternalCoverage.value)} with ≥4 ANC visits`;
        body = (
          <div className="space-y-5">
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">By trimester</p>
              {data.maternalCoverage.byTrimester.map((t) => (
                <StatRow key={t.trimester} label={t.trimester} value={num(t.count)} />
              ))}
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">By risk classification</p>
              {data.maternalCoverage.byRisk.map((r) => (
                <StatRow key={r.risk} label={r.risk} value={num(r.count)} />
              ))}
            </div>
          </div>
        );
        break;
      case "htn":
        title = "Hypertension Control Rate";
        description = `${pct(data.htnControl.value)} of known hypertensives with BP <140/90`;
        body = (
          <p className="text-sm text-text-secondary">
            See full cascade on the NCD Management dashboard.
          </p>
        );
        break;
      case "dm":
        title = "Diabetes Control Rate";
        description = `${pct(data.dmControl.value)} of known diabetics with HbA1c <7%`;
        body = (
          <p className="text-sm text-text-secondary">
            See full cascade on the NCD Management dashboard.
          </p>
        );
        break;
      case "referral":
        title = "Referral Completion Rate";
        description = `${pct(data.referralCompletion.value)} of BHC-initiated referrals documented`;
        body = (
          <div className="space-y-5">
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">
                By destination hospital
              </p>
              {data.referralCompletion.byDestination.map((d) => (
                <StatRow key={d.name} label={d.name} value={num(d.value)} />
              ))}
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">By outcome</p>
              {data.referralCompletion.byOutcome.map((o) => (
                <StatRow key={o.outcome} label={o.outcome} value={num(o.count)} />
              ))}
            </div>
          </div>
        );
        break;
    }
  } else if (drill?.kind === "morbidity") {
    title = "Morbidity detail";
    description = "Click a barangay in Zone B for barangay-level diagnosis breakdowns.";
    fullReportHref = "/lgu/reports/fhsis-monthly";
    body = (
      <p className="text-sm text-text-secondary">City-wide morbidity ranking shown in Zone C.</p>
    );
  }

  return (
    <ChartDrillDrawer
      open={open}
      onOpenChange={(v) => (v ? null : onClose())}
      metricName={title}
      value={description}
      {...(fullReportHref ? { fullReportHref } : {})}
    >
      {body}
    </ChartDrillDrawer>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-text-muted">{label}</div>
      <div className="mt-1 text-lg font-semibold text-text-primary">{value}</div>
    </div>
  );
}

function LguExecutiveSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 w-80" />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-80 w-full rounded-lg" />
      <div className="grid gap-4 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-80 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
