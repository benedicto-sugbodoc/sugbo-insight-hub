/**
 * Shared global filter state for the shared-dataset-backed hospital analytics
 * pages (Executive Overview, Performance Analysis, Financial/Claims Analysis,
 * Patient/Experience Analysis).
 *
 * This is the concrete answer to the supervisor's "shared filtering" ask:
 * one React context, mounted once per page via `HospitalFilterProvider`, so
 * that as long as the user stays on shared-dataset pages during one SPA
 * session, changing "Department: Cardiology" on the Overview page and then
 * navigating to Performance Analysis keeps that selection applied. Pages that
 * still run on the legacy per-file mock data (Clinical, Quality, Laboratory)
 * intentionally do NOT mount this provider — they are not yet wired to the
 * shared dataset, so a shared filter would silently do nothing on them, which
 * would be worse than not offering it. See `schema.md` for migration status.
 *
 * The UI reuses the existing `GlobalFilterBar` primitive from `interactive.tsx`
 * rather than inventing new filter chrome; this module only adds the
 * multi-page state layer and the mapping into `EncounterFilter`.
 */
import * as React from "react";

import type { EncounterFilter } from "@/lib/data/hospital";
import { getHospitalDataset } from "@/lib/data/hospital";
import {
  DateRangePicker,
  GlobalFilterBar,
  presetRange,
  type DateRangeValue,
  type GlobalFilterDef,
} from "./interactive";

const ALL = "all";

export interface HospitalFilterState {
  dateRange: DateRangeValue;
  departmentId: string;
  serviceId: string;
  doctorId: string;
  encounterType: string;
  paymentStatus: string;
  claimStatus: string;
  patientCategory: string;
  pwdStatus: string; // "all" | "pwd" | "non-pwd"
}

function defaultState(): HospitalFilterState {
  return {
    dateRange: presetRange("month"),
    departmentId: ALL,
    serviceId: ALL,
    doctorId: ALL,
    encounterType: ALL,
    paymentStatus: ALL,
    claimStatus: ALL,
    patientCategory: ALL,
    pwdStatus: ALL,
  };
}

interface HospitalFilterContextValue {
  filters: HospitalFilterState;
  setFilter: (key: keyof Omit<HospitalFilterState, "dateRange">, value: string) => void;
  setDateRange: (range: DateRangeValue) => void;
  resetFilters: () => void;
  /** The same state, reshaped into the `EncounterFilter` the derive-layer functions accept. */
  encounterFilter: EncounterFilter;
  isFiltered: boolean;
}

const HospitalFilterCtx = React.createContext<HospitalFilterContextValue | null>(null);

export function HospitalFilterProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = React.useState<HospitalFilterState>(defaultState);

  const setFilter = React.useCallback(
    (key: keyof Omit<HospitalFilterState, "dateRange">, value: string) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const setDateRange = React.useCallback((range: DateRangeValue) => {
    setFilters((prev) => ({ ...prev, dateRange: range }));
  }, []);

  const resetFilters = React.useCallback(() => setFilters(defaultState()), []);

  const encounterFilter = React.useMemo<EncounterFilter>(() => {
    const f: EncounterFilter = {
      from: filters.dateRange.from.toISOString().slice(0, 10),
      to: filters.dateRange.to.toISOString().slice(0, 10),
    };
    if (filters.departmentId !== ALL) f.departmentIds = [filters.departmentId];
    if (filters.serviceId !== ALL) f.serviceIds = [filters.serviceId];
    if (filters.doctorId !== ALL) f.doctorIds = [filters.doctorId];
    if (filters.encounterType !== ALL)
      f.encounterTypes = [
        filters.encounterType as EncounterFilter["encounterTypes"] extends
          readonly (infer T)[] | undefined
          ? T
          : never,
      ];
    if (filters.paymentStatus !== ALL)
      f.paymentStatuses = [
        filters.paymentStatus as EncounterFilter["paymentStatuses"] extends
          readonly (infer T)[] | undefined
          ? T
          : never,
      ];
    if (filters.claimStatus !== ALL)
      f.claimStatuses = [
        filters.claimStatus as EncounterFilter["claimStatuses"] extends
          readonly (infer T)[] | undefined
          ? T
          : never,
      ];
    if (filters.patientCategory !== ALL)
      f.patientCategories = [
        filters.patientCategory as EncounterFilter["patientCategories"] extends
          readonly (infer T)[] | undefined
          ? T
          : never,
      ];
    if (filters.pwdStatus !== ALL) f.pwdOnly = filters.pwdStatus === "pwd";
    return f;
  }, [filters]);

  const isFiltered =
    filters.departmentId !== ALL ||
    filters.serviceId !== ALL ||
    filters.doctorId !== ALL ||
    filters.encounterType !== ALL ||
    filters.paymentStatus !== ALL ||
    filters.claimStatus !== ALL ||
    filters.patientCategory !== ALL ||
    filters.pwdStatus !== ALL ||
    filters.dateRange.preset !== "month";

  const value = React.useMemo(
    () => ({ filters, setFilter, setDateRange, resetFilters, encounterFilter, isFiltered }),
    [filters, setFilter, setDateRange, resetFilters, encounterFilter, isFiltered],
  );

  return <HospitalFilterCtx.Provider value={value}>{children}</HospitalFilterCtx.Provider>;
}

