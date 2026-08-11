# Top 20 Charts — SugboDoc Hospital Analytics

This document lists the twenty charts that carry the hospital (Type A) analytics side of SugboDoc
today. It is not a wish list and it is not a proposal to rebuild the site. It is grounded in three
things that already exist in this repository: **`chart-audit.md`** (the panel-by-panel audit of all
87 existing hospital charts, which returned 51 Keep / 36 Modify / **0 Replace**), **`schema.md`**
(which documents the shared synthetic hospital dataset at `src/lib/data/hospital/**` — Patients,
Encounters, Departments, Doctors, ServiceCatalog, Billing, PhilHealthClaim, PWDDiscount, Feedback,
plus the `derive.ts` query layer), and the four pages that were rebuilt or newly built against that
dataset: `src/routes/analytics.executive.tsx` (Overview, rebuilt), `src/routes/analytics.performance.tsx`
(new), `src/routes/analytics.revenue.tsx` + `src/routes/analytics.claims.tsx` (Financial and Claims,
migrated and improved per the audit), and `src/routes/analytics.patient-experience.tsx` (new).
Per the supervisor's explicit instruction — *"Do NOT blindly replace the existing charts with 20 new
charts… The Top 20 should therefore be a combination of: Keep + Improve + Add rather than simply:
Delete everything + create 20 new charts"* — every entry below is tagged **Existing** (kept as-is
because it already works), **Improved** (an audit "Modify" that was actually changed during this
implementation, with the change stated), or **New** (built to fill a gap the audit named). The split
is **9 New, 8 Improved, 3 Existing**. Nothing was deleted to make room: the 67 other audited panels
are still live on their pages.

**On D3.** There is no `d3.md` in this project — it was searched for exhaustively during the audit
and confirmed absent. The D3 recommendations below are therefore based on general D3.js knowledge,
and they follow what was actually built: in almost every case Recharts or a small hand-rolled SVG /
CSS component is the right tool and D3 would add a dependency without adding an answer. D3 is
recommended only where there is a genuine capability gap, and that is called out explicitly rather
than sprinkled across every entry.

## How the hierarchy works

The nav in `src/routes/analytics.tsx` is now split into two tiers. The first tier is the analysis
hierarchy, and it runs **Overview → Comparison → Financial/Claims investigation → Patient/Experience
investigation**: `/analytics/executive` (Overview — what is happening, what changed, what needs
attention, and handoff links into the deeper pages), `/analytics/performance` (Comparison — rank
departments, services, physicians and time periods against each other), `/analytics/revenue` and
`/analytics/claims` (Financial and Claims investigation — where the money leaks and where claims
stall), and `/analytics/patient-experience` (Patient/Experience investigation — who the patients are,
what they score us, and which operational conditions move the score). Every one of those five pages
mounts `GlobalHospitalFilterBar` from `src/components/analytics/hospital-filter-context.tsx`, so a
department or date selected on one page survives navigation to the next, and every number is derived
from `src/lib/data/hospital/derive.ts` so the pages reconcile with each other. Drill-down is the last
step of the hierarchy and lives inside those pages: a click on a bar, bubble, slice or stage opens a
drawer that ends at real `Encounter` / `Billing` / `PhilHealthClaim` / `Feedback` rows. The second
tier, labelled **Detail** in the nav, holds the specialist tools — Clinical, Quality, Laboratory,
Cohort Builder, Patterns, Alerts and the New Charts preview. Those still run on the legacy per-file
mock data in `src/lib/analytics/**` and deliberately do **not** mount the shared filter provider,
because a filter that silently does nothing is worse than no filter at all. See the closing section
for the honest migration status.

---

## 1. Department comparison — volume, revenue and a quality axis in one view

**Page:** Performance Analysis (`/analytics/performance`) · **New**

- **Purpose.** Rank every department against every other on a metric of the user's choosing, while
  simultaneously showing a second financial metric and a third quality metric, so "biggest" and
  "best" can be separated in one glance.
- **Decision-maker question.** Which departments are carrying the volume, which are converting that
  volume into revenue, and which are doing it while performing badly on care quality?
- **Data dimensions.** Department (8 rows) × three independently selectable measures. Sourced from
  `volumeByDepartment`, `revenueByDepartment`, `losStatsByDepartment`, `npsByDepartment` and
  `readmissionRateByPayerAndDepartment`, joined in the page-local `buildDeptRows()`.
- **Metrics.** Ten selectable per axis (`DEPT_METRICS`): encounters, inpatient admissions, gross
  revenue, cash collected, revenue per encounter, collection rate, mean length of stay, NPS index,
  30-day readmission rate, average daily census.
- **Why it is useful.** The audit's cross-cutting finding #4 was that comparison across departments
  existed only as unsorted tables or single-measure bars. This panel is the direct answer: a tall bar
  rendered red is a high-volume department performing badly on the quality metric, which no single-
  measure chart on the old site could express. A live-computed callout underneath names the
  department whose share of revenue diverges furthest from its share of encounters.
- **Visualization type.** Recharts `ComposedChart` — `Bar` on the left axis, `Line` on the right axis,
  dual labelled y-axes, mean `ReferenceLine`.
- **Multi-dimensional encoding.** Three meaningful variables, all user-chosen and all independent:
  **bar height** = primary metric, **line** = secondary metric on its own axis, **bar fill colour** =
  a third metric banded into tertiles by `bandRows()`, direction-aware via each metric's
  `higherIsBetter` flag. The colour is never a restatement of bar length, which is precisely the
  failure mode the audit flagged in 13 "Yes (weakly)" charts.
- **Sorting.** Full `SortControl`: sort by the bar metric, the line metric, the colour metric, or
  department name, with an explicit ascending/descending toggle. The sort applies to the **chart**,
  not only to the table view.
- **Drill-down.** Bar click and table-row click both open the department drawer with the real
  encounter list (`filterEncounters` narrowed to that `departmentId`, rendered through
  `toEncounterRecords`).
- **Filters.** All eight shared filters: date range, department, service, doctor, encounter type,
  payment status, PhilHealth claim status, PWD status.
- **Interactions.** Three metric selectors, sort field + direction, hover tooltip showing all three
  metrics plus the tertile band, "view as table" with 9 sortable columns, click-to-drill.
- **D3 recommendation.** None. A grouped composed chart with a colour scale is squarely inside
  Recharts; adding D3 here would buy nothing.
- **Priority.** High.
- **Existing / Improved / New.** **New.**

## 2. Physician comparison — volume, revenue and compliance

