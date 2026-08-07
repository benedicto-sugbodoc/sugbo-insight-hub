import type { AlertItem } from "@/components/analytics/alert-center";

export const lguAlerts: AlertItem[] = [
  {
    id: "AL-L01",
    severity: "critical",
    title: "Dengue cases 2.6× baseline for 3 consecutive weeks",
    detail:
      "Barangay Talamban has crossed the outbreak-investigation threshold (2× baseline sustained). Trigger DOH notification.",
    module: "Surveillance",
    minutesAgo: 12,
    actionLabel: "Open dengue surveillance report",
    actionHref: "/lgu/reports/dengue-surveillance-pidsr",
  },
  {
    id: "AL-L02",
    severity: "critical",
    title: "TB treatment interruption risk — 8 patients",
    detail:
      "8 active TB-DOTS patients have missed medication pickup for more than 7 days across 4 barangays.",
    module: "TB-DOTS",
    minutesAgo: 35,
    actionLabel: "Open TB quarterly report",
    actionHref: "/lgu/reports/tb-quarterly-ntp",
  },
  {
    id: "AL-L03",
    severity: "critical",
    title: "Cold chain temperature excursion — Guadalupe RHU",
    detail:
      "Vaccine refrigerator logged 9.2°C for 40 minutes, above the 2–8°C safe range. Affected vials flagged for review.",
    module: "Immunization",
    minutesAgo: 58,
    actionLabel: "Open immunization coverage report",
    actionHref: "/lgu/reports/immunization-coverage-antigen-barangay",
  },
  {
    id: "AL-L04",
    severity: "warning",
    title: "Immunization coverage below 80% in 2 barangays",
    detail:
      "Inayawan (74%) and Sambag I (77%) are below the herd-immunity planning threshold this quarter.",
    module: "Immunization",
    minutesAgo: 90,
    actionLabel: "Open immunization coverage report",
    actionHref: "/lgu/reports/immunization-coverage-antigen-barangay",
  },
  {
    id: "AL-L05",
    severity: "warning",
    title: "eKAS claims cutoff in 4 days — 186 unsettled",
    detail:
      "₱8.24M in submitted Konsulta claims across 15 BHCs, with 186 still unsettled ahead of the PhilHealth cutoff.",
    module: "Konsulta",
    minutesAgo: 140,
    actionLabel: "Open Konsulta utilization report",
    actionHref: "/lgu/reports/konsulta-enrollment-utilization",
  },
  {
    id: "AL-L06",
    severity: "warning",
    title: "3 high-risk maternal cases overdue for follow-up",
    detail:
      "High-risk pregnancies in Labangon and Pardo have not had a documented ANC visit in over 3 weeks.",
    module: "Maternal Health",
    minutesAgo: 205,
    actionLabel: "Open maternal death audit report",
    actionHref: "/lgu/reports/maternal-death-audit",
  },
  {
    id: "AL-L07",
    severity: "info",
    title: "FHSIS monthly report due in 6 days",
    detail:
      "August FHSIS submission deadline is Aug 13. Draft is auto-populated from current BHC encounter data.",
    module: "Reports",
    minutesAgo: 300,
    actionLabel: "Open FHSIS monthly report",
    actionHref: "/lgu/reports/fhsis-monthly",
  },
  {
    id: "AL-L08",
    severity: "info",
    title: "New DOH memo: updated dengue case classification",
    detail:
      "DOH Epidemiology Bureau issued revised PIDSR classification guidance effective this reporting period.",
    module: "Surveillance",
    minutesAgo: 420,
    actionLabel: "Open dengue surveillance report",
    actionHref: "/lgu/reports/dengue-surveillance-pidsr",
  },
  {
    id: "AL-L09",
    severity: "info",
    title: "Immunization outreach scheduled — Talamban, next Tuesday",
    detail:
      "Mobile immunization team confirmed for Talamban RHU, targeting the 12–23 month age group.",
    module: "Immunization",
    minutesAgo: 540,
    actionLabel: "Open immunization coverage report",
    actionHref: "/lgu/reports/immunization-coverage-antigen-barangay",
  },
];

export const lguAlertRefreshPool: AlertItem[] = [
  {
    id: "AL-L10",
    severity: "warning",
    title: "Referral feedback overdue — Vicente Sotto Memorial",
    detail: "6 referrals sent over 14 days ago have no outcome documented yet.",
    module: "Referrals",
    minutesAgo: 0,
    actionLabel: "Open referral network analysis",
    actionHref: "/lgu/reports/referral-network-analysis",
  },
  {
    id: "AL-L11",
    severity: "info",
    title: "New batch of household health profiles synced",
    detail: "42 new household records were synced from the Basak Pardo Health Center this week.",
    module: "Community Health",
    minutesAgo: 0,
    actionLabel: "Open household health profile report",
    actionHref: "/lgu/reports/community-household-health-profile",
  },
  {
    id: "AL-L12",
    severity: "critical",
    title: "Suspected measles case reported — Tisa",
    detail:
      "1 suspected measles case pending lab confirmation. Isolation precautions advised per DOH protocol.",
    module: "Surveillance",
    minutesAgo: 0,
    actionLabel: "Open dengue surveillance report",
    actionHref: "/lgu/reports/dengue-surveillance-pidsr",
  },
];
