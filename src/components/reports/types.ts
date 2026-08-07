import type * as React from "react";

/**
 * Shared type contracts for the Reports module (hospital /reports and
 * LGU /lgu/reports). A single generic engine (ReportShell) renders any
 * report from one of these configs, so every report gets the same
 * filter panel, sortable table, search, export, print, schedule,
 * saved-filter and drill-down behaviour for free.
 */

export interface ReportColumn<T> {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  width?: string;
  sortable?: boolean;
  /** Value used for sorting; defaults to the raw field via `key`. */
  sortValue?: (row: T) => string | number;
  /** Custom cell renderer; defaults to String(row[key]). */
  render?: (row: T) => React.ReactNode;
  /** Value used for CSV/Excel export; defaults to render/raw field as string. */
  exportValue?: (row: T) => string;
}

export interface ReportFilterOption {
  label: string;
  value: string;
}

export interface ReportFilter<T> {
  key: string;
  label: string;
  type: "select" | "search";
  options?: ReportFilterOption[];
  placeholder?: string;
  /** Predicate applied when a non-"all" value is selected. */
  predicate?: (row: T, value: string) => boolean;
}

export interface DrawerField {
  label: string;
  value: React.ReactNode;
}

export interface DrawerDocument {
  name: string;
  type: string;
}

export interface DrawerRelated {
  label: string;
  value: React.ReactNode;
}

export interface DrawerAction {
  label: string;
  variant?: "default" | "outline" | "destructive";
}

export interface ReportDrawerData {
  heading: string;
  subheading?: string;
  alert?: string;
  detail: DrawerField[];
  documents?: DrawerDocument[];
  related?: DrawerRelated[];
  actions?: DrawerAction[];
}

export interface ReportConfig<T> {
  id: string;
  code: string;
  title: string;
  purpose: string;
  jurisdiction: "hospital" | "lgu";
  columns: ReportColumn<T>[];
  filters: ReportFilter<T>[];
  /** ISO date field (YYYY-MM-DD) used by the global date range picker. */
  dateField?: string;
  getDate?: (row: T) => string;
  searchFields: string[];
  getSearchText?: (row: T) => string;
  roleNote?: string;
  formatNote?: string;
  automationNote?: string;
  defaultSort?: { key: string; dir: "asc" | "desc" };
  getRows: () => T[];
  getDrawer: (row: T) => ReportDrawerData;
  rowAlert?: (row: T) => boolean;
  summaryRow?: (rows: T[]) => Record<string, React.ReactNode>;
}

export interface DateRangeValue {
  from: Date;
  to: Date;
  preset: "today" | "week" | "month" | "quarter" | "custom";
  label: string;
}
