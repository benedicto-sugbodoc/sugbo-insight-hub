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
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  BulletRow,
  DrillDrawer,
  LegendDot,
  PanelCard,
  SectionTitle,
  Sparkline,
  StatRow,
  StatusBadge,
  brandRamp,
  num,
  pct,
  php,
  PALETTE,
} from "@/components/analytics/shared";
import { fetchClinicalData, type ClinicalData, DEPT_COLOR_MAP } from "@/lib/analytics/clinical.mock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/analytics/clinical")({
  head: () => ({
    meta: [
      { title: "Clinical Analytics — SugboDoc" },
      {
        name: "description",
        content:
          "Clinical analytics: disease burden, procedures, surgical performance, patient outcomes and referral flow for hospital leadership.",
      },
      { property: "og:title", content: "Clinical Analytics — SugboDoc" },
      {
        property: "og:description",
        content: "Level 3 hospital clinical dashboard: ICD-10 trends, surgical KPIs, outcomes and referrals.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClinicalPage,
});

type Drill =
  | { kind: "heatmapCell"; department: string; month: string }
  | { kind: "comorbidity"; id: string }
  | { kind: "procedure"; name: string }
  | { kind: "surgeon"; name: string }
  | { kind: "readmission" }
  | { kind: "referral"; source: string; target: string }
  | null;

function ClinicalSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-72 animate-pulse rounded bg-muted" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-64 w-full animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}

function heatColor(count: number, max: number) {
  const t = Math.max(0, Math.min(1, count / max));
  const from = [255, 255, 255];
  const to = [0x44, 0x54, 0xc3];
  const rgb = from.map((c, i) => Math.round(c + ((to[i] ?? c) - c) * t));
  return `rgb(${rgb.join(",")})`;
}

function ClinicalPage() {
  const { data, isLoading } = useQuery({ queryKey: ["analytics", "clinical"], queryFn: fetchClinicalData });
  const [drill, setDrill] = React.useState<Drill>(null);
  const [selectedCodes, setSelectedCodes] = React.useState<string[]>([]);
  const [trendMode, setTrendMode] = React.useState<"count" | "rate">("count");
  const [codePickerOpen, setCodePickerOpen] = React.useState(false);
  const [orView, setOrView] = React.useState("daily");

  React.useEffect(() => {
    if (data && selectedCodes.length === 0) {
      setSelectedCodes(data.diseaseTrends.slice(0, 3).map((s) => s.code));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (isLoading || !data) return <ClinicalSkeleton />;

  const maxHeat = Math.max(...data.heatmap.map((c) => c.count));
  const depts = Array.from(new Set(data.heatmap.map((c) => c.department)));
  const cellFor = (dept: string, month: string) => data.heatmap.find((c) => c.department === dept && c.month === month);

  const trendSeries = data.diseaseTrends.filter((s) => selectedCodes.includes(s.code));
  const trendChartData = data.heatmapMonths.map((month) => {
    const row: Record<string, string | number> = { month };
    trendSeries.forEach((s) => {
      const pt = s.points.find((p) => p.month === month);
      row[s.code] = trendMode === "count" ? (pt?.count ?? 0) : (pt?.ratePer1000 ?? 0);
    });
    return row;
  });

  function toggleCode(code: string) {
    setSelectedCodes((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      if (prev.length >= 5) return prev;
      return [...prev, code];
    });
  }

  function exportCsv() {
    const header = ["month", ...trendSeries.map((s) => s.code)].join(",");
    const rows = trendChartData.map((row) => [row["month"], ...trendSeries.map((s) => row[s.code] ?? 0)].join(","));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "disease-trend-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const heatmapDrillCases = React.useMemo(() => {
    if (!drill || drill.kind !== "heatmapCell") return [];
    return data.heatmapDrill[`${drill.department}__${drill.month}`] ?? [];
  }, [drill, data]);

  const comorbidityBubble = drill?.kind === "comorbidity" ? data.comorbidity.find((c) => c.id === drill.id) : undefined;
  const surgeon = drill?.kind === "surgeon" ? data.surgeons.find((s) => s.name === drill.name) : undefined;
  const procedureNode =
    drill?.kind === "procedure"
      ? data.procedures.flatMap((c) => c.children).find((p) => p.name === drill.name)
      : undefined;
  const referralCases = drill?.kind === "referral" ? data.referralCases[`${drill.source}__${drill.target}`] ?? [] : [];

  const orRooms = data.orRooms;
  const timelineHours = Array.from({ length: 12 }, (_, i) => 7 + i);

  const dischargeTotal = (row: (typeof data.discharge)[number]) =>
    row.Recovered + row.Improved + row.Transferred + row.HAMA + row.Expired;

  const sankeySources = Array.from(new Set(data.referralFlow.map((l) => l.source)));
  const sankeyTargets = Array.from(new Set(data.referralFlow.map((l) => l.target)));
  const linkKindColor: Record<string, string> = { internal: PALETTE.brand, external: PALETTE.success, emergency: PALETTE.danger };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-brand">{data.tenant} · Level 3 Hospital</p>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Clinical Analytics</h1>
          <p className="text-sm text-text-muted">{data.period} · disease burden, surgical performance, outcomes and referrals</p>
        </div>
        <StatusBadge tone="neutral">Medical Director / Department Heads / Quality Officer view</StatusBadge>
      </header>

      {/* SECTION A — Diagnosis & Disease Burden */}
      <section className="space-y-4">
        <SectionTitle title="Diagnosis & Disease Burden" description="ICD-10 case volume, trend analysis and comorbidity clustering" />

        <PanelCard title="ICD-10 Case Heatmap" description="Department × month · click a cell to drill into cases">
          <div className="overflow-x-auto">
            <div className="grid min-w-[760px]" style={{ gridTemplateColumns: `140px repeat(${data.heatmapMonths.length}, 1fr)` }}>
              <div />
              {data.heatmapMonths.map((m) => (
                <div key={m} className="px-1 pb-1 text-center text-[10px] font-medium text-text-muted">
                  {m}
                </div>
              ))}
              {depts.map((dept) => (
                <React.Fragment key={dept}>
                  <div className="flex items-center pr-2 text-xs font-medium text-text-secondary">{dept}</div>
                  {data.heatmapMonths.map((month) => {
                    const cell = cellFor(dept, month);
                    const count = cell?.count ?? 0;
                    return (
                      <button
                        key={`${dept}-${month}`}
                        onClick={() => setDrill({ kind: "heatmapCell", department: dept, month })}
                        className="m-0.5 flex h-9 items-center justify-center rounded text-[11px] font-medium transition-transform hover:scale-105"
                        style={{ backgroundColor: heatColor(count, maxHeat), color: count / maxHeat > 0.55 ? "white" : "#333" }}
                        title={`${dept} · ${month}: ${count} cases`}
                      >
                        {count}
                      </button>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </PanelCard>

        <div className="grid gap-4 xl:grid-cols-2">
          <PanelCard
            title="Disease Trend Analysis"
            description="Select up to 5 ICD-10 codes to compare"
            action={
              <div className="flex flex-wrap items-center gap-2">
                <Tabs value={trendMode} onValueChange={(v) => setTrendMode(v as "count" | "rate")}>
                  <TabsList className="h-7">
                    <TabsTrigger value="count" className="text-xs">Count</TabsTrigger>
                    <TabsTrigger value="rate" className="text-xs">Rate / 1000</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Popover open={codePickerOpen} onOpenChange={setCodePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      Codes ({selectedCodes.length}/5)
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72">
                    <div className="max-h-64 space-y-1 overflow-y-auto">
                      {data.diseaseTrends.map((s) => (
                        <label key={s.code} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
                          <Checkbox
                            checked={selectedCodes.includes(s.code)}
                            onCheckedChange={() => toggleCode(s.code)}
                            disabled={!selectedCodes.includes(s.code) && selectedCodes.length >= 5}
                          />
                          <span className="font-medium text-text-primary">{s.code}</span>
                          <span className="truncate text-xs text-text-muted">{s.description}</span>
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={exportCsv}>
                  <Download className="size-3.5" /> Export CSV
                </Button>
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trendChartData} margin={{ left: -12, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {trendSeries.map((s) => (
                  <Line key={s.code} type="monotone" dataKey={s.code} name={`${s.code}`} stroke={s.color} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </PanelCard>

          <PanelCard title="Comorbidity Clustering" description="Frequency vs LOS · bubble size = mortality rate · click to drill">
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" dataKey="frequency" name="Frequency" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} label={{ value: "Diagnosis frequency", fontSize: 11, position: "insideBottom", offset: -4 }} />
                <YAxis type="number" dataKey="avgLos" name="Avg LOS" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} label={{ value: "Avg LOS (days)", angle: -90, fontSize: 11 }} />
                <ZAxis type="number" dataKey="mortalityRate" range={[80, 500]} name="Mortality rate" />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(value: number, name: string) => [name === "Mortality rate" ? `${value}%` : value, name]}
                  labelFormatter={() => ""}
                />
                <Scatter
                  data={data.comorbidity}
                  onClick={(entry) => setDrill({ kind: "comorbidity", id: (entry as unknown as { id: string }).id })}
                  cursor="pointer"
                >
                  {data.comorbidity.map((c) => (
                    <Cell key={c.id} fill={c.color} fillOpacity={0.75} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(DEPT_COLOR_MAP).map(([dept, color]) => (
                <LegendDot key={dept} color={color} label={dept} />
              ))}
            </div>
          </PanelCard>
        </div>
      </section>

      {/* SECTION B — Procedure & Surgical */}
      <section className="space-y-4">
        <SectionTitle title="Procedure & Surgical" description="Volume, revenue mix, surgeon performance and OR utilization" />

        <PanelCard title="Procedure Volume & Revenue" description="Category → procedure · size = volume · color intensity = revenue · click to drill">
          <ResponsiveContainer width="100%" height={300}>
            <Treemap
              data={data.procedures.map((c) => ({
                name: c.category,
                children: c.children.map((p) => ({ ...p, size: p.volume })),
              }))}
              dataKey="size"
              stroke="#fff"
              content={renderProcedureCell((name: string) => setDrill({ kind: "procedure", name }))}
            />
          </ResponsiveContainer>
        </PanelCard>

        <PanelCard
          title="Surgeon Performance"
          description="Click a row for the surgeon's full case history"
          action={<StatusBadge tone="warning">Visible to Medical Director and Admin only</StatusBadge>}
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Surgeon</TableHead>
                  <TableHead className="text-right text-xs">Cases</TableHead>
                  <TableHead className="text-right text-xs">Avg LOS</TableHead>
                  <TableHead className="text-right text-xs">Complication %</TableHead>
                  <TableHead className="text-right text-xs">Mortality %</TableHead>
                  <TableHead className="text-right text-xs">Avg OR Time</TableHead>
                  <TableHead className="text-right text-xs">Trend</TableHead>
                  <TableHead className="text-right text-xs">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.surgeons.map((s) => (
                  <TableRow
                    key={s.name}
                    className="cursor-pointer"
                    onClick={() => setDrill({ kind: "surgeon", name: s.name })}
                  >
                    <TableCell className="text-sm font-medium text-text-primary">
                      {s.name}
                      <div className="text-[11px] font-normal text-text-muted">{s.department}</div>
                    </TableCell>
                    <TableCell className="text-right text-sm">{num(s.cases)}</TableCell>
                    <TableCell className="text-right text-sm">{s.avgLos}d</TableCell>
                    <TableCell className={cn("text-right text-sm", s.complicationRate > 4 ? "text-warning" : "text-text-primary")}>
                      {pct(s.complicationRate)}
                    </TableCell>
                    <TableCell className={cn("text-right text-sm", s.mortalityRate > 1.5 ? "text-danger" : "text-text-primary")}>
                      {pct(s.mortalityRate)}
                    </TableCell>
                    <TableCell className="text-right text-sm">{s.avgOrTimeMin} min</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end"><Sparkline data={s.trend} color={PALETTE.brand} /></div>
                    </TableCell>
                    <TableCell className="text-right text-sm">{php(s.revenue, { compact: true })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </PanelCard>

        <PanelCard
          title="OR Utilization"
          description="Procedure blocks per room and utilization rate"
          action={
            <Tabs value={orView} onValueChange={setOrView}>
              <TabsList className="h-7">
                <TabsTrigger value="daily" className="text-xs">Daily</TabsTrigger>
                <TabsTrigger value="weekly" className="text-xs">Weekly</TabsTrigger>
                <TabsTrigger value="monthly" className="text-xs">Monthly</TabsTrigger>
              </TabsList>
            </Tabs>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-[70px_1fr] gap-2 text-[10px] text-text-muted">
              <div />
              <div className="grid" style={{ gridTemplateColumns: `repeat(${timelineHours.length}, 1fr)` }}>
                {timelineHours.map((h) => (
                  <div key={h} className="text-center">{h}:00</div>
                ))}
              </div>
            </div>
            {orRooms.map((room) => (
              <div key={room.room} className="grid grid-cols-[70px_1fr] items-center gap-2">
                <div className="text-xs font-medium text-text-secondary">{room.room}</div>
                <div className="relative h-8 rounded bg-muted">
                  {room.blocks.map((b, i) => {
                    const left = ((b.startHour - timelineHours[0]!) / timelineHours.length) * 100;
                    const width = (b.durationHours / timelineHours.length) * 100;
                    return (
                      <div
                        key={i}
                        title={`${b.procedure} · ${b.surgeon} · ${b.durationHours}h`}
                        className="absolute top-0.5 h-7 rounded px-1.5 text-[10px] font-medium leading-7 text-white"
                        style={{ left: `${left}%`, width: `${width}%`, backgroundColor: PALETTE.brand }}
                      >
                        <span className="truncate">{b.procedure}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="grid gap-3 pt-2 sm:grid-cols-2 lg:grid-cols-4">
              {orRooms.map((room) => (
                <div key={room.room} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary">{room.room} utilization</span>
                    <span className="font-medium text-text-primary">{pct(room.utilizationPct)}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${room.utilizationPct}%`, backgroundColor: room.utilizationPct > 80 ? PALETTE.success : room.utilizationPct > 60 ? PALETTE.warning : PALETTE.danger }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </PanelCard>
      </section>

      {/* SECTION C — Patient Outcomes */}
      <section className="space-y-4">
        <SectionTitle title="Patient Outcomes" description="Discharge disposition, readmissions and HAMA analysis" />

        <div className="grid gap-4 xl:grid-cols-2">
          <PanelCard title="Discharge Disposition" description="100% stacked by month">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.discharge.map((d) => ({
                month: d.month,
                Recovered: (d.Recovered / dischargeTotal(d)) * 100,
                Improved: (d.Improved / dischargeTotal(d)) * 100,
                Transferred: (d.Transferred / dischargeTotal(d)) * 100,
                HAMA: (d.HAMA / dischargeTotal(d)) * 100,
                Expired: (d.Expired / dischargeTotal(d)) * 100,
              }))} margin={{ left: -12, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={36} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number, n: string) => [`${v.toFixed(1)}%`, n]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar stackId="d" dataKey="Recovered" fill={PALETTE.success} />
                <Bar stackId="d" dataKey="Improved" fill={PALETTE.brand} />
                <Bar stackId="d" dataKey="Transferred" fill={PALETTE.hmo} />
                <Bar stackId="d" dataKey="HAMA" fill={PALETTE.warning} />
                <Bar stackId="d" dataKey="Expired" fill={PALETTE.danger} />
              </BarChart>
            </ResponsiveContainer>
          </PanelCard>

          <PanelCard title="30-Day Readmission Rate" description="Target bands: <5% good, 5–10% caution, >10% high · click to drill">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.readmission} margin={{ left: -12, right: 8, top: 8 }} onClick={() => setDrill({ kind: "readmission" })}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <ReferenceArea y1={0} y2={5} fill={PALETTE.success} fillOpacity={0.08} />
                <ReferenceArea y1={5} y2={10} fill={PALETTE.warning} fillOpacity={0.1} />
                <ReferenceArea y1={10} y2={20} fill={PALETTE.danger} fillOpacity={0.08} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={36} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => [`${v}%`, "Readmission rate"]} />
                <Line type="monotone" dataKey="rate" stroke={PALETTE.brand} strokeWidth={2} dot={{ r: 3, cursor: "pointer" }} />
              </LineChart>
            </ResponsiveContainer>
            <p className="mt-1 text-[11px] text-text-muted">Click any point on the line or chart area to view readmitted patients.</p>
          </PanelCard>
        </div>

        <PanelCard title="HAMA Rate by Department" description="Home Against Medical Advice · insight linking financial barriers">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.hamaByDept} layout="vertical" margin={{ left: 10, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} />
              <YAxis type="category" dataKey="department" width={140} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => [`${v}%`, "HAMA rate"]} />
              <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                {data.hamaByDept.map((d) => (
                  <Cell key={d.department} fill={d.rate > 6 ? PALETTE.danger : d.rate > 4 ? PALETTE.warning : PALETTE.brand} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-text-secondary">
            Departments with elevated HAMA rates (Orthopedics, Cardiology, Emergency Medicine) correlate strongly with
            out-of-pocket cost concerns. Recommend proactive Social Welfare and PhilHealth benefit-eligibility screening
            at admission for these services.
          </div>
        </PanelCard>
      </section>

      {/* SECTION D — Referrals */}
      <section className="space-y-4">
        <SectionTitle title="Referrals" description="Referral flow across the network and specialty responsiveness" />

        <PanelCard title="Referral Flow" description="Source → destination · thickness = volume · click a link for detail">
          <ReferralSankey
            sources={sankeySources}
            targets={sankeyTargets}
            links={data.referralFlow}
            colorFor={(kind) => linkKindColor[kind] ?? PALETTE.brand}
            onSelect={(source, target) => setDrill({ kind: "referral", source, target })}
          />
          <div className="mt-2 flex flex-wrap gap-3">
            <LegendDot color={PALETTE.brand} label="Internal" />
            <LegendDot color={PALETTE.success} label="External" />
            <LegendDot color={PALETTE.danger} label="Emergency" />
          </div>
        </PanelCard>

        <PanelCard title="Referral Acceptance Rate by Specialty" description="Target 80% acceptance · avg response time shown per row">
          <div className="space-y-4">
            {data.specialtyAcceptance.map((s) => (
              <div key={s.specialty} className="space-y-1">
                <BulletRow label={s.specialty} value={s.acceptanceRate} target={80} max={100} suffix="%" />
                <p className="text-[11px] text-text-muted">Avg response time: {s.avgResponseHours}h</p>
              </div>
            ))}
          </div>
        </PanelCard>
      </section>

      {/* Drawers */}
      <DrillDrawer
        open={drill?.kind === "heatmapCell"}
        onOpenChange={(o) => !o && setDrill(null)}
        title={drill?.kind === "heatmapCell" ? `${drill.department} · ${drill.month}` : ""}
        description="Case list, physician distribution and outcomes"
      >
        {drill?.kind === "heatmapCell" ? (
          <div className="space-y-3">
            <StatRow label="Total cases" value={num(heatmapDrillCases.length)} />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Encounter</TableHead>
                  <TableHead className="text-xs">Patient</TableHead>
                  <TableHead className="text-xs">Physician</TableHead>
                  <TableHead className="text-xs">ICD-10</TableHead>
                  <TableHead className="text-xs">Outcome</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {heatmapDrillCases.map((c) => (
                  <TableRow key={c.encounterId}>
                    <TableCell className="text-xs">{c.encounterId}</TableCell>
                    <TableCell className="text-xs">{c.patient}</TableCell>
                    <TableCell className="text-xs">{c.physician}</TableCell>
                    <TableCell className="text-xs">{c.icd10}</TableCell>
                    <TableCell className="text-xs">{c.outcome}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </DrillDrawer>

      <DrillDrawer
        open={drill?.kind === "comorbidity"}
        onOpenChange={(o) => !o && setDrill(null)}
        title={comorbidityBubble ? `${comorbidityBubble.primaryDx} + ${comorbidityBubble.comorbidDx}` : ""}
        description="Comorbidity cohort summary"
      >
        {comorbidityBubble ? (
          <div className="space-y-1">
            <StatRow label="Department" value={comorbidityBubble.department} />
            <StatRow label="Cohort size" value={num(comorbidityBubble.frequency)} />
            <StatRow label="Average LOS" value={`${comorbidityBubble.avgLos} days`} />
            <StatRow label="Mortality rate" value={pct(comorbidityBubble.mortalityRate)} />
          </div>
        ) : null}
      </DrillDrawer>

      <DrillDrawer
        open={drill?.kind === "procedure"}
        onOpenChange={(o) => !o && setDrill(null)}
        title={procedureNode?.name ?? ""}
        description="Procedure volume and revenue detail"
      >
        {procedureNode ? (
          <div className="space-y-1">
            <StatRow label="Category" value={procedureNode.category} />
            <StatRow label="Volume (MTD)" value={num(procedureNode.volume)} />
            <StatRow label="Avg revenue / case" value={php(procedureNode.avgRevenuePerCase, { compact: true })} />
            <StatRow label="Total revenue" value={php(procedureNode.revenue, { compact: true })} />
          </div>
        ) : null}
      </DrillDrawer>

      <DrillDrawer
        open={drill?.kind === "surgeon"}
        onOpenChange={(o) => !o && setDrill(null)}
        title={surgeon?.name ?? ""}
        description="Surgeon performance profile"
      >
        {surgeon ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <StatRow label="Department" value={surgeon.department} />
              <StatRow label="Cases (MTD)" value={num(surgeon.cases)} />
              <StatRow label="Average LOS" value={`${surgeon.avgLos} days`} />
              <StatRow label="Complication rate" value={pct(surgeon.complicationRate)} />
              <StatRow label="Mortality rate" value={pct(surgeon.mortalityRate)} />
              <StatRow label="Average OR time" value={`${surgeon.avgOrTimeMin} min`} />
              <StatRow label="Revenue (MTD)" value={php(surgeon.revenue, { compact: true })} />
            </div>
            <div>
              <p className="mb-1 text-xs text-text-muted">Case volume trend</p>
              <Sparkline data={surgeon.trend} color={PALETTE.brand} width={220} height={48} />
            </div>
            <Badge variant="outline" className="border-warning/30 bg-warning/10 text-[11px] text-warning">
              Confidential — Medical Director / Admin access only
            </Badge>
          </div>
        ) : null}
      </DrillDrawer>

      <DrillDrawer
        open={drill?.kind === "readmission"}
        onOpenChange={(o) => !o && setDrill(null)}
        title="Readmitted Patients"
        description="Grouped by original diagnosis, department and attending physician"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Patient</TableHead>
              <TableHead className="text-xs">Original Dx</TableHead>
              <TableHead className="text-xs">Department</TableHead>
              <TableHead className="text-xs">Physician</TableHead>
              <TableHead className="text-right text-xs">Days to readmit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.readmissionCases.map((c, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs">{c.patient}</TableCell>
                <TableCell className="text-xs">{c.originalDx}</TableCell>
                <TableCell className="text-xs">{c.department}</TableCell>
                <TableCell className="text-xs">{c.physician}</TableCell>
                <TableCell className="text-right text-xs">{c.daysToReadmit}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DrillDrawer>

      <DrillDrawer
        open={drill?.kind === "referral"}
        onOpenChange={(o) => !o && setDrill(null)}
        title={drill?.kind === "referral" ? `${drill.source} → ${drill.target}` : ""}
        description="Referral list and status breakdown"
      >
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(["Accepted", "Pending", "Declined", "Completed"] as const).map((status) => (
              <StatusBadge
                key={status}
                tone={status === "Accepted" || status === "Completed" ? "good" : status === "Pending" ? "warning" : "danger"}
              >
                {status}: {referralCases.filter((c) => c.status === status).length}
              </StatusBadge>
            ))}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Patient</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {referralCases.map((c, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs">{c.patient}</TableCell>
                  <TableCell className="text-xs">{c.status}</TableCell>
                  <TableCell className="text-xs">{c.date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DrillDrawer>
    </div>
  );
}

/** Custom treemap cell renderer factory: category header depth vs procedure leaf depth. */
function renderProcedureCell(onSelect: (name: string) => void) {
  // eslint-disable-next-line react/display-name
  return (props: unknown) => {
    const p = props as {
      x: number;
      y: number;
      width: number;
      height: number;
      depth: number;
      name: string;
      revenue?: number;
      volume?: number;
    };
    const { x, y, width, height, depth, name } = p;
    const isLeaf = depth === 2;
    const revenue = p.revenue ?? 0;
    const intensity = Math.min(1, revenue / 1_200_000);
    const fill = isLeaf
      ? `rgba(68, 84, 195, ${0.25 + intensity * 0.6})`
      : "rgba(138,143,152,0.12)";
    return (
      <g onClick={() => isLeaf && onSelect(name)} className={isLeaf ? "cursor-pointer" : undefined}>
        <rect x={x} y={y} width={width} height={height} style={{ fill, stroke: "#fff", strokeWidth: 2 }} />
        {width > 50 && height > 18 ? (
          <text x={x + 6} y={y + 16} fontSize={isLeaf ? 11 : 12} fontWeight={isLeaf ? 500 : 600} fill="#1f2430">
            {name}
          </text>
        ) : null}
        {isLeaf && width > 60 && height > 32 ? (
          <text x={x + 6} y={y + 30} fontSize={10} fill="#4b5060">
            {num(p.volume ?? 0)} cases
          </text>
        ) : null}
      </g>
    );
  };
}

/** Simple hand-rolled SVG sankey with two columns and curved links. */
function ReferralSankey({
  sources,
  targets,
  links,
  colorFor,
  onSelect,
}: {
  sources: string[];
  targets: string[];
  links: { source: string; target: string; volume: number; kind: "internal" | "external" | "emergency" }[];
  colorFor: (kind: "internal" | "external" | "emergency") => string;
  onSelect: (source: string, target: string) => void;
}) {
  const width = 720;
  const height = 320;
  const colW = 150;
  const leftX = 10;
  const rightX = width - colW - 10;
  const maxVolume = Math.max(...links.map((l) => l.volume));

  const sourceY = (name: string) => {
    const idx = sources.indexOf(name);
    return 20 + (idx * (height - 40)) / Math.max(1, sources.length - 1 || 1);
  };
  const targetY = (name: string) => {
    const idx = targets.indexOf(name);
    return 20 + (idx * (height - 40)) / Math.max(1, targets.length - 1 || 1);
  };

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} className="min-w-[720px]">
        {links.map((l, i) => {
          const y1 = sourceY(l.source);
          const y2 = targetY(l.target);
          const x1 = leftX + colW;
          const x2 = rightX;
          const midX = (x1 + x2) / 2;
          const strokeWidth = 2 + (l.volume / maxVolume) * 18;
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke={colorFor(l.kind)}
              strokeOpacity={0.45}
              strokeWidth={strokeWidth}
              className="cursor-pointer transition-opacity hover:opacity-80"
              onClick={() => onSelect(l.source, l.target)}
            >
              <title>{`${l.source} → ${l.target}: ${l.volume} referrals`}</title>
            </path>
          );
        })}
        {sources.map((s) => (
          <g key={s}>
            <rect x={leftX} y={sourceY(s) - 9} width={colW} height={18} rx={4} className="fill-brand/10" />
            <text x={leftX + 6} y={sourceY(s) + 4} fontSize={11} className="fill-text-primary">
              {s}
            </text>
          </g>
        ))}
        {targets.map((t) => (
          <g key={t}>
            <rect x={rightX} y={targetY(t) - 9} width={colW} height={18} rx={4} className="fill-success/10" />
            <text x={rightX + 6} y={targetY(t) + 4} fontSize={11} className="fill-text-primary">
              {t}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
