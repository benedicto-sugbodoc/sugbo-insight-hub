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
import {
  CEBU_PROVINCE_CITIES,
  CEBU_PROVINCE_TOTAL,
  jurisdictionMorbidity,
  PH_REGIONS,
  PHILIPPINES_TOTAL,
  scaleEpiCurve,
  type JurisdictionRow,
} from "@/lib/analytics/lgu/jurisdiction.mock";
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
  | { kind: "kpi"; id: string }
  | { kind: "barangay"; id: string }
  | { kind: "jurisdiction"; id: string }
  | { kind: "morbidity" }
  | null;

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

/* ------------------------------------------------------------------ */
/* Geo-scoped visibility — same dashboard layout at every level, only   */
/* the jurisdiction being viewed changes: President (national) ->       */
/* Governor (provincial) -> Mayor / CHO (city) -> Barangay Captain      */
/* (barangay). Mirrors the mock-role pattern (localStorage, no real     */
/* auth) used elsewhere in this prototype.                              */
/* ------------------------------------------------------------------ */

type GeoLevel = "national" | "provincial" | "city" | "barangay";

const GEO_LEVEL_META: Record<GeoLevel, { role: string; jurisdiction: string }> = {
  national: { role: "President", jurisdiction: "National" },
  provincial: { role: "Governor", jurisdiction: "Provincial" },
  city: { role: "Mayor / CHO", jurisdiction: "City" },
  barangay: { role: "Barangay Captain", jurisdiction: "Barangay" },
};

function useGeoLevel(): {
  geoLevel: GeoLevel;
  setGeoLevel: (l: GeoLevel) => void;
  geoBarangayId: string;
  setGeoBarangayId: (id: string) => void;
} {
  const [geoLevel, setGeoLevelState] = React.useState<GeoLevel>("city");
  const [geoBarangayId, setGeoBarangayIdState] = React.useState("");
  React.useEffect(() => {
    try {
      const savedLevel = window.localStorage.getItem("sugbodoc-lgu-geo-level");
      if (
        savedLevel === "national" ||
        savedLevel === "provincial" ||
        savedLevel === "city" ||
        savedLevel === "barangay"
      ) {
        setGeoLevelState(savedLevel);
      }
      const savedBarangay = window.localStorage.getItem("sugbodoc-lgu-geo-barangay");
      if (savedBarangay) setGeoBarangayIdState(savedBarangay);
    } catch {
      // ignore
    }
  }, []);
  const setGeoLevel = React.useCallback((l: GeoLevel) => {
    setGeoLevelState(l);
    try {
      window.localStorage.setItem("sugbodoc-lgu-geo-level", l);
    } catch {
      // ignore
    }
  }, []);
  const setGeoBarangayId = React.useCallback((id: string) => {
    setGeoBarangayIdState(id);
    try {
      window.localStorage.setItem("sugbodoc-lgu-geo-barangay", id);
    } catch {
      // ignore
    }
  }, []);
  return { geoLevel, setGeoLevel, geoBarangayId, setGeoBarangayId };
}

