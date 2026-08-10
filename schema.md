# SugboDoc Mock-Data Schema Reference

SugboDoc has no real database. Every dashboard, report, and analytics tool in the
prototype is fed by deterministic (seeded, non-`Math.random`) TypeScript mock-data
files under `src/lib/analytics/**` and `src/lib/reports/**`, plus a handful of
prop-type interfaces defined alongside the visualization components that consume
them (`src/components/analytics/*.tsx`). This document treats every exported
TypeScript `interface`/`type` with named fields in those files as if it were a
database table: attributes become columns, and cross-file naming/shape overlaps
are documented as informal, type-unenforced relationships. Trivial type aliases
that only union or re-export another type (e.g. `KpiStatus`, `LabCategory`,
`ComplianceCell`) are not given their own table; they are noted inline wherever
they constrain a real column. File-local (non-`export`ed) interfaces — mainly the
row shapes inside the two `reports/*.mock.tsx` files — are documented as tables
too, but flagged as not exported/only inferable from usage.

No column here was invented. Every attribute name and type below was read
directly from the source file cited in that table's **Source** line. Where a
relationship, constraint, or shape is not explicit in the code, this document
says `Unknown` or `Needs verification` rather than guessing.

---

## Known Cross-File Inconsistencies

The following were independently verified against the source (not just assumed from the prompt):

