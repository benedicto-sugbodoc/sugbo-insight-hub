/* ==========================================================================
 * top20-filter-context — cross-chart filter state for `Top20NewCharts`
 * ==========================================================================
 *
 * A deliberately small, self-contained filter layer for the
 * `/analytics/new-charts` dashboard only. It is NOT related to
 * `hospital-filter-context.tsx` (which drives the shared-dataset hospital
 * pages via `EncounterFilter`); the two systems have different data sources,
 * different dimensions and are never mounted together. Nothing here imports
 * from that module.
 *
 * WHY ONLY TWO DIMENSIONS
 * -----------------------
 * The 20 charts on that page read from ~15 unrelated row shapes. Exactly two
 * fields recur across enough of them to make a *real* cross-chart filter:
 *
 *   - `department` — PhysicianActivityRow, RevenueRow, ClaimRow, FormularyRow,
 *     CohortPatient (charts 3, 5, 7, 9, 12). Values are `PH_DEPARTMENTS`, so
 *     they also key straight into `PH_DEPARTMENT_COLORS`.
 *   - `barangay` — ImmunizationCoverageRow, DengueRow, HouseholdProfileRow and
 *     `NcdBarangay.name` (charts 14, 15, 18, 19), plus charts 13 and 17 which
 *     are keyed by `bhc` and are reached through the barangay -> BHC join
 *     below.
 *
 * Anything else (date range, payer, case type) exists on one or two row shapes
 * at most, so a global control for it would be a filter that almost nothing
 * responds to. It is intentionally absent.
 *
 * THE BARANGAY -> BHC JOIN
 * ------------------------
 * `BARANGAYS` in `src/lib/analytics/lgu/shared.mock.ts` already models the real
 * relation: 15 barangays clustered under 5 physical BHC facilities, with each
 * `Barangay` carrying the `bhc` facility name its catchment reports to. The
 * `bhc` strings on `ReferralRow` / `KonsultaUtilRow` are those same facility
 * names (both are generated from `BHC_LIST = BHC_FACILITIES.map(b => b.name)`),
 * so the lookup below is an existing foreign key, not an invented mapping.
 * ========================================================================== */

import * as React from "react";
import { X } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PH_DEPARTMENTS } from "@/lib/analytics/ph-constants";
import { BARANGAYS } from "@/lib/analytics/lgu/shared.mock";
import { cn } from "@/lib/utils";

const DEPARTMENT_OPTIONS: readonly string[] = PH_DEPARTMENTS;
const BARANGAY_OPTIONS: readonly string[] = BARANGAYS.map((b) => b.name);

/* -------------------------------------------------------------------------
 * State + API
 * ----------------------------------------------------------------------- */

export interface Top20FilterState {
  /** Matches PhysicianActivityRow / RevenueRow / ClaimRow / FormularyRow / CohortPatient `.department`. */
  department: string | null;
  /** Matches ImmunizationCoverageRow / DengueRow / HouseholdProfileRow `.barangay` and NcdBarangay `.name`. */
  barangay: string | null;
}

export interface Top20FilterApi extends Top20FilterState {
  setDepartment: (value: string | null) => void;
  setBarangay: (value: string | null) => void;
  clearDepartment: () => void;
  clearBarangay: () => void;
  resetAll: () => void;
  /** True when at least one dimension is active. */
  isFiltered: boolean;
  /** Barangay name -> BHC facility name, built once from `BARANGAYS`. */
  barangayToBhc: Record<string, string>;
  /** Resolve any barangay name to the BHC facility serving it. */
  bhcForBarangay: (barangay: string | null) => string | null;
  /** The BHC serving the currently-selected barangay (null when unfiltered). */
  selectedBhc: string | null;
}

const Top20FilterContext = React.createContext<Top20FilterApi | null>(null);

/** Built once per provider mount; `BARANGAYS` is a static module-level array. */
function buildBarangayToBhc(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const barangay of BARANGAYS) map[barangay.name] = barangay.bhc;
  return map;
}

export function Top20FilterProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<Top20FilterState>({
    department: null,
    barangay: null,
  });

  const barangayToBhc = React.useMemo(buildBarangayToBhc, []);

  const value = React.useMemo<Top20FilterApi>(() => {
    const bhcForBarangay = (barangay: string | null): string | null =>
      barangay ? (barangayToBhc[barangay] ?? null) : null;

    return {
      department: state.department,
      barangay: state.barangay,
      setDepartment: (next) => setState((prev) => ({ ...prev, department: next })),
      setBarangay: (next) => setState((prev) => ({ ...prev, barangay: next })),
      clearDepartment: () => setState((prev) => ({ ...prev, department: null })),
      clearBarangay: () => setState((prev) => ({ ...prev, barangay: null })),
      resetAll: () => setState({ department: null, barangay: null }),
      isFiltered: state.department !== null || state.barangay !== null,
      barangayToBhc,
      bhcForBarangay,
      selectedBhc: bhcForBarangay(state.barangay),
    };
  }, [state, barangayToBhc]);

  return <Top20FilterContext.Provider value={value}>{children}</Top20FilterContext.Provider>;
}

