/**
 * Derivation / query layer over the shared hospital dataset.
 *
 * Charts must not compute their own numbers from their own synthetic data —
 * they call one of these helpers so that every page reconciles. Each helper is
 * a pure function of `(dataset, filter?)`; nothing here mutates the dataset and
 * nothing here generates values.
 */

import {
  PH_DEPARTMENT_COLORS,
  PH_DIAGNOSIS_CASE_RATES,
  PH_TOP_DIAGNOSES,
} from "@/lib/analytics/ph-constants";

import type {
  Billing,
  ClaimStatus,
  Department,
  Encounter,
  EncounterType,
  FeedbackCategory,
  HospitalDataset,
  PayerType,
  PaymentStatus,
  PhilHealthCategory,
  PhilHealthClaim,
  ServiceCategory,
} from "./entities";
import { CLAIM_DENIAL_REASONS } from "./reference";
import { MS_DAY, ageBand, ageOn, daysBetween, monthKeyOf, parseDate } from "./time";

/* ------------------------------------------------------------------------- */
/* Filtering                                                                  */
/* ------------------------------------------------------------------------- */

/** Standard filter accepted by every helper below. All fields are optional. */
export interface EncounterFilter {
  /** Inclusive lower bound on admission date, `"YYYY-MM-DD"`. */
  from?: string;
  /** Inclusive upper bound on admission date, `"YYYY-MM-DD"`. */
  to?: string;
  departmentIds?: readonly string[];
  encounterTypes?: readonly EncounterType[];
  payerTypes?: readonly PayerType[];
  doctorIds?: readonly string[];
  /** Matches if the encounter has at least one `EncounterService` on one of these service catalog ids. */
  serviceIds?: readonly string[];
  /** Matches on the encounter's `Billing.paymentStatus`. Encounters with no billing row never match. */
  paymentStatuses?: readonly PaymentStatus[];
  /** Matches on the encounter's `PhilHealthClaim.status`. Encounters with no claim never match. */
  claimStatuses?: readonly ClaimStatus[];
  /** `true` = only PWD patients, `false` = only non-PWD patients, `undefined`/omitted = no filter. */
  pwdOnly?: boolean;
  /** Matches on `Patient.philhealthCategory` ("patient type"). */
  patientCategories?: readonly PhilHealthCategory[];
}

/** Applies an `EncounterFilter` to the encounter fact table. */
export function filterEncounters(dataset: HospitalDataset, filter?: EncounterFilter): Encounter[] {
  if (!filter) return dataset.encounters;
  const {
    from,
    to,
    departmentIds,
    encounterTypes,
    payerTypes,
    doctorIds,
    serviceIds,
    paymentStatuses,
    claimStatuses,
    pwdOnly,
    patientCategories,
  } = filter;
  return dataset.encounters.filter((e) => {
    const day = e.admitDateTime.slice(0, 10);
    if (from !== undefined && day < from) return false;
    if (to !== undefined && day > to) return false;
    if (departmentIds && !departmentIds.includes(e.departmentId)) return false;
    if (encounterTypes && !encounterTypes.includes(e.encounterType)) return false;
    if (payerTypes && !payerTypes.includes(e.payerType)) return false;
    if (doctorIds && !doctorIds.includes(e.primaryDoctorId)) return false;
    if (serviceIds) {
      const lines = dataset.index.servicesByEncounterId.get(e.id) ?? [];
      if (!lines.some((line) => serviceIds.includes(line.serviceId))) return false;
    }
    if (paymentStatuses) {
      const billing = dataset.index.billingByEncounterId.get(e.id);
      if (!billing || !paymentStatuses.includes(billing.paymentStatus)) return false;
    }
    if (claimStatuses) {
      const claim = dataset.index.claimByEncounterId.get(e.id);
      if (!claim || !claimStatuses.includes(claim.status)) return false;
    }
    if (pwdOnly !== undefined || patientCategories) {
      const patient = dataset.index.patientById.get(e.patientId);
      if (!patient) return false;
      if (pwdOnly !== undefined && patient.isPWD !== pwdOnly) return false;
      if (patientCategories && !patientCategories.includes(patient.philhealthCategory))
        return false;
    }
    return true;
  });
}

function departmentColor(dataset: HospitalDataset, departmentId: string): string {
  const dept = dataset.index.departmentById.get(departmentId);
  return dept ? PH_DEPARTMENT_COLORS[dept.name] : "#94A3B8";
}

function departmentName(dataset: HospitalDataset, departmentId: string): string {
  return dataset.index.departmentById.get(departmentId)?.name ?? departmentId;
}

function billingOf(dataset: HospitalDataset, encounterId: string): Billing | undefined {
  return dataset.index.billingByEncounterId.get(encounterId);
}

function sortDepartments(dataset: HospitalDataset): Department[] {
  return dataset.departments;
}

/* ------------------------------------------------------------------------- */
/* Volume                                                                     */
/* ------------------------------------------------------------------------- */

export interface DepartmentVolumeRow {
  departmentId: string;
  department: string;
  color: string;
  encounters: number;
  inpatient: number;
  outpatient: number;
  emergency: number;
  daySurgery: number;
  /** Staffed beds — a facility attribute, NOT a denominator for this sample. */
  bedCapacity: number;
  /** Sum of inpatient length of stay (min 1 day per admission). */
  bedDaysUsed: number;
  /** `bedDaysUsed / days in the filtered window`. */
  avgDailyCensus: number;
}