**Page:** Performance Analysis · **New**

- **Purpose.** Give physician-level comparison a real chart instead of an unsorted HTML table, and
  make it possible to rank doctors on one metric while measuring them on another.
- **Decision-maker question.** Who is high-volume but low-revenue, who is fully booked yet producing
  below-median revenue, and who has a compliance problem (uncoded diagnoses, denied claims,
  readmissions) rather than a productivity one?
- **Data dimensions.** Physician (20 doctors, filterable by a minimum-case floor) × department
  (colour in quadrant mode) × nine selectable measures. Built by `buildDoctorRows()` over
  `doctorProductivity()` plus a single pass over the same filtered encounter cohort for the three
  compliance signals the derive layer does not expose.
- **Metrics.** `DOCTOR_METRICS`: case volume, inpatient cases, gross revenue, revenue per case,
  capacity utilisation, mean LOS, ICD-10 coding completeness, PhilHealth denial rate, 30-day
  readmission rate.
- **Why it is useful.** The audit named physician-level comparison "the weakest analytical axis on
  the site" — only three panels compared doctors at all, two of them unsorted tables, and volume
  adjustment was inconsistent. This panel adds a case floor (0/5/10/20) so low-volume doctors are not
  falsely flagged, and a median reference so a rate is always read against its peer group.
- **Visualization type.** Two switchable views in one card: a ranked horizontal `BarChart` with a
  median `ReferenceLine`, and a `ScatterChart` productivity quadrant.
- **Multi-dimensional encoding.** *Ranked view:* bar length = chosen metric, bar colour = tertile band
  of that metric, median line = peer context (three layers). *Quadrant view:* **x** = cases handled,
  **y** = gross revenue, **bubble size** (`ZAxis`) = capacity utilisation, **bubble colour** =
  department, plus two median `ReferenceLine`s that encode the decision rule — five meaningful
  variables in one view.
- **Sorting.** `SortControl` over all nine metrics plus physician name, ascending/descending, applied
  to the chart. The sort field and the bar metric are deliberately independent, so you can rank by
  case volume while colouring and measuring on denial rate.
- **Drill-down.** Bar click, bubble click and table-row click all open the physician drawer with that
  doctor's real case list.
- **Filters.** All eight shared filters, plus the panel-local minimum-case floor.
- **Interactions.** View toggle, min-case floor, bar-metric selector, sort field + direction, tooltip
  carrying volume/revenue/compliance together, table view with 11 sortable columns.
- **D3 recommendation.** None. Recharts `ScatterChart` with `ZAxis` covers all five channels.
- **Priority.** High.
- **Existing / Improved / New.** **New.**

## 3. Volume & revenue trend by department

**Page:** Executive Overview (`/analytics/executive`) · **Improved**

- **Purpose.** Show twelve months of encounter volume broken out by department with gross revenue
  overlaid, so a volume story and a money story are read against each other rather than on two
  separate screens.
- **Decision-maker question.** Is the hospital growing, which departments are driving it, and is
  revenue tracking volume or diverging from it?
- **Data dimensions.** Month (12 buckets, 2025-09 → 2026-08) × department (8 series) × gross revenue.
  From `volumeByDepartmentAndMonth()` and `revenueByMonth()`.
