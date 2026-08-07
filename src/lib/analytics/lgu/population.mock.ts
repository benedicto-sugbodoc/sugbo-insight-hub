/**
 * Mock data for the Population Health & Epidemiology Dashboard
 * (Type B — Dashboard 12). FHIR alignment: Patient (birthDate, gender,
 * address), Condition (ICD-10 chapter), Coverage (PhilHealth), Encounter
 * (service type utilization), and free-text SDOH flags on Encounter/Patient.
 */
import { epiWeeks, seededRange } from "./shared.mock";

export interface PyramidBand {
  band: string;
  male: number;
  female: number;
}

export interface UtilizationSeries {
  service: string;
  benchmark: number;
  trend: { month: string; value: number }[];
}

export interface SdohMetric {
  label: string;
  value: number;
  delta: number;
  actionLabel: string;
}

export interface CommunicableDiseasePoint {
  week: string;
  dengue: number;
  ili: number;
  typhoid: number;
  cholera: number;
  measles: number;
  covid: number;
  lepto: number;
  rabies: number;
  abd: number;
  hfmd: number;
}

export interface PopulationData {
  tenant: string;
  period: string;
  pyramidRegistered: PyramidBand[];
  pyramidActive: PyramidBand[];
  pyramidPhilhealth: PyramidBand[];
  diseaseBurden: {
    ageGroup: string;
    infection: number;
    ncd: number;
    maternal: number;
    injury: number;
    other: number;
  }[];
  utilization: UtilizationSeries[];
  sdoh: SdohMetric[];
  communicable: CommunicableDiseasePoint[];
  outbreakThreshold: number;
}

const ageBands = [
  "0-4",
  "5-9",
  "10-14",
  "15-19",
  "20-24",
  "25-29",
  "30-34",
  "35-39",
  "40-44",
  "45-49",
  "50-54",
  "55-59",
  "60-64",
  "65-69",
  "70+",
];

function buildPyramid(scale: number, salt: number): PyramidBand[] {
  return ageBands.map((band, i) => ({
    band,
    male: Math.round(seededRange(i, 1200, 4200, salt) * scale),
    female: Math.round(seededRange(i, 1250, 4400, salt + 1) * scale),
  }));
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

function buildUtilization(): UtilizationSeries[] {
  const services: { service: string; benchmark: number }[] = [
    { service: "ANC", benchmark: 80 },
    { service: "Child checkup", benchmark: 80 },
    { service: "Immunization", benchmark: 95 },
    { service: "TB-DOTS", benchmark: 90 },
    { service: "NCD consult", benchmark: 70 },
    { service: "Family planning", benchmark: 60 },
    { service: "Mental health", benchmark: 40 },
    { service: "Dental", benchmark: 50 },
    { service: "Nutrition counseling", benchmark: 65 },
  ];
  return services.map((s, si) => ({
    ...s,
    trend: months12.map((month, i) => ({
      month,
      value: Math.round(seededRange(si * 12 + i, s.benchmark - 28, s.benchmark + 8, 120)),
    })),
  }));
}

export function getPopulationData(): PopulationData {
  return {
    tenant: "Cebu City Health Office",
    period: "August 2026 (MTD)",
    pyramidRegistered: buildPyramid(1, 130),
    pyramidActive: buildPyramid(0.62, 132),
    pyramidPhilhealth: buildPyramid(0.74, 134),
    diseaseBurden: [
      { ageGroup: "0-4", infection: 62, ncd: 4, maternal: 0, injury: 8, other: 14 },
      { ageGroup: "5-14", infection: 44, ncd: 6, maternal: 0, injury: 16, other: 12 },
      { ageGroup: "15-49", infection: 28, ncd: 32, maternal: 22, injury: 14, other: 10 },
      { ageGroup: "50-64", infection: 14, ncd: 58, maternal: 0, injury: 8, other: 8 },
      { ageGroup: "65+", infection: 12, ncd: 64, maternal: 0, injury: 6, other: 10 },
    ],
    utilization: buildUtilization(),
    sdoh: [
      {
        label: "4Ps / Pantawid enrollment",
        value: 34.2,
        delta: 1.4,
        actionLabel: "View 4Ps beneficiary list",
      },
      {
        label: "Indigent (PhilHealth) membership",
        value: 28.6,
        delta: -0.8,
        actionLabel: "Review indigent enrollment queue",
      },
      {
        label: "Without health insurance",
        value: 12.4,
        delta: -2.1,
        actionLabel: "Open unenrolled patient outreach list",
      },
      {
        label: "Self-reported food insecurity",
        value: 9.8,
        delta: 0.6,
        actionLabel: "Refer to nutrition program",
      },
      {
        label: "Referred to DSWD / social services",
        value: 6.2,
        delta: 0.9,
        actionLabel: "Open social services referral queue",
      },
    ],
    communicable: epiWeeks.map((week, i) => ({
      week,
      dengue:
        i >= 8 ? Math.round(seededRange(i, 30, 52, 140)) : Math.round(seededRange(i, 10, 18, 140)),
      ili: Math.round(seededRange(i, 20, 48, 141)),
      typhoid: Math.round(seededRange(i, 1, 6, 142)),
      cholera: Math.round(seededRange(i, 0, 2, 143)),
      measles: Math.round(seededRange(i, 0, 5, 144)),
      covid: Math.round(seededRange(i, 4, 16, 145)),
      lepto: Math.round(seededRange(i, 0, 3, 146)),
      rabies: Math.round(seededRange(i, 0, 4, 147)),
      abd: Math.round(seededRange(i, 6, 20, 148)),
      hfmd: Math.round(seededRange(i, 2, 12, 149)),
    })),
    outbreakThreshold: 30,
  };
}

export function fetchPopulationData(): Promise<PopulationData> {
  return new Promise((resolve) => setTimeout(() => resolve(getPopulationData()), 500));
}