/**
 * Encounter counts and inpatient bed-day load per department.
 *
 * Note there is deliberately no occupancy *percentage* here: the encounter
 * table is a ~1,800-row synthetic extract, which is one to two orders of
 * magnitude smaller than the annual throughput implied by `bedCapacity`, so any
 * `bedDays / (beds x days)` ratio would read as a nonsensical 1–3%. Charts that
 * need an occupancy story should use `avgDailyCensus` or compare departments
 * against each other, not against `bedCapacity`.
 */
export function volumeByDepartment(
  dataset: HospitalDataset,
  filter?: EncounterFilter,
): DepartmentVolumeRow[] {
  const encounters = filterEncounters(dataset, filter);
  const windowDays = filteredWindowDays(dataset, filter);
  const rows = new Map<string, DepartmentVolumeRow>();
  for (const dept of sortDepartments(dataset)) {
    rows.set(dept.id, {
      departmentId: dept.id,
      department: dept.name,
      color: PH_DEPARTMENT_COLORS[dept.name],
      encounters: 0,
      inpatient: 0,
      outpatient: 0,
      emergency: 0,
      daySurgery: 0,
      bedCapacity: dept.bedCapacity,
      bedDaysUsed: 0,
      avgDailyCensus: 0,
    });
  }
  for (const enc of encounters) {
    const row = rows.get(enc.departmentId);
    if (!row) continue;
    row.encounters += 1;
    if (enc.encounterType === "Inpatient") {
      row.inpatient += 1;
      row.bedDaysUsed += Math.max(1, enc.losDays);
    } else if (enc.encounterType === "Outpatient") row.outpatient += 1;
    else if (enc.encounterType === "Emergency") row.emergency += 1;
    else row.daySurgery += 1;
  }
  return [...rows.values()].map((row) => ({
    ...row,
    avgDailyCensus: windowDays > 0 ? Math.round((row.bedDaysUsed / windowDays) * 100) / 100 : 0,
  }));
}

function filteredWindowDays(dataset: HospitalDataset, filter?: EncounterFilter): number {
  const first = dataset.months[0];
  const last = dataset.months[dataset.months.length - 1];
  const from = filter?.from ?? first?.startDate ?? dataset.anchorDate;
  const to = filter?.to ?? last?.endDate ?? dataset.anchorDate;
  return daysBetween(parseDate(from), parseDate(to)) + 1;
}

export interface MonthlyDepartmentVolumeRow {
  month: string;
  monthLabel: string;
  isPartial: boolean;
  /** Encounter count keyed by department name. */
  byDepartment: Record<string, number>;
  total: number;
}

/** Monthly encounter volume, split by department — the canonical volume trend. */
export function volumeByDepartmentAndMonth(
  dataset: HospitalDataset,
  filter?: EncounterFilter,
): MonthlyDepartmentVolumeRow[] {
  const encounters = filterEncounters(dataset, filter);
  const rows = new Map<string, MonthlyDepartmentVolumeRow>();
  for (const month of dataset.months) {
    const byDepartment: Record<string, number> = {};
    for (const dept of dataset.departments) byDepartment[dept.name] = 0;
    rows.set(month.key, {
      month: month.key,
      monthLabel: month.label,
      isPartial: month.isPartial,
      byDepartment,
      total: 0,
    });
  }
  for (const enc of encounters) {
    const row = rows.get(monthKeyOf(enc.admitDateTime));
    if (!row) continue;
    const name = departmentName(dataset, enc.departmentId);
    row.byDepartment[name] = (row.byDepartment[name] ?? 0) + 1;
    row.total += 1;
  }
  return [...rows.values()];
}

export interface EncounterTypeRow {
  encounterType: EncounterType;
  encounters: number;
  share: number;
}

/** Encounter-type mix for the filtered window. */
export function volumeByEncounterType(
  dataset: HospitalDataset,
  filter?: EncounterFilter,
): EncounterTypeRow[] {
  const encounters = filterEncounters(dataset, filter);
  const types: EncounterType[] = ["Inpatient", "Outpatient", "Emergency", "Day Surgery"];
  const counts = new Map<EncounterType, number>(types.map((t) => [t, 0]));
  for (const enc of encounters)
    counts.set(enc.encounterType, (counts.get(enc.encounterType) ?? 0) + 1);
  const total = encounters.length || 1;
  return types.map((t) => ({
    encounterType: t,
    encounters: counts.get(t) ?? 0,
    share: (counts.get(t) ?? 0) / total,
  }));
}

export interface WeekdayHourCell {
  /** 0 = Sunday. */
  weekday: number;
  /** 0–23, UTC. */
  hour: number;
  value: number;
}

/** Arrival heatmap: admissions by day-of-week x hour-of-day. */
export function volumeByWeekdayHour(
  dataset: HospitalDataset,
  filter?: EncounterFilter,
): WeekdayHourCell[] {
  const encounters = filterEncounters(dataset, filter);
  const cells: WeekdayHourCell[] = [];
  const grid = new Array<number>(7 * 24).fill(0);
  for (const enc of encounters) {
    const d = new Date(enc.admitDateTime);
    const slot = d.getUTCDay() * 24 + d.getUTCHours();
    grid[slot] = (grid[slot] ?? 0) + 1;
  }
  for (let weekday = 0; weekday < 7; weekday += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      cells.push({ weekday, hour, value: grid[weekday * 24 + hour] ?? 0 });
    }
  }
  return cells;
}