- **Metrics.** Encounter count per department per month (or that department's % share of the month),
  and gross charges in PHP on a second axis.
- **Why it is useful.** The audit marked the old Admission Volume Trend "Keep" but flagged that its
  overlapping areas occluded each other and that clicking a month did nothing. Both are fixed, and
  the chart now carries the revenue series that used to require a separate panel.
- **Visualization type.** Recharts `ComposedChart` — 8 gradient-filled stacked `Area` series, a gold
  `Line` for gross revenue on a right-hand axis, and a `Brush` for range zoom.
- **Multi-dimensional encoding.** Three meaningful variables: **time** (x), **department** (stack
  colour), **encounter count** (stack height), plus a genuinely different fourth measure —
  **PHP gross revenue** — on its own axis. The 100%-share mode converts the stack to mix so that
  *composition shift* is separable from *total growth*.
- **Sorting.** Intentionally none on the x-axis: it is chronological and re-ordering time would be
  meaningless. Department series can be shown/hidden individually from the legend.
- **Drill-down.** Click any month on the chart, or any row in the table view, to open the month
  drawer.
- **Filters.** All eight shared filters apply on the dimension axes; the **date** filter deliberately
  does not, so the twelve-month shape stays readable — and that exception is stated on the chart, not
  hidden.
- **Interactions.** Stacked / 100%-share tabs, per-department legend toggles, brush zoom, rich
  tooltip, "view as table" with a Complete/Month-to-date column, click-to-drill.
- **What changed vs the audited version.** Re-sourced onto the shared dataset; department replaced
  service class as the stack dimension; gross revenue added as a second axis; the 100%-stacked toggle
  the audit asked for was added; month-level click-to-drill was added; and the month-to-date bucket is
  now explicitly labelled from `MonthMeta.isPartial` so its dip is not misread as a decline.
- **D3 recommendation.** None. Recharts composed area + brush is already the correct tool.
- **Priority.** High.
- **Existing / Improved / New.** **Improved.**

## 4. Where the departments differ — department positioning quadrant

**Page:** Executive Overview · **New**

- **Purpose.** Position all eight departments simultaneously on volume, yield and total size, so the
  Overview can answer "where are the differences?" without a table.
- **Decision-maker question.** Which service lines are high volume but low yield (the volume that
  costs the most to serve), and which are niche but high-margin?
- **Data dimensions.** Department × encounter volume × revenue per encounter × total gross revenue.
  Built from `revenueByDepartment()` joined to `npsByDepartment()` and
  `readmissionRateByPayerAndDepartment()` for the table view.
- **Metrics.** Encounters, PHP per encounter, gross revenue, outstanding balance, NPS, 30-day
  readmission rate.
- **Why it is useful.** It is the Overview's bridge into the Comparison tier — it shows *that* the
  departments differ and hands off to Performance Analysis for *how much*. The two median reference
  lines make the quadrant reading explicit rather than a matter of eyeballing.
- **Visualization type.** Recharts `ScatterChart` with `ZAxis` bubble sizing, two median
  `ReferenceLine`s, and persistent `LabelList` department names.
- **Multi-dimensional encoding.** Four meaningful variables: **x** = encounters, **y** = revenue per
  encounter, **bubble area** = gross revenue, **colour** = department identity, with median-volume and
  median-yield reference lines encoding the decision rule.
- **Sorting.** Not applicable to the scatter itself; the paired table view is sorted by gross revenue
  descending and is fully re-sortable.
- **Drill-down.** Bubble click and table-row click open the department drawer.
- **Filters.** All eight shared filters. The panel uses a minimum review window so a one-week filter
  cannot produce a scatter built on three encounters.
- **Interactions.** Hover tooltip with all six measures, click-to-drill, "view as table", and a direct
  handoff link to the Performance page's department comparison.
- **D3 recommendation.** None — but if persistent non-overlapping labels ever become a problem at
  higher cardinality, `d3-force` collision labelling is the standard fix. At 8 points it is not
  needed.
- **Priority.** High.
- **Existing / Improved / New.** **New.**

## 5. Gross-to-Net Revenue Bridge

**Page:** Financial Analysis (`/analytics/revenue`) · **Improved**

- **Purpose.** Show exactly where gross charges leak on the way to collected cash, with every step
  summing the same `Billing` columns so the bridge closes to the peso.
- **Decision-maker question.** Of everything we billed, how much did we actually keep, and which
  deduction is responsible for the largest part of the gap?
- **Data dimensions.** Waterfall step sequence (gross → PhilHealth benefit → PWD discount → net
  payable → collected → outstanding) × PHP magnitude × step kind, plus the same sequence for the
  prior period.
- **Metrics.** PHP per step, running total, and % of gross retained at each step.
- **Why it is useful.** The audit called this "the correct and complete answer" to the leakage
  question and marked it Keep. Its weaknesses were all contextual: no cumulative retention, no prior
  period, and an awkward tooltip that had to suppress the transparent base series.
- **Visualization type.** Recharts `BarChart` with a transparent floating `base` series (the standard
  waterfall construction), plus a second transparent-based ghost stack for the prior period.
- **Multi-dimensional encoding.** Three meaningful variables: **ordered step** (the sequence carries
  the analytical meaning), **PHP magnitude**, and **step kind** (start / deduction / subtotal / end)
  as colour. The prior-period ghost adds a fourth comparison layer.
- **Sorting.** Deliberately none — the step order *is* the semantics of a waterfall.
- **Drill-down.** Bar click opens the step drawer with the line-item breakdown behind that step.
- **Filters.** All eight shared filters.
- **Interactions.** Show/hide prior-period ghost, per-step summary chips showing "% of gross
  retained", a rewritten tooltip that reads the step row directly and reports the step delta, the
  running total and the retained share.
- **What changed vs the audited version.** Re-sourced onto `revenueByDepartment`/`revenueByMonth`;
  cumulative "% of gross retained" added per step; the prior-period ghost waterfall added; the
  tooltip rebuilt so it no longer has to suppress the base series.
- **D3 recommendation.** None.
- **Priority.** High.
- **Existing / Improved / New.** **Improved.**

## 6. Revenue by Department / Service Line

**Page:** Financial Analysis · **Improved**

- **Purpose.** Cross department against payer so that department size and department payer-dependency
  are legible in the same chart.
- **Decision-maker question.** Which departments generate the most revenue, from which payers, and
  which are dangerously concentrated on a single payer?
- **Data dimensions.** Department (category) × payer type (6 categories) × PHP — a true two-category
  cross. From `revenueByDepartment()` and `payerMix()` over the same filtered cohort.
- **Metrics.** Gross charges per department per payer, department total, collection rate, and each
  payer's share of the department.
- **Why it is useful.** The audit marked it Keep and named two real problems: the sort was hard-coded
  in the mock file so the user could not re-rank, and a 100%-stacked mode was missing so payer *mix*
  could not be compared between departments of different sizes.
- **Visualization type.** Recharts stacked horizontal `BarChart`, six stacked payer series.
- **Multi-dimensional encoding.** Three meaningful variables: **department** (y), **payer** (stack
  segment colour), **PHP** (segment length). The 100%-stacked mode turns the third variable into
  share, which is what makes cross-department mix comparison valid.
- **Sorting.** Six exposed options: highest revenue, lowest revenue, most PhilHealth-dependent, most
  private-pay, worst collection rate, department A–Z. The audit's specific complaint — a sort baked
  into the data file — is resolved.
- **Drill-down.** Segment click and table-row click open the department drawer with the per-payer
  split and the bills behind it.
- **Filters.** All eight shared filters.
- **Interactions.** Absolute / 100%-stacked toggle, sort selector, payer legend, tooltip that switches
  between PHP and share, "view as table".
- **What changed vs the audited version.** Re-sourced onto the shared dataset (so it now reconciles
  with the Overview's payer mix instead of using an independently declared `PayerSlice`); user-facing
  sort added with a payer-dependency and a collection-rate ordering; 100%-stacked mode added.
- **D3 recommendation.** None.
- **Priority.** High.
- **Existing / Improved / New.** **Improved.**

## 7. Drafted → Remittance pipeline

**Page:** Claims Analysis (`/analytics/claims`) · **Improved**

- **Purpose.** Show where PhilHealth claims stall between drafting and remittance, in both claim count
  and peso value, with an explicit measure of *how long* they have been stalled.
- **Decision-maker question.** Where in the claims cycle is our money sitting, how much of it is
  there, and which stage has breached its service level?
- **Data dimensions.** Pipeline stage (Drafted, Submitted, Under Review, Approved, Denied, Remitted)
  × claim count × case-rate value × average days in stage. From `claimsByStatus()` and the
  encounter-joined claim records.
- **Metrics.** Claims per stage, PHP case-rate value per stage, absolute and % drop-off vs the prior
  stage, count and value currently sitting at the stage, mean days in stage.
- **Why it is useful.** The audit called it "the most information-dense funnel on the site" and marked
  it Keep, with one gap: *where the delay is* required a drill-down to discover. That is now on the
  face of the chart, and stages beyond the SLA turn red.
- **Visualization type.** Hand-rolled horizontal stage bars (the audit's judgement that a funnel's
  sequence must not be drawn as a partition still holds), with a per-stage header line.
- **Multi-dimensional encoding.** Four meaningful variables: **stage sequence**, **claim count** (bar
  width), **PHP value**, and **average days in stage** — with SLA breach encoded as bar colour rather
  than left as text.
- **Sorting.** Deliberately none — the stage order is the semantics.
- **Drill-down.** Stage click opens the stage worklist: real `PhilHealthClaim` rows showing the claim
  id alongside the encounter and bill it belongs to, so every claim number on screen is traceable.
- **Filters.** All eight shared filters. Note the denominator is smaller than total encounters by
  construction — claims exist only for `philhealth` / `scpwd` payers — and the page states this.
- **Interactions.** Click-to-worklist per stage, SLA colouring, drop-off shown as both a count and a
  percentage, a companion pending-claim aging panel beside it.
- **What changed vs the audited version.** Re-sourced onto real `PhilHealthClaim` rows joined back to
  encounter/bill/patient/physician; average days in stage promoted from the drawer onto the bar;
  drop-off expressed as a % as well as a count; SLA breach colouring added.
- **D3 recommendation.** None.
- **Priority.** High.
- **Existing / Improved / New.** **Improved.**

## 8. Denial reasons — frequency, value at risk and Pareto

**Page:** Claims Analysis · **Improved**

- **Purpose.** Separate "most frequent denial reason" from "most expensive denial reason", and make
  the 80/20 point explicit.
- **Decision-maker question.** Which denial reasons should the claims team fix first — and is the
  most common one actually the one costing us the most?
- **Data dimensions.** Denial reason code (DN-01…DN-07, rendered with their human-readable reason)
  × claim count × PHP value at risk × cumulative share × appeal recovery. From
  `claimDenialReasons()`.
- **Metrics.** Denied claims per code, % of all denials, cumulative % of denials, PHP value at risk,
  appeals filed, appeals won, PHP recovered, recovery rate.
- **Why it is useful.** The audit marked this Keep but noted the y-axis showed only the opaque code,
  that value at risk and frequency diverge and could not be compared, and that no Pareto line existed.
  All three are addressed, and the remediation table underneath now carries the appeal-recovery column
  the audit asked for.
- **Visualization type.** Recharts `ComposedChart`, horizontal — `Bar` for denied claims on the bottom
  axis, `Line` for cumulative % on a second top axis scaled 0–100.
- **Multi-dimensional encoding.** Three meaningful variables: **reason** (y, labelled in words, not
  codes), **denial frequency** (bar length), **cumulative share of all denials** (Pareto line on its
  own axis). PHP value at risk and appeal recovery are the fourth and fifth variables, carried in the
  tooltip and in the paired remediation table where they can be read numerically and sorted.
- **Sorting.** Four exposed options: most frequent, highest value at risk, worst appeal recovery, code
  A–Z. The chart and the remediation table always share the same ordering.
- **Drill-down.** Bar click, table-row click and the per-row "Open worklist" button all open that
  specific denial code's claim worklist — fixing the audit's finding that the Executive page's version
  drilled to a generic "Denied" bucket without passing the reason code.
- **Filters.** All eight shared filters.
- **Interactions.** Sort selector, dual-axis tooltip, "view as table" with six sortable columns, plus
  the standalone remediation table with appeal counts and recovered PHP.
- **What changed vs the audited version.** Re-sourced onto real denial codes with `CLAIM_DENIAL_REASONS`
  labels; human-readable y-axis; cumulative Pareto line added; reason-specific drill-down; appeal and
  recovery columns added; user-facing sort added.
- **D3 recommendation.** None.
- **Priority.** High.
- **Existing / Improved / New.** **Improved.**

## 9. Case rate vs actual gross charges

**Page:** Claims Analysis · **Improved**

- **Purpose.** Identify the diagnoses where treating a patient costs more than PhilHealth reimburses,
  and rank them by *total* exposure rather than by per-case gap.
- **Decision-maker question.** Which conditions are we losing money on, and does that loss actually
  matter at our volume?
- **Data dimensions.** Diagnosis (ICD-10) × PhilHealth case rate × actual gross charge × claim volume
  × case type. Case rate comes from `PH_DIAGNOSIS_CASE_RATES` via the claim rows; actual charge from
  the joined `Billing`.
- **Metrics.** Case rate (PHP), actual average gross charge (PHP), claims, patients, gap per case, gap
  %, total exposure = gap × claims.
- **Why it is useful.** The audit called this "genuinely excellent" and marked it Keep, but flagged
  three concrete faults: the break-even diagonal was hard-coded to a 70,000 segment and would not
  extend, outliers were discoverable only on hover, and the case-type legend displayed without
  filtering. All three are fixed, and the "top by total exposure" companion list the audit
  recommended as the actionable ordering now exists.
- **Visualization type.** Recharts `ScatterChart` with `ZAxis` bubble sizing, a data-driven break-even
  `ReferenceLine`, and a second transparent `Scatter` layer carrying persistent outlier labels.
- **Multi-dimensional encoding.** Four meaningful variables plus a rule: **x** = case rate, **y** =
  actual charge, **bubble size** = claim volume, **colour** = case type, and the 45° break-even
  diagonal encodes the decision rule directly on the plot.
- **Sorting.** Not applicable to a scatter. The companion exposure list beneath it is ranked by
  `gap × claims` descending, which is the ordering that actually drives action.
- **Drill-down.** Point click and exposure-list click both open the diagnosis drawer with its claims.
- **Filters.** All eight shared filters, plus a panel-local case-type legend where clicking a case
  type genuinely removes it from the plot rather than merely dimming it.
- **Interactions.** Click-to-filter case-type chips, persistent labels on the worst outliers, margin-
  aware tooltip, click-to-drill, ranked exposure list.
- **D3 recommendation.** None. Recharts `ScatterChart` + `ZAxis` covers every channel used.
- **Priority.** High.
- **Existing / Improved / New.** **Improved.**

## 10. Experience vs operational load, by department

**Page:** Patient / Experience Analysis (`/analytics/patient-experience`) · **New**

- **Purpose.** Put patient experience and the operational reality that produces it on the same chart,
  and state the strength of the relationship numerically instead of asserting it in a caption.
- **Decision-maker question.** Which departments score worst with patients, and is that explained by
  their volume, their length of stay, or their readmission rate?
- **Data dimensions.** Department × an experience score × a selectable operational overlay. From
  `npsByDepartment()`, `volumeByDepartment()`, `losStatsByDepartment()` and
  `readmissionRateByPayerAndDepartment()`.
- **Metrics.** NPS index (−100…+100) or average CSAT (1–5) as the score; encounter volume, mean LOS or
  30-day readmission rate as the overlay; plus responses, detractor share and responses per 100
  encounters in the table.
- **Why it is useful.** The audit found the old satisfaction data was an explicit placeholder
  ("Connect patient feedback module") with a single unlabelled mini-bar. This panel is the first real
  experience analysis on the site, and it goes past ranking: the description line computes a **Pearson
  r** across departments on every filter change and states whether the relationship is weak, moderate
  or strong, so the correlation is a measured claim rather than a written one.
- **Visualization type.** Recharts `ComposedChart` — `Bar` for the score on a fixed-domain left axis,
  `Line` for the operational overlay on a right axis, hospital-average `ReferenceLine`.
- **Multi-dimensional encoding.** Three meaningful variables: **department** (x), **experience score**
  (bar height, with the hospital average drawn as a reference so every bar is read as a gap), and a
  genuinely different **operational measure** (line, own axis). Bar colour bands the NPS tier, which
  here is an intentional restatement for scannability and is labelled as such.
- **Sorting.** Six exposed options: worst score first, best score first, highest operational load,
  lowest operational load, most responses, department A–Z.
- **Drill-down.** Bar click and table-row click open the department drawer with that department's
  actual `Feedback` responses, including free-text comments and the encounter context behind each.
- **Filters.** All eight shared filters, plus a panel-level survey-window switch (full 12-month window
  vs the global date filter) — because post-discharge surveys are low volume and a one-week slice
  cannot rank eight departments. The switch only widens the date range; every other filter still
  applies in both modes.
- **Interactions.** Score selector, overlay selector, sort selector, tooltip carrying score +
  responses + overlay, "view as table" with ten sortable columns.
- **D3 recommendation.** None.
- **Priority.** High.
- **Existing / Improved / New.** **New.**

## 11. Physician claims performance — volume-adjusted

**Page:** Claims Analysis · **Improved**

- **Purpose.** Compare physicians on claim outcomes without letting a small denominator create a false
  outlier.
- **Decision-maker question.** Which physicians have a genuine claims problem, as opposed to two
  denied claims out of three?
- **Data dimensions.** Physician × claims filed × denial rate × case-rate value × department. Joined
  from `PhilHealthClaim` → `Encounter` → `Doctor`.
- **Metrics.** Claims filed, approval rate, denial rate, most common denial reason (with its count),
  case-rate value.
- **Why it is useful.** The audit called the old version "the *only* physician-comparison view in the
  entire hospital analytics module", noted it was a table with no sorting, and flagged that
  `commonDenialReason` was assigned positionally in the mock (`i % denialReasons.length`) and was
  therefore a label rather than a fact. Both are fixed.
- **Visualization type.** Recharts `ScatterChart` with `ZAxis`, three `ReferenceLine`s (peer median
  denial rate, peer median volume, and the 5% PhilHealth benchmark), backed by a paged sortable table.
- **Multi-dimensional encoding.** Four meaningful variables: **x** = claims filed (the denominator
  guard), **y** = denial rate, **bubble size** = case-rate value at stake, **colour** = performance
  band relative to the peer median and the benchmark. The two median lines encode the "is this a real
  outlier?" rule directly.
- **Sorting.** Five exposed options on the companion table: most claims filed, worst denial rate,
  worst approval rate, highest case-rate value, physician A–Z.
- **Drill-down.** Point click and row click open that physician's claim worklist.
- **Filters.** All eight shared filters. The panel is marked restricted (Admin / Claims Officer).
- **Interactions.** Click-to-drill, peer-band legend, sort selector, "show N more" paging.
- **What changed vs the audited version.** Re-sourced onto real claims; the volume-adjusted scatter and
  peer medians the audit recommended were added alongside the table; sorting added; `commonDenialReason`
  is now the genuine statistical mode of that physician's denial codes.
- **D3 recommendation.** None.
- **Priority.** High.
- **Existing / Improved / New.** **Improved.**

## 12. AR Aging by Payer

**Page:** Financial Analysis · **Improved**

- **Purpose.** Show which payers are sitting on the oldest receivables, and how much of each payer's
  balance is in the collection-risk bucket.
- **Decision-maker question.** Whose money is stuck, for how long, and where should the collections
  team spend the week?
- **Data dimensions.** Payer type × aging bucket (current / 31–60 / 61–90 / 90+) × PHP outstanding.
  From `arAgingByPayer()`.
- **Metrics.** Outstanding balance per bucket, total AR per payer, and the >90-day share as a
  percentage.
- **Why it is useful.** The audit marked it Keep with three named gaps: grouped bars made the total per
  payer unreadable, the >90-day share (the number leadership actually asks for) was not shown, and the
  bars were not clickable even though patient-level rows sat directly underneath.
- **Visualization type.** Recharts `BarChart`, switchable between grouped and stacked.
- **Multi-dimensional encoding.** Three meaningful variables: **payer** (x), **aging bucket** (an
  ordered category encoded as colour/series), **PHP** (bar height). The >90 share is a derived fourth
  read-out per payer.
- **Sorting.** Four exposed options: largest total AR, largest >90 exposure, worst >90 share, payer
  A–Z.
- **Drill-down.** Segment click opens that payer + that aging bucket's actual open accounts — the
  drill-down the panel previously did not have at all.
- **Filters.** All eight shared filters.
- **Interactions.** Grouped/stacked toggle, sort selector, per-payer summary chips that turn red above
  a 40% >90-day share, click-to-drill. The "Open accounts over 90 days" table below it is now sortable
  four ways, pageable beyond the old hard 8-row cap, and renders the `lastAction` column that the
  audit found was fetched and never displayed.
- **What changed vs the audited version.** Re-sourced onto the shared dataset; stacked/grouped toggle
  added; >90-day share surfaced per payer; drill-down added; the companion account table gained
  sorting, paging and its missing column.
- **D3 recommendation.** None.
- **Priority.** High.
- **Existing / Improved / New.** **Improved.**

## 13. What actually moves the score — experience driver correlations

**Page:** Patient / Experience Analysis · **New**

- **Purpose.** Quantify how much each operational failure costs in patient-experience points, by
  cross-referencing survey responses against the encounter, billing and claim records behind them.
- **Decision-maker question.** If we fix one thing, which one buys back the most patient goodwill?
- **Data dimensions.** Five operational conditions × the surveyed cohort split into "with" and
  "without" for each. Conditions: adverse discharge outcome (Expired / HAMA / Transferred), 30-day
  readmission, long stay above the department's P90 LOS, overdue or written-off bill, denied
  PhilHealth claim.
- **Metrics.** Cohort size on each side, average 0–10 NPS answer on each side, the gap in points, and
  the corresponding swing in the NPS index.
- **Why it is useful.** This is the panel that makes the shared dataset pay off. Feedback scores in
  `generate.ts` are constructed as a function of real operational outcomes rather than rolled
  independently, so this table is measuring a relationship that actually exists in the data — and it
  is the only place on the site where a satisfaction number is traced back to a billing status or a
  claim denial. The headline sentence above the table is auto-selected as the largest gap among
  cohorts with at least 20 responses on both sides, and it is recomputed on every filter change rather
  than being authored copy.
- **Visualization type.** A ranked comparison table with a computed headline callout. This is a
  deliberate choice, not a fallback: the useful output is five paired means and their differences, and
  a bar chart of five two-value comparisons would carry less information per pixel than the numbers.
- **Multi-dimensional encoding.** Intentionally not a multi-variable *encoding* — it is a paired
  comparison across five conditions, and its analytical value is the contrast (with vs without) rather
  than a spatial mapping. Small cohorts are explicitly badged "small n" below 20 responses so a large
  gap on a thin sample is visibly less trustworthy.
- **Sorting.** Three exposed options: biggest score gap, smallest score gap, largest cohort.
- **Drill-down.** Row click opens that driver's cohort — the actual survey responses from encounters
  that met the condition, with their comments and encounter context.
- **Filters.** All eight shared filters, plus the page's survey-window switch.
- **Interactions.** Sort selector, small-n badging, click-to-drill, an auto-computed headline that
  names the worst driver and states the rule it applied.
- **D3 recommendation.** None — this is a table by design.
- **Priority.** High.
- **Existing / Improved / New.** **New.**

## 14. Comorbidity Clustering

**Page:** Clinical Analytics (`/analytics/clinical`, Detail tier) · **Existing**

- **Purpose.** Show which diagnosis pairings drive the longest stays and the highest mortality.
- **Decision-maker question.** Which combinations of conditions should we build a care pathway for,
  because they cost the most days and the most lives?
- **Data dimensions.** Primary diagnosis + comorbid diagnosis pairing × department. From
  `ClinicalData.comorbidity -> ComorbidityBubble[]` (`primaryDx, comorbidDx, department, frequency,
  avgLos, mortalityRate`).
- **Metrics.** Pairing frequency, average length of stay, mortality rate.
- **Why it is useful.** The audit's verdict was "already exemplary multi-dimensionality" — it is the
  single best-encoded chart on the legacy side, and it answers a question no other panel on the site
  asks. It is kept exactly as built.
- **Visualization type.** Recharts bubble `ScatterChart` with `ZAxis`.
- **Multi-dimensional encoding.** Four meaningful variables: **x** = pairing frequency, **y** =
  average LOS, **bubble size** = mortality rate, **colour** = department.
- **Sorting.** Not applicable to a scatter. The audit's suggested improvement — a "highlight top N by
  mortality" control — has not been implemented and remains open.
- **Drill-down.** Bubble click opens a `DrillDrawer` with department, cohort size, average LOS and
  mortality rate. It is one level deep and terminal; extending it to a patient list remains open.
- **Filters.** None shared. This page is still on legacy mock data and does **not** mount the shared
  filter provider; its only local control is the ICD code picker on the neighbouring trend chart.
- **Interactions.** Hover tooltip, click-to-drill.
- **D3 recommendation.** Conditional and currently declined. A `d3-force` collision layout for
  persistent labels, or a chord / adjacency view showing *clusters* of co-occurring conditions, would
  show something a scatter cannot. Worth revisiting only if comorbidity network analysis becomes a
  stated requirement; the scatter answers the current question correctly.
- **Priority.** Medium (improvement priority — the chart itself is not at risk).
- **Existing / Improved / New.** **Existing.**

## 15. HAC Rate — Statistical Process Control chart

**Page:** Quality & Patient Safety (`/analytics/quality`, Detail tier) · **Existing**

- **Purpose.** Determine whether the hospital-acquired-condition rate is under statistical control, and
  flag the points that are special-cause rather than routine variation.
- **Decision-maker question.** Is this month's HAC rate a real signal that needs an investigation, or
  is it inside the noise band?
- **Data dimensions.** Period (time) × HAC category (switchable) × rate, against three control
  references. From `QualityData.hac -> HacPoint[]` (`period, rate, mean, ucl, lcl, category,
  specialCause`).
- **Metrics.** HAC rate per 1,000 patient-days, series mean, upper and lower control limits, and a
  special-cause flag.
- **Why it is useful.** The audit called it "structurally the most sophisticated chart in the module"
  and marked it Keep. SPC is the correct methodology for this question and nothing on the shared-
  dataset pages replaces it.
- **Visualization type.** Recharts `ComposedChart` — `Line` with a custom dot renderer, plus three
  `ReferenceLine`s for mean / UCL / LCL, and a special-cause callout list below the plot.
- **Multi-dimensional encoding.** Four meaningful layers: **time** (x), **rate** (y), **three control
  references**, and a **special-cause flag** encoded in dot size and colour.
- **Sorting.** None — chronological.
- **Drill-down.** Works from the special-cause callout list. It is **broken from the dots**: the dot's
  `onClick` passes a permanently empty `period` string, so clicking a point opens a drawer that finds
  no matching data. This is a known open defect recorded in `chart-audit.md`, not a claim of
  completeness.
- **Filters.** Category tabs only; no shared filter bar on this page. A second open defect: `mean`,
  `ucl` and `lcl` are flat constants read from `hac[0]`, so filtering by category does not recompute
  the limits.
- **Interactions.** Category tabs, hover tooltip, callout-list drill.
- **D3 recommendation.** None. SPC is well within Recharts; the outstanding work (standard run rules —
  seven-point runs, trends) is computation, not rendering.
- **Priority.** High (the two defects above should be fixed; the chart type is correct).
- **Existing / Improved / New.** **Existing.**

## 16. Service utilisation within department

**Page:** Performance Analysis · **New**

- **Purpose.** Rank the chargemaster services a selected patient cohort actually consumed, so
  department-level revenue can be decomposed into what was delivered.
- **Decision-maker question.** Inside this department, which services carry the revenue, and are they
  high-value services or high-volume cheap ones?
- **Data dimensions.** Service (58 catalogue items) × service category × cost-centre department ×
  five measures. From `serviceUtilization()`.
- **Metrics.** Encounters carrying the service, units delivered, charge-line revenue, revenue per
  encounter, share of the window's charge-line revenue.
- **Why it is useful.** No chart on the audited site connected departments to the services their
  patients consumed — the closest was the Clinical procedure treemap, which covers surgical procedures
  only. This panel also makes its cohort semantics explicit on screen: the department selector picks
  the *patients*, then every charge line on their encounters is counted, including ancillary lab and
  imaging owned by another cost centre. That is the department → service question, and it is why the
  "Cost centre" column in the table can legitimately differ from the department you selected.
- **Visualization type.** Recharts horizontal `BarChart` with a value `LabelList`, height scaled to
  the row count.
- **Multi-dimensional encoding.** Three meaningful variables: **service** (y), **the selected measure**
  (bar length), and **revenue per encounter** banded into tertiles as bar colour — so a long bar in red
  is high total spend spread thinly across many encounters, which bar length alone cannot say.
- **Sorting.** Five metrics plus service name, with an ascending/descending toggle, and a separate
  Top 10 / 15 / 25 / all selector. The panel header states what share of total charge-line revenue the
  displayed subset covers, so truncation is never silent.
- **Drill-down.** Bar click and table-row click open the service drawer listing the encounters that
  carried that service.
- **Filters.** All eight shared filters, plus a panel-local department focus selector that can either
  follow the global filter or override it.
- **Interactions.** Department focus, top-N, sort field + direction, tooltip with revenue per
  encounter as the target, "view as table" with eight sortable columns.
- **D3 recommendation.** None.
- **Priority.** Medium.
- **Existing / Improved / New.** **New.**

## 17. Time-period comparison by department

**Page:** Performance Analysis · **New**

- **Purpose.** Compare two time windows department by department, and rank by movement rather than by
  size.
- **Decision-maker question.** Which departments moved most between these two periods, and did the
  hospital total move with them or against them?
- **Data dimensions.** Department × two time periods × one selectable measure. Built by
  `buildPeriodComparison()` over two independent `EncounterFilter` windows.
- **Metrics.** Encounters, gross revenue, cash collected, revenue per encounter — each shown for both
  periods with the absolute and percentage change. Rate metrics are re-derived from numerator and
  denominator for the hospital total row, because a per-encounter rate cannot be summed across
  departments.
- **Why it is useful.** Period-over-period comparison previously existed only as a delta chip on a KPI
  card, with no way to see which department produced the delta. This panel makes the movement itself
  the sortable dimension.
- **Visualization type.** Recharts grouped `BarChart`, two bars per department, plus a "biggest movers"
  ranked table that always shares the chart's ordering.
- **Multi-dimensional encoding.** Three meaningful variables: **department** (x), **period** (paired
  bars), **measure magnitude** (bar height), with the derived change surfaced in the tooltip and as
  the primary sort key.
- **Sorting.** Five exposed options — % change (the default, because it answers the panel's own
  question), absolute change, period A, period B, department name — with a direction toggle. The sort
  reorders departments, never time.
- **Drill-down.** Either bar, or a movers-table row, opens period A's encounters for that department.
- **Filters.** All eight shared filters, plus a comparison-basis control: filtered range vs the
  immediately preceding equal-length window, or any two months the user picks.
- **Interactions.** Metric selector, basis selector, two month pickers, sort field + direction. If
  either selected month is the dataset's month-to-date bucket, a warning banner appears telling the
  reader to treat the % change as directional rather than like-for-like — the partial-month trap the
  audit flagged, handled explicitly.
- **D3 recommendation.** None.
- **Priority.** Medium.
- **Existing / Improved / New.** **New.**

## 18. PWD Mandatory Discount by Department

**Page:** Financial Analysis · **New**

- **Purpose.** Show the statutory RA 10754 discount the hospital actually absorbed, per department,
  sourced row-by-row rather than by applying a rate.
- **Decision-maker question.** How much mandatory discount are we carrying, where is it concentrated,
  and how much of each department's charges even qualify for it?
- **Data dimensions.** Department × qualifying amount × discount absorbed × discounted bill count.
  From `pwdDiscountByDepartment()`, i.e. the `PWDDiscount` table.
- **Metrics.** Discounted bills, qualifying amount (PHP), discount absorbed (PHP), VAT-exempt value
  (PHP).
- **Why it is useful.** This is the supervisor's own worked example of a data-integrity rule — a
  discount must only ever appear where the transaction genuinely qualifies — made visible. The panel
  enforces it structurally rather than by convention: the generator only emits a `PWDDiscount` row for
  a bill belonging to a `Patient.isPWD === true` patient with a qualifying amount, and the chart
  applies **no rate anywhere**. A department with no PWD-qualifying bill therefore renders as absent,
  not as an estimate. The statutory 20% is displayed from the `PWD_DISCOUNT_RATE` constant as a badge,
  never multiplied into a value.
- **Visualization type.** Recharts horizontal `BarChart`, two bars per department.
- **Multi-dimensional encoding.** Three meaningful variables: **department** (y), **qualifying amount**
  and **discount absorbed** as two paired bars on a shared PHP scale — so the gap between them shows
  how much of the department's charge base is *not* discount-eligible. Room & Board is excluded from
  qualifying categories, which is why the qualifying amount sits well below gross, and the panel says
  so on screen.
- **Sorting.** Four exposed options: largest discount absorbed, largest qualifying amount, most
  discounted bills, department A–Z.
- **Drill-down.** Either bar, or a table row, opens that department's discounted bills.
- **Filters.** All eight shared filters, including the PWD-status filter, which lets the whole page be
  narrowed to PWD or non-PWD patients.
- **Interactions.** Sort selector, tooltip with all four measures, "view as table", click-to-drill, and
  a computed footnote stating how many bills across how many PWD-flagged patients carried a discount
  and what share of gross charges that represents. A companion monthly panel ("PWD Discount Volume &
  Impact") separates a rise driven by more PWD patients from a rise in average discount by plotting a
  derived discount-per-bill line alongside the count.
- **D3 recommendation.** None.
- **Priority.** Medium.
- **Existing / Improved / New.** **New.**

## 19. SSI Rate — Funnel Plot by Surgeon

**Page:** Quality & Patient Safety (Detail tier) · **Existing**

- **Purpose.** Distinguish surgeons whose surgical-site-infection rate is a true outlier from those
  whose rate is small-sample noise.
- **Decision-maker question.** Is this surgeon's infection rate a real problem, or an artefact of
  operating on twelve patients?
- **Data dimensions.** Surgeon × case volume × observed SSI rate, against an expected-rate reference.
  From `QualityData.ssi.surgeons -> SsiSurgeon[]` (`surgeon, department, caseVolume, observedRate,
  expectedRate, outlier`).
- **Metrics.** Case volume, observed SSI rate, expected rate, outlier flag.
- **Why it is useful.** The audit marked it Keep and called it "methodologically the right chart" —
  volume adjustment is the entire point of a funnel plot and this is the only panel on the site that
  does it correctly. It is the model the rest of the site is being moved toward (the new Performance
  and Claims physician panels both adopted its median-and-denominator approach).
- **Visualization type.** Recharts `ScatterChart` with an expected-rate `ReferenceLine`, outlier points
  coloured red.
- **Multi-dimensional encoding.** Four meaningful variables: **x** = case volume, **y** = observed
  rate, **reference line** = expected rate, **colour** = outlier flag.
- **Sorting.** Not applicable to a scatter; the audit's recommended companion ranked list by
  (observed − expected) × volume has not been built and remains open.
- **Drill-down.** Point click opens the surgeon's department, volume, observed vs expected rate and
  funnel status.
- **Filters.** None shared — this page is still on legacy mock data.
- **Interactions.** Hover tooltip, click-to-drill.
- **D3 recommendation.** None, and explicitly so. The one real gap is that it is a funnel plot
  *without funnel limits* — the curved 95% / 99.8% control bounds that make it volume-adjusting rather
  than merely a scatter. Those are two computed paths and Recharts can render them as a `Line` over a
  synthetic series; this is arithmetic, not a rendering-library problem. The current `outlier` flag is
  also a crude ratio test (>1.8× or <0.25× expected) rather than a confidence-interval test.
- **Priority.** High (the funnel limits are the highest-value fix in the Detail tier).
- **Existing / Improved / New.** **Existing.**

## 20. Experience across the demographic split — age band × gender

**Page:** Patient / Experience Analysis · **New**

- **Purpose.** Establish whether a *demographic* — not just a department — is having a worse
  experience, and show the panel it is measured against.
- **Decision-maker question.** Are we failing a particular age group, and is that group large enough
  for the finding to matter?
- **Data dimensions.** Patient age band (7 bands: <1, 1–4, 5–17, 18–39, 40–59, 60–74, 75+) × gender ×
  survey score × response count. The scores come from the filtered `Feedback` records joined to
  `Patient.birthDate` through `ageBand(ageOn(...))`; the companion pyramid comes from
  `patientAgeMix()`.
- **Metrics.** NPS index per age band, average CSAT per age band, response count, and the male/female
  split of respondents. The companion pyramid carries registered-patient counts by band and gender.
- **Why it is useful.** Demographic analysis did not exist anywhere on the audited hospital side. This
  pairing answers two different questions honestly: the experience chart says *who is unhappy*, and the
  population pyramid beside it says *how many of them there are*, which is the denominator you need
  before acting on a −40 NPS in a band with nine respondents.
- **Visualization type.** Recharts `ComposedChart` — `Bar` for the NPS index on a fixed −100…+100 axis,
  `Line` for response count on a second axis, hospital-NPS `ReferenceLine`. The companion demographic
  panel is a Recharts `BarChart` with `stackOffset="sign"` — a proper back-to-back population pyramid
  with male plotted negative and female positive.
- **Multi-dimensional encoding.** Three meaningful variables in the experience chart: **age band** (x),
  **NPS index** (bar height, colour-banded by tier, read against the hospital reference line), and
  **sample size** (response-count line on its own axis) — so a dramatic score on a thin band is
  visibly thin. The companion pyramid crosses **age band** × **gender** × **headcount**.
- **Sorting.** Four exposed options on the experience chart: natural age-band order (default), worst
  NPS first, best NPS first, most responses. The pyramid offers natural order, largest band first,
  smallest band first.
- **Drill-down.** Bar click and table-row click open that age band's survey responses with their
  comments and encounter context.
- **Filters.** All eight shared filters plus the survey-window switch, for the experience chart. The
  population pyramid is deliberately **not** narrowed by the encounter filters — it describes the
  registered patient panel, not the filtered encounter cohort — and the panel description states this
  explicitly rather than letting the reader assume otherwise.
- **Interactions.** Sort selectors, dual-axis tooltip reporting NPS index, average CSAT, response count
  and the male/female split, "view as table" on both panels, click-to-drill.
- **D3 recommendation.** None. A signed stacked bar is the standard population-pyramid construction and
  Recharts supports it directly.
- **Priority.** Medium.
- **Existing / Improved / New.** **New.**

---

## Status — what is not yet migrated

This is a phased migration, and this document should not be read as a claim that the whole site is
finished. Five of the eleven hospital analytics routes are done; the rest are not.

**On the shared dataset (`src/lib/data/hospital/**`), with the shared filter bar and reconciled
figures:** Executive Overview, Performance Analysis, Financial Analysis, Claims Analysis, Patient /
Experience Analysis. Every number on these five pages comes from `derive.ts`, so they agree with each
other by construction.

**Still on legacy per-file mock data (`src/lib/analytics/**`), grouped under the "Detail" tier in the
nav:** Clinical Analytics, Quality & Patient Safety, Laboratory Analytics, Cohort Builder, Temporal
Pattern Analysis, Alert & Notification Center, and the New Charts preview
(`src/components/analytics/Top20NewCharts.tsx`). These pages deliberately do **not** mount
`HospitalFilterProvider` — a shared filter that silently changes nothing would be worse than not
offering one — so entries 14, 15 and 19 above have no shared filtering, and their drill-downs remain
one level deep and terminal. `schema.md` documents each of these legacy tables under "Legacy Mock Data
(Pending Migration)", and the known cross-file inconsistencies it lists (independently declared
`PayerSlice` / `PayerTrendPoint`, `"Emergency"` vs `"Emergency Medicine"`, `"OB-Gyne"` vs
`"Obstetrics"`, separate physician rosters in `claims.mock.ts` / `quality.mock.ts` /
`laboratory.mock.ts`) are still true for those pages.

Known open defects on the un-migrated pages, carried forward from `chart-audit.md` rather than quietly
dropped: the Quality HAC control chart's dot `onClick` passes a permanently empty `period` string so
point clicks find no data, and its control limits are read from `hac[0]` and do not recompute when the
category filter changes; the SSI funnel plot has no funnel limit curves and uses a ratio test rather
than a confidence interval; the Laboratory TAT box plot jitters its outlier dots with `Math.random()`
inside the render function, violating the codebase's deterministic-seeding rule; the Cohort Builder's
results table has sorting and row-click explicitly wired to no-ops despite `ReportTable` supporting
both; and every Laboratory KPI drawer renders the same "connect the module" placeholder.

Migrating those seven routes onto the shared dataset — and folding the strongest New Charts preview
panels (the ward occupancy × discharge-readiness heat grid and the payer × department readmission
matrix, both marked Keep and both currently on an unlinked preview page) into real routes — is the
next phase, not a completed one.
