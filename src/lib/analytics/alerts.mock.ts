import type { AlertItem } from "@/components/analytics/alert-center";

export const hospitalAlerts: AlertItem[] = [
  {
    id: "AL-H01",
    severity: "critical",
    title: "ICU occupancy at 96% — no available critical beds",
    detail:
      "ICU has 1 of 25 beds free. Medicine Ward is also above 90%. Review step-down and discharge-ready patients.",
    module: "Census",
    minutesAgo: 8,
    actionLabel: "Open bed management",
    actionHref: "/reports/daily-census",
  },
  {
    id: "AL-H02",
    severity: "critical",
    title: "3 STAT lab results unacknowledged for over 2 hours",
    detail:
      "Critical values pending physician acknowledgement: 2 troponin, 1 potassium. Longest pending 3h 20m.",
    module: "Laboratory",
    minutesAgo: 22,
    actionLabel: "Open lab results",
    actionHref: "/reports/laboratory-workload",
  },
  {
    id: "AL-H03",
    severity: "critical",
    title: "PhilHealth claims batch rejected — 42 claims, ₱610,000 at risk",
    detail:
      "Batch BATCH-2026-08-03 returned for incomplete supporting documents. 60-day filing window closes in 6 days.",
    module: "Claims",
    minutesAgo: 47,
    actionLabel: "Open denial & appeal tracker",
    actionHref: "/reports/denial-appeal-tracker",
  },
  {
    id: "AL-H04",
    severity: "warning",
    title: "Discharge clearance queue backing up",
    detail:
      "14 patients pending clearance signatures for over 4 hours, blocking bed turnover in Medicine Ward.",
    module: "Inpatient",
    minutesAgo: 63,
    actionLabel: "Open discharge queue",
    actionHref: "/reports/discharge-clearance-audit",
  },
  {
    id: "AL-H05",
    severity: "warning",
    title: "CSF signatures missing ahead of filing deadline",
    detail:
      "31 encounters are missing Claim Signature Form signatures required before PhilHealth filing.",
    module: "Billing",
    minutesAgo: 95,
    actionLabel: "Open encounters",
    actionHref: "/reports/philhealth-claims-register",
  },
  {
    id: "AL-H06",
    severity: "warning",
    title: "3 physician PRC/PAN registrations expiring within 30 days",
    detail:
      "Dr. R. Ocampo, Dr. K. Mendoza and Dr. L. Cabrera require renewal to remain active in the credentialing system.",
    module: "Settings",
    minutesAgo: 210,
    actionLabel: "Open practitioner registry",
  },
  {
    id: "AL-H07",
    severity: "info",
    title: "Monthly morbidity report (DOH CY-2) due in 5 days",
    detail:
      "August CY-2 submission deadline is Aug 12. Draft is 80% complete based on current encounter data.",
    module: "Reports",
    minutesAgo: 340,
    actionLabel: "Open morbidity summary",
    actionHref: "/reports/morbidity-summary",
  },
  {
    id: "AL-H08",
    severity: "info",
    title: "Formulary update published",
    detail:
      "12 new items added to the hospital formulary effective this week. Prescribers should refresh their order sets.",
    module: "Pharmacy",
    minutesAgo: 480,
    actionLabel: "Open formulary compliance",
    actionHref: "/reports/formulary-compliance",
  },
  {
    id: "AL-H09",
    severity: "info",
    title: "Scheduled system maintenance — Sat 11:00 PM to 1:00 AM",
    detail:
      "SugboDoc will be briefly unavailable for a database maintenance window. No action required.",
    module: "System",
    minutesAgo: 600,
    actionLabel: "View maintenance notice",
  },
];

export const hospitalAlertRefreshPool: AlertItem[] = [
  {
    id: "AL-H10",
    severity: "warning",
    title: "Emergency Department wait time above target",
    detail:
      "Average door-to-provider time is 48 minutes, above the 30-minute target for the past hour.",
    module: "Census",
    minutesAgo: 0,
    actionLabel: "Open bed management",
    actionHref: "/reports/daily-census",
  },
  {
    id: "AL-H11",
    severity: "info",
    title: "New lab result batch received from reference laboratory",
    detail: "18 outsourced results were just posted and are ready for physician review.",
    module: "Laboratory",
    minutesAgo: 0,
    actionLabel: "Open lab results",
    actionHref: "/reports/laboratory-workload",
  },
  {
    id: "AL-H12",
    severity: "critical",
    title: "Blood bank O-negative supply below safety stock",
    detail: "2 units remaining. Coordinate with the regional blood center for urgent restock.",
    module: "Laboratory",
    minutesAgo: 0,
    actionLabel: "Open lab results",
    actionHref: "/reports/laboratory-workload",
  },
];
