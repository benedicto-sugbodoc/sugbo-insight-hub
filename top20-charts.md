# Top 20 New Analytics Charts for SugboDoc

This document proposes the 20 best **new** analytics charts/visualizations to add to the SugboDoc
prototype (React + TanStack Router + Recharts, mock-data-driven hospital and LGU/public-health
analytics). Every chart below is grounded strictly in fields that already exist in the mock-data
schema — no hypothetical columns, no invented relationships. The grounding source is
`schema.md`, a verified, field-by-field inventory of every exported TypeScript
`interface`/`type` across `src/lib/analytics/**`, `src/lib/reports/**`, and the shared
`src/components/analytics/*.tsx` prop types. Every "Data Required" section below cites an exact
table/field pair from that document. The de-duplication pass against the site's current chart
inventory (18 routes, hospital + LGU, every panel and custom component, gathered by a prior
research pass reading every route file) is described inline for each chart, and a full "Charts
Considered But Rejected" list closes out the document with ideas that were dropped for being
too close to something that already exists, or because the data simply isn't there.

## Note on D3 recommendations

The original brief for this document asked to read a project reference file, `d3.md`, before
making any D3.js recommendations. That file was searched for exhaustively — across the repo,
session uploads, and the outputs folder — and **does not exist anywhere in this project.**
Rather than fabricate a citation to it, the D3 recommendations in this document are based on
general D3.js domain knowledge (scales, `d3-sankey`, `d3-hierarchy`, `d3-geo`, `d3-force`,
`d3-brush`/`d3-zoom`, `d3-hexbin`, `d3-voronoi`, chord/arc diagrams, streamgraphs, etc.), not on
any SugboDoc-specific guidance. Where D3 is recommended, the reasoning is spelled out explicitly
so it can be checked against the actual codebase rather than taken on faith. In most of the 20
charts below, a standard Recharts chart or a hand-rolled component in the style of the ones
already in the codebase (`StageFlow`, `CalendarHeatmap`, `ComplianceHeatmap`) is judged sufficient
and is recommended over D3 — D3 is reserved for the one chart in this set with a genuine,
unaddressed technique gap (a true multi-node flow network), consistent with the instruction not
to force D3 onto every chart.

## How these 20 work together

These charts are not 20 unrelated ideas dropped onto 20 unrelated pages — they extend the
lifecycle stories the existing dashboards already tell, and several are deliberately designed to
link across the hospital/LGU boundary that the current site treats as two separate worlds. On the
hospital side, the existing Executive dashboard's headline KPIs (mortality, ALOS, revenue,
claims, remittance) each currently drill only "by department" in the shared drill-drawer; charts
1, 2, and 12 extend those same KPIs along dimensions the drawer doesn't yet reach (diagnosis,
admission type, and a payer × department cross-tab), so a director looking at the mortality KPI
tile can follow it to a genuinely new cut instead of the same department breakdown seen
everywhere else. Charts 6, 7, and 8 form a claims-lifecycle chain that the existing Claims
dashboard doesn't close: the current pipeline funnel stops at "Remittance Received" and the
denial-reasons bar stops at "why claims were denied" — this set adds what happens *after*
(remittance batch settlement status, the CR1/CR2/patient-share structure of what actually gets
paid, and whether denied claims are recovered on appeal), so a Revenue Cycle manager can trace a
claim end-to-end. Charts 4, 5, 9, 10, and 11 pull previously chart-less report data (daily
census, departmental AR trend, formulary, lab workload, discharge audit — all currently only
sitting in flat report tables under Part 4/6 of the schema) into purpose-built operational views,
each mapped to a specific "who acts on this" role (bed manager, revenue cycle lead, pharmacy/P&T
committee, lab manager, discharge planner). On the LGU side, charts 15, 16, 17, 19, and 20 fill an
analogous gap: FHSIS (16) becomes the LGU's own "cross-program executive rollup" the way the
Executive dashboard rolls up hospital KPIs, and it should sit one click above the
program-specific dashboards (Maternal, NCD, TB, Konsulta) the same way the hospital Executive
dashboard sits above Clinical/Revenue/Claims/Quality/Lab. Chart 13 (the BHC→hospital referral
Sankey) is the one chart in this set explicitly designed as a **cross-link**: it uses LGU report
data (`ReferralRow`) whose `receivingFacility` values include the hospital tenant itself, so it is
the natural "where did this patient come from" companion to the hospital's own referral-flow
chart, and a plausible click-through target from both the LGU Executive dashboard and the
hospital Clinical dashboard. Chart 18 (dengue severity/outcome) is designed to sit directly next
to the LGU Executive dashboard's existing Epidemic Curve, which currently shows *volume* of a
live 2.6×-baseline dengue outbreak but nothing about how severe those cases are — 18 answers "how
bad is it," which is the natural next question after "how much of it is there." Throughout, the
underlying period/department/barangay/payer filters that already exist on each route (per the
inventory) are assumed as shared context — none of these charts introduce a new filter axis the
page doesn't already have, with the partial exception of the two new "matrix" cross-tabs (12, 14)
which are explicitly designed to let a user click a cell and land on the same drill-drawer pattern
already used elsewhere in the app.

---



## 1. Mortality Rate by Diagnosis



### Business Question

Which specific diagnoses carry the highest mortality burden, and is that burden concentrated in a
few high-risk conditions the hospital should target with a clinical improvement program?

### Data Required

`ExecutiveData.mortality.byDiagnosis` -> anonymous `{name: string; value: number}[]` (nested inline
inside `ExecutiveData.mortality: {value, delta, byDepartment, byDiagnosis}`).

### Calculation

Each `{name, value}` pair is an **aggregated metric** — a mortality value pre-aggregated across all
admissions grouped by diagnosis name (the mock data supplies this pre-computed; no raw per-encounter
rows are exposed for this breakdown). The chart itself performs no further calculation beyond
sorting the array descending by `value` and optionally computing each diagnosis's share of the
overall `ExecutiveData.mortality.value` KPI (a **derived metric**: `byDiagnosis[i].value / mortality.value`).

### Standard Visualization

Horizontal bar chart, diagnoses sorted descending, with the overall mortality KPI shown as a
reference line/value for context.

### D3 Recommendation

Standard bar chart is sufficient — no D3 needed, because a sorted single-metric ranking is exactly
what a plain horizontal bar does best and this chart type is already extensively used on the site.

### Relevant D3 Technique

