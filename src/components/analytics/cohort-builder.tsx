import * as React from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarClock, Download, RotateCcw, Save, Send, ShieldCheck, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PanelCard, PALETTE, SectionTitle, num } from "@/components/analytics/shared";
import { RichTooltip } from "@/components/analytics/interactive";
import { ReportTable } from "@/components/reports/report-table";
import type { ReportColumn } from "@/components/reports/types";
import { downloadCsv } from "@/components/reports/export-utils";
import { cn } from "@/lib/utils";

export interface CohortSelectField<T> {
  key: string;
  label: string;
  type: "select";
  group: string;
  options: { label: string; value: string }[];
  getValue: (row: T) => string;
}
export interface CohortRangeField<T> {
  key: string;
  label: string;
  type: "range";
  group: string;
  min: number;
  max: number;
  unit?: string;
  getValue: (row: T) => number;
}
export interface CohortBooleanField<T> {
  key: string;
  label: string;
  type: "boolean";
  group: string;
  getValue: (row: T) => boolean;
}
export type CohortField<T> = CohortSelectField<T> | CohortRangeField<T> | CohortBooleanField<T>;

interface SavedCohort {
  id: string;
  name: string;
  criteria: Record<string, unknown>;
  savedAt: string;
  count: number;
}

export interface CohortBuilderProps<T> {
  title: string;
  description: string;
  fields: CohortField<T>[];
  rows: T[];
  getId: (row: T) => string;
  resultColumns: ReportColumn<T>[];
  breakdownFieldKeys: string[];
  exportColumns: { header: string; get: (row: T) => string }[];
  storageKey: string;
  consentText: string;
}

