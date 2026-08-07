/**
 * Realistic mock data for the SugboDoc Medical Director executive dashboard.
 *
 * All data structures are shaped like FHIR R4 resources (Patient, Encounter,
 * Condition, Observation, DiagnosticReport, ServiceRequest) but flattened for
 * chart/table consumption. Values are in PHP and reflect the current month
 * compared with the prior month.
 */

export type KpiStatus = "good" | "warning" | "danger" | "neutral";

export interface KpiMetric {
  id: string;
  label: string;
  value: string;
  delta: number; // percentage change vs prior month
  priorValue: string;
  target?: string;
  status: KpiStatus;
  description: string;
}

export interface OccupancyPoint {
  date: string;
  occupancy: number;
  prior: number;
  capacity: number;
}

export interface DepartmentAdmissions {
  department: string;
  current: number;
  prior: number;
}

export interface OrUtilizationPoint {
  date: string;
  scheduled: number;
  completed: number;
  utilization: number;
}

export interface DiagnosisTop {
  code: string;
  description: string;
  count: number;
}

export interface QualityEventPoint {
  date: string;
  falls: number;
  infections: number;
  medicationErrors: number;
}

export interface VolumePoint {
  date: string;
  admissions: number;
  discharges: number;
  edVisits: number;
}

export interface PatientAlert {
  id: string;
  date: string;
  patientId: string;
  patientName: string;
  age: number;
  gender: "male" | "female";
  category: "Critical Result" | "High Risk" | "Safety Event" | "Readmission" | "Pending Claim";
  source: string;
  department: string;
  summary: string;
  status: "Open" | "Acknowledged" | "Resolved";
  priority: "High" | "Medium" | "Low";
}

export interface DashboardData {
  period: string;
  priorPeriod: string;
  generatedAt: string;
  tenant: string;
  role: string;
  kpis: KpiMetric[];
  occupancy: OccupancyPoint[];
  departmentAdmissions: DepartmentAdmissions[];
  orUtilization: OrUtilizationPoint[];
  topDiagnoses: DiagnosisTop[];
  qualityEvents: QualityEventPoint[];
  volume: VolumePoint[];
  alerts: PatientAlert[];
}

export const CURRENT_MONTH = "August 2026";
export const PRIOR_MONTH = "July 2026";

export const kpiMetrics: KpiMetric[] = [
  {
    id: "bed-occupancy",
    label: "Bed Occupancy Rate",
    value: "82.4%",
    delta: 4.2,
    priorValue: "79.1%",
    target: "85%",
    status: "warning",
    description: "Average daily inpatient bed occupancy across all wards.",
  },
  {
    id: "alos",
    label: "Average Length of Stay",
    value: "4.8 days",
    delta: -3.8,
    priorValue: "5.0 days",
    target: "4.5 days",
    status: "good",
    description: "Mean inpatient length of stay for discharged encounters.",
  },
  {
    id: "ed-admissions",
    label: "ER Admissions",
    value: "1,248",
    delta: 12.5,
    priorValue: "1,109",
    target: "1,200",
    status: "warning",
    description: "Emergency department admissions converted to inpatient status.",
  },
  {
    id: "or-utilization",
    label: "OR Utilization",
    value: "76.3%",
    delta: 6.1,
    priorValue: "71.9%",
    target: "80%",
    status: "neutral",
    description: "Scheduled operating hours used for actual procedures.",
  },
  {
    id: "mortality",
    label: "Inpatient Mortality",
    value: "1.4%",
    delta: -0.2,
    priorValue: "1.6%",
    target: "< 2%",
    status: "good",
    description: "In-hospital deaths per 100 inpatient discharges.",
  },
  {
    id: "readmissions",
    label: "30-Day Readmissions",
    value: "6.8%",
    delta: 0.9,
    priorValue: "5.9%",
    target: "< 5%",
    status: "danger",
    description: "Unplanned inpatient readmissions within 30 days of discharge.",
  },
  {
    id: "safety-events",
    label: "Patient Safety Events",
    value: "23",
    delta: -8.0,
    priorValue: "25",
    target: "< 20",
    status: "warning",
    description: "Reported falls, infections, medication errors, and near misses.",
  },
  {
    id: "critical-results",
    label: "Pending Critical Results",
    value: "7",
    delta: -22.2,
    priorValue: "9",
    target: "0",
    status: "good",
    description: "Critical laboratory/imaging results awaiting clinician acknowledgement.",
  },
  {
    id: "pending-claims",
    label: "Pending PhilHealth Claims",
    value: "Php 1,284,500",
    delta: 5.4,
    priorValue: "Php 1,218,500",
    target: "Php 1,000,000",
    status: "warning",
    description: "Total value of PhilHealth eClaims awaiting submission or payment.",
  },
  {
    id: "gross-revenue",
    label: "Gross Patient Revenue",
    value: "Php 18.4M",
    delta: 7.3,
    priorValue: "Php 17.1M",
    target: "Php 18M",
    status: "good",
    description: "Gross billed revenue for inpatient and outpatient services.",
  },
];

