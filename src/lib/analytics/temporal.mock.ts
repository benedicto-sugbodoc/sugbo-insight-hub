/**
 * Hour x weekday visit-volume mock data for the Temporal Pattern Analysis
 * tool (`/analytics/patterns`). Two service-type profiles are modelled:
 * OPD (business-hours-heavy, closed nights) and Emergency (24/7 with an
 * evening/weekend surge) — a realistic contrast for a Level 3 hospital.
 */
import type { HourWeekdayCell } from "@/components/analytics/temporal-heatmap";
import { PH_DEPARTMENTS } from "./ph-constants";

function seeded(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}
function seededRange(i: number, min: number, max: number, salt: number): number {
  return min + seeded(i, salt) * (max - min);
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const TEMPORAL_DEPARTMENTS = PH_DEPARTMENTS;

function opdVolume(dayIndex: number, hour: number, i: number): number {
  const weekday = dayIndex < 5;
  if (!weekday) return Math.round(seededRange(i, 1, 6, 1));
  if (hour < 6 || hour > 19) return Math.round(seededRange(i, 0, 2, 2));
  if (hour >= 8 && hour <= 11) return Math.round(seededRange(i, 34, 58, 3));
  if (hour >= 13 && hour <= 16) return Math.round(seededRange(i, 26, 46, 4));
  return Math.round(seededRange(i, 8, 20, 5));
}

function edVolume(dayIndex: number, hour: number, i: number): number {
  const weekend = dayIndex >= 5;
  const eveningPeak = hour >= 18 && hour <= 23;
  let base = 6;
  if (eveningPeak) base = weekend ? 24 : 18;
  else if (hour >= 8 && hour <= 17) base = weekend ? 14 : 11;
  else base = weekend ? 10 : 7;
  return Math.max(1, Math.round(base + seededRange(i, -3, 3, 6)));
}

function buildGrid(volumeFn: (day: number, hour: number, i: number) => number): HourWeekdayCell[] {
  const cells: HourWeekdayCell[] = [];
  let i = 0;
  DAYS.forEach((day, dayIndex) => {
    for (let hour = 0; hour < 24; hour++) {
      cells.push({ day, dayIndex, hour, value: volumeFn(dayIndex, hour, i) });
      i++;
    }
  });
  return cells;
}

export interface TemporalDataset {
  opd: HourWeekdayCell[];
  emergency: HourWeekdayCell[];
}

export function getTemporalData(): TemporalDataset {
  return { opd: buildGrid(opdVolume), emergency: buildGrid(edVolume) };
}

export function fetchTemporalData(): Promise<TemporalDataset> {
  return new Promise((resolve) => setTimeout(() => resolve(getTemporalData()), 400));
}

/** Deterministic department breakdown for a given day+hour slot, for drill-down. */
export function departmentBreakdownFor(day: string, hour: number, total: number) {
  const seedBase = DAYS.indexOf(day) * 24 + hour;
  const weights = TEMPORAL_DEPARTMENTS.map((_, k) => seededRange(seedBase, 0.4, 1.6, 10 + k));
  const sum = weights.reduce((s, w) => s + w, 0);
  return TEMPORAL_DEPARTMENTS.map((name, k) => ({
    name,
    value: Math.round((weights[k]! / sum) * total),
  }));
}