/* ------------------------------------------------------------------------- */
/* Revenue                                                                    */
/* ------------------------------------------------------------------------- */

export interface DepartmentRevenueRow {
  departmentId: string;
  department: string;
  color: string;
  encounters: number;
  grossCharges: number;
  philhealthDeduction: number;
  pwdDiscountAmount: number;
  netPayable: number;
  amountPaid: number;
  balance: number;
  /** `grossCharges / encounters`. */
  revenuePerEncounter: number;
}

/** Gross-to-collected revenue per department. The single source for revenue charts. */
export function revenueByDepartment(
  dataset: HospitalDataset,
  filter?: EncounterFilter,
): DepartmentRevenueRow[] {
  const encounters = filterEncounters(dataset, filter);
  const rows = new Map<string, DepartmentRevenueRow>();
  for (const dept of sortDepartments(dataset)) {
    rows.set(dept.id, {
      departmentId: dept.id,
      department: dept.name,
      color: PH_DEPARTMENT_COLORS[dept.name],
      encounters: 0,
      grossCharges: 0,
      philhealthDeduction: 0,
      pwdDiscountAmount: 0,
      netPayable: 0,
      amountPaid: 0,
      balance: 0,
      revenuePerEncounter: 0,
    });
  }
  for (const enc of encounters) {
    const row = rows.get(enc.departmentId);
    const bill = billingOf(dataset, enc.id);
    if (!row || !bill) continue;
    row.encounters += 1;
    row.grossCharges += bill.grossCharges;
    row.philhealthDeduction += bill.philhealthDeduction;
    row.pwdDiscountAmount += bill.pwdDiscountAmount;
    row.netPayable += bill.netPayable;
    row.amountPaid += bill.amountPaid;
    row.balance += bill.balance;
  }
  return [...rows.values()].map((row) => ({
    ...row,
    grossCharges: Math.round(row.grossCharges),
    philhealthDeduction: Math.round(row.philhealthDeduction),
    pwdDiscountAmount: Math.round(row.pwdDiscountAmount),
    netPayable: Math.round(row.netPayable),
    amountPaid: Math.round(row.amountPaid),
    balance: Math.round(row.balance),
    revenuePerEncounter: row.encounters > 0 ? Math.round(row.grossCharges / row.encounters) : 0,
  }));
}

export interface MonthlyRevenueRow {
  month: string;
  monthLabel: string;
  isPartial: boolean;
  grossCharges: number;
  philhealthDeduction: number;
  pwdDiscountAmount: number;
  netPayable: number;
  amountPaid: number;
  balance: number;
}

/** Monthly revenue waterfall inputs (gross -> deductions -> net -> collected). */
export function revenueByMonth(
  dataset: HospitalDataset,
  filter?: EncounterFilter,
): MonthlyRevenueRow[] {
  const encounters = filterEncounters(dataset, filter);
  const rows = new Map<string, MonthlyRevenueRow>();
  for (const month of dataset.months) {
    rows.set(month.key, {
      month: month.key,
      monthLabel: month.label,
      isPartial: month.isPartial,
      grossCharges: 0,
      philhealthDeduction: 0,
      pwdDiscountAmount: 0,
      netPayable: 0,
      amountPaid: 0,
      balance: 0,
    });
  }
  for (const enc of encounters) {
    const row = rows.get(monthKeyOf(enc.admitDateTime));
    const bill = billingOf(dataset, enc.id);
    if (!row || !bill) continue;
    row.grossCharges += bill.grossCharges;
    row.philhealthDeduction += bill.philhealthDeduction;
    row.pwdDiscountAmount += bill.pwdDiscountAmount;
    row.netPayable += bill.netPayable;
    row.amountPaid += bill.amountPaid;
    row.balance += bill.balance;
  }
  return [...rows.values()].map((row) => ({
    ...row,
    grossCharges: Math.round(row.grossCharges),
    philhealthDeduction: Math.round(row.philhealthDeduction),
    pwdDiscountAmount: Math.round(row.pwdDiscountAmount),
    netPayable: Math.round(row.netPayable),
    amountPaid: Math.round(row.amountPaid),
    balance: Math.round(row.balance),
  }));
}

export interface PayerMixRow {
  payerType: PayerType;
  encounters: number;
  grossCharges: number;
  netPayable: number;
  amountPaid: number;
  balance: number;
  /** Share of gross charges, 0–1. */
  share: number;
}

/** The one payer-mix aggregation. Every payer chart must read this. */
export function payerMix(dataset: HospitalDataset, filter?: EncounterFilter): PayerMixRow[] {
  const encounters = filterEncounters(dataset, filter);
  const rows = new Map<PayerType, PayerMixRow>();
  for (const enc of encounters) {
    const bill = billingOf(dataset, enc.id);
    if (!bill) continue;
    const row =
      rows.get(enc.payerType) ??
      ({
        payerType: enc.payerType,
        encounters: 0,
        grossCharges: 0,
        netPayable: 0,
        amountPaid: 0,
        balance: 0,
        share: 0,
      } satisfies PayerMixRow);
    row.encounters += 1;
    row.grossCharges += bill.grossCharges;
    row.netPayable += bill.netPayable;
    row.amountPaid += bill.amountPaid;
    row.balance += bill.balance;
    rows.set(enc.payerType, row);
  }
  const total = [...rows.values()].reduce((s, r) => s + r.grossCharges, 0) || 1;
  return [...rows.values()]
    .map((row) => ({
      ...row,
      grossCharges: Math.round(row.grossCharges),
      netPayable: Math.round(row.netPayable),
      amountPaid: Math.round(row.amountPaid),
      balance: Math.round(row.balance),
      share: row.grossCharges / total,
    }))
    .sort((a, b) => b.grossCharges - a.grossCharges);
}

