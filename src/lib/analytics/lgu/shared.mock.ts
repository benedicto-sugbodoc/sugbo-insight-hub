/**
 * Shared mock-data building blocks for the LGU / City Health Center
 * Analytics module (Type B). Mirrors the deterministic, FHIR-shaped
 * generation style established in src/lib/analytics/executive.mock.ts
 * (Type A / Block 1) — no Math.random so server/client renders match.
 *
 * FHIR alignment notes (mirrored across all Type B mock files):
 *  - Patient.address.city / .district -> barangay
 *  - Encounter.type = "Konsulta" | "TB-DOTS" | "ANC" | "NCD" | "Immunization"
 *  - Condition.code = ICD-10, Condition.onsetDateTime -> surveillance
 *  - Observation (vital-signs, LOINC 4548-4 HbA1c, LOINC 2345-7 FBS)
 *  - Claim / eKAS -> Konsulta PhilHealth claims
 */

export interface Barangay {
  id: string;
  name: string;
  population: number;
  /** Physical BHC facility this barangay is clustered under (5 facilities serve the 15 barangays). */
  bhc: string;
  bhcId: string;
  phn: string;
}

/**
 * 5 physical Barangay Health Center facilities, each serving a 3-barangay
 * catchment — matches the "5 BHCs in the LGU mock data" mock-data spec
 * while keeping the richer 15-barangay geography for choropleth/drill-down.
 */
export const BHC_FACILITIES = [
  { id: "bhc-lahug", name: "Lahug Health Center" },
  { id: "bhc-guadalupe", name: "Guadalupe RHU" },
  { id: "bhc-labangon", name: "Labangon RHU" },
  { id: "bhc-pardo", name: "Pardo District Health Center" },
  { id: "bhc-sambag", name: "Sambag Health Center" },
] as const;

export const BARANGAYS: Barangay[] = [
  {
    id: "brgy-lahug",
    name: "Lahug",
    population: 22400,
    bhc: "Lahug Health Center",
    bhcId: "bhc-lahug",
    phn: "N. Villaraza, RN",
  },
  {
    id: "brgy-banilad",
    name: "Banilad",
    population: 18900,
    bhc: "Lahug Health Center",
    bhcId: "bhc-lahug",
    phn: "R. Suarez, RN",
  },
  {
    id: "brgy-capsite",
    name: "Capitol Site",
    population: 15200,
    bhc: "Lahug Health Center",
    bhcId: "bhc-lahug",
    phn: "A. Rosales, RN",
  },
  {
    id: "brgy-guadalupe",
    name: "Guadalupe",
    population: 31800,
    bhc: "Guadalupe RHU",
    bhcId: "bhc-guadalupe",
    phn: "C. Espina, RN",
  },
  {
    id: "brgy-mabolo",
    name: "Mabolo",
    population: 27650,
    bhc: "Guadalupe RHU",
    bhcId: "bhc-guadalupe",
    phn: "J. Densing, RN",
  },
  {
    id: "brgy-talamban",
    name: "Talamban",
    population: 45200,
    bhc: "Guadalupe RHU",
    bhcId: "bhc-guadalupe",
    phn: "M. Otadoy, RN",
  },
  {
    id: "brgy-labangon",
    name: "Labangon",
    population: 33600,
    bhc: "Labangon RHU",
    bhcId: "bhc-labangon",
    phn: "T. Camara, RN",
  },
  {
    id: "brgy-tisa",
    name: "Tisa",
    population: 19300,
    bhc: "Labangon RHU",
    bhcId: "bhc-labangon",
    phn: "P. Alcoseba, RN",
  },
  {
    id: "brgy-inayawan",
    name: "Inayawan",
    population: 16800,
    bhc: "Labangon RHU",
    bhcId: "bhc-labangon",
    phn: "G. Maceda, RN",
  },
  {
    id: "brgy-pardo",
    name: "Pardo",
    population: 29800,
    bhc: "Pardo District Health Center",
    bhcId: "bhc-pardo",
    phn: "L. Ybañez, RN",
  },
  {
    id: "brgy-bulacao",
    name: "Bulacao",
    population: 24100,
    bhc: "Pardo District Health Center",
    bhcId: "bhc-pardo",
    phn: "E. Quijano, RN",
  },
  {
    id: "brgy-basakpardo",
    name: "Basak Pardo",
    population: 26700,
    bhc: "Pardo District Health Center",
    bhcId: "bhc-pardo",
    phn: "S. Noval, RN",
  },
  {
    id: "brgy-sambag1",
    name: "Sambag I",
    population: 14200,
    bhc: "Sambag Health Center",
    bhcId: "bhc-sambag",
    phn: "D. Torrejos, RN",
  },
  {
    id: "brgy-sambag2",
    name: "Sambag II",
    population: 17600,
    bhc: "Sambag Health Center",
    bhcId: "bhc-sambag",
    phn: "F. Batiancila, RN",
  },
  {
    id: "brgy-cogonramos",
    name: "Cogon Ramos",
    population: 20500,
    bhc: "Sambag Health Center",
    bhcId: "bhc-sambag",
    phn: "V. Empuerto, RN",
  },
];

/** 5 unique BHC facility names (use this, not a per-barangay map, for BHC-level charts). */
export const BHC_LIST = BHC_FACILITIES.map((b) => b.name);

export const TOTAL_POPULATION = BARANGAYS.reduce((s, b) => s + b.population, 0);

export const months12 = [
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

export const epiWeeks = Array.from({ length: 12 }, (_, i) => `EW${20 + i}`);

/** Deterministic pseudo-random in [0,1) — avoids Math.random for SSR hydration safety. */
export function seeded(i: number, salt = 1): number {
  const x = Math.sin(i * 12.9898 * salt + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function seededRange(i: number, min: number, max: number, salt = 1): number {
  return min + seeded(i, salt) * (max - min);
}

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
  "Abella",
  "Yap",
  "Villareal",
  "Cortes",
  "Ebrada",
  "Nacario",
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

export function personName(i: number): string {
  return `${surnames[i % surnames.length]}, ${givenNames[i % givenNames.length]} ${String.fromCharCode(65 + (i % 26))}.`;
}

export function patientId(i: number): string {
  return `PT-2026-${(1000 + i * 11).toString()}`;
}