N/A.

### Interaction

Click a bar to open the shared drill-drawer (same pattern as the existing "by department" mortality
breakdown) filtered to that diagnosis; hover tooltip shows value and % of total mortality.

### Implementation Complexity

Low — reuses the existing horizontal-bar pattern and drill-drawer infrastructure already built for
the department-level version of this same KPI.

### Why This Chart Matters

The Executive dashboard's mortality KPI currently only drills "by department" (per the existing
drill-drawer inventory); clinicians think in diagnoses, not departments, when prioritizing quality
interventions, so this closes a real gap in the same KPI's drill path without duplicating the
existing department view.

---



## 2. ALOS by Admission Type



### Business Question

Do emergency, elective, transfer-in, and newborn admissions have meaningfully different average
lengths of stay — and if emergency ALOS is rising, does that signal ED boarding or downstream bed
pressure?

### Data Required

`ExecutiveData.alos.byAdmissionType` -> anonymous `{name: string; value: number}[]` (nested inside
`ExecutiveData.alos: {value, delta, byDepartment, byChapter, byAdmissionType}`).

### Calculation

Each `{name, value}` pair is an **aggregated metric** (mean length-of-stay pre-aggregated across all
admissions of that admission type). The chart also plots the hospital-wide `ExecutiveData.alos.value`
(also an aggregated metric, aggregated across all admissions regardless of type) as a reference line
so each admission-type bar can be read as above/below the overall average.

### Standard Visualization

Horizontal or vertical bar chart with a `ReferenceLine` at the overall ALOS value.

### D3 Recommendation

Standard bar chart with reference line is sufficient — no D3 needed; this is a four-category
comparison against a benchmark, a pattern Recharts already handles well elsewhere on the site (e.g.
Hand Hygiene Monthly Trend's target line).

### Relevant D3 Technique

N/A.

### Interaction

Hover tooltip with exact days and delta vs. overall average; click-through to the admissions table
(`ExecutiveData.admissions.rows`, `AdmissionRow[]`) pre-filtered by admission type is possible in a
future iteration but not required for v1.

### Implementation Complexity

Low — same four-bar-plus-reference-line shape as several existing charts.

### Why This Chart Matters

`byAdmissionType` is one of three ALOS breakdowns already computed in the mock data
(`byDepartment`, `byChapter`, `byAdmissionType`) but only the department cut is currently exposed
anywhere on the site; this uses data that already exists but is completely unvisualized, and
surfaces a genuinely different operational signal (patient-flow/boarding pressure) than the
department cut does.

---



## 3. Physician Productivity Quadrant



### Business Question

Which physicians are high-volume but low-revenue (possible undercoding), and which are
high-revenue but have a low PhilHealth approval rate (possible documentation/compliance risk)?

### Data Required

`PhysicianActivityRow` (file-local interface in `src/lib/reports/hospital.mock.tsx`, report R-07
"Physician Activity Report") -> fields `physician, specialty, department, isoDate, cases, avgLos, procedures, pfRevenue, philhealthPfClaims, approvalRate`.

### Calculation

X-axis = `cases` summed across the reporting window for a physician (**aggregated metric**, sum
across that physician's monthly rows). Y-axis = `pfRevenue` summed the same way (**aggregated
metric**). Bubble size = `approvalRate` for the physician's most recent month (**raw data** field,
read directly off the row, not recomputed). Quadrant lines are drawn at the cohort median of each
axis (**aggregated metric**, median across all physicians).

### Standard Visualization

Scatter/bubble chart (physician-level, one bubble per physician) — the same visual grammar as the
existing Comorbidity Clustering bubble chart, applied to a completely different table.

### D3 Recommendation

Standard Recharts `ScatterChart` with bubble sizing is sufficient — no D3 needed; bubble scatter is
already a well-covered chart type on the site (Comorbidity Clustering, SSI Funnel Plot).

### Relevant D3 Technique

N/A.

### Interaction

Hover shows physician name, specialty, cases, revenue, approval rate; click opens a detail panel
listing that physician's 12-month `PhysicianActivityRow` trend.

### Implementation Complexity

Medium — `PhysicianActivityRow` currently only powers a flat report table (R-07), so this requires
a new aggregation step (group 180 monthly rows down to one point per physician) that doesn't exist
yet, plus a new route/section since no current analytics page owns "physician productivity" as a
concept.

### Why This Chart Matters

This is a different table entirely from the two existing physician-adjacent charts: the Clinical
dashboard's Surgeon Performance table is OR/surgical-outcomes-only (`SurgeonRow`, a different local
name pool), and the Claims dashboard's Physician Claim Row is submission/denial-focused
(`PhysicianClaimRow`). `PhysicianActivityRow` is the only table with both case volume *and*
professional-fee revenue *and* approval rate together, and today it is trapped inside a report
table nobody would think to open for performance management — this promotes genuinely unused data
into a chart.

---



## 4. Ward Occupancy & Discharge Readiness Heatmap



### Business Question

Which specific wards are gridlocked *today* — full beds combined with a backlog of patients who
are clinically ready to leave but haven't — so bed management can intervene before it becomes an ED
boarding problem?

### Data Required