export interface ArAgingRow {
  payerType: PayerType;
  current: number;
  d31to60: number;
  d61to90: number;
  over90: number;
  total: number;
}

/** Outstanding balance bucketed by bill age, per payer. */
export function arAgingByPayer(dataset: HospitalDataset, filter?: EncounterFilter): ArAgingRow[] {
  const encounters = filterEncounters(dataset, filter);
  const anchorMs = parseDate(dataset.anchorDate);
  const rows = new Map<PayerType, ArAgingRow>();
  for (const enc of encounters) {
    const bill = billingOf(dataset, enc.id);
    if (!bill || bill.balance <= 0) continue;
    const referenceMs = Date.parse(enc.dischargeDateTime ?? enc.admitDateTime);
    const age = daysBetween(referenceMs, anchorMs);
    const row =
      rows.get(enc.payerType) ??
      ({
        payerType: enc.payerType,
        current: 0,
        d31to60: 0,
        d61to90: 0,
        over90: 0,
        total: 0,
      } satisfies ArAgingRow);
    if (age <= 30) row.current += bill.balance;
    else if (age <= 60) row.d31to60 += bill.balance;
    else if (age <= 90) row.d61to90 += bill.balance;
    else row.over90 += bill.balance;
    row.total += bill.balance;
    rows.set(enc.payerType, row);
  }
  return [...rows.values()]
    .map((row) => ({
      payerType: row.payerType,
      current: Math.round(row.current),
      d31to60: Math.round(row.d31to60),
      d61to90: Math.round(row.d61to90),
      over90: Math.round(row.over90),
      total: Math.round(row.total),
    }))
    .sort((a, b) => b.total - a.total);
}

export interface PaymentStatusRow {
  paymentStatus: PaymentStatus;
  bills: number;
  netPayable: number;
  amountPaid: number;
  balance: number;
}

/** Bill counts and money by payment status. */
export function paymentStatusBreakdown(
  dataset: HospitalDataset,
  filter?: EncounterFilter,
): PaymentStatusRow[] {
  const encounters = filterEncounters(dataset, filter);
  const statuses: PaymentStatus[] = ["Paid", "Partial", "Pending", "Overdue", "Write-off"];
  const rows = new Map<PaymentStatus, PaymentStatusRow>(
    statuses.map((s) => [
      s,
      { paymentStatus: s, bills: 0, netPayable: 0, amountPaid: 0, balance: 0 },
    ]),
  );
  for (const enc of encounters) {
    const bill = billingOf(dataset, enc.id);
    if (!bill) continue;
    const row = rows.get(bill.paymentStatus);
    if (!row) continue;
    row.bills += 1;
    row.netPayable += bill.netPayable;
    row.amountPaid += bill.amountPaid;
    row.balance += bill.balance;
  }
  return statuses.map((s) => {
    const row = rows.get(s)!;
    return {
      paymentStatus: s,
      bills: row.bills,
      netPayable: Math.round(row.netPayable),
      amountPaid: Math.round(row.amountPaid),
      balance: Math.round(row.balance),
    };
  });
}

/* ------------------------------------------------------------------------- */
/* Claims                                                                     */
/* ------------------------------------------------------------------------- */

function filteredClaims(dataset: HospitalDataset, filter?: EncounterFilter): PhilHealthClaim[] {
  if (!filter) return dataset.claims;
  const ids = new Set(filterEncounters(dataset, filter).map((e) => e.id));
  return dataset.claims.filter((c) => ids.has(c.encounterId));
}

export interface ClaimStatusRow {
  status: ClaimStatus;
  claims: number;
  caseRateValue: number;
  share: number;
}

/** Claim pipeline by status — the single source for claim funnel/donut charts. */
export function claimsByStatus(
  dataset: HospitalDataset,
  filter?: EncounterFilter,
): ClaimStatusRow[] {
  const claims = filteredClaims(dataset, filter);
  const statuses: ClaimStatus[] = [
    "Drafted",
    "Submitted",
    "Under Review",
    "Approved",
    "Denied",
    "Remitted",
  ];
  const rows = new Map<ClaimStatus, ClaimStatusRow>(
    statuses.map((s) => [s, { status: s, claims: 0, caseRateValue: 0, share: 0 }]),
  );
  for (const claim of claims) {
    const row = rows.get(claim.status);
    if (!row) continue;
    row.claims += 1;
    row.caseRateValue += claim.caseRateAmount;
  }
  const total = claims.length || 1;
  return statuses.map((s) => {
    const row = rows.get(s)!;
    return {
      status: s,
      claims: row.claims,
      caseRateValue: Math.round(row.caseRateValue),
      share: row.claims / total,
    };
  });
}

export interface DenialReasonRow {
  denialCode: string;
  reason: string;
  claims: number;
  valueAtRisk: number;
  appealed: number;
  recovered: number;
  amountRecovered: number;
}

