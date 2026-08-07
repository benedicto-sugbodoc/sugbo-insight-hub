import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Palette                                                             */
/* ------------------------------------------------------------------ */

export const PALETTE = {
  brand: "#4454C3",
  brandLight: "#7C89DC",
  brandLighter: "#AEB6EB",
  success: "#1A7A3C",
  warning: "#E67E22",
  danger: "#C0392B",
  philhealth: "#1A5CA8",
  hmo: "#6B4C9A",
  scpwd: "#8B0000",
  gsis: "#0E6655",
  writeoff: "#999999",
  gold: "#B7950B",
  neutral: "#8A8F98",
} as const;

/** Sequential ramp of the brand blue, light -> dark. */
export function brandRamp(count: number): string[] {
  if (count <= 1) return [PALETTE.brand];
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    // interpolate #AEB6EB -> #2E3A96
    const from = [0xae, 0xb6, 0xeb];
    const to = [0x2e, 0x3a, 0x96];
    const rgb = from.map((c, k) => Math.round(c + (to[k] - c) * t));
    return `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  });
}

/* ------------------------------------------------------------------ */
/* Formatters                                                          */
/* ------------------------------------------------------------------ */

export function php(value: number, opts: { compact?: boolean; decimals?: boolean } = {}) {
  if (opts.compact) {
    if (Math.abs(value) >= 1_000_000) return `PHP ${(value / 1_000_000).toFixed(2)}M`;
    if (Math.abs(value) >= 1_000) return `PHP ${(value / 1_000).toFixed(1)}K`;
  }
  return `PHP ${value.toLocaleString("en-PH", {
    minimumFractionDigits: opts.decimals === false ? 0 : 2,
    maximumFractionDigits: opts.decimals === false ? 0 : 2,
  })}`;
}

export function pct(value: number, digits = 1) {
  return `${value.toFixed(digits)}%`;
}

export function num(value: number) {
  return value.toLocaleString("en-PH");
}

/* ------------------------------------------------------------------ */
/* Status                                                              */
/* ------------------------------------------------------------------ */

export type MetricStatus = "good" | "warning" | "danger" | "neutral" | "gold";

export const statusBorder: Record<MetricStatus, string> = {
  good: "border-l-success",
  warning: "border-l-warning",
  danger: "border-l-danger",
  neutral: "border-l-brand",
  gold: "border-l-brand",
};

export const statusText: Record<MetricStatus, string> = {
  good: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  neutral: "text-brand",
  gold: "text-brand",
};

export const statusHex: Record<MetricStatus, string> = {
  good: PALETTE.success,
  warning: PALETTE.warning,
  danger: PALETTE.danger,
  neutral: PALETTE.brand,
  gold: PALETTE.gold,
};

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

export function SectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-text-primary">{title}</h2>
        {description ? (
          <p className="text-xs text-text-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function PanelCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="gap-1 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            {description ? (
              <CardDescription className="text-xs">{description}</CardDescription>
            ) : null}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className={cn("pt-0", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

export function Trend({
  delta,
  suffix = "vs prior period",
  invert = false,
}: {
  delta: number;
  suffix?: string;
  invert?: boolean;
}) {
  const up = delta > 0;
  const flat = Math.abs(delta) < 0.05;
  const positive = invert ? !up : up;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        flat ? "text-text-muted" : positive ? "text-success" : "text-danger",
      )}
    >
      <Icon className="size-3.5" />
      {flat ? "0.0%" : `${up ? "+" : ""}${delta.toFixed(1)}%`}
      <span className="font-normal text-text-muted">{suffix}</span>
    </span>
  );
}

export interface MetricCardProps {
  label: string;
  value: string;
  delta?: number;
  deltaSuffix?: string;
  invertDelta?: boolean;
  secondary?: string;
  status?: MetricStatus;
  icon?: React.ElementType;
  note?: string;
  onClick?: () => void;
  className?: string;
}

export function MetricCard({
  label,
  value,
  delta,
  deltaSuffix,
  invertDelta,
  secondary,
  status = "neutral",
  icon: Icon,
  note,
  onClick,
  className,
}: MetricCardProps) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "flex min-w-[13rem] flex-col gap-1 rounded-lg border border-l-4 bg-card p-4 text-left shadow-sm transition-all",
        statusBorder[status],
        onClick && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-text-secondary">{label}</span>
        {Icon ? <Icon className={cn("size-4", statusText[status])} /> : null}
      </div>
      <span className="text-2xl font-semibold tracking-tight text-text-primary">{value}</span>
      {typeof delta === "number" ? (
        <Trend delta={delta} suffix={deltaSuffix} invert={invertDelta} />
      ) : null}
      {secondary ? <span className="text-xs text-text-muted">{secondary}</span> : null}
      {note ? (
        <span className="mt-1 text-[11px] italic text-text-muted">{note}</span>
      ) : null}
    </Comp>
  );
}

export function KpiStrip({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 md:grid md:grid-cols-2 md:overflow-visible lg:grid-cols-4">
      {children}
    </div>
  );
}

/** Generic right-side drill-down drawer. Drill-down never navigates away. */
export function DrillDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="text-base">{title}</SheetTitle>
          {description ? (
            <SheetDescription className="text-xs">{description}</SheetDescription>
          ) : null}
        </SheetHeader>
        <div className="space-y-5 px-4 pb-8">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

export function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-1.5 text-sm last:border-0">
      <span className="text-text-secondary">{label}</span>
      <span className="font-medium text-text-primary">{value}</span>
    </div>
  );
}

export function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
      <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: MetricStatus;
}) {
  const map: Record<MetricStatus, string> = {
    good: "bg-success/10 text-success border-success/30",
    warning: "bg-warning/10 text-warning border-warning/30",
    danger: "bg-danger/10 text-danger border-danger/30",
    neutral: "bg-brand/10 text-brand border-brand/30",
    gold: "bg-brand/10 text-brand border-brand/30",
  };
  return (
    <Badge variant="outline" className={cn("text-[11px] font-medium", map[tone])}>
      {children}
    </Badge>
  );
}

export function ChartSkeletonBlock({ className }: { className?: string }) {
  return <Skeleton className={cn("h-64 w-full rounded-lg", className)} />;
}

/** Simple SVG gauge (0-100). */
export function Gauge({
  value,
  label,
  size = 160,
  color,
}: {
  value: number;
  label?: string;
  size?: number;
  color?: string;
}) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circumference = Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  const dash = (clamped / 100) * circumference;
  const hex =
    color ??
    (clamped < 50
      ? PALETTE.danger
      : clamped < 80
        ? PALETTE.warning
        : clamped <= 95
          ? PALETTE.success
          : PALETTE.gold);
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 8} viewBox={`0 0 ${size} ${size / 2 + 8}`}>
        <path
          d={`M ${stroke / 2} ${size / 2} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${size / 2}`}
          fill="none"
          stroke="currentColor"
          className="text-muted"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <path
          d={`M ${stroke / 2} ${size / 2} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${size / 2}`}
          fill="none"
          stroke={hex}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <div className="-mt-6 text-center">
        <div className="text-2xl font-semibold text-text-primary">{clamped.toFixed(1)}%</div>
        {label ? <div className="text-xs text-text-muted">{label}</div> : null}
      </div>
    </div>
  );
}

/** Tiny inline sparkline. */
export function Sparkline({
  data,
  color = PALETTE.brand,
  width = 96,
  height = 24,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1 || 1)) * width;
      const y = height - ((d - min) / span) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.75} />
    </svg>
  );
}

/** Horizontal bullet chart row: actual bar vs target marker. */
export function BulletRow({
  label,
  value,
  target,
  max,
  suffix = "",
  good,
}: {
  label: string;
  value: number;
  target: number;
  max: number;
  suffix?: string;
  good?: boolean;
}) {
  const isGood = good ?? value >= target;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-secondary">{label}</span>
        <span className={cn("font-medium", isGood ? "text-success" : "text-danger")}>
          {value.toLocaleString("en-PH")}
          {suffix}
        </span>
      </div>
      <div className="relative h-3 w-full rounded-full bg-muted">
        <div
          className="h-3 rounded-full"
          style={{
            width: `${Math.min(100, (value / max) * 100)}%`,
            backgroundColor: isGood ? PALETTE.success : PALETTE.danger,
          }}
        />
        <div
          className="absolute top-[-2px] h-5 w-0.5 bg-foreground"
          style={{ left: `${Math.min(100, (target / max) * 100)}%` }}
        />
      </div>
    </div>
  );
}