1. **`claims.mock.ts`, `quality.mock.ts`, and `laboratory.mock.ts` do NOT import from `ph-constants.ts`.**
   All three files have zero `import` statements pulling in `PH_DEPARTMENTS`, `PH_PHYSICIANS`, or `PH_TOP_DIAGNOSES`. Each defines its own local, independently-typed literal data instead:
   - `claims.mock.ts` declares a local `physicians` array of 8 names that happens to exactly match the first 8 entries of `PH_PHYSICIANS` (duplicated literal, not imported), and a local `diagnoses` array of 20 `[icd10, description, caseType]` tuples that partially overlaps `PH_TOP_DIAGNOSES` codes (J18.9, E11.9, A09, N39.0, I10, K29.7) but also includes many codes `PH_TOP_DIAGNOSES` does not have (I21.9, N18.6, K35.8, C50.9 dup, I63.9, S72.0, J44.9, K80.2, M17.9, P07.3, B20, Z00.0, S06.0). It has no department field/list at all.
   - `quality.mock.ts` declares a local `surgeons` array of 10 names that is a *near*-duplicate of `PH_PHYSICIANS` but not identical: it has "Dr. F. Aquino" (ph-constants has "Dr. F. Aguilar") and three names not present in `PH_PHYSICIANS` at all ("Dr. N. Bravo", "Dr. T. Cortes", "Dr. E. Villareal" — ph-constants has "Dr. E. Villaraza", a similar-but-different spelling). It also declares local `surgeonDepts` (4 items, a valid subset of `PH_DEPARTMENTS`) and `prescriptionDepts` (7 items) which uses `"Emergency"` where `PH_DEPARTMENTS` uses `"Emergency Medicine"` — a naming mismatch, not just a subset.
   - `laboratory.mock.ts` has no physician roster and no diagnosis list (lab tests are named directly, not tied to ICD-10). Its local `orderingDepartments` list (`Emergency`, `ICU`, `Internal Medicine`, `Surgery`, `OB-Gyne`, `Pediatrics`) does not match `PH_DEPARTMENTS` naming either (`"OB-Gyne"` vs. canonical `"Obstetrics"`, `"Emergency"` vs. `"Emergency Medicine"`, plus `ICU` which isn't a `PH_DEPARTMENTS` value at all).

2. **The `{id, label, value}` funnel/cascade shape is independently redeclared in at least 4 places instead of being imported.** `src/components/analytics/lgu-shared.tsx` exports a canonical `FlowStage` interface (`{id, label, value, suffix?}`) specifically so the shared `<StageFlow />` component has one prop type. None of the LGU mock files that produce funnel-shaped data import it:
   - `lgu/maternal.mock.ts` → `AncFunnelStage {id, label, value}` (separate declaration)
   - `lgu/ncd.mock.ts` → `CascadeStage {id, label, value}` (separate declaration)
   - `lgu/tb.mock.ts` → `CascadeStage {id, label, value}` (separate declaration, same name as ncd's but a different interface in a different file)
   - `lgu/konsulta.mock.ts` → `FlowStageLike {id, label, value}` (separate declaration; the "Like" suffix suggests the author knew it mirrored `FlowStage` but still didn't import it)
   All four are structurally identical to `FlowStage` (minus the optional `suffix`), but TypeScript never enforces this — they are four independent type declarations.

3. **Identically-named types declared separately in more than one file:**
   - `PayerSlice` — declared in both `executive.mock.ts` (hospital) and `revenue.mock.ts`, **same shape** (`{payer, amount, color}`), not shared/imported between them.
   - `PayerTrendPoint` — declared in both `executive.mock.ts` and `revenue.mock.ts`, **same shape** (`{month, philhealth, hmo, privatePay, scpwd, gsis, writeoff}`), not shared.
   - `VolumePoint` — declared in the legacy `analytics.mock.ts` (`{date, admissions, discharges, edVisits}`) **and** in `executive.mock.ts` (`{month, inpatient, opd, emergency, daySurgery, priorInpatient}`) — **same name, different shape**.
   - `DenialReason` — declared in `executive.mock.ts` (hospital, `{code, reason, count, valueAtRisk, action}`) **and** in `lgu/konsulta.mock.ts` (`{code, reason, count, action}` — no `valueAtRisk`) — **same name, different shape**.
   - `CascadeStage` — declared separately in `lgu/ncd.mock.ts` and `lgu/tb.mock.ts`, **same shape** (`{id, label, value}`) (see item 2 above).
   - `MorbidityRow` — declared in `lgu/executive.mock.ts` (exported, `{code, description, current, priorMonth, priorYear}`) **and** as a file-local (non-exported) interface in `reports/hospital.mock.tsx` (`{icd10, diagnosis, ageGroup, male, female, period}`) — **same name, different shape**, and one is exported while the other is file-local.

4. **`hospital.mock.tsx` imports `phPatientName` from `ph-constants.ts` but never calls it.** Confirmed by grep: the only occurrence of `phPatientName` in the file is the `import` statement itself. The file instead defines and uses its own local `personName(i)` helper, built from a locally-declared `surnames`/`givenNames` pair. Unlike `phPatientName`, which is gender-aware (picks from `PH_FEMALE_NAMES` or `PH_MALE_NAMES` based on a passed `gender` argument), `personName` uses a single flat given-name list with no gender parameter at all — so it is not just a dead import, it's a behaviorally different generator. Note also that this same `surnames`/`givenNames` pair (Reyes, Dela Cruz, Garcia, Lim, Bautista, Tan, Santos, Pascual, Fernandez, Ramos / Maria, Juan, Ana, Paolo, Liza, Carlo, Grace, Noel, Divine, Ricky) is independently re-declared, verbatim, in `claims.mock.ts`, `laboratory.mock.ts` (surnames only, own given-name list), and forms the basis of `lgu/shared.mock.ts`'s `personName`/`patientId` pool — a second, distinct Filipino-name pool from the one in `ph-constants.ts` (`PH_SURNAMES`/`PH_FEMALE_NAMES`/`PH_MALE_NAMES`), duplicated across files rather than centralized.

5. **`lgu/population.mock.ts` and `lgu/alerts.mock.ts` do not reference `BARANGAYS`/`BHC_LIST` at all.**
   - `population.mock.ts` imports only `epiWeeks, seededRange` from `./shared.mock`. No `BARANGAYS` or `BHC_LIST` import or usage anywhere in the file. (It also redeclares its own local `months12` array rather than importing the one already exported from `shared.mock.ts` — a minor extra duplication found during verification.)
   - `lgu/alerts.mock.ts` imports only the `AlertItem` type from `@/components/analytics/alert-center` — no import from `shared.mock.ts`. Barangay/BHC names that appear in this file (e.g. "Barangay Talamban", "Guadalupe RHU", "Inayawan (74%) and Sambag I (77%)", "Labangon and Pardo", "Basak Pardo Health Center", "Tisa") are hardcoded inside free-text `detail` strings only — not looked up from `BARANGAYS`/`BHC_FACILITIES` — so they are not type- or data-linked and could silently drift out of sync with the real barangay/BHC list.

---

# Part 1 — Shared Reference / Constants

## File: `src/lib/analytics/ph-constants.ts`

Canonical Philippine-healthcare-context constants shared across the hospital (Type A) mock files: 8 departments, 15-physician roster, 12-entry top-morbidity ICD-10 list, payer-mix and PhilHealth-membership distribution assumptions. Most exports here are `const` data arrays/objects or generator functions, not named `interface`/`type` declarations, so per the documentation rule only the one true interface (`IcdEntry`) gets a formal table. The rest are described in prose below and referenced as data sources from the "Relationships" section of tables that consume them.

## Table: IcdEntry

**Description:** One ICD-10 diagnosis entry in the canonical Philippines top-morbidity list. Used to build `PH_TOP_DIAGNOSES`, which is imported by most hospital-side (Type A) mock files as the shared diagnosis pool.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| code | string | — | ICD-10 code, e.g. `"J18.9"`. |
| description | string | — | Full clinical description, e.g. `"Pneumonia, unspecified organism"`. |
| commonName | string | — | Short everyday label for chart axes/labels, e.g. `"Pneumonia"`. |

### Relationships
- `PH_TOP_DIAGNOSES: IcdEntry[]` is the 12-entry canonical export. Consumed (imported) by `executive.mock.ts`, `clinical.mock.ts` (as `ICD_CODES`), `cohort.mock.ts`, `temporal.mock.ts` (department only, not diagnoses), `analytics.mock.ts` (legacy), `reports/hospital.mock.tsx`, and `lgu/jurisdiction.mock.ts` (`jurisdictionMorbidity()`). **Not** imported by `claims.mock.ts`, `quality.mock.ts`, or `laboratory.mock.ts` (see Known Cross-File Inconsistencies #1).
- `PH_DIAGNOSIS_CASE_RATES: Record<string, number>` is keyed by `IcdEntry.code` and gives the PhilHealth case rate in PHP for each diagnosis in `PH_TOP_DIAGNOSES`. This is an informal FK: the record keys are expected to match `PH_TOP_DIAGNOSES[].code` but nothing in the type system enforces it.

### Source
`src/lib/analytics/ph-constants.ts`, exported as `PH_TOP_DIAGNOSES: IcdEntry[]`.

### Notes
- `PhDepartment` (`type PhDepartment = (typeof PH_DEPARTMENTS)[number]`) is a trivial type alias over the 8-value `PH_DEPARTMENTS` string-literal tuple (`Internal Medicine, Surgery, Obstetrics, Pediatrics, Orthopedics, Cardiology, Emergency Medicine, Oncology`) — not given its own table. `clinical.mock.ts` re-derives an equivalent local alias `Department` from its own `PALETTE_DEPTS = PH_DEPARTMENTS` re-export.
- Other exported consts in this file with fixed field shapes but **no backing interface/type declaration** (so, per the documentation rule, not tabled as their own entities): `PH_DEPARTMENT_COLORS: Record<PhDepartment, string>`, `PH_PHYSICIANS: readonly string[]` (15 names), `PH_SURNAMES`/`PH_FEMALE_NAMES`/`PH_MALE_NAMES: string[]`, `PH_PAYER_MIX` (object literal with keys `philhealth, hmo, privatePay, scpwd, gsis, writeoff`, all `number` fractions), `PH_SCPWD_PATIENT_RATE: number`, `PH_MEMBERSHIP_DISTRIBUTION: {category: string; share: number; color: string}[]`, `KONSULTA_EKAS_RATE: number`, `INPATIENT_GROSS_CHARGE_RANGE: [number, number]`, `TARGET_ADMISSIONS_PER_MONTH: number`.
- `phPatientName(i: number, gender: "male" | "female"): string` is the canonical gender-aware patient-name generator. It is imported (and actually called) correctly by `executive.mock.ts`, `clinical.mock.ts`, `revenue.mock.ts`, and `cohort.mock.ts`. It is imported but never called by `reports/hospital.mock.tsx` (see Known Cross-File Inconsistencies #4).

---

## File: `src/lib/analytics/lgu/shared.mock.ts`

Shared mock-data building blocks for the LGU / City Health Center module (Type B): the 15-barangay / 5-BHC geography, month/epi-week label arrays, the seeded pseudo-random helpers, and a second (non-`ph-constants`) name-generator pool used across most LGU files.

## Table: Barangay

**Description:** One barangay in the 15-barangay Cebu City catchment, clustered under one of 5 physical Barangay Health Center (BHC) facilities. This is the geographic backbone of nearly every LGU (Type B) dashboard.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| id | string | PK | Slug id, e.g. `"brgy-lahug"`. |
| name | string | — | Display name, e.g. `"Lahug"`. |
| population | number | — | Static population figure for this barangay. |
| bhc | string | — | Display name of the serving BHC facility, e.g. `"Lahug Health Center"`. |
| bhcId | string | FK -> BHC_FACILITIES.id (informal) | Slug id of the serving BHC; matches an entry in the local `BHC_FACILITIES` const array but is not type-enforced. |
| phn | string | — | Name/credential of the assigned Public Health Nurse, e.g. `"N. Villaraza, RN"`. |

### Relationships
- `BARANGAYS: Barangay[]` is the 15-row canonical export, imported throughout the LGU (Type B) mock files (`executive.mock.ts`, `maternal.mock.ts`, `ncd.mock.ts`, `tb.mock.ts`, `lgu/cohort.mock.ts`, `reports/lgu.mock.tsx`) and NOT imported by `population.mock.ts` or `lgu/alerts.mock.ts` (see Known Cross-File Inconsistencies #5).
- `bhc`/`bhcId` informally reference the local `BHC_FACILITIES` const array (`{id, name}[]`, 5 entries — this array has no backing interface/type, so it is not its own table). `BHC_LIST = BHC_FACILITIES.map(b => b.name)` is the derived 5-name array used for BHC-level (rather than barangay-level) charts, imported by `executive.mock.ts`, `konsulta.mock.ts`, `lgu/temporal.mock.ts`, and `reports/lgu.mock.tsx`.
- `TOTAL_POPULATION = BARANGAYS.reduce(...)` is a derived constant, not a table.

### Source
`src/lib/analytics/lgu/shared.mock.ts`, exported as `BARANGAYS: Barangay[]`.

### Notes
- This file also exports `months12: string[]` (12 labels, "Sep 25" .. "Aug 26") and `epiWeeks: string[]` (12 labels, "EW20".."EW31") — plain string arrays, no backing type, used widely across LGU mock files as the canonical time axis. `lgu/population.mock.ts` redeclares its own local `months12` instead of importing this one (see Known Cross-File Inconsistencies #5 note).
- `seeded(i, salt)` / `seededRange(i, min, max, salt)` are the shared deterministic pseudo-random helpers (sine-based, not `Math.random`) reused (via re-declaration, not import, in most files) across the whole codebase.
- `personName(i): string` and `patientId(i): string` are this file's own name/ID generator pair, built from a locally-declared 16-surname / 10-given-name pool that is distinct from `ph-constants.ts`'s `PH_SURNAMES`/`PH_FEMALE_NAMES`/`PH_MALE_NAMES` (see Known Cross-File Inconsistencies #4). `personName` is not gender-aware. Imported and used by `maternal.mock.ts`, `ncd.mock.ts`, and `lgu/cohort.mock.ts`.

---

# Part 2 — Shared Component Prop Types

These interfaces live in `src/components/analytics/*.tsx`, not in a `.mock.ts` file, but several hospital and LGU mock files import their types directly (rather than redeclaring an equivalent shape), so they are documented here as shared "lookup" tables.

## Table: HourWeekdayCell

**Description:** One cell of an hour-of-day (0–23) × weekday (Mon–Sun) visit-volume grid, used by the Temporal Pattern Analysis heatmap tool on both the hospital and LGU sides.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| day | string | — | Weekday label, one of `"Mon".."Sun"`. |
| dayIndex | number | — | 0-based weekday index (0 = Mon .. 6 = Sun). |
| hour | number | — | Hour of day, 0–23. |
| value | number | — | Visit volume for that day/hour cell. |

### Relationships
- Produced by `getTemporalData()` in `src/lib/analytics/temporal.mock.ts` (hospital, `TemporalDataset.opd` / `.emergency`) and by `getLguTemporalData()` in `src/lib/analytics/lgu/temporal.mock.ts` (`LguTemporalDataset.konsulta` / `.programs`). Both mock files import this type rather than redeclaring it — one of the few cases of genuine type sharing in the codebase.

### Source
`src/components/analytics/temporal-heatmap.tsx`, exported interface, consumed by `HourWeekdayHeatmap()`.

### Notes
None.

## Table: AlertItem

**Description:** One alert/notification row shown in the Alert & Notification Center tool, shared verbatim by the hospital and LGU alert mock files.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| id | string | PK | Alert id, e.g. `"AL-H01"` (hospital) / `"AL-L01"` (LGU). |
| severity | AlertSeverity (`"critical" \| "warning" \| "info"`) | — | Severity tier; drives icon/color and default sort. |
| title | string | — | One-line alert headline. |
| detail | string | — | Longer free-text explanation. |
| module | string | — | Source module/dashboard label, e.g. `"Census"`, `"Claims"`, `"Surveillance"`. |
| minutesAgo | number | — | Minutes since the alert fired; drives the relative-time label and default sort order. |
| actionLabel | string | — | Label for the primary action button in the drill-down drawer. |
| actionHref | string (optional) | — | Route the action button links to, if any. |

### Relationships
- `hospitalAlerts` / `hospitalAlertRefreshPool: AlertItem[]` in `src/lib/analytics/alerts.mock.ts`.
- `lguAlerts` / `lguAlertRefreshPool: AlertItem[]` in `src/lib/analytics/lgu/alerts.mock.ts`.
- Both mock files import `AlertItem` (and, implicitly, `AlertSeverity`) from this component file rather than redeclaring it.

### Source
`src/components/analytics/alert-center.tsx`, exported interface, consumed by `AlertCenter()`.

### Notes
- `AlertSeverity = "critical" | "warning" | "info"` is a trivial type alias, not given its own table.

## Table: FlowStage

**Description:** Shared `{id, label, value}`-shaped prop type for the `<StageFlow />` funnel/cascade-of-care visualization primitive used across several LGU dashboards (ANC funnel, HTN/DM cascades, TB cascade, Konsulta enrollment funnel).

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| id | string | — | Stable stage identifier. |
| label | string | — | Stage display label. |
| value | number | — | Stage value (count), used to compute bar width and conversion percentages. |
| suffix | string (optional) | — | Optional string appended after the formatted value (e.g. a unit). |

### Relationships
- **Not imported** by any LGU mock file that produces `{id, label, value}`-shaped data. `AncFunnelStage` (`maternal.mock.ts`), `CascadeStage` (`ncd.mock.ts`, `tb.mock.ts`), and `FlowStageLike` (`konsulta.mock.ts`) are all independently-declared, structurally-compatible near-duplicates of this type. See Known Cross-File Inconsistencies #2.

### Source
`src/components/analytics/lgu-shared.tsx`, exported interface, consumed by `StageFlow()`.

### Notes
None.

## Table: BarangayDatum

**Description:** Prop shape for one tile of the stylized `<BarangayChoropleth />` grid (a CSS-grid map substitute — no external mapping dependency).

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| id | string | — | Barangay/tile identifier. |
| name | string | — | Display name shown on the tile. |
| value | number | — | Numeric metric value used to compute the color ramp position. |
| display | string | — | Pre-formatted display string (e.g. `"62%"`) shown under the name. |
| alert | boolean (optional) | — | If true, tile is forced to the critical/outbreak color regardless of `value`. |

### Relationships
- Not produced directly by any mock file read for this document. Consuming route/page components appear to construct `BarangayDatum[]` values inline from `BarangayMetricSet[]` (from `lgu/executive.mock.ts`) at render time. **Needs verification** — the exact page component that maps `BarangayMetricSet` → `BarangayDatum` was not in scope for this document (only `.mock.ts`/`.mock.tsx` files and the specific component files listed were read in full).

### Source
`src/components/analytics/lgu-shared.tsx`, exported interface, consumed by `BarangayChoropleth()`.

### Notes
Exported but not directly referenced by any mock file in scope — documented because it is a named, exported interface in an in-scope component file.

## Table: CalendarDay

**Description:** One day cell of the eKAS-submission calendar heatmap (Konsulta PhilHealth claims cutoff tracker).

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| date | number | — | Day-of-month number (1–31). |
| weekday | number | — | 0 = Sunday .. 6 = Saturday. |
| submitted | number | — | Count of eKAS claims submitted that day. |
| pending | number | — | Count of eKAS claims still pending that day. |
| isCutoff | boolean (optional) | — | True if this date is the PhilHealth submission cutoff day. |
| isPast | boolean | — | True if the date is on/before the mocked "today" (Aug 7, 2026 in `konsulta.mock.ts`). Required field, not optional. |

### Relationships
- Produced by `buildCalendar()` inside `getKonsultaData()` in `src/lib/analytics/lgu/konsulta.mock.ts`, which imports this type directly rather than redeclaring it.

### Source
`src/components/analytics/lgu-shared.tsx`, exported interface, consumed by `CalendarHeatmap()`.

### Notes
None.

---

# Part 3 — Hospital ("Type A") Dashboard Mock Data

## File: `src/lib/analytics.mock.ts` (LEGACY — ORPHANED)

**This file is only reachable via `src/components/analytics/dashboard.tsx`, which is itself not imported or routed anywhere in the app** (confirmed by searching the whole `src/` tree for imports of `components/analytics/dashboard` — zero results). All of the newer, actively-routed hospital dashboards use `executive.mock.ts`, `clinical.mock.ts`, etc. instead. This file/component pair appears to be a first-draft predecessor kept in the repo but not wired into any route. Documented in full per the task brief, but treat everything below as dead code, not as the live schema.

## Table: KpiMetric (legacy)

**Description:** One KPI tile on the legacy Medical Director dashboard (bed occupancy, ALOS, ER admissions, etc.).

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| id | string | PK | KPI slug, e.g. `"bed-occupancy"`. |
| label | string | — | Display label. |
| value | string | — | Pre-formatted current value, e.g. `"82.4%"`. |
| delta | number | — | Percentage change vs. prior month. |
| priorValue | string | — | Pre-formatted prior-period value. |
| target | string (optional) | — | Pre-formatted target value, e.g. `"85%"`. |
| status | KpiStatus (`"good" \| "warning" \| "danger" \| "neutral"`) | — | Status tone driving chip color. |
| description | string | — | One-sentence explanation of the metric. |

### Relationships
- Instantiated by the `kpiMetrics: KpiMetric[]` const (10 rows), embedded into `DashboardData.kpis`.
- Note: `KpiMetric` also exists, independently, in `executive.mock.ts`? **No** — `executive.mock.ts` has no `KpiMetric` interface; its KPI-like fields are inlined per-metric objects (`admissions`, `alos`, `bor`, etc.) directly on `ExecutiveData`. No name collision here, just noted for clarity.

### Source
`src/lib/analytics.mock.ts`, exported as `kpiMetrics: KpiMetric[]`, wrapped by `getDashboardData()` / `fetchDashboardData()`.

### Notes
`KpiStatus` is a trivial type alias (`"good" | "warning" | "danger" | "neutral"`), not tabled separately.

## Table: OccupancyPoint (legacy)

**Description:** One day of bed-occupancy trend data (current vs. prior vs. capacity).

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| date | string | — | Day label, e.g. `"Aug 1"`. |
| occupancy | number | — | Current-period occupancy %. |
| prior | number | — | Prior-period occupancy % for the same relative day. |
| capacity | number | — | Total bed capacity (flat 320 across all rows in the mock). |

### Relationships
None identified.

### Source
`src/lib/analytics.mock.ts`, exported as `occupancyData: OccupancyPoint[]`, embedded in `DashboardData.occupancy`.

### Notes
None.

## Table: DepartmentAdmissions (legacy)

**Description:** One department's admission count, current vs. prior period.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| department | string | — | Department name — **note:** uses a different department list than `PH_DEPARTMENTS` (includes `"ENT"`, `"Ophthalmology"`, `"Dermatology"`; omits `"Emergency Medicine"`, `"Cardiology"`, `"Oncology"`). This file predates `ph-constants.ts` and does not import it for departments. |
| current | number | — | Current-period admission count. |
| prior | number | — | Prior-period admission count. |

### Relationships
None identified (department names are free strings, not FK'd to `PH_DEPARTMENTS`).

### Source
`src/lib/analytics.mock.ts`, exported as `departmentAdmissions: DepartmentAdmissions[]`, embedded in `DashboardData.departmentAdmissions`.

### Notes
None.

## Table: OrUtilizationPoint (legacy)

**Description:** One day-of-week OR utilization summary.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| date | string | — | Weekday label, e.g. `"Mon"`. |
| scheduled | number | — | Scheduled OR case count. |
| completed | number | — | Completed OR case count. |
| utilization | number | — | Utilization percentage (pre-computed, not derived at render time). |

### Relationships
None identified.

### Source
`src/lib/analytics.mock.ts`, exported as `orUtilization: OrUtilizationPoint[]`, embedded in `DashboardData.orUtilization`.

### Notes
None.

## Table: DiagnosisTop (legacy)

**Description:** One top-diagnosis row for the legacy dashboard's diagnosis chart.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| code | string | — | ICD-10 code, sourced from `PH_TOP_DIAGNOSES`. |
| description | string | — | Full clinical description. |
| commonName | string | — | Short chart-axis label. |
| count | number | — | Case count for the current period. |

### Relationships
- Built from `PH_TOP_DIAGNOSES.slice(0, 10)` — this is one of the few places this legacy file does reach into `ph-constants.ts` (it imports `PH_TOP_DIAGNOSES` only, nothing else).

### Source
`src/lib/analytics.mock.ts`, exported as `topDiagnoses: DiagnosisTop[]`, embedded in `DashboardData.topDiagnoses`.

### Notes
None.

## Table: QualityEventPoint (legacy)

**Description:** One week of patient-safety event counts.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| date | string | — | Week label, e.g. `"Week 1"`. |
| falls | number | — | Fall incident count. |
| infections | number | — | Infection event count. |
| medicationErrors | number | — | Medication error count. |

### Relationships
None identified.

### Source
`src/lib/analytics.mock.ts`, exported as `qualityEvents: QualityEventPoint[]`, embedded in `DashboardData.qualityEvents`.

### Notes
None.

## Table: VolumePoint (legacy)

**Description:** One day of patient-volume trend data (admissions, discharges, ED visits). **Same name as, but a different shape from,** `VolumePoint` in `executive.mock.ts` — see Known Cross-File Inconsistencies #3.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| date | string | — | Day label, e.g. `"Aug 1"`. |
| admissions | number | — | Admission count that day. |
| discharges | number | — | Discharge count that day. |
| edVisits | number | — | Emergency Department visit count that day. |

### Relationships
None identified.

### Source
`src/lib/analytics.mock.ts`, exported as `volumeData: VolumePoint[]`, embedded in `DashboardData.volume`.

### Notes
None.

## Table: PatientAlert (legacy)

**Description:** One clinical/operational alert row on the legacy dashboard. Predates, and is unrelated in shape to, the shared `AlertItem` type used by the (live) Alert & Notification Center tool.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| id | string | PK | Alert id, e.g. `"ALT-1024"`. |
| date | string | — | ISO date the alert was raised. |
| patientId | string | — | Patient identifier, e.g. `"PT-2026-00491"`. Free-text, not FK-enforced to any patient table. |
| patientName | string | — | Patient display name (Last, First M. format). |
| age | number | — | Patient age. |
| gender | `"male" \| "female"` | — | Patient gender. |
| category | `"Critical Result" \| "High Risk" \| "Safety Event" \| "Readmission" \| "Pending Claim"` | — | Alert category. |
| source | string | — | Free-text FHIR-style resource reference, e.g. `"DiagnosticReport/LAB-8842"`. |
| department | string | — | Department name (free string). |
| summary | string | — | One-line clinical summary. |
| status | `"Open" \| "Acknowledged" \| "Resolved"` | — | Alert workflow status. |
| priority | `"High" \| "Medium" \| "Low"` | — | Alert priority. |

### Relationships
- `source` is a free-text FHIR-resource-style reference string (e.g. `Claim/PH-2026-1182`) — not a real FK, purely illustrative/display text.

### Source
`src/lib/analytics.mock.ts`, exported as `patientAlerts: PatientAlert[]`, embedded in `DashboardData.alerts`.

### Notes
None.

## Table: DashboardData (legacy — top-level wrapper)

**Description:** Top-level payload returned by `getDashboardData()`/`fetchDashboardData()` for the legacy, orphaned Medical Director dashboard.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| period | string | — | Current period label, e.g. `"August 2026"`. |
| priorPeriod | string | — | Prior period label. |
| generatedAt | string | — | ISO timestamp of generation (`new Date().toISOString()` — non-deterministic, the one place this file breaks from the "no `Math.random`, deterministic" convention used elsewhere). |
| tenant | string | — | Facility name, `"Cebu City Medical Center"`. |
| role | string | — | Viewer role label. |
| kpis | KpiMetric[] | — | See **KpiMetric (legacy)**. |
| occupancy | OccupancyPoint[] | — | See **OccupancyPoint (legacy)**. |
| departmentAdmissions | DepartmentAdmissions[] | — | See **DepartmentAdmissions (legacy)**. |
| orUtilization | OrUtilizationPoint[] | — | See **OrUtilizationPoint (legacy)**. |
| topDiagnoses | DiagnosisTop[] | — | See **DiagnosisTop (legacy)**. |
| qualityEvents | QualityEventPoint[] | — | See **QualityEventPoint (legacy)**. |
| volume | VolumePoint[] | — | See **VolumePoint (legacy)**. |
| alerts | PatientAlert[] | — | See **PatientAlert (legacy)**. |

### Relationships
- Aggregates all other tables in this file.

### Source
`src/lib/analytics.mock.ts`, produced by `getDashboardData()` / `fetchDashboardData()`.

### Notes
Reachable only via the orphaned `src/components/analytics/dashboard.tsx` (imports `DashboardData, fetchDashboardData, KpiMetric, PatientAlert` from this file). No route in the app renders that component.

---

## File: `src/lib/analytics/executive.mock.ts`

Mock data for the live Executive Analytics dashboard (Type A — Level 3 Hospital). Imports `KONSULTA_EKAS_RATE, PH_DEPARTMENTS, PH_DIAGNOSIS_CASE_RATES, PH_PAYER_MIX, PH_PHYSICIANS, PH_TOP_DIAGNOSES, TARGET_ADMISSIONS_PER_MONTH, phPatientName` from `ph-constants.ts` and calls `phPatientName` correctly (gender-aware).

## Table: AdmissionRow

**Description:** One inpatient admission encounter, used by the Executive dashboard's admissions table/drill-down.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| encounterId | string | PK | Encounter id, e.g. `"ENC-2026-4200"`. |
| patient | string | — | Patient display name, from `phPatientName()`. |
| patientId | string | — | Patient id, e.g. `"PT-2026-00300"`. |
| age | number | — | Patient age. |
| gender | `"male" \| "female"` | — | Patient gender. |
| diagnosis | string | — | Diagnosis description, from `PH_TOP_DIAGNOSES`. |
| icd10 | string | FK -> IcdEntry.code (informal) | ICD-10 code, from `PH_TOP_DIAGNOSES`. |
| physician | string | FK -> PH_PHYSICIANS (informal) | Attending physician name. |
| department | string | FK -> PH_DEPARTMENTS (informal) | Department name. |
| los | number | — | Length of stay, in days. |
| disposition | `"Recovered" \| "Improved" \| "Transferred" \| "HAMA" \| "Expired"` | — | Discharge disposition. |
| admittedOn | string | — | ISO-ish date string (`"2026-08-DD"`). |

### Relationships
- `icd10`/`diagnosis` are sourced positionally from `PH_TOP_DIAGNOSES` (via a local `diagnoses: [string,string][]` derived array) — informal FK on `code`.
- `physician` values come directly from `PH_PHYSICIANS`; `department` from `PH_DEPARTMENTS` — both informal FKs (string match only, no id column).

### Source
`src/lib/analytics/executive.mock.ts`, produced by `buildAdmissions(40)`, embedded in `ExecutiveData.admissions.rows`.

### Notes
None.

## Table: VolumePoint (executive)

**Description:** One month of hospital-wide volume by service line. **Same name as, but a different shape from,** the legacy `VolumePoint` in `analytics.mock.ts` — see Known Cross-File Inconsistencies #3. Also independently redeclared (identical shape) in `revenue.mock.ts`? **No** — `revenue.mock.ts` has no `VolumePoint`; only `executive.mock.ts` and the legacy file share the name.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| month | string | — | Month label, e.g. `"Sep 25"`. |
| inpatient | number | — | Inpatient admission volume. |
| opd | number | — | Outpatient department visit volume. |
| emergency | number | — | Emergency visit volume. |
| daySurgery | number | — | Day-surgery case volume. |
| priorInpatient | number | — | Prior-year inpatient volume for the same month, for YoY comparison. |

### Relationships
None identified.

### Source
`src/lib/analytics/executive.mock.ts`, computed inline as `volume: VolumePoint[]`, embedded in `ExecutiveData.volume`.

### Notes
None.

## Table: PayerSlice (executive)

**Description:** One payer's share of gross revenue, for the payer-mix donut/bar chart. Same shape as, but independently declared from, `PayerSlice` in `revenue.mock.ts` — see Known Cross-File Inconsistencies #3.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| payer | string | — | Payer name, e.g. `"PhilHealth"`, `"HMO"`, `"SC/PWD Discount"`. |
| amount | number | — | PHP amount attributed to this payer. |
| color | string | — | Hex color for the chart slice. |

### Relationships
- `amount` values are derived from `PH_PAYER_MIX` fractions applied to total gross revenue — informal, computed (not stored) relationship.

### Source
`src/lib/analytics/executive.mock.ts`, computed inline, embedded in `ExecutiveData.revenue.byPayer`.

### Notes
None.

## Table: PayerTrendPoint (executive)

**Description:** One month of revenue broken out by payer, for the payer-mix trend chart. Same shape as, but independently declared from, `PayerTrendPoint` in `revenue.mock.ts` — see Known Cross-File Inconsistencies #3.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| month | string | — | Month label. |
| philhealth | number | — | PHP revenue from PhilHealth. |
| hmo | number | — | PHP revenue from HMO. |
| privatePay | number | — | PHP revenue from private pay. |
| scpwd | number | — | PHP revenue foregone/discounted for SC/PWD. |
| gsis | number | — | PHP revenue from GSIS/other government. |
| writeoff | number | — | PHP written off. |

### Relationships
None identified beyond the `PH_PAYER_MIX` fraction basis noted above.

### Source
`src/lib/analytics/executive.mock.ts`, computed inline over `months.slice(6)`, embedded in `ExecutiveData.revenue.payerTrend`.

### Notes
None.

## Table: DiagnosisRow

**Description:** One top-diagnosis row with case-rate and trend data, for the Executive dashboard's diagnosis chart.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| code | string | FK -> IcdEntry.code (informal) | ICD-10 code. |
| description | string | — | Full clinical description. |
| commonName | string | — | Short chart-axis label. |
| count | number | — | Case count for the current period. |
| caseRate | number | — | PhilHealth case rate in PHP, from `PH_DIAGNOSIS_CASE_RATES`. |
| avgLos | number | — | Average length of stay for this diagnosis. |
| trend | number[] | — | 6-point trailing trend series (unlabeled index, not paired with month names). |

### Relationships
- `code` sourced from `PH_TOP_DIAGNOSES`; `caseRate` looked up from `PH_DIAGNOSIS_CASE_RATES[code]` with a `10_000` fallback if missing — informal FK.

### Source
`src/lib/analytics/executive.mock.ts`, computed inline, embedded in `ExecutiveData.topDiagnoses`.

### Notes
None.

## Table: ClaimStatusSlice

**Description:** One claims-pipeline status bucket with PHP value, for the Executive dashboard's claims-status chart.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| status | string | — | Status label, e.g. `"Submitted"`, `"RTN Pending"`, `"Approved"`, `"Denied"`, `"Returned-to-Hospital"`. |
| count | number | — | Claim count in this status. |
| value | number | — | PHP value of claims in this status. |
| color | string | — | Hex color for the chart slice. |

### Relationships
None identified.

### Source
`src/lib/analytics/executive.mock.ts`, hardcoded in `getExecutiveData()`, embedded in `ExecutiveData.claims.statuses`.

### Notes
None.

## Table: DenialReason (executive)

**Description:** One PhilHealth claim-denial reason with financial impact, for the Executive dashboard's denial summary. Same name as, but a different (superset) shape from, `DenialReason` in `lgu/konsulta.mock.ts` — see Known Cross-File Inconsistencies #3.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| code | string | — | Denial reason code, e.g. `"DR-101"`. |
| reason | string | — | Short reason label. |
| count | number | — | Number of claims denied for this reason. |
| valueAtRisk | number | — | PHP value at risk from this denial reason. |
| action | string | — | Recommended remediation action, free text. |

### Relationships
None identified.

### Source
`src/lib/analytics/executive.mock.ts`, hardcoded in `getExecutiveData()`, embedded in `ExecutiveData.claims.denialReasons`.

### Notes
None.

## Table: LabTatCategory

**Description:** One laboratory test category's turn-around-time (TAT) compliance summary, for the Executive dashboard's lab compliance chart.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| category | string | — | Lab category name, e.g. `"Hematology"`, `"Microbiology"`. |
| compliance | number | — | TAT compliance percentage. |
| target | number | — | Target compliance percentage. |
| median | number | — | Median TAT in hours (or minutes for fast categories — unit not distinguished in the type; **Needs verification** against consuming UI for exact unit). |

### Relationships
None identified. Category names here are free strings, not FK'd to `LabCategory` in `laboratory.mock.ts` even though the value sets overlap.

### Source
`src/lib/analytics/executive.mock.ts`, hardcoded in `getExecutiveData()`, embedded in `ExecutiveData.lab.byCategory`.

### Notes
None.

## Table: ActionAlert

**Description:** One actionable alert card on the Executive dashboard (distinct from the shared `AlertItem` type used by the Alert & Notification Center tool — this is an older, simpler, Executive-dashboard-only shape).

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| id | string | PK | Alert id, e.g. `"AL-1"`. |
| title | string | — | Alert title. |
| detail | string | — | Supporting detail text. |
| count | number | — | Count associated with the alert (e.g. number of claims). |
| severity | `"danger" \| "warning" \| "neutral"` | — | Severity tone (note: only 3 values, vs. `AlertSeverity`'s `critical/warning/info`). |
| actionLabel | string | — | Label for the action button. |
| module | string | — | Source module label, e.g. `"Claims"`, `"Laboratory"`. |

### Relationships
None identified.

### Source
`src/lib/analytics/executive.mock.ts`, hardcoded in `getExecutiveData()`, embedded in `ExecutiveData.alerts`.

### Notes
None.

## Table: ExecutiveData (top-level wrapper)

**Description:** Top-level payload returned by `getExecutiveData()`/`fetchExecutiveData()` for the live hospital Executive dashboard. Most nested keys are anonymous inline object shapes (no separate named interface), noted as such below.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| tenant | string | — | `"Cebu City Medical Center"`. |
| period | string | — | Current period label. |
| priorPeriod | string | — | Prior period label. |
| admissions | inline `{total, deltaMonth, deltaYear, rows: AdmissionRow[]}` | — | Admission KPI + row-level detail; `rows` -> **AdmissionRow[]**. |
| alos | inline `{value, delta, byDepartment, byChapter, byAdmissionType}` (each breakdown an anonymous `{name, value}[]`) | — | Average length-of-stay KPI + breakdowns. |
| bor | inline `{value, delta, byWard: {name,value}[], trend: {month,value}[]}` | — | Bed occupancy rate KPI + breakdowns. |
| revenue | inline `{total, delta, byDepartment, byServiceType, byPayer: PayerSlice[], payerTrend: PayerTrendPoint[]}` | — | Revenue KPI; `byPayer` -> **PayerSlice (executive)[]**, `payerTrend` -> **PayerTrendPoint (executive)[]**. |
| remittance | inline `{received, expected, delta, batches: {batch,caseType,claims,amount,status}[]}` | — | PhilHealth remittance KPI + batch detail (anonymous row shape). |
| approvalRate | inline `{value, delta, byDepartment: {name,value}[]}` | — | Claims approval-rate KPI. |
| mortality | inline `{value, delta, byDepartment, byDiagnosis}` (anonymous `{name,value}[]`) | — | Mortality KPI + breakdowns. |
| satisfaction | inline `{value, delta, byDepartment: {name,value}[]}` | — | Patient satisfaction KPI. |
| volume | VolumePoint (executive)[] | — | See **VolumePoint (executive)**. |
| topDiagnoses | DiagnosisRow[] | — | See **DiagnosisRow**. |
| claims | inline `{statuses: ClaimStatusSlice[], denialReasons: DenialReason (executive)[]}` | — | Claims summary sub-object. |
| lab | inline `{compliance, target, byCategory: LabTatCategory[], trend: {day,value}[]}` | — | Lab compliance summary sub-object. |
| alerts | ActionAlert[] | — | See **ActionAlert**. |

### Relationships
- Aggregates `AdmissionRow`, `VolumePoint (executive)`, `PayerSlice (executive)`, `PayerTrendPoint (executive)`, `DiagnosisRow`, `ClaimStatusSlice`, `DenialReason (executive)`, `LabTatCategory`, `ActionAlert`.

### Source
`src/lib/analytics/executive.mock.ts`, produced by `getExecutiveData()` / `fetchExecutiveData()`.

### Notes
Many nested breakdown arrays (`byDepartment`, `byChapter`, `byWard`, etc.) share the same anonymous `{name: string; value: number}` shape but are not backed by a single named type — each is inlined separately on the `ExecutiveData` interface.

---

## File: `src/lib/analytics/clinical.mock.ts`

Mock data for the Clinical Analytics dashboard. Imports `PH_DEPARTMENTS, PH_DEPARTMENT_COLORS, PH_PHYSICIANS, PH_TOP_DIAGNOSES, phPatientName` from `ph-constants.ts` (and calls `phPatientName` correctly).

## Table: IcdCode

**Description:** A minimal ICD-10 code/description pair, re-declared here as its own interface even though `ICD_CODES` is assigned directly from `PH_TOP_DIAGNOSES` (which is typed as `IcdEntry[]`, a structural superset of `IcdCode`).

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| code | string | — | ICD-10 code. |
| description | string | — | Full clinical description. |

### Relationships
- `ICD_CODES: IcdCode[] = PH_TOP_DIAGNOSES` — direct re-export/assignment of the `ph-constants.ts` diagnosis list under a locally-typed name; structurally compatible with `IcdEntry` (TypeScript structural typing allows the extra `commonName` field to be ignored) but declared as its own, narrower interface rather than importing `IcdEntry`.

### Source
`src/lib/analytics/clinical.mock.ts`, exported as `ICD_CODES: IcdCode[]`.

### Notes
None.

## Table: HeatmapCell

**Description:** One department × month cell in the Clinical dashboard's admission-volume heatmap.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| department | Department (`= (typeof PALETTE_DEPTS)[number]`, i.e. one of the 8 `PH_DEPARTMENTS` values) | FK -> PH_DEPARTMENTS (informal) | Department name. |
| month | string | — | Month label, e.g. `"Sep 25"`. |
| count | number | — | Admission count for that department/month. |

### Relationships
- Keyed (informally, by string concatenation `` `${department}__${month}` ``) into `heatmapDrill: Record<string, HeatmapDrillCase[]>` on `ClinicalData` for drill-down.

### Source
`src/lib/analytics/clinical.mock.ts`, produced by `buildHeatmap()`, embedded in `ClinicalData.heatmap`.

### Notes
`Department` is a trivial type alias, not tabled separately.

## Table: HeatmapDrillCase

**Description:** One case-level row shown when a user drills into a `HeatmapCell`.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| encounterId | string | PK | Encounter id. |
| patient | string | — | Patient display name, from `phPatientName()`. |
| physician | string | FK -> PH_PHYSICIANS (informal) | Attending physician name. |
| icd10 | string | FK -> IcdCode.code (informal) | ICD-10 code. |
| outcome | string | — | Discharge outcome label (free string; overlaps but is not typed against `AdmissionRow.disposition`'s literal union). |

### Relationships
- Value of the `Record<string, HeatmapDrillCase[]>` keyed by `` `${department}__${month}` `` — see **HeatmapCell**.

### Source
`src/lib/analytics/clinical.mock.ts`, produced by `buildHeatmapDrill()`, embedded in `ClinicalData.heatmapDrill`.

### Notes
None.

## Table: DiseaseTrendSeries

**Description:** One diagnosis's monthly case-count and rate-per-1000 trend series, for the Clinical dashboard's disease-trend line chart.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| code | string | FK -> IcdCode.code (informal) | ICD-10 code. |
| description | string | — | Full clinical description. |
| color | string | — | Hex color for the trend line. |
| points | inline `{month: string; count: number; ratePer1000: number}[]` | — | 12-month trend series (anonymous shape, not a named type). |

### Relationships
- Built from `ICD_CODES.slice(0, 6)` — top 6 of the 12 canonical diagnoses.

### Source
`src/lib/analytics/clinical.mock.ts`, produced by `buildDiseaseTrends()`, embedded in `ClinicalData.diseaseTrends`.

### Notes
None.

## Table: ComorbidityBubble

**Description:** One primary/comorbid diagnosis pair, for the Clinical dashboard's comorbidity bubble chart.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| id | string | PK | Bubble id, e.g. `"COM-0"`. |
| primaryDx | string | FK -> IcdCode.code (informal) | Primary diagnosis ICD-10 code. |
| comorbidDx | string | FK -> IcdCode.code (informal) | Comorbid diagnosis ICD-10 code. |
| department | Department | FK -> PH_DEPARTMENTS (informal) | Department associated with this pairing. |
| frequency | number | — | Co-occurrence frequency count. |
| avgLos | number | — | Average length of stay for this pairing. |
| mortalityRate | number | — | Mortality rate percentage for this pairing. |
| color | string | — | Hex color, looked up from `DEPT_COLORS[department]` (i.e. `PH_DEPARTMENT_COLORS`). |

### Relationships
- `color` is an informal FK lookup into `PH_DEPARTMENT_COLORS` via `department`.
- `primaryDx`/`comorbidDx` are hardcoded pairs from a fixed 8-pair list of ICD-10 codes (some from `PH_TOP_DIAGNOSES`, others like none outside it — all 8 pairs use codes present in `PH_TOP_DIAGNOSES`).

### Source
`src/lib/analytics/clinical.mock.ts`, produced by `buildComorbidity()`, embedded in `ClinicalData.comorbidity`.

### Notes
None.

## Table: ProcedureNode

**Description:** One surgical/procedure line item, for the Clinical dashboard's procedure-revenue treemap.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| name | string | — | Procedure name, e.g. `"Appendectomy"`. |
| category | string | — | Procedure category, e.g. `"General Surgery"`. |
| volume | number | — | Case volume. |
| revenue | number | — | Total PHP revenue (`volume * avgRevenuePerCase`). |
| avgRevenuePerCase | number | — | Average PHP revenue per case. |

### Relationships
- Nested under `{category, children: ProcedureNode[]}[]` on `ClinicalData.procedures` — the outer `category` wrapper is an anonymous shape, not a named type.

### Source
`src/lib/analytics/clinical.mock.ts`, produced by `buildProcedures()`, embedded in `ClinicalData.procedures[].children`.

### Notes
None.

## Table: SurgeonRow

**Description:** One surgeon's case volume, outcomes, and revenue summary, for the Clinical dashboard's surgeon-performance table.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| name | string | — | Surgeon name (from a local 6-name subset of `PH_PHYSICIANS`-style names, hardcoded locally as `surgeonNames`, not imported from `PH_PHYSICIANS`). |
| department | Department | FK -> PH_DEPARTMENTS (informal) | Department. |
| cases | number | — | Case volume. |
| avgLos | number | — | Average length of stay. |
| complicationRate | number | — | Complication rate percentage. |
| mortalityRate | number | — | Mortality rate percentage. |
| avgOrTimeMin | number | — | Average OR time in minutes. |
| revenue | number | — | Total PHP revenue attributed to this surgeon. |
| trend | number[] | — | 8-point trailing trend series (unlabeled index). |

### Relationships
- `name` values (`"Dr. E. Villaraza"`, `"Dr. F. Nazareno"`, `"Dr. G. Suarez"`, `"Dr. H. Tolentino"`, `"Dr. I. Aquino"`, `"Dr. J. Villamor"`) happen to be an exact subset of `PH_PHYSICIANS`, but are hardcoded locally rather than filtered/imported from it — informal, coincidental overlap, not an enforced relationship.

### Source
`src/lib/analytics/clinical.mock.ts`, produced by `buildSurgeons()`, embedded in `ClinicalData.surgeons`.

### Notes
None.

## Table: OrBlock

**Description:** One scheduled OR block (a surgeon/procedure occupying an operating room for part of a day).

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| room | string | — | OR room label, e.g. `"OR-1"`. |
| procedure | string | — | Procedure name. |
| surgeon | string | FK -> SurgeonRow.name (informal) | Surgeon name. |
| startHour | number | — | Block start hour (24h clock, fractional not used). |
| durationHours | number | — | Block duration in hours (can be fractional, e.g. `1.75`). |

### Relationships
- Nested under `{room, blocks: OrBlock[], utilizationPct: number}[]` on `ClinicalData.orRooms` — outer wrapper is an anonymous shape.
- `surgeon` values are drawn from the same local `surgeonNames` pool as `SurgeonRow.name` — informal FK.

### Source
`src/lib/analytics/clinical.mock.ts`, produced by `buildOrRooms()`, embedded in `ClinicalData.orRooms[].blocks`.

### Notes
None.

## Table: DischargeMonth

**Description:** One month of discharge-disposition counts, for the Clinical dashboard's discharge-outcomes stacked bar chart.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| month | string | — | Month label. |
| Recovered | number | — | Count of "Recovered" dispositions (note: PascalCase field name, matching the `AdmissionRow.disposition` literal values used as keys). |
| Improved | number | — | Count of "Improved" dispositions. |
| Transferred | number | — | Count of "Transferred" dispositions. |
| HAMA | number | — | Count of "HAMA" (Home Against Medical Advice) dispositions. |
| Expired | number | — | Count of "Expired" dispositions. |

### Relationships
- Field names mirror `AdmissionRow.disposition`'s literal union values exactly, but this is not type-enforced (they are independently spelled out as object keys here).

### Source
`src/lib/analytics/clinical.mock.ts`, produced by `buildDischarge()`, embedded in `ClinicalData.discharge`.

### Notes
None.

## Table: ReadmissionPoint

**Description:** One month of 30-day readmission rate, for the Clinical dashboard's readmission trend chart.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| month | string | — | Month label. |
| rate | number | — | Readmission rate percentage. |

### Relationships
None identified.

### Source
`src/lib/analytics/clinical.mock.ts`, produced by `buildReadmission()`, embedded in `ClinicalData.readmission`.

### Notes
None.

## Table: ReadmissionCase

**Description:** One case-level readmission row, for the Clinical dashboard's readmission drill-down table.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| patient | string | — | Patient display name, from `phPatientName()`. |
| originalDx | string | FK -> IcdCode.description (informal) | Original diagnosis description. |
| department | Department | FK -> PH_DEPARTMENTS (informal) | Department. |
| physician | string | FK -> PH_PHYSICIANS (informal) | Attending physician name. |
| daysToReadmit | number | — | Days between discharge and readmission. |

### Relationships
None beyond the informal FKs noted.

### Source
`src/lib/analytics/clinical.mock.ts`, produced by `buildReadmissionCases()`, embedded in `ClinicalData.readmissionCases`.

### Notes
None.

## Table: HamaDept

**Description:** One department's HAMA (discharge Against Medical Advice) rate, for the Clinical dashboard's HAMA-by-department chart.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| department | Department | FK -> PH_DEPARTMENTS (informal) | Department. |
| rate | number | — | HAMA rate percentage. |

### Relationships
None identified.

### Source
`src/lib/analytics/clinical.mock.ts`, produced by `buildHamaByDept()`, embedded in `ClinicalData.hamaByDept`.

### Notes
None.

## Table: SankeyLink

**Description:** One source→target patient-flow link, for the Clinical dashboard's referral-flow Sankey diagram.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| source | string | — | Source node label, e.g. `"OPD / ER Intake"`, `"Barangay Health Center"`. |
| target | string | — | Target node label, e.g. `"Internal Medicine"`, `"ICU"`. |
| volume | number | — | Flow volume (case count). |
| kind | `"internal" \| "external" \| "emergency"` | — | Flow classification, drives link styling. |

### Relationships
- `` `${source}__${target}` `` string key informally links each `SankeyLink` to its `ReferralCase[]` bucket in `ClinicalData.referralCases`.

### Source
`src/lib/analytics/clinical.mock.ts`, produced by `buildReferralFlow()`, embedded in `ClinicalData.referralFlow`.

### Notes
None.

## Table: ReferralCase

**Description:** One case-level row for a given source→target referral link, for drill-down.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| patient | string | — | Patient label — **note:** hardcoded as literal `` `Patient ${i + 1}` `` placeholder text, not `phPatientName()`. |
| status | `"Accepted" \| "Pending" \| "Declined" \| "Completed"` | — | Referral status. |
| date | string | — | ISO-ish date string. |

### Relationships
- Value of `Record<string, ReferralCase[]>` keyed by `` `${source}__${target}` `` — see **SankeyLink**.

### Source
`src/lib/analytics/clinical.mock.ts`, produced by `buildReferralCases()`, embedded in `ClinicalData.referralCases`.

### Notes
`patient` values are generic placeholders (`"Patient 1"`, `"Patient 2"`, ...), not run through `phPatientName()` — inconsistent with the rest of the file's patient-naming convention.

## Table: SpecialtyAcceptance

**Description:** One outside specialty's referral acceptance-rate and response-time summary.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| specialty | string | — | Specialty name, e.g. `"Cardiology"`, `"Nephrology"` (a separate, hardcoded 6-item list, distinct from `PH_DEPARTMENTS`). |
| acceptanceRate | number | — | Acceptance rate percentage. |
| avgResponseHours | number | — | Average response time in hours. |

### Relationships
None identified.

### Source
`src/lib/analytics/clinical.mock.ts`, produced by `buildSpecialtyAcceptance()`, embedded in `ClinicalData.specialtyAcceptance`.

### Notes
None.

## Table: ClinicalData (top-level wrapper)

**Description:** Top-level payload returned by `getClinicalData()`/`fetchClinicalData()` for the Clinical Analytics dashboard.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| tenant | string | — | Facility name. |
| period | string | — | Current period label. |
| heatmap | HeatmapCell[] | — | See **HeatmapCell**. |
| heatmapMonths | string[] | — | 12-month axis labels for the heatmap. |
| heatmapDrill | Record<string, HeatmapDrillCase[]> | — | See **HeatmapDrillCase**. |
| diseaseTrends | DiseaseTrendSeries[] | — | See **DiseaseTrendSeries**. |
| comorbidity | ComorbidityBubble[] | — | See **ComorbidityBubble**. |
| procedures | inline `{category: string; children: ProcedureNode[]}[]` | — | See **ProcedureNode**. |
| surgeons | SurgeonRow[] | — | See **SurgeonRow**. |
| orRooms | inline `{room: string; blocks: OrBlock[]; utilizationPct: number}[]` | — | See **OrBlock**. |
| discharge | DischargeMonth[] | — | See **DischargeMonth**. |
| readmission | ReadmissionPoint[] | — | See **ReadmissionPoint**. |
| readmissionCases | ReadmissionCase[] | — | See **ReadmissionCase**. |
| hamaByDept | HamaDept[] | — | See **HamaDept**. |
| referralFlow | SankeyLink[] | — | See **SankeyLink**. |
| referralCases | Record<string, ReferralCase[]> | — | See **ReferralCase**. |
| specialtyAcceptance | SpecialtyAcceptance[] | — | See **SpecialtyAcceptance**. |

### Relationships
- Aggregates all tables in this file.

### Source
`src/lib/analytics/clinical.mock.ts`, produced by `getClinicalData()` / `fetchClinicalData()`.

### Notes
Also exports `DEPT_COLOR_MAP = DEPT_COLORS` (i.e. `PH_DEPARTMENT_COLORS`) as a convenience re-export; not a type.

---

## File: `src/lib/analytics/revenue.mock.ts`

Mock data for the Revenue Cycle & Billing Analytics dashboard. Imports `PH_DEPARTMENTS, PH_MEMBERSHIP_DISTRIBUTION, PH_PAYER_MIX, phPatientName` from `ph-constants.ts` (calls `phPatientName` correctly).

## Table: WaterfallStep

**Description:** One step of the gross-charges-to-net-collections waterfall chart.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| key | string | PK | Step slug, e.g. `"gross"`, `"scpwd"`, `"net"`. |
| label | string | — | Display label. |
| base | number | — | Base (floor) value for rendering the waterfall bar. |
| value | number | — | Step value (positive for start/end, magnitude of deduction for deduction steps). |
| kind | `"start" \| "deduction" \| "end"` | — | Step classification. |
| detail | inline `{item: string; amount: number}[]` | — | Line-item breakdown shown on drill-down. |

### Relationships
None identified.

### Source
`src/lib/analytics/revenue.mock.ts`, computed inline inside `getRevenueData()`, embedded in `RevenueData.waterfall`.

### Notes
None.

## Table: PayerSlice (revenue)

**Description:** One payer's share of gross charges. Same shape as, but independently declared from, `PayerSlice` in `executive.mock.ts` — see Known Cross-File Inconsistencies #3.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| payer | string | — | Payer name. |
| amount | number | — | PHP amount. |
| color | string | — | Hex color. |

### Relationships
- `amount` derived from `PH_PAYER_MIX` fractions.

### Source
`src/lib/analytics/revenue.mock.ts`, computed inline, embedded in `RevenueData.payerMix`.

### Notes
None.

## Table: PayerTrendPoint (revenue)

**Description:** One month of gross charges broken out by payer. Same shape as, but independently declared from, `PayerTrendPoint` in `executive.mock.ts` — see Known Cross-File Inconsistencies #3.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| month | string | — | Month label. |
| philhealth | number | — | PHP amount. |
| hmo | number | — | PHP amount. |
| privatePay | number | — | PHP amount. |
| scpwd | number | — | PHP amount. |
| gsis | number | — | PHP amount. |
| writeoff | number | — | PHP amount. |

### Relationships
None identified.

### Source
`src/lib/analytics/revenue.mock.ts`, computed inline over a 6-month window, embedded in `RevenueData.payerTrend`.

### Notes
None.

## Table: DeptRevenueRow

**Description:** One department's revenue breakdown by payer, with top procedures/diagnoses.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| department | string | FK -> PH_DEPARTMENTS (informal) | Department name. |
| philhealth | number | — | PHP revenue from PhilHealth. |
| hmo | number | — | PHP revenue from HMO. |
| privatePay | number | — | PHP revenue from private pay. |
| scpwd | number | — | PHP revenue from SC/PWD. |
| gsis | number | — | PHP revenue from GSIS. |
| total | number | — | Sum of the 5 payer columns. |
| topProcedures | inline `{name: string; amount: number}[]` | — | Top 3 procedures by revenue, from a hardcoded 8-item procedure pool. |
| topDiagnoses | inline `{name: string; amount: number}[]` | — | Top 3 diagnoses by revenue, from a hardcoded 6-item diagnosis-label pool (free-text labels like `"Type 2 diabetes (E11.9)"`, not structured `{code, description}`). |

### Relationships
None identified beyond the informal department FK.

### Source
`src/lib/analytics/revenue.mock.ts`, computed inline (sorted by `total` desc), embedded in `RevenueData.departmentRevenue`.

### Notes
None.

## Table: ARAgingRow

**Description:** One payer's accounts-receivable aging bucket summary.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| payer | string | — | Payer name. |
| current | number | — | PHP AR current (not yet aged). |
| d31 | number | — | PHP AR aged 31–60 days (field name suggests "31+"; bucket boundaries not explicit in code — **Needs verification** against the exact bucket definitions used in the UI). |
| d61 | number | — | PHP AR aged 61–90 days (approx; see caveat above). |
| d90 | number | — | PHP AR aged 90+ days. |

### Relationships
None identified.

### Source
`src/lib/analytics/revenue.mock.ts`, hardcoded 5-row array, embedded in `RevenueData.arAging`.

### Notes
Exact day-range boundaries for `d31`/`d61` are inferred from field naming and the `REV.b31`/`REV.b61`/`REV.b90` color constants, not from an explicit bucket-boundary constant in the code — flagged as `Needs verification`.

## Table: ARPatientRow

**Description:** One patient-level AR-over-90-days row, for the collections worklist.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| patient | string | — | Patient display name, from `phPatientName()`. |
| patientId | string | — | Patient id, e.g. `"PT-2026-01200"`. |
| payer | string | FK -> payers list (informal) | Payer name. |
| daysOutstanding | number | — | Days the balance has been outstanding (91+ in this mock). |
| amount | number | — | PHP outstanding amount. |
| lastBillingAction | string | — | Free-text description of the most recent billing action taken. |

### Relationships
None identified.

### Source
`src/lib/analytics/revenue.mock.ts`, produced by `buildPatientRows(18, payers)`, embedded in `RevenueData.arOver90`.

### Notes
None.

## Table: CollectionPoint

**Description:** One period's collection performance, broken out by payer, department, and collection agent.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| period | string | — | Month label. |
| target | number | — | PHP collection target (flat `6,200,000` every period in this mock). |
| philhealth | number | — | PHP collected from PhilHealth. |
| hmo | number | — | PHP collected from HMO. |
| privatePay | number | — | PHP collected from private pay. |
| scpwd | number | — | PHP collected from SC/PWD. |
| emergency | number | — | PHP collected attributed to Emergency department. |
| surgery | number | — | PHP collected attributed to Surgery department. |
| internalMed | number | — | PHP collected attributed to Internal Medicine department. |
| agentA | number | — | PHP collected by Agent A. |
| agentB | number | — | PHP collected by Agent B. |
| agentC | number | — | PHP collected by Agent C. |

### Relationships
None identified. Department/agent breakdowns are flat named fields, not FK'd to `PH_DEPARTMENTS` or any agent roster.

### Source
`src/lib/analytics/revenue.mock.ts`, computed inline over a 6-month window, embedded in `RevenueData.collectionTrend`.

### Notes
None.

## Table: FunnelStage (revenue)

**Description:** One stage of the discharge-to-payment revenue-cycle funnel. Different shape from `PipelineStage` (`claims.mock.ts`) even though both model a claims-like pipeline — see Notes.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| stage | string | — | Stage label, e.g. `"Discharged"`, `"Bill Generated"`, `"Claim Submitted"`, `"Paid"`. |
| count | number | — | Count of encounters at this stage. |
| encounters | inline `{encounterId: string; patient: string; amount: number; daysStuck: number}[]` | — | Encounter-level drill-down rows for this stage. |

### Relationships
None identified.

### Source
`src/lib/analytics/revenue.mock.ts`, computed inline, embedded in `RevenueData.funnel`.

### Notes
`FunnelStage` here is a 4-stage, encounter-drill-down-bearing shape, distinct from `claims.mock.ts`'s simpler `PipelineStage {stage, count, value}` (6 stages, no per-row drill-down array, has a `value` field instead) — both model a "claims funnel" concept but are independently declared with different shapes and different names, so not counted under the strict "identically-named type" inconsistency list, but noted here as a related near-duplicate concept.

## Table: CoverageSlice

**Description:** One PhilHealth membership-category slice, for the Revenue dashboard's PhilHealth coverage donut chart.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| category | string | — | Membership category, e.g. `"Employed"`, `"Indigent/4Ps"`. |
| count | number | — | Estimated member count in this category. |
| color | string | — | Hex color. |

### Relationships
- Directly derived from `PH_MEMBERSHIP_DISTRIBUTION` (category names, shares, and colors all sourced from that `ph-constants.ts` constant) — informal FK.

### Source
`src/lib/analytics/revenue.mock.ts`, computed inline from `PH_MEMBERSHIP_DISTRIBUTION`, embedded in `RevenueData.philhealthCoverage`.

### Notes
None.

## Table: ScPwdPoint

**Description:** One month of Senior Citizen/PWD discount volume and value, for trend charting.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| month | string | — | Month label. |
| patients | number | — | Count of SC/PWD patients. |
| discountAmount | number | — | PHP discount amount given. |

### Relationships
None identified.

### Source
`src/lib/analytics/revenue.mock.ts`, computed inline over a 6-month window, embedded in `RevenueData.scPwdTrend`.

### Notes
None.

## Table: RevenueData (top-level wrapper)

**Description:** Top-level payload returned by `getRevenueData()`/`fetchRevenueData()` for the Revenue Cycle & Billing Analytics dashboard.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| tenant | string | — | Facility name. |
| period | string | — | Current period label. |
| priorPeriod | string | — | Prior period label. |
| kpis | inline `{grossRevenue, netRevenue, collectionRate, daysInAR, writeOffRate}` (each `{value, delta, ...}`) | — | KPI strip sub-object; `grossRevenue` adds `budget`, `daysInAR` adds `benchmark`. |
| waterfall | WaterfallStep[] | — | See **WaterfallStep**. |
| payerMix | PayerSlice (revenue)[] | — | See **PayerSlice (revenue)**. |
| payerTrend | PayerTrendPoint (revenue)[] | — | See **PayerTrendPoint (revenue)**. |
| departmentRevenue | DeptRevenueRow[] | — | See **DeptRevenueRow**. |
| arAging | ARAgingRow[] | — | See **ARAgingRow**. |
| arOver90 | ARPatientRow[] | — | See **ARPatientRow**. |
| collectionTrend | CollectionPoint[] | — | See **CollectionPoint**. |
| funnel | FunnelStage (revenue)[] | — | See **FunnelStage (revenue)**. |
| philhealthCoverage | CoverageSlice[] | — | See **CoverageSlice**. |
| scPwdTrend | ScPwdPoint[] | — | See **ScPwdPoint**. |

### Relationships
- Aggregates all tables in this file.

### Source
`src/lib/analytics/revenue.mock.ts`, produced by `getRevenueData()` / `fetchRevenueData()`.

### Notes
`REV` (a hardcoded hex-color object, not a type) is also exported for reuse by consuming chart components.

---

## File: `src/lib/analytics/claims.mock.ts`

Mock data for the PhilHealth Claims Analytics dashboard. **Zero imports from `ph-constants.ts`** (see Known Cross-File Inconsistencies #1) — every physician, diagnosis, surname, and case-type value is declared locally in this file.

## Table: ClaimsKpis

**Description:** The KPI-strip sub-object at the top of `ClaimsData`; documented as its own table because it is a distinct named interface, even though it is only ever used nested inside `ClaimsData.kpis`.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| submittedMtd | inline `{count, amount, delta}` | — | Claims submitted month-to-date. |
| pendingRtn | inline `{count, oldestDays, delta}` | — | Claims pending RTN (Return-to-Nurse/Hospital) response. |
| approved | inline `{count, amount, rate, delta}` | — | Approved claims. |
| denied | inline `{count, amount, rate, delta}` | — | Denied claims. |
| avgDaysToRtn | inline `{value, target, delta}` | — | Average days to RTN. |
| expectedRemittance | inline `{amount, delta}` | — | Expected PhilHealth remittance. |

### Relationships
None identified.

### Source
`src/lib/analytics/claims.mock.ts`, hardcoded object, embedded in `ClaimsData.kpis`.

### Notes
All 6 sub-fields are anonymous inline object shapes, not separately named types.

## Table: PipelineStage

**Description:** One stage of the claims-submission pipeline (Drafted → Validated → Submitted → RTN Received → Approved → Remittance Received).

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| stage | string | — | Stage label. |
| count | number | — | Claim count at this stage. |
| value | number | — | PHP value of claims at this stage. |

### Relationships
- `stage` value informally keys `pipelineWorklists: Record<string, WorklistClaim[]>` on `ClaimsData`.

### Source
`src/lib/analytics/claims.mock.ts`, hardcoded 6-row array, embedded in `ClaimsData.pipeline`.

### Notes
Distinct from `revenue.mock.ts`'s `FunnelStage` — see that table's Notes.

## Table: DenialTrendPoint

**Description:** One month of denial-rate trend by case type, with optional policy-change annotation.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| month | string | — | Month label. |
| overall | number | — | Overall denial rate percentage. |
| ordinary | number | — | Denial rate for Ordinary case type. |
| catastrophic | number | — | Denial rate for Catastrophic case type. |
| zBenefit | number | — | Denial rate for Z-Benefit case type. |
| policyChange | string (optional) | — | Free-text annotation for a policy change that occurred that month (only set on 2 of 12 rows). |

### Relationships
None identified.

### Source
`src/lib/analytics/claims.mock.ts`, computed inline over 12 months, embedded in `ClaimsData.denialTrend`.

### Notes
None.

## Table: DenialReasonRow

**Description:** One PhilHealth claim-denial reason, with trend direction and remediation action — the Claims dashboard's more detailed sibling of `executive.mock.ts`'s `DenialReason`.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| code | string | PK | Denial code, e.g. `"DR-101"`. |
| reason | string | — | Short reason label. |
| description | string | — | Longer explanation of the denial cause. |
| count | number | — | Claim count for this reason. |
| pctOfTotal | number | — | Percentage of total denials this reason represents. |
| valueAtRisk | number | — | PHP value at risk. |
| trend | `"better" \| "worse" \| "flat"` | — | Trend direction vs. prior period. |
| action | string | — | Recommended remediation action. |

### Relationships
- Same 5 underlying denial-reason codes as `executive.mock.ts`'s `DenialReason` array (`DR-101, DR-204, DR-118, DR-330, DR-402`) plus 5 additional codes unique to this file (`DR-512, DR-215, DR-610, DR-140, DR-720`) — informally overlapping content, independently declared/typed.

### Source
`src/lib/analytics/claims.mock.ts`, hardcoded 10-row array, embedded in `ClaimsData.denialReasons`.

### Notes
None.

## Table: CaseTypeTreemapRow

**Description:** One PhilHealth case-type's claim volume and average value, for the case-type treemap.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| name | string | PK | Case type name, e.g. `"Ordinary"`, `"Catastrophic"`, `"Konsulta"`. |
| size | number | — | Claim count (drives treemap tile size). |
| avgValue | number | — | Average PHP value per claim of this case type. |

### Relationships
- `name` informally keys `caseTypeDetail: Record<string, {...}>` on `ClaimsData`.

### Source
`src/lib/analytics/claims.mock.ts`, hardcoded 8-row array, embedded in `ClaimsData.caseTypeTreemap`.

### Notes
None.

## Table: PhysicianClaimRow

**Description:** One physician's claims-submission performance summary.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| physician | string | PK (informal) | Physician name, from this file's own local 8-name `physicians` array (an exact literal duplicate of the first 8 `PH_PHYSICIANS` values, not imported — see Known Cross-File Inconsistencies #1). |
| submitted | number | — | Claims submitted. |
| approvalRate | number | — | Approval rate percentage. |
| denialRate | number | — | Denial rate percentage (hardcoded per-physician array of 8 literal values). |
| commonDenialReason | string | FK -> DenialReasonRow.reason (informal) | Most common denial reason for this physician, looked up positionally (`i % denialReasons.length`) from `denialReasons`. |
| revenue | number | — | PHP revenue attributed to this physician. |

### Relationships
- `commonDenialReason` is a positional (index-modulo) informal lookup into `denialReasons`, not a real join — the reason is not necessarily actually the "most common" one for that physician, just deterministically assigned.

### Source
`src/lib/analytics/claims.mock.ts`, computed inline, embedded in `ClaimsData.physicians`.

### Notes
None.

## Table: CaseRateScatterPoint

**Description:** One diagnosis's case-rate-vs-actual-charge comparison point, for the claims variance scatter plot.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| icd10 | string | — | ICD-10 code, from this file's own local 20-entry `diagnoses` tuple list. |
| description | string | — | Diagnosis description. |
| caseType | string | FK -> CaseTypeTreemapRow.name (informal) | Case type for this diagnosis. |
| caseRate | number | — | PhilHealth case rate in PHP. |
| actualCharge | number | — | Actual charged amount in PHP (case rate ± a margin). |
| patientCount | number | — | Patient count for this diagnosis. |
| color | string | — | Hex color, looked up from `CASE_TYPE_COLORS[caseType]`. |

### Relationships
- `color` is an informal FK lookup into the local `CASE_TYPE_COLORS` record via `caseType`.

### Source
`src/lib/analytics/claims.mock.ts`, computed inline over the local `diagnoses` list, embedded in `ClaimsData.caseRateScatter`.

### Notes
None.

## Table: CoverageDiagnosisRow

**Description:** One diagnosis's case-rate-coverage-gap row (actual cost vs. case-rate target), sorted by largest gap first.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| code | string | — | ICD-10 code. |
| description | string | — | Diagnosis description. |
| actualCost | number | — | Actual PHP cost. |
| caseRateTarget | number | — | PhilHealth case-rate target in PHP. |

### Relationships
None identified.

### Source
`src/lib/analytics/claims.mock.ts`, computed inline over the first 20 local `diagnoses` entries, embedded in `ClaimsData.coverageDiagnoses`.

### Notes
None.

## Table: WorklistClaim

**Description:** One claim row inside a pipeline-stage worklist (drill-down for `PipelineStage`).

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| claimId | string | PK | Claim id, e.g. `"CLM-2026-5100"`. |
| patient | string | — | Patient display name (built from a local surname/given-name pool, not `phPatientName()`). |
| caseType | string | FK -> CaseTypeTreemapRow.name (informal) | Case type. |
| icd10 | string | — | ICD-10 code. |
| amount | number | — | PHP claim amount. |
| daysInStage | number | — | Days the claim has been in its current pipeline stage. |

### Relationships
- Value of `Record<string, WorklistClaim[]>` (`pipelineWorklists`) keyed by `PipelineStage.stage`.

### Source
`src/lib/analytics/claims.mock.ts`, produced by `buildWorklist(stage, 14)` for each pipeline stage, embedded in `ClaimsData.pipelineWorklists`.

### Notes
None.

## Table: ClaimsData (top-level wrapper)

**Description:** Top-level payload returned by `getClaimsData()`/`fetchClaimsData()` for the PhilHealth Claims Analytics dashboard.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| tenant | string | — | Facility name. |
| period | string | — | Current period label. |
| priorPeriod | string | — | Prior period label. |
| kpis | ClaimsKpis | — | See **ClaimsKpis**. |
| pipeline | PipelineStage[] | — | See **PipelineStage**. |
| pipelineWorklists | Record<string, WorklistClaim[]> | — | See **WorklistClaim**. |
| denialTrend | DenialTrendPoint[] | — | See **DenialTrendPoint**. |
| denialReasons | DenialReasonRow[] | — | See **DenialReasonRow**. |
| caseTypeTreemap | CaseTypeTreemapRow[] | — | See **CaseTypeTreemapRow**. |
| caseTypeDetail | inline `Record<string, {topDiagnoses: {code,description,count}[]; avgCaseRate: number; approvalRate: number}>` | — | Per-case-type detail, keyed by `CaseTypeTreemapRow.name`; value is an anonymous shape, not a named type. |
| physicians | PhysicianClaimRow[] | — | See **PhysicianClaimRow**. |
| caseRateScatter | CaseRateScatterPoint[] | — | See **CaseRateScatterPoint**. |
| coverageDiagnoses | CoverageDiagnosisRow[] | — | See **CoverageDiagnosisRow**. |

### Relationships
- Aggregates all tables in this file.

### Source
`src/lib/analytics/claims.mock.ts`, produced by `getClaimsData()` / `fetchClaimsData()`.

### Notes
None.

---

## File: `src/lib/analytics/quality.mock.ts`

Mock data for the Quality & Patient Safety Analytics dashboard. **Zero imports from `ph-constants.ts`** (see Known Cross-File Inconsistencies #1) — physicians/surgeons, department lists, and prescription departments are all declared locally, and diverge in naming from `PH_DEPARTMENTS`/`PH_PHYSICIANS`.

## Table: HacPoint

**Description:** One period's Hospital-Acquired Condition (HAC) rate, styled as a statistical process control (SPC) chart point with mean/UCL/LCL control limits.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| period | string | — | Period label. |
| rate | number | — | HAC rate for the period. |
| mean | number | — | Control-chart center line (flat `2.4` for all rows). |
| ucl | number | — | Upper control limit (flat `4.1`). |
| lcl | number | — | Lower control limit (flat `0.7`). |
| category | string | FK -> hacCategories (informal) | HAC category assigned to this period, e.g. `"SSI"`, `"CAUTI"`, `"CLABSI"`, `"VAP"`, `"Falls"`, `"Pressure Injuries"` (cycled positionally, not necessarily the actual driver of that period's rate). |
| specialCause | boolean | — | True if `rate > ucl \|\| rate < lcl` (SPC "special cause" flag), computed at build time. |

### Relationships
- `category` cycles through the local `hacCategories: string[]` constant (not a named type — a plain 6-item string array).

### Source
`src/lib/analytics/quality.mock.ts`, produced by `buildHac()`, embedded in `QualityData.hac`.

### Notes
None.

## Table: MedErrorPoint

**Description:** One month of medication-error counts by error type.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| month | string | — | Month label. |
| wrongDrug | number | — | Wrong-drug error count. |
| wrongDose | number | — | Wrong-dose error count. |
| wrongRoute | number | — | Wrong-route error count. |
| wrongPatient | number | — | Wrong-patient error count. |
| omission | number | — | Omission error count. |
| total | number | — | Sum of the 5 error-type counts, computed at build time. |

### Relationships
None identified.

### Source
`src/lib/analytics/quality.mock.ts`, produced by `buildMedErrors()`, embedded in `QualityData.medErrors`.

### Notes
None.

## Table: HandHygieneUnit

**Description:** One hospital unit's hand-hygiene compliance rate.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| unit | string | — | Unit name, e.g. `"Medicine Ward"`, `"ICU"` (local 7-item list, distinct from the report module's `wards` list in `hospital.mock.tsx`, which has 8 items and different names like `"Isolation"`, `"Orthopedic Ward"`, `"Private Rooms"`). |
| compliance | number | — | Compliance percentage. |
| target | number | — | Target percentage (flat `80` for all rows). |
| observations | number | — | Number of hand-hygiene observations recorded. |

### Relationships
None identified.

### Source
`src/lib/analytics/quality.mock.ts`, produced by `buildHandHygieneUnits()`, embedded in `QualityData.handHygiene.byUnit`.

### Notes
None.

## Table: SsiSurgeon

**Description:** One surgeon's Surgical Site Infection (SSI) rate vs. expected/risk-adjusted rate, with outlier flag.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| surgeon | string | — | Surgeon name, from this file's own local 10-name `surgeons` array (near-duplicate of, but not identical to, `PH_PHYSICIANS` — see Known Cross-File Inconsistencies #1). |
| department | string | FK -> surgeonDepts (informal) | Department, from a local 4-item list (`Surgery, Orthopedics, Obstetrics, Cardiology`). |
| caseVolume | number | — | Surgical case volume. |
| observedRate | number | — | Observed SSI rate (risk-adjusted by an inverse-sqrt-of-volume jitter formula). |
| expectedRate | number | — | Expected SSI rate (flat `2.1` for all rows). |
| outlier | boolean | — | True if `observedRate` is >1.8× or <0.25× `expectedRate`. |

### Relationships
None identified.

### Source
`src/lib/analytics/quality.mock.ts`, produced by `buildSsiSurgeons()`, embedded in `QualityData.ssi.surgeons`.

### Notes
None.

## Table: PrescriptionDept

**Description:** One department's generic-prescribing, antibiotic-prescribing, and polypharmacy rates.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| department | string | FK -> PH_DEPARTMENTS (informal, imperfect) | Department name, from a local 7-item list that uses `"Emergency"` where `PH_DEPARTMENTS` uses `"Emergency Medicine"` — a naming mismatch (see Known Cross-File Inconsistencies #1). |
| genericRate | number | — | Percentage of orders that are generic. |
| antibioticRate | number | — | Percentage of orders that are antibiotics. |
| polypharmacyRate | number | — | Percentage of patients on polypharmacy. |

### Relationships
None identified.

### Source
`src/lib/analytics/quality.mock.ts`, produced by `buildPrescriptions()`, embedded in `QualityData.prescriptions.departments`.

### Notes
None.

## Table: QualityData (top-level wrapper)

**Description:** Top-level payload returned by `getQualityData()`/`fetchQualityData()` for the Quality & Patient Safety Analytics dashboard.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| tenant | string | — | Facility name. |
| period | string | — | Current period label. |
| priorPeriod | string | — | Prior period label. |
| kpi | inline `{hacRate, medErrorsMtd, handHygiene, ssiRate, genericPrescribing}` (each `{value, delta}`) | — | KPI strip sub-object, derived from the last row of each underlying series. |
| hacCategories | string[] | — | The 6 HAC category labels (plain array, no backing type). |
| hac | HacPoint[] | — | See **HacPoint**. |
| medErrors | MedErrorPoint[] | — | See **MedErrorPoint**. |
| handHygiene | inline `{overall: number; target: number; trend: {month,value}[]; byUnit: HandHygieneUnit[]}` | — | `byUnit` -> **HandHygieneUnit[]**. |
| ssi | inline `{surgeons: SsiSurgeon[]; overallExpectedRate: number}` | — | `surgeons` -> **SsiSurgeon[]**. |
| prescriptions | inline `{departments: PrescriptionDept[]; targets: {genericRate,antibioticRate,polypharmacyRate}}` | — | `departments` -> **PrescriptionDept[]**. |

### Relationships
- Aggregates `HacPoint`, `MedErrorPoint`, `HandHygieneUnit`, `SsiSurgeon`, `PrescriptionDept`.

### Source
`src/lib/analytics/quality.mock.ts`, produced by `getQualityData()` / `fetchQualityData()`.

### Notes
None.

---

## File: `src/lib/analytics/laboratory.mock.ts`

Mock data for the Laboratory Analytics dashboard. **Zero imports from `ph-constants.ts`** (see Known Cross-File Inconsistencies #1) — no physician roster is used at all; department names (`orderingDepartments`) are a locally-declared 6-item list that does not match `PH_DEPARTMENTS` naming.

## Table: VolumeTrendPoint

**Description:** One month of lab test volume broken out by category.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| month | string | — | Month label. |
| Hematology | number | — | Test volume for Hematology. |
| Chemistry | number | — | Test volume for Chemistry. |
| Urinalysis | number | — | Test volume for Urinalysis. |
| Microbiology | number | — | Test volume for Microbiology. |
| Immunology | number | — | Test volume for Immunology. |
| Serology | number | — | Test volume for Serology. |
| Other | number | — | Test volume for Other. |

### Relationships
- Field names (PascalCase) exactly mirror the `LabCategory` union's 7 literal values.

### Source
`src/lib/analytics/laboratory.mock.ts`, computed inline over 12 months, embedded in `LaboratoryData.volumeTrend`.

### Notes
None.

## Table: TatOutlier

**Description:** One turn-around-time (TAT) outlier case, for drill-down under a `TatBoxStat` box-plot category.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| id | string | PK | Outlier id, e.g. `"TAT-HEM-1011"`. |
| category | LabCategory | FK -> TatBoxStat.category (informal) | Lab category. |
| patient | string | — | Patient display name, from this file's own local `patientName()` helper (own surname/first-name pool, not `phPatientName()` — see Known Cross-File Inconsistencies #4 note). |
| patientId | string | — | Patient id. |
| test | string | — | Test name, e.g. `"Hematology panel"`. |
| orderedAt | string | — | `"YYYY-MM-DD HH:MM"` timestamp string (not strict ISO 8601 — no `T` separator). |
| releasedAt | string | — | `"YYYY-MM-DD HH:MM"` timestamp string. |
| tatMinutes | number | — | Turn-around time in minutes. |
| delayReason | string | — | Free-text delay explanation, from a 6-item local pool. |

### Relationships
- `category` value is passed in from the enclosing `TatBoxStat.category`.

### Source
`src/lib/analytics/laboratory.mock.ts`, produced by `buildOutliers()`, embedded in `TatBoxStat.outliers`.

### Notes
None.

## Table: TatBoxStat

**Description:** One lab category's TAT distribution, styled as box-plot statistics (min/q1/median/q3/max) with a target and outlier cases.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| category | LabCategory | PK (informal) | Lab category. |
| min | number | — | Minimum TAT in minutes. |
| q1 | number | — | First-quartile TAT in minutes. |
| median | number | — | Median TAT in minutes. |
| q3 | number | — | Third-quartile TAT in minutes. |
| max | number | — | Maximum TAT in minutes. |
| targetTat | number | — | Target TAT in minutes. |
| outliers | TatOutlier[] | — | See **TatOutlier**. |

### Relationships
- Contains `TatOutlier[]` directly (not a separate `Record` lookup, unlike most other drill-down patterns in this codebase).

### Source
`src/lib/analytics/laboratory.mock.ts`, hardcoded 7-row array (one per `LabCategory`), embedded in `LaboratoryData.tatBox`.

### Notes
None.

## Table: CriticalResponseBar

**Description:** One lab-category × ordering-department critical-result response-time compliance bar.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| category | LabCategory | FK -> TatBoxStat.category (informal) | Lab category (first 6 of the 7 `categories`, i.e. excludes `"Other"`). |
| department | string | FK -> orderingDepartments (informal) | Ordering department (first 4 of the local 6-item `orderingDepartments` list). |
| withinTargetPct | number | — | Percentage of critical results notified within target time. |
| target | number | — | Target percentage (flat `100`). |
| sampleSize | number | — | Sample size for this category/department combination. |

### Relationships
None identified.

### Source
`src/lib/analytics/laboratory.mock.ts`, built via nested `forEach` over categories × departments, embedded in `LaboratoryData.criticalBars`.

### Notes
None.

## Table: CriticalNotification

**Description:** One individual critical-result notification event.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| id | string | PK | Notification id, e.g. `"CRIT-2000"`. |
| category | LabCategory | FK -> TatBoxStat.category (informal) | Lab category. |
| department | string | FK -> orderingDepartments (informal) | Ordering department. |
| test | string | — | Test name, e.g. `"Chemistry critical value"`. |
| patient | string | — | Patient display name, from the local `patientName()` helper. |
| minutesToNotify | number | — | Minutes elapsed before the result was communicated. |
| outlier | boolean | — | True if `minutesToNotify > 30`. |

### Relationships
None identified beyond the informal FKs.

### Source
`src/lib/analytics/laboratory.mock.ts`, computed inline (42 rows), embedded in `LaboratoryData.criticalNotifications`.

### Notes
None.

## Table: AbnormalTestRow

**Description:** One lab test's total-results and abnormal-rate summary, top 20 by abnormal rate.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| test | string | — | Test name, from a 23-item local `testCatalog`. |
| category | LabCategory | FK -> TatBoxStat.category (informal) | Lab category. |
| totalResults | number | — | Total results for this test in the period. |
| abnormalPct | number | — | Percentage of results flagged abnormal. |

### Relationships
None identified.

### Source
`src/lib/analytics/laboratory.mock.ts`, computed from `testCatalog`, sorted desc by `abnormalPct`, sliced to top 20, embedded in `LaboratoryData.abnormalTests`.

### Notes
None.

## Table: UnmappedTest

**Description:** One lab test that lacks a LOINC code mapping.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| test | string | — | Test name. |
| category | LabCategory | FK -> TatBoxStat.category (informal) | Lab category. |
| monthlyVolume | number | — | Monthly test volume. |
| priority | `"High" \| "Medium" \| "Low"` | — | Mapping-effort priority. |

### Relationships
None identified.

### Source
`src/lib/analytics/laboratory.mock.ts`, hardcoded 6-row array, embedded in `LaboratoryData.loinc.unmapped`.

### Notes
None.

## Table: LaboratoryData (top-level wrapper)

**Description:** Top-level payload returned by `getLaboratoryData()`/`fetchLaboratoryData()` for the Laboratory Analytics dashboard.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| tenant | string | — | Facility name. |
| period | string | — | Current period label. |
| kpis | inline `{totalTestsMtd, totalTestsDelta, tatCompliancePct, criticalResponseCompliancePct, abnormalRatePct, loincMappedPct}` (all `number`) | — | KPI strip sub-object. |
| volumeTrend | VolumeTrendPoint[] | — | See **VolumeTrendPoint**. |
| tatBox | TatBoxStat[] | — | See **TatBoxStat**. |
| criticalBars | CriticalResponseBar[] | — | See **CriticalResponseBar**. |
| criticalNotifications | CriticalNotification[] | — | See **CriticalNotification**. |
| abnormalTests | AbnormalTestRow[] | — | See **AbnormalTestRow**. |
| loinc | inline `{mappedCount: number; totalCount: number; unmapped: UnmappedTest[]}` | — | `unmapped` -> **UnmappedTest[]**. |

### Relationships
- Aggregates all tables in this file.

### Source
`src/lib/analytics/laboratory.mock.ts`, produced by `getLaboratoryData()` / `fetchLaboratoryData()`.

### Notes
`LabCategory` (`"Hematology" | "Chemistry" | "Urinalysis" | "Microbiology" | "Immunology" | "Serology" | "Other"`) is a trivial type alias, not tabled separately, but referenced as an FK-like value throughout this file's tables.

---

## File: `src/lib/analytics/cohort.mock.ts`

Synthetic patient-level dataset for the Hospital Cohort Builder (`/analytics/cohorts`) — a wider (300-row) sample than the ~300/month admissions volume on the Executive dashboard, so cohort filters have enough rows to behave meaningfully. Imports `PH_DEPARTMENTS, PH_PAYER_MIX, PH_TOP_DIAGNOSES, phPatientName` from `ph-constants.ts` and calls `phPatientName` correctly.

## Table: CohortPatient

**Description:** One synthetic patient row for the Cohort Builder query tool. There is no separate "Data" wrapper interface for this file — the primary export is a flat `CohortPatient[]` array, not a wrapped object.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| patientId | string | PK | Patient id, e.g. `"PT-2026-1000"`. |
| name | string | — | Patient display name, from `phPatientName()`. |
| age | number | — | Patient age, 1–88. |
| gender | `"male" \| "female"` | — | Patient gender. |
| department | string | FK -> PH_DEPARTMENTS (informal) | Department. |
| diagnosisCode | string | FK -> IcdEntry.code (informal) | ICD-10 code, from `PH_TOP_DIAGNOSES`. |
| diagnosisDesc | string | — | Diagnosis description. |
| payer | string | FK -> weighted payer list (informal) | Payer name, drawn using a weighted-random selection based on `PH_PAYER_MIX` fractions. |
| admissionType | `"Emergency" \| "Elective" \| "Transfer-in" \| "Newborn"` | — | Admission type. |
| lastEncounterDate | string | — | ISO date (`YYYY-MM-DD`) of the last encounter, within a ~7-month window of 2026. |
| readmitted30d | boolean | — | True if `seeded(i, 50) > 0.82` (≈18% of rows). |
| labAbnormalFlag | boolean | — | True if `seeded(i, 51) > 0.7` (≈30% of rows). |

### Relationships
- `payer` selection uses `PH_PAYER_MIX` fractions (`philhealth, hmo, privatePay, scpwd`, and `gsis + writeoff` combined into one "GSIS/Other" bucket) as weights — informal, computed relationship, not a stored FK.

### Source
`src/lib/analytics/cohort.mock.ts`, produced by `buildCohortPatients(300)`, exported as `cohortPatients: CohortPatient[]`, wrapped by `fetchCohortPatients()`.

### Notes
This file also exports `cohortDepartments`, `cohortPayers`, `cohortAdmissionTypes`, `cohortDiagnoses` as convenience re-exports of the filter option lists used to build `CohortPatient` rows — not separate types.

---

## File: `src/lib/analytics/temporal.mock.ts`

Hour × weekday visit-volume mock data for the Temporal Pattern Analysis tool (`/analytics/patterns`). Models two service-type profiles: OPD (business-hours-heavy) and Emergency (24/7 with an evening/weekend surge). Imports `HourWeekdayCell` (type-only) from `@/components/analytics/temporal-heatmap` and `PH_DEPARTMENTS` from `ph-constants.ts`.

## Table: TemporalDataset (top-level wrapper)

**Description:** Top-level payload returned by `getTemporalData()`/`fetchTemporalData()` for the hospital Temporal Pattern Analysis tool.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| opd | HourWeekdayCell[] | — | 168-cell (7 days × 24 hours) OPD visit-volume grid. See **HourWeekdayCell**. |
| emergency | HourWeekdayCell[] | — | 168-cell Emergency visit-volume grid. See **HourWeekdayCell**. |

### Relationships
- Both fields are `HourWeekdayCell[]` imported from the shared component file (see Part 2), not redeclared locally.

### Source
`src/lib/analytics/temporal.mock.ts`, produced by `getTemporalData()` / `fetchTemporalData()`.

### Notes
This file also exports `TEMPORAL_DEPARTMENTS = PH_DEPARTMENTS` (re-export, not a type) and a helper function `departmentBreakdownFor(day, hour, total)` that returns an inline `{name: string; value: number}[]` (not a named type) for drill-down when a heatmap cell is clicked.

---

## File: `src/lib/analytics/alerts.mock.ts`

Static hospital alert data for the Alert & Notification Center tool. No local interfaces — imports `AlertItem` (type-only) from `@/components/analytics/alert-center` and exports two plain `AlertItem[]` constants. No "Data" wrapper interface exists for this file.

- `hospitalAlerts: AlertItem[]` — 9 initial alerts (3 critical, 3 warning, 3 info).
- `hospitalAlertRefreshPool: AlertItem[]` — 3 alerts used as a pool the UI's "Refresh" button pulls from, cycling through them.

See **AlertItem** in Part 2 for the field-level table. Source: `src/lib/analytics/alerts.mock.ts`.

---

# Part 4 — Hospital Reports (`src/lib/reports/hospital.mock.tsx`)

10 report configs (R-01..R-10), each an object conforming to the generic `ReportConfig<T>` type from `src/components/reports/types.ts` (columns, filters, drawer detail, and `getRows: () => T[]` all defined per report; not itself part of the mock-data file set in scope, so not tabled here). **Every row-shape interface below (`CensusRow`, `LogbookRow`, `MorbidityRow`, `ClaimRow`, `DenialRow`, `RevenueRow`, `PhysicianActivityRow`, `LabWorkloadRow`, `FormularyRow`, `DischargeAuditRow`) is declared with a plain `interface` keyword and no `export`** — they are file-local and only inferable from usage inside this file; there is no separate "Data" wrapper object per report (each report's `getRows()` function returns `T[]` directly, and the file's true top-level export is the array `hospitalReports: AnyReportConfig[]`, documented at the end of this Part). Imports `PH_DEPARTMENTS, PH_PHYSICIANS, PH_TOP_DIAGNOSES, phPatientName` from `ph-constants.ts` — but see Known Cross-File Inconsistencies #4 for the dead `phPatientName` import.

## Table: CensusRow (R-01 Daily Census Report)

**Description:** One ward/day bed-census snapshot.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| date | string | — | ISO date, last 21 days. |
| ward | string | FK -> local `wards` list (informal) | Ward name, from an 8-item local list (`Medicine Ward, Surgery Ward, OB Ward, Pedia Ward, ICU, Isolation, Orthopedic Ward, Private Rooms`). |
| capacity | number | — | Bed capacity for the ward (`20 + wardIndex * 6`). |
| occupied | number | — | Beds occupied. |
| admissionsToday | number | — | Admissions that day. |
| dischargesToday | number | — | Discharges that day. |
| pendingDischarges | number | — | Discharges pending clearance. |

### Relationships
None identified. Derived columns `available` and `bor` (BOR%) are computed at render time by the report's column `render`/`sortValue` functions, not stored on the row.

### Source
`src/lib/reports/hospital.mock.tsx`, file-local (not exported) interface, produced by `buildCensusRows()`, report id `daily-census` (code `R-01`).

### Notes
Not exported — only inferable from usage within this file.

## Table: LogbookRow (R-02 Admission & Discharge Logbook)

**Description:** One chronological admission/discharge log entry.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| caseNo | string | PK | Case number, e.g. `"CN-2026-4200"`. |
| patient | string | — | Patient name, from local `personName()` (not `phPatientName()`). |
| age | number | — | Patient age. |
| sex | `"M" \| "F"` | — | Patient sex (note: `"M"/"F"` codes, unlike the `"male"/"female"` string union used elsewhere in the codebase — an inconsistent representation of the same concept). |
| dateAdmitted | string | — | ISO date admitted. |
| dateDischarged | string \| null | — | ISO date discharged, or `null` if still admitted. |
| los | number | — | Length of stay in days. |
| icd10 | string | FK -> IcdEntry.code (informal) | ICD-10 code, from `PH_TOP_DIAGNOSES`. |
| diagnosis | string | — | Diagnosis description. |
| disposition | string | FK -> local `dispositions` list (informal) | Discharge disposition. |
| physician | string | FK -> PH_PHYSICIANS (informal) | Attending physician name. |
| department | string | FK -> PH_DEPARTMENTS (informal) | Department. |
| philhealthPin | string | — | Synthetic PhilHealth PIN, format `NN-NNNNNNNNN-N`. |
| payer | string | FK -> local `payers` list (informal) | Payer name. |

### Relationships
None beyond the informal FKs noted.

### Source
`src/lib/reports/hospital.mock.tsx`, file-local (not exported) interface, produced by `buildLogbook()` (60 rows), report id `admission-discharge-logbook` (code `R-02`).

### Notes
Not exported.

## Table: MorbidityRow (R-03 Morbidity Summary — hospital)

**Description:** One ICD-10 × age-group × period morbidity count row, formatted to match the DOH Form CY-2 layout. **Same name as, but a different shape from,** `MorbidityRow` in `lgu/executive.mock.ts` — see Known Cross-File Inconsistencies #3.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| icd10 | string | FK -> IcdEntry.code (informal) | ICD-10 code. |
| diagnosis | string | — | Diagnosis description. |
| ageGroup | string | FK -> local `ageGroups` list (informal) | Age group, one of `"0–4", "5–14", "15–49", "50–64", "65+"`. |
| male | number | — | Male case count. |
| female | number | — | Female case count. |
| period | `"Monthly" \| "Annual"` | — | Reporting period; Annual rows are the Monthly base value × 12. |

### Relationships
None identified. `total` and `rate per 1000` are derived at render time, not stored fields.

### Source
`src/lib/reports/hospital.mock.tsx`, file-local (not exported) interface, produced by `buildMorbidity()` (12 diagnoses × 5 age groups × 2 periods = 120 rows), report id `morbidity-summary` (code `R-03`).

### Notes
Not exported. Name collides with `lgu/executive.mock.ts`'s exported `MorbidityRow` but the two are unrelated, differently-shaped interfaces.

## Table: ClaimRow (R-04 PhilHealth Claims Register)

**Description:** One complete PhilHealth claim ledger row.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| claimId | string | PK | Claim id, e.g. `"CLM-2026-9000"`. |
| patient | string | — | Patient name, from local `personName()`. |
| pin | string | — | Synthetic PhilHealth PIN. |
| hciCaseNo | string | — | Health Care Institution case number. |
| rtn | string | — | Return-to-Nurse/Hospital tracking number. |
| tcn | string | — | Transaction control number. |
| dateSubmitted | string | — | ISO date submitted. |
| caseType | string | FK -> local `caseTypes` list (informal) | Case type (`Ordinary, Catastrophic, Day Surgery, Z-Benefit, Konsulta`). |
| grossCharges | number | — | Gross PHP charges. |
| cr1 | number | — | PhilHealth CR1 (Case Rate 1) amount, ≈70% of gross. |
| cr2 | number | — | PhilHealth CR2 (Case Rate 2) amount, ≈20% of gross. |
| patientShare | number | — | `max(0, grossCharges - cr1 - cr2)`. |
| status | string | FK -> local `claimStatuses` list (informal) | Claim status (`Submitted, RTN Pending, Approved, Denied, Returned-to-Hospital`). |
| dateApproved | string \| null | — | ISO date approved, if `status` is Approved/Denied. |
| remittanceDate | string \| null | — | ISO date remitted, if `status` is Approved. |
| amountRemitted | number | — | PHP amount remitted. |
| department | string | FK -> PH_DEPARTMENTS (informal) | Department. |
| physician | string | FK -> PH_PHYSICIANS (informal) | Attending physician name. |

### Relationships
None beyond the informal FKs noted. `variance` (`amountRemitted - (cr1+cr2)`) is derived at render time.

### Source
`src/lib/reports/hospital.mock.tsx`, file-local (not exported) interface, produced by `buildClaims()` (70 rows), report id `philhealth-claims-register` (code `R-04`).

### Notes
Not exported.

## Table: DenialRow (R-05 Denial & Appeal Tracker)

**Description:** One denied claim's appeal-tracking status.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| claimId | string | PK | Claim id, e.g. `"CLM-2026-8500"`. |
| patient | string | — | Patient name, from local `personName()`. |
| denialDate | string | — | ISO date denied. |
| denialCode | string | FK -> local `denialReasonPool` (informal) | Denial code, e.g. `"DR-101"` (5-item pool, same 5 codes as `executive.mock.ts`'s `DenialReason`). |
| denialReason | string | — | Denial reason label. |
| appealFiledDate | string \| null | — | ISO date the appeal was filed, or `null`. |
| appealStatus | string | FK -> local `appealStatuses` list (informal) | Appeal status (`Not Filed, Filed — Pending, Under Review, Approved, Rejected`). |
| rthStatus | string | — | `"Returned-to-Hospital"` or `"Not returned"` (roughly 1-in-3 rows). |
| resolutionDate | string \| null | — | ISO date resolved, if `appealStatus` is Approved/Rejected. |
| amountRecovered | number | — | PHP amount recovered, only nonzero if `appealStatus === "Approved"`. |
| physician | string | FK -> PH_PHYSICIANS (informal) | Attending physician name. |

### Relationships
None beyond the informal FKs.

### Source
`src/lib/reports/hospital.mock.tsx`, file-local (not exported) interface, produced by `buildDenials()` (32 rows), report id `denial-appeal-tracker` (code `R-05`).

### Notes
Not exported.

## Table: RevenueRow (R-06 Revenue & Collection Report)

**Description:** One month × department financial summary row.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| month | string | — | Month label. |
| isoDate | string | — | ISO first-of-month date. |
| department | string | FK -> PH_DEPARTMENTS (informal) | Department. |
| grossCharges | number | — | Gross PHP charges. |
| scDiscount | number | — | Senior Citizen discount, 4% of gross. |
| gsis | number | — | GSIS amount, 5% of gross. |
| hmo | number | — | HMO amount, 18% of gross. |
| philhealth | number | — | PhilHealth amount, 38% of gross. |
| patientPayments | number | — | Patient payments, 22% of gross. |
| outstandingAr | number | — | Outstanding AR, a seeded 3–16% of gross. |

### Relationships
None identified. `collectionRate` is derived at render time.

### Source
`src/lib/reports/hospital.mock.tsx`, file-local (not exported) interface, produced by `buildRevenue()` (12 months × 8 departments = 96 rows), report id `revenue-collection` (code `R-06`).

### Notes
Not exported.

## Table: PhysicianActivityRow (R-07 Physician Activity Report)

**Description:** One physician × month utilization/revenue summary row. Admin-only report (`roleNote: "Admin only"`).

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| physician | string | FK -> PH_PHYSICIANS (informal) | Physician name. |
| pan | string | — | Synthetic PAN (Practitioner Accreditation Number), e.g. `"PAN-00214"`. |
| specialty | string | FK -> PH_DEPARTMENTS (informal) | Specialty, assigned positionally from `PH_DEPARTMENTS` per physician. |
| department | string | FK -> PH_DEPARTMENTS (informal) | Department (assigned positionally, independently of `specialty`'s positional index base). |
| isoDate | string | — | ISO first-of-month date. |
| cases | number | — | Case count that month. |
| avgLos | number | — | Average length of stay. |
| procedures | number | — | Procedure count. |
| pfRevenue | number | — | Professional-fee PHP revenue. |
| philhealthPfClaims | number | — | Count of PhilHealth professional-fee claims. |
| approvalRate | number | — | Approval rate percentage. |

### Relationships
None beyond the informal FKs.

### Source
`src/lib/reports/hospital.mock.tsx`, file-local (not exported) interface, produced by `buildPhysicianActivity()` (15 physicians × 12 months = 180 rows), report id `physician-activity` (code `R-07`).

### Notes
Not exported.

## Table: LabWorkloadRow (R-08 Laboratory Workload Report)

**Description:** One lab test × month workload/TAT summary row.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| isoDate | string | — | ISO first-of-month date. |
| test | string | — | Test name, from an 8-item local `labTests` list. |
| loinc | string | — | LOINC code for the test. |
| category | string | — | Lab category (free string, values overlap but are not FK'd to `LabCategory` from `laboratory.mock.ts`). |
| ordersReceived | number | — | Orders received that month. |
| ordersCompleted | number | — | Orders completed that month. |
| avgTat | number | — | Average TAT in hours. |
| criticalResults | number | — | Count of critical results. |

### Relationships
None identified. `ordersPending` and `abnormalRate` are derived at render time.

### Source
`src/lib/reports/hospital.mock.tsx`, file-local (not exported) interface, produced by `buildLabWorkload()` (8 tests × 12 months = 96 rows), report id `laboratory-workload` (code `R-08`).

### Notes
Not exported.

## Table: FormularyRow (R-09 Prescription & Formulary Compliance Report)

**Description:** One drug × physician generic-prescribing compliance row.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| generic | string | — | Generic drug name, e.g. `"Paracetamol"`, from an 8-item local `drugPool`. |
| brandOrdered | string | — | Brand name ordered, e.g. `"Biogesic"`. |
| orders | number | — | Order count. |
| percentGeneric | number | — | Percentage of orders that were generic. |
| inNf | boolean | — | Whether the drug is in the National Formulary. |
| physician | string | FK -> PH_PHYSICIANS (informal) | Prescribing physician. |
| department | string | FK -> PH_DEPARTMENTS (informal) | Department. |

### Relationships
None beyond the informal FKs.

### Source
`src/lib/reports/hospital.mock.tsx`, file-local (not exported) interface, produced by `buildFormulary()` (8 drugs × 15 physicians = 120 rows), report id `formulary-compliance` (code `R-09`).

### Notes
Not exported.

## Table: DischargeAuditRow (R-10 Discharge Clearance Audit Report)

**Description:** One patient's discharge-wizard-completion audit row.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| patient | string | — | Patient name, from local `personName()`. |
| caseNo | string | — | Case number, e.g. `"CN-2026-5100"`. |
| dischargeDate | string | — | ISO date discharged. |
| stepsIncomplete | number | — | Count of incomplete discharge-wizard steps, 0–5. |
| missingDocuments | string | FK -> local `missingDocPool` (informal) | Missing document label, e.g. `"CSF"`, `"None"`. |
| claimStatus | string | FK -> local `claimStatuses` list (informal, shared with R-04) | Claim status. |
| daysSinceDischarge | number | — | Days since discharge, 0–21. |
| csfCollected | boolean | — | Whether the Claim Signature Form was collected. |

### Relationships
None beyond the informal FKs.

### Source
`src/lib/reports/hospital.mock.tsx`, file-local (not exported) interface, produced by `buildDischargeAudit()` (26 rows), report id `discharge-clearance-audit` (code `R-10`).

### Notes
Not exported.

## Table: hospitalReports (file-level export, not a row type)

**Description:** The file's true top-level export — an array of all 10 `ReportConfig<T>` objects (R-01..R-10), each wrapping one of the row types documented above plus its columns/filters/drawer UI config.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| (array of) `ReportConfig<CensusRow \| LogbookRow \| MorbidityRow \| ClaimRow \| DenialRow \| RevenueRow \| PhysicianActivityRow \| LabWorkloadRow \| FormularyRow \| DischargeAuditRow>` | — | 10-element array, one per report code R-01..R-10. |

### Relationships
- Aggregates all 10 row-type tables in this Part.

### Source
`src/lib/reports/hospital.mock.tsx`, exported as `hospitalReports: AnyReportConfig[]`; individual reports retrievable via `getHospitalReport(id)`.

### Notes
`AnyReportConfig = ReportConfig<any>` is a type-erasure alias (explicit `eslint-disable` comment in source acknowledging the `any`) so the 10 differently-typed reports can share one array — a trivial generic alias, not tabled on its own. `ReportConfig<T>` itself (columns, filters, drawer, `getRows`, `getDrawer`, etc.) is defined in `src/components/reports/types.ts`, which is UI-engine infrastructure, not a mock-data file, so it is out of scope for full field-by-field documentation here.

---

# Part 5 — LGU ("Type B") Dashboard Mock Data

## File: `src/lib/analytics/lgu/executive.mock.ts`

Mock data for the LGU / City Health Center Executive (CHO) Dashboard. Imports `BARANGAYS, BHC_LIST, months12, epiWeeks, seeded, seededRange, TOTAL_POPULATION` from `./shared.mock` and `KONSULTA_EKAS_RATE` from `../ph-constants`.

## Table: BarangayMetricSet

**Description:** One barangay's full metric bundle for the Executive dashboard's choropleth map and barangay drill-down. The richest per-barangay row in the codebase.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| id | string | FK -> Barangay.id | Barangay id. |
| name | string | — | Barangay name. |
| population | number | — | Barangay population. |
| bhc | string | FK -> BHC_FACILITIES.name (informal) | Serving BHC name. |
| phn | string | — | Assigned Public Health Nurse. |
| visitDensity | number | — | Konsulta visit density per 1,000 population. |
| immunizationCoverage | number | — | Immunization coverage rate %. |
| tbCases | number | — | TB case count. |
| hypertensionPrevalence | number | — | Hypertension prevalence %. |
| maternalCoverage | number | — | Maternal care coverage %. |
| dengueCases | number | — | Dengue case count. |
| registeredPatients | number | — | Registered patient count (55–82% of population). |
| visitsByType | inline `{type: string; count: number}[]` | — | 5-item breakdown by visit type (`Konsulta OPD, Immunization, ANC, TB-DOTS, NCD follow-up`). |
| topDiagnoses | inline `{code: string; description: string; count: number}[]` | — | 5-item top-diagnosis list, hardcoded per barangay (independent of `PH_TOP_DIAGNOSES`; includes `A90` dengue, which is not in `PH_TOP_DIAGNOSES`). |
| immunizationByAntigen | inline `{antigen: string; coverage: number}[]` | — | 7-antigen coverage breakdown. |
| maternalRiskCount | inline `{risk: string; count: number}[]` | — | 3-tier maternal risk-stratification counts. |
| tbOnTreatment | number | — | TB patients currently on treatment. |
| activeReferrals | number | — | Active referral count. |

### Relationships
- Built directly from `BARANGAYS.map(...)` — one row per `Barangay`, carrying `id`, `name`, `population`, `bhc`, `phn` straight through.
- `CHOROPLETH_METRICS` (a 6-item `const` array of `{key, label, unit}`, `as const`) enumerates which `BarangayMetricSet` numeric fields are choropleth-selectable; `ChoroplethMetricKey` is the derived trivial type alias (`(typeof CHOROPLETH_METRICS)[number]["key"]`) — neither is tabled separately (no backing named interface for `CHOROPLETH_METRICS` entries).

### Source
`src/lib/analytics/lgu/executive.mock.ts`, produced by `buildBarangayData()`, embedded in `LguExecutiveData.barangays`.

### Notes
None.

## Table: DiseaseCurvePoint

**Description:** One epidemiological week's case counts for 4 tracked diseases, each with a baseline for outbreak-threshold comparison.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| period | string | — | Epi-week label, e.g. `"EW20"`. |
| dengue | number | — | Dengue case count (spikes 2.1–3.4× baseline from week 8 onward, modeling an outbreak). |
| measles | number | — | Measles case count. |
| diarrhea | number | — | Diarrhea case count. |
| ari | number | — | Acute Respiratory Infection case count. |
| dengueBaseline | number | — | Dengue baseline for the week. |
| measlesBaseline | number | — | Flat measles baseline (`4`). |
| diarrheaBaseline | number | — | Flat diarrhea baseline (`14`). |
| ariBaseline | number | — | Flat ARI baseline (`32`). |

### Relationships
- `scaleEpiCurve(ratio)` in `jurisdiction.mock.ts` maps over this exact shape to rescale it for other jurisdictions — informal (untyped-by-name, but structurally identical) reuse.

### Source
`src/lib/analytics/lgu/executive.mock.ts`, produced by `buildEpiCurve()`, embedded in `LguExecutiveData.epiCurve`.

### Notes
None.

## Table: MorbidityRow (LGU executive)

**Description:** One ICD-10 morbidity row with current/prior-month/prior-year counts, for the Executive dashboard's morbidity table (all-ages and under-5 variants). **Same name as, but a different shape from,** the file-local `MorbidityRow` in `reports/hospital.mock.tsx` — see Known Cross-File Inconsistencies #3.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| code | string | — | ICD-10 code. |
| description | string | — | Diagnosis description. |
| current | number | — | Current-period case count. |
| priorMonth | number | — | Prior-month case count. |
| priorYear | number | — | Prior-year (same month) case count. |

### Relationships
- `jurisdictionMorbidity(population)` in `jurisdiction.mock.ts` returns an array of this same shape (structurally, via `PH_TOP_DIAGNOSES` instead of the hardcoded `morbidityAllAges`/`morbidityUnder5` lists here) — informal reuse, not a shared named type import.

### Source
`src/lib/analytics/lgu/executive.mock.ts`, hardcoded as `morbidityAllAges: MorbidityRow[]` (10 rows) and `morbidityUnder5: MorbidityRow[]` (10 rows), embedded in `LguExecutiveData.morbidity.{allAges,under5}`.

### Notes
This is an **exported** interface, unlike the file-local `MorbidityRow` in `reports/hospital.mock.tsx` it collides in name with.

## Table: LguExecutiveData (top-level wrapper)

**Description:** Top-level payload returned by `getLguExecutiveData()`/`fetchLguExecutiveData()` for the LGU Executive (CHO) Dashboard — the most complex single object in the whole mock-data set.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| tenant | string | — | `"Cebu City Health Office"`. |
| jurisdiction | string | — | `"City Health Center → 15 Barangay Health Centers"`. |
| period | string | — | Current period label. |
| priorPeriod | string | — | Prior period label. |
| role | string | — | Viewer role label. |
| totalPopulation | number | — | `TOTAL_POPULATION`, sum of all `BARANGAYS[].population`. |
| konsultaVisits | inline `{total, deltaMonth, deltaYear, byWeekday: {day,visits}[], byBhc: {name,value}[]}` | — | Konsulta OPD visit KPI + breakdowns. |
| ekas | inline `{submitted, value, delta, byStatus: {status,count,color}[], byBhc: {name,value}[], daysToCutoff, unsettledCount}` | — | eKAS (Konsulta claim) KPI + breakdowns. |
| tbDots | inline `{activeCases, delta, byBarangay: {name,value}[], byPhase: {phase,count}[], treatmentSuccessRate}` | — | TB-DOTS program KPI + breakdowns. |
| immunization | inline `{coverage, delta, byAntigen: {antigen,coverage}[], byAgeGroup: {group,coverage}[]}` | — | Immunization coverage KPI + breakdowns. |
| maternalCoverage | inline `{value, delta, byTrimester: {trimester,count}[], byRisk: {risk,count}[]}` | — | Maternal coverage KPI + breakdowns. |
| htnControl | inline `{value, delta}` | — | Hypertension control KPI. |
| dmControl | inline `{value, delta}` | — | Diabetes control KPI. |
| referralCompletion | inline `{value, delta, byDestination: {name,value}[], byOutcome: {outcome,count,color}[]}` | — | Referral completion KPI + breakdowns. |
| barangays | BarangayMetricSet[] | — | See **BarangayMetricSet**. |
| epiCurve | DiseaseCurvePoint[] | — | See **DiseaseCurvePoint**. |
| morbidity | inline `{allAges: MorbidityRow[]; under5: MorbidityRow[]}` | — | See **MorbidityRow (LGU executive)**. |
| outbreaks | inline `{name: string; ratio: number; weeks: number}[]` | — | Outbreak-alert list (1 entry: Dengue, 2.6× baseline, 3 weeks). |

### Relationships
- Aggregates `BarangayMetricSet`, `DiseaseCurvePoint`, `MorbidityRow (LGU executive)`.
- `ekas.value = 14620 * KONSULTA_EKAS_RATE` — informal computed relationship to the `ph-constants.ts` flat rate.

### Source
`src/lib/analytics/lgu/executive.mock.ts`, produced by `getLguExecutiveData()` / `fetchLguExecutiveData()`. Also re-exports `months12` from `shared.mock.ts`.

### Notes
Nearly every nested KPI sub-object uses the same anonymous `{value, delta, ...}` pattern seen in `ExecutiveData` (hospital) — not backed by any shared named type across the two files.

---

## File: `src/lib/analytics/lgu/jurisdiction.mock.ts`

Jurisdiction roll-ups for the LGU Executive dashboard's geo-role switcher (Barangay Captain → Mayor/CHO → Governor → President). Only Cebu City (15 barangays) is modeled in full detail (via `getLguExecutiveData()`); Cebu Province's 9 other cities/municipalities and the Philippines' 17 regions are explicitly **not independently modeled** — they are deterministically scaled from Cebu City's real per-capita numbers by population ratio. Imports `seededRange` from `./shared.mock`, `getLguExecutiveData` from `./executive.mock`, and `PH_TOP_DIAGNOSES` from `../ph-constants`.

## Table: JurisdictionRow

**Description:** One jurisdiction's (city/province/region/country) rolled-up choropleth + KPI-strip metrics — the same metric set at every geo tier, so the Executive dashboard can render "same layout, different jurisdiction."

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| id | string | PK | Jurisdiction slug, e.g. `"city-cebu"`, `"province-cebu"`, `"region-7"`, `"national-ph"`. |
| name | string | — | Display name. |
| population | number | — | Population (real for Cebu City; a `popRatio`-derived estimate for everything else). |
| visitDensity | number | — | Konsulta visit density per 1,000 population. |
| immunizationCoverage | number | — | Immunization coverage %. |
| tbCases | number | — | TB case count. |
| hypertensionPrevalence | number | — | Hypertension prevalence %. |
| maternalCoverage | number | — | Maternal coverage %. |
| dengueCases | number | — | Dengue case count. |
| konsultaVisits | number | — | Konsulta visit count. |
| ekasSubmitted | number | — | eKAS claims submitted count. |
| ekasValue | number | — | eKAS PHP value (`ekasSubmitted * 1500`, i.e. hardcoded `1500`, not imported `KONSULTA_EKAS_RATE` — a duplicated literal of the same constant). |
| tbActiveCases | number | — | Active TB case count. |
| tbTreatmentSuccessRate | number | — | TB treatment success rate %. |
| htnControl | number | — | Hypertension control %. |
| dmControl | number | — | Diabetes control %. |
| referralCompletion | number | — | Referral completion %. |

### Relationships
- `CEBU_PROVINCE_CITIES: JurisdictionRow[]` (10 rows: Cebu City + 9 scaled sibling cities/municipalities) rolls up into `CEBU_PROVINCE_TOTAL: JurisdictionRow` via a population-weighted `rollUp()` helper.
- `PH_REGIONS: JurisdictionRow[]` (17 rows: Region VII built from `CEBU_PROVINCE_TOTAL` + a synthetic Bohol/Negros Oriental/Siquijor top-up roll-up; the other 16 regions scaled from Cebu City's per-capita rates against illustrative population ratios) rolls up into `PHILIPPINES_TOTAL: JurisdictionRow`.
- All scaled rows are produced by `scaleFromCebu(id, name, population, salt)`, which applies a `±15%` seeded jitter to Cebu City's per-capita `BASE` rates — informal, computed, not independently modeled data.

### Source
`src/lib/analytics/lgu/jurisdiction.mock.ts`, exported as `CEBU_PROVINCE_CITIES`, `CEBU_PROVINCE_TOTAL`, `PH_REGIONS`, `PHILIPPINES_TOTAL` (all `JurisdictionRow` or `JurisdictionRow[]`).

### Notes
This file also exports two helper functions that return arrays shaped like other files' types without importing them: `scaleEpiCurve(ratio)` returns `DiseaseCurvePoint`-shaped objects (no import, structural match only), and `jurisdictionMorbidity(population)` returns `MorbidityRow (LGU executive)`-shaped objects built from `PH_TOP_DIAGNOSES` rather than the hardcoded `morbidityAllAges` list. Neither return type is a named type alias in this file — both are inferred function return types.

---

## File: `src/lib/analytics/lgu/maternal.mock.ts`

Mock data for the Maternal & Child Health Dashboard. Imports `BARANGAYS, months12, seeded, seededRange, personName, patientId` from `./shared.mock`.

## Table: AncFunnelStage

**Description:** One stage of the Antenatal Care (ANC) funnel (Registered → 1st visit → 4+ visits → Delivered → Postpartum check). `{id, label, value}`-shaped duplicate of `FlowStage` — see Known Cross-File Inconsistencies #2.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| id | string | PK | Stage slug, e.g. `"registered"`. |
| label | string | — | Stage display label. |
| value | number | — | Stage count. |

### Relationships
- The base 5-stage `ancStages` array is scaled per-barangay (via a seeded 3–9% share plus a small per-stage decay) to populate `funnelByBarangay: Record<string, AncFunnelStage[]>`, keyed by `Barangay.name`.

### Source
`src/lib/analytics/lgu/maternal.mock.ts`, hardcoded 5-row `ancStages` array, embedded in `MaternalData.ancFunnel` and (scaled) `MaternalData.funnelByBarangay`.

### Notes
None.

## Table: RiskPatient

**Description:** One high-risk (or routine) pregnancy case row, for the maternal risk-stratification table.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| id | string | PK | Case id, e.g. `"MAT-1000"`. |
| name | string | — | Patient name, from `personName()` (the `shared.mock.ts` generator, not gender-aware). |
| barangay | string | FK -> Barangay.name (informal) | Barangay name. |
| risk | `"Low Risk" \| "High Risk" \| "Very High Risk"` | — | Risk tier. |
| gestWeeks | number | — | Gestational age in weeks, 8–38. |
| contact | string | — | Synthetic mobile number, format `09XXXXXXXXX`. |
| flags | string[] | — | Free-text risk flags, e.g. `["Pre-eclampsia risk", "HIV screening pending"]`. |

### Relationships
None beyond the informal barangay FK.

### Source
`src/lib/analytics/lgu/maternal.mock.ts`, produced by `buildRiskPatients()` (18 rows), embedded in `MaternalData.riskPatients`.

### Notes
None.

## Table: MaternalData (top-level wrapper)

**Description:** Top-level payload returned by `getMaternalData()`/`fetchMaternalData()` for the Maternal & Child Health Dashboard.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| tenant | string | — | `"Cebu City Health Office"`. |
| period | string | — | Current period label. |
| ancFunnel | AncFunnelStage[] | — | See **AncFunnelStage**. |
| funnelByBarangay | Record<string, AncFunnelStage[]> | — | Per-barangay scaled version of `ancFunnel`, keyed by barangay name. |
| ancCoverageByBarangay | inline `{name: string; coverage: number}[]` | — | ANC coverage % per barangay, sorted ascending. |
| riskStrat | inline `{risk: string; count: number; color: string}[]` | — | City-wide risk-tier counts (3 rows). |
| riskPatients | RiskPatient[] | — | See **RiskPatient**. |
| gestAgeHistogram | inline `{bucket: string; count: number; band: "early"\|"mid"\|"late"}[]` | — | 10-bucket gestational-age histogram. |
| deliveryOutcome | inline `{month, facility, hospital, home}[]` | — | 12-month delivery-location trend. |
| complications | inline `{month, pph, preeclampsia, obstructedLabor, sepsis, ucl}[]` | — | 12-month complication-rate trend with a flat `ucl` (upper control limit) of `20`. |
| newbornScreening | inline `{label: string; completion: number; incomplete: {name,barangay}[]}[]` | — | 4-item newborn-screening completion summary with incomplete-case drill-down. |
| immunizationRadar | inline `{label: string; value: number}[]` | — | 9-antigen coverage radar data. |
| immunizationByBarangay | inline `{name: string; coverage: number}[]` | — | Immunization coverage % per barangay. |
| nutrition | inline `{ageGroup, stunted, wasted, underweight}[]` | — | 4-age-group malnutrition-indicator table. |
| growthMonitoring | inline `{month: string; coverage: number}[]` | — | 12-month growth-monitoring coverage trend. |
| growthByBarangay | inline `{name: string; trend: number[]}[]` | — | Per-barangay 6-point growth-coverage trend. |

### Relationships
- Aggregates `AncFunnelStage`, `RiskPatient`.
- Nearly all other keys are anonymous inline shapes, not separately named types.

### Source
`src/lib/analytics/lgu/maternal.mock.ts`, produced by `getMaternalData()` / `fetchMaternalData()`.

### Notes
None.

---

## File: `src/lib/analytics/lgu/ncd.mock.ts`

Mock data for the NCD (Non-Communicable Disease) Management Dashboard. Imports `BARANGAYS, months12, seededRange, personName` from `./shared.mock` and `ComplianceCell` (type-only) from `@/components/analytics/lgu-shared`.

## Table: NcdBarangay

**Description:** One barangay's NCD (hypertension/diabetes/obesity) prevalence and program-enrollment summary.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| id | string | FK -> Barangay.id | Barangay id. |
| name | string | — | Barangay name. |
| htnPrevalence | number | — | Hypertension prevalence %. |
| dmPrevalence | number | — | Diabetes prevalence %. |
| obesityPrevalence | number | — | Obesity prevalence %. |
| ncdIndex | number | — | Composite index, `htn*0.45 + dm*0.35 + obesity*0.2`. |
| patientCount | number | — | NCD patient count. |
| controlRate | number | — | Percentage of patients with controlled NCD. |
| referralCount | number | — | Referral count. |
| medicationCompliance | number | — | Medication compliance %. |

### Relationships
None beyond the direct 1:1 build from `BARANGAYS`.

### Source
`src/lib/analytics/lgu/ncd.mock.ts`, produced by `buildBarangays()`, embedded in `NcdData.barangays`.

### Notes
None.

## Table: CascadeStage (NCD)

**Description:** One stage of the HTN or DM care cascade (Estimated → Screened → Diagnosed → Enrolled → Medicated → Controlled). `{id, label, value}`-shaped duplicate of `FlowStage`, and same name/shape as `CascadeStage` in `tb.mock.ts` — see Known Cross-File Inconsistencies #2 and #3.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| id | string | PK | Stage slug, e.g. `"estimated"`, `"controlled"`. |
| label | string | — | Stage display label. |
| value | number | — | Stage count (city-wide, not per-barangay). |

### Relationships
None identified beyond the cross-file shape duplication noted above.

### Source
`src/lib/analytics/lgu/ncd.mock.ts`, hardcoded 6-row arrays `htnCascade` and `dmCascade`, embedded in `NcdData.htnCascade` / `NcdData.dmCascade`.

### Notes
None.

## Table: NcdData (top-level wrapper)

**Description:** Top-level payload returned by `getNcdData()`/`fetchNcdData()` for the NCD Management Dashboard.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| tenant | string | — | `"Cebu City Health Office"`. |
| period | string | — | Current period label. |
| barangays | NcdBarangay[] | — | See **NcdBarangay**. |
| htnCascade | CascadeStage (NCD)[] | — | See **CascadeStage (NCD)**. |
| dmCascade | CascadeStage (NCD)[] | — | See **CascadeStage (NCD)**. |
| complianceRows | string[] | — | 10 patient names (row labels for the compliance heatmap), from `personName()`. |
| complianceColumns | string[] | — | 12 month labels (short form, e.g. `"Sep"`), derived from `months12`. |
| complianceMatrix | ComplianceCell[][] | — | 10×12 grid of medication-refill compliance cells; see **ComplianceCell** (Part 2, noted as trivial alias — `"ok" \| "missed" \| "na"`). |
| riskFactors | inline `{metric, barangay, city, national}[]` | — | 5-row risk-factor comparison table (smoking, alcohol, inactivity, obesity, hypercholesterolemia) at 3 geo levels. |

### Relationships
- Aggregates `NcdBarangay`, `CascadeStage (NCD)`.
- `complianceMatrix: ComplianceCell[][]` imports its cell type from `lgu-shared.tsx` rather than redeclaring it — consistent with `ComplianceCell`/`ComplianceHeatmap` being a genuinely shared primitive (unlike `FlowStage`).

### Source
`src/lib/analytics/lgu/ncd.mock.ts`, produced by `getNcdData()` / `fetchNcdData()`.

### Notes
None.

---

## File: `src/lib/analytics/lgu/tb.mock.ts`

Mock data for the TB-DOTS Program Dashboard. Imports `BARANGAYS, seededRange, patientId` from `./shared.mock`. Uses a 24-month window (`months24`, Sep 2024–Aug 2026) rather than the usual 12-month `months12`.

## Table: TbTrendPoint

**Description:** One month of TB case-notification trend data (bacteriologically-confirmed vs. clinically-diagnosed), with a computed incidence rate.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| month | string | — | Month label (24-month range). |
| bacConfirmed | number | — | Bacteriologically-confirmed case count. |
| clinicallyDiagnosed | number | — | Clinically-diagnosed case count. |
| rate | number | — | Incidence rate per 100,000, computed as `(bacConfirmed + clinicallyDiagnosed) / 480_000 * 100_000`. |

### Relationships
None identified. `480_000` is a hardcoded population denominator, not sourced from `TOTAL_POPULATION`.

### Source
`src/lib/analytics/lgu/tb.mock.ts`, produced by `buildTrend()` (24 rows), embedded in `TbData.trend`.

### Notes
None.

## Table: CascadeStage (TB)

**Description:** One stage of the TB care cascade (Estimated burden → Suspects → Tested → Diagnosed → Initiated → Completed → Success). `{id, label, value}`-shaped duplicate of `FlowStage`, and same name/shape as `CascadeStage` in `ncd.mock.ts` — see Known Cross-File Inconsistencies #2 and #3.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| id | string | PK | Stage slug, e.g. `"estimated"`, `"success"`. |
| label | string | — | Stage display label. |
| value | number | — | Stage count. |

### Relationships
None identified beyond the cross-file shape duplication noted above.

### Source
`src/lib/analytics/lgu/tb.mock.ts`, hardcoded 7-row array, embedded in `TbData.cascade`.

### Notes
The last two stages (`"initiated"` and `"success"`/`"completed"`) reuse the value `704` for both `completed` and `success` rows — i.e. "Treatment success rate" is modeled as an absolute count equal to "Treatment completed," not as a separately-tracked percentage in this array (the percentage form, `whoTargetSuccess`, is a separate top-level field).

## Table: DrTbCase

**Description:** One Drug-Resistant TB (MDR/XDR/Pre-XDR) case, for the DR-TB case-management table.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| id | string | PK | Patient id, from `patientId()`. |
| barangay | string | FK -> Barangay.name (informal) | Barangay name. |
| type | `"MDR" \| "XDR" \| "Pre-XDR"` | — | Drug-resistance classification. |
| startDate | string | — | Treatment start date, `"2026-MM-DD"`. |
| phase | `"Intensive" \| "Continuation"` (as plain string) | — | Treatment phase. |
| nextReview | string | — | Next review date, `"2026-MM-DD"`. |
| status | `"On track" \| "Delayed" \| "Interrupted"` | — | Treatment status. |

### Relationships
None beyond the informal barangay FK.

### Source
`src/lib/analytics/lgu/tb.mock.ts`, computed inline (12 rows), embedded in `TbData.drTbCases`.

### Notes
None.

## Table: TbData (top-level wrapper)

**Description:** Top-level payload returned by `getTbData()`/`fetchTbData()` for the TB-DOTS Program Dashboard.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| tenant | string | — | `"Cebu City Health Office"`. |
| period | string | — | Current period label. |
| trend | TbTrendPoint[] | — | See **TbTrendPoint**. |
| nationalTarget | number | — | National TB incidence-rate target (flat `34`). |
| cascade | CascadeStage (TB)[] | — | See **CascadeStage (TB)**. |
| whoTargetSuccess | number | — | WHO target treatment success rate % (flat `90`). |
| outcomes | inline `{outcome: string; count: number; color: string}[]` | — | 6-row treatment-outcome breakdown (Cured, Treatment Completed, Failed, Lost to Follow-up, Died, Not Evaluated). |
| cohortTrend | inline `{month: string; successRate: number}[]` | — | 12-month treatment-success-rate trend, drawn from the back half of `months24`. |
| drTbCases | DrTbCase[] | — | See **DrTbCase**. |
| drTbByBarangay | inline `{id: string; name: string; count: number}[]` | — | Per-barangay DR-TB case counts. |

### Relationships
- Aggregates `TbTrendPoint`, `CascadeStage (TB)`, `DrTbCase`.

### Source
`src/lib/analytics/lgu/tb.mock.ts`, produced by `getTbData()` / `fetchTbData()`.

### Notes
None.

---

## File: `src/lib/analytics/lgu/konsulta.mock.ts`

Mock data for the Konsulta / PhilHealth OPD Analytics Dashboard. Imports `BHC_LIST, seededRange` from `./shared.mock` and `CalendarDay` (type-only) from `@/components/analytics/lgu-shared`.

## Table: BhcVolume

**Description:** One BHC's Konsulta visit volume, current vs. prior periods.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| bhc | string | FK -> BHC_LIST (informal) | BHC name. |
| current | number | — | Current-period visit count. |
| priorMonth | number | — | Prior-month visit count. |
| priorYear | number | — | Prior-year visit count. |

### Relationships
None identified.

### Source
`src/lib/analytics/lgu/konsulta.mock.ts`, computed inline (sorted desc by `current`), embedded in `KonsultaData.volumeByBhc`.

### Notes
None.

## Table: DenialReason (Konsulta)

**Description:** One eKAS (Konsulta claim) denial reason. Same name as, but a narrower shape than (missing `valueAtRisk`), `DenialReason` in `executive.mock.ts` (hospital) — see Known Cross-File Inconsistencies #3.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| code | string | PK | Denial code, e.g. `"KD-101"` (distinct `KD-` prefix, not shared with hospital's `DR-` codes). |
| reason | string | — | Denial reason label. |
| count | number | — | Denial count. |
| action | string | — | Recommended remediation action. |

### Relationships
None identified.

### Source
`src/lib/analytics/lgu/konsulta.mock.ts`, hardcoded 5-row array, embedded in `KonsultaData.denialReasons`.

### Notes
None.

## Table: FlowStageLike

**Description:** One stage of the Konsulta member-enrollment funnel. `{id, label, value}`-shaped duplicate of `FlowStage`, with a name that explicitly acknowledges the duplication — see Known Cross-File Inconsistencies #2.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| id | string | PK | Stage slug, e.g. `"estimated"`, `"referred"`. |
| label | string | — | Stage display label. |
| value | number | — | Stage count. |

### Relationships
None identified beyond the cross-file shape duplication noted above.

### Source
`src/lib/analytics/lgu/konsulta.mock.ts`, hardcoded 5-row array, embedded in `KonsultaData.enrollmentFunnel`.

### Notes
None.

## Table: KonsultaData (top-level wrapper)

**Description:** Top-level payload returned by `getKonsultaData()`/`fetchKonsultaData()` for the Konsulta / PhilHealth OPD Analytics Dashboard.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| tenant | string | — | `"Cebu City Health Office"`. |
| period | string | — | Current period label. |
| cutoffDay | number | — | Day-of-month PhilHealth submission cutoff (`25`). |
| volumeByBhc | BhcVolume[] | — | See **BhcVolume**. |
| calendarDays | CalendarDay[] | — | See **CalendarDay** (Part 2). |
| denialReasons | DenialReason (Konsulta)[] | — | See **DenialReason (Konsulta)**. |
| enrollmentFunnel | FlowStageLike[] | — | See **FlowStageLike**. |
| revenueByBhc | inline `{bhc, ekasValue, oopValue, visits, ekasSubmitted}[]` | — | Per-BHC revenue breakdown (eKAS value, out-of-pocket value, visit and submission counts). |

### Relationships
- Aggregates `BhcVolume`, `CalendarDay`, `DenialReason (Konsulta)`, `FlowStageLike`.

### Source
`src/lib/analytics/lgu/konsulta.mock.ts`, produced by `getKonsultaData()` / `fetchKonsultaData()`.

### Notes
`buildCalendar()` mocks "today" as August 7, 2026 (`isPast = date <= 7`) — consistent with the `currentDate` context of this documentation task's environment, though that is almost certainly a coincidence of the mock data's fixed design date, not a dynamic reference.

---

## File: `src/lib/analytics/lgu/population.mock.ts`

Mock data for the Population Health & Epidemiology Dashboard. Imports only `epiWeeks, seededRange` from `./shared.mock` — **does not import `BARANGAYS` or `BHC_LIST`** (see Known Cross-File Inconsistencies #5). Also redeclares its own local `months12` array instead of importing `shared.mock.ts`'s.

## Table: PyramidBand

**Description:** One age-band row of a population pyramid (male/female counts).

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| band | string | — | Age band label, e.g. `"0-4"`, `"70+"` (15 bands). |
| male | number | — | Male count in this band. |
| female | number | — | Female count in this band. |

### Relationships
None identified. Three separate `PyramidBand[]` series are built from the same `ageBands` list at different population scales (see **PopulationData** below).

### Source
`src/lib/analytics/lgu/population.mock.ts`, produced by `buildPyramid(scale, salt)`, embedded in `PopulationData.pyramidRegistered` / `.pyramidActive` / `.pyramidPhilhealth`.

### Notes
None.

## Table: UtilizationSeries

**Description:** One health service's monthly utilization-rate trend vs. a benchmark target.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| service | string | — | Service name, e.g. `"ANC"`, `"TB-DOTS"`, `"Mental health"` (9 services). |
| benchmark | number | — | Target utilization rate %. |
| trend | inline `{month: string; value: number}[]` | — | 12-month utilization trend. |

### Relationships
None identified.

### Source
`src/lib/analytics/lgu/population.mock.ts`, produced by `buildUtilization()`, embedded in `PopulationData.utilization`.

### Notes
None.

## Table: SdohMetric

**Description:** One Social Determinants of Health (SDOH) indicator, for the SDOH summary panel.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| label | string | — | Indicator label, e.g. `"4Ps / Pantawid enrollment"`. |
| value | number | — | Indicator value %. |
| delta | number | — | Change vs. prior period. |
| actionLabel | string | — | Label for the associated action button. |

### Relationships
None identified.

### Source
`src/lib/analytics/lgu/population.mock.ts`, hardcoded 5-row array, embedded in `PopulationData.sdoh`.

### Notes
None.

## Table: CommunicableDiseasePoint

**Description:** One epidemiological week's case counts across 10 tracked communicable diseases, for the disease-surveillance chart.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| week | string | — | Epi-week label. |
| dengue | number | — | Dengue case count (spikes from week 8 onward). |
| ili | number | — | Influenza-Like Illness case count. |
| typhoid | number | — | Typhoid case count. |
| cholera | number | — | Cholera case count. |
| measles | number | — | Measles case count. |
| covid | number | — | COVID-19 case count. |
| lepto | number | — | Leptospirosis case count. |
| rabies | number | — | Rabies (animal-bite) case count. |
| abd | number | — | Acute Bloody Diarrhea case count. |
| hfmd | number | — | Hand-Foot-Mouth Disease case count. |

### Relationships
None identified. `outbreakThreshold: number` (flat `30`) sits alongside this array on `PopulationData` as the outbreak-detection cutoff, but is not a per-row field.

### Source
`src/lib/analytics/lgu/population.mock.ts`, computed inline over `epiWeeks`, embedded in `PopulationData.communicable`.

### Notes
None.

## Table: PopulationData (top-level wrapper)

**Description:** Top-level payload returned by `getPopulationData()`/`fetchPopulationData()` for the Population Health & Epidemiology Dashboard.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| tenant | string | — | `"Cebu City Health Office"`. |
| period | string | — | Current period label. |
| pyramidRegistered | PyramidBand[] | — | Full registered-population pyramid (scale 1.0). |
| pyramidActive | PyramidBand[] | — | Active-patient pyramid (scale 0.62). |
| pyramidPhilhealth | PyramidBand[] | — | PhilHealth-covered pyramid (scale 0.74). |
| diseaseBurden | inline `{ageGroup, infection, ncd, maternal, injury, other}[]` | — | 5-age-group disease-burden-category breakdown. |
| utilization | UtilizationSeries[] | — | See **UtilizationSeries**. |
| sdoh | SdohMetric[] | — | See **SdohMetric**. |
| communicable | CommunicableDiseasePoint[] | — | See **CommunicableDiseasePoint**. |
| outbreakThreshold | number | — | Flat outbreak-detection threshold (`30`). |

### Relationships
- Aggregates `PyramidBand` (×3), `UtilizationSeries`, `SdohMetric`, `CommunicableDiseasePoint`.
- **No relationship to `BARANGAYS`/`BHC_LIST`** — this file operates entirely at the city-wide level (see Known Cross-File Inconsistencies #5).

### Source
`src/lib/analytics/lgu/population.mock.ts`, produced by `getPopulationData()` / `fetchPopulationData()`.

### Notes
None.

---

## File: `src/lib/analytics/lgu/cohort.mock.ts`

Synthetic community-patient dataset for the LGU Cohort Builder (`/lgu/analytics/cohorts`), across the 15-barangay catchment. Imports `BARANGAYS, patientId, personName, seeded, seededRange` from `./shared.mock`.

## Table: CommunityPatient

**Description:** One synthetic community patient row for the LGU Cohort Builder query tool. Like the hospital `cohort.mock.ts`, there is no separate "Data" wrapper interface — the file's primary export is a flat `CommunityPatient[]` array.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| patientId | string | PK | Patient id, from `patientId(i + 500)`. |
| name | string | — | Patient name, from `personName(i + 5)`. |
| age | number | — | Patient age, 0–84. |
| gender | `"male" \| "female"` | — | Patient gender. |
| barangayId | string | FK -> Barangay.id | Barangay id. |
| barangayName | string | — | Barangay name (denormalized alongside `barangayId`). |
| diagnosisCode | string | — | ICD-10 code, from a local 8-entry `diagnoses` list distinct from `PH_TOP_DIAGNOSES` (includes `A90` dengue, `Z34.9` normal pregnancy supervision). |
| diagnosisDesc | string | — | Diagnosis description. |
| pregnant | boolean | — | True if female, age 15–45, and a seeded condition (`seeded(i,62) > 0.86`). |
| fullyImmunized | boolean | — | Seeded boolean, threshold varies by age (<5 vs. ≥5). |
| hypertensive | boolean | — | True if age ≥30 and a seeded condition. |
| diabetic | boolean | — | True if age ≥30 and a seeded condition. |
| tbCase | boolean | — | Seeded boolean (~8% of rows). |
| dengueCase | boolean | — | True if `diagnosisCode === "A90"` or a seeded condition. |
| lastVisitDate | string | — | ISO date within a ~7-month window of 2026. |

### Relationships
- `barangayId`/`barangayName` are a direct 1:1 pull from `BARANGAYS[i % BARANGAYS.length]` — informal FK (both id and denormalized name copied, not just an id reference).

### Source
`src/lib/analytics/lgu/cohort.mock.ts`, produced by `buildCommunityPatients(320)`, exported as `communityPatients: CommunityPatient[]`, wrapped by `fetchCommunityPatients()`.

### Notes
None.

---

## File: `src/lib/analytics/lgu/temporal.mock.ts`

Hour × weekday visit-volume mock data for the LGU Temporal Pattern Analysis tool (`/lgu/analytics/patterns`). Models BHC business-hours-only, closed-Sunday, half-day-Saturday patterns — a different shape from the hospital's 24/7 profile. Imports `HourWeekdayCell` (type-only) from `@/components/analytics/temporal-heatmap` and `BHC_LIST` from `./shared.mock`. Redeclares its own local `seeded`/`seededRange` helpers rather than importing them from `shared.mock.ts` (a minor, functionally-harmless duplication — both implementations are identical sine-based formulas).

## Table: LguTemporalDataset (top-level wrapper)

**Description:** Top-level payload returned by `getLguTemporalData()`/`fetchLguTemporalData()` for the LGU Temporal Pattern Analysis tool.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| konsulta | HourWeekdayCell[] | — | 168-cell Konsulta OPD visit-volume grid (business hours, half-day Saturday, closed Sunday). See **HourWeekdayCell** (Part 2). |
| programs | HourWeekdayCell[] | — | 168-cell TB-DOTS/ANC program-visit grid (weekdays only, business hours). See **HourWeekdayCell** (Part 2). |

### Relationships
- Both fields are `HourWeekdayCell[]` imported from the shared component file, not redeclared locally — same sharing pattern as the hospital `temporal.mock.ts`.

### Source
`src/lib/analytics/lgu/temporal.mock.ts`, produced by `getLguTemporalData()` / `fetchLguTemporalData()`.

### Notes
This file also exports `TEMPORAL_BHCS = BHC_LIST` (re-export, not a type) and `bhcBreakdownFor(day, hour, total)`, a helper returning inline `{name: string; value: number}[]` (not a named type) for drill-down.

---

## File: `src/lib/analytics/lgu/alerts.mock.ts`

Static LGU alert data for the Alert & Notification Center tool. No local interfaces — imports `AlertItem` (type-only) from `@/components/analytics/alert-center` and exports two plain `AlertItem[]` constants. No "Data" wrapper interface exists for this file. **Does not import `BARANGAYS`/`BHC_LIST`/`shared.mock.ts` at all** (see Known Cross-File Inconsistencies #5).

- `lguAlerts: AlertItem[]` — 9 initial alerts (3 critical, 3 warning, 3 info).
- `lguAlertRefreshPool: AlertItem[]` — 3 alerts used as the "Refresh" button's pool.

See **AlertItem** in Part 2 for the field-level table. Source: `src/lib/analytics/lgu/alerts.mock.ts`.

---

# Part 6 — LGU Reports (`src/lib/reports/lgu.mock.tsx`)

8 report configs (R-11..R-18), same `ReportConfig<T>` contract as the hospital reports module. Imports `BARANGAYS, BHC_LIST` from `@/lib/analytics/lgu/shared.mock` for cross-module consistency (this is the one reports file that *does* consistently reuse the shared geography data rather than redeclaring it). **All row-shape interfaces below are file-local (not exported)**, same pattern as `hospital.mock.tsx`.

## Table: FhsisRow (R-11 Monthly FHSIS)

**Description:** One section × indicator × month row of the DOH Field Health Service Information System (FHSIS) M1/M2-equivalent report.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| section | string | FK -> local `fhsisIndicators` sections (informal) | Section name, e.g. `"Family Planning"`, `"Maternal Care"`, `"Child Care"`, `"Nutrition"`, `"NCD"`, `"TB"`. |
| indicator | string | — | Indicator label, e.g. `"ANC 1st visit"`, `"OPV3"` (28 indicators total). |
| month | string | — | Month label (6-month window). |
| isoDate | string | — | ISO first-of-month date. |
| count | number | — | Achieved count for the indicator/month. |
| target | number | — | Target count (flat per indicator, not scaled by month). |

### Relationships
None identified beyond the informal section FK. `coverage%` is derived at render time.

### Source
`src/lib/reports/lgu.mock.tsx`, file-local (not exported) interface, produced by `buildFhsis()` (28 indicators × 6 months = 168 rows), report id `fhsis-monthly` (code `R-11`).

### Notes
Not exported.

## Table: ImmunizationCoverageRow (R-12 Immunization Coverage by Antigen × Barangay)

**Description:** One barangay's EPI (Expanded Program on Immunization) coverage across 6 antigens.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| barangay | string | FK -> Barangay.name | Barangay name. |
| targetPopulation | number | — | POPCOM-based estimated 0–11-month target cohort (`population * 0.018`). |
| bcg | number | — | BCG coverage %. |
| hepB | number | — | HepB coverage %. |
| penta | number | — | Penta coverage %. |
| opv | number | — | OPV coverage %. |
| pcv | number | — | PCV coverage %. |
| mmr | number | — | MMR coverage %. |

### Relationships
- One row per `BARANGAYS` entry — direct 1:1 build.

### Source
`src/lib/reports/lgu.mock.tsx`, file-local (not exported) interface, produced by `buildImmunizationCoverage()` (15 rows), report id `immunization-coverage-antigen-barangay` (code `R-12`).

### Notes
Not exported. Note: only 6 antigens here vs. the 7-antigen `antigens` list (`BCG, HepB, Penta, OPV, PCV, MMR, Rota`) used in `lgu/executive.mock.ts`'s `BarangayMetricSet.immunizationByAntigen` and `maternal.mock.ts`'s `immunizationRadar` — `Rota` is present in those two but omitted from this report's column set, a minor cross-file coverage-set inconsistency.

## Table: MaternalDeathRow (R-13 Maternal Death Audit Report)

**Description:** One maternal death case, for the restricted MHO/CHO-only quality-review report.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| date | string | — | ISO date of death. |
| caseLabel | string | — | De-identified case label, e.g. `"Case #1"`. |
| age | number | — | Patient age at death. |
| gravidaPara | string | — | Obstetric history shorthand, e.g. `"G2P1"`. |
| ancVisits | number | — | Number of ANC visits attended, 0–4. |
| causeCode | string | — | ICD-10 cause-of-death code, e.g. `"O72.1"`. |
| causeOfDeath | string | — | Cause-of-death description, e.g. `"Postpartum hemorrhage"`. |
| placeOfDeath | string | — | `"Referral hospital"` or `"En route to facility"`. |
| avoidable | `"Yes" \| "No" \| "Under review"` | — | Whether the death was assessed as avoidable. |
| recommendations | string | — | Free-text review-committee recommendation. |

### Relationships
None identified.

### Source
`src/lib/reports/lgu.mock.tsx`, file-local (not exported) interface, produced by `buildMaternalDeaths()` (5 rows), report id `maternal-death-audit` (code `R-13`), `roleNote: "MHO and CHO only — restricted"`.

### Notes
Not exported.

## Table: TbQuarterlyRow (R-14 TB Program Quarterly Report)

**Description:** One section × indicator × quarter row of the National TB Program (NTP Form 6-equivalent) quarterly submission.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| section | string | FK -> local `ntpIndicators` sections (informal) | Section, one of `"Case Notification"`, `"Treatment Enrollment"`, `"Treatment Outcomes"`. |
| indicator | string | — | Indicator label, e.g. `"Bacteriologically confirmed, new"` (11 indicators total). |
| quarter | string | — | Quarter label, e.g. `"Q3 2025"` (4-quarter window). |
| isoDate | string | — | ISO first-of-quarter date. |
| value | number | — | Count for the indicator/quarter. |

### Relationships
None identified.

### Source
`src/lib/reports/lgu.mock.tsx`, file-local (not exported) interface, produced by `buildTbQuarterly()` (11 indicators × 4 quarters = 44 rows), report id `tb-quarterly-ntp` (code `R-14`).

### Notes
Not exported.

## Table: KonsultaUtilRow (R-15 Konsulta Enrollment & Utilization Report)

**Description:** One BHC × month Konsulta Package (KP) enrollment/utilization performance row.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| bhc | string | FK -> BHC_LIST | BHC name. |
| month | string | — | Month label (6-month window). |
| isoDate | string | — | ISO first-of-month date. |
| membershipType | string | FK -> local `membershipTypes` list (informal) | Membership type, assigned positionally per BHC (`Formal Economy, Informal Economy, Indigent (NHTS), Senior Citizen`). |
| enrolledMembers | number | — | Enrolled member count. |
| activeVisitors | number | — | Active-visitor count (month-to-date). |
| ekasSubmitted | number | — | eKAS claims submitted. |
| ekasValue | number | — | PHP eKAS value. |
| approvalRate | number | — | Approval rate %. |
| denialRate | number | — | Denial rate %, `100 - approvalRate`. |

### Relationships
- One row per `BHC_LIST` entry × 6 months — direct build.

### Source
`src/lib/reports/lgu.mock.tsx`, file-local (not exported) interface, produced by `buildKonsultaUtil()` (5 BHCs × 6 months = 30 rows), report id `konsulta-enrollment-utilization` (code `R-15`).

### Notes
Not exported. `utilizationRate` is derived at render time (`activeVisitors / enrolledMembers`).

## Table: ReferralRow (R-16 Referral Network Analysis Report)

**Description:** One referral from a BHC to a receiving hospital facility.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| bhc | string | FK -> BHC_LIST | Referring BHC name. |
| date | string | — | ISO referral date. |
| referralReason | string | FK -> local `referralReasons` list (informal) | Referral reason, e.g. `"Suspected TB"`, `"High-risk pregnancy"` (6-item list). |
| receivingFacility | string | FK -> local `receivingFacilities` list (informal) | Receiving hospital, e.g. `"Cebu City Medical Center"` (4-item list). |
| outcomeDocumented | boolean | — | Whether the referral outcome has been documented (~78% true). |
| outcome | string | FK -> local `referralOutcomes` list (informal) | Outcome, one of `"Admitted", "OPD", "Returned"`, or `"Pending"` if not yet documented. |
| feedbackReceived | boolean | — | Whether feedback was received from the receiving facility (only possibly true if `outcomeDocumented`). |

### Relationships
- `totalReferralsFor(bhc)` (a report-column helper, not a stored field) counts rows in a module-level cache (`referralRowsCache`) matching a given `bhc` — an informal, computed aggregate, not a join.

### Source
`src/lib/reports/lgu.mock.tsx`, file-local (not exported) interface, produced by `buildReferrals()` (60 rows, cached once as `referralRowsCache`), report id `referral-network-analysis` (code `R-16`).

### Notes
Not exported.

## Table: HouseholdProfileRow (R-17 Community Household Health Profile)

**Description:** One barangay's aggregate household health profile, for barangay-level CBHIS profiling.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| barangay | string | FK -> Barangay.name | Barangay name. |
| households | number | — | Estimated household count (`population / 4.3`). |
| members | number | — | Total members (= `Barangay.population`). |
| philhealthCoverage | number | — | PhilHealth coverage %. |
| fourPsPct | number | — | 4Ps (Pantawid Pamilyang Pilipino Program) enrollment %. |
| withDm | number | — | Estimated count with diabetes. |
| withHtn | number | — | Estimated count with hypertension. |
| withTb | number | — | Estimated TB case count. |
| pregnant | number | — | Estimated pregnant-women count. |
| childrenUnder5 | number | — | Estimated children-under-5 count. |
| elderly | number | — | Estimated elderly (60+) count. |

### Relationships
- One row per `BARANGAYS` entry — direct 1:1 build; several counts are `population * seededRange(...)` fractions.

### Source
`src/lib/reports/lgu.mock.tsx`, file-local (not exported) interface, produced by `buildHouseholdProfile()` (15 rows), report id `community-household-health-profile` (code `R-17`).

### Notes
Not exported.

## Table: DengueRow (R-18 Dengue Surveillance Report — PIDSR format)

**Description:** One dengue case, formatted for the Philippine Integrated Disease Surveillance & Response (PIDSR) Case Investigation Form (CIF) / CESU submission.

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| caseNo | string | PK | Case number, e.g. `"DGE-2026-600"`. |
| dateOfOnset | string | — | ISO date of symptom onset. |
| barangay | string | FK -> Barangay.name | Barangay name. |
| age | number | — | Patient age, 2–70. |
| sex | `"M" \| "F"` | — | Patient sex (same `"M"/"F"` vs. `"male"/"female"` inconsistency noted under `LogbookRow` in the hospital reports). |
| dengueType | `"Dengue" \| "Dengue with Warning Signs" \| "Severe Dengue"` | — | WHO dengue classification. |
| outcome | string | FK -> local `dengueOutcomes` list (informal) | Outcome; Severe Dengue cases are forced to `"Died"` or `"Referred"` via a seeded branch rather than drawn from the general `dengueOutcomes` pool. |
| hospitalized | boolean | — | Whether the patient was hospitalized. |
| dateNotifiedCesu | string | — | ISO date the case was notified to the Community Epidemiology and Surveillance Unit (CESU). |

### Relationships
- One row's `barangay` is drawn positionally from `BARANGAYS` — informal FK.
- `automationNote` on this report states it "Auto-triggers an outbreak alert when weekly case count exceeds the epidemic threshold (see LGU Analytics → Executive)" — an informal, documented-but-not-code-enforced link to `lgu/executive.mock.ts`'s `outbreaks` field and `DiseaseCurvePoint`/`dengueBaseline` outbreak logic (the two are not actually wired together in code; both independently model a dengue outbreak narrative).

### Source
`src/lib/reports/lgu.mock.tsx`, file-local (not exported) interface, produced by `buildDengueCases()` (34 rows), report id `dengue-surveillance-pidsr` (code `R-18`).

### Notes
Not exported.

## Table: lguReports (file-level export, not a row type)

**Description:** The file's true top-level export — an array of all 8 `ReportConfig<T>` objects (R-11..R-18).

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| (array of) `ReportConfig<FhsisRow \| ImmunizationCoverageRow \| MaternalDeathRow \| TbQuarterlyRow \| KonsultaUtilRow \| ReferralRow \| HouseholdProfileRow \| DengueRow>` | — | 8-element array, one per report code R-11..R-18. |

### Relationships
- Aggregates all 8 row-type tables in this Part.

### Source
`src/lib/reports/lgu.mock.tsx`, exported as `lguReports: AnyReportConfig[]`; individual reports retrievable via `getLguReport(id)`.

### Notes
Same `AnyReportConfig = ReportConfig<any>` type-erasure pattern as the hospital reports file — see that Part's Notes.

---

# Appendix — Table Count Summary

| Group | Files | Tables documented (interfaces/types with named fields + wrapper types) |
|---|---|---|
| Shared reference/constants | `ph-constants.ts`, `lgu/shared.mock.ts` | 2 (`IcdEntry`, `Barangay`) |
| Shared component prop types | `temporal-heatmap.tsx`, `alert-center.tsx`, `lgu-shared.tsx` | 5 (`HourWeekdayCell`, `AlertItem`, `FlowStage`, `BarangayDatum`, `CalendarDay`) |
| Hospital (Type A) dashboards | `analytics.mock.ts` (legacy), `executive.mock.ts`, `clinical.mock.ts`, `revenue.mock.ts`, `claims.mock.ts`, `quality.mock.ts`, `laboratory.mock.ts`, `cohort.mock.ts`, `temporal.mock.ts`, `alerts.mock.ts` | 72 |
| Hospital reports | `reports/hospital.mock.tsx` | 11 (10 row types + 1 file-level export table) |
| LGU (Type B) dashboards | `lgu/executive.mock.ts`, `lgu/jurisdiction.mock.ts`, `lgu/maternal.mock.ts`, `lgu/ncd.mock.ts`, `lgu/tb.mock.ts`, `lgu/konsulta.mock.ts`, `lgu/population.mock.ts`, `lgu/cohort.mock.ts`, `lgu/temporal.mock.ts`, `lgu/alerts.mock.ts` | 26 |
| LGU reports | `reports/lgu.mock.tsx` | 9 (8 row types + 1 file-level export table) |
| **Total** | 25 mock/component files | **125 tables** |

Every attribute in every table above was read directly from the cited source file — none were inferred or assumed. Items explicitly marked `Needs verification` or left as `Unknown` in this document: the exact hour/minute unit of `LabTatCategory.median` in `executive.mock.ts`; the exact day-range boundaries implied by `ARAgingRow.d31`/`d61` field names in `revenue.mock.ts`; and the consuming component for `BarangayDatum` (`lgu-shared.tsx`), which was not in scope to trace beyond the mock/component files listed for this task.

