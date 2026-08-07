/**
 * Jurisdiction roll-ups for the LGU Executive dashboard's geo-role switcher:
 * Barangay Captain -> Mayor / CHO -> Governor -> President. Only Cebu City
 * (15 barangays) is modeled in full detail elsewhere in this module; the
 * sibling cities of Cebu Province and the 17 regions of the Philippines
 * here are lightweight aggregate roll-ups only, deterministically scaled
 * from Cebu City's real numbers by population ratio — not independently
 * modeled datasets. Good enough to demonstrate "same layout, different
 * jurisdiction" without building out a second full LGU dataset.
 */
import { seededRange } from "./shared.mock";
import { getLguExecutiveData } from "./executive.mock";
import { PH_TOP_DIAGNOSES } from "../ph-constants";

export interface JurisdictionRow {
  id: string;
  name: string;
  population: number;
  // Choropleth / map metrics (mirrors BarangayMetricSet's metric fields)
  visitDensity: number;
  immunizationCoverage: number;
  tbCases: number;
  hypertensionPrevalence: number;
  maternalCoverage: number;
  dengueCases: number;
  // KPI-strip metrics
  konsultaVisits: number;
  ekasSubmitted: number;
  ekasValue: number;
  tbActiveCases: number;
  tbTreatmentSuccessRate: number;
  htnControl: number;
  dmControl: number;
  referralCompletion: number;
}

const cebuCity = getLguExecutiveData();
const cebuPop = cebuCity.totalPopulation;

