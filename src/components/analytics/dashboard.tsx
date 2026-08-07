import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bed,
  Building2,
  Calendar,
  ChevronRight,
  Clock,
  FileText,
  HeartPulse,
  Minus,
  RefreshCw,
  Scissors,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { DashboardData, fetchDashboardData, KpiMetric, PatientAlert } from "@/lib/analytics.mock";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

const kpiIcons: Record<string, React.ElementType> = {
  "bed-occupancy": Bed,
  alos: Clock,
  "ed-admissions": Users,
  "or-utilization": Scissors,
  mortality: HeartPulse,
  readmissions: Activity,
  "safety-events": AlertTriangle,
  "critical-results": AlertCircle,
  "pending-claims": FileText,
  "gross-revenue": Building2,
};

const statusColor = {
  good: "text-success border-l-success",
  warning: "text-warning border-l-warning",
  danger: "text-danger border-l-danger",
  neutral: "text-muted-foreground border-l-border",
};

const statusBg = {
  good: "bg-success/10",
  warning: "bg-warning/10",
  danger: "bg-danger/10",
  neutral: "bg-muted",
};

const alertPriorityVariant = {
  High: "bg-danger text-danger-foreground",
  Medium: "bg-warning text-warning-foreground",
  Low: "bg-secondary text-secondary-foreground",
};

const alertCategoryVariant = {
  "Critical Result": "bg-danger/10 text-danger",
  "High Risk": "bg-warning/10 text-warning",
  "Safety Event": "bg-warning/10 text-warning",
  Readmission: "bg-philhealth/10 text-philhealth",
  "Pending Claim": "bg-brand/10 text-brand",
};

function KpiSkeleton() {
  return (
    <Card className="border-l-4 border-l-border">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <Skeleton className="mt-3 h-8 w-20" />
        <Skeleton className="mt-2 h-3 w-40" />
      </CardContent>
    </Card>
  );
}

function ChartSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="flex-1">
        <Skeleton className="h-full w-full rounded-xl" />
      </CardContent>
    </Card>
  );
}

function TrendIndicator({ metric }: { metric: KpiMetric }) {
  const { delta, status } = metric;
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        No change
      </span>
    );
  }
  const isPositive = delta > 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        status === "good" && "text-success",
        status === "warning" && "text-warning",
        status === "danger" && "text-danger",
        status === "neutral" && "text-muted-foreground",
      )}
    >
      <Icon className="h-3 w-3" />
      {isPositive ? "+" : ""}
      {delta}% vs prior
    </span>
  );
}

