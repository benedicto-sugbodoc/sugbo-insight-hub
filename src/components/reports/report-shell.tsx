import * as React from "react";
import { Check, Clock, Download, FileSpreadsheet, FileText, Printer, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { RoleGate, RoleSwitcher, useMockRole } from "@/components/analytics/interactive";

import { presetRange } from "./date-range";
import { downloadCsv, downloadExcel, printCurrentView, slugFilename } from "./export-utils";
import { FilterPanel, SavedFilterSet } from "./filter-panel";
import { RecordDrawer } from "./record-drawer";
import { ReportTable, SortState } from "./report-table";
import type { DateRangeValue, ReportConfig } from "./types";

function useLocalStorage<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = React.useState<T>(initial);
  const hydrated = React.useRef(false);
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setValue(JSON.parse(raw) as T);
    } catch {
      // ignore malformed storage
    }
    hydrated.current = true;
  }, [key]);
  const update = React.useCallback(
    (v: T) => {
      setValue(v);
      if (hydrated.current) {
        try {
          window.localStorage.setItem(key, JSON.stringify(v));
        } catch {
          // storage unavailable — filter set simply won't persist
        }
      }
    },
    [key],
  );
  return [value, update];
}

export function ReportShell<T>({ config }: { config: ReportConfig<T> }) {
  const rows = React.useMemo(() => config.getRows(), [config]);
  const [role, setRole] = useMockRole();
  const restricted = Boolean(config.roleNote) && role !== "Admin";

  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [dateRange, setDateRange] = React.useState<DateRangeValue>(() => presetRange("month"));
  const [filterValues, setFilterValues] = React.useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    config.filters.forEach((f) => {
      if (f.type === "select") initial[f.key] = "all";
    });
    return initial;
  });
  const [searchText, setSearchText] = React.useState("");

  // Apply filters encoded in the URL (from a shared link) after mount only,
  // so the server-rendered and first client-rendered HTML stay identical.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q) setSearchText(q);
    setFilterValues((prev) => {
      const next = { ...prev };
      let changed = false;
      config.filters
        .filter((f) => f.type === "select")
        .forEach((f) => {
          const v = params.get(f.key);
          if (v) {
            next[f.key] = v;
            changed = true;
          }
        });
      return changed ? next : prev;
    });
    const from = params.get("from");
    const to = params.get("to");
    if (from && to) {
      setDateRange({
        from: new Date(from),
        to: new Date(to),
        preset: "custom",
        label: "Custom range",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [sort, setSort] = React.useState<SortState | null>(
    config.defaultSort ? { key: config.defaultSort.key, dir: config.defaultSort.dir } : null,
  );
  const [selectedRow, setSelectedRow] = React.useState<T | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [savedSets, setSavedSets] = useLocalStorage<SavedFilterSet[]>(
    `sugbodoc-report-filters-${config.id}`,
    [],
  );
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [scheduleSaved, setScheduleSaved] = React.useState(false);
  const [scheduleEmail, setScheduleEmail] = React.useState("");
  const [scheduleCadence, setScheduleCadence] = React.useState("weekly");

  const filtered = React.useMemo(() => {
    let out = rows;

    if (config.dateField || config.getDate) {
      out = out.filter((r) => {
        const dateStr = config.getDate
          ? config.getDate(r)
          : (r as Record<string, unknown>)[config.dateField as string];
        const d = new Date(String(dateStr));
        d.setHours(0, 0, 0, 0);
        return d.getTime() >= dateRange.from.getTime() && d.getTime() <= dateRange.to.getTime();
      });
    }

    config.filters
      .filter((f) => f.type === "select")
      .forEach((f) => {
        const val = filterValues[f.key];
        if (val && val !== "all") {
          out = out.filter((r) =>
            f.predicate
              ? f.predicate(r, val)
              : String((r as Record<string, unknown>)[f.key]) === val,
          );
        }
      });

    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      out = out.filter((r) => {
        const text = config.getSearchText
          ? config.getSearchText(r)
          : config.searchFields
              .map((k) => String((r as Record<string, unknown>)[k] ?? ""))
              .join(" ");
        return text.toLowerCase().includes(q);
      });
    }

    if (sort) {
      const col = config.columns.find((c) => c.key === sort.key);
      out = [...out].sort((a, b) => {
        const av = col?.sortValue ? col.sortValue(a) : (a as Record<string, unknown>)[sort.key];
        const bv = col?.sortValue ? col.sortValue(b) : (b as Record<string, unknown>)[sort.key];
        if (typeof av === "number" && typeof bv === "number") {
          return sort.dir === "asc" ? av - bv : bv - av;
        }
        const as = String(av ?? "");
        const bs = String(bv ?? "");
        return sort.dir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
      });
    }

    return out;
  }, [rows, config, dateRange, filterValues, searchText, sort]);

  const hasDateRange = Boolean(config.dateField || config.getDate);

  function handleSortChange(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  function handleRowClick(row: T) {
    setSelectedRow(row);
    setDrawerOpen(true);
  }

  const exportColumns = config.columns.map((c) => ({
    header: c.header,
    get: (row: unknown) =>
      c.exportValue?.(row as T) ?? String((row as Record<string, unknown>)[c.key] ?? ""),
  }));

  function handleCopyLink() {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    Object.entries(filterValues).forEach(([k, v]) => {
      if (v && v !== "all") params.set(k, v);
    });
    if (searchText.trim()) params.set("q", searchText.trim());
    params.set("from", dateRange.from.toISOString().slice(0, 10));
    params.set("to", dateRange.to.toISOString().slice(0, 10));
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => undefined);
    }
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }

  const summaryRow = config.summaryRow?.(filtered);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col md:flex-row">
      <FilterPanel
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        filters={config.filters}
        values={filterValues}
        onChange={(key, value) => setFilterValues((v) => ({ ...v, [key]: value }))}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        showDateRange={hasDateRange}
        savedSets={savedSets}
        onSaveSet={(name) =>
          setSavedSets([...savedSets, { name, values: filterValues, dateRange }])
        }
        onApplySet={(set) => {
          setFilterValues(set.values);
          setDateRange(set.dateRange);
        }}
        onCopyLink={handleCopyLink}
      />

      <div className="flex-1 space-y-4 p-4">
        <header className="space-y-1 print:mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="border-brand/30 bg-brand/10 text-[11px] font-medium text-brand"
            >
              {config.code}
            </Badge>
            <h1 className="text-lg font-semibold tracking-tight text-text-primary">
              {config.title}
            </h1>
            {config.roleNote ? (
              <Badge
                variant="outline"
                className="border-warning/30 bg-warning/10 text-[11px] text-warning"
              >
                {config.roleNote}
              </Badge>
            ) : null}
            {config.roleNote ? (
              <span className="print:hidden">
                <RoleSwitcher role={role} onChange={setRole} />
              </span>
            ) : null}
          </div>
          <p className="text-xs text-text-muted">{config.purpose}</p>
          {config.formatNote ? (
            <p className="text-[11px] italic text-text-muted">{config.formatNote}</p>
          ) : null}
          {config.automationNote ? (
            <p className="text-[11px] text-text-muted">
              <Clock className="mr-1 inline size-3" />
              {config.automationNote}
            </p>
          ) : null}
        </header>

        {restricted ? (
          <RoleGate
            role={role}
            label={`Restricted: ${config.roleNote}. Switch to Admin above to view this report.`}
          />
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" />
                <Input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search within results…"
                  className="h-8 w-56 pl-8 text-xs"
                />
              </div>

              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() =>
                    downloadCsv(slugFilename(config.title, "csv"), exportColumns, filtered)
                  }
                >
                  <Download className="size-3.5" />
                  CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() =>
                    downloadExcel(
                      slugFilename(config.title, "xls"),
                      config.title,
                      exportColumns,
                      filtered,
                    )
                  }
                >
                  <FileSpreadsheet className="size-3.5" />
                  Excel
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs"
                  onClick={printCurrentView}
                >
                  <FileText className="size-3.5" />
                  PDF
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs"
                  onClick={printCurrentView}
                >
                  <Printer className="size-3.5" />
                  Print
                </Button>

                <Popover open={scheduleOpen} onOpenChange={setScheduleOpen}>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                      <Clock className="size-3.5" />
                      Schedule
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 space-y-3">
                    <p className="text-xs font-medium text-text-primary">
                      Send this report automatically
                    </p>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-text-secondary">Frequency</Label>
                      <Select value={scheduleCadence} onValueChange={setScheduleCadence}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly" className="text-xs">
                            Weekly
                          </SelectItem>
                          <SelectItem value="monthly" className="text-xs">
                            Monthly
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-text-secondary">Send to</Label>
                      <Input
                        value={scheduleEmail}
                        onChange={(e) => setScheduleEmail(e.target.value)}
                        placeholder="name@sugbodoc.ph"
                        type="email"
                        className="h-8 text-xs"
                      />
                    </div>
                    <Button
                      size="sm"
                      className={cn(
                        "w-full gap-1.5 bg-brand text-xs text-brand-foreground hover:bg-brand/90",
                        scheduleSaved && "bg-success hover:bg-success",
                      )}
                      disabled={!scheduleEmail.trim()}
                      onClick={() => setScheduleSaved(true)}
                    >
                      {scheduleSaved ? <Check className="size-3.5" /> : null}
                      {scheduleSaved
                        ? "Schedule saved"
                        : `Send ${scheduleCadence} to ${scheduleEmail || "…"}`}
                    </Button>
                    <p className="text-[10px] text-text-muted">
                      UI scaffold — connect an email/reporting service to activate delivery.
                    </p>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <p className="text-xs text-text-muted print:hidden">
              Showing {filtered.length} of {rows.length} results
            </p>

            <ReportTable
              columns={config.columns}
              rows={filtered}
              sort={sort}
              onSortChange={handleSortChange}
              onRowClick={handleRowClick}
              {...(config.rowAlert ? { rowAlert: config.rowAlert } : {})}
              {...(summaryRow ? { summaryRow } : {})}
            />
          </>
        )}
      </div>

      <RecordDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        data={selectedRow ? config.getDrawer(selectedRow) : null}
      />
    </div>
  );
}
