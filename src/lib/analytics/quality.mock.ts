/**
 * Mock data for the Quality & Patient Safety Analytics dashboard.
 * Shapes mirror FHIR R4 resources (Observation, AdverseEvent, MedicationStatement,
 * Procedure) flattened for chart consumption.
 */

export interface HacPoint {
  period: string;
  rate: number;
  mean: number;
  ucl: number;
  lcl: number;
  category: string;
  specialCause: boolean;
}

export interface MedErrorPoint {
  month: string;
  wrongDrug: number;
  wrongDose: number;
  wrongRoute: number;
  wrongPatient: number;
  omission: number;
  total: number;
}

export interface HandHygieneUnit {
  unit: string;
  compliance: number;
  target: number;
  observations: number;
}

export interface SsiSurgeon {
  surgeon: string;
  department: string;
  caseVolume: number;
  observedRate: number;
  expectedRate: number;
  outlier: boolean;
}

export interface PrescriptionDept {
  department: string;
  genericRate: number;
  antibioticRate: number;
  polypharmacyRate: number;
}

export interface QualityData {
  tenant: string;
  period: string;
  priorPeriod: string;
  kpi: {
    hacRate: { value: number; delta: number };
    medErrorsMtd: { value: number; delta: number };
    handHygiene: { value: number; delta: number };
    ssiRate: { value: number; delta: number };
    genericPrescribing: { value: number; delta: number };
  };
  hacCategories: string[];
  hac: HacPoint[];
  medErrors: MedErrorPoint[];
  handHygiene: {
    overall: number;
    target: number;
    trend: { month: string; value: number }[];
    byUnit: HandHygieneUnit[];
  };
  ssi: {
    surgeons: SsiSurgeon[];
    overallExpectedRate: number;
  };
  prescriptions: {
    departments: PrescriptionDept[];
    targets: { genericRate: number; antibioticRate: number; polypharmacyRate: number };
  };
}

const hacCategories = ["SSI", "CAUTI", "CLABSI", "VAP", "Falls", "Pressure Injuries"];

const periods = [
  "Sep 25", "Oct 25", "Nov 25", "Dec 25", "Jan 26", "Feb 26",
  "Mar 26", "Apr 26", "May 26", "Jun 26", "Jul 26", "Aug 26",
];

function buildHac(): HacPoint[] {
  const mean = 2.4;
  const ucl = 4.1;
  const lcl = 0.7;
  const noise = [1.9, 2.1, 2.6, 2.3, 3.9, 2.0, 2.5, 0.5, 2.8, 2.2, 4.4, 2.6];
  return periods.map((period, i) => {
    const rate = noise[i]!;
    const category = hacCategories[i % hacCategories.length]!;
    return {
      period,
      rate,
      mean,
      ucl,
      lcl,
      category,
      specialCause: rate > ucl || rate < lcl,
    };
  });
}

function buildMedErrors(): MedErrorPoint[] {
  return periods.map((month, i) => {
    const wrongDrug = 4 + ((i * 3) % 5);
    const wrongDose = 6 + ((i * 2) % 6);
    const wrongRoute = 2 + (i % 3);
    const wrongPatient = 1 + (i % 2);
    const omission = 3 + ((i * 5) % 4);
    return {
      month,
      wrongDrug,
      wrongDose,
      wrongRoute,
      wrongPatient,
      omission,
      total: wrongDrug + wrongDose + wrongRoute + wrongPatient + omission,
    };
  });
}

const units = [
  "Medicine Ward",
  "Surgery Ward",
  "ICU",
  "OB Ward",
  "Pedia Ward",
  "Emergency",
  "OR / Recovery",
];

function buildHandHygieneUnits(): HandHygieneUnit[] {
  return units.map((unit, i) => ({
    unit,
    compliance: 68 + ((i * 7) % 28),
    target: 80,
    observations: 120 + i * 34,
  }));
}

const surgeons = [
  "Dr. A. Villanueva",
  "Dr. M. Sarmiento",
  "Dr. J. Uy",
  "Dr. L. Cabrera",
  "Dr. R. Ocampo",
  "Dr. K. Mendoza",
  "Dr. F. Aquino",
  "Dr. N. Bravo",
  "Dr. T. Cortes",
  "Dr. E. Villareal",
];
const surgeonDepts = ["Surgery", "Orthopedics", "Obstetrics", "Cardiology"];

function buildSsiSurgeons(): SsiSurgeon[] {
  const expectedRate = 2.1;
  return surgeons.map((surgeon, i) => {
    const caseVolume = 30 + ((i * 23) % 180);
    const jitter = ((i * 37) % 40) / 10 - 2;
    const observedRate = Math.max(0, expectedRate + jitter * (1 / Math.sqrt(caseVolume / 40)));
    const outlier = observedRate > expectedRate * 1.8 || observedRate < expectedRate * 0.25;
    return {
      surgeon,
      department: surgeonDepts[i % surgeonDepts.length]!,
      caseVolume,
      observedRate: Number(observedRate.toFixed(2)),
      expectedRate,
      outlier,
    };
  });
}

const prescriptionDepts = [
  "Internal Medicine",
  "Surgery",
  "Obstetrics",
  "Pediatrics",
  "Orthopedics",
  "Cardiology",
  "Emergency",
];

function buildPrescriptions(): PrescriptionDept[] {
  return prescriptionDepts.map((department, i) => ({
    department,
    genericRate: 58 + ((i * 6) % 30),
    antibioticRate: 22 + ((i * 5) % 25),
    polypharmacyRate: 8 + ((i * 3) % 18),
  }));
}

export function getQualityData(): QualityData {
  const hac = buildHac();
  const medErrors = buildMedErrors();
  const handHygieneByUnit = buildHandHygieneUnits();
  const ssiSurgeons = buildSsiSurgeons();
  const prescriptions = buildPrescriptions();

  const lastHac = hac[hac.length - 1]!;
  const lastMedErrors = medErrors[medErrors.length - 1]!;
  const overallHandHygiene =
    handHygieneByUnit.reduce((s, u) => s + u.compliance, 0) / handHygieneByUnit.length;
  const overallSsi =
    ssiSurgeons.reduce((s, s2) => s + s2.observedRate, 0) / ssiSurgeons.length;
  const overallGeneric =
    prescriptions.reduce((s, d) => s + d.genericRate, 0) / prescriptions.length;

  return {
    tenant: "Cebu City Medical Center",
    period: "August 2026 (MTD)",
    priorPeriod: "July 2026",
    kpi: {
      hacRate: { value: lastHac.rate, delta: -8.2 },
      medErrorsMtd: { value: lastMedErrors.total, delta: -4.6 },
      handHygiene: { value: Number(overallHandHygiene.toFixed(1)), delta: 3.1 },
      ssiRate: { value: Number(overallSsi.toFixed(2)), delta: -5.4 },
      genericPrescribing: { value: Number(overallGeneric.toFixed(1)), delta: 2.0 },
    },
    hacCategories,
    hac,
    medErrors,
    handHygiene: {
      overall: Number(overallHandHygiene.toFixed(1)),
      target: 80,
      trend: periods.map((month, i) => ({ month, value: 68 + ((i * 3) % 20) })),
      byUnit: handHygieneByUnit,
    },
    ssi: {
      surgeons: ssiSurgeons,
      overallExpectedRate: 2.1,
    },
    prescriptions: {
      departments: prescriptions,
      targets: { genericRate: 75, antibioticRate: 30, polypharmacyRate: 10 },
    },
  };
}

export function fetchQualityData(): Promise<QualityData> {
  return new Promise((resolve) => setTimeout(() => resolve(getQualityData()), 500));
}
