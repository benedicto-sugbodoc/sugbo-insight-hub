/**
 * Deterministic pseudo-random helpers for the shared synthetic hospital
 * dataset.
 *
 * These mirror the `seeded` / `seededRange` pattern already used throughout
 * `src/lib/analytics/**` (see `src/lib/analytics/lgu/shared.mock.ts`), with one
 * deliberate fix: the original formula collapses to the same value for `i === 0`
 * regardless of `salt` (because `sin(0 * k + 78.233)` drops the salt entirely).
 * Here the index is shifted by 1 and the salt is also added as an additive term,
 * so different salts yield independent streams even at index 0.
 *
 * `Math.random` is never used anywhere in this module tree: the whole dataset is
 * generated during SSR and re-generated on the client, so every value must be
 * reproducible bit-for-bit.
 */

/** Deterministic pseudo-random in [0,1). */
export function seeded(i: number, salt = 1): number {
  const x = Math.sin((i + 1) * 12.9898 * salt + salt * 4.1357 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Deterministic pseudo-random in [min, max). */
export function seededRange(i: number, min: number, max: number, salt = 1): number {
  return min + seeded(i, salt) * (max - min);
}

/** Deterministic pseudo-random integer in [min, max] (both inclusive). */
export function seededInt(i: number, min: number, max: number, salt = 1): number {
  if (max <= min) return min;
  const v = Math.floor(min + seeded(i, salt) * (max - min + 1));
  return v > max ? max : v;
}

/** Deterministic boolean that is true with probability `p`. */
export function seededBool(i: number, p: number, salt = 1): boolean {
  return seeded(i, salt) < p;
}

/** Deterministic element pick from a non-empty array. */
export function seededPick<T>(items: readonly T[], i: number, salt = 1): T {
  if (items.length === 0) {
    throw new Error("seededPick: cannot pick from an empty array");
  }
  return items[seededInt(i, 0, items.length - 1, salt)]!;
}

/**
 * Resolve a weighted choice from a [0,1) roll. Returns the chosen index.
 * Weights need not be normalized; non-positive totals fall back to index 0.
 */
export function weightedIndex(weights: readonly number[], roll: number): number {
  let total = 0;
  for (const w of weights) total += w > 0 ? w : 0;
  if (total <= 0) return 0;
  const target = roll * total;
  let acc = 0;
  for (let i = 0; i < weights.length; i += 1) {
    const w = weights[i]!;
    acc += w > 0 ? w : 0;
    if (target < acc) return i;
  }
  return weights.length - 1;
}

/** Deterministic weighted pick over a parallel `items` / `weights` pair. */
export function seededWeightedPick<T>(
  items: readonly T[],
  weights: readonly number[],
  i: number,
  salt = 1,
): T {
  if (items.length === 0) {
    throw new Error("seededWeightedPick: cannot pick from an empty array");
  }
  return items[weightedIndex(weights, seeded(i, salt))]!;
}

/**
 * Approximately-normal deviate (mean 0, sd 1) built from the average of four
 * uniform draws (Bates distribution, rescaled). Used where a bell-shaped spread
 * reads more realistically than a flat one — e.g. satisfaction scores.
 */
export function seededNormal(i: number, salt = 1): number {
  const u =
    (seeded(i, salt) +
      seeded(i, salt * 3 + 1) +
      seeded(i, salt * 7 + 2) +
      seeded(i, salt * 11 + 3)) /
    4;
  return (u - 0.5) * 3.4641; // sd of mean-of-4-uniforms is 1/sqrt(48)
}

/** Clamp helper used pervasively by the generator. */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** Round to 2 decimal places (money). */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Binary search over a cumulative-weight array; returns the selected slot. */
export function cumulativeIndex(cumulative: readonly number[], roll: number): number {
  const total = cumulative[cumulative.length - 1] ?? 0;
  if (total <= 0) return 0;
  const target = roll * total;
  let lo = 0;
  let hi = cumulative.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((cumulative[mid] ?? 0) <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