const BASE = {
  visitDensity:
    cebuCity.barangays.reduce((s, b) => s + b.visitDensity, 0) / cebuCity.barangays.length,
  immunizationCoverage: cebuCity.immunization.coverage,
  hypertensionPrevalence: cebuCity.htnControl.value,
  maternalCoverage: cebuCity.maternalCoverage.value,
  tbTreatmentSuccessRate: cebuCity.tbDots.treatmentSuccessRate,
  htnControl: cebuCity.htnControl.value,
  dmControl: cebuCity.dmControl.value,
  referralCompletion: cebuCity.referralCompletion.value,
  konsultaVisitsPerCapita: cebuCity.konsultaVisits.total / cebuPop,
  ekasSubmittedPerCapita: cebuCity.ekas.submitted / cebuPop,
  tbActiveCasesPerCapita: cebuCity.tbDots.activeCases / cebuPop,
  tbCasesPerCapita: (cebuCity.tbDots.activeCases * 1.3) / cebuPop,
  dengueCasesPerCapita: 22 / cebuPop,
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Deterministically scales Cebu City's per-capita rates to a sibling entity's population. */
function scaleFromCebu(
  id: string,
  name: string,
  population: number,
  salt: number,
): JurisdictionRow {
  const j = (s: number) => seededRange(salt, 0.85, 1.15, s);
  return {
    id,
    name,
    population,
    visitDensity: Math.round(BASE.visitDensity * j(1) * 10) / 10,
    immunizationCoverage: Math.round(clamp(BASE.immunizationCoverage * j(2), 62, 99) * 10) / 10,
    tbCases: Math.round(BASE.tbCasesPerCapita * population * j(3)),
    hypertensionPrevalence: Math.round(clamp(BASE.hypertensionPrevalence * j(4), 12, 46) * 10) / 10,
    maternalCoverage: Math.round(clamp(BASE.maternalCoverage * j(5), 42, 95) * 10) / 10,
    dengueCases: Math.round(BASE.dengueCasesPerCapita * population * j(6)),
    konsultaVisits: Math.round(BASE.konsultaVisitsPerCapita * population * j(7)),
    ekasSubmitted: Math.round(BASE.ekasSubmittedPerCapita * population * j(8)),
    ekasValue: Math.round(BASE.ekasSubmittedPerCapita * population * j(8)) * 1500,
    tbActiveCases: Math.round(BASE.tbActiveCasesPerCapita * population * j(9)),
    tbTreatmentSuccessRate:
      Math.round(clamp(BASE.tbTreatmentSuccessRate * j(10), 72, 98) * 10) / 10,
    htnControl: Math.round(clamp(BASE.htnControl * j(11), 22, 60) * 10) / 10,
    dmControl: Math.round(clamp(BASE.dmControl * j(12), 22, 55) * 10) / 10,
    referralCompletion: Math.round(clamp(BASE.referralCompletion * j(13), 52, 90) * 10) / 10,
  };
}

function cebuCityRow(): JurisdictionRow {
  return {
    id: "city-cebu",
    name: "Cebu City",
    population: cebuPop,
    visitDensity: Math.round(BASE.visitDensity * 10) / 10,
    immunizationCoverage: cebuCity.immunization.coverage,
    tbCases: cebuCity.barangays.reduce((s, b) => s + b.tbCases, 0),
    hypertensionPrevalence: cebuCity.htnControl.value,
    maternalCoverage: cebuCity.maternalCoverage.value,
    dengueCases: cebuCity.barangays.reduce((s, b) => s + b.dengueCases, 0),
    konsultaVisits: cebuCity.konsultaVisits.total,
    ekasSubmitted: cebuCity.ekas.submitted,
    ekasValue: cebuCity.ekas.value,
    tbActiveCases: cebuCity.tbDots.activeCases,
    tbTreatmentSuccessRate: cebuCity.tbDots.treatmentSuccessRate,
    htnControl: cebuCity.htnControl.value,
    dmControl: cebuCity.dmControl.value,
    referralCompletion: cebuCity.referralCompletion.value,
  };
}

/** Cities/municipalities of Cebu Province — Cebu City uses its real modeled totals. */
export const CEBU_PROVINCE_CITIES: JurisdictionRow[] = [
  cebuCityRow(),
  scaleFromCebu("city-mandaue", "Mandaue City", Math.round(cebuPop * 0.55), 51),
  scaleFromCebu("city-lapulapu", "Lapu-Lapu City", Math.round(cebuPop * 0.62), 52),
  scaleFromCebu("city-talisay", "Talisay City", Math.round(cebuPop * 0.48), 53),
  scaleFromCebu("city-toledo", "Toledo City", Math.round(cebuPop * 0.22), 54),
  scaleFromCebu("city-danao", "Danao City", Math.round(cebuPop * 0.18), 55),
  scaleFromCebu("city-naga", "Naga City", Math.round(cebuPop * 0.17), 56),
  scaleFromCebu("city-carcar", "Carcar City", Math.round(cebuPop * 0.16), 57),
  scaleFromCebu("mun-consolacion", "Consolacion", Math.round(cebuPop * 0.19), 58),
  scaleFromCebu("mun-minglanilla", "Minglanilla", Math.round(cebuPop * 0.18), 59),
];

/** Weighted (population) roll-up of a set of jurisdiction rows into one summary row. */
function rollUp(id: string, name: string, rows: JurisdictionRow[]): JurisdictionRow {
  const population = rows.reduce((s, r) => s + r.population, 0) || 1;
  const weightedAvg = (get: (r: JurisdictionRow) => number) =>
    rows.reduce((s, r) => s + get(r) * r.population, 0) / population;
  return {
    id,
    name,
    population,
    visitDensity: Math.round(weightedAvg((r) => r.visitDensity) * 10) / 10,
    immunizationCoverage: Math.round(weightedAvg((r) => r.immunizationCoverage) * 10) / 10,
    tbCases: rows.reduce((s, r) => s + r.tbCases, 0),
    hypertensionPrevalence: Math.round(weightedAvg((r) => r.hypertensionPrevalence) * 10) / 10,
    maternalCoverage: Math.round(weightedAvg((r) => r.maternalCoverage) * 10) / 10,
    dengueCases: rows.reduce((s, r) => s + r.dengueCases, 0),
    konsultaVisits: rows.reduce((s, r) => s + r.konsultaVisits, 0),
    ekasSubmitted: rows.reduce((s, r) => s + r.ekasSubmitted, 0),
    ekasValue: rows.reduce((s, r) => s + r.ekasValue, 0),
    tbActiveCases: rows.reduce((s, r) => s + r.tbActiveCases, 0),
    tbTreatmentSuccessRate: Math.round(weightedAvg((r) => r.tbTreatmentSuccessRate) * 10) / 10,
    htnControl: Math.round(weightedAvg((r) => r.htnControl) * 10) / 10,
    dmControl: Math.round(weightedAvg((r) => r.dmControl) * 10) / 10,
    referralCompletion: Math.round(weightedAvg((r) => r.referralCompletion) * 10) / 10,
  };
}

export const CEBU_PROVINCE_TOTAL: JurisdictionRow = rollUp(
  "province-cebu",
  "Cebu Province",
  CEBU_PROVINCE_CITIES,
);

/**
 * 17 regions of the Philippines. Region VII (Central Visayas) is built from
 * the modeled Cebu Province total plus a flat top-up standing in for the
 * province's Bohol/Negros Oriental/Siquijor neighbors. The other 16 regions
 * are scaled from Cebu City's per-capita rates against roughly realistic
 * relative population sizes — illustrative only, not census figures.
 */
const otherRegionSpecs: { id: string; name: string; popRatio: number; salt: number }[] = [
  { id: "region-ncr", name: "National Capital Region", popRatio: 1.6, salt: 61 },
  { id: "region-car", name: "Cordillera Administrative Region", popRatio: 0.22, salt: 62 },
  { id: "region-1", name: "Region I – Ilocos Region", popRatio: 0.6, salt: 63 },
  { id: "region-2", name: "Region II – Cagayan Valley", popRatio: 0.45, salt: 64 },
  { id: "region-3", name: "Region III – Central Luzon", popRatio: 1.3, salt: 65 },
  { id: "region-4a", name: "Region IV-A – CALABARZON", popRatio: 1.9, salt: 66 },
  { id: "region-mimaropa", name: "MIMAROPA Region", popRatio: 0.38, salt: 67 },
  { id: "region-5", name: "Region V – Bicol Region", popRatio: 0.75, salt: 68 },
  { id: "region-6", name: "Region VI – Western Visayas", popRatio: 0.95, salt: 69 },
  { id: "region-8", name: "Region VIII – Eastern Visayas", popRatio: 0.6, salt: 70 },
  { id: "region-9", name: "Region IX – Zamboanga Peninsula", popRatio: 0.5, salt: 71 },
  { id: "region-10", name: "Region X – Northern Mindanao", popRatio: 0.62, salt: 72 },
  { id: "region-11", name: "Region XI – Davao Region", popRatio: 0.7, salt: 73 },
  { id: "region-12", name: "Region XII – SOCCSKSARGEN", popRatio: 0.55, salt: 74 },
  { id: "region-13", name: "Region XIII – Caraga", popRatio: 0.35, salt: 75 },
  { id: "region-barmm", name: "BARMM", popRatio: 0.5, salt: 76 },
];

function centralVisayasRow(): JurisdictionRow {
  const topUp = rollUp("cv-neighbors", "Bohol / Negros Oriental / Siquijor (est.)", [
    scaleFromCebu("prov-bohol", "Bohol", Math.round(CEBU_PROVINCE_TOTAL.population * 0.42), 81),
    scaleFromCebu(
      "prov-negor",
      "Negros Oriental",
      Math.round(CEBU_PROVINCE_TOTAL.population * 0.38),
      82,
    ),
    scaleFromCebu(
      "prov-siquijor",
      "Siquijor",
      Math.round(CEBU_PROVINCE_TOTAL.population * 0.05),
      83,
    ),
  ]);
  return rollUp("region-7", "Region VII – Central Visayas", [CEBU_PROVINCE_TOTAL, topUp]);
}

export const PH_REGIONS: JurisdictionRow[] = [
  centralVisayasRow(),
  ...otherRegionSpecs.map((r) =>
    scaleFromCebu(
      r.id,
      r.name,
      Math.round(CEBU_PROVINCE_TOTAL.population * 4 * r.popRatio),
      r.salt,
    ),
  ),
];

export const PHILIPPINES_TOTAL: JurisdictionRow = rollUp("national-ph", "Philippines", PH_REGIONS);

/** Scales the modeled Cebu City epidemic curve to a different population for the same shape/series. */
export function scaleEpiCurve(ratio: number) {
  return cebuCity.epiCurve.map((p) => ({
    ...p,
    dengue: Math.round(p.dengue * ratio),
    measles: Math.round(p.measles * ratio),
    diarrhea: Math.round(p.diarrhea * ratio),
    ari: Math.round(p.ari * ratio),
    dengueBaseline: Math.round(p.dengueBaseline * ratio),
    measlesBaseline: Math.round(p.measlesBaseline * ratio),
    diarrheaBaseline: Math.round(p.diarrheaBaseline * ratio),
    ariBaseline: Math.round(p.ariBaseline * ratio),
  }));
}

/** Top-diagnoses ranking scaled to a jurisdiction's population, using the canonical PH ICD-10 list. */
export function jurisdictionMorbidity(population: number) {
  const ratio = population / cebuPop;
  return PH_TOP_DIAGNOSES.map((d, i) => ({
    code: d.code,
    description: d.description,
    current: Math.round((1800 - i * 120) * ratio),
    priorMonth: Math.round((1700 - i * 110) * ratio),
    priorYear: Math.round((1600 - i * 100) * ratio),
  }));
}
