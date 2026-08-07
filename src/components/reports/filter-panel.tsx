import * as React from "react";
import { Check, ChevronLeft, ChevronRight, Link2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DateRangePicker } from "./date-range";
import type { DateRangeValue, ReportFilter } from "./types";

export interface SavedFilterSet {
  name: string;
  values: Record<string, string>;
  dateRange: DateRangeValue;
}

export function FilterPanel<T>({
  collapsed,
  onToggleCollapsed,
  filters,
  values,
  onChange,
  dateRange,
  onDateRangeChange,
  showDateRange,
  savedSets,
  onSaveSet,
  onApplySet,
  onCopyLink,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  filters: ReportFilter<T>[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  dateRange: DateRangeValue;
  onDateRangeChange: (value: DateRangeValue) => void;
  showDateRange: boolean;
  savedSets: SavedFilterSet[];
  onSaveSet: (name: string) => void;
  onApplySet: (set: SavedFilterSet) => void;
  onCopyLink: () => void;
}) {
  const [saveName, setSaveName] = React.useState("");
  const [copied, setCopied] = React.useState(false);

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 border-r border-border bg-card py-3">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onToggleCollapsed}
          aria-label="Expand filters"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <aside className="w-full shrink-0 space-y-5 border-r border-border bg-card p-4 print:hidden md:w-64">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Filters</h3>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onToggleCollapsed}
          aria-label="Collapse filters"
        >
          <ChevronLeft className="size-4" />
        </Button>
      </div>

      {showDateRange ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-text-secondary">Date range</p>
          <DateRangePicker value={dateRange} onChange={onDateRangeChange} />
        </div>
      ) : null}

      {filters
        .filter((f) => f.type === "select")
        .map((f) => (
          <div key={f.key}>
            <p className="mb-1.5 text-xs font-medium text-text-secondary">{f.label}</p>
            <Select value={values[f.key] ?? "all"} onValueChange={(v) => onChange(f.key, v)}>
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  All
                </SelectItem>
                {f.options?.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}

      <div className="space-y-2 border-t border-border pt-4">
        <p className="text-xs font-medium text-text-secondary">Saved filter sets</p>
        {savedSets.length > 0 ? (
          <div className="space-y-1">
            {savedSets.map((s) => (
              <button
                key={s.name}
                onClick={() => onApplySet(s)}
                className="flex w-full items-center justify-between rounded-md border border-border px-2 py-1.5 text-left text-xs text-text-secondary hover:bg-muted hover:text-text-primary"
              >
                {s.name}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-text-muted">No saved filter sets yet.</p>
        )}
        <div className="flex gap-1.5">
          <Input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Name this filter set"
            className="h-8 text-xs"
          />
          <Button
            size="icon"
            variant="outline"
            className="size-8 shrink-0"
            disabled={!saveName.trim()}
            onClick={() => {
              if (!saveName.trim()) return;
              onSaveSet(saveName.trim());
              setSaveName("");
            }}
            aria-label="Save filter set"
          >
            <Save className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "w-full justify-center gap-1.5 text-xs",
            copied && "border-success text-success",
          )}
          onClick={() => {
            onCopyLink();
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
        >
          {copied ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
          {copied ? "Link copied" : "Copy shareable link"}
        </Button>
      </div>
    </aside>
  );
}
