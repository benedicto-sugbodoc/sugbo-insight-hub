import * as React from "react";
import { AlertOctagon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/utils";
import { PALETTE, num, pct } from "@/components/analytics/shared";

/* ------------------------------------------------------------------ */
/* LGU / public-health color extension                                 */
/* Reuses the existing PALETTE hexes so the design system stays single */
/* source of truth — these are semantic aliases only.                  */
/* ------------------------------------------------------------------ */

export const LGU_COLORS = {
  outbreak: PALETTE.scpwd, // #8B0000 dark red
  vaccination: PALETTE.success, // #1A7A3C green
  ncd: PALETTE.warning, // #E67E22 amber
  maternal: PALETTE.hmo, // #6B4C9A purple
  critical: PALETTE.danger, // #C0392B
  brand: PALETTE.brand,
} as const;

/** White (low) -> brand blue (high) choropleth ramp, or critical red if alert. */
export function choroplethColor(t: number, alert?: boolean) {
  if (alert) return LGU_COLORS.critical;
  const clamped = Math.max(0, Math.min(1, t));
  const from = [255, 255, 255];
  const to = [0x44, 0x54, 0xc3];
  const rgb = from.map((c, k) => Math.round(c + ((to[k] ?? c) - c) * clamped));
  return `rgb(${rgb.join(",")})`;
}

/* ------------------------------------------------------------------ */
/* Outbreak alert banner                                               */
/* ------------------------------------------------------------------ */

export function OutbreakBanner({
  diseases,
}: {
  diseases: { name: string; ratio: number; weeks: number }[];
}) {
  if (!diseases.length) return null;
  return (
    <div
      className="flex items-start gap-3 rounded-lg border-2 p-3.5"
      style={{ borderColor: LGU_COLORS.outbreak, backgroundColor: `${LGU_COLORS.outbreak}14` }}
    >
      <AlertOctagon className="mt-0.5 size-5 shrink-0" style={{ color: LGU_COLORS.outbreak }} />
      <div>
        <p className="text-sm font-semibold" style={{ color: LGU_COLORS.outbreak }}>
          OUTBREAK ALERT — {diseases.length} disease{diseases.length > 1 ? "s" : ""} above threshold
        </p>
        <p className="mt-0.5 text-xs text-text-secondary">
          {diseases
            .map(
              (d) => `${d.name}: ${d.ratio.toFixed(1)}× baseline for ${d.weeks} consecutive weeks`,
            )
            .join(" · ")}
          . CESU notification recommended.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* StageFlow — shared primitive for funnels & cascades of care         */
/* ------------------------------------------------------------------ */

export interface FlowStage {
  id: string;
  label: string;
  value: number;
  suffix?: string;
}

export function StageFlow({
  stages,
  onStageClick,
  valueFormatter = num,
  showConversion = true,
}: {
  stages: FlowStage[];
  onStageClick?: (stage: FlowStage, index: number) => void;
  valueFormatter?: (v: number) => string;
  showConversion?: boolean;
}) {
  const max = stages[0]?.value || 1;
  return (
    <div className="space-y-2.5">
      {stages.map((s, i) => {
        const widthPct = Math.max(10, (s.value / max) * 100);
        const ofFirst = (s.value / max) * 100;
        const prior = stages[i - 1];
        const ofPrev = i === 0 || !prior ? null : (s.value / prior.value) * 100;
        const t = i / Math.max(1, stages.length - 1);
        const color = choroplethColor(0.25 + t * 0.75);
        const Comp = onStageClick ? "button" : "div";
        return (
          <Comp
            key={s.id}
            onClick={onStageClick ? () => onStageClick(s, i) : undefined}
            className={cn("block w-full text-left", onStageClick && "cursor-pointer group")}
          >
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
              <span className="font-medium text-text-primary">{s.label}</span>
              <span className="text-text-muted">
                {valueFormatter(s.value)}
                {s.suffix ?? ""} · {pct(ofFirst, 0)} of stage 1
                {showConversion && ofPrev !== null ? ` · ${pct(ofPrev, 0)} of prior` : ""}
              </span>
            </div>
            <div className="h-7 w-full rounded-md bg-muted">
              <div
                className="flex h-7 items-center justify-center rounded-md text-[11px] font-semibold text-white transition-all group-hover:brightness-95"
                style={{ width: `${widthPct}%`, backgroundColor: color, minWidth: "3.5rem" }}
              >
                {valueFormatter(s.value)}
              </div>
            </div>
          </Comp>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Radar coverage chart (immunization by antigen, etc.)                */
/* ------------------------------------------------------------------ */

export function CoverageRadar({
  data,
  target = 95,
  color = LGU_COLORS.vaccination,
}: {
  data: { label: string; value: number }[];
  target?: number;
  color?: string;
}) {
  const withTarget = data.map((d) => ({ ...d, target }));
  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={withTarget} outerRadius="72%">
        <PolarGrid stroke="var(--color-border)" />
        <PolarAngleAxis dataKey="label" tick={{ fontSize: 10 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} tickCount={5} axisLine={false} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v: number, n: string) => [pct(v, 0), n]}
        />
        <Radar
          name="Target (95%)"
          dataKey="target"
          stroke={PALETTE.neutral}
          strokeDasharray="4 4"
          fill="none"
        />
        <Radar
          name="Coverage"
          dataKey="value"
          stroke={color}
          fill={color}
          fillOpacity={0.32}
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/* Population pyramid                                                  */
/* ------------------------------------------------------------------ */

export function PopulationPyramid({
  data,
  onBandClick,
}: {
  data: { band: string; male: number; female: number }[];
  onBandClick?: (band: string) => void;
}) {
  const chartData = data.map((d) => ({ ...d, maleNeg: -d.male }));
  return (
    <ResponsiveContainer width="100%" height={380}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ left: 8, right: 16 }}
        onClick={(e) => {
          const band = (e as unknown as { activeLabel?: string })?.activeLabel;
          if (band && onBandClick) onBandClick(band);
        }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v: number) => num(Math.abs(v))}
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="band"
          width={56}
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v: number, n: string) => [num(Math.abs(v)), n]}
        />
        <Bar
          dataKey="maleNeg"
          name="Male"
          fill={PALETTE.brand}
          radius={[2, 0, 0, 2]}
          cursor="pointer"
        />
        <Bar
          dataKey="female"
          name="Female"
          fill={LGU_COLORS.maternal}
          radius={[0, 2, 2, 0]}
          cursor="pointer"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/* Barangay choropleth (stylized tile grid — no external map dep)      */
/* ------------------------------------------------------------------ */

export interface BarangayDatum {
  id: string;
  name: string;
  value: number;
  display: string;
  alert?: boolean;
}

export function BarangayChoropleth({
  data,
  onSelect,
  maxValue,
}: {
  data: BarangayDatum[];
  onSelect?: (d: BarangayDatum) => void;
  maxValue?: number;
}) {
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1);
  return (
    <div>
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
        {data.map((d) => {
          const t = d.value / max;
          const bg = choroplethColor(t, d.alert);
          const light = t < 0.55 && !d.alert;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => onSelect?.(d)}
              title={`${d.name}: ${d.display}`}
              className={cn(
                "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-md border p-1 text-center leading-tight transition-transform hover:z-10 hover:scale-[1.06] hover:shadow-md",
                d.alert ? "border-danger" : "border-border",
              )}
              style={{ backgroundColor: bg }}
            >
              <span
                className={cn(
                  "text-[9px] font-semibold",
                  light ? "text-text-primary" : "text-white",
                )}
              >
                {d.name}
              </span>
              <span className={cn("text-[8px]", light ? "text-text-muted" : "text-white/85")}>
                {d.display}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-text-muted">
        <span>Low</span>
        <div
          className="h-2 flex-1 rounded-full"
          style={{
            background: `linear-gradient(to right, #ffffff, ${PALETTE.brand})`,
            border: "1px solid var(--color-border)",
          }}
        />
        <span>High</span>
        <span className="ml-3 inline-flex items-center gap-1">
          <span
            className="size-2.5 rounded-full"
            style={{ backgroundColor: LGU_COLORS.critical }}
          />
          Outbreak / critical threshold
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Calendar heatmap (eKAS submission tracker)                          */
/* ------------------------------------------------------------------ */

export interface CalendarDay {
  date: number;
  weekday: number; // 0 = Sunday
  submitted: number;
  pending: number;
  isCutoff?: boolean;
  isPast: boolean;
}

export function CalendarHeatmap({
  days,
  onDayClick,
}: {
  days: CalendarDay[];
  onDayClick?: (d: CalendarDay) => void;
}) {
  const max = Math.max(...days.map((d) => d.submitted), 1);
  const leadingBlanks = days[0]?.weekday ?? 0;
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-text-muted">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`b-${i}`} />
        ))}
        {days.map((d) => {
          const risky = d.pending > 0 && d.isCutoff;
          const t = d.submitted / max;
          const bg = risky
            ? LGU_COLORS.critical
            : d.submitted === 0
              ? "var(--color-muted)"
              : choroplethColor(0.2 + t * 0.8);
          return (
            <button
              key={d.date}
              type="button"
              onClick={() => onDayClick?.(d)}
              title={`Day ${d.date}: ${d.submitted} submitted, ${d.pending} pending`}
              className={cn(
                "flex aspect-square flex-col items-center justify-center rounded text-[10px] font-medium transition-transform hover:scale-110",
                d.isCutoff ? "ring-2 ring-offset-1" : "",
              )}
              style={{
                backgroundColor: bg,
                color: t > 0.5 || risky ? "#fff" : "var(--color-text-primary)",
                ...(d.isCutoff
                  ? ({ "--tw-ring-color": LGU_COLORS.ncd } as React.CSSProperties)
                  : {}),
              }}
            >
              {d.date}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="size-2.5 rounded" style={{ backgroundColor: LGU_COLORS.critical }} />{" "}
          Cutoff risk
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            className="size-2.5 rounded ring-2"
            style={{ ringColor: LGU_COLORS.ncd } as React.CSSProperties}
          />{" "}
          Submission cutoff day
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Compliance / adherence heatmap (patient x month grid)               */
/* ------------------------------------------------------------------ */

export type ComplianceCell = "ok" | "missed" | "na";

export function ComplianceHeatmap({
  rowLabels,
  columns,
  matrix,
  onCellClick,
}: {
  rowLabels: string[];
  columns: string[];
  matrix: ComplianceCell[][];
  onCellClick?: (rowIndex: number, colIndex: number) => void;
}) {
  const cellColor: Record<ComplianceCell, string> = {
    ok: LGU_COLORS.vaccination,
    missed: LGU_COLORS.critical,
    na: "var(--color-muted)",
  };
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[420px]">
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `8rem repeat(${columns.length}, minmax(1.75rem, 1fr))` }}
        >
          <div />
          {columns.map((c) => (
            <div key={c} className="text-center text-[10px] text-text-muted">
              {c}
            </div>
          ))}
          {rowLabels.map((label, r) => (
            <React.Fragment key={label}>
              <div className="truncate pr-2 text-[11px] text-text-secondary">{label}</div>
              {matrix[r]?.map((cell, c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onCellClick?.(r, c)}
                  title={`${label} · ${columns[c]}: ${cell === "ok" ? "Refilled" : cell === "missed" ? "Missed" : "No data"}`}
                  className="aspect-square rounded-sm transition-transform hover:scale-110"
                  style={{ backgroundColor: cellColor[cell] }}
                />
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-text-muted">
        <span className="inline-flex items-center gap-1">
          <span
            className="size-2.5 rounded-sm"
            style={{ backgroundColor: LGU_COLORS.vaccination }}
          />{" "}
          Consultation + refill
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2.5 rounded-sm" style={{ backgroundColor: LGU_COLORS.critical }} />{" "}
          Missed
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2.5 rounded-sm" style={{ backgroundColor: "var(--color-muted)" }} />{" "}
          No data
        </span>
      </div>
    </div>
  );
}