/** Denials grouped by reason code, with appeal outcomes. */
export function claimDenialReasons(
  dataset: HospitalDataset,
  filter?: EncounterFilter,
): DenialReasonRow[] {
  const claims = filteredClaims(dataset, filter);
  const rows = new Map<string, DenialReasonRow>();
  for (const claim of claims) {
    if (claim.status !== "Denied" || claim.denialCode === null) continue;
    const row =
      rows.get(claim.denialCode) ??
      ({
        denialCode: claim.denialCode,
        reason: CLAIM_DENIAL_REASONS[claim.denialCode] ?? "Unclassified",
        claims: 0,
        valueAtRisk: 0,
        appealed: 0,
        recovered: 0,
        amountRecovered: 0,
      } satisfies DenialReasonRow);
    row.claims += 1;
    row.valueAtRisk += claim.caseRateAmount;
    if (claim.appealFiledDate !== null) row.appealed += 1;
    if (claim.appealStatus === "Won") {
      row.recovered += 1;
      row.amountRecovered += claim.amountRecovered ?? 0;
    }
    rows.set(claim.denialCode, row);
  }
  return [...rows.values()]
    .map((row) => ({
      ...row,
      valueAtRisk: Math.round(row.valueAtRisk),
      amountRecovered: Math.round(row.amountRecovered),
    }))
    .sort((a, b) => b.claims - a.claims);
}

export interface ClaimTurnaroundRow {
  departmentId: string;
  department: string;
  color: string;
  claims: number;
  remitted: number;
  /** Mean days from submission to remittance, remitted claims only. */
  avgTurnaroundDays: number;
  denialRate: number;
  caseRateValue: number;
  remittedValue: number;
}

/** Submission-to-remittance turnaround and denial rate, per department. */
export function claimTurnaroundByDepartment(
  dataset: HospitalDataset,
  filter?: EncounterFilter,
): ClaimTurnaroundRow[] {
  const claims = filteredClaims(dataset, filter);
  const rows = new Map<string, ClaimTurnaroundRow & { turnaroundSum: number; denied: number }>();
  for (const dept of sortDepartments(dataset)) {
    rows.set(dept.id, {
      departmentId: dept.id,
      department: dept.name,
      color: PH_DEPARTMENT_COLORS[dept.name],
      claims: 0,
      remitted: 0,
      avgTurnaroundDays: 0,
      denialRate: 0,
      caseRateValue: 0,
      remittedValue: 0,
      turnaroundSum: 0,
      denied: 0,
    });
  }
  for (const claim of claims) {
    const enc = dataset.index.encounterById.get(claim.encounterId);
    if (!enc) continue;
    const row = rows.get(enc.departmentId);
    if (!row) continue;
    row.claims += 1;
    row.caseRateValue += claim.caseRateAmount;
    if (claim.status === "Denied") row.denied += 1;
    if (claim.status === "Remitted" && claim.remittanceDate !== null) {
      row.remitted += 1;
      row.remittedValue += claim.remittanceAmount ?? 0;
      row.turnaroundSum += Math.round(
        (parseDate(claim.remittanceDate) - parseDate(claim.submissionDate)) / MS_DAY,
      );
    }
  }
  return [...rows.values()].map(({ turnaroundSum, denied, ...row }) => ({
    ...row,
    caseRateValue: Math.round(row.caseRateValue),
    remittedValue: Math.round(row.remittedValue),
    avgTurnaroundDays: row.remitted > 0 ? Math.round((turnaroundSum / row.remitted) * 10) / 10 : 0,
    denialRate: row.claims > 0 ? denied / row.claims : 0,
  }));
}

/* ------------------------------------------------------------------------- */
/* PWD                                                                        */
/* ------------------------------------------------------------------------- */

export interface PwdDiscountRow {
  departmentId: string;
  department: string;
  color: string;
  discountedEncounters: number;
  qualifyingAmount: number;
  discountAmount: number;
  vatExemptAmount: number;
}

/** PWD discount uptake and value per department. */
export function pwdDiscountByDepartment(
  dataset: HospitalDataset,
  filter?: EncounterFilter,
): PwdDiscountRow[] {
  const ids = new Set(filterEncounters(dataset, filter).map((e) => e.id));
  const rows = new Map<string, PwdDiscountRow>();
  for (const dept of sortDepartments(dataset)) {
    rows.set(dept.id, {
      departmentId: dept.id,
      department: dept.name,
      color: PH_DEPARTMENT_COLORS[dept.name],
      discountedEncounters: 0,
      qualifyingAmount: 0,
      discountAmount: 0,
      vatExemptAmount: 0,
    });
  }
  for (const discount of dataset.pwdDiscounts) {
    if (!ids.has(discount.encounterId)) continue;
    const enc = dataset.index.encounterById.get(discount.encounterId);
    if (!enc) continue;
    const row = rows.get(enc.departmentId);
    if (!row) continue;
    row.discountedEncounters += 1;
    row.qualifyingAmount += discount.qualifyingAmount;
    row.discountAmount += discount.discountAmount;
    row.vatExemptAmount += discount.vatExemptAmount;
  }
  return [...rows.values()].map((row) => ({
    ...row,
    qualifyingAmount: Math.round(row.qualifyingAmount),
    discountAmount: Math.round(row.discountAmount),
    vatExemptAmount: Math.round(row.vatExemptAmount),
  }));
}

/* ------------------------------------------------------------------------- */
/* Feedback                                                                   */
/* ------------------------------------------------------------------------- */

