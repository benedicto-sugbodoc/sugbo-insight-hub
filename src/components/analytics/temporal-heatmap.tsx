import * as React from "react";

import { cn } from "@/lib/utils";

export interface HourWeekdayCell {
  day: string;
  dayIndex: number;
  hour: number;
  value: number;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOUR_LABELS = [0, 3, 6, 9, 12, 15, 18, 21];

function intensity(value: number, max: number): string {
  if (max <= 0) return "rgba(68, 84, 195, 0.06)";
  const ratio = Math.min(1, value / max);
  const alpha = 0.06 + ratio * 0.86;
  return `rgba(68, 84, 195, ${alpha.toFixed(3)})`;
}

/** Hour (0-23) x weekday (Mon-Sun) visit-volume heatmap. */
export function HourWeekdayHeatmap({
  data,
  onCellClick,
  selected,
}: {
  data: HourWeekdayCell[];
  onCellClick?: (cell: HourWeekdayCell) => void;
  selected?: { day: string; hour: number } | null;
}) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const byKey = new Map(data.map((d) => [`${d.day}-${d.hour}`, d]));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        <div
          className="ml-12 grid gap-[2px] pb-1"
          style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}
        >
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="text-center text-[9px] text-text-muted">
              {HOUR_LABELS.includes(h) ? `${h}h` : ""}
            </div>
          ))}
        </div>
        {DAYS.map((day) => (
          <div key={day} className="flex items-center gap-1">
            <div className="w-11 shrink-0 text-right text-[11px] text-text-muted">{day}</div>
            <div
              className="grid flex-1 gap-[2px]"
              style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}
            >
              {Array.from({ length: 24 }, (_, hour) => {
                const cell = byKey.get(`${day}-${hour}`);
                const value = cell?.value ?? 0;
                const isSelected = selected?.day === day && selected.hour === hour;
                return (
                  <button
                    key={hour}
                    title={`${day} ${hour}:00 · ${value} visits`}
                    onClick={() => cell && onCellClick?.(cell)}
                    className={cn(
                      "aspect-square rounded-[2px] transition-transform hover:scale-110 hover:ring-1 hover:ring-brand",
                      isSelected && "ring-2 ring-brand",
                    )}
                    style={{ backgroundColor: intensity(value, maxValue) }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
