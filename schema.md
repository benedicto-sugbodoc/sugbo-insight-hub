# SugboDoc Data Schema Reference

SugboDoc has no real database. Every dashboard, report and analytics tool in the
prototype is fed by deterministic (seeded, non-`Math.random`) TypeScript data
modules. This document is the schema reference for those modules.

There are currently **two** data models in the repository:

| | Model | Location | Status |
|---|---|---|---|
| **1** | **Shared synthetic hospital dataset** | `src/lib/data/hospital/**` | **Current source of truth.** One relational dataset; every chart derives its numbers from it through the query layer, so figures reconcile across pages. |
| **2** | Per-file independent mock data | `src/lib/analytics/**`, `src/lib/reports/**` | **Legacy — pending migration.** Still physically present and still powering most existing routes. Each file generates its own synthetic numbers in isolation, which is why (for example) two different payer-mix charts could historically show different totals. |

Model 1 exists because of exactly that reconciliation problem. It is the
evolution of `src/lib/analytics/ph-constants.ts`, not a competitor to it: the
canonical departments, physician roster, ICD-10 morbidity list, PhilHealth case
rates, payer mix, membership distribution, department colours and patient-name
generator are all **imported** from `ph-constants.ts` rather than redeclared.

Model 2 is documented in condensed form in
[Legacy Mock Data (Pending Migration)](#legacy-mock-data-pending-migration). Its
tables have **not** been deleted and are **not** deprecated at runtime — they are
simply no longer the reference schema for new work.

Documentation conventions used throughout: every attribute name and type below
was read directly from the source file cited in that table's **Source** line.
Where something is a modelling simplification rather than a fact about real
Philippine hospital data, it is called out in **Notes** and repeated in
[Data Generation Assumptions](#data-generation-assumptions).

---

# Part 1 — Shared Synthetic Hospital Dataset

## Module map — `src/lib/data/hospital/`

| File | Responsibility |
|---|---|
| `entities.ts` | All table interfaces and enumeration types. No logic. |
| `reference.ts` | Every calibration constant and weighting table (the tuning knobs). |
| `random.ts` | Seeded pseudo-random helpers (`seeded`, `seededRange`, `seededInt`, `weightedIndex`, `seededNormal`, `cumulativeIndex`, …). No `Math.random` anywhere. |
| `time.ts` | UTC-only date helpers (`parseDate`, `toDate`, `toDateTime`, `ageOn`, `ageBand`, `daysBetween`, `monthKeyOf`, `monthLabel`). |
| `generate.ts` | `generateHospitalDataset()` — builds every table in dependency order. |
| `derive.ts` | The query/aggregation layer charts call (`revenueByDepartment`, `claimsByStatus`, …). |
| `index.ts` | Public entry point: `getHospitalDataset()` (memoized lazy singleton), `fetchHospitalDataset()`, `resetHospitalDataset()`, plus re-exports of every type, constant and query helper. |

Consumption pattern:

```ts
import { getHospitalDataset, revenueByDepartment } from "@/lib/data/hospital";

const dataset = getHospitalDataset();          // built once, then memoized
const rows = revenueByDepartment(dataset, { from: "2026-01-01" });
```

`getHospitalDataset()` follows the repo's existing `getXData()` convention (see
`src/lib/analytics/executive.mock.ts`), with the addition of a module-level
`cached` singleton because this dataset is shared by every page rather than
owned by one dashboard.

## Row counts as generated

| Table | Rows | Notes |
|---|---|---|
| `Department` | 8 | One per `PH_DEPARTMENTS` entry. |
| `Doctor` | 20 | 15 from `PH_PHYSICIANS` + 5 generated. |
| `ServiceCatalogItem` | 58 | 8 Consultation, 12 Laboratory, 7 Imaging, 12 Surgery, 6 Room & Board, 8 Pharmacy, 5 Emergency Care. |
| `Patient` | 800 | |
| `Encounter` | 1,802 | Target 1,800; ±2 from per-department rounding. |
| `EncounterService` | 6,168 | 1–6 lines per encounter, mean 3.42. |
| `Billing` | 1,802 | Strictly 1:1 with `Encounter`. |
| `PhilHealthClaim` | 1,101 | 61.1% of encounters (target band 55–65%). |
| `PWDDiscount` | 105 | Only for the 46 PWD patients' qualifying bills. |
| `Feedback` | 634 | 35.2% of encounters. |
| `MonthMeta` | 12 | 2025-09 … 2026-08 (last bucket is month-to-date). |

---

## Table: Department

**Description:** One clinical department. A dimension table with exactly 8 rows, one per entry in `PH_DEPARTMENTS`.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| id | string | PK | `"DEP-01"` … `"DEP-08"`, positionally aligned to `PH_DEPARTMENTS`. |
| name | `PhDepartment` | UQ | Department name, imported literal union from `ph-constants.ts`. |
| category | `"Medical" \| "Surgical" \| "Diagnostic" \| "Emergency"` | — | Service-line grouping. |
| bedCapacity | number | — | Staffed inpatient beds (25–90). |
| baseVolumeWeight | number | — | Relative multiplier used to allocate monthly encounter volume across departments (0.5–1.9). |
| baseRevenueIndex | number | — | Relative revenue-per-case multiplier applied to service unit prices (0.6–2.2). |

### Relationships
- `Doctor.primaryDepartmentId` -> `Department.id` (many-to-one).
- `ServiceCatalogItem.departmentId` -> `Department.id` (many-to-one).
- `Encounter.departmentId` -> `Department.id` (many-to-one). **This is the field all revenue/volume attribution uses.**
- `Feedback.departmentId` -> `Department.id`, denormalized from the encounter.
- `name` is the key into `PH_DEPARTMENT_COLORS` (`ph-constants.ts`), which is how the derivation layer supplies chart colours.

### Source
`src/lib/data/hospital/generate.ts`, `buildDepartments()`. Values come from `DEPARTMENT_PROFILES` in `src/lib/data/hospital/reference.ts`.

### Notes
- The `"Diagnostic"` category is declared in the union but **no current row uses it** — none of the 8 canonical `PH_DEPARTMENTS` is a diagnostic service line. It is retained for a future lab/imaging department without a breaking type change.
- `bedCapacity` is a realistic Level 3 facility attribute and is deliberately **not** used as an occupancy denominator; see the note on `volumeByDepartment` in [Derivation layer](#derivation-layer--derivets).
- `DEPARTMENT_PROFILES` also carries `baseLosDays` and `npsBaseline`, which shape encounters and feedback but are not surfaced as `Department` columns.

## Table: Doctor

**Description:** One attending physician. Dimension table, 20 rows.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| id | string | PK | `"DOC-01"` … `"DOC-20"`. |
| name | string | — | `"Dr. A. Villanueva"` style. First 15 are `PH_PHYSICIANS` verbatim. |
| primaryDepartmentId | string | FK -> Department.id | The department this physician is assigned to. |
| yearsExperience | number | — | Drawn 3–34; 6–33 observed. |
| monthlyCaseCapacity | number | — | Soft monthly panel size (33–79 observed); rises with `yearsExperience`. Used only by `doctorProductivity()`. |

### Relationships
- `Encounter.primaryDoctorId` -> `Doctor.id`. Every encounter's doctor is always drawn from that encounter's own department, so `Encounter.departmentId === Doctor.primaryDepartmentId` holds for all rows.

### Source
`src/lib/data/hospital/generate.ts`, `buildDoctors()` / `buildDoctorNames()` / `allocateDoctorsPerDepartment()`.

### Notes
- The 5 extra doctors beyond `PH_PHYSICIANS` are built from `PH_SURNAMES` entries the canonical roster does not already use, so no name pool is duplicated or invented.
- Doctors are allocated one-per-department first, then the remaining 12 by `baseVolumeWeight` (largest-remainder method). Result: Internal Medicine 4, Emergency Medicine 3, Pediatrics 3, Surgery 2, Obstetrics 2, Orthopedics 2, Cardiology 2, Oncology 2.

## Table: ServiceCatalogItem

**Description:** One billable line in the chargemaster. Dimension table, 58 rows. (The conceptual entity is "ServiceCatalog"; the TypeScript interface is named `ServiceCatalogItem` because the dataset field holding them is `services`.)

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| id | string | PK | `"SVC-001"` … `"SVC-058"`. |
| name | string | — | e.g. `"Complete Blood Count"`, `"Cesarean Section"`. |
| category | `"Consultation" \| "Laboratory" \| "Imaging" \| "Surgery" \| "Room & Board" \| "Pharmacy" \| "Emergency Care"` | — | Charge category. |
| departmentId | string | FK -> Department.id | Owning cost-centre department. |
| basePriceMin | number | — | Lower bound of the catalogue price band, PHP. |
| basePriceMax | number | — | Upper bound of the catalogue price band, PHP. |
| philhealthCaseRateEligible | boolean | — | Whether the line sits inside a PhilHealth case-rate bundle. |

Price bands by category (PHP, from `SERVICE_PRICE_RANGES`):

| Category | min | max |
|---|---|---|
| Consultation | 350 | 900 |
| Pharmacy | 120 | 4,500 |
| Laboratory | 250 | 2,500 |
| Emergency Care | 900 | 8,000 |
| Room & Board (per day) | 1,200 | 6,500 |
| Imaging | 900 | 12,000 |
| Surgery | 18,000 | 160,000 |

### Relationships
- `EncounterService.serviceId` -> `ServiceCatalogItem.id`.
- `category` drives PWD-discount eligibility via `PWD_QUALIFYING_CATEGORIES`.

### Source
`src/lib/data/hospital/generate.ts`, `buildServices()`. Names/categories from `SERVICE_SEEDS`, prices from `SERVICE_PRICE_RANGES`, both in `reference.ts`.

### Notes
- **Simplification:** ancillary categories (Laboratory, Imaging, Pharmacy, Room & Board) have no single clinical owner, so all 33 of them are parked on the Internal Medicine department id as a shared cost centre. This field is only used for service-mix plausibility. **Revenue is never attributed through `ServiceCatalogItem.departmentId`** — every revenue helper attributes through `Encounter.departmentId`.
- `philhealthCaseRateEligible` is `false` for all Consultation rows (professional fees are billed outside the case-rate bundle), `true` for Laboratory / Imaging / Surgery / Room & Board / Emergency Care, and seeded against a 0.6 threshold for Pharmacy rows (formulary vs. non-formulary drugs), which lands at 4 of 8 in practice.

## Table: Patient

**Description:** One registered patient. Dimension table, 800 rows.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| id | string | PK | `"PT-0001"` … `"PT-0800"`. |
| name | string | — | From `phPatientName(i, gender)` in `ph-constants.ts` (gender-aware). |
| gender | `"male" \| "female"` | — | 52% female. |
| birthDate | string (`"YYYY-MM-DD"`) | — | Derived from a banded age draw against the dataset anchor date. |
| isPWD | boolean | — | Person-with-disability flag; ~6% true. |
| philhealthCategory | `"Employed" \| "Indigent/4Ps" \| "Self-Earning" \| "Sponsored" \| "Lifetime" \| "OFW/Other" \| "Senior Citizen" \| "Non-Member/Self-Pay"` | — | PhilHealth classification. |
| registrationDate | string (`"YYYY-MM-DD"`) | — | Always on or before the patient's earliest encounter date. |

### Relationships
- `Encounter.patientId` -> `Patient.id`.
- `Feedback.patientId` -> `Patient.id`, denormalized from the encounter.
- `philhealthCategory` and `isPWD` jointly drive `Encounter.payerType` (see `PAYER_CATEGORY_MULTIPLIER`).
- `isPWD` gates `Billing.pwdDiscountAmount` and the entire `PWDDiscount` table.

### Source
`src/lib/data/hospital/generate.ts`, `buildPatients()`; registration reconciled by `reconcileRegistrationDates()`.

### Notes
- The first six category values are taken **verbatim** from `PH_MEMBERSHIP_DISTRIBUTION` in `ph-constants.ts` (they are that file's real names, which differ from the wording used in earlier planning docs). Two values are **added**: `"Senior Citizen"` and `"Non-Member/Self-Pay"`, because `PH_MEMBERSHIP_DISTRIBUTION` describes only *enrolled members* and therefore cannot express either concept.
- **Invariant:** `"Senior Citizen"` and `"Lifetime"` are only ever assigned to patients whose derived age at the anchor date is >= 60. Verified: 0 violations.
- **Invariant:** `registrationDate <= min(admitDate)` for every patient with encounters. Verified: 0 violations.

## Table: Encounter

**Description:** One patient visit or admission. The grain of the entire fact model. 1,802 rows across a 12-month window ending on the anchor date.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| id | string | PK | `"ENC-00001"` … `"ENC-01802"`, numbered in chronological admit order. |
| patientId | string | FK -> Patient.id | |
| departmentId | string | FK -> Department.id | |
| primaryDoctorId | string | FK -> Doctor.id | Always a doctor of `departmentId`. |
| encounterType | `"Inpatient" \| "Outpatient" \| "Emergency" \| "Day Surgery"` | — | |
| admissionType | `"Emergency" \| "Elective" \| "Transfer-in" \| "Newborn" \| null` | — | Non-null **iff** `encounterType === "Inpatient"`. |
| admitDateTime | string (ISO-8601 UTC) | — | Full timestamp; hour/weekday carry real signal. |
| dischargeDateTime | string (ISO-8601 UTC) \| null | — | `null` for encounters still admitted at the anchor date (9 rows). |
| losDays | number | — | Whole days admit -> discharge. For still-admitted rows it is the **running** LOS to the anchor date. 0 for same-day encounters. |
| diagnosisCode | string \| null | FK -> `PH_TOP_DIAGNOSES[].code` | `null` for 3.1% of rows (incomplete coding). |
| disposition | `"Recovered" \| "Improved" \| "Transferred" \| "HAMA" \| "Expired"` | — | |
| readmitted30d | boolean | — | **Computed** from the patient's real prior encounter history, not rolled. |
| payerType | `"philhealth" \| "hmo" \| "privatePay" \| "scpwd" \| "gsis" \| "writeoff"` | — | `keyof typeof PH_PAYER_MIX`. |

### Relationships
- 1:1 with `Billing` (`Billing.encounterId`).
- 1:N with `EncounterService`.
- 0..1 with `PhilHealthClaim` — exists only when `payerType ∈ {philhealth, scpwd}`.
- 0..1 with `PWDDiscount` — exists only when the patient `isPWD` and there is a qualifying amount.
- 0..1 with `Feedback`.
- `diagnosisCode` is also the key into `PH_DIAGNOSIS_CASE_RATES` for the PhilHealth deduction and claim case rate.

### Source
`src/lib/data/hospital/generate.ts`, `buildEncounters()`; readmission flags by `applyReadmissionFlags()`.

### Notes
- **Readmission derivation:** an Inpatient or Emergency encounter is flagged when the *same patient* has a prior **Inpatient** encounter with a non-null discharge falling within the preceding 30 days. Only the most recent prior inpatient stay is considered. Observed rate: 107 / 989 eligible = 10.8%.
- **Still-admitted rows** keep a `disposition` value; for those 9 rows it reads as current clinical status rather than a final discharge disposition. Helpers that need true discharge outcomes filter on `dischargeDateTime !== null`.
- Encounters admitted late on the anchor date may have a discharge timestamp a few hours past it; this is intentional and does not affect month bucketing (which uses `admitDateTime`).

## Table: EncounterService

**Description:** One charge line on an encounter. 6,168 rows; 1–6 lines per encounter (mean 3.42, min 1, max 6, zero encounters with no lines).

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| id | string | PK | `"ES-000001"` … |
| encounterId | string | FK -> Encounter.id | |
| serviceId | string | FK -> ServiceCatalogItem.id | |
| quantity | number | — | Room & Board = length of stay; Consultation = `ceil(los/2)` capped at 6; Pharmacy 1–4; everything else 1. |
| unitPrice | number | — | PHP, whole pesos. |
| lineTotal | number | — | `round2(unitPrice * quantity)`. |

### Relationships
- `SUM(lineTotal)` per encounter is **exactly** `Billing.grossCharges`. Verified: dataset-wide totals reconcile to the peso across `encounterServices`, `billings`, `revenueByDepartment()`, `revenueByMonth()` and `payerMix()` (all 68,768,179).

### Source
`src/lib/data/hospital/generate.ts`, `buildEncounterServices()`.

### Notes
- Service selection is constrained by encounter type: **Outpatient encounters never receive a Surgery-category line**; Inpatient encounters always start with a Room & Board line; Emergency encounters always start with an Emergency Care line; Day Surgery always carries a Surgery line.
- Ancillary picks are diagnosis-aware — e.g. Sputum GeneXpert is heavily weighted only for `A15.0`, Mammography only for female patients with `C50.9` or in Oncology, 2D Echo for Cardiology, MRI Lumbar for Orthopedics/`M54.5`, Insulin Pack for `E11.9`, Anesthesia Drugs only when a Surgery line exists.
- `unitPrice` is a seeded draw inside the catalogue band, biased upward by the encounter department's `baseRevenueIndex`, then multiplied by a per-case variance of 0.94–1.06 so no two identical services bill identically.

## Table: Billing

**Description:** One bill. Exactly 1:1 with `Encounter`; 1,802 rows.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| id | string | PK | `"BIL-00001"` … |
| encounterId | string | FK -> Encounter.id, UQ | |
| grossCharges | number | — | Sum of that encounter's `EncounterService.lineTotal`. |
| philhealthDeduction | number | — | Case-rate/package benefit applied. 0 when the payer carries no PhilHealth benefit. |
| pwdDiscountAmount | number | — | **Always 0 unless the encounter's patient has `isPWD === true`.** |
| netPayable | number | — | `max(0, grossCharges - philhealthDeduction - pwdDiscountAmount)`. |
| amountPaid | number | — | |
| balance | number | — | `netPayable - amountPaid`, for every status including `Write-off`. |
| paymentStatus | `"Paid" \| "Partial" \| "Pending" \| "Overdue" \| "Write-off"` | — | |
| paymentDate | string (`"YYYY-MM-DD"`) \| null | — | `null` whenever `amountPaid === 0`, plus ~4% missingness on Partial bills. |
| payerType | `PayerType` | — | Mirrors `Encounter.payerType` exactly. |

### Relationships
- `PhilHealthClaim.billingId` -> `Billing.id`.
- `PWDDiscount.billingId` -> `Billing.id`.

### Source
`src/lib/data/hospital/generate.ts`, `buildBillings()` (which also emits `PWDDiscount` rows so the two can never disagree).

### Notes
- **Invariant (the supervisor's explicit example):** `pwdDiscountAmount > 0` implies `patient.isPWD === true`. Verified: 0 violations across 1,802 bills and 105 discount rows.
- `philhealthDeduction` logic: Outpatient uses the flat `KONSULTA_EKAS_RATE` (1,500) capped at 90% of gross; Inpatient and Day Surgery use the full `PH_DIAGNOSIS_CASE_RATES[diagnosisCode]`; Emergency uses 60% of it. When `diagnosisCode` is `null` the deduction is **0** — a real downstream consequence of the incomplete-coding rate, not a separate roll.
- Observed status mix: Paid 1,375 / Partial 177 / Pending 105 / Overdue 124 / Write-off 21.
- `balance` is retained for `Write-off` rows so AR-exposure charts can still show written-off value.

## Table: PhilHealthClaim

**Description:** One PhilHealth claim. Generated **only** for encounters whose `payerType` carries a PhilHealth benefit (`philhealth` or `scpwd`). 1,101 rows = 61.1% of encounters.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| id | string | PK | `"CLM-00001"` … |
| encounterId | string | FK -> Encounter.id | |
| billingId | string | FK -> Billing.id | |
| caseType | `"Medical Case" \| "Surgical Case" \| "Maternity Package" \| "Konsulta Package" \| "Catastrophic (Z-Benefit)"` | — | Derived from encounter type, department, diagnosis and whether a Surgery line exists. |
| caseRateAmount | number | — | `PH_DIAGNOSIS_CASE_RATES[diagnosisCode]`, or `KONSULTA_EKAS_RATE` for Konsulta packages, or 0 when the diagnosis is uncoded. |
| cr1Amount | number | — | Facility component, 70% of `caseRateAmount`. |
| cr2Amount | number | — | Professional-fee component, the remaining 30%. |
| patientShare | number | — | Equals the linked `Billing.netPayable`. |
| submissionDate | string (`"YYYY-MM-DD"`) | — | Discharge + 2–25 days, clamped to the anchor date. For `Drafted` claims this is the preparation date, not a filing date. |
| status | `"Drafted" \| "Submitted" \| "Under Review" \| "Approved" \| "Denied" \| "Remitted"` | — | |
| denialCode | string \| null | — | Non-null **iff** `status === "Denied"`. Values `"DN-01"`…`"DN-07"`. |
| remittanceDate | string (`"YYYY-MM-DD"`) \| null | — | Non-null **iff** `status === "Remitted"`. |
| remittanceAmount | number \| null | — | Non-null **iff** `status === "Remitted"`; 85–100% of `caseRateAmount`. |
| appealFiledDate | string (`"YYYY-MM-DD"`) \| null | — | Non-null only for appealed denials (~55% of denials). |
| appealStatus | `"Filed" \| "Under Appeal" \| "Won" \| "Lost" \| null` | — | Non-null only when `status === "Denied"`. |
| amountRecovered | number \| null | — | Non-null **iff** `appealStatus === "Won"`; 60–100% of `caseRateAmount`. |

Denial code dictionary (`CLAIM_DENIAL_REASONS` in `reference.ts`):

| Code | Reason |
|---|---|
| DN-01 | Incomplete Claim Signature Form (CSF) |
| DN-02 | Member eligibility / missing PhilHealth ID |
| DN-03 | Late filing beyond the 60-day window |
| DN-04 | Non-compensable condition for the case rate claimed |
| DN-05 | Duplicate claim already on file |
| DN-06 | Missing laboratory / imaging attachment |
| DN-07 | Attending physician accreditation lapsed |

### Relationships
- Strictly 0..1 per encounter, and only ever for a PhilHealth-bearing encounter. Verified: 0 claims reference a self-pay / HMO-only / GSIS encounter.

### Source
`src/lib/data/hospital/generate.ts`, `buildClaims()`.

### Notes
- **Invariants verified (0 violations each):** `denialCode !== null` iff Denied; `remittanceDate !== null` iff Remitted; `appealStatus !== null` only when Denied; `amountRecovered !== null` only when `appealStatus === "Won"`.
- Encounters with a `null` `diagnosisCode` produce a claim stuck in `"Drafted"` with `caseRateAmount === 0` — the claim exists but cannot be filed. 25 such rows.
- Observed status mix: Drafted 25 / Submitted 124 / Under Review 89 / Approved 238 / Denied 101 / Remitted 524.

## Table: PWDDiscount

**Description:** One applied PWD discount. Generated **only** where `patient.isPWD === true` and the bill has a qualifying amount. 105 rows across 46 PWD patients.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| id | string | PK | `"PWD-0001"` … |
| encounterId | string | FK -> Encounter.id | |
| billingId | string | FK -> Billing.id | |
| qualifyingAmount | number | — | Sum of `lineTotal` on discount-qualifying service categories. |
| discountRate | number | — | Constant `0.20` (RA 10754). |
| discountAmount | number | — | `round2(qualifyingAmount * 0.20)`. Always equals `Billing.pwdDiscountAmount`. |
| vatExemptAmount | number | — | VAT component backed out of the qualifying amount: `qualifyingAmount * 0.12 / 1.12`. |

### Relationships
- `discountAmount` is computed in the same pass as `Billing.pwdDiscountAmount`, from the same `qualifyingAmount`, so the two tables can never disagree.

### Source
`src/lib/data/hospital/generate.ts`, `buildBillings()`.

### Notes
- **Simplification:** qualifying categories are Consultation, Laboratory, Imaging, Surgery, Pharmacy and Emergency Care. **Room & Board (accommodation) is excluded.** Real RA 10754 rules are more nuanced per item; this is a deliberate, documented simplification so "not every line item qualifies" is genuinely true in the data.

## Table: Feedback

**Description:** One post-discharge experience survey response. 634 rows = 35.2% of encounters. Only generated for discharged encounters.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| id | string | PK | `"FB-00001"` … |
| encounterId | string | FK -> Encounter.id | |
| patientId | string | FK -> Patient.id | Denormalized from the encounter. |
| departmentId | string | FK -> Department.id | Denormalized from the encounter. |
| npsScore | number | — | Integer 0–10. |
| csatScore | number | — | Integer 1–5, correlated with `npsScore`. |
| category | `"Wait Time" \| "Staff Attitude" \| "Cleanliness" \| "Billing Clarity" \| "Communication" \| "Facilities" \| "Other"` | — | Theme of the response. |
| comment | string \| null | — | `null` for ~57% of rows (score-only submissions). |
| submittedDate | string (`"YYYY-MM-DD"`) | — | Discharge + 0–14 days, clamped to the anchor date. |

### Relationships
- Reads `Encounter.disposition`, `Encounter.losDays`, `Encounter.readmitted30d`, `Billing.paymentStatus` and `PhilHealthClaim.status` to adjust the score. This is the "related variables move together" requirement: satisfaction is a function of operational reality already encoded elsewhere, not an independent roll.

### Source
`src/lib/data/hospital/generate.ts`, `buildFeedback()`.

### Notes
- Departmental NPS is genuinely differentiated, not uniform. Observed: Pediatrics +38, Oncology +26, Cardiology +17, Obstetrics +12, Surgery 0, Internal Medicine −14, Orthopedics −19, Emergency Medicine −69.
- Category weighting is sentiment-dependent (detractors skew "Wait Time" / "Billing Clarity"; promoters skew "Staff Attitude" / "Communication"), and Emergency Medicine gets a 2.2x boost on "Wait Time".

## Table: MonthMeta

**Description:** One bucket in the 12-month reporting window. Not a fact table — a calendar helper carried on the dataset so charts do not each re-derive the month axis.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| key | string | PK | `"YYYY-MM"`, sort-safe. |
| label | string | — | Chart label, e.g. `"Mar 26"`. |
| startDate | string (`"YYYY-MM-DD"`) | — | First day of the month. |
| endDate | string (`"YYYY-MM-DD"`) | — | Last **observed** day (the anchor date for the final month). |
| daysInMonth | number | — | Calendar length. |
| daysObserved | number | — | Days actually inside the window. |
| isPartial | boolean | — | `true` only for the final, month-to-date bucket. |

### Source
`src/lib/data/hospital/generate.ts`, `buildMonths()`.

### Notes
- Window is 2025-09 through 2026-08, with 2026-08 partial (11 of 31 days). Monthly volume charts should surface `isPartial` rather than reading the final bucket's dip as a trend. `MonthlyDepartmentVolumeRow` and `MonthlyRevenueRow` both carry the flag through.

## Type: HospitalDatasetIndex

**Description:** Not a table — a bundle of `ReadonlyMap` lookups built once alongside the dataset so the derivation layer never does linear scans for joins.

| Attribute | Data Type |
|---|---|
| departmentById | `ReadonlyMap<string, Department>` |
| doctorById | `ReadonlyMap<string, Doctor>` |
| serviceById | `ReadonlyMap<string, ServiceCatalogItem>` |
| patientById | `ReadonlyMap<string, Patient>` |
| encounterById | `ReadonlyMap<string, Encounter>` |
| billingByEncounterId | `ReadonlyMap<string, Billing>` |
| servicesByEncounterId | `ReadonlyMap<string, EncounterService[]>` |
| claimByEncounterId | `ReadonlyMap<string, PhilHealthClaim>` |
| pwdDiscountByEncounterId | `ReadonlyMap<string, PWDDiscount>` |
| feedbackByEncounterId | `ReadonlyMap<string, Feedback>` |
| encountersByPatientId | `ReadonlyMap<string, Encounter[]>` |

### Source
`src/lib/data/hospital/generate.ts`, `buildIndex()`. Exposed as `HospitalDataset.index`.

## Type: HospitalDataset

**Description:** The container returned by `getHospitalDataset()`.

| Attribute | Data Type | Description |
|---|---|---|
| anchorDate | string | `"2026-08-11"`. |
| months | `MonthMeta[]` | 12 rows, oldest first. |
| departments | `Department[]` | |
| doctors | `Doctor[]` | |
| services | `ServiceCatalogItem[]` | |
| patients | `Patient[]` | |
| encounters | `Encounter[]` | Sorted by `admitDateTime`. |
| encounterServices | `EncounterService[]` | |
| billings | `Billing[]` | |
| claims | `PhilHealthClaim[]` | |
| pwdDiscounts | `PWDDiscount[]` | |
| feedback | `Feedback[]` | |
| index | `HospitalDatasetIndex` | |

### Source
`src/lib/data/hospital/entities.ts` (type), `src/lib/data/hospital/generate.ts` (construction), `src/lib/data/hospital/index.ts` (memoized accessor).

---

## Derivation layer — `derive.ts`

Every helper is a pure `(dataset, filter?) => Row[]` function. `EncounterFilter`
is `{ from?, to?, departmentIds?, encounterTypes?, payerTypes?, doctorIds? }`,
all optional; `from`/`to` are inclusive `"YYYY-MM-DD"` bounds compared against
`Encounter.admitDateTime`.

| Helper | Returns | Purpose |
|---|---|---|
| `filterEncounters` | `Encounter[]` | The shared filter primitive every other helper calls. |
| `volumeByDepartment` | `DepartmentVolumeRow[]` | Encounter counts split by type, plus `bedDaysUsed` / `avgDailyCensus`. |
| `volumeByDepartmentAndMonth` | `MonthlyDepartmentVolumeRow[]` | Monthly volume trend by department, with `isPartial`. |
| `volumeByEncounterType` | `EncounterTypeRow[]` | Inpatient / Outpatient / Emergency / Day Surgery mix and shares. |
| `volumeByWeekdayHour` | `WeekdayHourCell[]` | 7x24 = 168 arrival-heatmap cells. |
| `revenueByDepartment` | `DepartmentRevenueRow[]` | Gross -> deductions -> net -> collected -> balance, plus revenue per encounter. |
| `revenueByMonth` | `MonthlyRevenueRow[]` | Same measures on the month axis (waterfall/trend input). |
| `payerMix` | `PayerMixRow[]` | **The** payer-mix aggregation. Every payer chart must read this. |
| `arAgingByPayer` | `ArAgingRow[]` | Outstanding balance in current / 31-60 / 61-90 / 90+ buckets, per payer. |
| `paymentStatusBreakdown` | `PaymentStatusRow[]` | Bill counts and money by payment status. |
| `claimsByStatus` | `ClaimStatusRow[]` | Claim pipeline funnel/donut input. |
| `claimDenialReasons` | `DenialReasonRow[]` | Denials by code with value at risk, appeals filed and amount recovered. |
| `claimTurnaroundByDepartment` | `ClaimTurnaroundRow[]` | Submission-to-remittance days and denial rate, per department. |
| `pwdDiscountByDepartment` | `PwdDiscountRow[]` | PWD uptake, qualifying amount, discount and VAT-exempt value. |
| `npsByDepartment` | `NpsRow[]` | Promoters/passives/detractors, NPS (−100..100), mean NPS score and CSAT. |
| `feedbackByCategory` | `FeedbackCategoryRow[]` | Themes with mean scores and comment-completion rate. |
| `readmissionRateByPayerAndDepartment` | `ReadmissionRow[]` | 30-day readmission rate crossed by payer x department. |
| `topDiagnoses` | `DiagnosisRow[]` | Volume, inpatient mean LOS, canonical case rate, gross charges, readmission rate. |
| `losStatsByDepartment` | `LosStatsRow[]` | Mean/median/p90/max LOS, outlier count, still-admitted count. |
| `doctorProductivity` | `DoctorProductivityRow[]` | Per-physician volume, revenue, mean LOS, capacity utilization. |
| `patientAgeMix` | `AgeMixRow[]` | Population pyramid by 7 age bands x gender. |
| `datasetSummary` | `DatasetSummary` | Row counts for every table (smoke-test / docs helper). |

### Note on occupancy
`volumeByDepartment` deliberately returns `bedDaysUsed` and `avgDailyCensus`
rather than an occupancy percentage. The encounter table is a ~1,800-row
synthetic extract, one to two orders of magnitude smaller than the annual
throughput implied by a real Level 3 `bedCapacity`, so `bedDays / (beds x days)`
would read as a nonsensical 1–3%. Charts needing an occupancy story should
compare departments against each other on `avgDailyCensus`.

---

# Data Generation Assumptions

Everything in this section is a modelling choice, not observed data. All
constants named here live in `src/lib/data/hospital/reference.ts`.

## Determinism and SSR safety

- **No `Math.random` anywhere.** All variation comes from `seeded(i, salt)` in `random.ts`, the same `sin`-based formula already used across `src/lib/analytics/**`, with one fix: the index is shifted by 1 and the salt added as an additive term, because the original formula collapses to the same value for `i === 0` regardless of salt. ~70 distinct prime salts give each decision an independent stream.
- **All date arithmetic is UTC.** SSR and hydration can run in different timezones; local-time getters would shift admissions across day/month boundaries and break hydration.
- **The anchor date is a constant (`2026-08-11`), not `new Date()`.** A wall-clock anchor could straddle midnight between server render and client hydration. Verified: two independent `generateHospitalDataset()` calls produce byte-identical rows.
- The dataset is built once and memoized in a module-level singleton (`getHospitalDataset()`).

## Reporting window

- 12 monthly buckets, 2025-09 through 2026-08, ending at the anchor date.
- The final bucket is **month-to-date** (11 of 31 days) and is flagged `isPartial`; monthly targets are scaled by `daysObserved / daysInMonth` so the partial month is not artificially inflated.

## Patient population (800 rows)

- **Gender:** 52% female target; 52.8% observed.
- **Age distribution — deliberately non-uniform**, banded: 0–4 = 7%, 5–17 = 10%, 18–39 = 30%, 40–59 = 28%, 60–74 = 17%, 75–95 = 8%. Observed at the anchor date: 17.1% under 18, 21.6% aged 60+, the balance working-age. Age is drawn per band, converted to a `birthDate` with a 0–364 day jitter, and every downstream age check re-derives age from `birthDate` so the two can never disagree.
- **PWD rate: 6%** (`PWD_PATIENT_RATE`), giving 46 PWD patients. `PH_SCPWD_PATIENT_RATE` in `ph-constants.ts` is 0.15, but that constant describes the combined **Senior Citizen + PWD payer share**, not PWD prevalence; senior citizens are modelled separately here (21.6% of patients are 60+), so applying 0.15 to the PWD flag alone would double-count. 6% is used per the brief.
- **PhilHealth category:** 12% are `"Non-Member/Self-Pay"`. Of the remainder, patients aged 60+ become `"Senior Citizen"` with probability 0.55; everyone else draws from `PH_MEMBERSHIP_DISTRIBUTION`'s six categories at that file's own shares, with `"Lifetime"` suppressed to zero weight for under-60s (Lifetime membership legally requires 60+ plus 120 contributions). Observed: Employed 284, Indigent/4Ps 140, Self-Earning 103, Non-Member/Self-Pay 99, Senior Citizen 78, Sponsored 55, OFW/Other 40, Lifetime 1. `"Lifetime"` is rare by construction — it can only survive the 60+ gate after the Senior Citizen draw has already claimed most of that cohort.
- **Registration date** starts as a draw across the preceding 6 years, then is pulled back to the patient's first encounter date wherever it would otherwise post-date it.
- **Visit propensity:** each patient gets a long-tailed weight `0.4 + seeded^3 * 6`, so a minority of patients account for a disproportionate share of encounters. Without this, 1,800 encounters across 800 patients would produce an implausibly low readmission rate.

## Department calibration

| Department | Category | Beds | Volume weight | Revenue index | Mean LOS | NPS baseline |
|---|---|---|---|---|---|---|
| Internal Medicine | Medical | 90 | 1.9 | 0.85 | 4.2 | 7.5 |
| Emergency Medicine | Emergency | 25 | 1.8 | 0.60 | 2.5 | 6.4 |
| Pediatrics | Medical | 50 | 1.2 | 0.75 | 3.4 | 8.4 |
| Obstetrics | Surgical | 45 | 1.1 | 1.00 | 2.6 | 8.1 |
| Surgery | Surgical | 60 | 1.0 | 1.75 | 5.0 | 7.7 |
| Orthopedics | Surgical | 35 | 0.8 | 1.50 | 6.0 | 7.3 |
| Cardiology | Medical | 30 | 0.7 | 1.90 | 5.2 | 8.0 |
| Oncology | Medical | 25 | 0.5 | 2.20 | 6.5 | 8.6 |

Intent, as specified: Internal Medicine and Emergency Medicine are the highest-volume, lowest-revenue-per-case departments; Oncology and Cardiology are low-volume, high-revenue-per-case; Surgery is moderate volume with high revenue per case. Observed result: 380 encounters at PHP 16.3k/encounter for Internal Medicine and 359 at PHP 11.2k for Emergency Medicine, versus 99 encounters at PHP 47.1k for Oncology and 201 at PHP 96.9k for Surgery.

## Encounter volume shaping

- Monthly target = `TARGET_ENCOUNTER_COUNT` distributed across months by `growth x seasonality x noise x observedFraction`, then normalized so the total lands on target.
- **Trend:** `ANNUAL_GROWTH = 0.14` applied linearly across the window (≈ ±7% end to end).
- **Seasonality:** `MONTH_SEASONALITY` peaks Dec–Feb (respiratory/gastro) at 1.08–1.12 and troughs Apr–May at 0.88–0.90.
- **Noise:** ±5% seeded per month.
- **Department split:** proportional to `baseVolumeWeight`.
- **Day of week:** per-encounter-type weights. Outpatient and Day Surgery are heavily weekday-skewed (Sunday 0.03–0.05 vs. weekday 1.1–1.3); Emergency is nearly flat with a slight weekend bump; Inpatient is moderately weekday-skewed.
- **Hour of day:** per-encounter-type 24-slot weights. Outpatient peaks 09:00–11:00 and 13:00–15:00 with a lunch dip; Day Surgery peaks 07:00–09:00; Emergency runs 24h with an 17:00–21:00 evening peak and an early-morning trough; Inpatient admissions peak 09:00–15:00.
- **Encounter-type mix** varies by department (`DEPARTMENT_ENCOUNTER_MIX`) — e.g. Emergency Medicine is 83% Emergency, Obstetrics is 55% Inpatient, Pediatrics is 60% Outpatient. Observed overall: Outpatient 37.8%, Inpatient 33.5%, Emergency 21.4%, Day Surgery 7.3%.

## Clinical plausibility rules

- **Patient/department eligibility** (`DEPARTMENT_PATIENT_RULES`): Pediatrics only accepts patients aged 0–17; Obstetrics only female patients aged 15–49; Cardiology 35+; Oncology 30+; Internal Medicine 13+; Surgery 12+; Orthopedics 10+; Emergency Medicine all ages.
- **Doctor assignment:** the primary doctor is always drawn from the encounter's own department.
- **Admission type:** populated only for Inpatient encounters, weighted Emergency 0.45 / Elective 0.40 / Transfer-in 0.08 / Newborn 0.07 — and `"Newborn"` is only possible in Obstetrics or Pediatrics. Verified: 0 non-Inpatient encounters carry an admission type, and 0 Inpatient encounters lack one.
- **Diagnosis affinity** (`DEPARTMENT_DIAGNOSIS_WEIGHTS`): each department has explicit weights over the 12 `PH_TOP_DIAGNOSES` codes — `O80` at 12x in Obstetrics and 0.01x elsewhere, `C50.9` at 8x in Oncology, `I10` at 6x in Cardiology, `M54.5` at 6x in Orthopedics, and so on. Codes not listed for a department fall back to a residual weight of 0.15 (small but non-zero, because real coding is messy).
- **Missing diagnosis:** 3% of encounters (`DIAGNOSIS_MISSING_RATE`) are left uncoded. Observed 3.1%. This is not cosmetic — it propagates to a zero PhilHealth deduction and a `Drafted` claim.
- **Length of stay:** inpatient LOS is `round(baseLosDays x (0.45 + u x 1.4))`, minimum 1 day. Non-inpatient encounters are same-day (`losDays = 0`) with realistic hour-level durations (Outpatient 1–4h, Emergency 2–11h, Day Surgery 6h or overnight 20h).
- **LOS outliers:** 2% of inpatient encounters (`LOS_OUTLIER_RATE`) have their LOS multiplied by 3–7x, producing a genuine long-stay tail rather than a clean distribution. Observed maxima: 45 days (Orthopedics), 35 (Internal Medicine), 23 (Oncology) against department medians of 5–7.
- **Still admitted:** an encounter is left with `dischargeDateTime === null` when its computed discharge would fall past the anchor date — a natural consequence of admit date plus LOS, not a separate flag. 9 rows.
- **Disposition** starts from Recovered 0.60 / Improved 0.28 / Transferred 0.05 / HAMA 0.04 / Expired 0.03 and is then adjusted: Expired x4 in Oncology, x2 in Emergency Medicine, x1.6 in Internal Medicine, x0.3 in Pediatrics/Obstetrics, x2.5 when LOS > 14 days; Transferred x3 and HAMA x2 in Emergency Medicine; HAMA x2.2 for private-pay/write-off payers and x1.8 for non-members; Outpatient encounters get Recovered x2 and Expired x0.02.
- **Readmission** is computed, never rolled — see the `Encounter` table notes. Observed 10.8% of eligible encounters, and it varies by payer as an emergent property (private-pay Emergency Medicine 16.9% vs. HMO Emergency Medicine 5.9%).

## Payer correlation

- Base weights are `PH_PAYER_MIX` verbatim (philhealth 0.55, hmo 0.20, privatePay 0.17, scpwd 0.05, gsis 0.02, writeoff 0.01).
- These are multiplied by `PAYER_CATEGORY_MULTIPLIER`, keyed on the patient's `philhealthCategory`. The important entries: `"Non-Member/Self-Pay"` gets **philhealth 0 and scpwd 0** (a self-pay patient can never land on a PhilHealth-funded bill) with privatePay 4.0x; `"Indigent/4Ps"` and `"Sponsored"` get philhealth 1.7–1.8x and hmo 0.05–0.1x; `"Employed"` gets hmo 1.6x; `"Senior Citizen"` gets scpwd 6.0x.
- `isPWD === true` additionally multiplies the scpwd weight by 6 and adds a 0.08 floor, so a PWD patient reaches the SC/PWD ledger even if they are a non-member.
- Result: 61.1% of encounters carry a PhilHealth benefit (`philhealth` or `scpwd`), inside the intended 55–65% band, and 56.8% of gross charges sit on `philhealth`.

## Pricing and billing

- **Unit price** = a seeded draw inside the service's catalogue band, shifted upward by `clamp((baseRevenueIndex - 0.6)/1.6, 0, 1) x 0.5` of the band width, multiplied by a department factor of `0.9 + 0.12 x baseRevenueIndex` and a per-case variance of 0.94–1.06. High-revenue-index departments therefore land systematically higher in the band *and* pay a modest multiplier, while no two identical services bill identically.
- **Line item count:** 1–6 per encounter, mean 3.42. Composition is type-constrained (see the `EncounterService` notes).
- **PhilHealth deduction:** see the `Billing` notes. Capped at 90% of gross so a bill is never fully extinguished by the case rate.
- **PWD discount:** 20% of the qualifying amount, where qualifying excludes Room & Board. Strictly zero for non-PWD patients.
- **Payment resolution:** a bill is fully settled with probability `payerPropensity x (0.35 + 0.65 x min(ageDays/120, 1))` — so recent bills are mostly Pending and old bills are mostly resolved. Payer propensities: philhealth 0.93, scpwd 0.90, hmo 0.88, gsis 0.85, privatePay 0.72, writeoff 0.05.
- **Overdue / write-off correlation:** unsettled bills become `Write-off` if the payer is `writeoff`, or if the bill is over 240 days old on a privatePay/hmo payer with a 30% roll. Remaining unsettled bills are `Partial` (45%), else `Overdue` if over 60 days old, else `Pending`. Observed AR aging confirms the intent: privatePay carries PHP 2.34M in the 90+ bucket versus PHP 0.77M for philhealth.
- **Missingness:** `paymentDate` is `null` whenever nothing was collected, plus a further 4% of Partial bills where the date was never captured.

## Claims

- Generated only for `philhealth` / `scpwd` encounters — verified 0 exceptions.
- `caseType` derivation order: Outpatient -> `Konsulta Package`; Obstetrics + `O80` -> `Maternity Package`; `C50.9` -> `Catastrophic (Z-Benefit)`; Day Surgery or an existing Surgery line -> `Surgical Case`; otherwise `Medical Case`.
- **CR1/CR2 split:** 70/30 facility vs. professional fee (`CASE_RATE_CR1_SHARE`).
- **Status** is age-driven: uncoded -> `Drafted`; under 7 days since submission -> `Submitted`; under 25 days -> `Under Review`; then an 8% backlog tail keeps some old claims in Submitted/Under Review (realistic queue behaviour); otherwise a 12% denial roll (`CLAIM_DENIAL_RATE`), and approved claims older than 45 days become `Remitted` with 75% probability.
- **Denial codes** are weighted, not uniform: DN-01 (incomplete CSF) 26%, DN-03 (late filing) 18%, DN-06 (missing attachment) 15%, DN-02 14%, DN-04 12%, DN-05 8%, DN-07 7%.
- **Appeals:** 55% of denials are appealed, with outcomes Filed 18% / Under Appeal 22% / Won 38% / Lost 22%. `amountRecovered` exists only for wins, at 60–100% of the case rate.
- **Remittance** lands 30–95 days after submission at 85–100% of the case rate (partial payments and deductions).

## Feedback

- **Response rate:** 35% baseline (`FEEDBACK_RESPONSE_RATE`), modulated by department satisfaction so happier departments respond slightly more often, clamped to 22–45%. Only discharged encounters are surveyed.
- **Score construction:** department `npsBaseline` + an approximately-normal deviate (sd 1.5), then adjusted downward: Expired −2.5, HAMA −2.0, Transferred −0.8, LOS beyond 2x the department mean −1.5, 30-day readmission −0.7, Overdue/Write-off bill −0.6, denied claim −0.7. Clamped to 0–10.
- **CSAT** is derived from NPS (`1 + nps x 0.4` plus noise, clamped 1–5), so the two questions never contradict each other.
- **Comment missingness:** 55% target, 56.8% observed. Comment text is a fixed positive/negative phrase per category, chosen by sentiment.

## Known simplifications (summary)

1. Ancillary services (Laboratory, Imaging, Pharmacy, Room & Board) all carry the Internal Medicine department id as a shared cost centre. Revenue attribution never uses this field.
2. PWD discount qualification is category-level, not item-level, and excludes Room & Board.
3. `Department.category` includes `"Diagnostic"`, which no current row uses.
4. Doctors never work outside their primary department.
5. Bed occupancy percentage is not derivable — the encounter volume is a scaled-down extract relative to real Level 3 bed capacity.
6. Claim `submissionDate` is populated even for `Drafted` claims, where it represents the preparation date.
7. Still-admitted encounters carry a `disposition` reflecting current status rather than a final discharge outcome.

---

# Legacy Mock Data (Pending Migration)

Everything below still exists in the repository and still powers most existing
routes. It is **not** the current reference schema: each file generates its own
synthetic numbers independently, so figures produced here do not necessarily
reconcile with each other or with the shared dataset above. Migrate consumers
to `src/lib/data/hospital/**` as pages are rebuilt.

Field-level detail for these tables is unchanged from the prior version of this
document; see git history for the full per-column listings. Listed here are the
table names and one-line descriptions so nothing is lost.

## Shared reference / constants (still current)

- **`src/lib/analytics/ph-constants.ts`** — canonical PH constants: `IcdEntry` / `PH_TOP_DIAGNOSES` (12 ICD-10 codes), `PH_DIAGNOSIS_CASE_RATES`, `PH_DEPARTMENTS`, `PH_DEPARTMENT_COLORS`, `PH_PHYSICIANS`, `PH_SURNAMES`/`PH_FEMALE_NAMES`/`PH_MALE_NAMES`, `phPatientName()`, `PH_PAYER_MIX`, `PH_SCPWD_PATIENT_RATE`, `PH_MEMBERSHIP_DISTRIBUTION`, `KONSULTA_EKAS_RATE`, `INPATIENT_GROSS_CHARGE_RANGE`, `TARGET_ADMISSIONS_PER_MONTH`. **This file is not legacy** — the shared dataset imports from it and it remains the single source of reference data for both models.
- **`src/lib/analytics/lgu/shared.mock.ts`** — `Barangay` plus the LGU-side `seeded`/`seededRange`/`epiWeeks`/`personName` helpers.

## Hospital (Type A) analytics — pending migration

| File | Tables | Status |
|---|---|---|
| `src/lib/analytics.mock.ts` | `KpiMetric`, `OccupancyPoint`, `DepartmentAdmissions`, `OrUtilizationPoint`, `DiagnosisTop`, `QualityEventPoint`, `VolumePoint`, `PatientAlert`, `DashboardData` | **Legacy and orphaned** — no route imports it. |
| `src/lib/analytics/executive.mock.ts` | `AdmissionRow`, `VolumePoint`, `PayerSlice`, `PayerTrendPoint`, `DiagnosisRow`, `ClaimStatusSlice`, `DenialReason`, `LabTatCategory`, `ActionAlert`, `ExecutiveData` | Live — powers the Executive Analytics dashboard. Independent volume/payer/claims numbers; a prime migration candidate. |
| `src/lib/analytics/clinical.mock.ts` | `IcdCode`, `HeatmapCell`, `HeatmapDrillCase`, `DiseaseTrendSeries`, `ComorbidityBubble`, `ProcedureNode`, `SurgeonRow`, `OrBlock`, `DischargeMonth`, `ReadmissionPoint`, `ReadmissionCase`, `HamaDept`, `SankeyLink`, `ReferralCase`, `SpecialtyAcceptance`, `ClinicalData` | Live — Clinical Analytics. Not yet migrated. |
| `src/lib/analytics/revenue.mock.ts` | `WaterfallStep`, `PayerSlice`, `PayerTrendPoint`, `DeptRevenueRow`, `ARAgingRow`, `ARPatientRow`, `CollectionPoint`, `FunnelStage`, `CoverageSlice`, `ScPwdPoint`, `RevenueData` | Live — Revenue Analytics. Duplicates `PayerSlice`/`PayerTrendPoint` from `executive.mock.ts` with independent values. |
| `src/lib/analytics/claims.mock.ts` | `ClaimsKpis`, `PipelineStage`, `DenialTrendPoint`, `DenialReasonRow`, `CaseTypeTreemapRow`, `PhysicianClaimRow`, `CaseRateScatterPoint`, `CoverageDiagnosisRow`, `WorklistClaim`, `ClaimsData` | Live — Claims Analytics. Does **not** import `ph-constants.ts`; keeps its own physician and diagnosis lists. |
| `src/lib/analytics/quality.mock.ts` | `HacPoint`, `MedErrorPoint`, `HandHygieneUnit`, `SsiSurgeon`, `PrescriptionDept`, `QualityData` | Live — Quality Analytics. Does **not** import `ph-constants.ts`; local surgeon roster and `"Emergency"` vs. canonical `"Emergency Medicine"` naming mismatch. |
| `src/lib/analytics/laboratory.mock.ts` | `VolumeTrendPoint`, `TatOutlier`, `TatBoxStat`, `CriticalResponseBar`, `CriticalNotification`, `AbnormalTestRow`, `UnmappedTest`, `LaboratoryData` | Live — Laboratory Analytics. Does **not** import `ph-constants.ts`; local department list uses `"OB-Gyne"`, `"Emergency"`, `"ICU"`. |
| `src/lib/analytics/cohort.mock.ts` | `CohortPatient` | Live — hospital Cohort Builder. |
| `src/lib/analytics/temporal.mock.ts` | `TemporalDataset` | Live — hospital Temporal Pattern Analysis. |
| `src/lib/analytics/alerts.mock.ts` | (no own row types; emits `AlertItem` from `@/components/analytics/alert-center`) | Live — hospital Alert Center. |

## Hospital reports — pending migration

**`src/lib/reports/hospital.mock.tsx`** — 10 report row types plus the file-level `hospitalReports` export. All row interfaces are **file-local (not exported)** and only inferable from usage:

`CensusRow` (R-01 Daily Census), `LogbookRow` (R-02 Admission & Discharge Logbook), `MorbidityRow` (R-03 Morbidity Summary), `ClaimRow` (R-04 PhilHealth Claims Register), `DenialRow` (R-05 Denial & Appeal Tracker), `RevenueRow` (R-06 Revenue & Collection), `PhysicianActivityRow` (R-07 Physician Activity), `LabWorkloadRow` (R-08 Laboratory Workload), `FormularyRow` (R-09 Prescription & Formulary Compliance), `DischargeAuditRow` (R-10 Discharge Clearance Audit).

This file imports `phPatientName` from `ph-constants.ts` but never calls it, using its own gender-unaware local `personName(i)` instead. Every one of these ten reports is a direct candidate for re-derivation from the shared dataset (census from `Encounter`, logbook from `Encounter` + `Patient`, morbidity from `Encounter.diagnosisCode`, claims/denials from `PhilHealthClaim`, revenue from `Billing`, physician activity from `doctorProductivity()`).

## LGU (Type B) analytics and reports — out of scope for migration

The shared dataset is hospital-side (Type A) only. All LGU files remain the
source of truth for their own dashboards and are unchanged:

| File | Tables |
|---|---|
| `src/lib/analytics/lgu/executive.mock.ts` | `BarangayMetricSet`, `DiseaseCurvePoint`, `MorbidityRow`, `LguExecutiveData` |
| `src/lib/analytics/lgu/jurisdiction.mock.ts` | `JurisdictionRow` |
| `src/lib/analytics/lgu/maternal.mock.ts` | `AncFunnelStage`, `RiskPatient`, `MaternalData` |
| `src/lib/analytics/lgu/ncd.mock.ts` | `NcdBarangay`, `CascadeStage`, `NcdData` |
| `src/lib/analytics/lgu/tb.mock.ts` | `TbTrendPoint`, `CascadeStage`, `DrTbCase`, `TbData` |
| `src/lib/analytics/lgu/konsulta.mock.ts` | `BhcVolume`, `DenialReason`, `FlowStageLike`, `KonsultaData` |
| `src/lib/analytics/lgu/population.mock.ts` | `PyramidBand`, `UtilizationSeries`, `SdohMetric`, `CommunicableDiseasePoint`, `PopulationData` |
| `src/lib/analytics/lgu/cohort.mock.ts` | `CommunityPatient` |
| `src/lib/analytics/lgu/temporal.mock.ts` | `LguTemporalDataset` |
| `src/lib/analytics/lgu/alerts.mock.ts` | (emits `AlertItem`) |
| `src/lib/reports/lgu.mock.tsx` | `FhsisRow` (R-11), `ImmunizationCoverageRow` (R-12), `MaternalDeathRow` (R-13), `TbQuarterlyRow` (R-14), `KonsultaUtilRow` (R-15), `ReferralRow` (R-16), `HouseholdProfileRow` (R-17), `DengueRow` (R-18), plus the `lguReports` export |

## Shared component prop types

Declared alongside the visualization components rather than in a mock file, and
consumed by both models:

- `HourWeekdayCell` — `src/components/analytics/temporal-heatmap.tsx`
- `AlertItem` — `src/components/analytics/alert-center.tsx`
- `FlowStage`, `BarangayDatum`, `CalendarDay` — `src/components/analytics/lgu-shared.tsx`

## `Top20NewCharts.tsx` data sourcing

`src/components/analytics/Top20NewCharts.tsx` is a standalone, unwired preview
component (no route, no nav entry, nothing imports it). It sources data from the
**legacy** model only:

- Charts 1, 2, 6 read pre-aggregated arrays off `getExecutiveData()` (`executive.mock.ts`).
- Charts 3–5 and 7–11 read hospital report rows via `getHospitalReport(id).getRows()` (`reports/hospital.mock.tsx`).
- Charts 13–14 and 16–20 read LGU report rows via `getLguReport(id).getRows()` (`reports/lgu.mock.tsx`).
- It also imports `cohortPatients` (`cohort.mock.ts`), `getNcdData` (`lgu/ncd.mock.ts`) and `PH_DEPARTMENT_COLORS`.

Because the report row interfaces in `src/lib/reports/*.mock.tsx` are file-local,
this component declares local mirrors of them. All group-by/derivation logic
lives inside the component rather than in the mock files. When these charts are
promoted into real routes, the hospital-side ones should be re-pointed at
`getHospitalDataset()` plus the `derive.ts` helpers instead.

## Known cross-file inconsistencies in the legacy model

Preserved from the prior version of this document because they are still true
and are the motivation for the shared dataset:

1. `claims.mock.ts`, `quality.mock.ts` and `laboratory.mock.ts` do not import `ph-constants.ts` at all; each declares its own near-duplicate physician roster and/or department list, with real naming drift (`"Dr. F. Aquino"` vs `"Dr. F. Aguilar"`, `"Emergency"` vs `"Emergency Medicine"`, `"OB-Gyne"` vs `"Obstetrics"`, plus an `"ICU"` that is not a `PH_DEPARTMENTS` value).
2. The `{id, label, value}` funnel/cascade shape is independently redeclared in four LGU mock files instead of importing `FlowStage` from `lgu-shared.tsx`.
3. Identically-named types are declared separately in more than one file: `PayerSlice` and `PayerTrendPoint` (same shape, `executive.mock.ts` and `revenue.mock.ts`), `VolumePoint` (**same name, different shape**, `analytics.mock.ts` and `executive.mock.ts`), `DenialReason` (**same name, different shape**, `executive.mock.ts` and `lgu/konsulta.mock.ts`), `CascadeStage` (`lgu/ncd.mock.ts` and `lgu/tb.mock.ts`), `MorbidityRow` (**same name, different shape**, `lgu/executive.mock.ts` exported and `reports/hospital.mock.tsx` file-local).
4. `reports/hospital.mock.tsx` imports `phPatientName` but never calls it, using a behaviourally different local `personName(i)` instead.
5. `lgu/population.mock.ts` and `lgu/alerts.mock.ts` never reference `BARANGAYS`/`BHC_LIST`; barangay names in `lgu/alerts.mock.ts` are hardcoded inside free-text strings and can silently drift.

---

# Appendix — Table Count Summary

| Group | Files | Tables |
|---|---|---|
| **Shared hospital dataset (current)** | `src/lib/data/hospital/{entities,reference,random,time,generate,derive,index}.ts` | **12** (10 tables — 4 dimensions + 6 facts — plus `MonthMeta` and `HospitalDataset`), and additionally `HospitalDatasetIndex` plus 22 derivation row/filter types |
| Shared reference/constants | `ph-constants.ts`, `lgu/shared.mock.ts` | 2 (`IcdEntry`, `Barangay`) |
| Shared component prop types | `temporal-heatmap.tsx`, `alert-center.tsx`, `lgu-shared.tsx` | 5 |
| Legacy hospital (Type A) dashboards | 10 files, see above | 72 |
| Legacy hospital reports | `reports/hospital.mock.tsx` | 11 |
| LGU (Type B) dashboards | 10 files, see above | 26 |
| LGU reports | `reports/lgu.mock.tsx` | 9 |
| **Total** | 32 files | **137** |

The 125 legacy tables are unchanged; the 12 new ones are additive. No legacy
file was modified, deleted or renamed while introducing the shared dataset.
