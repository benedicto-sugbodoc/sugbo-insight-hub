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
  bhcBreakdownFor,
  fetchLguTemporalData,
  type LguTemporalDataset,
} from "@/lib/analytics/lgu/temporal.mock";

export const Route = createFileRoute("/lgu/analytics/patterns")({
  head: () => ({
    meta: [
      { title: "Temporal Pattern Analysis — SugboDoc LGU Analytics" },
      {
        name: "description",
        content:
          "Hour-by-weekday visit volume heatmap for Konsulta OPD and TB-DOTS/ANC programmes, for BHC staffing and clinic-hour planning.",
      },
    ],
  }),
  component: LguPatternsPage,
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

function LguPatternsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["lgu-analytics", "patterns"],
    queryFn: fetchLguTemporalData,
  });
  const [service, setService] = React.useState<keyof LguTemporalDataset>("konsulta");
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
        description="BHC visit volume by hour and day of week — identify peak-demand windows for clinic-hour and staffing decisions."
        action={
          <Tabs value={service} onValueChange={(v) => setService(v as keyof LguTemporalDataset)}>
            <TabsList className="h-8">
              <TabsTrigger value="konsulta" className="text-xs">
                Konsulta OPD
              </TabsTrigger>
              <TabsTrigger value="programs" className="text-xs">
                TB-DOTS / ANC
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
          value={stats.peak.value > 0 ? `${stats.peak.day} ${stats.peak.hour}:00` : "—"}
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
          label="Saturday / Sunday share"
          value={`${Math.round((stats.weekend / Math.max(1, stats.total)) * 100)}%`}
          secondary="BHCs run half-day Saturday, closed Sunday"
          status="neutral"
        />
      </KpiStrip>

      <PanelCard
        title={`${service === "konsulta" ? "Konsulta OPD" : "TB-DOTS / ANC"} visits by hour × weekday`}
        description="Darker cells = higher volume. Click a cell for a BHC-level breakdown."
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
              Barangay health center breakdown for this slot
            </p>
            {selectedCell.value > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={bhcBreakdownFor(selectedCell.day, selectedCell.hour, selectedCell.value)}
                  layout="vertical"
                  margin={{ left: 8, right: 16 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={150}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<RichTooltip valueFormatter={num} clickHint={false} />} />
                  <Bar dataKey="value" name="Visits" fill={PALETTE.brand} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-text-muted">
                No visits recorded in this slot — BHC closed or off-hours.
              </p>
            )}
          </div>
        ) : null}
      </ChartDrillDrawer>
    </div>
  );
}
