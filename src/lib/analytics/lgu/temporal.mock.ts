/**
 * Hour x weekday visit-volume mock data for the LGU Temporal Pattern
 * Analysis tool (`/lgu/analytics/patterns`). BHCs run business hours only
 * and are closed on Sundays — a different shape from the hospital's
 * 24/7 profile, useful for staffing and clinic-hour planning.
 */
import type { HourWeekdayCell } from "@/components/analytics/temporal-heatmap";
import { BHC_LIST } from "./shared.mock";

function seeded(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}
function seededRange(i: number, min: number, max: number, salt: number): number {
  return min + seeded(i, salt) * (max - min);
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const TEMPORAL_BHCS = BHC_LIST;

function konsultaVolume(dayIndex: number, hour: number, i: number): number {
  if (dayIndex === 6) return 0; // closed Sundays
  if (dayIndex === 5 && hour > 12) return 0; // half-day Saturday
  if (hour < 7 || hour > 17) return 0;
  if (hour >= 8 && hour <= 10) return Math.round(seededRange(i, 24, 44, 21));
  if (hour >= 13 && hour <= 15) return Math.round(seededRange(i, 14, 28, 22));
  return Math.round(seededRange(i, 3, 10, 23));
}

function programVolume(dayIndex: number, hour: number, i: number): number {
  if (dayIndex >= 5) return 0; // TB-DOTS / ANC weekdays only
  if (hour < 7 || hour > 16) return 0;
  if (hour >= 8 && hour <= 10) return Math.round(seededRange(i, 6, 16, 24));
  return Math.round(seededRange(i, 1, 6, 25));
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

export interface LguTemporalDataset {
  konsulta: HourWeekdayCell[];
  programs: HourWeekdayCell[];
}

export function getLguTemporalData(): LguTemporalDataset {
  return { konsulta: buildGrid(konsultaVolume), programs: buildGrid(programVolume) };
}

export function fetchLguTemporalData(): Promise<LguTemporalDataset> {
  return new Promise((resolve) => setTimeout(() => resolve(getLguTemporalData()), 400));
}

export function bhcBreakdownFor(day: string, hour: number, total: number) {
  const seedBase = DAYS.indexOf(day) * 24 + hour;
  const weights = TEMPORAL_BHCS.map((_, k) => seededRange(seedBase, 0.4, 1.6, 30 + k));
  const sum = weights.reduce((s, w) => s + w, 0) || 1;
  return TEMPORAL_BHCS.map((name, k) => ({
    name,
    value: Math.round((weights[k]! / sum) * total),
  }));
}