export const occupancyData: OccupancyPoint[] = [
  { date: "Aug 1", occupancy: 78, prior: 76, capacity: 320 },
  { date: "Aug 2", occupancy: 80, prior: 78, capacity: 320 },
  { date: "Aug 3", occupancy: 82, prior: 79, capacity: 320 },
  { date: "Aug 4", occupancy: 85, prior: 80, capacity: 320 },
  { date: "Aug 5", occupancy: 84, prior: 81, capacity: 320 },
  { date: "Aug 6", occupancy: 86, prior: 82, capacity: 320 },
  { date: "Aug 7", occupancy: 88, prior: 83, capacity: 320 },
  { date: "Aug 8", occupancy: 85, prior: 82, capacity: 320 },
  { date: "Aug 9", occupancy: 83, prior: 80, capacity: 320 },
  { date: "Aug 10", occupancy: 81, prior: 79, capacity: 320 },
  { date: "Aug 11", occupancy: 79, prior: 78, capacity: 320 },
  { date: "Aug 12", occupancy: 82, prior: 77, capacity: 320 },
  { date: "Aug 13", occupancy: 84, prior: 79, capacity: 320 },
  { date: "Aug 14", occupancy: 86, prior: 80, capacity: 320 },
  { date: "Aug 15", occupancy: 87, prior: 81, capacity: 320 },
  { date: "Aug 16", occupancy: 85, prior: 80, capacity: 320 },
  { date: "Aug 17", occupancy: 83, prior: 79, capacity: 320 },
  { date: "Aug 18", occupancy: 80, prior: 78, capacity: 320 },
  { date: "Aug 19", occupancy: 82, prior: 77, capacity: 320 },
  { date: "Aug 20", occupancy: 84, prior: 79, capacity: 320 },
  { date: "Aug 21", occupancy: 86, prior: 80, capacity: 320 },
  { date: "Aug 22", occupancy: 88, prior: 81, capacity: 320 },
  { date: "Aug 23", occupancy: 87, prior: 82, capacity: 320 },
  { date: "Aug 24", occupancy: 85, prior: 80, capacity: 320 },
  { date: "Aug 25", occupancy: 83, prior: 79, capacity: 320 },
  { date: "Aug 26", occupancy: 81, prior: 78, capacity: 320 },
  { date: "Aug 27", occupancy: 80, prior: 77, capacity: 320 },
  { date: "Aug 28", occupancy: 82, prior: 78, capacity: 320 },
  { date: "Aug 29", occupancy: 84, prior: 79, capacity: 320 },
  { date: "Aug 30", occupancy: 86, prior: 80, capacity: 320 },
  { date: "Aug 31", occupancy: 85, prior: 79, capacity: 320 },
];

