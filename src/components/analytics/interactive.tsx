import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  ExternalLink,
  FileText,
  Link2,
  Lock,
  MessageSquarePlus,
  RotateCcw,
  Table as TableIcon,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ReportTable, type SortState } from "@/components/reports/report-table";
import type { ReportColumn } from "@/components/reports/types";
import { DateRangePicker, presetRange } from "@/components/reports/date-range";
import type { DateRangeValue } from "@/components/reports/types";
import { downloadCsv, printCurrentView } from "@/components/reports/export-utils";

export { presetRange, DateRangePicker };
export type { DateRangeValue };

/* ------------------------------------------------------------------ */
/* Mock role — this prototype has no real auth, so annotations and     */
/* other role-gated affordances are demoed behind a lightweight        */
/* client-side role switcher, persisted so it "sticks" like a session. */
/* ------------------------------------------------------------------ */

export type MockRole = "Admin" | "Staff";

export function useMockRole(): [MockRole, (r: MockRole) => void] {
  const [role, setRole] = React.useState<MockRole>("Admin");
  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem("sugbodoc-mock-role");
      if (saved === "Admin" || saved === "Staff") setRole(saved);
    } catch {
      // ignore
    }
  }, []);
  const update = React.useCallback((r: MockRole) => {
    setRole(r);
    try {
      window.localStorage.setItem("sugbodoc-mock-role", r);
    } catch {
      // ignore
    }
  }, []);
  return [role, update];
}

