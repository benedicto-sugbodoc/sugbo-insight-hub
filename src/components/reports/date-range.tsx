import * as React from "react";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DateRangeValue } from "./types";
import { REPORT_TODAY } from "./export-utils";

function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = (day + 6) % 7; // Monday start
  const out = new Date(d);
  out.setDate(d.getDate() - diff);
  out.setHours(0, 0, 0, 0);
  return out;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfQuarter(d: Date) {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
}

export function presetRange(preset: DateRangeValue["preset"]): DateRangeValue {
  const today = new Date(REPORT_TODAY);
  today.setHours(0, 0, 0, 0);
  switch (preset) {
    case "today":
      return { from: today, to: today, preset, label: "Today" };
    case "week":
      return { from: startOfWeek(today), to: today, preset, label: "This Week" };
    case "quarter":
      return { from: startOfQuarter(today), to: today, preset, label: "This Quarter" };
    case "month":
    default:
      return { from: startOfMonth(today), to: today, preset, label: "This Month" };
  }
}

export function fmtDate(d: Date) {
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

export function isWithinRange(dateStr: string | undefined, range: DateRangeValue): boolean {
  if (!dateStr) return true;
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d.getTime() >= range.from.getTime() && d.getTime() <= range.to.getTime();
}

export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
}) {
  const [customOpen, setCustomOpen] = React.useState(false);

  return (
    <div className="space-y-2">
      <Select
        value={value.preset}
        onValueChange={(v) => {
          if (v === "custom") {
            setCustomOpen(true);
            return;
          }
          onChange(presetRange(v as DateRangeValue["preset"]));
        }}
      >
        <SelectTrigger className="h-8 w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today" className="text-xs">
            Today
          </SelectItem>
          <SelectItem value="week" className="text-xs">
            This Week
          </SelectItem>
          <SelectItem value="month" className="text-xs">
            This Month
          </SelectItem>
          <SelectItem value="quarter" className="text-xs">
            This Quarter
          </SelectItem>
          <SelectItem value="custom" className="text-xs">
            Custom range
          </SelectItem>
        </SelectContent>
      </Select>

      <Popover open={customOpen} onOpenChange={setCustomOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 text-xs font-normal"
          >
            <CalendarIcon className="size-3.5" />
            {fmtDate(value.from)} – {fmtDate(value.to)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            defaultMonth={value.from}
            selected={{ from: value.from, to: value.to } satisfies DateRange}
            onSelect={(range) => {
              if (range?.from) {
                onChange({
                  from: range.from,
                  to: range.to ?? range.from,
                  preset: "custom",
                  label: "Custom range",
                });
              }
            }}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
