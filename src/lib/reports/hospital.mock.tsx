/**
 * Report configs + deterministic mock data for the Hospital Reports
 * module (Type A). Each report is a ReportConfig<T> consumed by the
 * generic <ReportShell /> engine — columns, filters, drawer detail and
 * rows are all defined here, nothing report-specific lives in the UI
 * layer. Row shapes mirror FHIR R4 resources flattened for tabular use,
 * consistent with the Type A analytics mock data (Block 1).
 */
import type { ReactNode } from "react";
import type { ReportConfig, ReportDrawerData } from "@/components/reports/types";
import { REPORT_TODAY } from "@/components/reports/export-utils";
import {
  PH_DEPARTMENTS,
  PH_PHYSICIANS,
  PH_TOP_DIAGNOSES,
  phPatientName,
} from "@/lib/analytics/ph-constants";

// Type-erased registry: each report below is authored against its own concrete row type
// and only erased at this boundary so heterogeneous reports can share one array.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyReportConfig = ReportConfig<any>;

function seeded(i: number, salt = 1): number {
  const x = Math.sin(i * 12.9898 * salt + 78.233) * 43758.5453;
  return x - Math.floor(x);
}
function seededRange(i: number, min: number, max: number, salt = 1): number {
  return min + seeded(i, salt) * (max - min);
}
function isoDaysAgo(days: number): string {
  const d = new Date(REPORT_TODAY);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function isoDaysFromNow(days: number): string {
  return isoDaysAgo(-days);
}

function StatusChip({
  tone,
  children,
}: {
  tone: "good" | "warning" | "danger" | "neutral";
  children: ReactNode;
}) {
  const map: Record<string, string> = {
    good: "bg-success/10 text-success border-success/30",
    warning: "bg-warning/10 text-warning border-warning/30",
    danger: "bg-danger/10 text-danger border-danger/30",
    neutral: "bg-brand/10 text-brand border-brand/30",
  };
  return (
    <span
      className={`inline-flex rounded border px-1.5 py-0.5 text-[11px] font-medium ${map[tone]}`}
    >
      {children}
    </span>
  );
}

const departments = PH_DEPARTMENTS;
const physicianPool = PH_PHYSICIANS.map((name, i) => ({
  name,
  pan: `PAN-00${(214 + i * 63).toString()}`,
  specialty: PH_DEPARTMENTS[i % PH_DEPARTMENTS.length]!,
}));
const diagnosisPool: [string, string][] = PH_TOP_DIAGNOSES.map((d) => [d.code, d.description]);
const surnames = [
  "Reyes",
  "Dela Cruz",
  "Garcia",
  "Lim",
  "Bautista",
  "Tan",
  "Santos",
  "Pascual",
  "Fernandez",
  "Ramos",
];
const givenNames = [
  "Maria",
  "Juan",
  "Ana",
  "Paolo",
  "Liza",
  "Carlo",
  "Grace",
  "Noel",
  "Divine",
  "Ricky",
];
function personName(i: number) {
  return `${surnames[i % surnames.length]}, ${givenNames[i % givenNames.length]} ${String.fromCharCode(65 + (i % 26))}.`;
}
const payers = ["PhilHealth", "HMO", "Private Pay", "SC/PWD Discount", "GSIS/Other"];

/* ------------------------------------------------------------------ */
/* R-01 Daily Census Report                                            */
/* ------------------------------------------------------------------ */

interface CensusRow {
  date: string;
  ward: string;
  capacity: number;
  occupied: number;
  admissionsToday: number;
  dischargesToday: number;
  pendingDischarges: number;
}
const wards = [
  "Medicine Ward",
  "Surgery Ward",
  "OB Ward",
  "Pedia Ward",
  "ICU",
  "Isolation",
  "Orthopedic Ward",
  "Private Rooms",
];

function buildCensusRows(): CensusRow[] {
  const rows: CensusRow[] = [];
  for (let d = 0; d < 21; d++) {
    const date = isoDaysAgo(d);
    wards.forEach((ward, w) => {
      const capacity = 20 + w * 6;
      const occupied = Math.round(seededRange(d * 8 + w, capacity * 0.5, capacity * 0.98, 1));
      rows.push({
        date,
        ward,
        capacity,
        occupied,
        admissionsToday: Math.round(seededRange(d * 8 + w, 0, 8, 2)),
        dischargesToday: Math.round(seededRange(d * 8 + w, 0, 7, 3)),
        pendingDischarges: Math.round(seededRange(d * 8 + w, 0, 4, 4)),
      });
    });
  }
  return rows;
}

const r01: ReportConfig<CensusRow> = {
  id: "daily-census",
  code: "R-01",
  title: "Daily Census Report",
  purpose: "Daily snapshot of bed occupancy, new admissions and discharges by ward.",
  jurisdiction: "hospital",
  automationNote: "Auto-generated at midnight and emailed to the Head Nurse and Administrator.",
  dateField: "date",
  searchFields: ["ward"],
  defaultSort: { key: "date", dir: "desc" },
  filters: [
    {
      key: "ward",
      label: "Ward",
      type: "select",
      options: wards.map((w) => ({ label: w, value: w })),
    },
  ],
  columns: [
    { key: "ward", header: "Ward", sortable: true },
    { key: "capacity", header: "Capacity", align: "right", sortable: true },
    { key: "occupied", header: "Occupied", align: "right", sortable: true },
    {
      key: "available",
      header: "Available",
      align: "right",
      render: (r) => String(r.capacity - r.occupied),
    },
    { key: "admissionsToday", header: "Admissions Today", align: "right", sortable: true },
    { key: "dischargesToday", header: "Discharges Today", align: "right", sortable: true },
    {
      key: "bor",
      header: "BOR%",
      align: "right",
      sortable: true,
      sortValue: (r) => (r.occupied / r.capacity) * 100,
      render: (r) => {
        const bor = (r.occupied / r.capacity) * 100;
        return (
          <StatusChip tone={bor > 95 ? "danger" : bor >= 75 ? "good" : "warning"}>
            {bor.toFixed(1)}%
          </StatusChip>
        );
      },
      exportValue: (r) => `${((r.occupied / r.capacity) * 100).toFixed(1)}%`,
    },
    { key: "pendingDischarges", header: "Pending Discharges", align: "right", sortable: true },
  ],
  getRows: buildCensusRows,
  getDrawer: (r): ReportDrawerData => ({
    heading: r.ward,
    subheading: `Census for ${r.date}`,
    detail: [
      { label: "Date", value: r.date },
      { label: "Capacity", value: r.capacity },
      { label: "Occupied", value: r.occupied },
      { label: "Available", value: r.capacity - r.occupied },
      { label: "BOR%", value: `${((r.occupied / r.capacity) * 100).toFixed(1)}%` },
      { label: "Admissions today", value: r.admissionsToday },
      { label: "Discharges today", value: r.dischargesToday },
      { label: "Pending discharges", value: r.pendingDischarges },
    ],
    related: [
      { label: "Linked Admission & Discharge Logbook", value: "View R-02" },
      { label: "Linked Discharge Clearance Audit", value: "View R-10" },
    ],
    actions: [
      { label: "Flag for bed management review", variant: "outline" },
      { label: "Notify Head Nurse", variant: "default" },
    ],
  }),
};

/* ------------------------------------------------------------------ */
/* R-02 Admission & Discharge Logbook                                  */
/* ------------------------------------------------------------------ */

interface LogbookRow {
  caseNo: string;
  patient: string;
  age: number;
  sex: "M" | "F";
  dateAdmitted: string;
  dateDischarged: string | null;
  los: number;
  icd10: string;
  diagnosis: string;
  disposition: string;
  physician: string;
  department: string;
  philhealthPin: string;
  payer: string;
}
const dispositions = ["Recovered", "Improved", "Transferred", "HAMA", "Expired"];

function buildLogbook(): LogbookRow[] {
  return Array.from({ length: 60 }, (_, i) => {
    const dx = diagnosisPool[i % diagnosisPool.length]!;
    const phys = physicianPool[i % physicianPool.length]!;
    const admitted = 2 + (i % 26);
    const los = 1 + Math.round(seededRange(i, 0, 10, 5));
    return {
      caseNo: `CN-2026-${(4200 + i).toString()}`,
      patient: personName(i),
      age: 21 + ((i * 13) % 60),
      sex: i % 2 === 0 ? "F" : "M",
      dateAdmitted: isoDaysAgo(admitted),
      dateDischarged: admitted - los >= 0 ? isoDaysAgo(admitted - los) : null,
      los,
      icd10: dx[0],
      diagnosis: dx[1],
      disposition: dispositions[i % dispositions.length]!,
      physician: phys.name,
      department: departments[i % departments.length]!,
      philhealthPin: `${(10 + (i % 89)).toString()}-${(100000000 + i * 137).toString().slice(0, 9)}-${i % 10}`,
      payer: payers[i % payers.length]!,
    };
  });
}

const r02: ReportConfig<LogbookRow> = {
  id: "admission-discharge-logbook",
  code: "R-02",
  title: "Admission & Discharge Logbook",
  purpose: "Chronological log of all admissions and discharges.",
  jurisdiction: "hospital",
  dateField: "dateAdmitted",
  searchFields: ["patient", "caseNo", "diagnosis", "icd10"],
  defaultSort: { key: "dateAdmitted", dir: "desc" },
  filters: [
    {
      key: "department",
      label: "Department",
      type: "select",
      options: departments.map((d) => ({ label: d, value: d })),
    },
    {
      key: "physician",
      label: "Physician",
      type: "select",
      options: physicianPool.map((p) => ({ label: p.name, value: p.name })),
    },
    {
      key: "disposition",
      label: "Disposition",
      type: "select",
      options: dispositions.map((d) => ({ label: d, value: d })),
    },
  ],
  columns: [
    { key: "caseNo", header: "Case No.", sortable: true },
    { key: "patient", header: "Patient Name", sortable: true },
    { key: "age", header: "Age/Sex", render: (r) => `${r.age}/${r.sex}` },
    { key: "dateAdmitted", header: "Date Admitted", sortable: true },
    { key: "dateDischarged", header: "Date Discharged", render: (r) => r.dateDischarged ?? "—" },
    { key: "los", header: "LOS", align: "right", sortable: true, render: (r) => `${r.los}d` },
    { key: "icd10", header: "Diagnosis (ICD-10)", render: (r) => `${r.icd10} · ${r.diagnosis}` },
    { key: "disposition", header: "Disposition", sortable: true },
    { key: "physician", header: "Attending Physician", sortable: true },
    { key: "philhealthPin", header: "PhilHealth PIN" },
    { key: "payer", header: "Payer", sortable: true },
  ],
  getRows: buildLogbook,
  getDrawer: (r): ReportDrawerData => ({
    heading: r.patient,
    subheading: `${r.caseNo} · ${r.age}y ${r.sex === "F" ? "Female" : "Male"}`,
    detail: [
      { label: "Date admitted", value: r.dateAdmitted },
      { label: "Date discharged", value: r.dateDischarged ?? "Still admitted" },
      { label: "Length of stay", value: `${r.los} days` },
      { label: "Diagnosis", value: `${r.icd10} · ${r.diagnosis}` },
      { label: "Disposition", value: r.disposition },
      { label: "Attending physician", value: r.physician },
      { label: "Department", value: r.department },
      { label: "PhilHealth PIN", value: r.philhealthPin },
      { label: "Payer", value: r.payer },
    ],
    documents: [
      { name: "Admitting order.pdf", type: "Clinical" },
      { name: "Discharge summary.pdf", type: "Clinical" },
    ],
    related: [
      { label: "PhilHealth claim", value: `CLM-${r.caseNo.slice(-6)}` },
      { label: "Discharge clearance status", value: r.dateDischarged ? "See R-10" : "Pending" },
    ],
    actions: [
      { label: "Open patient chart", variant: "default" },
      { label: "View billing summary", variant: "outline" },
    ],
  }),
};

/* ------------------------------------------------------------------ */
/* R-03 Morbidity Summary (Monthly/Annual) — DOH Form CY-2 equivalent  */
/* ------------------------------------------------------------------ */

interface MorbidityRow {
  icd10: string;
  diagnosis: string;
  ageGroup: string;
  male: number;
  female: number;
  period: "Monthly" | "Annual";
}
const ageGroups = ["0–4", "5–14", "15–49", "50–64", "65+"];

function buildMorbidity(): MorbidityRow[] {
  const rows: MorbidityRow[] = [];
  diagnosisPool.forEach(([icd10, diagnosis], di) => {
    ageGroups.forEach((ageGroup, ai) => {
      (["Monthly", "Annual"] as const).forEach((period, pi) => {
        const scale = period === "Annual" ? 12 : 1;
        const base = seededRange(di * 5 + ai, 8, 60, pi + 1) * scale;
        rows.push({
          icd10,
          diagnosis,
          ageGroup,
          male: Math.round(base * 0.48),
          female: Math.round(base * 0.52),
          period,
        });
      });
    });
  });
  return rows;
}

const r03: ReportConfig<MorbidityRow> = {
  id: "morbidity-summary",
  code: "R-03",
  title: "Morbidity Summary (Monthly/Annual)",
  purpose: "DOH-format morbidity report — ten leading causes by age group.",
  jurisdiction: "hospital",
  formatNote: "DOH Form CY-2 equivalent — Export PDF matches the official form layout.",
  searchFields: ["diagnosis", "icd10"],
  defaultSort: { key: "total", dir: "desc" },
  filters: [
    {
      key: "period",
      label: "Period",
      type: "select",
      options: [
        { label: "Monthly", value: "Monthly" },
        { label: "Annual", value: "Annual" },
      ],
    },
    {
      key: "ageGroup",
      label: "Age group",
      type: "select",
      options: ageGroups.map((a) => ({ label: a, value: a })),
    },
  ],
  columns: [
    { key: "icd10", header: "ICD-10 Code", sortable: true },
    { key: "diagnosis", header: "Diagnosis", sortable: true },
    { key: "ageGroup", header: "Age Group", sortable: true },
    { key: "male", header: "Male", align: "right", sortable: true },
    { key: "female", header: "Female", align: "right", sortable: true },
    {
      key: "total",
      header: "Total",
      align: "right",
      sortable: true,
      sortValue: (r) => r.male + r.female,
      render: (r) => String(r.male + r.female),
    },
    {
      key: "rate",
      header: "Rate per 1000",
      align: "right",
      sortValue: (r) => ((r.male + r.female) / 320) * 1000,
      render: (r) => (((r.male + r.female) / 320) * 1000).toFixed(1),
    },
  ],
  getRows: buildMorbidity,
  getDrawer: (r): ReportDrawerData => ({
    heading: `${r.icd10} · ${r.diagnosis}`,
    subheading: `${r.ageGroup} · ${r.period}`,
    detail: [
      { label: "Male cases", value: r.male },
      { label: "Female cases", value: r.female },
      { label: "Total cases", value: r.male + r.female },
      { label: "Rate per 1,000", value: (((r.male + r.female) / 320) * 1000).toFixed(1) },
    ],
    related: [{ label: "Source encounters", value: "See Admission & Discharge Logbook (R-02)" }],
  }),
};

/* ------------------------------------------------------------------ */
/* R-04 PhilHealth Claims Register                                     */
/* ------------------------------------------------------------------ */

interface ClaimRow {
  claimId: string;
  patient: string;
  pin: string;
  hciCaseNo: string;
  rtn: string;
  tcn: string;
  dateSubmitted: string;
  caseType: string;
  grossCharges: number;
  cr1: number;
  cr2: number;
  patientShare: number;
  status: string;
  dateApproved: string | null;
  remittanceDate: string | null;
  amountRemitted: number;
  department: string;
  physician: string;
}
const caseTypes = ["Ordinary", "Catastrophic", "Day Surgery", "Z-Benefit", "Konsulta"];
const claimStatuses = ["Submitted", "RTN Pending", "Approved", "Denied", "Returned-to-Hospital"];

function buildClaims(): ClaimRow[] {
  return Array.from({ length: 70 }, (_, i) => {
    const gross = Math.round(seededRange(i, 8000, 180000, 6));
    const cr1 = Math.round(gross * 0.7);
    const cr2 = Math.round(gross * 0.2);
    const status = claimStatuses[i % claimStatuses.length]!;
    const approved = status === "Approved" || status === "Denied";
    const remitted = status === "Approved";
    const amountRemitted = remitted ? Math.round((cr1 + cr2) * seededRange(i, 0.9, 1, 7)) : 0;
    return {
      claimId: `CLM-2026-${(9000 + i).toString()}`,
      patient: personName(i),
      pin: `${(10 + (i % 89)).toString()}-${(100000000 + i * 137).toString().slice(0, 9)}-${i % 10}`,
      hciCaseNo: `HCI-${(4200 + i).toString()}`,
      rtn: `RTN-${(3000 + i).toString()}`,
      tcn: `TCN-${(700000 + i * 3).toString()}`,
      dateSubmitted: isoDaysAgo(3 + (i % 45)),
      caseType: caseTypes[i % caseTypes.length]!,
      grossCharges: gross,
      cr1,
      cr2,
      patientShare: Math.max(0, gross - cr1 - cr2),
      status,
      dateApproved: approved ? isoDaysAgo(1 + (i % 30)) : null,
      remittanceDate: remitted ? isoDaysAgo(i % 14) : null,
      amountRemitted,
      department: departments[i % departments.length]!,
      physician: physicianPool[i % physicianPool.length]!.name,
    };
  });
}

const r04: ReportConfig<ClaimRow> = {
  id: "philhealth-claims-register",
  code: "R-04",
  title: "PhilHealth Claims Register",
  purpose: "Complete claims ledger for reconciliation.",
  jurisdiction: "hospital",
  dateField: "dateSubmitted",
  searchFields: ["patient", "claimId", "pin", "hciCaseNo"],
  defaultSort: { key: "dateSubmitted", dir: "desc" },
  filters: [
    {
      key: "caseType",
      label: "Case type",
      type: "select",
      options: caseTypes.map((c) => ({ label: c, value: c })),
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: claimStatuses.map((s) => ({ label: s, value: s })),
    },
    {
      key: "physician",
      label: "Physician",
      type: "select",
      options: physicianPool.map((p) => ({ label: p.name, value: p.name })),
    },
    {
      key: "department",
      label: "Department",
      type: "select",
      options: departments.map((d) => ({ label: d, value: d })),
    },
  ],
  columns: [
    { key: "claimId", header: "Claim ID", sortable: true },
    { key: "patient", header: "Patient", sortable: true },
    { key: "pin", header: "PIN" },
    { key: "hciCaseNo", header: "HCI Case No." },
    { key: "rtn", header: "RTN" },
    { key: "tcn", header: "TCN" },
    { key: "dateSubmitted", header: "Date Submitted", sortable: true },
    { key: "caseType", header: "Case Type", sortable: true },
    {
      key: "grossCharges",
      header: "Gross Charges",
      align: "right",
      sortable: true,
      render: (r) => r.grossCharges.toLocaleString("en-PH"),
    },
    { key: "cr1", header: "CR1", align: "right", render: (r) => r.cr1.toLocaleString("en-PH") },
    { key: "cr2", header: "CR2", align: "right", render: (r) => r.cr2.toLocaleString("en-PH") },
    {
      key: "patientShare",
      header: "Patient Share",
      align: "right",
      render: (r) => r.patientShare.toLocaleString("en-PH"),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (r) => (
        <StatusChip
          tone={r.status === "Approved" ? "good" : r.status === "Denied" ? "danger" : "warning"}
        >
          {r.status}
        </StatusChip>
      ),
    },
    { key: "dateApproved", header: "Date Approved", render: (r) => r.dateApproved ?? "—" },
    { key: "remittanceDate", header: "Remittance Date", render: (r) => r.remittanceDate ?? "—" },
    {
      key: "amountRemitted",
      header: "Amount Remitted",
      align: "right",
      render: (r) => r.amountRemitted.toLocaleString("en-PH"),
    },
    {
      key: "variance",
      header: "Variance",
      align: "right",
      sortValue: (r) => r.amountRemitted - (r.cr1 + r.cr2),
      render: (r) => (r.amountRemitted - (r.cr1 + r.cr2)).toLocaleString("en-PH"),
    },
  ],
  getRows: buildClaims,
  summaryRow: (rows) => ({
    claimId: `${rows.length} claims`,
    grossCharges: rows.reduce((s, r) => s + r.grossCharges, 0).toLocaleString("en-PH"),
    cr1: rows.reduce((s, r) => s + r.cr1, 0).toLocaleString("en-PH"),
    cr2: rows.reduce((s, r) => s + r.cr2, 0).toLocaleString("en-PH"),
    patientShare: rows.reduce((s, r) => s + r.patientShare, 0).toLocaleString("en-PH"),
    amountRemitted: rows.reduce((s, r) => s + r.amountRemitted, 0).toLocaleString("en-PH"),
  }),
  getDrawer: (r): ReportDrawerData => ({
    heading: r.claimId,
    subheading: `${r.patient} · ${r.caseType}`,
    detail: [
      { label: "PIN", value: r.pin },
      { label: "HCI Case No.", value: r.hciCaseNo },
      { label: "RTN / TCN", value: `${r.rtn} / ${r.tcn}` },
      { label: "Gross charges", value: `PHP ${r.grossCharges.toLocaleString("en-PH")}` },
      { label: "CR1 + CR2", value: `PHP ${(r.cr1 + r.cr2).toLocaleString("en-PH")}` },
      { label: "Patient share", value: `PHP ${r.patientShare.toLocaleString("en-PH")}` },
      { label: "Status", value: r.status },
      { label: "Date approved", value: r.dateApproved ?? "—" },
      { label: "Remittance date", value: r.remittanceDate ?? "—" },
      { label: "Amount remitted", value: `PHP ${r.amountRemitted.toLocaleString("en-PH")}` },
    ],
    documents: [
      { name: "eClaims submission.pdf", type: "Claims" },
      { name: "CF1/CF2/CF4.pdf", type: "Clinical" },
    ],
    related: [
      { label: "Encounter", value: r.hciCaseNo },
      { label: "Attending physician", value: r.physician },
    ],
    actions:
      r.status === "Denied"
        ? [{ label: "Open in Denial & Appeal Tracker", variant: "default" }]
        : [{ label: "Download remittance advice", variant: "outline" }],
  }),
};

/* ------------------------------------------------------------------ */
/* R-05 Denial & Appeal Tracker                                        */
/* ------------------------------------------------------------------ */

interface DenialRow {
  claimId: string;
  patient: string;
  denialDate: string;
  denialCode: string;
  denialReason: string;
  appealFiledDate: string | null;
  appealStatus: string;
  rthStatus: string;
  resolutionDate: string | null;
  amountRecovered: number;
  physician: string;
}
const denialReasonPool: [string, string][] = [
  ["DR-101", "Incomplete supporting documents"],
  ["DR-204", "Case rate not applicable to diagnosis"],
  ["DR-118", "Late filing beyond 60 days"],
  ["DR-330", "Member eligibility not established"],
  ["DR-402", "Duplicate claim submission"],
];
const appealStatuses = ["Not Filed", "Filed — Pending", "Under Review", "Approved", "Rejected"];

function buildDenials(): DenialRow[] {
  return Array.from({ length: 32 }, (_, i) => {
    const reason = denialReasonPool[i % denialReasonPool.length]!;
    const appealStatus = appealStatuses[i % appealStatuses.length]!;
    const filed = appealStatus !== "Not Filed";
    const resolved = appealStatus === "Approved" || appealStatus === "Rejected";
    return {
      claimId: `CLM-2026-${(8500 + i).toString()}`,
      patient: personName(i + 5),
      denialDate: isoDaysAgo(5 + (i % 50)),
      denialCode: reason[0],
      denialReason: reason[1],
      appealFiledDate: filed ? isoDaysAgo(3 + (i % 30)) : null,
      appealStatus,
      rthStatus: i % 3 === 0 ? "Returned-to-Hospital" : "Not returned",
      resolutionDate: resolved ? isoDaysAgo(i % 10) : null,
      amountRecovered: appealStatus === "Approved" ? Math.round(seededRange(i, 8000, 90000, 8)) : 0,
      physician: physicianPool[i % physicianPool.length]!.name,
    };
  });
}

const r05: ReportConfig<DenialRow> = {
  id: "denial-appeal-tracker",
  code: "R-05",
  title: "Denial & Appeal Tracker",
  purpose: "Track all denied claims and their appeal status.",
  jurisdiction: "hospital",
  dateField: "denialDate",
  searchFields: ["patient", "claimId", "denialReason"],
  defaultSort: { key: "denialDate", dir: "desc" },
  filters: [
    {
      key: "denialReason",
      label: "Denial reason",
      type: "select",
      options: denialReasonPool.map(([, reason]) => ({ label: reason, value: reason })),
    },
    {
      key: "physician",
      label: "Physician",
      type: "select",
      options: physicianPool.map((p) => ({ label: p.name, value: p.name })),
    },
  ],
  rowAlert: (r) => r.appealStatus === "Not Filed",
  columns: [
    { key: "claimId", header: "Claim ID", sortable: true },
    { key: "patient", header: "Patient", sortable: true },
    { key: "denialDate", header: "Denial Date", sortable: true },
    { key: "denialCode", header: "Denial Code" },
    { key: "denialReason", header: "Denial Reason" },
    {
      key: "appealFiledDate",
      header: "Appeal Filed Date",
      render: (r) => r.appealFiledDate ?? "Not filed",
    },
    {
      key: "appealStatus",
      header: "Appeal Status",
      sortable: true,
      render: (r) => (
        <StatusChip
          tone={
            r.appealStatus === "Approved"
              ? "good"
              : r.appealStatus === "Rejected"
                ? "danger"
                : r.appealStatus === "Not Filed"
                  ? "danger"
                  : "warning"
          }
        >
          {r.appealStatus}
        </StatusChip>
      ),
    },
    { key: "rthStatus", header: "RTH Status" },
    { key: "resolutionDate", header: "Resolution Date", render: (r) => r.resolutionDate ?? "—" },
    {
      key: "amountRecovered",
      header: "Amount Recovered",
      align: "right",
      render: (r) => r.amountRecovered.toLocaleString("en-PH"),
    },
  ],
  getRows: buildDenials,
  getDrawer: (r): ReportDrawerData => ({
    heading: r.claimId,
    subheading: r.patient,
    ...(r.appealStatus === "Not Filed"
      ? { alert: "No appeal has been filed for this denied claim." }
      : {}),
    detail: [
      { label: "Denial date", value: r.denialDate },
      { label: "Denial code", value: r.denialCode },
      { label: "Denial reason", value: r.denialReason },
      { label: "Appeal filed date", value: r.appealFiledDate ?? "Not filed" },
      { label: "Appeal status", value: r.appealStatus },
      { label: "RTH status", value: r.rthStatus },
      { label: "Resolution date", value: r.resolutionDate ?? "—" },
      { label: "Amount recovered", value: `PHP ${r.amountRecovered.toLocaleString("en-PH")}` },
    ],
    related: [{ label: "Original claim", value: "See PhilHealth Claims Register (R-04)" }],
    actions: [
      { label: "File appeal", variant: "default" },
      { label: "Attach supporting documents", variant: "outline" },
    ],
  }),
};

/* ------------------------------------------------------------------ */
/* R-06 Revenue & Collection Report                                    */
/* ------------------------------------------------------------------ */

interface RevenueRow {
  month: string;
  isoDate: string;
  department: string;
  grossCharges: number;
  scDiscount: number;
  gsis: number;
  hmo: number;
  philhealth: number;
  patientPayments: number;
  outstandingAr: number;
}
const months12 = [
  "Sep 25",
  "Oct 25",
  "Nov 25",
  "Dec 25",
  "Jan 26",
  "Feb 26",
  "Mar 26",
  "Apr 26",
  "May 26",
  "Jun 26",
  "Jul 26",
  "Aug 26",
];
const monthIso = [
  "2025-09-01",
  "2025-10-01",
  "2025-11-01",
  "2025-12-01",
  "2026-01-01",
  "2026-02-01",
  "2026-03-01",
  "2026-04-01",
  "2026-05-01",
  "2026-06-01",
  "2026-07-01",
  "2026-08-01",
];

function buildRevenue(): RevenueRow[] {
  const rows: RevenueRow[] = [];
  months12.forEach((month, mi) => {
    departments.forEach((department, di) => {
      const gross = Math.round(seededRange(mi * 8 + di, 400000, 1_800_000, 9));
      rows.push({
        month,
        isoDate: monthIso[mi]!,
        department,
        grossCharges: gross,
        scDiscount: Math.round(gross * 0.04),
        gsis: Math.round(gross * 0.05),
        hmo: Math.round(gross * 0.18),
        philhealth: Math.round(gross * 0.38),
        patientPayments: Math.round(gross * 0.22),
        outstandingAr: Math.round(gross * seededRange(mi * 8 + di, 0.03, 0.16, 10)),
      });
    });
  });
  return rows;
}

const r06: ReportConfig<RevenueRow> = {
  id: "revenue-collection",
  code: "R-06",
  title: "Revenue & Collection Report",
  purpose: "Financial summary for accounting, exportable to Excel with totals intact.",
  jurisdiction: "hospital",
  dateField: "isoDate",
  searchFields: ["department"],
  defaultSort: { key: "grossCharges", dir: "desc" },
  filters: [
    {
      key: "department",
      label: "Department",
      type: "select",
      options: departments.map((d) => ({ label: d, value: d })),
    },
  ],
  columns: [
    { key: "department", header: "Department", sortable: true },
    { key: "month", header: "Month", sortable: true },
    {
      key: "grossCharges",
      header: "Gross Charges",
      align: "right",
      sortable: true,
      render: (r) => r.grossCharges.toLocaleString("en-PH"),
    },
    {
      key: "scDiscount",
      header: "SC Discount",
      align: "right",
      render: (r) => r.scDiscount.toLocaleString("en-PH"),
    },
    { key: "gsis", header: "GSIS", align: "right", render: (r) => r.gsis.toLocaleString("en-PH") },
    { key: "hmo", header: "HMO", align: "right", render: (r) => r.hmo.toLocaleString("en-PH") },
    {
      key: "philhealth",
      header: "PhilHealth",
      align: "right",
      render: (r) => r.philhealth.toLocaleString("en-PH"),
    },
    {
      key: "patientPayments",
      header: "Patient Payments",
      align: "right",
      render: (r) => r.patientPayments.toLocaleString("en-PH"),
    },
    {
      key: "outstandingAr",
      header: "Outstanding AR",
      align: "right",
      sortable: true,
      render: (r) => r.outstandingAr.toLocaleString("en-PH"),
    },
    {
      key: "collectionRate",
      header: "Collection Rate",
      align: "right",
      sortValue: (r) => (1 - r.outstandingAr / r.grossCharges) * 100,
      render: (r) => {
        const rate = (1 - r.outstandingAr / r.grossCharges) * 100;
        return (
          <StatusChip tone={rate >= 92 ? "good" : rate >= 85 ? "warning" : "danger"}>
            {rate.toFixed(1)}%
          </StatusChip>
        );
      },
    },
  ],
  getRows: buildRevenue,
  summaryRow: (rows) => ({
    department: `${rows.length} rows`,
    grossCharges: rows.reduce((s, r) => s + r.grossCharges, 0).toLocaleString("en-PH"),
    scDiscount: rows.reduce((s, r) => s + r.scDiscount, 0).toLocaleString("en-PH"),
    gsis: rows.reduce((s, r) => s + r.gsis, 0).toLocaleString("en-PH"),
    hmo: rows.reduce((s, r) => s + r.hmo, 0).toLocaleString("en-PH"),
    philhealth: rows.reduce((s, r) => s + r.philhealth, 0).toLocaleString("en-PH"),
    patientPayments: rows.reduce((s, r) => s + r.patientPayments, 0).toLocaleString("en-PH"),
    outstandingAr: rows.reduce((s, r) => s + r.outstandingAr, 0).toLocaleString("en-PH"),
  }),
  getDrawer: (r): ReportDrawerData => ({
    heading: r.department,
    subheading: r.month,
    detail: [
      { label: "Gross charges", value: `PHP ${r.grossCharges.toLocaleString("en-PH")}` },
      { label: "SC discount", value: `PHP ${r.scDiscount.toLocaleString("en-PH")}` },
      { label: "GSIS", value: `PHP ${r.gsis.toLocaleString("en-PH")}` },
      { label: "HMO", value: `PHP ${r.hmo.toLocaleString("en-PH")}` },
      { label: "PhilHealth", value: `PHP ${r.philhealth.toLocaleString("en-PH")}` },
      { label: "Patient payments", value: `PHP ${r.patientPayments.toLocaleString("en-PH")}` },
      { label: "Outstanding AR", value: `PHP ${r.outstandingAr.toLocaleString("en-PH")}` },
    ],
    related: [{ label: "PhilHealth remittance detail", value: "See Executive Dashboard" }],
  }),
};

/* ------------------------------------------------------------------ */
/* R-07 Physician Activity Report — Admin only                         */
/* ------------------------------------------------------------------ */

interface PhysicianActivityRow {
  physician: string;
  pan: string;
  specialty: string;
  department: string;
  isoDate: string;
  cases: number;
  avgLos: number;
  procedures: number;
  pfRevenue: number;
  philhealthPfClaims: number;
  approvalRate: number;
}

function buildPhysicianActivity(): PhysicianActivityRow[] {
  const rows: PhysicianActivityRow[] = [];
  physicianPool.forEach((p, pi) => {
    months12.forEach((month, mi) => {
      rows.push({
        physician: p.name,
        pan: p.pan,
        specialty: p.specialty,
        department: departments[pi % departments.length]!,
        isoDate: monthIso[mi]!,
        cases: Math.round(seededRange(pi * 12 + mi, 20, 90, 11)),
        avgLos: Math.round(seededRange(pi * 12 + mi, 2, 7, 12) * 10) / 10,
        procedures: Math.round(seededRange(pi * 12 + mi, 4, 40, 13)),
        pfRevenue: Math.round(seededRange(pi * 12 + mi, 60000, 420000, 14)),
        philhealthPfClaims: Math.round(seededRange(pi * 12 + mi, 10, 60, 15)),
        approvalRate: Math.round(seededRange(pi * 12 + mi, 78, 98, 16)),
      });
    });
  });
  return rows;
}

const r07: ReportConfig<PhysicianActivityRow> = {
  id: "physician-activity",
  code: "R-07",
  title: "Physician Activity Report",
  purpose: "Individual physician utilization and revenue attribution.",
  jurisdiction: "hospital",
  roleNote: "Admin only",
  dateField: "isoDate",
  searchFields: ["physician", "specialty"],
  defaultSort: { key: "pfRevenue", dir: "desc" },
  filters: [
    {
      key: "department",
      label: "Department",
      type: "select",
      options: departments.map((d) => ({ label: d, value: d })),
    },
    {
      key: "physician",
      label: "Physician",
      type: "select",
      options: physicianPool.map((p) => ({ label: p.name, value: p.name })),
    },
  ],
  columns: [
    { key: "physician", header: "Physician", sortable: true },
    { key: "pan", header: "PAN" },
    { key: "specialty", header: "Specialty", sortable: true },
    { key: "cases", header: "Cases", align: "right", sortable: true },
    { key: "avgLos", header: "Avg LOS", align: "right", render: (r) => `${r.avgLos}d` },
    { key: "procedures", header: "Procedures", align: "right", sortable: true },
    {
      key: "pfRevenue",
      header: "Professional Fee Revenue",
      align: "right",
      sortable: true,
      render: (r) => r.pfRevenue.toLocaleString("en-PH"),
    },
    { key: "philhealthPfClaims", header: "PhilHealth PF Claims", align: "right" },
    {
      key: "approvalRate",
      header: "Approval Rate",
      align: "right",
      sortable: true,
      render: (r) => (
        <StatusChip
          tone={r.approvalRate >= 90 ? "good" : r.approvalRate >= 80 ? "warning" : "danger"}
        >
          {r.approvalRate}%
        </StatusChip>
      ),
    },
  ],
  getRows: buildPhysicianActivity,
  getDrawer: (r): ReportDrawerData => ({
    heading: r.physician,
    subheading: `${r.specialty} · ${r.pan}`,
    detail: [
      { label: "Cases", value: r.cases },
      { label: "Avg LOS", value: `${r.avgLos} days` },
      { label: "Procedures", value: r.procedures },
      { label: "Professional fee revenue", value: `PHP ${r.pfRevenue.toLocaleString("en-PH")}` },
      { label: "PhilHealth PF claims", value: r.philhealthPfClaims },
      { label: "Approval rate", value: `${r.approvalRate}%` },
    ],
    related: [{ label: "Department", value: r.department }],
  }),
};

/* ------------------------------------------------------------------ */
/* R-08 Laboratory Workload Report                                     */
/* ------------------------------------------------------------------ */

interface LabWorkloadRow {
  isoDate: string;
  test: string;
  loinc: string;
  category: string;
  ordersReceived: number;
  ordersCompleted: number;
  avgTat: number;
  criticalResults: number;
}
const labTests: [string, string, string][] = [
  ["CBC", "58410-2", "Hematology"],
  ["Basic Metabolic Panel", "51990-0", "Chemistry"],
  ["Urinalysis", "24356-8", "Urinalysis"],
  ["Blood Culture", "600-7", "Microbiology"],
  ["HbA1c", "4548-4", "Chemistry"],
  ["Lipid Panel", "57698-3", "Chemistry"],
  ["Dengue NS1", "48066-5", "Immunology"],
  ["COVID-19 RT-PCR", "94500-6", "Microbiology"],
];

function buildLabWorkload(): LabWorkloadRow[] {
  const rows: LabWorkloadRow[] = [];
  labTests.forEach(([test, loinc, category], ti) => {
    months12.forEach((_, mi) => {
      const received = Math.round(seededRange(ti * 12 + mi, 80, 620, 17));
      const completed = Math.round(received * seededRange(ti * 12 + mi, 0.9, 0.99, 18));
      rows.push({
        isoDate: monthIso[mi]!,
        test,
        loinc,
        category,
        ordersReceived: received,
        ordersCompleted: completed,
        avgTat: Math.round(seededRange(ti * 12 + mi, 1, 40, 19) * 10) / 10,
        criticalResults: Math.round(seededRange(ti * 12 + mi, 0, 12, 20)),
      });
    });
  });
  return rows;
}

const r08: ReportConfig<LabWorkloadRow> = {
  id: "laboratory-workload",
  code: "R-08",
  title: "Laboratory Workload Report",
  purpose: "Lab management and staffing analytics.",
  jurisdiction: "hospital",
  dateField: "isoDate",
  searchFields: ["test", "loinc"],
  defaultSort: { key: "ordersReceived", dir: "desc" },
  filters: [
    {
      key: "category",
      label: "Category",
      type: "select",
      options: Array.from(new Set(labTests.map((t) => t[2]))).map((c) => ({ label: c, value: c })),
    },
  ],
  columns: [
    { key: "test", header: "Test", sortable: true },
    { key: "loinc", header: "LOINC Code" },
    { key: "ordersReceived", header: "Orders Received", align: "right", sortable: true },
    { key: "ordersCompleted", header: "Orders Completed", align: "right" },
    {
      key: "ordersPending",
      header: "Orders Pending",
      align: "right",
      render: (r) => String(r.ordersReceived - r.ordersCompleted),
    },
    { key: "avgTat", header: "Avg TAT (hours)", align: "right", sortable: true },
    { key: "criticalResults", header: "Critical Results", align: "right" },
    {
      key: "abnormalRate",
      header: "Abnormal Rate%",
      align: "right",
      sortValue: (r) => (r.criticalResults / r.ordersCompleted) * 100 * 4,
      render: (r) => `${((r.criticalResults / r.ordersCompleted) * 100 * 4).toFixed(1)}%`,
    },
  ],
  getRows: buildLabWorkload,
  getDrawer: (r): ReportDrawerData => ({
    heading: r.test,
    subheading: `LOINC ${r.loinc} · ${r.category}`,
    detail: [
      { label: "Orders received", value: r.ordersReceived },
      { label: "Orders completed", value: r.ordersCompleted },
      { label: "Orders pending", value: r.ordersReceived - r.ordersCompleted },
      { label: "Avg TAT", value: `${r.avgTat} hours` },
      { label: "Critical results", value: r.criticalResults },
    ],
  }),
};

/* ------------------------------------------------------------------ */
/* R-09 Prescription & Formulary Compliance Report                     */
/* ------------------------------------------------------------------ */

interface FormularyRow {
  generic: string;
  brandOrdered: string;
  orders: number;
  percentGeneric: number;
  inNf: boolean;
  physician: string;
  department: string;
}
const drugPool: [string, string, boolean][] = [
  ["Paracetamol", "Biogesic", true],
  ["Amoxicillin", "Amoxil", true],
  ["Losartan", "Cozaar", true],
  ["Metformin", "Glucophage", true],
  ["Atorvastatin", "Lipitor", true],
  ["Cefuroxime", "Zinnat", true],
  ["Rosuvastatin", "Crestor", false],
  ["Esomeprazole", "Nexium", false],
];

function buildFormulary(): FormularyRow[] {
  return drugPool.flatMap(([generic, brand, inNf], di) =>
    physicianPool.map((p, pi) => ({
      generic,
      brandOrdered: brand,
      orders: Math.round(seededRange(di * 6 + pi, 10, 120, 21)),
      percentGeneric: Math.round(seededRange(di * 6 + pi, 45, 98, 22)),
      inNf,
      physician: p.name,
      department: departments[pi % departments.length]!,
    })),
  );
}

const r09: ReportConfig<FormularyRow> = {
  id: "formulary-compliance",
  code: "R-09",
  title: "Prescription & Formulary Compliance Report",
  purpose: "Track generic prescribing and National Formulary adherence.",
  jurisdiction: "hospital",
  searchFields: ["generic", "brandOrdered", "physician"],
  defaultSort: { key: "percentGeneric", dir: "asc" },
  filters: [
    {
      key: "physician",
      label: "Physician",
      type: "select",
      options: physicianPool.map((p) => ({ label: p.name, value: p.name })),
    },
    {
      key: "department",
      label: "Department",
      type: "select",
      options: departments.map((d) => ({ label: d, value: d })),
    },
  ],
  rowAlert: (r) => r.percentGeneric < 80 || !r.inNf,
  columns: [
    { key: "generic", header: "Drug Name (Generic)", sortable: true },
    { key: "brandOrdered", header: "Brand Ordered" },
    { key: "orders", header: "Orders", align: "right", sortable: true },
    {
      key: "percentGeneric",
      header: "% Generic",
      align: "right",
      sortable: true,
      render: (r) => (
        <StatusChip tone={r.percentGeneric >= 80 ? "good" : "danger"}>
          {r.percentGeneric}%
        </StatusChip>
      ),
    },
    {
      key: "inNf",
      header: "In NF?",
      align: "center",
      render: (r) => (
        <StatusChip tone={r.inNf ? "good" : "danger"}>{r.inNf ? "Yes" : "No"}</StatusChip>
      ),
    },
    { key: "physician", header: "Prescribing Physician", sortable: true },
    { key: "department", header: "Department" },
  ],
  getRows: buildFormulary,
  getDrawer: (r): ReportDrawerData => ({
    heading: r.generic,
    subheading: `Ordered as ${r.brandOrdered}`,
    ...(r.percentGeneric < 80 || !r.inNf
      ? {
          alert:
            "Below the 80% generic-prescribing threshold or drug is outside the National Formulary.",
        }
      : {}),
    detail: [
      { label: "Orders", value: r.orders },
      { label: "% Generic", value: `${r.percentGeneric}%` },
      { label: "In National Formulary", value: r.inNf ? "Yes" : "No" },
      { label: "Prescribing physician", value: r.physician },
      { label: "Department", value: r.department },
    ],
  }),
};

/* ------------------------------------------------------------------ */
/* R-10 Discharge Clearance Audit Report                               */
/* ------------------------------------------------------------------ */

interface DischargeAuditRow {
  patient: string;
  caseNo: string;
  dischargeDate: string;
  stepsIncomplete: number;
  missingDocuments: string;
  claimStatus: string;
  daysSinceDischarge: number;
  csfCollected: boolean;
}
const missingDocPool = ["None", "CSF", "CF4", "CSF, CF4", "Discharge summary", "Consent form"];

function buildDischargeAudit(): DischargeAuditRow[] {
  return Array.from({ length: 26 }, (_, i) => {
    const daysSince = Math.round(seededRange(i, 0, 21, 23));
    const csfCollected = seeded(i, 24) > 0.35;
    return {
      patient: personName(i + 10),
      caseNo: `CN-2026-${(5100 + i).toString()}`,
      dischargeDate: isoDaysAgo(daysSince),
      stepsIncomplete: Math.round(seededRange(i, 0, 5, 25)),
      missingDocuments: missingDocPool[i % missingDocPool.length]!,
      claimStatus: claimStatuses[i % claimStatuses.length]!,
      daysSinceDischarge: daysSince,
      csfCollected,
    };
  });
}

const r10: ReportConfig<DischargeAuditRow> = {
  id: "discharge-clearance-audit",
  code: "R-10",
  title: "Discharge Clearance Audit Report",
  purpose: "Track incomplete discharge wizard steps.",
  jurisdiction: "hospital",
  dateField: "dischargeDate",
  searchFields: ["patient", "caseNo"],
  defaultSort: { key: "daysSinceDischarge", dir: "desc" },
  filters: [
    {
      key: "claimStatus",
      label: "Claim status",
      type: "select",
      options: claimStatuses.map((s) => ({ label: s, value: s })),
    },
  ],
  rowAlert: (r) => !r.csfCollected && r.daysSinceDischarge >= 7,
  columns: [
    { key: "patient", header: "Patient", sortable: true },
    { key: "caseNo", header: "Case No." },
    { key: "dischargeDate", header: "Discharge Date", sortable: true },
    { key: "stepsIncomplete", header: "Steps Incomplete", align: "right", sortable: true },
    { key: "missingDocuments", header: "Missing Documents" },
    { key: "claimStatus", header: "Claim Status" },
    { key: "daysSinceDischarge", header: "Days Since Discharge", align: "right", sortable: true },
  ],
  getRows: buildDischargeAudit,
  getDrawer: (r): ReportDrawerData => ({
    heading: r.patient,
    subheading: r.caseNo,
    ...(!r.csfCollected && r.daysSinceDischarge >= 7
      ? { alert: `CSF not collected ${r.daysSinceDischarge} days after discharge.` }
      : {}),
    detail: [
      { label: "Discharge date", value: r.dischargeDate },
      { label: "Steps incomplete", value: r.stepsIncomplete },
      { label: "Missing documents", value: r.missingDocuments },
      { label: "Claim status", value: r.claimStatus },
      { label: "Days since discharge", value: r.daysSinceDischarge },
      { label: "CSF collected", value: r.csfCollected ? "Yes" : "No" },
    ],
    actions: [{ label: "Send reminder to attending physician", variant: "default" }],
  }),
};

export const hospitalReports: AnyReportConfig[] = [
  r01,
  r02,
  r03,
  r04,
  r05,
  r06,
  r07,
  r08,
  r09,
  r10,
] as AnyReportConfig[];

export function getHospitalReport(id: string): AnyReportConfig | undefined {
  return hospitalReports.find((r) => r.id === id);
}
