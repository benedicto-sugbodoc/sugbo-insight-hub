/**
 * UTC-only date helpers for the shared hospital dataset.
 *
 * Everything is computed in UTC on purpose: the dataset is generated on the
 * server during SSR and again in the browser during hydration, and those two
 * environments can sit in different timezones. Using local-time getters would
 * silently shift admissions across day/month boundaries and break hydration.
 */

export const MS_DAY = 86_400_000;
export const MS_HOUR = 3_600_000;

export const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** `"YYYY-MM-DD"` -> epoch ms at UTC midnight. */
export function parseDate(date: string): number {
  return Date.parse(`${date}T00:00:00.000Z`);
}

/** Epoch ms -> `"YYYY-MM-DD"`. */
export function toDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Epoch ms -> full ISO-8601 UTC timestamp. */
export function toDateTime(ms: number): string {
  return new Date(ms).toISOString();
}

/** ISO date or datetime string -> epoch ms. */
export function toMs(value: string): number {
  return value.length <= 10 ? parseDate(value) : Date.parse(value);
}

/** `"YYYY-MM"` bucket key for any ISO date/datetime string. */
export function monthKeyOf(value: string): string {
  return value.slice(0, 7);
}

/** Number of days in a UTC month (`monthIndex` 0-based). */
export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Chart label such as `"Mar 26"` from a `"YYYY-MM"` key. */
export function monthLabel(key: string): string {
  const year = Number(key.slice(0, 4));
  const monthIndex = Number(key.slice(5, 7)) - 1;
  return `${MONTH_SHORT[monthIndex] ?? "???"} ${String(year).slice(2)}`;
}

/** Whole days between two epoch-ms values, floored, never negative. */
export function daysBetween(fromMs: number, toMsValue: number): number {
  const diff = Math.floor((toMsValue - fromMs) / MS_DAY);
  return diff < 0 ? 0 : diff;
}

/** Age in completed years on a given epoch-ms instant. */
export function ageOn(birthDate: string, atMs: number): number {
  const birth = new Date(parseDate(birthDate));
  const at = new Date(atMs);
  let age = at.getUTCFullYear() - birth.getUTCFullYear();
  const monthDelta = at.getUTCMonth() - birth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && at.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }
  return age < 0 ? 0 : age;
}

/** Standard 5-bucket age band used by demographic charts. */
export function ageBand(age: number): string {
  if (age < 1) return "<1";
  if (age <= 4) return "1-4";
  if (age <= 17) return "5-17";
  if (age <= 39) return "18-39";
  if (age <= 59) return "40-59";
  if (age <= 74) return "60-74";
  return "75+";
}