export interface NpsRow {
  departmentId: string;
  department: string;
  color: string;
  responses: number;
  promoters: number;
  passives: number;
  detractors: number;
  /** Classic NPS, -100 to +100. */
  nps: number;
  avgNpsScore: number;
  avgCsat: number;
}

/** Net Promoter Score and CSAT per department. */
export function npsByDepartment(dataset: HospitalDataset, filter?: EncounterFilter): NpsRow[] {
  const ids = new Set(filterEncounters(dataset, filter).map((e) => e.id));
  const rows = new Map<string, NpsRow & { npsSum: number; csatSum: number }>();
  for (const dept of sortDepartments(dataset)) {
    rows.set(dept.id, {
      departmentId: dept.id,
      department: dept.name,
      color: PH_DEPARTMENT_COLORS[dept.name],
      responses: 0,
      promoters: 0,
      passives: 0,
      detractors: 0,
      nps: 0,
      avgNpsScore: 0,
      avgCsat: 0,
      npsSum: 0,
      csatSum: 0,
    });
  }
  for (const fb of dataset.feedback) {
    if (!ids.has(fb.encounterId)) continue;
    const row = rows.get(fb.departmentId);
    if (!row) continue;
    row.responses += 1;
    row.npsSum += fb.npsScore;
    row.csatSum += fb.csatScore;
    if (fb.npsScore >= 9) row.promoters += 1;
    else if (fb.npsScore >= 7) row.passives += 1;
    else row.detractors += 1;
  }
  return [...rows.values()].map(({ npsSum, csatSum, ...row }) => ({
    ...row,
    nps:
      row.responses > 0 ? Math.round(((row.promoters - row.detractors) / row.responses) * 100) : 0,
    avgNpsScore: row.responses > 0 ? Math.round((npsSum / row.responses) * 10) / 10 : 0,
    avgCsat: row.responses > 0 ? Math.round((csatSum / row.responses) * 100) / 100 : 0,
  }));
}

export interface FeedbackCategoryRow {
  category: FeedbackCategory;
  responses: number;
  avgNpsScore: number;
  avgCsat: number;
  withComment: number;
  share: number;
}

/** Feedback themes with their average scores. */
export function feedbackByCategory(
  dataset: HospitalDataset,
  filter?: EncounterFilter,
): FeedbackCategoryRow[] {
  const ids = new Set(filterEncounters(dataset, filter).map((e) => e.id));
  const rows = new Map<
    FeedbackCategory,
    FeedbackCategoryRow & { npsSum: number; csatSum: number }
  >();
  let total = 0;
  for (const fb of dataset.feedback) {
    if (!ids.has(fb.encounterId)) continue;
    total += 1;
    const row = rows.get(fb.category) ?? {
      category: fb.category,
      responses: 0,
      avgNpsScore: 0,
      avgCsat: 0,
      withComment: 0,
      share: 0,
      npsSum: 0,
      csatSum: 0,
    };
    row.responses += 1;
    row.npsSum += fb.npsScore;
    row.csatSum += fb.csatScore;
    if (fb.comment !== null) row.withComment += 1;
    rows.set(fb.category, row);
  }
  const denominator = total || 1;
  return [...rows.values()]
    .map(({ npsSum, csatSum, ...row }) => ({
      ...row,
      avgNpsScore: row.responses > 0 ? Math.round((npsSum / row.responses) * 10) / 10 : 0,
      avgCsat: row.responses > 0 ? Math.round((csatSum / row.responses) * 100) / 100 : 0,
      share: row.responses / denominator,
    }))
    .sort((a, b) => b.responses - a.responses);
}

/* ------------------------------------------------------------------------- */
/* Clinical outcomes                                                          */
/* ------------------------------------------------------------------------- */

export interface ReadmissionRow {
  departmentId: string;
  department: string;
  payerType: PayerType;
  eligibleEncounters: number;
  readmissions: number;
  rate: number;
}

/** 30-day readmission rate crossed by payer and department. */
export function readmissionRateByPayerAndDepartment(
  dataset: HospitalDataset,
  filter?: EncounterFilter,
): ReadmissionRow[] {
  const encounters = filterEncounters(dataset, filter);
  const rows = new Map<string, ReadmissionRow>();
  for (const enc of encounters) {
    if (enc.encounterType !== "Inpatient" && enc.encounterType !== "Emergency") continue;
    const key = `${enc.departmentId}|${enc.payerType}`;
    const row =
      rows.get(key) ??
      ({
        departmentId: enc.departmentId,
        department: departmentName(dataset, enc.departmentId),
        payerType: enc.payerType,
        eligibleEncounters: 0,
        readmissions: 0,
        rate: 0,
      } satisfies ReadmissionRow);
    row.eligibleEncounters += 1;
    if (enc.readmitted30d) row.readmissions += 1;
    rows.set(key, row);
  }
  return [...rows.values()]
    .map((row) => ({
      ...row,
      rate: row.eligibleEncounters > 0 ? row.readmissions / row.eligibleEncounters : 0,
    }))
    .sort((a, b) => b.eligibleEncounters - a.eligibleEncounters);
}

export interface DiagnosisRow {
  code: string;
  description: string;
  commonName: string;
  encounters: number;
  /** Mean LOS across *inpatient* encounters carrying this code. */
  avgLosDays: number;
  /** Canonical PhilHealth case rate for the code, straight from `PH_DIAGNOSIS_CASE_RATES`. */
  caseRate: number;
  grossCharges: number;
  readmissionRate: number;
}