function GeoLevelSwitcher({
  geoLevel,
  onGeoLevelChange,
  barangayId,
  onBarangayChange,
  barangayOptions,
}: {
  geoLevel: GeoLevel;
  onGeoLevelChange: (l: GeoLevel) => void;
  barangayId: string;
  onBarangayChange: (id: string) => void;
  barangayOptions: { label: string; value: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Select value={geoLevel} onValueChange={(v) => onGeoLevelChange(v as GeoLevel)}>
        <SelectTrigger className="h-7 w-52 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="national" className="text-xs">
            President (National)
          </SelectItem>
          <SelectItem value="provincial" className="text-xs">
            Governor (Provincial)
          </SelectItem>
          <SelectItem value="city" className="text-xs">
            Mayor / CHO (City)
          </SelectItem>
          <SelectItem value="barangay" className="text-xs">
            Barangay Captain
          </SelectItem>
        </SelectContent>
      </Select>
      {geoLevel === "barangay" ? (
        <Select value={barangayId} onValueChange={onBarangayChange}>
          <SelectTrigger className="h-7 w-48 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {barangayOptions.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}

interface LevelKpis {
  konsultaVisits: number;
  ekasSubmitted: number;
  ekasValue: number;
  tbActiveCases: number;
  tbSuccessRate: number;
  immunizationCoverage: number;
  maternalCoverage: number;
  htnControl: number;
  dmControl: number;
  referralCompletion: number;
}

function levelKpisFor(
  geoLevel: GeoLevel,
  data: LguExecutiveData,
  geoBarangay: BarangayMetricSet,
): LevelKpis {
  if (geoLevel === "provincial" || geoLevel === "national") {
    const r = geoLevel === "provincial" ? CEBU_PROVINCE_TOTAL : PHILIPPINES_TOTAL;
    return {
      konsultaVisits: r.konsultaVisits,
      ekasSubmitted: r.ekasSubmitted,
      ekasValue: r.ekasValue,
      tbActiveCases: r.tbActiveCases,
      tbSuccessRate: r.tbTreatmentSuccessRate,
      immunizationCoverage: r.immunizationCoverage,
      maternalCoverage: r.maternalCoverage,
      htnControl: r.htnControl,
      dmControl: r.dmControl,
      referralCompletion: r.referralCompletion,
    };
  }
  if (geoLevel === "barangay") {
    const b = geoBarangay;
    const konsultaOpd = b.visitsByType.find((v) => v.type === "Konsulta OPD")?.count ?? 0;
    const ekasRatio = data.ekas.submitted / data.konsultaVisits.total;
    const ekasSubmitted = Math.round(konsultaOpd * ekasRatio);
    const avgImmunization =
      Math.round(
        (b.immunizationByAntigen.reduce((s, a) => s + a.coverage, 0) /
          b.immunizationByAntigen.length) *
          10,
      ) / 10;
    return {
      konsultaVisits: konsultaOpd,
      ekasSubmitted,
      ekasValue: ekasSubmitted * 1500,
      tbActiveCases: b.tbOnTreatment,
      tbSuccessRate: data.tbDots.treatmentSuccessRate,
      immunizationCoverage: avgImmunization,
      maternalCoverage: data.maternalCoverage.value,
      htnControl: data.htnControl.value,
      dmControl: data.dmControl.value,
      referralCompletion: data.referralCompletion.value,
    };
  }
  // city
  return {
    konsultaVisits: data.konsultaVisits.total,
    ekasSubmitted: data.ekas.submitted,
    ekasValue: data.ekas.value,
    tbActiveCases: data.tbDots.activeCases,
    tbSuccessRate: data.tbDots.treatmentSuccessRate,
    immunizationCoverage: data.immunization.coverage,
    maternalCoverage: data.maternalCoverage.value,
    htnControl: data.htnControl.value,
    dmControl: data.dmControl.value,
    referralCompletion: data.referralCompletion.value,
  };
}

type MetricSource = { id: string; name: string } & Record<ChoroplethMetricKey, number>;

function toDatum(
  entity: MetricSource,
  key: ChoroplethMetricKey,
  unit: string,
  alertLimit?: number,
): BarangayDatum {
  const v = entity[key];
  return {
    id: entity.id,
    name: entity.name,
    value: v,
    display: `${v}${unit}`,
    alert: alertLimit !== undefined && v >= alertLimit,
  };
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
  const { geoLevel, setGeoLevel, geoBarangayId, setGeoBarangayId } = useGeoLevel();
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

  const meta = GEO_LEVEL_META[geoLevel];
  const barangayOptions = data.barangays.map((b) => ({ label: b.name, value: b.id }));
  const effectiveGeoBarangayId = geoBarangayId || data.barangays[0]!.id;
  const geoBarangay =
    data.barangays.find((b) => b.id === effectiveGeoBarangayId) ?? data.barangays[0]!;

  // Only the "city" level exposes the free-choice barangay filter (Mayor drilling
  // into one barangay for exploration). At "barangay" level it's the Captain's
  // own barangay, forced. Both funnel into the same `activeBarangay`.
  const cityFilterBarangayId =
    geoLevel === "city" && filterValues["barangay"] && filterValues["barangay"] !== "all"
      ? filterValues["barangay"]
      : null;
  const activeBarangay =
    geoLevel === "barangay"
      ? geoBarangay
      : cityFilterBarangayId
        ? (data.barangays.find((b) => b.id === cityFilterBarangayId) ?? null)
        : null;

  const kpi = levelKpisFor(geoLevel, data, geoBarangay);

  const entityName =
    geoLevel === "barangay"
      ? geoBarangay.name
      : geoLevel === "city"
        ? "Cebu City"
        : geoLevel === "provincial"
          ? CEBU_PROVINCE_TOTAL.name
          : PHILIPPINES_TOTAL.name;
  const entityPopulation =
    geoLevel === "barangay"
      ? geoBarangay.population
      : geoLevel === "provincial"
        ? CEBU_PROVINCE_TOTAL.population
        : geoLevel === "national"
          ? PHILIPPINES_TOTAL.population
          : data.totalPopulation;

  // ---- Zone B breakdown (choropleth-style list) — same component, different roll-up ----
  const metricDef = CHOROPLETH_METRICS.find((m) => m.key === metric)!;
  const alertThresholds: Partial<Record<ChoroplethMetricKey, number>> = {
    dengueCases: 10,
    tbCases: 20,
  };
  const alertLimit = alertThresholds[metric];

  let breakdownEntities: MetricSource[];
  let breakdownTitle: string;
  let breakdownHint: string;
  let breakdownRangeNote: string;
  let clickKind: "barangay" | "jurisdiction";
  if (geoLevel === "barangay") {
    breakdownEntities = [geoBarangay];
    breakdownTitle = "Your barangay";
    breakdownHint = "Scoped to your barangay only.";
    breakdownRangeNote = "your barangay only";
    clickKind = "barangay";
  } else if (geoLevel === "city") {
    breakdownEntities = data.barangays;
    breakdownTitle = "Barangay health map";
    breakdownHint = "Click a barangay for its full health profile.";
    breakdownRangeNote = "across 15 barangays";
    clickKind = "barangay";
  } else if (geoLevel === "provincial") {
    breakdownEntities = CEBU_PROVINCE_CITIES;
    breakdownTitle = "City / municipality health map";
    breakdownHint = "Click a city or municipality for its aggregate profile.";
    breakdownRangeNote = `across ${CEBU_PROVINCE_CITIES.length} cities/municipalities`;
    clickKind = "jurisdiction";
  } else {
    breakdownEntities = PH_REGIONS;
    breakdownTitle = "Regional health map";
    breakdownHint = "Click a region for its aggregate profile.";
    breakdownRangeNote = `across ${PH_REGIONS.length} regions`;
    clickKind = "jurisdiction";
  }
  const breakdownValues = breakdownEntities.map((e) => e[metric]);
  const maxValue = Math.max(...breakdownValues, 1);
  const choroplethData: BarangayDatum[] = breakdownEntities.map((e) =>
    toDatum(e, metric, metricDef.unit, alertLimit),
  );

  // ---- Zone C: epidemic curve, scaled to the jurisdiction's population ----
  const epiPopulationRatio =
    geoLevel === "barangay"
      ? geoBarangay.population / data.totalPopulation
      : geoLevel === "provincial"
        ? CEBU_PROVINCE_TOTAL.population / data.totalPopulation
        : geoLevel === "national"
          ? PHILIPPINES_TOTAL.population / data.totalPopulation
          : 1;
  const epiCurveSource = geoLevel === "city" ? data.epiCurve : scaleEpiCurve(epiPopulationRatio);

  const epiWindowSize = Math.min(zoomWindowSize[epiZoomPreset], epiCurveSource.length);
  const epiMaxOffset = epiCurveSource.length - epiWindowSize;
  const epiClampedOffset = Math.min(Math.max(epiZoomOffset, 0), epiMaxOffset);
  const epiCurveWindow = epiCurveSource.slice(
    epiCurveSource.length - epiWindowSize - epiClampedOffset,
    epiCurveSource.length - epiClampedOffset,
  );
  const epiIsZoomed = epiWindowSize < epiCurveSource.length || epiClampedOffset > 0;
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

  // ---- Zone C: morbidity ranking — jurisdiction roll-up, else existing city/barangay logic ----
  const morbidityRows = ageGroup === "all" ? data.morbidity.allAges : data.morbidity.under5;
  const morbiditySorted = [...morbidityRows].sort((a, b) => b.current - a.current);
  const jurisdictionMorbidityRows =
    geoLevel === "provincial"
      ? jurisdictionMorbidity(CEBU_PROVINCE_TOTAL.population)
      : geoLevel === "national"
        ? jurisdictionMorbidity(PHILIPPINES_TOTAL.population)
        : null;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-brand">
            {meta.role} · {meta.jurisdiction} jurisdiction
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
            {entityName} Health Dashboard
          </h1>
          <p className="text-sm text-text-muted">
            {data.period} · compared with {data.priorPeriod} · population {num(entityPopulation)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            <RoleSwitcher role={role} onChange={setRole} />
            <StatusBadge tone="neutral">{data.role} view</StatusBadge>
          </div>
          <GeoLevelSwitcher
            geoLevel={geoLevel}
            onGeoLevelChange={setGeoLevel}
            barangayId={effectiveGeoBarangayId}
            onBarangayChange={setGeoBarangayId}
            barangayOptions={barangayOptions}
          />
        </div>
      </header>

      {geoLevel === "city" ? (
        <GlobalFilterBar
          filters={[{ key: "barangay", label: "Barangay", options: barangayOptions }]}
          values={filterValues}
          onChange={(key, value) => setFilterValues((v) => ({ ...v, [key]: value }))}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand/30 bg-brand/5 p-2.5 text-xs text-text-secondary">
          <span className="font-medium text-brand">{meta.role} view:</span>
          you're seeing {meta.jurisdiction.toLowerCase()}-level data for{" "}
          <span className="font-medium">{entityName}</span>. Switch level above to change
          jurisdiction.
          {geoLevel !== "barangay" ? (
            <span className="text-text-muted">
              {" "}
              Provincial/national figures are aggregate estimates scaled from Cebu City's modeled
              rates, not independently surveyed data.
            </span>
          ) : null}
        </div>
      )}

      {geoLevel === "city" && data.outbreaks.length > 0 ? (
        <OutbreakBanner diseases={data.outbreaks} />
      ) : null}

      {/* ZONE A — KPI strip (8 cards) — same cards at every jurisdiction level */}
      <section className="space-y-3">
        <SectionTitle
          title="Key performance indicators"
          description="Month to date, drill any card for detail."
        />
        <KpiStrip>
          <MetricCard
            label="Total Konsulta Visits (MTD)"
            value={num(kpi.konsultaVisits)}
            delta={data.konsultaVisits.deltaMonth}
            secondary={`+${data.konsultaVisits.deltaYear}% vs same month last year`}
            status="neutral"
            icon={Stethoscope}
            onClick={() => setDrill({ kind: "kpi", id: "konsulta" })}
          />
          <MetricCard
            label="PhilHealth Konsulta Claims (eKAS)"
            value={num(kpi.ekasSubmitted)}
            delta={data.ekas.delta}
            secondary={php(kpi.ekasValue, { compact: true })}
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
            value={num(kpi.tbActiveCases)}
            delta={data.tbDots.delta}
            invertDelta
            secondary={`${pct(kpi.tbSuccessRate)} treatment success`}
            status={kpi.tbSuccessRate >= 90 ? "good" : "warning"}
            icon={Activity}
            onClick={() => setDrill({ kind: "kpi", id: "tb" })}
          />
          <MetricCard
            label="Immunization Coverage Rate"
            value={pct(kpi.immunizationCoverage)}
            delta={data.immunization.delta}
            secondary="Herd immunity target ≥95%"
            status={coverageStatus(kpi.immunizationCoverage, 95, 80)}
            icon={Syringe}
            onClick={() => setDrill({ kind: "kpi", id: "immunization" })}
          />
          <MetricCard
            label="Maternal Care Coverage"
            value={pct(kpi.maternalCoverage)}
            delta={data.maternalCoverage.delta}
            secondary="≥4 ANC visits, target ≥80%"
            status={coverageStatus(kpi.maternalCoverage, 80, 60)}
            icon={Baby}
            onClick={() => setDrill({ kind: "kpi", id: "maternal" })}
          />
          <MetricCard
            label="Hypertension Control Rate"
            value={pct(kpi.htnControl)}
            delta={data.htnControl.delta}
            secondary="BP <140/90, target ≥50%"
            status={coverageStatus(kpi.htnControl, 50, 30)}
            icon={HeartPulse}
            onClick={() => setDrill({ kind: "kpi", id: "htn" })}
          />
          <MetricCard
            label="Diabetes Control Rate"
            value={pct(kpi.dmControl)}
            delta={data.dmControl.delta}
            secondary="HbA1c <7%, target ≥50%"
            status={coverageStatus(kpi.dmControl, 50, 30)}
            icon={HeartPulse}
            onClick={() => setDrill({ kind: "kpi", id: "dm" })}
          />
          <MetricCard
            label="Referral Completion Rate"
            value={pct(kpi.referralCompletion)}
            delta={data.referralCompletion.delta}
            secondary="Outcome documented, target ≥80%"
            status={coverageStatus(kpi.referralCompletion, 80, 60)}
            icon={Send}
            onClick={() => setDrill({ kind: "kpi", id: "referral" })}
          />
        </KpiStrip>
      </section>

      {/* ZONE B — jurisdiction breakdown map — same component at every level */}
      <section className="space-y-3">
        <SectionTitle
          title={breakdownTitle}
          description={breakdownHint}
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
          description={`Range: 0 – ${maxValue}${metricDef.unit} ${breakdownRangeNote}`}
        >
          <BarangayChoropleth
            data={choroplethData}
            maxValue={maxValue}
            onSelect={(d) => setDrill({ kind: clickKind, id: d.id })}
          />
        </PanelCard>
      </section>

      {/* ZONE C — disease surveillance — same two charts at every level */}
      <section className="grid gap-4 xl:grid-cols-3">
        <InteractiveChartCard
          title="Epidemic Curve"
          description={`New cases by ${epiGranularity} · dengue vs prior-year baseline${geoLevel !== "city" ? " · scaled estimate" : ""}`}
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
            jurisdictionMorbidityRows
              ? `${entityName} · national ICD-10 ranking, scaled estimate`
              : activeBarangay
                ? `${activeBarangay.name} · top diagnoses this month`
                : "Current month vs prior periods"
          }
          table={{
            columns: morbidityTableColumns,
            rows: jurisdictionMorbidityRows
              ? jurisdictionMorbidityRows.map((m) => ({
                  code: m.code,
                  description: m.description,
                  count: m.current,
                }))
              : activeBarangay
                ? activeBarangay.topDiagnoses
                : morbiditySorted.map((m) => ({
                    code: m.code,
                    description: m.description,
                    count: m.current,
                  })),
          }}
          action={
            !jurisdictionMorbidityRows && !activeBarangay ? (
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
              data={
                jurisdictionMorbidityRows
                  ? jurisdictionMorbidityRows
                  : activeBarangay
                    ? activeBarangay.topDiagnoses
                    : morbiditySorted
              }
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
                dataKey={jurisdictionMorbidityRows || activeBarangay ? "count" : "current"}
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

      <ExecutiveDrillDrawer
        data={data}
        drill={drill}
        onClose={() => setDrill(null)}
        geoLevel={geoLevel}
        kpi={kpi}
        entityName={entityName}
      />
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

function ExecutiveDrillDrawer({
  data,
  drill,
  onClose,
  geoLevel,
  kpi,
  entityName,
}: {
  data: LguExecutiveData;
  drill: Drill;
  onClose: () => void;
  geoLevel: GeoLevel;
  kpi: LevelKpis;
  entityName: string;
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
      body = <BarangayProfilePanel b={b} />;
    }
  } else if (drill?.kind === "jurisdiction") {
    const r = [...CEBU_PROVINCE_CITIES, ...PH_REGIONS].find((x) => x.id === drill.id);
    if (r) {
      title = `${r.name} Health Profile`;
      description = `Population ${num(r.population)} · aggregate estimate`;
      body = <JurisdictionProfilePanel r={r} />;
    }
  } else if (drill?.kind === "kpi") {
    if (geoLevel !== "city") {
      switch (drill.id) {
        case "konsulta":
          title = "Total Konsulta Visits (MTD)";
          description = `${num(kpi.konsultaVisits)} visits (est.) · ${entityName}`;
          break;
        case "ekas":
          title = "PhilHealth Konsulta Claims (eKAS)";
          description = `${num(kpi.ekasSubmitted)} submitted (est.) · ${php(kpi.ekasValue, { compact: true })}`;
          break;
        case "tb":
          title = "Active TB Cases Under DOTS";
          description = `${num(kpi.tbActiveCases)} active cases (est.) · ${pct(kpi.tbSuccessRate)} success rate`;
          break;
        case "immunization":
          title = "Immunization Coverage Rate";
          description = `${pct(kpi.immunizationCoverage)} of target population (est.)`;
          break;
        case "maternal":
          title = "Maternal Care Coverage";
          description = `${pct(kpi.maternalCoverage)} with ≥4 ANC visits (est.)`;
          break;
        case "htn":
          title = "Hypertension Control Rate";
          description = `${pct(kpi.htnControl)} of known hypertensives with BP <140/90 (est.)`;
          break;
        case "dm":
          title = "Diabetes Control Rate";
          description = `${pct(kpi.dmControl)} of known diabetics with HbA1c <7% (est.)`;
          break;
        case "referral":
          title = "Referral Completion Rate";
          description = `${pct(kpi.referralCompletion)} of referrals documented (est.)`;
          break;
      }
      body = (
        <p className="text-sm text-text-secondary">
          Aggregate estimate for {entityName}, scaled from Cebu City's modeled rates. Switch to
          Mayor / CHO above for the fully detailed, drill-through breakdown.
        </p>
      );
    } else {
      fullReportHref = reportHrefForKpi(drill.id);
      switch (drill.id) {
        case "konsulta":
          title = "Total Konsulta Visits (MTD)";
          description = `${num(data.konsultaVisits.total)} visits · +${data.konsultaVisits.deltaMonth}% vs prior month`;
          body = (
            <div className="space-y-5">
              <div>
                <p className="mb-1 text-xs font-medium text-text-secondary">
                  Visits by day of week
                </p>
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
                <p className="mb-1 text-xs font-medium text-text-secondary">
                  By risk classification
                </p>
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
    }
  } else if (drill?.kind === "morbidity") {
    title = "Morbidity detail";
    description = "Click a row in Zone B for a jurisdiction-level diagnosis breakdown.";
    fullReportHref = "/lgu/reports/fhsis-monthly";
    body = <p className="text-sm text-text-secondary">Full ranking shown in Zone C.</p>;
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

function BarangayProfilePanel({ b }: { b: BarangayMetricSet }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

function JurisdictionProfilePanel({ r }: { r: JurisdictionRow }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Population" value={num(r.population)} />
        <StatCard label="Konsulta visits (est.)" value={num(r.konsultaVisits)} />
        <StatCard label="Active TB cases (est.)" value={num(r.tbActiveCases)} />
        <StatCard label="eKAS claims (est.)" value={num(r.ekasSubmitted)} />
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-text-secondary">
          Coverage & control rates (est.)
        </p>
        <StatRow label="Immunization coverage" value={pct(r.immunizationCoverage, 0)} />
        <StatRow label="Maternal care coverage" value={pct(r.maternalCoverage, 0)} />
        <StatRow label="Hypertension control" value={pct(r.htnControl, 0)} />
        <StatRow label="Diabetes control" value={pct(r.dmControl, 0)} />
        <StatRow label="Referral completion" value={pct(r.referralCompletion, 0)} />
        <StatRow label="TB treatment success" value={pct(r.tbTreatmentSuccessRate, 0)} />
      </div>
      <p className="text-[11px] text-text-muted">
        Aggregate estimate scaled from Cebu City's modeled rates — not an independently surveyed
        dataset.
      </p>
    </div>
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
