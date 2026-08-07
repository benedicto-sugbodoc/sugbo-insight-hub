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
  bhc: string;
  phn: string;
}

export const BARANGAYS: Barangay[] = [
  {
    id: "brgy-lahug",
    name: "Lahug",
    population: 22400,
    bhc: "Lahug Health Center",
    phn: "N. Villaraza, RN",
  },
  {
    id: "brgy-guadalupe",
    name: "Guadalupe",
    population: 31800,
    bhc: "Guadalupe RHU",
    phn: "C. Espina, RN",
  },
  {
    id: "brgy-mabolo",
    name: "Mabolo",
    population: 27650,
    bhc: "Mabolo Health Center",
    phn: "J. Densing, RN",
  },
  {
    id: "brgy-talamban",
    name: "Talamban",
    population: 45200,
    bhc: "Talamban RHU",
    phn: "M. Otadoy, RN",
  },
  {
    id: "brgy-banilad",
    name: "Banilad",
    population: 18900,
    bhc: "Banilad Health Center",
    phn: "R. Suarez, RN",
  },
  {
    id: "brgy-capsite",
    name: "Capitol Site",
    population: 15200,
    bhc: "Capitol Site Health Center",
    phn: "A. Rosales, RN",
  },
  {
    id: "brgy-labangon",
    name: "Labangon",
    population: 33600,
    bhc: "Labangon RHU",
    phn: "T. Camara, RN",
  },
  {
    id: "brgy-pardo",
    name: "Pardo",
    population: 29800,
    bhc: "Pardo District Health Center",
    phn: "L. Ybañez, RN",
  },
  {
    id: "brgy-bulacao",
    name: "Bulacao",
    population: 24100,
    bhc: "Bulacao Health Center",
    phn: "E. Quijano, RN",
  },
  {
    id: "brgy-basakpardo",
    name: "Basak Pardo",
    population: 26700,
    bhc: "Basak Pardo Health Center",
    phn: "S. Noval, RN",
  },
  {
    id: "brgy-tisa",
    name: "Tisa",
    population: 19300,
    bhc: "Tisa Health Center",
    phn: "P. Alcoseba, RN",
  },
  {
    id: "brgy-inayawan",
    name: "Inayawan",
    population: 16800,
    bhc: "Inayawan Health Center",
    phn: "G. Maceda, RN",
  },
  {
    id: "brgy-sambag1",
    name: "Sambag I",
    population: 14200,
    bhc: "Sambag I Health Center",
    phn: "D. Torrejos, RN",
  },
  {
    id: "brgy-sambag2",
    name: "Sambag II",
    population: 17600,
    bhc: "Sambag II Health Center",
    phn: "F. Batiancila, RN",
  },
  {
    id: "brgy-cogonramos",
    name: "Cogon Ramos",
    population: 20500,
    bhc: "Cogon Ramos Health Center",
    phn: "V. Empuerto, RN",
  },
];

export const BHC_LIST = BARANGAYS.map((b) => b.bhc);

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