/** Top diagnoses by encounter count, with LOS/charge context. */
export function topDiagnoses(
  dataset: HospitalDataset,
  limit = 10,
  filter?: EncounterFilter,
): DiagnosisRow[] {
  const encounters = filterEncounters(dataset, filter);
  const rows = new Map<
    string,
    DiagnosisRow & { losSum: number; losCount: number; readmits: number }
  >();
  for (const entry of PH_TOP_DIAGNOSES) {
    rows.set(entry.code, {
      code: entry.code,
      description: entry.description,
      commonName: entry.commonName,
      encounters: 0,
      avgLosDays: 0,
      caseRate: PH_DIAGNOSIS_CASE_RATES[entry.code] ?? 0,
      grossCharges: 0,
      readmissionRate: 0,
      losSum: 0,
      losCount: 0,
      readmits: 0,
    });
  }
  for (const enc of encounters) {
    if (enc.diagnosisCode === null) continue;
    const row = rows.get(enc.diagnosisCode);
    if (!row) continue;
    row.encounters += 1;
    if (enc.encounterType === "Inpatient") {
      row.losSum += enc.losDays;
      row.losCount += 1;
    }
    if (enc.readmitted30d) row.readmits += 1;
    row.grossCharges += billingOf(dataset, enc.id)?.grossCharges ?? 0;
  }
  return [...rows.values()]
    .map(({ losSum, losCount, readmits, ...row }) => ({
      ...row,
      avgLosDays: losCount > 0 ? Math.round((losSum / losCount) * 10) / 10 : 0,
      grossCharges: Math.round(row.grossCharges),
      readmissionRate: row.encounters > 0 ? readmits / row.encounters : 0,
    }))
    .sort((a, b) => b.encounters - a.encounters)
    .slice(0, limit);
}

export interface LosStatsRow {
  departmentId: string;
  department: string;
  color: string;
  discharges: number;
  meanLosDays: number;
  medianLosDays: number;
  p90LosDays: number;
  maxLosDays: number;
  /** Stays beyond 3x the department median — the injected long-stay tail. */
  outliers: number;
  stillAdmitted: number;
}

/** Length-of-stay distribution per department, including the outlier tail. */
export function losStatsByDepartment(
  dataset: HospitalDataset,
  filter?: EncounterFilter,
): LosStatsRow[] {
  const encounters = filterEncounters(dataset, filter);
  const buckets = new Map<string, number[]>();
  const stillAdmitted = new Map<string, number>();
  for (const enc of encounters) {
    if (enc.encounterType !== "Inpatient") continue;
    if (enc.dischargeDateTime === null) {
      stillAdmitted.set(enc.departmentId, (stillAdmitted.get(enc.departmentId) ?? 0) + 1);
      continue;
    }
    const list = buckets.get(enc.departmentId) ?? [];
    list.push(enc.losDays);
    buckets.set(enc.departmentId, list);
  }
  return sortDepartments(dataset).map((dept) => {
    const values = (buckets.get(dept.id) ?? []).slice().sort((a, b) => a - b);
    const n = values.length;
    const median = n > 0 ? (values[Math.floor(n / 2)] ?? 0) : 0;
    const p90 = n > 0 ? (values[Math.min(n - 1, Math.floor(n * 0.9))] ?? 0) : 0;
    const mean = n > 0 ? values.reduce((s, v) => s + v, 0) / n : 0;
    return {
      departmentId: dept.id,
      department: dept.name,
      color: PH_DEPARTMENT_COLORS[dept.name],
      discharges: n,
      meanLosDays: Math.round(mean * 10) / 10,
      medianLosDays: median,
      p90LosDays: p90,
      maxLosDays: n > 0 ? (values[n - 1] ?? 0) : 0,
      outliers: values.filter((v) => v > median * 3 && v > 0).length,
      stillAdmitted: stillAdmitted.get(dept.id) ?? 0,
    };
  });
}

export interface DoctorProductivityRow {
  doctorId: string;
  doctor: string;
  departmentId: string;
  department: string;
  encounters: number;
  inpatient: number;
  grossCharges: number;
  avgLosDays: number;
  /** Encounters per month against `monthlyCaseCapacity`, 0–1+. */
  capacityUtilization: number;
}

/** Per-physician volume, revenue and capacity utilization. */
export function doctorProductivity(
  dataset: HospitalDataset,
  filter?: EncounterFilter,
): DoctorProductivityRow[] {
  const encounters = filterEncounters(dataset, filter);
  const months = Math.max(1, dataset.months.length);
  const rows = new Map<string, DoctorProductivityRow & { losSum: number; losCount: number }>();
  for (const doc of dataset.doctors) {
    rows.set(doc.id, {
      doctorId: doc.id,
      doctor: doc.name,
      departmentId: doc.primaryDepartmentId,
      department: departmentName(dataset, doc.primaryDepartmentId),
      encounters: 0,
      inpatient: 0,
      grossCharges: 0,
      avgLosDays: 0,
      capacityUtilization: 0,
      losSum: 0,
      losCount: 0,
    });
  }
  for (const enc of encounters) {
    const row = rows.get(enc.primaryDoctorId);
    if (!row) continue;
    row.encounters += 1;
    row.grossCharges += billingOf(dataset, enc.id)?.grossCharges ?? 0;
    if (enc.encounterType === "Inpatient") {
      row.inpatient += 1;
      row.losSum += enc.losDays;
      row.losCount += 1;
    }
  }
  return [...rows.values()]
    .map(({ losSum, losCount, ...row }) => {
      const doc = dataset.index.doctorById.get(row.doctorId);
      const capacity = doc?.monthlyCaseCapacity ?? 1;
      return {
        ...row,
        grossCharges: Math.round(row.grossCharges),
        avgLosDays: losCount > 0 ? Math.round((losSum / losCount) * 10) / 10 : 0,
        capacityUtilization: capacity > 0 ? row.encounters / months / capacity : 0,
      };
    })
    .sort((a, b) => b.encounters - a.encounters);
}