export function CohortBuilder<T>({
  title,
  description,
  fields,
  rows,
  resultColumns,
  breakdownFieldKeys,
  exportColumns,
  storageKey,
  consentText,
}: CohortBuilderProps<T>) {
  const [selectCriteria, setSelectCriteria] = React.useState<Record<string, string[]>>({});
  const [rangeCriteria, setRangeCriteria] = React.useState<Record<string, [number, number]>>({});
  const [boolCriteria, setBoolCriteria] = React.useState<Record<string, "any" | "yes" | "no">>({});
  const [consented, setConsented] = React.useState(false);
  const [savedCohorts, setSavedCohorts] = React.useState<SavedCohort[]>([]);
  const [saveName, setSaveName] = React.useState("");
  const [savePopoverOpen, setSavePopoverOpen] = React.useState(false);
  const [campaignSent, setCampaignSent] = React.useState(false);
  const hydrated = React.useRef(false);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`sugbodoc-cohorts-${storageKey}`);
      if (raw) setSavedCohorts(JSON.parse(raw) as SavedCohort[]);
    } catch {
      // ignore
    }
    hydrated.current = true;
  }, [storageKey]);

  const persistCohorts = (next: SavedCohort[]) => {
    setSavedCohorts(next);
    if (hydrated.current) {
      try {
        window.localStorage.setItem(`sugbodoc-cohorts-${storageKey}`, JSON.stringify(next));
      } catch {
        // ignore
      }
    }
  };

  const filtered = React.useMemo(() => {
    return rows.filter((row) => {
      for (const field of fields) {
        if (field.type === "select") {
          const active = selectCriteria[field.key];
          if (active && active.length > 0 && !active.includes(field.getValue(row))) return false;
        } else if (field.type === "range") {
          const bounds = rangeCriteria[field.key];
          if (bounds) {
            const v = field.getValue(row);
            if (v < bounds[0] || v > bounds[1]) return false;
          }
        } else if (field.type === "boolean") {
          const want = boolCriteria[field.key];
          if (want && want !== "any") {
            const v = field.getValue(row);
            if (want === "yes" && !v) return false;
            if (want === "no" && v) return false;
          }
        }
      }
      return true;
    });
  }, [rows, fields, selectCriteria, rangeCriteria, boolCriteria]);

  const activeCriteriaCount =
    Object.values(selectCriteria).filter((v) => v.length > 0).length +
    Object.keys(rangeCriteria).length +
    Object.values(boolCriteria).filter((v) => v !== "any").length;

  const resetAll = () => {
    setSelectCriteria({});
    setRangeCriteria({});
    setBoolCriteria({});
  };

  const groups = Array.from(new Set(fields.map((f) => f.group)));

  return (
    <div className="space-y-4">
      <SectionTitle
        title={title}
        description={description}
        action={
          activeCriteriaCount > 0 ? (
            <button
              onClick={resetAll}
              className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
            >
              <RotateCcw className="size-3" />
              Reset all filters
            </button>
          ) : undefined
        }
      />

      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        {/* Filter panel */}
        <PanelCard
          title="Cohort criteria"
          description="Combine filters across resources — all conditions apply (AND)."
        >
          <div className="max-h-[600px] space-y-5 overflow-y-auto pr-1">
            {groups.map((group) => (
              <div key={group} className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                  {group}
                </p>
                {fields
                  .filter((f) => f.group === group)
                  .map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <p className="text-xs font-medium text-text-secondary">{field.label}</p>
                      {field.type === "select" ? (
                        <div className="flex flex-wrap gap-1">
                          {field.options.map((opt) => {
                            const active = (selectCriteria[field.key] ?? []).includes(opt.value);
                            return (
                              <button
                                key={opt.value}
                                onClick={() =>
                                  setSelectCriteria((prev) => {
                                    const current = prev[field.key] ?? [];
                                    const next = current.includes(opt.value)
                                      ? current.filter((v) => v !== opt.value)
                                      : [...current, opt.value];
                                    return { ...prev, [field.key]: next };
                                  })
                                }
                                className={cn(
                                  "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                                  active
                                    ? "border-brand bg-brand text-brand-foreground"
                                    : "border-border text-text-secondary hover:bg-muted",
                                )}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      ) : field.type === "range" ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            placeholder={String(field.min)}
                            className="h-7 w-20 text-xs"
                            value={rangeCriteria[field.key]?.[0] ?? ""}
                            onChange={(e) => {
                              const min =
                                e.target.value === "" ? field.min : Number(e.target.value);
                              setRangeCriteria((prev) => ({
                                ...prev,
                                [field.key]: [min, prev[field.key]?.[1] ?? field.max],
                              }));
                            }}
                          />
                          <span className="text-xs text-text-muted">to</span>
                          <Input
                            type="number"
                            placeholder={String(field.max)}
                            className="h-7 w-20 text-xs"
                            value={rangeCriteria[field.key]?.[1] ?? ""}
                            onChange={(e) => {
                              const max =
                                e.target.value === "" ? field.max : Number(e.target.value);
                              setRangeCriteria((prev) => ({
                                ...prev,
                                [field.key]: [prev[field.key]?.[0] ?? field.min, max],
                              }));
                            }}
                          />
                          {field.unit ? (
                            <span className="text-xs text-text-muted">{field.unit}</span>
                          ) : null}
                        </div>
                      ) : (
                        <Select
                          value={boolCriteria[field.key] ?? "any"}
                          onValueChange={(v) =>
                            setBoolCriteria((prev) => ({
                              ...prev,
                              [field.key]: v as "any" | "yes" | "no",
                            }))
                          }
                        >
                          <SelectTrigger className="h-7 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="any" className="text-xs">
                              Any
                            </SelectItem>
                            <SelectItem value="yes" className="text-xs">
                              Yes
                            </SelectItem>
                            <SelectItem value="no" className="text-xs">
                              No
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ))}
              </div>
            ))}

            {savedCohorts.length > 0 ? (
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                  Saved cohorts
                </p>
                {savedCohorts.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-text-secondary">{c.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {num(c.count)} pts
                    </Badge>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </PanelCard>

        {/* Results */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
            <Users className="size-5 text-brand" />
            <div>
              <div className="text-2xl font-semibold text-text-primary">{num(filtered.length)}</div>
              <div className="text-xs text-text-muted">
                patients match
                {activeCriteriaCount > 0 ? ` (${activeCriteriaCount} filters active)` : ""} — of{" "}
                {num(rows.length)} in cohort universe
              </div>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Popover open={savePopoverOpen} onOpenChange={setSavePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                    <Save className="size-3.5" />
                    Save cohort
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 space-y-2">
                  <p className="text-xs font-medium text-text-primary">
                    Save this cohort definition
                  </p>
                  <Input
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="e.g. Uncontrolled HTN, 60+"
                    className="h-7 text-xs"
                  />
                  <Button
                    size="sm"
                    disabled={!saveName.trim()}
                    className="w-full bg-brand text-xs text-brand-foreground hover:bg-brand/90"
                    onClick={() => {
                      persistCohorts([
                        ...savedCohorts,
                        {
                          id: `CH-${Date.now()}`,
                          name: saveName.trim(),
                          criteria: { selectCriteria, rangeCriteria, boolCriteria },
                          savedAt: "Aug 7, 2026",
                          count: filtered.length,
                        },
                      ]);
                      setSaveName("");
                      setSavePopoverOpen(false);
                    }}
                  >
                    Save
                  </Button>
                  <p className="text-[10px] text-text-muted">
                    Saved locally to this browser. Connect the cohort service to sync across users.
                  </p>
                </PopoverContent>
              </Popover>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                disabled={filtered.length === 0}
                onClick={() => {
                  setCampaignSent(true);
                  window.setTimeout(() => setCampaignSent(false), 3000);
                }}
              >
                <Send className="size-3.5" />
                {campaignSent ? "Scaffold only — not sent" : "Create intervention campaign"}
              </Button>
            </div>
          </div>

          {breakdownFieldKeys.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {breakdownFieldKeys.map((key) => {
                const field = fields.find((f) => f.key === key);
                if (!field || field.type !== "select") return null;
                const counts = field.options.map((opt) => ({
                  name: opt.label,
                  value: filtered.filter((r) => field.getValue(r) === opt.value).length,
                }));
                return (
                  <PanelCard
                    key={key}
                    title={`By ${field.label}`}
                    description="Filtered cohort breakdown"
                  >
                    <ResponsiveContainer width="100%" height={Math.max(120, counts.length * 28)}>
                      <BarChart data={counts} layout="vertical" margin={{ left: 8, right: 16 }}>
                        <XAxis type="number" hide />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={110}
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip content={<RichTooltip valueFormatter={num} clickHint={false} />} />
                        <Bar
                          dataKey="value"
                          name="Patients"
                          fill={PALETTE.brand}
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </PanelCard>
                );
              })}
            </div>
          ) : null}

          <PanelCard
            title="Matching patients"
            description="Row-level detail — export is gated by the consent confirmation below."
          >
            <ReportTable
              columns={resultColumns}
              rows={filtered.slice(0, 200)}
              sort={null}
              onSortChange={() => undefined}
              onRowClick={() => undefined}
            />
            {filtered.length > 200 ? (
              <p className="mt-2 text-[11px] text-text-muted">
                Showing first 200 of {num(filtered.length)} matching patients. Export CSV for the
                full extract.
              </p>
            ) : null}
          </PanelCard>

          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border bg-card p-4">
            <ShieldCheck className="size-5 shrink-0 text-brand" />
            <label className="flex flex-1 items-start gap-2 text-xs text-text-secondary">
              <Checkbox
                checked={consented}
                onCheckedChange={(v) => setConsented(v === true)}
                className="mt-0.5"
              />
              {consentText}
            </label>
            <Button
              size="sm"
              disabled={!consented || filtered.length === 0}
              className="gap-1.5 bg-brand text-xs text-brand-foreground hover:bg-brand/90"
              onClick={() =>
                downloadCsv(
                  `cohort-extract-${filtered.length}-patients.csv`,
                  exportColumns as { header: string; get: (row: unknown) => string }[],
                  filtered as unknown[],
                )
              }
            >
              <Download className="size-3.5" />
              Export cohort (CSV)
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" disabled>
              <CalendarClock className="size-3.5" />
              Schedule recurring extract
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function idColumn<T>(getId: (row: T) => string): ReportColumn<T> {
  return { key: "__id", header: "ID", render: (r) => getId(r) };
}