export const departmentAdmissions: DepartmentAdmissions[] = [
  { department: "Medicine", current: 342, prior: 310 },
  { department: "Surgery", current: 198, prior: 185 },
  { department: "Obstetrics", current: 176, prior: 162 },
  { department: "Pediatrics", current: 134, prior: 128 },
  { department: "Orthopedics", current: 112, prior: 98 },
  { department: "ENT", current: 86, prior: 82 },
  { department: "Ophthalmology", current: 64, prior: 60 },
  { department: "Dermatology", current: 52, prior: 48 },
];

export const orUtilization: OrUtilizationPoint[] = [
  { date: "Mon", scheduled: 24, completed: 20, utilization: 83.3 },
  { date: "Tue", scheduled: 28, completed: 22, utilization: 78.6 },
  { date: "Wed", scheduled: 26, completed: 21, utilization: 80.8 },
  { date: "Thu", scheduled: 30, completed: 23, utilization: 76.7 },
  { date: "Fri", scheduled: 25, completed: 19, utilization: 76.0 },
  { date: "Sat", scheduled: 18, completed: 14, utilization: 77.8 },
  { date: "Sun", scheduled: 12, completed: 9, utilization: 75.0 },
];

export const topDiagnoses: DiagnosisTop[] = [
  { code: "J44.9", description: "COPD, unspecified", count: 94 },
  { code: "I10", description: "Essential hypertension", count: 87 },
  { code: "E11.9", description: "Type 2 diabetes mellitus", count: 76 },
  { code: "A09", description: "Gastroenteritis and colitis", count: 68 },
  { code: "N39.0", description: "Urinary tract infection", count: 62 },
  { code: "J18.9", description: "Pneumonia, unspecified", count: 58 },
  { code: "S52.5", description: "Fracture of lower forearm", count: 45 },
  { code: "K29.7", description: "Gastritis", count: 41 },
  { code: "O80", description: "Single spontaneous delivery", count: 38 },
  { code: "M25.5", description: "Joint pain", count: 32 },
];

export const qualityEvents: QualityEventPoint[] = [
  { date: "Week 1", falls: 2, infections: 1, medicationErrors: 1 },
  { date: "Week 2", falls: 1, infections: 2, medicationErrors: 2 },
  { date: "Week 3", falls: 3, infections: 1, medicationErrors: 1 },
  { date: "Week 4", falls: 1, infections: 3, medicationErrors: 2 },
];

export const volumeData: VolumePoint[] = [
  { date: "Aug 1", admissions: 32, discharges: 28, edVisits: 98 },
  { date: "Aug 5", admissions: 38, discharges: 35, edVisits: 112 },
  { date: "Aug 10", admissions: 36, discharges: 34, edVisits: 105 },
  { date: "Aug 15", admissions: 42, discharges: 39, edVisits: 124 },
  { date: "Aug 20", admissions: 40, discharges: 38, edVisits: 118 },
  { date: "Aug 25", admissions: 35, discharges: 37, edVisits: 108 },
  { date: "Aug 30", admissions: 33, discharges: 31, edVisits: 95 },
];