/* ------------------------------------------------------------------------- */
/* Demographics + summary                                                     */
/* ------------------------------------------------------------------------- */

export interface AgeMixRow {
  band: string;
  male: number;
  female: number;
  total: number;
}

/** Patient population pyramid by age band and gender. */
export function patientAgeMix(dataset: HospitalDataset): AgeMixRow[] {
  const anchorMs = parseDate(dataset.anchorDate);
  const bands = ["<1", "1-4", "5-17", "18-39", "40-59", "60-74", "75+"];
  const rows = new Map<string, AgeMixRow>(
    bands.map((band) => [band, { band, male: 0, female: 0, total: 0 }]),
  );
  for (const patient of dataset.patients) {
    const row = rows.get(ageBand(ageOn(patient.birthDate, anchorMs)));
    if (!row) continue;
    if (patient.gender === "male") row.male += 1;
    else row.female += 1;
    row.total += 1;
  }
  return bands.map((band) => rows.get(band)!);
}

export interface DatasetSummary {
  anchorDate: string;
  months: number;
  departments: number;
  doctors: number;
  services: number;
  patients: number;
  encounters: number;
  encounterServices: number;
  billings: number;
  claims: number;
  pwdDiscounts: number;
  feedback: number;
}

/* ------------------------------------------------------------------------- */
/* Service utilization                                                        */
/* ------------------------------------------------------------------------- */

export interface ServiceUtilizationRow {
  serviceId: string;
  service: string;
  category: ServiceCategory;
  /** The service's owning cost-centre department — NOT the encounter's department. */
  departmentId: string;
  department: string;
  /** Filtered encounters carrying at least one charge line for this service. */
  encounters: number;
  /** Sum of `EncounterService.quantity` across those lines. */
  units: number;
  /** Sum of `EncounterService.lineTotal` — gross charges booked to this service. */
  revenue: number;
  /** `revenue / encounters`. */
  revenuePerEncounter: number;
  /** Share of the filtered window's total charge-line revenue, 0–1. */
  share: number;
}

/**
 * Charge-line volume and revenue per chargemaster service, for the encounter
 * cohort selected by `filter`.
 *
 * Note on semantics: the cohort is chosen by `filterEncounters`, then *every*
 * charge line on those encounters is aggregated. So filtering by
 * `departmentIds` answers "which services did this department's patients
 * consume" (including ancillary lab/imaging owned by another cost centre),
 * which is the department -> service question. Filtering by `serviceIds`
 * selects encounters that used those services but still returns all of their
 * lines, so the result reads as a market-basket around the chosen service.
 */
export function serviceUtilization(
  dataset: HospitalDataset,
  filter?: EncounterFilter,
): ServiceUtilizationRow[] {
  const encounters = filterEncounters(dataset, filter);
  const rows = new Map<string, ServiceUtilizationRow>();
  for (const enc of encounters) {
    const lines = dataset.index.servicesByEncounterId.get(enc.id) ?? [];
    const counted = new Set<string>();
    for (const line of lines) {
      const service = dataset.index.serviceById.get(line.serviceId);
      if (!service) continue;
      const row =
        rows.get(service.id) ??
        ({
          serviceId: service.id,
          service: service.name,
          category: service.category,
          departmentId: service.departmentId,
          department: departmentName(dataset, service.departmentId),
          encounters: 0,
          units: 0,
          revenue: 0,
          revenuePerEncounter: 0,
          share: 0,
        } satisfies ServiceUtilizationRow);
      if (!counted.has(service.id)) {
        row.encounters += 1;
        counted.add(service.id);
      }
      row.units += line.quantity;
      row.revenue += line.lineTotal;
      rows.set(service.id, row);
    }
  }
  const total = [...rows.values()].reduce((sum, row) => sum + row.revenue, 0) || 1;
  return [...rows.values()]
    .map((row) => ({
      ...row,
      revenue: Math.round(row.revenue),
      revenuePerEncounter: row.encounters > 0 ? Math.round(row.revenue / row.encounters) : 0,
      share: row.revenue / total,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

/** Row counts for every table — handy for smoke tests and docs. */
export function datasetSummary(dataset: HospitalDataset): DatasetSummary {
  return {
    anchorDate: dataset.anchorDate,
    months: dataset.months.length,
    departments: dataset.departments.length,
    doctors: dataset.doctors.length,
    services: dataset.services.length,
    patients: dataset.patients.length,
    encounters: dataset.encounters.length,
    encounterServices: dataset.encounterServices.length,
    billings: dataset.billings.length,
    claims: dataset.claims.length,
    pwdDiscounts: dataset.pwdDiscounts.length,
    feedback: dataset.feedback.length,
  };
}