export function RoleSwitcher({
  role,
  onChange,
}: {
  role: MockRole;
  onChange: (r: MockRole) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-border bg-card p-0.5 text-xs">
      {(["Admin", "Staff"] as const).map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={cn(
            "rounded px-2 py-1 font-medium transition-colors",
            role === r
              ? "bg-brand text-brand-foreground"
              : "text-text-muted hover:text-text-primary",
          )}
        >
          Viewing as {r}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Role gate — wraps restricted (Admin-only) report/dashboard content  */
/* with a graceful placeholder for non-Admin mock roles, e.g. the      */
/* Maternal Death Audit and Physician Activity reports.                */
/* ------------------------------------------------------------------ */

export function RoleGate({
  role,
  allow = ["Admin"],
  label = "This section is restricted to Admin roles.",
  children,
}: {
  role: MockRole;
  allow?: MockRole[];
  label?: string;
  children?: React.ReactNode;
}) {
  if (allow.includes(role)) return <>{children}</>;
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
        <Lock className="size-6 text-text-muted" aria-hidden="true" />
        <p className="max-w-sm text-sm text-text-muted">{label}</p>
        <p className="text-xs text-text-muted">
          Switch to Admin using the role switcher above to view this content.
        </p>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Rich hover tooltip — shared across every chart                      */
/* ------------------------------------------------------------------ */

export interface RichTooltipPayloadEntry {
  name?: string;
  value?: number;
  dataKey?: string;
  color?: string;
  payload?: Record<string, unknown>;
}

export function RichTooltip({
  active,
  payload,
  label,
  valueFormatter = (v: number) => v.toLocaleString("en-PH"),
  getTarget,
  targetLabel = "Target",
  getPriorChangePct,
  clickHint = true,
}: {
  active?: boolean;
  payload?: RichTooltipPayloadEntry[];
  label?: string | number;
  valueFormatter?: (v: number) => string;
  getTarget?: (entry: Record<string, unknown> | undefined) => number | undefined;
  targetLabel?: string;
  getPriorChangePct?: (entry: Record<string, unknown> | undefined) => number | undefined;
  clickHint?: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const first = payload[0];
  if (!first) return null;
  const target = getTarget?.(first.payload);
  const change = getPriorChangePct?.(first.payload);
  const single = payload.length === 1;

  return (
    <div
      style={{
        background: "#111111",
        color: "#ffffff",
        borderRadius: 6,
        padding: "8px 10px",
        fontSize: 11,
        maxWidth: 220,
        boxShadow: "0 6px 16px rgba(0,0,0,0.28)",
        lineHeight: 1.5,
      }}
    >
      {single ? (
        <>
          <div style={{ fontWeight: 700, fontSize: 12 }}>
            {first.name ?? first.dataKey ?? ""}
            {label !== undefined ? ` · ${label}` : ""}
          </div>
          <div>
            {typeof first.value === "number"
              ? valueFormatter(first.value)
              : String(first.value ?? "")}
          </div>
        </>
      ) : (
        <>
          {label !== undefined ? (
            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 2 }}>{label}</div>
          ) : null}
          {payload.map((entry, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span style={{ opacity: 0.82 }}>{entry.name ?? entry.dataKey ?? ""}</span>
              <span style={{ fontWeight: 600 }}>
                {typeof entry.value === "number"
                  ? valueFormatter(entry.value)
                  : String(entry.value ?? "")}
              </span>
            </div>
          ))}
        </>
      )}
      {target !== undefined ? (
        <div style={{ opacity: 0.78, fontSize: 10, marginTop: 2 }}>
          {targetLabel}: {valueFormatter(target)}
        </div>
      ) : null}
      {change !== undefined ? (
        <div style={{ opacity: 0.78, fontSize: 10 }}>
          {change >= 0 ? "+" : ""}
          {change.toFixed(1)}% vs prior period
        </div>
      ) : null}
      {clickHint ? (
        <div style={{ marginTop: 4, opacity: 0.68, fontSize: 10, fontStyle: "italic" }}>
          Click to drill down →
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Zoom controls — presets + arrow scroll + reset                      */
/* ------------------------------------------------------------------ */

export type ZoomPreset = "1M" | "3M" | "6M" | "1Y" | "All";

export function ZoomControls({
  preset,
  onPresetChange,
  onShift,
  zoomed,
  onReset,
}: {
  preset: ZoomPreset;
  onPresetChange: (p: ZoomPreset) => void;
  onShift?: (dir: -1 | 1) => void;
  zoomed: boolean;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {onShift ? (
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={() => onShift(-1)}
          aria-label="Scroll left"
        >
          <ArrowLeft className="size-3.5" />
        </Button>
      ) : null}
      <Tabs value={preset} onValueChange={(v) => onPresetChange(v as ZoomPreset)}>
        <TabsList className="h-6">
          {(["1M", "3M", "6M", "1Y", "All"] as const).map((p) => (
            <TabsTrigger key={p} value={p} className="px-1.5 text-[10px]">
              {p}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {onShift ? (
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={() => onShift(1)}
          aria-label="Scroll right"
        >
          <ArrowRight className="size-3.5" />
        </Button>
      ) : null}
      {zoomed ? (
        <button
          onClick={onReset}
          className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-brand hover:underline"
        >
          <RotateCcw className="size-3" />
          Reset zoom
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Compare mode toggle                                                 */
/* ------------------------------------------------------------------ */

export interface CompareOption {
  key: string;
  label: string;
}

export function CompareToggle({
  options,
  value,
  onChange,
}: {
  options: CompareOption[];
  value: string | null;
  onChange: (key: string | null) => void;
}) {
  return (
    <Select value={value ?? "__off__"} onValueChange={(v) => onChange(v === "__off__" ? null : v)}>
      <SelectTrigger className="h-6 w-auto gap-1 border-dashed px-2 text-[10px]">
        <SelectValue placeholder="Compare" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__off__" className="text-xs">
          Compare: off
        </SelectItem>
        {options.map((o) => (
          <SelectItem key={o.key} value={o.key} className="text-xs">
            Compare: {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ------------------------------------------------------------------ */
/* Chain-link (chart-to-chart filter) badge                            */
/* ------------------------------------------------------------------ */

export function ChainLinkBadge({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <div className="mt-1 flex items-center gap-1.5 text-[11px]">
      <Badge variant="outline" className="gap-1 border-brand/30 bg-brand/10 text-brand">
        <Link2 className="size-3" />
        Filtered to {label}
      </Badge>
      <button
        onClick={onClear}
        className="inline-flex items-center gap-0.5 text-text-muted hover:text-text-primary"
      >
        <X className="size-3" />
        Clear filter
      </button>
    </div>
  );
}

export function ChainIcon({ className }: { className?: string }) {
  return <Link2 className={cn("size-3.5 text-brand", className)} />;
}

/* ------------------------------------------------------------------ */
/* Annotations                                                         */
/* ------------------------------------------------------------------ */

export interface ChartAnnotation {
  id: string;
  x: string;
  note: string;
  user: string;
  timestamp: string;
}

export function useAnnotations(chartId: string): {
  annotations: ChartAnnotation[];
  addAnnotation: (x: string, note: string, user: string) => void;
  removeAnnotation: (id: string) => void;
} {
  const key = `sugbodoc-annotations-${chartId}`;
  const [annotations, setAnnotations] = React.useState<ChartAnnotation[]>([]);
  const hydrated = React.useRef(false);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setAnnotations(JSON.parse(raw) as ChartAnnotation[]);
    } catch {
      // ignore
    }
    hydrated.current = true;
  }, [key]);

  const persist = React.useCallback(
    (next: ChartAnnotation[]) => {
      setAnnotations(next);
      if (hydrated.current) {
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // ignore
        }
      }
    },
    [key],
  );

  const addAnnotation = React.useCallback(
    (x: string, note: string, user: string) => {
      const entry: ChartAnnotation = {
        id: `AN-${Date.now()}-${Math.round(Math.random() * 1000)}`,
        x,
        note,
        user,
        timestamp: new Date().toISOString().slice(0, 16).replace("T", " "),
      };
      persist([...annotations, entry]);
    },
    [annotations, persist],
  );

  const removeAnnotation = React.useCallback(
    (id: string) => {
      persist(annotations.filter((a) => a.id !== id));
    },
    [annotations, persist],
  );

  return { annotations, addAnnotation, removeAnnotation };
}

export function AddAnnotationButton({
  role,
  xOptions,
  onAdd,
}: {
  role: MockRole;
  xOptions: string[];
  onAdd: (x: string, note: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [x, setX] = React.useState(xOptions[0] ?? "");
  const [note, setNote] = React.useState("");

  if (role !== "Admin") return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="size-6" aria-label="Add note">
          <MessageSquarePlus className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-2">
        <p className="text-xs font-medium text-text-primary">Add note here</p>
        <Select value={x} onValueChange={setX}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {xOptions.map((o) => (
              <SelectItem key={o} value={o} className="text-xs">
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. PhilHealth rate change effective this month"
          className="h-16 text-xs"
        />
        <Button
          size="sm"
          className="w-full bg-brand text-xs text-brand-foreground hover:bg-brand/90"
          disabled={!note.trim()}
          onClick={() => {
            onAdd(x, note.trim());
            setNote("");
            setOpen(false);
          }}
        >
          Save note
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export function AnnotationList({
  annotations,
  onRemove,
}: {
  annotations: ChartAnnotation[];
  onRemove?: (id: string) => void;
}) {
  if (annotations.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {annotations.map((a) => (
        <div
          key={a.id}
          className="group relative inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] text-warning"
          title={`${a.note} — ${a.user}, ${a.timestamp}`}
        >
          <MessageSquarePlus className="size-2.5" />
          {a.x}: {a.note.length > 28 ? `${a.note.slice(0, 28)}…` : a.note}
          {onRemove ? (
            <button
              onClick={() => onRemove(a.id)}
              className="opacity-0 group-hover:opacity-100"
              aria-label={`Remove annotation: ${a.note}`}
            >
              <X className="size-2.5" />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Interactive chart card — the shell every flagship chart uses        */
/* ------------------------------------------------------------------ */

export function InteractiveChartCard<Row>({
  title,
  description,
  action,
  chainLabel,
  onClearChain,
  table,
  className,
  contentClassName,
  onRowClickInTable,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  chainLabel?: string;
  onClearChain?: () => void;
  table?: { columns: ReportColumn<Row>[]; rows: Row[] };
  className?: string;
  contentClassName?: string;
  onRowClickInTable?: (row: Row) => void;
  children: React.ReactNode;
}) {
  const [view, setView] = React.useState<"chart" | "table">("chart");
  const [sort, setSort] = React.useState<SortState | null>(null);

  const sortedRows = React.useMemo(() => {
    if (!table) return [];
    if (!sort) return table.rows;
    const col = table.columns.find((c) => c.key === sort.key);
    return [...table.rows].sort((a, b) => {
      const av = col?.sortValue ? col.sortValue(a) : (a as Record<string, unknown>)[sort.key];
      const bv = col?.sortValue ? col.sortValue(b) : (b as Record<string, unknown>)[sort.key];
      if (typeof av === "number" && typeof bv === "number")
        return sort.dir === "asc" ? av - bv : bv - av;
      const as = String(av ?? "");
      const bs = String(bv ?? "");
      return sort.dir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
    });
  }, [table, sort]);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="gap-1 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            {description ? (
              <CardDescription className="text-xs">{description}</CardDescription>
            ) : null}
            {chainLabel && onClearChain ? (
              <ChainLinkBadge label={chainLabel} onClear={onClearChain} />
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {action}
            {table ? (
              <Button
                variant="outline"
                size="sm"
                className="h-6 gap-1 px-2 text-[10px]"
                onClick={() => setView((v) => (v === "chart" ? "table" : "chart"))}
              >
                <TableIcon className="size-3" />
                {view === "chart" ? "View as table" : "Back to chart"}
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn("pt-0", contentClassName)}>
        {view === "table" && table ? (
          <ReportTable
            columns={table.columns}
            rows={sortedRows}
            sort={sort}
            onSortChange={(key) =>
              setSort((prev) => {
                if (!prev || prev.key !== key) return { key, dir: "asc" };
                if (prev.dir === "asc") return { key, dir: "desc" };
                return null;
              })
            }
            onRowClick={onRowClickInTable ?? (() => undefined)}
          />
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Chart drill-down drawer — header metric+value+range+filter,         */
/* body detail, footer Export CSV / Export PDF / View Full Report      */
/* ------------------------------------------------------------------ */

export function ChartDrillDrawer({
  open,
  onOpenChange,
  metricName,
  value,
  dateRangeLabel,
  filterLabel,
  children,
  exportRows,
  exportColumns,
  fullReportHref,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metricName: string;
  value?: string;
  dateRangeLabel?: string;
  filterLabel?: string;
  children: React.ReactNode;
  exportRows?: unknown[];
  exportColumns?: { header: string; get: (row: unknown) => string }[];
  fullReportHref?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle className="text-base">{metricName}</SheetTitle>
          <SheetDescription className="text-xs">
            {value ? <span className="font-semibold text-text-primary">{value}</span> : null}
            {dateRangeLabel ? <span> · {dateRangeLabel}</span> : null}
            {filterLabel ? <span> · Filter: {filterLabel}</span> : null}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-4 px-4 pb-4">{children}</div>
        <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
          {exportRows && exportColumns ? (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() =>
                downloadCsv(
                  `${metricName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`,
                  exportColumns,
                  exportRows,
                )
              }
            >
              <Download className="size-3.5" />
              Export CSV
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={printCurrentView}
          >
            <FileText className="size-3.5" />
            Export PDF
          </Button>
          {fullReportHref ? (
            <Button
              asChild
              size="sm"
              className="ml-auto gap-1.5 bg-brand text-xs text-brand-foreground hover:bg-brand/90"
            >
              <a href={fullReportHref}>
                View Full Report
                <ExternalLink className="size-3.5" />
              </a>
            </Button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Global filter bar — date range + entity selects, URL-synced         */
/* ------------------------------------------------------------------ */

export interface GlobalFilterDef {
  key: string;
  label: string;
  options: { label: string; value: string }[];
}

export function useUrlSyncedFilters(paramKeys: string[]) {
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [dateRange, setDateRange] = React.useState<DateRangeValue>(() => presetRange("month"));
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const next: Record<string, string> = {};
    paramKeys.forEach((k) => {
      const v = params.get(k);
      if (v) next[k] = v;
    });
    if (Object.keys(next).length) setValues(next);
    const from = params.get("from");
    const to = params.get("to");
    if (from && to)
      setDateRange({
        from: new Date(from),
        to: new Date(to),
        preset: "custom",
        label: "Custom range",
      });
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const params = new URLSearchParams();
    Object.entries(values).forEach(([k, v]) => {
      if (v && v !== "all") params.set(k, v);
    });
    params.set("from", dateRange.from.toISOString().slice(0, 10));
    params.set("to", dateRange.to.toISOString().slice(0, 10));
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }, [values, dateRange, hydrated]);

  return { values, setValues, dateRange, setDateRange };
}

export function GlobalFilterBar({
  filters,
  values,
  onChange,
  dateRange,
  onDateRangeChange,
}: {
  filters: GlobalFilterDef[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  dateRange: DateRangeValue;
  onDateRangeChange: (v: DateRangeValue) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2.5">
      <span className="text-[11px] font-medium text-text-muted">Global filters:</span>
      <div className="w-44">
        <DateRangePicker value={dateRange} onChange={onDateRangeChange} />
      </div>
      {filters.map((f) => (
        <Select
          key={f.key}
          value={values[f.key] ?? "all"}
          onValueChange={(v) => onChange(f.key, v)}
        >
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder={f.label} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">
              All {f.label}
            </SelectItem>
            {f.options.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      {Object.values(values).some((v) => v && v !== "all") ? (
        <button
          onClick={() => filters.forEach((f) => onChange(f.key, "all"))}
          className="inline-flex items-center gap-1 text-[11px] text-brand hover:underline"
        >
          <X className="size-3" />
          Clear all
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small text search box shared by table views                        */
/* ------------------------------------------------------------------ */

export function InlineSearch({
  value,
  onChange,
  placeholder = "Search…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-7 w-40 text-xs"
    />
  );
}
