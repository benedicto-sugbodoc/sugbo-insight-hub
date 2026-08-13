# New Charts Tab — Reporting Script

*A short walkthrough script for demoing the "New Charts" (Top 20) dashboard tab. Covers this tab only — every other dashboard tab is out of scope.*

## Opening line

"This is the New Charts tab — 20 new analytics panels added on top of the existing hospital and LGU dashboards, with shared filtering and drill-down across all of them."

## What's in it — 20 charts at a glance

"Charts 1–12 are hospital-side; 13–20 are LGU/city-health side. Every chart is real — no placeholders."

1. **Mortality Rate by Diagnosis** — which diagnoses carry the highest mortality burden, and is it concentrated in a few conditions.
2. **ALOS by Admission Type** — whether emergency, elective, transfer-in and newborn admissions differ meaningfully in length of stay.
3. **Physician Productivity Quadrant** — who's high-volume but low-revenue (undercoding), and who's high-revenue with a low PhilHealth approval rate.
4. **Ward Occupancy & Discharge Readiness Heatmap** — which wards are gridlocked today: full beds plus a backlog of patients ready to leave.
5. **Departmental AR Trend** — which departments' uncollected receivables are trending worse month over month.
6. **PhilHealth Remittance Batch Status & Value Tracker** — how much expected remittance is stuck in un-received batches, and which case types drive the delay.
7. **Claims Reimbursement Structure by Case Type** — how much of each case type's charge is covered by CR1+CR2 versus left as patient out-of-pocket.
8. **Appeal Recovery Funnel & Amount Recovered** — of denied claims, how many get appealed and how much PHP is actually recovered.
9. **Formulary Generic-Substitution Rate by Drug** — which drugs have the worst generic-substitution compliance, so P&T knows where to enforce the formulary.
10. **Lab Test Efficiency: Volume vs. TAT** — which lab tests combine high order volume with slow turnaround, the biggest throughput wins.
11. **Discharge Readiness Blockers** — the single most common blocker keeping patients from a clean discharge.
12. **Readmission Rate Matrix: Payer × Department** — whether 30-day readmissions concentrate in specific payer-and-department combinations.
13. **BHC-to-Hospital Referral Network** — which BHCs refer to which hospitals, for what reason, with what outcome, and where the feedback loop breaks.
14. **Immunization Coverage Matrix (Barangay × Antigen)** — which barangay is missing which specific vaccine, for targeting a catch-up campaign.
15. **NCD Burden vs. Control Bubble Chart** — which barangays combine a high NCD burden with poor treatment control.
16. **FHSIS Program Section Achievement Rollup** — across the six FHSIS sections, which one is furthest behind target this period.
17. **Konsulta Utilization Rate by Membership Type** — which PhilHealth Konsulta membership segment is under-utilizing its benefit.
18. **Dengue Case Severity & Outcome Breakdown** — given the active outbreak, how severe cases are and whether hospitalization burden is rising.
19. **Household Vulnerability Index by Barangay** — which barangays combine the highest household disease/dependency burden with the weakest safety-net coverage.
20. **Maternal Death Audit: Avoidability & Cause of Death** — of maternal deaths reviewed, how many were avoidable and what causes keep recurring.

## How filtering works

"Two filters run across the whole tab: **Department** and **Barangay**. A sticky header at the top lets you pick either from a dropdown, or click straight into a chart to drill in — both do the same thing. Active filters show as removable chips, with a one-click 'Clear all.' Charts that share a dimension respond together; charts that don't stay independent rather than faking a filter that wouldn't do anything."

## Recent improvements — worth calling out

**Ward Occupancy Heatmap (#4):** now has a sort control — arrange wards by name, occupancy, or pending-discharge backlog, so the worst bottleneck rises to the top instantly.

**Departmental AR Trend (#5):** rebuilt as a cleaner comparison chart —
- A bold **Hospital total** line anchors the view; department lines are thin and subdued by default.
- A **View** dropdown switches between All Departments, Worsening/Improving Only, Top 3 Worsening/Improving, or a custom comparison set.
- A **Period** control (3/6/12 months or all-time) rescopes the trend.
- A live summary line reads out how many departments are worsening month-over-month and which one is worst.
- Legend lets you hover to preview a line, toggle visibility per department, or click a name to drill in — each interaction is distinct so nothing conflicts with the existing filter behavior.

## Closing line

"Everything here is scoped to this one tab — no other dashboard, nav item, or dataset was touched to build it."