function KpiCard({ metric, onClick }: { metric: KpiMetric; onClick: (metric: KpiMetric) => void }) {
  const Icon = kpiIcons[metric.id] ?? Activity;
  return (
    <button
      type="button"
      onClick={() => onClick(metric)}
      className={cn(
        "group relative text-left rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "border-l-4",
        statusColor[metric.status],
      )}
      aria-label={`${metric.label}: ${metric.value}. ${metric.description}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{metric.label}</span>
        <div className={cn("rounded-full p-2", statusBg[metric.status])}>
          <Icon className="h-4 w-4 text-foreground" />
        </div>
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold tracking-tight text-foreground">{metric.value}</div>
        <div className="mt-1 flex items-center gap-2">
          <TrendIndicator metric={metric} />
          <span className="text-xs text-muted-foreground">Prior: {metric.priorValue}</span>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
        Drill down <ArrowRight className="h-3 w-3" />
      </div>
    </button>
  );
}

function DetailDrawer({
  open,
  onOpenChange,
  data,
  selection,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: DashboardData | undefined;
  selection: { type: "kpi"; item: KpiMetric } | { type: "alert"; item: PatientAlert } | null;
}) {
  if (!selection || !data) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-foreground">
            {selection.type === "kpi" ? selection.item.label : selection.item.id}
          </SheetTitle>
          <SheetDescription className="text-muted-foreground">
            {selection.type === "kpi"
              ? selection.item.description
              : `${data.tenant} · ${selection.item.date}`}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          {selection.type === "kpi" && (
            <>
              <div className="rounded-lg border bg-card p-4">
                <div className="text-sm text-muted-foreground">Current value</div>
                <div className="mt-1 text-3xl font-bold text-foreground">
                  {selection.item.value}
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <TrendIndicator metric={selection.item} />
                  <span className="text-xs text-muted-foreground">
                    Prior: {selection.item.priorValue}
                  </span>
                </div>
                {selection.item.target && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    Target:{" "}
                    <span className="font-medium text-foreground">{selection.item.target}</span>
                  </div>
                )}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">Suggested action</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Review the underlying trend for {selection.item.label.toLowerCase()} and escalate
                  to the responsible department head if the variance exceeds the governance
                  threshold.
                </p>
              </div>
            </>
          )}
          {selection.type === "alert" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground">Patient</div>
                  <div className="mt-1 text-sm font-medium text-foreground">
                    {selection.item.patientName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selection.item.patientId} · {selection.item.age}y · {selection.item.gender}
                  </div>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground">Category</div>
                  <div className="mt-1 text-sm font-medium text-foreground">
                    {selection.item.category}
                  </div>
                  <div className="text-xs text-muted-foreground">{selection.item.department}</div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">Summary</h4>
                <p className="mt-1 text-sm text-muted-foreground">{selection.item.summary}</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">Source</h4>
                <code className="mt-1 block text-xs text-muted-foreground">
                  {selection.item.source}
                </code>
              </div>
              <div className="flex items-center gap-3">
                <Badge className={alertPriorityVariant[selection.item.priority]}>
                  {selection.item.priority} priority
                </Badge>
                <Badge variant="outline">{selection.item.status}</Badge>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1">Acknowledge</Button>
                <Button variant="outline" className="flex-1">
                  View chart
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function MedicalDirectorDashboard() {
  const { data, isLoading, isError, refetch } = useQuery<DashboardData>({
    queryKey: ["medical-director-dashboard"],
    queryFn: fetchDashboardData,
  });

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [selection, setSelection] = React.useState<
    { type: "kpi"; item: KpiMetric } | { type: "alert"; item: PatientAlert } | null
  >(null);

  const handleKpiClick = (item: KpiMetric) => {
    setSelection({ type: "kpi", item });
    setDrawerOpen(true);
  };

  const handleAlertClick = (item: PatientAlert) => {
    setSelection({ type: "alert", item });
    setDrawerOpen(true);
  };

  const openAlerts = data?.alerts.filter((a) => a.status === "Open").length ?? 0;
  const highPriorityAlerts = data?.alerts.filter((a) => a.priority === "High").length ?? 0;

  const occupancyConfig = {
    occupancy: { label: "Current occupancy %", color: "var(--color-primary)" },
    prior: { label: "Prior month", color: "var(--color-muted-foreground)" },
    capacity: { label: "Bed capacity", color: "var(--color-border)" },
  } satisfies ChartConfig;

  const admissionsConfig = {
    current: { label: "Current month", color: "var(--color-primary)" },
    prior: { label: "Prior month", color: "var(--color-muted-foreground)" },
  } satisfies ChartConfig;

  const orConfig = {
    scheduled: { label: "Scheduled cases", color: "var(--color-muted-foreground)" },
    completed: { label: "Completed cases", color: "var(--color-primary)" },
    utilization: { label: "Utilization %", color: "var(--color-warning)" },
  } satisfies ChartConfig;

  const diagnosisConfig = {
    count: { label: "Encounters", color: "var(--color-primary)" },
  } satisfies ChartConfig;

  const qualityConfig = {
    falls: { label: "Falls", color: "var(--color-danger)" },
    infections: { label: "Infections", color: "var(--color-warning)" },
    medicationErrors: { label: "Medication errors", color: "var(--color-philhealth)" },
  } satisfies ChartConfig;

  const volumeConfig = {
    admissions: { label: "Admissions", color: "var(--color-primary)" },
    discharges: { label: "Discharges", color: "var(--color-success)" },
    edVisits: { label: "ED visits", color: "var(--color-warning)" },
  } satisfies ChartConfig;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span>{data?.tenant ?? "Cebu City Medical Center"}</span>
                <span className="text-border">|</span>
                <Stethoscope className="h-4 w-4" />
                <span>{data?.role ?? "Medical Director / Chief of Hospital"}</span>
              </div>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                Executive Overview
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{data?.period ?? "August 2026"}</span>
                <span className="text-border">vs</span>
                <span>{data?.priorPeriod ?? "July 2026"}</span>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => refetch()}
                aria-label="Refresh data"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              {highPriorityAlerts > 0 && (
                <Badge className="bg-danger text-danger-foreground">
                  {highPriorityAlerts} high priority
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {isError && (
          <div className="mb-6 rounded-lg border border-danger/20 bg-danger/10 p-4 text-sm text-danger">
            Failed to load dashboard data. Please try again.
          </div>
        )}

        {/* KPIs */}
        <section aria-label="Key performance indicators" className="mb-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {isLoading
              ? Array.from({ length: 10 }).map((_, i) => <KpiSkeleton key={i} />)
              : data?.kpis.map((metric) => (
                  <KpiCard key={metric.id} metric={metric} onClick={handleKpiClick} />
                ))}
          </div>
        </section>

        {/* Top charts */}
        <div className="mb-6 grid gap-4 lg:grid-cols-3">
          {isLoading ? (
            <>
              <ChartSkeleton className="lg:col-span-2" />
              <ChartSkeleton />
            </>
          ) : (
            <>
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Bed Occupancy Trend</CardTitle>
                  <CardDescription>Daily inpatient occupancy vs prior month</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={occupancyConfig} aria-label="Bed occupancy trend chart">
                    <LineChart
                      data={data?.occupancy ?? []}
                      margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        stroke="var(--color-muted-foreground)"
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 12 }}
                        stroke="var(--color-muted-foreground)"
                        unit="%"
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ReferenceLine
                        y={85}
                        stroke="var(--color-warning)"
                        strokeDasharray="4 4"
                        label="Target"
                      />
                      <Line
                        type="monotone"
                        dataKey="occupancy"
                        stroke="var(--color-occupancy)"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="prior"
                        stroke="var(--color-prior)"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={false}
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Admissions by Department</CardTitle>
                  <CardDescription>Current vs prior month</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={admissionsConfig}
                    className="aspect-[4/3]"
                    aria-label="Admissions by department chart"
                  >
                    <BarChart
                      data={data?.departmentAdmissions ?? []}
                      layout="vertical"
                      margin={{ top: 8, right: 16, bottom: 8, left: 24 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 12 }}
                        stroke="var(--color-muted-foreground)"
                      />
                      <YAxis
                        dataKey="department"
                        type="category"
                        tick={{ fontSize: 12 }}
                        stroke="var(--color-muted-foreground)"
                        width={80}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="current" fill="var(--color-current)" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="prior" fill="var(--color-prior)" radius={[0, 4, 4, 0]} />
                      <ChartLegend content={<ChartLegendContent />} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Middle charts */}
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          {isLoading ? (
            <>
              <ChartSkeleton />
              <ChartSkeleton />
            </>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">OR Utilization</CardTitle>
                  <CardDescription>
                    Scheduled vs completed cases and utilization rate
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={orConfig}
                    className="aspect-[4/3]"
                    aria-label="Operating room utilization chart"
                  >
                    <ComposedChart
                      data={data?.orUtilization ?? []}
                      margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        stroke="var(--color-muted-foreground)"
                      />
                      <YAxis
                        yAxisId="left"
                        tick={{ fontSize: 12 }}
                        stroke="var(--color-muted-foreground)"
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        domain={[0, 100]}
                        tick={{ fontSize: 12 }}
                        stroke="var(--color-muted-foreground)"
                        unit="%"
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar
                        yAxisId="left"
                        dataKey="scheduled"
                        fill="var(--color-scheduled)"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="completed"
                        fill="var(--color-completed)"
                        radius={[4, 4, 0, 0]}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="utilization"
                        stroke="var(--color-utilization)"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                    </ComposedChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top Diagnoses</CardTitle>
                  <CardDescription>Most frequent ICD-10 encounters</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={diagnosisConfig}
                    className="aspect-[4/3]"
                    aria-label="Top diagnoses chart"
                  >
                    <BarChart
                      data={data?.topDiagnoses ?? []}
                      layout="vertical"
                      margin={{ top: 8, right: 16, bottom: 8, left: 24 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 12 }}
                        stroke="var(--color-muted-foreground)"
                      />
                      <YAxis
                        dataKey="commonName"
                        type="category"
                        tick={{ fontSize: 12 }}
                        stroke="var(--color-muted-foreground)"
                        width={120}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value, _name, props) => (
                              <span className="text-xs text-muted-foreground">
                                {props.payload.description}: {value}
                              </span>
                            )}
                          />
                        }
                      />
                      <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Bottom charts */}
        <div className="mb-6 grid gap-4 lg:grid-cols-3">
          {isLoading ? (
            <>
              <ChartSkeleton className="lg:col-span-2" />
              <ChartSkeleton />
            </>
          ) : (
            <>
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Patient Volume & Discharges</CardTitle>
                  <CardDescription>Admissions, discharges, and emergency visits</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={volumeConfig}
                    aria-label="Patient volume and discharges chart"
                  >
                    <LineChart
                      data={data?.volume ?? []}
                      margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        stroke="var(--color-muted-foreground)"
                      />
                      <YAxis tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        type="monotone"
                        dataKey="admissions"
                        stroke="var(--color-admissions)"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="discharges"
                        stroke="var(--color-discharges)"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="edVisits"
                        stroke="var(--color-edVisits)"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={{ r: 3 }}
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Quality Events</CardTitle>
                  <CardDescription>Weekly safety events</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={qualityConfig}
                    className="aspect-[4/3]"
                    aria-label="Quality events chart"
                  >
                    <BarChart
                      data={data?.qualityEvents ?? []}
                      margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        stroke="var(--color-muted-foreground)"
                      />
                      <YAxis tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar
                        dataKey="falls"
                        stackId="a"
                        fill="var(--color-falls)"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="infections"
                        stackId="a"
                        fill="var(--color-infections)"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="medicationErrors"
                        stackId="a"
                        fill="var(--color-medicationErrors)"
                        radius={[4, 4, 0, 0]}
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Alerts */}
        <section aria-label="Clinical and operational alerts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Alerts & Action Items</CardTitle>
                <CardDescription>{openAlerts} open items requiring attention</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="gap-1">
                View all <ChevronRight className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Date</TableHead>
                        <TableHead>Patient</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Summary</TableHead>
                        <TableHead className="text-center">Priority</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.alerts.map((alert) => (
                        <TableRow
                          key={alert.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleAlertClick(alert)}
                        >
                          <TableCell className="whitespace-nowrap text-sm">{alert.date}</TableCell>
                          <TableCell className="text-sm">
                            <div className="font-medium text-foreground">{alert.patientName}</div>
                            <div className="text-xs text-muted-foreground">{alert.patientId}</div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={alertCategoryVariant[alert.category]}
                              variant="outline"
                            >
                              {alert.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {alert.department}
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                            {alert.summary}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={alertPriorityVariant[alert.priority]}>
                              {alert.priority}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" className="gap-1">
                              Open <ArrowRight className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>

      <DetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        data={data}
        selection={selection}
      />
    </div>
  );
}
