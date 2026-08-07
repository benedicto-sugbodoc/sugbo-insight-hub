import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Clock } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChartSkeletonBlock,
  KpiStrip,
  MetricCard,
  PALETTE,
  PanelCard,
  SectionTitle,
  num,
} from "@/components/analytics/shared";
import { HourWeekdayHeatmap, type HourWeekdayCell } from "@/components/analytics/temporal-heatmap";
import { ChartDrillDrawer, RichTooltip } from "@/components/analytics/interactive";
import {
  departmentBreakdownFor,
  fetchTemporalData,
  type TemporalDataset,
} from "@/lib/analytics/temporal.mock";

export const Route = createFileRoute("/analytics/patterns")({
  head: () => ({
    meta: [
      { title: "Temporal Pattern Analysis — SugboDoc Analytics" },
      {
        name: "description",
        content:
          "Hour-by-weekday visit volume heatmap for OPD and Emergency, for staffing and capacity planning.",
      },
    ],
  }),
  component: PatternsPage,
});

function summarize(cells: HourWeekdayCell[]) {
  const total = cells.reduce((s, c) => s + c.value, 0);
  const peak = cells.reduce((best, c) => (c.value > best.value ? c : best), cells[0]!);
  const weekday = cells.filter((c) => c.dayIndex < 5).reduce((s, c) => s + c.value, 0);
  const weekend = total - weekday;
  const byHour = Array.from({ length: 24 }, (_, h) => ({
    hour: `${h}:00`,
    value: cells.filter((c) => c.hour === h).reduce((s, c) => s + c.value, 0),
  }));
  const byDay = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => ({
    day,
    value: cells.filter((c) => c.day === day).reduce((s, c) => s + c.value, 0),
  }));
  return { total, peak, weekday, weekend, byHour, byDay };
}

function PatternsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "patterns"],
    queryFn: fetchTemporalData,
  });
  const [service, setService] = React.useState<keyof TemporalDataset>("opd");
  const [selectedCell, setSelectedCell] = React.useState<HourWeekdayCell | null>(null);

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <ChartSkeletonBlock className="h-24" />
        <ChartSkeletonBlock className="h-72" />
      </div>
    );
  }

  const cells = data[service];
  const stats = summarize(cells);

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Temporal Pattern Analysis"
        description="Visit volume by hour and day of week — identify peak-demand windows for staffing and scheduling."
        action={
          <Tabs value={service} onValueChange={(v) => setService(v as keyof TemporalDataset)}>
            <TabsList className="h-8">
              <TabsTrigger value="opd" className="text-xs">
                OPD
              </TabsTrigger>
              <TabsTrigger value="emergency" className="text-xs">
                Emergency
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <KpiStrip>
        <MetricCard
          label="Total visits (12-week sample)"
          value={num(stats.total)}
          status="neutral"
          icon={Clock}
        />
        <MetricCard
          label="Peak slot"
          value={`${stats.peak.day} ${stats.peak.hour}:00`}
          secondary={`${num(stats.peak.value)} visits`}
          status="neutral"
        />
        <MetricCard
          label="Weekday share"
          value={`${Math.round((stats.weekday / Math.max(1, stats.total)) * 100)}%`}
          secondary={`${num(stats.weekday)} of ${num(stats.total)} visits`}
          status="neutral"
        />
        <MetricCard
          label="Weekend share"
          value={`${Math.round((stats.weekend / Math.max(1, stats.total)) * 100)}%`}
          secondary={`${num(stats.weekend)} of ${num(stats.total)} visits`}
          status="neutral"
        />
      </KpiStrip>

      <PanelCard
        title={`${service === "opd" ? "OPD" : "Emergency"} visits by hour × weekday`}
        description="Darker cells = higher volume. Click a cell for a department breakdown."
      >
        <HourWeekdayHeatmap
          data={cells}
          onCellClick={setSelectedCell}
          selected={selectedCell ? { day: selectedCell.day, hour: selectedCell.hour } : null}
        />
      </PanelCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <PanelCard title="Hourly profile" description="Total visits by hour of day, all week">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={stats.byHour} margin={{ left: -12, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval={2}
              />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
              <Tooltip content={<RichTooltip valueFormatter={num} clickHint={false} />} />
              <Line
                type="monotone"
                dataKey="value"
                name="Visits"
                stroke={PALETTE.brand}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </PanelCard>
        <PanelCard title="Day-of-week profile" description="Total visits by day, all hours">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.byDay} margin={{ left: -12, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
              <Tooltip content={<RichTooltip valueFormatter={num} clickHint={false} />} />
              <Bar dataKey="value" name="Visits" fill={PALETTE.brand} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </PanelCard>
      </div>

      <ChartDrillDrawer
        open={selectedCell !== null}
        onOpenChange={(v) => (v ? null : setSelectedCell(null))}
        metricName={selectedCell ? `${selectedCell.day} ${selectedCell.hour}:00` : ""}
        value={selectedCell ? `${num(selectedCell.value)} visits` : ""}
        dateRangeLabel="12-week rolling sample"
      >
        {selectedCell ? (
          <div>
            <p className="mb-2 text-xs font-medium text-text-secondary">
              Department breakdown for this slot
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={departmentBreakdownFor(
                  selectedCell.day,
                  selectedCell.hour,
                  selectedCell.value,
                )}
                layout="vertical"
                margin={{ left: 8, right: 16 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<RichTooltip valueFormatter={num} clickHint={false} />} />
                <Bar dataKey="value" name="Visits" fill={PALETTE.brand} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </ChartDrillDrawer>
    </div>
  );
}
