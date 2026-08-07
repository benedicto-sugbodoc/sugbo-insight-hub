/**
 * Canonical Philippine-healthcare-context constants shared across the
 * hospital (Type A) mock data files. Centralizing these keeps every
 * dashboard, report and tool consistent: same 8 departments, same
 * 15-physician roster, same top-12 national morbidity ICD-10 list,
 * same payer-mix and PhilHealth-membership distribution assumptions.
 *
 * Sourced from the "MOCK DATA REQUIREMENTS" specification:
 *  - Diagnoses: Philippines top-10 morbidity/mortality ICD-10 codes
 *  - Payer mix: 55% PhilHealth | 20% HMO | 20% Private | 5% SC/PWD
 *  - SC/PWD share of patient population: 15%
 *  - PhilHealth membership: 40% Employed | 25% Indigent/4Ps |
 *    15% Self-earning | 10% Sponsored | 5% Lifetime | 5% OFW/other
 */

export interface IcdEntry {
  code: string;
  description: string;
}

/** Philippines top-10-style morbidity/mortality ICD-10 list (12 entries per spec). */
export const PH_TOP_DIAGNOSES: IcdEntry[] = [
  { code: "J18.9", description: "Pneumonia, unspecified organism" },
  { code: "I10", description: "Essential (primary) hypertension" },
  { code: "E11.9", description: "Type 2 diabetes mellitus, without complications" },
  { code: "A09", description: "Diarrhea and gastroenteritis of presumed infectious origin" },
  { code: "J00", description: "Acute nasopharyngitis (common cold)" },
  { code: "J06.9", description: "Acute upper respiratory infection, unspecified (AURI)" },
  { code: "K29.7", description: "Gastritis, unspecified" },
  { code: "M54.5", description: "Low back pain" },
  { code: "N39.0", description: "Urinary tract infection, site not specified" },
  { code: "O80", description: "Single spontaneous delivery (NSD)" },
  { code: "A15.0", description: "Tuberculosis of lung" },
  { code: "C50.9", description: "Malignant neoplasm of breast, unspecified" },
];

/** PhilHealth case rate (CR1+CR2), PHP, indexed to PH_TOP_DIAGNOSES order. */
export const PH_DIAGNOSIS_CASE_RATES: Record<string, number> = {
  "J18.9": 9_500,
  I10: 10_800,
  "E11.9": 11_600,
  A09: 9_800,
  J00: 9_500,
  "J06.9": 9_500,
  "K29.7": 10_200,
  "M54.5": 12_400,
  "N39.0": 10_600,
  O80: 19_000,
  "A15.0": 22_500,
  "C50.9": 34_000,
};

export const PH_DEPARTMENTS = [
  "Internal Medicine",
  "Surgery",
  "Obstetrics",
  "Pediatrics",
  "Orthopedics",
  "Cardiology",
  "Emergency Medicine",
  "Oncology",
] as const;

export type PhDepartment = (typeof PH_DEPARTMENTS)[number];

export const PH_DEPARTMENT_COLORS: Record<PhDepartment, string> = {
  "Internal Medicine": "#4454C3",
  Surgery: "#1A5CA8",
  Obstetrics: "#6B4C9A",
  Pediatrics: "#1A7A3C",
  Orthopedics: "#E67E22",
  Cardiology: "#C0392B",
  "Emergency Medicine": "#8B0000",
  Oncology: "#B7950B",
};

/** 15-physician roster shared across executive, clinical and claims dashboards. */
export const PH_PHYSICIANS = [
  "Dr. A. Villanueva",
  "Dr. M. Sarmiento",
  "Dr. J. Uy",
  "Dr. L. Cabrera",
  "Dr. R. Ocampo",
  "Dr. K. Mendoza",
  "Dr. F. Aguilar",
  "Dr. C. Ramos",
  "Dr. E. Villaraza",
  "Dr. F. Nazareno",
  "Dr. G. Suarez",
  "Dr. H. Tolentino",
  "Dr. I. Aquino",
  "Dr. J. Villamor",
  "Dr. R. Bacalso",
] as const;

/** Realistic Filipino surname / given-name pools for synthetic patient names. */
export const PH_SURNAMES = [
  "Reyes",
  "Dela Cruz",
  "Garcia",
  "Santos",
  "Bautista",
  "Mendoza",
  "Torres",
  "Ramos",
  "Flores",
  "Villanueva",
  "Castillo",
  "Aquino",
  "Fernandez",
  "Pascual",
  "Del Rosario",
  "Salazar",
  "Cruz",
  "Gonzales",
  "Rivera",
  "Manalo",
];
export const PH_FEMALE_NAMES = [
  "Maria",
  "Ana",
  "Liza",
  "Grace",
  "Divine",
  "Rosario",
  "Josephine",
  "Cristina",
  "Angelica",
  "Precious",
];
export const PH_MALE_NAMES = [
  "Juan",
  "Paolo",
  "Carlo",
  "Noel",
  "Ricky",
  "Mark Anthony",
  "Jose",
  "Ramon",
  "Ferdinand",
  "Michael",
];

export function phPatientName(i: number, gender: "male" | "female"): string {
  const surname = PH_SURNAMES[i % PH_SURNAMES.length]!;
  const pool = gender === "female" ? PH_FEMALE_NAMES : PH_MALE_NAMES;
  const given = pool[i % pool.length]!;
  return `${surname}, ${given} ${String.fromCharCode(65 + (i % 26))}.`;
}

/** Payer mix — 55% PhilHealth | 20% HMO | 20% Private | 5% SC/PWD, with a small
 *  residual left for GSIS/Other and Write-offs so those line items (used
 *  elsewhere in AR aging / claims dashboards) stay meaningful. */
export const PH_PAYER_MIX = {
  philhealth: 0.55,
  hmo: 0.2,
  privatePay: 0.17,
  scpwd: 0.05,
  gsis: 0.02,
  writeoff: 0.01,
} as const;

/** SC/PWD share of the overall patient population. */
export const PH_SCPWD_PATIENT_RATE = 0.15;

/** PhilHealth membership category distribution (of enrolled/covered patients). */
export const PH_MEMBERSHIP_DISTRIBUTION = [
  { category: "Employed", share: 0.4, color: "#1A5CA8" },
  { category: "Indigent/4Ps", share: 0.25, color: "#1A7A3C" },
  { category: "Self-Earning", share: 0.15, color: "#4454C3" },
  { category: "Sponsored", share: 0.1, color: "#E67E22" },
  { category: "Lifetime", share: 0.05, color: "#B7950B" },
  { category: "OFW/Other", share: 0.05, color: "#6B4C9A" },
] as const;

/** Standard flat Konsulta eKAS package rate, PHP. */
export const KONSULTA_EKAS_RATE = 1_500;

/** Realistic inpatient gross charge range, PHP. */
export const INPATIENT_GROSS_CHARGE_RANGE: [number, number] = [25_000, 85_000];

/** Target monthly hospital admission volume for a Level 3 facility. */
export const TARGET_ADMISSIONS_PER_MONTH = 300;