`CensusRow` (file-local interface in `src/lib/reports/hospital.mock.tsx`, report R-01 "Daily Census
Report") -> fields `date, ward, capacity, occupied, admissionsToday, dischargesToday, pendingDischarges`.

### Calculation

Grid cell color = occupancy rate, a **derived metric** computed per row as `occupied / capacity`.
Cell badge/overlay = `pendingDischarges`, a **raw data** field read directly off the row (the count
of discharges pending clearance that ward/day). No values are aggregated across wards or days for
the base grid — each cell is one ward × one day.

### Standard Visualization

A ward (rows) × day (columns) grid/heatmap, color-coded by occupancy rate with a secondary visual
cue (e.g. a dot or number badge) for `pendingDischarges` — the same grid pattern as the existing
ICD-10 Case Heatmap (dept × month) and Compliance Heatmap (patient × month), applied to a
ward/day/discharge-readiness axis none of those use.

### D3 Recommendation

Standard hand-rolled grid (in the style of the existing `HourWeekdayHeatmap`/`ComplianceHeatmap`
components) is sufficient — no D3 needed; grid-based heatmaps at this scale (8 wards × 21 days ≈
168 cells) are already a proven, well-covered pattern in this codebase and don't need D3's
performance or layout machinery.

### Relevant D3 Technique

N/A.

### Interaction

Click a cell to drill into that ward/day's admissions/discharges detail; hover tooltip shows
capacity, occupied, available, and pending-discharge count.

### Implementation Complexity

Medium — `CensusRow` currently only powers the R-01 flat report table, so this needs a new
day-grain aggregation surfaced as a first-class chart (not just a sortable table), plus a home on
an operational/bed-management view.

### Why This Chart Matters

The existing BOR content on the Executive dashboard is monthly-trend and department/ward
snapshot-level (`ExecutiveData.bor.trend`, `.byWard`) — useful for a director's monthly review, but
useless for "which ward do I call right now." `CensusRow` is the only table in the schema with
*daily* ward-level capacity data plus the `pendingDischarges` discharge-readiness signal, and it's
currently locked inside a flat report nobody would check for real-time bed management.

---



## 5. Departmental AR Trend (Outstanding % Over Time)



### Business Question

Which departments' uncollected receivables are trending worse month over month, before they show
up as a crisis in the aging buckets?

### Data Required

`RevenueRow` (file-local interface in `src/lib/reports/hospital.mock.tsx`, report R-06 "Revenue &
Collection Report") -> fields `month, isoDate, department, grossCharges, outstandingAr`.

### Calculation

Y-axis = outstanding-AR rate, a **derived metric** computed per row as `outstandingAr / grossCharges`, plotted as one line per department across the 12 months in the dataset. No
cross-row aggregation is needed since `RevenueRow` already has one row per month × department.

### Standard Visualization

Multi-line trend chart, one line per department (8 lines, using the existing `PH_DEPARTMENT_COLORS`
palette for visual consistency with other department-colored charts on the site).

### D3 Recommendation

Standard multi-line chart is sufficient — no D3 needed; multi-line trends with 6–10 series are
already a well-covered, well-understood pattern on the site (Disease Trend Analysis, Communicable
Disease Trend).

### Relevant D3 Technique

N/A.

### Interaction

Legend toggle to isolate one department's line; hover tooltip with exact AR% and PHP amount; click
a department's line to open its 12-month detail table.

### Implementation Complexity

Low — straightforward line-chart binding once `RevenueRow` is pulled out of the report-only file and
exposed to a chart component.

### Why This Chart Matters

The existing "AR Aging by Payer" chart is a single-snapshot grouped bar by **payer**, with no time
dimension and no department dimension (`ARAgingRow`, 5 static rows). `RevenueRow` is the only table
with both a department axis *and* a 12-month time axis for outstanding AR — this is the trend view
that would let a Revenue Cycle director catch a department's AR problem forming instead of finding
out about it only after it's already aged past 90 days.

---



## 6. PhilHealth Remittance Batch Status & Value Tracker



### Business Question

How much expected PhilHealth remittance is sitting in batches that are stuck (not yet received),
and which case types are driving the delay?

### Data Required

`ExecutiveData.remittance.batches` -> anonymous `{batch: string; caseType: string; claims: number; amount: number; status: string}[]` (nested inside `ExecutiveData.remittance: {received, expected, delta, batches}`).

### Calculation

Each `{batch, caseType, claims, amount, status}` row is **raw data** (one row per remittance batch).
The chart groups rows by `status` and sums `amount` per status — an **aggregated metric**
(`sum(amount) grouped by status`) — and separately sums `amount` by `caseType` within
each status for a stacked breakdown (also an **aggregated metric**). The overall
`ExecutiveData.remittance.received` / `.expected` values (already-aggregated fields supplied by the
mock data) anchor the chart as a reference total.

### Standard Visualization

Stacked horizontal bar chart: one bar per status (e.g. "Received," "Processing," "Pending"),
segmented by case type, with total expected remittance shown as a reference marker.

### D3 Recommendation

Standard stacked bar chart is sufficient — no D3 needed; stacked bars by status/category are
already the most common chart pattern on the site (Payer Mix trended bar, Discharge Disposition
stacked bar).

### Relevant D3 Technique

N/A.

### Interaction

Click a status segment to see the underlying batch list (`batch`, `caseType`, `claims`, `amount`);
hover for per-segment PHP value and claim count.

### Implementation Complexity

Low — the data already exists as a clean array on `ExecutiveData`; this is purely a matter of
wiring an unused field to a new chart.

### Why This Chart Matters

`ExecutiveData.remittance.batches` is not surfaced as a chart anywhere per the existing inventory —
only the top-line received/expected KPI numbers are shown. This closes the claims lifecycle: the
existing Claims dashboard's pipeline funnel ends at "Remittance Received" as a single stage; this
chart is the natural next-level view of what's actually happening inside that final stage,
batch by batch.

---



## 7. Claims Reimbursement Structure by Case Type (CR1 / CR2 / Patient Share)



### Business Question

For each PhilHealth case type, how much of the total charge is actually covered by the two-tranche
case-rate mechanism (CR1 + CR2) versus left as patient out-of-pocket exposure — and is that
exposure concentrated in specific case types the hospital should counsel patients about upfront?

### Data Required

`ClaimRow` (file-local interface in `src/lib/reports/hospital.mock.tsx`, report R-04 "PhilHealth
Claims Register") -> fields `caseType, grossCharges, cr1, cr2, patientShare`.

### Calculation

For each case type, sum `cr1`, `cr2`, and `patientShare` across all claims of that type — three
**aggregated metrics** (`sum(cr1)`, `sum(cr2)`, `sum(patientShare)`, each grouped by `caseType`).
Each case type's total is also expressed as a percentage split, a **derived metric**
(`sum(cr1) / (sum(cr1)+sum(cr2)+sum(patientShare))`, etc.) for the 100%-stacked view.

### Standard Visualization

100%-stacked horizontal bar chart, one bar per case type, three segments (CR1 / CR2 / Patient
Share).

### D3 Recommendation

Standard 100%-stacked bar is sufficient — no D3 needed; this exact stacking pattern already exists
on the site for Discharge Disposition, just applied to different fields.

### Relevant D3 Technique

N/A.

### Interaction

Hover for exact PHP amounts per segment; click a case type to filter the claims register-style
table to that case type.

### Implementation Complexity

Low — `ClaimRow` already carries all three fields per claim; this is a straightforward group-and-sum.

### Why This Chart Matters

This is a genuinely different question from the two existing case-rate charts on the Claims
dashboard: "Case rate vs actual charges" (`CaseRateScatterPoint`) and "Case rate coverage ratio"
(`CoverageDiagnosisRow`) both compare the case-rate *target* against actual *charges*, at the
diagnosis level. This chart instead shows how PhilHealth's own two-installment payment mechanism
(CR1/CR2) splits against what the patient is left to pay, at the case-type level — data (`cr1`,
`cr2`) that exists nowhere else in the schema and isn't visualized anywhere today.

---



## 8. Appeal Recovery Funnel & Amount Recovered



### Business Question

Of the claims that get denied, how many are actually appealed, and how much PHP is being recovered
through the appeal process versus written off by inaction?

### Data Required

`DenialRow` (file-local interface in `src/lib/reports/hospital.mock.tsx`, report R-05 "Denial &
Appeal Tracker") -> fields `denialCode, appealFiledDate, appealStatus, amountRecovered`.

### Calculation

Count of claims in each `appealStatus` bucket (`Not Filed`, `Filed — Pending`, `Under Review`,
`Approved`, `Rejected`) is an **aggregated metric** (`count(*) grouped by appealStatus`). Total PHP
recovered is `sum(amountRecovered)` restricted to `appealStatus === "Approved"` rows — an
**aggregated metric**. The overall appeal rate (`% of denied claims with appealFiledDate not null`)
is a **derived metric** computed from the raw `appealFiledDate` field.

### Standard Visualization

Funnel-style horizontal bar chart (reusing the existing hand-rolled `StageFlow` component pattern
already used for cascades-of-care) showing Denied → Appeal Filed → Under Review → Approved, with a
KPI callout for total PHP recovered.

### D3 Recommendation

Standard hand-rolled funnel (`StageFlow`-style) is sufficient — no D3 needed; this is exactly the
shape the existing `StageFlow` component was built for, just applied to appeals instead of
cascades-of-care.

### Relevant D3 Technique

N/A.

### Interaction

Click a stage to see the underlying claim list; a KPI card alongside shows recovery rate as % of
value-at-risk.

### Implementation Complexity

Low-Medium — reuses the existing `StageFlow` component; the only new work is shaping `DenialRow`
into `{id, label, value}` stages, which the codebase already does four times for other funnels.

### Why This Chart Matters

The existing Claims dashboard tells you *why* claims get denied (Top 10 Denial Reasons bar, Denial
Rate Trend) but nothing about what happens *after* — whether the hospital actually pursues and wins
appeals. `DenialRow`'s `appealStatus`/`amountRecovered` fields are unused anywhere today; this chart
closes the loop on the denial story and gives Revenue Cycle leadership a direct ROI number for the
appeals process.

---



## 9. Formulary Generic-Substitution Rate by Drug



### Business Question

Which specific drugs have the worst generic-substitution compliance, so the Pharmacy & Therapeutics
committee knows exactly where to focus formulary enforcement?

### Data Required

`FormularyRow` (file-local interface in `src/lib/reports/hospital.mock.tsx`, report R-09
"Prescription & Formulary Compliance Report") -> fields `generic, brandOrdered, orders, percentGeneric, inNf`.

### Calculation

`percentGeneric` per drug, aggregated across all physicians who prescribed it, is an **aggregated
metric** (mean or volume-weighted `percentGeneric` grouped by `generic`). `orders` summed per drug
is also an **aggregated metric**, used to size/weight the bars so high-volume, low-compliance drugs
stand out.

### Standard Visualization

Horizontal bar chart of generic-substitution rate by drug, sorted ascending (worst compliance
first), with bar length or a secondary encoding for order volume, and a target reference line.

### D3 Recommendation

Standard bar chart is sufficient — no D3 needed; ranked-bar-with-target-line is already a proven
pattern on the site (Hand Hygiene Compliance, Prescription Appropriateness).

### Relevant D3 Technique

N/A.

### Interaction

Click a drug to see the physician-level breakdown for that drug (`FormularyRow` rows filtered by
`generic`); hover shows brand ordered, order count, and NF (National Formulary) status.

### Implementation Complexity

Low — `FormularyRow` already has every field needed; just needs a group-by-drug aggregation step.

### Why This Chart Matters

The existing "Prescription Appropriateness by Dept" chart uses a completely different table
(`PrescriptionDept`) at the department grain (`genericRate`, `antibioticRate`, `polypharmacyRate`
per department). `FormularyRow` is drug-grain and currently sits only inside a flat report table
(R-09); a P&T committee needs to know *which drugs*, not just which departments, are the compliance
problem — this is a materially different, decision-relevant cut of formulary data that's currently
invisible.

---



## 10. Lab Test Efficiency: Order Volume vs. Average TAT



### Business Question

Which specific lab tests combine high order volume with slow turnaround time — the tests where a
process fix would have the biggest impact on overall lab throughput?

### Data Required

`LabWorkloadRow` (file-local interface in `src/lib/reports/hospital.mock.tsx`, report R-08
"Laboratory Workload Report") -> fields `test, category, ordersReceived, avgTat, criticalResults`.

### Calculation

X-axis = `ordersReceived` summed per test across the reporting window (**aggregated metric**).
Y-axis = `avgTat` averaged per test across the reporting window (**aggregated metric**, mean of a
field that is itself already a per-month average in the raw row — an average-of-averages). Bubble
size = `criticalResults` summed per test (**aggregated metric**).

### Standard Visualization

Scatter/bubble chart, one bubble per named test, with quadrant reference lines at the median volume
and median TAT.

### D3 Recommendation

Standard Recharts `ScatterChart` with bubble sizing is sufficient — no D3 needed; scatter/bubble is
already well-covered on the site (Comorbidity Clustering, SSI Funnel Plot, Case Rate vs. Actual
Charges).

### Relevant D3 Technique

N/A.

### Interaction

Hover shows test name, category, total orders, avg TAT, critical result count; click filters the
lab-workload table to that test's 12-month history.

### Implementation Complexity

Low-Medium — `LabWorkloadRow` currently only feeds the R-08 flat report; needs a group-by-test
aggregation across its 12 monthly rows per test.

### Why This Chart Matters

The existing Laboratory dashboard's TAT chart (`TatBoxStat`) is at the **category** grain
(Hematology, Chemistry, etc., 7 categories) via box-and-whisker distribution — useful for spotting
outlier *results* within a category, but useless for identifying which *named test* is the
bottleneck. `LabWorkloadRow` is the only table with both volume and TAT at the individual-test
grain, and it's currently trapped in a flat report (R-08) that nobody browsing the Laboratory
Analytics dashboard would ever see.

---



## 11. Discharge Readiness Blockers (Missing Documents & Incomplete Steps)



### Business Question

What is the single most common blocker keeping patients from a clean discharge — a specific missing
document, or an unfinished workflow step — so the discharge-planning team can fix the process
upstream instead of firefighting case by case?

### Data Required

`DischargeAuditRow` (file-local interface in `src/lib/reports/hospital.mock.tsx`, report R-10
"Discharge Clearance Audit Report") -> fields `stepsIncomplete, missingDocuments, claimStatus, daysSinceDischarge, csfCollected`.

### Calculation

Count of rows per `missingDocuments` value (e.g. "CSF," "None," other document types) is an
**aggregated metric** (`count(*) grouped by missingDocuments`). CSF (Claim Signature Form)
collection rate is a **derived metric** computed as `count(csfCollected === true) / count(*)`. Average `stepsIncomplete` and `daysSinceDischarge` are **aggregated metrics** (mean
across the 26 audit rows).

### Standard Visualization

Horizontal bar chart of blocker frequency (missing-document type), paired with a KPI card for CSF
collection rate and average days-since-discharge-with-open-items.

### D3 Recommendation

Standard bar chart is sufficient — no D3 needed; a simple ranked-frequency bar is the clearest way
to show "what's the #1 blocker," and this pattern is already common on the site.

### Relevant D3 Technique

N/A.

### Interaction

Click a blocker type to see the patient-level list of open cases with that blocker; sortable by
`daysSinceDischarge` to prioritize the oldest open items.

### Implementation Complexity

Low — `DischargeAuditRow` already has all needed fields; simple group-and-count.

### Why This Chart Matters

The existing "Unbilled Encounters Funnel" (`FunnelStage` in `revenue.mock.ts`) shows *how many*
encounters are stuck between discharge and payment, but not *why*. `DischargeAuditRow` is the only
table with the actual root-cause field (`missingDocuments`) and is currently used only for a flat
report table (R-10) — this chart turns "encounters are stuck" into "here's specifically what to
fix," a materially more actionable view built from data that already exists.

---



## 12. Readmission Rate Matrix: Payer × Department



### Business Question

Are 30-day readmissions concentrated in specific payer-and-department combinations (e.g. a
particular payer's patients in a particular department), which would point to a targeted discharge-
planning or care-coordination fix rather than a hospital-wide problem?

### Data Required

`CohortPatient` (`src/lib/analytics/cohort.mock.ts`) -> fields `department, payer, readmitted30d`.

### Calculation

For every payer × department cell, compute the readmission rate as a **derived metric per group**:
`count(readmitted30d === true) / count(*)`, i.e. an **aggregated metric** (readmission rate
aggregated across all `CohortPatient` rows sharing that payer and department). This is a genuine
two-dimensional cross-tabulation, not achievable with the existing single-field Cohort Builder
breakdown.

### Standard Visualization

A payer (rows) × department (columns) grid/heatmap, color-coded by readmission rate, in the style
of the existing `ComplianceHeatmap` component.

### D3 Recommendation

Standard hand-rolled grid is sufficient — no D3 needed; at this scale (roughly 5 payers × 8
departments ≈ 40 cells) a simple color-coded grid is clear and fast, and the codebase already has a
proven component (`ComplianceHeatmap`) for exactly this shape. A D3 matrix/correlation-matrix
technique would only be warranted at much larger N than this dataset supports.

### Relevant D3 Technique

N/A.

### Interaction

Click a cell to open the drill-drawer filtered to that payer + department combination, listing the
underlying `CohortPatient` rows; hover for exact rate and sample size (cells with very small N
should be visually flagged as low-confidence).

### Implementation Complexity

Low-Medium — reuses the existing heatmap-grid component pattern; the only new logic is the two-
dimensional group-by instead of the Cohort Builder's existing single-field group-by.

### Why This Chart Matters

The existing 30-Day Readmission Rate chart is a single time-series line (month over month,
hospital-wide) with `ReferenceArea` bands; the generic Cohort Builder only supports one
breakdown field at a time. Neither can show "which specific combination of payer and department"
is driving readmissions — this fills that specific, previously-impossible cross-tab, using data
(`CohortPatient`) that already exists and is already imported for the Cohort Builder tool.

---



## 13. BHC-to-Hospital Referral Network



### Business Question

Which Barangay Health Centers are referring patients to which hospitals, for what reasons, and with
what outcomes — and where is the referral loop breaking down (no feedback returned to the referring
BHC)?

### Data Required

`ReferralRow` (file-local interface in `src/lib/reports/lgu.mock.tsx`, report R-16 "Referral
Network Analysis Report") -> fields `bhc, referralReason, receivingFacility, outcomeDocumented, outcome, feedbackReceived`.

### Calculation

This chart is built directly from **raw data**: each `ReferralRow` is one referral event, and the
Sankey link weights are **aggregated metrics** — the flow volume from a given `bhc` node through a
given `referralReason` node to a given `receivingFacility` node to a given `outcome` node is
`count(*) grouped by (bhc, referralReason, receivingFacility, outcome)`. The feedback-loop closure
rate is a **derived metric**: `count(feedbackReceived === true) / count(outcomeDocumented === true)`.

### Standard Visualization

A standard bar chart could show top BHC→facility pairs, but it would flatten out the
reason/outcome dimensions that are exactly what makes this data actionable — a bar chart is
explicitly not recommended here.

### D3 Recommendation

D3 recommended — this is the one chart in this set with a genuine, unaddressed technique gap: a
true multi-stage flow (BHC → reason → receiving facility → outcome) with four node tiers and
weighted links. The codebase's existing hand-rolled `ReferralSankey` component only handles a
simple two-column source→target flow for hospital-internal referrals (`SankeyLink`); it was not
built for, and would need substantial rework to support, a four-tier node structure with proper
link routing and overlap avoidance.

### Relevant D3 Technique

`d3-sankey` (node/link layout with `sankeyLinkHorizontal()` for curved multi-tier flow ribbons).

### Interaction

Hover a link for its exact case count and PHP-adjacent context (referral reason); click a node
(e.g. a specific receiving facility) to highlight all flows through it and filter a detail table
below; a toggle to color links by `feedbackReceived` status to visually surface loop breakdowns.

### Implementation Complexity

High — genuinely new: requires pulling `d3-sankey` in as a dependency (not currently used anywhere
in the codebase), aggregating `ReferralRow`'s 60 rows into weighted node/link data, and building a
new React wrapper component around the D3 layout (the existing Recharts-based charts don't have a
Sankey primitive, and the hand-rolled `ReferralSankey` isn't structured for 4 tiers).

### Why This Chart Matters

This is the deliberate cross-link chart in this set: `ReferralRow.receivingFacility` includes real
hospital names (e.g. "Cebu City Medical Center"), so this is the one place in the entire site where
LGU-side data and hospital-side identity meet. It belongs as a click-through target from both the
LGU Executive dashboard (referral completion is already an LGU Executive KPI, just without any
network detail) and the hospital Clinical dashboard (which has its own, internal-only referral
Sankey) — giving a City Health Officer and a Hospital Medical Director a shared view of the same
patient-flow problem from opposite ends.

---



## 14. Immunization Coverage Matrix (Barangay × Antigen)



### Business Question

Which barangay is missing which specific vaccine — not just "which barangay has low overall
coverage," but "which antigen gap in that barangay needs a targeted catch-up campaign"?

### Data Required

`ImmunizationCoverageRow` (file-local interface in `src/lib/reports/lgu.mock.tsx`, report R-12
"Immunization Coverage by Antigen × Barangay") -> fields `barangay, bcg, hepB, penta, opv, pcv, mmr`.

### Calculation

Each cell (barangay × antigen) is **raw data** — a coverage percentage read directly off the row,
no aggregation needed since `ImmunizationCoverageRow` already has one row per barangay with all six
antigen columns. The only derived value is a per-barangay "fully-immunized-child" proxy, a
**derived metric** computed as the minimum coverage % across the six antigen columns for that row
(the weakest link determines full-course completion risk).

### Standard Visualization

A barangay (rows) × antigen (columns) grid/heatmap, color-coded by coverage %, in the style of the
existing `ComplianceHeatmap` component.

### D3 Recommendation

Standard hand-rolled grid is sufficient — no D3 needed; at 15 barangays × 6 antigens (90 cells) this
is well within the range the existing `ComplianceHeatmap` component (10 patients × 12 months = 120
cells) already handles cleanly.

### Relevant D3 Technique

N/A.

### Interaction

Click a cell to see the barangay's full `BarangayMetricSet.immunizationByAntigen` detail and
assigned PHN contact; hover for exact %; sort rows by the derived "weakest antigen" metric to
surface the most at-risk barangays first.

### Implementation Complexity

Low-Medium — `ImmunizationCoverageRow` currently only feeds the R-12 flat report table; needs to be
reshaped into a grid-cell array, reusing the existing heatmap-grid component.

### Why This Chart Matters

The existing Immunization content is either city-wide-only (the `CoverageRadar`, 9 antigens, no
barangay breakdown) or barangay-only-with-a-single-blended-metric (the horizontal bar of overall
`immunizationCoverage` per barangay, no per-antigen detail). Neither shows the actual cross of
barangay × antigen, which is precisely what a catch-up-campaign planner needs and which
`ImmunizationCoverageRow` already has, unused, sitting in a flat report.

---



## 15. NCD Burden vs. Control Bubble Chart



### Business Question

Which barangays combine a high NCD burden *and* poor treatment control — the highest-priority
targets for intensified hypertension/diabetes program outreach — versus barangays with high
prevalence but already-good control, which need less urgent intervention?

### Data Required

`NcdBarangay` (`src/lib/analytics/lgu/ncd.mock.ts`) -> fields `name, ncdIndex, patientCount, controlRate`.

### Calculation

X-axis = `ncdIndex`, itself a **derived metric** already computed in the mock data per barangay as
`htnPrevalence*0.45 + dmPrevalence*0.35 + obesityPrevalence*0.2` (a weighted composite of three raw
prevalence fields). Y-axis = `controlRate` — **raw data**, read directly per barangay row. Bubble
size = `patientCount` — **raw data**. No further cross-row aggregation; this chart plots one bubble
per `NcdBarangay` row as-is.

### Standard Visualization

Scatter/bubble chart, one bubble per barangay, with quadrant reference lines at the city median
`ncdIndex` and median `controlRate`.

### D3 Recommendation

Standard Recharts `ScatterChart` with bubble sizing is sufficient — no D3 needed; this exact visual
grammar (bubble chart, size = volume, two axes = severity/outcome) is already proven on the site for
the hospital's Comorbidity Clustering chart, and 15 barangays is a small, easily-labeled N.

### Relevant D3 Technique

N/A.

### Interaction

Hover shows barangay name, index, control rate, patient count; click opens the barangay's full NCD
detail (medication compliance heatmap row, referral count).

### Implementation Complexity

Low — all three fields already exist on `NcdBarangay`, which is already fetched for the existing
choropleth on the same route; this is an additional view over data already in memory.

### Why This Chart Matters

The existing NCD Burden Index choropleth shows only `ncdIndex` as a single color-ramped value per
barangay tile — it cannot show whether a high-burden barangay is *already being managed well*
(good `controlRate`) or is a true crisis (high burden, poor control, large `patientCount`). This
bubble chart adds the two dimensions the choropleth structurally can't show at once, turning "where
is NCD burden highest" into "where should the next outreach team actually go."

---



## 16. FHSIS Program Section Achievement Rollup



### Business Question

Across all six FHSIS program sections (Family Planning, Maternal Care, Child Care, Nutrition, NCD,
TB), which section is furthest behind its national target this reporting period — the one question
a CHO needs answered before allocating scarce field staff?

### Data Required

`FhsisRow` (file-local interface in `src/lib/reports/lgu.mock.tsx`, report R-11 "Monthly FHSIS") ->
fields `section, indicator, month, count, target`.

### Calculation

For each `section`, sum `count` and sum `target` across all its constituent indicators and the
selected month(s) — two **aggregated metrics** (`sum(count)`, `sum(target)`, both grouped by
`section`). Section-level achievement % is a **derived metric**: `sum(count) / sum(target)` per
section.

### Standard Visualization

`RadialBarChart` (a standard Recharts primitive), one radial bar per section, showing % of target
achieved — a chart type not currently used anywhere on the site but well suited to "six categories,
each a % of target" without needing D3.

### D3 Recommendation

Standard Recharts `RadialBarChart` is sufficient — no D3 needed. This isn't a capability gap D3
would meaningfully close; it's simply an unused-but-standard Recharts primitive that fits this
specific "N categories, each a bounded percentage" shape better than a bar chart would, without
introducing a new charting library.

### Relevant D3 Technique

N/A.

### Interaction

Click a section's radial segment to drill into its constituent indicators (e.g. click "Maternal
Care" to see "ANC 1st visit," "Facility-based delivery," etc. individually); hover for exact
count/target.

### Implementation Complexity

Low-Medium — `FhsisRow` currently only feeds the R-11 flat report; needs a group-by-section rollup,
plus introducing `RadialBarChart` (already part of the installed Recharts package, just unused).

### Why This Chart Matters

This is the LGU-side analog of the hospital Executive dashboard: just as that dashboard rolls up
ALOS/BOR/mortality/revenue into one screen, FHSIS is the LGU's own cross-program regulatory
rollup, and today it's invisible — sitting only inside a flat report table (R-11) nobody would
check to answer "which program is falling behind." Placing this one level above Maternal/NCD/TB/
Konsulta (which already have their own detailed dashboards) gives the LGU Executive view the same
"rollup → drill into specialist dashboard" structure the hospital side already has.

---



## 17. Konsulta Utilization Rate by Membership Type



### Business Question

Which PhilHealth Konsulta membership segment (Formal Economy, Informal Economy, Indigent/NHTS,
Senior Citizen) is under-utilizing their enrolled benefit — signaling an outreach or access barrier
specific to that segment, distinct from any particular BHC's performance?

### Data Required

`KonsultaUtilRow` (file-local interface in `src/lib/reports/lgu.mock.tsx`, report R-15 "Konsulta
Enrollment & Utilization Report") -> fields `bhc, month, membershipType, enrolledMembers, activeVisitors`.

### Calculation

For each `membershipType`, sum `enrolledMembers` and `activeVisitors` across all BHCs and the
selected month(s) — two **aggregated metrics**. Utilization rate per membership type is a
**derived metric**: `sum(activeVisitors) / sum(enrolledMembers)`.

### Standard Visualization

Vertical or horizontal bar chart, one bar per membership type, showing utilization rate, with a
citywide-average reference line.

### D3 Recommendation

Standard bar chart is sufficient — no D3 needed; four-category comparison against a benchmark is
already a proven, simple pattern on the site.

### Relevant D3 Technique

N/A.

### Interaction

Click a membership-type bar to see the BHC-level breakdown for that segment (cross-reference with
existing "Konsulta Visit Volume by BHC"); hover for exact enrolled/active counts.

### Implementation Complexity

Low — `KonsultaUtilRow` already has both fields needed; simple group-by-membership-type sum.

### Why This Chart Matters

Every existing Konsulta chart slices by BHC (Visit Volume by BHC, Revenue per BHC) or by city-wide
funnel stage (Enrollment Status StageFlow) — none slice by membership *segment*. Since
`membershipType` (Formal Economy / Informal Economy / Indigent (NHTS) / Senior Citizen) is a
policy-relevant equity dimension unique to `KonsultaUtilRow` and currently locked in the R-15 flat
report, this chart adds an angle (which population segment is being underserved) that no
BHC-level or funnel-level chart could ever show.

---



## 18. Dengue Case Severity & Outcome Breakdown



### Business Question

Given the active dengue outbreak already flagged on the LGU Executive dashboard (2.6× baseline),
how severe are the cases coming in — and is the hospitalization/mortality burden rising in a way
that requires surge-capacity planning at the receiving hospitals?

### Data Required

`DengueRow` (file-local interface in `src/lib/reports/lgu.mock.tsx`, report R-18 "Dengue
Surveillance Report — PIDSR format") -> fields `dengueType, outcome, hospitalized, dateOfOnset, barangay`.

### Calculation

Count of cases per `dengueType` (Dengue / Dengue with Warning Signs / Severe Dengue) is an
**aggregated metric** (`count(*) grouped by dengueType`). Within each severity tier, count of cases
per `outcome` is a nested **aggregated metric**. Hospitalization rate per severity tier is a
**derived metric**: `count(hospitalized === true) / count(*)`, computed within each `dengueType`
group.

### Standard Visualization

Stacked bar chart (severity tier on the x-axis, outcome as the stacked segments), paired with a KPI
card for overall hospitalization rate.

### D3 Recommendation

Standard stacked bar chart is sufficient — no D3 needed; this is the same stacked-bar-by-category
pattern used elsewhere on the site (Discharge Disposition), just applied to dengue severity/outcome
fields that exist nowhere else in the schema.

### Relevant D3 Technique

N/A.

### Interaction

Click a severity tier to filter to its case list (barangay, onset date); this chart should sit
directly beside the existing Epidemic Curve panel so a user can go from "volume is spiking" to "and
here's how severe" in one glance.

### Implementation Complexity

Low — `DengueRow` currently only feeds the R-18 flat report; straightforward group-and-count.

### Why This Chart Matters

The existing Epidemic Curve shows dengue *case count* trending against a baseline — a volume
signal. It says nothing about severity or clinical outcome, which is what actually determines
whether receiving hospitals need to prepare surge capacity. `DengueRow`'s WHO classification and
outcome fields are the only place in the schema with this information, and they're unused outside
the flat R-18 report — this is the natural "how bad is it" companion chart to the existing "how
much of it is there" Epidemic Curve, on a dataset the mock data has deliberately modeled as an
active outbreak.

---



## 19. Household Vulnerability Index by Barangay



### Business Question

Which barangays combine the highest concentrations of chronic-disease, TB, maternal, and elderly/
child dependents *with* the lowest social-safety-net coverage (PhilHealth, 4Ps) — the barangays
where a household-level community health worker surge would have the most impact?

### Data Required

`HouseholdProfileRow` (file-local interface in `src/lib/reports/lgu.mock.tsx`, report R-17
"Community Household Health Profile") -> fields `barangay, members, philhealthCoverage, fourPsPct, withDm, withHtn, withTb, pregnant, childrenUnder5, elderly`.

### Calculation

For each barangay, compute per-capita burden rates as **derived metrics**: `withDm/members`,
`withHtn/members`, `withTb/members`, `(pregnant+childrenUnder5+elderly)/members` (dependent/vulnerable
share). `philhealthCoverage` and `fourPsPct` are used as-is (**raw data**, already expressed as
percentages on the row). No cross-barangay aggregation — each barangay is plotted as its own row.

### Standard Visualization

Grouped/stacked horizontal bar chart, one bar group per barangay, combining the per-capita burden
rates with the two coverage percentages, sorted by a simple composite (e.g. total burden rate) for
easy scanning.

### D3 Recommendation

Standard grouped bar chart is sufficient — no D3 needed; with only 15 barangays and roughly 6
metrics each, a grouped bar (or small-multiples of simple bars) is clear and doesn't need force
layout or a matrix technique — this is squarely within what Recharts already handles well
elsewhere on the site.

### Relevant D3 Technique

N/A.

### Interaction

Hover for exact per-capita rates and coverage %; click a barangay to open its full
`HouseholdProfileRow` alongside its `BarangayMetricSet` (cross-referencing the existing choropleth
data for that same barangay).

### Implementation Complexity

Low-Medium — `HouseholdProfileRow` currently only feeds the R-17 flat report; needs the per-capita
derivation step, otherwise straightforward.

### Why This Chart Matters

This is the one chart in this set that combines *disease burden* (DM/HTN/TB) with *social
determinants* (PhilHealth coverage, 4Ps enrollment) and *demographic dependency* (pregnant,
under-5, elderly) at the same barangay grain — none of the existing per-program choropleths (NCD
burden, TB density) or the existing SDOH metric cards (city-wide only, no barangay breakdown) do
this. It's the household-level planning view a CHO would use to decide where to send the next
community health worker cohort.

---



## 20. Maternal Death Audit: Avoidability & Cause-of-Death Summary



### Business Question

Of the maternal deaths reviewed this period, how many were assessed as avoidable, and what are the
recurring causes — the core quality-improvement signal a Maternal & Child Health program needs to
act on?

### Data Required

`MaternalDeathRow` (file-local interface in `src/lib/reports/lgu.mock.tsx`, report R-13 "Maternal
Death Audit Report") -> fields `causeOfDeath, ancVisits, avoidable`.

### Calculation

Count of cases per `avoidable` value (Yes / No / Under review) is an **aggregated metric**
(`count(*) grouped by avoidable`, across the small case set in the reporting window). Count of
cases per `causeOfDeath` is a separate **aggregated metric**. Average `ancVisits` among avoidable-
"Yes" cases versus all cases is a **derived/aggregated comparison metric** (`mean(ancVisits) where avoidable="Yes"` vs. `mean(ancVisits)` overall) — a proxy check for whether inadequate antenatal
care contact correlates with avoidable deaths.

### Standard Visualization

A donut chart for avoidability breakdown paired with a horizontal bar for cause-of-death frequency;
given this report is explicitly small-N and restricted (`roleNote: "MHO and CHO only — restricted"`), a simple, honest two-panel summary is more appropriate than any dense visualization.

### D3 Recommendation

Standard donut + bar is sufficient — no D3 needed; with only 5 rows in the mock dataset, any denser
visualization technique would be misleading rather than clarifying, and both chart types are
already well-covered on the site.

### Relevant D3 Technique

N/A.

### Interaction

Click a cause-of-death segment to see the de-identified case list (`caseLabel`, `gravidaPara`,
`ancVisits`, `recommendations`); this view should carry the same MHO/CHO-only access restriction
the underlying report already declares.

### Implementation Complexity

Low — `MaternalDeathRow` already has every field needed; the only real work is respecting the
existing role-restriction on who can view it.

### Why This Chart Matters

This is currently a flat, restricted report table (R-13) with no chart representation anywhere.
It is the single most consequential quality-of-care metric in the maternal dataset, and it is
adjacent to — but answers a different question than — the existing Maternal Complications Rate
trend (incidence of complications among *living* patients) and Risk Stratification donut (risk
tier of *current* patients). This chart is the outcome-of-last-resort view that closes the loop on
"did our complications and risk-stratification programs actually prevent the worst outcome."

---



## Charts Considered But Rejected

- **Top Revenue-Generating Procedures Rollup** (from `DeptRevenueRow.topProcedures`, aggregated
across departments) — rejected as too close to the existing Procedure Volume & Revenue Treemap
on the Clinical dashboard (`ProcedureNode`, category → procedure, with volume/revenue/
avgRevenuePerCase already shown). A cross-department rollup of the same underlying concept
(procedure revenue) didn't clear the bar for a "meaningfully different angle."
- **TB Quarterly (NTP Form 6) Indicator Chart** (from `TbQuarterlyRow`, section × indicator ×
quarter) — rejected because the TB dashboard already covers case notification (TB Case Detection
Rate composed chart), treatment cascade (TB Treatment Cascade StageFlow), and treatment outcomes
(Treatment Outcomes donut) at monthly/cascade grain; re-presenting the same three concepts at
quarterly regulatory-reporting grain wasn't a genuinely new operational question, just a
different periodicity of the same story.
- **Real GeoJSON/Leaflet Map of Barangay Metrics** — rejected on two grounds: it would visualize
the same metrics the existing `BarangayChoropleth` tile-grid already shows (just with prettier
underlying geography, not new information), and `schema.md` contains no latitude/longitude or
boundary/geometry fields anywhere in the `Barangay` table or elsewhere — a true geographic map
would require inventing spatial data that doesn't exist in the mock schema.
- **Collection Trend by Agent** (from `CollectionPoint.agentA/agentB/agentC`) — rejected because
the existing Revenue dashboard's "Collection Trend" chart is explicitly described as having a
"switchable view," which plausibly already includes an agent-level cut of this same data; without
being able to confirm it's excluded, proposing it risked a direct duplicate rather than a new
angle.
- **Individual Patient Journey Timeline / Gantt** (a per-patient chronological view spanning
admission → labs → claims → discharge) — rejected because no table in `schema.md` links a single
patient's admission, lab, and claim events together with a shared identifier and timestamps
suitable for a timeline; `AdmissionRow`, `TatOutlier`, and `ClaimRow` each have their own
independent patient-naming/ID schemes (see `schema.md`'s Known Cross-File Inconsistencies #4) and
are not joinable in the mock data as it exists.
- **Physician Referral Network (Force-Directed Graph)** — rejected because no physician-to-
physician or facility-to-facility edge-list data exists in the schema; the closest table,
`SpecialtyAcceptance`, is a flat per-specialty acceptance-rate/response-time summary with no
relationship/edge structure, so a network diagram would require inventing connections the mock
data doesn't contain.