export const patientAlerts: PatientAlert[] = [
  {
    id: "ALT-1024",
    date: "2026-08-07",
    patientId: "PT-2026-00491",
    patientName: "Reyes, Maria L.",
    age: 67,
    gender: "female",
    category: "Critical Result",
    source: "DiagnosticReport/LAB-8842",
    department: "Internal Medicine",
    summary: "Potassium 6.2 mmol/L — urgent hyperkalemia requiring intervention.",
    status: "Open",
    priority: "High",
  },
  {
    id: "ALT-1023",
    date: "2026-08-07",
    patientId: "PT-2026-00512",
    patientName: "Dela Cruz, Juan P.",
    age: 54,
    gender: "male",
    category: "High Risk",
    source: "Condition/ICD-I21.9",
    department: "Cardiology",
    summary: "Acute MI with elevated troponin; awaiting PCI slot.",
    status: "Acknowledged",
    priority: "High",
  },
  {
    id: "ALT-1022",
    date: "2026-08-06",
    patientId: "PT-2026-00488",
    patientName: "Garcia, Ana S.",
    age: 29,
    gender: "female",
    category: "Safety Event",
    source: "AuditEvent/FALL-2201",
    department: "Obstetrics",
    summary: "Slip in antenatal ward; no injury, incident report filed.",
    status: "Resolved",
    priority: "Medium",
  },
  {
    id: "ALT-1021",
    date: "2026-08-06",
    patientId: "PT-2026-00450",
    patientName: "Lim, Roberto T.",
    age: 71,
    gender: "male",
    category: "Readmission",
    source: "Encounter/RE-AD-1041",
    department: "Pulmonology",
    summary: "7-day readmission for COPD exacerbation after discharge.",
    status: "Open",
    priority: "High",
  },
  {
    id: "ALT-1020",
    date: "2026-08-05",
    patientId: "PT-2026-00392",
    patientName: "Bautista, Sofia R.",
    age: 45,
    gender: "female",
    category: "Pending Claim",
    source: "Claim/PH-2026-1182",
    department: "Billing",
    summary: "PhilHealth eClaim missing RTN; pending document upload.",
    status: "Open",
    priority: "Medium",
  },
  {
    id: "ALT-1019",
    date: "2026-08-05",
    patientId: "PT-2026-00505",
    patientName: "Tan, Miguel A.",
    age: 38,
    gender: "male",
    category: "Critical Result",
    source: "Observation/GLU-9912",
    department: "Emergency",
    summary: "Random blood glucose 28.4 mmol/L with altered sensorium.",
    status: "Acknowledged",
    priority: "High",
  },
  {
    id: "ALT-1018",
    date: "2026-08-04",
    patientId: "PT-2026-00410",
    patientName: "Santos, Liza M.",
    age: 62,
    gender: "female",
    category: "Safety Event",
    source: "AuditEvent/INF-1092",
    department: "Surgery",
    summary: "Suspected SSI in post-op appendectomy; cultures sent.",
    status: "Open",
    priority: "High",
  },
  {
    id: "ALT-1017",
    date: "2026-08-03",
    patientId: "PT-2026-00388",
    patientName: "Pascual, Daniel E.",
    age: 58,
    gender: "male",
    category: "High Risk",
    source: "CarePlan/Stroke-441",
    department: "Neurology",
    summary: "TIA with ABCD2 score 5; discharged with close follow-up.",
    status: "Acknowledged",
    priority: "Medium",
  },
  {
    id: "ALT-1016",
    date: "2026-08-02",
    patientId: "PT-2026-00371",
    patientName: "Fernandez, Carla O.",
    age: 33,
    gender: "female",
    category: "Pending Claim",
    source: "Claim/PH-2026-1155",
    department: "Billing",
    summary: "CSF documentation incomplete for maternity package claim.",
    status: "Open",
    priority: "Low",
  },
  {
    id: "ALT-1015",
    date: "2026-08-01",
    patientId: "PT-2026-00360",
    patientName: "Ramos, Paolo S.",
    age: 49,
    gender: "male",
    category: "Critical Result",
    source: "DiagnosticReport/RAD-7799",
    department: "Radiology",
    summary: "CT chest shows large pulmonary embolism; results communicated.",
    status: "Resolved",
    priority: "High",
  },
];

export function getDashboardData(): DashboardData {
  return {
    period: CURRENT_MONTH,
    priorPeriod: PRIOR_MONTH,
    generatedAt: new Date().toISOString(),
    tenant: "Cebu City Medical Center",
    role: "Medical Director / Chief of Hospital",
    kpis: kpiMetrics,
    occupancy: occupancyData,
    departmentAdmissions,
    orUtilization,
    topDiagnoses,
    qualityEvents,
    volume: volumeData,
    alerts: patientAlerts,
  };
}

export function fetchDashboardData(): Promise<DashboardData> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(getDashboardData()), 900);
  });
}