export function useHospitalFilters(): HospitalFilterContextValue {
  const ctx = React.useContext(HospitalFilterCtx);
  if (!ctx) {
    throw new Error("useHospitalFilters must be used within a <HospitalFilterProvider>");
  }
  return ctx;
}

/**
 * Renders the actual filter bar UI, wired to the shared context. Drop this
 * once near the top of any page mounted inside `HospitalFilterProvider`.
 * Options are pulled live from the shared dataset (departments/services/
 * doctors) so they can never drift out of sync with what's actually in it.
 */
export function GlobalHospitalFilterBar() {
  const { filters, setFilter, setDateRange } = useHospitalFilters();
  const dataset = getHospitalDataset();

  const filterDefs: GlobalFilterDef[] = [
    {
      key: "departmentId",
      label: "Department",
      options: dataset.departments.map((d) => ({ label: d.name, value: d.id })),
    },
    {
      key: "serviceId",
      label: "Service",
      options: dataset.services
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => ({ label: s.name, value: s.id })),
    },
    {
      key: "doctorId",
      label: "Doctor",
      options: dataset.doctors.map((d) => ({ label: d.name, value: d.id })),
    },
    {
      key: "encounterType",
      label: "Encounter Type",
      options: ["Inpatient", "Outpatient", "Emergency", "Day Surgery"].map((v) => ({
        label: v,
        value: v,
      })),
    },
    {
      key: "paymentStatus",
      label: "Payment Status",
      options: ["Paid", "Partial", "Pending", "Overdue", "Write-off"].map((v) => ({
        label: v,
        value: v,
      })),
    },
    {
      key: "claimStatus",
      label: "PhilHealth Status",
      options: ["Drafted", "Submitted", "Under Review", "Approved", "Denied", "Remitted"].map(
        (v) => ({ label: v, value: v }),
      ),
    },
    {
      key: "pwdStatus",
      label: "PWD Status",
      options: [
        { label: "PWD patients", value: "pwd" },
        { label: "Non-PWD patients", value: "non-pwd" },
      ],
    },
  ];

  const values: Record<string, string> = {
    departmentId: filters.departmentId,
    serviceId: filters.serviceId,
    doctorId: filters.doctorId,
    encounterType: filters.encounterType,
    paymentStatus: filters.paymentStatus,
    claimStatus: filters.claimStatus,
    pwdStatus: filters.pwdStatus,
  };

  return (
    <GlobalFilterBar
      filters={filterDefs}
      values={values}
      onChange={(key, value) =>
        setFilter(key as keyof Omit<HospitalFilterState, "dateRange">, value)
      }
      dateRange={filters.dateRange}
      onDateRangeChange={setDateRange}
    />
  );
}

export { DateRangePicker };