export function useTop20Filters(): Top20FilterApi {
  const ctx = React.useContext(Top20FilterContext);
  if (!ctx) {
    throw new Error("useTop20Filters() must be used inside <Top20FilterProvider>.");
  }
  return ctx;
}

/* -------------------------------------------------------------------------
 * Floating filter header
 * ----------------------------------------------------------------------- */

/**
 * One removable chip per active filter. Styling deliberately mirrors
 * `StatusBadge` from `shared.tsx` (`border-brand/30 bg-brand/10 text-brand`,
 * `text-[11px]`) so it reads as part of the same design system.
 */
function FilterChip({
  label,
  value,
  note,
  onRemove,
}: {
  label: string;
  value: string;
  note?: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 py-0.5 pl-2.5 pr-1 text-[11px] font-medium text-brand">
      <span>
        <span className="text-brand/70">{label}:</span> {value}
      </span>
      {note ? <span className="text-[10px] font-normal text-brand/70">({note})</span> : null}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
        title={`Remove ${label} filter`}
        className="inline-flex size-4 items-center justify-center rounded-full transition-colors hover:bg-brand/20"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

/**
 * One labeled dropdown, used for the explicit Department / Barangay pickers
 * in the floating header. `value` is `"all"` when the dimension is unfiltered
 * (native `<select>`/Radix `Select` can't represent an empty string cleanly),
 * mapped back to `null` on the way out.
 */
function FilterSelect({
  label,
  placeholder,
  value,
  options,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string | null;
  options: readonly string[];
  onChange: (value: string | null) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <span className="text-[11px] font-medium text-text-muted">{label}</span>
      <Select value={value ?? "all"} onValueChange={(v) => onChange(v === "all" ? null : v)}>
        <SelectTrigger className="h-7 w-40 text-xs">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs">
            {placeholder}
          </SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o} className="text-xs">
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Slim sticky bar shown once at the top of the Top-20 dashboard.
 *
 * `top-12` (48px) clears the `/analytics` layout's own sticky nav bar, which is
 * a `py-2` row of `py-1.5 text-sm` tabs plus a 1px bottom border (~49px tall);
 * `z-10` keeps it *under* that nav (`z-20`) rather than fighting it.
 *
 * The two `<Select>`s are the primary, always-available way to set a filter —
 * every chart's click-to-drill still works and calls the same setters, but a
 * user should never be *required* to find and click the right bar/cell just
 * to filter the dashboard.
 */
export function Top20FloatingFilterHeader({ className }: { className?: string }) {
  const {
    department,
    barangay,
    selectedBhc,
    setDepartment,
    setBarangay,
    clearDepartment,
    clearBarangay,
    resetAll,
    isFiltered,
  } = useTop20Filters();

  return (
    <div
      className={cn(
        "sticky top-12 z-10 -mx-4 space-y-1.5 border-y border-border bg-card/95 px-4 py-1.5 backdrop-blur md:-mx-6 md:px-6",
        className,
      )}
    >
      <div className="flex min-h-7 flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
          Filters
        </span>

        <FilterSelect
          label="Department"
          placeholder="All departments"
          value={department}
          options={DEPARTMENT_OPTIONS}
          onChange={setDepartment}
        />
        <FilterSelect
          label="Barangay"
          placeholder="All barangays"
          value={barangay}
          options={BARANGAY_OPTIONS}
          onChange={setBarangay}
        />

        {isFiltered ? (
          <button
            type="button"
            onClick={resetAll}
            className="ml-auto shrink-0 text-[11px] font-medium text-text-muted underline-offset-2 hover:text-text-primary hover:underline"
          >
            Clear all
          </button>
        ) : null}
      </div>

      {isFiltered ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          {department ? (
            <FilterChip label="Department" value={department} onRemove={clearDepartment} />
          ) : null}
          {barangay ? (
            <FilterChip
              label="Barangay"
              value={barangay}
              {...(selectedBhc ? { note: selectedBhc } : {})}
              onRemove={clearBarangay}
            />
          ) : null}
        </div>
      ) : (
        <span className="text-[11px] text-text-muted">
          No filters applied — pick a department/barangay above, or click any department or barangay
          chart to drill in.
        </span>
      )}
    </div>
  );
}
